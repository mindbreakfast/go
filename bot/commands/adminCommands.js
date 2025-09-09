console.log('✅ adminCommands loaded');
const path = require('path');
const config = require(path.join(__dirname, '..', '..', 'config'));
const database = require(path.join(__dirname, '..', '..', 'database', 'database'));
const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));

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

function handleLiveCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
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

    database.saveData().then(success => {
        bot.sendMessage(msg.chat.id, success ?
            `✅ Стрим запущен!\nСсылка: ${streamUrl}\nОписание: ${eventDescription}` :
            '❌ Ошибка обновления статуса стрима'
        );
    });
}

function handleStopCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    database.setStreamStatus({
        isStreamLive: false,
        streamUrl: '',
        eventDescription: '',
        lastUpdated: new Date().toISOString()
    });

    database.saveData().then(success => {
        bot.sendMessage(msg.chat.id, success ?
            '✅ Стрим остановлен' :
            '❌ Ошибка остановки стрима'
        );
    });
}

function handleTextCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
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

    database.saveData().then(() => {
        bot.sendMessage(msg.chat.id,
            `✅ Анонс добавлен!\nID: ${newAnnouncement.id}\nЦвет: ${color}\nТекст: ${text}`
        );
    });
}

function handleClearTextCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    database.setAnnouncements([]);
    database.saveData().then(() => {
        bot.sendMessage(msg.chat.id, '✅ Все анонсы очищены!');
    });
}

function handleListTextCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const announcements = database.getAnnouncements();
    if (announcements.length === 0) {
        return bot.sendMessage(msg.chat.id, '📝 Список анонсов пуст');
    }

    const announcementList = announcements.map(a =>
        `ID: ${a.id}\nЦвет: ${a.color}\nТекст: ${a.text}\nДата: ${new Date(a.createdAt).toLocaleString('ru-RU')}\n──────────────────`
    ).join('\n');

    bot.sendMessage(msg.chat.id,
        `Список анонсов (${announcements.length}):\n\n${announcementList}`
    );
}

function handleRemoveTextCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const id = parseInt(match[1]);
    const announcements = database.getAnnouncements();
    const index = announcements.findIndex(a => a.id === id);

    if (index !== -1) {
        const removed = announcements.splice(index, 1)[0];
        database.setAnnouncements(announcements);
        database.saveData().then(() => {
            bot.sendMessage(msg.chat.id,
                `✅ Анонс удален!\nID: ${id}\nТекст: ${removed.text}`
            );
        });
    } else {
        bot.sendMessage(msg.chat.id, `❌ Анонс с ID ${id} не найден`);
    }
}

async function handleBroadcastCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const message = match[1];
    const userChats = database.getUserChats();
    let successCount = 0;
    let errorCount = 0;

    bot.sendMessage(msg.chat.id, `📤 Начинаю рассылку для ${userChats.size} пользователей...`);

    for (const [userId] of userChats) {
        try {
            await bot.sendMessage(userId, `📢 ОБЪЯВЛЕНИЕ:\n\n${message}`);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            errorCount++;
        }
    }

    bot.sendMessage(msg.from.id,
        `✅ Рассылка завершена!\n` +
        `✓ Доставлено: ${successCount}\n` +
        `✗ Ошибок: ${errorCount}`
    );
}

function handleApproveCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const userId = parseInt(match[1]);
    const success = database.approveUserAccess(userId);
    
    if (success) {
        bot.sendMessage(msg.chat.id, `✅ Пользователь ${userId} одобрен для доступа к лайв комнате!`);
        bot.sendMessage(userId, '🎉 Ваш доступ к приватной лайв комнате одобрен! Обновите приложение.');
    } else {
        bot.sendMessage(msg.chat.id, `❌ Не удалось одобрить пользователя ${userId}`);
    }
}

function handleApprovalsCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const pending = database.getPendingApprovals();
    if (pending.length === 0) {
        return bot.sendMessage(msg.chat.id, '📝 Запросов на одобрение нет');
    }

    const approvalList = pending.map(req => 
        `ID: ${req.userId}\nUsername: @${req.requestedUsername}\nЗапросил: ${new Date(req.requestedAt).toLocaleString('ru-RU')}\n/odobri_${req.userId}`
    ).join('\n\n');

    bot.sendMessage(msg.chat.id,
        `Запросы на одобрение (${pending.length}):\n\n${approvalList}`
    );
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
    handleApprovalsCommand
};
