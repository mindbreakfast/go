const config = require('../config');
const database = require('./database');

class UserFeatures {
    constructor() {
        // Структуры уже должны быть в database.js
    }

    // ===== РЕФЕРАЛЬНАЯ СИСТЕМА =====
    setUserReferrer(userId, referrerId) {
        const userChats = database.getUserChats();
        if (userChats.has(userId) && referrerId !== userId) {
            const userData = userChats.get(userId);
            userData.referredBy = referrerId;
            userData.referralDate = new Date().toISOString();
            
            // Также обновляем у реферера
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

    getUserReferrer(userId) {
        const userChats = database.getUserChats();
        return userChats.get(userId)?.referredBy || null;
    }

    getUserReferrals(userId) {
        const userChats = database.getUserChats();
        return userChats.get(userId)?.referrals || [];
    }

    generateReferralLink(userId) {
        return `https://t.me/${config.BOT_USERNAME}?start=ref${userId}`;
    }

    // ===== СИСТЕМА ОДОБРЕНИЯ ДОСТУПА =====
    approveUserAccess(userId) {
        const userSettings = database.getUserSettings();
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
        return true;
    }

    revokeUserAccess(userId) {
        const userSettings = database.getUserSettings();
        if (userSettings.has(userId)) {
            userSettings.get(userId).approvedForLive = false;
            return true;
        }
        return false;
    }

    isUserApproved(userId) {
        const userSettings = database.getUserSettings();
        return userSettings.get(userId)?.approvedForLive || false;
    }

    getPendingApprovals() {
        const userChats = database.getUserChats();
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

    requestApproval(userId, telegramUsername) {
        const userChats = database.getUserChats();
        if (userChats.has(userId)) {
            const userData = userChats.get(userId);
            userData.pendingApproval = true;
            userData.pendingApprovalDate = new Date().toISOString();
            userData.pendingApprovalUsername = telegramUsername;
            return true;
        }
        return false;
    }
}

module.exports = new UserFeatures();
