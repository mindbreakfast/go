const path = require('path');
const database = require(path.join(__dirname, '..', '..', 'database', 'database'));
const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));
const logger = require(path.join(__dirname, '..', '..', 'utils', 'logger'));

function handleUserInfoCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        const userId = parseInt(match[1]);
        if (isNaN(userId)) {
            return bot.sendMessage(msg.chat.id, '❌ Неверный формат ID. Используйте: /user_info [ID]');
        }

        // 🔥 ПОЛУЧАЕМ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ИЗ БАЗЫ
        const userChat = database.getUserChats().get(userId);
        const userSettings = database.getUserSettings().get(userId);
        const referralInfo = database.getReferralInfo(userId);
        const clickStats = database.getUserClickStats(userId);

        if (!userChat) {
            return bot.sendMessage(msg.chat.id, `❌ Пользователь с ID ${userId} не найден в базе`);
        }

        // 🔥 ФОРМИРУЕМ ТОП КАЗИНО ДЛЯ СТАТИСТИКИ
        let topCasinosText = '';
        if (Object.keys(clickStats).length > 0) {
            const topCasinos = Object.entries(clickStats)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([casinoId, clicks], index) => {
                    const casino = database.getCasino(parseInt(casinoId));
                    return `${index + 1}. ${casino ? casino.name : `Казино#${casinoId}`} - ${clicks} кликов`;
                })
                .join('\n');
            
            topCasinosText = `\nТоп казино:\n${topCasinos}`;
        }

        // 🔥 ФОРМИРУЕМ ИНФОРМАЦИЮ О ПОЛЬЗОВАТЕЛЕ
        const userInfo = `
👤 Информация о пользователе:

🆔 ID: ${userChat.id}
📛 Имя: ${userChat.first_name || 'Не указано'}
📛 Фамилия: ${userChat.last_name || 'Не указано'}
🔗 Username: @${userChat.username || 'Не указан'}
🌐 Язык: ${userChat.language_code || 'Не указан'}

📅 Зарегистрирован: ${new Date(userChat.joined_at).toLocaleString('ru-RU')}
⏰ Последняя активность: ${new Date(userChat.last_activity).toLocaleString('ru-RU')}

🎰 Настройки:
${userSettings ? `
• Скрытых казино: ${userSettings.hiddenCasinos?.length || 0}
• Уведомления: ${userSettings.notifications ? '✅' : '❌'}
• Тема: ${userSettings.theme === 'dark' ? '🌙 Тёмная' : '☀️ Светлая'}
• Доступ к лайву: ${userSettings.hasLiveAccess ? '✅' : '❌'}
` : '• Настройки не найдены'}

📊 Реферальная система:
• Пригласил: ${referralInfo.referredBy ? `User#${referralInfo.referredBy}` : 'Никто'}
• Приглашено: ${referralInfo.referrals?.length || 0} человек
• Заработано: ${referralInfo.totalEarned || 0} баллов

🎯 Статистика кликов:
• Всего кликов: ${Object.values(clickStats).reduce((sum, clicks) => sum + clicks, 0)}
• Уникальных казино: ${Object.keys(clickStats).length}
${topCasinosText}
        `.trim();

        bot.sendMessage(msg.chat.id, userInfo);

    } catch (error) {
        logger.error('Error in user info command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при получении информации о пользователе');
    }
}

// 🔥 ДОПОЛНИТЕЛЬНАЯ КОМАНДА ДЛЯ ПОИСКА ПО USERNAME
function handleFindUserCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        const searchUsername = match[1].toLowerCase().replace('@', '');
        if (!searchUsername) {
            return bot.sendMessage(msg.chat.id, '❌ Укажите username для поиска');
        }

        const userChats = database.getUserChats();
        const foundUsers = [];

        // 🔥 ПОИСК ПО USERNAME
        for (const [userId, userData] of userChats.entries()) {
            if (userData.username && userData.username.toLowerCase().includes(searchUsername)) {
                foundUsers.push({ userId, userData });
            }
        }

        if (foundUsers.length === 0) {
            return bot.sendMessage(msg.chat.id, `❌ Пользователи с username содержащим "${searchUsername}" не найдены`);
        }

        const message = foundUsers.slice(0, 10).map((user, index) => {
            return `${index + 1}. @${user.userData.username} (ID: ${user.userId})\n   Имя: ${user.userData.first_name || 'Не указано'}\n   Зарегистрирован: ${new Date(user.userData.joined_at).toLocaleDateString('ru-RU')}`;
        }).join('\n\n');

        const resultMessage = `🔍 Найдено пользователей: ${foundUsers.length}\n\n${message}${
            foundUsers.length > 10 ? `\n\n... и еще ${foundUsers.length - 10} пользователей` : ''
        }`;

        bot.sendMessage(msg.chat.id, resultMessage);

    } catch (error) {
        logger.error('Error in find user command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при поиске пользователя');
    }
}

module.exports = {
    handleUserInfoCommand,
    handleFindUserCommand
};
