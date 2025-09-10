const express = require('express');
const path = require('path');
const database = require('../database/database');
const router = express.Router();

console.log('✅ API routes loaded');

// Сохраняем ссылку на бота, который будет передан при инициализации
let botInstance = null;

// Функция для инициализации (будет вызвана из main.js)
function initializeApiRoutes(bot) {
    botInstance = bot;
    console.log('✅ Bot instance set in API routes');
}

// 🔥 ДОБАВЛЯЕМ ГЛАВНЫЙ ЭНДПОИНТ ДЛЯ ВЕБ-ПРИЛОЖЕНИЯ
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

router.post('/request-approval', async (req, res) => {
    try {
        console.log('API: /request-approval called with:', req.body);
        const { userId, username } = req.body;
        
        if (!userId || !username) {
            return res.status(400).json({ error: 'User ID and username required' });
        }

        const success = database.requestApproval(userId, username);
        
        if (success && botInstance) {
            // Уведомляем админов через переданный экземпляр бота
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

// Убираем обработчики webhook или оставляем с проверкой botInstance
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

// Добавляем endpoint для сохранения всех данных
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

// Debug endpoint для проверки данных
router.get('/debug-data', (req, res) => {
    try {
        const data = {
            casinos: database.getCasinos().length,
            announcements: database.getAnnouncements(),
            streamStatus: database.getStreamStatus(),
            userSettingsSize: database.getUserSettings().size,
            userChatsSize: database.getUserChats().size
        };
        
        console.log('Debug data:', data);
        res.json(data);
    } catch (error) {
        console.error('Error in /debug-data:', error);
        res.status(500).json({ error: 'Debug error' });
    }
});

// Debug endpoint для принудительной перезагрузки
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

module.exports = {
    router,
    initializeApiRoutes // Добавляем функцию инициализации
};
