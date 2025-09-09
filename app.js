// ===== ПЕРЕМЕННЫЕ =====
let allCasinos = [];
let activeFilters = new Set();
let currentSearchQuery = '';
let userClickStats = {};
let userHiddenCasinos = [];
let userViewMode = 'full';
let userId = null;
let isApproved = false;

// ===== ТАЙМЕРЫ =====
let hidePressTimer = null;
let currentHideCandidate = null;
let searchTimeout = null;
let saveTimeout = null;

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadUserStats();
    loadInitialData();
    setupEventListeners();
});

// ===== ТЕМНАЯ ТЕМА =====
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    document.body.classList.toggle('theme-dark', isDark);
    document.getElementById('themeSwitcher').textContent = isDark ? '☀️ Светлая тема' : '🌙 Тёмная тема';
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('theme-dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('themeSwitcher').textContent = isDark ? '☀️ Светлая тема' : '🌙 Тёмная тема';
    debouncedSaveSettings();
}

// ===== ОТКРЫТИЕ ССЫЛОК БЕЗ ЗАКРЫТИЯ WEBAPP =====
function openLink(event, url) {
    event.preventDefault();
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openLink(url);
    } else {
        window.open(url, '_blank');
    }
    return false;
}

// ===== СТАТИСТИКА КЛИКОВ =====
function loadUserStats() {
    userClickStats = JSON.parse(localStorage.getItem('userClickStats') || '{}');
}

function saveUserStats() {
    localStorage.setItem('userClickStats', JSON.stringify(userClickStats));
}

function incrementClickCount(casinoId) {
    userClickStats[casinoId] = (userClickStats[casinoId] || 0) + 1;
    saveUserStats();
    
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const user = window.Telegram.WebApp.initDataUnsafe.user;
        fetch('https://go-5zty.onrender.com/track-click', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: user.id,
                userInfo: user,
                casinoId: casinoId,
                action: 'click'
            })
        }).catch(error => console.log('Ошибка отправки статистики:', error));
    }
}

// ===== DEBOUNCED СОХРАНЕНИЕ НАСТРОЕК =====
function debouncedSaveSettings() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveUserSettings, 2000);
}

async function saveUserSettings() {
    if (userId && userId !== 'anonymous') {
        try {
            const response = await fetch('https://go-5zty.onrender.com/api/save-user-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    hiddenCasinos: userHiddenCasinos,
                    viewMode: userViewMode
                })
            });
            
            const result = await response.json();
            console.log('Settings save result:', result);
            
            if (!response.ok) {
                console.log('Ошибка сохранения настроек');
            }
        } catch (error) {
            console.log('Ошибка сохранения настроек:', error);
        }
    }
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadInitialData() {
    try {
        const tg = window.Telegram?.WebApp;
        const currentUserId = tg?.initDataUnsafe?.user?.id || 'anonymous';
        
        console.log('Loading data for user:', currentUserId);
        
        const [casinosData, userData] = await Promise.all([
            fetch('https://go-5zty.onrender.com/api/all-data').then(r => {
                if (!r.ok) throw new Error('Ошибка загрузки данных');
                return r.json();
            }),
            fetch(`https://go-5zty.onrender.com/api/user-data?userId=${currentUserId}`)
                .then(r => r.json())
                .catch(e => {
                    console.log('User data load error, using defaults');
                    return { hiddenCasinos: [], viewMode: 'full', approvedForLive: false };
                })
        ]);

        console.log('Loaded data:', {
            casinos: casinosData.casinos?.length,
            announcements: casinosData.announcements?.length,
            streamLive: casinosData.streamStatus?.isStreamLive,
            userSettings: userData
        });

        allCasinos = casinosData.casinos || [];
        renderFilters(casinosData.categories || []);
        
        // ПОКАЗЫВАЕМ АНОНСЫ И СТРИМ
        showAnnouncements(casinosData.announcements || []);
        updateStreamStatus(casinosData.streamStatus);
        
        userHiddenCasinos = userData.hiddenCasinos || [];
        userViewMode = userData.viewMode || 'full';
        userId = currentUserId;
        isApproved = userData.approvedForLive || false;
        
        document.getElementById('userIdDisplay').textContent = `ID: ${userId}`;
        renderCasinos();
        updateLiveRooms();

        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
            const user = tg.initDataUnsafe.user;
            fetch('https://go-5zty.onrender.com/api/track-visit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.id,
                    userInfo: user,
                    action: 'visit'
                })
            }).catch(error => console.log('Ошибка отправки статистики:', error));
        }

    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showError('Ошибка при загрузке данных. Попробуйте обновить страницу.');
    }
}

