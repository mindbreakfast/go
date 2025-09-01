const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// ==== НАСТРОЙКИ ====
const TOKEN = process.env.BOT_TOKEN || '8368808338:AAECcdNDbVJkwlgTlXV_aVnhxrG3wdKRW2A';
const ADMINS = [1777213824];
const WEB_APP_URL = 'https://gogo-kohl-beta.vercel.app';
// ===================

// Разрешаем CORS запросы
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Создаем бота
const bot = new TelegramBot(TOKEN, { 
    polling: {
        interval: 300,
        timeout: 10,
        limit: 100
    }
});

// ==== GITHUB API ====
class GitHubAPI {
    constructor() {
        // Используем токен из переменных окружения (безопаснее)
        this.token = process.env.GITHUB_TOKEN || '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';
        this.repo = 'mindbreakfast/go';
        this.filePath = 'data_default.json';
        
        console.log('🔑 GitHub Token:', this.token ? 'установлен' : 'отсутствует');
    }

    async getFileSHA() {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: `/repos/${this.repo}/contents/${this.filePath}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'User-Agent': 'Node.js',
                    'Accept': 'application/vnd.github.v3+json'
                }
            };

            console.log('🔍 Запрос SHA по пути:', options.path);

            const req = https.request(options, (res) => {
                let data = '';
                console.log('📡 Статус ответа GitHub:', res.statusCode);
                
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    console.log('📋 Ответ GitHub:', data);
                    
                    try {
                        const response = JSON.parse(data);
                        
                        if (response.sha) {
                            console.log('✅ SHA найден:', response.sha);
                            resolve(response.sha);
                        } else if (response.message === 'Not Found') {
                            reject(new Error('Файл не найден на GitHub. Проверьте путь.'));
                        } else {
                            reject(new Error('SHA не найден в ответе: ' + JSON.stringify(response)));
                        }
                    } catch (error) {
                        reject(new Error('Ошибка парсинга ответа: ' + data));
                    }
                });
            });

            req.on('error', (error) => {
                console.error('❌ Ошибка запроса:', error);
                reject(error);
            });
            
            req.end();
        });
    }

    async updateFile(content) {
        try {
            console.log('🔄 Попытка обновления файла на GitHub...');
            const sha = await this.getFileSHA();
            console.log('🔑 Получен SHA:', sha);
            
            return new Promise((resolve, reject) => {
                const postData = JSON.stringify({
                    message: '🤖 Update casino list via bot',
                    content: Buffer.from(content).toString('base64'),
                    sha: sha
                });

                const options = {
                    hostname: 'api.github.com',
                    path: `/repos/${this.repo}/contents/${this.filePath}`,
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'User-Agent': 'Node.js',
                        'Content-Type': 'application/json',
                        'Content-Length': postData.length,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                };

                const req = https.request(options, (res) => {
                    let data = '';
                    console.log('📡 Статус ответа (PUT):', res.statusCode);
                    
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        console.log('📋 Ответ (PUT):', data);
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            resolve(data);
                        }
                    });
                });

                req.on('error', reject);
                req.write(postData);
                req.end();
            });

        } catch (error) {
            console.error('❌ Ошибка получения SHA:', error.message);
            throw error;
        }
    }
}

const githubAPI = new GitHubAPI();

// Храним статус в памяти вместо файла
let streamStatus = {
    isStreamLive: false,
    streamUrl: '',
    eventDescription: '',
    lastUpdated: new Date().toISOString()
};

// ===== СИСТЕМА МНОГОШАГОВОГО ДОБАВЛЕНИЯ КАЗИНО =====
const userStates = new Map();
const ADD_CASINO_STEPS = {
    START: 'start',
    NAME: 'name',
    PROMOCODE: 'promocode', 
    DESCRIPTION: 'description',
    URL: 'url',
    CATEGORY: 'category',
    KEYWORDS: 'keywords',
    CONFIRM: 'confirm'
};

// ===== ОБРАБОТКА ОШИБОК POLLING =====
bot.on('polling_error', (error) => {
    console.log('Polling error:', error.code);
    
    if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
        console.log('Обнаружена ошибка 409, перезапускаем polling через 5 секунд...');
        setTimeout(() => {
            bot.stopPolling().then(() => {
                console.log('Старый polling остановлен');
                bot.startPolling();
                console.log('Новый polling запущен');
            });
        }, 5000);
    }
});

// ===== ПРОВЕРКА ПРАВ =====
function isAdmin(userId) {
    return ADMINS.includes(Number(userId));
}

// ===== ФУНКЦИЯ ОБНОВЛЕНИЯ СТАТУСА СТРИМА =====
async function updateStreamStatus(isLive, streamUrl = '', eventDescription = '') {
    try {
        streamStatus = {
            isStreamLive: isLive,
            streamUrl: streamUrl,
            eventDescription: eventDescription,
            lastUpdated: new Date().toISOString()
        };
        
        console.log('✅ Статус стрима обновлен:', streamStatus);
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка обновления статуса:', error);
        return false;
    }
}

// ===== КОМАНДЫ БОТА =====

// Команда /start
bot.onText(/\/start/, (msg) => {
    console.log('Получен /start от:', msg.from.id);
    
    const keyboard = {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: '🎰 ОТКРЫТЬ СПИСОК КАЗИНО',
                    web_app: { url: WEB_APP_URL }
                }
            ]]
        }
    };
    
    bot.sendMessage(msg.chat.id, 'Добро пожаловать! Нажмите кнопку ниже:', keyboard)
        .catch(error => console.log('Ошибка отправки:', error));
});

// Команда /live - с описанием
bot.onText(/\/live (.+) (.+)/, async (msg, match) => {
    console.log('Получен /live от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const streamUrl = match[1];
    const eventDescription = match[2];
    
    const success = await updateStreamStatus(true, streamUrl, eventDescription);
    
    bot.sendMessage(msg.chat.id, success ? 
        `✅ Стрим запущен!\nСсылка: ${streamUrl}\nОписание: ${eventDescription}` : 
        '❌ Ошибка обновления статуса'
    );
});

// Команда /stop
bot.onText(/\/stop/, async (msg) => {
    console.log('Получен /stop от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const success = await updateStreamStatus(false, '', '');
    bot.sendMessage(msg.chat.id, success ? 
        '✅ Стрим остановлен' : 
        '❌ Ошибка обновления статуса'
    );
});

// Команда /add - начало диалога
bot.onText(/\/add/, (msg) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }

    userStates.set(msg.from.id, {
        step: ADD_CASINO_STEPS.NAME,
        newCasino: {}
    });

    bot.sendMessage(msg.chat.id, 
        '🎰 Начинаем добавление нового казино!\n\n' +
        'Введите название казино:'
    );
});

// Команда /cancel для отмены процесса
bot.onText(/\/cancel/, (msg) => {
    if (userStates.has(msg.from.id)) {
        userStates.delete(msg.from.id);
        bot.sendMessage(msg.chat.id, '✅ Текущая операция отменена.');
    }
});

// Команда для теста GitHub API
bot.onText(/\/test_github/, async (msg) => {
    if (!isAdmin(msg.from.id)) return;
    
    try {
        const sha = await githubAPI.getFileSHA();
        bot.sendMessage(msg.chat.id, `✅ GitHub API работает! SHA: ${sha}`);
    } catch (error) {
        bot.sendMessage(msg.chat.id, `❌ GitHub API ошибка: ${error.message}`);
    }
});

// Команда для диагностики GitHub
bot.onText(/\/debug_github/, async (msg) => {
    if (!isAdmin(msg.from.id)) return;
    
    try {
        bot.sendMessage(msg.chat.id, '🔍 Проверяю доступ к GitHub...');
        
        const options = {
            hostname: 'api.github.com',
            path: '/user',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${githubAPI.token}`,
                'User-Agent': 'Node.js',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const userInfo = JSON.parse(data);
                    bot.sendMessage(msg.chat.id,
                        `✅ GitHub API доступен!\n` +
                        `👤 User: ${userInfo.login || 'unknown'}\n` +
                        `📧 Email: ${userInfo.email || 'hidden'}\n` +
                        `🏢 Company: ${userInfo.company || 'none'}`
                    );
                } catch (error) {
                    bot.sendMessage(msg.chat.id, `❌ Ошибка: ${data}`);
                }
            });
        });

        req.on('error', (error) => {
            bot.sendMessage(msg.chat.id, `❌ Ошибка подключения: ${error.message}`);
        });

        req.end();

    } catch (error) {
        bot.sendMessage(msg.chat.id, `❌ Ошибка: ${error.message}`);
    }
});

