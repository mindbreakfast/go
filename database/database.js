const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const config = require('../config');
const githubSync = require('./githubSync');
const logger = require('../utils/logger');

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
let clickStats = new Map(); // 📊 Статистика кликов по казино
let hiddenStats = new Map(); // 📊 Статистика скрытий казино
let voiceAccessLogs = []; // 🎤 Лог входов в голосовые комнаты

class Database {
    constructor() {
        this.dataFilePath = path.join(__dirname, '..', 'data.json');
        this.contentFilePath = path.join(__dirname, '..', 'content.json');
        this.userDataFilePath = path.join(__dirname, '..', 'userdata.json');
        this.statsFilePath = path.join(__dirname, '..', 'stats.json');
    }

    async loadData() {
        logger.info('🔄 Starting COMPLETE data loading from GitHub...');
        
        try {
            logger.info('🌐 Loading ALL data from GitHub...');
            
            const [mainDataLoaded, contentDataLoaded, userDataLoaded, statsDataLoaded] = await Promise.all([
                this.#loadFileFromGitHub('data.json', (data) => this.#processMainData(data)),
                this.#loadFileFromGitHub('content.json', (data) => this.#processContentData(data)),
                this.#loadFileFromGitHub('userdata.json', (data) => this.#processUserData(data)),
                this.#loadFileFromGitHub('stats.json', (data) => this.#processStatsData(data))
            ]);

            logger.info('GitHub load results:', {
                main: mainDataLoaded,
                content: contentDataLoaded,
                user: userDataLoaded,
                stats: statsDataLoaded
            });

            if (!mainDataLoaded) await this.#loadMainDataFromLocal();
            if (!contentDataLoaded) await this.#loadContentDataFromLocal();
            if (!userDataLoaded) await this.#loadUserDataFromLocal();
            if (!statsDataLoaded) await this.#loadStatsDataFromLocal();

            logger.info('FINAL data loaded:', {
                casinos: casinos.length,
                announcements: announcements.length,
                users: userChats.size,
                clickStats: clickStats.size,
                voiceLogs: voiceAccessLogs.length
            });
            return true;

        } catch (error) {
            logger.error('Error loading data:', { error: error.message });
            return await this.initializeData();
        }
    }

    async #loadFileFromGitHub(fileName, processor) {
        if (!config.GITHUB_TOKEN) {
            logger.warn(`GITHUB_TOKEN not set, skipping ${fileName}`);
            return false;
        }

