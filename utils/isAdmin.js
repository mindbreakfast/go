const config = require('../config'); // Меняем с '../../config' на '../config'

function isAdmin(userId) {
    return config.ADMINS.includes(Number(userId));
}

module.exports = { isAdmin };
