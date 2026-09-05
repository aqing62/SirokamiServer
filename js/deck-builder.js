/**
 * 白神服Sirokami — 组卡模式（卡池信息页）
 * 点击卡片 → 选择加入 主/额外/副 卡组；实时 G-Ext 校验与总分；
 * 支持导出 .ydk 与复制卡组码（含 DIY + 官方卡）。
 * 依赖：/api/scores（禁限分值）、window._cardIndex（DIY 卡信息）
 */
(function () {
    'use strict';

    var panel = document.getElementById('deckBuilderPanel');
    var toggleBtn = document.getElementById('deckBuilderToggle');
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

    var scoreMap = null;   // { cardId: { score, forbidden } }
    var scoreLimit = 100;
    var menuEl = null;     // 加入位置小菜单
    var pendingCard = null;

    // ── 工具 ──
    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    // 卡片信息：DIY 用 _cardIndex，官方卡用传入对象
    function cardInfoOf(id, cardData) {
        if (cardData) return cardData;
        var idx = window._cardIndex;
        if (idx && idx.get) return idx.get(parseInt(id, 10)) || null;
        return null;
    }

    // 是否为"额外卡组"类型怪兽（融合/同调/超量/灵摆额外/连接）
    function isExtraMonster(card) {
        if (!card || !card.typeInfo) return false;
        var sub = (card.typeInfo.subTypes || []).join(' ');
        var cat = card.typeInfo.monsterCategory || '';
        return /融合|同调|超量|连接/.test(sub + ' ' + cat);
    }

    // ── 分数加载（与 deck-viewer 一致的 no-cache）──
    function loadScores() {
        if (scoreMap) return Promise.resolve(scoreMap);
        return fetch('/api/scores?t=' + Date.now())
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                var limit = parseInt(resp.headers.get('X-GExt-Limit'), 10);
                if (!isNaN(limit) && limit > 0) scoreLimit = limit;
                return resp.json();
            })
            .then(function (data) {
                scoreMap = data || {};
                return scoreMap;
            })
            .catch(function () {
                scoreMap = {};
                return scoreMap;
            });
    }

    // ── 规则校验 ──
    function cardScoreOf(id) {
        var s = scoreMap && scoreMap[id];
        return s || null;
    }

    // 返回 { ok, reason }
    function checkAdd(zoneKey, id) {
        var zone = zones[zoneKey];
        var score = cardScoreOf(id);
        if (score && score.forbidden) {
            return { ok: false, reason: '🚫 该卡在 G-Ext 中为禁止卡' };
        }
        // 同名数量限制：主/额外/副合计最多 3
        var totalSame = 0;
        ['main', 'extra', 'side'].forEach(function (k) {
            zones[k].list.forEach(function (cid) { if (cid === id) totalSame++; });
        });
        if (totalSame >= 3) {
            return { ok: false, reason: '同名卡最多 3 张' };
        }
        if (zone.list.length >= zone.max) {
            return { ok: false, reason: zoneKey === 'main'
                ? '主卡组最多 60 张'
                : (zoneKey === 'extra' ? '额外卡组最多 15 张' : '副卡组最多 15 张') };
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

    // ── 渲染 ──
    function renderAll() {
        renderZone('main');
        renderZone('extra');
        renderZone('side');
        // 分数未就绪时显示加载中占位
        var scoreEl = document.getElementById('dbScore');
        if (!scoreMap) {
            scoreEl.textContent = '总分：…/100';
            scoreEl.style.color = '#888';
            return;
        }
        var total = calcTotalScore();
        scoreEl.textContent = '总分：' + total + '/' + scoreLimit;
        scoreEl.style.color = total > scoreLimit ? '#ff6b6b' : '#F0E68C';
        scoreEl.style.fontWeight = 'bold';
    }

    // 分数就绪后重算总分（首次开启组卡时 loadScores 异步）
    function refreshScore() {
        loadScores().then(function () {
            renderAll();
        });
    }

    function cardThumbHtml(id) {
        var idx = window._cardIndex;
        var info = idx && idx.get ? idx.get(parseInt(id, 10)) : null;
        var title = info && info.name ? info.name : ('卡牌 ' + id);
        return '<img class="db-card-img" src="https://api.ygopro3.cn/pics/siro/' + id
            + '.jpg" alt="' + escapeHtml(title) + '" title="' + escapeHtml(title)
            + ' · 点击移除" loading="lazy"'
            + ' onerror="this.onerror=null;this.src=\'https://cdn.233.momobako.com/ygopro/pics/'
            + id + '.jpg\';this.onerror=function(){this.onerror=null;this.src=\'cover.jpg\';}">';
    }

    function renderZone(zoneKey) {
        var zone = zones[zoneKey];
        var score = cardScoreOf; // eslint-disable-line
        zone.el.innerHTML = zone.list.length
            ? zone.list.map(function (id, i) {
                return '<div class="db-card-slot" data-zone="' + zoneKey + '" data-index="' + i
                    + '" data-id="' + id + '">' + cardThumbHtml(id)
                    + '<span class="db-remove">×</span></div>';
            }).join('')
            : '<div class="db-zone-empty">空</div>';
        zone.countEl.textContent = zone.list.length;
    }

    // ── 加减卡 ──
    function addCard(zoneKey, id) {
        var res = checkAdd(zoneKey, id);
        if (!res.ok) {
            toast(res.reason);
            return false;
        }
        zones[zoneKey].list.push(id);
        renderAll();
        refreshScore(); // 分数未就绪时异步补齐后重算
        return true;
    }

    function removeCard(zoneKey, index) {
        zones[zoneKey].list.splice(index, 1);
        renderAll();
        refreshScore();
    }

    // ── 加入位置小菜单 ──
    function showZoneMenu(cardId, x, y, defaultZone) {
        hideZoneMenu();
        pendingCard = cardId;
        menuEl = document.createElement('div');
        menuEl.className = 'db-zone-menu';
        var opts = [
            { k: 'main', label: '主卡组' },
            { k: 'extra', label: '额外卡组', hint: isExtraMonster(cardInfoOf(cardId)) ? '（默认）' : '' },
            { k: 'side', label: '副卡组' },
        ];
        menuEl.innerHTML = '<div class="db-zone-menu-title">加入位置</div>'
            + opts.map(function (o) {
                return '<button class="db-zone-opt" data-zone="' + o.k + '">' + o.label
                    + (o.hint ? ' <span style="font-size:10px;color:#888">' + o.hint + '</span>' : '')
                    + '</button>';
            }).join('')
            + '<button class="db-zone-opt db-zone-cancel">取消</button>';
        document.body.appendChild(menuEl);

        // 定位
        var mw = menuEl.offsetWidth || 120;
        var mh = menuEl.offsetHeight || 120;
        var left = Math.min(x, window.innerWidth - mw - 8);
        var top = Math.min(y, window.innerHeight - mh - 8);
        menuEl.style.left = Math.max(4, left) + 'px';
        menuEl.style.top = Math.max(4, top) + 'px';

        menuEl.querySelectorAll('.db-zone-opt[data-zone]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var z = btn.getAttribute('data-zone');
                if (pendingCard != null) addCard(z, pendingCard);
                hideZoneMenu();
            });
        });
        menuEl.querySelector('.db-zone-cancel').addEventListener('click', hideZoneMenu);
        // 智能默认：如果卡是额外怪兽，把额外选项高亮提示（点击卡直接默认额外）
    }

    function hideZoneMenu() {
        if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
        menuEl = null;
        pendingCard = null;
    }

    // ── toast 提示 ──
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
            // 兼容：选中提示手动复制
            var ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动选择'); }
            document.body.removeChild(ta);
        }
    }

    function downloadYdk() {
        var content = buildYdkText();
        var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
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

    // ── 切换组卡模式 ──
    function setBuilderActive(on) {
        builderActive = on;
        toggleBtn.classList.toggle('active', on);
        panel.style.display = on ? 'block' : 'none';
        document.body.classList.toggle('deck-builder-on', on);
        if (on) {
            loadScores().then(function () {
                if (builderActive) renderAll();
            });
            renderAll();
        } else {
            hideZoneMenu();
        }
    }

    // ── 卡片点击拦截（事件委托：DIY 网格 + 官方网格共用容器 #cardContainer）──
    function onCardContainerClick(e) {
        if (!builderActive) return;
        // 只处理卡片本体/图片点击，避免触发卡片详情
        var cardEl = e.target.closest ? e.target.closest('.card-item') : null;
        if (!cardEl) return;
        e.preventDefault();
        e.stopPropagation();

        // 从卡片元素拿 id：DIY 卡 .card-id 文本 "ID: xxxx"，官方卡需要 data 属性
        var idStr = null;
        var idEl = cardEl.querySelector('.card-id');
        if (idEl) {
            var m = /ID:\s*(\d+)/.exec(idEl.textContent || '');
            if (m) idStr = m[1];
        }
        if (!idStr) {
            // 官方卡查询模式：卡片元素可能有 data-card-id
            idStr = cardEl.getAttribute('data-card-id');
        }
        if (!idStr) {
            // 兜底：找图片 URL 中的卡号
            var img = cardEl.querySelector('img');
            if (img) {
                var mm = /\/(\d{5,10})\.(jpg|png|webp)/.exec(img.src || img.getAttribute('data-src') || '');
                if (mm) idStr = mm[1];
            }
        }
        if (!idStr) return;
        var id = parseInt(idStr, 10);
        if (!id) return;

        var x = e.clientX, y = e.clientY;
        var defaultZone = 'main';
        var info = cardInfoOf(id);
        if (isExtraMonster(info)) defaultZone = 'extra';
        showZoneMenu(id, x, y, defaultZone);
    }

    // 移除卡片（点击卡组区 slot）
    function onZoneClick(e) {
        var slot = e.target.closest ? e.target.closest('.db-card-slot') : null;
        if (!slot) return;
        var zoneKey = slot.getAttribute('data-zone');
        var index = parseInt(slot.getAttribute('data-index'), 10);
        if (zoneKey && !isNaN(index)) {
            removeCard(zoneKey, index);
        }
    }

    // ── 初始化 ──
    function init() {
        if (!toggleBtn || !panel) return;

        toggleBtn.addEventListener('click', function () {
            setBuilderActive(!builderActive);
        });

        var container = document.getElementById('cardContainer');
        if (container) container.addEventListener('click', onCardContainerClick, true);

        // 卡组区点击移除
        ['main', 'extra', 'side'].forEach(function (k) {
            zones[k].el.addEventListener('click', onZoneClick);
        });

        document.getElementById('dbCopy').addEventListener('click', copyDeckCode);
        document.getElementById('dbDownload').addEventListener('click', downloadYdk);
        document.getElementById('dbClear').addEventListener('click', function () {
            var all = zones.main.list.length + zones.extra.list.length + zones.side.list.length;
            if (!all) { toast('卡组已是空的'); return; }
            if (confirm('确认清空当前卡组？')) clearAll();
        });

        // 点空白处关闭菜单
        document.addEventListener('click', function (e) {
            if (menuEl && !menuEl.contains(e.target)) hideZoneMenu();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') hideZoneMenu();
        });

        // 官方卡网格（ygocdb-search.js 可能用不同容器），若存在也绑定
        var ygoContainer = document.getElementById('ygoSearchResults')
            || document.querySelector('.ygocdb-grid')
            || document.getElementById('poolYgoResults');
        if (ygoContainer && ygoContainer !== container) {
            ygoContainer.addEventListener('click', onCardContainerClick, true);
        }

        // 暴露 API（供测试/其他模块）
        window.DeckBuilder = {
            active: function () { return builderActive; },
            enable: function () { setBuilderActive(true); },
            disable: function () { setBuilderActive(false); },
            add: function (zoneKey, id) { return addCard(zoneKey, id); },
            getDeck: function () {
                return { main: zones.main.list.slice(), extra: zones.extra.list.slice(), side: zones.side.list.slice() };
            },
            ydk: buildYdkText,
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
