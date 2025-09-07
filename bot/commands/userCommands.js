console.log('✅ userCommands loaded');
const config = require('../../config');
const database = require('../../database/database');

function handleStartCommand(bot, msg) {
    const user = msg.from;
    database.trackUserAction(user.id, user, 'start');

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

function handleMessage(bot, msg) {
    const { isAdmin } = require('./adminCommands');
    const { handleReferralCommand } = require('./referralCommands');
    
    const approveRegex = /^\/odobri (\d+)$/;
    const approvalsRegex = /^\/approvals$/;
    const referralRegex = /^\/referral$/;
    const text = msg.text;

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

    if (statsRegex.test(text)) {
        require('./adminCommands').handleStatsCommand(bot, msg);
    } else if (liveRegex.test(text)) {
        require('./adminCommands').handleLiveCommand(bot, msg, text.match(liveRegex));
    } else if (stopRegex.test(text)) {
        require('./adminCommands').handleStopCommand(bot, msg);
    } else if (textRegex.test(text)) {
        require('./adminCommands').handleTextCommand(bot, msg, text.match(textRegex));
    } else if (clearTextRegex.test(text)) {
        require('./adminCommands').handleClearTextCommand(bot, msg);
    } else if (listTextRegex.test(text)) {
        require('./adminCommands').handleListTextCommand(bot, msg);
    } else if (removeTextRegex.test(text)) {
        require('./adminCommands').handleRemoveTextCommand(bot, msg, text.match(removeTextRegex));
    } else if (broadcastRegex.test(text)) {
        require('./adminCommands').handleBroadcastCommand(bot, msg, text.match(broadcastRegex));
    } else if (addCasinoRegex.test(text)) {
        require('./casinoCommands').handleAddCasinoCommand(bot, msg, require('../bot').casinoEditingState());
    } else if (listCasinosRegex.test(text)) {
        require('./casinoCommands').handleListCasinosCommand(bot, msg);
    } else if (editCasinoRegex.test(text)) {
        require('./casinoCommands').handleEditCasinoCommand(bot, msg, text.match(editCasinoRegex));
    } else if (approveRegex.test(text)) {
        require('./adminCommands').handleApproveCommand(bot, msg, text.match(approveRegex));
    } else if (approvalsRegex.test(text)) {
        require('./adminCommands').handleApprovalsCommand(bot, msg);
    } else if (referralRegex.test(text)) {
        handleReferralCommand(bot, msg);
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
        
        const { isAdmin } = require('./adminCommands');
        const admins = require('../../config').ADMINS;
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
    handleApprovalRequest
};
