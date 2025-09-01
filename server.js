const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

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

// Создаем бота с новым токеном
const bot = new TelegramBot(TOKEN, { 
    polling: {
        interval: 300,
        timeout: 10,
        limit: 100
    }
});

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
            
            // Диагностика: проверяем доступ к файлам
            try {
                const files = await fs.readdir('.');
                console.log('📁 Файлы в директории:', files);
            } catch (dirError) {
                console.log('❌ Ошибка чтения директории:', dirError.message);
            }
            
            // Пробуем прочитать файл
            const data = await fs.readFile('data_default.json', 'utf8');
            const jsonData = JSON.parse(data);
            console.log('✅ Файл прочитан, казино в базе:', jsonData.casinos.length);
            
            // Создаем новое казино
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
            
            // Добавляем в массив
            jsonData.casinos.push(newCasino);
            console.log('🆕 Новое казино подготовлено:', newCasino.name);
            
            // Пробуем записать файл
            await fs.writeFile('data_default.json', JSON.stringify(jsonData, null, 2));
            console.log('💾 Файл успешно записан');
            
            // Пробуем прочитать обратно для проверки
            const verifyData = await fs.readFile('data_default.json', 'utf8');
            const verifyJson = JSON.parse(verifyData);
            console.log('✅ Проверка: казино после записи:', verifyJson.casinos.length);
            
            bot.sendMessage(msg.chat.id,
                `✅ Казино успешно добавлено!\n` +
                `ID: ${newCasino.id}\n` +
                `Название: ${newCasino.name}\n` +
                `Изменения появятся при следующей загрузке приложения.`
            );
            
        } catch (fileError) {
            console.error('❌ Ошибка работы с файлом:', fileError);
            bot.sendMessage(msg.chat.id,
                `❌ Ошибка при сохранении: ${fileError.message}\n` +
                `Данные остались без изменений.`
            );
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

// Команда для диагностики файловой системы
bot.onText(/\/debug_fs/, async (msg) => {
    if (!isAdmin(msg.from.id)) return;
    
    try {
        const fs = require('fs').promises;
        
        const files = await fs.readdir('.');
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        let fileInfo = [];
        for (const file of jsonFiles) {
            try {
                const stats = await fs.stat(file);
                const content = await fs.readFile(file, 'utf8');
                fileInfo.push({
                    name: file,
                    size: stats.size,
                    lines: content.split('\n').length
                });
            } catch (e) {
                fileInfo.push({ name: file, error: e.message });
            }
        }
        
        bot.sendMessage(msg.chat.id,
            `📁 Файловая система:\n` +
            `Файлы: ${files.join(', ')}\n` +
            `JSON файлы: ${JSON.stringify(fileInfo, null, 2)}`
        );
        
    } catch (error) {
        bot.sendMessage(msg.chat.id, `❌ Ошибка диагностики: ${error.message}`);
    }
});


// ===== WEB-СЕРВЕР ДЛЯ RENDER =====
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


