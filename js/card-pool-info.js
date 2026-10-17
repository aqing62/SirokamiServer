/**
 * 白神服Sirokami — 卡池信息页面
 * 优化版: 预解析数值 + DOMContentLoaded + 搜索防抖
 */
let allCards = [];
const selectedTypeMasks = new Set();
const selectedAttributes = new Set();
const selectedRaces = new Set();

/* ══════════════════════════════════════════════════════════════
   V1.9.0 卡池合并：DIY / 先行 / 官方 三个来源合成一个池子
     · 来源 = 筛选条件（默认「全部」），不再来回切模式
     · 分值 / 禁限 来自 lflist.conf（Genesys 分值段 + DIY_Sirokami 禁限段）
   ══════════════════════════════════════════════════════════════ */
let selectedSource = 'all';              // all | diy | pre | ocg
const selectedLimits = new Set();        // '0' 禁 · '1' 限制 · '2' 准限制 · '3' 无限制
let scoreMinEl = null, scoreMaxEl = null;
let poolNewIds = new Set();              // 最新一期新卡（打「新」角标）
window._poolMeta = {
    score: new Map(),      // id → 分值（Genesys）
    limit: new Map(),      // id → 0/1/2/3（禁/限制/准限制/无限制）
    cat: new Map(),        // id → 'diy' | 'ot' | 'mod'（禁限表里的分类）
    forbidden: new Set(),  // id → 禁止使用
};

const SOURCE_NAME = { diy: 'DIY', pre: '先行', ocg: '官方' };
const LIMIT_NAME = { 0: '禁', 1: '限1', 2: '限2', 3: '无限制' };

let levelMin, levelMax, atkMin, atkMax, defMin, defMax;
const container = document.getElementById('cardContainer');
const searchInput = document.getElementById('search');
const resetFilterBtn = document.getElementById('resetFilterBtn');

let currentPage = 1;
const PAGE_SIZE = 18;
let totalPages = 1;
const paginationContainer = document.getElementById('pagination');

const ALL_TYPE_MASKS = {
    0x1: "怪兽", 0x2: "魔法", 0x4: "陷阱", 0x10: "通常", 0x20: "效果",
    0x40: "融合", 0x80: "仪式", 0x200: "灵魂", 0x400: "同盟", 0x800: "二重",
    0x1000: "调整", 0x2000: "同调", 0x4000: "衍生物", 0x200000: "反转",
    0x400000: "卡通", 0x800000: "超量", 0x1000000: "灵摆", 0x2000000: "特殊召唤",
    0x4000000: "连接", 0x10000: "速攻", 0x20000: "永续", 0x40000: "装备",
    0x80000: "场地", 0x100000: "反击",
};

const CUSTOM_FILTER_ORDER = [
    ["怪兽", "通常", "效果", "仪式", "融合", "同调", "超量", "灵摆", "连接"],
    ["灵魂", "同盟", "二重", "反转", "卡通", "特殊召唤", "衍生物"],
    ["魔法", "速攻", "永续", "装备", "场地", "陷阱", "反击"],
];

const MONSTER_CATEGORY_PRIORITY = {
    "纯效果怪兽": 1, "仪式怪兽": 2, "融合怪兽": 3, "同调怪兽": 4,
    "超量怪兽": 5, "灵摆怪兽": 6, "连接怪兽": 7, "其他怪兽": 8,
};
const EXCLUDED_MONSTER_SUBTYPES = ["仪式", "融合", "同调", "超量", "灵摆", "连接"];
const TOKEN_MASK = 0x4000;
const MAGIC_SUBTYPE_PRIORITY = { "通常": 1, "速攻": 2, "仪式": 3, "永续": 4, "场地": 5, "装备": 6 };
const TRAP_SUBTYPE_PRIORITY = { "通常": 1, "永续": 2, "反击": 3 };
const BASE_TYPE_PRIORITY = { "怪兽": 1, "魔法": 2, "陷阱": 3 };

const RACE_MAP = {
    0x0: "无", 0x1: "战士族", 0x2: "魔法师族", 0x4: "天使族", 0x8: "恶魔族",
    0x10: "不死族", 0x20: "机械族", 0x40: "水族", 0x80: "炎族", 0x100: "岩石族",
    0x200: "鸟兽族", 0x400: "植物族", 0x800: "昆虫族", 0x1000: "雷族",
    0x2000: "龙族", 0x4000: "兽族", 0x8000: "兽战士族", 0x10000: "恐龙族",
    0x20000: "鱼族", 0x40000: "海龙族", 0x80000: "爬虫类族",
    0x100000: "念动力族", 0x200000: "幻神兽族", 0x400000: "创造神族",
    0x800000: "幻龙族", 0x1000000: "电子界族", 0x2000000: "幻想魔族",
};
const ATTR_MAP = { 0x0: "无", 0x1: "地", 0x2: "水", 0x4: "炎", 0x8: "风", 0x10: "光", 0x20: "暗", 0x40: "神" };

// ── 图片加载管理器（并发控制 + 换页清队）─────────────────
const PLACEHOLDER_SVG = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="290">' +
    '<rect fill="%231a1a1a" width="200" height="290"/>' +
    '<text fill="%23888" x="100" y="150" text-anchor="middle" font-size="14" font-family="sans-serif">加载中...</text>' +
    '</svg>'
);
const ERROR_SVG = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="290">' +
    '<rect fill="%231a1a1a" width="200" height="290"/>' +
    '<text fill="%23888" x="100" y="150" text-anchor="middle" font-size="14" font-family="sans-serif">无卡图</text>' +
    '</svg>'
);

