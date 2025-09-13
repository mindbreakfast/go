const logger = require('../utils/logger');

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
    ]
};

const commands = {};

// Добавляем isAdmin отдельно, так как она используется в других модулях
try {
    const { isAdmin } = require('../../utils/isAdmin');
    commands.isAdmin = isAdmin;
} catch (error) {
    logger.error('Failed to load isAdmin:', error);
    // Создаем заглушку чтобы не ломать другие модули
    commands.isAdmin = () => false;
}

// Загружаем остальные команды
for (const [moduleName, functions] of Object.entries(commandModules)) {
    try {
        const module = require(`./${moduleName}`);
        for (const funcName of functions) {
            if (module[funcName]) {
                commands[funcName] = module[funcName];
            } else {
                logger.warn(`Function ${funcName} not found in ${moduleName}`);
            }
        }
    } catch (error) {
        logger.error(`Failed to load module ${moduleName}:`, error);
    }
}

module.exports = commands;
