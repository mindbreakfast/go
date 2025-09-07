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

module.exports = router;