const imageLoadQueue = [];
let activeImageLoads = 0;
const MAX_CONCURRENT_LOADS = 6;

function processImageQueue() {
    while (activeImageLoads < MAX_CONCURRENT_LOADS && imageLoadQueue.length > 0) {
        const { img, url } = imageLoadQueue.shift();
        activeImageLoads++;
        const onDone = () => {
            activeImageLoads--;
            processImageQueue();
        };
        img.onload = onDone;
        img.onerror = function() {
            if (!this._triedSuperPre) {
                this._triedSuperPre = true;
                const match = url.match(/\/(\d+)\.jpg/);
                const cardId = match ? match[1] : '';
                this.src = 'https://cdn02.moecube.com:444/ygopro-super-pre/data/pics/' + cardId + '.jpg';
            } else if (!this._triedOcg) {
                this._triedOcg = true;
                const match = url.match(/\/(\d+)\.jpg/);
                const cardId = match ? match[1] : '';
                this.src = 'https://cdn.233.momobako.com/ygopro/pics/' + cardId + '.jpg';
            } else {
                this.src = ERROR_SVG;
                onDone();
            }
        };
        img.src = url;
    }
}

function enqueueImageLoad(img, url) {
    imageLoadQueue.push({ img, url });
    processImageQueue();
}

function cancelPendingImageLoads() {
    // 清空尚未开始下载的排队项（已在下载的由浏览器自行管理）
    imageLoadQueue.length = 0;
}

// ── 图片懒加载 ─────────────────────────────────────────
const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            imageObserver.unobserve(img);
            enqueueImageLoad(img, img.dataset.src);
        }
    });
}, { rootMargin: '100px 0px' });

// ── 类型掩码快速查找 - 预构建反向索引 ──────────────────
const MASK_TO_NAME = {};
for (const [mask, name] of Object.entries(ALL_TYPE_MASKS)) {
    MASK_TO_NAME[parseInt(mask)] = name;
}
const MASK_ENTRIES = Object.entries(ALL_TYPE_MASKS).map(([k, v]) => [parseInt(k), v]);

/**
 * 预解析卡牌数据 —— 一次性解析，避免每次渲染时重复 parseInt
 */
function preParseCard(raw) {
    const type = parseInt(raw[2]);
    const atk = parseInt(raw[3]);
    const def = parseInt(raw[4]);
    const level = parseInt(raw[5]) || 0;
    const race = parseInt(raw[6]);
    const attribute = parseInt(raw[7]);

    // 解析类型
    const typeParts = [];
    let baseType = "";
    for (const [maskVal, name] of MASK_ENTRIES) {
        if (type & maskVal) {
            typeParts.push(name);
            if (["怪兽", "魔法", "陷阱"].includes(name)) baseType = name;
        }
    }
    let monsterCategory = "其他怪兽";
    const subTypes = typeParts.filter(t => !["怪兽", "魔法", "陷阱"].includes(t));
    if (baseType === "怪兽") {
        const hasExcluded = subTypes.some(sub => EXCLUDED_MONSTER_SUBTYPES.includes(sub));
        if (!hasExcluded && subTypes.includes("效果")) monsterCategory = "纯效果怪兽";
        else if (subTypes.includes("仪式")) monsterCategory = "仪式怪兽";
        else if (subTypes.includes("融合")) monsterCategory = "融合怪兽";
        else if (subTypes.includes("同调")) monsterCategory = "同调怪兽";
        else if (subTypes.includes("超量")) monsterCategory = "超量怪兽";
        else if (subTypes.includes("灵摆")) monsterCategory = "灵摆怪兽";
        else if (subTypes.includes("连接")) monsterCategory = "连接怪兽";
    }

    // 解析种族 (取第一个匹配的位)
    let raceName = "未知种族";
    for (const [maskVal, name] of Object.entries(RACE_MAP)) {
        if (race & parseInt(maskVal)) { raceName = name; break; }
    }

    // 解析属性 (取第一个匹配的位)
    let attrName = "未知属性";
    for (const [maskVal, name] of Object.entries(ATTR_MAP)) {
        if (attribute & parseInt(maskVal)) { attrName = name; break; }
    }

    // 提取DIY作者
    let author = "";
    let processedDesc = "无效果描述";
    if (raw[8]) {
        const lines = raw[8].split(/\r?\n/);
        const effectLines = [];
        for (const line of lines) {
            const t = line.trim();
            if (t.startsWith("DIY by")) { author = t; break; }
            effectLines.push(line);
        }
        processedDesc = effectLines.join("\n").trim() || "无效果描述";
    }

    return {
        id: raw[0],
        name: raw[1],
        type,           // 预解析的数值
        atk,
        def,
        level,
        race,           // 预解析的数值
        attribute,      // 预解析的数值
        desc: raw[8],
        // 预计算的显示值
        typeInfo: {
            fullType: typeParts.join(" ") || "未知类型",
            baseType,
            subTypes,
            monsterCategory,
        },
        raceName,
        attrName,
        author,
        processedDesc,
    };
}

