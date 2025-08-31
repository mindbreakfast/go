const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Замените на ваш реальный токен!
const TOKEN = '8368808338:AAF25l680ekIKpzQyvDj9pKc2zByrJx9dII';
const bot = new TelegramBot(TOKEN, {polling: true});

// Простейшая команда для теста
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  console.log('Получено сообщение:', msg.text);
  
  if (msg.text === '/start') {
    const keyboard = {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🎰 ОТКРЫТЬ СПИСОК КАЗИНО',
            web_app: {url: 'https://gogo-kohl-beta.vercel.app'}
          }
        ]]
      }
    };
    
    bot.sendMessage(chatId, 'Привет! Нажми кнопку ниже:', keyboard)
      .then(() => console.log('Сообщение отправлено'))
      .catch(error => console.error('Ошибка отправки:', error));
  }
});

// Просто чтобы сервер не умирал
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log('Bot is waiting for messages...');

});

