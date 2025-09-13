const axios = require('axios');
const path = require('path');
const config = require(path.join(__dirname, '..', 'config'));
const logger = require(path.join(__dirname, 'logger'));

class WarmupService {
    constructor() {
        this.isWarming = false;
        this.warmupInterval = null;
    }

    start() {
        // 🔥 ИСПРАВЛЕНИЕ: Используем абсолютный URL сервера
        const serverUrl = `https://go-5zty.onrender.com`;
        
        // Запускаем сразу при старте
        this.warmup(serverUrl);
        
        // Затем каждые 5 минут (оптимально для Render)
        this.warmupInterval = setInterval(() => {
            this.warmup(serverUrl);
        }, 5 * 60 * 1000); // 5 минут

        logger.info('Warmup service started', { serverUrl });
    }

    async warmup(serverUrl) {
        if (this.isWarming) {
            logger.debug('Warmup already in progress');
            return;
        }

        this.isWarming = true;
        const startTime = Date.now();

        try {
            logger.info('Starting server warmup', { serverUrl });
            
            // Делаем запросы к основным endpoint-ам
            const endpoints = [
                '/health',
                '/api/health',
                '/api/data',
                '/status'
            ];

            const results = await Promise.allSettled(
                endpoints.map(endpoint => 
                    axios.get(`${serverUrl}${endpoint}`, {
                        timeout: 30000, // Увеличенный таймаут для "просыпающегося" сервера
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
                serverUrl
            });

        } catch (error) {
            logger.error('Warmup process error', { 
                error: error.message,
                serverUrl 
            });
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
        
        const serverUrl = `https://go-5zty.onrender.com`;
        await this.warmup(serverUrl);
        return { status: 'completed' };
    }
}

module.exports = new WarmupService();
