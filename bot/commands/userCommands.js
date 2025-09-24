const path = require('path');
const database = require(path.join(__dirname, '..', '..', 'database', 'database'));
const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));
const logger = require(path.join(__dirname, '..', '..', 'utils', 'logger'));

// 🔥 ДОБАВЛЯЕМ config
const config = require(path.join(__dirname, '..', '..', 'config'));

// 🔥 Импортируем команды через глобальный commandHandlers чтобы избежать циклических зависимостей
let commandHandlers = null;

function getCommandHandlers() {
    if (!commandHandlers) {
        commandHandlers = require(path.join(__dirname, '..', 'commands'));
    }
    return commandHandlers;
}

function handleStartCommand(bot, msg) {
    const user = msg.from;
    
    // 🔥 УСТАНАВЛИВАЕМ ТЁМНУЮ ТЕМУ ПО УМОЛЧАНИЮ ДЛЯ НОВЫХ ПОЛЬЗОВАТЕЛЕЙ
    database.trackUserAction(user.id, user, 'start');
    
    // 🔥 ОБНОВЛЯЕМ НАСТРОЙКИ С ТЁМНОЙ ТЕМОЙ ПО УМОЛЧАНИЮ
    database.updateUserSettings(user.id, {
        theme: 'dark' // Тёмная тема по умолчанию
    });

    if (msg.text && msg.text.includes('giftme_')) {
        const contestId = msg.text.split(' ')[1];
        handleContestJoin(bot, msg, contestId);
        return;
    }

    if (msg.text && msg.text.includes('request_approval')) {
        database.requestApproval(user.id, user.username || 'не указан');
        bot.sendMessage(msg.chat.id, '✅ Ваш запрос на доступ отправлен админам! Ожидайте одобрения.');
        return;
    }

    if (msg.text && msg.text.includes(' ')) {
        const referralCode = msg.text.split(' ')[1];
        if (referralCode.startsWith('ref')) {
            const referrerId = parseInt(referralCode.substring(3));
            if (!isNaN(referrerId) && referrerId !== user.id) {
                database.handleReferralStart(user.id, referrerId);
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

    bot.sendMessage(msg.chat.id, 'Добро пожаловать! Нажмите кнопку ниже чтобы открыть список казино:', keyboard)
        .catch(error => console.error('Error sending welcome message:', error));
}

function handleContestJoin(bot, msg, contestId) {
    const user = msg.from;
    
    database.updateUserSettings(user.id, {
        contestState: {
            active: true,
            contestId: contestId,
            step: 'email'
        }
    });

    bot.sendMessage(msg.chat.id,
        `🎁 Вы участвуете в конкурсе!\n\nОтправьте вашу почту в казино:`
    );
}

function handleHelpCommand(bot, msg) {
    const helpText = `
Доступные команды:
/start - Запустить бота
/help - Показать это сообщение
/stats - Статистика бота
/casino_stats - Статистика казино
/voice_audit - Аудит голосовых
/referral - Реферальная статистика

Команды для админов:
/live [ссылка] [описание] - Начать стрим
/stop - Остановить стрим
/text [сообщение] [цвет] - Добавить анонс
/clear_text - Очистить все анонсы
/list_text - Показать анонсы
/delete_text [ID] - Удалить анонс
/vsem [сообщение] - Сделать рассылку всем пользователям
/add_casino - Добавить казино
/list_casinos - Список казино
/edit_casino [ID] - Редактировать казино
/ref_stats - Топ рефереров
    `.trim();

    bot.sendMessage(msg.chat.id, helpText);
}

function handleMessage(bot, msg) {
    const text = msg.text;
    if (!text) return;

    console.log('Processing message:', text);

    // Сначала проверяем команды
    if (text.startsWith('/')) {
        processCommand(bot, msg, text);
        return;
    }

    // Затем проверяем конкурсы
    const userData = database.getUserData(msg.from.id);
    if (userData.settings?.contestState?.active) {
        handleContestResponse(bot, msg, text, userData.settings.contestState);
        return;
    }

    // Если это не команда и не конкурс - игнорируем
    console.log('Ignoring non-command message:', text);
}

function processCommand(bot, msg, text) {
    const command = text.split(' ')[0].toLowerCase();
    const handlers = getCommandHandlers();
    
    // 🔥 ИМПОРТИРУЕМ casinoEditingState ДЛЯ ПЕРЕДАЧИ В КОМАНДЫ
    const { casinoEditingState } = require(path.join(__dirname, '..', 'state'));

    switch (command) {
        case '/start':
            handleStartCommand(bot, msg);
            break;
        case '/help':
            handleHelpCommand(bot, msg);
            break;
        case '/stats':
            if (isAdmin(msg.from.id)) {
                handlers.handleStatsCommand(bot, msg);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/casino_stats':
            if (isAdmin(msg.from.id)) {
                handlers.handleCasinoStatsCommand(bot, msg);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/voice_audit':
            if (isAdmin(msg.from.id)) {
                handlers.handleVoiceAuditCommand(bot, msg);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/text':
            if (isAdmin(msg.from.id)) {
                const messageText = text.substring(text.includes('@') ? text.indexOf(' ') + 1 : 5).trim();
                const match = messageText.match(/^(.+?)(?:\s+(blue|green|red|yellow|purple))?$/);
                handlers.handleTextCommand(bot, msg, match ? [null, match[1], match[2]] : [null, messageText]);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/live':
            if (isAdmin(msg.from.id)) {
                const params = text.substring(text.includes('@') ? text.indexOf(' ') + 1 : 6).trim();
                const spaceIndex = params.indexOf(' ');
                if (spaceIndex > 0) {
                    const streamUrl = params.substring(0, spaceIndex);
                    const eventDescription = params.substring(spaceIndex + 1);
                    handlers.handleLiveCommand(bot, msg, [null, streamUrl, eventDescription]);
                } else {
                    bot.sendMessage(msg.chat.id, '❌ Формат: /live [ссылка] [описание]');
                }
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команда!');
            }
            break;
        case '/stop':
            if (isAdmin(msg.from.id)) {
                handlers.handleStopCommand(bot, msg);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/referral':
            handlers.handleReferralCommand(bot, msg);
            break;
        case '/ref_stats':
            if (isAdmin(msg.from.id)) {
                handlers.handleRefStatsCommand(bot, msg);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/add_casino':
            if (isAdmin(msg.from.id)) {
                // 🔥 ПЕРЕДАЕМ casinoEditingState В КОМАНДУ
                handlers.handleAddCasinoCommand(bot, msg, casinoEditingState);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/list_casinos':
            if (isAdmin(msg.from.id)) {
                handlers.handleListCasinosCommand(bot, msg);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/edit_casino':
            if (isAdmin(msg.from.id)) {
                const casinoId = text.substring(text.includes('@') ? text.indexOf(' ') + 1 : 12).trim();
                handlers.handleEditCasinoCommand(bot, msg, [null, casinoId]);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        // 🔥 ОБНОВЛЯЕМ КОМАНДЫ АНОНСОВ НА СТАРЫЕ НАЗВАНИЯ
        case '/clear_text':
            if (isAdmin(msg.from.id)) {
                handlers.handleClearTextCommand(bot, msg);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/delete_text':
            if (isAdmin(msg.from.id)) {
                const announcementId = text.substring(text.includes('@') ? text.indexOf(' ') + 1 : 12).trim();
                handlers.handleDeleteTextCommand(bot, msg, [null, announcementId]);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/list_text':
            if (isAdmin(msg.from.id)) {
                handlers.handleListTextCommand(bot, msg);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        // 🔥 ДОБАВЛЯЕМ КОМАНДУ РАССЫЛКИ
        case '/vsem':
            if (isAdmin(msg.from.id)) {
                const messageText = text.substring(text.includes('@') ? text.indexOf(' ') + 1 : 5).trim();
                handlers.handleBroadcastCommand(bot, msg, [null, messageText]);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
               case '/save':
            if (isAdmin(msg.from.id)) {
                handlers.handleSaveCommand(bot, msg);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        default:
            bot.sendMessage(msg.chat.id, '❌ Неизвестная команда. Используйте /help для списка команд.');
    }
}

function handleContestResponse(bot, msg, text, contestState) {
    const user = msg.from;

    if (contestState.step === 'email') {
        database.updateUserSettings(user.id, {
            contestState: {
                ...contestState,
                step: 'screenshot',
                email: text
            }
        });

        bot.sendMessage(msg.chat.id, '✅ Почта сохранена! Теперь отправьте скриншот депозита:');
    } else if (contestState.step === 'screenshot') {
        database.updateUserSettings(user.id, {
            contestState: null
        });

        bot.sendMessage(msg.chat.id, '✅ Заявка на конкурс отправлена! Ожидайте проверки админом.');

        // Уведомляем админов
        const admins = config.ADMINS;
        admins.forEach(adminId => {
            if (isAdmin(adminId)) {
                bot.sendMessage(adminId,
                    `🎁 Новая заявка на конкурс!\nID: ${user.id}\nUsername: @${user.username}\nПочта: ${contestState.email}`
                );
            }
        });
    }
}

function handleApprovalRequest(bot, msg) {
    const username = msg.text.trim();
    const userId = msg.from.id;
    
    if (!username.startsWith('@') || username.length < 5) {
        return bot.sendMessage(msg.chat.id, '❌ Пожалуйста, введите корректный username в формате @username');
    }

    const success = database.requestApproval(userId, username);
    if (success) {
        bot.sendMessage(msg.chat.id, '✅ Ваш запрос на одобрение отправлен админам! Ожидайте.');
        
        const admins = config.ADMINS;
        admins.forEach(adminId => {
            if (isAdmin(adminId)) {
                bot.sendMessage(adminId,
                    `🆕 Новый запрос на одобрение!\nID: ${userId}\nUsername: ${username}\n/odobri_${userId}`
                );
            }
        });
    } else {
        bot.sendMessage(msg.chat.id, '❌ Ошибка при отправке запроса');
    }
}

module.exports = {
    handleStartCommand,
    handleHelpCommand,
    handleMessage,
    handleApprovalRequest,
    handleContestJoin
};
