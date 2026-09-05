/**
 * 白神服Sirokami — 组卡模式（卡池信息页）
 * 三栏布局：
 *   左栏 — 点卡详情 + 加入按钮
 *   中栏 — 卡组编辑（主/额外/副）
 *   右栏 — 搜卡系统（搜索 + 卡图网格，一行5张滚动，仅卡图+分值）
 * 规则：G-Ext 同名≤3、禁卡不可入、总分 X/100 超限标红
 * 导出：下载 .ydk / 复制卡组码
 */
(function () {
    'use strict';

    var toggleBtn = document.getElementById('deckBuilderToggle');
    var layout = document.getElementById('dbLayout');
    var builderActive = false;

    // 卡组三区
    var zones = {
        main: { list: [], max: 60, el: null, countEl: null },
        extra: { list: [], max: 15, el: null, countEl: null },
        side: { list: [], max: 15, el: null, countEl: null },
    };
    zones.main.el = document.getElementById('dbMainCards');
    zones.main.countEl = document.getElementById('dbMainCount');
    zones.extra.el = document.getElementById('dbExtraCards');
    zones.extra.countEl = document.getElementById('dbExtraCount');
    zones.side.el = document.getElementById('dbSideCards');
    zones.side.countEl = document.getElementById('dbSideCount');

    // 数据
    var scoreMap = null;
    var scoreLimit = 100;
    var diyCards = [];      // DIY 全量卡（/api/cards）
    var diyIndex = null;    // Map<id, card>
    var officialMode = false; // 当前右栏搜 DIY 还是官方（跟主页面模式走）
    var officialResults = []; // 官方模式搜索结果
    var allTypes = null;    // DIY 类型筛选

    // 当前详情卡
    var detailCard = null;   // { id, name, typeInfo... } DIY 结构
    var detailId = null;

    // 右栏搜索状态
    var searchQuery = '';
    var PAGE = 60;

    var gridEl = document.getElementById('dbGrid');
    var gridTipEl = document.getElementById('dbGridTip');
    var searchInputEl = document.getElementById('dbSearchInput');

    // ── 工具 ──
    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    function $(id) { return document.getElementById(id); }

    function isExtraMonster(card) {
        if (!card || !card.typeInfo) return false;
        var sub = (card.typeInfo.subTypes || []).join(' ');
        var cat = card.typeInfo.monsterCategory || '';
        return /融合|同调|超量|连接/.test(sub + ' ' + cat);
    }

    // ── 分数加载 ──
    function loadScores() {
        if (scoreMap) return Promise.resolve(scoreMap);
        return fetch('/api/scores?t=' + Date.now())
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                var limit = parseInt(resp.headers.get('X-GExt-Limit'), 10);
                if (!isNaN(limit) && limit > 0) scoreLimit = limit;
                return resp.json();
            })
            .then(function (data) { scoreMap = data || {}; return scoreMap; })
            .catch(function () { scoreMap = {}; return scoreMap; });
    }

    function cardScoreOf(id) {
        var s = scoreMap && scoreMap[id];
        return s || null;
    }

    // ── 卡图 URL ──
    function cardImgHtml(id, extraCls) {
        return '<img class="' + (extraCls || 'db-img') + '" src="https://api.ygopro3.cn/pics/siro/' + id
            + '.jpg" alt="' + id + '" loading="lazy"'
            + ' onerror="this.onerror=null;this.src=\'https://cdn.233.momobako.com/ygopro/pics/' + id
            + '.jpg\';this.onerror=function(){this.onerror=null;this.src=\'cover.jpg\';}">';
    }

    // ── 规则校验 ──
    function checkAdd(zoneKey, id) {
        var zone = zones[zoneKey];
        var sc = cardScoreOf(id);
        if (sc && sc.forbidden) {
            return { ok: false, reason: '🚫 该卡在 G-Ext 中为禁止卡' };
        }
        var totalSame = 0;
        ['main', 'extra', 'side'].forEach(function (k) {
            zones[k].list.forEach(function (cid) { if (cid === id) totalSame++; });
        });
        if (totalSame >= 3) {
            return { ok: false, reason: '同名卡最多 3 张' };
        }
        if (zone.list.length >= zone.max) {
            return { ok: false, reason: zoneKey === 'main'
                ? '主卡组最多 60 张' : (zoneKey === 'extra' ? '额外卡组最多 15 张' : '副卡组最多 15 张') };
        }
        return { ok: true };
    }

    function calcTotalScore() {
        var total = 0;
        ['main', 'extra', 'side'].forEach(function (k) {
            zones[k].list.forEach(function (cid) {
                var s = cardScoreOf(cid);
                if (s && !s.forbidden) total += (s.score || 0);
            });
        });
        return total;
    }

    // ── 卡组渲染 ──
    function renderAll() {
        renderZone('main');
        renderZone('extra');
        renderZone('side');
        var scoreEl = $('dbScore');
        if (!scoreMap) {
            scoreEl.textContent = '总分：…/100';
            scoreEl.style.color = '#888';
            return;
        }
        var total = calcTotalScore();
        scoreEl.textContent = '总分：' + total + '/' + scoreLimit;
        scoreEl.style.color = total > scoreLimit ? '#ff6b6b' : '#F0E68C';
    }

    function refreshScore() {
        loadScores().then(renderAll);
    }

    function renderZone(zoneKey) {
        var zone = zones[zoneKey];
        zone.el.innerHTML = zone.list.length
            ? zone.list.map(function (id, i) {
                return '<div class="db-card-slot" data-zone="' + zoneKey + '" data-index="' + i
                    + '" data-id="' + id + '" title="点击移除">'
                    + '<div class="db-slot-score">' + scoreBadgeText(id) + '</div>'
                    + cardImgHtml(id, 'db-card-img')
                    + '<span class="db-remove">×</span></div>';
            }).join('')
            : '<div class="db-zone-empty">空</div>';
        zone.countEl.textContent = zone.list.length;
    }

    function scoreBadgeText(id) {
        var sc = cardScoreOf(id);
        if (!sc) return '';
        if (sc.forbidden) return '🚫';
        return String(sc.score);
    }

    // ── 卡组排序（降序：大怪在前）──
    // 属性优先级：神 > 光 > 暗 > 地 > 水 > 风 > 炎
    var ATTR_ORDER = ['神', '光', '暗', '地', '水', '风', '炎'];
    var MONSTER_TYPE_ORDER = { '融合': 0, '同调': 1, '超量': 2, '连接': 3 };
    var MAGIC_ORDER = { '通常': 0, '速攻': 1, '装备': 2, '仪式': 3, '永续': 4, '场地': 5 };
    var TRAP_ORDER = { '通常': 0, '永续': 1, '反击': 2 };

    function cardInfoForSort(id) {
        if (diyIndex && diyIndex.get) return diyIndex.get(parseInt(id, 10)) || null;
        return null;
    }

    // 主/副卡组排序比较（怪兽 > 魔法 > 陷阱）
    function compareMainCard(a, b) {
        var ca = cardInfoForSort(a), cb = cardInfoForSort(b);
        var ta = ca && ca.typeInfo || {};
        var tb = cb && cb.typeInfo || {};
        var ga = groupOf(ta), gb = groupOf(tb);
        if (ga !== gb) return ga - gb; // 怪兽0 魔法1 陷阱2
        if (ga === 0) return compareMonster(ca, cb, ta, tb);
        if (ga === 1) return compareMagic(ca, cb, ta, tb);
        return compareTrap(ca, cb, ta, tb);
    }

    function groupOf(ti) {
        if (ti.baseType === '怪兽') return 0;
        if (ti.baseType === '魔法') return 1;
        return 2; // 陷阱等
    }

    function hasTag(ti, tag) {
        return (ti.subTypes || []).indexOf(tag) !== -1;
    }

    // 怪兽：类型序(仅限额外怪兽，普通怪-1) → 等级↓ → 攻↓ → 守↓ → 属性序
    function compareMonster(ca, cb, ta, tb) {
        var ma = extraTypeRank(ta), mb = extraTypeRank(tb);
        if (ma !== mb) return mb - ma; // 融合/同调/超量/连接在前？主卡组通常无额外怪，此处兜底：普通怪兽统一排后
        var la = ca.level || 0, lb = cb.level || 0;
        if (la !== lb) return lb - la;
        var aa = ca.atk < 0 ? -1 : (ca.atk || 0);
        var ab = cb.atk < 0 ? -1 : (cb.atk || 0);
        if (aa !== ab) return ab - aa;
        var da = ca.def < 0 ? -1 : (ca.def || 0);
        var db = cb.def < 0 ? -1 : (cb.def || 0);
        if (da !== db) return db - da;
        return attrRank(ca.attrName) - attrRank(cb.attrName);
    }

    // 额外怪兽在主卡组不应出现，这里给个极低优先级，让普通怪兽先排
    function extraTypeRank(ti) {
        var m = MONSTER_TYPE_ORDER[ti.monsterCategory || ''];
        if (m !== undefined) return -10 - m; // 融合/同调等主卡组少见，排最后
        return 0;
    }

    // 魔法：通常→速攻→装备→仪式→永续→场地（类型相同按 id 稳定即可）
    function compareMagic(ca, cb, ta, tb) {
        var ma = magicRank(ta), mb = magicRank(tb);
        return ma - mb;
    }

    function magicRank(ti) {
        for (var i = 0; i < (ti.subTypes || []).length; i++) {
            var t = ti.subTypes[i];
            if (t in MAGIC_ORDER) return MAGIC_ORDER[t];
        }
        return 99;
    }

    // 陷阱：通常→永续→反击
    function compareTrap(ca, cb, ta, tb) {
        return trapRank(ta) - trapRank(tb);
    }

    function trapRank(ti) {
        for (var i = 0; i < (ti.subTypes || []).length; i++) {
            var t = ti.subTypes[i];
            if (t in TRAP_ORDER) return TRAP_ORDER[t];
        }
        return 99;
    }

    function attrRank(name) {
        var idx = ATTR_ORDER.indexOf(name || '');
        return idx === -1 ? 99 : idx;
    }

    // 额外卡组排序：融合→同调→超量→连接，组内 等级↓→攻↓→守↓
    function compareExtraCard(a, b) {
        var ca = cardInfoForSort(a), cb = cardInfoForSort(b);
        var ta = ca && ca.typeInfo || {}, tb = cb && cb.typeInfo || {};
        var ma = extraKind(ta), mb = extraKind(tb);
        if (ma !== mb) return ma - mb;
        return compareMonsterInner(ca, cb);
    }

    function extraKind(ti) {
        var cat = ti.monsterCategory || '';
        if (cat === '融合怪兽') return 0;
        if (cat === '同调怪兽') return 1;
        if (cat === '超量怪兽') return 2;
        if (cat === '连接怪兽') return 3;
        // 兜底按 subTypes
        var subs = ti.subTypes || [];
        if (subs.indexOf('融合') !== -1) return 0;
        if (subs.indexOf('同调') !== -1) return 1;
        if (subs.indexOf('超量') !== -1) return 2;
        if (subs.indexOf('连接') !== -1) return 3;
        return 4;
    }

    function compareMonsterInner(ca, cb) {
        var la = ca.level || 0, lb = cb.level || 0;
        if (la !== lb) return lb - la;
        var aa = ca.atk < 0 ? -1 : (ca.atk || 0);
        var ab = cb.atk < 0 ? -1 : (cb.atk || 0);
        if (aa !== ab) return ab - aa;
        var da = ca.def < 0 ? -1 : (ca.def || 0);
        var db = cb.def < 0 ? -1 : (cb.def || 0);
        if (da !== db) return db - da;
        return attrRank(ca.attrName) - attrRank(cb.attrName);
    }

    function sortDeck() {
        ['main', 'side'].forEach(function (k) {
            zones[k].list.sort(compareMainCard);
        });
        zones.extra.list.sort(compareExtraCard);
        renderAll();
        refreshScore();
        toast('卡组已排序（降序）');
    }

    // ── 加减卡 ──
    function addCard(zoneKey, id) {
        var res = checkAdd(zoneKey, id);
        if (!res.ok) { toast(res.reason); return false; }
        zones[zoneKey].list.push(id);
        renderAll();
        refreshScore();
        return true;
    }

    function removeCard(zoneKey, index) {
        zones[zoneKey].list.splice(index, 1);
        renderAll();
        refreshScore();
    }

    // 加入按钮（左栏详情底部）
    function bindDetailAddButtons() {
        document.querySelectorAll('.db-detail-add[data-zone]').forEach(function (b) {
            b.onclick = function () {
                if (detailId == null) { toast('请先选择一张卡片'); return; }
                addCard(b.getAttribute('data-zone'), detailId);
            };
        });
    }

    // ── 左栏：详情 ──
    function renderDetail(id, name, typeHtml, detailRowsHtml, desc) {
        detailId = id;
        var sc = cardScoreOf(id);
        var scHtml = sc
            ? (sc.forbidden
                ? '<div class="db-detail-score" style="color:#ff6b6b;">🚫 禁止使用</div>'
                : '<div class="db-detail-score">G-Ext 分值：<b>' + sc.score + '</b> 分</div>')
            : '<div class="db-detail-score" style="color:#999;">无分值（普通卡）</div>';
        var body = $('dbDetailBody');
        body.innerHTML =
            '<div class="db-detail-head">'
            + '<div class="db-detail-card">'
            + cardImgHtml(id, 'db-detail-img')
            + '</div>'
            + '<div class="db-detail-name">' + escapeHtml(name) + '</div>'
            + scHtml
            + typeHtml
            + detailRowsHtml
            + '</div>'
            + '<div class="db-detail-scroll">'
            + '<div class="db-detail-desc">' + (desc || '') + '</div>'
            + '</div>'
            + '<div class="db-detail-actions">'
            + '<button class="db-detail-add" data-zone="main">加入主卡组</button>'
            + '<button class="db-detail-add" data-zone="extra">加入额外</button>'
            + '<button class="db-detail-add" data-zone="side">加入副卡组</button>'
            + '</div>';
        bindDetailAddButtons();
    }

    function showDetailForDiyCard(card) {
        if (!card) return;
        var ti = card.typeInfo || {};
        var isMon = ti.baseType === '怪兽';
        var rows = '';
        if (isMon) {
            var level = card.level || '-';
            var atk = card.atk === -2 ? '?' : (isNaN(card.atk) ? '-' : card.atk);
            var def = (ti.monsterCategory === '连接怪兽')
                ? '-' : (card.def === -2 ? '?' : (isNaN(card.def) ? '-' : card.def));
            rows = '<div class="db-detail-rows">'
                + '<span>属性：' + (card.attrName || '-') + '</span>'
                + '<span>种族：' + (card.raceName || '-') + '</span>'
                + '<span>等级：' + level + '</span></div>'
                + '<div class="db-detail-rows">'
                + '<span>ATK ' + atk + '</span><span>DEF ' + def + '</span></div>';
        }
        var typeHtml = '<div class="db-detail-type">' + escapeHtml(ti.fullType || '') + '</div>';
        renderDetail(card.id, card.name, typeHtml, rows, card.processedDesc || card.desc || '');
    }

    // ── 右栏：搜索与网格 ──
    function loadDiyData() {
        if (diyCards.length) return Promise.resolve(diyCards);
        return fetch('/api/cards?t=' + Date.now())
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (cards) {
                diyCards = cards || [];
                diyIndex = new Map();
                diyCards.forEach(function (c) { diyIndex.set(parseInt(c.id, 10), c); });
                return diyCards;
            })
            .catch(function (e) {
                gridTipEl.textContent = 'DIY 卡数据加载失败：' + e.message;
                return [];
            });
    }

    // 类型筛选（简版：怪兽/魔法/陷阱/额外怪兽）
    // ── 类型筛选（大类型 + 细分）──
    var selBase = '';       // '' | '怪兽' | '魔法' | '陷阱'
    var selMSub = {};       // 怪兽细分标签多选
    var selSSub = {};       // 魔法细分标签多选
    var selTSub = {};       // 陷阱细分标签多选

    var BASE_TYPES = ['怪兽', '魔法', '陷阱'];
    var MONSTER_SUB_TAGS = ['效果', '通常', '调整', '反转', '灵魂', '二重', '同盟', '卡通',
        '衍生物', '仪式', '融合', '同调', '超量', '灵摆', '连接', '特殊召唤'];
    var SPELL_SUB_TAGS = ['通常', '速攻', '装备', '仪式', '永续', '场地'];
    var TRAP_SUB_TAGS = ['通常', '永续', '反击'];

    function chipHtml(tag, selected) {
        return '<button class="db-af-chip' + (selected ? ' active' : '') + '" data-v="'
            + escapeHtml(tag) + '">' + escapeHtml(tag) + '</button>';
    }

    // 填充 4 组类型 chips（大类型单选互斥；细分多选）
    function buildTypeGroups() {
        var baseBox = $('dbFilterTypes');
        var mBox = $('dbFilterMonsterSub');
        var sBox = $('dbFilterSpellSub');
        var tBox = $('dbFilterTrapSub');
        if (!baseBox) return;

        baseBox.innerHTML = BASE_TYPES.map(function (b) {
            return chipHtml(b, selBase === b);
        }).join('');
        baseBox.querySelectorAll('.db-af-chip').forEach(function (b) {
            b.addEventListener('click', function () {
                var v = b.getAttribute('data-v');
                selBase = (selBase === v) ? '' : v; // 再次点击取消
                baseBox.querySelectorAll('.db-af-chip').forEach(function (x) {
                    x.classList.toggle('active', x.getAttribute('data-v') === selBase);
                });
                refreshAdvFilterCount();
                doSearch();
            });
        });

        function bindSubBox(box, store) {
            if (!box) return;
            box.querySelectorAll('.db-af-chip').forEach(function (b) {
                b.addEventListener('click', function () {
                    var v = b.getAttribute('data-v');
                    if (store[v]) delete store[v]; else store[v] = 1;
                    b.classList.toggle('active');
                    refreshAdvFilterCount();
                    doSearch();
                });
            });
        }

        if (mBox) {
            mBox.innerHTML = MONSTER_SUB_TAGS.map(function (t) { return chipHtml(t, !!selMSub[t]); }).join('');
            bindSubBox(mBox, selMSub);
        }
        if (sBox) {
            sBox.innerHTML = SPELL_SUB_TAGS.map(function (t) { return chipHtml(t, !!selSSub[t]); }).join('');
            bindSubBox(sBox, selSSub);
        }
        if (tBox) {
            tBox.innerHTML = TRAP_SUB_TAGS.map(function (t) { return chipHtml(t, !!selTSub[t]); }).join('');
            bindSubBox(tBox, selTSub);
        }
        refreshAdvFilterCount();
    }

    // 细分标签命中：卡 subTypes 含任一选中 tag（对魔法/陷阱，"通常"指其自身细分；"仪式"魔法指仪式魔法）
    function matchSubTags(card, store) {
        var keys = Object.keys(store);
        if (!keys.length) return true;
        var subs = (card.typeInfo && card.typeInfo.subTypes) || [];
        for (var i = 0; i < keys.length; i++) {
            if (subs.indexOf(keys[i]) !== -1) return true;
        }
        return false;
    }

    // 高级筛选：chips 填充 + 折叠 + 变更即刷新
    function initAdvFilters() {
        var attrBox = $('dbFilterAttr');
        var raceBox = $('dbFilterRace');
        if (!attrBox || !raceBox) return;

        // 类型组（大类型 + 细分）先构建
        buildTypeGroups();

        attrBox.innerHTML = ADV_FILTERS_ATTRS.map(function (a) {
            return chipHtml(a, !!selAttrs[a]);
        }).join('');
        raceBox.innerHTML = ADV_FILTERS_RACES.map(function (r) {
            return chipHtml(r, !!selRaces[r]);
        }).join('');

        attrBox.querySelectorAll('.db-af-chip').forEach(function (b) {
            b.addEventListener('click', function () {
                var v = b.getAttribute('data-v');
                if (selAttrs[v]) delete selAttrs[v]; else selAttrs[v] = 1;
                b.classList.toggle('active');
                refreshAdvFilterCount();
                doSearch();
            });
        });
        raceBox.querySelectorAll('.db-af-chip').forEach(function (b) {
            b.addEventListener('click', function () {
                var v = b.getAttribute('data-v');
                if (selRaces[v]) delete selRaces[v]; else selRaces[v] = 1;
                b.classList.toggle('active');
                refreshAdvFilterCount();
                doSearch();
            });
        });

        // 范围输入框
        ['dbFLevelMin', 'dbFLevelMax', 'dbFAtkMin', 'dbFAtkMax', 'dbFDefMin', 'dbFDefMax', 'dbFScoreMin', 'dbFScoreMax']
            .forEach(function (id) {
                var el = $(id);
                if (el) el.addEventListener('input', function () {
                    refreshAdvFilterCount();
                    doSearch();
                });
            });

        // 折叠开关
        var tg = $('dbFilterToggle');
        var panel = $('dbAdvFilters');
        if (tg && panel) {
            tg.addEventListener('click', function () {
                var open = panel.style.display !== 'block';
                panel.style.display = open ? 'block' : 'none';
                tg.classList.toggle('active', open);
            });
        }
        refreshAdvFilterCount();
    }

    function refreshAdvFilterCount() {
        var n = Object.keys(selAttrs).length + Object.keys(selRaces).length;
        if (selBase) n++;
        n += Object.keys(selMSub).length + Object.keys(selSSub).length + Object.keys(selTSub).length;
        ['dbFLevelMin', 'dbFLevelMax', 'dbFAtkMin', 'dbFAtkMax', 'dbFDefMin', 'dbFDefMax', 'dbFScoreMin', 'dbFScoreMax']
            .forEach(function (id) {
                var el = $(id);
                if (el && el.value !== '') n++;
            });
        var countEl = $('dbFilterCount');
        if (countEl) countEl.textContent = n ? '(' + n + ')' : '';
    }

    function resetAdvFilters() {
        selAttrs = {};
        selRaces = {};
        selBase = '';
        selMSub = {};
        selSSub = {};
        selTSub = {};
        ['dbFLevelMin', 'dbFLevelMax', 'dbFAtkMin', 'dbFAtkMax', 'dbFDefMin', 'dbFDefMax', 'dbFScoreMin', 'dbFScoreMax']
            .forEach(function (id) { var el = $(id); if (el) el.value = ''; });
        var attrBox = $('dbFilterAttr'), raceBox = $('dbFilterRace');
        if (attrBox) attrBox.querySelectorAll('.db-af-chip').forEach(function (b) { b.classList.remove('active'); });
        if (raceBox) raceBox.querySelectorAll('.db-af-chip').forEach(function (b) { b.classList.remove('active'); });
        // 类型组（若 DOM 存在则重绘，保持与状态一致）
        ['dbFilterTypes', 'dbFilterMonsterSub', 'dbFilterSpellSub', 'dbFilterTrapSub'].forEach(function (id) {
            var box = $(id);
            if (box) box.innerHTML = '';
        });
        buildTypeGroups();
        refreshAdvFilterCount();
    }

    // ── 高级筛选状态（读输入框）──
    var ADV_FILTERS_ATTRS = ['光', '暗', '地', '水', '风', '炎', '神'];
    var ADV_FILTERS_RACES = ['战士族', '魔法师族', '龙族', '机械族', '天使族', '恶魔族', '不死族',
        '水族', '炎族', '岩石族', '鸟兽族', '植物族', '昆虫族', '雷族', '兽族', '兽战士族',
        '恐龙族', '鱼族', '海龙族', '爬虫类族', '念动力族', '幻神兽族', '幻龙族', '电子界族', '幻想魔族', '创造神族'];
    var selAttrs = {};  // 属性多选
    var selRaces = {};  // 种族多选

    function numOf(id) {
        var el = document.getElementById(id);
        if (!el) return null;
        var v = parseFloat(el.value);
        return isNaN(v) ? null : v;
    }

    function rangeMatch(val, minId, maxId) {
        if (val == null || val === -2 || isNaN(val)) {
            // ？或未知的攻守：仅在无下限要求时放行
            var lo = numOf(minId);
            return lo == null;
        }
        var lo = numOf(minId), hi = numOf(maxId);
        if (lo != null && val < lo) return false;
        if (hi != null && val > hi) return false;
        return true;
    }

    function matchFilter(card) {
        var ti = card.typeInfo || {};
        var subs = ti.subTypes || [];
        var base = ti.baseType; // 怪兽/魔法/陷阱
        var mKeys = Object.keys(selMSub);
        var sKeys = Object.keys(selSSub);
        var tKeys = Object.keys(selTSub);

        // 大类型限定集合：显式 selBase + 细分隐式所属类型
        var baseWanted = {};
        if (selBase) baseWanted[selBase] = 1;
        if (mKeys.length) baseWanted['怪兽'] = 1;
        if (sKeys.length) baseWanted['魔法'] = 1;
        if (tKeys.length) baseWanted['陷阱'] = 1;
        var baseList = Object.keys(baseWanted);
        // 卡不在任何限定大类型中 → 排除（无论显式或细分触发）
        if (baseList.length && baseList.indexOf(base) === -1) return false;

        // 细分标签匹配（只对同 base 生效；base 未命中已在上面排除）
        // 特殊：通常魔法/通常陷阱的 subTypes 为空数组（不标注"通常"），
        // 需按"无其它细分标签"判定；通常怪兽则 subTypes 含"通常"。
        function hitSubTags(tags) {
            var isUsualOnly = tags.length === 1 && tags[0] === '通常';
            for (var i = 0; i < tags.length; i++) {
                if (tags[i] === '通常') {
                    if (subs.indexOf('通常') !== -1) return true;
                    if (subs.length === 0) return true; // 通常魔法/陷阱（无标签）
                    continue;
                }
                if (subs.indexOf(tags[i]) !== -1) return true;
            }
            return false;
        }
        if (base === '怪兽' && mKeys.length && !hitSubTags(mKeys)) return false;
        if (base === '魔法' && sKeys.length && !hitSubTags(sKeys)) return false;
        if (base === '陷阱' && tKeys.length && !hitSubTags(tKeys)) return false;
        // 属性
        var attrKeys = Object.keys(selAttrs);
        if (attrKeys.length && (attrKeys.indexOf(card.attrName || '') === -1)) return false;
        // 种族
        var raceKeys = Object.keys(selRaces);
        if (raceKeys.length && (raceKeys.indexOf(card.raceName || '') === -1)) return false;
        // 等级/攻/守范围（仅怪兽）
        if (base === '怪兽') {
            var lv = card.level || 0;
            var loLv = numOf('dbFLevelMin'), hiLv = numOf('dbFLevelMax');
            if (loLv != null && lv < loLv) return false;
            if (hiLv != null && lv > hiLv) return false;
            if (!rangeMatch(card.atk, 'dbFAtkMin', 'dbFAtkMax')) return false;
            if (!rangeMatch(card.def, 'dbFDefMin', 'dbFDefMax')) return false;
        }
        // 分值（-1 表示筛禁卡）
        var sc = cardScoreOf(card.id);
        var loS = numOf('dbFScoreMin'), hiS = numOf('dbFScoreMax');
        if (loS === -1 || hiS === -1) {
            // 任一填 -1 → 只看禁卡
            return !!(sc && sc.forbidden);
        }
        if (loS != null || hiS != null) {
            var scVal = sc && !sc.forbidden ? (sc.score || 0) : null;
            if (scVal == null) return false; // 无分卡在有分值筛选时排除
            if (loS != null && scVal < loS) return false;
            if (hiS != null && scVal > hiS) return false;
        }
        return true;
    }

    function matchQuery(card, q) {
        if (!q) return true;
        q = q.toLowerCase();
        var text = (card.name || '') + ' ' + card.id + ' '
            + (card.processedDesc || card.desc || '')
            + (card.typeInfo && card.typeInfo.fullType ? card.typeInfo.fullType : '');
        return text.toLowerCase().indexOf(q) !== -1;
    }

    // DIY 搜索：返回过滤后的全量（分页由滚动加载控制）
    function diySearchList() {
        var q = searchQuery;
        var list = diyCards.filter(function (c) {
            return matchFilter(c) && matchQuery(c, q);
        });
        return list;
    }

    // ── 右栏网格：滚动懒加载（一批 PAGE 张，滚近底部加载下一批）──
    var gridList = [];       // 当前完整结果集
    var gridLoaded = 0;      // 已渲染张数
    var gridLoading = false; // 防重入
    var gridScrollHandler = null;

    function cellHtml(c) {
        var sc = cardScoreOf(c.id);
        var badge = sc
            ? (sc.forbidden
                ? '<span class="db-badge db-badge-fb">🚫</span>'
                : '<span class="db-badge">' + sc.score + '</span>')
            : '';
        return '<div class="db-cell" data-id="' + c.id + '">'
            + '<div class="db-cell-imgwrap">' + cardImgHtml(c.id, 'db-cell-img') + '</div>'
            + badge + '</div>';
    }

    function renderNextBatch() {
        if (gridLoading) return;
        if (gridLoaded >= gridList.length) return;
        gridLoading = true;
        var slice = gridList.slice(gridLoaded, gridLoaded + PAGE);
        gridLoaded += slice.length;
        var frag = document.createDocumentFragment();
        var tmp = document.createElement('div');
        tmp.innerHTML = slice.map(cellHtml).join('');
        while (tmp.firstChild) frag.appendChild(tmp.firstChild);
        gridEl.appendChild(frag);
        gridLoading = false;
    }

    function resetGrid(list) {
        disconnectGridLoad();
        gridList = list || [];
        gridLoaded = 0;
        gridEl.innerHTML = '';
        if (!gridList.length) {
            gridEl.innerHTML = '<div class="db-grid-empty">无匹配卡片</div>';
            return;
        }
        renderNextBatch();
        // 内容不足以填满视口时继续加载
        fillGridIfNotFull();
        attachGridLoad();
    }

    function fillGridIfNotFull() {
        // 滚动容器高度有限时一次补足可滚动区域
        var wrap = gridEl.closest('.db-grid-wrap');
        if (!wrap) return;
        var guard = 0;
        while (guard++ < 60 && gridLoaded < gridList.length
            && wrap.scrollHeight <= wrap.clientHeight + 20) {
            renderNextBatch();
        }
    }

    function attachGridLoad() {
        var wrap = gridEl.closest('.db-grid-wrap');
        if (!wrap) return;
        gridScrollHandler = function () {
            // 距底不足 400px 时加载下一批
            if (wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 400) {
                renderNextBatch();
            }
        };
        wrap.addEventListener('scroll', gridScrollHandler, { passive: true });
    }

    function disconnectGridLoad() {
        if (gridScrollHandler) {
            var w = gridEl.closest('.db-grid-wrap');
            if (w) w.removeEventListener('scroll', gridScrollHandler);
            gridScrollHandler = null;
        }
    }

    function doSearch() {
        if (!builderActive) return;
        if (officialMode) {
            renderOfficialResults();
            return;
        }
        loadDiyData().then(function () {
            var list = diySearchList();
            gridTipEl.textContent = '共 ' + list.length + ' 张 · 滚轮翻阅';
            resetGrid(list);
        });
    }

    function renderOfficialResults() {
        gridTipEl.textContent = '官方卡 · 共 ' + officialResults.length + ' 张（滚轮翻阅）';
        resetGrid(officialResults);
    }

    // 官方模式搜索（复用 ygocdb 代理接口，同源）
    function officialSearch(q) {
        if (!q) { officialResults = []; gridTipEl.textContent = '输入关键词搜索官方卡'; renderGridEmpty(); return; }
        gridTipEl.textContent = '查询中...';
        return fetch('/api/ygocdb/?search=' + encodeURIComponent(q) + '&t=' + Date.now())
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
                var list = (data && data.result) || [];
                // 归一化
                officialResults = list.map(function (c) {
                    var t = c.text || {};
                    var f = null;
                    if (window.DeckViewer && window.DeckViewer.officialCardFields) {
                        try { f = window.DeckViewer.officialCardFields(c); } catch (e) {}
                    }
                    return {
                        id: c.id,
                        name: f ? f.name : (c.nwbbs_n || c.sc_name || c.cn_name || c.en_name || ('卡牌 ' + c.id)),
                        fullType: f ? f.fullType : '',
                        raceAttr: f ? f.raceAttr : '',
                        atkDef: f ? f.atkDef : '',
                        desc: f ? f.desc : '',
                    };
                });
                renderOfficialResults();
            })
            .catch(function (e) {
                officialResults = [];
                gridTipEl.textContent = '⚠️ 查询失败: ' + e.message;
            });
    }

    function renderGridEmpty() {
        gridEl.innerHTML = '<div class="db-grid-empty">输入关键词搜索官方卡</div>';
    }

    // 类型点击官方卡详情
    function showDetailForOfficial(o) {
        if (!o) return;
        detailId = o.id;
        var sc = cardScoreOf(o.id);
        var scHtml = sc
            ? (sc.forbidden
                ? '<div class="db-detail-score" style="color:#ff6b6b;">🚫 禁止使用</div>'
                : '<div class="db-detail-score">G-Ext 分值：<b>' + sc.score + '</b> 分</div>')
            : '<div class="db-detail-score" style="color:#999;">无分值（普通卡）</div>';
        var body = $('dbDetailBody');
        body.innerHTML =
            '<div class="db-detail-head">'
            + '<div class="db-detail-card">' + cardImgHtml(o.id, 'db-detail-img') + '</div>'
            + '<div class="db-detail-name">' + escapeHtml(o.name) + '</div>'
            + scHtml
            + (o.fullType ? '<div class="db-detail-type">' + escapeHtml(o.fullType) + '</div>' : '')
            + (o.raceAttr ? '<div class="db-detail-rows"><span>' + escapeHtml(o.raceAttr) + '</span></div>' : '')
            + (o.atkDef ? '<div class="db-detail-rows"><span>' + escapeHtml(o.atkDef) + '</span></div>' : '')
            + '</div>'
            + '<div class="db-detail-scroll">'
            + '<div class="db-detail-desc">' + escapeHtml(o.desc || '暂无效果文本') + '</div>'
            + '</div>'
            + '<div class="db-detail-actions">'
            + '<button class="db-detail-add" data-zone="main">加入主卡组</button>'
            + '<button class="db-detail-add" data-zone="extra">加入额外</button>'
            + '<button class="db-detail-add" data-zone="side">加入副卡组</button>'
            + '</div>';
        bindDetailAddButtons();
    }

    // 点击网格卡片（事件委托）
    function onGridClick(e) {
        var cell = e.target.closest ? e.target.closest('.db-cell') : null;
        if (!cell) return;
        var id = parseInt(cell.getAttribute('data-id'), 10);
        if (!id) return;
        if (officialMode) {
            var o = officialResults.find(function (x) { return x.id === id; });
            if (o) showDetailForOfficial(o);
        } else {
            var c = diyIndex && diyIndex.get(id);
            if (c) showDetailForDiyCard(c);
            else {
                // 找不到（理论上不会），尝试官方补全
                var o2 = null;
                officialResults.find(function (x) { if (x.id === id) { o2 = x; return true; } return false; });
                if (o2) showDetailForOfficial(o2);
            }
        }
    }

    // ── 导出 ──
    function buildYdkText() {
        var lines = ['#created by Sirokami deck builder'];
        ['main', 'extra', 'side'].forEach(function (k) {
            if (!zones[k].list.length) return;
            if (k === 'main') lines.push('#main');
            else if (k === 'extra') lines.push('#extra');
            else lines.push('!side');
            zones[k].list.forEach(function (id) { lines.push(String(id)); });
        });
        return lines.join('\n');
    }

    function copyDeckCode() {
        var text = buildYdkText();
        var done = function () { toast('卡组码已复制 ✓'); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(done);
        } else {
            var ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动选择'); }
            document.body.removeChild(ta);
        }
    }

    function downloadYdk() {
        var blob = new Blob([buildYdkText()], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'siro_deck_' + Date.now() + '.ydk';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('已下载 .ydk 文件 ⬇');
    }

    // 解析 ydk 文本 → { main, extra, side }（优先复用 DeckViewer.parse）
    function parseYdkText(text) {
        if (!text || !text.trim()) return null;
        if (window.DeckViewer && window.DeckViewer.parse) {
            try {
                var d = window.DeckViewer.parse(text);
                if (d && (d.main.length || d.extra.length || d.side.length)) {
                    return { main: d.main || [], extra: d.extra || [], side: d.side || [] };
                }
            } catch (e) { /* fallthrough */ }
        }
        // 兜底简单解析
        var main = [], extra = [], side = [];
        var section = 'main';
        String(text).split(/\r?\n/).forEach(function (line) {
            line = line.trim();
            if (!line || line.charAt(0) === '#') return;
            if (/^#extra/i.test(line)) { section = 'extra'; return; }
            if (/^!side/i.test(line)) { section = 'side'; return; }
            var id = parseInt(line, 10);
            if (!isNaN(id) && id > 0) {
                if (section === 'extra') extra.push(id);
                else if (section === 'side') side.push(id);
                else main.push(id);
            }
        });
        if (!main.length && !extra.length && !side.length) return null;
        return { main: main, extra: extra, side: side };
    }

    // 导入卡组（替换当前卡组）
    function importDeck() {
        var text = prompt(
            '粘贴 YDK 卡组文本（#main/#extra/!side 格式，或纯卡号列表）：\n\n' +
            '导入将替换当前卡组内容。'
        );
        if (text == null) return;
        var deck = parseYdkText(text);
        if (!deck) { toast('无法解析卡组内容'); return; }
        // 数量检查
        if (deck.main.length > zones.main.max) {
            toast('主卡组超过 ' + zones.main.max + ' 张，无法导入');
            return;
        }
        if (deck.extra.length > zones.extra.max) {
            toast('额外卡组超过 ' + zones.extra.max + ' 张，无法导入');
            return;
        }
        if (deck.side.length > zones.side.max) {
            toast('副卡组超过 ' + zones.side.max + ' 张，无法导入');
            return;
        }
        // 同名检查（跨区合计最多 3）
        var countMap = {};
        ['main', 'extra', 'side'].forEach(function (k) {
            deck[k].forEach(function (id) { countMap[id] = (countMap[id] || 0) + 1; });
        });
        var over = null;
        Object.keys(countMap).forEach(function (id) {
            if (countMap[id] > 3) over = id;
        });
        if (over != null) {
            toast('卡号 ' + over + ' 数量超过 3 张（同名最多 3 张）');
            return;
        }
        // 禁卡检查（有分数表时）
        if (scoreMap) {
            for (var i = 0; i < deck.main.length; i++) {
                var sc = cardScoreOf(deck.main[i]);
                if (sc && sc.forbidden) { toast('🚫 卡号 ' + deck.main[i] + ' 为禁止卡'); return; }
            }
        }
        zones.main.list = deck.main.slice();
        zones.extra.list = deck.extra.slice();
        zones.side.list = deck.side.slice();
        renderAll();
        refreshScore();
        toast('卡组已导入：主 ' + zones.main.list.length + ' / 额 ' + zones.extra.list.length + ' / 副 ' + zones.side.list.length);
    }

    function clearAll() {
        ['main', 'extra', 'side'].forEach(function (k) { zones[k].list = []; });
        renderAll();
        toast('卡组已清空');
    }

    // ── toast ──
    var toastTimer = 0;
    function toast(msg) {
        var old = document.getElementById('dbToast');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var t = document.createElement('div');
        t.id = 'dbToast';
        t.textContent = msg;
        t.style.cssText = 'position:fixed;left:50%;top:60px;transform:translateX(-50%);'
            + 'background:rgba(30,30,30,0.95);color:#fff;padding:10px 20px;border-radius:8px;'
            + 'border:1px solid rgba(216,30,68,0.5);z-index:100020;font-size:0.85rem;'
            + 'box-shadow:0 4px 20px rgba(0,0,0,0.5);';
        document.body.appendChild(t);
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            if (t.parentNode) t.parentNode.removeChild(t);
        }, 2200);
    }

    // ── 切换组卡模式 ──
    function syncOfficialMode() {
        var ygoBtn = $('poolModeYgo');
        officialMode = !!(ygoBtn && ygoBtn.classList.contains('active'));
    }

    function setBuilderActive(on) {
        builderActive = on;
        if (toggleBtn) toggleBtn.classList.toggle('active', on);
        var section = document.getElementById('section-card-pool');
        if (section) section.classList.toggle('builder-mode', on);
        layout.style.display = on ? 'flex' : 'none';
        if (on) {
            document.body.style.overflow = 'hidden';
            // 组卡模式固定搜 DIY 总卡池：清空搜索词与筛选，重置为全部卡
            officialMode = false;
            searchQuery = '';
            searchInputEl.value = '';
            searchInputEl.placeholder = '搜索卡名 / ID / 效果...';
            // 重置高级筛选（类型/属性/种族/范围）并收起折叠面板
            resetAdvFilters();
            var advPanel = $('dbAdvFilters');
            if (advPanel) advPanel.style.display = 'none';
            var advToggle = $('dbFilterToggle');
            if (advToggle) advToggle.classList.remove('active');
            // 开启时预加载分数 + DIY 全量数据
            loadScores().then(function () {
                renderAll();
                loadDiyData().then(function () { doSearch(); });
            });
            gridTipEl.textContent = '加载 DIY 卡池中...';
            gridEl.innerHTML = '<div class="db-grid-empty">加载中...</div>';
            $('dbDetailBody').innerHTML = '<div class="db-detail-empty">点击右侧卡片查看详情<br><br>点击下方按钮加入卡组</div>';
            detailId = null;
        } else {
            document.body.style.overflow = '';
            disconnectGridLoad();
            // 清空详情（避免残留）
            $('dbDetailBody').innerHTML = '<div class="db-detail-empty">点击右侧卡片查看详情<br><br>点击下方按钮加入卡组</div>';
            detailId = null;
        }
    }

    // 监听主页面 DIY/官方模式切换（由 ygocdb-search.js 维护按钮 active）
    function watchModeButtons() {
        var diyBtn = $('poolModeDiy');
        var ygoBtn = $('poolModeYgo');
        if (diyBtn) diyBtn.addEventListener('click', function () {
            if (!builderActive) return;
            officialMode = false;
            searchInputEl.placeholder = '搜索卡名 / ID / 效果...';
            doSearch();
        });
        if (ygoBtn) ygoBtn.addEventListener('click', function () {
            if (!builderActive) return;
            officialMode = true;
            searchInputEl.placeholder = '搜索官方卡（回车查询）';
            officialResults = [];
            renderGridEmpty();
        });
    }

    // ── 初始化 ──
    function init() {
        if (!toggleBtn || !layout) return;

        toggleBtn.addEventListener('click', function () {
            // 移动端不使用组卡模式
            if (window.innerWidth <= 768) {
                toast('组卡模式请在电脑端使用');
                return;
            }
            setBuilderActive(!builderActive);
        });

        // 右栏搜索
        var debounce = 0;
        searchInputEl.addEventListener('input', function () {
            clearTimeout(debounce);
            var q = searchInputEl.value.trim();
            debounce = setTimeout(function () {
                if (officialMode) {
                    if (q) officialSearch(q);
                    else { officialResults = []; renderGridEmpty(); }
                } else {
                    searchQuery = q;
                    doSearch();
                }
            }, 250);
        });
        searchInputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && officialMode) {
                var q = searchInputEl.value.trim();
                if (q) officialSearch(q);
            }
        });

        // 高级筛选（chips + 范围 + 折叠）
        initAdvFilters();

        // 网格点击 → 详情
        gridEl.addEventListener('click', onGridClick);

        // 中栏按钮
        $('dbSort').addEventListener('click', sortDeck);
        $('dbImport').addEventListener('click', importDeck);
        $('dbCopy').addEventListener('click', copyDeckCode);
        $('dbDownload').addEventListener('click', downloadYdk);
        $('dbClear').addEventListener('click', function () {
            var all = zones.main.list.length + zones.extra.list.length + zones.side.list.length;
            if (!all) { toast('卡组已是空的'); return; }
            if (confirm('确认清空当前卡组？')) clearAll();
        });

        // 卡组区点击移除
        ['main', 'extra', 'side'].forEach(function (k) {
            zones[k].el.addEventListener('click', function (e) {
                var slot = e.target.closest ? e.target.closest('.db-card-slot') : null;
                if (!slot) return;
                var zk = slot.getAttribute('data-zone');
                var idx = parseInt(slot.getAttribute('data-index'), 10);
                if (zk && !isNaN(idx)) removeCard(zk, idx);
            });
        });

        // 监视主页面 DIY/官方切换
        watchModeButtons();

        // 点击详情加卡后刷新角标等
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && builderActive) setBuilderActive(false);
        });

        // 暴露 API
        window.DeckBuilder = {
            active: function () { return builderActive; },
            enable: function () { setBuilderActive(true); },
            disable: function () { setBuilderActive(false); },
            add: function (zoneKey, id) { return addCard(zoneKey, id); },
            getDeck: function () {
                return { main: zones.main.list.slice(), extra: zones.extra.list.slice(), side: zones.side.list.slice() };
            },
            ydk: buildYdkText,
            setOfficialResults: function (list) { officialResults = list || []; },
            showOfficialDetail: showDetailForOfficial,
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
