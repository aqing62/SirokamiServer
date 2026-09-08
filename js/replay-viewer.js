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

    // ── 动画系统：全部用视口坐标（棋盘被 fitBoard 缩放时 getBoundingClientRect 自动换算）──
    function isVisibleLoc(l) { return l === LOC.HAND || l === LOC.MZONE || l === LOC.SZONE; }
    function emzKey(ctl, seq) {
        // P0：左=5 右=6；P1：左=6 右=5
        return ctl === 0 ? (seq === 5 ? 'emz:L' : 'emz:R') : (seq === 5 ? 'emz:R' : 'emz:L');
    }
    function rectAt(ctl, locRaw, seq) {
        var l2 = locRaw & 0xff;
        if (l2 === LOC.HAND) {
            var cont = zoneEls[ctl + ':' + LOC.HAND];
            if (!cont || !cont.children.length) return null;
            var cards = locCards(ctl, LOC.HAND);
            var i = 0;
            for (; i < cards.length; i++) { if (cards[i].seq === seq) break; }
            if (i >= cards.length || i >= cont.children.length) return null;
            return cont.children[i].getBoundingClientRect();
        }        if (l2 === LOC.MZONE && seq >= 5) {
            var cellE = zoneEls[emzKey(ctl, seq)];
            return cellE ? cellE.getBoundingClientRect() : null;
        }
        if (l2 === LOC.SZONE && seq === 5) {
            var fcell = zoneEls[ctl + ':' + LOC.SZONE + ':5'];
            return fcell ? fcell.getBoundingClientRect() : null;
        }
        if (l2 === LOC.GRAVE || l2 === LOC.REMOVED || l2 === LOC.DECK || l2 === LOC.EXTRA) {
            var pileName = l2 === LOC.GRAVE ? 'grave' : (l2 === LOC.REMOVED ? 'removed' : (l2 === LOC.DECK ? 'deck' : 'extra'));
            var pel = midEls[pileName + ':' + ctl];
            return pel ? pel.getBoundingClientRect() : null;
        }
        var cell = zoneEls[ctl + ':' + l2 + ':' + seq];
        return cell ? cell.getBoundingClientRect() : null;
    }
    // 手牌来源格：按卡号定位（不依赖 seq，防止压缩/洗牌后错位导致没动画）
    function rectAtHandByCode(ctl, code) {
        var cont = zoneEls[ctl + ':' + LOC.HAND];
        if (!cont || !cont.children.length || !code) return null;
        var cards = locCards(ctl, LOC.HAND);
        for (var i = 0; i < cards.length; i++) {
            if (cards[i].code === code && cont.children[i]) return cont.children[i].getBoundingClientRect();
        }
        return null;
    }
    // 阶段横幅：画面中央从左滑入 → 停留 → 向右滑出消失
    function phaseBanner(text) {
        if (animSuppress || !text) return;
        var pane = fieldEl.getBoundingClientRect();
        var b = fxEl('rp-phase-banner');
        b.textContent = text;
        b.style.left = (pane.left + pane.width / 2) + 'px';
        b.style.top = (pane.top + pane.height / 2) + 'px';
        b.style.transform = 'translate(-50%,-50%) translateX(-130%)';
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                b.style.transform = 'translate(-50%,-50%) translateX(0)';
            });
        });
        setTimeout(function () {
            b.style.transform = 'translate(-50%,-50%) translateX(130%)';
            b.style.opacity = '0';
            setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 340);
        }, 640);
    }

    // 通用特效节点（fixed 定位，视口坐标）
    function fxEl(cls, w, h, left, top) {
        var el = document.createElement('div');
        el.className = cls;
        if (w) el.style.width = w + 'px';
        if (h) el.style.height = h + 'px';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        document.body.appendChild(el);
        return el;
    }

    // 移动动画：幽灵卡从原格滑到目标格
    function flyGhost(cardCode, down, s, d) {
        if (animSuppress || !s || !d || !s.width || !d.width) return;
        var g = fxEl('rp-fly' + (down || !cardCode ? ' rp-fly-down' : ''), s.width, s.height, s.left, s.top);
        if (!down && cardCode) {
            var im = document.createElement('img');
            wireImgChain(im, cardCode);
            im.src = cardImgSrc(cardCode);
            g.appendChild(im);
        }
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                g.style.transform = 'translate(' + (d.left - s.left) + 'px,' + (d.top - s.top) + 'px)'
                    + ' scale(' + (d.width / s.width) + ',' + (d.height / s.height) + ')';
            });
        });
        setTimeout(function () {
            g.style.opacity = '0';
            setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, 200);
        }, 200);
    }

    // 发效果：把卡片“放到镜头前”闪一下，并从中央向外扩散金色圆环
    function effectFlash(cardCode, fromRect, flip) {
        if (animSuppress || !cardCode) return;
        var pane = fieldEl.getBoundingClientRect();
        var cx = pane.left + pane.width / 2;
        var cy = pane.top + pane.height / 2;
        var BW = 150, BH = 210;
        var el = fxEl('rp-fx-card' + (flip ? ' rp-flip' : ''), BW, BH, cx - BW / 2, cy - BH / 2);
        var im = document.createElement('img');
        wireImgChain(im, cardCode);
        im.src = cardImgSrc(cardCode);
        el.appendChild(im);
        var sx = cx, sy = cy, sc = 0.5;
        if (fromRect && fromRect.width) {
            sx = fromRect.left + fromRect.width / 2;
            sy = fromRect.top + fromRect.height / 2;
            sc = Math.min(1, fromRect.width / 120);
        }
        el.style.opacity = '0';
        el.style.transform = 'translate(' + (sx - cx) + 'px,' + (sy - cy) + 'px) scale(' + (0.35 * sc) + ')';
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                el.style.opacity = '1';
                el.style.transform = 'translate(0px,0px) scale(1)';
            });
        });
        // 由中央发出的扩散圆环（两道，交错）
        function ringPulse(delay, size, dur, thick) {
            setTimeout(function () {
                var r = fxEl('rp-fx-ring', 46, 46, cx - 23, cy - 23);
                r.style.borderWidth = thick + 'px';
                try {
                    r.animate([
                        { transform: 'scale(0.5)', opacity: 0.95, offset: 0 },
                        { transform: 'scale(' + size + ')', opacity: 0, offset: 1 }
                    ], { duration: dur, easing: 'cubic-bezier(.1,.7,.35,1)' }).onfinish = function () {
                        if (r.parentNode) r.parentNode.removeChild(r);
                    };
                } catch (e) { /* ignore */ }
                setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, dur + 120);
            }, delay);
        }
        ringPulse(80, 8.5, 640, 3);
        ringPulse(200, 5.5, 480, 2);
        // 收尾淡出
        setTimeout(function () {
            el.style.opacity = '0';
            el.style.transform = 'translate(0px,0px) scale(1.15)';
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 180);
        }, 430);
    }

    // 攻击动画：攻击者撞向目标（或对手中线），撞击处闪光
    function attackFx(cardCode, fromRect, targetRect) {
        if (animSuppress || !fromRect || !fromRect.width) return;
        var tx, ty, tw, th;
        if (targetRect && targetRect.width) {
            tx = targetRect.left + targetRect.width / 2;
            ty = targetRect.top + targetRect.height / 2;
            tw = targetRect.width; th = targetRect.height;
        } else {
            var pane = fieldEl.getBoundingClientRect();
            tx = pane.left + pane.width / 2;
            ty = pane.top + pane.height * 0.42;
            tw = fromRect.width; th = fromRect.height;
        }
        var g = fxEl('rp-fly rp-fly-atk', fromRect.width, fromRect.height, fromRect.left, fromRect.top);
        if (cardCode) {
            var im = document.createElement('img');
            wireImgChain(im, cardCode);
            im.src = cardImgSrc(cardCode);
            g.appendChild(im);
        }
        var sx = fromRect.left + fromRect.width / 2, sy = fromRect.top + fromRect.height / 2;
        var dx = tx - sx, dy = ty - sy;
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                g.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + (tw / fromRect.width) + ',' + (th / fromRect.height) + ')';
            });
        });
        setTimeout(function () {
            var ring = fxEl('rp-fx-hit', 120, 120, tx - 60, ty - 60);
            setTimeout(function () {
                ring.style.opacity = '0';
                setTimeout(function () { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 300);
            }, 90);
        }, 230);
        setTimeout(function () {
            g.style.opacity = '0';
            setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, 220);
        }, 330);
    }

    // 破坏动画：卡片碎成金色发光粒子，先炸开再飞向墓地（定时双保险清理）
    function shatterFx(srcRect, graveRect) {
        if (animSuppress || !srcRect || !srcRect.width) return;
        var gx = graveRect && graveRect.width ? graveRect.left + graveRect.width / 2 : srcRect.left + srcRect.width / 2;
        var gy = graveRect && graveRect.width ? graveRect.top + graveRect.height / 2 : srcRect.bottom;
        var cx0 = srcRect.left + srcRect.width / 2, cy0 = srcRect.top + srcRect.height / 2;
        var golds = ['#ffd700', '#ffe27a', '#fff3c4', '#ffc94d', '#ffec9e'];
        for (var i = 0; i < 20; i++) {
            var sz = 3 + Math.random() * 5;
            var el = fxEl('rp-fx-shard rp-fx-gold', sz, sz,
                cx0 + (Math.random() - 0.5) * srcRect.width * 0.7,
                cy0 + (Math.random() - 0.5) * srcRect.height * 0.7);
            el.style.background = golds[i % golds.length];
            var bx = (Math.random() - 0.5) * 140;
            var by = (Math.random() - 0.5) * 100 - 30;
            (function (node) {
                var anim = null;
                try {
                    anim = node.animate([
                        { transform: 'translate(0px,0px) scale(1)', opacity: 1, offset: 0 },
                        { transform: 'translate(' + bx + 'px,' + by + 'px) scale(1.2)', opacity: 1, offset: 0.25 },
                        { transform: 'translate(' + (gx - cx0) + 'px,' + (gy - cy0) + 'px) scale(0.15)', opacity: 0, offset: 1 }
                    ], { duration: 620, easing: 'cubic-bezier(.3,.6,.5,1)' });
                } catch (e) { /* WAAPI 不可用时仅靠定时器清理 */ }
                if (anim) {
                    anim.onfinish = function () { if (node.parentNode) node.parentNode.removeChild(node); };
                }
                setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 760);
            })(el);
        }
    }

    function animateMove(cardCode, down, s, d) {
        flyGhost(cardCode, down, s, d);
    }

    // 召唤落地：怪兽入场后在脚下展开召唤圆环
    function summonRingFx(rect) {
        if (animSuppress || !rect || !rect.width) return;
        var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        var r = fxEl('rp-summon-ring', rect.width * 0.5, rect.width * 0.5, cx - rect.width * 0.25, cy - rect.width * 0.25);
        r.style.left = (cx - rect.width * 0.25) + 'px';
        r.style.top = (cy - rect.width * 0.25) + 'px';
        var anim = null;
        try {
            anim = r.animate([
                { transform: 'scale(0.15)', opacity: 0, offset: 0 },
                { transform: 'scale(1)', opacity: 0.95, offset: 0.35 },
                { transform: 'scale(1.25)', opacity: 0, offset: 1 }
            ], { duration: 480, easing: 'ease-out' });
        } catch (e) { /* ignore */ }
        if (anim) anim.onfinish = function () { if (r.parentNode) r.parentNode.removeChild(r); };
        setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 620);
    }

    // 单元格标记环：攻击方红圈 / 目标金圈（脉冲）
    function cellMarkFx(rect, color) {
        if (animSuppress || !rect || !rect.width) return;
        var m = fxEl('rp-fx-cellmark ' + (color === 'gold' ? 'gold' : 'red'),
            rect.width + 8, rect.height + 8, rect.left - 4, rect.top - 4);
        var anim = null;
        try {
            anim = m.animate([
                { opacity: 0, transform: 'scale(0.92)', offset: 0 },
                { opacity: 0.95, transform: 'scale(1.03)', offset: 0.3 },
                { opacity: 0.9, transform: 'scale(1.05)', offset: 0.65 },
                { opacity: 0, transform: 'scale(1.1)', offset: 1 }
            ], { duration: 900, easing: 'ease-in-out' });
        } catch (e) { /* ignore */ }
        if (anim) anim.onfinish = function () { if (m.parentNode) m.parentNode.removeChild(m); };
        setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 1050);
    }

    // 攻击箭头：攻击方 → 目标 的金色虚线箭头
    function arrowFx(ax, ay, tx, ty) {
        if (animSuppress) return;
        var NS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'rp-fx-arrow');
        svg.style.left = '0px';
        svg.style.top = '0px';
        svg.style.width = '100vw';
        svg.style.height = '100vh';
        var defs = document.createElementNS(NS, 'defs');
        var mark = document.createElementNS(NS, 'marker');
        mark.setAttribute('id', 'rpArrowH' + Date.now() + Math.floor(Math.random() * 9999));
        mark.setAttribute('viewBox', '0 0 10 10');
        mark.setAttribute('refX', '8');
        mark.setAttribute('refY', '5');
        mark.setAttribute('markerWidth', '8');
        mark.setAttribute('markerHeight', '8');
        mark.setAttribute('orient', 'auto-start-reverse');
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        path.setAttribute('fill', '#ffd700');
        mark.appendChild(path);
        defs.appendChild(mark);
        svg.appendChild(defs);
        var line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', ax);
        line.setAttribute('y1', ay);
        line.setAttribute('x2', tx);
        line.setAttribute('y2', ty);
        line.setAttribute('stroke', '#ffd700');
        line.setAttribute('stroke-width', '4');
        line.setAttribute('stroke-dasharray', '10 7');
        line.setAttribute('marker-end', 'url(#' + mark.getAttribute('id') + ')');
        svg.appendChild(line);
        document.body.appendChild(svg);
        var anim = null;
        try {
            anim = svg.animate([
                { opacity: 0, offset: 0 },
                { opacity: 1, offset: 0.15 },
                { opacity: 0.85, offset: 0.7 },
                { opacity: 0, offset: 1 }
            ], { duration: 950, easing: 'linear' });
        } catch (e) { /* ignore */ }
        if (anim) anim.onfinish = function () { if (svg.parentNode) svg.parentNode.removeChild(svg); };
        setTimeout(function () { if (svg.parentNode) svg.parentNode.removeChild(svg); }, 1100);
    }

    // 攻击标记：攻击怪兽红圈脉冲 + 目标金圈 + 金色箭头（替代原先撞击动画）
    function attackMarkFx(aRect, tRect, direct) {
        if (animSuppress || !aRect || !aRect.width) return;
        cellMarkFx(aRect, 'red');
        if (tRect && tRect.width) {
            if (!direct) cellMarkFx(tRect, 'gold');
            var ax = aRect.left + aRect.width / 2, ay = aRect.top + aRect.height / 2;
            var tx = tRect.left + tRect.width / 2, ty = tRect.top + tRect.height / 2;
            arrowFx(ax, ay, tx, ty);
        }
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
    // 前瞻本次战阶：若防守方(1-atkCtl)的怪兽从怪兽区离场 → 那正是被攻击的目标
    function lookAheadDefender(atkCtl) {
        var defCtl = 1 - atkCtl;
        var end = Math.min(idx + 200, messages.length - 1);
        for (var i = idx + 1; i <= end; i++) {
            var m = messages[i];
            if (!m || !m.f) continue;
            if (m.name === 'Move') {
                var pr = m.f.previous;
                var cr = m.f.current;
                if (pr && pr.location !== undefined && (pr.location & 0xff) === LOC.MZONE) {
                    if (pr.controller === defCtl) return m.f.code || 0;   // 防守方怪兽离场=被破坏
                    if (pr.controller === atkCtl && (cr.location & 0xff) === LOC.GRAVE) return 0; // 攻击方反死，难定目标
                }
            } else if (m.name === 'DamageStepEnd' || m.name === 'NewPhase' || m.name === 'Win' || m.name === 'Attack') {
                break;
            }
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
        // 多名候选：看战斗结果定目标（防守方被破坏离场=目标）
        var la = lookAheadDefender(atkCtl);
        if (la > 0) return { code: la, direct: false };
        return { code: 0, direct: false };                        // 仍无法确定
    }

    // 受伤闪红：受伤方那一半场地闪一层红色渐变
    function hurtFlash(ctl) {
        if (animSuppress) return;
        var side = fieldEl.querySelector(ctl === 1 ? '.rp-opp' : '.rp-self');
        if (!side) return;
        side.classList.remove('rp-hurt');
        void side.offsetWidth;   // 重置以重新触发动画
        side.classList.add('rp-hurt');
        setTimeout(function () { side.classList.remove('rp-hurt'); }, 620);
    }

    // 伤害/恢复数字提示：-3000 红字上飘 / +N 绿字上飘
    function dmgFloat(ctl, value, sign) {
        if (animSuppress) return;
        var side = fieldEl.querySelector(ctl === 1 ? '.rp-opp' : '.rp-self');
        if (!side) return;
        var sr = side.getBoundingClientRect();
        var x = sr.left + sr.width / 2;
        var y = sr.top + sr.height * (ctl === 1 ? 0.45 : 0.55);
        var el = fxEl('rp-dmg-num', 0, 0, 0, 0);
        el.textContent = (sign === '+' ? '+' : '-') + value;
        el.style.color = sign === '+' ? '#8dff9e' : '#ff5b6e';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.transform = 'translate(-50%,-50%)';
        var anim = null;
        try {
            anim = el.animate([
                { opacity: 0, transform: 'translate(-50%,-50%) translateY(6px)', offset: 0 },
                { opacity: 1, transform: 'translate(-50%,-50%) translateY(0)', offset: 0.12 },
                { opacity: 1, transform: 'translate(-50%,-50%) translateY(-22px)', offset: 0.75 },
                { opacity: 0, transform: 'translate(-50%,-50%) translateY(-46px)', offset: 1 }
            ], { duration: 950, easing: 'ease-out' });
        } catch (e) { /* ignore */ }
        if (anim) anim.onfinish = function () { if (el.parentNode) el.parentNode.removeChild(el); };
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1100);
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
                // 抽卡动画：卡从卡组堆滑向手牌
                if (!animSuppress && cards.length) {
                    var dkPileEl = midEls['deck:' + pl];
                    var handCont = zoneEls[pl + ':' + LOC.HAND];
                    if (dkPileEl && handCont) {
                        var dkR = dkPileEl.getBoundingClientRect();
                        cards.forEach(function (c, ci) {
                            var slotEl = handCont.children[handCont.children.length - cards.length + ci];
                            if (slotEl) {
                                setTimeout(function () {
                                    flyGhost(c, false, dkR, slotEl.getBoundingClientRect());
                                }, ci * 50);
                            }
                        });
                    }
                }
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
                if (!animSuppress) phaseBanner(phaseText);
                break;
            }
            case 'Move': {
                var code = f.code;
                var prev = f.previous || {};
                var cur = f.current || {};
                var name = cardName(code);
                // 动画：移动前先记下来源矩形（手牌按卡号定位；场上/牌堆按位置）
                var animPreSrc = null;
                if (!animSuppress && cur.location !== undefined) {
                    var pRaw = prev.location;
                    if (pRaw !== undefined) {
                        var pM = pRaw & 0xff;
                        var pCtl0 = prev.controller !== undefined ? prev.controller : 0;
                        if (pM === LOC.HAND) {
                            animPreSrc = rectAtHandByCode(pCtl0, code);
                        } else if (pM === LOC.MZONE || pM === LOC.SZONE
                            || pM === LOC.GRAVE || pM === LOC.REMOVED || pM === LOC.DECK || pM === LOC.EXTRA) {
                            animPreSrc = rectAt(pCtl0, pRaw, prev.sequence !== undefined ? prev.sequence : 0);
                        }
                    }
                }
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
                    // 动画：送墓=破碎粒子；其余=幽灵滑行（同格翻面不播）
                    if (animPreSrc) {
                        var mvCtl = cCon;
                        var mvSeq = cur.sequence !== undefined ? cur.sequence : 0;
                        var sameCell = pLoc === cLoc && pCon === cCon
                            && (prev.sequence === undefined || cur.sequence === undefined || prev.sequence === cur.sequence);
                        if (cLoc === LOC.GRAVE && (pLoc === LOC.MZONE || pLoc === LOC.SZONE)) {
                            var gPileEl = midEls['grave:' + mvCtl];
                            shatterFx(animPreSrc, gPileEl ? gPileEl.getBoundingClientRect() : null);
                        } else if (!sameCell) {
                            var dRect = rectAt(mvCtl, cur.location, mvSeq);
                            if (dRect) {
                                flyGhost(code || 0, isFaceDown(cur.position) || cLoc === LOC.DECK || cLoc === LOC.EXTRA, animPreSrc, dRect);
                                // 召唤落地：进入怪兽区后脚下展开圆环
                                if (cLoc === LOC.MZONE) {
                                    var ringRect = dRect;
                                    setTimeout(function () { summonRingFx(ringRect); }, 200);
                                }
                            }
                        }
                    }
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
                // 发效果动画：把卡“放到镜头前”闪一下
                if (!animSuppress && f.code) {
                    var cl = f.location;
                    var cc = f.controller;
                    if ((cl === undefined || cc === undefined) && f.chainCardLocation) {
                        cl = f.chainCardLocation.location;
                        cc = f.chainCardLocation.controller;
                    }
                    if (cl !== undefined && cc !== undefined) {
                        var fr = rectAt(cc, cl, f.sequence !== undefined ? f.sequence : 0);
                        effectFlash(f.code, fr, false);
                    } else {
                        effectFlash(f.code, null, false);
                    }
                }
                break;
            }
            case 'Attack': {
                var atk = f.attacker || {};
                var aCtl = atk.controller !== undefined ? atk.controller : 0;
                var aSeq = atk.sequence !== undefined ? atk.sequence : 0;
                var aLocRaw = atk.location !== undefined ? atk.location : LOC.MZONE;
                var aCard = field[aCtl] ? field[aCtl][(aLocRaw & 0xff) + ':' + aSeq] : null;
                var aCode = aCard ? aCard.code : 0;
                var tg = attackResolve(aCtl);
                var line = '⚔ ' + playerName(aCtl) + ' 的 ' + (cardName(aCode) || '怪兽');
                if (tg && tg.code) line += ' 攻击 ' + (cardName(tg.code) || '怪兽');
                else if (tg && tg.direct) line += ' 直接攻击';
                else line += ' 发起攻击';
                log(line, 'rp-log-battle');
                // 攻击动画：攻击怪兽红圈标记 + 目标金圈 + 金色箭头（直击则箭头指向对方LP）
                if (!animSuppress) {
                    var aRect = rectAt(aCtl, aLocRaw, aSeq);
                    var tRect = null;
                    var isDirect = !!(tg && tg.direct);
                    if (tg && tg.code) {
                        var df = field[1 - aCtl] || {};
                        var dk = Object.keys(df).filter(function (k) { return k.indexOf('4:') === 0; })
                            .find(function (k) { return df[k].code === tg.code; });
                        if (dk) tRect = rectAt(1 - aCtl, LOC.MZONE, parseInt(dk.split(':')[1], 10));
                    } else if (isDirect) {
                        // 直击：箭头指向对方手卡区中心（与客户端一致）
                        var hEl = zoneEls[(1 - aCtl) + ':' + LOC.HAND];
                        tRect = hEl ? hEl.getBoundingClientRect() : null;
                        if (!tRect) {
                            var lpEl2 = lpEls[1 - aCtl];
                            if (lpEl2) tRect = lpEl2.getBoundingClientRect();
                        }
                    }
                    attackMarkFx(aRect, tRect, isDirect);
                }
                break;
            }
            case 'DamageStepStart': inBattle = true; break;
            case 'DamageStepEnd': inBattle = false; break;
            case 'ChainSolving': log('… 连锁处理中 …', 'rp-log-chain'); break;
            case 'ChainSolved': log('✓ 连锁处理完毕', 'rp-log-chain'); break;
            case 'ChainEnd': log('— 连锁结束 —', 'rp-log-chain'); break;
            case 'Damage': {
                var dpl = f.player;
                lp[dpl] = Math.max(0, (lp[dpl] || 8000) - (f.value || 0));
                renderPlayerHead(dpl);
                hurtFlash(dpl);   // 受伤方瞬间闪红
                dmgFloat(dpl, f.value, '-');   // -3000 提示
                if (inBattle) {
                    log('💥 ' + playerName(dpl) + ' 受到 ' + f.value + ' 战斗伤害（LP ' + lp[dpl] + '）', 'rp-log-damage');
                } else {
                    log('💥 ' + playerName(dpl) + ' 受到 ' + f.value + ' 点效果伤害（LP ' + lp[dpl] + '）', 'rp-log-damage');
                }
                break;
            }
            case 'Recover': {
                var rpl = f.player;
                lp[rpl] = Math.min(8000, (lp[rpl] || 8000) + (f.value || 0));
                renderPlayerHead(rpl);
                dmgFloat(rpl, f.value, '+');   // +N 提示
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
        Start: 1, Draw: 1, NewTurn: 1, NewPhase: 1, Move: 1, Attack: 1,
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
        animSuppress = true;   // 大跳不放动画
        for (var i = 0; i <= target; i++) {
            idx = i;
            handleMessage(messages[i]);
        }
        animSuppress = false;
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
