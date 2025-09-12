const express = require('express');
const database = require('./database/database');
const { router: apiRoutes, initializeApiRoutes } = require('./api/routes');
const { startBot, testBot } = require('./bot/bot');
const config = require('./config');
const logger = require('./utils/logger');
const warmupService = require('./utils/warmup');

const app = express();

logger.info('===================================');
logger.info('Starting Ludogolik Bot Server...');
logger.info('===================================');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
});
app.options('*', (req, res) => res.sendStatus(200));

// Инициализируем API routes (пока без бота)
app.use('/api', apiRoutes);

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

// Warmup endpoint
app.get('/warmup', (req, res) => {
    logger.info('Manual warmup requested');
    warmupService.warmup();
    res.json({ status: 'warmup_started' });
});

// Graceful shutdown
function gracefulShutdown() {
    logger.info('🛑 Received shutdown signal. Saving ALL data...');
    warmupService.stop();
    
    database.saveAllDataToGitHub().then(() => {
        logger.info('✅ All data saved to GitHub. Exiting.');
        process.exit(0);
    }).catch(error => {
        logger.error('❌ Error saving data during shutdown', { error: error.message });
        process.exit(1);
    });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

async function startServer() {
    logger.info('🔄 Step 1: Loading data from storage...');
    const dataLoaded = await database.loadData();
    if (!dataLoaded) {
        logger.error('❌ Failed to load data. Exiting.');
        process.exit(1);
    }

    logger.info('✅ Step 2: Data loaded successfully');
    logger.info('🔄 Step 3: Starting Telegram Bot...');
    
    try {
        // Запускаем бота (явно и контролируемо)
        const botStartResult = await startBot();
        if (!botStartResult.success) {
            throw new Error('Bot failed to start');
        }

        logger.info('✅ Step 4: Bot started successfully');
        
        // Инициализируем API routes с экземпляром бота
        const { bot } = require('./bot/bot');
        initializeApiRoutes(bot);
        logger.info('✅ Step 5: API routes initialized with bot instance');

        // Запускаем сервис прогрева
        warmupService.start();
        logger.info('✅ Step 6: Warmup service started');

        // Запускаем сервер
        app.listen(config.PORT, () => {
            logger.info('✅ Step 7: Express server started on port', { port: config.PORT });
            logger.info('===================================');
            logger.info('🚀 Server is fully operational!');
            logger.info('===================================');
        });

    } catch (error) {
        logger.error('❌ Error during bot startup:', { error: error.message });
        process.exit(1);
    }
}

// Запускаем сервер
startServer().catch(error => {
    logger.error('❌ Fatal error during startup:', { error: error.message });
    process.exit(1);
});
