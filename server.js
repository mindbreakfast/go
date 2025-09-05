const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// ==== НАСТРОЙКИ ====
const TOKEN = process.env.BOT_TOKEN;
const ADMINS = [1777213824, 594143385, 1097210873];
const WEB_APP_URL = 'https://gogo-kohl-beta.vercel.app';
const RENDER_URL = 'https://go-5zty.onrender.com';
// ===================

if (!TOKEN) {
    console.error('❌ FATAL: BOT_TOKEN not found in environment variables');
    process.exit(1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
});

app.options('*', (req, res) => {
    res.sendStatus(200);
});

const bot = new TelegramBot(TOKEN);

// ===== ХРАНЕНИЕ ДАННЫХ В ПАМЯТИ =====
let streamStatus = {
    isStreamLive: false,
    streamUrl: '',
    eventDescription: '',
    lastUpdated: new Date().toISOString()
};

let announcements = [];
let userChats = new Set();
let cachedData = null;
let cacheTimestamp = 0;

// ===== РЕГУЛЯРНОЕ СОХРАНЕНИЕ =====
function backupToEnv() {
    try {
        console.log('💾 Backup stats:', {
            announcements: announcements.length,
            users: userChats.size,
            time: new Date().toLocaleTimeString('ru-RU')
        });
    } catch (error) {
        console.error('❌ Backup error:', error);
    }
}

// ===== ПРОГРЕВ СЕРВЕРА =====
async function keepAlive() {
    try {
        setInterval(async () => {
            try {
                await axios.get(`${RENDER_URL}/health`);
                backupToEnv();
                console.log('✅ Сервер прогрет:', new Date().toLocaleTimeString('ru-RU'));
            } catch (error) {
                console.log('❌ Ошибка прогрева:', error.message);
            }
        }, 4 * 60 * 1000);
    } catch (error) {
        console.log('Ошибка инициализации keepAlive:', error);
    }
}

// ===== ФУНКЦИЯ УСТАНОВКИ WEBHOOK =====
async function setupWebhook() {
    try {
        const webhookUrl = `${RENDER_URL}/webhook`;
        console.log('🔄 Настраиваю webhook:', webhookUrl);
        
        await bot.deleteWebHook();
        const result = await bot.setWebHook(webhookUrl);
        
        const webhookInfo = await bot.getWebHookInfo();
        console.log('📋 Webhook info:', webhookInfo.url);
        
        return true;
    } catch (error) {
        console.error('❌ Ошибка webhook:', error);
        return false;
    }
}

function isAdmin(userId) {
    return ADMINS.includes(Number(userId));
}

async function updateStreamStatus(isLive, streamUrl = '', eventDescription = '') {
    try {
        streamStatus = {
            isStreamLive: isLive,
            streamUrl: streamUrl,
            eventDescription: eventDescription,
            lastUpdated: new Date().toISOString()
        };
        cachedData = null;
        return true;
    } catch (error) {
        console.error('❌ Ошибка обновления статуса:', error);
        return false;
    }
}

function addAnnouncement(text, color = 'blue') {
    const newAnnouncement = {
        id: Date.now(),
        text: text,
        color: color,
        createdAt: new Date().toISOString()
    };
    announcements.push(newAnnouncement);
    cachedData = null;
    return newAnnouncement.id;
}

function clearAnnouncements() {
    const count = announcements.length;
    announcements = [];
    cachedData = null;
    return count;
}

function removeAnnouncement(id) {
    const index = announcements.findIndex(a => a.id === id);
    if (index !== -1) {
        const removed = announcements.splice(index, 1)[0];
        cachedData = null;
        return removed;
    }
    return null;
}

// ===== КОМАНДЫ БОТА =====

// Команда /start
bot.onText(/\/start/, (msg) => {
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
    
    bot.sendMessage(msg.chat.id, 'Добро пожаловать! Нажмите кнопку ниже чтобы открыть список казино:', keyboard);
});

// Команда /help
bot.onText(/\/help/, (msg) => {
    const helpText = `
🤖 *Доступные команды:*

/start - Запустить бота и открыть список казино
/help - Показать это сообщение
/stats - Статистика бота (только для админов)

👑 *Команды для админов:*
/live [ссылка] [описание] - Начать стрим
/stop - Остановить стрим
/text [сообщение] - Добавить анонс
/clear_text - Очистить все анонсы
/list_text - Показать все анонсы
/remove_text [ID] - Удалить конкретный анонс
/broadcast [сообщение] - Сделать рассылку

💡 *Примеры:*
/live https://twitch.tv Мой крутой стрим
/text цвет:green 🎉 Бонус 200%!
/remove_text 123456789
/text Просто анонс без цвета
    `;
    
    bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

// Команда /stats
bot.onText(/\/stats/, (msg) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    
    bot.sendMessage(msg.chat.id,
        `📊 *Статистика бота:*\n` +
        `👥 Пользователей: ${userChats.size}\n` +
        `🎬 Стрим: ${streamStatus.isStreamLive ? 'В ЭФИРЕ' : 'не активен'}\n` +
        `📝 Анонсов: ${announcements.length}\n` +
        `🕐 Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`,
        { parse_mode: 'Markdown' }
    );
});

// Команда /live - правильный парсинг
bot.onText(/\/live (.+?) (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    
    const streamUrl = match[1];
    const eventDescription = match[2];
    
    const success = await updateStreamStatus(true, streamUrl, eventDescription);
    bot.sendMessage(msg.chat.id, success ? 
        `✅ Стрим запущен!\nСсылка: ${streamUrl}\nОписание: ${eventDescription}` : 
        '❌ Ошибка обновления статуса стрима'
    );
});

// Команда /stop
bot.onText(/\/stop/, async (msg) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    
    const success = await updateStreamStatus(false);
    bot.sendMessage(msg.chat.id, success ? 
        '✅ Стрим остановлен' : 
        '❌ Ошибка остановки стрима'
    );
});

