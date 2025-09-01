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

const bot = new TelegramBot(TOKEN, { 
    polling: {
        interval: 300,
        timeout: 10,
        limit: 100
    }
});


// Добавьте обработчик ошибок polling
bot.on('polling_error', (error) => {
    console.log('Polling error:', error.code);
    
    if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
        console.log('Обнаружена ошибка 409, перезапускаем polling через 5 секунд...');
        setTimeout(() => {
            bot.stopPolling();
            bot.startPolling();
        }, 5000);
    }
});

// Принудительно закрываем предыдущие соединения при запуске
bot.stopPolling().then(() => {
    console.log('Предыдущие соединения закрыты');
    setTimeout(() => {
        bot.startPolling();
        console.log('Polling перезапущен');
    }, 3000);
}).catch(() => {
    bot.startPolling();
});



// Храним статус в памяти вместо файла
let streamStatus = {
    isStreamLive: false,
    streamUrl: '',
    eventDescription: '',
    lastUpdated: new Date().toISOString()
};

// Проверка прав
function isAdmin(userId) {
    return ADMINS.includes(Number(userId));
}

// Функция обновления статуса стрима (в памяти)
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

// Команда /live - теперь с описанием
bot.onText(/\/live (.+) (.+)/, async (msg, match) => {
    console.log('Получен /live от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const streamUrl = match[1]; // Первый параметр - ссылка
    const eventDescription = match[2]; // Второй параметр - описание
    
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

// ===== СИСТЕМА МНОГОШАГОВОГО ДОБАВЛЕНИЯ КАЗИНО =====
const userStates = new Map();

// Шаги добавления казино
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

// Команда /add - начало диалога
bot.onText(/\/add/, (msg) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }

    // Начинаем новый процесс добавления
    userStates.set(msg.from.id, {
        step: ADD_CASINO_STEPS.NAME,
        newCasino: {}
    });

    bot.sendMessage(msg.chat.id, 
        '🎰 Начинаем добавление нового казино!\n\n' +
        'Введите название казино:'
    );
});

// Обработчик текстовых сообщений (для многошагового диалога)
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
                
                // Получаем список категорий для подсказки
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
                
                // Показываем summary для подтверждения
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
                    // Сохраняем казино в файл
                    const fs = require('fs').promises;
                    const data = await fs.readFile('data_default.json', 'utf8');
                    const jsonData = JSON.parse(data);
                    
                    // Создаем полный объект казино
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
                    
                    // Добавляем и сохраняем
                    jsonData.casinos.push(newCasino);
                    await fs.writeFile('data_default.json', JSON.stringify(jsonData, null, 2));
                    
                    bot.sendMessage(msg.chat.id,
                        `✅ Казино успешно добавлено!\n` +
                        `ID: ${newCasino.id}\n` +
                        `Изменения появятся при следующей загрузке приложения.`
                    );
                    
                } else {
                    bot.sendMessage(msg.chat.id, '❌ Добавление отменено.');
                }
                
                // Очищаем состояние
                userStates.delete(userId);
                break;
        }
        
    } catch (error) {
        console.error('Ошибка в процессе добавления:', error);
        bot.sendMessage(msg.chat.id, '❌ Произошла ошибка. Процесс прерван.');
        userStates.delete(userId);
    }
});

// Команда /cancel для отмены процесса
bot.onText(/\/cancel/, (msg) => {
    if (userStates.has(msg.from.id)) {
        userStates.delete(msg.from.id);
        bot.sendMessage(msg.chat.id, '✅ Текущая операция отменена.');
    }
});

