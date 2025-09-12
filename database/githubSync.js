const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger'); // Используем логгер

class GitHubSync {
    constructor() {
        this.baseURL = 'https://api.github.com';
        this.headers = {
            'Authorization': `token ${config.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Ludogolik-Bot-Server'
        };
        this.owner = config.GITHUB_REPO_OWNER;
        this.repo = config.GITHUB_REPO_NAME;
        this.branch = 'main';
        logger.info('GitHubSync initialized', { repo: `${this.owner}/${this.repo}` });
    }

    async #getFileSHA(filePath) {
        try {
            const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${filePath}`;
            const response = await axios.get(url, { 
                headers: this.headers,
                timeout: 15000 // Увеличен таймаут для Render
            });
            return response.data.sha;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                logger.debug('File not found on GitHub, will create new', { filePath });
                return null;
            }
            // Безопасное логирование ошибки без вывода чувствительных данных
            logger.error('Error getting file SHA from GitHub', { 
                filePath: filePath,
                status: error.response?.status,
                message: error.message // Не логируем весь response
            });
            throw error;
        }
    }

    async saveDataToGitHub(dataJSON, filePath = 'data.json') {
        if (!config.GITHUB_TOKEN) {
            logger.warn('GitHubSync: GITHUB_TOKEN not set, skipping backup');
            return { success: false, message: 'GITHUB_TOKEN not configured' };
        }

        const MAX_RETRIES = 3;
        let retries = 0;
        let lastError = null;

        while (retries < MAX_RETRIES) {
            try {
                logger.debug(`Starting GitHub sync attempt ${retries + 1} for file: ${filePath}`);
                const content = Buffer.from(dataJSON).toString('base64');
                const sha = await this.#getFileSHA(filePath);
                const message = `Auto-update: ${new Date().toISOString()}`;

                const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${filePath}`;
                const payload = {
                    message: message,
                    content: content,
                    branch: this.branch,
                    committer: config.GITHUB_COMMITTER
                };
                if (sha) payload.sha = sha;

                const response = await axios.put(url, payload, { 
                    headers: this.headers,
                    timeout: 20000 // Увеличен таймаут для Render
                });
                
                logger.info('GitHub backup successful', { filePath });
                return { success: true, commit: response.data.commit };

            } catch (error) {
                lastError = error;
                if (error.response?.status === 409 && retries < MAX_RETRIES - 1) {
                    // Конфликт версий - пробуем еще раз с экспоненциальной задержкой
                    retries++;
                    const delayMs = 2000 * Math.pow(2, retries); // 2s, 4s, 6s
                    logger.warn(`409 conflict on ${filePath}, retrying in ${delayMs}ms... (${retries}/${MAX_RETRIES})`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue;
                }
                break; // Выходим из цикла при других ошибках или после всех попыток
            }
        }
        
        // Безопасное логирование ошибки после всех попыток
        logger.error('GitHubSync: Failed to save data after all retries', {
            filePath: filePath,
            status: lastError.response?.status,
            message: lastError.message
        });
        return { success: false, error: lastError.message };
    }
}

module.exports = new GitHubSync();
