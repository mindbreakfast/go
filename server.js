const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// ==== НАСТРОЙКИ ====
const TOKEN = process.env.BOT_TOKEN || '8368808338:AAECcdNDbVJkwlgTlXV_aVnhxrG3wdKRW2A';
const ADMINS = [1777213824];
const WEB_APP_URL = 'https://gogo-kohl-beta.vercel.app';
// ===================

// Создаем бота БЕЗ автоматического polling
const bot = new TelegramBot(TOKEN);

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
app.get('/status', async (req, res) => {
    try {
        const statusData = await fs.readFile('status.json', 'utf8');
        res.json(JSON.parse(statusData));
    } catch (error) {
        res.json({ isStreamLive: false, streamUrl: '' });
    }
});

// Endpoint для получения данных казино
app.get('/casino-data', async (req, res) => {
    try {
        const data = await fs.readFile('data_default.json', 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.json({ casinos: [], categories: [] });
    }
});

// Умная функция запуска polling с защитой от 409
let isPolling = false;

function startSmartPolling() {
    if (isPolling) return;
    
    bot.startPolling({
        interval: 300,
        timeout: 10,
        limit: 1,
        params: {
            allowed_updates: ['message']
        }
    }).then(() => {
        isPolling = true;
        console.log('✅ Polling успешно запущен');
    }).catch(error => {
        console.log('❌ Ошибка запуска polling:', error.message);
        
        if (error.message.includes('409')) {
            console.log('🔄 Обнаружена ошибка 409, пробуем снова через 5 секунд...');
            setTimeout(startSmartPolling, 5000);
        }
    });
}

// Обработка ошибок polling
bot.on('polling_error', (error) => {
    console.log('Polling error:', error.code);
    
    if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
        console.log('🔁 Обнаружена ошибка 409, перезапускаем polling...');
        isPolling = false;
        setTimeout(startSmartPolling, 3000);
    }
});

// Запускаем сервер и умный polling
app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
    console.log(`🤖 Bot token: ${TOKEN ? 'SET' : 'MISSING'}`);
    
    // Запускаем polling через 3 секунды после старта сервера
    setTimeout(startSmartPolling, 3000);
});


