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
    var cardDomCache = {}; // code → 已创建的 img src（内存缓存避免闪）

    function createFieldDOM() {
        // 上=对手(P1)，下=自己(P0)；左右镜像使双方 1~5 号位视觉对称
        var html =
            '<div class="rp-side rp-opp">' + sideSkeleton(1, true) + '</div>'
            + '<div class="rp-midbar">'
            + '<div class="rp-mid-group rp-grav-opp"><span class="rp-mid-label">墓地</span><div class="rp-mid-cards" data-mid="grave:1"></div></div>'
            + '<div class="rp-mid-group rp-deck-opp"><span class="rp-mid-label">卡组</span><div class="rp-mid-cards" data-mid="deck:1"></div></div>'
            + '<div class="rp-mid-info"><span class="rp-turn-label"></span><span class="rp-phase"></span></div>'
            + '<div class="rp-mid-group rp-deck-self"><span class="rp-mid-label">卡组</span><div class="rp-mid-cards" data-mid="deck:0"></div></div>'
            + '<div class="rp-mid-group rp-grav-self"><span class="rp-mid-label">墓地</span><div class="rp-mid-cards" data-mid="grave:0"></div></div>'
            + '</div>'
            + '<div class="rp-side rp-self">' + sideSkeleton(0, false) + '</div>';
        fieldEl.innerHTML = html;

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
        // 中间墓地/卡组 4 个容器
        midEls = {};
        fieldEl.querySelectorAll('[data-mid]').forEach(function (el) {
            midEls[el.getAttribute('data-mid')] = el;
        });
        renderPlayerHead(0);
        renderPlayerHead(1);
        updateAllZones();
    }

    // 一侧场地骨架：手牌 / 场上(魔陷+怪兽) / 角落名签
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

        if (isOpp) {
            // 对手(坐对面镜像)：手牌(最顶) → 魔陷 → 怪兽(靠中线)
            return nameTag + hand + szoneRow + mzoneRow;
        }
        // 自己：怪兽(靠中线) → 魔陷 → 手牌(最底)
        return mzoneRow + szoneRow + hand + nameTag;
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
        // 中间：墓地/卡组容器
        [0, 1].forEach(function (c) {
            var g = midEls['grave:' + c];
            if (g) {
                var gcards = locCards(c, LOC.GRAVE);
                g.innerHTML = gcards.length
                    ? '<span class="rp-mid-count">' + gcards.length + '</span>'
                        + (gcards.length ? cardImgHtml(gcards[gcards.length - 1]) : '')
                    : '';
            }
            var dk = midEls['deck:' + c];
            if (dk) {
                var dcount = deckCount[c] || 0;
                dk.innerHTML = '<span class="rp-mid-count">' + dcount + '</span>'
                    + (dcount ? '<div class="rp-card rp-card-down"></div>' : '');
            }
        });
        // 阶段/回合
        if (phaseEl) phaseEl.textContent = phaseText || '对局开始';
        if (turnLabelEl) turnLabelEl.textContent = turnPlayer === 0 ? '我方回合' : '对手回合';
        // 高亮当前回合玩家
        [0, 1].forEach(function (c) {
            var side = fieldEl.querySelector(c === 1 ? '.rp-opp' : '.rp-self');
            if (side) side.classList.toggle('rp-active-side', turnPlayer === c);
        });
    }

    // 更新某玩家某区：手牌整行重绘；场上逐格精确填
    function updateZone(controller, loc) {
        if (loc === LOC.HAND) {
            var container = zoneEls[controller + ':' + LOC.HAND];
            if (!container) return;
            var cards = locCards(controller, LOC.HAND);
            container.innerHTML = cards.length
                ? cards.map(cardImgHtml).join('')
                : '';
            return;
        }
        // MZONE / SZONE：按 sequence 逐格
        for (var seq = 0; seq < 5; seq++) {
            var cellKey = controller + ':' + loc + ':' + seq;
            var cell = zoneEls[cellKey];
            if (!cell) continue;
            var card = field[controller] ? field[controller][loc + ':' + seq] : null;
            if (card) {
                if (!cell.querySelector('.rp-card') || cell._code !== card.code || cell._down !== !!card.faceDown) {
                    cell.innerHTML = cardImgHtml(card);
                    cell._code = card.code;
                    cell._down = !!card.faceDown;
                }
            } else {
                if (cell.innerHTML !== '') { cell.innerHTML = ''; cell._code = null; }
            }
        }
    }

    function cardImgHtml(card) {
        if (!card) return '<div class="rp-card rp-card-empty"></div>';
        if (card.faceDown) {
            return '<div class="rp-card rp-card-down" title="盖牌"></div>';
        }
        var name = cardName(card.code);
        return '<div class="rp-card" title="' + escapeHtml(name || card.code) + '">'
            + '<img src="' + cardImgSrc(card.code) + '" alt="' + escapeHtml(name || card.code) + '"'
            + ' onerror="this.onerror=null;this.src=\'' + SUPER_PRE_PIC + card.code
            + '.jpg\';this.onerror=function(){this.onerror=null;this.src=\'' + OCG_PIC + card.code
            + '.jpg\';this.onerror=function(){this.onerror=null;this.src=\'cover.jpg\';}}">'
            + '</div>';
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
        var trySrcs = [cardImgSrc(code), SUPER_PRE_PIC + code + '.jpg', OCG_PIC + code + '.jpg'];
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
                (meta && meta.players || []).forEach(function (p) {
                    if ((p.pos === 0 || p.pos === 1) && p.mainc) deckCount[p.pos] = p.mainc;
                });
                createFieldDOM();
                log('🃏 对局开始（房间 ' + (meta.roomName || '') + '）');
                logHtml('VS <b>' + escapeHtml(playerName(0)) + '</b> 对战 <b>' + escapeHtml(playerName(1)) + '</b>');
                break;
            }
            case 'UpdateData': {
                // UpdateData 语义复杂（query 流），雏形跳过精确重建。
                // 但对局开始时双方卡组在 UpdateData 里建立——这里用简化：
                // 不展示卡组内部，保持场地空，靠 Draw 逐渐填充手牌。
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
                var dkEl = midEls['deck:' + pl];
                if (dkEl) {
                    var dNow = deckCount[pl] || 0;
                    dkEl.innerHTML = '<span class="rp-mid-count">' + dNow + '</span>'
                        + (dNow ? '<div class="rp-card rp-card-down"></div>' : '');
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

    // 场地操作辅助：field[c][loc:seq] = {code, faceDown, pos(原表示位), zone:(loc)…}
    // 卡从一处移到另一处时，用 prev 定位删除、插到 cur。
    var _uid = 1;

    function addCardAt(controller, loc, seq, code, down, posRaw) {
        if (!field[controller]) field[controller] = {};
        var key = loc + ':' + seq;
        // 若该位已有卡（同名序列可能复用），直接覆盖并记住旧引用移除
        field[controller][key] = {
            code: code,
            uid: _uid++,
            faceDown: !!down,
            pos: posRaw,
        };
    }

    function removeAt(controller, loc, seq) {
        if (field[controller]) {
            delete field[controller][loc + ':' + seq];
        }
    }

    function moveCard(prev, cur, code) {
        var pCon = prev.controller !== undefined ? prev.controller : 0;
        var pLoc = prev.location !== undefined ? (prev.location & 0xff) : undefined;
        var pSeq = prev.sequence !== undefined ? prev.sequence : 0;
        var cCon = cur.controller !== undefined ? cur.controller : pCon;
        var cLoc = cur.location !== undefined ? (cur.location & 0xff) : undefined;
        var cSeq = cur.sequence !== undefined ? cur.sequence : 0;
        var down = isFaceDown(cur.position);
        var posRaw = cur.position;

        // 找旧位置卡对象（若存在）
        var oldCard = null;
        if (pLoc !== undefined && field[pCon]) {
            oldCard = field[pCon][pLoc + ':' + pSeq] || null;
        }
        if (pLoc !== undefined) removeAt(pCon, pLoc, pSeq);

        if (cLoc !== undefined) {
            // 新位置插入：若原位有卡且 code 匹配，携带其 uid/原信息；否则新卡
            var useCode = code !== undefined ? code : (oldCard ? oldCard.code : 0);
            addCardAt(cCon, cLoc, cSeq, useCode, down, posRaw);
        }
    }

    function addToHand(controller, code) {
        var seq = 0;
        while (field[controller] && field[controller][LOC.HAND + ':' + seq]) seq++;
        addCardAt(controller, LOC.HAND, seq, code, false, 0);
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
                // 播放到 Start
                playNext();
                startAuto();
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
        if (playing) stopAuto(); else startAuto();
    });
    stepBtn.addEventListener('click', function () {
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
}
