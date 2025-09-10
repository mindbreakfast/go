console.log('✅ userCommands loaded');
const path = require('path');
const config = require(path.join(__dirname, '..', '..', 'config'));
const database = require(path.join(__dirname, '..', '..', 'database', 'database'));
const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));
const { casinoEditingState } = require('../state'); // Импортируем состояние из общего модуля

function handleStartCommand(bot, msg) {
    console.log(`🎬 Handling /start for user ${msg.from.id}`);
    const user = msg.from;
    
    // ✅ ИСПРАВЛЕНО: Используем правильный метод
    database.trackUserAction(user.id, user, 'start');

    if (msg.text && msg.text.includes('request_approval')) {
        console.log(`📋 Approval request from user ${user.id}`);
        database.requestApproval(user.id, user.username || 'не указан');
        bot.sendMessage(msg.chat.id, '✅ Ваш запрос на доступ отправлен админам! Ожидайте одобрения.');
        return;
    }

    if (msg.text && msg.text.includes(' ')) {
        const referralCode = msg.text.split(' ')[1];
        if (referralCode.startsWith('ref')) {
            const referrerId = parseInt(referralCode.substring(3));
            if (!isNaN(referrerId) && referrerId !== user.id) {
                console.log(`🤝 Referral detected: user ${user.id} referred by ${referrerId}`);
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
        .catch(error => console.error('Error sending welcome message:', error.message));
}

function handleHelpCommand(bot, msg) {
    console.log(`❓ Handling /help for user ${msg.from.id}`);
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
/text цвет:green 🎉 Бonus 200%!
/remove_text 123456789
    `;

    bot.sendMessage(msg.chat.id, helpText)
        .catch(error => console.error('Error sending help:', error.message));
}

function handleMessage(bot, msg) {
    const text = msg.text;
    if (!text) {
        console.log('⚠️ Empty text in handleMessage');
        return;
    }

    console.log(`📝 Handling message: "${text}" from user ${msg.from.id}`);

    // ✅ ИСПРАВЛЕННЫЕ РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ (добавлен |\s для параметров)
    const statsRegex = /^\/stats($|\s)/;
    const liveRegex = /^\/live($|\s)/;
    const stopRegex = /^\/stop($|\s)/;
    const textRegex = /^\/text($|\s)/;
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

    // ✅ ОБРАБОТКА /start И /help ПЕРВЫМИ
    if (startRegex.test(text)) {
        console.log(`🎬 Handling /start from user ${msg.from.id}`);
        handleStartCommand(bot, msg);
        return;
    }

    if (helpRegex.test(text)) {
        console.log(`❓ Handling /help from user ${msg.from.id}`);
        handleHelpCommand(bot, msg);
        return;
    }

    if (database.getUserChats().get(msg.from.id)?.waitingForApproval) {
        console.log(`⏳ Handling approval response from user ${msg.from.id}`);
        handleApprovalRequest(bot, msg);
        return;
    }

    if (statsRegex.test(text)) {
        console.log(`📊 Handling /stats from user ${msg.from.id}`);
        const adminCommands = require('./adminCommands');
        adminCommands.handleStatsCommand(bot, msg);
    } else if (liveRegex.test(text)) {
        console.log(`🎥 Handling /live from user ${msg.from.id}`);
        const adminCommands = require('./adminCommands');
        // Получаем параметры после команды
        const params = text.substring(6).trim();
        const spaceIndex = params.indexOf(' ');
        if (spaceIndex > 0) {
            const streamUrl = params.substring(0, spaceIndex);
            const eventDescription = params.substring(spaceIndex + 1);
            adminCommands.handleLiveCommand(bot, msg, [null, streamUrl, eventDescription]);
        } else {
            bot.sendMessage(msg.chat.id, '❌ Формат: /live [ссылка] [описание]');
        }
    } else if (stopRegex.test(text)) {
        console.log(`⏹️ Handling /stop from user ${msg.from.id}`);
        const adminCommands = require('./adminCommands');
        adminCommands.handleStopCommand(bot, msg);
    } else if (textRegex.test(text)) {
        console.log(`📝 Handling /text from user ${msg.from.id}`);
        const adminCommands = require('./adminCommands');
        const messageText = text.substring(5).trim();
        adminCommands.handleTextCommand(bot, msg, [null, messageText]);
    } else if (clearTextRegex.test(text)) {
        console.log(`🧹 Handling /clear_text from user ${msg.from.id}`);
        const adminCommands = require('./adminCommands');
        adminCommands.handleClearTextCommand(bot, msg);
    } else if (listTextRegex.test(text)) {
        console.log(`📋 Handling /list_text from user ${msg.from.id}`);
        const adminCommands = require('./adminCommands');
        adminCommands.handleListTextCommand(bot, msg);
    } else if (removeTextRegex.test(text)) {
        console.log(`🗑️ Handling /remove_text from user ${msg.from.id}`);
        const adminCommands = require('./adminCommands');
        const id = parseInt(text.substring(12).trim());
        adminCommands.handleRemoveTextCommand(bot, msg, [null, id]);
    } else if (broadcastRegex.test(text)) {
        console.log(`📢 Handling /broadcast from user ${msg.from.id}`);
        const adminCommands = require('./adminCommands');
        const message = text.substring(10).trim();
        adminCommands.handleBroadcastCommand(bot, msg, [null, message]);
    } else if (addCasinoRegex.test(text)) {
        console.log(`🎰 Handling /add_casino from user ${msg.from.id}`);
        const casinoCommands = require('./casinoCommands');
        casinoCommands.handleAddCasinoCommand(bot, msg, casinoEditingState);
    } else if (listCasinosRegex.test(text)) {
        console.log(`📋 Handling /list_casinos from user ${msg.from.id}`);
        const casinoCommands = require('./casinoCommands');
        casinoCommands.handleListCasinosCommand(bot, msg);
    } else if (editCasinoRegex.test(text)) {
        console.log(`✏️ Handling /edit_casino from user ${msg.from.id}`);
        const casinoCommands = require('./casinoCommands');
        const id = parseInt(text.substring(12).trim());
        casinoCommands.handleEditCasinoCommand(bot, msg, [null, id]);
    } else if (approveRegex.test(text)) {
        console.log(`✅ Handling /odobri from user ${msg.from.id}`);
        const adminCommands = require('./adminCommands');
        const userId = parseInt(text.substring(7).trim());
        adminCommands.handleApproveCommand(bot, msg, [null, userId]);
    } else if (approvalsRegex.test(text)) {
        console.log(`📋 Handling /approvals from user ${msg.from.id}`);
        const adminCommands = require('./adminCommands');
        adminCommands.handleApprovalsCommand(bot, msg);
    } else if (referralRegex.test(text)) {
        console.log(`🤝 Handling /referral from user ${msg.from.id}`);
        const referralCommands = require('./referralCommands');
        referralCommands.handleReferralCommand(bot, msg);
    } else {
        console.log(`❓ Unknown command: "${text}" from user ${msg.from.id}`);
        // Если это не команда, а просто текст - игнорируем
        if (text.startsWith('/')) {
            bot.sendMessage(msg.chat.id, '❌ Неизвестная команда. Используйте /help для списка команд.')
                .catch(error => console.error('Error sending unknown command message:', error.message));
        }
    }
}

function handleApprovalRequest(bot, msg) {
    const username = msg.text.trim();
    const userId = msg.from.id;
    
    console.log(`📋 Approval request processing for user ${userId}: ${username}`);
    
    if (!username.startsWith('@') || username.length < 5) {
        return bot.sendMessage(msg.chat.id, '❌ Пожалуйста, введите корректный username в формате @username')
            .catch(error => console.error('Error sending validation message:', error.message));
    }

    const success = database.requestApproval(userId, username);
    if (success) {
        bot.sendMessage(msg.chat.id, '✅ Ваш запрос на одобрение отправлен админам! Ожидайте.')
            .catch(error => console.error('Error sending success message:', error.message));
        
        const admins = config.ADMINS;
        admins.forEach(adminId => {
            if (isAdmin(adminId)) {
                bot.sendMessage(adminId,
                    `🆕 Новый запрос на одобрение!\nID: ${userId}\nUsername: ${username}\n/odobri_${userId}`
                ).catch(error => console.error(`Error notifying admin ${adminId}:`, error.message));
            }
        });
    } else {
        bot.sendMessage(msg.chat.id, '❌ Ошибка при отправке запроса')
            .catch(error => console.error('Error sending error message:', error.message));
    }
}

module.exports = {
    handleStartCommand,
    handleHelpCommand,
    handleMessage,
    handleApprovalRequest
};
