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
let userChats = new Map();
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

// ===== ФУНКЦИИ РАБОТЫ С ДАННЫМИ =====
async function loadData() {
    try {
        console.log('🔄 Загружаю данные...');
        
        // Пробуем загрузить из локального файла
        try {
            const data = await fs.readFile('data.json', 'utf8');
            const parsedData = JSON.parse(data);
            
            casinos = parsedData.casinos || [];
            announcements = parsedData.announcements || [];
            userChats = new Map(Object.entries(parsedData.userChats || {}));
            streamStatus = parsedData.streamStatus || streamStatus;
            
            console.log(`✅ Данные загружены из data.json: ${casinos.length} казино`);
            return true;
        } catch (error) {
            console.log('📁 Локальный файл не найден, создаю новый...');
        }
        
        // Если файла нет, создаем базовую структуру
        const dataToSave = {
            casinos: [],
            announcements: [],
            userChats: {},
            streamStatus: {
                isStreamLive: false,
                streamUrl: "",
                eventDescription: "",
                lastUpdated: new Date().toISOString()
            },
            categories: [
                {"id": "kb", "name": "КБ"},
                {"id": "royals", "name": "Роялы"},
                {"id": "cats", "name": "Коты"},
                {"id": "bandits", "name": "Бандиты"},
                {"id": "other", "name": "Другие"}
            ],
            lastUpdated: new Date().toISOString()
        };
        
        await fs.writeFile('data.json', JSON.stringify(dataToSave, null, 2));
        console.log('✅ Создан новый файл data.json');
        
        return true;
    } catch (error) {
        console.error('❌ Критическая ошибка загрузки данных:', error);
        return false;
    }
}

async function saveData() {
    try {
        const dataToSave = {
            casinos: casinos,
            announcements: announcements,
            userChats: Object.fromEntries(userChats),
            streamStatus: streamStatus,
            categories: [
                {"id": "kb", "name": "КБ"},
                {"id": "royals", "name": "Роялы"},
                {"id": "cats", "name": "Коты"},
                {"id": "bandits", "name": "Бандиты"},
                {"id": "other", "name": "Другие"}
            ],
            lastUpdated: new Date().toISOString()
        };
        
        await fs.writeFile('data.json', JSON.stringify(dataToSave, null, 2));
        console.log('💾 Данные сохранены в data.json');
        
        // Пытаемся сохранить в GitHub
        await saveToGitHub();
        
        return true;
    } catch (error) {
        console.error('❌ Ошибка сохранения данных:', error);
        return false;
    }
}

