const express = require('express');
const bot = require('./bot/bot');
const database = require('./database/database');
const apiRoutes = require('./api/routes'); // Создадим на следующем этапе
const config = require('./config');

const app = express();

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

// Подключаем маршруты API
app.use('/api', apiRoutes);

// Health check и корневой маршрут
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Ludogolik Bot Server работает',
        users: database.getUserChats().size,
        stream_live: database.getStreamStatus().isStreamLive,
        casinos: database.getCasinos().length,
        announcements: database.getAnnouncements().length,
    });
});
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage().rss / 1024 / 1024 + ' MB'
    });
});

// Функция для graceful shutdown
function gracefulShutdown() {
    console.log('\nReceived shutdown signal. Saving data...');
    database.saveData().then(() => {
        console.log('Data saved. Exiting.');
        process.exit(0);
    });
}
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Функция инициализации и запуска
async function startServer() {
    console.log('===================================');
    console.log('Starting Ludogolik Bot Server...');

    // 1. Загружаем данные
    const dataLoaded = await database.loadData();
    if (!dataLoaded) {
        console.error('Failed to load data. Exiting.');
        process.exit(1);
    }

    // 2. Запускаем бота
    await bot.start();

    // 3. Запускаем Express сервер
    app.listen(config.PORT, () => {
        console.log('✅ Server is running on port', config.PORT);
        console.log('✅ Bot is running');
        console.log('===================================');
    });

    // 4. Запускаем периодическое сохранение
    setInterval(() => database.saveData(), 5 * 60 * 1000); // Каждые 5 минут
}

// Запускаем сервер
startServer().catch(error => {
    console.error('Fatal error during startup:', error);
    process.exit(1);
});
