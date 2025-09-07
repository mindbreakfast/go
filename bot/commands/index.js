console.log('✅ Commands index loaded');
const adminCommands = require('./adminCommands');
const casinoCommands = require('./casinoCommands');
const userCommands = require('./userCommands');
const referralCommands = require('./referralCommands');

module.exports = {
    ...adminCommands,
    ...casinoCommands, 
    ...userCommands,
    ...referralCommands
};
