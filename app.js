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

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadInitialData() {
    try {
        const tg = window.Telegram?.WebApp;
        const currentUserId = tg?.initDataUnsafe?.user?.id || 'anonymous';
        
        const [casinosData, userData] = await Promise.all([
            fetch('https://go-5zty.onrender.com/api/all-data').then(r => {
                if (!r.ok) throw new Error('Ошибка загрузки данных');
                return r.json();
            }),
            fetch(`https://go-5zty.onrender.com/api/user-data?userId=${currentUserId}`)
                .then(r => r.json())
                .catch(e => ({}))
        ]);

        allCasinos = casinosData.casinos || [];
        renderFilters(casinosData.categories || []);
        
        userHiddenCasinos = userData.hiddenCasinos || [];
        userViewMode = userData.viewMode || 'full';
        userId = currentUserId;
        isApproved = userData.approvedForLive || false;
        
        document.getElementById('userIdDisplay').textContent = `ID: ${userId}`;
        renderCasinos();
        updateLiveRooms();

        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
            const user = tg.initDataUnsafe.user;
            fetch('https://go-5zty.onrender.com/track-visit', {
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

// ===== ОТОБРАЖЕНИЕ АНОНСОВ =====
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

// ===== БАННЕРЫ =====
function showStreamBanner(status) {
    const banner = document.getElementById('streamBanner');
    const streamLink = document.getElementById('streamLink');
    const streamDescription = document.getElementById('streamDescription');
    
    if (banner && streamLink && status.streamUrl) {
        banner.style.display = 'block';
        streamLink.href = status.streamUrl;
        streamDescription.textContent = status.eventDescription || 'Присоединяйтесь к стриму!';
        
        streamLink.onclick = function(e) {
            e.preventDefault();
            openLink(e, this.href);
        };
    }
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====
function setupEventListeners() {
    document.getElementById('themeSwitcher').addEventListener('click', toggleTheme);
    
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearchQuery = e.target.value.toLowerCase().trim();
            renderCasinos();
        }, 300);
    });
    
    document.querySelectorAll('.footer-link, .developer-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            openLink(e, this.href);
        });
    });
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function showError(message) {
    const container = document.getElementById('casinoList');
    if (container) {
        container.innerHTML = `
            <div class="error-message">
                <p>${message}</p>
                <button class="btn btn-primary" onclick="location.reload()">
                    Попробовать снова
                </button>
            </div>
        `;
    }
}

function openCasino(casinoId, viewMode) {
    const casino = allCasinos.find(c => c.id === casinoId);
    if (!casino) return;

    incrementClickCount(casinoId);
    
    if (viewMode === 'compact') {
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.openLink(casino.url);
            window.Telegram.WebApp.close();
        } else {
            window.open(casino.url, '_blank');
        }
    } else {
        copyPromoCode(casinoId, casino.promocode);
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.openLink(casino.url);
        } else {
            window.open(casino.url, '_blank');
        }
    }
}

function copyPromoCode(casinoId, promocode) {
    navigator.clipboard.writeText(promocode).then(() => {
        const promoElement = document.querySelector(`.casino-card[data-id="${casinoId}"] .promo-code`);
        if (promoElement) {
            promoElement.classList.add('copied');
            promoElement.textContent = '✓ Скопировано!';
            setTimeout(() => {
                promoElement.classList.remove('copied');
                promoElement.textContent = promocode;
            }, 2000);
        }
    }).catch(err => {
        console.error('Ошибка копирования:', err);
    });
}

function toggleDetails(casinoId) {
    const detailsElement = document.getElementById(`details-${casinoId}`);
    if (detailsElement) {
        detailsElement.style.display = detailsElement.style.display === 'none' ? 'block' : 'none';
    }
}

// ===== СИСТЕМА СКРЫТИЯ КАЗИНО =====
function startHideTimer(casinoId, event) {
    if (hidePressTimer) clearTimeout(hidePressTimer);
    currentHideCandidate = casinoId;
    
    hidePressTimer = setTimeout(() => {
        showHideConfirmation(casinoId);
    }, 1000);
}

function cancelHideTimer() {
    if (hidePressTimer) {
        clearTimeout(hidePressTimer);
        hidePressTimer = null;
    }
    currentHideCandidate = null;
}

