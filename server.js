const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ==== НАСТРОЙКИ ====
const TOKEN = process.env.BOT_TOKEN || '8368808338:AAECcdNDbVJkwlgTlXV_aVnhxrG3wdKRW2A';
const ADMINS = [1777213824, 594143385, 1097210873];
const WEB_APP_URL = 'https://gogo-kohl-beta.vercel.app';
// ===================

// Разрешаем CORS запросы
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Создаем бота
const bot = new TelegramBot(TOKEN, { 
    polling: {
        interval: 300,
        timeout: 10,
        limit: 100
    }
});

// ===== ХРАНЕНИЕ ДАННЫХ В ПАМЯТИ =====
let streamStatus = {
    isStreamLive: false,
    streamUrl: '',
    eventDescription: '',
    lastUpdated: new Date().toISOString()
};

let announcements = [];
let userChats = new Set(); // Для рассылки сообщений

// ===== СИСТЕМА МНОГОШАГОВОГО ДОБАВЛЕНИЯ КАЗИНО =====
const userStates = new Map();
const ADD_CASINO_STEPS = {
    NAME: 'name',
    PROMOCODE: 'promocode', 
    DESCRIPTION: 'description',
    URL: 'url',
    CATEGORY: 'category',
    KEYWORDS: 'keywords',
    CONFIRM: 'confirm'
};

// ===== ОБРАБОТКА ОШИБОК POLLING =====
bot.on('polling_error', (error) => {
    console.log('Polling error:', error.code);
    
    if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
        console.log('Обнаружена ошибка 409, перезапускаем polling через 5 секунд...');
        setTimeout(() => {
            bot.stopPolling().then(() => {
                console.log('Старый polling остановлен');
                bot.startPolling();
                console.log('Новый polling запущен');
            });
        }, 5000);
    }
});

// ===== ПРОВЕРКА ПРАВ =====
function isAdmin(userId) {
    return ADMINS.includes(Number(userId));
}

// ===== ФУНКЦИЯ ОБНОВЛЕНИЯ СТАТУСА СТРИМА =====
async function updateStreamStatus(isLive, streamUrl = '', eventDescription = '') {
    try {
        streamStatus = {
            isStreamLive: isLive,
            streamUrl: streamUrl,
            eventDescription: eventDescription,
            lastUpdated: new Date().toISOString()
        };
        
        console.log('✅ Статус стрима обновлен:', streamStatus);
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка обновления статуса:', error);
        return false;
    }
}

// ===== ФУНКЦИИ ДЛЯ АНОНСОВ =====
function addAnnouncement(text, type = 'info') {
    const newAnnouncement = {
        id: Date.now(),
        text: text,
        type: type,
        createdAt: new Date().toISOString()
    };
    
    announcements.push(newAnnouncement);
    console.log('✅ Анонс добавлен:', newAnnouncement);
    return true;
}

function clearAnnouncements() {
    announcements = [];
    console.log('✅ Все анонсы очищены');
    return true;
}

// ===== КОМАНДЫ БОТА =====

