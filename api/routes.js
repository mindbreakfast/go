const express = require('express');
const path = require('path');
const database = require('../database/database');
const router = express.Router();

console.log('API routes loaded');

router.get('/all-data', (req, res) => {
    console.log('API: /all-data called');
    try {
        const data = {
            streamStatus: database.getStreamStatus(),
            announcements: database.getAnnouncements(),
            casinos: database.getCasinos(),
            categories: database.getCategories()
        };
        console.log('Sending data:', {
            casinos: data.casinos.length,
            announcements: data.announcements.length,
            streamLive: data.streamStatus.isStreamLive
        });
        res.json(data);
    } catch (error) {
        console.error('Error in /all-data:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/user-data', async (req, res) => {
    try {
        const userId = req.query.userId;
        console.log('API: /user-data called for userId:', userId);
        
        const userSettings = database.getUserSettings();
        const userData = userSettings.get(userId) || {};
        
        const response = {
            hiddenCasinos: userData.hiddenCasinos || [],
            viewMode: userData.viewMode || 'full',
            approvedForLive: userData.approvedForLive || false
        };
        
        console.log('User data response:', response);
        res.json(response);
    } catch (error) {
        console.error('Error in /user-data:', error);
        res.status(500).json({ error: 'User data error' });
    }
});

router.post('/save-user-settings', async (req, res) => {
    try {
        console.log('API: /save-user-settings called with:', req.body);
        const { userId, hiddenCasinos, viewMode } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        const userSettings = database.getUserSettings();
        if (!userSettings.has(userId)) {
            userSettings.set(userId, {
                hiddenCasinos: hiddenCasinos || [],
                viewMode: viewMode || 'full',
                approvedForLive: false
            });
        } else {
            const settings = userSettings.get(userId);
            settings.hiddenCasinos = hiddenCasinos || [];
            settings.viewMode = viewMode || 'full';
        }

        await database.saveUserData();
        console.log('User settings saved for userId:', userId);
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Error in /save-user-settings:', error);
        res.status(500).json({ error: 'Save settings error' });
    }
});

router.post('/track-click', async (req, res) => {
    try {
        console.log('API: /track-click called with:', req.body);
        const { userId, userInfo, casinoId, action } = req.body;
        
        if (userId && userInfo) {
            database.trackUserAction(userId, userInfo, action, casinoId);
        }
        
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Error in /track-click:', error);
        res.status(500).json({ error: 'Tracking error' });
    }
});

router.post('/track-visit', async (req, res) => {
    try {
        console.log('API: /track-visit called with:', req.body);
        const { userId, userInfo, action } = req.body;
        
        if (userId && userInfo) {
            database.trackUserAction(userId, userInfo, action);
        }
        
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Error in /track-visit:', error);
        res.status(500).json({ error: 'Tracking error' });
    }
});

router.post('/request-approval', async (req, res) => {
    try {
        console.log('API: /request-approval called with:', req.body);
        const { userId, username } = req.body;
        
        if (!userId || !username) {
            return res.status(400).json({ error: 'User ID and username required' });
        }

        const success = database.requestApproval(userId, username);
        
        if (success) {
            // Уведомляем админов
            const { isAdmin } = require('../utils/isAdmin');
            const config = require('../config');
            
            config.ADMINS.forEach(adminId => {
                if (isAdmin(adminId)) {
                    const bot = require('../bot/bot').bot;
                    bot.sendMessage(adminId,
                        `🆕 Новый запрос на одобрение!\nID: ${userId}\nUsername: ${username}\n/odobri_${userId}`
                    ).catch(err => console.log('Error notifying admin:', err));
                }
            });
            
            res.json({ status: 'ok', message: 'Approval request sent' });
        } else {
            res.status(400).json({ error: 'Failed to send approval request' });
        }
    } catch (error) {
        console.error('Error in /request-approval:', error);
        res.status(500).json({ error: 'Approval request error' });
    }
});

router.get('/setup-webhook', async (req, res) => {
    try {
        console.log('API: /setup-webhook called');
        const bot = require('../bot/bot').bot;
        const webhookUrl = `${process.env.RENDER_URL || 'https://go-5zty.onrender.com'}/webhook`;
        await bot.setWebHook(webhookUrl);
        const webhookInfo = await bot.getWebHookInfo();
        res.json({ success: true, webhook: webhookInfo.url });
    } catch (error) {
        console.error('Error in /setup-webhook:', error);
        res.json({ success: false, error: error.message });
    }
});

router.post('/webhook', (req, res) => {
    console.log('Webhook received:', req.body?.message?.text || 'No text message');
    try {
        const bot = require('../bot/bot').bot;
        bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.sendStatus(200); // Всегда возвращаем 200 чтобы Telegram не повторял запрос
    }
});

// Добавляем endpoint для сохранения всех данных
router.post('/save-all-data', async (req, res) => {
    try {
        console.log('API: Saving all data before deploy...');
        const result = await database.saveAllData();
        res.json(result);
    } catch (error) {
        console.error('Error saving all data:', error);
        res.status(500).json({ error: 'Save all data error' });
    }
});

// Endpoint для отладки - получить информацию о пользователе
router.get('/debug-user/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        console.log('API: /debug-user called for userId:', userId);
        
        const userData = database.getUserData(userId);
        res.json(userData);
    } catch (error) {
        console.error('Error in /debug-user:', error);
        res.status(500).json({ error: 'Debug error' });
    }
});

// Endpoint для проверки статуса бота
router.get('/status', (req, res) => {
    try {
        const userChats = database.getUserChats();
        const streamStatus = database.getStreamStatus();
        const announcements = database.getAnnouncements();
        const casinos = database.getCasinos();
        
        res.json({
            status: 'ok',
            users: userChats.size,
            streamLive: streamStatus.isStreamLive,
            announcements: announcements.length,
            casinos: casinos.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in /status:', error);
        res.status(500).json({ error: 'Status check error' });
    }
});

// Endpoint для принудительной перезагрузки данных
router.post('/reload-data', async (req, res) => {
    try {
        console.log('API: Forced data reload');
        const success = await database.loadData();
        res.json({ success: success });
    } catch (error) {
        console.error('Error in /reload-data:', error);
        res.status(500).json({ error: 'Reload error' });
    }
});

module.exports = router;
