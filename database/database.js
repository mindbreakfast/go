const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const config = require('../config');
const githubSync = require('./githubSync');

// Разделяем данные на 3 части
let casinos = [];
let categories = config.CATEGORIES;
let announcements = [];
let streamStatus = {
    isStreamLive: false,
    streamUrl: '',
    eventDescription: '',
    lastUpdated: new Date().toISOString()
};
let userChats = new Map();
let userSettings = new Map();
let giveaways = [];
let pendingApprovals = [];
let referralData = new Map();
let userClickStats = new Map(); // ✅ ДОБАВЛЕНО определение
let hiddenStats = new Map();
let voiceAccessLogs = [];

class Database {
    constructor() {
        this.dataFilePath = path.join(__dirname, '..', 'data.json');
        this.contentFilePath = path.join(__dirname, '..', 'content.json');
        this.userDataFilePath = path.join(__dirname, '..', 'userdata.json');
        this.statsFilePath = path.join(__dirname, '..', 'stats.json');
        this.backupInterval = null;
    }

    async loadData() {
        console.log('🔄 Starting data loading...');
        
        try {
            // Пытаемся загрузить из локальных файлов
            await this.#loadMainDataFromLocal();
            await this.#loadContentDataFromLocal();
            await this.#loadUserDataFromLocal();
            await this.#loadStatsDataFromLocal();

            console.log(`✅ Data loaded: ${casinos.length} casinos, ${userSettings.size} users`);
            return true;

        } catch (error) {
            console.error('❌ Error loading data:', error.message);
            return await this.initializeData();
        }
    }

