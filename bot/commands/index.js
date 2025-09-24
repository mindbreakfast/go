const path = require('path');
const logger = require(path.join(__dirname, '..', '..', 'utils', 'logger'));

// Динамическая загрузка команд с обработкой ошибок
const commandModules = {
    adminCommands: [
        'handleStatsCommand', 'handleLiveCommand', 'handleStopCommand', 
        'handleTextCommand', 'handleClearTextCommand', 'handleListTextCommand',
        'handleRemoveTextCommand', 'handleBroadcastCommand', 'handleApproveCommand',
        'handleApprovalsCommand', 'handleCasinoStatsCommand', 'handleVoiceAuditCommand'
    ],
    casinoCommands: [
        'handleAddCasinoCommand', 'handleListCasinosCommand', 'handleEditCasinoCommand',
        'handleCallbackQuery', 'handleCasinoEditResponse', 'handleCasinoCreationStep'
    ],
    userCommands: [
        'handleStartCommand', 'handleHelpCommand', 'handleMessage',
        'handleApprovalRequest', 'handleContestJoin'
    ],
    referralCommands: [
        'handleReferralCommand', 'handleRefStatsCommand'
    ],
    // 🔥 ДОБАВЛЯЕМ НОВЫЙ МОДУЛЬ С КОМАНДАМИ АНОНСОВ
    announcementCommands: [
        'handleClearAnnouncementsCommand', 
        'handleDeleteAnnouncementCommand', 
        'handleAnnouncementsListCommand'
    ]
};

const commands = {};

// Добавляем isAdmin отдельно, так как она используется в других модулях
try {
    const { isAdmin } = require(path.join(__dirname, '..', '..', 'utils', 'isAdmin'));
    commands.isAdmin = isAdmin;
} catch (error) {
    logger.error('Failed to load isAdmin:', error);
    // Создаем заглушку чтобы не ломать другие модули
    commands.isAdmin = () => false;
}

// Загружаем остальные команды
for (const [moduleName, functions] of Object.entries(commandModules)) {
    try {
        const modulePath = path.join(__dirname, moduleName);
        const module = require(modulePath);
        
        for (const funcName of functions) {
            if (typeof module[funcName] === 'function') {
                commands[funcName] = module[funcName].bind(module);
                logger.debug(`Loaded function: ${funcName} from ${moduleName}`);
            } else {
                logger.warn(`Function ${funcName} not found in ${moduleName}`);
                // Создаем заглушку для отсутствующих функций
                commands[funcName] = () => {
                    logger.error(`Function ${funcName} not implemented`);
                };
            }
        }
    } catch (error) {
        logger.error(`Failed to load module ${moduleName}:`, error);
        // Создаем заглушки для всех функций этого модуля
        for (const funcName of functions) {
            commands[funcName] = () => {
                logger.error(`Module ${moduleName} failed to load, function ${funcName} unavailable`);
            };
        }
    }
}

// 🔥 ВАЖНО: Проверяем что handleMessage загружена
if (!commands.handleMessage) {
    logger.error('handleMessage function is missing!');
    commands.handleMessage = (bot, msg) => {
        logger.warn('handleMessage stub called', { text: msg.text });
        bot.sendMessage(msg.chat.id, '❌ Команда временно недоступна');
    };
}

logger.info('Command loader initialized', {
    loadedFunctions: Object.keys(commands).filter(key => typeof commands[key] === 'function')
});

module.exports = commands;
