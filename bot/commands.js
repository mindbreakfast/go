const config = require('../config');
const database = require('../database/database');

// ===== КОНСТАНТЫ =====
const ADD_CASINO_STEPS = {
    NAME: 'name',
    PROMOCODE: 'promocode',
    SHORT_DESC: 'short_desc',
    FULL_DESC: 'full_desc',
    URL: 'url',
    CATEGORY: 'category',
    KEYWORDS: 'keywords',
    CONFIRM: 'confirm'
};

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function isAdmin(userId) {
    return config.ADMINS.includes(Number(userId));
}

function getNextCasinoId() {
    const casinos = database.getCasinos();
    return casinos.length > 0 ? Math.max(...casinos.map(c => c.id)) + 1 : 1;
}

function getCasino(id) {
    return database.getCasinos().find(c => c.id === id);
}

// ===== ОБРАБОТЧИКИ КОМАНД =====

// Обработчик команды /start
function handleStartCommand(bot, msg) {
    const user = msg.from;
    database.trackUserAction(user.id, user, 'start');


    if (msg.text && msg.text.includes('request_approval')) {
    database.requestApproval(user.id, user.username || 'не указан');
    bot.sendMessage(msg.chat.id, '✅ Ваш запрос на доступ отправлен админам! Ожидайте одобрения.');
    return;
}



    
    // Обработка реферальной ссылки
    if (msg.text && msg.text.includes(' ')) {
        const referralCode = msg.text.split(' ')[1];
        if (referralCode.startsWith('ref')) {
            const referrerId = parseInt(referralCode.substring(3));
            if (!isNaN(referrerId) && referrerId !== user.id) {
                database.handleReferralStart(user.id, referrerId);
                console.log(`User ${user.id} was referred by ${referrerId}`);
            }
        }
    }

    const keyboard = {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: '🎰 ОТКРЫТЬ СПИСОК КАЗИНО',
                    web_app: { url: config.WEB_APP_URL }
                }
            ]]
        }
    };

    bot.sendMessage(msg.chat.id, 'Добро пожаловать! Нажмите кнопку ниже чтобы открыть список казино:', keyboard);
}

// Обработчик команды /help
function handleHelpCommand(bot, msg) {
    const helpText = `
Доступные команды:

/start - Запустить бота и открыть список казино
/help - Показать это сообщение
/stats - Статистика бота (только для админов)

Команды для админов:
/live [ссылка] [описание] - Начать стрим
/stop - Остановить стрим
/text [сообщение] - Добавить анонс
/clear_text - Очистить все анонсы
/list_text - Показать все анонсы
/remove_text [ID] - Удалить конкретный анонс
/broadcast [сообщение] - Сделать рассылку
/add_casino - Добавить казино
/list_casinos - Список казино
/edit_casino [ID] - Редактировать казино

Примеры:
/live https://twitch.tv Мой крутой стрим
/text цвет:green 🎉 Бонус 200%!
/remove_text 123456789
    `;

    bot.sendMessage(msg.chat.id, helpText);
}

// Обработчик команды /stats
function handleStatsCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const userChats = database.getUserChats();
    const streamStatus = database.getStreamStatus();
    const announcements = database.getAnnouncements();
    const casinos = database.getCasinos();

    bot.sendMessage(msg.chat.id,
        `Статистика бота:\n` +
        `Пользователей: ${userChats.size}\n` +
        `Стрим: ${streamStatus.isStreamLive ? 'В ЭФИРЕ' : 'не активен'}\n` +
        `Анонсов: ${announcements.length}\n` +
        `Казино: ${casinos.length}\n` +
        `Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`
    );
}

