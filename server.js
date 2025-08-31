const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();
const ADMINS = [1777213824]; // Замените на реальные ID

// Функция проверки прав
function isAdmin(userId) {
    return ADMINS.includes(userId);
}

// В обработчиках команд добавьте проверку:
bot.onText(/\/live (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '❌ Эта команда только для администратора!');
    }
    
    // Остальная логика команды...
    const streamUrl = match[1];
    bot.sendMessage(chatId, `Стрим запущен! Ссылка: ${streamUrl}`);
});

// ниже все остальное

// Замените на ваш токен от @BotFather
const TOKEN = '8368808338:AAGyyuxvjGJ---R0YZVSv9IIwiDQWcQjUi8';
const bot = new TelegramBot(TOKEN, { polling: true });

// Настройка веб-приложения
app.use(express.static('public')); // Папка с нашими файлами
app.listen(3000, () => console.log('Server started on port 3000'));

// ===== КОМАНДЫ БОТА =====

// Команда /start - показывает кнопку с приложением
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const keyboard = {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: '🎰 ОТКРЫТЬ СПИСОК КАЗИНО',
                    web_app: { url: 'https://gogo-mru3lm2yp-mindbreakfasts-projects.vercel.app' }
                }
            ]]
        }
    };
    
    bot.sendMessage(chatId, 'Нажмите кнопку ниже, чтобы открыть актуальный список казино:', keyboard);
});

// Команда /live - запуск трансляции
bot.onText(/\/live (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const streamUrl = match[1];
    
    // Здесь будет логика обновления stream_status.json
    bot.sendMessage(chatId, `Стрим запущен! Ссылка: ${streamUrl}`);
});

// Команда /add - добавление казино (простая версия)
bot.onText(/\/add (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    // Здесь будет логика добавления в JSON
    bot.sendMessage(chatId, 'Казино добавлено в список!');
});

console.log('Bot is running...');