// ── 排序 ────────────────────────────────────────────────
function customCardSort(a, b) {
    const aBase = BASE_TYPE_PRIORITY[a.typeInfo.baseType] || 99;
    const bBase = BASE_TYPE_PRIORITY[b.typeInfo.baseType] || 99;
    if (aBase !== bBase) return aBase - bBase;

    if (a.typeInfo.baseType === "怪兽") {
        const aCat = MONSTER_CATEGORY_PRIORITY[a.typeInfo.monsterCategory] || 99;
        const bCat = MONSTER_CATEGORY_PRIORITY[b.typeInfo.monsterCategory] || 99;
        if (aCat !== bCat) return aCat - bCat;
        if (a.level !== b.level) return b.level - a.level;
        if (a.atk !== b.atk) return b.atk - a.atk;
        return parseInt(a.id) - parseInt(b.id);
    }
    if (a.typeInfo.baseType === "魔法") {
        const get = s => Math.min(...s.map(i => MAGIC_SUBTYPE_PRIORITY[i] || 99));
        return get(a.typeInfo.subTypes) - get(b.typeInfo.subTypes) || parseInt(a.id) - parseInt(b.id);
    }
    if (a.typeInfo.baseType === "陷阱") {
        const get = s => Math.min(...s.map(i => TRAP_SUBTYPE_PRIORITY[i] || 99));
        return get(a.typeInfo.subTypes) - get(b.typeInfo.subTypes) || parseInt(a.id) - parseInt(b.id);
    }
    return parseInt(a.id) - parseInt(b.id);
}

// ── 筛选标签 ────────────────────────────────────────────
function createTag(text, value, set, container) {
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.dataset.value = value;
    tag.textContent = text;

    tag.addEventListener('click', (e) => {
        tag.classList.toggle('active');
        tag.classList.contains('active') ? set.add(value) : set.delete(value);
        currentPage = 1;
        renderCards();

        const rect = tag.getBoundingClientRect();
        const x = e.clientX - rect.left - 12;
        const y = e.clientY - rect.top - 12;
        const hex = document.createElement('span');
        hex.className = 'hex-effect';
        hex.style.left = `${x}px`;
        hex.style.top = `${y}px`;
        tag.appendChild(hex);
        hex.addEventListener('animationend', () => hex.remove(), { once: true });
    });

    container.appendChild(tag);
}

function generateTypeFilter() {
    const container = document.getElementById('filterTypeContainer');
    container.innerHTML = '';
    CUSTOM_FILTER_ORDER.flat().forEach(tagName => {
        const entry = MASK_ENTRIES.find(([, v]) => v === tagName);
        if (entry) createTag(tagName, entry[0], selectedTypeMasks, container);
    });
}

function generateAttributeFilter() {
    const container = document.getElementById('filterAttributeContainer');
    container.innerHTML = '';
    Object.values(ATTR_MAP).filter(v => v !== "无").forEach(attr => {
        createTag(attr, attr, selectedAttributes, container);
    });
}

function generateRaceFilter() {
    const container = document.getElementById('filterRaceContainer');
    container.innerHTML = '';
    Object.values(RACE_MAP).filter(v => v !== "无").forEach(race => {
        createTag(race, race, selectedRaces, container);
    });
}

function initRangeInputs() {
    levelMin = document.getElementById('levelMin');
    levelMax = document.getElementById('levelMax');
    atkMin = document.getElementById('atkMin');
    atkMax = document.getElementById('atkMax');
    defMin = document.getElementById('defMin');
    defMax = document.getElementById('defMax');
    [levelMin, levelMax, atkMin, atkMax, defMin, defMax].forEach(input => {
        input.addEventListener('input', () => {
            currentPage = 1;
            renderCards();
        });
    });
}

function initFilterCollapse() {
    document.querySelectorAll('.filter-collapse-header').forEach(header => {
        header.addEventListener('click', () => {
            header.classList.toggle('active');
            header.nextElementSibling.classList.toggle('open');
        });
    });
}

function generateAllFilters() {
    generateTypeFilter();
    generateAttributeFilter();
    generateRaceFilter();
    initRangeInputs();
    initFilterCollapse();
}

// ══════════════════════════════════════════════════════════════
// V1.9.0：合并池元数据（分值 / 禁限 / 来源）
// ══════════════════════════════════════════════════════════════

/** 解析 lflist.conf：
 *  · !ReGenesys DIY 段：`id $genesys N --卡名` = 分值；`id 0 --卡名` = 禁止使用
 *  · !DIY_Sirokami 段：按 #forbidden / #limit / #semi limit / #no limit 分组，
 *    `##non DIY` / `##non DIY modification` 切换分类（DIY / OT / 特别规制）
 *  ⚠ 不能复用「禁限分值」页的解析：那边是把两类行塞进同一个数组给列表用，
 *    这里需要按**卡号**索引，才能当作筛选条件用 */
