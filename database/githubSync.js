const axios = require('axios');
const config = require('../config');

class GitHubSync {
    constructor() {
        console.log('GitHubSync initialized for repo:', config.GITHUB_REPO_OWNER + '/' + config.GITHUB_REPO_NAME);
        this.baseURL = 'https://api.github.com';
        this.headers = {
            'Authorization': `token ${config.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Ludogolik-Bot-Server'
        };
        this.owner = config.GITHUB_REPO_OWNER;
        this.repo = config.GITHUB_REPO_NAME;
        this.branch = 'main';
    }

    async #getFileSHA(filePath) {
        try {
            const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${filePath}`;
            console.log('Getting file SHA from:', url);
            const response = await axios.get(url, { 
                headers: this.headers,
                timeout: 10000
            });
            return response.data.sha;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log('File not found on GitHub, will create new');
                return null;
            }
            console.error('Error getting file SHA:', error.message);
            throw error;
        }
    }

    async saveDataToGitHub(dataJSON, filePath = 'data.json') {
        if (!config.GITHUB_TOKEN) {
            console.log('GitHubSync: GITHUB_TOKEN not set, skipping');
            return { success: false, message: 'GITHUB_TOKEN not configured' };
        }

        const MAX_RETRIES = 3;
        let retries = 0;

        while (retries < MAX_RETRIES) {
            try {
                console.log(`Starting GitHub sync for file: ${filePath} (attempt ${retries + 1})`);
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
                    timeout: 15000
                });
                
                console.log('GitHubSync: Success! File:', filePath);
                return { success: true, commit: response.data.commit };

            } catch (error) {
                if (error.response?.status === 409 && retries < MAX_RETRIES - 1) {
                    // Конфликт версий - пробуем еще раз
                    retries++;
                    console.log(`⚠️ 409 conflict, retrying in 2s... (${retries}/${MAX_RETRIES})`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
                
                console.error('GitHubSync: Failed to save data:', error.message);
                if (error.response?.data) {
                    console.error('GitHubSync: Error details:', JSON.stringify(error.response.data));
                }
                return { success: false, error: error.message };
            }
        }
        
        return { success: false, error: 'Max retries exceeded' };
    }
}

module.exports = new GitHubSync();
