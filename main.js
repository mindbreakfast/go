const express = require('express');
const database = require('./database/database');
const apiRoutes = require('./api/routes');
const config = require('./config');

const app = express();

console.log('Starting server with config:', {
    port: config.PORT,
    renderUrl: config.RENDER_URL
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
});
app.options('*', (req, res) => res.sendStatus(200));

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    console.log('Root endpoint called');
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

function gracefulShutdown() {
    console.log('\nReceived shutdown signal. Saving data...');
    database.saveData().then(() => {
        console.log('Data saved. Exiting.');
        process.exit(0);
    });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

async function startServer() {
    console.log('===================================');
    console.log('Starting Ludogolik Bot Server...');

    const dataLoaded = await database.loadData();
    if (!dataLoaded) {
        console.error('Failed to load data. Exiting.');
        process.exit(1);
    }

    const bot = require('./bot/bot');
    await bot.start();

    app.listen(config.PORT, () => {
        console.log('✅ Server is running on port', config.PORT);
        console.log('✅ Bot is running');
        console.log('===================================');
    });

    setInterval(() => {
        console.log('Auto-saving data...');
        database.saveData();
    }, 5 * 60 * 1000);
}

startServer().catch(error => {
    console.error('Fatal error during startup:', error);
    process.exit(1);
});
