const express = require('express');
const database = require('../database/database');
const router = express.Router();

console.log('API routes loaded');

// Сохраняем все данные перед деплоем
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

router.get('/all-data', (req, res) => {
    console.log('API: /all-data called');
    try {
        const data = {
            streamStatus: database.getStreamStatus(),
            announcements: database.getAnnouncements(),
            casinos: database.getCasinos(),
            categories: database.getCategories()
        };
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
        
        res.json(response);
    } catch (error) {
        console.error('Error in /user-data:', error);
        res.status(500).json({ error: 'User data error' });
    }
});

router.post('/save-user-settings', async (req, res) => {
    try {
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
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Error in /save-user-settings:', error);
        res.status(500).json({ error: 'Save settings error' });
    }
});

// ... остальные endpoints без изменений ...