function parsePoolMeta(text) {
    const M = window._poolMeta;
    const lines = String(text).split(/\r?\n/);
    let inOt = false;
    let curLimit = -1;
    let curCat = 'diy';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (/^!DIY[_-]Sirokami/i.test(line)) { inOt = true; curLimit = -1; curCat = 'diy'; continue; }
        if (line[0] === '!') continue;              // 其它段头
        if (line[0] === '$') continue;              // $genesys 100 之类的段参数

        if (line[0] === '#') {
            if (!inOt) continue;                    // Genesys 段里的 # 只是分类注释
            const l = line.toLowerCase();
            if (l.indexOf('##non diy modification') >= 0) { curCat = 'mod'; continue; }
            if (l.indexOf('##non diy') >= 0) { curCat = 'ot'; continue; }
            if (l.indexOf('#diy cards') >= 0) { curCat = 'diy'; continue; }
            if (l.indexOf('#semi limit') >= 0) { curLimit = 2; continue; }
            if (l.indexOf('#forbidden') >= 0) { curLimit = 0; continue; }
            if (l.indexOf('#limit') >= 0) { curLimit = 1; continue; }
            if (l.indexOf('#no limit') >= 0) { curLimit = 3; continue; }
            continue;
        }

        // 分值行： 12345678 $genesys 8 --卡名
        const gm = line.match(/^(\d+)\s+\$genesys\s+(\d+)\b/);
        if (gm) {
            const id = parseInt(gm[1], 10), sc = parseInt(gm[2], 10);
            M.score.set(id, sc);
            if (sc === 0) M.forbidden.add(id);      // 0 分 = 禁止使用
            continue;
        }

        // 普通行： 12345678 [限几张] --卡名
        const m = line.match(/^(\d+)\s*(\d+)?\s*(?:--.*)?$/);
        if (!m) continue;
        const id = parseInt(m[1], 10);
        const num = (m[2] === undefined || m[2] === '') ? null : parseInt(m[2], 10);

        if (!inOt) {
            if (num === 0) M.forbidden.add(id);     // Genesys 段里的 0 = 禁
            continue;
        }
        const lim = num === null ? curLimit : num;
        if (lim >= 0 && lim <= 3) M.limit.set(id, lim);
        M.cat.set(id, curCat);
        if (lim === 0) M.forbidden.add(id);
    }
}

/** 给每张卡挂上 _score / _limit / _forbidden / _src / _new（一次性，渲染时不再查 Map） */
function enrichPoolCards() {
    const M = window._poolMeta;
    for (let i = 0; i < allCards.length; i++) {
        const c = allCards[i];
        const id = parseInt(c.id, 10);
        c._src = c.source || 'diy';
        c._score = M.score.has(id) ? M.score.get(id) : null;
        c._limit = M.limit.has(id) ? M.limit.get(id) : null;
        c._forbidden = M.forbidden.has(id);
        c._new = poolNewIds.has(id);
    }
}

/** 加载分值/禁限表 + 新卡表（失败不阻塞卡池：只是少了角标和筛选） */
async function loadPoolMeta() {
    const jobs = [
        fetch('lflist.conf?v=20261022e').then(r => (r.ok ? r.text() : '')).catch(() => ''),
        fetch('new_cards.json').then(r => (r.ok ? r.json() : null)).catch(() => null),
    ];
    const [lflistText, newCards] = await Promise.all(jobs);
    try { if (lflistText) parsePoolMeta(lflistText); } catch (e) { console.warn('分值/禁限表解析失败', e); }
    try {
        if (newCards) {
            const dates = Object.keys(newCards).sort().reverse();
            const latest = dates[0];
            if (latest && Array.isArray(newCards[latest])) {
                poolNewIds = new Set(newCards[latest].map(x => parseInt(x, 10)));
            }
        }
    } catch (e) { /* 忽略 */ }
}

// ── 范围匹配 (使用预解析的数值) ──────────────────────────
function matchRange(cardVal, minInput, maxInput) {
    const minVal = minInput.value.trim() === '' ? null : Number(minInput.value);
    const maxVal = maxInput.value.trim() === '' ? null : Number(maxInput.value);
    if (minVal === null && maxVal === null) return true;
    if (minVal !== null && maxVal === null) return cardVal >= minVal;
    if (minVal === null && maxVal !== null) return cardVal <= maxVal;
    return cardVal >= minVal && cardVal <= maxVal;
}

// ── 筛选 & 分页 ─────────────────────────────────────────
// V1.9.0：卡池 = DIY + 先行 + 官方 全量（来源只当筛选条件，默认全部）
function poolBaseCards() {
    return allCards;
}

/** 排序：默认按类型/等级/攻击；分值 / 攻击 / 等级 / 卡号 由顶部下拉决定
 *  （分值缺失的卡一律排在后面，避免「没分值」混进分数榜前排） */
function makeSort(key) {
    if (key === 'scoreDesc' || key === 'scoreAsc') {
        const dir = key === 'scoreDesc' ? -1 : 1;
        return (a, b) => {
            const sa = (a._score === null || a._score === undefined) ? null : a._score;
            const sb = (b._score === null || b._score === undefined) ? null : b._score;
            if (sa === null && sb === null) return customCardSort(a, b);
            if (sa === null) return 1;
            if (sb === null) return -1;
            if (sa !== sb) return (sa - sb) * dir;
            return customCardSort(a, b);
        };
    }
    if (key === 'atkDesc') return (a, b) => (b.atk - a.atk) || customCardSort(a, b);
    if (key === 'levelDesc') return (a, b) => (b.level - a.level) || customCardSort(a, b);
    if (key === 'idAsc') return (a, b) => parseInt(a.id, 10) - parseInt(b.id, 10);
    return customCardSort;
}

