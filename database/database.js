const fs = require('fs').promises;
const path = require('path');
const config = require(path.join(__dirname, '..', 'config'));
const githubSync = require(path.join(__dirname, 'githubSync'));
const logger = require(path.join(__dirname, '..', 'utils', 'logger'));

class Database {
    constructor() {
        this.casinos = [];
        this.categories = [];
        this.announcements = [];
        this.streamStatus = {
            isStreamLive: false,
            streamUrl: '',
            eventDescription: '',
            lastUpdated: new Date().toISOString()
        };
        this.userChats = new Map();
        this.userSettings = new Map();
        this.giveaways = [];
        this.pendingApprovals = [];
        this.referralData = new Map();
        this.userClickStats = new Map();
        this.hiddenStats = new Map();
        this.voiceAccessLogs = [];
        this.clickQueue = new Map();

        this.dataFilePath = path.join(__dirname, '..', 'data.json');
        this.contentFilePath = path.join(__dirname, '..', 'content.json');
        this.userDataFilePath = path.join(__dirname, '..', 'userdata.json');
        this.statsFilePath = path.join(__dirname, '..', 'stats.json');
        this.backupInterval = null;
        this.clickSyncInterval = null;
        this.writeLocks = {};
    }

    async #acquireLock(filePath) {
        while (this.writeLocks[filePath]) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        this.writeLocks[filePath] = true;
    }

    async #releaseLock(filePath) {
        this.writeLocks[filePath] = false;
    }

    async loadData() {
        logger.info('Starting data loading...');
        
        try {
            await Promise.all([
                this.#loadMainDataFromLocal(),
                this.#loadContentDataFromLocal(),
                this.#loadUserDataFromLocal(),
                this.#loadStatsDataFromLocal()
            ]);

            // 🔥 Запускаем синхронизацию кликов
            this.startClickSyncService();

            logger.info(`Data loaded: ${this.casinos.length} casinos, ${this.userSettings.size} users`);
            return true;

        } catch (error) {
            logger.error('Error loading data:', error.message);
            return await this.initializeData();
        }
    }

    async #loadMainDataFromLocal() {
        try {
            const data = await fs.readFile(this.dataFilePath, 'utf8');
            const parsedData = JSON.parse(data);
            this.casinos = parsedData.casinos || [];
            this.categories = parsedData.categories || [];
        } catch (error) {
            logger.info('Local data file not found, initializing empty');
            await this.#saveMainDataLocally();
        }
    }

    async #loadContentDataFromLocal() {
        try {
            const contentData = await fs.readFile(this.contentFilePath, 'utf8');
            const parsedContent = JSON.parse(contentData);
            this.announcements = parsedContent.announcements || [];
            this.streamStatus = parsedContent.streamStatus || this.streamStatus;
        } catch (error) {
            logger.info('Local content file not found, initializing empty');
            await this.saveContentData();
        }
    }

    async #loadUserDataFromLocal() {
        try {
            const userData = await fs.readFile(this.userDataFilePath, 'utf8');
            const parsedUserData = JSON.parse(userData);
            
            this.userChats = new Map();
            if (parsedUserData.userChats) {
                for (const [key, value] of Object.entries(parsedUserData.userChats)) {
                    this.userChats.set(Number(key), value);
                }
            }
            
            this.userSettings = new Map();
            if (parsedUserData.userSettings) {
                for (const [key, value] of Object.entries(parsedUserData.userSettings)) {
                    this.userSettings.set(Number(key), value);
                }
            }
            
            this.giveaways = parsedUserData.giveaways || [];
            this.pendingApprovals = parsedUserData.pendingApprovals || [];
            this.referralData = new Map();
            
            if (parsedUserData.referralData) {
                for (const [key, value] of Object.entries(parsedUserData.referralData)) {
                    this.referralData.set(Number(key), value);
                }
            }
            
        } catch (error) {
            logger.info('Local user file not found, initializing empty');
            await this.saveUserData();
        }
    }

    async #loadStatsDataFromLocal() {
        try {
            const statsData = await fs.readFile(this.statsFilePath, 'utf8');
            const parsedStats = JSON.parse(statsData);
            
            this.userClickStats = new Map();
            if (parsedStats.userClickStats) {
                for (const [key, value] of Object.entries(parsedStats.userClickStats)) {
                    this.userClickStats.set(Number(key), value);
                }
            }
            
            this.hiddenStats = new Map();
            if (parsedStats.hiddenStats) {
                for (const [key, value] of Object.entries(parsedStats.hiddenStats)) {
                    this.hiddenStats.set(Number(key), value);
                }
            }
            
            this.voiceAccessLogs = parsedStats.voiceAccessLogs || [];
            
        } catch (error) {
            logger.info('Local stats file not found, initializing empty');
            await this.saveStatsData();
        }
    }

    async #saveMainDataLocally() {
        await this.#acquireLock(this.dataFilePath);
        try {
            const dataToSave = {
                casinos: this.casinos,
                categories: this.categories,
                lastUpdated: new Date().toISOString()
            };
            await fs.writeFile(this.dataFilePath, JSON.stringify(dataToSave, null, 2));
        } catch (error) {
            logger.error('Error saving main data:', error.message);
            throw error;
        } finally {
            await this.#releaseLock(this.dataFilePath);
        }
    }

    async saveContentData() {
        await this.#acquireLock(this.contentFilePath);
        try {
            const contentToSave = {
                announcements: this.announcements,
                streamStatus: this.streamStatus,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.contentFilePath, JSON.stringify(contentToSave, null, 2));
            return true;

        } catch (error) {
            logger.error('Error saving content data:', error.message);
            return false;
        } finally {
            await this.#releaseLock(this.contentFilePath);
        }
    }

    async saveUserData() {
        await this.#acquireLock(this.userDataFilePath);
        try {
            const userDataToSave = {
                userChats: Object.fromEntries(this.userChats),
                userSettings: Object.fromEntries(this.userSettings),
                giveaways: this.giveaways,
                pendingApprovals: this.pendingApprovals,
                referralData: Object.fromEntries(this.referralData),
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.userDataFilePath, JSON.stringify(userDataToSave, null, 2));
            return true;

        } catch (error) {
            logger.error('Error saving user data:', error.message);
            return false;
        } finally {
            await this.#releaseLock(this.userDataFilePath);
        }
    }

    async saveStatsData() {
        await this.#acquireLock(this.statsFilePath);
        try {
            const statsToSave = {
                userClickStats: Object.fromEntries(this.userClickStats),
                hiddenStats: Object.fromEntries(this.hiddenStats),
                voiceAccessLogs: this.voiceAccessLogs,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.statsFilePath, JSON.stringify(statsToSave, null, 2));
            return true;

        } catch (error) {
            logger.error('Error saving stats data:', error.message);
            return false;
        } finally {
            await this.#releaseLock(this.statsFilePath);
        }
    }

    async initializeData() {
        logger.info('Initializing data files...');
        
        const initialData = { casinos: [], categories: [], lastUpdated: new Date().toISOString() };
        const initialContent = { announcements: [], streamStatus: this.streamStatus, lastUpdated: new Date().toISOString() };
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
            await Promise.all([
                fs.writeFile(this.dataFilePath, JSON.stringify(initialData, null, 2)),
                fs.writeFile(this.contentFilePath, JSON.stringify(initialContent, null, 2)),
                fs.writeFile(this.userDataFilePath, JSON.stringify(initialUserData, null, 2)),
                fs.writeFile(this.statsFilePath, JSON.stringify(initialStats, null, 2))
            ]);
            
            logger.info('All data files created');
            return true;
        } catch (error) {
            logger.error('Error creating initial data files:', error);
            return false;
        }
    }

    // 🔥 СИНХРОНИЗАЦИЯ КЛИКОВ (раз в час)
    startClickSyncService() {
        if (this.clickSyncInterval) {
            clearInterval(this.clickSyncInterval);
        }

        this.clickSyncInterval = setInterval(async () => {
            try {
                await this.#processClickQueue();
            } catch (error) {
                logger.error('Click sync error:', error.message);
            }
        }, 60 * 60 * 1000); // 1 час
    }

    async #processClickQueue() {
        if (this.clickQueue.size === 0) return;

        logger.info(`Processing click queue: ${this.clickQueue.size} items`);

        for (const [casinoId, count] of this.clickQueue.entries()) {
            const currentHides = this.hiddenStats.get(casinoId) || 0;
            this.hiddenStats.set(casinoId, currentHides + count);
        }

        this.clickQueue.clear();
        await this.saveStatsData();
        logger.info('Click queue processed and saved');
    }

    // 🔥 УЛУЧШЕННЫЙ ТРЕКИНГ КЛИКОВ
    trackCasinoClick(userId, casinoId) {
        try {
            console.log('🎯 Tracking click:', { userId, casinoId });

            // 1. Обновляем статистику пользователя
            if (!this.userClickStats.has(userId)) {
                this.userClickStats.set(userId, {});
            }
            const userStats = this.userClickStats.get(userId);
            userStats[casinoId] = (userStats[casinoId] || 0) + 1;

            // 2. Обновляем общую статистику казино
            const currentClicks = this.hiddenStats.get(casinoId) || 0;
            this.hiddenStats.set(casinoId, currentClicks + 1);

            // 3. Добавляем в очередь для пакетного сохранения
            this.clickQueue.set(casinoId, (this.clickQueue.get(casinoId) || 0) + 1);

            console.log('📊 Click stats updated:', { 
                userClicks: userStats[casinoId], 
                totalClicks: currentClicks + 1 
            });

            // 4. Немедленно сохраняем статистику
            this.saveStatsData().catch(err => 
                logger.error('Save stats error:', err)
            );

            return true;

        } catch (error) {
            logger.error('Error tracking casino click:', error);
            return false;
        }
    }

    trackCasinoHide(casinoId) {
        try {
            const currentHides = this.hiddenStats.get(casinoId) || 0;
            this.hiddenStats.set(casinoId, currentHides + 1);
        } catch (error) {
            logger.error('Error tracking casino hide:', error);
        }
    }

    trackVoiceAccess(userId, username, roomType, userAgent = '') {
        try {
            const logEntry = {
                userId,
                username: username || `user${userId}`,
                roomType,
                userAgent: userAgent.substring(0, 200),
                timestamp: new Date().toISOString()
            };
            
            this.voiceAccessLogs.push(logEntry);
            
            if (this.voiceAccessLogs.length > 100) {
                this.voiceAccessLogs = this.voiceAccessLogs.slice(-100);
            }
        } catch (error) {
            logger.error('Error tracking voice access:', error);
        }
    }

    // 🔥 ПОЛУЧЕНИЕ СТАТИСТИКИ КАЗИНО С АГРЕГАЦИЕЙ
    getCasinoStats() {
        try {
            const stats = [];
            
            for (const casino of this.casinos) {
                if (casino.isActive) {
                    const clicks = this.hiddenStats.get(casino.id) || 0;
                    const hides = this.hiddenStats.get(casino.id) || 0;
                    
                    stats.push({
                        id: casino.id,
                        name: casino.name,
                        clicks: clicks,
                        hides: hides,
                        isPinned: casino.isPinned,
                        clickThroughRate: clicks > 0 ? ((clicks - hides) / clicks * 100).toFixed(1) : 0
                    });
                }
            }
            
            return stats.sort((a, b) => b.clicks - a.clicks);
            
        } catch (error) {
            logger.error('Error getting casino stats:', error);
            return [];
        }
    }

    getVoiceAccessLogs(limit = 30) {
        try {
            return this.voiceAccessLogs.slice(-limit).reverse();
        } catch (error) {
            logger.error('Error getting voice access logs:', error);
            return [];
        }
    }

    getUserClickStats(userId) {
        try {
            return this.userClickStats.get(userId) || {};
        } catch (error) {
            logger.error('Error getting user click stats:', error);
            return {};
        }
    }

    // 🔥 УЛУЧШЕННАЯ РЕФЕРАЛЬНАЯ СИСТЕМА
