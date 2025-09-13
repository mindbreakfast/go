const express = require('express');
const path = require('path');
const database = require(path.join(__dirname, '..', 'database', 'database'));
const logger = require(path.join(__dirname, '..', 'utils', 'logger'));
const router = express.Router();

let botInstance = null;

function initializeApiRoutes(bot) {
    botInstance = bot;
    logger.info('Bot instance set in API routes');
}

// 🔥 ГЛАВНЫЕ ЭНДПОИНТЫ
router.get('/data', async (req, res) => {
    try {
        const data = {
            casinos: database.getCasinos() || [],
            categories: database.getCategories() || [],
            announcements: database.getAnnouncements() || [],
            streamStatus: database.getStreamStatus() || {
                isStreamLive: false,
                streamUrl: '',
                eventDescription: '',
                lastUpdated: new Date().toISOString()
            }
        };
        
        logger.debug('Sending data to client', { 
            casinos: data.casinos.length,
            categories: data.categories.length 
        });
        
        res.json(data);
    } catch (error) {
        logger.error('Error in /data endpoint:', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to load data',
            details: error.message 
        });
    }
});

router.get('/all-data', async (req, res) => {
    try {
        const data = {
            casinos: database.getCasinos() || [],
            categories: database.getCategories() || [],
            announcements: database.getAnnouncements() || [],
            streamStatus: database.getStreamStatus() || {
                isStreamLive: false,
                streamUrl: '',
                eventDescription: '',
                lastUpdated: new Date().toISOString()
            }
        };
        
        logger.debug('Sending all data to client', { 
            casinos: data.casinos.length 
        });
        
        res.json(data);
    } catch (error) {
        logger.error('Error in /all-data endpoint:', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to load all data',
            details: error.message 
        });
    }
});

// 🔥 ЭНДПОИНТ ДЛЯ ПОЛЬЗОВАТЕЛЬСКИХ ДАННЫХ
router.get('/user-data', async (req, res) => {
    try {
        const userId = parseInt(req.query.userId);
        if (!userId || isNaN(userId)) {
            return res.status(400).json({ error: 'Valid user ID required' });
        }

        const userData = database.getUserData(userId);
        res.json(userData);
    } catch (error) {
        logger.error('Error in /user-data endpoint:', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to load user data',
            details: error.message 
        });
    }
});

// 🔥 ЭНДПОИНТ ДЛЯ СОХРАНЕНИЯ НАСТРОЕК
router.post('/save-user-settings', async (req, res) => {
    try {
        const { userId, hiddenCasinos, viewMode, theme } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

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
        logger.error('Error in /save-user-settings:', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to save settings',
            details: error.message 
        });
    }
});

// 🔥 ЭНДПОИНТ ДЛЯ ОДОБРЕНИЯ
router.post('/request-approval', async (req, res) => {
    try {
        const { userId, username } = req.body;
        
        if (!userId || !username) {
            return res.status(400).json({ error: 'User ID and username required' });
        }

        const success = database.requestApproval(userId, username);
        
        if (success && botInstance) {
            const { isAdmin } = require(path.join(__dirname, '..', 'utils', 'isAdmin'));
            const config = require(path.join(__dirname, '..', 'config'));
            
            // Отправляем уведомления только тем админам, кто есть в config
            const adminNotificationPromises = config.ADMINS.map(adminId => {
                if (isAdmin(adminId)) {
                    return botInstance.sendMessage(adminId,
                        `🆕 Новый запрос на одобрение!\nID: ${userId}\nUsername: ${username}\n/odobri_${userId}`
                    ).catch(err => {
                        logger.warn('Error notifying admin:', { adminId, error: err.message });
                    });
                }
                return Promise.resolve();
            });

            await Promise.allSettled(adminNotificationPromises);
            
            res.json({ status: 'ok', message: 'Approval request sent' });
        } else if (!botInstance) {
            res.json({ status: 'ok', message: 'Request saved but bot not available for notifications' });
        } else {
            res.status(400).json({ error: 'Failed to send approval request' });
        }
    } catch (error) {
        logger.error('Error in /request-approval:', { error: error.message });
        res.status(500).json({ 
            error: 'Approval request error',
            details: error.message 
        });
    }
});

// 🔥 ЭНДПОИНТ ДЛЯ ТРЕКИНГА
router.post('/track-visit', async (req, res) => {
    try {
        const { userId, userInfo, action } = req.body;
        
        if (userId && userInfo) {
            database.trackUserAction(userId, userInfo, action);
        }
        
        res.json({ status: 'ok' });
    } catch (error) {
        logger.error('Error in /track-visit:', { error: error.message });
        res.status(500).json({ 
            error: 'Tracking error',
            details: error.message 
        });
    }
});

