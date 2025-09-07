require('dotenv').config(); // Для загрузки переменных окружения локально

const config = {
    PORT: process.env.PORT || 3000,
    BOT_TOKEN: process.env.BOT_TOKEN,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_REPO: process.env.GITHUB_REPO || 'mindbreakfast/go',
    GITHUB_REPO_OWNER: 'mindbreakfast',
    GITHUB_REPO_NAME: 'go',
    GITHUB_COMMITTER: {
        name: 'mindbreakfast',
        email: 'homegamego@gmail.com'
    },
    WEB_APP_URL: 'https://gogo-kohl-beta.vercel.app',
    RENDER_URL: process.env.RENDER_URL || 'https://go-5zty.onrender.com',
    ADMINS: [1777213824, 594143385, 1097210873].map(id => Number(id)), // Убедимся, что это числа
    CATEGORIES: [
        {"id": "kb", "name": "КБ"},
        {"id": "royals", "name": "Роялы"},
        {"id": "cats", "name": "Коты"},
        {"id": "bandits", "name": "Банды"}, 
        {"id": "other", "name": "Другие"},
        {"id": "pf", "name": "ПФ"},         
        {"id": "joy", "name": "ДЖОИ"}       
    ]
};

// Проверка критически важных переменных
if (!config.BOT_TOKEN) {
    console.error('FATAL ERROR: BOT_TOKEN is not defined in environment variables.');
    process.exit(1);
}

module.exports = config;
