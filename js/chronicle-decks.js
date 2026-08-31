/**
 * 白神服Sirokami — 编年史模式卡组列表
 * 主页「编年史模式」Tab 内「卡组列表」按钮 → 弹出卡组池列表弹窗 → 点击卡组名
 * 复用全局卡组查看器弹窗（DeckViewer.showDeck）查看卡组详情
 * 数据源: decks/chronicle_decks.json（由 decks/update_chronicle_decks.ps1 从 chronicle/*.ydk 生成）
 */
(function () {
    'use strict';

    var loaded = false;

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function openModal() {
        document.getElementById('chronicleOverlay').classList.add('show');
        document.body.style.overflow = 'hidden';
        if (!loaded) loadDecks();
    }

    function closeModal() {
        document.getElementById('chronicleOverlay').classList.remove('show');
        document.body.style.overflow = '';
    }

    function loadDecks() {
        loaded = true;
        var body = document.getElementById('chronicleModalBody');
        body.innerHTML = '<div class="loading-hint">加载中...</div>';

        fetch('decks/chronicle_decks.json?v=20260901b')
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                var decks = (data && data.decks) || [];
                if (!decks.length) {
                    body.innerHTML = '<div class="loading-hint">暂无编年史卡组</div>';
                    return;
                }
                var wrap = document.createElement('div');
                wrap.className = 'chronicle-modal-list';
                decks.forEach(function (d) {
                    var btn = document.createElement('button');
                    btn.className = 'chronicle-deck-btn';
                    btn.textContent = d.name;
                    btn.title = '点击查看卡组详情';
                    btn.onclick = function () {
                        closeModal();
                        if (window.DeckViewer && window.DeckViewer.showDeck) {
                            window.DeckViewer.showDeck(
                                { main: d.main || [], extra: d.extra || [], side: d.side || [] },
                                d.name
                            );
                        }
                    };
                    wrap.appendChild(btn);
                });
                body.innerHTML = '';
                body.appendChild(wrap);
            })
            .catch(function (e) {
                body.innerHTML = '<div class="loading-hint">⚠️ 加载卡组列表失败: ' +
                    escapeHtml(String(e.message || e)) + '</div>';
            });
    }

    function init() {
        var open = document.getElementById('chronicleDecksOpen');
        var overlay = document.getElementById('chronicleOverlay');
        if (!open || !overlay) return;

        open.onclick = openModal;

        var close = document.getElementById('chronicleModalClose');
        if (close) close.onclick = closeModal;

        overlay.onclick = function (e) {
            if (e.target === overlay) closeModal();
        };
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('show')) closeModal();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
