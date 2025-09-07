const config = require('../../config');

function isAdmin(userId) {
    return config.ADMINS.includes(Number(userId));
}

module.exports = { isAdmin };
