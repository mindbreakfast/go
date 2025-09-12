const express = require('express');
const path = require('path');
const database = require('../database/database');
const logger = require('../utils/logger');
const router = express.Router();

logger.info('✅ API routes loaded');

let botInstance = null;

function initializeApiRoutes(bot) {
    botInstance = bot;
    logger.info('✅ Bot instance set in API routes');
}

// 🔥 ГЛАВНЫЕ ЭНДПОИНТЫ
router.get('/data', async (req, res) => {
    try {
        logger.debug('API: /data called');
        const data = {
            casinos: database.getCasinos(),
            categories: database.getCategories(),
            announcements: database.getAnnouncements(),
            streamStatus: database.getStreamStatus()
        };
        
        logger.info('Sending data to client', {
            casinos: data.casinos.length,
            announcements: data.announcements.length
        });
        res.json(data);
    } catch (error) {
        logger.error('Error in /data endpoint:', { error: error.message });
        res.status(500).json({ error: 'Failed to load data' });
    }
});

router.get('/all-data', async (req, res) => {
    try {
        logger.debug('API: /all-data called');
        const data = {
            casinos: database.getCasinos(),
            categories: database.getCategories(),
            announcements: database.getAnnouncements(),
            streamStatus: database.getStreamStatus()
        };
        
        logger.debug('Sending all data to client', { casinos: data.casinos.length });
        res.json(data);
    } catch (error) {
        logger.error('Error in /all-data endpoint:', { error: error.message });
        res.status(500).json({ error: 'Failed to load all data' });
    }
});

// 🔥 ЭНДПОИНТ ДЛЯ ПОЛЬЗОВАТЕЛЬСКИХ ДАННЫХ
router.get('/user-data', async (req, res) => {
    try {
        const userId = parseInt(req.query.userId);
        if (!userId || isNaN(userId)) {
            logger.warn('Invalid user ID in /user-data', { userId: req.query.userId });
            return res.status(400).json({ error: 'Valid user ID required' });
        }

        logger.debug('API: /user-data called for user:', { userId });
        
        const userData = database.getUserData(userId);
        
        logger.debug('User data retrieved', { userId, hasSettings: !!userData.settings });
        res.json(userData);
    } catch (error) {
        logger.error('Error in /user-data endpoint:', { error: error.message });
        res.status(500).json({ error: 'Failed to load user data' });
    }
});

// 🔥 ЭНДПОИНТ ДЛЯ СОХРАНЕНИЯ НАСТРОЕК
router.post('/save-user-settings', async (req, res) => {
    try {
        const { userId, hiddenCasinos, viewMode, theme } = req.body;
        
        if (!userId) {
            logger.warn('Missing user ID in /save-user-settings');
            return res.status(400).json({ error: 'User ID required' });
        }

        logger.debug('API: /save-user-settings called', {
            userId,
            hiddenCasinos: hiddenCasinos?.length,
            viewMode,
            theme
        });

        const settingsToUpdate = {};
        if (hiddenCasinos !== undefined) settingsToUpdate.hiddenCasinos = hiddenCasinos;
        if (viewMode !== undefined) settingsToUpdate.viewMode = viewMode;
        if (theme !== undefined) settingsToUpdate.theme = theme;

        const success = database.updateUserSettings(userId, settingsToUpdate);
        
        if (success) {
            logger.info('User settings updated successfully', { userId });
        } else {
            logger.warn('Failed to update user settings', { userId });
        }
        
        res.json({ 
            success: success,
            message: success ? 'Settings updated successfully' : 'Failed to update settings'
        });
    } catch (error) {
        logger.error('Error in /save-user-settings:', { error: error.message });
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// 🔥 ЭНДПОИНТ ДЛЯ ОДОБРЕНИЯ
router.post('/request-approval', async (req, res) => {
    try {
        logger.debug('API: /request-approval called', { body: req.body });
        const { userId, username } = req.body;
        
        if (!userId || !username) {
            logger.warn('Missing parameters in /request-approval', { userId, username });
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
                    ).catch(err => logger.warn('Error notifying admin:', { adminId, error: err.message }));
                }
            });
            
            logger.info('Approval request processed successfully', { userId, username });
            res.json({ status: 'ok', message: 'Approval request sent' });
        } else if (!botInstance) {
            logger.error('Bot instance not available for approval notifications');
            res.json({ status: 'ok', message: 'Request saved but bot not available for notifications' });
        } else {
            logger.warn('Failed to send approval request', { userId, username });
            res.status(400).json({ error: 'Failed to send approval request' });
        }
    } catch (error) {
        logger.error('Error in /request-approval:', { error: error.message });
        res.status(500).json({ error: 'Approval request error' });
    }
});