// Обработчик команды /live
function handleLiveCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const streamUrl = match[1];
    const eventDescription = match[2];

    database.setStreamStatus({
        isStreamLive: true,
        streamUrl: streamUrl,
        eventDescription: eventDescription,
        lastUpdated: new Date().toISOString()
    });

    database.saveData().then(success => {
        bot.sendMessage(msg.chat.id, success ?
            `✅ Стрим запущен!\nСсылка: ${streamUrl}\nОписание: ${eventDescription}` :
            '❌ Ошибка обновления статуса стрима'
        );
    });
}

// Обработчик команды /stop
function handleStopCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    database.setStreamStatus({
        isStreamLive: false,
        streamUrl: '',
        eventDescription: '',
        lastUpdated: new Date().toISOString()
    });

    database.saveData().then(success => {
        bot.sendMessage(msg.chat.id, success ?
            '✅ Стрим остановлен' :
            '❌ Ошибка остановки стрима'
        );
    });
}

// Обработчик команды /text
function handleTextCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    let text = match[1];
    let color = 'blue';

    const colorMatch = text.match(/цвет:(\w+)\s+/i);
    if (colorMatch) {
        color = colorMatch[1];
        text = text.replace(colorMatch[0], '');
    }

    const announcements = database.getAnnouncements();
    const newAnnouncement = {
        id: Date.now(),
        text: text,
        color: color,
        createdAt: new Date().toISOString()
    };
    announcements.push(newAnnouncement);
    database.setAnnouncements(announcements);

    database.saveData().then(() => {
        bot.sendMessage(msg.chat.id,
            `✅ Анонс добавлен!\nID: ${newAnnouncement.id}\nЦвет: ${color}\nТекст: ${text}`
        );
    });
}

// Обработчик команды /clear_text
function handleClearTextCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    database.setAnnouncements([]);
    database.saveData().then(() => {
        bot.sendMessage(msg.chat.id, '✅ Все анонсы очищены!');
    });
}

// Обработчик команды /list_text
function handleListTextCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const announcements = database.getAnnouncements();
    if (announcements.length === 0) {
        return bot.sendMessage(msg.chat.id, '📝 Список анонсов пуст');
    }

    const announcementList = announcements.map(a =>
        `ID: ${a.id}\nЦвет: ${a.color}\nТекст: ${a.text}\nДата: ${new Date(a.createdAt).toLocaleString('ru-RU')}\n──────────────────`
    ).join('\n');

    bot.sendMessage(msg.chat.id,
        `Список анонсов (${announcements.length}):\n\n${announcementList}`
    );
}

// Обработчик команды /remove_text
function handleRemoveTextCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const id = parseInt(match[1]);
    const announcements = database.getAnnouncements();
    const index = announcements.findIndex(a => a.id === id);

    if (index !== -1) {
        const removed = announcements.splice(index, 1)[0];
        database.setAnnouncements(announcements);
        database.saveData().then(() => {
            bot.sendMessage(msg.chat.id,
                `✅ Анонс удален!\nID: ${id}\nТекст: ${removed.text}`
            );
        });
    } else {
        bot.sendMessage(msg.chat.id, `❌ Анонс с ID ${id} не найден`);
    }
}

// Обработчик команды /broadcast
async function handleBroadcastCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const message = match[1];
    const userChats = database.getUserChats();
    let successCount = 0;
    let errorCount = 0;

    bot.sendMessage(msg.chat.id, `📤 Начинаю рассылку для ${userChats.size} пользователей...`);

    for (const [userId] of userChats) {
        try {
            await bot.sendMessage(userId, `📢 ОБЪЯВЛЕНИЕ:\n\n${message}`);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            errorCount++;
        }
    }

    bot.sendMessage(msg.from.id,
        `✅ Рассылка завершена!\n` +
        `✓ Доставлено: ${successCount}\n` +
        `✗ Ошибок: ${errorCount}`
    );
}

// Обработчик команды /add_casino
function handleAddCasinoCommand(bot, msg, casinoEditingState) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const response = startCasinoCreation(msg.from.id, casinoEditingState);
    bot.sendMessage(msg.chat.id, response);
}