// ===== ОТОБРАЖЕНИЕ АНОНСОВ И СТРИМА =====
function showAnnouncements(announcements) {
    const container = document.getElementById('announcementsContainer');
    if (!announcements || announcements.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = announcements.map(announcement => `
        <div class="announcement-banner announcement-${announcement.color || 'blue'}">
            ${announcement.text}
        </div>
    `).join('');
}

function updateStreamStatus(streamStatus) {
    const streamBanner = document.getElementById('streamBanner');
    const streamLink = document.getElementById('streamLink');
    const streamDescription = document.getElementById('streamDescription');
    
    if (streamStatus && streamStatus.isStreamLive && streamStatus.streamUrl) {
        streamBanner.style.display = 'block';
        streamLink.href = streamStatus.streamUrl;
        streamDescription.textContent = streamStatus.eventDescription || 'Идет прямой эфир!';
    } else {
        streamBanner.style.display = 'none';
    }
}

// ===== ПОИСК И ФИЛЬТРАЦИЯ =====
function filterCasinos() {
    return allCasinos.filter(casino => {
        const matchesSearch = currentSearchQuery === '' || 
            casino.name.toLowerCase().includes(currentSearchQuery) ||
            (casino.hiddenKeywords && casino.hiddenKeywords.some(kw => 
                kw.toLowerCase().includes(currentSearchQuery)
            ));

        const matchesCategory = activeFilters.size === 0 || 
            (casino.category && activeFilters.has(casino.category));

        const notHidden = !userHiddenCasinos.includes(casino.id);
        
        return matchesSearch && matchesCategory && casino.isActive && notHidden;
    });
}

function sortCasinos(casinos) {
    return casinos.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        
        const aClicks = userClickStats[a.id] || 0;
        const bClicks = userClickStats[b.id] || 0;
        if (aClicks !== bClicks) return bClicks - aClicks;
        
        return a.id - b.id;
    });
}

// ===== РЕНДЕРИНГ ИНТЕРФЕЙСА =====
function renderFilters(categories) {
    const container = document.getElementById('filtersContainer');
    if (!container) return;

    const filteredCategories = categories.filter(cat => cat.id !== 'other');

    container.innerHTML = filteredCategories.map(cat => `
        <div class="filter-chip" data-category="${cat.id}">
            ${cat.name}
        </div>
    `).join('');

    container.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const category = chip.getAttribute('data-category');
            chip.classList.toggle('active');
            
            if (chip.classList.contains('active')) {
                activeFilters.add(category);
            } else {
                activeFilters.delete(category);
            }
            
            renderCasinos();
        });
    });
}

