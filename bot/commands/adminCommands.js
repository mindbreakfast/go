console.log('✅ adminCommands loaded');
const config = require('../../config');
const database = require('../../database/database');
const { isAdmin } = require('../../utils/isAdmin'); // Импорт из утилит

// Убираем локальную функцию isAdmin, используем импортированную

function handleStatsCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const userChats = database.getUserChats();
    const streamStatus = database.getStreamStatus();
    const announcements = database.getAnnouncements();
    const casinos = database.getCasinos();

    bot.sendMessage(msg.chat.id,
        `Статистика бота:\n` +
        `Пользователей: ${userChats.size}\n` +
        `Стрим: ${streamStatus.isStreamLive ? 'В ЭФИРЕ' : 'не активен'}\n` +
        `Анонсов: ${announcements.length}\n` +
        `Казино: ${casinos.length}\n` +
        `Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`
    );
}

// ... остальные функции без изменений ...

module.exports = {
    isAdmin, // экспортируем
    handleStatsCommand,
    handleLiveCommand,
    handleStopCommand,
    handleTextCommand,
    handleClearTextCommand,
    handleListTextCommand,
    handleRemoveTextCommand,
    handleBroadcastCommand,
    handleApproveCommand,
    handleApprovalsCommand
};
