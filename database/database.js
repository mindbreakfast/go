const fs = require('fs').promises;
const path = require('path');
const githubSync = require('./githubSync');
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
        console.log('Database files loaded');
    }

    async loadData() {
        try {
            // 1. Загружаем основные данные (казино + категории)
            console.log('Loading main data (casinos)...');
            const data = await fs.readFile(this.dataFilePath, 'utf8');
            const parsedData = JSON.parse(data);
            casinos = parsedData.casinos || [];
            categories = parsedData.categories || config.CATEGORIES;

            // 2. Загружаем контент (анонсы + стримы)
            try {
                console.log('Loading content data...');
                const contentData = await fs.readFile(this.contentFilePath, 'utf8');
                const parsedContent = JSON.parse(contentData);
                announcements = parsedContent.announcements || [];
                streamStatus = parsedContent.streamStatus || streamStatus;
            } catch (contentError) {
                console.log('Content file not found, creating new...');
                await this.saveContentData();
            }

            // 3. Загружаем данные пользователей (ИСПРАВЛЕНО восстановление Map)
            try {
                console.log('Loading user data...');
                const userData = await fs.readFile(this.userDataFilePath, 'utf8');
                const parsedUserData = JSON.parse(userData);
                
                // Правильное восстановление Map
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
            } catch (userError) {
                console.log('User data file not found, creating new...');
                await this.saveUserData();
            }

            console.log(`Loaded: ${casinos.length} casinos, ${announcements.length} announcements, ${userChats.size} users`);
            return true;

        } catch (error) {
            console.error('Error loading data:', error);
            return await this.initializeData();
        }
    }

    // ... остальные методы без изменений ...

    // Методы пользователей (ПЕРЕНЕСЕНО из userFeatures.js)
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
        this.saveUserData();
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
        console.log('View mode set:', { userId, mode });
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
        console.log('User approved for live:', userId);
        this.saveUserData();
        return true;
    }

    requestApproval(userId, telegramUsername) {
        if (userChats.has(userId)) {
            const userData = userChats.get(userId);
            userData.pendingApproval = true;
            userData.pendingApprovalDate = new Date().toISOString();
            userData.pendingApprovalUsername = telegramUsername;
            console.log('Approval requested:', { userId, telegramUsername });
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
            return true;
        }
        return false;
    }

    getReferralInfo(userId) {
        const userChats = this.getUserChats();
        const userData = userChats.get(userId) || {};
        
        return {
            referredBy: userData.referredBy || null,
            referrals: userData.referrals || [],
            referralLink: `https://t.me/Ludogol_bot?start=ref${userId}`
        };
    }
}

module.exports = new Database();
