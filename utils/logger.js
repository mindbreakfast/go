const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

class Logger {
    constructor() {
        this.logFile = path.join(__dirname, '..', 'logs', 'app.log');
        this.init();
    }

    async init() {
        try {
            await fs.mkdir(path.dirname(this.logFile), { recursive: true });
        } catch (error) {
            console.error('Cannot create logs directory:', error);
        }
    }

    shouldLog(level) {
        const levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        const currentLevel = levels[config.LOG_LEVEL] || levels['info'];
        return levels[level] <= currentLevel;
    }

    async log(level, message, metadata = {}) {
        // Проверяем уровень логирования из конфига
        if (!this.shouldLog(level)) {
            return;
        }

        const timestamp = new Date().toISOString();
        
        // 🔒 Безопасное логирование: убираем чувствительные данные
        let safeMetadata = { ...metadata };
        if (safeMetadata.error && safeMetadata.error.message) {
            // Оставляем только message у ошибок, остальное может содержать敏感 данные
            safeMetadata.error = { message: safeMetadata.error.message };
        }
        
        // Фильтруем чувствительные поля
        const sensitiveKeys = ['token', 'password', 'secret', 'authorization', 'email'];
        Object.keys(safeMetadata).forEach(key => {
            if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
                safeMetadata[key] = '***REDACTED***';
            }
        });

        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message} ${Object.keys(safeMetadata).length ? JSON.stringify(safeMetadata) : ''}\n`;
        
        // Вывод в консоль только для error и warn в продакшене
        if (level === 'error' || level === 'warn' || config.LOG_LEVEL === 'debug') {
            console.log(logEntry.trim());
        }
        
        // Запись в файл (асинхронно, без ожидания)
        if (config.LOG_LEVEL !== 'silent') {
            fs.appendFile(this.logFile, logEntry).catch(err => {
                console.error('Log file write error:', err);
            });
        }
    }

    info(message, metadata = {}) {
        this.log('info', message, metadata);
    }

    warn(message, metadata = {}) {
        this.log('warn', message, metadata);
    }

    error(message, metadata = {}) {
        this.log('error', message, metadata);
    }

    debug(message, metadata = {}) {
        this.log('debug', message, metadata);
    }
}

module.exports = new Logger();
