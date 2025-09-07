const config = require('../../config');
const database = require('../../database/database');

function isAdmin(userId) {
    return config.ADMINS.includes(Number(userId));
}

// Все админские команды: /stats, /live, /stop, /text, /broadcast и т.д.
// Переносим сюда соответствующие функции из старого commands.js

module.exports = {
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
    isAdmin
};