// ===== ОБРАБОТЧИК ТЕКСТОВЫХ СООБЩЕНИЙ =====
bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    
    const userId = msg.from.id;
    const userState = userStates.get(userId);
    
    if (!userState || !userState.step) return;

    try {
        switch (userState.step) {
            case ADD_CASINO_STEPS.NAME:
                userState.newCasino.name = msg.text;
                userState.step = ADD_CASINO_STEPS.PROMOCODE;
                bot.sendMessage(msg.chat.id, 'Введите промокод:');
                break;

            case ADD_CASINO_STEPS.PROMOCODE:
                userState.newCasino.promocode = msg.text;
                userState.step = ADD_CASINO_STEPS.DESCRIPTION;
                bot.sendMessage(msg.chat.id, 'Введите описание промокода:');
                break;

            case ADD_CASINO_STEPS.DESCRIPTION:
                userState.newCasino.promoDescription = msg.text;
                userState.step = ADD_CASINO_STEPS.URL;
                bot.sendMessage(msg.chat.id, 'Введите URL казино:');
                break;

            case ADD_CASINO_STEPS.URL:
                userState.newCasino.url = msg.text;
                userState.newCasino.registeredUrl = msg.text.replace('ref=', '');
                userState.step = ADD_CASINO_STEPS.CATEGORY;
                
                const fs = require('fs').promises;
                const data = await fs.readFile('data_default.json', 'utf8');
                const jsonData = JSON.parse(data);
                const categories = jsonData.categories.map(c => c.name).join(', ');
                
                bot.sendMessage(msg.chat.id, 
                    `Введите категорию (доступные: ${categories}):`
                );
                break;

            case ADD_CASINO_STEPS.CATEGORY:
                userState.newCasino.category = msg.text.toLowerCase();
                userState.step = ADD_CASINO_STEPS.KEYWORDS;
                bot.sendMessage(msg.chat.id, 
                    'Введите ключевые слова через запятую (для поиска):\n' +
                    'Пример: казино, slots, рулетка'
                );
                break;

            case ADD_CASINO_STEPS.KEYWORDS:
                userState.newCasino.hiddenKeywords = msg.text.split(',').map(kw => kw.trim());
                userState.step = ADD_CASINO_STEPS.CONFIRM;
                
                const casino = userState.newCasino;
                bot.sendMessage(msg.chat.id,
                    `✅ Проверьте данные:\n\n` +
                    `🎰 Название: ${casino.name}\n` +
                    `🎯 Промокод: ${casino.promocode}\n` +
                    `📝 Описание: ${casino.promoDescription}\n` +
                    `🔗 URL: ${casino.url}\n` +
                    `🏷️ Категория: ${casino.category}\n` +
                    `🔍 Ключевые слова: ${casino.hiddenKeywords.join(', ')}\n\n` +
                    `Для подтверждения введите "да", для отмены - "нет"`
                );
                break;

            case ADD_CASINO_STEPS.CONFIRM:
                if (msg.text.toLowerCase() === 'да') {
                    try {
                        const fs = require('fs').promises;
                        const data = await fs.readFile('data_default.json', 'utf8');
                        const jsonData = JSON.parse(data);
                        
                        const newCasino = {
                            id: Math.max(0, ...jsonData.casinos.map(c => c.id)) + 1,
                            name: userState.newCasino.name,
                            promocode: userState.newCasino.promocode,
                            promoDescription: userState.newCasino.promoDescription,
                            description: "Добавлено через бота",
                            url: userState.newCasino.url,
                            registeredUrl: userState.newCasino.registeredUrl,
                            showRegisteredButton: true,
                            hiddenKeywords: userState.newCasino.hiddenKeywords,
                            category: userState.newCasino.category,
                            isActive: true
                        };
                        
                        jsonData.casinos.push(newCasino);
                        const newContent = JSON.stringify(jsonData, null, 2);
                        
                        // Сохраняем локально
                        await fs.writeFile('data_default.json', newContent);
                        
                        // Обновляем на GitHub
                        try {
                            await githubAPI.updateFile(newContent);
                            bot.sendMessage(msg.chat.id,
                                `✅ Казино успешно добавлено!\n` +
                                `ID: ${newCasino.id}\n` +
                                `Название: ${newCasino.name}\n` +
                                `Изменения сохранены на GitHub!`
                            );
                        } catch (githubError) {
                            console.error('GitHub error:', githubError);
                            bot.sendMessage(msg.chat.id,
                                `✅ Казино добавлено локально!\n` +
                                `❌ Ошибка GitHub: ${githubError.message}\n` +
                                `Нужно обновить файл вручную.`
                            );
                        }
                        
                    } catch (error) {
                        console.error('❌ Ошибка:', error);
                        bot.sendMessage(msg.chat.id, '❌ Ошибка при добавлении казино.');
                    }
                    
                } else {
                    bot.sendMessage(msg.chat.id, '❌ Добавление отменено.');
                }
                
                userStates.delete(userId);
                break;
        }
        
    } catch (error) {
        console.error('Ошибка в процессе добавления:', error);
        bot.sendMessage(msg.chat.id, '❌ Произошла ошибка. Процесс прерван.');
        userStates.delete(userId);
    }
});

