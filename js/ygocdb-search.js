/**
 * 白神服Sirokami — 官方卡查询（百鸽 ygocdb.com API）
 *
 * V1.9.0 改造：卡池里 DIY / 先行 / 官方 三个池子已合并成一个池子，
 *   「官方卡查询」不再是页面模式（以前是 DIY/官方 两个按钮来回切、会顶掉整个卡池），
 *   改成卡池页右上角「🔍 官方译名查询」按钮弹出的**弹窗**。
 *   本地 /api/cards 已含 14597 张官方卡（能搜能筛），这里只解决它没有的东西：
 *   **同一张卡的多套译名**（YGOPro / 官方简中 / Master Duel / NWBBS / CNOCG）。
 *
 * 端点: /api/v0/?search= 搜索（经 vote_server 同源代理 /api/ygocdb）
 */
(function () {
    'use strict';

    var YGOCDB_API = '/api/ygocdb';
    var OCG_PIC = 'https://cdn.233.momobako.com/ygopro/pics/';
    var FALLBACK_PIC = 'cover.jpg';

    var TRANS_OPTIONS = [
        ['nwbbs_n', 'NWBBS 译名'],
        ['cn_name', 'YGOPro 译名'],
        ['sc_name', '官方简中'],
        ['md_name', 'Master Duel'],
        ['cnocg_n', 'CNOCG 译名'],
    ];
    var TRANS_KEY = 'ygocdb.translation';
    var TRANS_DEFAULT = 'nwbbs_n';

    function getTransKey() {
        try { return localStorage.getItem(TRANS_KEY) || TRANS_DEFAULT; } catch (e) { return TRANS_DEFAULT; }
    }
    function setTransKey(k) {
        try { localStorage.setItem(TRANS_KEY, k); } catch (e) {}
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

    function transName(c, key) {
        return c[key] || c.sc_name || c.cn_name || c.en_name || c.name || ('卡片 ' + c.id);
    }

    var overlay = null, inputEl = null, gridEl = null, selectEl = null;
    var lastQuery = '';

    function buildModal() {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.className = 'pyg-overlay';
        overlay.id = 'pygOverlay';
        overlay.innerHTML =
            '<div class="pyg-box" role="dialog" aria-label="官方卡查询">'
            + '  <div class="pyg-head">'
            + '    <span class="pyg-title">🔍 官方卡查询</span>'
            + '    <span class="pyg-sub">数据来源：百鸽 ygocdb · 可对比多套译名</span>'
            + '    <label class="pyg-trans">译名'
            + '      <select id="pygTrans">'
            + TRANS_OPTIONS.map(function (o) {
                return '<option value="' + o[0] + '">' + o[1] + '</option>';
            }).join('')
            + '      </select>'
            + '    </label>'
            + '    <button class="pyg-close" id="pygClose" title="关闭（Esc）">×</button>'
            + '  </div>'
            + '  <div class="pyg-search">'
            + '    <input type="text" id="pygInput" placeholder="卡名 / 效果关键词 / 卡片密码…（回车查询）" autocomplete="off">'
            + '    <button class="pyg-go" id="pygGo">查询</button>'
            + '  </div>'
            + '  <div class="pyg-grid card-grid" id="pygGrid"></div>'
            + '</div>';
        document.body.appendChild(overlay);

        inputEl = overlay.querySelector('#pygInput');
        gridEl = overlay.querySelector('#pygGrid');
        selectEl = overlay.querySelector('#pygTrans');

        selectEl.value = getTransKey();
        selectEl.addEventListener('change', function () {
            setTransKey(selectEl.value);
            if (lastQuery) doSearch(lastQuery);
        });

        overlay.querySelector('#pygClose').onclick = closeModal;
        overlay.querySelector('#pygGo').onclick = function () {
            doSearch((inputEl.value || '').trim());
        };
        inputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') doSearch((inputEl.value || '').trim());
        });
        // 点遮罩空白处关闭
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) closeModal();
        });
    }

    function openModal(prefill) {
        buildModal();
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        gridEl.innerHTML = '<div class="pyg-tip">输入关键词查询官方卡（可对比 5 套译名）；没找到的卡也可以在本地卡池里按卡号搜索</div>';
        setTimeout(function () { try { inputEl.focus(); } catch (e) {} }, 60);
        if (prefill) {
            inputEl.value = prefill;
            doSearch(prefill);
        }
    }

    function closeModal() {
        if (!overlay) return;
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    function doSearch(q) {
        if (!q) return;
        lastQuery = q;
        gridEl.innerHTML = '<div class="pyg-tip">正在查询官方卡数据…</div>';
        fetch(YGOCDB_API + '/?search=' + encodeURIComponent(q))
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
                var list = (data && data.result) || [];
                if (!list.length) {
                    gridEl.innerHTML = '<div class="pyg-tip">没有找到相关卡片</div>';
                    return;
                }
                var key = selectEl ? selectEl.value : TRANS_DEFAULT;
                gridEl.innerHTML = '';
                list.slice(0, 60).forEach(function (c) {
                    var f = null;
                    if (window.DeckViewer && window.DeckViewer.officialCardFields) {
                        try { f = window.DeckViewer.officialCardFields(c); } catch (e) {}
                    }
                    // 多套译名（有值才显示）
                    var names = TRANS_OPTIONS.map(function (o) {
                        var v = c[o[0]];
                        return v ? (o[1] + '：' + v) : '';
                    }).filter(Boolean);

                    var el = document.createElement('div');
                    el.className = 'card-item';
                    el.setAttribute('data-card-id', c.id);
                    el.innerHTML =
                        '<div class="card-image-wrapper">'
                        + '<img class="card-image" src="' + OCG_PIC + c.id + '.jpg" alt="' + escapeHtml(transName(c, key)) + '" loading="lazy"'
                        + ' onerror="this.onerror=null;this.src=\'' + FALLBACK_PIC + '\';">'
                        + '</div>'
                        + '<div class="card-info">'
                        + '<div class="card-name">' + escapeHtml(transName(c, key)) + '</div>'
                        + '<div class="card-id">ID: ' + c.id + '</div>'
                        + (f && f.fullType ? '<div class="card-type">' + escapeHtml(f.fullType) + '</div>' : '')
                        + (f && f.raceAttr ? '<div class="card-attrrace">' + escapeHtml(f.raceAttr) + '</div>' : '')
                        + (f && f.atkDef ? '<div class="card-atkdef">' + escapeHtml(f.atkDef) + '</div>' : '')
                        + (names.length ? '<div class="pyg-names">' + names.map(escapeHtml).join('<br>') + '</div>' : '')
                        + (f && f.desc ? '<div class="card-desc">' + escapeHtml(f.desc) + '</div>' : '')
                        + '</div>';
                    gridEl.appendChild(el);
                });
            })
            .catch(function (e) {
                gridEl.innerHTML = '<div class="pyg-tip">⚠️ 查询失败：' + escapeHtml(e.message || e) + '</div>';
            });
    }

    window.openYgocdbQuery = function (prefill) { openModal(prefill || ''); };

    // 保留旧入口名（script.js 的 lazyInit 里会调）：现在只负责把按钮接上
    window.initYgocdbModule = function () {
        var btn = document.getElementById('poolYgocdbBtn');
        if (btn && !btn._wired) {
            btn._wired = true;
            btn.onclick = function () { openModal(''); };
        }
    };
})();
