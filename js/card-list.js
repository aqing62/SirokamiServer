/**
 * 白神服Sirokami — 禁限卡表 (G-Ext分值 / OT规制)
 * 合并自: card-list-constants.js, card-list-utils.js, card-list-filter.js,
 *          card-list-render.js, card-list-main.js
 */

/* ================================================================
 * §1. 常量 & 全局状态
 * ================================================================ */

const OCG_CARD_IMAGE_URL = "https://cdn.233.momobako.com/ygopro/pics/";
const SUPER_PRE_URL = "https://cdn02.moecube.com:444/ygopro-super-pre/data/pics/";
const DIY_CARD_IMAGE_URL = "https://api.ygopro3.cn/pics/siro/";

const LAZY_LOAD_CONFIG = {
    root: null,
    rootMargin: '200px 0px',
    threshold: 0.1,
};

let _cardInfoMap = null;
let _cardListAliasMap = null;
let _cardListTooltipEl = null;

function buildAliasMap(cardMap) {
    var aliasMap = {};
    cardMap.forEach(function (card) {
        if (card.alias) aliasMap[parseInt(card.id)] = parseInt(card.alias);
    });
    return aliasMap;
}

function resolveCardListInfo(cardId) {
    if (_cardInfoMap) {
        var card = _cardInfoMap.get(cardId);
        if (card) return card;
        var aliasId = _cardListAliasMap && _cardListAliasMap[cardId];
        if (aliasId) return _cardInfoMap.get(aliasId) || null;
    }
    return null;
}

async function loadCardInfo() {
    if (_cardInfoMap) return _cardInfoMap;
    if (window._cardIndex && window._cardIndex.size) {
        _cardInfoMap = window._cardIndex;
        _cardListAliasMap = buildAliasMap(window._cardIndex);
        return _cardInfoMap;
    }
    try {
        const resp = await fetch('/api/cards');
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const cards = await resp.json();
        _cardInfoMap = new Map();
        cards.forEach(function (c) { _cardInfoMap.set(parseInt(c.id), c); });
        _cardListAliasMap = buildAliasMap(_cardInfoMap);
        return _cardInfoMap;
    } catch (e) {
        console.warn('Failed to load card info for tooltip:', e);
        _cardInfoMap = new Map();
        _cardListAliasMap = {};
        return _cardInfoMap;
    }
}

function ensureCardListTooltip() {
    if (_cardListTooltipEl) return _cardListTooltipEl;
    _cardListTooltipEl = document.createElement('div');
    _cardListTooltipEl.className = 'card-tooltip';
    _cardListTooltipEl.style.display = 'none';
    document.body.appendChild(_cardListTooltipEl);
    return _cardListTooltipEl;
}

function showCardListTooltip(e, card) {
    var tip = ensureCardListTooltip();
    var isMonster = card.typeInfo && card.typeInfo.baseType === '怪兽';
    var atkDef = isMonster
        ? '<div class="tooltip-atkdef">ATK ' + (card.atk < 0 ? '?' : card.atk) + ' / DEF ' + (card.def < 0 ? '?' : card.def) + '</div>'
        : '';
    var raceAttr = isMonster
        ? '<div class="tooltip-raceattr">' + card.attrName + ' | ' + card.raceName + (card.level ? ' | Lv' + card.level : '') + '</div>'
        : '';
    tip.innerHTML = '<div class="tooltip-name">' + (card.name || '') + '</div>'
        + '<div class="tooltip-type">' + (card.typeInfo ? card.typeInfo.fullType : '') + '</div>'
        + raceAttr
        + atkDef
        + '<div class="tooltip-desc">' + (card.processedDesc || '') + '</div>';
    tip.style.display = 'block';
    var x = e.clientX + 14;
    var y = e.clientY + 10;
    var tw = tip.offsetWidth;
    var th = tip.offsetHeight;
    if (x + tw > window.innerWidth - 10) x = e.clientX - tw - 14;
    if (y + th > window.innerHeight - 10) y = e.clientY - th - 10;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
}