    async #loadMainDataFromLocal() {
        try {
            const data = await fs.readFile(this.dataFilePath, 'utf8');
            const parsedData = JSON.parse(data);
            casinos = parsedData.casinos || [];
            categories = parsedData.categories || config.CATEGORIES;
        } catch (error) {
            console.log('❌ Local data file not found, initializing empty');
            await this.#saveMainDataLocally();
        }
    }

    async #loadContentDataFromLocal() {
        try {
            const contentData = await fs.readFile(this.contentFilePath, 'utf8');
            const parsedContent = JSON.parse(contentData);
            announcements = parsedContent.announcements || [];
            streamStatus = parsedContent.streamStatus || streamStatus;
        } catch (error) {
            console.log('❌ Local content file not found, initializing empty');
            await this.saveContentData();
        }
    }

    async #loadUserDataFromLocal() {
        try {
            const userData = await fs.readFile(this.userDataFilePath, 'utf8');
            const parsedUserData = JSON.parse(userData);
            
            userChats = new Map();
            if (parsedUserData.userChats) {
                for (const [key, value] of Object.entries(parsedUserData.userChats)) {
                    userChats.set(Number(key), value);
                }
            }
            
            userSettings = new Map();
            if (parsedUserData.userSettings) {
                for (const [key, value] of Object.entries(parsedUserData.userSettings)) {
                    userSettings.set(Number(key), value);
                }
            }
            
            giveaways = parsedUserData.giveaways || [];
            pendingApprovals = parsedUserData.pendingApprovals || [];
            referralData = new Map();
            
            if (parsedUserData.referralData) {
                for (const [key, value] of Object.entries(parsedUserData.referralData)) {
                    referralData.set(Number(key), value);
                }
            }
            
        } catch (error) {
            console.log('❌ Local user file not found, initializing empty');
            await this.saveUserData();
        }
    }

    async #loadStatsDataFromLocal() {
        try {
            const statsData = await fs.readFile(this.statsFilePath, 'utf8');
            const parsedStats = JSON.parse(statsData);
            
            userClickStats = new Map();
            if (parsedStats.userClickStats) {
                for (const [key, value] of Object.entries(parsedStats.userClickStats)) {
                    userClickStats.set(Number(key), value);
                }
            }
            
            hiddenStats = new Map();
            if (parsedStats.hiddenStats) {
                for (const [key, value] of Object.entries(parsedStats.hiddenStats)) {
                    hiddenStats.set(Number(key), value);
                }
            }
            
            voiceAccessLogs = parsedStats.voiceAccessLogs || [];
            
        } catch (error) {
            console.log('❌ Local stats file not found, initializing empty');
            await this.saveStatsData();
        }
    }

    async #saveMainDataLocally() {
        try {
            const dataToSave = {
                casinos: casinos,
                categories: categories,
                lastUpdated: new Date().toISOString()
            };
            await fs.writeFile(this.dataFilePath, JSON.stringify(dataToSave, null, 2));
        } catch (error) {
            console.error('❌ Error saving main data:', error.message);
        }
    }

    async saveContentData() {
        try {
            const contentToSave = {
                announcements: announcements,
                streamStatus: streamStatus,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.contentFilePath, JSON.stringify(contentToSave, null, 2));
            return true;

        } catch (error) {
            console.error('❌ Error saving content data:', error.message);
            return false;
        }
    }

    async saveUserData() {
        try {
            const userDataToSave = {
                userChats: Object.fromEntries(userChats),
                userSettings: Object.fromEntries(userSettings),
                giveaways: giveaways,
                pendingApprovals: pendingApprovals,
                referralData: Object.fromEntries(referralData),
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.userDataFilePath, JSON.stringify(userDataToSave, null, 2));
            return true;

        } catch (error) {
            console.error('❌ Error saving user data:', error.message);
            return false;
        }
    }

    async saveStatsData() {
        try {
            const statsToSave = {
                userClickStats: Object.fromEntries(userClickStats),
                hiddenStats: Object.fromEntries(hiddenStats),
                voiceAccessLogs: voiceAccessLogs,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.statsFilePath, JSON.stringify(statsToSave, null, 2));
            return true;

        } catch (error) {
            console.error('❌ Error saving stats data:', error.message);
            return false;
        }
    }

    async initializeData() {
        console.log('🔄 Initializing data files...');
        
        const initialData = { casinos: [], categories: categories, lastUpdated: new Date().toISOString() };
        const initialContent = { announcements: [], streamStatus: streamStatus, lastUpdated: new Date().toISOString() };
        const initialUserData = {
            userChats: {},
            userSettings: {},
            giveaways: [],
            pendingApprovals: [],
            referralData: {},
            lastUpdated: new Date().toISOString()
        };
        const initialStats = {
            userClickStats: {},
            hiddenStats: {},
            voiceAccessLogs: [],
            lastUpdated: new Date().toISOString()
        };

        try {
            await fs.writeFile(this.dataFilePath, JSON.stringify(initialData, null, 2));
            await fs.writeFile(this.contentFilePath, JSON.stringify(initialContent, null, 2));
            await fs.writeFile(this.userDataFilePath, JSON.stringify(initialUserData, null, 2));
            await fs.writeFile(this.statsFilePath, JSON.stringify(initialStats, null, 2));
            
            console.log('✅ All data files created');
            return true;
        } catch (error) {
            console.error('❌ Error creating initial data files:', error);
            return false;
        }
    }

    // 📊 Методы для работы со статистикой
    trackCasinoClick(userId, casinoId) {
        if (!userClickStats.has(userId)) {
            userClickStats.set(userId, {});
        }
        const userStats = userClickStats.get(userId);
        userStats[casinoId] = (userStats[casinoId] || 0) + 1;
        
        // Автосохранение раз в 30 минут через отдельный механизм
    }

    trackCasinoHide(casinoId) {
        const currentHides = hiddenStats.get(casinoId) || 0;
        hiddenStats.set(casinoId, currentHides + 1);
    }

    trackVoiceAccess(userId, username, roomType, userAgent = '') {
        const logEntry = {
            userId,
            username: username || `user${userId}`,
            roomType,
            userAgent,
            timestamp: new Date().toISOString()
        };
        
        voiceAccessLogs.push(logEntry);
        
        // Сохраняем только последние 100 записей
        if (voiceAccessLogs.length > 100) {
            voiceAccessLogs = voiceAccessLogs.slice(-100);
        }
    }

    getCasinoStats() {
        const stats = [];
        for (const casino of casinos) {
            if (casino.isActive) {
                stats.push({
                    id: casino.id,
                    name: casino.name,
                    clicks: hiddenStats.get(casino.id) || 0,
                    hides: hiddenStats.get(casino.id) || 0,
                    isPinned: casino.isPinned
                });
            }
        }
        return stats.sort((a, b) => b.clicks - a.clicks);
    }

    getVoiceAccessLogs(limit = 30) {
        return voiceAccessLogs.slice(-limit).reverse();
    }

    getUserClickStats(userId) {
        return userClickStats.get(userId) || {};
    }

    // ✅ Методы для работы с пользователями
    trackUserAction(userId, userData, actionType) {
        if (!userChats.has(userId)) {
            userChats.set(userId, {
                id: userId,
                username: userData.username || 'не указан',
                first_name: userData.first_name,
                last_name: userData.last_name,
                language_code: userData.language_code,
                joined_at: new Date().toISOString(),
                last_activity: new Date().toISOString()
            });
        } else {
            const user = userChats.get(userId);
            user.last_activity = new Date().toISOString();
            userChats.set(userId, user);
        }
        
        if (!userSettings.has(userId)) {
            userSettings.set(userId, {
                hiddenCasinos: [],
                notifications: true,
                theme: 'light',
                hasLiveAccess: false
            });
        }
        
        return true;
    }

    requestApproval(userId, username) {
        const existingRequest = pendingApprovals.find(req => req.userId === userId);
        if (existingRequest) {
            return false;
        }
        
        pendingApprovals.push({
            userId: userId,
            requestedUsername: username,
            requestedAt: new Date().toISOString(),
            status: 'pending'
        });
        
        this.saveUserData().catch(err => console.error('Save approval error:', err));
        return true;
    }

    approveUserAccess(userId) {
        const requestIndex = pendingApprovals.findIndex(req => req.userId === userId && req.status === 'pending');
        if (requestIndex === -1) {
            return false;
        }
        
        pendingApprovals[requestIndex].status = 'approved';
        pendingApprovals[requestIndex].approvedAt = new Date().toISOString();
        
        if (userSettings.has(userId)) {
            const settings = userSettings.get(userId);
            settings.hasLiveAccess = true;
            userSettings.set(userId, settings);
        }
        
        this.saveUserData().catch(err => console.error('Save approval error:', err));
        return true;
    }

    handleReferralStart(userId, referrerId) {
        if (!referralData.has(referrerId)) {
            referralData.set(referrerId, { referrals: [], totalEarned: 0 });
        }
        
        if (!referralData.has(userId)) {
            referralData.set(userId, { referredBy: referrerId, referrals: [], totalEarned: 0 });
        }
        
        const referrerData = referralData.get(referrerId);
        if (!referrerData.referrals.includes(userId)) {
            referrerData.referrals.push(userId);
            referralData.set(referrerId, referrerData);
        }
        
        const userRefData = referralData.get(userId);
        userRefData.referredBy = referrerId;
        referralData.set(userId, userRefData);
        
        this.saveUserData().catch(err => console.error('Save referral error:', err));
        return true;
    }

    getReferralInfo(userId) {
        const refData = referralData.get(userId) || {
            referredBy: null,
            referrals: [],
            totalEarned: 0
        };
        
        return {
            referredBy: refData.referredBy,
            referrals: refData.referrals || [],
            referralLink: `https://t.me/${config.BOT_TOKEN.split(':')[0]}?start=ref${userId}`,
            totalEarned: refData.totalEarned || 0
        };
    }

    getUserData(userId) {
        const userStats = this.getUserClickStats(userId);
        const topCasinos = Object.entries(userStats)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([casinoId, clicks]) => {
                const casino = this.getCasino(parseInt(casinoId));
                return casino ? { name: casino.name, clicks } : null;
            })
            .filter(Boolean);

        return {
            settings: userSettings.get(userId) || {
                hiddenCasinos: [],
                notifications: true,
                theme: 'light',
                hasLiveAccess: false
            },
            profile: userChats.get(userId) || null,
            referralInfo: this.getReferralInfo(userId),
            stats: { topCasinos }
        };
    }

    updateUserSettings(userId, newSettings) {
        if (userSettings.has(userId)) {
            const currentSettings = userSettings.get(userId);
            userSettings.set(userId, { ...currentSettings, ...newSettings });
        } else {
            userSettings.set(userId, {
                hiddenCasinos: [],
                notifications: true,
                theme: 'light',
                hasLiveAccess: false,
                ...newSettings
            });
        }
        
        this.saveUserData().catch(err => console.error('Save user settings error:', err));
        return true;
    }

    // Геттеры
    getCasinos() { return casinos; }
    getAnnouncements() { return announcements; }
    getUserChats() { return userChats; }
    getStreamStatus() { return streamStatus; }
    getUserSettings() { return userSettings; }
    getGiveaways() { return giveaways; }
    getCategories() { return categories; }
    getPendingApprovals() { return pendingApprovals.filter(req => req.status === 'pending'); }
    getClickStats() { return userClickStats; }
    getHiddenStats() { return hiddenStats; }
    getVoiceAccessLogs(limit = 30) { return voiceAccessLogs.slice(-limit).reverse(); }

    // Сеттеры
    setCasinos(newCasinos) { 
        casinos = newCasinos; 
        this.saveData();
    }

    setAnnouncements(newAnnouncements) { 
        announcements = newAnnouncements; 
        this.saveContentData();
    }

    setStreamStatus(newStatus) { 
        streamStatus = { ...streamStatus, ...newStatus }; 
        this.saveContentData();
    }

    async saveData() {
        try {
            const dataToSave = {
                casinos: casinos,
                categories: categories,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.dataFilePath, JSON.stringify(dataToSave, null, 2));
            return true;

        } catch (error) {
            console.error('❌ Error saving main data:', error.message);
            return false;
        }
    }

    async saveAllData() {
        try {
            await Promise.all([
                this.saveData(),
                this.saveContentData(),
                this.saveUserData(),
                this.saveStatsData()
            ]);
            return true;
        } catch (error) {
            console.error('❌ Error saving all data:', error.message);
            return false;
        }
    }

    // 🔄 Новый метод: Резервное копирование на GitHub (раз в час)
    startBackupService() {
        this.backupInterval = setInterval(async () => {
            try {
                console.log('🔄 Starting scheduled backup to GitHub...');
                await this.#backupToGitHub();
            } catch (error) {
                console.error('❌ Backup error:', error.message);
            }
        }, 60 * 60 * 1000); // Каждый час
    }

    async #backupToGitHub() {
        if (!config.GITHUB_TOKEN) return;

        try {
            const [dataResult, contentResult, userResult, statsResult] = await Promise.all([
                this.#backupFile('data.json'),
                this.#backupFile('content.json'),
                this.#backupFile('userdata.json'),
                this.#backupFile('stats.json')
            ]);

            console.log('✅ Backup completed:', {
                data: dataResult,
                content: contentResult,
                user: userResult,
                stats: statsResult
            });

        } catch (error) {
            console.error('❌ Backup failed:', error.message);
        }
    }

    async #backupFile(fileName) {
        try {
            let content;
            switch (fileName) {
                case 'data.json':
                    content = JSON.stringify({
                        casinos: casinos,
                        categories: categories,
                        lastUpdated: new Date().toISOString()
                    }, null, 2);
                    break;
                case 'content.json':
                    content = JSON.stringify({
                        announcements: announcements,
                        streamStatus: streamStatus,
                        lastUpdated: new Date().toISOString()
                    }, null, 2);
                    break;
                case 'userdata.json':
                    content = JSON.stringify({
                        userChats: Object.fromEntries(userChats),
                        userSettings: Object.fromEntries(userSettings),
                        giveaways: giveaways,
                        pendingApprovals: pendingApprovals,
                        referralData: Object.fromEntries(referralData),
                        lastUpdated: new Date().toISOString()
                    }, null, 2);
                    break;
                case 'stats.json':
                    content = JSON.stringify({
                        userClickStats: Object.fromEntries(userClickStats),
                        hiddenStats: Object.fromEntries(hiddenStats),
                        voiceAccessLogs: voiceAccessLogs,
                        lastUpdated: new Date().toISOString()
                    }, null, 2);
                    break;
            }

            const result = await githubSync.saveDataToGitHub(content, fileName);
            return result.success;
        } catch (error) {
            console.error(`❌ Backup of ${fileName} failed:`, error.message);
            return false;
        }
    }

    stopBackupService() {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
        }
    }
}

module.exports = new Database();
