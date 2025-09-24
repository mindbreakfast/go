const path = require('path');
const database = require(path.join(__dirname, '..', '..', 'database', 'database'));
const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));
const logger = require(path.join(__dirname, '..', '..', 'utils', 'logger'));

function handleClearTextCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        // 🔥 ПРАВИЛЬНЫЙ ВЫЗОВ - через свойство класса
        database.announcements = [];
        database.saveContentData().then(success => {
            if (success) {
                logger.info('All announcements cleared by admin', { userId: msg.from.id });
                bot.sendMessage(msg.chat.id, '✅ Все анонсы очищены!');
            } else {
                logger.error('Failed to clear announcements');
                bot.sendMessage(msg.chat.id, '❌ Ошибка при очистке анонсов');
            }
        });
    } catch (error) {
        logger.error('Error in clear text command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при очистке анонсов');
    }
}

function handleDeleteTextCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        const id = parseInt(match[1]);
        const announcements = database.announcements;
        const index = announcements.findIndex(a => a.id === id);

        if (index === -1) {
            return bot.sendMessage(msg.chat.id, `❌ Анонс с ID ${id} не найден`);
        }

        const removed = announcements.splice(index, 1)[0];
        
        database.saveContentData().then(success => {
            if (success) {
                bot.sendMessage(msg.chat.id, `✅ Анонс удален!\nID: ${removed.id}\nТекст: ${removed.text}`);
            } else {
                bot.sendMessage(msg.chat.id, '❌ Ошибка при удалении анонса');
            }
        });
    } catch (error) {
        logger.error('Error in delete text command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при удалении анонса');
    }
}

function handleListTextCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        const announcements = database.announcements;
        if (announcements.length === 0) {
            return bot.sendMessage(msg.chat.id, '📝 Список анонсов пуст');
        }

        const message = announcements.map(ann => 
            `ID: ${ann.id}\nТекст: ${ann.text}\nЦвет: ${ann.color}\nДата: ${new Date(ann.createdAt).toLocaleString()}\n──────────────────`
        ).join('\n\n');

        bot.sendMessage(msg.chat.id, `📝 Список анонсов (${announcements.length}):\n\n${message}`);
    } catch (error) {
        logger.error('Error in list text command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при получении списка анонсов');
    }
}

module.exports = {
    handleClearTextCommand,
    handleDeleteTextCommand,
    handleListTextCommand
};
