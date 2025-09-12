const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const config = require(path.join(__dirname, '..', 'config'));
const { casinoEditingState, clearUserState } = require('./state');
const commandHandlers = require('./commands');
const logger = require('../utils/logger');

// СОЗДАЕМ бота БЕЗ автоматического запуска
const bot = new TelegramBot(config.BOT_TOKEN, { 
    polling: false // Ключевое изменение: убираем autoStart
});

logger.info('✅ Bot instance created (polling NOT started)');

// ОБРАБОТЧИКИ СООБЩЕНИЙ
bot.on('message', (msg) => {
    logger.info('Message received', {
        text: msg.text?.substring(0, 50),
        userId: msg.from.id,
        chatId: msg.chat.id
    });

    // Обновляем время последней активности для состояния
    if (casinoEditingState.has(msg.from.id)) {
        casinoEditingState.get(msg.from.id).lastActivity = Date.now();
    }

    // Проверяем состояние редактирования казино
    if (casinoEditingState.has(msg.from.id) && casinoEditingState.get(msg.from.id).step) {
        logger.debug('Routing to casino creation step handler');
        commandHandlers.handleCasinoCreationStep(bot, msg, casinoEditingState);
        return;
    }

    if (casinoEditingState.has(msg.from.id) && casinoEditingState.get(msg.from.id).editingCasinoId) {
        logger.debug('Routing to casino edit response handler');
        commandHandlers.handleCasinoEditResponse(bot, msg, casinoEditingState);
        return;
    }

    if (msg.text) {
        logger.debug('Routing to general message handler');
        commandHandlers.handleMessage(bot, msg);
    } else {
        logger.debug('Non-text message received, ignoring');
    }
});

bot.on('callback_query', (query) => {
    logger.info('Callback query received', {
        data: query.data,
        userId: query.from.id
    });
    commandHandlers.handleCallbackQuery(bot, query, casinoEditingState);
});

// Обработчик ошибок polling
bot.on('polling_error', (error) => {
    if (error.code === 409) {
        logger.warn('Polling conflict error (409) - old session detected', { 
            message: error.message 
        });
    } else {
        logger.error('Polling error:', { 
            code: error.code, 
            message: error.message 
        });
    }
});

bot.on('error', (error) => {
    logger.error('General bot error:', { error: error.message });
});

async function safeSendMessage(chatId, text, options = {}) {
    try {
        const result = await bot.sendMessage(chatId, text, options);
        logger.info('Message sent successfully', {
            chatId,
            length: text.length,
            hasKeyboard: !!options.reply_markup
        });
        return { success: true, result };
    } catch (error) {
        if (error.response?.statusCode === 403) {
            logger.warn('User blocked the bot', { chatId });
            return { success: false, reason: 'blocked' };
        } else {
            logger.error('Error sending message', {
                chatId,
                error: error.message,
                code: error.response?.statusCode
            });
            return { success: false, reason: 'error', error };
        }
    }
}

async function startBot() {
    logger.info('🚀 Starting Telegram Bot with POLLING...');
    
    try {
        // 🔥 КРИТИЧЕСКИЙ ФИКС: Ждем 10 секунд перед запуском
        logger.info('⏳ Waiting 10 seconds to avoid session conflicts...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // 🔥 Принудительная очистка ВСЕХ сессий
        try {
            logger.info('🛑 Force closing all sessions...');
            await bot.close();
        } catch (closeError) {
            logger.warn('Normal close failed, trying emergency cleanup...');
        }

        // 🔥 Гарантированная очистка вебхуков
        try {
            await bot.deleteWebHook({ drop_pending_updates: true });
            logger.info('✅ Webhook deleted with pending updates drop');
        } catch (webhookError) {
            logger.warn('Webhook delete failed:', { error: webhookError.message });
        }

        // 🔥 Еще одно ожидание для гарантии
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 🔥 Запускаем polling с принудительными параметрами
        logger.info('🔄 Starting fresh polling session...');
        await bot.startPolling({
            timeout: 30,
            limit: 1, // Минимальный лимит для избежания конфликтов
            allowed_updates: ['message', 'callback_query'],
            drop_pending_updates: true // ⚠️ КРИТИЧЕСКИЙ ПАРАМЕТР
        });
        
        const me = await bot.getMe();
        logger.info('✅ Telegram Bot is running in POLLING mode', {
            username: me.username,
            id: me.id
        });
        
        return { success: true, botInfo: me };
        
    } catch (error) {
        logger.error('❌ FATAL: Cannot start bot:', { error: error.message });
        
        // 🔥 НЕ перезапускаем автоматически - это смертельно!
        logger.error('💀 Bot startup failed completely. Manual intervention required.');
        
        throw error;
    }
}

async function stopBot() {
    try {
        logger.info('🛑 Stopping bot polling...');
        await bot.stopPolling();
        logger.info('✅ Bot polling stopped');
        return true;
    } catch (error) {
        logger.error('Error stopping bot:', { error: error.message });
        return false;
    }
}

// Функция для проверки работы бота
async function testBot() {
    try {
        const me = await bot.getMe();
        logger.info('✅ Bot test successful:', { username: me.username });
        return { success: true, username: me.username };
    } catch (error) {
        logger.error('❌ Bot test failed:', { error: error.message });
        return { success: false, error: error.message };
    }
}

// 📊 Новая функция для проверки подписки на каналы
async function checkChannelSubscription(userId, channelUsernames = ['@LUDOGOLIK', '@LUDOGOLIK666']) {
    try {
        logger.debug('Checking channel subscriptions', { userId, channels: channelUsernames });
        
        const results = await Promise.allSettled(
            channelUsernames.map(channel => 
                bot.getChatMember(channel, userId)
            )
        );

        const subscribed = results.every(result => 
            result.status === 'fulfilled' && result.value.status !== 'left'
        );

        logger.info('Channel subscription check result', {
            userId,
            subscribed,
            details: results.map((r, i) => ({
                channel: channelUsernames[i],
                status: r.status === 'fulfilled' ? r.value.status : 'error'
            }))
        });

        return subscribed;
    } catch (error) {
        logger.error('Error checking channel subscription:', {
            userId,
            error: error.message
        });
        return false;
    }
}

module.exports = {
    bot,
    startBot,
    stopBot,
    safeSendMessage,
    testBot,
    checkChannelSubscription
};
