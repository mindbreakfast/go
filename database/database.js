const fs = require('fs').promises;
const path = require('path');
const githubSync = require('./githubSync');
const config = require('../config');

// Структуры данных (аналогично исходному server.js)
let casinos = [];
let announcements = [];
let userChats = new Map(); // { userId: userData }
let streamStatus = {
    isStreamLive: false,
    streamUrl: '',
    eventDescription: '',
    lastUpdated: new Date().toISOString()
};
// Новые структуры данных для Этапа 2 и 3
let userSettings = new Map(); // { userId: { hiddenCasinos: [], viewMode: 'full'/'compact' } }
let giveaways = []; // Массив активных розыгрышей

class Database {
    constructor() {
        this.dataFilePath = path.join(__dirname, '..', 'data.json');
    }

    async loadData() {
        try {
            console.log('Database: Loading data from local file...');
            const data = await fs.readFile(this.dataFilePath, 'utf8');
            const parsedData = JSON.parse(data);

            // Восстанавливаем данные, включая новые
            casinos = parsedData.casinos || [];
            announcements = parsedData.announcements || [];
            streamStatus = parsedData.streamStatus || streamStatus;

            // Восстанавливаем Map из объекта
            userChats = new Map(Object.entries(parsedData.userChats || {}));

            // Загружаем новые структуры (если есть в файле)
            userSettings = new Map(Object.entries(parsedData.userSettings || {}));
            giveaways = parsedData.giveaways || [];

            console.log(`Database: Loaded ${casinos.length} casinos, ${userChats.size} users, ${userSettings.size} user settings.`);
            return true;

        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('Database: Local data file not found. Creating initial structure...');
                return await this.initializeData();
            } else {
                console.error('Database: Error loading data:', error);
                return false;
            }
        }
    }

    async initializeData() {
        const initialData = {
            casinos: [],
            announcements: [],
            userChats: {},
            userSettings: {}, // Новая структура
            giveaways: [],   // Новая структура
            streamStatus: {
                isStreamLive: false,
                streamUrl: "",
                eventDescription: "",
                lastUpdated: new Date().toISOString()
            },
            categories: config.CATEGORIES, // Используем категории из конфига
            lastUpdated: new Date().toISOString()
        };

        try {
            await fs.writeFile(this.dataFilePath, JSON.stringify(initialData, null, 2));
            // Обновляем внутренние структуры пустыми данными
            casinos = [];
            announcements = [];
            userChats = new Map();
            userSettings = new Map();
            giveaways = [];
            console.log('Database: New data file created with initial structure.');
            return true;
        } catch (error) {
            console.error('Database: Error creating initial data file:', error);
            return false;
        }
    }

    async saveData() {
        try {
            // Подготавливаем объект для сохранения
            const dataToSave = {
                casinos: casinos,
                announcements: announcements,
                userChats: Object.fromEntries(userChats), // Конвертируем Map в Object
                userSettings: Object.fromEntries(userSettings), // Новая структура
                giveaways: giveaways, // Новая структура
                streamStatus: streamStatus,
                categories: config.CATEGORIES,
                lastUpdated: new Date().toISOString()
            };

            // Сохраняем локально
            await fs.writeFile(this.dataFilePath, JSON.stringify(dataToSave, null, 2));
            console.log('Database: Data saved locally.');

            // Пытаемся синхронизировать с GitHub
            const githubResult = await githubSync.saveDataToGitHub(JSON.stringify(dataToSave, null, 2));
            if (githubResult.success) {
                console.log('Database: Data synced to GitHub successfully.');
            } else {
                console.log('Database: Local save OK, GitHub sync failed (non-critical).');
            }

            return { local: true, github: githubResult.success };

        } catch (error) {
            console.error('Database: Error saving data:', error);
            return { local: false, github: false, error: error.message };
        }
    }

    // === Геттеры для доступа к данным ===
// Добавьте этот метод в класс Database в database.js
getCategories() {
    return config.CATEGORIES;
}
    
    getCasinos() { return casinos; }
    getAnnouncements() { return announcements; }
    getUserChats() { return userChats; }
    getStreamStatus() { return streamStatus; }
    getUserSettings() { return userSettings; } // Новый геттер
    getGiveaways() { return giveaways; }       // Новый геттер

    // === Сеттеры для изменения данных ===
    setCasinos(newCasinos) { casinos = newCasinos; }
    setAnnouncements(newAnnouncements) { announcements = newAnnouncements; }
    setStreamStatus(newStatus) { streamStatus = { ...streamStatus, ...newStatus }; }
    // userChats, userSettings, giveaways изменяются через методы ниже

    // === Методы для работы с пользователями (аналогично исходному server.js) ===
    trackUserAction(userId, userInfo, action, target = null) { ... } // Перенеси код из server.js
    getUserStats(userId) { ... } // Перенеси код из server.js

    // === Новые методы для Этапа 2 (Скрытие казино) ===
    hideCasinoForUser(userId, casinoId) {
        if (!userSettings.has(userId)) {
            userSettings.set(userId, { hiddenCasinos: [], viewMode: 'full' });
        }
        const settings = userSettings.get(userId);
        if (!settings.hiddenCasinos.includes(casinoId)) {
            settings.hiddenCasinos.push(casinoId);
        }
        // Здесь же можно добавить трекинг события "hide"
        this.trackUserAction(userId, { id: userId }, 'hide_casino', casinoId);
    }

    unhideCasinoForUser(userId, casinoId) {
        if (userSettings.has(userId)) {
            const settings = userSettings.get(userId);
            settings.hiddenCasinos = settings.hiddenCasinos.filter(id => id !== casinoId);
        }
    }

    getHiddenCasinosForUser(userId) {
        return userSettings.get(userId)?.hiddenCasinos || [];
    }

    // === Новые методы для Этапа 3 (Режим просмотра) ===
    setUserViewMode(userId, mode) {
        if (!['full', 'compact'].includes(mode)) mode = 'full';
        if (!userSettings.has(userId)) {
            userSettings.set(userId, { hiddenCasinos: [], viewMode: mode });
        } else {
            userSettings.get(userId).viewMode = mode;
        }
    }

    getUserViewMode(userId) {
        return userSettings.get(userId)?.viewMode || 'full';
    }
}

// Экспортируем экземпляр класса Database
module.exports = new Database();



