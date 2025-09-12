const path = require('path');
const config = require(path.join(__dirname, '..', '..', 'config'));
const database = require(path.join(__dirname, '..', '..', 'database', 'database'));
const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));
const logger = require('../../utils/logger');

function handleStatsCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        logger.warn('Unauthorized stats command attempt', { userId: msg.from.id });
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const userChats = database.getUserChats();
    const streamStatus = database.getStreamStatus();
    const announcements = database.getAnnouncements();
    const casinos = database.getCasinos();
    const pendingApprovals = database.getPendingApprovals();

    const statsMessage = `
Статистика бота:
Пользователей: ${userChats.size}
Стрим: ${streamStatus.isStreamLive ? 'В ЭФИРЕ' : 'не активен'}
Анонсов: ${announcements.length}
Казино: ${casinos.length}
Ожидают одобрения: ${pendingApprovals.length}
Обновлено: ${new Date().toLocaleTimeString('ru-RU')}
    `.trim();

    logger.info('Stats command executed', {
        userId: msg.from.id,
        users: userChats.size,
        casinos: casinos.length
    });

    bot.sendMessage(msg.chat.id, statsMessage);
}

function handleLiveCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        logger.warn('Unauthorized live command attempt', { userId: msg.from.id });
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const streamUrl = match[1];
    const eventDescription = match[2];

    database.setStreamStatus({
        isStreamLive: true,
        streamUrl: streamUrl,
        eventDescription: eventDescription,
        lastUpdated: new Date().toISOString()
    });

    database.saveContentData().then(success => {
        if (success) {
            logger.info('Stream started', { streamUrl, eventDescription });
            bot.sendMessage(msg.chat.id, 
                `✅ Стрим запущен!\nСсылка: ${streamUrl}\nОписание: ${eventDescription}`
            );
        } else {
            logger.error('Failed to start stream');
            bot.sendMessage(msg.chat.id, '❌ Ошибка обновления статуса стрима');
        }
    });
}

function handleStopCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        logger.warn('Unauthorized stop command attempt', { userId: msg.from.id });
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    database.setStreamStatus({
        isStreamLive: false,
        streamUrl: '',
        eventDescription: '',
        lastUpdated: new Date().toISOString()
    });

    database.saveContentData().then(success => {
        if (success) {
            logger.info('Stream stopped');
            bot.sendMessage(msg.chat.id, '✅ Стрим остановлен');
        } else {
            logger.error('Failed to stop stream');
            bot.sendMessage(msg.chat.id, '❌ Ошибка остановки стрима');
        }
    });
}

function handleTextCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        logger.warn('Unauthorized text command attempt', { userId: msg.from.id });
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    let text = match[1];
    let color = 'blue';

    const colorMatch = text.match(/цвет:(\w+)\s+/i);
    if (colorMatch) {
        color = colorMatch[1];
        text = text.replace(colorMatch[0], '');
    }

    const announcements = database.getAnnouncements();
    const newAnnouncement = {
        id: Date.now(),
        text: text,
        color: color,
        createdAt: new Date().toISOString()
    };
    announcements.push(newAnnouncement);
    database.setAnnouncements(announcements);

    database.saveContentData().then(success => {
        if (success) {
            logger.info('Announcement added', { id: newAnnouncement.id, color, length: text.length });
            bot.sendMessage(msg.chat.id,
                `✅ Анонс добавлен!\nID: ${newAnnouncement.id}\nЦвет: ${color}\nТекст: ${text}`
            );
        } else {
            logger.error('Failed to add announcement');
            bot.sendMessage(msg.chat.id, '❌ Ошибка сохранения анонса');
        }
    });
}

function handleClearTextCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        logger.warn('Unauthorized cleartext command attempt', { userId: msg.from.id });
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    database.setAnnouncements([]);
    
    database.saveContentData().then(success => {
        if (success) {
            logger.info('All announcements cleared');
            bot.sendMessage(msg.chat.id, '✅ Все анонсы очищены!');
        } else {
            logger.error('Failed to clear announcements');
            bot.sendMessage(msg.chat.id, '❌ Ошибка очистки анонсов');
        }
    });
}

function handleListTextCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        logger.warn('Unauthorized listtext command attempt', { userId: msg.from.id });
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const announcements = database.getAnnouncements();
    if (announcements.length === 0) {
        logger.info('List text command - no announcements');
        return bot.sendMessage(msg.chat.id, '📝 Список анонсов пуст');
    }

    const announcementList = announcements.map(a =>
        `ID: ${a.id}\nЦвет: ${a.color}\nТекст: ${a.text}\nДата: ${new Date(a.createdAt).toLocaleString('ru-RU')}\n──────────────────`
    ).join('\n');

    logger.info('List text command executed', { count: announcements.length });
    bot.sendMessage(msg.chat.id,
        `Список анонсов (${announcements.length}):\n\n${announcementList}`
    );
}

function handleRemoveTextCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        logger.warn('Unauthorized removetext command attempt', { userId: msg.from.id });
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const id = parseInt(match[1]);
    const announcements = database.getAnnouncements();
    const index = announcements.findIndex(a => a.id === id);

    if (index !== -1) {
        const removed = announcements.splice(index, 1)[0];
        database.setAnnouncements(announcements);
        
        database.saveContentData().then(success => {
            if (success) {
                logger.info('Announcement removed', { id, text: removed.text });
                bot.sendMessage(msg.chat.id,
                    `✅ Анонс удален!\nID: ${id}\nТекст: ${removed.text}`
                );
            } else {
                logger.error('Failed to remove announcement', { id });
                bot.sendMessage(msg.chat.id, '❌ Ошибка удаления анонса');
            }
        });
    } else {
        logger.warn('Announcement not found for removal', { id });
        bot.sendMessage(msg.chat.id, `❌ Анонс с ID ${id} не найден`);
    }
}

async function handleBroadcastCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        logger.warn('Unauthorized broadcast command attempt', { userId: msg.from.id });
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const message = match[1];
    const userChats = database.getUserChats();
    let successCount = 0;
    let errorCount = 0;

    logger.info('Starting broadcast', { users: userChats.size, messageLength: message.length });
    bot.sendMessage(msg.chat.id, `📤 Начинаю рассылку для ${userChats.size} пользователей...`);

    for (const [userId] of userChats) {
        try {
            await bot.sendMessage(userId, message);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            errorCount++;
            logger.debug('Broadcast failed for user', { userId, error: error.message });
        }
    }

    logger.info('Broadcast completed', { success: successCount, errors: errorCount });
    bot.sendMessage(msg.from.id,
        `✅ Рассылка завершена!\n✓ Доставлено: ${successCount}\n✗ Ошибок: ${errorCount}`
    );
}

function handleApproveCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        logger.warn('Unauthorized approve command attempt', { userId: msg.from.id });
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const userId = parseInt(match[1]);
    const success = database.approveUserAccess(userId);
    
    if (success) {
        logger.info('User approved', { userId });
        bot.sendMessage(msg.chat.id, `✅ Пользователь ${userId} одобрен для доступа к лайв комнате!`);
        
        // Уведомляем пользователя
        try {
            bot.sendMessage(userId, '🎉 Ваш доступ к приватной лайв комнате одобрен! Обновите приложение.');
        } catch (error) {
            logger.warn('Cannot notify approved user', { userId, error: error.message });
        }
    } else {
        logger.warn('Failed to approve user', { userId });
        bot.sendMessage(msg.chat.id, `❌ Не удалось одобрить пользователя ${userId}`);
    }
}

function handleApprovalsCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        logger.warn('Unauthorized approvals command attempt', { userId: msg.from.id });
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const pending = database.getPendingApprovals();
    if (pending.length === 0) {
        logger.info('Approvals command - no pending requests');
        return bot.sendMessage(msg.chat.id, '📝 Запросов на одобрение нет');
    }

    const approvalList = pending.map(req => 
        `ID: ${req.userId}\nUsername: @${req.requestedUsername}\nЗапросил: ${new Date(req.requestedAt).toLocaleString('ru-RU')}\n/odobri_${req.userId}`
    ).join('\n\n');

    logger.info('Approvals command executed', { count: pending.length });
    bot.sendMessage(msg.chat.id,
        `Запросы на одобрение (${pending.length}):\n\n${approvalList}`
    );
}

// 📊 НОВАЯ КОМАНДА: Статистика казино
function handleCasinoStatsCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        logger.warn('Unauthorized casino stats command attempt', { userId: msg.from.id });
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const stats = database.getCasinoStats();
    
    if (stats.length === 0) {
        return bot.sendMessage(msg.chat.id, '📊 Статистика казино пуста');
    }

    // Разбиваем на части из-за ограничения Telegram
    const chunks = [];
    let currentChunk = '🎰 Статистика казино (клики/скрытия):\n\n';
    
    for (const casino of stats.slice(0, 20)) { // Ограничиваем 20 казино
        const line = `${casino.isPinned ? '📌 ' : ''}${casino.name}\n👆 ${casino.clicks} | 🙈 ${casino.hides}\n──────────────────\n`;
        
        if (currentChunk.length + line.length > 4000) {
            chunks.push(currentChunk);
            currentChunk = line;
        } else {
            currentChunk += line;
        }
    }
    
    chunks.push(currentChunk);

    // Отправляем по частям
    (async () => {
        for (let i = 0; i < chunks.length; i++) {
            await bot.sendMessage(msg.chat.id, chunks[i]);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    })();

    logger.info('Casino stats command executed', { count: stats.length });
}

// 🎤 НОВАЯ КОМАНДА: Аудит голосовых комнат
function handleVoiceAuditCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        logger.warn('Unauthorized voice audit command attempt', { userId: msg.from.id });
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const logs = database.getVoiceAccessLogs(30);
    
    if (logs.length === 0) {
        return bot.sendMessage(msg.chat.id, '🎤 Записей о входах в голосовые нет');
    }

    const logList = logs.map(log => 
        `👤 ${log.username} (${log.userId})\n🎧 ${log.roomType}\n🕐 ${new Date(log.timestamp).toLocaleString('ru-RU')}\n──────────────────`
    ).join('\n');

    bot.sendMessage(msg.chat.id,
        `🎤 Последние входы в голосовые (${logs.length}):\n\n${logList}`
    );

    logger.info('Voice audit command executed', { count: logs.length });
}

module.exports = {
    isAdmin,
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
