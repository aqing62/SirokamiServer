/**
 * 白神服Sirokami — 官方卡查询（百鸽 ygocdb.com API）
 * 方案A：前端直连 ygocdb（CORS 允许 *），渲染使用本站样式
 * 端点: /api/v0/?search= 搜索 /api/v0/card/:id?show=all 详情
 */
(function () {
    'use strict';

    var YGOCDB_API = 'https://ygocdb.com/api/v0';
    var OCG_PIC = 'https://cdn.233.momobako.com/ygopro/pics/';
    var FALLBACK_PIC = 'cover.jpg';
    var _lastQuery = '';

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function cardPic(id) {
        return '<img src="' + OCG_PIC + id + '.jpg" loading="lazy" '
            + 'onerror="this.onerror=null;this.src=\'' + FALLBACK_PIC + '\';">';
    }

    function ygocdbSearch(q) {
        _lastQuery = q;
        var box = document.getElementById('ygocdbResult');
        if (!box) return;
        box.innerHTML = '<div class="loading-hint">搜索中...</div>';

        fetch(YGOCDB_API + '/?search=' + encodeURIComponent(q))
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
                var list = data.result || [];
                if (!list.length) {
                    box.innerHTML = '<div class="loading-hint">没有找到相关卡片</div>';
                    return;
                }
                var shown = list.slice(0, 50);
                var html = '<div class="ygocdb-count">共 ' + list.length + ' 条结果' + (list.length > 50 ? '，显示前 50 条' : '') + '，点击卡牌查看详情</div>';
                html += '<div class="ygocdb-grid">';
                shown.forEach(function (c) {
                    var name = c.sc_name || c.cn_name || c.en_name || ('卡片 ' + c.id);
                    html += '<div class="ygocdb-card" data-id="' + c.id + '">'
                        + cardPic(c.id)
                        + '<div class="ygocdb-name">' + escapeHtml(name) + '</div>'
                        + '<div class="ygocdb-id">密码 ' + c.id + '</div>'
                        + '</div>';
                });
                html += '</div>';
                box.innerHTML = html;
                box.querySelectorAll('.ygocdb-card').forEach(function (el) {
                    el.addEventListener('click', function () {
                        ygocdbDetail(parseInt(el.getAttribute('data-id')));
                    });
                });
            })
            .catch(function (e) {
                box.innerHTML = '<div class="loading-hint">⚠️ 查询失败: ' + escapeHtml(String(e.message || e)) + '</div>';
            });
    }

    function ygocdbDetail(id) {
        var box = document.getElementById('ygocdbResult');
        if (!box) return;
        box.innerHTML = '<div class="loading-hint">加载卡牌详情...</div>';

        fetch(YGOCDB_API + '/card/' + id + '?show=all')
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (c) {
                var t = c.text || {};
                var name = t.sc_name || t.cn_name || t.en_name || ('卡片 ' + c.id);
                var html = '<div class="ygocdb-detail">'
                    + '<button class="ygocdb-back" id="ygocdbBackBtn">← 返回结果</button>'
                    + '<div class="ygocdb-detail-head">'
                    + cardPic(c.id)
                    + '<div>'
                    + '<div class="ygocdb-detail-name">' + escapeHtml(name) + '</div>'
                    + '<div class="ygocdb-detail-meta">密码 ' + c.id + ' · CID ' + c.cid + '</div>'
                    + (t.types ? '<div class="ygocdb-types">' + escapeHtml(t.types) + '</div>' : '')
                    + '</div></div>'
                    + (t.desc ? '<div class="ygocdb-desc">' + escapeHtml(t.desc).replace(/\n/g, '<br>') + '</div>' : '')
                    + (t.jp_name ? '<div class="ygocdb-other">日文名：' + escapeHtml(t.jp_name) + '</div>' : '')
                    + (t.en_name ? '<div class="ygocdb-other">英文名：' + escapeHtml(t.en_name) + '</div>' : '')
                    + '</div>';
                box.innerHTML = html;
                var back = document.getElementById('ygocdbBackBtn');
                if (back) back.addEventListener('click', function () {
                    if (_lastQuery) ygocdbSearch(_lastQuery);
                    else box.innerHTML = '<div class="loading-hint">输入关键词查询官方卡数据</div>';
                });
            })
            .catch(function (e) {
                box.innerHTML = '<div class="loading-hint">⚠️ 加载详情失败: ' + escapeHtml(String(e.message || e)) + '</div>';
            });
    }

    window.initYgocdbModule = function () {
        // 模式切换：DIY 卡池 / 官方卡查询（在卡池信息页内）
        var diyBtn = document.getElementById('poolModeDiy');
        var ygoBtn = document.getElementById('poolModeYgo');
        var ygocdbPanel = document.getElementById('ygocdbPanel');
        var stats = document.getElementById('stats');
        var filter = document.querySelector('.search-filter-container');
        var cardContainer = document.getElementById('cardContainer');
        if (diyBtn && ygoBtn && ygocdbPanel) {
            var setMode = function (isYgo) {
                diyBtn.classList.toggle('active', !isYgo);
                ygoBtn.classList.toggle('active', isYgo);
                ygocdbPanel.style.display = isYgo ? 'block' : 'none';
                if (stats) stats.style.display = isYgo ? 'none' : '';
                if (filter) filter.style.display = isYgo ? 'none' : '';
                if (cardContainer) cardContainer.style.display = isYgo ? 'none' : '';
            };
            diyBtn.onclick = function () { setMode(false); };
            ygoBtn.onclick = function () { setMode(true); };
        }

        // 搜索绑定
        var input = document.getElementById('ygocdbSearchInput');
        var btn = document.getElementById('ygocdbSearchBtn');
        if (!input || !btn) return;
        var doSearch = function () {
            var q = (input.value || '').trim();
            if (q) ygocdbSearch(q);
        };
        btn.onclick = doSearch;
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
    };
})();