// Команда /text - с поддержкой цветов
bot.onText(/\/text (.+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    
    let text = match[1];
    let color = 'blue';
    
    const colorMatch = text.match(/цвет:(\w+)\s+/i);
    if (colorMatch) {
        color = colorMatch[1];
        text = text.replace(colorMatch[0], '');
    }
    
    const announcementId = addAnnouncement(text, color);
    bot.sendMessage(msg.chat.id, 
        `✅ Анонс добавлен!\nID: ${announcementId}\nЦвет: ${color}\nТекст: ${text}`
    );
});

// Команда /clear_text
bot.onText(/\/clear_text/, (msg) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    
    const count = clearAnnouncements();
    bot.sendMessage(msg.chat.id, 
        `✅ Все анонсы очищены!\nУдалено: ${count} анонсов`
    );
});

// Команда /list_text
bot.onText(/\/list_text/, (msg) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    
    if (announcements.length === 0) {
        return bot.sendMessage(msg.chat.id, '📝 Список анонсов пуст');
    }
    
    const announcementList = announcements.map(a => 
        `🆔 ID: ${a.id}\n🎨 Цвет: ${a.color}\n📝 Текст: ${a.text}\n⏰ Дата: ${new Date(a.createdAt).toLocaleString('ru-RU')}\n──────────────────`
    ).join('\n');
    
    bot.sendMessage(msg.chat.id, 
        `📝 *Список анонсов (${announcements.length}):*\n\n${announcementList}`,
        { parse_mode: 'Markdown' }
    );
});

// Команда /remove_text
bot.onText(/\/remove_text (\d+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    
    const id = parseInt(match[1]);
    const removed = removeAnnouncement(id);
    
    if (removed) {
        bot.sendMessage(msg.chat.id, 
            `✅ Анонс удален!\nID: ${id}\nТекст: ${removed.text}`
        );
    } else {
        bot.sendMessage(msg.chat.id, 
            `❌ Анонс с ID ${id} не найден`
        );
    }
});

// Команда /broadcast
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    
    const message = match[1];
    let successCount = 0;
    let errorCount = 0;
    
    bot.sendMessage(msg.chat.id, `📤 Начинаю рассылку для ${userChats.size} пользователей...`);
    
    for (const chatId of userChats) {
        try {
            await bot.sendMessage(chatId, `📢 ОБЪЯВЛЕНИЕ:\n\n${message}`);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            errorCount++;
        }
    }
    
    bot.sendMessage(msg.from.id,
        `✅ Рассылка завершена!\n` +
        `✓ Доставлено: ${successCount}\n` +
        `✗ Ошибок: ${errorCount}`
    );
});

// ===== API ENDPOINTS =====

app.post('/webhook', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Объединенный endpoint для всех данных
app.get('/api/all-data', (req, res) => {
    if (cachedData && Date.now() - cacheTimestamp < 2 * 60 * 1000) {
        return res.json(cachedData);
    }
    
    cachedData = {
        streamStatus: streamStatus,
        announcements: announcements
    };
    cacheTimestamp = Date.now();
    
    res.json(cachedData);
});

app.get('/status', (req, res) => {
    res.json(streamStatus);
});

app.get('/announcements', (req, res) => {
    res.json(announcements);
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        users: userChats.size,
        announcements: announcements.length,
        memory: process.memoryUsage().rss / 1024 / 1024 + ' MB'
    });
});

app.get('/setup-webhook', async (req, res) => {
    const success = await setupWebhook();
    res.json({ success, message: success ? 'Webhook настроен' : 'Ошибка настройки' });
});

app.get('/info', (req, res) => {
    res.json({
        status: 'online',
        users: userChats.size,
        stream_live: streamStatus.isStreamLive,
        announcements_count: announcements.length,
        server_time: new Date().toISOString()
    });
});

// ===== ЗАПУСК СЕРВЕРА =====
app.listen(PORT, async () => {
    console.log('===================================');
    console.log('🚀 Ludogolik Bot Server запущен!');
    console.log('📞 Порт:', PORT);
    console.log('🌐 URL:', RENDER_URL);
    console.log('🤖 Токен:', TOKEN ? 'Установлен' : 'Отсутствует');
    console.log('👑 Админы:', ADMINS.join(', '));
    console.log('===================================');
    
    // Запускаем прогрев сервера
    keepAlive();
    
    // Бэкап каждые 5 минут
    setInterval(backupToEnv, 5 * 60 * 1000);
    
    setTimeout(async () => {
        const success = await setupWebhook();
        if (success) {
            console.log('✅ Webhook успешно настроен');
        } else {
            console.log('❌ Ошибка настройки webhook');
        }
    }, 3000);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Останавливаем бота...');
    backupToEnv();
    bot.deleteWebHook();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Останавливаем бота...');
    backupToEnv();
    bot.deleteWebHook();
    process.exit(0);
});

