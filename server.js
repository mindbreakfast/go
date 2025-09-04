const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ==== НАСТРОЙКИ ====
const TOKEN = process.env.BOT_TOKEN || 'ВАШ_НОВЫЙ_ТОКЕН';
const ADMINS = [1777213824, 594143385, 1097210873];
const WEB_APP_URL = 'https://gogo-kohl-beta.vercel.app';
// ===================

// Разрешаем CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    next();
});

app.options('*', (req, res) => {
    res.sendStatus(200);
});

// Создаем бота с правильными настройками polling
const bot = new TelegramBot(TOKEN, {
    polling: {
        interval: 300,
        timeout: 10,
        limit: 100,
        params: {
            timeout: 10,
            allowed_updates: ['message', 'callback_query']
        }
    }
});

// ===== ХРАНЕНИЕ ДАННЫХ =====
let streamStatus = {
    isStreamLive: false,
    streamUrl: '',
    eventDescription: '',
    lastUpdated: new Date().toISOString()
};

let announcements = [];
let userChats = new Set();

// ===== ОБРАБОТКА ОШИБОК POLLING =====
let pollingRestartAttempts = 0;
const MAX_POLLING_RESTARTS = 5;

bot.on('polling_error', (error) => {
    console.log('❌ Polling error:', error.code, error.message);
    
    if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
        console.log('🔄 Обнаружена ошибка 409 - перезапускаем polling...');
        
        if (pollingRestartAttempts < MAX_POLLING_RESTARTS) {
            pollingRestartAttempts++;
            
            setTimeout(() => {
                bot.stopPolling().then(() => {
                    console.log('✅ Старый polling остановлен');
                    setTimeout(() => {
                        bot.startPolling().then(() => {
                            console.log('✅ Новый polling запущен');
                        }).catch(pollError => {
                            console.log('❌ Ошибка запуска polling:', pollError);
                        });
                    }, 2000);
                }).catch(stopError => {
                    console.log('❌ Ошибка остановки polling:', stopError);
                });
            }, 3000);
        } else {
            console.log('❌ Достигнут лимит перезапусков polling');
        }
    }
});

bot.on('webhook_error', (error) => {
    console.log('❌ Webhook error:', error);
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

// ===== ФУНКЦИИ ДЛЯ АНОНСОВ =====
function addAnnouncement(text, type = 'info') {
    const newAnnouncement = {
        id: Date.now(),
        text: text,
        type: type,
        createdAt: new Date().toISOString()
    };
    
    announcements.push(newAnnouncement);
    console.log('✅ Анонс добавлен:', newAnnouncement);
    return true;
}

function clearAnnouncements() {
    announcements = [];
    console.log('✅ Все анонсы очищены');
    return true;
}

// ===== КОМАНДЫ БОТА =====

// Команда /start
bot.onText(/\/start/, (msg) => {
    console.log('✅ Получен /start от:', msg.from.id);
    userChats.add(msg.chat.id);
    
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
        .catch(error => console.log('❌ Ошибка отправки:', error));
});

// Команда /live
bot.onText(/\/live (.+) (.+)/, async (msg, match) => {
    console.log('✅ Получен /live от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const streamUrl = match[1];
    const eventDescription = match[2];
    
    const success = await updateStreamStatus(true, streamUrl, eventDescription);
    
    if (success) {
        for (const chatId of userChats) {
            try {
                await bot.sendMessage(chatId, `🔴 НАЧАЛСЯ СТРИМ!\n${eventDescription}\n${streamUrl}`);
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error('❌ Ошибка рассылки:', error);
            }
        }
    }
    
    bot.sendMessage(msg.chat.id, success ? 
        `✅ Стрим запущен!\nСсылка: ${streamUrl}\nОписание: ${eventDescription}` : 
        '❌ Ошибка обновления статуса'
    );
});

// Команда /stop
bot.onText(/\/stop/, async (msg) => {
    console.log('✅ Получен /stop от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const success = await updateStreamStatus(false, '', '');
    bot.sendMessage(msg.chat.id, success ? 
        '✅ Стрим остановлен' : 
        '❌ Ошибка обновления статуса'
    );
});

// Команда /announce
bot.onText(/\/announce (.+)/, (msg, match) => {
    console.log('✅ Получен /announce от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const text = match[1];
    const success = addAnnouncement(text);
    
    if (success) {
        for (const chatId of userChats) {
            try {
                bot.sendMessage(chatId, `📢 АНОНС:\n${text}`);
            } catch (error) {
                console.error('❌ Ошибка рассылки:', error);
            }
        }
    }
    
    bot.sendMessage(msg.chat.id, success ? 
        `✅ Анонс добавлен и разослан:\n${text}` : 
        '❌ Ошибка добавления анонса'
    );
});

// Команда /clear_announce
bot.onText(/\/clear_announce/, (msg) => {
    console.log('✅ Получен /clear_announce от:', msg.from.id);
    
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    const success = clearAnnouncements();
    bot.sendMessage(msg.chat.id, success ? 
        '✅ Все анонсы очищены' : 
        '❌ Ошибка очистки анонсов'
    );
});

// Команда /stats
bot.onText(/\/stats/, (msg) => {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав!');
    }
    
    bot.sendMessage(msg.chat.id,
        `📊 Статистика бота:\n` +
        `👥 Пользователей: ${userChats.size}\n` +
        `🎬 Стрим: ${streamStatus.isStreamLive ? 'В ЭФИРЕ' : 'не активен'}\n` +
        `📝 Анонсов: ${announcements.length}\n` +
        `🔄 Перезапусков: ${pollingRestartAttempts}\n` +
        `🕐 Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`
    );
});

// ===== WEB-СЕРВЕР И API =====
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Ludogolik Bot Server работает',
        users: userChats.size,
        stream_live: streamStatus.isStreamLive,
        polling_restarts: pollingRestartAttempts
    });
});

// API для статуса стрима
app.get('/status', (req, res) => {
    res.json(streamStatus);
});

// API для анонсов
app.get('/announcements', (req, res) => {
    res.json(announcements);
});

// ===== ЗАПУСК СЕРВЕРА =====
app.listen(PORT, () => {
    console.log('===================================');
    console.log('🚀 Ludogolik Bot Server запущен!');
    console.log('📞 Порт:', PORT);
    console.log('🤖 Токен установлен');
    console.log('👑 Админы:', ADMINS.join(', '));
    console.log('👥 Пользователей:', userChats.size);
    console.log('===================================');
    
    // Принудительный перезапуск polling через 3 секунды после старта
    setTimeout(() => {
        console.log('🔄 Принудительный перезапуск polling...');
        bot.stopPolling().then(() => {
            console.log('✅ Старый polling остановлен');
            setTimeout(() => {
                bot.startPolling().then(() => {
                    console.log('✅ Новый polling запущен');
                    pollingRestartAttempts = 0;
                }).catch(error => {
                    console.log('❌ Ошибка запуска polling:', error);
                });
            }, 2000);
        }).catch(error => {
            console.log('❌ Ошибка остановки polling:', error);
        });
    }, 3000);
});

// Обработка graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Останавливаем бота...');
    bot.stopPolling();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Останавливаем бота...');
    bot.stopPolling();
    process.exit(0);
});




