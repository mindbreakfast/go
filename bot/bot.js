const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const database = require('../database/database');
const commandHandlers = require('./commands'); // Импортируем обработчики команд

// Создаем экземпляр бота
const bot = new TelegramBot(config.BOT_TOKEN, { polling: false }); // Polling отключен, используем Webhook

// Переменная для отслеживания состояния редактирования (перенесена из server.js)
let casinoEditingState = new Map();

// Функция для настройки вебхука
async function setupWebhook() {
    try {
        const webhookUrl = `${config.RENDER_URL}/webhook`;
        console.log('Setting webhook to:', webhookUrl);

        await bot.deleteWebHook();
        const result = await bot.setWebHook(webhookUrl);

        const webhookInfo = await bot.getWebHookInfo();
        console.log('Webhook info:', webhookInfo.url);

        return true;
    } catch (error) {
        console.error('Webhook setup error:', error);
        return false;
    }
}

// Обработка входящих сообщений от Telegram
bot.on('message', (msg) => {
    // Логируем команды
    if (msg.text && msg.text.startsWith('/')) {
        console.log('Command received:', msg.text, 'from user:', msg.from.id);
    }

    // 1. Проверяем, не находится ли пользователь в процессе добавления/редактирования казино
    if (casinoEditingState.has(msg.from.id) && casinoEditingState.get(msg.from.id).step) {
        // Это сообщение - шаг в добавлении казино (логика из processCasinoStep)
        commandHandlers.handleCasinoCreationStep(bot, msg, casinoEditingState);
        return;
    }

    if (casinoEditingState.has(msg.from.id) && casinoEditingState.get(msg.from.id).editingCasinoId) {
        // Это сообщение - ответ для редактирования казино
        commandHandlers.handleCasinoEditResponse(bot, msg, casinoEditingState);
        return;
    }

    // 2. Если это не состояние редактирования, проверяем команды
    if (msg.text) {
        // Обработка команды /start
        if (msg.text.startsWith('/start')) {
            commandHandlers.handleStartCommand(bot, msg);
            return;
        }

        // Обработка команды /help
        if (msg.text.startsWith('/help')) {
            commandHandlers.handleHelpCommand(bot, msg);
            return;
        }

        // ... другие команды будут обрабатываться здесь
        // Для остальных команд просто передаем сообщение в обработчик команд
        commandHandlers.handleMessage(bot, msg);
    }
});

// Обработка callback_query от inline-кнопок
bot.on('callback_query', (query) => {
    commandHandlers.handleCallbackQuery(bot, query, casinoEditingState);
});

// Функция для отправки сообщения с обработкой ошибок (чтобы бот не падал при попытке написать пользователю, который его заблокировал)
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

// Функция запуска бота
async function startBot() {
    console.log('Starting Telegram Bot...');
    // Настраиваем вебхук при запуске
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

// Экспортируем бота и функции
module.exports = {
    bot,
    start: startBot,
    setupWebhook,
    safeSendMessage,
    // Экспортируем состояние для доступа из других модулей
    casinoEditingState: () => casinoEditingState
};
