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

    // ── 排序：按名称首字母 A→Z ──
    // 形如「投稿者-卡组名」时取 "-" 之后的第一个字（例：命运博士投稿-光道 → G）
    // 常见首字直接查表；其余用中文拼音排序规则比较推定首字母
    var PINYIN_MAP = {
        '白': 'B', '爆': 'B', '饼': 'B', '不': 'B', '超': 'C', '点': 'D', '电': 'D', '二': 'E',
        '方': 'F', '芳': 'F', '风': 'F', '古': 'G', '光': 'G', '黑': 'H', '坏': 'H', '幻': 'H',
        '机': 'J', '急': 'J', '军': 'J', '卡': 'K', '克': 'K', '恐': 'K', '雷': 'L', '龙': 'L',
        '毛': 'M', '魔': 'M', '七': 'Q', '青': 'Q', '三': 'S', '手': 'S', '熟': 'S', '淘': 'T',
        '通': 'T', '王': 'W', '武': 'W', '新': 'X', '虚': 'X', '玄': 'X', '异': 'Y', '云': 'Y',
        '泽': 'Z', '真': 'Z', '珠': 'Z', '罪': 'Z',
    };
    var PINYIN_ANCHORS = [
        ['A', '阿'], ['B', '八'], ['C', '擦'], ['D', '搭'], ['E', '蛾'], ['F', '发'], ['G', '嘎'],
        ['H', '哈'], ['J', '击'], ['K', '喀'], ['L', '拉'], ['M', '妈'], ['N', '拿'], ['O', '噢'],
        ['P', '啪'], ['Q', '期'], ['R', '然'], ['S', '撒'], ['T', '塌'], ['W', '挖'], ['X', '昔'],
        ['Y', '压'], ['Z', '匝'],
    ];
    var pinyinCollator = null;
    try {
        pinyinCollator = new Intl.Collator('zh-Hans-CN');
    } catch (e) {
        pinyinCollator = null;
    }
    function pinyinInitialOf(ch) {
        if (PINYIN_MAP[ch]) return PINYIN_MAP[ch];
        if (!pinyinCollator) return 'Z';
        var best = 'A';
        for (var i = 0; i < PINYIN_ANCHORS.length; i++) {
            if (pinyinCollator.compare(ch, PINYIN_ANCHORS[i][1]) >= 0) best = PINYIN_ANCHORS[i][0];
        }
        return best;
    }
    // 排序用的核心名：含 "-" 等分隔符时取最后一段
    function sortCore(name) {
        var s = String(name == null ? '' : name);
        var parts = s.split(/[-－—–_]/);
        var core = (parts.length > 1 ? parts[parts.length - 1] : parts[0]).trim();
        return core || s.trim();
    }
    function initialKey(name) {
        var core = sortCore(name);
        var c = core.charAt(0);
        if (!c) return 'zzz';
        if (/[A-Za-z]/.test(c)) return c.toUpperCase();
        if (/[0-9]/.test(c)) return c;
        if (/[\u4e00-\u9fff]/.test(c)) return pinyinInitialOf(c);
        return 'zzz';
    }
    function deckSortRank(name) {
        var c = sortCore(name).charAt(0);
        if (!c) return '2';
        if (/[0-9]/.test(c)) return '1';                          // 数字开头排在字母之后
        if (/[A-Za-z]/.test(c) || /[\u4e00-\u9fff]/.test(c)) return '0';
        return '2';
    }
    function compareDecks(a, b) {
        var ra = deckSortRank(a.name), rb = deckSortRank(b.name);
        if (ra !== rb) return ra < rb ? -1 : 1;
        var ka = initialKey(a.name), kb = initialKey(b.name);
        if (ka !== kb) return ka < kb ? -1 : 1;
        var ca = sortCore(a.name), cb = sortCore(b.name);
        if (pinyinCollator) {
            var r = pinyinCollator.compare(ca, cb);
            if (r) return r;
        }
        return String(a.name).localeCompare(String(b.name));
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

        fetch('decks/chronicle_decks.json?v=202609200225b')
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
                decks = decks.slice().sort(compareDecks);   // 按首字母 A→Z 排序
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
