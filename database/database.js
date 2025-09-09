const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const config = require('../config');

// Разделяем данные на 3 части
let casinos = [];
let categories = config.CATEGORIES;
let announcements = [];
let streamStatus = {
    isStreamLive: false,
    streamUrl: '',
    eventDescription: '',
    lastUpdated: new Date().toISOString()
};
let userChats = new Map();
let userSettings = new Map();
let giveaways = [];

class Database {
    constructor() {
        this.dataFilePath = path.join(__dirname, '..', 'data.json');
        this.contentFilePath = path.join(__dirname, '..', 'content.json');
        this.userDataFilePath = path.join(__dirname, '..', 'userdata.json');
    }

    async loadData() {
        console.log('🔄 Starting COMPLETE data loading from GitHub...');
        
        try {
            // 1. Загружаем ВСЕ данные из GitHub
            console.log('🌐 Loading ALL data from GitHub...');
            
            const [mainDataLoaded, contentDataLoaded, userDataLoaded] = await Promise.all([
                this.#loadFileFromGitHub('data.json', (data) => this.#processMainData(data)),
                this.#loadFileFromGitHub('content.json', (data) => this.#processContentData(data)),
                this.#loadFileFromGitHub('userdata.json', (data) => this.#processUserData(data))
            ]);

            console.log(`✅ GitHub load results: Main=${mainDataLoaded}, Content=${contentDataLoaded}, User=${userDataLoaded}`);

            // 2. Если какие-то файлы не загрузились с GitHub, пробуем локально
            if (!mainDataLoaded) {
                console.log('⚠️ Trying local main data...');
                await this.#loadMainDataFromLocal();
            }
            if (!contentDataLoaded) {
                console.log('⚠️ Trying local content data...');
                await this.#loadContentDataFromLocal();
            }
            if (!userDataLoaded) {
                console.log('⚠️ Trying local user data...');
                await this.#loadUserDataFromLocal();
            }

            console.log(`✅ FINAL: ${casinos.length} casinos, ${announcements.length} announcements, ${userChats.size} users`);
            return true;

        } catch (error) {
            console.error('❌ Error loading data:', error.message);
            return await this.initializeData();
        }
    }

    async #loadFileFromGitHub(fileName, processor) {
        if (!config.GITHUB_TOKEN) {
            console.log(`⚠️ GITHUB_TOKEN not set, skipping ${fileName}`);
            return false;
        }

