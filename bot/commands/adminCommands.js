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

function handleTextCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    bot.sendMessage(msg.chat.id, '📝 Функция работы с текстами в разработке');
}

function handleClearTextCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    bot.sendMessage(msg.chat.id, '🧹 Функция очистки текстов в разработке');
}

function handleListTextCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    bot.sendMessage(msg.chat.id, '📋 Функция списка текстов в разработке');
}

function handleRemoveTextCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }
    bot.sendMessage(msg.chat.id, '🗑️ Функция удаления текстов в разработке');
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
