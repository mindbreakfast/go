const path = require('path');
const database = require(path.join(__dirname, '..', '..', 'database', 'database'));
const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));
const logger = require(path.join(__dirname, '..', '..', 'utils', 'logger'));

function handleStartCommand(bot, msg) {
    const user = msg.from;
    
    database.trackUserAction(user.id, user, 'start');

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
/clear_text - Очистить анонсы
/list_text - Показать анонсы
/remove_text [ID] - Удалить анонс
/broadcast [сообщение] - Сделать рассылку
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

    switch (command) {
        case '/start':
            handleStartCommand(bot, msg);
            break;
        case '/help':
            handleHelpCommand(bot, msg);
            break;
        case '/stats':
            if (isAdmin(msg.from.id)) {
                const adminCommands = require('./adminCommands');
                adminCommands.handleStatsCommand(bot, msg);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/casino_stats':
            if (isAdmin(msg.from.id)) {
                const adminCommands = require('./adminCommands');
                adminCommands.handleCasinoStatsCommand(bot, msg);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/voice_audit':
            if (isAdmin(msg.from.id)) {
                const adminCommands = require('./adminCommands');
                adminCommands.handleVoiceAuditCommand(bot, msg);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/text':
            if (isAdmin(msg.from.id)) {
                const adminCommands = require('./adminCommands');
                const messageText = text.substring(5).trim();
                const match = messageText.match(/^(.+?)(?:\s+(blue|green|red|yellow|purple))?$/);
                adminCommands.handleTextCommand(bot, msg, match ? [null, match[1], match[2]] : [null, messageText]);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/live':
            if (isAdmin(msg.from.id)) {
                const adminCommands = require('./adminCommands');
                const params = text.substring(6).trim();
                const spaceIndex = params.indexOf(' ');
                if (spaceIndex > 0) {
                    const streamUrl = params.substring(0, spaceIndex);
                    const eventDescription = params.substring(spaceIndex + 1);
                    adminCommands.handleLiveCommand(bot, msg, [null, streamUrl, eventDescription]);
                } else {
                    bot.sendMessage(msg.chat.id, '❌ Формат: /live [ссылка] [описание]');
                }
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/stop':
            if (isAdmin(msg.from.id)) {
                const adminCommands = require('./adminCommands');
                adminCommands.handleStopCommand(bot, msg);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
            }
            break;
        case '/referral':
            const referralCommands = require('./referralCommands');
            referralCommands.handleReferralCommand(bot, msg);
            break;
        case '/ref_stats':
            if (isAdmin(msg.from.id)) {
                const referralCommands = require('./referralCommands');
                referralCommands.handleRefStatsCommand(bot, msg);
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
