const path = require('path');
const database = require(path.join(__dirname, '..', '..', 'database', 'database'));
const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));
const logger = require(path.join(__dirname, '..', '..', 'utils', 'logger'));

async function handleSaveCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        const progressMsg = await bot.sendMessage(msg.chat.id, '💾 Начинаю сохранение данных...');

        // 🔥 ШАГ 1: СОХРАНЯЕМ ВСЕ ДАННЫЕ ЛОКАЛЬНО (ПЕРЕЗАПИСЫВАЕМ ФАЙЛЫ)
        await bot.editMessageText('💾 Сохраняю данные локально...', {
            chat_id: msg.chat.id,
            message_id: progressMsg.message_id
        });

        const localSaveResult = await database.saveAllData();
        
        if (!localSaveResult) {
            throw new Error('Ошибка локального сохранения');
        }

        // 🔥 ШАГ 2: ПУШИМ В GIT
        await bot.editMessageText('🔁 Синхронизирую с GitHub...', {
            chat_id: msg.chat.id,
            message_id: progressMsg.message_id
        });

        const githubSync = require(path.join(__dirname, '..', '..', 'database', 'githubSync'));
        
        const filesToSave = [
            { name: 'data.json', data: JSON.stringify({
                casinos: database.getCasinos(),
                categories: database.getCategories(),
                lastUpdated: new Date().toISOString()
            }, null, 2) },
            { name: 'content.json', data: JSON.stringify({
                announcements: database.getAnnouncements(),
                streamStatus: database.getStreamStatus(),
                lastUpdated: new Date().toISOString()
            }, null, 2) },
            { name: 'userdata.json', data: JSON.stringify({
                userChats: Object.fromEntries(database.getUserChats()),
                userSettings: Object.fromEntries(database.getUserSettings()),
                giveaways: database.getGiveaways(),
                pendingApprovals: database.getPendingApprovals(),
                referralData: Object.fromEntries(database.getReferralData()),
                lastUpdated: new Date().toISOString()
            }, null, 2) },
            { name: 'stats.json', data: JSON.stringify({
                userClickStats: Object.fromEntries(database.getClickStats()),
                hiddenStats: Object.fromEntries(database.getHiddenStats()),
                voiceAccessLogs: database.getVoiceAccessLogs(),
                lastUpdated: new Date().toISOString()
            }, null, 2) }
        ];

        let successCount = 0;
        let errorCount = 0;

        for (const file of filesToSave) {
            try {
                await bot.editMessageText(`📁 Сохраняю ${file.name}...`, {
                    chat_id: msg.chat.id,
                    message_id: progressMsg.message_id
                });

                const result = await githubSync.saveDataToGitHub(file.data, file.name);
                
                if (result.success) {
                    successCount++;
                    logger.info(`File ${file.name} saved to GitHub`);
                } else {
                    errorCount++;
                    logger.error(`Failed to save ${file.name} to GitHub`);
                }

                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                errorCount++;
                logger.error(`Error saving ${file.name}:`, error);
            }
        }

        // 🔥 ШАГ 3: ПОДТВЕРЖДАЕМ ЧТО ДАННЫЕ СОХРАНЕНЫ И В ЛОКАЛЬНЫЕ ФАЙЛЫ И В GIT
        const resultMessage = `
✅ Сохранение завершено!

📊 Результат:
💾 Локальные файлы: перезаписаны
🔁 GitHub: ${successCount}/4 файлов
⏰ Время: ${new Date().toLocaleString()}

${errorCount > 0 ? 
`⚠️ В GitHub сохранено не все файлы. 
При следующем деплое данные могут загрузиться из локальных файлов.` : 
'🎉 Все данные сохранены в GitHub! При деплое загрузятся актуальные данные.'
}
        `.trim();

        await bot.editMessageText(resultMessage, {
            chat_id: msg.chat.id,
            message_id: progressMsg.message_id
        });

        logger.info('Manual save completed', { 
            adminId: msg.from.id, 
            successCount, 
            errorCount 
        });

    } catch (error) {
        logger.error('Error in save command:', error);
        
        try {
            await bot.sendMessage(msg.chat.id, 
                `❌ Ошибка при сохранении:\n${error.message}`
            );
        } catch (e) {
            logger.error('Failed to send error message:', e);
        }
    }
}

module.exports = {
    handleSaveCommand
};
