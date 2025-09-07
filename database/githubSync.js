const axios = require('axios');
const config = require('../config');

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
        this.filePath = 'data.json';
        this.branch = 'main';
    }

    async #getFileSHA() {
        try {
            const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${this.filePath}`;
            const response = await axios.get(url, { headers: this.headers });
            return response.data.sha;
        } catch (error) {
            // Если файл не найден (404), значит его еще нет, SHA не нужен для создания.
            if (error.response && error.response.status === 404) {
                return null;
            }
            console.error('GitHubSync: Error getting file SHA:', error.message);
            throw error;
        }
    }

    async saveDataToGitHub(dataJSON) {
           console.log('GITHUB_TOKEN exists:', !!config.GITHUB_TOKEN);
    console.log('Repo:', config.GITHUB_REPO_OWNER + '/' + config.GITHUB_REPO_NAME);
        // Если токен не задан, пропускаем синхронизацию с GitHub
        if (!config.GITHUB_TOKEN) {
            console.log('GitHubSync: GITHUB_TOKEN not set, skipping upload.');
            return { success: false, message: 'GITHUB_TOKEN not configured' };
        }

        try {
            const content = Buffer.from(dataJSON).toString('base64');
            const sha = await this.#getFileSHA();
            const message = `Auto-update: ${new Date().toISOString()}`;

            const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${this.filePath}`;

            const payload = {
                message: message,
                content: content,
                branch: this.branch,
                committer: config.GITHUB_COMMITTER
            };

            // Если файл существует, добавляем его SHA для обновления
            if (sha) {
                payload.sha = sha;
            }

            const response = await axios.put(url, payload, { headers: this.headers });

            console.log('GitHubSync: Data successfully committed to GitHub.');
            console.log('GitHubSync: Commit SHA:', response.data.commit.sha);
            return { success: true, commit: response.data.commit };

        } catch (error) {
            console.error('GitHubSync: Failed to save data to GitHub:', error.message);
            if (error.response) {
                console.error('GitHubSync: Error response data:', error.response.data);
            }
            return { success: false, error: error.message };
        }
    }
}

module.exports = new GitHubSync(); // Экспортируем экземпляр
