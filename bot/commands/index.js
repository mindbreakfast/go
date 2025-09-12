console.log('✅ Commands index loaded');

module.exports = {
    // Admin commands
    isAdmin: require('./adminCommands').isAdmin,
    handleStatsCommand: require('./adminCommands').handleStatsCommand,
    handleLiveCommand: require('./adminCommands').handleLiveCommand,
    handleStopCommand: require('./adminCommands').handleStopCommand,
    handleTextCommand: require('./adminCommands').handleTextCommand,
    handleClearTextCommand: require('./adminCommands').handleClearTextCommand,
    handleListTextCommand: require('./adminCommands').handleListTextCommand,
    handleRemoveTextCommand: require('./adminCommands').handleRemoveTextCommand,
    handleBroadcastCommand: require('./adminCommands').handleBroadcastCommand,
    handleApproveCommand: require('./adminCommands').handleApproveCommand,
    handleApprovalsCommand: require('./adminCommands').handleApprovalsCommand,
    handleCasinoStatsCommand: require('./adminCommands').handleCasinoStatsCommand,
    handleVoiceAuditCommand: require('./adminCommands').handleVoiceAuditCommand,

    // Casino commands
    handleAddCasinoCommand: require('./casinoCommands').handleAddCasinoCommand,
    handleListCasinosCommand: require('./casinoCommands').handleListCasinosCommand,
    handleEditCasinoCommand: require('./casinoCommands').handleEditCasinoCommand,
    handleCallbackQuery: require('./casinoCommands').handleCallbackQuery,
    handleCasinoEditResponse: require('./casinoCommands').handleCasinoEditResponse,
    handleCasinoCreationStep: require('./casinoCommands').handleCasinoCreationStep,

    // User commands
    handleStartCommand: require('./userCommands').handleStartCommand,
    handleHelpCommand: require('./userCommands').handleHelpCommand,
    handleMessage: require('./userCommands').handleMessage,
    handleApprovalRequest: require('./userCommands').handleApprovalRequest,
    handleContestJoin: require('./userCommands').handleContestJoin,

    // Referral commands
    handleReferralCommand: require('./referralCommands').handleReferralCommand,
    handleRefStatsCommand: require('./referralCommands').handleRefStatsCommand
};
