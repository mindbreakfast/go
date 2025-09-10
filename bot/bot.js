const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const config = require(path.join(__dirname, '..', 'config'));
const { casinoEditingState, clearUserState } = require('./state');
const commandHandlers = require('./commands');

// СОЗДАЕМ бота БЕЗ автоматического запуска
const bot = new TelegramBot(config.BOT_TOKEN, { 
    polling: false // Ключевое изменение: убираем autoStart
});

console.log('✅ Bot instance created (polling NOT started)');

// ОБРАБОТЧИКИ СООБЩЕНИЙ (остаются без изменений)
bot.on('message', (msg) => {
    console.log('📨 Message received:', msg.text?.substring(0, 50), 'from user:', msg.from.id, 'chat:', msg.chat.id);

    // Обновляем время последней активности для состояния
    if (casinoEditingState.has(msg.from.id)) {
        casinoEditingState.get(msg.from.id).lastActivity = Date.now();
    }

    // Проверяем состояние редактирования казино
    if (casinoEditingState.has(msg.from.id) && casinoEditingState.get(msg.from.id).step) {
        console.log('➡️ Routing to casino creation step handler');
        commandHandlers.handleCasinoCreationStep(bot, msg, casinoEditingState);
        return;
    }

    if (casinoEditingState.has(msg.from.id) && casinoEditingState.get(msg.from.id).editingCasinoId) {
        console.log('➡️ Routing to casino edit response handler');
        commandHandlers.handleCasinoEditResponse(bot, msg, casinoEditingState);
        return;
    }

    if (msg.text) {
        console.log('➡️ Routing to general message handler');
        commandHandlers.handleMessage(bot, msg);
    } else {
        console.log('⚠️ Non-text message received, ignoring');
    }
});

bot.on('callback_query', (query) => {
    console.log('🔘 Callback query received:', query.data, 'from user:', query.from.id);
    commandHandlers.handleCallbackQuery(bot, query, casinoEditingState);
});

// Обработчик ошибок polling
bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error.code, error.message);
    // Можно добавить логику перезапуска при определенных ошибках
});

bot.on('error', (error) => {
    console.error('❌ General bot error:', error.message);
});

async function safeSendMessage(chatId, text, options = {}) {
    try {
        const result = await bot.sendMessage(chatId, text, options);
        console.log(`✅ Message sent to ${chatId}, length: ${text.length}`);
        return { success: true, result };
    } catch (error) {
        if (error.response?.statusCode === 403) {
            console.log(`👤 User ${chatId} blocked the bot`);
            return { success: false, reason: 'blocked' };
        } else {
            console.error(`❌ Error sending message to ${chatId}:`, error.message);
            return { success: false, reason: 'error', error };
        }
    }
}

async function startBot() {
    console.log('🚀 Starting Telegram Bot with POLLING...');
    console.log('🔑 Using BOT_TOKEN:', config.BOT_TOKEN ? config.BOT_TOKEN.substring(0, 10) + '...' : 'MISSING!');
    console.log('🌐 Webhook URL would be:', config.RENDER_URL + '/webhook');
    
    try {
        // 🔥 ГАРАНТИРОВАННАЯ ОЧИСТКА СТАРЫХ СЕССИЙ
        try {
            console.log('🛑 Attempting to close all active sessions...');
            // Пробуем несколько методов для гарантированного выхода
            await bot.close();
            console.log('✅ Bot instance closed successfully');
        } catch (closeError) {
            console.log('ℹ️ Close method failed, trying logOut...');
            try {
                await bot.logOut();
                console.log('✅ Successfully logged out from all sessions');
            } catch (logoutError) {
                console.log('⚠️ Both close and logOut failed, continuing...');
            }
        }

        // Сначала убедимся, что вебхук отключен
        try {
            await bot.deleteWebHook();
            console.log('✅ Webhook deleted (if existed)');
        } catch (error) {
            console.log('ℹ️ No webhook to delete or error:', error.message);
        }
        
        // Даем время на закрытие сессий
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Явно запускаем polling
        console.log('🔄 Starting polling...');
        await bot.startPolling({ 
            timeout: 10,
            limit: 100,
            allowed_updates: ['message', 'callback_query']
        });
        
        const me = await bot.getMe();
        console.log('✅ Telegram Bot is running in POLLING mode');
        console.log('🤖 Bot username:', me.username);
        console.log('📊 Bot state users:', casinoEditingState.size);
        
        return { success: true, botInfo: me };
    } catch (error) {
        console.error('❌ Error starting bot:', error.message);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        
        // Пробуем перезапуститься через 5 секунд при ошибке 409
        if (error.message.includes('409')) {
            console.log('🔄 Restarting bot in 5 seconds due to 409 conflict...');
            setTimeout(startBot, 5000);
        }
        
        throw error;
    }
}

async function stopBot() {
    try {
        console.log('🛑 Stopping bot polling...');
        await bot.stopPolling();
        console.log('✅ Bot polling stopped');
        return true;
    } catch (error) {
        console.error('❌ Error stopping bot:', error.message);
        return false;
    }
}

// Функция для проверки работы бота
async function testBot() {
    try {
        const me = await bot.getMe();
        console.log('✅ Bot test successful:', me.username);
        return { success: true, username: me.username };
    } catch (error) {
        console.error('❌ Bot test failed:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    bot,
    startBot,
    stopBot,
    safeSendMessage,
    testBot
};
