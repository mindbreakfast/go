const express = require('express');
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
    console.log('Webhook received');
    const bot = require('../bot/bot').bot;
    bot.processUpdate(req.body);
    res.sendStatus(200);
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

module.exports = router; //