function getFilteredCards() {
    let filtered = poolBaseCards();
    const keyword = searchInput.value.toLowerCase().trim();
    const isTokenSelected = selectedTypeMasks.has(TOKEN_MASK);

    // 来源：全部 / DIY / 先行 / 官方
    if (selectedSource !== 'all') filtered = filtered.filter(c => c._src === selectedSource);

    // 禁限：不选 = 不限；选了只看对应级别（可多选）
    if (selectedLimits.size) {
        filtered = filtered.filter(c => c._limit !== null && selectedLimits.has(String(c._limit)));
    }

    // 分值区间：没有分值的卡不参与（填了区间就是在查分值表）
    if (scoreMinEl && scoreMaxEl &&
        (scoreMinEl.value.trim() !== '' || scoreMaxEl.value.trim() !== '')) {
        filtered = filtered.filter(c => {
            if (c._score === null || c._score === undefined) return false;
            return matchRange(c._score, scoreMinEl, scoreMaxEl);
        });
    }

    if (isTokenSelected) {
        filtered = filtered.filter(c => c.type & TOKEN_MASK);
    } else {
        filtered = filtered.filter(c => !(c.type & TOKEN_MASK));
        const typeMasks = [...selectedTypeMasks].filter(m => m !== TOKEN_MASK);
        if (typeMasks.length) filtered = filtered.filter(c => typeMasks.every(m => c.type & m));
    }

    if (selectedAttributes.size) filtered = filtered.filter(c => selectedAttributes.has(c.attrName));
    if (selectedRaces.size) filtered = filtered.filter(c => selectedRaces.has(c.raceName));

    filtered = filtered.filter(c =>
        matchRange(c.level, levelMin, levelMax) &&
        matchRange(c.atk, atkMin, atkMax) &&
        matchRange(c.def, defMin, defMax)
    );

    if (keyword) {
        // 空格分词：每个词都必须匹配（AND 逻辑）
        const words = keyword.split(/\s+/).filter(w => w.length > 0);
        filtered = filtered.filter(c => {
            const haystack = ((c.name || '') + ' ' + c.id + ' ' + (c.desc || '')).toLowerCase();
            return words.every(w => haystack.includes(w));
        });
    }

    const sortEl = document.getElementById('poolSort');
    const sortedCards = filtered.sort(makeSort(sortEl ? sortEl.value : 'default'));
    totalPages = Math.ceil(sortedCards.length / PAGE_SIZE);
    const start = (currentPage - 1) * PAGE_SIZE;
    return {
        total: sortedCards.length,
        full: sortedCards, // 筛选后全量（供统计）
        paginated: sortedCards.slice(start, start + PAGE_SIZE),
    };
}

// 更新顶部统计：显示当前搜索结果数（无筛选时即 DIY 总量）
function updateStats(list) {
    if (!list) return;
    document.getElementById('total').textContent = list.length;
    document.getElementById('monster').textContent =
        list.filter(c => (c.typeInfo && c.typeInfo.baseType) === '怪兽').length;
    document.getElementById('totalSpell').textContent =
        list.filter(c => (c.typeInfo && c.typeInfo.baseType) === '魔法').length;
    document.getElementById('totalTrap').textContent =
        list.filter(c => (c.typeInfo && c.typeInfo.baseType) === '陷阱').length;
}

// ── 分页控件 ────────────────────────────────────────────
function renderPagination() {
    paginationContainer.innerHTML = '';
    if (totalPages <= 1) { paginationContainer.style.display = 'none'; return; }
    paginationContainer.style.display = 'flex';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn prev';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => { currentPage--; renderCards(); };
    paginationContainer.appendChild(prevBtn);

    const startPage = Math.max(1, currentPage - 1);
    const endPage = Math.min(totalPages, currentPage + 1);
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => { currentPage = i; renderCards(); };
        paginationContainer.appendChild(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn next';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => { currentPage++; renderCards(); };
    paginationContainer.appendChild(nextBtn);

    const jumpWrap = document.createElement('div');
    jumpWrap.className = 'pagination-jump';
    const input = document.createElement('input');
    input.type = 'number';
    input.min = 1;
    input.max = totalPages;
    input.placeholder = '页码';
    const goBtn = document.createElement('button');
    goBtn.textContent = 'GO';
    goBtn.className = 'pagination-go';
    goBtn.onclick = () => {
        const val = parseInt(input.value);
        if (!isNaN(val) && val >= 1 && val <= totalPages) {
            currentPage = val;
            renderCards();
            input.value = '';
        }
    };
    input.onkeydown = (e) => { if (e.key === 'Enter') goBtn.onclick(); };
    jumpWrap.appendChild(input);
    jumpWrap.appendChild(goBtn);
    paginationContainer.appendChild(jumpWrap);
}

// ── 渲染卡牌 ────────────────────────────────────────────
function renderCards() {
    // 换页/筛选：立即清空排队中的旧图片请求，断开旧观察者
    cancelPendingImageLoads();
    imageObserver.disconnect();

    container.style.opacity = 0;

    const { total: filteredTotal, full: filteredFull, paginated: filteredCards } = getFilteredCards();
    // 统计实时反映当前筛选/搜索结果
    updateStats(filteredFull || []);
    container.innerHTML = '';

    if (filteredTotal === 0) {
        container.innerHTML = '<div class="empty-tip">暂无匹配的卡牌</div>';
        container.style.opacity = 1;
        renderPagination();
        return;
    }

    filteredCards.forEach(card => {
            const ti = card.typeInfo;
            const isMonster = ti.baseType === "怪兽";
            const level = card.level || "-";
            const displayAtk = card.atk === -2 ? '?' : (isNaN(card.atk) ? '-' : card.atk);
            const displayDef = ti.monsterCategory === "连接怪兽"
                ? '-' : (card.def === -2 ? '?' : (isNaN(card.def) ? '-' : card.def));

            const cardEl = document.createElement('div');
            cardEl.className = 'card-item';
            cardEl.setAttribute('data-card-id', card.id);
            cardEl.setAttribute('data-src', card._src || 'diy');
            // V1.9.0 角标：禁 / 限N / N分 / DIY·先行 / 新（同一张卡最多 3 个，避免糊满）
            const badges = [];
            if (card._forbidden) {
                badges.push('<span class="pool-badge b-forbidden">禁</span>');
            } else if (card._limit !== null && card._limit !== undefined && card._limit < 3) {
                badges.push('<span class="pool-badge b-limit lv' + card._limit + '">' + LIMIT_NAME[card._limit] + '</span>');
            }
            if (card._score !== null && card._score !== undefined && card._score > 0) {
                badges.push('<span class="pool-badge b-score">' + card._score + '分</span>');
            }
            if (card._src && card._src !== 'ocg') {
                badges.push('<span class="pool-badge b-src ' + card._src + '">' + (SOURCE_NAME[card._src] || '') + '</span>');
            }
            if (card._new) badges.push('<span class="pool-badge b-new">新</span>');
            cardEl.innerHTML = `
                <div class="card-image-wrapper">
                    <img class="card-image" src="${PLACEHOLDER_SVG}"
                         data-src="https://api.ygopro3.cn/pics/siro/${card.id}.jpg" alt="${card.name}">
                    ${badges.length ? `<div class="pool-badges">${badges.join('')}</div>` : ''}
                    ${card.author ? `<div class="card-author">${card.author}</div>` : ''}
                </div>
                <div class="card-info">
                    <div class="card-name">${card.name || '无名卡牌'}</div>
                    <div class="card-id">ID: ${card.id}</div>
                    <div class="card-type">${ti.fullType}</div>
                    ${isMonster ? `<div>属性：${card.attrName} | 种族：${card.raceName} | 等级：${level}</div>
                    <div>攻击力：${displayAtk} | 防御力：${displayDef}</div>` : ''}
                    <div class="card-desc">${card.processedDesc}</div>
                </div>`;
            container.appendChild(cardEl);
            imageObserver.observe(cardEl.querySelector('.card-image'));
        });

        container.style.opacity = 1;
        renderPagination();
}

// ── 搜索防抖 ────────────────────────────────────────────
let searchDebounceTimer;
function debouncedRender() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        currentPage = 1;
        renderCards();
    }, 250);
}

