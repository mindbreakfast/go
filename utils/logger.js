const fs = require('fs').promises;
const path = require('path');

class Logger {
    constructor() {
        this.logFile = path.join(__dirname, '..', 'logs', 'app.log');
        this.logLevel = process.env.LOG_LEVEL || 'info'; // Читаем из process.env напрямую
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
        
        const currentLevel = levels[this.logLevel] || levels['info'];
        return levels[level] <= currentLevel;
    }

    async log(level, message, metadata = {}) {
        // Проверяем уровень логирования
        if (!this.shouldLog(level)) {
            return;
        }

        const timestamp = new Date().toISOString();
        
        // 🔒 Безопасное логирование: убираем чувствительные данные
        let safeMetadata = { ...metadata };
        if (safeMetadata.error && safeMetadata.error.message) {
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
        
        // Вывод в консоль
        console.log(logEntry.trim());
        
        // Запись в файл (с обработкой ошибок)
        try {
            await fs.appendFile(this.logFile, logEntry);
        } catch (error) {
            // Если ошибка записи в файл, пишем только в консоль
            console.error('Log file write error:', error.message);
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