function hideCardListTooltip() {
    if (_cardListTooltipEl) _cardListTooltipEl.style.display = 'none';
}

function attachCardListHover() {
    document.querySelectorAll('#cardList .card-item').forEach(function (item) {
        item.addEventListener('mouseenter', function (e) {
            var cardId = parseInt(item.getAttribute('data-card-id'));
            if (!cardId || !_cardInfoMap) return;
            var card = resolveCardListInfo(cardId);
            if (card) showCardListTooltip(e, card);
        });
        item.addEventListener('mousemove', function (e) {
            if (!_cardListTooltipEl || _cardListTooltipEl.style.display === 'none') return;
            var x = e.clientX + 14;
            var y = e.clientY + 10;
            var tw = _cardListTooltipEl.offsetWidth;
            var th = _cardListTooltipEl.offsetHeight;
            if (x + tw > window.innerWidth - 10) x = e.clientX - tw - 14;
            if (y + th > window.innerHeight - 10) y = e.clientY - th - 10;
            _cardListTooltipEl.style.left = x + 'px';
            _cardListTooltipEl.style.top = y + 'px';
        });
        item.addEventListener('mouseleave', hideCardListTooltip);
        // 移动端触摸
        item.addEventListener('touchstart', function (e) {
            var cardId = parseInt(item.getAttribute('data-card-id'));
            if (!cardId || !_cardInfoMap) return;
            var card = resolveCardListInfo(cardId);
            if (card) {
                e.preventDefault();
                showCardListTooltip(e.touches[0], card);
            }
        }, { passive: false });
        item.addEventListener('touchend', hideCardListTooltip);
    });
}

let originalCards = [];   // G-Ext 原始数据
let originalOtCards = []; // OT 原始数据
let currentMode = "g-ext";
let lazyLoadObserver = null;

/* ================================================================
 * §2. 数据解析 (lflist.conf)
 * ================================================================ */

