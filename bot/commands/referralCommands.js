const database = require('../../database/database');
const config = require('../../config');

function handleReferralCommand(bot, msg) {
    const userId = msg.from.id;
    const referralInfo = database.getReferralInfo(userId);
    
    const message = `
📊 Ваша реферальная статистика:

👥 Вас пригласил: ${referralInfo.referredBy ? 'User#' + referralInfo.referredBy : 'Никто'}
📈 Вы пригласили: ${referralInfo.referrals.length} человек

🔗 Ваша реферальная ссылка:
${referralInfo.referralLink}

Приглашайте друзей и получайте бонусы!`;
    
    bot.sendMessage(msg.chat.id, message);
}

module.exports = {
    handleReferralCommand
};
