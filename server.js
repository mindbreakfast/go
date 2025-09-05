const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const simpleGit = require('simple-git');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==== НАСТРОЙКИ ====
const TOKEN = process.env.BOT_TOKEN;
const ADMINS = [1777213824, 594143385, 1097210873];
const WEB_APP_URL = 'https://gogo-kohl-beta.vercel.app';
const RENDER_URL = 'https://go-5zty.onrender.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'mindbreakfast/go';
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

// ===== СТРУКТУРЫ ДАННЫХ =====
let streamStatus = {
    isStreamLive: false,
    streamUrl: '',
    eventDescription: '',
    lastUpdated: new Date().toISOString()
};

let announcements = [];
let userChats = new Map(); // Теперь Map для статистики
let casinos = [];
let casinoEditingState = new Map();
let cachedData = null;
let cacheTimestamp = 0;

// ===== КОНСТАНТЫ =====
const ADD_CASINO_STEPS = {
    NAME: 'name',
    PROMOCODE: 'promocode',
    SHORT_DESC: 'short_desc',
    FULL_DESC: 'full_desc',
    URL: 'url',
    CATEGORY: 'category',
    KEYWORDS: 'keywords',
    CONFIRM: 'confirm'
};

const CATEGORIES = [
    {"id": "kb", "name": "КБ"},
    {"id": "royals", "name": "Роялы"},
    {"id": "cats", "name": "Коты"},
    {"id": "bandits", "name": "Бандиты"},
    {"id": "other", "name": "Другие"}
];

// ===== ФУНКЦИИ СОХРАНЕНИЯ ДАННЫХ =====
async function saveDataToFile() {
    try {
        const dataToSave = {
            casinos,
            announcements,
            userChats: Object.fromEntries(userChats),
            streamStatus,
            lastBackup: new Date().toISOString()
        };
        
        await fs.writeFile('data_backup.json', JSON.stringify(dataToSave, null, 2));
        console.log('💾 Данные сохранены в файл');
        return true;
    } catch (error) {
        console.error('❌ Ошибка сохранения в файл:', error);
        return false;
    }
}

async function backupToGitHub() {
    if (!GITHUB_TOKEN) {
        console.log('⚠️ GITHUB_TOKEN не установлен, пропускаем бэкап');
        return false;
    }

    try {
        await saveDataToFile();
        
        const git = simpleGit();
        await git.addConfig('user.name', 'CasinoBot');
        await git.addConfig('user.email', 'bot@casinohub.com');
        
        await git.add('data_backup.json');
        await git.commit('Auto-backup: ' + new Date().toISOString());
        await git.push('origin', 'main');
        
        console.log('✅ Резервная копия отправлена в GitHub');
        return true;
    } catch (error) {
        console.error('❌ Ошибка бэкапа в GitHub:', error);
        return false;
    }
}

async function loadDataFromBackup() {
    try {
        const data = await fs.readFile('data_backup.json', 'utf8');
        const parsedData = JSON.parse(data);
        
        casinos = parsedData.casinos || [];
        announcements = parsedData.announcements || [];
        userChats = new Map(Object.entries(parsedData.userChats || {}));
        streamStatus = parsedData.streamStatus || streamStatus;
        
        console.log('💾 Данные восстановлены из бэкапа:', {
            casinos: casinos.length,
            users: userChats.size,
            announcements: announcements.length
        });
        return true;
    } catch (error) {
        console.log('📁 Файл бэкапа не найден, начинаем с чистого листа');
        return false;
    }
}

// ===== СТАТИСТИКА ПОЛЬЗОВАТЕЛЕЙ =====
function trackUserAction(userId, userInfo, action, target = null) {
    if (!userChats.has(userId)) {
        userChats.set(userId, {
            id: userId,
            username: userInfo.username,
            firstName: userInfo.first_name,
            lastName: userInfo.last_name,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            totalVisits: 0,
            totalClicks: 0,
            casinoClicks: {},
            actions: []
        });
    }

    const user = userChats.get(userId);
    user.lastSeen = new Date().toISOString();
    user.totalVisits++;

    if (action === 'click' && target) {
        user.totalClicks++;
        user.casinoClicks[target] = (user.casinoClicks[target] || 0) + 1;
    }

    user.actions.push({
        action,
        target,
        timestamp: new Date().toISOString()
    });

    // Сохраняем каждое 10-е действие
    if (user.actions.length % 10 === 0) {
        saveDataToFile();
    }
}

function getUserStats(userId) {
    return userChats.get(userId) || null;
}

