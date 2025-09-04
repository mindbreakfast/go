const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ==== НАСТРОЙКИ ====
const TOKEN = process.env.BOT_TOKEN;
const ADMINS = [1777213824, 594143385, 1097210873];
const WEB_APP_URL = 'https://gogo-kohl-beta.vercel.app';
// Получаем URL из переменных окружения Render
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `https://go-5zty.onrender.com`;
// ===================

// Проверка токена
if (!TOKEN) {
    console.error('❌ FATAL: BOT_TOKEN not found in environment variables');
    process.exit(1);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
});

app.options('*', (req, res) => {
    res.sendStatus(200);
});

// Создаем бота
const bot = new TelegramBot(TOKEN);

// ===== ХРАНЕНИЕ ДАННЫХ =====
let streamStatus = {
    isStreamLive: false,
    streamUrl: '',
    eventDescription: '',
    lastUpdated: new Date().toISOString()
};

let announcements = [];
let userChats = new Set();

// ===== ФУНКЦИЯ УСТАНОВКИ WEBHOOK =====
async function setupWebhook() {
    try {
        const webhookUrl = `${RENDER_URL}/webhook`;
        console.log('🔄 Setting up webhook:', webhookUrl);
        
        // Удаляем старый webhook
        await bot.deleteWebHook();
        
        // Устанавливаем новый webhook
        const result = await bot.setWebHook(webhookUrl);
        console.log('✅ Webhook setup result:', result);
        
        // Проверяем статус
        const webhookInfo = await bot.getWebHookInfo();
        console.log('📋 Webhook info:', {
            url: webhookInfo.url,
            pending_updates: webhookInfo.pending_update_count,
            last_error: webhookInfo.last_error_message
        });
        
        return true;
    } catch (error) {
        console.error('❌ Webhook setup error:', error);
        return false;
    }
}

// ===== ПРОВЕРКА ПРАВ =====
function isAdmin(userId) {
    return ADMINS.includes(Number(userId));
}

// ===== ОБНОВЛЕНИЕ СТАТУСА СТРИМА =====
async function updateStreamStatus(isLive, streamUrl = '', eventDescription = '') {
    try {
        streamStatus = {
            isStreamLive: isLive,
            streamUrl: streamUrl,
            eventDescription: eventDescription,
            lastUpdated: new Date().toISOString()
        };
        return true;
    } catch (error) {
        console.error('❌ Ошибка обновления статуса:', error);
        return false;
    }
}

// ===== ФУНКЦИИ ДЛЯ АНОНСОВ =====
function addAnnouncement(text) {
    const newAnnouncement = {
        id: Date.now(),
        text: text,
        createdAt: new Date().toISOString()
    };
    announcements.push(newAnnouncement);
    return true;
}

function clearAnnouncements() {
    announcements = [];
    return true;
}

// ===== ОБРАБОТКА КОМАНД =====

// Команда /start
bot.onText(/\/start/, (msg) => {
    console.log('✅ /start from:', msg.from.id);
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
    
    bot.sendMessage(msg.chat.id, 'Добро пожаловать! Нажмите кнопку ниже:', keyboard);
});

// Команда /stats
bot.onText(/\/stats/, (msg) => {
    if (!isAdmin(msg.from.id)) return;
    
    bot.sendMessage(msg.chat.id,
        `📊 Статистика:\n👥 Users: ${userChats.size}\n🎬 Stream: ${streamStatus.isStreamLive ? 'LIVE' : 'off'}\n📝 Announcements: ${announcements.length}`
    );
});

// Команда /live
bot.onText(/\/live (.+) (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const success = await updateStreamStatus(true, match[1], match[2]);
    bot.sendMessage(msg.chat.id, success ? '✅ Stream started' : '❌ Error');
});

// Команда /stop
bot.onText(/\/stop/, async (msg) => {
    if (!isAdmin(msg.from.id)) return;
    
    const success = await updateStreamStatus(false);
    bot.sendMessage(msg.chat.id, success ? '✅ Stream stopped' : '❌ Error');
});

// Команда /announce
bot.onText(/\/announce (.+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const success = addAnnouncement(match[1]);
    bot.sendMessage(msg.chat.id, success ? '✅ Announcement added' : '❌ Error');
});

// ===== API ENDPOINTS =====

// Webhook endpoint
app.post('/webhook', (req, res) => {
    try {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(200);
    }
});

// Статус стрима
app.get('/status', (req, res) => {
    res.json(streamStatus);
});

// Анонсы
app.get('/announcements', (req, res) => {
    res.json(announcements);
});

// Информация о сервере
app.get('/info', (req, res) => {
    res.json({
        status: 'online',
        users: userChats.size,
        stream: streamStatus,
        webhook_url: `${RENDER_URL}/webhook`
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// ===== ЗАПУСК СЕРВЕРА =====
app.listen(PORT, async () => {
    console.log('===================================');
    console.log('🚀 Server started on port:', PORT);
    console.log('🤖 Bot token:', TOKEN ? 'SET' : 'MISSING');
    console.log('🌐 External URL:', RENDER_URL);
    console.log('===================================');
    
    // Устанавливаем webhook
    setTimeout(async () => {
        const success = await setupWebhook();
        console.log(success ? '✅ Webhook setup successful' : '❌ Webhook setup failed');
    }, 3000);
});

// Ручная установка webhook
app.get('/setup-webhook', async (req, res) => {
    try {
        const success = await setupWebhook();
        res.json({ success, message: success ? 'Webhook setup completed' : 'Webhook setup failed' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});


