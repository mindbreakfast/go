const fs = require('fs').promises;
const path = require('path');
const githubSync = require('./githubSync');
const config = require('../config');

// Разделяем данные
let casinos = [];
let announcements = [];
let streamStatus = {
    isStreamLive: false,
    streamUrl: '',
    eventDescription: '',
    lastUpdated: new Date().toISOString()
};
let categories = config.CATEGORIES;

// Данные пользователей (не синхронизируем с GitHub)
let userChats = new Map();
let userSettings = new Map();
let giveaways = [];

class Database {
    constructor() {
        this.dataFilePath = path.join(__dirname, '..', 'data.json');
        this.userDataFilePath = path.join(__dirname, '..', 'userdata.json');
        console.log('Database files:', this.dataFilePath, this.userDataFilePath);
    }

    async loadData() {
        try {
            // Загружаем основные данные
            console.log('Loading main data from GitHub...');
            const data = await fs.readFile(this.dataFilePath, 'utf8');
            const parsedData = JSON.parse(data);
            
            casinos = parsedData.casinos || [];
            announcements = parsedData.announcements || [];
            streamStatus = parsedData.streamStatus || streamStatus;
            categories = parsedData.categories || config.CATEGORIES;

            // Загружаем данные пользователей
            try {
                console.log('Loading user data...');
                const userData = await fs.readFile(this.userDataFilePath, 'utf8');
                const parsedUserData = JSON.parse(userData);
                
                userChats = new Map(Object.entries(parsedUserData.userChats || {}));
                userSettings = new Map(Object.entries(parsedUserData.userSettings || {}));
                giveaways = parsedUserData.giveaways || [];
            } catch (userError) {
                if (userError.code === 'ENOENT') {
                    console.log('User data file not found, creating new...');
                    await this.saveUserData(); // Создаем файл
                } else {
                    console.error('Error loading user data:', userError);
                }
            }

            console.log(`Loaded: ${casinos.length} casinos, ${userChats.size} users, ${userSettings.size} settings`);
            return true;

        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('Main data file not found, creating initial structure');
                return await this.initializeData();
            } else {
                console.error('Error loading data:', error);
                return false;
            }
        }
    }

    async initializeData() {
        const initialData = {
            casinos: [],
            announcements: [],
            streamStatus: streamStatus,
            categories: categories,
            lastUpdated: new Date().toISOString()
        };

        const initialUserData = {
            userChats: {},
            userSettings: {},
            giveaways: [],
            lastUpdated: new Date().toISOString()
        };

        try {
            await fs.writeFile(this.dataFilePath, JSON.stringify(initialData, null, 2));
            await fs.writeFile(this.userDataFilePath, JSON.stringify(initialUserData, null, 2));
            
            casinos = [];
            announcements = [];
            userChats = new Map();
            userSettings = new Map();
            giveaways = [];
            
            console.log('New data files created with initial structure');
            return true;
        } catch (error) {
            console.error('Error creating initial data files:', error);
            return false;
        }
    }

    async saveData() {
        try {
            console.log('Saving main data to GitHub...');
            const dataToSave = {
                casinos: casinos,
                announcements: announcements,
                streamStatus: streamStatus,
                categories: categories,
                lastUpdated: new Date().toISOString()
            };

            // Сохраняем локально
            await fs.writeFile(this.dataFilePath, JSON.stringify(dataToSave, null, 2));
            console.log('Main data saved locally');

            // Синхронизируем с GitHub
            if (config.GITHUB_TOKEN) {
                const githubResult = await githubSync.saveDataToGitHub(JSON.stringify(dataToSave, null, 2));
                console.log('GitHub sync result:', githubResult.success);
                return { local: true, github: githubResult.success };
            } else {
                console.log('GitHub token not set, skipping sync');
                return { local: true, github: false };
            }

        } catch (error) {
            console.error('Error saving main data:', error);
            return { local: false, github: false, error: error.message };
        }
    }

    async saveUserData() {
        try {
            console.log('Saving user data locally...');
            const userDataToSave = {
                userChats: Object.fromEntries(userChats),
                userSettings: Object.fromEntries(userSettings),
                giveaways: giveaways,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.userDataFilePath, JSON.stringify(userDataToSave, null, 2));
            console.log('User data saved locally');
            return true;

        } catch (error) {
            console.error('Error saving user data:', error);
            return false;
        }
    }

    // Геттеры
    getCasinos() { return casinos; }
    getAnnouncements() { return announcements; }
    getUserChats() { return userChats; }
    getStreamStatus() { return streamStatus; }
    getUserSettings() { return userSettings; }
    getGiveaways() { return giveaways; }
    getCategories() { return categories; }

    // Сеттеры
    setCasinos(newCasinos) { casinos = newCasinos; }
    setAnnouncements(newAnnouncements) { announcements = newAnnouncements; }
    setStreamStatus(newStatus) { streamStatus = { ...streamStatus, ...newStatus }; }

    // Методы пользователей (сохраняют только локально)
    trackUserAction(userId, userInfo, action, target = null) {
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

        console.log('User action tracked:', { userId, action, target });
        this.saveUserData(); // ← ТОЛЬКО локальное сохранение
    }

    hideCasinoForUser(userId, casinoId) {
        if (!userSettings.has(userId)) {
            userSettings.set(userId, { hiddenCasinos: [], viewMode: 'full' });
        }
        const settings = userSettings.get(userId);
        if (!settings.hiddenCasinos.includes(casinoId)) {
            settings.hiddenCasinos.push(casinoId);
            console.log('Casino hidden:', { userId, casinoId });
        }
        this.trackUserAction(userId, { id: userId }, 'hide_casino', casinoId);
    }

    unhideCasinoForUser(userId, casinoId) {
        if (userSettings.has(userId)) {
            const settings = userSettings.get(userId);
            settings.hiddenCasinos = settings.hiddenCasinos.filter(id => id !== casinoId);
            console.log('Casino unhidden:', { userId, casinoId });
            this.saveUserData(); // ← ТОЛЬКО локальное сохранение
        }
    }

    setUserViewMode(userId, mode) {
        if (!['full', 'compact'].includes(mode)) mode = 'full';
        if (!userSettings.has(userId)) {
            userSettings.set(userId, { hiddenCasinos: [], viewMode: mode });
        } else {
            userSettings.get(userId).viewMode = mode;
        }
        console.log('View mode set:', { userId, mode });
        this.saveUserData(); // ← ТОЛЬКО локальное сохранение
    }

    approveUserAccess(userId) {
        const userSettings = this.getUserSettings();
        if (!userSettings.has(userId)) {
            userSettings.set(userId, { 
                hiddenCasinos: [], 
                viewMode: 'full',
                approvedForLive: true,
                approvalDate: new Date().toISOString()
            });
        } else {
            const settings = userSettings.get(userId);
            settings.approvedForLive = true;
            settings.approvalDate = new Date().toISOString();
        }
        console.log('User approved for live:', userId);
        this.saveUserData(); // ← ТОЛЬКО локальное сохранение
        return true;
    }

    requestApproval(userId, telegramUsername) {
        const userChats = this.getUserChats();
        if (userChats.has(userId)) {
            const userData = userChats.get(userId);
            userData.pendingApproval = true;
            userData.pendingApprovalDate = new Date().toISOString();
            userData.pendingApprovalUsername = telegramUsername;
            console.log('Approval requested:', { userId, telegramUsername });
            this.saveUserData(); // ← ТОЛЬКО локальное сохранение
            return true;
        }
        return false;
    }
}

module.exports = new Database();
