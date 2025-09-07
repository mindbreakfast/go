console.log('✅ casinoCommands loaded');
const config = require('../config');
const database = require('../database/database');
const { isAdmin } = require('../utils/isAdmin');

const ADD_CASINO_STEPS = {
    NAME: 'name',
    PROMOCODE: 'promocode',
    SHORT_DESC: 'short_desc',
    FULL_DESC: 'full_desc',
    URL: 'url',
    CATEGORY: 'category',
    KEYWORDS: 'keywords',
    CONFIRM: 'confirm'
};

function getNextCasinoId() {
    const casinos = database.getCasinos();
    return casinos.length > 0 ? Math.max(...casinos.map(c => c.id)) + 1 : 1;
}

function getCasino(id) {
    return database.getCasinos().find(c => c.id === id);
}

function handleAddCasinoCommand(bot, msg, casinoEditingState) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const response = startCasinoCreation(msg.from.id, casinoEditingState);
    bot.sendMessage(msg.chat.id, response);
}

function startCasinoCreation(userId, casinoEditingState) {
    casinoEditingState.set(userId, {
        step: ADD_CASINO_STEPS.NAME,
        data: {}
    });
    return 'Введите название казино:';
}

async function handleCasinoCreationStep(bot, msg, casinoEditingState) {
    const state = casinoEditingState.get(msg.from.id);
    if (!state) return;

    let response = null;

    switch (state.step) {
        case ADD_CASINO_STEPS.NAME:
            state.data.name = msg.text;
            state.step = ADD_CASINO_STEPS.PROMOCODE;
            response = 'Введите промокод:';
            break;

        case ADD_CASINO_STEPS.PROMOCODE:
            state.data.promocode = msg.text;
            state.step = ADD_CASINO_STEPS.SHORT_DESC;
            response = 'Введите краткое описание:';
            break;

        case ADD_CASINO_STEPS.SHORT_DESC:
            state.data.shortDescription = msg.text;
            state.step = ADD_CASINO_STEPS.FULL_DESC;
            response = 'Введите полное описание (или "пропустить"):';
            break;

        case ADD_CASINO_STEPS.FULL_DESC:
            state.data.fullDescription = msg.text === 'пропустить' ? '' : msg.text;
            state.step = ADD_CASINO_STEPS.URL;
            response = 'Введите URL ссылку:';
            break;

        case ADD_CASINO_STEPS.URL:
            state.data.url = msg.text;
            state.step = ADD_CASINO_STEPS.CATEGORY;
            const categoriesList = config.CATEGORIES.map(c => `${c.id} - ${c.name}`).join('\n');
            response = `Выберите категорию:\n${categoriesList}`;
            break;

        case ADD_CASINO_STEPS.CATEGORY:
            state.data.category = msg.text;
            state.step = ADD_CASINO_STEPS.KEYWORDS;
            response = 'Введите ключевые слова через запятую (или "пропустить"):';
            break;

        case ADD_CASINO_STEPS.KEYWORDS:
            state.data.hiddenKeywords = msg.text === 'пропустить' ? [] : msg.text.split(',').map(k => k.trim());
            state.step = ADD_CASINO_STEPS.CONFIRM;

            response = `
Название: ${state.data.name}
Промокод: ${state.data.promocode}
Описание: ${state.data.shortDescription}
Ссылка: ${state.data.url}
Категория: ${state.data.category}
Ключевые слова: ${state.data.hiddenKeywords.join(', ')}

Для подтверждения введите "да", для отмены "нет"`;
            break;

        case ADD_CASINO_STEPS.CONFIRM:
            if (msg.text.toLowerCase() === 'да') {
                const casinos = database.getCasinos();
                const newCasino = {
                    id: getNextCasinoId(),
                    ...state.data,
                    isActive: true,
                    isPinned: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                casinos.push(newCasino);
                database.setCasinos(casinos);

                await database.saveData();
                casinoEditingState.delete(msg.from.id);
                response = `✅ Казино добавлено! ID: ${newCasino.id}`;
            } else {
                casinoEditingState.delete(msg.from.id);
                response = '❌ Добавление отменено';
            }
            break;
    }

    if (response) {
        bot.sendMessage(msg.chat.id, response);
    }
}

async function handleListCasinosCommand(bot, msg) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команды!');
    }

    const casinos = database.getCasinos();
    if (casinos.length === 0) {
        return bot.sendMessage(msg.chat.id, '📝 Список казино пуст');
    }

    const chunkSize = 10;
    for (let i = 0; i < casinos.length; i += chunkSize) {
        const chunk = casinos.slice(i, i + chunkSize);
        const casinoList = chunk.map(c =>
            `🎰 ID: ${c.id} - ${c.name}\n🎫 Промо: ${c.promocode}\n🏷️ Категория: ${c.category}\n🔗 ${c.url}\n──────────────────`
        ).join('\n');

        const message = i === 0 ?
            `📝 Список казино (${casinos.length}):\n\n${casinoList}` :
            `Продолжение (${i+1}-${Math.min(i+chunkSize, casinos.length)}):\n\n${casinoList}`;

        await bot.sendMessage(msg.chat.id, message);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

function handleEditCasinoCommand(bot, msg, match) {
    if (!isAdmin(msg.from.id)) {
        return bot.sendMessage(msg.chat.id, '❌ Нет прав для выполнения этой команда!');
    }

    const id = parseInt(match[1]);
    const casino = getCasino(id);

    if (!casino) {
        return bot.sendMessage(msg.chat.id, `❌ Казино с ID ${id} не найдено`);
    }

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✏️ Название', callback_data: `edit_name_${id}` },
                    { text: '🎫 Промокод', callback_data: `edit_promo_${id}` }
                ],
                [
                    { text: '📝 Описание', callback_data: `edit_desc_${id}` },
                    { text: '🔗 Ссылка', callback_data: `edit_url_${id}` }
                ],
                [
                    { text: '🏷️ Категория', callback_data: `edit_category_${id}` },
                    { text: '📌 Закрепить', callback_data: `pin_${id}` },
                    { text: '👻 Скрыть', callback_data: `hide_${id}` }
                ],
                [
                    { text: '🚫 Удалить', callback_data: `delete_${id}` }
                ]
            ]
        }
    };

    bot.sendMessage(msg.chat.id,
        `Редактирование: ${casino.name} (ID: ${casino.id})\nВыберите действие:`,
        keyboard
    ).catch(error => {
        console.log('Error with keyboard:', error);
        bot.sendMessage(msg.chat.id,
            `Редактирование: ${casino.name} (ID: ${casino.id})\nКнопки не доступны. Используйте команды:\n/edit_name_${id}\n/edit_promo_${id} и т.д.`
        );
    });
}

