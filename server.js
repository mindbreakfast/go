const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs').promises;

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ==== НАСТРОЙКИ ====
const TOKEN = process.env.BOT_TOKEN || '8368808338:AAFQswtEUrguFKjLajbqRTKvUpsQypoWZ8k';
const ADMINS = [1777213824];
const WEB_APP_URL = 'https://gogo-kohl-beta.vercel.app';
// ===================

const bot = new TelegramBot(TOKEN);

// Включаем webhook вместо polling
bot.setWebHook(`https://your-bot-name.onrender.com/bot${TOKEN}`);

// Обрабатываем webhook запросы
app.post(`/bot${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
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
        
        await fs.writeFile('status.json', JSON.stringify(statusData, null, 2));
        console.log('✅ Статус стрима обновлен');
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
    
    bot.sendMessage(msg.chat.id, 'Добро пожаловать! Нажмите кнопку ниже:', keyboard);
});

// Команда /live
bot.onText(/\/live (.+)/, async (msg, match) => {
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
    console.log(`🤖 Webhook set for token: ${TOKEN ? 'SET' : 'MISSING'}`);
});

