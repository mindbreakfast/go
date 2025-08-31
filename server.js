const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// ==== НАСТРОЙКИ ====
const TOKEN = process.env.BOT_TOKEN || '8368808338:AAF25l680ekIKpzQyvDj9pKc2zByrJx9dII';
const ADMINS = [1777213824];
// ===================

const bot = new TelegramBot(TOKEN, { 
    polling: true,
    onlyFirstMatch: true
});

// Проверка прав
function isAdmin(userId) {
    return ADMINS.includes(Number(userId));
}

// Функция обновления статуса стрима
async function updateStreamStatus(isLive, streamUrl = '') {
    try {
        const statusData = {
            isStreamLive: isLive,
            streamUrl: streamUrl,
            lastUpdated: new Date().toISOString()
        };
        
        // Сохраняем в файл (Render позволяет писать файлы во временную файловую систему)
        await fs.writeFile('status.json', JSON.stringify(statusData, null, 2));
        console.log('✅ Статус стрима обновлен:', statusData);
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка обновления статуса:', error);
        return false;
    }
}

// Команда /start
bot.onText(/\/start/, (msg) => {
    console.log('Получен /start от:', msg.from.id);
    
    const keyboard = {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: '🎰 ОТКРЫТЬ СПИСОК КАЗИНО',
                    web_app: { url: 'https://gogo-kohl-beta.vercel.app' }
                }
            ]]
        }
    };
    
    bot.sendMessage(msg.chat.id, 'Добро пожаловать! Нажмите кнопку ниже:', keyboard)
        .catch(error => console.log('Ошибка отправки:', error));
});

// Команда /live
bot.onText(/\/live (.+)/, async (msg, match) => {
    console.log('Получен /live от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const streamUrl = match[1];
    const success = await updateStreamStatus(true, streamUrl);
    
    if (success) {
        bot.sendMessage(msg.chat.id, `✅ Стрим запущен: ${streamUrl}`);
    } else {
        bot.sendMessage(msg.chat.id, '❌ Ошибка обновления статуса');
    }
});

// Команда /stop
bot.onText(/\/stop/, async (msg) => {
    console.log('Получен /stop от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const success = await updateStreamStatus(false);
    
    if (success) {
        bot.sendMessage(msg.chat.id, '✅ Стрим остановлен');
    } else {
        bot.sendMessage(msg.chat.id, '❌ Ошибка обновления статуса');
    }
});

// Веб-сервер для проверки работы
app.get('/', (req, res) => {
    res.send(`
        <h1>CasinoHub Bot Server</h1>
        <p>Бот работает! Токен: ${TOKEN ? 'установлен' : 'отсутствует'}</p>
        <p>Админы: ${ADMINS.join(', ')}</p>
        <p><a href="https://t.me/your_bot_username">Написать боту</a></p>
    `);
});

// Новый endpoint для проверки статуса стрима
app.get('/status', async (req, res) => {
    try {
        const statusData = await fs.readFile('status.json', 'utf8');
        res.json(JSON.parse(statusData));
    } catch (error) {
        res.json({ isStreamLive: false, streamUrl: '' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
    console.log(`🤖 Bot token: ${TOKEN ? 'SET' : 'MISSING'}`);
    console.log(`👑 Admins: ${ADMINS.join(', ')}`);
});
