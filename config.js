require('dotenv').config();
const logger = require('./utils/logger');

// Валидация критически важных переменных ДЕЛОЕ любого логирования
if (!process.env.BOT_TOKEN) {
    // Используем console.error потому что logger может зависеть от config
    console.error('FATAL ERROR: BOT_TOKEN is not defined in environment variables');
    process.exit(1);
}

const config = {
    PORT: process.env.PORT || 3000,
    BOT_TOKEN: process.env.BOT_TOKEN,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    // Репозиторий и коммитер теперь настраиваются через env для гибкости
    GITHUB_REPO_OWNER: process.env.GITHUB_REPO_OWNER || 'mindbreakfast',
    GITHUB_REPO_NAME: process.env.GITHUB_REPO_NAME || 'go',
    GITHUB_COMMITTER: {
        name: process.env.GITHUB_COMMITTER_NAME || 'mindbreakfast',
        email: process.env.GITHUB_COMMITTER_EMAIL || 'homegamego@gmail.com'
    },
    WEB_APP_URL: process.env.WEB_APP_URL || 'https://gogo-kohl-beta.vercel.app',
    // RENDER_URL больше не нужен, будем использовать window.location.origin на фронтенде
    ADMINS: process.env.ADMIN_IDS ? 
        process.env.ADMIN_IDS.split(',').map(id => {
            const numId = Number(id.trim());
            return isNaN(numId) ? null : numId;
        }).filter(id => id !== null) : 
        [], // Убраны жесткие ID. Только из environment variables!
    CATEGORIES: [
        {"id": "kb", "name": "КБ"},
        {"id": "royals", "name": "Роялы"},
        {"id": "cats", "name": "Коты"},
        {"id": "bandits", "name": "Банды"},
        {"id": "other", "name": "Другие"},
        {"id": "pf", "name": "Пф"},
        {"id": "joy", "name": "Джои"}
    ],
    BUST_CACHE: process.env.BUST_CACHE === 'true',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

// Безопасное логирование конфигурации
logger.info('Config loaded:', {
    port: config.PORT,
    hasBotToken: !!config.BOT_TOKEN,
    hasGitHubToken: !!config.GITHUB_TOKEN,
    githubRepo: `${config.GITHUB_REPO_OWNER}/${config.GITHUB_REPO_NAME}`,
    adminCount: config.ADMINS.length,
    bustCache: config.BUST_CACHE,
    logLevel: config.LOG_LEVEL
});

module.exports = config;
