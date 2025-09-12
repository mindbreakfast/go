const logger = require('../utils/logger');

const casinoEditingState = new Map();

logger.info('✅ Bot state module loaded');

// Функция для очистки состояния пользователя (на случай таймаутов)
function clearUserState(userId) {
    if (casinoEditingState.has(userId)) {
        logger.info(`Clearing casino editing state for user ${userId}`);
        casinoEditingState.delete(userId);
    }
}

// Очищаем состояние каждые 30 минут для предотвращения утечек памяти
setInterval(() => {
    logger.debug('Running periodic state cleanup');
    const now = Date.now();
    const thirtyMinutesAgo = now - 30 * 60 * 1000;
    
    let clearedCount = 0;
    
    for (const [userId, state] of casinoEditingState.entries()) {
        if (state.lastActivity && state.lastActivity < thirtyMinutesAgo) {
            logger.debug(`Removing stale state for user ${userId}`);
            casinoEditingState.delete(userId);
            clearedCount++;
        }
    }
    
    if (clearedCount > 0) {
        logger.info(`Cleared ${clearedCount} stale user states`);
    }
}, 30 * 60 * 1000);

module.exports = {
    casinoEditingState,
    clearUserState
};