function renderCasinos() {
    const container = document.getElementById('casinoList');
    if (!container) return;

    const filteredCasinos = filterCasinos();
    const sortedCasinos = sortCasinos(filteredCasinos);

    if (sortedCasinos.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                Ничего не найдено
                ${userHiddenCasinos.length > 0 ? 
                    '<button class="btn btn-outline" onclick="showHiddenCasinos()">Показать скрытые</button>' : 
                    ''
                }
            </div>
        `;
        return;
    }

    container.innerHTML = sortedCasinos.map(casino => `
        <div class="casino-card ${userViewMode === 'compact' ? 'compact' : ''}" 
             data-id="${casino.id}"
             onmousedown="startHideTimer(${casino.id}, event)"
             onmouseup="cancelHideTimer()"
             onmouseleave="cancelHideTimer()"
             ontouchstart="startHideTimer(${casino.id}, event)"
             ontouchend="cancelHideTimer()"
             ontouchcancel="cancelHideTimer()">
            
            <div class="casino-header">
                <div class="casino-name">${casino.name}</div>
                ${userViewMode === 'full' ? `
                <div class="promo-code" onclick="copyPromoCode(${casino.id}, '${casino.promocode}')">
                    ${casino.promocode}
                </div>
                ` : ''}
            </div>
            
            ${userViewMode === 'full' ? `
            <div class="promo-description">
                ${casino.shortDescription}
            </div>

            <div class="action-buttons">
                <button class="btn btn-primary" onclick="openCasino(${casino.id}, '${userViewMode}')">
                    ПЕРЕЙТИ
                </button>
                ${casino.fullDescription ? `
                <button class="btn btn-outline" onclick="toggleDetails(${casino.id})">
                    ℹ️ Подробнее
                </button>
                ` : ''}
            </div>

            ${casino.fullDescription ? `
            <div class="casino-details" id="details-${casino.id}" style="display: none;">
                <p>${casino.fullDescription}</p>
            </div>
            ` : ''}
            ` : `
            <div class="action-buttons">
                <button class="btn btn-primary" onclick="openCasino(${casino.id}, '${userViewMode}')">
                    ПЕРЕЙТИ
                </button>
            </div>
            `}
        </div>
    `).join('');

    if (userHiddenCasinos.length > 0) {
        container.innerHTML += `
            <div class="show-hidden-container">
                <button class="btn btn-outline" onclick="showHiddenCasinos()">
                    👻 Показать скрытые (${userHiddenCasinos.length})
                </button>
            </div>
        `;
    }
}

// ===== УПРАВЛЕНИЕ КАЗИНО =====
function startHideTimer(casinoId, event) {
    if (event.type === 'touchstart') {
        event.preventDefault();
    }
    
    currentHideCandidate = casinoId;
    hidePressTimer = setTimeout(() => {
        showHideConfirmation(casinoId);
    }, 1000);
}

function cancelHideTimer() {
    clearTimeout(hidePressTimer);
    currentHideCandidate = null;
}

function showHideConfirmation(casinoId) {
    const casinoCard = document.querySelector(`.casino-card[data-id="${casinoId}"]`);
    if (casinoCard) {
        casinoCard.classList.add('hide-confirm');
        casinoCard.innerHTML += `
            <div class="hide-confirm-buttons">
                <button class="btn btn-outline" onclick="hideCasino(${casinoId})">
                    ✅ Скрыть
                </button>
                <button class="btn btn-outline" onclick="cancelHide(${casinoId})">
                    ❌ Отмена
                </button>
            </div>
        `;
    }
}

function hideCasino(casinoId) {
    if (!userHiddenCasinos.includes(casinoId)) {
        userHiddenCasinos.push(casinoId);
        renderCasinos();
        debouncedSaveSettings();
    }
}

function cancelHide(casinoId) {
    const casinoCard = document.querySelector(`.casino-card[data-id="${casinoId}"]`);
    if (casinoCard) {
        casinoCard.classList.remove('hide-confirm');
        renderCasinos();
    }
}

function showHiddenCasinos() {
    userHiddenCasinos = [];
    renderCasinos();
    debouncedSaveSettings();
}

function toggleViewMode() {
    userViewMode = userViewMode === 'full' ? 'compact' : 'full';
    renderCasinos();
    debouncedSaveSettings();
}

function toggleDetails(casinoId) {
    const details = document.getElementById(`details-${casinoId}`);
    if (details) {
        details.style.display = details.style.display === 'none' ? 'block' : 'none';
    }
}

function copyPromoCode(casinoId, promocode) {
    navigator.clipboard.writeText(promocode).then(() => {
        const promoElement = document.querySelector(`.casino-card[data-id="${casinoId}"] .promo-code`);
        if (promoElement) {
            promoElement.classList.add('copied');
            promoElement.textContent = '✅ Скопировано!';
            setTimeout(() => {
                promoElement.classList.remove('copied');
                promoElement.textContent = promocode;
            }, 2000);
        }
    });
}

function openCasino(casinoId, viewMode) {
    const casino = allCasinos.find(c => c.id === casinoId);
    if (casino && casino.url) {
        incrementClickCount(casinoId);
        openLink(event, casino.url);
    }
}

// ===== ЛАЙВ КОМНАТЫ =====
function updateLiveRooms() {
    const privateRoomContent = document.getElementById('privateRoomContent');
    if (privateRoomContent) {
        if (isApproved) {
            privateRoomContent.innerHTML = `
                <p>Доступ открыт! Присоединяйтесь к приватному голосовому чату</p>
                <button class="btn btn-primary" onclick="openLink(event, 'https://meet.google.com/xxx-xxxx-xxx')">
                    ПЕРЕЙТИ В ПРИВАТНУЮ КОМНАТУ
                </button>
            `;
        } else {
            privateRoomContent.innerHTML = `
                <p>Доступ к приватной комнате только для одобренных пользователей</p>
                <button class="btn btn-outline" onclick="requestApproval()">
                    🚀 Запросить доступ
                </button>
            `;
        }
    }
}

function requestApproval() {
    if (userId && userId !== 'anonymous') {
        fetch('https://go-5zty.onrender.com/api/request-approval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                username: `@user${userId}`
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'ok') {
                alert('✅ Запрос на доступ отправлен админам! Ожидайте одобрения.');
            } else {
                alert('❌ Ошибка при отправке запроса');
            }
        })
        .catch(error => {
            console.error('Error requesting approval:', error);
            alert('❌ Ошибка при отправке запроса');
        });
    }
}

// ===== РЕФЕРАЛЬНАЯ СИСТЕМА =====
function copyReferralLink() {
    if (userId && userId !== 'anonymous') {
        const referralLink = `https://t.me/Ludogol_bot?start=ref${userId}`;
        navigator.clipboard.writeText(referralLink).then(() => {
            alert('✅ Реферальная ссылка скопирована!\n\nДелитесь с друзьями и получайте бонусы!');
        }).catch(err => {
            console.error('Error copying referral link:', err);
            alert('❌ Ошибка при копировании ссылки');
        });
    } else {
        alert('⚠️ Войдите в аккаунт чтобы получить реферальную ссылку');
    }
}

