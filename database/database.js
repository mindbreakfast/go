const fs = require('fs').promises;
const path = require('path');
const githubSync = require('./githubSync');
const config = require('../config');

let casinos = [];
let announcements = [];
let userChats = new Map();
let userSettings = new Map();
let giveaways = [];
let streamStatus = {
    isStreamLive: false,
    streamUrl: '',
    eventDescription: '',
    lastUpdated: new Date().toISOString()
};

class Database {
    constructor() {
        this.dataFilePath = path.join(__dirname, '..', 'data.json');
        console.log('Database file path:', this.dataFilePath);
    }

    async loadData() {
        try {
            console.log('Loading data from local file...');
            const data = await fs.readFile(this.dataFilePath, 'utf8');
            const parsedData = JSON.parse(data);
            console.log('Local data file found');

            casinos = parsedData.casinos || [];
            announcements = parsedData.announcements || [];
            streamStatus = parsedData.streamStatus || streamStatus;
            userChats = new Map(Object.entries(parsedData.userChats || {}));
            userSettings = new Map(Object.entries(parsedData.userSettings || {}));
            giveaways = parsedData.giveaways || [];

            console.log(`Loaded: ${casinos.length} casinos, ${userChats.size} users, ${userSettings.size} settings`);
            return true;

        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('Local data file not found, creating initial structure');
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
            userChats: {},
            userSettings: {},
            giveaways: [],
            streamStatus: streamStatus,
            categories: config.CATEGORIES,
            lastUpdated: new Date().toISOString()
        };

        try {
            await fs.writeFile(this.dataFilePath, JSON.stringify(initialData, null, 2));
            casinos = [];
            announcements = [];
            userChats = new Map();
            userSettings = new Map();
            giveaways = [];
            console.log('New data file created with initial structure');
            return true;
        } catch (error) {
            console.error('Error creating initial data file:', error);
            return false;
        }
    }

    async saveData() {
        try {
            console.log('Saving data...');
            const dataToSave = {
                casinos: casinos,
                announcements: announcements,
                userChats: Object.fromEntries(userChats),
                userSettings: Object.fromEntries(userSettings),
                giveaways: giveaways,
                streamStatus: streamStatus,
                categories: config.CATEGORIES,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.dataFilePath, JSON.stringify(dataToSave, null, 2));
            console.log('Data saved locally');

            const githubResult = await githubSync.saveDataToGitHub(JSON.stringify(dataToSave, null, 2));
            console.log('GitHub sync result:', githubResult.success);

            return { local: true, github: githubResult.success };

        } catch (error) {
            console.error('Error saving data:', error);
            return { local: false, github: false, error: error.message };
        }
    }

    // Геттеры
    getCasinos() { return casinos; }
    getAnnouncements() { return announcements; }
    getUserChats() { return userChats; }
    getStreamStatus() { return streamStatus; }
    getUserSettings() { return userSettings; }
    getGiveaways() { return giveaways; }
    getCategories() { return config.CATEGORIES; }

    // Сеттеры
    setCasinos(newCasinos) { casinos = newCasinos; }
    setAnnouncements(newAnnouncements) { announcements = newAnnouncements; }
    setStreamStatus(newStatus) { streamStatus = { ...streamStatus, ...newStatus }; }

    // Методы пользователей
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
    }

    getUserStats(userId) {
        return userChats.get(userId) || null;
    }

    // Новые методы
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
        }
    }

    getHiddenCasinosForUser(userId) {
        return userSettings.get(userId)?.hiddenCasinos || [];
    }

    setUserViewMode(userId, mode) {
        if (!['full', 'compact'].includes(mode)) mode = 'full';
        if (!userSettings.has(userId)) {
            userSettings.set(userId, { hiddenCasinos: [], viewMode: mode });
        } else {
            userSettings.get(userId).viewMode = mode;
        }
        console.log('View mode set:', { userId, mode });
    }

    getUserViewMode(userId) {
        return userSettings.get(userId)?.viewMode || 'full';
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
            return true;
        }
        return false;
    }

    getPendingApprovals() {
        const userChats = this.getUserChats();
        const pending = [];
        
        for (const [userId, userData] of userChats) {
            if (userData.pendingApproval) {
                pending.push({
                    userId: userId,
                    username: userData.username,
                    requestedAt: userData.pendingApprovalDate,
                    requestedUsername: userData.pendingApprovalUsername
                });
            }
        }
        return pending;
    }
}

module.exports = new Database();
