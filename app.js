// ===== БЕЗОПАСНОСТЬ: Функция для экранирования HTML (Защита от XSS) =====
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ===== СТАБИЛЬНОСТЬ RENDER: Динамическое определение URL API =====
const API_BASE = window.location.hostname.includes('vercel.app') 
    ? 'https://go-5zty.onrender.com'  // Бэкенд на Render
    : window.location.origin;          // Локальная разработка

console.log('🚀 API Base URL:', API_BASE);
// ===== ПЕРЕМЕННЫЕ =====
let allCasinos = [];
let activeFilters = new Set();
let currentSearchQuery = '';
let userClickStats = {};
let userHiddenCasinos = [];
let userViewMode = 'full';
let userId = null;
let isApproved = false;
let currentTheme = 'light';

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
    
    // 🔥 ПО УМОЛЧАНИЮ ТЕМНАЯ ТЕМА
    const isDark = savedTheme === 'dark' || 
                  (savedTheme === null && true) || // Всегда темная если нет сохраненной
                  (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    currentTheme = isDark ? 'dark' : 'light';
    document.body.classList.toggle('theme-dark', isDark);
    document.getElementById('themeSwitcher').textContent = isDark ? '☀️ Светлая тема' : '🌙 Тёмная тема';
    
    // Сохраняем настройку
    if (savedTheme === null) {
        localStorage.setItem('theme', 'dark');
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('theme-dark');
    currentTheme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
    document.getElementById('themeSwitcher').textContent = isDark ? '☀️ Светлая тема' : '🌙 Тёмная тема';
    debouncedSaveSettings();
}

// ===== ОТКРЫТИЕ ССЫЛОК =====
function openLink(event, url) {
    event.preventDefault();
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openLink(url);
    } else {
        window.open(url, '_blank');
    }
    return false;
}

function openVoiceRoom(event, roomType, roomUrl) {
    if (userId && userId !== 'anonymous') {
        fetch(`${API_BASE}/api/track-voice-access`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                username: `user${userId}`,
                roomType: roomType,
                userAgent: navigator.userAgent
            })
        }).catch(error => console.log('Ошибка трекинга голосовой:', error));
    }
    
    openLink(event, roomUrl);
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
        fetch(`${API_BASE}/api/track-click`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                userInfo: { id: user.id, username: user.username },
                casinoId: casinoId,
                action: 'click'
            })
        }).catch(error => console.log('Ошибка отправки статистики:', error));
    }
}

// ===== СОХРАНЕНИЕ НАСТРОЕК =====
function debouncedSaveSettings() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveUserSettings, 1000);
}

async function saveUserSettings() {
    if (userId && userId !== 'anonymous') {
        try {
            await fetch(`${API_BASE}/api/save-user-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    hiddenCasinos: userHiddenCasinos,
                    viewMode: userViewMode,
                    theme: currentTheme
                })
            });
        } catch (error) {
            console.error('Ошибка сохранения настроек:', error);
        }
    }
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadInitialData() {
    try {
        showLoadingState();
        const tg = window.Telegram?.WebApp;
        const currentUserId = tg?.initDataUnsafe?.user?.id || 'anonymous';
        
        console.log('🔄 Starting data loading...');
        console.log('📡 Fetching from:', `${API_BASE}/api/all-data`);
        
        const [casinosData, userData] = await Promise.all([
            fetch(`${API_BASE}/api/all-data`).then(async r => {
                console.log('🎰 Casino response status:', r.status);
                const data = await r.json();
                console.log('🎰 Casinos loaded:', data.casinos?.length);
                if (!r.ok) throw new Error('Ошибка загрузки данных');
                return data;
            }),
            fetch(`${API_BASE}/api/user-data?userId=${currentUserId}`)
                .then(async r => {
                    console.log('👤 User response status:', r.status);
                    const data = await r.json();
                    return r.ok ? data : Promise.reject('User data error');
                })
                .catch(e => ({ 
                    settings: { 
                        hiddenCasinos: [], 
                        viewMode: 'full', 
                        theme: 'light',
                        hasLiveAccess: false 
                    } 
                }))
        ]);

        // 🔥 ПРАВИЛЬНОЕ ПРИСВАИВАНИЕ (без let - переменная уже объявлена)
        allCasinos = casinosData.casinos || [];
        renderFilters(casinosData.categories || []);
        
        showAnnouncements(casinosData.announcements || []);
        updateStreamStatus(casinosData.streamStatus);
        
        // ЕДИНЫЙ ИСТОЧНИК НАСТРОЕК
        const userSettings = userData.settings || {};
        userHiddenCasinos = userSettings.hiddenCasinos || [];
        userViewMode = userSettings.viewMode || 'full';
        currentTheme = userSettings.theme || 'light';
        userId = currentUserId;
        isApproved = userSettings.hasLiveAccess || false;
        
        console.log('🎨 Theme:', currentTheme);
        console.log('👁️ View mode:', userViewMode);
        console.log('🙈 Hidden casinos:', userHiddenCasinos.length);
        console.log('🎰 Total casinos:', allCasinos.length);
        
        document.body.classList.toggle('theme-dark', currentTheme === 'dark');
        document.getElementById('themeSwitcher').textContent = currentTheme === 'dark' ? '☀️ Светлая тема' : '🌙 Тёмная тема';
        localStorage.setItem('theme', currentTheme);
        
        document.getElementById('userIdDisplay').textContent = `ID: ${userId}`;
        
        console.log('🖼️ Rendering casinos...');
        renderCasinos();
        updateLiveRooms();
        
        // 🔥 ДОБАВЛЕНО: Обновление реферального блока
        updateReferralSection();

        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
            const user = tg.initDataUnsafe.user;
            fetch(`${API_BASE}/api/track-visit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    userInfo: { id: user.id, username: user.username },
                    action: 'visit'
                })
            }).catch(error => console.log('Ошибка отправки статистики:', error));
        }

    } catch (error) {
        console.error('❌ Load error:', error);
        showError('Ошибка при загрузке данных. Попробуйте обновить страницу.');
    } finally {
        hideLoadingState();
    }
}