// ── V1.9.0 顶部控件：来源切换 / 排序 / 禁限 chips / 分值区间 ──────────
function generateLimitFilter() {
    const box = document.getElementById('filterLimitContainer');
    if (!box) return;
    box.innerHTML = '';
    const items = [
        ['禁', '0'], ['限制', '1'], ['准限制', '2'], ['无限制', '3'],
    ];
    items.forEach(([text, val]) => {
        const tag = document.createElement('div');
        tag.className = 'filter-tag';
        tag.dataset.value = val;
        tag.textContent = text;
        tag.addEventListener('click', () => {
            tag.classList.toggle('active');
            tag.classList.contains('active') ? selectedLimits.add(val) : selectedLimits.delete(val);
            currentPage = 1;
            renderCards();
        });
        box.appendChild(tag);
    });
}

function initPoolTopbar() {
    // 来源：单选，默认「全部」
    const srcBox = document.getElementById('poolSourceSwitch');
    if (srcBox) {
        srcBox.querySelectorAll('.pool-mode-btn').forEach(btn => {
            btn.onclick = () => {
                srcBox.querySelectorAll('.pool-mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedSource = btn.dataset.src || 'all';
                currentPage = 1;
                renderCards();
            };
        });
    }

    // 排序
    const sortEl = document.getElementById('poolSort');
    if (sortEl) {
        sortEl.onchange = () => { currentPage = 1; renderCards(); };
    }

    // 分值区间
    scoreMinEl = document.getElementById('scoreMin');
    scoreMaxEl = document.getElementById('scoreMax');
    [scoreMinEl, scoreMaxEl].forEach(el => {
        if (el) el.addEventListener('input', () => { currentPage = 1; renderCards(); });
    });

    // 禁限 chips
    generateLimitFilter();

    // 官方译名查询（弹窗，见 js/ygocdb-search.js）
    const yBtn = document.getElementById('poolYgocdbBtn');
    if (yBtn) {
        yBtn.onclick = function () {
            if (typeof window.openYgocdbQuery === 'function') {
                window.openYgocdbQuery();
            } else {
                alert('官方译名查询模块未加载，请刷新页面重试');
            }
        };
    }
}

/** 深链预设：?goto=banlist → 分值榜（只看有分值的卡，按分值从高到低）
 *  （原「禁限分值」页 = G-Ext 分数表 + OT 禁限表，这里用「分值区间 + 分值排序」等价还原） */
window.poolPresetBanlist = function () {
    try {
        selectedSource = 'all';
        selectedLimits.clear();
        selectedTypeMasks.clear();
        selectedAttributes.clear();
        selectedRaces.clear();
        const srcBox = document.getElementById('poolSourceSwitch');
        if (srcBox) srcBox.querySelectorAll('.pool-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.src === 'all'));
        document.querySelectorAll('#filterLimitContainer .filter-tag').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
        const sortEl = document.getElementById('poolSort');
        if (sortEl) sortEl.value = 'scoreDesc';
        if (scoreMinEl) scoreMinEl.value = '0';
        if (scoreMaxEl) scoreMaxEl.value = '';
        currentPage = 1;
        renderCards();
    } catch (e) { console.warn(e); }
};

// ── 事件绑定 ────────────────────────────────────────────
resetFilterBtn.addEventListener('click', () => {
    selectedTypeMasks.clear();
    selectedAttributes.clear();
    selectedRaces.clear();
    selectedLimits.clear();
    selectedSource = 'all';
    [levelMin, levelMax, atkMin, atkMax, defMin, defMax].forEach(i => i.value = '');
    if (scoreMinEl) scoreMinEl.value = '';
    if (scoreMaxEl) scoreMaxEl.value = '';
    const sortEl = document.getElementById('poolSort');
    if (sortEl) sortEl.value = 'default';
    const srcBox = document.getElementById('poolSourceSwitch');
    if (srcBox) srcBox.querySelectorAll('.pool-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.src === 'all'));
    document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
    searchInput.value = '';
    currentPage = 1;
    renderCards();
});

searchInput.addEventListener('input', debouncedRender);

// ── 数据初始化 ──────────────────────────────────────────
function initCardPoolModule() {
    (async function () {
    try {
        // 分值/禁限表与新卡表（失败也不影响卡池本身）
        const metaJob = loadPoolMeta();

        // 直接从服务端获取预解析好的 JSON（服务端已用 Python sqlite3 处理 CDB）
        const res = await fetch("/api/cards");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        allCards = await res.json();

        await metaJob;              // 等分值/禁限表，才能算角标与筛选
        enrichPoolCards();

        updateStats(allCards);

        document.getElementById('stats').style.display = 'flex';
        document.querySelector('.search-filter-container').style.display = 'flex';

        // 移动端筛选按钮
        initMobilePoolFilter();

        // 构建卡号索引，供新卡列表快速查找
        window._cardIndex = new Map();
        allCards.forEach(c => window._cardIndex.set(parseInt(c.id), c));

        generateAllFilters();
        initPoolTopbar();
        renderCards();

        // 初始化新卡列表功能
        initNewCardsFeature();
    } catch (e) {
        container.innerHTML =
            `<div class="empty-tip" style="color:#ff4444">加载失败：${e.message}</div>`;
        console.error("数据加载失败：", e);
    }
    })();
}

// ── 移动端筛选弹窗 ──────────────────────────────────────
function initMobilePoolFilter() {
    const section = document.getElementById('section-card-pool');
    const filterContainer = document.querySelector('.search-filter-container');

    // 创建移动端筛选按钮
    const btn = document.createElement('button');
    btn.className = 'mobile-pool-filter-btn';
    btn.id = 'mobilePoolFilterBtn';
    btn.textContent = '☰';
    btn.title = '筛选';
    section.appendChild(btn);

    // 在筛选容器内添加关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'mobile-pool-filter-close';
    closeBtn.textContent = '×';
    filterContainer.appendChild(closeBtn);

    const openFilter = () => {
        filterContainer.classList.add('mobile-open');
        document.body.style.overflow = 'hidden';
    };
    const closeFilter = () => {
        filterContainer.classList.remove('mobile-open');
        document.body.style.overflow = '';
    };

    btn.addEventListener('click', openFilter);
    closeBtn.addEventListener('click', closeFilter);
    // 点击遮罩背景关闭
    filterContainer.addEventListener('click', (e) => {
        if (e.target === filterContainer) closeFilter();
    });
}

// ═══════════════════════════════════════════════════════
// 新卡列表 — 模态框功能
// ═══════════════════════════════════════════════════════

let newCardsData = null;       // 已加载的 JSON 数据
let newCardsDates = [];        // 排序后的日期列表
let newCardsActiveDate = '';   // 当前选中的日期
let newCardsModalOpen = false;

// 模态框内的图片懒加载观察者
const newCardsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            newCardsObserver.unobserve(img);
            enqueueImageLoad(img, img.dataset.src);
        }
    });
}, { rootMargin: '100px 0px' });