// ===== WEB-СЕРВЕР =====
app.get('/', (req, res) => {
    res.send(`
        <h1>CasinoHub Bot Server</h1>
        <p>🤖 Бот работает! Токен: ${TOKEN ? 'установлен' : 'отсутствует'}</p>
        <p>👑 Админы: ${ADMINS.join(', ')}</p>
        <p>🌐 WebApp: <a href="${WEB_APP_URL}">${WEB_APP_URL}</a></p>
        <p>📊 Статус: <a href="/status">/status</a></p>
    `);
});

app.get('/status', (req, res) => {
    res.json(streamStatus);
});

app.get('/casino-data', async (req, res) => {
    try {
        const fs = require('fs').promises;
        const data = await fs.readFile('data_default.json', 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.json({ casinos: [], categories: [] });
    }
});

// ===== ЗАПУСК СЕРВЕРА =====
app.listen(PORT, () => {
    console.log('===================================');
    console.log('🚀 CasinoHub Bot Server запущен!');
    console.log('📞 Порт:', PORT);
    console.log('🤖 Токен установлен');
    console.log('👑 Админы:', ADMINS.join(', '));
    console.log('🔗 GitHub API: настроен');
    console.log('===================================');
});

// Принудительный перезапуск polling при старте
setTimeout(() => {
    bot.stopPolling().then(() => {
        console.log('🔄 Перезапускаем polling...');
        bot.startPolling();
        console.log('✅ Polling запущен');
    }).catch(error => {
        console.log('❌ Ошибка перезапуска polling:', error);
        bot.startPolling();
    });
}, 2000);

