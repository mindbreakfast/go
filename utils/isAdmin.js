const config = require('../config');

// Простое кэширование для частых вызовов
const adminCache = new Map();

function isAdmin(userId) {
    // Проверяем кэш
    if (adminCache.has(userId)) {
        return adminCache.get(userId);
    }

    // Валидация и проверка
    const numId = Number(userId);
    if (isNaN(numId)) {
        adminCache.set(userId, false);
        return false;
    }
    
    const result = Array.isArray(config.ADMINS) && config.ADMINS.includes(numId);
    adminCache.set(userId, result);
    
    return result;
}

// Функция для сброса кэша (на случай изменения config)
function clearAdminCache() {
    adminCache.clear();
}

module.exports = { 
    isAdmin,
    clearAdminCache 
};
