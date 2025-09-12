const axios = require('axios');
const config = require('./config');
const logger = require('./logger');

class WarmupService {
    constructor() {
        this.isWarming = false;
        this.warmupInterval = null;
    }

    start() {
        // Запускаем сразу при старте
        this.warmup();
        
        // Затем каждые 10 минут
        this.warmupInterval = setInterval(() => {
            this.warmup();
        }, 10 * 60 * 1000);

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
            
            // Делаем запросы к основным endpoint-ам
            const endpoints = [
                '/health',
                '/data',
                '/api/health',
                '/api/data'
            ];

            const results = await Promise.allSettled(
                endpoints.map(endpoint => 
                    axios.get(`${config.RENDER_URL}${endpoint}`, {
                        timeout: 10000
                    }).catch(error => ({
                        error: true,
                        message: error.message
                    }))
                )
            );

            const successful = results.filter(r => r.status === 'fulfilled' && !r.value.error).length;
            const failed = results.length - successful;

            logger.info('Warmup completed', {
                successful,
                failed,
                duration: Date.now() - startTime
            });

        } catch (error) {
            logger.error('Warmup error', { error: error.message });
        } finally {
            this.isWarming = false;
        }
    }

    stop() {
        if (this.warmupInterval) {
            clearInterval(this.warmupInterval);
            logger.info('Warmup service stopped');
        }
    }
}

module.exports = new WarmupService();
