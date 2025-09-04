const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ==== НАСТРОЙКИ ====
const TOKEN = process.env.BOT_TOKEN || 'ВАШ_НОВЫЙ_ТОКЕН';
const ADMINS = [1777213824, 594143385, 1097210873];
const WEB_APP_URL = 'https://gogo-kohl-beta.vercel.app';
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `https://your-app-name.onrender.com`;
// ===================

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Разрешаем CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
});

app.options('*', (req, res) => {
    res.sendStatus(200);
});

// Создаем бота в режиме webhook
const bot = new TelegramBot(TOKEN);
bot.setWebHook(`${RENDER_URL}/bot${TOKEN}`);

// ===== ХРАНЕНИЕ ДАННЫХ =====
let streamStatus = {
    isStreamLive: false,
    streamUrl: '',
    eventDescription: '',
    lastUpdated: new Date().toISOString()
};

let announcements = [];
let userChats = new Set();

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

// ===== ОБРАБОТКА КОМАНД БОТА =====

// Обработчик всех сообщений
bot.on('message', (msg) => {
    console.log('📨 Получено сообщение:', msg.text, 'от:', msg.from.id);
    userChats.add(msg.chat.id);
    
    // Обработка команды /start
    if (msg.text === '/start') {
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
            .catch(error => console.log('❌ Ошибка отправки:', error));
    }
    
    // Обработка команды /stats
    else if (msg.text === '/stats') {
        if (!isAdmin(msg.from.id)) {
            return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
        }
        
        bot.sendMessage(msg.chat.id,
            `📊 Статистика бота:\n` +
            `👥 Пользователей: ${userChats.size}\n` +
            `🎬 Стрим: ${streamStatus.isStreamLive ? 'В ЭФИРЕ' : 'не активен'}\n` +
            `📝 Анонсов: ${announcements.length}\n` +
            `🕐 Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`
        );
    }
});

// Обработка команды /live
bot.onText(/\/live (.+) (.+)/, async (msg, match) => {
    console.log('✅ Получен /live от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const streamUrl = match[1];
    const eventDescription = match[2];
    
    const success = await updateStreamStatus(true, streamUrl, eventDescription);
    
    if (success) {
        for (const chatId of userChats) {
            try {
                await bot.sendMessage(chatId, `🔴 НАЧАЛСЯ СТРИМ!\n${eventDescription}\n${streamUrl}`);
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error('❌ Ошибка рассылки:', error);
            }
        }
    }
    
    bot.sendMessage(msg.chat.id, success ? 
        `✅ Стрим запущен!\nСсылка: ${streamUrl}\nОписание: ${eventDescription}` : 
        '❌ Ошибка обновления статуса'
    );
});

// Обработка команды /stop
bot.onText(/\/stop/, async (msg) => {
    console.log('✅ Получен /stop от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const success = await updateStreamStatus(false, '', '');
    bot.sendMessage(msg.chat.id, success ? 
        '✅ Стрим остановлен' : 
        '❌ Ошибка обновления статуса'
    );
});

// Обработка команды /announce
bot.onText(/\/announce (.+)/, (msg, match) => {
    console.log('✅ Получен /announce от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const text = match[1];
    const success = addAnnouncement(text);
    
    if (success) {
        for (const chatId of userChats) {
            try {
                bot.sendMessage(chatId, `📢 АНОНС:\n${text}`);
            } catch (error) {
                console.error('❌ Ошибка рассылки:', error);
            }
        }
    }
    
    bot.sendMessage(msg.chat.id, success ? 
        `✅ Анонс добавлен и разослан:\n${text}` : 
        '❌ Ошибка добавления анонса'
    );
});

// Обработка команды /clear_announce
bot.onText(/\/clear_announce/, (msg) => {
    console.log('✅ Получен /clear_announce от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const success = clearAnnouncements();
    bot.sendMessage(msg.chat.id, success ? 
        '✅ Все анонсы очищены' : 
        '❌ Ошибка очистки анонсов'
    );
});

// ===== WEB-СЕРВЕР И API =====

// Webhook endpoint для Telegram
app.post(`/bot${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Основной endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Ludogolik Bot Server работает (Webhook mode)',
        users: userChats.size,
        stream_live: streamStatus.isStreamLive,
        webhook_url: `${RENDER_URL}/bot${TOKEN}`
    });
});

// API для статуса стрима
app.get('/status', (req, res) => {
    res.json(streamStatus);
});

// API для анонсов
app.get('/announcements', (req, res) => {
    res.json(announcements);
});

// Проверка здоровья
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ===== ЗАПУСК СЕРВЕРА =====
app.listen(PORT, () => {
    console.log('===================================');
    console.log('🚀 Ludogolik Bot Server запущен!');
    console.log('📞 Порт:', PORT);
    console.log('🌐 URL:', RENDER_URL);
    console.log('🤖 Токен установлен');
    console.log('👑 Админы:', ADMINS.join(', '));
    console.log('👥 Пользователей:', userChats.size);
    console.log('🔗 Webhook URL:', `${RENDER_URL}/bot${TOKEN}`);
    console.log('===================================');
    
    // Проверяем webhook
    bot.getWebHookInfo().then(info => {
        console.log('📋 Webhook info:', info);
    }).catch(error => {
        console.log('❌ Ошибка получения webhook info:', error);
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Останавливаем бота...');
    bot.deleteWebHook();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Останавливаем бота...');
    bot.deleteWebHook();
    process.exit(0);
});