function initNewCardsFeature() {
    // 在卡池页面右上角添加触发按钮
    const section = document.getElementById('section-card-pool');
    const btn = document.createElement('button');
    btn.className = 'new-cards-trigger';
    btn.id = 'newCardsTrigger';
    btn.textContent = '新卡列表';
    btn.onclick = openNewCardsModal;
    section.appendChild(btn);
}

async function loadNewCardsData() {
    if (newCardsData) return;
    try {
        const resp = await fetch('new_cards.json');
        newCardsData = await resp.json();
        newCardsDates = Object.keys(newCardsData).sort().reverse();
    } catch (e) {
        console.error('加载新卡列表失败：', e);
        newCardsData = {};
        newCardsDates = [];
    }
}

function openNewCardsModal() {
    // 防止重复打开
    if (document.getElementById('newCardsOverlay')) return;
    newCardsModalOpen = true;

    // 先加载数据再渲染
    loadNewCardsData().then(() => {
        if (newCardsDates.length === 0) {
            newCardsModalOpen = false;
            alert('暂无新卡数据');
            return;
        }
        newCardsActiveDate = newCardsDates[0];
        buildNewCardsModal();
        renderNewCards();
    });
}

function closeNewCardsModal() {
    const overlay = document.getElementById('newCardsOverlay');
    if (overlay) {
        newCardsObserver.disconnect();
        overlay.remove();
    }
    newCardsModalOpen = false;
    newCardsActiveDate = '';

    // 重新扫描卡池中尚未加载的可见图片
    const visibleImages = document.querySelectorAll('#cardContainer .card-image[src^="data:image/svg+xml"]');
    visibleImages.forEach(img => imageObserver.observe(img));
}

