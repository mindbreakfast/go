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
const DATA_FILE = 'data.json';
// ===================

if (!TOKEN) {
    console.error('❌ FATAL: BOT_TOKEN not found in environment variables');
    process.exit(1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ... (остальной код CORS и т.д.)

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

// ===== ФУНКЦИИ РАБОТЫ С ДАННЫМИ =====
async function loadData() {
    try {
        console.log('🔄 Загружаю данные...');
        
        // Пробуем загрузить из локального файла
        try {
            const data = await fs.readFile(DATA_FILE, 'utf8');
            const parsedData = JSON.parse(data);
            
            casinos = parsedData.casinos || [];
            announcements = parsedData.announcements || [];
            userChats = new Map(Object.entries(parsedData.userChats || {}));
            streamStatus = parsedData.streamStatus || streamStatus;
            
            console.log(`✅ Данные загружены из ${DATA_FILE}: ${casinos.length} казино`);
            return true;
        } catch (error) {
            console.log('📁 Локальный файл не найден, пробую GitHub...');
        }
        
        // Пробуем загрузить из GitHub
        if (GITHUB_TOKEN) {
            try {
                const response = await axios.get(
                    `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`,
                    {
                        headers: {
                            'Authorization': `token ${GITHUB_TOKEN}`,
                            'Accept': 'application/vnd.github.v3.raw'
                        }
                    }
                );
                
                const parsedData = response.data;
                casinos = parsedData.casinos || [];
                announcements = parsedData.announcements || [];
                userChats = new Map(Object.entries(parsedData.userChats || {}));
                streamStatus = parsedData.streamStatus || streamStatus;
                
                // Сохраняем локально
                await saveData();
                
                console.log(`✅ Данные загружены из GitHub: ${casinos.length} казино`);
                return true;
            } catch (error) {
                console.log('❌ Ошибка загрузки из GitHub:', error.message);
            }
        }
        
        // Если всё провалилось, создаем тестовые данные
        if (casinos.length === 0) {
            console.log('📝 Создаю тестовые казино...');
            casinos = [
                {
                    id: 1,
                    name: "PINCO",
                    promocode: "SASH",
                    shortDescription: "Вводи SASH при регистрации, до 180% на деп",
                    fullDescription: "Максимально возможный процент 180%\nМаксимальная сумма бонуса: 500 000 RUB\nОтыгрыш бонуса (вейджер): х50\nПериод на отыгрыш: 3 дня (72 часа)\nМакс. сумма бонуса: 500 000 RUB\nМаксимальный кешаут х10",
                    url: "https://partnerprofitboost.com/L5ztWmif",
                    hiddenKeywords: ["PINCO", "Пинко", "gbyrj", "зштсщ", "pinko", "зштлщ"],
                    category: "other",
                    isActive: true,
                    isPinned: false,
                    createdAt: new Date().toISOString()
                }
            ];
            await saveData();
            console.log(`✅ Создано ${casinos.length} тестовых казино`);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Критическая ошибка загрузки данных:', error);
        return false;
    }
}

async function saveData() {
    try {
        const dataToSave = {
            casinos,
            announcements,
            userChats: Object.fromEntries(userChats),
            streamStatus,
            lastUpdated: new Date().toISOString()
        };
        
        await fs.writeFile(DATA_FILE, JSON.stringify(dataToSave, null, 2));
        console.log('💾 Данные сохранены локально');
        
        // Пытаемся сохранить в GitHub
        if (GITHUB_TOKEN) {
            await saveToGitHub();
        }
        
        return true;
    } catch (error) {
        console.error('❌ Ошибка сохранения данных:', error);
        return false;
    }
}

async function saveToGitHub() {
    try {
        const git = simpleGit();
        await git.addConfig('user.name', 'mindbreakfast');
        await git.addConfig('user.email', 'homegamego@gmail.com');
        
        // Проверяем изменения
        const status = await git.status();
        if (status.modified.includes(DATA_FILE) || status.not_added.includes(DATA_FILE)) {
            await git.add(DATA_FILE);
            await git.commit('Auto-update: ' + new Date().toISOString());
            await git.push('origin', 'main');
            console.log('✅ Данные отправлены в GitHub');
        } else {
            console.log('ℹ️ Изменений нет, коммит не требуется');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Ошибка сохранения в GitHub:', error);
        return false;
    }
}

// ===== ОБНОВЛЕННЫЕ ФУНКЦИИ ДЛЯ КАЗИНО =====
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
    await saveData(); // Сохраняем изменения
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
        await saveData(); // Сохраняем изменения
        return casinos[index];
    }
    return null;
}

async function deleteCasino(id) {
    const index = casinos.findIndex(c => c.id === id);
    if (index !== -1) {
        const deleted = casinos.splice(index, 1)[0];
        await saveData(); // Сохраняем изменения
        return deleted;
    }
    return null;
}

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
    
    // ... (остальной код запуска)
});

// В обработчиках команд заменяем saveDataToFile() на saveData()
