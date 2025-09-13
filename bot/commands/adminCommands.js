const path = require('path');
const database = require(path.join(__dirname, '..', 'database', 'database'));
const { isAdmin } = require(path.join(__dirname, '..', 'utils', 'isAdmin'));
const logger = require(path.join(__dirname, '..', 'utils', 'logger'));

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

function handleTextCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        const text = match[1];
        const color = match[2] || 'blue';

        if (!text) {
            return bot.sendMessage(msg.chat.id, '❌ Формат: /text [сообщение] [цвет]\nЦвета: blue, green, red, yellow, purple');
        }

        const announcements = database.getAnnouncements();
        const newAnnouncement = {
            id: announcements.length + 1,
            text: text,
            color: color,
            createdAt: new Date().toISOString()
        };

        announcements.push(newAnnouncement);
        database.setAnnouncements(announcements);

        bot.sendMessage(msg.chat.id, `✅ Анонс добавлен!\nID: ${newAnnouncement.id}\nЦвет: ${color}`);
    } catch (error) {
        logger.error('Error in text command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при добавлении анонса');
    }
}

function handleClearTextCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        database.setAnnouncements([]);
        bot.sendMessage(msg.chat.id, '✅ Все анонсы очищены!');
    } catch (error) {
        logger.error('Error in clear text command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при очистке анонсов');
    }
}

function handleListTextCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        const announcements = database.getAnnouncements();
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

function handleRemoveTextCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        const id = parseInt(match[1]);
        const announcements = database.getAnnouncements();
        const index = announcements.findIndex(a => a.id === id);

        if (index === -1) {
            return bot.sendMessage(msg.chat.id, `❌ Анонс с ID ${id} не найден`);
        }

        const removed = announcements.splice(index, 1)[0];
        database.setAnnouncements(announcements);

        bot.sendMessage(msg.chat.id, `✅ Анонс удален!\nID: ${removed.id}\nТекст: ${removed.text}`);
    } catch (error) {
        logger.error('Error in remove text command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при удалении анонса');
    }
}

function handleBroadcastCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    bot.sendMessage(msg.chat.id, '📢 Функция рассылки в разработке');
}

function handleApproveCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        const userId = parseInt(match[1]);
        if (database.approveUserAccess(userId)) {
            bot.sendMessage(msg.chat.id, `✅ Пользователь ${userId} одобрен!`);
        } else {
            bot.sendMessage(msg.chat.id, '❌ Пользователь не найден или уже одобрен');
        }
    } catch (error) {
        logger.error('Error in approve command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при одобрении пользователя');
    }
}

function handleApprovalsCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        const pendingApprovals = database.getPendingApprovals();
        if (pendingApprovals.length === 0) {
            return bot.sendMessage(msg.chat.id, '✅ Нет ожидающих одобрения заявок');
        }

        const message = pendingApprovals.map((req, index) => 
            `${index + 1}. ID: ${req.userId} - @${req.requestedUsername || 'unknown'}\n   📅 ${new Date(req.requestedAt).toLocaleString()}`
        ).join('\n\n');

        bot.sendMessage(msg.chat.id, `⏳ Ожидающие одобрения (${pendingApprovals.length}):\n\n${message}`);
    } catch (error) {
        logger.error('Error in approvals command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при получении списка заявок');
    }
}

function handleCasinoStatsCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        const stats = database.getCasinoStats();
        if (stats.length === 0) {
            return bot.sendMessage(msg.chat.id, '📊 Нет данных по статистике казино');
        }

        const message = stats.slice(0, 10).map((casino, index) => 
            `${index + 1}. ${casino.name}\n   👆 ${casino.clicks} кликов | 👻 ${casino.hides} скрытий ${casino.isPinned ? '📌' : ''}`
        ).join('\n\n');

        bot.sendMessage(msg.chat.id, `📊 Топ казино по кликам:\n\n${message}`);
    } catch (error) {
        logger.error('Error in casino stats command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при получении статистики казино');
    }
}

function handleVoiceAuditCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        const logs = database.getVoiceAccessLogs(20);
        if (logs.length === 0) {
            return bot.sendMessage(msg.chat.id, '🎙️ Нет данных о доступах к голосовым комнатам');
        }

        const message = logs.map((log, index) => 
            `${index + 1}. User#${log.userId} (${log.username})\n   🎚️ ${log.roomType} | 📅 ${new Date(log.timestamp).toLocaleString()}`
        ).join('\n\n');

        bot.sendMessage(msg.chat.id, `🎙️ Последние доступы к голосовым:\n\n${message}`);
    } catch (error) {
        logger.error('Error in voice audit command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при получении логов голосовых комнат');
    }
}

module.exports = {
    handleStatsCommand,
    handleLiveCommand,
    handleStopCommand,
    handleTextCommand,
    handleClearTextCommand,
    handleListTextCommand,
    handleRemoveTextCommand,
    handleBroadcastCommand,
    handleApproveCommand,
    handleApprovalsCommand,
    handleCasinoStatsCommand,
    handleVoiceAuditCommand
};
