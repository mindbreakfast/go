const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const config = require(path.join(__dirname, '..', 'config'));
const { casinoEditingState, clearUserState } = require(path.join(__dirname, 'state'));
const commandHandlers = require(path.join(__dirname, 'commands'));
const logger = require(path.join(__dirname, '..', 'utils', 'logger'));

// СОЗДАЕМ бота БЕЗ автоматического запуска
const bot = new TelegramBot(config.BOT_TOKEN, { 
    polling: false,
    request: {
        timeout: 30000,
        agentOptions: { keepAlive: true }
    }
});

logger.info('Bot instance created');

// ОБРАБОТЧИКИ СООБЩЕНИЙ
bot.on('message', (msg) => {
    if (!msg.text) return;

    logger.debug('Message received', {
        userId: msg.from.id,
        chatId: msg.chat.id,
        text: msg.text.substring(0, 50) + (msg.text.length > 50 ? '...' : '')
    });

    // Обновляем время последней активности для состояния
    if (casinoEditingState.has(msg.from.id)) {
        casinoEditingState.get(msg.from.id).lastActivity = Date.now();
    }

    // Проверяем состояние редактирования казино
    if (casinoEditingState.has(msg.from.id) && casinoEditingState.get(msg.from.id).step) {
        logger.debug('Processing casino creation step', { userId: msg.from.id });
        commandHandlers.handleCasinoCreationStep(bot, msg, casinoEditingState);
        return;
    }

    if (casinoEditingState.has(msg.from.id) && casinoEditingState.get(msg.from.id).editingCasinoId) {
        logger.debug('Processing casino edit response', { userId: msg.from.id });
        commandHandlers.handleCasinoEditResponse(bot, msg, casinoEditingState);
        return;
    }

    logger.debug('Processing regular message', { userId: msg.from.id });
    if (typeof commandHandlers.handleMessage === 'function') {
        commandHandlers.handleMessage(bot, msg);
    } else {
        logger.error('handleMessage function is not available!');
        bot.sendMessage(msg.chat.id, '❌ Системная ошибка. Попробуйте позже.');
    }
});

bot.on('callback_query', (query) => {
    logger.debug('Callback query received', {
        userId: query.from.id,
        data: query.data
    });
    
    if (typeof commandHandlers.handleCallbackQuery === 'function') {
        commandHandlers.handleCallbackQuery(bot, query, casinoEditingState);
    } else {
        logger.error('handleCallbackQuery function is not available!');
        bot.answerCallbackQuery(query.id, { text: '❌ Системная ошибка' });
    }
});

// Обработчик ошибок polling
bot.on('polling_error', (error) => {
    if (error.code === 409) {
        logger.warn('Polling conflict error (409) - old session detected');
        // 🔥 Автоматическая перезагрузка через 5 секунд
        setTimeout(() => {
            logger.info('Restarting bot after 409 error...');
            startBot().catch(err => logger.error('Failed to restart bot:', err));
        }, 5000);
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
        return { success: true, result };
    } catch (error) {
        if (error.response?.statusCode === 403) {
            logger.warn('User blocked the bot', { chatId });
            return { success: false, reason: 'blocked' };
        } else {
            logger.error('Error sending message', {
                chatId,
                error: error.message
            });
            return { success: false, reason: 'error', error };
        }
    }
}

async function startBot() {
    logger.info('Starting Telegram Bot with POLLING...');
    
    try {
        // 🔥 Упрощенная и безопасная стратегия запуска
        if (bot.isPolling()) {
            logger.info('Bot is already polling, stopping first...');
            await bot.stopPolling();
        }

        // 🔥 Принудительная очистка старых сессий
        await bot.deleteWebHook({ drop_pending_updates: true });
        logger.info('Webhook deleted with pending updates drop');

        // 🔥 Проверяем токен бота
        logger.debug('Checking bot token...');
        const me = await bot.getMe();
        logger.debug('Bot token is valid', { username: me.username });

        // 🔥 Запускаем polling с правильными параметрами
        await bot.startPolling({
            timeout: 10,
            limit: 100,
            allowed_updates: ['message', 'callback_query'],
            drop_pending_updates: true
        });
        
        logger.info('Telegram Bot is running in POLLING mode', {
            username: me.username
        });
        
        return { success: true, botInfo: me };
        
    } catch (error) {
        logger.error('Cannot start bot:', { error: error.message });
        
        // 🔥 Пытаемся остановить polling при ошибке
        try {
            await bot.stopPolling();
        } catch (stopError) {
            logger.warn('Error stopping bot after failure:', { error: stopError.message });
        }
        
        // 🔥 Если ошибка авторизации (неверный токен)
        if (error.response?.statusCode === 401) {
            logger.error('INVALID BOT TOKEN! Please check BOT_TOKEN environment variable');
        }
        
        throw error;
    }
}

async function stopBot() {
    try {
        logger.info('Stopping bot polling...');
        await bot.stopPolling();
        logger.info('Bot polling stopped');
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
        logger.info('Bot test successful:', { username: me.username });
        return { success: true, username: me.username };
    } catch (error) {
        logger.error('Bot test failed:', { error: error.message });
        return { success: false, error: error.message };
    }
}

// 📊 Функция для проверки подписки на каналы
async function checkChannelSubscription(userId, channelUsernames = ['@LUDOGOLIK', '@LUDOGOLIK666']) {
    try {
        logger.debug('Checking channel subscriptions', { userId });
        
        const results = await Promise.allSettled(
            channelUsernames.map(channel => 
                bot.getChatMember(channel, userId)
            )
        );

        const subscribed = results.every(result => 
            result.status === 'fulfilled' && result.value.status !== 'left'
        );

        return subscribed;
    } catch (error) {
        logger.error('Error checking channel subscription:', {
            userId,
            error: error.message
        });
        return false;
    }
}

// После запуска бота добавьте:
bot.setMyCommands([
    { command: 'start', description: 'Запустить бота' },
    { command: 'help', description: 'Помощь' },
    { command: 'stats', description: 'Статистика (админы)' },
    { command: 'add_casino', description: 'Добавить казино (админы)' },
    { command: 'list_casinos', description: 'Список казино (админы)' },
    { command: 'edit_casino', description: 'Редактировать казино (админы)' },
    { command: 'referral', description: 'Реферальная система' }
]);

module.exports = {
    bot,
    startBot,
    stopBot,
    safeSendMessage,
    testBot,
    checkChannelSubscription
};
