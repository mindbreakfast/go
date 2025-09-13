const axios = require('axios');
const logger = require('./logger');

class WarmupService {
    constructor() {
        this.isWarming = false;
        this.warmupInterval = null;
    }

    start() {
        // 🔥 УБРАЛИ ЖЕСТКИЙ URL - используем относительные пути
        // Запускаем сразу при старте
        this.warmup();
        
        // Затем каждые 5 минут (оптимально для Render)
        this.warmupInterval = setInterval(() => {
            this.warmup();
        }, 5 * 60 * 1000); // 5 минут

        logger.info('Warmup service started');
    }

    async warmup() {
        if (this.isWarming) {
            logger.debug('Warmup already in progress');
            return;
        }

        this.isWarming = true;
        const startTime = Date.now();

        try {
            logger.info('Starting server warmup');
            
            // 🔥 ИСПРАВЛЕНИЕ: Используем относительные пути вместо config.RENDER_URL
            // Это работает потому что мы "прогреваем" тот же самый сервер
            const baseURL = 'http://localhost:' + (process.env.PORT || 3000);
            
            // Делаем запросы к основным endpoint-ам
            const endpoints = [
                '/health',
                '/api/health',
                '/api/data',
                '/status'
            ];

            const results = await Promise.allSettled(
                endpoints.map(endpoint => 
                    axios.get(`${baseURL}${endpoint}`, {
                        timeout: 15000, // Увеличенный таймаут для "просыпающегося" сервера
                        headers: {
                            'User-Agent': 'Ludogolik-Warmup/1.0'
                        }
                    }).then(response => ({
                        success: true,
                        status: response.status,
                        endpoint: endpoint
                    })).catch(error => ({
                        success: false,
                        error: error.message,
                        endpoint: endpoint,
                        status: error.response?.status
                    }))
                )
            );

            const successful = results.filter(r => 
                r.status === 'fulfilled' && r.value.success
            ).length;
            
            const failed = results.length - successful;

            logger.info('Warmup completed', {
                successful,
                failed,
                duration: Date.now() - startTime + 'ms',
                details: results.map(r => 
                    r.status === 'fulfilled' ? 
                    `${r.value.endpoint}: ${r.value.success ? 'OK' : 'FAIL'}` : 
                    'PROMISE_REJECTED'
                )
            });

        } catch (error) {
            logger.error('Warmup process error', { error: error.message });
        } finally {
            this.isWarming = false;
        }
    }

    stop() {
        if (this.warmupInterval) {
            clearInterval(this.warmupInterval);
            this.warmupInterval = null;
            logger.info('Warmup service stopped');
        }
    }

    // 🔥 НОВАЯ ФУНКЦИЯ: Ручной запуск прогрева через API
    async manualWarmup() {
        if (this.isWarming) {
            return { status: 'already_running' };
        }
        
        await this.warmup();
        return { status: 'completed' };
    }
}

module.exports = new WarmupService();
