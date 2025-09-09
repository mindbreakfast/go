const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const config = require('../config');

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

class Database {
    constructor() {
        this.dataFilePath = path.join(__dirname, '..', 'data.json');
        this.contentFilePath = path.join(__dirname, '..', 'content.json');
        this.userDataFilePath = path.join(__dirname, '..', 'userdata.json');
        console.log('Database files configured:', {
            data: this.dataFilePath,
            content: this.contentFilePath,
            user: this.userDataFilePath
        });
    }

    async loadData() {
        console.log('🔄 Starting data loading process...');
        
        try {
            // 1. Пытаемся загрузить основные данные (казино) из GitHub
            console.log('🌐 Step 1: Trying to load main data from GitHub...');
            const githubDataLoaded = await this.#loadMainDataFromGitHub();
            
            if (!githubDataLoaded) {
                // 2. Если GitHub не доступен, пробуем локальный файл
                console.log('⚠️ GitHub load failed, trying local main data file...');
                await this.#loadMainDataFromLocal();
            }

            // 3. Загружаем контент (анонсы + стримы) локально
            console.log('📁 Step 2: Loading content data...');
            await this.#loadContentData();

            // 4. Загружаем данные пользователей локально
            console.log('👥 Step 3: Loading user data...');
            await this.#loadUserData();

            console.log(`✅ Successfully loaded: ${casinos.length} casinos, ${announcements.length} announcements, ${userChats.size} users`);
            return true;

        } catch (error) {
            console.error('❌ Error loading data:', error.message);
            console.log('🔄 Attempting to initialize with empty data...');
            return await this.initializeData();
        }
    }

    async #loadMainDataFromGitHub() {
        if (!config.GITHUB_TOKEN) {
            console.log('⚠️ GITHUB_TOKEN not set, skipping GitHub load');
            return false;
        }

