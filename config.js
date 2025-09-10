require('dotenv').config();

const config = {
    PORT: process.env.PORT || 3000,
    BOT_TOKEN: process.env.BOT_TOKEN,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_REPO_OWNER: 'mindbreakfast',
    GITHUB_REPO_NAME: 'go', 
    GITHUB_FILE_PATH: 'data.json', 
    GITHUB_COMMITTER: {
        name: 'mindbreakfast',
        email: 'homegamego@gmail.com'
    },
    WEB_APP_URL: 'https://gogo-kohl-beta.vercel.app',
    RENDER_URL: process.env.RENDER_URL || 'https://go-5zty.onrender.com',
    ADMINS: process.env.ADMIN_IDS ? 
        process.env.ADMIN_IDS.split(',').map(id => Number(id.trim())) : 
        [1777213824, 1097210873, 594143385],  
    CATEGORIES: [
        {"id": "kb", "name": "КБ"},
        {"id": "royals", "name": "Роялы"},
        {"id": "cats", "name": "Коты"},
        {"id": "bandits", "name": "Банды"},
        {"id": "other", "name": "Другие"},
        {"id": "pf", "name": "ПФ"},
        {"id": "joy", "name": "ДЖОИ"}
    ],
    BUST_CACHE: process.env.BUST_CACHE === 'true' // ✅ Добавлена переменная
};

console.log('Config loaded:', {
    hasBotToken: !!config.BOT_TOKEN,
    botToken: config.BOT_TOKEN ? config.BOT_TOKEN.substring(0, 10) + '...' : 'missing',
    hasGitHubToken: !!config.GITHUB_TOKEN,
    githubRepo: config.GITHUB_REPO_OWNER + '/' + config.GITHUB_REPO_NAME,
    bustCache: config.BUST_CACHE
});

if (!config.BOT_TOKEN) {
    console.error('FATAL ERROR: BOT_TOKEN is not defined');
    process.exit(1);
}

module.exports = config;