function parseGExtData(text) {
    let cards = [];
    let sirokamiIndex = text.search(/!DIY[_-]Sirokami/i);
    let gExtText = sirokamiIndex > -1 ? text.substring(0, sirokamiIndex) : text;
    let lines = gExtText.trim().split('\n').map(l => l.trim()).filter(l => l);

    let currentCategory = 'non-DIY';
    const tempIdSet = new Set();

    lines.forEach(line => {
        if (line.toLowerCase().includes('#ocg cards')) {
            currentCategory = 'non-DIY';
            return;
        }
        if (line.toLowerCase().includes('#diy cards')) {
            currentCategory = 'DIY';
            return;
        }
        if (line.startsWith('#') || line.startsWith('!') || line.startsWith('$genesys')) return;

        // 匹配被直接禁止的卡（无 $genesys 前缀，仅 0）
        let fbM = line.match(/^(\d+)\s+0\s+--(.+?)(?:\s+#(.+))?$/);
        if (fbM) {
            const cardId = fbM[1];
            if (!tempIdSet.has(cardId)) {
                tempIdSet.add(cardId);
                cards.push({
                    id: fbM[1],
                    score: 0,
                    name: fbM[2].trim(),
                    reason: fbM[3] ? fbM[3].trim() : '无备注',
                    cardType: 'g-ext',
                    category: currentCategory,
                    forbidden: true,
                });
            }
            return;
        }

        let m = line.match(/^(\d+)\s+\$genesys\s+(\d+)\s+--(.+?)(?:\s+#(.+))?$/);
        if (!m) return;

        const cardId = m[1];
        if (tempIdSet.has(cardId)) {
            console.warn(`G-Ext模块内重复卡号：${cardId}，已跳过`);
            return;
        }
        tempIdSet.add(cardId);

        cards.push({
            id: m[1],
            score: parseInt(m[2]),
            name: m[3].trim(),
            reason: m[4] ? m[4].trim() : '无备注',
            cardType: 'g-ext',
            category: currentCategory,
        });
    });

    console.log('G-Ext解析结果（已去重）：', cards.length, '张');
    return cards;
}

function parseOtData(text) {
    let cards = [];
    let sirokamiIndex = text.search(/!DIY[_-]Sirokami/i);
    let otText = sirokamiIndex > -1 ? text.substring(sirokamiIndex) : text;
    if (!otText) {
        console.log('未找到!DIY_Sirokami标记，OT数据为空');
        return cards;
    }

    let lines = otText.trim().split('\n').map(l => l.trim()).filter(l => l);
    let currentCategory = 'DIY';
    let currentRestriction = 'no-limit';
    const tempIdSet = new Set();

    lines.forEach(line => {
        if (line.includes('##non DIY modification')) {
            currentCategory = 'non-DIY-mod';
            return;
        }
        if (line.includes('##non DIY')) {
            currentCategory = 'non-DIY';
            return;
        }
        if (line.toLowerCase().includes('#diy cards')) {
            currentCategory = 'DIY';
            return;
        }
        if (line.toLowerCase().includes('#forbidden')) {
            currentRestriction = 'forbidden';
            return;
        }
        if (line.toLowerCase().includes('#limit')) {
            currentRestriction = 'limit';
            return;
        }
        if (line.toLowerCase().includes('#semi limit')) {
            currentRestriction = 'semi';
            return;
        }
        if (line.toLowerCase().includes('#no limit')) {
            currentRestriction = 'no-limit';
            return;
        }
        if (line.startsWith('#') || line.startsWith('!') || line.startsWith('$')) return;

        let m = line.match(/^(\d+)\s*(?:\d+)?\s*--(.+?)(?:\s+#(.+))?$/);
        if (!m) return;

        const cardId = m[1];
        if (tempIdSet.has(cardId)) {
            console.warn(`OT模块内重复卡号：${cardId}，已跳过`);
            return;
        }
        tempIdSet.add(cardId);

        let num;
        switch (currentRestriction) {
            case 'forbidden': num = 0; break;
            case 'limit': num = 1; break;
            case 'semi': num = 2; break;
            default: num = -1;
        }
        cards.push({
            id: m[1],
            name: m[2].trim(),
            reason: m[3] ? m[3].trim() : '无备注',
            category: currentCategory,
            restriction: currentRestriction,
            limitNum: num,
            cardType: 'ot',
        });
    });

    console.log('OT解析结果（已去重）：', cards.length, '张');
    return cards;
}

/* ================================================================
 * §3. 图片懒加载工具
 * ================================================================ */

function makeCardImageHtml(cardId, cardCategory) {
    const id = cardId ? String(Number(cardId)) : '';
    return `<div class="card-img lazy-img" data-card-id="${id}" data-card-category="${cardCategory || ''}" aria-label="卡图">
        <span class="img-placeholder">加载中...</span>
    </div>`;
}

function loadCardImage(imgContainer) {
    if (imgContainer.classList.contains('loading') || imgContainer.classList.contains('loaded')) return;

    const cardId = imgContainer.dataset.cardId;
    const cardCategory = imgContainer.dataset.cardCategory;
    if (!cardId) {
        imgContainer.innerHTML = '无效卡片ID';
        return;
    }

    imgContainer.classList.add('loading');

    let imgUrl = cardCategory === 'DIY'
        ? `${DIY_CARD_IMAGE_URL}${cardId}.jpg`
        : `${OCG_CARD_IMAGE_URL}${cardId}.jpg`;

    const img = new Image();
    img.className = 'card-img';
    img.alt = `卡图 ${cardId}`;

    img.onerror = function () {
        this.onerror = null;
        if (cardCategory === 'DIY') {
            this.src = `${OCG_CARD_IMAGE_URL}${cardId}.jpg`;
            this.onerror = function () {
                this.onerror = null;
                this.src = `${SUPER_PRE_URL}${cardId}.jpg`;
                this.onerror = function () {
                    imgContainer.innerHTML = `卡图缺失<br>${cardId}`;
                    imgContainer.classList.remove('loading');
                };
            };
        } else {
            this.src = `${SUPER_PRE_URL}${cardId}.jpg`;
            this.onerror = function () {
                imgContainer.innerHTML = `卡图缺失<br>${cardId}`;
                imgContainer.classList.remove('loading');
            };
        }
    };

    img.onload = function () {
        imgContainer.innerHTML = '';
        imgContainer.appendChild(img);
        imgContainer.classList.add('loaded');
        imgContainer.classList.remove('loading');
    };

    imgContainer.appendChild(img);
    img.src = imgUrl;
}

function unloadCardImage(imgContainer) {
    if (!imgContainer.classList.contains('loaded')) return;
    const img = imgContainer.querySelector('img');
    if (img) {
        img.src = '';
        img.remove();
    }
    imgContainer.innerHTML = '<span class="img-placeholder">加载中...</span>';
    imgContainer.classList.remove('loaded', 'loading');
}

function initLazyLoadObserver() {
    if (lazyLoadObserver) lazyLoadObserver.disconnect();
    lazyLoadObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                loadCardImage(entry.target);
            } else {
                unloadCardImage(entry.target);
            }
        });
    }, LAZY_LOAD_CONFIG);

    document.querySelectorAll('.lazy-img').forEach(el => lazyLoadObserver.observe(el));
}

function resetLazyLoadObserver() {
    if (lazyLoadObserver) {
        lazyLoadObserver.disconnect();
        lazyLoadObserver = null;
    }
    document.querySelectorAll('.lazy-img.loaded').forEach(el => unloadCardImage(el));
}

/* ================================================================
 * §4. 筛选 & 排序
 * ================================================================ */

function filterAndSortGExt() {
    const isMobile = window.innerWidth <= 992;
    const nameSearch = (isMobile
        ? document.getElementById('nameSearch').value
        : document.getElementById('desktopNameSearch').value).toLowerCase();
    const scoreMin = (isMobile
        ? document.getElementById('scoreMin').value | 0
        : document.getElementById('desktopScoreMin').value | 0) || 0;
    const scoreMax = (isMobile
        ? document.getElementById('scoreMax').value | 0
        : document.getElementById('desktopScoreMax').value | 0) || 99999;
    const isDesc = isMobile
        ? document.getElementById('sortDesc').classList.contains('active')
        : document.getElementById('desktopSortDesc').classList.contains('active');

    let filtered = originalCards.filter(c =>
        c.name.toLowerCase().includes(nameSearch) &&
        c.score >= scoreMin &&
        c.score <= scoreMax
    );
    filtered.sort((a, b) => isDesc ? b.score - a.score : a.score - b.score);
    renderGExtCards(filtered);
}

function filterOtCards() {
    const isMobile = window.innerWidth <= 992;

    const nameSearch = (isMobile
        ? document.getElementById('otNameSearch').value
        : document.getElementById('desktopOtNameSearch').value).toLowerCase();

    const typeSel = isMobile
        ? '.ot-type-filter [data-type].active'
        : '#desktopOtFilterGroup .ot-type-filter [data-type].active';
    const type = document.querySelector(typeSel).dataset.type;

    const catSel = isMobile
        ? '.ot-type-filter [data-category].active'
        : '#desktopOtFilterGroup .ot-type-filter [data-category].active';
    const category = document.querySelector(catSel).dataset.category;

    let filtered = originalOtCards.filter(x =>
        x.name.toLowerCase().includes(nameSearch) &&
        (type === 'all' || x.restriction === type) &&
        (category === 'all' || x.category === category)
    );
    renderOtCards(filtered);
}

function switchMode(mode, isMobile) {
    currentMode = mode;
    document.querySelector('.title-g-ext').style.display = mode === 'g-ext' ? 'block' : 'none';
    document.querySelector('.title-ot').style.display = mode === 'ot' ? 'block' : 'none';

    if (isMobile) {
        document.getElementById('scoreFilterGroup').style.display = mode === 'g-ext' ? 'block' : 'none';
        document.getElementById('otFilterGroup').style.display = mode === 'ot' ? 'block' : 'none';
    } else {
        document.getElementById('desktopScoreFilterGroup').style.display = mode === 'g-ext' ? 'block' : 'none';
        document.getElementById('desktopOtFilterGroup').style.display = mode === 'ot' ? 'block' : 'none';
    }

    if (mode === 'g-ext') filterAndSortGExt();
    else filterOtCards();
}

/* ================================================================
 * §5. 渲染
 * ================================================================ */

function renderGExtCards(cards) {
    let ctn = document.getElementById('cardList');
    let empty = document.getElementById('emptyTip');
    let gEmpty = document.getElementById('gExtEmptyTip');
    ctn.innerHTML = '';
    empty.style.display = 'none';
    gEmpty.style.display = 'none';

    if (originalCards.length === 0) {
        gEmpty.style.display = 'block';
        return;
    }
    if (cards.length === 0) {
        empty.style.display = 'block';
        return;
    }

    cards.forEach(c => {
        let div = document.createElement('div');
        div.className = 'card-item';
        div.setAttribute('data-card-id', c.id);
        let scoreHtml = c.forbidden
            ? `<div class="card-score g-ext-forbidden">🚫 禁止</div>`
            : `<div class="card-score">分数：${c.score}</div>`;
        div.innerHTML = makeCardImageHtml(c.id, c.category) + `
        <div class="card-info">
            <div class="card-name">${c.name}</div>
            <div class="card-id">${c.id}</div>
            ${scoreHtml}
            <div class="card-reason">${c.reason}</div>
        </div>`;
        ctn.appendChild(div);
    });

    resetLazyLoadObserver();
    initLazyLoadObserver();
    loadCardInfo().then(attachCardListHover);
}

function renderOtCards(cards) {
    let ctn = document.getElementById('cardList');
    let empty = document.getElementById('emptyTip');
    let gEmpty = document.getElementById('gExtEmptyTip');
    ctn.innerHTML = '';
    empty.style.display = 'none';
    gEmpty.style.display = 'none';

    if (cards.length === 0) {
        empty.style.display = 'block';
        return;
    }

    cards.forEach(c => {
        let txt = '', cls = '';
        switch (c.restriction) {
            case 'forbidden': txt = '禁用(0)'; cls = 'ot-forbidden'; break;
            case 'limit': txt = '限制(1)'; cls = 'ot-limit'; break;
            case 'semi': txt = '准限制(2)'; cls = 'ot-semi'; break;
            case 'no-limit': txt = '无限制'; cls = 'ot-no-limit'; break;
            default: txt = '无规制'; cls = '';
        }
        let div = document.createElement('div');
        div.className = 'card-item';
        div.setAttribute('data-card-id', c.id);
        div.innerHTML = makeCardImageHtml(c.id, c.category) + `
        <div class="card-info">
            <div class="card-name">${c.name}</div>
            <div class="card-id">${c.id}</div>
            <div class="card-ot ${cls}" style="display:block;">${txt}</div>
            <div class="card-reason">${c.reason}</div>
        </div>`;
        ctn.appendChild(div);
    });

    resetLazyLoadObserver();
    initLazyLoadObserver();
    loadCardInfo().then(attachCardListHover);
}

/* ================================================================
 * §6. 初始化入口
 * ================================================================ */

function initCardListModule() {
    (async function () {
    try {
        console.log('开始读取lflist.conf...');
        const response = await fetch('lflist.conf');
        if (!response.ok) throw new Error(`文件读取失败：状态码 ${response.status}`);

        const text = await response.text();
        console.log('lflist.conf读取成功！内容长度：', text.length);

        originalCards = parseGExtData(text);
        originalOtCards = parseOtData(text);

        // ── 绑定移动端事件 ──
        document.getElementById('mobileFilterBtn').addEventListener('click', function () {
            document.getElementById('filterModal').style.display = 'block';
        });
        document.getElementById('closeModalBtn').addEventListener('click', function () {
            document.getElementById('filterModal').style.display = 'none';
        });
        document.getElementById('modeToggle').addEventListener('change', function () {
            switchMode(this.checked ? 'ot' : 'g-ext', true);
        });
        document.getElementById('sortDesc').addEventListener('click', function () {
            this.classList.add('active');
            document.getElementById('sortAsc').classList.remove('active');
            filterAndSortGExt();
        });
        document.getElementById('sortAsc').addEventListener('click', function () {
            this.classList.add('active');
            document.getElementById('sortDesc').classList.remove('active');
            filterAndSortGExt();
        });
        document.querySelectorAll('#otFilterGroup [data-type]').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('#otFilterGroup [data-type]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                filterOtCards();
            });
        });
        document.querySelectorAll('#otFilterGroup [data-category]').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('#otFilterGroup [data-category]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                filterOtCards();
            });
        });
        document.getElementById('resetFilter').addEventListener('click', function () {
            document.getElementById('nameSearch').value = '';
            document.getElementById('scoreMin').value = '';
            document.getElementById('scoreMax').value = '';
            document.getElementById('sortDesc').classList.add('active');
            document.getElementById('sortAsc').classList.remove('active');
            document.getElementById('otNameSearch').value = '';
            document.querySelectorAll('#otFilterGroup [data-type]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === 'all');
            });
            document.querySelectorAll('#otFilterGroup [data-category]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === 'all');
            });
            document.getElementById('modeToggle').checked = false;
            switchMode('g-ext', true);
        });

        // ── 绑定桌面端事件 ──
        document.getElementById('desktopModeToggle').addEventListener('change', function () {
            switchMode(this.checked ? 'ot' : 'g-ext', false);
        });
        document.getElementById('desktopSortDesc').addEventListener('click', function () {
            this.classList.add('active');
            document.getElementById('desktopSortAsc').classList.remove('active');
            filterAndSortGExt();
        });
        document.getElementById('desktopSortAsc').addEventListener('click', function () {
            this.classList.add('active');
            document.getElementById('desktopSortDesc').classList.remove('active');
            filterAndSortGExt();
        });
        document.querySelectorAll('#desktopOtFilterGroup [data-type]').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('#desktopOtFilterGroup [data-type]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                filterOtCards();
            });
        });
        document.querySelectorAll('#desktopOtFilterGroup [data-category]').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('#desktopOtFilterGroup [data-category]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                filterOtCards();
            });
        });
        document.getElementById('desktopResetFilter').addEventListener('click', function () {
            document.getElementById('desktopNameSearch').value = '';
            document.getElementById('desktopScoreMin').value = '';
            document.getElementById('desktopScoreMax').value = '';
            document.getElementById('desktopSortDesc').classList.add('active');
            document.getElementById('desktopSortAsc').classList.remove('active');
            document.getElementById('desktopOtNameSearch').value = '';
            document.querySelectorAll('#desktopOtFilterGroup [data-type]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === 'all');
            });
            document.querySelectorAll('#desktopOtFilterGroup [data-category]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === 'all');
            });
            document.getElementById('desktopModeToggle').checked = false;
            switchMode('g-ext', false);
        });

        // ── 绑定搜索输入事件 ──
        document.getElementById('nameSearch').addEventListener('input', filterAndSortGExt);
        document.getElementById('scoreMin').addEventListener('input', filterAndSortGExt);
        document.getElementById('scoreMax').addEventListener('input', filterAndSortGExt);
        document.getElementById('otNameSearch').addEventListener('input', filterOtCards);
        document.getElementById('desktopNameSearch').addEventListener('input', filterAndSortGExt);
        document.getElementById('desktopScoreMin').addEventListener('input', filterAndSortGExt);
        document.getElementById('desktopScoreMax').addEventListener('input', filterAndSortGExt);
        document.getElementById('desktopOtNameSearch').addEventListener('input', filterOtCards);

        // ── 默认显示 ──
        switchMode('g-ext');

    } catch (error) {
        console.error('初始化失败：', error);
        const tip = document.getElementById('errorTip');
        tip.style.display = 'block';
        tip.textContent = '加载失败：' + error.message;
    }
    })();
}

// 移动端点击弹窗外部关闭
window.addEventListener('click', function (e) {
    const modal = document.getElementById('filterModal');
    if (e.target === modal) modal.style.display = 'none';
});
