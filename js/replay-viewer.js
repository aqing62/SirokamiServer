/**
 * 白神服Sirokami — 回放播放器（雏形）
 * 输入 R# → /api/forum/replay/:id → 消息流驱动场地状态机
 * 左：双场地视图（卡图实时加载）  右：对局日志（每步从下弹出）
 * 雏形版说明：能播完整一局，支持 播放/暂停/步进/倍速/拖动。
 */
function initReplayViewer() {
    'use strict';

    // ── 常量（YGOPro ocgcore）──
    var LOC = {
        DECK: 1, HAND: 2, MZONE: 4, SZONE: 8, GRAVE: 16,
        REMOVED: 32, EXTRA: 64, OVERLAY: 128, FZONE: 256, PZONE: 512,
    };
    var LOC_NAME = {};
    LOC_NAME[LOC.DECK] = '卡组'; LOC_NAME[LOC.HAND] = '手牌';
    LOC_NAME[LOC.MZONE] = '怪兽区'; LOC_NAME[LOC.SZONE] = '魔陷区';
    LOC_NAME[LOC.GRAVE] = '墓地'; LOC_NAME[LOC.REMOVED] = '除外';
    LOC_NAME[LOC.EXTRA] = '额外'; LOC_NAME[LOC.OVERLAY] = '素材';
    LOC_NAME[LOC.FZONE] = '场地'; LOC_NAME[LOC.PZONE] = '灵摆';

    // 阶段（ocgcore phase 位标记值 → 中文）
    var PHASE_NAMES = {
        1: '抽卡阶段', 2: '准备阶段', 4: '主要阶段1',
        8: '战斗阶段', 16: '战斗步骤', 32: '伤害步骤',
        64: '伤害计算', 128: '战斗阶段',
        256: '主要阶段2', 512: '结束阶段',
    };

    // 卡图源（与站内一致：DIY 图 → 官方 CDN）
    var OCG_PIC = 'https://cdn.233.momobako.com/ygopro/pics/';
    var SUPER_PRE_PIC = 'https://cdn02.moecube.com:444/ygopro-super-pre/data/pics/';
    var DIY_PIC = 'https://api.ygopro3.cn/pics/siro/';

    // ── DOM ──
    var $ = function (id) { return document.getElementById(id); };
    var inputEl = $('replayInput');
    var loadBtn = $('replayLoadBtn');
    var metaEl = $('replayMeta');
    var controlsEl = $('replayControls');
    var mainEl = $('replayMain');
    var fieldEl = $('replayField');
    var logBody = $('replayLogBody');
    var playPauseBtn = $('rpPlayPause');
    var stepBtn = $('rpStep');
    var stepBackBtn = $('rpStepBack');
    var progressEl = $('rpProgress');
    var progressText = $('rpProgressText');

    // ── 回放状态 ──
    var messages = [];   // 解码后的消息 [{name,f,hex}]
    var meta = null;
    var idx = -1;        // 当前已播放到第几条
    var playing = false;
    var speed = 1;
    var timer = 0;
    var loaded = false;

    // 场地状态模型（只维护回放需要的抽象位置）
    // 简化：主控双方各一张表，键 "loc:seq"，值 {code, controller, loc, seq, faceDown}
    var field = {
        0: {}, 1: {},          // controller → 该玩家视角下的区（其实 loc 带 controller，这里简化按 controller 存储）
    };
    var lp = [8000, 8000];
    var turnPlayer = 0;
    var phaseText = '';
    var deckCount = [0, 0];  // 剩余卡组张数：开局=mainc，抽卡/移出卡组递减，回卡组递增
    var extraCount = [0, 0]; // 额外卡组张数（开局按 UpdateData(64) 列表，出场/回收增减）
    var inBattle = false;        // 是否处于伤害步骤（战斗消息上下文）
    var animSuppress = false;    // 进度条大跳等批量处理时关闭动画
    var preloading = false;      // 卡图预加载中

    // 卡池索引（卡名查询，可选加载 /api/cards）
    var cardNameMap = {};
    var cardNameLoaded = false;
    function loadCardNames() {
        if (cardNameLoaded) return Promise.resolve();
        cardNameLoaded = true;
        return fetch('/api/cards?t=' + Date.now())
            .then(function (r) { return r.json(); })
            .then(function (cards) {
                cards.forEach(function (c) { cardNameMap[String(c.id)] = c.name || ''; });
            })
            .catch(function () {});
    }
    function cardName(code) {
        return cardNameMap[String(code)] || '';
    }
    function cardImgSrc(code) {
        return DIY_PIC + code + '.jpg';
    }

    // ── 日志（右侧，每步插到底部并自动滚下）──
    function log(line, cls) {
        var div = document.createElement('div');
        div.className = 'rp-log-line' + (cls ? ' ' + cls : '');
        div.textContent = line;
        logBody.appendChild(div);
        // 保留最近 500 条
        while (logBody.children.length > 500) logBody.removeChild(logBody.firstChild);
        logBody.scrollTop = logBody.scrollHeight;
    }

    function logHtml(html) {
        var div = document.createElement('div');
        div.className = 'rp-log-line';
        div.innerHTML = html;
        logBody.appendChild(div);
        while (logBody.children.length > 500) logBody.removeChild(logBody.firstChild);
        logBody.scrollTop = logBody.scrollHeight;
    }

    // ── 场地渲染：持久 DOM + 分区局部更新（避免整场重建导致卡图闪烁）──
    var zoneEls = {};   // "c:loc:seq" → 格子容器（手牌/怪兽/魔陷）
    var midEls = {};    // "grave:c"/"deck:c" → 中间墓地/卡组容器
    var phaseEl = null;
    var turnLabelEl = null;
    var lpEls = {};
    var playerNameEls = {};
    var boardEl = null;     // 整个场地棋盘容器（用于整体缩放防滚动条）
    var cardDomCache = {}; // code → 已创建的 img src（内存缓存避免闪）

    // 场地棋盘按播放器窗口自动缩放：整体缩小到刚好放下，不出现滚动条
    function fitBoard() {
        if (!boardEl || !fieldEl.clientWidth) return;
        var availW = fieldEl.clientWidth - 12;
        var availH = fieldEl.clientHeight - 12;
        var bw = boardEl.scrollWidth || boardEl.offsetWidth;
        var bh = boardEl.scrollHeight || boardEl.offsetHeight;
        var k = Math.min(1, availW / bw, availH / bh);
        boardEl.style.transform = k < 1 ? 'scale(' + k + ')' : '';
    }

    function createFieldDOM() {
        // 上=对手(P1)，下=自己(P0)
        // 行 = [外轨][5格][外轨]：对手的牌堆凸在左外轨、自己凸在右外轨，对侧外轨留空，
        //     因此双方 5 格怪兽/魔陷列上下对齐（对称）。
        // 中线行：除外P1(左外轨) | 额外区P1 | 回合/阶段 | 额外区P0 | 除外P0(右外轨)
        var html =
            '<div class="rp-board">'
            + '<div class="rp-side rp-opp">' + sideSkeleton(1, true) + '</div>'
            + '<div class="rp-row rp-centerband">'
            + '<div class="rp-cell rp-pile rp-pile-removed" data-pile="removed:1"></div>'
            + '<div class="rp-mid-zone">'
            + '<div class="rp-rail-void"></div>'
            + '<div class="rp-cell rp-emz-cell" data-zone="emz:L" title="额外怪兽区(共用)"></div>'
            + '<div class="rp-mid-info"><span class="rp-turn-label"></span><span class="rp-phase"></span></div>'
            + '<div class="rp-cell rp-emz-cell" data-zone="emz:R" title="额外怪兽区(共用)"></div>'
            + '<div class="rp-rail-void"></div>'
            + '</div>'
            + '<div class="rp-cell rp-pile rp-pile-removed" data-pile="removed:0"></div>'
            + '</div>'
            + '<div class="rp-side rp-self">' + sideSkeleton(0, false) + '</div>'
            + '</div>';
        fieldEl.innerHTML = html;
        boardEl = fieldEl.querySelector('.rp-board');

        // 收集引用
        zoneEls = {};
        fieldEl.querySelectorAll('[data-zone]').forEach(function (el) {
            zoneEls[el.getAttribute('data-zone')] = el;
        });
        phaseEl = fieldEl.querySelector('.rp-phase');
        turnLabelEl = fieldEl.querySelector('.rp-turn-label');
        lpEls[0] = fieldEl.querySelector('[data-lp="0"]');
        lpEls[1] = fieldEl.querySelector('[data-lp="1"]');
        playerNameEls[0] = fieldEl.querySelector('[data-pname="0"]');
        playerNameEls[1] = fieldEl.querySelector('[data-pname="1"]');
        // 边侧牌堆格子：墓地/卡组（各2）+ 除外（中线行2）
        midEls = {};
        fieldEl.querySelectorAll('[data-pile]').forEach(function (el) {
            midEls[el.getAttribute('data-pile')] = el;
        });
        renderPlayerHead(0);
        renderPlayerHead(1);
        updateAllZones();
        fitBoard();
    }

    // 一侧场地骨架：名签 + 手牌 + 行(怪兽/魔陷 与 墓地/卡组 同格并排)
    function sideSkeleton(controller, isOpp) {
        // 名签：纵向排列，名字在上 LP 在下；对手挂右上角，自己挂左下角
        var nameTag = '<div class="rp-nametag ' + (isOpp ? 'rp-nametag-opp' : 'rp-nametag-self') + '">'
            + '<span class="rp-player-name" data-pname="' + controller + '"></span>'
            + '<span class="rp-lp" data-lp="' + controller + '"></span>'
            + '</div>';

        function zoneRow(loc, count) {
            var cells = '';
            for (var i = 0; i < count; i++) {
                cells += '<div class="rp-cell" data-zone="' + controller + ':' + loc + ':' + i + '"></div>';
            }
            return cells;
        }
        var mzone = zoneRow(LOC.MZONE, 5);
        var szone = zoneRow(LOC.SZONE, 5);
        var hand = '<div class="rp-hand" data-zone="' + controller + ':' + LOC.HAND + '"></div>';
        var mzoneRow = '<div class="rp-fieldrow rp-mzone">' + mzone + '</div>';
        var szoneRow = '<div class="rp-fieldrow rp-szone">' + szone + '</div>';
        // 牌堆/场地区：与同行格子同尺寸贴在外轨
        //   自己：怪兽行 [场地|怪兽×5|墓地]，魔陷行 [额外|魔陷×5|卡组]；对手左右镜像
        var graveCell = '<div class="rp-cell rp-pile rp-pile-grave" data-pile="grave:' + controller + '"></div>';
        var deckCell = '<div class="rp-cell rp-pile rp-pile-deck" data-pile="deck:' + controller + '"></div>';
        var extraCell = '<div class="rp-cell rp-pile rp-pile-extra" data-pile="extra:' + controller + '"></div>';
        var fieldCell = '<div class="rp-cell rp-field-cell" data-zone="' + controller + ':' + LOC.SZONE + ':5"></div>';

        if (isOpp) {
            // 对手(镜像)：手牌(顶) → [卡组|魔陷×5|额外] → [墓地|怪兽×5|场地]
            return nameTag
                + hand
                + '<div class="rp-row">' + deckCell + szoneRow + extraCell + '</div>'
                + '<div class="rp-row">' + graveCell + mzoneRow + fieldCell + '</div>';
        }
        // 自己：[场地|怪兽×5|墓地] → [额外|魔陷×5|卡组] → 手牌(底)
        return nameTag
            + '<div class="rp-row">' + fieldCell + mzoneRow + graveCell + '</div>'
            + '<div class="rp-row">' + extraCell + szoneRow + deckCell + '</div>'
            + hand;
    }

    function renderPlayerHead(controller) {
        var name = meta && meta.players
            ? (meta.players.find(function (p) { return p.pos === controller; }) || {}).realName || ''
            : ('玩家' + controller);
        var pEl = playerNameEls[controller];
        if (pEl) pEl.textContent = name || ('玩家' + (controller + 1));
        if (lpEls[controller]) lpEls[controller].textContent = 'LP ' + lp[controller];
    }

    function updateAllZones() {
        [0, 1].forEach(function (c) {
            [LOC.HAND, LOC.MZONE, LOC.SZONE].forEach(function (loc) {
                updateZone(c, loc);
            });
        });
        updatePiles();
        refreshEmz();
        // 阶段/回合
        if (phaseEl) phaseEl.textContent = phaseText || '对局开始';
        if (turnLabelEl) turnLabelEl.textContent = turnPlayer === 0 ? '我方回合' : '对手回合';
        // 高亮当前回合玩家
        [0, 1].forEach(function (c) {
            var side = fieldEl.querySelector(c === 1 ? '.rp-opp' : '.rp-self');
            if (side) side.classList.toggle('rp-active-side', turnPlayer === c);
        });
    }

    // 额外怪兽区：两格共用。核心按“各玩家自己视角”编号：
    //   P0：左=seq5 右=seq6；P1：左=seq6 右=seq5（左格=emz:L，右格=emz:R）
    function refreshEmz() {
        function content(candidates) {
            for (var i = 0; i < candidates.length; i++) {
                var ctl = candidates[i][0];
                var seq = candidates[i][1];
                var t = field[ctl];
                var cd = t ? t[LOC.MZONE + ':' + seq] : null;
                if (cd) return { card: cd, flip: ctl === 1 };
            }
            return null;
        }
        var L = content([[0, 5], [1, 6]]);
        var R = content([[0, 6], [1, 5]]);
        setCellCard(zoneEls['emz:L'], L ? L.card : null, L ? L.flip : false);
        setCellCard(zoneEls['emz:R'], R ? R.card : null, R ? R.flip : false);
    }

    // 侧边牌堆格子：墓地/除外 = 计数徽标 + 最顶卡（里侧则盖牌）；卡组 = 计数 + 卡背
    // 内容未变（_sig 相同）时跳过重绘，避免每步闪烁
    function fillPile(el, sig, badge, card, flip) {
        if (!el) return;
        if (el._sig === sig) return;
        giveImgsIn(el);
        el.innerHTML = '';
        if (badge) {
            var b = document.createElement('span');
            b.className = 'rp-pile-count';
            b.textContent = badge;
            el.appendChild(b);
        }
        if (card) el.appendChild(cardNode(card, flip));
        el._sig = sig;
    }
    function updatePiles() {
        [0, 1].forEach(function (c) {
            var gc = locCards(c, LOC.GRAVE);
            var gtop = gc[gc.length - 1];
            fillPile(midEls['grave:' + c],
                'g' + gc.length + '|' + (gtop ? (gtop.code + (gtop.faceDown ? 'd' : 'u')) : ''),
                gc.length ? String(gc.length) : null,
                gc.length ? gtop : null,
                !!(c === 1 && gtop && !gtop.faceDown));
            var dcount = deckCount[c] || 0;
            fillPile(midEls['deck:' + c],
                'd' + dcount,
                String(dcount),
                dcount ? { code: 0, faceDown: true } : null,
                false);
            var xcount = extraCount[c] || 0;
            fillPile(midEls['extra:' + c],
                'x' + xcount,
                String(xcount),
                xcount ? { code: 0, faceDown: true } : null,
                false);
            var bc = locCards(c, LOC.REMOVED);
            var btop = bc[bc.length - 1];
            fillPile(midEls['removed:' + c],
                'r' + bc.length + '|' + (btop ? (btop.code + (btop.faceDown ? 'd' : 'u')) : ''),
                bc.length ? String(bc.length) : null,
                bc.length ? btop : null,
                !!(c === 1 && btop && !btop.faceDown));
        });
    }

    // 更新某玩家某区：手牌签名比对（未变不重绘，防每步闪）；场上逐格精确填
    // 对手(controller=1)的正面场上卡上下倒置，方便区分归属；手牌不倒
    function updateZone(controller, loc) {
        if (loc === LOC.HAND) {
            var container = zoneEls[controller + ':' + LOC.HAND];
            if (!container) return;
            var cards = locCards(controller, LOC.HAND);
            var sig = cards.map(function (c) { return c.code + (c.faceDown ? 'd' : 'u'); }).join(',');
            if (container._sig === sig) return;
            giveImgsIn(container);
            container.innerHTML = '';
            cards.forEach(function (card) { container.appendChild(cardNode(card, false)); });
            container._sig = sig;
            return;
        }
        // MZONE / SZONE：按 sequence 逐格
        for (var seq = 0; seq < 5; seq++) {
            var cellKey = controller + ':' + loc + ':' + seq;
            var cell = zoneEls[cellKey];
            var card = cell ? (field[controller] ? field[controller][loc + ':' + seq] : null) : null;
            setCellCard(cell, card, controller === 1 && !!card && !card.faceDown);
        }
        // 场地区：魔陷区的 seq=5 格（场地魔法）单独显示在怪兽行外轨
        if (loc === LOC.SZONE) {
            var fKey = controller + ':' + LOC.SZONE + ':5';
            var fCell = zoneEls[fKey];
            var fCard = field[controller] ? field[controller][LOC.SZONE + ':5'] : null;
            setCellCard(fCell, fCard, controller === 1 && !!fCard && !fCard.faceDown);
        }
    }

    // 卡图节点池：同一卡号复用已解码的 <img>，离场回收、再上场直接取用（不再重新加载）
    var cardImgs = {};
    // 卡图回退链：DIY → 先行(SuperPre) → OCG → moecube 镜像1/2/3 → cover.jpg
    function picChain(code) {
        return [
            cardImgSrc(code),
            SUPER_PRE_PIC + code + '.jpg',
            OCG_PIC + code + '.jpg',
            'https://cdn01.moecube.com:444/ygopro/pics/' + code + '.jpg',
            'https://cdn02.moecube.com:444/ygopro/pics/' + code + '.jpg',
            'https://cdn03.moecube.com:444/ygopro/pics/' + code + '.jpg',
            'cover.jpg'
        ];
    }
    function wireImgChain(im, code) {
        var chain = picChain(code);
        var i = 0;
        im.onerror = function () {
            i++;
            if (i < chain.length) im.src = chain[i];
        };
    }
    function buildCardImg(code) {
        var im = document.createElement('img');
        im._code = code;
        wireImgChain(im, code);
        im.src = cardImgSrc(code);
        return im;
    }
    function takeImg(code) {
        var arr = cardImgs[code];
        if (arr && arr.length) return arr.pop();
        return buildCardImg(code);
    }
    function giveImg(code, im) {
        if (!im) return;
        if (im.parentNode) im.parentNode.removeChild(im);
        (cardImgs[code] || (cardImgs[code] = [])).push(im);
    }
    function giveImgsIn(el) {
        if (!el) return;
        var imgs = el.querySelectorAll('img');
        for (var i = 0; i < imgs.length; i++) {
            var im = imgs[i];
            giveImg(im._code !== undefined ? im._code : 0, im);
        }
    }

    // 生成卡牌外层节点（正面图从池中取；盖牌/卡背无 img 节点）
    // flip=true：正面卡上下倒置（用于区分对手的卡；手牌不做）
    function cardNode(card, flip) {
        var w = document.createElement('div');
        w.className = 'rp-card';
        if (!card) { w.className += ' rp-card-empty'; return w; }
        if (card.faceDown) { w.className += ' rp-card-down'; w.title = '盖牌'; return w; }
        if (flip) w.className += ' rp-flip';
        var nm = cardName(card.code);
        w.title = escapeHtml(nm || card.code);
        w.appendChild(takeImg(card.code));
        return w;
    }

    // 单元格精确更新：同卡同状态不动 DOM；换卡/翻面/翻转才重建并回收旧图
    function setCellCard(cell, card, flip) {
        if (!cell) return;
        if (card) {
            var f = !!flip;
            if (cell._code === card.code && cell._down === !!card.faceDown && cell._flip === f && cell.querySelector('.rp-card')) return;
            giveImgsIn(cell);
            cell.innerHTML = '';
            cell.appendChild(cardNode(card, f));
            cell._code = card.code;
            cell._down = !!card.faceDown;
            cell._flip = f;
            if (!card.faceDown) warmCardImg(card.code);
        } else {
            if (cell._code !== undefined || cell.innerHTML !== '') {
                giveImgsIn(cell);
                cell.innerHTML = '';
                cell._code = null;
                cell._down = false;
                cell._flip = false;
            }
        }
    }

    function locCards(controller, loc) {
        var out = [];
        var pfx = loc + ':';
        Object.keys(field[controller] || {}).forEach(function (k) {
            if (k.indexOf(pfx) === 0) out.push(field[controller][k]);
        });
        out.sort(function (a, b) { return a.seq - b.seq; });
        return out;
    }

    function countLoc(controller, loc) {
        var pfx = loc + ':';
        var n = 0;
        Object.keys(field[controller] || {}).forEach(function (k) {
            if (k.indexOf(pfx) === 0) n++;
        });
        return n;
    }

    // 闪烁根治：预加载 + 缓存图片（防止每条消息重建触发加载闪烁）
    var imgLoading = {};
    function warmCardImg(code) {
        if (imgLoading[code] || cardDomCache[code]) return;
        imgLoading[code] = true;
        var trySrcs = picChain(code).slice(0, 6);   // 依次尝试各图源（不含最终 cover）
        var attempt = 0;
        var tryNext = function () {
            if (attempt >= trySrcs.length) { cardDomCache[code] = 'cover.jpg'; return; }
            var im = new Image();
            var src = trySrcs[attempt++];
            im.onload = function () { cardDomCache[code] = src; };
            im.onerror = tryNext;
            im.src = src;
        };
        tryNext();
    }
    function warmAllVisible() {
        [0, 1].forEach(function (c) {
            Object.keys(field[c] || {}).forEach(function (k) {
                var card = field[c][k];
                if (card && card.code && !card.faceDown) warmCardImg(card.code);
            });
        });
    }

    // ── 移动动画：幽灵卡从原格滑到目标格（视口坐标，随棋盘缩放自动正确）──
    function isVisibleLoc(l) { return l === LOC.HAND || l === LOC.MZONE || l === LOC.SZONE; }
    function rectAt(ctl, loc, seq) {
        var l2 = loc & 0xff;
        if (l2 === LOC.HAND) {
            var cont = zoneEls[ctl + ':' + LOC.HAND];
            if (!cont || !cont.children.length) return null;
            var cards = locCards(ctl, LOC.HAND);
            var i = 0;
            for (; i < cards.length; i++) { if (cards[i].seq === seq) break; }
            if (i >= cards.length || i >= cont.children.length) return null;
            return cont.children[i].getBoundingClientRect();
        }
        var cell = zoneEls[ctl + ':' + l2 + ':' + seq];
        return cell ? cell.getBoundingClientRect() : null;
    }
    function flyGhost(cardCode, down, s, d) {
        if (!s || !d || !s.width || !d.width) return;
        var g = document.createElement('div');
        g.className = 'rp-fly' + (down || !cardCode ? ' rp-fly-down' : '');
        g.style.width = s.width + 'px';
        g.style.height = s.height + 'px';
        g.style.left = s.left + 'px';
        g.style.top = s.top + 'px';
        if (!down && cardCode) {
            var im = document.createElement('img');
            wireImgChain(im, cardCode);
            im.src = cardImgSrc(cardCode);
            g.appendChild(im);
        }
        document.body.appendChild(g);
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                g.style.transform = 'translate(' + (d.left - s.left) + 'px,' + (d.top - s.top) + 'px)'
                    + ' scale(' + (d.width / s.width) + ',' + (d.height / s.height) + ')';
            });
        });
        setTimeout(function () {
            g.style.opacity = '0';
            setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, 200);
        }, 210);
    }
    function animateMove(cardCode, down, s, d) {
        if (animSuppress || !s || !d) return;
        flyGhost(cardCode, down, s, d);
    }

    // ── 攻击日志辅助：尽量确定“攻击了谁” ──
    function attackTargetCode(atkCtl) {
        // 攻击宣言前最近的 SelectCard（目标候选，通常只有1个=唯一目标）
        for (var i = idx - 1; i >= 0 && i > idx - 14; i--) {
            var m = messages[i];
            if (!m || !m.f) continue;
            if (m.name === 'SelectCard' && m.f.player === atkCtl && m.f.cards && m.f.cards.length) {
                return m.f.cards.length === 1 ? m.f.cards[0] : 0; // 0=多名候选不确定
            }
            if (m.name === 'Move' || m.name === 'Summoning' || m.name === 'SpSummoning') return -1;
        }
        return -1;
    }
    function attackResolve(atkCtl) {
        var defCtl = 1 - atkCtl;
        var defCards = Object.keys(field[defCtl] || {})
            .filter(function (k) { return k.indexOf('4:') === 0; })
            .map(function (k) { return field[defCtl][k]; });
        var c = attackTargetCode(atkCtl);
        if (c > 0) return { code: c, direct: false };
        if (!defCards.length) return { code: 0, direct: true };   // 场上无怪兽 → 直接攻击
        if (c === -1 && defCards.length === 1) return { code: defCards[0].code, direct: false };
        return { code: 0, direct: false };                        // 多个可攻击对象，无法确定
    }

    // ── 消息处理（驱动场地状态 + 日志）──
    function playerName(pos) {
        if (!meta || !meta.players) return 'P' + pos;
        var p = meta.players.find(function (x) { return x.pos === pos; });
        return p ? (p.realName || p.name || ('P' + pos)) : ('P' + pos);
    }

    function handleMessage(m) {
        var n = m.name;
        var f = m.f || {};
        switch (n) {
            case 'Start': {
                idx = 0;
                // 重置场地
                field = { 0: {}, 1: {} };
                lp = [8000, 8000];
                turnPlayer = 0;
                phaseText = '';
                // 卡组张数 = 开局主卡组数(mainc)，此后由 Draw/Move 增减
                deckCount = [0, 0];
                extraCount = [0, 0];
                (meta && meta.players || []).forEach(function (p) {
                    if ((p.pos === 0 || p.pos === 1) && p.mainc) deckCount[p.pos] = p.mainc;
                });
                createFieldDOM();
                log('🃏 对局开始（房间 ' + (meta.roomName || '') + '）');
                logHtml('VS <b>' + escapeHtml(playerName(0)) + '</b> 对战 <b>' + escapeHtml(playerName(1)) + '</b>');
                break;
            }
            case 'UpdateData': {
                // UpdateData 语义复杂，雏形不重建场上区；
                // 但 手牌(2) 全量列表与 额外卡组(64) 是权威的
                var udLoc = f.location !== undefined ? (f.location & 0xff) : null;
                if (udLoc === LOC.HAND && f.player !== undefined && f.cards
                    && (f.cards.length === 0 || typeof f.cards[0] === 'number')) {
                    syncHand(f.player, f.cards);
                    updateZone(f.player, LOC.HAND);
                } else if (udLoc === LOC.EXTRA && f.player !== undefined && Array.isArray(f.cards)) {
                    // 额外卡组列表（数字=卡号）→ 张数
                    var ec = f.cards.filter(function (c) { return typeof c === 'number'; }).length;
                    extraCount[f.player] = ec;
                    updatePiles();
                }
                break;
            }
            case 'Draw': {
                var pl = f.player;
                var cards = f.cards || [];
                var drawN = cards.length || (f.count || 0);
                if (drawN && deckCount[pl] !== undefined) {
                    deckCount[pl] = Math.max(0, deckCount[pl] - drawN);
                }
                log(playerName(pl) + ' 抽卡 ' + drawN + ' 张');
                cards.forEach(function (code) {
                    addToHand(pl, code);
                });
                updateZone(pl, LOC.HAND);
                // 卡组计数即时刷新（Draw 无 Move，不会触发 updateAllZones）
                updatePiles();
                break;
            }
            case 'NewTurn': {
                turnPlayer = f.player;
                phaseText = '回合开始';
                renderPlayerHead(0);
                renderPlayerHead(1);
                if (phaseEl) phaseEl.textContent = phaseText;
                if (turnLabelEl) turnLabelEl.textContent = turnPlayer === 0 ? '我方回合' : '对手回合';
                // 高亮当前回合方
                [0, 1].forEach(function (c) {
                    var side = fieldEl.querySelector(c === 1 ? '.rp-opp' : '.rp-self');
                    if (side) side.classList.toggle('rp-active-side', turnPlayer === c);
                });
                log('🔄 ' + playerName(turnPlayer) + ' 的回合');
                break;
            }
            case 'NewPhase': {
                phaseText = PHASE_NAMES[f.phase] || ('阶段' + f.phase);
                if (phaseEl) phaseEl.textContent = phaseText;
                log('— ' + phaseText + ' —', 'rp-log-phase');
                break;
            }
            case 'Move': {
                var code = f.code;
                var prev = f.previous || {};
                var cur = f.current || {};
                var name = cardName(code);
                // 卡组进出计数：移出卡组 -1，回卡组 +1（Draw 已在上面单独扣）
                var pLocD = prev.location !== undefined ? (prev.location & 0xff) : null;
                var cLocD = cur.location !== undefined ? (cur.location & 0xff) : null;
                if (pLocD === LOC.DECK || cLocD === LOC.DECK) {
                    var dCon = prev.controller !== undefined ? prev.controller : 0;
                    var dDelta = (cLocD === LOC.DECK ? 1 : 0) - (pLocD === LOC.DECK ? 1 : 0);
                    deckCount[dCon] = Math.max(0, (deckCount[dCon] || 0) + dDelta);
                }
                // 额外卡组计数：出场 -1，回收 +1
                if (pLocD === LOC.EXTRA || cLocD === LOC.EXTRA) {
                    var eCon = prev.controller !== undefined ? prev.controller : 0;
                    var eDelta = (cLocD === LOC.EXTRA ? 1 : 0) - (pLocD === LOC.EXTRA ? 1 : 0);
                    extraCount[eCon] = Math.max(0, (extraCount[eCon] || 0) + eDelta);
                }
                // 精确按位置移动（prev→cur）
                if (cur.location !== undefined) {
                    moveCard(prev, cur, code);
                    // 刷新涉及的两个区
                    var pCon = prev.controller !== undefined ? prev.controller : 0;
                    var pLoc = prev.location !== undefined ? (prev.location & 0xff) : null;
                    var cCon = cur.controller !== undefined ? cur.controller : pCon;
                    var cLoc = cur.location & 0xff;
                    if (pLoc !== null && (pCon !== cCon || pLoc !== cLoc)) updateZone(pCon, pLoc);
                    updateZone(cCon, cLoc);
                    // 若移动到卡组/额外/素材等未展示区，刷新计数
                    updateAllZones();
                }
                // 日志：谁、哪张卡、从哪个区到哪个区
                // （不带 reason 附注：本服核心的 reason 位与常见表不一致，按位猜测会误导）
                var from = prev.location !== undefined ? (LOC_NAME[prev.location & 0xff] || '') : '';
                var to = cur.location !== undefined ? (LOC_NAME[cur.location & 0xff] || '') : '';
                if (to) {
                    var mover = cur.controller !== undefined ? playerName(cur.controller) : '';
                    log((mover ? mover + '：' : '') + (name || '卡片') + '：' + (from ? from + ' → ' : '') + to);
                }
                break;
            }
            case 'Summoning': {
                var sc = f.code;
                log('⚡ ' + playerName(f.controller !== undefined ? f.controller : 0) + ' 召唤 ' + cardName(sc));
                // 召唤通常先有 Move 到手牌→场上，这里仅日志
                break;
            }
            case 'Summoned': {
                break;
            }
            case 'SpSummoning': {
                log('✨ 特殊召唤 ' + cardName(f.code));
                break;
            }
            case 'Chaining': {
                log('🔗 连锁发动：' + cardName(f.code), 'rp-log-chain');
                break;
            }
            case 'ChainSolving': log('… 连锁处理中 …', 'rp-log-chain'); break;
            case 'ChainSolved': log('✓ 连锁处理完毕', 'rp-log-chain'); break;
            case 'ChainEnd': log('— 连锁结束 —', 'rp-log-chain'); break;
            case 'Damage': {
                var dpl = f.player;
                lp[dpl] = Math.max(0, (lp[dpl] || 8000) - (f.value || 0));
                renderPlayerHead(dpl);
                log('💥 ' + playerName(dpl) + ' 受到 ' + f.value + ' 点伤害（LP ' + lp[dpl] + '）', 'rp-log-damage');
                break;
            }
            case 'Recover': {
                var rpl = f.player;
                lp[rpl] = Math.min(8000, (lp[rpl] || 8000) + (f.value || 0));
                renderPlayerHead(rpl);
                log('💚 ' + playerName(rpl) + ' 恢复 ' + f.value + ' LP');
                break;
            }
            case 'Win': {
                var wpl = f.player;
                log('🏆 ' + playerName(wpl) + ' 获胜！', 'rp-log-win');
                break;
            }
            case 'Hint': {
                if (f.hint) log('💡 ' + f.hint, 'rp-log-hint');
                break;
            }
            case 'ShuffleHand': {
                // 手牌洗牌：cards 为新顺序，整体重建手牌
                if (f.player !== undefined && f.cards && f.cards.length && typeof f.cards[0] === 'number') {
                    syncHand(f.player, f.cards);
                    updateZone(f.player, LOC.HAND);
                }
                break;
            }
            case 'SelectIdleCmd':
            case 'SelectBattleCmd':
            case 'SelectChain':
            case 'SelectCard':
            case 'SelectEffectYn':
            case 'SelectOption':
            case 'SelectPlace':
            case 'SelectPosition':
            case 'SelectTribute':
            case 'SelectSum':
            case 'SelectUnselectCard':
            case 'AnnounceCard':
            case 'AnnounceAttrib':
            case 'AnnounceNumber':
            case 'AnnounceRace':
            case 'ConfirmCards':
            case 'Toss':
            case 'RockPaperScissors':
                // 选择类消息：回放时无需操作，直接跳过（可能有可视提示可选做）
                break;
            default:
                // 未知消息不阻塞
                break;
        }
    }

    // 场地操作辅助：field[c][loc:seq] = {code, faceDown, pos(原表示位)}
    var _uid = 1;

    function addCardAt(controller, loc, seq, code, down, posRaw) {
        if (!field[controller]) field[controller] = {};
        field[controller][loc + ':' + seq] = {
            code: code,
            uid: _uid++,
            faceDown: !!down,
            pos: posRaw,
        };
    }

    function removeAt(controller, loc, seq) {
        if (field[controller]) delete field[controller][loc + ':' + seq];
    }

    // 手牌是“压缩列表”：出牌/洗牌后核心的序号会前移。
    // 因此删除手牌按【卡号】匹配，删除后把剩余手牌重排为 0..n-1（不依赖 seq 键）。
    function handKeys(ctl) {
        var t = field[ctl] || {};
        return Object.keys(t)
            .filter(function (k) { return k.indexOf(LOC.HAND + ':') === 0; })
            .sort(function (a, b) { return parseInt(a.split(':')[1], 10) - parseInt(b.split(':')[1], 10); });
    }
    function removeFromHandByCode(ctl, code) {
        if (!field[ctl] || !code) return false;
        var keys = handKeys(ctl);
        var idx = -1;
        for (var i = 0; i < keys.length; i++) {
            if (field[ctl][keys[i]].code === code) { idx = i; break; }
        }
        if (idx < 0) return false;
        delete field[ctl][keys[idx]];
        var rest = keys.filter(function (k, j) { return j !== idx; })
            .map(function (k) { return field[ctl][k]; });
        var next = {};
        Object.keys(field[ctl]).forEach(function (k) {
            if (k.indexOf(LOC.HAND + ':') !== 0) next[k] = field[ctl][k];
        });
        rest.forEach(function (c, j) { next[LOC.HAND + ':' + j] = c; });
        field[ctl] = next;
        return true;
    }

    // 用权威的手牌列表（顺序）整体重建手牌（UpdateData/ShuffleHand 同步用）
    function syncHand(ctl, codes) {
        if (!field[ctl]) field[ctl] = {};
        var next = {};
        Object.keys(field[ctl]).forEach(function (k) {
            if (k.indexOf(LOC.HAND + ':') !== 0) next[k] = field[ctl][k];
        });
        codes.forEach(function (c, i) {
            next[LOC.HAND + ':' + i] = { code: c, uid: _uid++, faceDown: false, pos: 0 };
        });
        field[ctl] = next;
    }

    function moveCard(prev, cur, code) {
        var pCon = prev.controller !== undefined ? prev.controller : 0;
        var pLoc = prev.location !== undefined ? (prev.location & 0xff) : undefined;
        var cCon = cur.controller !== undefined ? cur.controller : pCon;
        var cLoc = cur.location !== undefined ? (cur.location & 0xff) : undefined;
        var down = isFaceDown(cur.position);
        var posRaw = cur.position;

        if (pLoc === LOC.HAND) {
            // 出牌（含换控制权给对面，如坏兽）：按卡号删，找不到再退回按 seq 删
            var removed = removeFromHandByCode(pCon, code);
            if (!removed) removeAt(pCon, pLoc, prev.sequence !== undefined ? prev.sequence : 0);
        } else if (pLoc !== undefined) {
            removeAt(pCon, pLoc, prev.sequence !== undefined ? prev.sequence : 0);
        }

        if (cLoc === LOC.HAND) {
            // 回手/检索：追加末尾，序号=当前手牌数（随后 UpdateData 会再校准）
            addToHand(cCon, code !== undefined ? code : 0);
        } else if (cLoc !== undefined) {
            addCardAt(cCon, cLoc, cur.sequence !== undefined ? cur.sequence : 0, code, down, posRaw);
        }
    }

    function addToHand(controller, code) {
        var seq = 0;
        while (field[controller] && field[controller][LOC.HAND + ':' + seq]) seq++;
        if (code) addCardAt(controller, LOC.HAND, seq, code, false, 0);
    }

    function isFaceDown(pos) {
        if (pos === undefined) return false;
        return (pos & 0x8) !== 0 || (pos & 0x2) !== 0; // FACEDOWN_DEFENSE=8 FACEDOWN_ATTACK=2
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    // ── 播放推进 ──
    // 哪些消息算“可见步”：会写日志或改变场地。
    // UpdateData / UpdateCard / Select* / CardHint 等只是查询回声/等待输入，算填充消息。
    var VISIBLE_MSG = {
        Start: 1, Draw: 1, NewTurn: 1, NewPhase: 1, Move: 1,
        Summoning: 1, SpSummoning: 1, Chaining: 1, ChainSolving: 1,
        ChainSolved: 1, ChainEnd: 1, Damage: 1, Recover: 1, Win: 1, Hint: 1,
    };

    function playNext() {
        if (idx < messages.length - 1) {
            idx++;
            handleMessage(messages[idx]);
            // 消息处理器内部已做分区 updateZone；此处仅兜底更新计数/头
            renderPlayerHead(0);
            renderPlayerHead(1);
            updateProgress();
            return true;
        }
        return false;
    }

    // 推进到下一个“可见步”：中间夹的填充消息在同一 tick 内直接快进跳过（不计时）
    function playNextVisible() {
        var guard = 0;
        while (idx < messages.length - 1 && guard++ < 50000) {
            idx++;
            handleMessage(messages[idx]);
            if (VISIBLE_MSG[messages[idx].name]) break;
        }
        renderPlayerHead(0);
        renderPlayerHead(1);
        updateProgress();
        return idx < messages.length - 1;
    }

    function playStepBack() {
        // 雏形不支持回退（状态难回滚），提示
        log('⚠️ 雏形暂不支持回退，请用进度条重播', 'rp-log-hint');
    }

    function startAuto() {
        stopAuto();
        playing = true;
        playPauseBtn.textContent = '⏸ 暂停';
        // 基准：1x ≈ 333ms/可见步 → 右侧日志约每秒 3 行（填充消息不计时）
        var interval = Math.max(80, Math.floor(1000 / 3 / speed));
        function tick() {
            if (!playing) return;
            if (!playNextVisible()) {
                stopAuto();
                log('✅ 回放结束', 'rp-log-win');
                return;
            }
            timer = setTimeout(tick, interval);
        }
        timer = setTimeout(tick, 0);
    }

    function stopAuto() {
        playing = false;
        if (timer) { clearTimeout(timer); timer = 0; }
        playPauseBtn.textContent = '▶ 播放';
    }

    function updateProgress() {
        progressEl.value = messages.length ? (idx / (messages.length - 1)) * 100 : 0;
        progressText.textContent = (idx + 1) + ' / ' + messages.length;
    }

    // ── 卡图预加载：开播前把所有会用到的卡图下载好，播放中不等待、不闪烁 ──
    function collectCodes(msgs) {
        var set = {};
        msgs.forEach(function (m) {
            var f = m.f || {};
            if (typeof f.code === 'number') set[f.code] = 1;
            if (Array.isArray(f.cards)) {
                f.cards.forEach(function (c) { if (typeof c === 'number') set[c] = 1; });
            }
        });
        return Object.keys(set).map(function (k) { return parseInt(k, 10); });
    }
    function loadOneImg(code) {
        return new Promise(function (resolve) {
            var chain = picChain(code);
            var i = 0;
            function tryNext() {
                if (i >= chain.length) { cardDomCache[code] = 'cover.jpg'; return resolve(); }
                var im = new Image();
                var src = chain[i];
                im.onload = function () { cardDomCache[code] = src; resolve(); };
                im.onerror = function () { i++; tryNext(); };
                im.src = src;
            }
            tryNext();
        });
    }
    function preloadAll(codes, onProg) {
        return new Promise(function (resolveAll) {
            var total = codes.length;
            if (!total) { resolveAll(); return; }
            var idx = 0, done = 0;
            function nextBatch() {
                var batch = [];
                while (idx < total && batch.length < 8) batch.push(codes[idx++]);
                if (!batch.length) { resolveAll(); return; }
                var pending = batch.length;
                batch.forEach(function (code) {
                    loadOneImg(code).then(function () {
                        done++;
                        if (onProg) onProg(done, total);
                        if (--pending === 0) nextBatch();
                    });
                });
            }
            nextBatch();
        });
    }

    // ── 加载回放 ──
    function loadReplay(text) {
        var m = /R#?(\d+)/i.exec(text || '');
        var id = m ? parseInt(m[1], 10) : parseInt(text || '', 10);
        if (!id || isNaN(id)) { log('请输入有效回放码，如 R#3333'); return; }

        stopAuto();
        field = { 0: {}, 1: {} };
        lp = [8000, 8000];
        logBody.innerHTML = '';
        fieldEl.innerHTML = '<div class="rp-loading-tip">加载回放 R#' + id + ' ...</div>';
        mainEl.style.display = 'none';
        controlsEl.style.display = 'none';

        loadCardNames().then(function () {
            return fetch('/api/forum/replay/' + id);
        })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                if (data.error) throw new Error(data.error);
                meta = data;
                messages = data.messages || [];
                metaEl.textContent = data.roomName + ' · ' + (data.players || []).map(function (p) {
                    return (p.realName || p.name) + (p.winner ? '🏆' : '');
                }).join(' VS ');
                idx = -1;
                mainEl.style.display = 'flex';
                controlsEl.style.display = 'flex';
                loaded = true;
                // 先预加载全部会用到的卡图，再开始播放
                var codes = collectCodes(messages);
                preloading = true;
                fieldEl.innerHTML = '<div class="rp-loading-tip">预加载卡图 0/' + codes.length + ' …</div>';
                var tip = fieldEl.firstChild;
                preloadAll(codes, function (done, total) {
                    if (tip) tip.textContent = '预加载卡图 ' + done + '/' + total + ' …';
                }).then(function () {
                    preloading = false;
                    if (tip) tip.textContent = '预加载完成，开始播放';
                    // 播放到 Start
                    playNext();
                    startAuto();
                });
            })
            .catch(function (e) {
                logBody.innerHTML = '';
                log('❌ 加载失败：' + e.message, 'rp-log-err');
                fieldEl.innerHTML = '<div class="rp-loading-tip" style="color:#ff6b6b;">加载失败：' + escapeHtml(e.message) + '</div>';
            });
    }

    // ── 控件绑定 ──
    loadBtn.addEventListener('click', function () { loadReplay(inputEl.value); });
    inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') loadReplay(inputEl.value); });
    playPauseBtn.addEventListener('click', function () {
        if (preloading) return;   // 预加载中不响应
        if (playing) stopAuto(); else startAuto();
    });
    stepBtn.addEventListener('click', function () {
        if (preloading) return;
        stopAuto();
        playNextVisible();
    });
    stepBackBtn.addEventListener('click', playStepBack);
    progressEl.addEventListener('input', function () {
        // 拖动进度：雏形直接跳消息数重放（重置状态）
        if (!messages.length) return;
        var target = Math.round((progressEl.value / 100) * (messages.length - 1));
        stopAuto();
        // 从 Start 重放到 target
        field = { 0: {}, 1: {} };
        lp = [8000, 8000];
        turnPlayer = 0;
        phaseText = '';
        logBody.innerHTML = '';
        idx = -1;
        for (var i = 0; i <= target; i++) {
            idx = i;
            handleMessage(messages[i]);
        }
        // Start 消息已 createFieldDOM；若消息流没有 Start 则兜底建一次
        if (!fieldEl.querySelector('.rp-side')) createFieldDOM();
        updateProgress();
    });
    document.querySelectorAll('.rp-speed').forEach(function (btn) {
        btn.addEventListener('click', function () {
            speed = parseFloat(btn.getAttribute('data-s'));
            document.querySelectorAll('.rp-speed').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            if (playing) { stopAuto(); startAuto(); }
        });
    });

    // 窗口尺寸变化时重新缩放棋盘，保证不出现滚动条
    var _fitTimer = 0;
    window.addEventListener('resize', function () {
        clearTimeout(_fitTimer);
        _fitTimer = setTimeout(fitBoard, 80);
    });
}
