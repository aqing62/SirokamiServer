/**
 * 白神服Sirokami — 官方卡查询（百鸽 ygocdb.com API）
 * 方案A：前端直连 ygocdb（CORS 允许 *）
 * UI：复用卡池信息页的搜索框(#search) + 卡牌网格(#cardContainer .card-item)
 * 端点: /api/v0/?search= 搜索 /api/v0/card/:id?show=all 详情
 */
(function () {
    'use strict';

    var YGOCDB_API = 'https://ygocdb.com/api/v0';
    var OCG_PIC = 'https://cdn.233.momobako.com/ygopro/pics/';
    var FALLBACK_PIC = 'cover.jpg';

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── 译名偏好 ─────────────────────────────────────
    var TRANS_KEY = 'ygocdb.translation';
    var TRANS_DEFAULT = 'nwbbs_n'; // 用户选择：NWBBS 译名

    function getTransKey() {
        try { return localStorage.getItem(TRANS_KEY) || TRANS_DEFAULT; } catch (e) { return TRANS_DEFAULT; }
    }

    function transName(c) {
        var k = getTransKey();
        return c[k] || c.sc_name || c.cn_name || c.en_name || c.name || ('卡片 ' + c.id);
    }

    var _lastSearch = '';

    function ygocdbSearch(q) {
        _lastSearch = q;
        var container = document.getElementById('cardContainer');
        if (!container || !q) return;
        container.style.opacity = 1;
        container.innerHTML = '<div class="loading-tip" style="text-align:center;color:#aaa;padding:30px;">正在查询官方卡数据...</div>';

        fetch(YGOCDB_API + '/?search=' + encodeURIComponent(q))
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
                var list = data.result || [];
                if (!list.length) {
                    container.innerHTML = '<div class="empty-tip">没有找到相关卡片</div>';
                    return;
                }
                container.innerHTML = '';
                list.slice(0, 50).forEach(function (c) {
                    var t = c.text || {};
                    // 用 deck-viewer 解析后的字段（类型/属性·种族·等级/ATK·DEF），与 DIY 卡池展示一致
                    var f = null;
                    if (window.DeckViewer && window.DeckViewer.officialCardFields) {
                        try { f = window.DeckViewer.officialCardFields(c); } catch (e) {}
                    }
                    var name = f ? f.name : transName(c);
                    var el = document.createElement('div');
                    el.className = 'card-item';
                    el.innerHTML =
                        '<div class="card-image-wrapper">'
                        + '<img class="card-image" src="' + OCG_PIC + c.id + '.jpg" alt="' + escapeHtml(name) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + FALLBACK_PIC + '\';">'
                        + '</div>'
                        + '<div class="card-info">'
                        + '<div class="card-name">' + escapeHtml(name) + '</div>'
                        + '<div class="card-id">ID: ' + c.id + '</div>'
                        + (f && f.fullType ? '<div class="card-type">' + escapeHtml(f.fullType) + '</div>' : '')
                        + (f && f.raceAttr ? '<div class="card-attrrace">' + escapeHtml(f.raceAttr) + '</div>' : '')
                        + (f && f.atkDef ? '<div class="card-atkdef">' + escapeHtml(f.atkDef) + '</div>' : '')
                        + (f && f.desc ? '<div class="card-desc">' + escapeHtml(f.desc) + '</div>' : '')
                        + '</div>';
                    container.appendChild(el);
                });
            })
            .catch(function (e) {
                container.innerHTML = '<div class="empty-tip">⚠️ 查询失败: ' + escapeHtml(String(e.message || e)) + '</div>';
            });
    }

    window.initYgocdbModule = function () {
        var diyBtn = document.getElementById('poolModeDiy');
        var ygoBtn = document.getElementById('poolModeYgo');
        if (!diyBtn || !ygoBtn) return;

        var stats = document.getElementById('stats');
        // 只隐藏筛选组，保留搜索框（搜索框在 .search-filter-container 内，由 card-pool-info 控制显隐）
        var filterGroup = document.querySelector('.multi-filter-group');
        var pagination = document.getElementById('pagination');
        var transBar = document.getElementById('ygocdbTransBar');
        var transSelect = document.getElementById('ygocdbTransSelect');
        var searchInput = document.getElementById('search');
        var container = document.getElementById('cardContainer');
        var _diyQuery = '';

        // 译名选择：初始化 + 变更时重查
        if (transSelect) {
            transSelect.value = getTransKey();
            transSelect.addEventListener('change', function () {
                try { localStorage.setItem(TRANS_KEY, transSelect.value); } catch (e) {}
                if (window._poolYgoMode && _lastSearch) ygocdbSearch(_lastSearch);
            });
        }

        function setMode(isYgo) {
            window._poolYgoMode = isYgo;
            diyBtn.classList.toggle('active', !isYgo);
            ygoBtn.classList.toggle('active', isYgo);
            if (stats) stats.style.display = isYgo ? 'none' : '';
            if (filterGroup) filterGroup.style.display = isYgo ? 'none' : '';
            if (transBar) transBar.style.display = isYgo ? 'flex' : 'none';
            // 官方模式隐藏分页（避免点页码触发 DIY 渲染）；切回 DIY 时恢复
            if (pagination) {
                if (isYgo) {
                    pagination.style.display = 'none';
                } else if (typeof renderPagination === 'function') {
                    renderPagination();
                }
            }
            if (searchInput) {
                if (isYgo) {
                    _diyQuery = searchInput.value;
                    searchInput.value = '';
                    searchInput.placeholder = '输入官方卡名 / 效果关键词 / 卡片密码...';
                } else {
                    searchInput.value = _diyQuery;
                    searchInput.placeholder = '搜索卡名 / ID / 效果...';
                }
            }
            if (container) {
                container.style.opacity = 1;
                if (isYgo) {
                    container.innerHTML = '<div class="loading-tip" style="text-align:center;color:#aaa;padding:30px;">输入关键词按回车查询官方卡数据（数据来源：百鸽 ygocdb.com）</div>';
                } else if (typeof renderCards === 'function') {
                    renderCards();
                }
            }
        }

        diyBtn.onclick = function () { setMode(false); };
        ygoBtn.onclick = function () { setMode(true); };

        // 官方模式：回车触发查询
        if (searchInput) {
            searchInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && window._poolYgoMode) {
                    ygocdbSearch((searchInput.value || '').trim());
                }
            });
        }
    };
})();
