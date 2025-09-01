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

// Команда /add - добавление казино через бота
bot.onText(/\/add (.+)/, async (msg, match) => {
    console.log('Получен /add от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    try {
        const params = match[1].split('|').map(param => param.trim());
        
        if (params.length < 6) {
            return bot.sendMessage(msg.chat.id, 
                '❌ Неправильный формат!\n' +
                'Используйте: /add name|promocode|promoDescription|url|category|hiddenKeywords\n' +
                'Пример: /add NewCasino|WELCOME200|200% бонус|https://casino.com|popular|новое,казино'
            );
        }
        
        const [name, promocode, promoDescription, url, category, hiddenKeywords] = params;
        
        // Читаем текущие данные
        const fs = require('fs').promises;
        const data = await fs.readFile('data_default.json', 'utf8');
        const jsonData = JSON.parse(data);
        
        // Создаем новое казино
        const newCasino = {
            id: Math.max(...jsonData.casinos.map(c => c.id)) + 1,
            name: name,
            promocode: promocode,
            promoDescription: promoDescription,
            description: "Добавлено через бота",
            url: url,
            registeredUrl: url.replace('ref=', ''),
            showRegisteredButton: true,
            hiddenKeywords: hiddenKeywords.split(',').map(kw => kw.trim()),
            category: category,
            isActive: true
        };
        
        // Добавляем в массив
        jsonData.casinos.push(newCasino);
        
        // Сохраняем обратно
        await fs.writeFile('data_default.json', JSON.stringify(jsonData, null, 2));
        
        bot.sendMessage(msg.chat.id, 
            `✅ Казино добавлено!\n` +
            `🎰 Name: ${name}\n` +
            `🎯 Promo: ${promocode}\n` +
            `🏷️ Category: ${category}`
        );
        
    } catch (error) {
        console.error('Ошибка добавления казино:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при добавлении казино: ' + error.message);
    }
});


// Команда /remove - удаление казино через бота
// Команда /remove - удаление/скрытие казино
bot.onText(/\/remove (\d+)/, async (msg, match) => {
    console.log('Получен /remove от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    try {
        const casinoId = parseInt(match[1]);
        
        // Читаем текущие данные
        const fs = require('fs').promises;
        const data = await fs.readFile('data_default.json', 'utf8');
        const jsonData = JSON.parse(data);
        
        // Находим казино
        const casinoIndex = jsonData.casinos.findIndex(c => c.id === casinoId);
        
        if (casinoIndex === -1) {
            return bot.sendMessage(msg.chat.id, '❌ Казино с таким ID не найдено');
        }
        
        // Удаляем или деактивируем
        const casinoName = jsonData.casinos[casinoIndex].name;
        jsonData.casinos.splice(casinoIndex, 1); // Полное удаление
        // Или: jsonData.casinos[casinoIndex].isActive = false; // Скрытие
        
        // Сохраняем обратно
        await fs.writeFile('data_default.json', JSON.stringify(jsonData, null, 2));
        
        bot.sendMessage(msg.chat.id, 
            `✅ Казино удалено!\n` +
            `🎰 Name: ${casinoName}\n` +
            `🗑️ ID: ${casinoId}`
        );
        
    } catch (error) {
        console.error('Ошибка удаления казино:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при удалении казино: ' + error.message);
    }
});

// Команда /list - список всех казино
bot.onText(/\/list/, async (msg) => {
    console.log('Получен /list от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    try {
        const fs = require('fs').promises;
        const data = await fs.readFile('data_default.json', 'utf8');
        const jsonData = JSON.parse(data);
        
        const casinoList = jsonData.casinos.map(c => 
            `${c.id}: ${c.name} (${c.promocode}) - ${c.category}`
        ).join('\n');
        
        bot.sendMessage(msg.chat.id, 
            `📋 Список казино (${jsonData.casinos.length}):\n\n${casinoList}`
        );
        
    } catch (error) {
        console.error('Ошибка получения списка:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при получении списка казино');
    }
});


// Веб-сервер
app.get('/', (req, res) => {
    res.send('CasinoHub Bot Server is running!');
});

// Endpoint для проверки статуса
app.get('/status', (req, res) => {
    res.json(streamStatus);
});

// Endpoint для получения данных казино
app.get('/casino-data', async (req, res) => {
    try {
        const fs = require('fs').promises;
        const data = await fs.readFile('data_default.json', 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.json({ casinos: [], categories: [] });
    }
});

// Endpoint для debug
app.get('/debug-status', (req, res) => {
    res.json({
        status: streamStatus,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
    });
});

// Запускаем сервер
app.listen(PORT, () => {
    console.log('===================================');
    console.log('🚀 CasinoHub Bot Server запущен!');
    console.log('📞 Порт:', PORT);
    console.log('🤖 Токен установлен:', TOKEN ? '✅' : '❌');
    console.log('👑 Админы:', ADMINS.join(', '));
    console.log('🌐 WebApp URL:', WEB_APP_URL);
    console.log('💾 Статус хранится в памяти');
    console.log('===================================');
    
    // Проверяем подключение к Telegram API
    bot.getMe().then(botInfo => {
        console.log('✅ Бот успешно подключен к Telegram API');
        console.log('🤖 Username бота:', botInfo.username);
    }).catch(error => {
        console.log('❌ Ошибка подключения к Telegram API:', error.message);
    });
});