// Функция начала создания казино
function startCasinoCreation(userId, casinoEditingState) {
    casinoEditingState.set(userId, {
        step: ADD_CASINO_STEPS.NAME,
        data: {}
    });
    return 'Введите название казино:';
}

// Обработчик шагов создания казино
async function handleCasinoCreationStep(bot, msg, casinoEditingState) {
    const state = casinoEditingState.get(msg.from.id);
    if (!state) return;

    let response = null;

    switch (state.step) {
        case ADD_CASINO_STEPS.NAME:
            state.data.name = msg.text;
            state.step = ADD_CASINO_STEPS.PROMOCODE;
            response = 'Введите промокод:';
            break;

        case ADD_CASINO_STEPS.PROMOCODE:
            state.data.promocode = msg.text;
            state.step = ADD_CASINO_STEPS.SHORT_DESC;
            response = 'Введите краткое описание:';
            break;

        case ADD_CASINO_STEPS.SHORT_DESC:
            state.data.shortDescription = msg.text;
            state.step = ADD_CASINO_STEPS.FULL_DESC;
            response = 'Введите полное описание (или "пропустить"):';
            break;

        case ADD_CASINO_STEPS.FULL_DESC:
            state.data.fullDescription = msg.text === 'пропустить' ? '' : msg.text;
            state.step = ADD_CASINO_STEPS.URL;
            response = 'Введите URL ссылку:';
            break;

        case ADD_CASINO_STEPS.URL:
            state.data.url = msg.text;
            state.step = ADD_CASINO_STEPS.CATEGORY;
            const categoriesList = config.CATEGORIES.map(c => `${c.id} - ${c.name}`).join('\n');
            response = `Выберите категорию:\n${categoriesList}`;
            break;

        case ADD_CASINO_STEPS.CATEGORY:
            state.data.category = msg.text;
            state.step = ADD_CASINO_STEPS.KEYWORDS;
            response = 'Введите ключевые слова через запятую (или "пропустить"):';
            break;

        case ADD_CASINO_STEPS.KEYWORDS:
            state.data.hiddenKeywords = msg.text === 'пропустить' ? [] : msg.text.split(',').map(k => k.trim());
            state.step = ADD_CASINO_STEPS.CONFIRM;

            response = `
Название: ${state.data.name}
Промокод: ${state.data.promocode}
Описание: ${state.data.shortDescription}
Ссылка: ${state.data.url}
Категория: ${state.data.category}
Ключевые слова: ${state.data.hiddenKeywords.join(', ')}

Для подтверждения введите "да", для отмены "нет"`;
            break;

        case ADD_CASINO_STEPS.CONFIRM:
            if (msg.text.toLowerCase() === 'да') {
                const casinos = database.getCasinos();
                const newCasino = {
                    id: getNextCasinoId(),
                    ...state.data,
                    isActive: true,
                    isPinned: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                casinos.push(newCasino);
                database.setCasinos(casinos);

                await database.saveData();
                casinoEditingState.delete(msg.from.id);
                response = `✅ Казино добавлено! ID: ${newCasino.id}`;
            } else {
                casinoEditingState.delete(msg.from.id);
                response = '❌ Добавление отменено';
            }
            break;
    }

    if (response) {
        bot.sendMessage(msg.chat.id, response);
    }
}

// Обработчик команды /list_casinos
async function handleListCasinosCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const casinos = database.getCasinos();
    if (casinos.length === 0) {
        return bot.sendMessage(msg.chat.id, '📝 Список казино пуст');
    }

    // Разбиваем список на части по 10 казино
    const chunkSize = 10;
    for (let i = 0; i < casinos.length; i += chunkSize) {
        const chunk = casinos.slice(i, i + chunkSize);
        const casinoList = chunk.map(c =>
            `🎰 ID: ${c.id} - ${c.name}\n🎫 Промо: ${c.promocode}\n🏷️ Категория: ${c.category}\n🔗 ${c.url}\n──────────────────`
        ).join('\n');

        const message = i === 0 ?
            `📝 Список казино (${casinos.length}):\n\n${casinoList}` :
            `Продолжение (${i+1}-${Math.min(i+chunkSize, casinos.length)}):\n\n${casinoList}`;

        await bot.sendMessage(msg.chat.id, message);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

// Обработчик команды /edit_casino
function handleEditCasinoCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команда!');
    }

    const id = parseInt(match[1]);
    const casino = getCasino(id);

    if (!casino) {
        return bot.sendMessage(msg.chat.id, `❌ Казино с ID ${id} не найдено`);
    }

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✏️ Название', callback_data: `edit_name_${id}` },
                    { text: '🎫 Промокод', callback_data: `edit_promo_${id}` }
                ],
                [
                    { text: '📝 Описание', callback_data: `edit_desc_${id}` },
                    { text: '🔗 Ссылка', callback_data: `edit_url_${id}` }
                ],
                [
                    { text: '🏷️ Категория', callback_data: `edit_category_${id}` },
                    { text: '📌 Закрепить', callback_data: `pin_${id}` },
                    { text: '👻 Скрыть', callback_data: `hide_${id}` }
                ],
                [
                    { text: '🚫 Удалить', callback_data: `delete_${id}` }
                ]
            ]
        }
    };

    bot.sendMessage(msg.chat.id,
        `Редактирование: ${casino.name} (ID: ${casino.id})\nВыберите действие:`,
        keyboard
    ).catch(error => {
        console.log('Error with keyboard:', error);
        bot.sendMessage(msg.chat.id,
            `Редактирование: ${casino.name} (ID: ${casino.id})\nКнопки не доступны. Используйте команды:\n/edit_name_${id}\n/edit_promo_${id} и т.д.`
        );
    });
}

