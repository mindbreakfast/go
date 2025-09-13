const fs = require('fs').promises;
const path = require('path');
const config = require(path.join(__dirname, '..', 'config'));

class Logger {
    constructor() {
        this.logFile = path.join(__dirname, '..', 'logs', 'app.log');
        this.logLevel = process.env.LOG_LEVEL || 'info';
    }

    async log(level, message, metadata = {}) {
        if (!this.shouldLog(level)) return;

        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message} ${Object.keys(metadata).length ? JSON.stringify(metadata) : ''}\n`;
        
        console.log(logEntry.trim());
        
        try {
            await fs.appendFile(this.logFile, logEntry);
        } catch (error) {
            console.error('Log write error:', error.message);
        }
    }

    shouldLog(level) {
        const levels = { error: 0, warn: 1, info: 2, debug: 3 };
        return levels[level] <= (levels[this.logLevel] || levels['info']);
    }

    info(message, metadata) { this.log('info', message, metadata); }
    warn(message, metadata) { this.log('warn', message, metadata); }
    error(message, metadata) { this.log('error', message, metadata); }
    debug(message, metadata) { this.log('debug', message, metadata); }
}

module.exports = new Logger();