async function handleCallbackQuery(bot, query, casinoEditingState) {
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
        if (data.startsWith('edit_')) {
            const [action, id] = data.split('_').slice(1);
            const casinoId = parseInt(id);

            casinoEditingState.set(chatId, {
                editingCasinoId: casinoId,
                editingField: action
            });

            const fieldNames = {
                name: 'название',
                promo: 'промокод',
                desc: 'краткое описание',
                url: 'URL ссылку',
                category: 'категорию'
            };

            await bot.sendMessage(chatId, `Введите новое значение для ${fieldNames[action]}:`);
        }
        else if (data.startsWith('delete_')) {
            const casinoId = parseInt(data.split('_')[1]);
            const casinos = database.getCasinos();
            const index = casinos.findIndex(c => c.id === casinoId);

            if (index !== -1) {
                const deleted = casinos.splice(index, 1)[0];
                database.setCasinos(casinos);
                await database.saveData();
                await bot.sendMessage(chatId, `✅ Казино "${deleted.name}" удалено!`);
            } else {
                await bot.sendMessage(chatId, '❌ Казино не найдено');
            }
        }
        else if (data.startsWith('pin_')) {
            const casinoId = parseInt(data.split('_')[1]);
            const casino = getCasino(casinoId);
            const casinos = database.getCasinos();
            const index = casinos.findIndex(c => c.id === casinoId);

            if (index !== -1) {
                casinos[index].isPinned = !casinos[index].isPinned;
                database.setCasinos(casinos);
                await database.saveData();
                await bot.sendMessage(chatId,
                    `✅ Казино "${casinos[index].name}" ${casinos[index].isPinned ? 'закреплено' : 'откреплено'}!`
                );
            }
        }
        else if (data.startsWith('hide_')) {
            const casinoId = parseInt(data.split('_')[1]);
            const casinos = database.getCasinos();
            const index = casinos.findIndex(c => c.id === casinoId);

            if (index !== -1) {
                casinos[index].isActive = false;
                database.setCasinos(casinos);
                await database.saveData();
                await bot.sendMessage(chatId, `✅ Казино "${casinos[index].name}" скрыто!`);
            }
        }

        await bot.answerCallbackQuery(query.id);
    } catch (error) {
        console.error('Callback error:', error);
        await bot.answerCallbackQuery(query.id, { text: '❌ Произошла ошибка' });
    }
}

async function handleCasinoEditResponse(bot, msg, casinoEditingState) {
    const state = casinoEditingState.get(msg.from.id);
    if (!state || !state.editingCasinoId) return;

    const casino = getCasino(state.editingCasinoId);
    if (!casino) {
        casinoEditingState.delete(msg.from.id);
        return bot.sendMessage(msg.from.id, '❌ Казино не найдено');
    }

    const casinos = database.getCasinos();
    const index = casinos.findIndex(c => c.id === state.editingCasinoId);
    if (index === -1) {
        casinoEditingState.delete(msg.from.id);
        return bot.sendMessage(msg.from.id, '❌ Казино не найдено');
    }

    const updates = {};
    switch (state.editingField) {
        case 'name': updates.name = msg.text; break;
        case 'promo': updates.promocode = msg.text; break;
        case 'desc': updates.shortDescription = msg.text; break;
        case 'url': updates.url = msg.text; break;
        case 'category': updates.category = msg.text; break;
    }

    casinos[index] = { ...casinos[index], ...updates, updatedAt: new Date().toISOString() };
    database.setCasinos(casinos);

    await database.saveData();
    casinoEditingState.delete(msg.from.id);

    bot.sendMessage(msg.from.id, `✅ Поле успешно обновлено!`);
}

module.exports = {
    handleAddCasinoCommand,
    handleListCasinosCommand,
    handleEditCasinoCommand,
    handleCallbackQuery,
    handleCasinoEditResponse,
