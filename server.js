const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== КОНФИГУРАЦИЯ =====
const TOKEN = '8368808338:AAF25l680ekIKpzQyvDj9pKc2zByrJx9dII'; // ЗАМЕНИТЕ НА РЕАЛЬНЫЙ ТОКЕН!
const WEB_APP_URL = 'https://gogo-kohl-beta.vercel.app'; // ЗАМЕНИТЕ НА ВАШ URL

// ID администраторов (узнать свой ID через @userinfobot)
const ADMINS = [1777213824]; // ЗАМЕНИТЕ НА РЕАЛЬНЫЕ ID

const bot = new TelegramBot(TOKEN, { 
    polling: true,
    onlyFirstMatch: true,
    request: { timeout: 60000 }
});

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function isAdmin(userId) {
    return ADMINS.includes(Number(userId));
}

function logMessage(msg, command = '') {
    console.log(`[${new Date().toLocaleTimeString()}] ${msg.from.first_name} (${msg.from.id}): ${command || msg.text}`);
}

async function updateStreamStatus(isLive, streamUrl = '') {
    try {
        const statusData = {
            isStreamLive: isLive,
            streamUrl: streamUrl,
            lastUpdated: new Date().toISOString()
        };
        
        await fs.writeFile(
            path.join(__dirname, 'public', 'stream_status_default.json'),
            JSON.stringify(statusData, null, 2)
        );
        
        console.log('Статус стрима обновлен:', statusData);
        return true;
    } catch (error) {
        console.error('Ошибка обновления статуса стрима:', error);
        return false;
    }
}

// ===== ОБРАБОТЧИКИ КОМАНД =====

// Команда /start - для всех пользователей
bot.onText(/\/start/, (msg) => {
    logMessage(msg, '/start');
    
    const chatId = msg.chat.id;
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
    
    const welcomeText = `Добро пожаловать! 

🎯 Здесь вы найдете актуальные списки казино с рабочими промокодами.

📋 Чтобы открыть список, нажмите кнопку ниже 👇`;

    bot.sendMessage(chatId, welcomeText, keyboard)
        .catch(error => console.error('Ошибка отправки сообщения:', error));
});

// Команда /help - для всех пользователей
bot.onText(/\/help/, (msg) => {
    logMessage(msg, '/help');
    
    const helpText = `📖 Доступные команды:

/start - Запустить бота и открыть список
/help - Получить справку

⚙️ Команды для администратора:
/live [ссылка] - Начать трансляцию
/stop - Завершить трансляцию
/add - Добавить новое казино`;

    bot.sendMessage(msg.chat.id, helpText);
});

// Команда /live - только для админов
bot.onText(/\/live (.+)/, async (msg, match) => {
    logMessage(msg, '/live');
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const streamUrl = match[1].trim();

    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '❌ Эта команда доступна только администраторам!');
    }

    try {
        const success = await updateStreamStatus(true, streamUrl);
        
        if (success) {
            const responseText = `✅ Стрим запущен!
            
Ссылка: ${streamUrl}

Баннер будет отображаться в приложении до команды /stop`;
            
            bot.sendMessage(chatId, responseText);
        } else {
            throw new Error('Ошибка записи файла');
        }
    } catch (error) {
        console.error('Ошибка команды /live:', error);
        bot.sendMessage(chatId, '❌ Не удалось запустить трансляцию. Проверьте логи.');
    }
});

// Команда /stop - только для админов
bot.onText(/\/stop/, async (msg) => {
    logMessage(msg, '/stop');
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '❌ Эта команда доступна только администраторам!');
    }

    try {
        const success = await updateStreamStatus(false);
        
        if (success) {
            bot.sendMessage(chatId, '✅ Трансляция завершена. Баннер скрыт.');
        } else {
            throw new Error('Ошибка записи файла');
        }
    } catch (error) {
        console.error('Ошибка команды /stop:', error);
        bot.sendMessage(chatId, '❌ Не удалось завершить трансляцию.');
    }
});

// Команда /add - только для админов (упрощенная версия)
bot.onText(/\/add/, (msg) => {
    logMessage(msg, '/add');
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '❌ Эта команда доступна только администраторам!');
    }

    const instructions = `📝 Чтобы добавить казино:

1. Откройте файл data_default.json
2. Добавьте новый объект в массив casinos
3. Сохраните файл

Пример структуры:
{
  "id": 3,
  "name": "Новое казино",
  "promocode": "PROMO123",
  "promoDescription": "Описание бонуса",
  "url": "https://casino.com",
  "showRegisteredButton": true,
  "hiddenKeywords": ["ключевые", "слова"],
  "category": "crypto"
}

В будущих версиях будет реализовано добавление через бота.`;

    bot.sendMessage(chatId, instructions);
});

// Обработка обычных сообщений
bot.on('message', (msg) => {
    if (msg.text && !msg.text.startsWith('/')) {
        logMessage(msg);
        
        // Простой echo для теста
        if (msg.text.toLowerCase() === 'привет') {
            bot.sendMessage(msg.chat.id, 'Привет! Напишите /help для списка команд');
        }
    }
});

// ===== ОБРАБОТКА ОШИБОК =====
bot.on('error', (error) => {
    console.error('Ошибка бота:', error);
});

bot.on('polling_error', (error) => {
    console.error('Ошибка polling:', error);
});

// ===== WEB-СЕРVER =====
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.send(`
        <html>
            <body>
                <h1>CasinoHub Bot Server</h1>
                <p>Бот работает! Используйте Telegram для взаимодействия.</p>
                <p>Токен: ${TOKEN ? 'установлен' : 'отсутствует'}</p>
                <p>Админы: ${ADMINS.join(', ')}</p>
            </body>
        </html>
    `);
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`
🚀 Сервер запущен на порту ${PORT}
🤖 Бот инициализирован с токеном: ${TOKEN ? 'YES' : 'NO'}
👑 Администраторы: ${ADMINS.join(', ')}
🌐 WebApp URL: ${WEB_APP_URL}
    `);
    
    if (!TOKEN || TOKEN.includes('ВАШ_ТОКЕН')) {
        console.error('❌ ОШИБКА: Токен бота не установлен!');
    }
    
    if (ADMINS.length === 0 || ADMINS[0] === 123456789) {
        console.error('❌ ОШИБКА: ID администраторов не настроены!');
    }
});