router.post('/track-click', async (req, res) => {
    try {
        const { userId, userInfo, casinoId, action } = req.body;
        
        if (userId && casinoId) {
            database.trackUserAction(userId, userInfo, `${action}_${casinoId}`);
            database.trackCasinoClick(userId, casinoId);
        }
        
        res.json({ status: 'ok' });
    } catch (error) {
        logger.error('Error in /track-click:', { error: error.message });
        res.status(500).json({ 
            error: 'Tracking error',
            details: error.message 
        });
    }
});

// 🔥 ЭНДПОИНТ: Трекинг входа в голосовую комнату
router.post('/track-voice-access', async (req, res) => {
    try {
        const { userId, username, roomType, userAgent } = req.body;
        
        if (userId) {
            database.trackVoiceAccess(userId, username, roomType, userAgent);
        }
        
        res.json({ status: 'ok' });
    } catch (error) {
        logger.error('Error in /track-voice-access:', { error: error.message });
        res.status(500).json({ 
            error: 'Voice tracking error',
            details: error.message 
        });
    }
});

// 🔥 ЭНДПОИНТ: Статистика для админов
router.get('/admin/stats', async (req, res) => {
    try {
        // Безопасная проверка прав
        const adminToken = process.env.ADMIN_TOKEN;
        if (!adminToken) {
            logger.error('ADMIN_TOKEN not configured');
            return res.status(503).json({ error: 'Admin access not configured' });
        }

        const token = req.headers.authorization;
        if (!token || token !== `Bearer ${adminToken}`) {
            logger.warn('Unauthorized admin stats access attempt');
            return res.status(403).json({ error: 'Access denied' });
        }

        const stats = {
            users: database.getUserChats() ? database.getUserChats().size : 0,
            casinos: database.getCasinos() ? database.getCasinos().length : 0,
            activeCasinos: database.getCasinos() ? database.getCasinos().filter(c => c.isActive).length : 0,
            pendingApprovals: database.getPendingApprovals() ? database.getPendingApprovals().length : 0,
            casinoStats: database.getCasinoStats() || [],
            voiceAccessLogs: database.getVoiceAccessLogs(50) || []
        };

        res.json(stats);
    } catch (error) {
        logger.error('Error in /admin/stats:', { error: error.message });
        res.status(500).json({ 
            error: 'Stats error',
            details: error.message 
        });
    }
});

router.post('/save-all-data', async (req, res) => {
    try {
        const result = await database.saveAllData();
        res.json(result);
    } catch (error) {
        logger.error('Error saving all data:', { error: error.message });
        res.status(500).json({ 
            error: 'Save all data error',
            details: error.message 
        });
    }
});

router.get('/debug-data', (req, res) => {
    try {
        const data = {
            casinos: database.getCasinos() ? database.getCasinos().length : 0,
            announcements: database.getAnnouncements() || [],
            streamStatus: database.getStreamStatus() || {
                isStreamLive: false,
                streamUrl: '',
                eventDescription: '',
                lastUpdated: new Date().toISOString()
            },
            userSettingsSize: database.getUserSettings() ? database.getUserSettings().size : 0,
            userChatsSize: database.getUserChats() ? database.getUserChats().size : 0,
            pendingApprovals: database.getPendingApprovals() ? database.getPendingApprovals().length : 0
        };
        
        res.json(data);
    } catch (error) {
        logger.error('Error in /debug-data:', { error: error.message });
        res.status(500).json({ 
            error: 'Debug error',
            details: error.message 
        });
    }
});

router.post('/force-reload', async (req, res) => {
    try {
        await database.loadData();
        res.json({ status: 'ok', message: 'Data reloaded' });
    } catch (error) {
        logger.error('Error in force reload:', { error: error.message });
        res.status(500).json({ 
            error: 'Force reload error',
            details: error.message 
        });
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
            users: userChats ? userChats.size : 0,
            streamLive: streamStatus ? streamStatus.isStreamLive : false,
            announcements: announcements ? announcements.length : 0,
            casinos: casinos ? casinos.length : 0,
            pendingApprovals: pendingApprovals ? pendingApprovals.length : 0,
            timestamp: new Date().toISOString()
        };

        res.json(status);
    } catch (error) {
        logger.error('Error in /status:', { error: error.message });
        res.status(500).json({ 
            status: 'error',
            error: 'Status check error',
            timestamp: new Date().toISOString()
        });
    }
});

// 🔥 ЭНДПОИНТ: Прогрев сервера
router.get('/warmup', (req, res) => {
    try {
        const warmupService = require(path.join(__dirname, '..', 'utils', 'warmup'));
        warmupService.manualWarmup();
        
        res.json({ 
            status: 'warmup_initiated',
            message: 'Server warmup process started',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error in warmup endpoint:', { error: error.message });
        res.status(500).json({ 
            status: 'error',
            error: 'Warmup failed',
            timestamp: new Date().toISOString()
        });
    }
});

// 🔥 ЭНДПОИНТ: Health check для Render
router.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage().rss / 1024 / 1024 + ' MB'
    });
});

module.exports = {
    router,
    initializeApiRoutes
};
