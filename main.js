const express = require('express');
const database = require('./database/database');
const { router: apiRoutes, initializeApiRoutes } = require('./api/routes');
const { startBot } = require('./bot/bot');
const config = require('./config');
const logger = require('./utils/logger');

const app = express();

logger.info('Starting Ludogolik Bot Server...');

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
});
app.options('*', (req, res) => res.sendStatus(200));

// Health check endpoints
app.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'Ludogolik Bot Server работает', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage().rss / 1024 / 1024 + ' MB'
    });
});

// Graceful shutdown
function gracefulShutdown() {
    logger.info('Received shutdown signal. Saving data...');
    database.stopBackupService();
    
    // Даем время на сохранение данных, но не блокируем надолго
    setTimeout(() => {
        process.exit(0);
    }, 5000);
    
    database.saveAllData().then(() => {
        logger.info('Data saved. Exiting.');
        process.exit(0);
    }).catch(error => {
        logger.error('Error saving data on shutdown:', error);
        process.exit(1);
    });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Обработчики необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception thrown:', error);
    process.exit(1);
});

async function startServer() {
    try {
        logger.info('Step 1: Loading data from storage...');
        const dataLoaded = await database.loadData();
        
        if (!dataLoaded) {
            throw new Error('Failed to load data from storage');
        }

        logger.info('Step 2: Data loaded successfully');
        
        // Запускаем сервис резервного копирования
        database.startBackupService();
        logger.info('Step 3: Backup service started');

        logger.info('Step 4: Starting Telegram Bot...');
        const botStartResult = await startBot();
        
        if (!botStartResult.success) {
            throw new Error('Bot failed to start');
        }

        logger.info('Step 5: Bot started successfully');
        
        // Инициализируем API routes с экземпляром бота
        const { bot } = require('./bot/bot');
        initializeApiRoutes(bot);
        logger.info('Step 6: API routes initialized');

        // Подключаем API routes ПОСЛЕ инициализации
        app.use('/api', apiRoutes);
        logger.info('Step 7: API routes mounted');

        // Запускаем сервер
        const server = app.listen(config.PORT, () => {
            logger.info('Server started on port', config.PORT);
            logger.info('Server is fully operational!');
        });

        // Обработчик ошибок сервера
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`Port ${config.PORT} is already in use`);
            } else {
                logger.error('Server error:', error);
            }
            process.exit(1);
        });

    } catch (error) {
        logger.error('Fatal error during startup:', error);
        process.exit(1);
    }
}

// Запускаем сервер
startServer().catch(error => {
    logger.error('Fatal error during startup:', error);
    process.exit(1);
});
