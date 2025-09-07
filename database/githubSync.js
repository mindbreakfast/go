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
        this.filePath = 'data.json';
        this.branch = 'main';
    }

    async #getFileSHA() {
        try {
            const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${this.filePath}`;
            console.log('Getting file SHA from:', url);
            const response = await axios.get(url, { headers: this.headers });
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

    async saveDataToGitHub(dataJSON) {
        if (!config.GITHUB_TOKEN) {
            console.log('GitHubSync: GITHUB_TOKEN not set, skipping');
            return { success: false, message: 'GITHUB_TOKEN not configured' };
        }

        try {
            console.log('Starting GitHub sync...');
            const content = Buffer.from(dataJSON).toString('base64');
            const sha = await this.#getFileSHA();
            const message = `Auto-update: ${new Date().toISOString()}`;

            const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${this.filePath}`;
            console.log('Saving to URL:', url);

            const payload = {
                message: message,
                content: content,
                branch: this.branch,
                committer: config.GITHUB_COMMITTER
            };

            if (sha) {
                payload.sha = sha;
            }

            const response = await axios.put(url, payload, { headers: this.headers });
            console.log('GitHubSync: Success! Commit SHA:', response.data.commit.sha);
            return { success: true, commit: response.data.commit };

        } catch (error) {
            console.error('GitHubSync: Failed to save data:', error.message);
            if (error.response) {
                console.error('GitHubSync: Error response:', error.response.status, error.response.data);
            }
            return { success: false, error: error.message };
        }
    }
}

module.exports = new GitHubSync();