// Обработчик callback_query
async function handleCallbackQuery(bot, query, casinoEditingState) {
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
        if (data.startsWith('edit_')) {
            const [action, id] = data.split('_').slice(1);
            const casinoId = parseInt(id);

            casinoEditingState.set(chatId, {
                editingCasinoId: casinoId,
                editingField: action
            });

            const fieldNames = {
                name: 'название',
                promo: 'промокод',
                desc: 'краткое описание',
                url: 'URL ссылку',
                category: 'категорию'
            };

            await bot.sendMessage(chatId, `Введите новое значение для ${fieldNames[action]}:`);
        }
        else if (data.startsWith('delete_')) {
            const casinoId = parseInt(data.split('_')[1]);
            const casinos = database.getCasinos();
            const index = casinos.findIndex(c => c.id === casinoId);

            if (index !== -1) {
                const deleted = casinos.splice(index, 1)[0];
                database.setCasinos(casinos);
                await database.saveData();
                await bot.sendMessage(chatId, `✅ Казино "${deleted.name}" удалено!`);
            } else {
                await bot.sendMessage(chatId, '❌ Казино не найдено');
            }
        }
        else if (data.startsWith('pin_')) {
            const casinoId = parseInt(data.split('_')[1]);
            const casino = getCasino(casinoId);
            const casinos = database.getCasinos();
            const index = casinos.findIndex(c => c.id === casinoId);

            if (index !== -1) {
                casinos[index].isPinned = !casinos[index].isPinned;
                database.setCasinos(casinos);
                await database.saveData();
                await bot.sendMessage(chatId,
                    `✅ Казино "${casinos[index].name}" ${casinos[index].isPinned ? 'закреплено' : 'откреплено'}!`
                );
            }
        }
        else if (data.startsWith('hide_')) {
            const casinoId = parseInt(data.split('_')[1]);
            const casinos = database.getCasinos();
            const index = casinos.findIndex(c => c.id === casinoId);

            if (index !== -1) {
                casinos[index].isActive = false;
                database.setCasinos(casinos);
                await database.saveData();
                await bot.sendMessage(chatId, `✅ Казино "${casinos[index].name}" скрыто!`);
            }
        }

        await bot.answerCallbackQuery(query.id);
    } catch (error) {
        console.error('Callback error:', error);
        await bot.answerCallbackQuery(query.id, { text: '❌ Произошла ошибка' });
    }
}

