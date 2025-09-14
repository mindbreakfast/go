const path = require('path');
const config = require(path.join(__dirname, '..', '..', 'config'));
const database = require(path.join(__dirname, '..', '..', 'database', 'database'));
const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));
const logger = require(path.join(__dirname, '..', '..', 'utils', 'logger'));

function handleReferralCommand(bot, msg) {
    try {
        const userId = msg.from.id;
        const referralInfo = database.getReferralInfo(userId);
        
        const message = `
📊 Ваша реферальная статистика:

👥 Вас пригласил: ${referralInfo.referredBy ? 'User#' + referralInfo.referredBy : 'Никто'}
📈 Вы пригласили: ${referralInfo.referrals.length} человек

🔗 Ваша реферальная ссылка:
${referralInfo.referralLink}

Киньте ссылку другу и получайте бонусы!`;
        
        bot.sendMessage(msg.chat.id, message);
    } catch (error) {
        logger.error('Error in referral command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при получении реферальной статистики');
    }
}

function handleRefStatsCommand(bot, msg) {
    try {
        if (!isAdmin(msg.from.id)) {
            logger.warn('Unauthorized refstats command attempt', { userId: msg.from.id });
            return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
        }

        const referralData = database.getReferralData();
        const topReferrers = Array.from(referralData.entries())
            .filter(([userId, data]) => data.referrals && data.referrals.length > 0)
            .sort((a, b) => b[1].referrals.length - a[1].referrals.length)
            .slice(0, 10);

        if (topReferrers.length === 0) {
            return bot.sendMessage(msg.chat.id, '🏆 Топ рефереров пуст');
        }

        const statsMessage = topReferrers.map(([userId, data], index) => 
            `${index + 1}. User#${userId} - ${data.referrals.length} рефералов`
        ).join('\n');

        bot.sendMessage(msg.chat.id, `🏆 Топ рефереров:\n\n${statsMessage}`);
    } catch (error) {
        logger.error('Error in ref stats command:', error);
        bot.sendMessage(msg.chat.id, '❌ Ошибка при получении статистики рефералов');
    }
}

module.exports = {
    handleReferralCommand,
    handleRefStatsCommand
};