        try {
            logger.info(`Downloading ${fileName} from GitHub...`);
            const url = `https://api.github.com/repos/${config.GITHUB_REPO_OWNER}/${config.GITHUB_REPO_NAME}/contents/${fileName}`;
            
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `token ${config.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Ludogolik-Bot-Server'
                },
                timeout: 10000
            });

            if (response.data && response.data.content) {
                const content = Buffer.from(response.data.content, 'base64').toString('utf8');
                const parsedData = JSON.parse(content);
                processor(parsedData);
                logger.info(`Successfully loaded ${fileName} from GitHub`);
                return true;
            }
            return false;
            
        } catch (error) {
            if (error.response?.status === 404) {
                logger.warn(`${fileName} not found on GitHub`);
            } else {
                logger.error(`Failed to load ${fileName} from GitHub:`, { error: error.message });
            }
            return false;
        }
    }

    #processMainData(parsedData) {
        casinos = parsedData.casinos || [];
        categories = parsedData.categories || config.CATEGORIES;
        logger.info(`Processed main data: ${casinos.length} casinos`);
    }

    #processContentData(parsedData) {
        announcements = parsedData.announcements || [];
        streamStatus = parsedData.streamStatus || streamStatus;
        logger.info(`Processed content data: ${announcements.length} announcements`);
    }

    #processUserData(parsedData) {
        userChats = new Map();
        if (parsedData.userChats) {
            for (const [key, value] of Object.entries(parsedData.userChats)) {
                userChats.set(Number(key), value);
            }
        }
        
        userSettings = new Map();
        if (parsedData.userSettings) {
            for (const [key, value] of Object.entries(parsedData.userSettings)) {
                userSettings.set(Number(key), value);
            }
        }
        
        giveaways = parsedData.giveaways || [];
        pendingApprovals = parsedData.pendingApprovals || [];
        referralData = new Map();
        
        if (parsedData.referralData) {
            for (const [key, value] of Object.entries(parsedData.referralData)) {
                referralData.set(Number(key), value);
            }
        }
        
        logger.info(`Processed user data: ${userSettings.size} users, ${pendingApprovals.length} pending approvals`);
    }

    #processStatsData(parsedData) {
        clickStats = new Map();
        if (parsedData.clickStats) {
            for (const [key, value] of Object.entries(parsedData.clickStats)) {
                clickStats.set(Number(key), value);
            }
        }
        
        hiddenStats = new Map();
        if (parsedData.hiddenStats) {
            for (const [key, value] of Object.entries(parsedData.hiddenStats)) {
                hiddenStats.set(Number(key), value);
            }
        }
        
        voiceAccessLogs = parsedData.voiceAccessLogs || [];
        
        logger.info(`Processed stats data: ${clickStats.size} click stats, ${hiddenStats.size} hidden stats, ${voiceAccessLogs.length} voice logs`);
    }

    async #loadMainDataFromLocal() {
        try {
            const data = await fs.readFile(this.dataFilePath, 'utf8');
            const parsedData = JSON.parse(data);
            casinos = parsedData.casinos || [];
            categories = parsedData.categories || config.CATEGORIES;
            logger.info('Loaded from local file:', { casinos: casinos.length });
        } catch (error) {
            logger.warn('Local data file not found, will initialize empty');
            await this.#saveMainDataLocally();
        }
    }

    async #loadContentDataFromLocal() {
        try {
            const contentData = await fs.readFile(this.contentFilePath, 'utf8');
            const parsedContent = JSON.parse(contentData);
            announcements = parsedContent.announcements || [];
            streamStatus = parsedContent.streamStatus || streamStatus;
            logger.info('Loaded from local file:', { announcements: announcements.length });
        } catch (error) {
            logger.warn('Local content file not found, will initialize empty');
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
            
            logger.info('Loaded from local file:', { users: userSettings.size });
        } catch (error) {
            logger.warn('Local user file not found, will initialize empty');
            await this.saveUserData();
        }
    }

    async #loadStatsDataFromLocal() {
        try {
            const statsData = await fs.readFile(this.statsFilePath, 'utf8');
            const parsedStats = JSON.parse(statsData);
            
            clickStats = new Map();
            if (parsedStats.clickStats) {
                for (const [key, value] of Object.entries(parsedStats.clickStats)) {
                    clickStats.set(Number(key), value);
                }
            }
            
            hiddenStats = new Map();
            if (parsedStats.hiddenStats) {
                for (const [key, value] of Object.entries(parsedStats.hiddenStats)) {
                    hiddenStats.set(Number(key), value);
                }
            }
            
            voiceAccessLogs = parsedStats.voiceAccessLogs || [];
            
            logger.info('Loaded from local file:', { 
                clickStats: clickStats.size,
                hiddenStats: hiddenStats.size,
                voiceLogs: voiceAccessLogs.length
            });
        } catch (error) {
            logger.warn('Local stats file not found, will initialize empty');
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
            logger.info('Main data saved locally');
        } catch (error) {
            logger.error('Error saving main data locally:', { error: error.message });
        }
    }

    async saveContentData() {
        try {
            logger.info('Saving content data...');
            const contentToSave = {
                announcements: announcements,
                streamStatus: streamStatus,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.contentFilePath, JSON.stringify(contentToSave, null, 2));
            logger.info('Content data saved locally');

            if (config.GITHUB_TOKEN) {
                try {
                    const githubResult = await githubSync.saveDataToGitHub(
                        JSON.stringify(contentToSave, null, 2),
                        'content.json'
                    );
                    logger.info('GitHub sync result for content:', { success: githubResult.success });
                    return githubResult.success;
                } catch (githubError) {
                    logger.error('GitHub sync error for content:', { error: githubError.message });
                    return false;
                }
            }
            
            return true;

        } catch (error) {
            logger.error('Error saving content data:', { error: error.message });
            return false;
        }
    }

    async saveUserData() {
        try {
            logger.info('Saving user data...');
            
            const userDataToSave = {
                userChats: Object.fromEntries(userChats),
                userSettings: Object.fromEntries(userSettings),
                giveaways: giveaways,
                pendingApprovals: pendingApprovals,
                referralData: Object.fromEntries(referralData),
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.userDataFilePath, JSON.stringify(userDataToSave, null, 2));
            logger.info('User data saved locally');

            if (config.GITHUB_TOKEN) {
                try {
                    const githubResult = await githubSync.saveDataToGitHub(
                        JSON.stringify(userDataToSave, null, 2),
                        'userdata.json'
                    );
                    logger.info('GitHub sync result for userdata:', { success: githubResult.success });
                    return githubResult.success;
                } catch (githubError) {
                    logger.error('GitHub sync error for userdata:', { error: githubError.message });
                    return false;
                }
            }
            
            return true;

        } catch (error) {
            logger.error('Error saving user data:', { error: error.message });
            return false;
        }
    }

    async saveStatsData() {
        try {
            logger.info('Saving stats data...');
            
            const statsToSave = {
                clickStats: Object.fromEntries(clickStats),
                hiddenStats: Object.fromEntries(hiddenStats),
                voiceAccessLogs: voiceAccessLogs,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.statsFilePath, JSON.stringify(statsToSave, null, 2));
            logger.info('Stats data saved locally');

            if (config.GITHUB_TOKEN) {
                try {
                    const githubResult = await githubSync.saveDataToGitHub(
                        JSON.stringify(statsToSave, null, 2),
                        'stats.json'
                    );
                    logger.info('GitHub sync result for stats:', { success: githubResult.success });
                    return githubResult.success;
                } catch (githubError) {
                    logger.error('GitHub sync error for stats:', { error: githubError.message });
                    return false;
                }
            }
            
            return true;

        } catch (error) {
            logger.error('Error saving stats data:', { error: error.message });
            return false;
        }
    }

    async initializeData() {
        logger.info('Initializing data files...');
        
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
            clickStats: {},
            hiddenStats: {},
            voiceAccessLogs: [],
            lastUpdated: new Date().toISOString()
        };

        try {
            await fs.writeFile(this.dataFilePath, JSON.stringify(initialData, null, 2));
            await fs.writeFile(this.contentFilePath, JSON.stringify(initialContent, null, 2));
            await fs.writeFile(this.userDataFilePath, JSON.stringify(initialUserData, null, 2));
            await fs.writeFile(this.statsFilePath, JSON.stringify(initialStats, null, 2));
            
            logger.info('All data files created with initial structure');
            return true;
        } catch (error) {
            logger.error('Error creating initial data files:', { error: error.message });
            return false;
        }
    }

    // 📊 Методы для работы со статистикой
    trackCasinoClick(casinoId) {
        const currentClicks = clickStats.get(casinoId) || 0;
        clickStats.set(casinoId, currentClicks + 1);
        logger.debug('Casino click tracked:', { casinoId, clicks: currentClicks + 1 });
        
        // Автосохранение раз в 30 минут через отдельный механизм
    }

    trackCasinoHide(casinoId) {
        const currentHides = hiddenStats.get(casinoId) || 0;
        hiddenStats.set(casinoId, currentHides + 1);
        logger.debug('Casino hide tracked:', { casinoId, hides: currentHides + 1 });
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
        
        // Сохраняем только последние 1000 записей
        if (voiceAccessLogs.length > 1000) {
            voiceAccessLogs = voiceAccessLogs.slice(-1000);
        }
        
        logger.info('Voice access tracked:', logEntry);
    }

    getCasinoStats() {
        const stats = [];
        for (const casino of casinos) {
            if (casino.isActive) {
                stats.push({
                    id: casino.id,
                    name: casino.name,
                    clicks: clickStats.get(casino.id) || 0,
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

    // ✅ Остальные методы остаются без изменений, но с добавлением логирования...
    // [Здесь должны быть все предыдущие методы с добавлением logger вместо console.log]

    // Пример обновленного метода:
    trackUserAction(userId, userData, actionType) {
        logger.info(`Tracking user action: ${userId}, ${actionType}`);
        
        // Сохраняем информацию о пользователе
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
        
        // Сохраняем настройки по умолчанию если их нет
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

    // ... остальные методы
// ... продолжение database/database.js

    requestApproval(userId, username) {
        logger.info(`Approval request from user ${userId}: ${username}`);
        
        const existingRequest = pendingApprovals.find(req => req.userId === userId);
        if (existingRequest) {
            logger.warn(`User ${userId} already has pending approval`);
            return false;
        }
        
        pendingApprovals.push({
            userId: userId,
            requestedUsername: username,
            requestedAt: new Date().toISOString(),
            status: 'pending'
        });
        
        this.saveUserData().catch(err => logger.error('Save approval error:', { error: err.message }));
        return true;
    }

    getPendingApprovals() {
        return pendingApprovals.filter(req => req.status === 'pending');
    }

    approveUserAccess(userId) {
        logger.info(`Approving user access: ${userId}`);
        
        const requestIndex = pendingApprovals.findIndex(req => req.userId === userId && req.status === 'pending');
        if (requestIndex === -1) {
            logger.warn(`No pending approval for user ${userId}`);
            return false;
        }
        
        pendingApprovals[requestIndex].status = 'approved';
        pendingApprovals[requestIndex].approvedAt = new Date().toISOString();
        
        if (userSettings.has(userId)) {
            const settings = userSettings.get(userId);
            settings.hasLiveAccess = true;
            userSettings.set(userId, settings);
        }
        
        this.saveUserData().catch(err => logger.error('Save approval error:', { error: err.message }));
        return true;
    }

    handleReferralStart(userId, referrerId) {
        logger.info(`Referral start: user ${userId} referred by ${referrerId}`);
        
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
        
        this.saveUserData().catch(err => logger.error('Save referral error:', { error: err.message }));
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
        const userStats = {};
        // Собираем статистику кликов пользователя по казино
        if (userClickStats[userId]) {
            const userCasinoStats = Object.entries(userClickStats[userId])
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([casinoId, clicks]) => {
                    const casino = this.getCasino(parseInt(casinoId));
                    return casino ? { name: casino.name, clicks } : null;
                })
                .filter(Boolean);
            
            userStats.topCasinos = userCasinoStats;
        }

        return {
            settings: userSettings.get(userId) || {
                hiddenCasinos: [],
                notifications: true,
                theme: 'light',
                hasLiveAccess: false
            },
            profile: userChats.get(userId) || null,
            referralInfo: this.getReferralInfo(userId),
            stats: userStats
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
    getClickStats() { return clickStats; }
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
            logger.info('Saving main data...');
            const dataToSave = {
                casinos: casinos,
                categories: categories,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.dataFilePath, JSON.stringify(dataToSave, null, 2));
            logger.info('Main data saved locally');
            
            if (config.GITHUB_TOKEN) {
                try {
                    const githubResult = await githubSync.saveDataToGitHub(
                        JSON.stringify(dataToSave, null, 2),
                        'data.json'
                    );
                    logger.info('GitHub sync result:', { success: githubResult.success });
                    return githubResult.success;
                } catch (githubError) {
                    logger.error('GitHub sync error:', { error: githubError.message });
                    return false;
                }
            }
            
            return true;

        } catch (error) {
            logger.error('Error saving main data:', { error: error.message });
            return false;
        }
    }

    async saveAllDataToGitHub() {
        try {
            logger.info('Saving ALL data to GitHub...');
            const results = await Promise.allSettled([
                this.saveData(),
                this.saveContentData(),
                this.saveUserData(),
                this.saveStatsData()
            ]);

            const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
            logger.info('GitHub save completed:', { success: successCount, total: results.length });
            
            return successCount === results.length;
        } catch (error) {
            logger.error('Error saving all data to GitHub:', { error: error.message });
            return false;
        }
    }
}

module.exports = new Database();