// Обработчик ответов для редактирования казино
async function handleCasinoEditResponse(bot, msg, casinoEditingState) {
    const state = casinoEditingState.get(msg.from.id);
    if (!state || !state.editingCasinoId) return;

    const casino = getCasino(state.editingCasinoId);
    if (!casino) {
        casinoEditingState.delete(msg.from.id);
        return bot.sendMessage(msg.from.id, '❌ Казино не найдено');
    }

    const casinos = database.getCasinos();
    const index = casinos.findIndex(c => c.id === state.editingCasinoId);
    if (index === -1) {
        casinoEditingState.delete(msg.from.id);
        return bot.sendMessage(msg.from.id, '❌ Казино не найдено');
    }

    const updates = {};
    switch (state.editingField) {
        case 'name': updates.name = msg.text; break;
        case 'promo': updates.promocode = msg.text; break;
        case 'desc': updates.shortDescription = msg.text; break;
        case 'url': updates.url = msg.text; break;
        case 'category': updates.category = msg.text; break;
    }

    casinos[index] = { ...casinos[index], ...updates, updatedAt: new Date().toISOString() };
    database.setCasinos(casinos);

    await database.saveData();
    casinoEditingState.delete(msg.from.id);

    bot.sendMessage(msg.from.id, `✅ Поле успешно обновлено!`);
}

// Главный обработчик сообщений
function handleMessage(bot, msg) {
    const approveRegex = /^\/odobri (\d+)$/;
const approvalsRegex = /^\/approvals$/;
    const text = msg.text;

    // Регулярные выражения для команд
    const statsRegex = /^\/stats$/;
    const liveRegex = /^\/live (.+?) (.+)/;
    const stopRegex = /^\/stop$/;
    const textRegex = /^\/text (.+)/;
    const clearTextRegex = /^\/clear_text$/;
    const listTextRegex = /^\/list_text$/;
    const removeTextRegex = /^\/remove_text (\d+)/;
    const broadcastRegex = /^\/broadcast (.+)/;
    const addCasinoRegex = /^\/add_casino$/;
    const listCasinosRegex = /^\/list_casinos$/;
    const editCasinoRegex = /^\/edit_casino (\d+)/;
if (database.getUserChats().get(msg.from.id)?.waitingForApproval) {
    handleApprovalRequest(bot, msg);
    return;
}
    // Проверяем команды и вызываем соответствующие обработчики
    if (statsRegex.test(text)) {
        handleStatsCommand(bot, msg);
    } else if (liveRegex.test(text)) {
        handleLiveCommand(bot, msg, text.match(liveRegex));
    } else if (stopRegex.test(text)) {
        handleStopCommand(bot, msg);
    } else if (textRegex.test(text)) {
        handleTextCommand(bot, msg, text.match(textRegex));
    } else if (clearTextRegex.test(text)) {
        handleClearTextCommand(bot, msg);
    } else if (listTextRegex.test(text)) {
        handleListTextCommand(bot, msg);
    } else if (removeTextRegex.test(text)) {
        handleRemoveTextCommand(bot, msg, text.match(removeTextRegex));
    } else if (broadcastRegex.test(text)) {
        handleBroadcastCommand(bot, msg, text.match(broadcastRegex));
    } else if (addCasinoRegex.test(text)) {
        handleAddCasinoCommand(bot, msg, casinoEditingState);
    } else if (listCasinosRegex.test(text)) {
        handleListCasinosCommand(bot, msg);
    } else if (editCasinoRegex.test(text)) {
        handleEditCasinoCommand(bot, msg, text.match(editCasinoRegex));
    } else if (approveRegex.test(text)) {
    handleApproveCommand(bot, msg, text.match(approveRegex));
} else if (approvalsRegex.test(text)) {
    handleApprovalsCommand(bot, msg);
}
    // Можно добавить другие команды здесь
}

