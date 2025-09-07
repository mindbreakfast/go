const fs = require('fs').promises;
const path = require('path');
const githubSync = require('./githubSync');
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
        console.log('Database files loaded');
    }

    async loadData() {
        try {
            // 1. Загружаем основные данные (казино + категории)
            console.log('Loading main data (casinos)...');
            const data = await fs.readFile(this.dataFilePath, 'utf8');
            const parsedData = JSON.parse(data);
            casinos = parsedData.casinos || [];
            categories = parsedData.categories || config.CATEGORIES;

            // 2. Загружаем контент (анонсы + стримы)
            try {
                console.log('Loading content data...');
                const contentData = await fs.readFile(this.contentFilePath, 'utf8');
                const parsedContent = JSON.parse(contentData);
                announcements = parsedContent.announcements || [];
                streamStatus = parsedContent.streamStatus || streamStatus;
            } catch (contentError) {
                console.log('Content file not found, creating new...');
                await this.saveContentData();
            }

            // 3. Загружаем данные пользователей
            try {
                console.log('Loading user data...');
                const userData = await fs.readFile(this.userDataFilePath, 'utf8');
                const parsedUserData = JSON.parse(userData);
                userChats = new Map(Object.entries(parsedUserData.userChats || {}));
                userSettings = new Map(Object.entries(parsedUserData.userSettings || {}));
                giveaways = parsedUserData.giveaways || [];
            } catch (userError) {
                console.log('User data file not found, creating new...');
                await this.saveUserData();
            }

            console.log(`Loaded: ${casinos.length} casinos, ${announcements.length} announcements, ${userChats.size} users`);
            return true;

        } catch (error) {
            console.error('Error loading data:', error);
            return await this.initializeData();
        }
    }

    async initializeData() {
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
            
            console.log('All data files created with initial structure');
            return true;
        } catch (error) {
            console.error('Error creating initial data files:', error);
            return false;
        }
    }

    // Сохраняем ТОЛЬКО казино в GitHub
    async saveData() {
        try {
            console.log('Saving casinos to GitHub...');
            const dataToSave = {
                casinos: casinos,
                categories: categories,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.dataFilePath, JSON.stringify(dataToSave, null, 2));
            
            if (config.GITHUB_TOKEN) {
                const githubResult = await githubSync.saveDataToGitHub(
                    JSON.stringify(dataToSave, null, 2),
                    'data.json' // Явно указываем файл
                );
                console.log('GitHub sync result:', githubResult.success);
                return { local: true, github: githubResult.success };
            }
            
            return { local: true, github: false };

        } catch (error) {
            console.error('Error saving main data:', error);
            return { local: false, github: false, error: error.message };
        }
    }

    // Сохраняем контент локально (без GitHub)
    async saveContentData() {
        try {
            const contentToSave = {
                announcements: announcements,
                streamStatus: streamStatus,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.contentFilePath, JSON.stringify(contentToSave, null, 2));
            console.log('Content data saved locally');
            return true;
        } catch (error) {
            console.error('Error saving content data:', error);
            return false;
        }
    }

    // Сохраняем пользователей локально
    async saveUserData() {
        try {
            const userDataToSave = {
                userChats: Object.fromEntries(userChats),
                userSettings: Object.fromEntries(userSettings),
                giveaways: giveaways,
                lastUpdated: new Date().toISOString()
            };

            await fs.writeFile(this.userDataFilePath, JSON.stringify(userDataToSave, null, 2));
            console.log('User data saved locally');
            return true;
        } catch (error) {
            console.error('Error saving user data:', error);
            return false;
        }
    }

    // Сохраняем ВСЕ данные перед деплоем
    async saveAllData() {
        try {
            console.log('Saving ALL data before deploy...');
            const [dataResult, contentResult, userResult] = await Promise.all([
                this.saveData(),
                this.saveContentData(),
                this.saveUserData()
            ]);
            
            return {
                data: dataResult,
                content: contentResult,
                user: userResult
            };
        } catch (error) {
            console.error('Error saving all data:', error);
            return { error: error.message };
        }
    }

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
        this.saveData(); // → GitHub синхронизация
    }

    setAnnouncements(newAnnouncements) { 
        announcements = newAnnouncements; 
        this.saveContentData(); // → Только локально
    }

    setStreamStatus(newStatus) { 
        streamStatus = { ...streamStatus, ...newStatus }; 
        this.saveContentData(); // → Только локально
    }
}
