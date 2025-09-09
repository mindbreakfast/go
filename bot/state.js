const casinoEditingState = new Map();

console.log('✅ Bot state module loaded');

// Функция для очистки состояния пользователя (на случай таймаутов)
function clearUserState(userId) {
    if (casinoEditingState.has(userId)) {
        console.log(`🧹 Clearing casino editing state for user ${userId}`);
        casinoEditingState.delete(userId);
    }
}

// Очищаем состояние каждые 30 минут для предотвращения утечек памяти
setInterval(() => {
    console.log('🕒 Running periodic state cleanup');
    const now = Date.now();
    const thirtyMinutesAgo = now - 30 * 60 * 1000;
    
    for (const [userId, state] of casinoEditingState.entries()) {
        if (state.lastActivity && state.lastActivity < thirtyMinutesAgo) {
            console.log(`🧹 Removing stale state for user ${userId}`);
            casinoEditingState.delete(userId);
        }
    }
}, 30 * 60 * 1000);

module.exports = {
    casinoEditingState,
    clearUserState
};
