const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

// Замените на ваш токен от @BotFather
const TOKEN = 'YOUR_BOT_TOKEN_HERE';
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
                    web_app: { url: 'https://your-glitch-project.glitch.me' }
                }
            ]]
        }
    };
    
    bot.sendMessage(chatId, 'Добро пожаловать! Нажмите кнопку ниже, чтобы открыть актуальный список казино с промокодами:', keyboard);
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