function showHideConfirmation(casinoId) {
    const casino = allCasinos.find(c => c.id === casinoId);
    if (!casino) return;
    
    const card = document.querySelector(`.casino-card[data-id="${casinoId}"]`);
    if (!card) return;
    
    card.classList.add('hide-confirm');
    card.innerHTML = `
        <div class="casino-header">
            <div class="casino-name">${casino.name}</div>
        </div>
        <p>Скрыть это казино из списка?</p>
        <div class="hide-confirm-buttons">
            <button class="btn btn-primary" onclick="confirmHideCasino(${casinoId})">Да</button>
            <button class="btn btn-outline" onclick="cancelHideCasino(${casinoId})">Нет</button>
        </div>
    `;
}

function confirmHideCasino(casinoId) {
    userHiddenCasinos.push(casinoId);
    saveUserSettings();
    renderCasinos();
}

function cancelHideCasino(casinoId) {
    const card = document.querySelector(`.casino-card[data-id="${casinoId}"]`);
    if (card) {
        card.classList.remove('hide-confirm');
    }
    renderCasinos();
}

function showHiddenCasinos() {
    userHiddenCasinos = [];
    saveUserSettings();
    renderCasinos();
}

// ===== РЕЖИМЫ ПРОСМОТРА =====
function toggleViewMode() {
    userViewMode = userViewMode === 'full' ? 'compact' : 'full';
    saveUserSettings();
    renderCasinos();
    
    const modeButton = document.getElementById('viewModeToggle');
    if (modeButton) {
        modeButton.textContent = userViewMode === 'full' ? '📱 Компактный' : '📋 Полный';
    }
}

// ===== ЛАЙВ КОМНАТЫ =====
function updateLiveRooms() {
    const privateRoomContent = document.getElementById('privateRoomContent');
    if (!privateRoomContent) return;
    
    if (isApproved) {
        privateRoomContent.innerHTML = `
            <p>Доступ одобрен ✅</p>
            <button class="btn btn-primary" onclick="openLink(event, 'https://meet.google.com/xes-fsxv-gun')">
                ПЕРЕЙТИ В КОМНАТУ
            </button>
        `;
    } else {
        privateRoomContent.innerHTML = `
            <p>Доступ требуется запросить у админа</p>
            <button class="btn btn-outline" onclick="requestApproval()">
                📝 Получить одобрение
            </button>
        `;
    }
}

function requestApproval() {
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openTelegramLink('https://t.me/LudogolikClickBot?start=approval');
    } else {
        alert('Откройте бота @LudogolikClickBot и запросите одобрение');
    }
}

// ===== РЕФЕРАЛЬНАЯ СИСТЕМА =====
function copyReferralLink() {
    if (!userId || userId === 'anonymous') {
        return; // Не показываем alert
    }
    
    const referralLink = `https://t.me/Ludogol_bot?start=ref${userId}`;
    navigator.clipboard.writeText(referralLink).then(() => {
        // Создаем красивое уведомление как у промокодов
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--promo-bg);
            color: var(--promo-text);
            padding: 10px 20px;
            border-radius: 20px;
            font-weight: bold;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        notification.textContent = '✓ Реферальная ссылка скопирована!';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
    }).catch(err => {
        console.error('Ошибка копирования:', err);
    });
}

// ===== СОХРАНЕНИЕ НАСТРОЕК =====
async function saveUserSettings() {
    if (!userId || userId === 'anonymous') return;
    
    try {
        await fetch('https://go-5zty.onrender.com/api/save-user-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                hiddenCasinos: userHiddenCasinos,
                viewMode: userViewMode
            })
        });
    } catch (error) {
        console.log('Ошибка сохранения настроек:', error);
    }
}

// Глобальные функции
window.openCasino = openCasino;
window.toggleDetails = toggleDetails;
window.copyPromoCode = copyPromoCode;
window.openLink = openLink;
window.startHideTimer = startHideTimer;
window.cancelHideTimer = cancelHideTimer;
window.confirmHideCasino = confirmHideCasino;
window.cancelHideCasino = cancelHideCasino;
window.showHiddenCasinos = showHiddenCasinos;
window.toggleViewMode = toggleViewMode;
window.requestApproval = requestApproval;
window.copyReferralLink = copyReferralLink;
