const path = require('path');
const config = require(path.join(__dirname, '..', 'config'));

function isAdmin(userId) {
    return config.ADMINS.includes(Number(userId));
}

module.exports = { isAdmin };
