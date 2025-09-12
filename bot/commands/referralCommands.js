const path = require('path');
const database = require(path.join(__dirname, '..', '..', 'database', 'database'));
const logger = require('../../utils/logger');

function handleReferralCommand(bot, msg) {
    const userId = msg.from.id;
    const referralInfo = database.getReferralInfo(userId);
    
    logger.info('Referral command executed', { userId, referrals: referralInfo.referrals.length });
    
    const message = `
📊 Ваша реферальная статистика:

👥 Вас пригласил: ${referralInfo.referredBy ? 'User#' + referralInfo.referredBy : 'Никто'}
📈 Вы пригласили: ${referralInfo.referrals.length} человек

🔗 Ваша реферальная ссылка:
${referralInfo.referralLink}

Киньте ссылку другу и получайте бонусы!`;
    
    bot.sendMessage(msg.chat.id, message);
}

// 📊 НОВАЯ КОМАНДА: Топ рефереров
function handleRefStatsCommand(bot, msg) {
    const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));
    
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

    logger.info('Ref stats command executed', { topReferrers: topReferrers.length });
    bot.sendMessage(msg.chat.id, `🏆 Топ рефереров:\n\n${statsMessage}`);
}

module.exports = {
    handleReferralCommand,
    handleRefStatsCommand
};