// 🔥 ЭНДПОИНТ ДЛЯ ТРЕКИНГА
router.post('/track-visit', async (req, res) => {
    try {
        const { userId, userInfo, action } = req.body;
        
        if (userId && userInfo) {
            logger.debug('Tracking visit', { userId, action });
            database.trackUserAction(userId, userInfo, action);
        }
        
        res.json({ status: 'ok' });
    } catch (error) {
        logger.error('Error in /track-visit:', { error: error.message });
        res.status(500).json({ error: 'Tracking error' });
    }
});

router.post('/track-click', async (req, res) => {
    try {
        const { userId, userInfo, casinoId, action } = req.body;
        
        if (userId && casinoId) {
            logger.debug('Tracking click', { userId, casinoId, action });
            database.trackUserAction(userId, userInfo, `${action}_${casinoId}`);
            database.trackCasinoClick(casinoId); // 📊 Трекинг кликов по казино
        }
        
        res.json({ status: 'ok' });
    } catch (error) {
        logger.error('Error in /track-click:', { error: error.message });
        res.status(500).json({ error: 'Tracking error' });
    }
});

// 🔥 НОВЫЙ ЭНДПОИНТ: Трекинг входа в голосовую комнату
router.post('/track-voice-access', async (req, res) => {
    try {
        const { userId, username, roomType, userAgent } = req.body;
        
        if (userId) {
            logger.info('Voice access tracked', { userId, username, roomType });
            database.trackVoiceAccess(userId, username, roomType, userAgent);
        }
        
        res.json({ status: 'ok' });
    } catch (error) {
        logger.error('Error in /track-voice-access:', { error: error.message });
        res.status(500).json({ error: 'Voice tracking error' });
    }
});

// 🔥 НОВЫЙ ЭНДПОИНТ: Статистика для админов
router.get('/admin/stats', async (req, res) => {
    try {
        logger.debug('API: /admin/stats called');
        
        // Простая проверка прав (можно улучшить)
        const token = req.headers.authorization;
        if (!token || token !== `Bearer ${process.env.ADMIN_TOKEN}`) {
            logger.warn('Unauthorized admin stats access attempt');
            return res.status(403).json({ error: 'Access denied' });
        }

        const stats = {
            users: database.getUserChats().size,
            casinos: database.getCasinos().length,
            activeCasinos: database.getCasinos().filter(c => c.isActive).length,
            pendingApprovals: database.getPendingApprovals().length,
            casinoStats: database.getCasinoStats(),
            voiceAccessLogs: database.getVoiceAccessLogs(50)
        };

        logger.info('Admin stats retrieved');
        res.json(stats);
    } catch (error) {
        logger.error('Error in /admin/stats:', { error: error.message });
        res.status(500).json({ error: 'Stats error' });
    }
});

// Другие эндпоинты остаются без изменений
router.post('/webhook', (req, res) => {
    if (!botInstance) {
        logger.error('Webhook received but bot instance not initialized');
        return res.sendStatus(503);
    }
    
    logger.debug('Webhook received:', { 
        text: req.body?.message?.text || 'No text message' 
    });
    try {
        botInstance.processUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        logger.error('Error processing webhook:', { error: error.message });
        res.sendStatus(200);
    }
});

router.post('/save-all-data', async (req, res) => {
    try {
        logger.info('API: Saving all data...');
        const result = await database.saveAllData();
        res.json(result);
    } catch (error) {
        logger.error('Error saving all data:', { error: error.message });
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
        
        logger.debug('Debug data accessed');
        res.json(data);
    } catch (error) {
        logger.error('Error in /debug-data:', { error: error.message });
        res.status(500).json({ error: 'Debug error' });
    }
});

router.post('/force-reload', async (req, res) => {
    try {
        logger.info('Force reload requested');
        await database.loadData();
        res.json({ status: 'ok', message: 'Data reloaded' });
    } catch (error) {
        logger.error('Error in force reload:', { error: error.message });
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
        
        const status = {
            status: 'ok',
            users: userChats.size,
            streamLive: streamStatus.isStreamLive,
            announcements: announcements.length,
            casinos: casinos.length,
            pendingApprovals: pendingApprovals.length,
            timestamp: new Date().toISOString()
        };

        logger.debug('Status check performed');
        res.json(status);
    } catch (error) {
        logger.error('Error in /status:', { error: error.message });
        res.status(500).json({ error: 'Status check error' });
    }
});

// 🔥 НОВЫЙ ЭНДПОИНТ: Прогрев сервера
router.get('/warmup', (req, res) => {
    logger.info('Manual warmup endpoint called');
    res.json({ 
        status: 'warmup_initiated',
        message: 'Server warmup process started',
        timestamp: new Date().toISOString()
    });
});

module.exports = {
    router,
    initializeApiRoutes
};
