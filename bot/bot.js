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
    // ✅ УБРАН автоматический перезапуск при 409 ошибке
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
    
    try {
        // 🔥 КРИТИЧЕСКИЙ ФИКС: Ждем 10 секунд перед запуском
        console.log('⏳ Waiting 10 seconds to avoid session conflicts...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // 🔥 Принудительная очистка ВСЕХ сессий
        try {
            console.log('🛑 Force closing all sessions...');
            await bot.close();
        } catch (closeError) {
            console.log('ℹ️ Normal close failed, trying emergency cleanup...');
        }

        // 🔥 Гарантированная очистка вебхуков
        try {
            await bot.deleteWebHook({ drop_pending_updates: true });
            console.log('✅ Webhook deleted with pending updates drop');
        } catch (webhookError) {
            console.log('ℹ️ Webhook delete failed:', webhookError.message);
        }

        // 🔥 Еще одно ожидание для гарантии
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 🔥 Запускаем polling с принудительными параметрами
        console.log('🔄 Starting fresh polling session...');
        await bot.startPolling({
            timeout: 30,
            limit: 1, // Минимальный лимит для избежания конфликтов
            allowed_updates: ['message', 'callback_query'],
            drop_pending_updates: true // ⚠️ КРИТИЧЕСКИЙ ПАРАМЕТР
        });
        
        const me = await bot.getMe();
        console.log('✅ Telegram Bot is running in POLLING mode');
        console.log('🤖 Bot username:', me.username);
        
        return { success: true, botInfo: me };
        
    } catch (error) {
        console.error('❌ FATAL: Cannot start bot:', error.message);
        
        // 🔥 НЕ перезапускаем автоматически - это смертельно!
        console.log('💀 Bot startup failed completely. Manual intervention required.');
        
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
