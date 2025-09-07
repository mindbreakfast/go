const simpleGit = require('simple-git');
const fs = require('fs').promises;

async function backupToGitHub() {
    try {
        const git = simpleGit();
        
        // Проверяем изменения
        const status = await git.status();
        
        if (status.modified.length > 0 || status.not_added.length > 0) {
            await git.addConfig('user.name', 'mindbreakfast');
            await git.addConfig('user.email', 'homegamego@gmail.com');
            
            await git.add('.');
            await git.commit('Auto-backup: ' + new Date().toISOString());
            await git.push('origin', 'main');
            
            console.log('✅ Резервная копия отправлена в GitHub');
            return true;
        } else {
            console.log('ℹ️ Изменений нет, бэкап не требуется');
            return false;
        }
    } catch (error) {
        console.error('❌ Ошибка бэкапа в GitHub:', error);
        return false;
    }
}

// Запускаем бэкап если файл вызван напрямую
if (require.main === module) {
    backupToGitHub().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { backupToGitHub };