// Обработчик команды /odobri
function handleApproveCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const userId = parseInt(match[1]);
    const success = database.approveUser(userId);
    
    if (success) {
        bot.sendMessage(msg.chat.id, `✅ Пользователь ${userId} одобрен для доступа к лайв комнате!`);
        // Уведомляем пользователя
        bot.sendMessage(userId, '🎉 Ваш доступ к приватной лайв комнате одобрен! Обновите приложение.');
    } else {
        bot.sendMessage(msg.chat.id, `❌ Не удалось одобрить пользователя ${userId}`);
    }
}

// Обработчик команды /approvals
function handleApprovalsCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const pending = database.getPendingApprovals();
    if (pending.length === 0) {
        return bot.sendMessage(msg.chat.id, '📝 Запросов на одобрение нет');
    }

    const approvalList = pending.map(req => 
        `ID: ${req.userId}\nUsername: @${req.requestedUsername}\nЗапросил: ${new Date(req.requestedAt).toLocaleString('ru-RU')}\n/odobri_${req.userId}`
    ).join('\n\n');

    bot.sendMessage(msg.chat.id,
        `Запросы на одобрение (${pending.length}):\n\n${approvalList}`
    );
}

// Обработчик для запроса одобрения
function handleApprovalRequest(bot, msg) {
    const username = msg.text.trim();
    const userId = msg.from.id;
    
    // Простая валидация username
    if (!username.startsWith('@') || username.length < 5) {
        return bot.sendMessage(msg.chat.id, '❌ Пожалуйста, введите корректный username в формате @username');
    }

    const success = database.requestApproval(userId, username);
    if (success) {
        bot.sendMessage(msg.chat.id, '✅ Ваш запрос на одобрение отправлен админам! Ожидайте.');
        
        // Уведомляем админов
        const admins = config.ADMINS;
        admins.forEach(adminId => {
            bot.sendMessage(adminId,
                `🆕 Новый запрос на одобрение!\nID: ${userId}\nUsername: ${username}\n/odobri_${userId}`
            );
        });
    } else {
        bot.sendMessage(msg.chat.id, '❌ Ошибка при отправке запроса');
    }
}

// Добавьте эту функцию
function handleReferralCommand(bot, msg) {
    const userId = msg.from.id;
    const referralInfo = database.getReferralInfo(userId);
    
    const message = `
📊 Ваша реферальная статистика:

👥 Вас пригласил: ${referralInfo.referredBy ? 'User#' + referralInfo.referredBy : 'Никто'}
📈 Вы пригласили: ${referralInfo.referrals.length} человек

🔗 Ваша реферальная ссылка:
${referralInfo.referralLink}

Приглашайте друзей и получайте бонусы!`;
    
    bot.sendMessage(msg.chat.id, message);
}

// Добавьте регулярное выражение в handleMessage
const referralRegex = /^\/referral$/;

// И проверку в handleMessage
 else if (referralRegex.test(text)) {
    handleReferralCommand(bot, msg);
}

// Экспортируем все обработчики
module.exports = {
    handleStartCommand,
    handleHelpCommand,
    handleStatsCommand,
    handleLiveCommand,
    handleStopCommand,
    handleTextCommand,
    handleClearTextCommand,
    handleListTextCommand,
    handleRemoveTextCommand,
    handleBroadcastCommand,
    handleAddCasinoCommand,
    handleListCasinosCommand,
    handleEditCasinoCommand,
    handleCallbackQuery,
    handleCasinoEditResponse,
    handleCasinoCreationStep,
    handleMessage
};
