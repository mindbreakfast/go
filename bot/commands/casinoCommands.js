const database = require('../../database/database');

// Все что связано с казино: /add_casino, /list_casinos, /edit_casino
// Переносим сюда функции работы с казино

module.exports = {
    handleAddCasinoCommand,
    handleListCasinosCommand,
    handleEditCasinoCommand,
    handleCasinoCreationStep,
    handleCasinoEditResponse
};
