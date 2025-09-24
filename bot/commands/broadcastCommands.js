const path = require('path');
const database = require(path.join(__dirname, '..', '..', 'database', 'database'));
const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));
const logger = require(path.join(__dirname, '..', '..', 'utils', 'logger'));

async function handleBroadcastCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        const messageText = match[1];
        if (!messageText) {
            return bot.sendMessage(msg.chat.id, '❌ Формат: /vsem [сообщение]');
        }

        const userChats = database.getUserChats();
        const totalUsers = userChats.size;
        let sentCount = 0;
        let failedCount = 0;

        // 🔥 ОТПРАВЛЯЕМ СООБЩЕНИЕ БЕЗ ПРЕФИКСА "Объявление:"
        const broadcastMessage = messageText;

        bot.sendMessage(msg.chat.id, `📢 Рассылка начата...\nПолучателей: ${totalUsers}`);

        // Отправляем сообщения с задержкой чтобы не превысить лимиты Telegram
        for (const [userId, userData] of userChats.entries()) {
            try {
                await bot.sendMessage(userId, broadcastMessage);
                sentCount++;
                
                // Задержка 100ms между сообщениями
                if (sentCount % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                // Обновляем прогресс каждые 20 сообщений
                if (sentCount % 20 === 0) {
                    bot.sendMessage(msg.chat.id, 
                        `📊 Прогресс: ${sentCount}/${totalUsers} отправлено`
                    ).catch(e => console.log('Progress update failed'));
                }
                
            } catch (error) {
                failedCount++;
                logger.warn('Failed to send broadcast to user', { 
                    userId, 
                    error: error.message 
                });
                
                // Если пользователь заблокировал бота, удаляем его из списка
                if (error.response?.statusCode === 403) {
                    userChats.delete(userId);
                }
            }
        }

        // Сохраняем обновленные данные пользователей
        await database.saveUserData();

        const resultMessage = `
✅ Рассылка завершена!
📊 Статистика:
👥 Всего получателей: ${totalUsers}
✅ Успешно отправлено: ${sentCount}
❌ Не удалось отправить: ${failedCount}
${failedCount > 0 ? '\n⚠️ Пользователи, заблокировавшие бота, удалены из списка' : ''}
        `.trim();

        bot.sendMessage(msg.chat.id, resultMessage);

    } catch (error) {
        logger.error('Error in broadcast command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при выполнении рассылки');
    }
}

module.exports = {
    handleBroadcastCommand
};
