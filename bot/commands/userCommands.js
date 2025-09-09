console.log('✅ userCommands loaded');
const path = require('path');
const config = require(path.join(__dirname, '..', '..', 'config'));
const database = require(path.join(__dirname, '..', '..', 'database', 'database'));
const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));
const { casinoEditingState } = require('../state'); // Импортируем состояние из общего модуля

function handleStartCommand(bot, msg) {
    console.log(`🎬 Handling /start for user ${msg.from.id}`);
    const user = msg.from;
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
Доступные команды: [сокращенный список для примера]
/start - Запустить бота
/help - Помощь
/stats - Статистика (админы)
    `.trim();

    bot.sendMessage(msg.chat.id, helpText)
        .catch(error => console.error('Error sending help:', error.message));
}

function handleMessage(bot, msg) {
    const text = msg.text;
    if (!text) {
        console.log('⚠️ Empty text in handleMessage');
        return;
    }

    console.log(`📝 Handling message: "${text.substring(0, 30)}" from user ${msg.from.id}`);

    // Регулярные выражения для команд
    const statsRegex = /^\/stats$/;
    const addCasinoRegex = /^\/add_casino$/;
    // ... другие regex ...

    if (database.getUserChats().get(msg.from.id)?.waitingForApproval) {
        console.log(`⏳ Handling approval response from user ${msg.from.id}`);
        handleApprovalRequest(bot, msg);
        return;
    }

    if (statsRegex.test(text)) {
        console.log(`📊 Handling /stats from user ${msg.from.id}`);
        const adminCommands = require('./adminCommands');
        adminCommands.handleStatsCommand(bot, msg);
    } else if (addCasinoRegex.test(text)) {
        console.log(`🎰 Handling /add_casino from user ${msg.from.id}`);
        const casinoCommands = require('./casinoCommands');
        // УБИРАЕМ импорт бота - используем переданный экземпляр и общее состояние
        casinoCommands.handleAddCasinoCommand(bot, msg, casinoEditingState);
    }
    // ... обработка других команд ...
}

// ... остальные функции без изменений ...

module.exports = {
    handleStartCommand,
    handleHelpCommand,
    handleMessage,
    handleApprovalRequest
};
