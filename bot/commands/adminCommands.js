const path = require('path');
const database = require(path.join(__dirname, '..', '..', 'database', 'database'));
const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));
const logger = require(path.join(__dirname, '..', '..', 'utils', 'logger'));

function handleStatsCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        const userChats = database.getUserChats();
        const casinos = database.getCasinos();
        const pendingApprovals = database.getPendingApprovals();
        const streamStatus = database.getStreamStatus();

        const message = `
📊 Статистика бота:

👥 Пользователей: ${userChats.size}
🎰 Казино: ${casinos.length} (${casinos.filter(c => c.isActive).length} активных)
⏳ Ожидают одобрения: ${pendingApprovals.length}
📡 Стрим: ${streamStatus.isStreamLive ? '🔴 В ЭФИРЕ' : '⚫ НЕ В ЭФИРЕ'}

💾 Память: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`;

        bot.sendMessage(msg.chat.id, message);
    } catch (error) {
        logger.error('Error in stats command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при получении статистики');
    }
}

function handleLiveCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        const url = match[1];
        const description = match[2] || 'Идет прямой эфир!';

        database.setStreamStatus({
            isStreamLive: true,
            streamUrl: url,
            eventDescription: description,
            lastUpdated: new Date().toISOString()
        });

        bot.sendMessage(msg.chat.id, `✅ Стрим запущен!\nСсылка: ${url}\nОписание: ${description}`);
    } catch (error) {
        logger.error('Error in live command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при запуске стрима');
    }
}

function handleStopCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        database.setStreamStatus({
            isStreamLive: false,
            streamUrl: '',
            eventDescription: '',
            lastUpdated: new Date().toISOString()
        });

        bot.sendMessage(msg.chat.id, '✅ Стрим остановлен!');
    } catch (error) {
        logger.error('Error in stop command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при остановке стрима');
    }
}

// ... (остальные функции adminCommands с аналогичными исправлениями)

module.exports = {
    handleStatsCommand,
    handleLiveCommand,
    handleStopCommand,
    // ... остальные экспорты
};
