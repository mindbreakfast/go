const express = require('express');
const database = require('./database/database');
const { router: apiRoutes, initializeApiRoutes } = require('./api/routes');
const { startBot, testBot } = require('./bot/bot'); // Импортируем функции запуска
const config = require('./config');

const app = express();

console.log('===================================');
console.log('Starting Ludogolik Bot Server...');
console.log('===================================');

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

// Graceful shutdown
function gracefulShutdown() {
    console.log('\n🛑 Received shutdown signal. Saving data...');
    database.saveData().then(() => {
        console.log('✅ Data saved. Exiting.');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Error saving data on shutdown:', error);
        process.exit(1);
    });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

async function startServer() {
    console.log('🔄 Step 1: Loading data from storage...');
    const dataLoaded = await database.loadData();
    if (!dataLoaded) {
        console.error('❌ Failed to load data. Exiting.');
        process.exit(1);
    }

    console.log('✅ Step 2: Data loaded successfully');
    console.log('🔄 Step 3: Starting Telegram Bot...');
    
    try {
        // Запускаем бота (явно и контролируемо)
        const botStartResult = await startBot();
        if (!botStartResult.success) {
            throw new Error('Bot failed to start');
        }

        console.log('✅ Step 4: Bot started successfully');
        
        // Инициализируем API routes с экземпляром бота
        const { bot } = require('./bot/bot');
        initializeApiRoutes(bot);
        console.log('✅ Step 5: API routes initialized with bot instance');

        // Запускаем сервер
        app.listen(config.PORT, () => {
            console.log('✅ Step 6: Express server started on port', config.PORT);
            console.log('===================================');
            console.log('🚀 Server is fully operational!');
            console.log('===================================');
        });

// Автосохранение каждые 5 минут
// setInterval(() => {
//     console.log('💾 Auto-saving data...');
//     database.saveData().catch(err => console.error('❌ Auto-save error:', err.message));
// }, 5 * 60 * 1000);

    } catch (error) {
        console.error('❌ Error during bot startup:', error.message);
        process.exit(1);
    }
}

// Запускаем сервер
startServer().catch(error => {
    console.error('❌ Fatal error during startup:', error);
    process.exit(1);
});
