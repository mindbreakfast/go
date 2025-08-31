const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
// Добавьте в начало server.js после express()
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});
const PORT = process.env.PORT || 3000;

// ==== НАСТРОЙКИ ====
const TOKEN = process.env.BOT_TOKEN || '8368808338:AAECcdNDbVJkwlgTlXV_aVnhxrG3wdKRW2A';
const ADMINS = [1777213824];
const WEB_APP_URL = 'https://gogo-kohl-beta.vercel.app';
// ===================

const bot = new TelegramBot(TOKEN, { 
    polling: {
        interval: 300,
        timeout: 10,
        limit: 100
    }
});

// Храним статус в памяти вместо файла
let streamStatus = {
    isStreamLive: false,
    streamUrl: '',
    lastUpdated: new Date().toISOString()
};

// Проверка прав
function isAdmin(userId) {
    return ADMINS.includes(Number(userId));
}

// Функция обновления статуса стрима (в памяти)
async function updateStreamStatus(isLive, streamUrl = '') {
    try {
        streamStatus = {
            isStreamLive: isLive,
            streamUrl: streamUrl,
            lastUpdated: new Date().toISOString()
        };
        
        console.log('✅ Статус стрима обновлен в памяти:', streamStatus);
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
                    web_app: { url: WEB_APP_URL }
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
    
    bot.sendMessage(msg.chat.id, success ? 
        `✅ Стрим запущен: ${streamUrl}` : 
        '❌ Ошибка обновления статуса'
    );
});

// Команда /stop
bot.onText(/\/stop/, async (msg) => {
    console.log('Получен /stop от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const success = await updateStreamStatus(false);
    bot.sendMessage(msg.chat.id, success ? 
        '✅ Стрим остановлен' : 
        '❌ Ошибка обновления статуса'
    );
});

// Веб-сервер
app.get('/', (req, res) => {
    res.send('CasinoHub Bot Server is running!');
});

// Endpoint для проверки статуса
app.get('/status', (req, res) => {
    res.json(streamStatus);
});

// Endpoint для получения данных казино
app.get('/casino-data', async (req, res) => {
    try {
        const fs = require('fs').promises;
        const data = await fs.readFile('data_default.json', 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.json({ casinos: [], categories: [] });
    }
});

// Endpoint для debug
app.get('/debug-status', (req, res) => {
    res.json({
        status: streamStatus,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
    });
});

// Запускаем сервер
app.listen(PORT, () => {
    console.log('===================================');
    console.log('🚀 CasinoHub Bot Server запущен!');
    console.log('📞 Порт:', PORT);
    console.log('🤖 Токен установлен:', TOKEN ? '✅' : '❌');
    console.log('👑 Админы:', ADMINS.join(', '));
    console.log('🌐 WebApp URL:', WEB_APP_URL);
    console.log('💾 Статус хранится в памяти');
    console.log('===================================');
});