// Команда /start - сохраняем пользователя и показываем кнопку
bot.onText(/\/start/, (msg) => {
    console.log('Получен /start от:', msg.from.id);
    userChats.add(msg.chat.id);
    
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

// Команда /live - запуск стрима
bot.onText(/\/live (.+) (.+)/, async (msg, match) => {
    console.log('Получен /live от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const streamUrl = match[1];
    const eventDescription = match[2];
    
    const success = await updateStreamStatus(true, streamUrl, eventDescription);
    
    bot.sendMessage(msg.chat.id, success ? 
        `✅ Стрим запущен!\nСсылка: ${streamUrl}\nОписание: ${eventDescription}` : 
        '❌ Ошибка обновления статуса'
    );
});

// Команда /stop - остановка стрима
bot.onText(/\/stop/, async (msg) => {
    console.log('Получен /stop от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const success = await updateStreamStatus(false, '', '');
    bot.sendMessage(msg.chat.id, success ? 
        '✅ Стрим остановлен' : 
        '❌ Ошибка обновления статуса'
    );
});

// Команда /announce - добавление анонса
bot.onText(/\/announce (.+)/, (msg, match) => {
    console.log('Получен /announce от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const text = match[1];
    const success = addAnnouncement(text);
    
    bot.sendMessage(msg.chat.id, success ? 
        `✅ Анонс добавлен:\n${text}` : 
        '❌ Ошибка добавления анонса'
    );
});

// Команда /clear_announce - очистка анонсов
bot.onText(/\/clear_announce/, (msg) => {
    console.log('Получен /clear_announce от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const success = clearAnnouncements();
    bot.sendMessage(msg.chat.id, success ? 
        '✅ Все анонсы очищены' : 
        '❌ Ошибка очистки анонсов'
    );
});

// Команда /broadcast - рассылка всем пользователям
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    console.log('Получен /broadcast от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const message = match[1];
    let successCount = 0;
    let errorCount = 0;
    
    bot.sendMessage(msg.chat.id, `📤 Начинаю рассылку для ${userChats.size} пользователей...`);
    
    for (const chatId of userChats) {
        try {
            await bot.sendMessage(chatId, `📢 ОБЪЯВЛЕНИЕ:\n\n${message}`);
            successCount++;
            // Задержка чтобы не превысить лимиты Telegram
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error(`Ошибка отправки для ${chatId}:`, error);
            errorCount++;
        }
    }
    
    bot.sendMessage(msg.from.id,
        `✅ Рассылка завершена!\n` +
        `✓ Доставлено: ${successCount}\n` +
        `✗ Ошибок: ${errorCount}`
    );
});

// Команда /stats - статистика
bot.onText(/\/stats/, (msg) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    bot.sendMessage(msg.chat.id,
        `📊 Статистика бота:\n` +
        `👥 Пользователей: ${userChats.size}\n` +
        `🎬 Стрим: ${streamStatus.isStreamLive ? 'в эфире' : 'не активен'}\n` +
        `📝 Анонсов: ${announcements.length}\n` +
        `🕐 Последнее обновление: ${new Date().toLocaleTimeString()}`
    );
});

// ===== WEB-СЕРВЕР И API =====
app.get('/', (req, res) => {
    res.send(`
        <h1>CasinoHub Bot Server</h1>
        <p>🤖 Бот работает! Пользователей: ${userChats.size}</p>
        <p>👑 Админы: ${ADMINS.join(', ')}</p>
        <p>🌐 WebApp: <a href="${WEB_APP_URL}">${WEB_APP_URL}</a></p>
        <p>📊 <a href="/status">Статус стрима</a></p>
        <p>📝 <a href="/announcements">Анонсы</a></p>
    `);
});

// API для статуса стрима
app.get('/status', (req, res) => {
    res.json(streamStatus);
});

// API для анонсов
app.get('/announcements', (req, res) => {
    res.json(announcements);
});

// API для данных казино
app.get('/casino-data', async (req, res) => {
    try {
        const fs = require('fs').promises;
        const data = await fs.readFile('data_default.json', 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.json({ casinos: [], categories: [] });
    }
});

// ===== ЗАПУСК СЕРВЕРА =====
app.listen(PORT, () => {
    console.log('===================================');
    console.log('🚀 Ludogolik Bot Server запущен!');
    console.log('📞 Порт:', PORT);
    console.log('🤖 Токен установлен');
    console.log('👑 Админы:', ADMINS.join(', '));
    console.log('👥 Пользователей:', userChats.size);
    console.log('===================================');
});

// Принудительный перезапуск polling при старте
setTimeout(() => {
    bot.stopPolling().then(() => {
        console.log('🔄 Перезапускаем polling...');
        bot.startPolling();
        console.log('✅ Polling запущен');
    }).catch(error => {
        console.log('❌ Ошибка перезапуска polling:', error);
        bot.startPolling();
    });
}, 2000);

