const path = require('path');
const database = require(path.join(__dirname, '..', '..', 'database', 'database'));
const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));
const logger = require(path.join(__dirname, '..', '..', 'utils', 'logger'));

async function handleSaveCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    try {
        // 🔥 ОТПРАВЛЯЕМ СООБЩЕНИЕ О НАЧАЛЕ СОХРАНЕНИЯ
        const progressMsg = await bot.sendMessage(msg.chat.id, '💾 Начинаю сохранение данных в Git...');

        // 🔥 СОХРАНЯЕМ ВСЕ ДАННЫЕ ЛОКАЛЬНО
        await bot.editMessageText('💾 Сохраняю данные локально...', {
            chat_id: msg.chat.id,
            message_id: progressMsg.message_id
        });

        const localSaveResult = await database.saveAllData();
        
        if (!localSaveResult) {
            throw new Error('Ошибка локального сохранения');
        }

        // 🔥 СИНХРОНИЗИРУЕМ С GIT
        await bot.editMessageText('🔁 Синхронизирую с GitHub...', {
            chat_id: msg.chat.id,
            message_id: progressMsg.message_id
        });

        const githubSync = require(path.join(__dirname, '..', '..', 'database', 'githubSync'));
        
        // 🔥 СОХРАНЯЕМ КАЖДЫЙ ФАЙЛ ОТДЕЛЬНО В GIT
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

                // 🔥 НЕБОЛЬШАЯ ЗАДЕРЖКА МЕЖДУ ФАЙЛАМИ
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                errorCount++;
                logger.error(`Error saving ${file.name}:`, error);
            }
        }

        // 🔥 ФИНАЛЬНОЕ СООБЩЕНИЕ
        const resultMessage = `
✅ Сохранение завершено!

📊 Результат:
✅ Успешно: ${successCount} файлов
❌ Ошибок: ${errorCount} файлов
⏰ Время: ${new Date().toLocaleString()}

${errorCount > 0 ? '⚠️ Некоторые файлы не сохранены. Проверьте логи.' : '🎉 Все данные сохранены успешно!'}
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
        
        // 🔥 Пытаемся отправить сообщение об ошибке
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
