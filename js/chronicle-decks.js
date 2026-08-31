/**
 * 白神服Sirokami — 编年史模式现有卡组
 * 主页「编年史模式」Tab 内展示卡组池列表，点击卡组名 → 复用全局卡组查看器弹窗（DeckViewer.showDeck）
 * 数据源: decks/chronicle_decks.json（由 decks/update_chronicle_decks.ps1 从 chronicle/*.ydk 生成）
 */
(function () {
    'use strict';

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function load() {
        var list = document.getElementById('chronicleDeckList');
        if (!list) return;

        fetch('decks/chronicle_decks.json?v=20260901a')
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                var decks = (data && data.decks) || [];
                if (!decks.length) {
                    list.innerHTML = '<div class="loading-hint">暂无编年史卡组</div>';
                    return;
                }
                list.innerHTML = '';
                decks.forEach(function (d) {
                    var btn = document.createElement('button');
                    btn.className = 'chronicle-deck-btn';
                    btn.textContent = d.name;
                    btn.title = '点击查看卡组详情';
                    btn.onclick = function () {
                        if (window.DeckViewer && window.DeckViewer.showDeck) {
                            window.DeckViewer.showDeck(
                                { main: d.main || [], extra: d.extra || [], side: d.side || [] },
                                d.name
                            );
                        }
                    };
                    list.appendChild(btn);
                });
            })
            .catch(function (e) {
                list.innerHTML = '<div class="loading-hint">⚠️ 加载卡组列表失败: ' +
                    escapeHtml(String(e.message || e)) + '</div>';
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', load);
    } else {
        load();
    }
})();
