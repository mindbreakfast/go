const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const config = require(path.join(__dirname, '..', 'config'));
const database = require(path.join(__dirname, '..', 'database', 'database'));
const commandHandlers = require('./commands'); 

// ВКЛЮЧАЕМ POLLING ДЛЯ ТЕСТА
const bot = new TelegramBot(config.BOT_TOKEN, { 
    polling: {
        interval: 300,
        autoStart: true,
        params: {
            timeout: 10
        }
    }
});
console.log('Bot instance created with POLLING');

let casinoEditingState = new Map();

// Убираем webhook setup так как используем polling
async function setupWebhook() {
    console.log('Webhook setup skipped - using polling');
    return true;
}

// ОБРАБОТЧИКИ СООБЩЕНИЙ
bot.on('message', (msg) => {
    console.log('📨 Message received:', msg.text, 'from user:', msg.from.id, 'chat:', msg.chat.id);

    // Проверяем состояние редактирования казино
    if (casinoEditingState.has(msg.from.id) && casinoEditingState.get(msg.from.id).step) {
        console.log('Processing casino creation step');
        commandHandlers.handleCasinoCreationStep(bot, msg, casinoEditingState);
        return;
    }

    if (casinoEditingState.has(msg.from.id) && casinoEditingState.get(msg.from.id).editingCasinoId) {
        console.log('Processing casino edit response');
        commandHandlers.handleCasinoEditResponse(bot, msg, casinoEditingState);
        return;
    }

    if (msg.text) {
        console.log('Processing text message:', msg.text);
        
        if (msg.text.startsWith('/start')) {
            console.log('Handling /start command');
            commandHandlers.handleStartCommand(bot, msg);
            return;
        }
        
        if (msg.text.startsWith('/help')) {
            console.log('Handling /help command');
            commandHandlers.handleHelpCommand(bot, msg);
            return;
        }
        
        // ОБРАБАТЫВАЕМ ВСЕ КОМАНДЫ ЧЕРЕЗ handleMessage
        console.log('Handling general message');
        commandHandlers.handleMessage(bot, msg);
    } else {
        console.log('Non-text message received');
    }
});

bot.on('callback_query', (query) => {
    console.log('🔘 Callback query received:', query.data, 'from user:', query.from.id);
    commandHandlers.handleCallbackQuery(bot, query, casinoEditingState);
});

// Обработчик ошибок polling
bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error);
});

bot.on('webhook_error', (error) => {
    console.error('❌ Webhook error:', error);
});

bot.on('error', (error) => {
    console.error('❌ General bot error:', error);
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
    console.log('🚀 Starting Telegram Bot with POLLING...');
    try {
        // Отключаем webhook если был установлен
        try {
            await bot.deleteWebHook();
            console.log('✅ Webhook deleted');
        } catch (error) {
            console.log('ℹ️ No webhook to delete');
        }
        
        console.log('✅ Telegram Bot is running in POLLING mode');
        console.log('🤖 Bot username:', (await bot.getMe()).username);
        
    } catch (error) {
        console.error('❌ Error starting bot:', error);
        throw error;
    }
}

// Функция для проверки работы бота
async function testBot() {
    try {
        const me = await bot.getMe();
        console.log('✅ Bot test successful:', me.username);
        return true;
    } catch (error) {
        console.error('❌ Bot test failed:', error);
        return false;
    }
}

module.exports = {
    bot,
    start: startBot,
    setupWebhook,
    safeSendMessage,
    casinoEditingState: () => casinoEditingState,
    testBot
};