function buildNewCardsModal() {
    // 遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'new-cards-overlay';
    overlay.id = 'newCardsOverlay';
    overlay.onclick = (e) => {
        if (e.target === overlay) closeNewCardsModal();
    };

    // 日期选项
    const dateChips = newCardsDates.map((d, i) =>
        `<div class="new-cards-date-option${d === newCardsActiveDate ? ' active' : ''}" data-date="${d}">${d}</div>`
    ).join('');

    overlay.innerHTML = `
        <div class="new-cards-modal" onclick="event.stopPropagation()">
            <div class="new-cards-topbar">
                <div class="new-cards-topbar-left">
                    <div class="new-cards-date-dropdown" id="newCardsDateDropdown">
                        <div class="new-cards-date-trigger" id="newCardsDateTrigger">
                            <span id="newCardsDateLabel">${newCardsActiveDate}</span>
                            <span class="new-cards-date-arrow">▼</span>
                        </div>
                        <div class="new-cards-date-panel" id="newCardsDatePanel">
                            ${dateChips}
                        </div>
                    </div>
                    <span class="new-cards-card-count" id="newCardsCount"></span>
                </div>
                <button class="new-cards-close" onclick="closeNewCardsModal()">&times;</button>
            </div>
            <div class="new-cards-grid" id="newCardsGrid">
                <div class="empty-tip">加载中…</div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // 日期下拉：点击触发器展开/收起
    const dateDropdown = document.getElementById('newCardsDateDropdown');
    const dateTrigger = document.getElementById('newCardsDateTrigger');
    const datePanel = document.getElementById('newCardsDatePanel');
    const dateLabel = document.getElementById('newCardsDateLabel');

    dateTrigger.onclick = function (e) {
        e.stopPropagation();
        const isOpen = dateDropdown.classList.toggle('open');
        if (isOpen) {
            datePanel.style.maxHeight = datePanel.scrollHeight + 'px';
        } else {
            datePanel.style.maxHeight = '0';
        }
    };

    // 点击选项
    datePanel.onclick = function (e) {
        const opt = e.target.closest('.new-cards-date-option');
        if (!opt) return;
        newCardsActiveDate = opt.dataset.date;
        dateLabel.textContent = newCardsActiveDate;
        datePanel.querySelectorAll('.new-cards-date-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        // 收起
        dateDropdown.classList.remove('open');
        datePanel.style.maxHeight = '0';
        renderNewCards();
    };

    // 点击外部关闭
    document.addEventListener('click', function collapseDateDropdown(e) {
        if (!dateDropdown.contains(e.target)) {
            dateDropdown.classList.remove('open');
            datePanel.style.maxHeight = '0';
        }
    });

    // ESC 关闭
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeNewCardsModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function renderNewCards() {
    const grid = document.getElementById('newCardsGrid');
    const countEl = document.getElementById('newCardsCount');
    if (!grid) return;

    // 清队 + 断连旧观察
    cancelPendingImageLoads();
    newCardsObserver.disconnect();

    const ids = newCardsData[newCardsActiveDate] || [];
    const cardIndex = window._cardIndex;

    // 查找匹配的卡片
    const matched = [];
    for (const id of ids) {
        const card = cardIndex.get(id);
        if (card) matched.push(card);
    }

    countEl.textContent = `(${matched.length} 张)`;

    if (matched.length === 0) {
        grid.innerHTML = '<div class="empty-tip">该日期暂无匹配卡片数据</div>';
        return;
    }

    // 判断是否为最新一期
    const isLatest = newCardsActiveDate === newCardsDates[0];

    grid.innerHTML = '';
    matched.forEach(card => {
        const ti = card.typeInfo;
        const isMonster = ti.baseType === '怪兽';
        const level = card.level || '-';
        const displayAtk = card.atk === -2 ? '?' : (isNaN(card.atk) ? '-' : card.atk);
        const displayDef = ti.monsterCategory === '连接怪兽'
            ? '-' : (card.def === -2 ? '?' : (isNaN(card.def) ? '-' : card.def));

        const cardEl = document.createElement('div');
        cardEl.className = 'card-item';
        cardEl.innerHTML = `
            <div class="card-image-wrapper">
                <div class="card-image-inner">
                    <img class="card-image" src="${PLACEHOLDER_SVG}"
                         data-src="https://api.ygopro3.cn/pics/siro/${card.id}.jpg" alt="${card.name}">
                    ${isLatest ? `<img class="new-card-badge${ti.subTypes.includes('灵摆') ? ' pendulum-badge' : ''}" src="cardlogo.png" alt="NEW">` : ''}
                </div>
                ${card.author ? `<div class="card-author">${card.author}</div>` : ''}
            </div>
            <div class="card-info">
                <div class="card-name">${card.name || '无名卡牌'}</div>
                <div class="card-id">ID: ${card.id}</div>
                <div class="card-type">${ti.fullType}</div>
                ${isMonster ? `<div>属性：${card.attrName} | 种族：${card.raceName} | 等级：${level}</div>
                <div>攻击力：${displayAtk} | 防御力：${displayDef}</div>` : ''}
                <div class="card-desc">${card.processedDesc}</div>
            </div>`;
        grid.appendChild(cardEl);
        newCardsObserver.observe(cardEl.querySelector('.card-image'));
    });
}