        try {
            console.log('🌐 Downloading data.json from GitHub...');
            const url = `https://api.github.com/repos/${config.GITHUB_REPO_OWNER}/${config.GITHUB_REPO_NAME}/contents/data.json`;
            
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
                
                casinos = parsedData.casinos || [];
                categories = parsedData.categories || config.CATEGORIES;
                
                console.log('✅ Successfully loaded from GitHub:', casinos.length, 'casinos');
                
                // Сохраняем локально для будущего использования
                await this.#saveMainDataLocally();
                
                return true;
            }
            return false;
            
        } catch (error) {
            if (error.response?.status === 404) {
                console.log('⚠️ data.json not found on GitHub');
            } else {
                console.log('❌ Failed to load from GitHub:', error.message);
            }
            return false;
        }
    }

    async #loadMainDataFromLocal() {
        try {
            console.log('📁 Loading main data from local file:', this.dataFilePath);
            const data = await fs.readFile(this.dataFilePath, 'utf8');
            const parsedData = JSON.parse(data);
            casinos = parsedData.casinos || [];
            categories = parsedData.categories || config.CATEGORIES;
            console.log('✅ Loaded from local file:', casinos.length, 'casinos');
        } catch (error) {
            console.log('❌ Local data file not found or invalid, will initialize empty');
            throw error;
        }
    }

    async #loadContentData() {
        try {
            console.log('📁 Loading content data from:', this.contentFilePath);
            const contentData = await fs.readFile(this.contentFilePath, 'utf8');
            const parsedContent = JSON.parse(contentData);
            announcements = parsedContent.announcements || [];
            streamStatus = parsedContent.streamStatus || streamStatus;
            console.log('✅ Loaded announcements:', announcements.length);
        } catch (contentError) {
            console.log('⚠️ Content file not found, creating new...');
            await this.saveContentData();
        }
    }

    async #loadUserData() {
        try {
            console.log('📁 Loading user data from:', this.userDataFilePath);
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
            console.log('✅ Loaded user settings:', userSettings.size, 'users');
        } catch (userError) {
            console.log('⚠️ User data file not found, creating new...');
            await this.saveUserData();
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
            console.log('💾 Main data saved locally for future use');
        } catch (error) {
            console.error('❌ Error saving main data locally:', error.message);
        }
    }

    async initializeData() {
        console.log('🔄 Initializing data files...');
        const initialData = {
            casinos: [],
            categories: categories,
            lastUpdated: new Date().toISOString()
        };

        const initialContent = {
            announcements: [],
            streamStatus: streamStatus,
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
            await fs.writeFile(this.contentFilePath, JSON.stringify(initialContent, null, 2));
            await fs.writeFile(this.userDataFilePath, JSON.stringify(initialUserData, null, 2));
            
            console.log('✅ All data files created with initial structure');
            return true;
        } catch (error) {
            console.error('❌ Error creating initial data files:', error);
            return false;
        }
    }

    // Сохраняем ТОЛЬКО казино в GitHub
    async saveData() {
        try {
            console.log('💾 Saving main data...');
            const dataToSave = {
                casinos: casinos,
                categories: categories,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.dataFilePath, JSON.stringify(dataToSave, null, 2));
            console.log('✅ Main data saved locally');
            
            if (config.GITHUB_TOKEN) {
                try {
                    // Используем оригинальный githubSync для сохранения
                    const githubSync = require('./githubSync');
                    const githubResult = await githubSync.saveDataToGitHub(
                        JSON.stringify(dataToSave, null, 2),
                        'data.json'
                    );
                    console.log('🌐 GitHub sync result:', githubResult.success);
                    return { local: true, github: githubResult.success };
                } catch (githubError) {
                    console.error('❌ GitHub sync error:', githubError.message);
                    return { local: true, github: false };
                }
            }
            
            return { local: true, github: false };

        } catch (error) {
            console.error('❌ Error saving main data:', error.message);
            return { local: false, github: false, error: error.message };
        }
    }

    // Сохраняем контент локально
    async saveContentData() {
        try {
            console.log('💾 Saving content data...');
            const contentToSave = {
                announcements: announcements,
                streamStatus: streamStatus,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.contentFilePath, JSON.stringify(contentToSave, null, 2));
            console.log('✅ Content data saved locally');
            return true;
        } catch (error) {
            console.error('❌ Error saving content data:', error.message);
            return false;
        }
    }

    // Сохраняем пользователей локально
    async saveUserData() {
        try {
            console.log('💾 Saving user data...');
            const userDataToSave = {
                userChats: Object.fromEntries(userChats),
                userSettings: Object.fromEntries(userSettings),
                giveaways: giveaways,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.userDataFilePath, JSON.stringify(userDataToSave, null, 2));
            console.log('✅ User data saved locally');
            return true;
        } catch (error) {
            console.error('❌ Error saving user data:', error.message);
            return false;
        }
    }

    // Сохраняем ВСЕ данные
    async saveAllData() {
        try {
            console.log('💾 Saving ALL data...');
            const [dataResult, contentResult, userResult] = await Promise.all([
                this.saveData(),
                this.saveContentData(),
                this.saveUserData()
            ]);
            
            console.log('✅ All data saved:', { 
                data: dataResult, 
                content: contentResult, 
                user: userResult 
            });
            return {
                data: dataResult,
                content: contentResult,
                user: userResult
            };
        } catch (error) {
            console.error('❌ Error saving all data:', error.message);
            return { error: error.message };
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

        console.log('📊 User action tracked:', { userId, action, target });
        this.saveUserData();
    }

    hideCasinoForUser(userId, casinoId) {
        if (!userSettings.has(userId)) {
            userSettings.set(userId, { hiddenCasinos: [], viewMode: 'full' });
        }
        const settings = userSettings.get(userId);
        if (!settings.hiddenCasinos.includes(casinoId)) {
            settings.hiddenCasinos.push(casinoId);
            console.log('👻 Casino hidden:', { userId, casinoId });
            this.saveUserData();
        }
    }

    unhideCasinoForUser(userId, casinoId) {
        if (userSettings.has(userId)) {
            const settings = userSettings.get(userId);
            settings.hiddenCasinos = settings.hiddenCasinos.filter(id => id !== casinoId);
            console.log('👀 Casino unhidden:', { userId, casinoId });
            this.saveUserData();
        }
    }

    setUserViewMode(userId, mode) {
        if (!['full', 'compact'].includes(mode)) mode = 'full';
        if (!userSettings.has(userId)) {
            userSettings.set(userId, { hiddenCasinos: [], viewMode: mode });
        } else {
            userSettings.get(userId).viewMode = mode;
        }
        console.log('🎨 View mode set:', { userId, mode });
        this.saveUserData();
    }

    approveUserAccess(userId) {
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
        console.log('✅ User approved for live:', userId);
        this.saveUserData();
        return true;
    }

    requestApproval(userId, telegramUsername) {
        if (userChats.has(userId)) {
            const userData = userChats.get(userId);
            userData.pendingApproval = true;
            userData.pendingApprovalDate = new Date().toISOString();
            userData.pendingApprovalUsername = telegramUsername;
            console.log('📋 Approval requested:', { userId, telegramUsername });
            this.saveUserData();
            return true;
        }
        return false;
    }

    getPendingApprovals() {
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

    // Реферальная система
    handleReferralStart(userId, referrerId) {
        if (userChats.has(userId) && referrerId !== userId) {
            const userData = userChats.get(userId);
            userData.referredBy = referrerId;
            userData.referralDate = new Date().toISOString();
            
            if (userChats.has(referrerId)) {
                const referrerData = userChats.get(referrerId);
                if (!referrerData.referrals) referrerData.referrals = [];
                if (!referrerData.referrals.includes(userId)) {
                    referrerData.referrals.push(userId);
                }
            }
            this.saveUserData();
            return true;
        }
        return false;
    }

    getReferralInfo(userId) {
        const userData = userChats.get(userId) || {};
        
        return {
            referredBy: userData.referredBy || null,
            referrals: userData.referrals || [],
            referralLink: `https://t.me/Ludogol_bot?start=ref${userId}`
        };
    }

    // Дополнительные методы для отладки
    getUserData(userId) {
        return {
            chats: userChats.get(userId),
            settings: userSettings.get(userId)
        };
    }

    // Очистка данных (для тестирования)
    async clearAllData() {
        try {
            casinos = [];
            announcements = [];
            userChats.clear();
            userSettings.clear();
            giveaways = [];
            
            await this.saveAllData();
            console.log('🧹 All data cleared');
            return true;
        } catch (error) {
            console.error('❌ Error clearing data:', error.message);
            return false;
        }
    }
}

module.exports = new Database();
