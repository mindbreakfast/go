const express = require('express');
const database = require('../database/database');
const router = express.Router();

// API для получения всех данных (используется webapp)
router.get('/all-data', (req, res) => {
    const data = {
        streamStatus: database.getStreamStatus(),
        announcements: database.getAnnouncements(),
        casinos: database.getCasinos(),
        categories: database.getCategories() // Нужно добавить этот метод в database.js
    };
    res.json(data);
});

// Трекинг кликов из веб-интерфейса
router.post('/track-click', async (req, res) => {
    try {
        const { userId, userInfo, casinoId, action } = req.body;

        if (userId && userInfo) {
            database.trackUserAction(userId, userInfo, action, casinoId);
        }

        res.json({ status: 'ok' });
    } catch (error) {
        res.status(500).json({ error: 'Tracking error' });
    }
});

// Трекинг визитов из веб-интерфейса
router.post('/track-visit', async (req, res) => {
    try {
        const { userId, userInfo, action } = req.body;

        if (userId && userInfo) {
            database.trackUserAction(userId, userInfo, action);
        }

        res.json({ status: 'ok' });
    } catch (error) {
        res.status(500).json({ error: 'Tracking error' });
    }
});

// Endpoint для setup webhook (можно вызывать вручную)
router.get('/setup-webhook', async (req, res) => {
    const bot = require('../bot/bot').bot;
    try {
        const webhookUrl = `${process.env.RENDER_URL || 'https://go-5zty.onrender.com'}/webhook`;
        await bot.setWebHook(webhookUrl);
        const webhookInfo = await bot.getWebHookInfo();
        res.json({ success: true, webhook: webhookInfo.url });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Webhook endpoint для Telegram
router.post('/webhook', (req, res) => {
    const bot = require('../bot/bot').bot;
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Добавьте эти маршруты перед module.exports

// API для получения пользовательских данных
router.get('/user-data', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) {
            return res.json({});
        }

        const userSettings = database.getUserSettings();
        const userData = userSettings.get(userId) || {};
        
        res.json({
            hiddenCasinos: userData.hiddenCasinos || [],
            viewMode: userData.viewMode || 'full',
            approvedForLive: userData.approvedForLive || false
        });
    } catch (error) {
        res.status(500).json({ error: 'User data error' });
    }
});

// API для сохранения пользовательских настроек
router.post('/save-user-settings', async (req, res) => {
    try {
         console.log('Saving user settings:', req.body); // ←
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

        await database.saveData();
        res.json({ status: 'ok' });
    } catch (error) {
        res.status(500).json({ error: 'Save settings error' });
    }
});


module.exports = router;
