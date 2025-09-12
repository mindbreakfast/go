const path = require('path');
const config = require(path.join(__dirname, '..', '..', 'config'));
const database = require(path.join(__dirname, '..', '..', 'database', 'database'));
const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));
const { casinoEditingState } = require('../state');
const logger = require('../../utils/logger');

function handleStartCommand(bot, msg) {
    logger.info('Start command received', { userId: msg.from.id });
    const user = msg.from;
    
    database.trackUserAction(user.id, user, 'start');

    // 🔥 Обработка deep link для конкурсов
    if (msg.text && msg.text.includes('giftme_')) {
        const contestId = msg.text.split(' ')[1];
        logger.info('Contest deep link detected', { userId: user.id, contestId });
        handleContestJoin(bot, msg, contestId);
        return;
    }

    if (msg.text && msg.text.includes('request_approval')) {
        logger.info('Approval request from start command', { userId: user.id });
        database.requestApproval(user.id, user.username || 'не указан');
        bot.sendMessage(msg.chat.id, '✅ Ваш запрос на доступ отправлен админам! Ожидайте одобрения.');
        return;
    }

    if (msg.text && msg.text.includes(' ')) {
        const referralCode = msg.text.split(' ')[1];
        if (referralCode.startsWith('ref')) {
            const referrerId = parseInt(referralCode.substring(3));
            if (!isNaN(referrerId) && referrerId !== user.id) {
                logger.info('Referral detected via start', { userId: user.id, referrerId });
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
        .catch(error => logger.error('Error sending welcome message:', { error: error.message }));
}

function handleContestJoin(bot, msg, contestId) {
    const user = msg.from;
    logger.info('Contest join attempt', { userId: user.id, contestId });

    bot.sendMessage(msg.chat.id,
        `🎁 Вы участвуете в конкурсе!\n\n` +
        `Для завершения регистрации нам нужно:\n` +
        `📧 Ваша почта в казино\n` +
        `📸 Скриншот депозита\n\n` +
        `Отправьте вашу почту:`
    );
}

function handleHelpCommand(bot, msg) {
    logger.info('Help command received', { userId: msg.from.id });
    const helpText = `
Доступные команды:

/start - Запустить бота и открыть список казино
/help - Показать это сообщение
/stats - Статистика бота (только для админов)
/casino_stats - Статистика казино (только для админов)
/voice_audit - Аудит голосовых (только для админов)
/referral - Реферальная статистика

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
/ref_stats - Топ рефереров

Примеры:
/live https://twitch.tv Мой крутой стрим
/text цвет:green 🎉 Бonus 200%!
/remove_text 123456789
    `.trim();

    bot.sendMessage(msg.chat.id, helpText)
        .catch(error => logger.error('Error sending help:', { error: error.message }));
}

function handleMessage(bot, msg) {
    const text = msg.text;
    if (!text) {
        logger.debug('Empty text in handleMessage');
        return;
    }

    logger.debug('Handling message', { userId: msg.from.id, text: text.substring(0, 50) });

    // Регулярные выражения для всех команд
    const statsRegex = /^\/stats($|\s)/;
    const liveRegex = /^\/live($|\s)/;
    const stopRegex = /^\/stop($|\s)/;
    const textRegex = /^\/text($|\s)/; // ✅ ДОБАВЛЕНО
    const clearTextRegex = /^\/clear_text($|\s)/;
    const listTextRegex = /^\/list_text($|\s)/;
    const removeTextRegex = /^\/remove_text($|\s)/;
    const broadcastRegex = /^\/broadcast($|\s)/;
    const addCasinoRegex = /^\/add_casino($|\s)/;
    const listCasinosRegex = /^\/list_casinos($|\s)/;
    const editCasinoRegex = /^\/edit_casino($|\s)/;
    const approveRegex = /^\/odobri($|\s)/;
    const approvalsRegex = /^\/approvals($|\s)/;
    const referralRegex = /^\/referral($|\s)/;
    const startRegex = /^\/start($|\s)/;
    const helpRegex = /^\/help($|\s)/;
    const casinoStatsRegex = /^\/casino_stats($|\s)/;
    const voiceAuditRegex = /^\/voice_audit($|\s)/;
    const refStatsRegex = /^\/ref_stats($|\s)/;

    if (startRegex.test(text)) {
        handleStartCommand(bot, msg);
        return;
    }

    if (helpRegex.test(text)) {
        handleHelpCommand(bot, msg);
        return;
    }

    // ✅ ОБРАБОТКА TEXT КОМАНДЫ
    if (textRegex.test(text)) {
        logger.info('Text command received', { userId: msg.from.id });
        const adminCommands = require('./adminCommands');
        const messageText = text.substring(5).trim();
        adminCommands.handleTextCommand(bot, msg, [null, messageText]);
        return;
    }

    if (database.getUserChats().get(msg.from.id)?.waitingForApproval) {
        handleApprovalRequest(bot, msg);
        return;
    }

    // 📊 Новые команды статистики
    if (casinoStatsRegex.test(text)) {
        logger.info('Casino stats command received', { userId: msg.from.id });
        const adminCommands = require('./adminCommands');
        adminCommands.handleCasinoStatsCommand(bot, msg);
        return;
    }

    if (voiceAuditRegex.test(text)) {
        logger.info('Voice audit command received', { userId: msg.from.id });
        const adminCommands = require('./adminCommands');
        adminCommands.handleVoiceAuditCommand(bot, msg);
        return;
    }

    if (refStatsRegex.test(text)) {
        logger.info('Ref stats command received', { userId: msg.from.id });
        const referralCommands = require('./referralCommands');
        referralCommands.handleRefStatsCommand(bot, msg);
        return;
    }

    // Остальная обработка команд...
    if (statsRegex.test(text)) {
        logger.info('Stats command received', { userId: msg.from.id });
        const adminCommands = require('./adminCommands');
        adminCommands.handleStatsCommand(bot, msg);
    } else if (liveRegex.test(text)) {
        logger.info('Live command received', { userId: msg.from.id });
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
    }
    // ... остальные команды
}

function handleApprovalRequest(bot, msg) {
    const username = msg.text.trim();
    const userId = msg.from.id;
    
    logger.info('Approval request processing', { userId, username });
    
    if (!username.startsWith('@') || username.length < 5) {
        return bot.sendMessage(msg.chat.id, '❌ Пожалуйста, введите корректный username в формате @username')
            .catch(error => logger.error('Error sending validation message:', { error: error.message }));
    }

    const success = database.requestApproval(userId, username);
    if (success) {
        bot.sendMessage(msg.chat.id, '✅ Ваш запрос на одобрение отправлен админам! Ожидайте.')
            .catch(error => logger.error('Error sending success message:', { error: error.message }));
        
        const admins = config.ADMINS;
        admins.forEach(adminId => {
            if (isAdmin(adminId)) {
                bot.sendMessage(adminId,
                    `🆕 Новый запрос на одобрение!\nID: ${userId}\nUsername: ${username}\n/odobri_${userId}`
                ).catch(error => logger.error(`Error notifying admin ${adminId}:`, { error: error.message }));
            }
        });
    } else {
        bot.sendMessage(msg.chat.id, '❌ Ошибка при отправке запроса')
            .catch(error => logger.error('Error sending error message:', { error: error.message }));
    }
}

module.exports = {
    handleStartCommand,
    handleHelpCommand,
    handleMessage,
    handleApprovalRequest,
    handleContestJoin
};
