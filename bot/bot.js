const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const database = require('../database/database');
const commandHandlers = require('./commands'); 

const bot = new TelegramBot(config.BOT_TOKEN, { polling: false });
console.log('Bot instance created');

let casinoEditingState = new Map();

async function setupWebhook() {
    try {
        const webhookUrl = `${config.RENDER_URL}/webhook`;
        console.log('Setting webhook to:', webhookUrl);
        
        await bot.deleteWebHook();
        const result = await bot.setWebHook(webhookUrl);
        
        const webhookInfo = await bot.getWebHookInfo();
        console.log('Webhook setup successful:', webhookInfo.url);
        
        return true;
    } catch (error) {
        console.error('Webhook setup error:', error);
        return false;
    }
}

// ДОБАВИМ ОБРАБОТЧИКИ СООБЩЕНИЙ ПРАВИЛЬНО
bot.on('message', (msg) => {
    console.log('Message received:', msg.text, 'from:', msg.from.id);
    
    if (casinoEditingState.has(msg.from.id) && casinoEditingState.get(msg.from.id).step) {
        commandHandlers.handleCasinoCreationStep(bot, msg, casinoEditingState);
        return;
    }

    if (casinoEditingState.has(msg.from.id) && casinoEditingState.get(msg.from.id).editingCasinoId) {
        commandHandlers.handleCasinoEditResponse(bot, msg, casinoEditingState);
        return;
    }

    if (msg.text) {
        if (msg.text.startsWith('/start')) {
            commandHandlers.handleStartCommand(bot, msg);
            return;
        }
        if (msg.text.startsWith('/help')) {
            commandHandlers.handleHelpCommand(bot, msg);
            return;
        }
        
        // ОБРАБАТЫВАЕМ ВСЕ КОМАНДЫ ЧЕРЕЗ handleMessage
        commandHandlers.handleMessage(bot, msg);
    }
});

bot.on('callback_query', (query) => {
    console.log('Callback query received:', query.data);
    commandHandlers.handleCallbackQuery(bot, query, casinoEditingState);
});

async function safeSendMessage(chatId, text, options = {}) {
    try {
        await bot.sendMessage(chatId, text, options);
        return true;
    } catch (error) {
        if (error.response && error.response.statusCode === 403) {
            console.log(`User ${chatId} blocked the bot.`);
        } else {
            console.error(`Error sending message to ${chatId}:`, error.message);
        }
        return false;
    }
}

async function startBot() {
    console.log('Starting Telegram Bot...');
    try {
        const webhookSuccess = await setupWebhook();
        if (webhookSuccess) {
            console.log('✅ Telegram Bot is running in webhook mode');
        } else {
            console.log('❌ Telegram Bot webhook setup failed');
        }
    } catch (error) {
        console.error('Error starting bot:', error);
    }
}

module.exports = {
    bot,
    start: startBot,
    setupWebhook,
    safeSendMessage,
    casinoEditingState: () => casinoEditingState
};
