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
                buildTypeFilter();
                return diyCards;
            })
            .catch(function (e) {
                gridTipEl.textContent = 'DIY 卡数据加载失败：' + e.message;
                return [];
            });
    }

    // 类型筛选（简版：怪兽/魔法/陷阱/额外怪兽）
    function buildTypeFilter() {
        var row = $('dbSearchFilterRow');
        if (!row) return;
        row.innerHTML =
            '<button class="db-filter-chip active" data-ft="all">全部</button>'
            + '<button class="db-filter-chip" data-ft="monster">怪兽</button>'
            + '<button class="db-filter-chip" data-ft="spell">魔法</button>'
            + '<button class="db-filter-chip" data-ft="trap">陷阱</button>'
            + '<button class="db-filter-chip" data-ft="extra">额外(融合/同调/超量/连接)</button>'
            + '<button class="db-filter-chip" data-ft="forbidden">🚫禁卡</button>';
        row.querySelectorAll('.db-filter-chip').forEach(function (b) {
            b.addEventListener('click', function () {
                row.querySelectorAll('.db-filter-chip').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                doSearch();
            });
        });
    }

    function activeFilterType() {
        var act = document.querySelector('#dbSearchFilterRow .db-filter-chip.active');
        return act ? act.getAttribute('data-ft') : 'all';
    }

    function matchFilter(card) {
        var ft = activeFilterType();
        if (ft === 'all') return true;
        var ti = card.typeInfo || {};
        if (ft === 'monster') return ti.baseType === '怪兽';
        if (ft === 'spell') return ti.baseType === '魔法';
        if (ft === 'trap') return ti.baseType === '陷阱';
        if (ft === 'extra') return isExtraMonster(card);
        if (ft === 'forbidden') {
            var sc = cardScoreOf(card.id);
            return !!(sc && sc.forbidden);
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
            // 重置类型筛选 chips 到「全部」
            var chips = document.querySelectorAll('#dbSearchFilterRow .db-filter-chip');
            chips.forEach(function (c) {
                c.classList.toggle('active', c.getAttribute('data-ft') === 'all');
            });
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

        // 网格点击 → 详情
        gridEl.addEventListener('click', onGridClick);

        // 中栏按钮
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
