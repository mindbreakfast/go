
https://gogo-kohl-beta.vercel.app
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const TOKEN = '8368808338:AAF25l680ekIKpzQyvDj9pKc2zByrJx9dII'; // ЗАМЕНИТЕ НА РЕАЛЬНЫЙ ТОКЕН!
const WEB_APP_URL = '
'; // ЗАМЕНИТЕ НА ВАШ URL

// ID администраторов (узнать через @userinfobot)
const ADMINS = [1777213824]; // ЗАМЕНИТЕ НА ВАШ ID

const bot = new TelegramBot(TOKEN, { 
    polling: true 
});

// ===== ПРОВЕРКА ПРАВ =====
function isAdmin(userId) {
    return ADMINS.includes(Number(userId));
}

// ===== ОБРАБОТКА КОМАНД =====

// Команда /start - ДЛЯ ВСЕХ
bot.onText(/\/start/, (msg) => {
    console.log('Получена команда /start от:', msg.from.id);
    
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
    
    bot.sendMessage(msg.chat.id, 'Добро пожаловать! Нажмите кнопку ниже:', keyboard);
});

// Команда /help - ДЛЯ ВСЕХ
bot.onText(/\/help/, (msg) => {
    console.log('Получена команда /help');
    bot.sendMessage(msg.chat.id, 'Справка по командам...');
});

// Команда /live - ТОЛЬКО ДЛЯ АДМИНОВ
bot.onText(/\/live (.+)/, (msg, match) => {
    console.log('Получена команда /live от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const streamUrl = match[1];
    bot.sendMessage(msg.chat.id, `✅ Стрим запущен: ${streamUrl}`);
});

// Команда /stop - ТОЛЬКО ДЛЯ АДМИНОВ
bot.onText(/\/stop/, (msg) => {
    console.log('Получена команда /stop от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    bot.sendMessage(msg.chat.id, '✅ Стрим остановлен');
});

// Команда /add - ТОЛЬКО ДЛЯ АДМИНОВ
bot.onText(/\/add/, (msg) => {
    console.log('Получена команда /add от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    bot.sendMessage(msg.chat.id, 'Добавление казино...');
});

// ===== ЗАПУСК СЕРВЕРА =====
app.use(express.static('public'));

app.listen(3000, () => {
    console.log('🚀 Сервер запущен на порту 3000');
    console.log('🤖 Бот инициализирован');
    
    // Проверка токена
    if (!TOKEN || TOKEN.includes('ВАШ_ТОКЕН')) {
        console.error('❌ ОШИБКА: Токен не настроен!');
        return;
    }
    
    console.log('✅ Токен установлен');
    console.log('✅ Ожидаю сообщения...');
});
