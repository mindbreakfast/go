const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios'); // для запросов к API

const TOKEN = '8368808338:AAF25l680ekIKpzQyvDj9pKc2zByrJx9dII';
const ADMINS = [1777213824];
const GITHUB_TOKEN = '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'; // если используете GitHub
const STATUS_FILE_URL = 'https://api.github.com/repos/mindbreakfast/go/contents/status.json';

const bot = new TelegramBot(TOKEN, { polling: true });

// Функция обновления статуса
async function updateStreamStatus(isLive, streamUrl = '') {
    try {
        const newData = {
            isStreamLive: isLive,
            streamUrl: streamUrl,
            lastUpdated: new Date().toISOString()
        };

        // Если используете GitHub
        const response = await axios.put(STATUS_FILE_URL, {
            message: 'Update stream status',
            content: Buffer.from(JSON.stringify(newData)).toString('base64'),
            sha: '8b137891791fe96927ad78e64b0aad7bded08bdc' // нужен текущий sha файла
        }, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });

        console.log('Статус обновлен!');
        return true;
    } catch (error) {
        console.error('Ошибка обновления:', error);
        return false;
    }
}

// Команда /live
bot.onText(/\/live (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    
    const streamUrl = match[1];
    const success = await updateStreamStatus(true, streamUrl);
    
    if (success) {
        bot.sendMessage(msg.chat.id, `✅ Стрим запущен: ${streamUrl}`);
    } else {
        bot.sendMessage(msg.chat.id, '❌ Ошибка обновления статуса');
    }
});

// Команда /stop
bot.onText(/\/stop/, async (msg) => {
    if (!isAdmin(msg.from.id)) return;
    
    const success = await updateStreamStatus(false);
    
    if (success) {
        bot.sendMessage(msg.chat.id, '✅ Стрим остановлен');
    } else {
        bot.sendMessage(msg.chat.id, '❌ Ошибка обновления статуса');
    }
});