// ===== ПОИСК =====
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentSearchQuery = e.target.value.toLowerCase();
                renderCasinos();
            }, 300);
        });
    }

    const themeSwitcher = document.getElementById('themeSwitcher');
    if (themeSwitcher) {
        themeSwitcher.addEventListener('click', toggleTheme);
    }
}

// ===== УТИЛИТЫ =====
function showError(message) {
    const container = document.getElementById('casinoList');
    if (container) {
        container.innerHTML = `
            <div class="error-message">
                ${message}
                <button class="btn btn-outline" onclick="location.reload()">
                    🔄 Обновить страницу
                </button>
            </div>
        `;
    }
}

// ===== ГЛОБАЛЬНЫЕ ФУНКЦИИ =====
window.toggleTheme = toggleTheme;
window.openLink = openLink;
window.startHideTimer = startHideTimer;
window.cancelHideTimer = cancelHideTimer;
window.hideCasino = hideCasino;
window.cancelHide = cancelHide;
window.showHiddenCasinos = showHiddenCasinos;
window.toggleViewMode = toggleViewMode;
window.toggleDetails = toggleDetails;
window.copyPromoCode = copyPromoCode;
window.openCasino = openCasino;
window.requestApproval = requestApproval;
window.copyReferralLink = copyReferralLink;
