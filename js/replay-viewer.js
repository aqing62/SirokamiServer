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

    // 卡图源（与站内一致：DIY 图 → 官方 CDN）
    var OCG_PIC = 'https://cdn.233.momobako.com/ygopro/pics/';
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

    // ── 场地渲染 ──
    function renderField() {
        // 上下两玩家区
        var html = '<div class="rp-player-zone">' + playerHtml(1) + '</div>'
            + '<div class="rp-middle">' + middleHtml() + '</div>'
            + '<div class="rp-player-zone">' + playerHtml(0) + '</div>';
        fieldEl.innerHTML = html;
    }

    function locCards(controller, loc) {
        // 收集该 controller 对应 loc 的所有卡（按 sequence 排序）
        var out = [];
        // 简化：从 field[controller] 取 loc:seq
        var pfx = loc + ':';
        Object.keys(field[controller]).forEach(function (k) {
            if (k.indexOf(pfx) === 0) out.push(field[controller][k]);
        });
        out.sort(function (a, b) { return a.seq - b.seq; });
        return out;
    }

    function cardImgHtml(card, small) {
        if (!card) return '<div class="rp-card rp-card-empty"></div>';
        var name = cardName(card.code);
        var img = cardImgSrc(card.code);
        var inner = '<img src="' + img + '" alt="' + (name || card.code) + '"'
            + ' onerror="this.onerror=null;this.src=\'' + OCG_PIC + card.code
            + '.jpg\';this.onerror=function(){this.onerror=null;this.src=\'cover.jpg\';}">';
        if (card.faceDown) {
            // 里侧：盖牌
            return '<div class="rp-card rp-card-down" title="盖牌"></div>';
        }
        return '<div class="rp-card" title="' + (name || card.code) + '">' + inner + '</div>';
    }

    function rowHtml(cards, loc) {
        if (!cards || !cards.length) {
            return '<div class="rp-row">'
                + '<span class="rp-loc-label">' + (LOC_NAME[loc] || loc) + '</span>'
                + '<span class="rp-row-empty">空</span></div>';
        }
        var cells = cards.map(cardImgHtml).join('');
        return '<div class="rp-row"><span class="rp-loc-label">' + (LOC_NAME[loc] || loc)
            + '</span><div class="rp-row-cards">' + cells + '</div></div>';
    }

    function playerHtml(controller) {
        var name = meta && meta.players
            ? (meta.players.find(function (p) { return p.pos === controller; }) || {}).realName || ''
            : ('玩家' + controller);
        var isTurn = turnPlayer === controller;
        return '<div class="rp-player' + (isTurn ? ' turn' : '') + '">'
            + '<div class="rp-player-head">'
            + '<span class="rp-player-name">' + escapeHtml(name || ('玩家' + (controller + 1)))
            + (isTurn ? ' ●' : '') + '</span>'
            + '<span class="rp-lp">LP ' + lp[controller] + '</span>'
            + '</div>'
            + '<div class="rp-sec-hand">' + rowHtml(locCards(controller, LOC.HAND), LOC.HAND) + '</div>'
            + '<div class="rp-sec-field">'
            + rowHtml(locCards(controller, LOC.MZONE), LOC.MZONE)
            + rowHtml(locCards(controller, LOC.SZONE), LOC.SZONE)
            + '</div>'
            + '<div class="rp-sec-grave">'
            + rowHtml(locCards(controller, LOC.GRAVE), LOC.GRAVE)
            + rowHtml(locCards(controller, LOC.REMOVED), LOC.REMOVED)
            + '</div>'
            + '</div>';
    }

    function middleHtml() {
        var p0deck = (field[0][LOC.DECK + ':0'] ? 1 : 0) + countLoc(0, LOC.DECK);
        var p1deck = countLoc(1, LOC.DECK);
        var p0extra = countLoc(0, LOC.EXTRA);
        var p1extra = countLoc(1, LOC.EXTRA);
        var phase = phaseText || '准备阶段';
        return '<div class="rp-middle-info">'
            + '<span class="rp-deck-info">P0 卡组' + countLoc(0, LOC.DECK) + ' 额外' + countLoc(0, LOC.EXTRA) + '</span>'
            + '<span class="rp-phase">' + escapeHtml(phase) + '</span>'
            + '<span class="rp-deck-info">额外' + countLoc(1, LOC.EXTRA) + ' 卡组' + countLoc(1, LOC.DECK) + ' P1</span>'
            + '</div>';
    }

    function countLoc(controller, loc) {
        var pfx = loc + ':';
        var n = 0;
        Object.keys(field[controller]).forEach(function (k) {
            if (k.indexOf(pfx) === 0) n++;
        });
        return n;
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
                log('🃏 对局开始（房间 ' + (meta.roomName || '') + '）');
                logHtml('VS <b>' + escapeHtml(playerName(0)) + '</b> 对战 <b>' + escapeHtml(playerName(1)) + '</b>');
                break;
            }
            case 'UpdateData': {
                // 建立手牌/额外/卡组初始状态：f.code 可能是一组，但简化按单条处理不足 → 需要靠 hex 或 query 重建
                // 雏形：UpdateData 难以精确重建，跳过渲染细节，只当推进标记
                break;
            }
            case 'Draw': {
                var pl = f.player;
                var cards = f.cards || [];
                log(playerName(pl) + ' 抽卡 ' + cards.length + ' 张' + (cards.length ? '：' + cards.map(cardName).join('、') : ''));
                cards.forEach(function (code) {
                    addToHand(pl, code);
                });
                break;
            }
            case 'NewTurn': {
                turnPlayer = f.player;
                phaseText = '回合开始';
                log('🔄 ' + playerName(turnPlayer) + ' 的回合');
                break;
            }
            case 'NewPhase': {
                // phase 值语义：0抽卡/1准备/2主要1/3战斗/4主要2/5结束
                var ph = f.phase;
                var names = ['抽卡阶段', '准备阶段', '主要阶段1', '战斗阶段', '主要阶段2', '结束阶段'];
                phaseText = names[ph] || ('阶段' + ph);
                log('— ' + phaseText + ' —', 'rp-log-phase');
                break;
            }
            case 'Move': {
                var code = f.code;
                var prev = f.previous || {};
                var cur = f.current || {};
                var reason = f.reason || 0;
                var name = cardName(code);
                // 简化：cur.location 为卡当前所处位置
                if (cur.location !== undefined) {
                    // 从旧位置移除
                    removeFromAll(code);
                    // 放新位置
                    var ploc = cur.location & 0xff; // 去掉高位标记
                    if (cur.location & 0x80000000) {
                        // 位置带 controller 位？YGOPro location 高字节是 controller
                        // 简化：cur.controller 如果给了就用，否则默认 0
                    }
                    addToLoc(cur.controller !== undefined ? cur.controller : 0, ploc, code, cur.sequence || 0, isFaceDown(cur.position));
                }
                // 日志（reason 简化）
                var why = reasonText(reason);
                var from = prev.location !== undefined ? (LOC_NAME[prev.location & 0xff] || '') : '';
                var to = cur.location !== undefined ? (LOC_NAME[cur.location & 0xff] || '') : '';
                if (to) log(name + '：' + (from ? from + ' → ' : '') + to + (why ? '（' + why + '）' : ''));
                break;
            }
            case 'Summoning': {
                var sc = f.code;
                var sname = cardName(sc);
                log('⚡ ' + playerName(f.controller !== undefined ? f.controller : 0) + ' 召唤 ' + sname);
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
                log('💥 ' + playerName(dpl) + ' 受到 ' + f.value + ' 点伤害（LP ' + lp[dpl] + '）', 'rp-log-damage');
                break;
            }
            case 'Recover': {
                var rpl = f.player;
                lp[rpl] = Math.min(8000, (lp[rpl] || 8000) + (f.value || 0));
                log('💚 ' + playerName(rpl) + ' 恢复 ' + f.value + ' LP');
                break;
            }
            case 'Win': {
                var wpl = f.player;
                log('🏆 ' + playerName(wpl) + ' 获胜！', 'rp-log-win');
                break;
            }
            case 'Hint': {
                // hint: 游戏提示，简要显示
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

    // 场地操作辅助
    function addToHand(controller, code) {
        // 找手牌空位
        var seq = 0;
        while (field[controller][LOC.HAND + ':' + seq]) seq++;
        field[controller][LOC.HAND + ':' + seq] = { code: code, controller: controller, loc: LOC.HAND, seq: seq, faceDown: false };
    }

    function addToLoc(controller, ploc, code, seq, down) {
        if (!field[controller]) field[controller] = {};
        field[controller][ploc + ':' + seq] = { code: code, controller: controller, loc: ploc, seq: seq, faceDown: down };
    }

    function removeFromAll(code) {
        [0, 1].forEach(function (c) {
            var keys = Object.keys(field[c]);
            keys.forEach(function (k) {
                if (field[c][k].code === code) delete field[c][k];
            });
        });
    }

    function isFaceDown(pos) {
        if (pos === undefined) return false;
        return (pos & 0x8) !== 0 || (pos & 0x2) !== 0; // FACEDOWN_DEFENSE=8 FACEDOWN_ATTACK=2
    }

    function reasonText(r) {
        if (!r) return '';
        // 常见 reason 简化（完整掩码复杂，先常用）
        if (r === 0x1) return '规则';       // 实际上 reason=1 是 SPSUMMON? 简化占位
        return '';
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    // ── 播放推进 ──
    function playNext() {
        if (idx < messages.length - 1) {
            idx++;
            handleMessage(messages[idx]);
            renderField();
            updateProgress();
            return true;
        }
        return false;
    }

    function playStepBack() {
        // 雏形不支持回退（状态难回滚），提示
        log('⚠️ 雏形暂不支持回退，请用进度条重播', 'rp-log-hint');
    }

    function startAuto() {
        stopAuto();
        playing = true;
        playPauseBtn.textContent = '⏸ 暂停';
        var interval = Math.max(100, Math.floor(600 / speed));
        timer = setInterval(function () {
            if (!playNext()) {
                stopAuto();
                log('✅ 回放结束', 'rp-log-win');
            }
        }, interval);
    }

    function stopAuto() {
        playing = false;
        if (timer) { clearInterval(timer); timer = 0; }
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
        playNext();
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
        renderField();
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