        try {
            console.log(`🌐 Downloading ${fileName} from GitHub...`);
            const url = `https://api.github.com/repos/${config.GITHUB_REPO_OWNER}/${config.GITHUB_REPO_NAME}/contents/${fileName}`;
            
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `token ${config.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Ludogolik-Bot-Server'
                },
                timeout: 10000
            });

            if (response.data && response.data.content) {
                const content = Buffer.from(response.data.content, 'base64').toString('utf8');
                const parsedData = JSON.parse(content);
                
                // Обрабатываем данные
                processor(parsedData);
                
                console.log(`✅ Successfully loaded ${fileName} from GitHub`);
                return true;
            }
            return false;
            
        } catch (error) {
            if (error.response?.status === 404) {
                console.log(`⚠️ ${fileName} not found on GitHub`);
            } else {
                console.log(`❌ Failed to load ${fileName} from GitHub:`, error.message);
            }
            return false;
        }
    }

    #processMainData(parsedData) {
        casinos = parsedData.casinos || [];
        categories = parsedData.categories || config.CATEGORIES;
        console.log(`📊 Processed main data: ${casinos.length} casinos`);
    }

    #processContentData(parsedData) {
        announcements = parsedData.announcements || [];
        streamStatus = parsedData.streamStatus || streamStatus;
        console.log(`📢 Processed content data: ${announcements.length} announcements`);
    }

    #processUserData(parsedData) {
        userChats = new Map();
        if (parsedData.userChats) {
            for (const [key, value] of Object.entries(parsedData.userChats)) {
                userChats.set(Number(key), value);
            }
        }
        
        userSettings = new Map();
        if (parsedData.userSettings) {
            for (const [key, value] of Object.entries(parsedData.userSettings)) {
                userSettings.set(Number(key), value);
            }
        }
        
        giveaways = parsedData.giveaways || [];
        console.log(`👥 Processed user data: ${userSettings.size} users`);
    }

    async #loadMainDataFromLocal() {
        try {
            const data = await fs.readFile(this.dataFilePath, 'utf8');
            const parsedData = JSON.parse(data);
            casinos = parsedData.casinos || [];
            categories = parsedData.categories || config.CATEGORIES;
            console.log('📁 Loaded from local file:', casinos.length, 'casinos');
        } catch (error) {
            console.log('❌ Local data file not found, will initialize empty');
            await this.#saveMainDataLocally();
        }
    }

    async #loadContentDataFromLocal() {
        try {
            const contentData = await fs.readFile(this.contentFilePath, 'utf8');
            const parsedContent = JSON.parse(contentData);
            announcements = parsedContent.announcements || [];
            streamStatus = parsedContent.streamStatus || streamStatus;
            console.log('📁 Loaded from local file:', announcements.length, 'announcements');
        } catch (error) {
            console.log('❌ Local content file not found, will initialize empty');
            await this.saveContentData();
        }
    }

    async #loadUserDataFromLocal() {
        try {
            const userData = await fs.readFile(this.userDataFilePath, 'utf8');
            const parsedUserData = JSON.parse(userData);
            
            userChats = new Map();
            if (parsedUserData.userChats) {
                for (const [key, value] of Object.entries(parsedUserData.userChats)) {
                    userChats.set(Number(key), value);
                }
            }
            
            userSettings = new Map();
            if (parsedUserData.userSettings) {
                for (const [key, value] of Object.entries(parsedUserData.userSettings)) {
                    userSettings.set(Number(key), value);
                }
            }
            
            giveaways = parsedUserData.giveaways || [];
            console.log('📁 Loaded from local file:', userSettings.size, 'users');
        } catch (error) {
            console.log('❌ Local user file not found, will initialize empty');
            await this.saveUserData();
        }
    }

    async #saveMainDataLocally() {
        try {
            const dataToSave = {
                casinos: casinos,
                categories: categories,
                lastUpdated: new Date().toISOString()
            };
            await fs.writeFile(this.dataFilePath, JSON.stringify(dataToSave, null, 2));
            console.log('💾 Main data saved locally');
        } catch (error) {
            console.error('❌ Error saving main data locally:', error.message);
        }
    }

    async saveContentData() {
        try {
            console.log('💾 Saving content data...');
            const contentToSave = {
                announcements: announcements,
                streamStatus: streamStatus,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.contentFilePath, JSON.stringify(contentToSave, null, 2));
            console.log('✅ Content data saved locally');
            return true;
        } catch (error) {
            console.error('❌ Error saving content data:', error.message);
            return false;
        }
    }

    async saveUserData() {
        try {
            console.log('💾 Saving user data...');
            const userDataToSave = {
                userChats: Object.fromEntries(userChats),
                userSettings: Object.fromEntries(userSettings),
                giveaways: giveaways,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.userDataFilePath, JSON.stringify(userDataToSave, null, 2));
            console.log('✅ User data saved locally');
            return true;
        } catch (error) {
            console.error('❌ Error saving user data:', error.message);
            return false;
        }
    }

    async initializeData() {
        console.log('🔄 Initializing data files...');
        const initialData = {
            casinos: [],
            categories: categories,
            lastUpdated: new Date().toISOString()
        };

        const initialContent = {
            announcements: [],
            streamStatus: streamStatus,
            lastUpdated: new Date().toISOString()
        };

        const initialUserData = {
            userChats: {},
            userSettings: {},
            giveaways: [],
            lastUpdated: new Date().toISOString()
        };

        try {
            await fs.writeFile(this.dataFilePath, JSON.stringify(initialData, null, 2));
            await fs.writeFile(this.contentFilePath, JSON.stringify(initialContent, null, 2));
            await fs.writeFile(this.userDataFilePath, JSON.stringify(initialUserData, null, 2));
            
            console.log('✅ All data files created with initial structure');
            return true;
        } catch (error) {
            console.error('❌ Error creating initial data files:', error);
            return false;
        }
    }

    // ... остальные методы (getCasinos, setCasinos, trackUserAction и т.д.) ...
    // [ВСТАВЬТЕ СЮДА ВСЕ ОСТАЛЬНЫЕ МЕТОДЫ ИЗ ПРЕДЫДУЩЕЙ ВЕРСИИ]

    // Геттеры
    getCasinos() { return casinos; }
    getAnnouncements() { return announcements; }
    getUserChats() { return userChats; }
    getStreamStatus() { return streamStatus; }
    getUserSettings() { return userSettings; }
    getGiveaways() { return giveaways; }
    getCategories() { return categories; }

    // Сеттеры
    setCasinos(newCasinos) { 
        casinos = newCasinos; 
        this.saveData();
    }

    setAnnouncements(newAnnouncements) { 
        announcements = newAnnouncements; 
        this.saveContentData();
    }

    setStreamStatus(newStatus) { 
        streamStatus = { ...streamStatus, ...newStatus }; 
        this.saveContentData();
    }

    // Сохраняем ТОЛЬКО казино в GitHub
    async saveData() {
        try {
            console.log('💾 Saving main data...');
            const dataToSave = {
                casinos: casinos,
                categories: categories,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.dataFilePath, JSON.stringify(dataToSave, null, 2));
            console.log('✅ Main data saved locally');
            
            if (config.GITHUB_TOKEN) {
                try {
                    const githubSync = require('./githubSync');
                    const githubResult = await githubSync.saveDataToGitHub(
                        JSON.stringify(dataToSave, null, 2),
                        'data.json'
                    );
                    console.log('🌐 GitHub sync result:', githubResult.success);
                    return { local: true, github: githubResult.success };
                } catch (githubError) {
                    console.error('❌ GitHub sync error:', githubError.message);
                    return { local: true, github: false };
                }
            }
            
            return { local: true, github: false };

        } catch (error) {
            console.error('❌ Error saving main data:', error.message);
            return { local: false, github: false, error: error.message };
        }
    }

    // Сохраняем ВСЕ данные
    async saveAllData() {
        try {
            console.log('💾 Saving ALL data...');
            const [dataResult, contentResult, userResult] = await Promise.all([
                this.saveData(),
                this.saveContentData(),
                this.saveUserData()
            ]);
            
            console.log('✅ All data saved:', { 
                data: dataResult, 
                content: contentResult, 
                user: userResult 
            });
            return {
                data: dataResult,
                content: contentResult,
                user: userResult
            };
        } catch (error) {
            console.error('❌ Error saving all data:', error.message);
            return { error: error.message };
        }
    }
}

module.exports = new Database();