handleReferralStart(userId, referrerId) {
    try {
        console.log('🔗 Referral start processing:', { userId, referrerId }); // 🔥 ЛОГ
        
        if (userId === referrerId) {
            logger.warn('User tried to refer themselves', { userId, referrerId });
            return false;
        }

        // Проверяем существующую связь
        const userRefData = this.referralData.get(userId) || { referredBy: null, referrals: [], totalEarned: 0 };
        if (userRefData.referredBy && userRefData.referredBy !== referrerId) {
            logger.warn('User already referred by someone else', { userId, existingReferrer: userRefData.referredBy, newReferrer: referrerId });
            return false;
        }

        // 🔥 ЛОГ: Проверяем данные реферера
        console.log('📊 Referrer data before:', { 
            referrerId, 
            hasData: this.referralData.has(referrerId),
            existingReferrals: this.referralData.get(referrerId)?.referrals?.length || 0 
        });

        // Обновляем данные реферера
        if (!this.referralData.has(referrerId)) {
            this.referralData.set(referrerId, { referrals: [], totalEarned: 0 });
        }

        const referrerData = this.referralData.get(referrerId);
        if (!referrerData.referrals.includes(userId)) {
            referrerData.referrals.push(userId);
            referrerData.totalEarned += 10;
            this.referralData.set(referrerId, referrerData);
            
            console.log('🎉 New referral added:', { 
                referrerId, 
                userId, 
                totalReferrals: referrerData.referrals.length 
            });
        } else {
            console.log('⚠️ Referral already exists:', { referrerId, userId });
        }

        // Обновляем данные приглашенного
        userRefData.referredBy = referrerId;
        this.referralData.set(userId, userRefData);

        // 🔥 ЛОГ: Проверяем результат
        console.log('✅ Referral final state:', {
            userId: this.referralData.get(userId),
            referrerId: this.referralData.get(referrerId)
        });

        logger.info('Referral registered', { userId, referrerId, referrals: referrerData.referrals.length });

        this.saveUserData().catch(err => logger.error('Save referral error:', err));
        return true;

    } catch (error) {
        logger.error('Error handling referral start:', error);
        return false;
    }
}

    getReferralInfo(userId) {
        try {
            const refData = this.referralData.get(userId) || {
                referredBy: null,
                referrals: [],
                totalEarned: 0
            };
            
            return {
                referredBy: refData.referredBy,
                referrals: refData.referrals || [],
                referralLink: `https://t.me/${process.env.BOT_TOKEN?.split(':')[0]}?start=ref${userId}`,
                totalEarned: refData.totalEarned || 0
            };
        } catch (error) {
            logger.error('Error getting referral info:', error);
            return {
                referredBy: null,
                referrals: [],
                referralLink: '',
                totalEarned: 0
            };
        }
    }