async function saveToGitHub() {
    if (!GITHUB_TOKEN) {
        console.log('⚠️ GITHUB_TOKEN не установлен, пропускаем синхронизацию');
        return false;
    }

    try {
        const git = simpleGit();
        await git.addConfig('user.name', 'mindbreakfast');
        await git.addConfig('user.email', 'homegamego@gmail.com');
        
        await git.add('data.json');
        await git.commit('Auto-update: ' + new Date().toISOString());
        await git.push('origin', 'main');
        
        console.log('✅ Данные отправлены в GitHub');
        return true;
    } catch (error) {
        console.error('❌ Ошибка сохранения в GitHub:', error.message);
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

    if (user.actions.length % 10 === 0) {
        saveData();
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

async function addCasino(casinoData) {
    const newCasino = {
        id: getNextCasinoId(),
        ...casinoData,
        isActive: true,
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    casinos.push(newCasino);
    await saveData();
    return newCasino;
}

async function updateCasino(id, updates) {
    const index = casinos.findIndex(c => c.id === id);
    if (index !== -1) {
        casinos[index] = {
            ...casinos[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        await saveData();
        return casinos[index];
    }
    return null;
}

async function deleteCasino(id) {
    const index = casinos.findIndex(c => c.id === id);
    if (index !== -1) {
        const deleted = casinos.splice(index, 1)[0];
        await saveData();
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

async function processCasinoStep(userId, message) {
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
            const categoriesList = [
                {"id": "kb", "name": "КБ"},
                {"id": "royals", "name": "Роялы"},
                {"id": "cats", "name": "Коты"},
                {"id": "bandits", "name": "Бандиты"},
                {"id": "other", "name": "Другие"}
            ].map(c => `${c.id} - ${c.name}`).join('\n');
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
                const newCasino = await addCasino(state.data);
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
        await saveData();
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
    saveData();
    return newAnnouncement.id;
}

function clearAnnouncements() {
    const count = announcements.length;
    announcements = [];
    cachedData = null;
    saveData();
    return count;
}

function removeAnnouncement(id) {
    const index = announcements.findIndex(a => a.id === id);
    if (index !== -1) {
        const removed = announcements.splice(index, 1)[0];
        cachedData = null;
        saveData();
        return removed;
    }
    return null;
}

// ===== КОМАНДЫ БОТА =====

// Команда /start
bot.onText(/\/start/, (msg) => {
    const user = msg.from;
    trackUserAction(user.id, user, 'start');
    
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
/add_casino - Добавить казино
/list_casinos - Список казино
/edit_casino [ID] - Редактировать казино

💡 *Примеры:*
/live https://twitch.tv Мой крутой стрим
/text цвет:green 🎉 Бонус 200%!
/remove_text 123456789
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
        `🎰 Казино: ${casinos.length}\n` +
        `🕐 Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`,
        { parse_mode: 'Markdown' }
    );
});

// Команда /live
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

// Команда /text
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
    
    for (const [userId] of userChats) {
        try {
            await bot.sendMessage(userId, `📢 ОБЪЯВЛЕНИЕ:\n\n${message}`);
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

// Команда /add_casino
bot.onText(/\/add_casino/, (msg) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    
    const response = startCasinoCreation(msg.from.id);
    bot.sendMessage(msg.chat.id, response);
});

// Команда /list_casinos
bot.onText(/\/list_casinos/, (msg) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    
    if (casinos.length === 0) {
        return bot.sendMessage(msg.chat.id, '📝 Список казино пуст');
    }
    
    const casinoList = casinos.map(c => 
        `🎰 ID: ${c.id} - ${c.name}\n🎫 Промо: ${c.promocode}\n🏷️ Категория: ${c.category}\n🔗 ${c.url}\n──────────────────`
    ).join('\n');
    
    bot.sendMessage(msg.chat.id, 
        `📝 *Список казино (${casinos.length}):*\n\n${casinoList}`,
        { parse_mode: 'Markdown' }
    );
});

// Команда /edit_casino
bot.onText(/\/edit_casino (\d+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    
    const id = parseInt(match[1]);
    const casino = getCasino(id);
    
    if (!casino) {
        return bot.sendMessage(msg.chat.id, `❌ Казино с ID ${id} не найдено`);
    }
    
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✏️ Название', callback_data: `edit_name_${id}` },
                    { text: '🎫 Промокод', callback_data: `edit_promo_${id}` }
                ],
                [
                    { text: '📝 Описание', callback_data: `edit_desc_${id}` },
                    { text: '🔗 Ссылка', callback_data: `edit_url_${id}` }
                ],
                [
                    { text: '🏷️ Категория', callback_data: `edit_category_${id}` },
                    { text: '📌 Закрепить', callback_data: `pin_${id}` },
                    { text: '👻 Скрыть', callback_data: `hide_${id}` }
                ],
                [
                    { text: '🚫 Удалить', callback_data: `delete_${id}` }
                ]
            ]
        }
    };
    
    bot.sendMessage(msg.chat.id, 
        `🎰 *Редактирование казино:*\n\nID: ${casino.id}\nНазвание: ${casino.name}\nПромокод: ${casino.promocode}\nКатегория: ${casino.category}\nСтатус: ${casino.isActive ? '✅ Активно' : '❌ Скрыто'}\nЗакреплено: ${casino.isPinned ? '✅ Да' : '❌ Нет'}\n\nВыберите что редактировать:`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
    );
});

// Обработка callback кнопок
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    try {
        if (data.startsWith('edit_')) {
            const [action, id] = data.split('_').slice(1);
            const casinoId = parseInt(id);
            
            casinoEditingState.set(chatId, {
                editingCasinoId: casinoId,
                editingField: action
            });
            
            const fieldNames = {
                name: 'название',
                promo: 'промокод', 
                desc: 'краткое описание',
                url: 'URL ссылку',
                category: 'категорию'
            };
            
            await bot.sendMessage(chatId, `Введите новое значение для ${fieldNames[action]}:`);
        }
        else if (data.startsWith('delete_')) {
            const casinoId = parseInt(data.split('_')[1]);
            const deleted = await deleteCasino(casinoId);
            
            if (deleted) {
                await bot.sendMessage(chatId, `✅ Казино "${deleted.name}" удалено!`);
            } else {
                await bot.sendMessage(chatId, '❌ Казино не найдено');
            }
        }
        else if (data.startsWith('pin_')) {
            const casinoId = parseInt(data.split('_')[1]);
            const casino = getCasino(casinoId);
            const updated = await updateCasino(casinoId, { isPinned: !casino.isPinned });
            await bot.sendMessage(chatId, updated ? 
                `✅ Казино "${updated.name}" ${updated.isPinned ? 'закреплено' : 'откреплено'}!` : 
                '❌ Ошибка'
            );
        }
        else if (data.startsWith('hide_')) {
            const casinoId = parseInt(data.split('_')[1]);
            const updated = await updateCasino(casinoId, { isActive: false });
            await bot.sendMessage(chatId, updated ? `✅ Казино "${updated.name}" скрыто!` : '❌ Ошибка');
        }
        else if (data.startsWith('show_')) {
            const casinoId = parseInt(data.split('_')[1]);
            const updated = await updateCasino(casinoId, { isActive: true });
            await bot.sendMessage(chatId, updated ? `✅ Казино "${updated.name}" показано!` : '❌ Ошибка');
        }
        
        await bot.answerCallbackQuery(query.id);
    } catch (error) {
        console.error('❌ Ошибка в callback:', error);
        await bot.answerCallbackQuery(query.id, { text: '❌ Произошла ошибка' });
    }
});

// Обработка сообщений для редактирования
bot.on('message', async (msg) => {
    if (!isAdmin(msg.from.id) || !casinoEditingState.has(msg.from.id)) return;
    
    const state = casinoEditingState.get(msg.from.id);
    if (!state || !state.editingCasinoId) return;
    
    const casino = getCasino(state.editingCasinoId);
    if (!casino) {
        casinoEditingState.delete(msg.from.id);
        return bot.sendMessage(msg.from.id, '❌ Казино не найдено');
    }
    
    const updates = {};
    switch (state.editingField) {
        case 'name': updates.name = msg.text; break;
        case 'promo': updates.promocode = msg.text; break;
        case 'desc': updates.shortDescription = msg.text; break;
        case 'url': updates.url = msg.text; break;
        case 'category': updates.category = msg.text; break;
    }
    
    await updateCasino(state.editingCasinoId, updates);
    casinoEditingState.delete(msg.from.id);
    
    bot.sendMessage(msg.from.id, `✅ Поле успешно обновлено!`);
});

// Обработка шагов добавления казино
bot.on('message', async (msg) => {
    if (!isAdmin(msg.from.id) || !casinoEditingState.has(msg.from.id)) return;
    
    const state = casinoEditingState.get(msg.from.id);
    if (state && state.step) {
        const response = await processCasinoStep(msg.from.id, msg.text);
        if (response) {
            bot.sendMessage(msg.chat.id, response);
        }
    }
});

// Статистика пользователей
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

// Топ казино по кликам
bot.onText(/\/top_casinos/, (msg) => {
    if (!isAdmin(msg.from.id)) return;
    
    const casinoStats = casinos.map(casino => {
        const stats = getCasinoStats(casino.id);
        return { ...stats, name: casino.name };
    }).sort((a, b) => b.totalClicks - a.totalClicks).slice(0, 10);
    
    if (casinoStats.length === 0) {
        return bot.sendMessage(msg.chat.id, '📊 Нет данных о кликах');
    }
    
    const topList = casinoStats.map((casino, index) => 
        `${index + 1}. ${casino.name}\n   👥 ${casino.uniqueUsers} users | 🖱️ ${casino.totalClicks} clicks`
    ).join('\n\n');
    
    bot.sendMessage(msg.chat.id,
        `🏆 *Топ казино по кликам:*\n\n${topList}`,
        { parse_mode: 'Markdown' }
    );
});

// ===== API ENDPOINTS =====

// Главная страница
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Ludogolik Bot Server работает',
        users: userChats.size,
        stream_live: streamStatus.isStreamLive,
        casinos: casinos.length,
        announcements: announcements.length,
        webhook_url: `${RENDER_URL}/bot${TOKEN}`
    });
});

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
        categories: [
            {"id": "kb", "name": "КБ"},
            {"id": "royals", "name": "Роялы"},
            {"id": "cats", "name": "Коты"},
            {"id": "bandits", "name": "Бандиты"},
            {"id": "other", "name": "Другие"}
        ]
    };
    cacheTimestamp = Date.now();
    
    res.json(cachedData);
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

// Трекинг кликов
app.post('/track-click', async (req, res) => {
    try {
        const { userId, userInfo, casinoId, action } = req.body;
        
        if (userId && userInfo) {
            trackUserAction(userId, userInfo, action, casinoId);
        }
        
        res.json({ status: 'ok' });
    } catch (error) {
        res.status(500).json({ error: 'Tracking error' });
    }
});

// Трекинг визитов
app.post('/track-visit', async (req, res) => {
    try {
        const { userId, userInfo, action } = req.body;
        
        if (userId && userInfo) {
            trackUserAction(userId, userInfo, action);
        }
        
        res.json({ status: 'ok' });
    } catch (error) {
        res.status(500).json({ error: 'Tracking error' });
    }
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
    
    // Загружаем данные при старте
    await loadData();
    
    // Запускаем прогрев
    keepAlive();
    
    // Сохранение в файл каждые 5 минут
    setInterval(saveData, 5 * 60 * 1000);
    
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
    saveData();
    bot.deleteWebHook();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Останавливаем бота...');
    saveData();
    bot.deleteWebHook();
    process.exit(0);
});



