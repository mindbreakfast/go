const fs = require('fs').promises;
const path = require('path');

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

    async log(level, message, metadata = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message} ${Object.keys(metadata).length ? JSON.stringify(metadata) : ''}\n`;
        
        // Вывод в консоль
        console.log(logEntry.trim());
        
        // Запись в файл (асинхронно, без ожидания)
        fs.appendFile(this.logFile, logEntry).catch(err => {
            console.error('Log file write error:', err);
        });
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
        if (process.env.NODE_ENV === 'development') {
            this.log('debug', message, metadata);
        }
    }
}

module.exports = new Logger();
