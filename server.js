const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ==== НАСТРОЙКИ ====
const TOKEN = process.env.BOT_TOKEN || '8368808338:AAF25l680ekIKpzQyvDj9pKc2zByrJx9dII';
const WEB_APP_URL = 'https://gogo-kohl-beta.vercel.app';
const ADMINS = [1777213824]; // Ваш ID
// ===================

const bot = new TelegramBot(TOKEN, { 
    polling: true,
    onlyFirstMatch: true
});

// Проверка прав
function isAdmin(userId) {
    return ADMINS.includes(Number(userId));
}

// Команда /start
bot.onText(/\/start/, (msg) => {
    const keyboard = {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: '🎰 ОТКРЫТЬ СПИСОК КАЗИНО',
                    web_app: { url: WEB_APP_URL }
                }
            ]]
        }
    };
    
    bot.sendMessage(msg.chat.id, 'Добро пожаловать! Нажмите кнопку ниже:', keyboard)
        .catch(error => console.log('Ошибка отправки:', error));
});

// Команда /stop
bot.onText(/\/stop/, (msg) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    bot.sendMessage(msg.chat.id, '✅ Стрим остановлен');
});

// Команда /live
bot.onText(/\/live (.+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    const streamUrl = match[1];
    bot.sendMessage(msg.chat.id, `✅ Стрим запущен: ${streamUrl}`);
});

// Веб-сервер
app.get('/', (req, res) => {
    res.send('CasinoHub Bot Server is running!');
});

app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
    console.log(`🤖 Bot token: ${TOKEN ? 'SET' : 'MISSING'}`);
});
