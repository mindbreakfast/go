const express = require('express');
const path = require('path');
const database = require('../database/database');
const router = express.Router();

console.log('✅ API routes loaded');

let botInstance = null;

function initializeApiRoutes(bot) {
    botInstance = bot;
    console.log('✅ Bot instance set in API routes');
}

// 🔥 ГЛАВНЫЕ ЭНДПОИНТЫ
router.get('/data', async (req, res) => {
    try {
        console.log('API: /data called');
        const data = {
            casinos: database.getCasinos(),
            categories: database.getCategories(),
            announcements: database.getAnnouncements(),
            streamStatus: database.getStreamStatus()
        };
        
        console.log(`Sending data: ${data.casinos.length} casinos, ${data.announcements.length} announcements`);
        res.json(data);
    } catch (error) {
        console.error('Error in /data endpoint:', error);
        res.status(500).json({ error: 'Failed to load data' });
    }
});

router.get('/all-data', async (req, res) => {
    try {
        console.log('API: /all-data called');
        const data = {
            casinos: database.getCasinos(),
            categories: database.getCategories(),
            announcements: database.getAnnouncements(),
            streamStatus: database.getStreamStatus()
        };
        
        console.log(`Sending all data: ${data.casinos.length} casinos, ${data.announcements.length} announcements`);
        res.json(data);
    } catch (error) {
        console.error('Error in /all-data endpoint:', error);
        res.status(500).json({ error: 'Failed to load all data' });
    }
});

// 🔥 ЭНДПОИНТ ДЛЯ ПОЛЬЗОВАТЕЛЬСКИХ ДАННЫХ
router.get('/user-data', async (req, res) => {
    try {
        const userId = parseInt(req.query.userId);
        if (!userId || isNaN(userId)) {
            return res.status(400).json({ error: 'Valid user ID required' });
        }

        console.log('API: /user-data called for user:', userId);
        
        const userData = database.getUserData(userId);
        
        res.json(userData);
    } catch (error) {
        console.error('Error in /user-data endpoint:', error);
        res.status(500).json({ error: 'Failed to load user data' });
    }
});

// 🔥 ЭНДПОИНТ ДЛЯ СОХРАНЕНИЯ НАСТРОЕК (ДОБАВЛЕНО)
router.post('/save-user-settings', async (req, res) => {
    try {
        const { userId, hiddenCasinos, viewMode, theme } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        console.log('API: /save-user-settings called for user:', userId, {
            hiddenCasinos: hiddenCasinos?.length,
            viewMode: viewMode,
            theme: theme
        });

        const settingsToUpdate = {};
        if (hiddenCasinos !== undefined) settingsToUpdate.hiddenCasinos = hiddenCasinos;
        if (viewMode !== undefined) settingsToUpdate.viewMode = viewMode;
        if (theme !== undefined) settingsToUpdate.theme = theme;

        const success = database.updateUserSettings(userId, settingsToUpdate);
        
        res.json({ 
            success: success,
            message: success ? 'Settings updated successfully' : 'Failed to update settings'
        });
    } catch (error) {
        console.error('Error in /save-user-settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// 🔥 ЭНДПОИНТ ДЛЯ ОДОБРЕНИЯ
router.post('/request-approval', async (req, res) => {
    try {
        console.log('API: /request-approval called with:', req.body);
        const { userId, username } = req.body;
        
        if (!userId || !username) {
            return res.status(400).json({ error: 'User ID and username required' });
        }

        const success = database.requestApproval(userId, username);
        
        if (success && botInstance) {
            const { isAdmin } = require('../utils/isAdmin');
            const config = require('../config');
            
            config.ADMINS.forEach(adminId => {
                if (isAdmin(adminId)) {
                    botInstance.sendMessage(adminId,
                        `🆕 Новый запрос на одобрение!\nID: ${userId}\nUsername: ${username}\n/odobri_${userId}`
                    ).catch(err => console.log('Error notifying admin:', err.message));
                }
            });
            
            res.json({ status: 'ok', message: 'Approval request sent' });
        } else if (!botInstance) {
            console.error('❌ Bot instance not available for approval notifications');
            res.json({ status: 'ok', message: 'Request saved but bot not available for notifications' });
        } else {
            res.status(400).json({ error: 'Failed to send approval request' });
        }
    } catch (error) {
        console.error('Error in /request-approval:', error.message);
        res.status(500).json({ error: 'Approval request error' });
    }
});

// 🔥 ЭНДПОИНТ ДЛЯ ТРЕКИНГА (ДОБАВЛЕНО)
router.post('/track-visit', async (req, res) => {
    try {
        const { userId, userInfo, action } = req.body;
        
        if (userId && userInfo) {
            console.log('📊 Tracking visit:', { userId, action });
            database.trackUserAction(userId, userInfo, action);
        }
        
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Error in /track-visit:', error);
        res.status(500).json({ error: 'Tracking error' });
    }
});

router.post('/track-click', async (req, res) => {
    try {
        const { userId, userInfo, casinoId, action } = req.body;
        
        if (userId && casinoId) {
            console.log('📊 Tracking click:', { userId, casinoId, action });
            database.trackUserAction(userId, userInfo, `${action}_${casinoId}`);
        }
        
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Error in /track-click:', error);
        res.status(500).json({ error: 'Tracking error' });
    }
});

// Другие эндпоинты остаются без изменений
router.post('/webhook', (req, res) => {
    if (!botInstance) {
        console.error('❌ Webhook received but bot instance not initialized');
        return res.sendStatus(503);
    }
    
    console.log('Webhook received:', req.body?.message?.text || 'No text message');
    try {
        botInstance.processUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('Error processing webhook:', error.message);
        res.sendStatus(200);
    }
});

router.post('/save-all-data', async (req, res) => {
    try {
        console.log('API: Saving all data...');
        const result = await database.saveAllData();
        res.json(result);
    } catch (error) {
        console.error('Error saving all data:', error);
        res.status(500).json({ error: 'Save all data error' });
    }
});

router.get('/debug-data', (req, res) => {
    try {
        const data = {
            casinos: database.getCasinos().length,
            announcements: database.getAnnouncements(),
            streamStatus: database.getStreamStatus(),
            userSettingsSize: database.getUserSettings().size,
            userChatsSize: database.getUserChats().size,
            pendingApprovals: database.getPendingApprovals().length
        };
        
        console.log('Debug data:', data);
        res.json(data);
    } catch (error) {
        console.error('Error in /debug-data:', error);
        res.status(500).json({ error: 'Debug error' });
    }
});

router.post('/force-reload', async (req, res) => {
    try {
        console.log('Force reload requested');
        await database.loadData();
        res.json({ status: 'ok', message: 'Data reloaded' });
    } catch (error) {
        console.error('Error in force reload:', error);
        res.status(500).json({ error: 'Force reload error' });
    }
});

router.get('/status', (req, res) => {
    try {
        const userChats = database.getUserChats();
        const streamStatus = database.getStreamStatus();
        const announcements = database.getAnnouncements();
        const casinos = database.getCasinos();
        const pendingApprovals = database.getPendingApprovals();
        
        res.json({
            status: 'ok',
            users: userChats.size,
            streamLive: streamStatus.isStreamLive,
            announcements: announcements.length,
            casinos: casinos.length,
            pendingApprovals: pendingApprovals.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in /status:', error);
        res.status(500).json({ error: 'Status check error' });
    }
});

module.exports = {
    router,
    initializeApiRoutes
};