trackUserAction(userId, userData, actionType) {
    try {
        if (!this.userChats.has(userId)) {
            this.userChats.set(userId, {
                id: userId,
                username: userData.username || 'не указан',
                first_name: userData.first_name,
                last_name: userData.last_name,
                language_code: userData.language_code,
                joined_at: new Date().toISOString(),
                last_activity: new Date().toISOString()
            });
        } else {
            const user = this.userChats.get(userId);
            user.last_activity = new Date().toISOString();
            this.userChats.set(userId, user);
        }
        
        // 🔥 УСИЛЕННАЯ УСТАНОВКА ТЁМНОЙ ТЕМЫ ПО УМОЛЧАНИЮ
        if (!this.userSettings.has(userId)) {
            this.userSettings.set(userId, {
                hiddenCasinos: [],
                notifications: true,
                theme: 'dark', // ТЁМНАЯ ТЕМА ПО УМОЛЧАНИЮ
                hasLiveAccess: false
            });
            console.log('🎨 Установлена тёмная тема по умолчанию для нового пользователя:', userId);
        } else {
            // 🔥 ДЛЯ СУЩЕСТВУЮЩИХ ПОЛЬЗОВАТЕЛЕЙ, ЕСЛИ ТЕМА НЕ УСТАНОВЛЕНА - СТАВИМ ТЁМНУЮ
            const userSettings = this.userSettings.get(userId);
            if (!userSettings.theme || userSettings.theme === 'light') {
                userSettings.theme = 'dark';
                this.userSettings.set(userId, userSettings);
                console.log('🎨 Обновлена тема на тёмную для пользователя:', userId);
            }
        }
        
        return true;
    } catch (error) {
        logger.error('Error tracking user action:', error);
        return false;
    }
}

    requestApproval(userId, username) {
        try {
            const existingRequest = this.pendingApprovals.find(req => req.userId === userId);
            if (existingRequest) {
                return false;
            }
            
            this.pendingApprovals.push({
                userId: userId,
                requestedUsername: username,
                requestedAt: new Date().toISOString(),
                status: 'pending'
            });
            
            this.saveUserData().catch(err => logger.error('Save approval error:', err));
            return true;
        } catch (error) {
            logger.error('Error requesting approval:', error);
            return false;
        }
    }

    approveUserAccess(userId) {
        try {
            const requestIndex = this.pendingApprovals.findIndex(req => req.userId === userId && req.status === 'pending');
            if (requestIndex === -1) {
                return false;
            }
            
            this.pendingApprovals[requestIndex].status = 'approved';
            this.pendingApprovals[requestIndex].approvedAt = new Date().toISOString();
            
            if (this.userSettings.has(userId)) {
                const settings = this.userSettings.get(userId);
                settings.hasLiveAccess = true;
                this.userSettings.set(userId, settings);
            }
            
            this.saveUserData().catch(err => logger.error('Save approval error:', err));
            return true;
        } catch (error) {
            logger.error('Error approving user access:', error);
            return false;
        }
    }

    getUserData(userId) {
        try {
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
                settings: this.userSettings.get(userId) || {
                    hiddenCasinos: [],
                    notifications: true,
                    theme: 'light',
                    hasLiveAccess: false
                },
                profile: this.userChats.get(userId) || null,
                referralInfo: this.getReferralInfo(userId),
                stats: { topCasinos }
            };
        } catch (error) {
            logger.error('Error getting user data:', error);
            return {
                settings: {
                    hiddenCasinos: [],
                    notifications: true,
                    theme: 'light',
                    hasLiveAccess: false
                },
                profile: null,
                referralInfo: this.getReferralInfo(userId),
                stats: { topCasinos: [] }
            };
        }
    }

    updateUserSettings(userId, newSettings) {
        try {
            if (this.userSettings.has(userId)) {
                const currentSettings = this.userSettings.get(userId);
                this.userSettings.set(userId, { ...currentSettings, ...newSettings });
            } else {
                this.userSettings.set(userId, {
                    hiddenCasinos: [],
                    notifications: true,
                    theme: 'light',
                    hasLiveAccess: false,
                    ...newSettings
                });
            }
            
            this.saveUserData().catch(err => logger.error('Save user settings error:', err));
            return true;
        } catch (error) {
            logger.error('Error updating user settings:', error);
            return false;
        }
    }

    // Геттеры
    getCasinos() { return this.casinos; }
    getAnnouncements() { return this.announcements; }
    getUserChats() { return this.userChats; }
    getStreamStatus() { return this.streamStatus; }
    getUserSettings() { return this.userSettings; }
    getGiveaways() { return this.giveaways; }
    getCategories() { return this.categories; }
    getPendingApprovals() { return this.pendingApprovals.filter(req => req.status === 'pending'); }
    getClickStats() { return this.userClickStats; }
    getHiddenStats() { return this.hiddenStats; }
    getVoiceAccessLogs(limit = 30) { return this.voiceAccessLogs.slice(-limit).reverse(); }
    getReferralData() { return this.referralData; }

    getCasino(id) {
        return this.casinos.find(c => c.id === id);
    }

    // Сеттеры
    setCasinos(newCasinos) { 
        this.casinos = newCasinos; 
        this.saveData().catch(err => logger.error('Error saving casinos:', err));
    }

    setAnnouncements(newAnnouncements) { 
        this.announcements = newAnnouncements; 
        this.saveContentData().catch(err => logger.error('Error saving announcements:', err));
    }

    setStreamStatus(newStatus) { 
        this.streamStatus = { ...this.streamStatus, ...newStatus }; 
        this.saveContentData().catch(err => logger.error('Error saving stream status:', err));
    }

    async saveData() {
        try {
            await this.#saveMainDataLocally();
            return true;
        } catch (error) {
            logger.error('Error saving main data:', error.message);
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
            logger.error('Error saving all data:', error.message);
            return false;
        }
    }

    // 🔄 Резервное копирование на GitHub (раз в час)
    startBackupService() {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
        }

        this.backupInterval = setInterval(async () => {
            try {
                logger.info('Starting scheduled backup to GitHub...');
                await this.#backupToGitHub();
            } catch (error) {
                logger.error('Backup error:', error.message);
            }
        }, 60 * 60 * 1000);
    }

    async #backupToGitHub() {
        if (!process.env.GITHUB_TOKEN) {
            logger.warn('GitHub token not available, skipping backup');
            return;
        }

        try {
            const results = await Promise.allSettled([
                this.#backupFile('data.json'),
                this.#backupFile('content.json'),
                this.#backupFile('userdata.json'),
                this.#backupFile('stats.json')
            ]);

            const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
            logger.info(`Backup completed: ${successful}/4 files successful`);

        } catch (error) {
            logger.error('Backup failed:', error.message);
        }
    }

    async #backupFile(fileName) {
        try {
            let content;
            switch (fileName) {
                case 'data.json':
                    content = JSON.stringify({
                        casinos: this.casinos,
                        categories: this.categories,
                        lastUpdated: new Date().toISOString()
                    }, null, 2);
                    break;
                case 'content.json':
                    content = JSON.stringify({
                        announcements: this.announcements,
                        streamStatus: this.streamStatus,
                        lastUpdated: new Date().toISOString()
                    }, null, 2);
                    break;
                case 'userdata.json':
                    content = JSON.stringify({
                        userChats: Object.fromEntries(this.userChats),
                        userSettings: Object.fromEntries(this.userSettings),
                        giveaways: this.giveaways,
                        pendingApprovals: this.pendingApprovals,
                        referralData: Object.fromEntries(this.referralData),
                        lastUpdated: new Date().toISOString()
                    }, null, 2);
                    break;
                case 'stats.json':
                    content = JSON.stringify({
                        userClickStats: Object.fromEntries(this.userClickStats),
                        hiddenStats: Object.fromEntries(this.hiddenStats),
                        voiceAccessLogs: this.voiceAccessLogs,
                        lastUpdated: new Date().toISOString()
                    }, null, 2);
                    break;
            }

            const result = await githubSync.saveDataToGitHub(content, fileName);
            return result.success;
        } catch (error) {
            logger.error(`Backup of ${fileName} failed:`, error.message);
            return false;
        }
    }

    stopBackupService() {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
            this.backupInterval = null;
        }
        if (this.clickSyncInterval) {
            clearInterval(this.clickSyncInterval);
            this.clickSyncInterval = null;
        }
    }
}

module.exports = new Database();