function getCasinoStats(casinoId) {
    let totalClicks = 0;
    const usersClicked = new Set();

    for (const [userId, user] of userChats) {
        if (user.casinoClicks[casinoId]) {
            totalClicks += user.casinoClicks[casinoId];
            usersClicked.add(userId);
        }
    }

    return {
        totalClicks,
        uniqueUsers: usersClicked.size,
        casino: casinos.find(c => c.id === casinoId)
    };
}

// ===== ФУНКЦИИ ДЛЯ КАЗИНО =====
function getNextCasinoId() {
    return casinos.length > 0 ? Math.max(...casinos.map(c => c.id)) + 1 : 1;
}

function addCasino(casinoData) {
    const newCasino = {
        id: getNextCasinoId(),
        ...casinoData,
        isActive: true,
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    casinos.push(newCasino);
    saveDataToFile();
    return newCasino;
}

function updateCasino(id, updates) {
    const index = casinos.findIndex(c => c.id === id);
    if (index !== -1) {
        casinos[index] = {
            ...casinos[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        saveDataToFile();
        return casinos[index];
    }
    return null;
}

function deleteCasino(id) {
    const index = casinos.findIndex(c => c.id === id);
    if (index !== -1) {
        const deleted = casinos.splice(index, 1)[0];
        saveDataToFile();
        return deleted;
    }
    return null;
}

function getCasino(id) {
    return casinos.find(c => c.id === id);
}

// ===== СИСТЕМА ПОШАГОВОГО ДОБАВЛЕНИЯ =====
function startCasinoCreation(userId) {
    casinoEditingState.set(userId, {
        step: ADD_CASINO_STEPS.NAME,
        data: {}
    });
    return 'Введите название казино:';
}

function processCasinoStep(userId, message) {
    const state = casinoEditingState.get(userId);
    if (!state) return null;

    switch (state.step) {
        case ADD_CASINO_STEPS.NAME:
            state.data.name = message;
            state.step = ADD_CASINO_STEPS.PROMOCODE;
            return 'Введите промокод:';
            
        case ADD_CASINO_STEPS.PROMOCODE:
            state.data.promocode = message;
            state.step = ADD_CASINO_STEPS.SHORT_DESC;
            return 'Введите краткое описание:';
            
        case ADD_CASINO_STEPS.SHORT_DESC:
            state.data.shortDescription = message;
            state.step = ADD_CASINO_STEPS.FULL_DESC;
            return 'Введите полное описание (или "пропустить"):';
            
        case ADD_CASINO_STEPS.FULL_DESC:
            state.data.fullDescription = message === 'пропустить' ? '' : message;
            state.step = ADD_CASINO_STEPS.URL;
            return 'Введите URL ссылку:';
            
        case ADD_CASINO_STEPS.URL:
            state.data.url = message;
            state.step = ADD_CASINO_STEPS.CATEGORY;
            const categoriesList = CATEGORIES.map(c => `${c.id} - ${c.name}`).join('\n');
            return `Выберите категорию:\n${categoriesList}`;
            
        case ADD_CASINO_STEPS.CATEGORY:
            state.data.category = message;
            state.step = ADD_CASINO_STEPS.KEYWORDS;
            return 'Введите ключевые слова через запятую (или "пропустить"):';
            
        case ADD_CASINO_STEPS.KEYWORDS:
            state.data.hiddenKeywords = message === 'пропустить' ? [] : message.split(',').map(k => k.trim());
            state.step = ADD_CASINO_STEPS.CONFIRM;
            
            const casinoData = `
🎰 *Название:* ${state.data.name}
🎫 *Промокод:* ${state.data.promocode}
📝 *Описание:* ${state.data.shortDescription}
🔗 *Ссылка:* ${state.data.url}
🏷️ *Категория:* ${state.data.category}
🔍 *Ключевые слова:* ${state.data.hiddenKeywords.join(', ')}

Для подтверждения введите "да", для отмены "нет"`;
            
            return casinoData;
            
        case ADD_CASINO_STEPS.CONFIRM:
            if (message.toLowerCase() === 'да') {
                const newCasino = addCasino(state.data);
                casinoEditingState.delete(userId);
                return `✅ Казино добавлено! ID: ${newCasino.id}`;
            } else {
                casinoEditingState.delete(userId);
                return '❌ Добавление отменено';
            }
    }
    
    return null;
}

// ===== ПРОГРЕВ СЕРВЕРА =====
async function keepAlive() {
    try {
        setInterval(async () => {
            try {
                await axios.get(`${RENDER_URL}/health`);
                console.log('✅ Сервер прогрет:', new Date().toLocaleTimeString('ru-RU'));
            } catch (error) {
                console.log('❌ Ошибка прогрева:', error.message);
            }
        }, 4 * 60 * 1000);
    } catch (error) {
        console.log('Ошибка инициализации keepAlive:', error);
    }
}

// ===== WEBHOOK =====
async function setupWebhook() {
    try {
        const webhookUrl = `${RENDER_URL}/webhook`;
        await bot.deleteWebHook();
        await bot.setWebHook(webhookUrl);
        return true;
    } catch (error) {
        console.error('❌ Ошибка webhook:', error);
        return false;
    }
}

function isAdmin(userId) {
    return ADMINS.includes(Number(userId));
}

// ===== КОМАНДЫ БОТА =====
// ... (здесь будут все команды бота из предыдущего кода)
// Команды /start, /help, /live, /stop, /text, /clear_text, /list_text, /remove_text, /broadcast

// Добавляем обработку статистики
bot.onText(/\/stats_users/, (msg) => {
    if (!isAdmin(msg.from.id)) return;
    
    const stats = {
        totalUsers: userChats.size,
        totalVisits: Array.from(userChats.values()).reduce((sum, user) => sum + user.totalVisits, 0),
        totalClicks: Array.from(userChats.values()).reduce((sum, user) => sum + user.totalClicks, 0),
        activeToday: Array.from(userChats.values()).filter(user => {
            return new Date(user.lastSeen).toDateString() === new Date().toDateString();
        }).length
    };
    
    bot.sendMessage(msg.chat.id, 
        `📊 *Статистика пользователей:*\n\n` +
        `👥 Всего пользователей: ${stats.totalUsers}\n` +
        `🚀 Всего визитов: ${stats.totalVisits}\n` +
        `🖱️ Всего кликов: ${stats.totalClicks}\n` +
        `🔥 Активных сегодня: ${stats.activeToday}`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/stats_user (\d+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const userId = parseInt(match[1]);
    const user = getUserStats(userId);
    
    if (!user) {
        return bot.sendMessage(msg.chat.id, '❌ Пользователь не найден');
    }
    
    const topCasinos = Object.entries(user.casinoClicks)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, clicks]) => {
            const casino = getCasino(parseInt(id));
            return casino ? `${casino.name}: ${clicks} кликов` : `Казино ${id}: ${clicks} кликов`;
        })
        .join('\n');
    
    bot.sendMessage(msg.chat.id,
        `👤 *Статистика пользователя:*\n\n` +
        `ID: ${user.id}\n` +
        `Username: @${user.username || 'нет'}\n` +
        `Имя: ${user.firstName} ${user.lastName || ''}\n` +
        `Первый визит: ${new Date(user.firstSeen).toLocaleString('ru-RU')}\n` +
        `Последний визит: ${new Date(user.lastSeen).toLocaleString('ru-RU')}\n` +
        `Всего визитов: ${user.totalVisits}\n` +
        `Всего кликов: ${user.totalClicks}\n\n` +
        `🎰 Топ казино:\n${topCasinos || 'Нет данных'}`,
        { parse_mode: 'Markdown' }
    );
});

// ===== API ENDPOINTS =====
app.post('/webhook', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.get('/api/all-data', (req, res) => {
    if (cachedData && Date.now() - cacheTimestamp < 2 * 60 * 1000) {
        return res.json(cachedData);
    }
    
    cachedData = {
        streamStatus: streamStatus,
        announcements: announcements,
        casinos: casinos,
        categories: CATEGORIES
    };
    cacheTimestamp = Date.now();
    
    res.json(cachedData);
});

// ===== API ENDPOINTS =====

// Главная страница
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        message: 'Ludogolik Bot Server is running!',
        stats: {
            users: userChats.size,
            casinos: casinos.length,
            announcements: announcements.length,
            stream_live: streamStatus.isStreamLive
        },
        endpoints: {
            webhook: '/webhook',
            api_data: '/api/all-data',
            status: '/status',
            health: '/health',
            info: '/info'
        }
    });
});

app.post('/webhook', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// ... остальные endpoints




// ===== ЗАПУСК СЕРВЕРА =====
app.listen(PORT, async () => {
    console.log('===================================');
    console.log('🚀 Ludogolik Bot Server запущен!');
    console.log('📞 Порт:', PORT);
    
    // Загружаем данные из бэкапа
    await loadDataFromBackup();
    
    // Запускаем прогрев
    keepAlive();
    
    // Бэкап в GitHub каждые 30 минут
    setInterval(backupToGitHub, 30 * 60 * 1000);
    
    // Сохранение в файл каждые 5 минут
    setInterval(saveDataToFile, 5 * 60 * 1000);
    
    setTimeout(async () => {
        await setupWebhook();
    }, 3000);
});



