const logger = require('../utils/logger');

class StateManager {
    constructor() {
        this.casinoEditingState = new Map();
        this.cleanupInterval = null;
        this.startCleanup();
        logger.info('Bot state module loaded');
    }

    // Функция для очистки состояния пользователя
    clearUserState(userId) {
        if (this.casinoEditingState.has(userId)) {
            logger.debug(`Clearing casino editing state for user ${userId}`);
            this.casinoEditingState.delete(userId);
        }
    }

    // Запуск очистки состояния
    startCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleStates();
        }, 30 * 60 * 1000); // 30 минут
    }

    // Очистка устаревших состояний
    cleanupStaleStates() {
        const now = Date.now();
        const thirtyMinutesAgo = now - 30 * 60 * 1000;
        
        let clearedCount = 0;
        
        for (const [userId, state] of this.casinoEditingState.entries()) {
            if (state.lastActivity && state.lastActivity < thirtyMinutesAgo) {
                this.casinoEditingState.delete(userId);
                clearedCount++;
            }
        }
        
        if (clearedCount > 0) {
            logger.debug(`Cleared ${clearedCount} stale user states`);
        }
    }

    // Остановка очистки
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    // Получение состояния
    getState() {
        return this.casinoEditingState;
    }
}

// Создаем единственный экземпляр
const stateManager = new StateManager();

module.exports = {
    casinoEditingState: stateManager.getState(),
    clearUserState: (userId) => stateManager.clearUserState(userId)
};
