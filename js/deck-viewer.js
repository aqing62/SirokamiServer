/**
 * 白神服Sirokami — 全局卡组查看器
 * 桌面端：拖拽 .ydk 文件 → 解析展示卡组
 * 手机端：识别剪贴板内容 → 询问是否查看卡组
 * 卡组展示：复刻玩家排名胜者卡组样式（禁限分数角标 + DIY角标 + 双栏布局）
 *
 * YDK格式：
 *   #main / #extra / !side 分段
 *   每行一个卡ID，重复即复数张
 *   支持 #注释行
 *
 * 依赖：window._cardIndex（卡池信息模块提供卡名/效果）
 */

(function () {
    'use strict';

    // ── 常量 ──────────────────────────────────────────
    var OCG_PIC_URL = 'https://cdn.233.momobako.com/ygopro/pics/';
    var SUPER_PRE_URL = 'https://cdn02.moecube.com:444/ygopro-super-pre/data/pics/';
    var DIY_PIC_URL = 'https://api.ygopro3.cn/pics/siro/';
    var FALLBACK_PIC = 'cover.jpg';

    var isMobile = window.innerWidth <= 768;
    var _lastClipboardText = '';
    var _scoreMap = null;
    var _tooltipEl = null;
    var _toastTimer = 0;
    var _dragOverlay = null;
    var _clipboardToast = null;
    var _deckModalOverlay = null;

    // ═══════════════════════════════════════════════════
    // YDK 解析
    // ═══════════════════════════════════════════════════

    function parseYdk(text) {
        if (!text || typeof text !== 'string') return null;
        text = text.trim();

        var main = [];
        var extra = [];
        var side = [];
        var hasMarkers = /#main|#extra|!side/i.test(text);

        if (hasMarkers) {
            var section = 'main';
            var lines = text.split(/\r?\n/);
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;
                if (/^#/.test(line) && !/^#(main|extra)/i.test(line)) continue;
                if (/^#extra/i.test(line)) { section = 'extra'; continue; }
                if (/^!side/i.test(line)) { section = 'side'; continue; }
                var id = parseInt(line, 10);
                if (!isNaN(id) && id > 0) {
                    if (section === 'main') main.push(id);
                    else if (section === 'extra') extra.push(id);
                    else if (section === 'side') side.push(id);
                }
            }
        } else {
            var tokens = text.split(/[\s,\n\r]+/);
            for (var j = 0; j < tokens.length; j++) {
                var tid = parseInt(tokens[j], 10);
                if (!isNaN(tid) && tid > 0) main.push(tid);
            }
        }

        if (main.length === 0 && extra.length === 0 && side.length === 0) return null;
        return { main: main, extra: extra, side: side };
    }

    function detectDeckCode(text) {
        if (!text || typeof text !== 'string') return null;
        if (text.trim().length < 20) return null;
        var deck = parseYdk(text);
        if (!deck) return null;
        var totalCards = deck.main.length + deck.extra.length + deck.side.length;
        if (totalCards < 5) return null;
        // 卡ID合法性检查
        var allIds = deck.main.concat(deck.extra, deck.side);
        var validCount = 0;
        for (var i = 0; i < allIds.length; i++) {
            if (allIds[i] >= 1000 && allIds[i] <= 99999999) validCount++;
        }
        if (validCount / allIds.length < 0.8) return null;
        return deck;
    }

    // ═══════════════════════════════════════════════════
    // 禁限分数加载
    // ═══════════════════════════════════════════════════

    function loadScoreMap() {
        if (_scoreMap) return Promise.resolve(_scoreMap);
        return fetch('/api/scores')
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                _scoreMap = data;
                return _scoreMap;
            })
            .catch(function (e) {
                console.warn('Failed to load scores:', e);
                _scoreMap = {};
                return _scoreMap;
            });
    }

    // ═══════════════════════════════════════════════════
    // 卡信息加载（优先复用 window._cardIndex，否则请求 /api/cards）
    // ═══════════════════════════════════════════════════

    var _cardInfoMap = null;
    var _aliasMap = null;

    function loadCardInfoMap() {
        if (_cardInfoMap) return Promise.resolve(_cardInfoMap);

        // 优先复用卡池页面已加载的数据
        if (window._cardIndex && window._cardIndex.size) {
            _cardInfoMap = window._cardIndex;
            _aliasMap = buildAliasMap(window._cardIndex);
            return Promise.resolve(_cardInfoMap);
        }

        return fetch('/api/cards')
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (cards) {
                _cardInfoMap = new Map();
                cards.forEach(function (c) { _cardInfoMap.set(parseInt(c.id), c); });
                _aliasMap = buildAliasMap(_cardInfoMap);
                return _cardInfoMap;
            })
            .catch(function (e) {
                console.warn('Failed to load card info:', e);
                _cardInfoMap = new Map();
                _aliasMap = {};
                return _cardInfoMap;
            });
    }

    function buildAliasMap(cardMap) {
        var aliasMap = {};
        cardMap.forEach(function (card) {
            if (card.alias) aliasMap[parseInt(card.id)] = parseInt(card.alias);
        });
        return aliasMap;
    }

    function getCardInfo(cardId) {
        if (_cardInfoMap) {
            var card = _cardInfoMap.get(cardId);
            if (card) return card;
            var aliasId = _aliasMap && _aliasMap[cardId];
            if (aliasId) return _cardInfoMap.get(aliasId) || null;
        }
        return null;
    }

    function ensureTooltip() {
        if (_tooltipEl) return _tooltipEl;
        _tooltipEl = document.createElement('div');
        _tooltipEl.className = 'deck-viewer-tooltip';
        _tooltipEl.style.display = 'none';
        document.body.appendChild(_tooltipEl);
        return _tooltipEl;
    }

    function showTooltip(e, card) {
        if (!card) return;
        var tip = ensureTooltip();
        var isMonster = card.typeInfo && card.typeInfo.baseType === '怪兽';
        var atkDef = isMonster
            ? '<div class="tt-atkdef">ATK ' + (card.atk < 0 ? '?' : card.atk) + ' / DEF ' + (card.def < 0 ? '?' : card.def) + '</div>'
            : '';
        var raceAttr = isMonster
            ? '<div class="tt-raceattr">' + (card.attrName || '') + ' | ' + (card.raceName || '') + (card.level ? ' | Lv' + card.level : '') + '</div>'
            : '';
        tip.innerHTML =
            '<div class="tt-name">' + escapeHtml(card.name || '未知卡牌') + '</div>'
            + '<div class="tt-type">' + (card.typeInfo ? card.typeInfo.fullType : '') + '</div>'
            + raceAttr
            + atkDef
            + '<div class="tt-desc">' + (card.processedDesc || '') + '</div>';
        tip.style.display = 'block';

        positionTooltip(e, tip);
    }

    function hideTooltip() {
        if (_tooltipEl) _tooltipEl.style.display = 'none';
    }

    // ═══════════════════════════════════════════════════
    // 官方卡效果补充（非 DIY 卡：从百鸽 ygocdb 拉取显示）
    // ═══════════════════════════════════════════════════

    var _ygocdbCardCache = {};

    function fetchYgocdbCardInfo(cardId) {
        if (_ygocdbCardCache[cardId] !== undefined) {
            return Promise.resolve(_ygocdbCardCache[cardId]);
        }
        // 详情接口不返回卡名，改用搜索接口按密码查（返回 cn_name/sc_name + text）
        return fetch('https://ygocdb.com/api/v0/?search=' + cardId)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var card = (data && data.result && data.result[0]) || null;
                _ygocdbCardCache[cardId] = card;
                return card;
            })
            .catch(function () {
                _ygocdbCardCache[cardId] = null;
                return null;
            });
    }

    function positionTooltip(e, tip) {
        if (isMobile) {
            tip.style.left = Math.max(4, (window.innerWidth - tip.offsetWidth) / 2) + 'px';
            tip.style.top = '8px';
        } else {
            var x = e.clientX + 14;
            var y = e.clientY + 10;
            var tw = tip.offsetWidth;
            var th = tip.offsetHeight;
            if (x + tw > window.innerWidth - 10) x = e.clientX - tw - 14;
            if (y + th > window.innerHeight - 10) y = e.clientY - th - 10;
            tip.style.left = x + 'px';
            tip.style.top = y + 'px';
        }
    }

    // 解析 ygocdb types 字符串（"[怪兽|效果] 龙/暗\n[★7] 2500/2000"）为 DIY 展示结构
    function parseYgocdbTypes(types) {
        var res = { fullType: '', raceAttr: '', atkDef: '' };
        if (!types) return res;
        var lines = types.split(/\r?\n/);
        if (lines[0]) {
            var m = lines[0].match(/^(\[[^\]]*\])\s*(.*)$/);
            if (m) {
                // [怪兽|效果|灵摆] → 怪兽 效果 灵摆（去括号去竖线，空格分隔，与 DIY 一致）
                res.fullType = m[1].replace(/^\[|\]$/g, '').replace(/\|/g, ' ');
                var ra = (m[2] || '').trim();
                var parts = ra.split('/');
                if (parts.length === 2) {
                    // 格式为 种族/属性，DIY 展示顺序为 属性 | 种族；种族补"族"字（龙→龙族）
                    var race = parts[0].trim();
                    var attr = parts[1].trim();
                    if (race && race.slice(-1) !== '族') race += '族';
                    res.raceAttr = attr + ' | ' + race;
                } else if (ra) {
                    res.raceAttr = ra;
                }
            } else {
                res.fullType = lines[0];
            }
        }
        if (lines[1]) {
            var m2 = lines[1].match(/^\[★(\d+)\]\s*(\d+|-{1,2}|\?)\s*\/\s*(\d+|-{1,2}|\?)/);
            if (m2) {
                res.raceAttr = (res.raceAttr ? res.raceAttr + ' | ' : '') + 'Lv' + m2[1];
                res.atkDef = 'ATK ' + m2[2] + ' / DEF ' + m2[3];
            }
        }
        return res;
    }

    function showTooltipOfficial(e, data) {
        var t = (data && data.text) ? data.text : {};
        // 译名偏好（与官方卡查询页一致，默认 NWBBS）
        var transKey = 'nwbbs_n';
        try { transKey = localStorage.getItem('ygocdb.translation') || transKey; } catch (err) {}
        var name = data[transKey] || data.sc_name || data.cn_name || data.en_name || t.name || ('卡牌 ' + data.id);
        var tip = ensureTooltip();
        // 与 DIY 卡悬浮效果保持同一结构：卡名/类型/属性·种族·等级/ATK·DEF/效果文本
        var info = parseYgocdbTypes(t.types);
        var desc = t.desc ? t.desc.replace(/\r\n/g, '\n') : '';
        tip.innerHTML =
            '<div class="tt-name">' + escapeHtml(name) + '</div>'
            + (info.fullType ? '<div class="tt-type">' + escapeHtml(info.fullType) + '</div>' : '')
            + (info.raceAttr ? '<div class="tt-raceattr">' + escapeHtml(info.raceAttr) + '</div>' : '')
            + (info.atkDef ? '<div class="tt-atkdef">' + escapeHtml(info.atkDef) + '</div>' : '')
            + (desc
                ? '<div class="tt-desc">' + escapeHtml(desc) + '</div>'
                : '<div class="tt-desc" style="color:#999;">暂无效果文本</div>');
        tip.style.display = 'block';
        positionTooltip(e, tip);
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ═══════════════════════════════════════════════════
    // 卡图渲染（复刻 player-ranking.js cardImgs）
    // ═══════════════════════════════════════════════════

    /**
     * 排序但不合并：每张卡独立展示，同一卡ID可多次出现
     */
    function sortCards(ids) {
        return (ids || []).slice().sort(function (a, b) { return a - b; });
    }

    /**
     * 渲染卡片图片列表，带禁限分数角标 + DIY角标
     * 复刻 player-ranking.js:cardImgs()
     */
    function cardImgs(ids, scoreMap) {
        if (!ids || !ids.length) return '<div class="deck-empty-tip">无</div>';
        return sortCards(ids).map(function (id) {
            var scoreBadge = '';
            if (scoreMap && scoreMap[id]) {
                if (scoreMap[id].forbidden) {
                    scoreBadge = '<div class="card-score-badge forbidden">🚫</div>';
                } else {
                    scoreBadge = '<div class="card-score-badge">' + scoreMap[id].score + '</div>';
                }
            }
            // 四级回退：OCG → SuperPre → DIY → fallback（DIY 成功时打标）
            return '<div class="card-img-wrapper" data-card-id="' + id + '">'
                + '<img src="' + OCG_PIC_URL + id + '.jpg" class="deck-card-img" alt="' + id + '" loading="lazy"'
                + ' onerror="this.onerror=null;this.src=\'' + SUPER_PRE_URL + id + '.jpg\';'
                + 'this.onerror=function(){this.onerror=null;this.src=\'' + DIY_PIC_URL + id + '.jpg\';'
                + 'this.onload=function(){var w=this.closest(\'.card-img-wrapper\');'
                + 'if(w&&!w.querySelector(\'.card-diy-badge\')){'
                + 'var b=document.createElement(\'div\');b.className=\'card-diy-badge\';b.textContent=\'DIY\';w.appendChild(b);'
                + '}};'
                + 'this.onerror=function(){this.src=\'' + FALLBACK_PIC + '\';}}">'
                + scoreBadge
                + '</div>';
        }).join('');
    }

    /**
     * 生成 YDK 文本并触发浏览器下载（5秒冷却）
     */
    var _lastDownloadTime = 0;
    function downloadYdk(deck, fileName) {
        var now = Date.now();
        if (now - _lastDownloadTime < 5000) return;
        _lastDownloadTime = now;

        var lines = ['#created by Sirokami'];
        if (deck.main.length) {
            lines.push('#main');
            for (var i = 0; i < deck.main.length; i++) {
                lines.push(String(deck.main[i]));
            }
        }
        if (deck.extra.length) {
            lines.push('#extra');
            for (var j = 0; j < deck.extra.length; j++) {
                lines.push(String(deck.extra[j]));
            }
        }
        if (deck.side.length) {
            lines.push('!side');
            for (var k = 0; k < deck.side.length; k++) {
                lines.push(String(deck.side[k]));
            }
        }
        var content = lines.join('\n');

        var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ═══════════════════════════════════════════════════
    // 卡组弹窗（复刻 fetchPlayerDeck 布局）
    // ═══════════════════════════════════════════════════

    function openDeckModal(deck, sourceName) {
        closeDeckModal();

        // 生成 YDK 文件名
        var ydkFileName = (sourceName || 'deck').replace(/[\\/:*?"<>|]/g, '_') + '.ydk';

        var overlay = document.createElement('div');
        overlay.className = 'deck-viewer-modal-overlay';
        overlay.innerHTML =
            '<div class="deck-viewer-modal">'
            + '<div class="deck-viewer-header">'
            + '<span class="deck-viewer-title">📋 ' + escapeHtml(sourceName || '卡组') + '</span>'
            + '<div class="deck-viewer-actions">'
            + '<button class="deck-viewer-dl-btn" id="deckViewerDl" title="下载 .ydk 卡组文件">⬇ 下载</button>'
            + '<button class="deck-viewer-close" id="deckViewerClose">&times;</button>'
            + '</div>'
            + '</div>'
            + '<div class="deck-viewer-body" id="deckViewerBody">'
            + '<div class="deck-loading" style="text-align:center;color:#aaa;padding:40px;">加载卡组数据...</div>'
            + '</div>'
            + '</div>';

        document.body.appendChild(overlay);
        _deckModalOverlay = overlay;

        // 下载按钮
        overlay.querySelector('#deckViewerDl').addEventListener('click', function () {
            downloadYdk(deck, ydkFileName);
        });

        // 加载分数和卡信息，然后渲染
        Promise.all([loadScoreMap(), loadCardInfoMap()]).then(function (results) {
            var scoreMap = results[0];
            var body = overlay.querySelector('#deckViewerBody');
            if (!body) return;

            var mainLen = deck.main.length;
            var extraLen = deck.extra.length;
            var sideLen = deck.side.length;

            // 主卡组 grid 4行布局
            var mainCols = Math.max(10, Math.ceil(mainLen / 4));
            var mainGridStyle = mainLen > 0
                ? 'style="grid-template-columns:repeat(' + mainCols + ',1fr);grid-template-rows:repeat(4,1fr);"'
                : '';

            var html =
                '<div class="deck-two-col">'
                // 左栏：主卡组
                + '<div class="deck-col-main">'
                + '<div class="deck-section-title">主卡组 (' + mainLen + '张)</div>'
                + '<div class="deck-cards-grid deck-cards-main" ' + mainGridStyle + '>'
                + cardImgs(deck.main, scoreMap)
                + '</div>'
                + '</div>'
                // 右栏：额外 + 副卡组
                + '<div class="deck-col-side">'
                + (extraLen > 0
                    ? '<div class="deck-section-title">额外卡组 (' + extraLen + '张)</div>'
                    + '<div class="deck-cards-grid deck-cards-extra">' + cardImgs(deck.extra, scoreMap) + '</div>'
                    : '')
                + (sideLen > 0
                    ? '<div class="deck-section-title">副卡组 (' + sideLen + '张)</div>'
                    + '<div class="deck-cards-grid deck-cards-side">' + cardImgs(deck.side, scoreMap) + '</div>'
                    : '')
                + (extraLen === 0 && sideLen === 0 ? '<div class="deck-empty-tip">无</div>' : '')
                + '</div>'
                + '</div>';

            body.innerHTML = html;

            // 绑定卡图悬停 tooltip
            attachCardHover(body);
        }).catch(function (e) {
            var body = overlay.querySelector('#deckViewerBody');
            if (body) body.innerHTML = '<div class="deck-empty-tip">加载失败: ' + e.message + '</div>';
        });

        // 绑定关闭事件
        var closeBtn = overlay.querySelector('#deckViewerClose');
        closeBtn.addEventListener('click', closeDeckModal);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeDeckModal();
        });
        document.addEventListener('keydown', onDeckModalKeydown);

        // 弹窗内滚轮不穿透
        overlay.addEventListener('wheel', function (e) {
            e.stopPropagation();
        }, { passive: false });

        requestAnimationFrame(function () {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    function closeDeckModal() {
        if (_deckModalOverlay) {
            _deckModalOverlay.classList.remove('active');
            document.body.style.overflow = '';
            document.removeEventListener('keydown', onDeckModalKeydown);
            var overlay = _deckModalOverlay;
            setTimeout(function () {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 300);
            _deckModalOverlay = null;
        }
        hideTooltip();
    }

    function onDeckModalKeydown(e) {
        if (e.key === 'Escape') closeDeckModal();
    }

    function attachCardHover(container, selector) {
        container.querySelectorAll(selector || '.card-img-wrapper').forEach(function (wrapper) {
            wrapper.addEventListener('mouseenter', function (e) {
                var cardId = parseInt(wrapper.getAttribute('data-card-id'));
                if (!cardId) return;
                var card = getCardInfo(cardId);
                if (card) {
                    showTooltip(e, card);
                } else {
                    // 非 DIY 卡：从官方卡查补充效果（仍悬停时才显示）
                    fetchYgocdbCardInfo(cardId).then(function (official) {
                        if (official && wrapper.matches(':hover')) showTooltipOfficial(e, official);
                    });
                }
            });
            wrapper.addEventListener('mousemove', function (e) {
                if (!_tooltipEl || _tooltipEl.style.display === 'none') return;
                if (!isMobile) {
                    var x = e.clientX + 14;
                    var y = e.clientY + 10;
                    var tw = _tooltipEl.offsetWidth;
                    var th = _tooltipEl.offsetHeight;
                    if (x + tw > window.innerWidth - 10) x = e.clientX - tw - 14;
                    if (y + th > window.innerHeight - 10) y = e.clientY - th - 10;
                    _tooltipEl.style.left = x + 'px';
                    _tooltipEl.style.top = y + 'px';
                }
            });
            wrapper.addEventListener('mouseleave', hideTooltip);
            // 移动端触摸
            wrapper.addEventListener('touchstart', function (e) {
                var cardId = parseInt(wrapper.getAttribute('data-card-id'));
                if (!cardId) return;
                var card = getCardInfo(cardId);
                if (card) {
                    e.preventDefault();
                    showTooltip(e.touches[0], card);
                }
            }, { passive: false });
            wrapper.addEventListener('touchend', hideTooltip);
        });
    }

    // ═══════════════════════════════════════════════════
    // 拖拽处理（桌面端）
    // ═══════════════════════════════════════════════════

    var _dragCounter = 0;

    function createDragOverlay() {
        if (_dragOverlay) return _dragOverlay;
        var overlay = document.createElement('div');
        overlay.className = 'deck-drag-overlay';
        overlay.innerHTML =
            '<div class="deck-drag-dropzone">'
            + '<span class="deck-drag-icon">📥</span>'
            + '</div>';
        document.body.appendChild(overlay);
        _dragOverlay = overlay;
        return overlay;
    }

    function showDragOverlay() {
        createDragOverlay().classList.add('active');
    }

    function hideDragOverlay() {
        if (_dragOverlay) _dragOverlay.classList.remove('active');
        _dragCounter = 0;
    }

    function hasFiles(e) {
        if (!e.dataTransfer || !e.dataTransfer.types) return false;
        for (var i = 0; i < e.dataTransfer.types.length; i++) {
            if (e.dataTransfer.types[i] === 'Files') return true;
        }
        return false;
    }

    function handleDragEnter(e) {
        if (isMobile) return;
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        _dragCounter++;
        showDragOverlay();
    }

    function handleDragOver(e) {
        if (isMobile) return;
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
    }

    function handleDragLeave(e) {
        if (isMobile) return;
        e.preventDefault();
        e.stopPropagation();
        _dragCounter--;
        if (_dragCounter <= 0) hideDragOverlay();
    }

    function handleDrop(e) {
        if (isMobile) return;
        e.preventDefault();
        e.stopPropagation();
        hideDragOverlay();

        var files = e.dataTransfer && e.dataTransfer.files;
        if (!files || !files.length) return;

        var ydkFile = null;
        for (var i = 0; i < files.length; i++) {
            if (/\.ydk$/i.test(files[i].name)) {
                ydkFile = files[i];
                break;
            }
        }
        if (!ydkFile) return;

        readAndShowYdkFile(ydkFile);
    }

    function readAndShowYdkFile(file) {
        var reader = new FileReader();
        reader.onload = function () {
            var text = reader.result;
            var deck = parseYdk(text);
            if (!deck) {
                showToast('无法解析该文件，请确认是有效的 .ydk 卡组文件', false);
                return;
            }
            var name = file.name.replace(/\.ydk$/i, '');
            openDeckModal(deck, name);
        };
        reader.onerror = function () {
            showToast('文件读取失败，请重试', false);
        };
        reader.readAsText(file);
    }

    // ═══════════════════════════════════════════════════
    // 剪贴板检测 & 粘贴处理
    // ═══════════════════════════════════════════════════

    function showToast(message, isDeck, onView) {
        if (_clipboardToast && _clipboardToast.parentNode) {
            _clipboardToast.parentNode.removeChild(_clipboardToast);
        }
        clearTimeout(_toastTimer);

        var toast = document.createElement('div');
        toast.className = 'clipboard-toast';
        if (isDeck) {
            toast.innerHTML =
                '<span class="clipboard-toast-icon">📋</span>'
                + '<span class="clipboard-toast-text">' + message + '</span>'
                + '<button class="clipboard-toast-btn" id="clipboardViewBtn">查看</button>'
                + '<button class="clipboard-toast-close" id="clipboardCloseBtn">&times;</button>';
        } else {
            toast.innerHTML =
                '<span class="clipboard-toast-icon">⚠️</span>'
                + '<span class="clipboard-toast-text">' + message + '</span>'
                + '<button class="clipboard-toast-close" id="clipboardCloseBtn">&times;</button>';
        }
        document.body.appendChild(toast);
        _clipboardToast = toast;

        var closeBtn = toast.querySelector('#clipboardCloseBtn');
        if (closeBtn) closeBtn.addEventListener('click', dismissToast);
        var viewBtn = toast.querySelector('#clipboardViewBtn');
        if (viewBtn && onView) {
            viewBtn.addEventListener('click', function () {
                dismissToast();
                onView();
            });
        }

        requestAnimationFrame(function () {
            toast.classList.add('show');
        });

        _toastTimer = setTimeout(dismissToast, 8000);
    }

    function dismissToast() {
        clearTimeout(_toastTimer);
        if (_clipboardToast) {
            _clipboardToast.classList.remove('show');
            var toast = _clipboardToast;
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 400);
            _clipboardToast = null;
        }
    }

    function checkClipboardForDeck() {
        if (!navigator.clipboard || !navigator.clipboard.readText) return;

        navigator.clipboard.readText().then(function (text) {
            if (!text || text === _lastClipboardText) return;
            _lastClipboardText = text;

            var deck = detectDeckCode(text);
            if (!deck) return;

            var totalCards = deck.main.length + deck.extra.length + deck.side.length;
            var hasMarkers = /#main|#extra|!side/i.test(text);
            var msg = hasMarkers
                ? '检测到剪贴板中的卡组（' + totalCards + '张），是否查看？'
                : '检测到剪贴板中的卡组码（' + totalCards + '张），是否查看？';

            showToast(msg, true, function () {
                var name = hasMarkers ? '剪贴板卡组' : '剪贴板卡组码';
                openDeckModal(deck, name);
            });
        }).catch(function () {
            // 静默忽略
        });
    }

    function handlePaste(e) {
        var activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
            return;
        }

        var text = '';
        if (e.clipboardData && e.clipboardData.getData) {
            text = e.clipboardData.getData('text/plain');
        }
        if (!text) return;

        var deck = detectDeckCode(text);
        if (!deck) return;

        e.preventDefault();
        e.stopPropagation();

        var totalCards = deck.main.length + deck.extra.length + deck.side.length;
        var hasMarkers = /#main|#extra|!side/i.test(text);
        var msg = hasMarkers
            ? '检测到粘贴的卡组（' + totalCards + '张），是否查看？'
            : '检测到粘贴的卡组码（' + totalCards + '张），是否查看？';

        showToast(msg, true, function () {
            var name = hasMarkers ? '粘贴的卡组' : '粘贴的卡组码';
            openDeckModal(deck, name);
        });
    }

    // ═══════════════════════════════════════════════════
    // 初始化
    // ═══════════════════════════════════════════════════

    function init() {
        // 拖拽事件（桌面端）
        document.addEventListener('dragenter', handleDragEnter, false);
        document.addEventListener('dragover', handleDragOver, false);
        document.addEventListener('dragleave', handleDragLeave, false);
        document.addEventListener('drop', handleDrop, false);

        // 防止浏览器直接打开拖拽的文件
        window.addEventListener('dragover', function (e) {
            if (!isMobile && e.dataTransfer && e.dataTransfer.types) e.preventDefault();
        }, false);
        window.addEventListener('drop', function (e) {
            if (!isMobile && e.dataTransfer && e.dataTransfer.types) e.preventDefault();
        }, false);

        // 全局粘贴事件
        document.addEventListener('paste', handlePaste, false);

        // 手机端剪贴板检测
        if (isMobile) {
            document.addEventListener('visibilitychange', function () {
                if (!document.hidden) setTimeout(checkClipboardForDeck, 600);
            });
            window.addEventListener('focus', function () {
                setTimeout(checkClipboardForDeck, 600);
            });
        }
    }

    // ── 公开 API ──
    window.DeckViewer = {
        parse: parseYdk,
        showDeck: function (deck, sourceName) {
            if (!deck || (!deck.main && !deck.extra && !deck.side)) {
                showToast('卡组数据无效', false);
                return;
            }
            openDeckModal(deck, sourceName || '卡组');
        },
        openDeck: function (ydkText, sourceName) {
            var deck = parseYdk(ydkText);
            if (!deck) {
                showToast('卡组数据无效', false);
                return;
            }
            openDeckModal(deck, sourceName || '卡组');
        },
        close: closeDeckModal,
        checkClipboard: checkClipboardForDeck,
        // 给任意容器绑定卡牌悬浮（DIY 卡表 + 官方卡补全），供胜者卡组/禁限分值等页面复用
        attachCardHover: function (container, selector) {
            if (!container) return;
            loadCardInfoMap().then(function () {
                attachCardHover(container, selector || '.card-img-wrapper');
            });
        },
        // 官方卡数据与展示字段（供论坛卡片嵌入等复用）
        fetchOfficialCard: fetchYgocdbCardInfo,
        officialCardFields: function (data) {
            var t = (data && data.text) ? data.text : {};
            var transKey = 'nwbbs_n';
            try { transKey = localStorage.getItem('ygocdb.translation') || transKey; } catch (err) {}
            var name = data[transKey] || data.sc_name || data.cn_name || data.en_name || t.name || ('卡牌 ' + data.id);
            var info = parseYgocdbTypes(t.types);
            return {
                name: name,
                fullType: info.fullType,
                raceAttr: info.raceAttr,
                atkDef: info.atkDef,
                desc: (t.desc || '').replace(/\r\n/g, '\n'),
            };
        },
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('resize', function () {
        isMobile = window.innerWidth <= 768;
    });

})();