function showLoadingState() {
    const container = document.getElementById('casinoList');
    if (container) {
        container.innerHTML = '<div class="loader">Загрузка...</div>';
    }
}

function hideLoadingState() {
    const loader = document.querySelector('.loader');
    if (loader) loader.style.display = 'none';
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
            ${escapeHtml(announcement.text)}
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
    if (!container) {
        console.error('❌ Casino list container not found!');
        return;
    }

    const filteredCasinos = filterCasinos();
    const sortedCasinos = sortCasinos(filteredCasinos);

    console.log('🃏 Filtered casinos:', filteredCasinos.length);
    console.log('🃏 Sorted casinos:', sortedCasinos.length);
    console.log('🙈 User hidden casinos:', userHiddenCasinos.length);
    console.log('🔍 Active filters:', Array.from(activeFilters));

    if (sortedCasinos.length === 0) {
        console.log('📭 No casinos to display');
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

    console.log('🎨 Rendering', sortedCasinos.length, 'casinos');
    container.innerHTML = sortedCasinos.map(casino => `
        <div class="casino-card ${userViewMode === 'compact' ? 'compact' : ''}" 
             data-id="${casino.id}"
             data-casino-id="${casino.id}"
             onmousedown="startHideTimer(${casino.id}, event)"
             onmouseup="cancelHideTimer()"
             onmouseleave="cancelHideTimer()"
             ontouchstart="startHideTimer(${casino.id}, event)"
             ontouchend="cancelHideTimer()"
             ontouchcancel="cancelHideTimer()">
            
            <div class="casino-header">
                <div class="casino-name">${escapeHtml(casino.name)}</div>
                ${userViewMode === 'full' ? `
                <div class="promo-code" onclick="copyPromoCode(${casino.id}, '${escapeHtml(casino.promocode)}')">
                    ${escapeHtml(casino.promocode)}
                </div>
                ` : ''}
            </div>
            
            ${userViewMode === 'full' ? `
            <div class="promo-description">
                ${escapeHtml(casino.shortDescription)}
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
                <p>${escapeHtml(casino.fullDescription)}</p>
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
                <button class="btn btn-primary" onclick="openVoiceRoom(event, 'vip', 'https://meet.google.com/xxx-xxxx-xxx')">
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
        fetch(`${API_BASE}/api/request-approval`, {
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
function updateReferralSection() {
    const referralSection = document.getElementById('referralSection');
    const referralCount = document.getElementById('referralCount');
    const referralLinkInput = document.getElementById('referralLinkInput');
    
    if (userId && userId !== 'anonymous') {
        // Временно используем заглушку, пока не подключим API
        const referralInfo = {
            referrals: [],
            referralLink: `https://t.me/Ludogol_bot?start=ref${userId}`
        };
        
        referralCount.textContent = referralInfo.referrals.length;
        referralLinkInput.value = referralInfo.referralLink;
        referralSection.style.display = 'block';
    } else {
        referralSection.style.display = 'none';
    }
}

function copyReferralLink() {
    const referralLinkInput = document.getElementById('referralLinkInput');
    if (referralLinkInput && referralLinkInput.value) {
        navigator.clipboard.writeText(referralLinkInput.value).then(() => {
            alert('✅ Реферальная ссылка скопирована!\n\nКиньте ссылку другу!');
        }).catch(err => {
            console.error('Error copying referral link:', err);
            alert('❌ Ошибка при копировании ссылки');
        });
    } else if (userId && userId !== 'anonymous') {
        const referralLink = `https://t.me/Ludogol_bot?start=ref${userId}`;
        navigator.clipboard.writeText(referralLink).then(() => {
            alert('✅ Реферальная ссылка скопирована!\n\nКиньте ссылку другу!');
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

        setTimeout(() => {
            searchInput.focus();
        }, 500);
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
                ${escapeHtml(message)}
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
window.openVoiceRoom = openVoiceRoom;
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


// ==================== КНОПКА "НАВЕРХ" ====================

// Создаем кнопку
const scrollToTopButton = document.createElement('div');
scrollToTopButton.innerHTML = '↑';
scrollToTopButton.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    opacity: 0;
    transform: translateY(100px);
    transition: all 0.3s ease;
    border: none;
`;
document.body.appendChild(scrollToTopButton);

// Функция для прокрутки наверх
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Обработчик клика
scrollToTopButton.addEventListener('click', scrollToTop);

// Показываем/скрываем кнопку при прокрутке
window.addEventListener('scroll', function() {
    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    // Показываем кнопку когда прокрутили больше 2 экранов
    if (scrollPosition > windowHeight * 2) {
        scrollToTopButton.style.opacity = '1';
        scrollToTopButton.style.transform = 'translateY(0)';
    } else {
        scrollToTopButton.style.opacity = '0';
        scrollToTopButton.style.transform = 'translateY(100px)';
    }
    
    // Дополнительно: скрываем кнопку когда верха
    if (scrollPosition < 50) {
        scrollToTopButton.style.opacity = '0';
        scrollToTopButton.style.transform = 'translateY(50px)';
    }
});

// Плавное появление через 2 секунды после загрузки
setTimeout(() => {
    if (window.scrollY > window.innerHeight * 2) {
        scrollToTopButton.style.opacity = '1';
        scrollToTopButton.style.transform = 'translateY(0)';
    }
}, 2000);

// ==================== КОНЕЦ КНОПКИ "НАВЕРХ" ====================
