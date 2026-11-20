/* 本文件由 make-viewer-live.mjs 从官网回放查看器生成，请勿手工编辑。
 * 来源: D:\YGO\Server\SirokamiServer\js\replay-viewer.js
 * 已应用补丁: liveMode 标志 / startAuto 追平等待 / 手牌屏蔽显示为盖牌 / 手牌移出按 seq 精确删 + 补位 / 回手按 seq 插位（并把后面往后挪） / UpdateData 整区重建（重连快照用） / 卡面左上角标等级 L*（调整怪黄色） / 卡离开格位时清掉该格攻守缓存（同卡号再次出场不能沿用旧个体的数值） / 补位工具函数 / cardMetaMap 带 attribute（属性角标用） / 实时接口注入
 * 生成时间: 2026-10-15T21:05:20.969Z
 */
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

    // 动作音效：快进/拖动/重放批量处理时 animSuppress=true，不播，避免一串杂音
    function duelSfx(name) {
        try {
            if (!animSuppress && window.__duelSfx) window.__duelSfx.play(name);
        } catch (e) {}
    }
    LOC_NAME[LOC.FZONE] = '场地'; LOC_NAME[LOC.PZONE] = '灵摆';

    // 阶段（ocgcore phase 位标记值 → 中文）
    var PHASE_NAMES = {
        1: '抽卡', 2: '准备', 4: '主一',
        8: '战阶', 16: '战步', 32: '伤判',
        64: '伤算', 128: '战阶',
        256: '主二', 512: '结阶',
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
    var speed = 4;   // 默认 4×（和 replay.html 一致）
    var timer = 0;
    var loaded = false;
    var liveMode = false;      // PATCH: 实时模式（消息来自 WebSocket 而非回放 API）

    // 场地状态模型（只维护回放需要的抽象位置）
    // 简化：主控双方各一张表，键 "loc:seq"，值 {code, controller, loc, seq, faceDown}
    var field = {
        0: {}, 1: {},          // controller → 该玩家视角下的区（其实 loc 带 controller，这里简化按 controller 存储）
    };
    var lp = [8000, 8000];
    var lpShown = [8000, 8000];          // 屏幕上正在滚动的血量（动画用）
    var lpAnimTimer = [null, null];      // 每个玩家的滚动定时器

    /** 选一个"好看"的步长：总值越大，每步跳得越多；保证 1 秒内跑完 */
    function pickLpStep(diff) {
        var a = Math.abs(diff);
        var steps = [1, 5, 10, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
        for (var i = 0; i < steps.length; i++) {
            if (a / steps[i] <= 30) return steps[i];
        }
        return Math.ceil(a / 30);
    }

    /** 血量动画：固定 1 秒，按步长滚动（例：8000 → 6000 每步 -10 左右） */
    function setLp(controller, target, instant) {
        controller = controller | 0;
        if (controller !== 0 && controller !== 1) return;
        target = Math.max(0, target | 0);
        lp[controller] = target;
        if (instant || lpAnimTimer[controller]) {
            if (lpAnimTimer[controller]) { clearInterval(lpAnimTimer[controller]); lpAnimTimer[controller] = null; }
        }
        var from = (typeof lpShown[controller] === 'number') ? lpShown[controller] : target;
        if (instant || from === target) {
            lpShown[controller] = target;
            renderPlayerHead(controller);
            return;
        }
        var diff = target - from;
        duelSfx('hpChange');
        var step = pickLpStep(diff);
        var ticks = Math.max(1, Math.min(60, Math.round(Math.abs(diff) / step)));
        step = Math.abs(diff) / ticks;              // 均分，最后一帧精确落到目标
        var sign = diff > 0 ? 1 : -1;
        var i = 0;
        var cur = from;
        var interval = 1000 / ticks;
        if (interval < 16) interval = 16;
        lpAnimTimer[controller] = setInterval(function () {
            i++;
            cur = from + sign * step * i;
            if (i >= ticks) {
                clearInterval(lpAnimTimer[controller]);
                lpAnimTimer[controller] = null;
                lpShown[controller] = target;
                duelSfx('hpDone');
            } else {
                lpShown[controller] = (sign > 0) ? Math.min(target, Math.round(cur)) : Math.max(target, Math.round(cur));
            }
            renderPlayerHead(controller);
        }, interval);
    }
    var turnPlayer = 0;
    var turnCount = 0;        // 当前回合数（每次 NewTurn +1）
    var phaseText = '';
    var deckCount = [null, null];  // 剩余卡组张数（null = 未知，不要当成 0）
    var extraCount = [null, null];
    var deckTopCode = [null, null];  // DeckTop 公开的卡组顶卡号（天变地异等）
    var graveCountOverride = [null, null]; // SwapGraveDeck 后的墓地张数（卡号未知）
    var deckReversed = [false, false];     // ReverseDeck 后卡组上下翻转
    var countSource = 'init';
    var countTrace = [];
    function markCountSource(src) {
        try {
            countSource = src || 'unknown';
            countTrace.push({
                src: countSource, deck: deckCount.slice(), extra: extraCount.slice(),
                myDuelPos: myDuelPos, metaSwap: metaSwap, at: Date.now()
            });
            if (countTrace.length > 40) countTrace.shift();
        } catch (e) {}
    }
    // ── 牌堆张数的唯一写入通道 ────────────────────────────────────────────
    //  PATCH(白神服) 2026-11-19：根治「卡组/额外张数反复变动」。
    //  原来有六路各自直写 deckCount/extraCount：MSG_START(解码/hex/meta 三条)、
    //  UpdateData 兜底、Move/Draw 增减、localStorage 快照；而且 `(x||0)±1` 会把
    //  “未知”变成 0 或 1 —— 同一局里数字就来回跳。
    //  现在只允许两种写入口：
    //    ① setPileAbs  写绝对值，按来源优先级（snapshot < meta < start < deckcount < reload）
    //    ② bumpPile    写增减量，值未知时直接跳过（保持 null）
    var PILE_PRI = { snapshot: 0, meta: 1, start: 2, deckcount: 3, reload: 4 };
    var pilePri = { deck: [-1, -1], extra: [-1, -1] };
    function pileArr(which) { return which === 'extra' ? extraCount : deckCount; }
    function resetPilePriority() { pilePri.deck = [-1, -1]; pilePri.extra = [-1, -1]; }
    function setPileAbs(seat, which, val, src) {
        try {
            if (seat !== 0 && seat !== 1) return false;
            if (val === null || val === undefined || val === '') return false;
            var n = Number(val);
            if (!isFinite(n)) return false;
            n = Math.max(0, Math.min(120, Math.round(n)));
            var pri = (PILE_PRI[src] === undefined) ? 0 : PILE_PRI[src];
            if (pri < pilePri[which][seat]) return false;      // 低优先级来源不许覆盖
            pilePri[which][seat] = pri;
            pileArr(which)[seat] = n;
            try { updatePiles(); } catch (e) {}
            return true;
        } catch (e) { return false; }
    }
    function bumpPile(seat, which, delta, src) {
        try {
            if (seat !== 0 && seat !== 1) return false;
            var arr = pileArr(which), cur = arr[seat];
            if (cur === null || cur === undefined) return false;   // 未知保持未知
            arr[seat] = Math.max(0, cur + delta);
            return true;
        } catch (e) { return false; }
    }
    var handCountAtStart = [0, 0];   // PATCH(白神服): 开局手卡数（对手手卡只给数量，卡面是背面） // 额外卡组张数（开局按 UpdateData(64) 列表，出场/回收增减）
    var inBattle = false;        // 是否处于伤害步骤（战斗消息上下文）
    var animSuppress = false;
    var bulkApplyActive = false;   // 批量应用消息时只更新状态、不渲染（观战同步用）    // 进度条大跳等批量处理时关闭动画
    var preloading = false;      // 卡图预加载中
    var pendingMats = {};        // 额外卡组超量：召唤前先叠放的素材 "ctl:extraSeq" → {count, rects}
    var lastLand = null;         // 最近一次怪兽落地 {code, fromExtra, idx, ctl, seq, rawLoc}
    var pendingImpact = null;    // 攻击命中后等待"真正破坏"以同步爆炸+破碎 {code, rect, defCtl, done}
    var lastPayLp = null;        // 最近一次支付 LP 的位置（避免 LpUpdate 重复飘字）

    // 卡池索引（卡名/卡片种类查询，可选加载 /api/cards）
    var cardNameMap = {};
    var cardMetaMap = {};   // id → { cat, subs, level } 用于识别召唤种类
    var cardNameLoaded = false;
    function loadCardNames() {
        if (cardNameLoaded) return Promise.resolve();
        cardNameLoaded = true;
        return fetch('/api/cards?t=' + Date.now())
            .then(function (r) { return r.json(); })
            .then(function (cards) {
                cards.forEach(function (c) {
                    var id = String(c.id);
                    cardNameMap[id] = c.name || '';
                    var ti = c.typeInfo || {};
                    cardMetaMap[id] = {
                        attribute: c.attribute || 0,   // PATCH: 属性位（1地 2水 4炎 8风 16光 32暗 64神）
                        cat: ti.monsterCategory || '',
                        subs: ti.subTypes || [],
                        level: c.level || 0,
                        atk: typeof c.atk === 'number' ? c.atk : undefined,
                        def: typeof c.def === 'number' ? c.def : undefined,
                    };
                });
            })
            .catch(function () {});
    }
    function cardName(code) {
        return cardNameMap[String(code)] || '';
    }
    // 召唤种类：fusion / synchro / xyz / link / pendulum / ritual / null
    function summonTypeOf(code) {
        var m = cardMetaMap[String(code)];
        if (!m) return null;
        var cat = m.cat || '';
        var subs = m.subs || [];
        if (cat.indexOf('连接') >= 0 || subs.indexOf('连接') >= 0) return 'link';
        if (cat.indexOf('超量') >= 0 || subs.indexOf('超量') >= 0) return 'xyz';
        if (cat.indexOf('同调') >= 0 || subs.indexOf('同调') >= 0) return 'synchro';
        if (cat.indexOf('融合') >= 0 || subs.indexOf('融合') >= 0) return 'fusion';
        if (cat.indexOf('灵摆') >= 0 || subs.indexOf('灵摆') >= 0) return 'pendulum';
        if (cat.indexOf('仪式') >= 0 || subs.indexOf('仪式') >= 0) return 'ritual';
        return null;
    }
    function cardLevel(code) {
        var m = cardMetaMap[String(code)];
        return (m && m.level) || 0;
    }
    // PATCH(白神服) 2026-11-06: 卡号必须是**数字**。某些消息里 code 字段会是解析器对象
    //   （{flags, queryLength, empty:true}）→ 拼出来是 ".../pics/[object Object].jpg" 加载失败 →
    //   表现就是「对方后场的盖卡看不见 / 场上某些卡是空白」（用户实测 ✗）。
    function toCode(v) {
        try {
            if (typeof v === 'number') return (isFinite(v) && v > 0) ? v : 0;
            if (!v || typeof v !== 'object') {
                var n0 = Number(v);
                return (isFinite(n0) && n0 > 0) ? n0 : 0;
            }
            if (typeof v.value === 'number') return v.value > 0 ? v.value : 0;
            if (typeof v.code === 'number') return v.code > 0 ? v.code : 0;
            if (typeof v.toNumber === 'function') { var n1 = Number(v.toNumber()); return (isFinite(n1) && n1 > 0) ? n1 : 0; }
            if (typeof v.readInt32LE === 'function' || typeof v.getInt32 === 'function') return 0;
            return 0;
        } catch (e) { return 0; }
    }

    function cardImgSrc(code) {
        var _c = toCode(code);
        if (!_c) return 'cover2.jpg?v=20261108a';      // 卡号无效 → 用卡背，绝不拼出 [object Object]
        return DIY_PIC + _c + '.jpg';
    }

    // ── 日志（右侧，每步插到底部并自动滚下）──
    // siro-log-follow：自动跟到底部，但**用户往上翻看时不打扰**
    //   离底部超过 60px 就不自动跟（否则想回头看旧日志会被一直拽回底部）
    //   回放页的日志框靠 CSS 撑出固定高度才滚得动（replay.html 的 siro-log-scroll）
    function keepLogBottom() {
        try {
            if (!logBody) return;
            var gap = logBody.scrollHeight - logBody.scrollTop - logBody.clientHeight;
            if (gap < 60) logBody.scrollTop = logBody.scrollHeight;
        } catch (e) {}
    }
    function escHtml(x) {
        return String(x === undefined || x === null ? '' : x)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function log(line, cls) {
        var div = document.createElement('div');
        div.className = 'rp-log-line' + (cls ? ' ' + cls : '');
        div.textContent = line;
        logBody.appendChild(div);
        // 保留最近 500 条
        while (logBody.children.length > 500) logBody.removeChild(logBody.firstChild);
        keepLogBottom();
    }

    // ── 卡片式日志（参考 MDPro3/Master Duel 的决斗日志）─────────────
    //   一条 = 左侧归属色条 + 卡图缩略 + 动作词 + 卡名 + 位置变迁小标签
    //   点击卡图 → 右侧放大展示（复用 showCardShowcase）
    // 注意：这些值必须和 YGOPro 的 LOCATION_* 常量一致 ——
    //   DECK=1 HAND=2 MZONE=4 SZONE=8 GRAVE=16 REMOVED=32 EXTRA=64 OVERLAY=128
    //   （之前抄错成 1=手 2=怪兽 4=魔陷 8=墓…，于是「手牌 → 墓地」显示成「怪兽 → 墓」✗）
    var LOC_CHIP = {
        0x01: '卡组', 0x02: '手牌', 0x04: '怪兽', 0x08: '魔陷', 0x10: '墓地',
        0x20: '除外', 0x40: '额外', 0x80: '素材', 0x100: '场', 0x200: '摆'
    };
    function locChip(loc) {
        if (loc === undefined || loc === null) return '';
        var plain = (loc & 0x7f);
        if (loc & 0x80) return '素材';
        return LOC_CHIP[plain] || '';
    }

    // 宣言种族/属性：MSG_ANNOUNCE_RACE / MSG_ANNOUNCE_ATTRIB
    var RACE_NAMES = {
        1: '战士', 2: '魔法师', 4: '天使', 8: '恶魔', 16: '不死', 32: '机械',
        64: '水', 128: '炎', 256: '雷', 512: '风', 1024: '地', 2048: '昆虫',
        4096: '恐龙', 8192: '龙', 16384: '兽', 32768: '兽战士', 65536: '植物',
        131072: '念动力', 262144: '幻龙', 524288: '电子界', 1048576: '幻想魔'
    };
    var ATTR_NAMES = { 1: '地', 2: '水', 4: '炎', 8: '风', 16: '光', 32: '暗', 64: '神' };
    var CARD_HINT_NAMES = {
        500: '解放', 501: '加入手牌', 502: '回到卡组', 503: '除外', 504: '丢弃',
        505: '回到手牌', 506: '送去墓地', 507: '破坏', 508: '当作祭品', 509: '特殊召唤',
        510: '盖放', 511: '融合素材', 512: '同调素材', 513: '超量素材', 514: '表侧表示',
        515: '里侧表示', 516: '攻击表示', 517: '守备表示', 518: '装备', 519: '取除素材',
        520: '回到额外卡组', 521: '变成里侧', 522: '表侧攻击', 523: '表侧守备',
        524: '里侧攻击', 525: '里侧守备', 526: '选择位置', 527: '选择卡'
    };
    function maskNames(mask, map) {
        var out = [];
        Object.keys(map).forEach(function (bit) {
            if (Number(mask) & Number(bit)) out.push(map[bit]);
        });
        return out.join('、');
    }
    function logCardRow(o) {
        try {
            var mine = (o.ctl === myDuelPos) || (myDuelPos === null && o.ctl === 0);
            var side = (o.ctl === 0 || o.ctl === 1) ? (o.ctl === 0 ? 'side-a' : 'side-b') : '';
            var row = document.createElement('div');
            row.className = 'rp-lrow' + (o.indent ? ' indent' : '') + (o.chain ? ' chain' : '') + (side ? ' ' + side : '');
            var html = '<span class="rp-lbar"></span>';
            if (o.code) {
                // PATCH(白神服) 2026-11-17: 卡号未知/加载失败 → 显示卡背（用户要求）
                html += '<img class="rp-lthumb" src="' + (typeof PIC_THUMB === 'function' ? PIC_THUMB(o.code, 60)
                    : ('/thumbcard/' + o.code + '.jpg?w=60&v=20261118d')) + '" data-code="' + o.code + '" alt="" '
                    + 'onerror="this.onerror=null;this.src=window.__liveCardBack">';
            } else {
                html += '<img class="rp-lthumb" src="' + CARD_BACK_URI + '" alt="">';
            }
            html += '<span class="rp-lmain">';
            if (o.badge) html += '<span class="rp-lchain">' + o.badge + '</span>';
            if (o.action) html += '<span class="rp-laction">' + o.action + '</span>';
            if (o.name) html += '<span class="rp-lname">' + escHtml(o.name) + '</span>';
            var f1 = locChip(o.from), f2 = locChip(o.to);
            if (f1 || f2) {
                html += '<span class="rp-lflow">';
                if (f1) html += '<b>' + f1 + '</b>';
                if (f1 && f2) html += '<i>▶</i>';
                if (f2) html += '<b>' + f2 + '</b>';
                html += '</span>';
            }
            if (o.note) html += '<span class="rp-lnote">' + escHtml(o.note) + '</span>';
            html += '</span>';
            row.innerHTML = html;
            var th = row.querySelector('.rp-lthumb[data-code]');
            if (th) {
                th.style.cursor = 'zoom-in';
                th.onclick = function () { try { showCardShowcase(Number(th.getAttribute('data-code')), '日志'); } catch (e) {} };
            }
            logBody.appendChild(row);
            while (logBody.children.length > 500) logBody.removeChild(logBody.firstChild);
            keepLogBottom();
            return row;                       // PATCH(白神服) 2026-11-17: 返回行元素，供连锁状态回填
        } catch (e) {
            try { log((o.action || '') + (o.name || '')); } catch (e2) {}
        }
        return null;
    }

    // ── 连锁状态回填（抄 MDPro3 DuelLog 的 chainSolving / ChainSolved 归属）──
    //   MDPro3 把「发动 → 无效 / 处理」挂在**同一条连锁**上；我们原来是三行散日志。
    var chainRowByNum = {};      // 连锁号 → 日志行元素
    var battleRow = null;        // 当前这次攻击的日志行（战斗四段状态回填用）
    /** 给任意日志行追加/更新状态小标（MDPro3：一个动作的各阶段挂在同一条记录上） */
    function setRowState(row, text, kind) {
        try {
            if (!row || !row.parentNode) return;
            var old = row.querySelector('.rp-lchain-state');
            if (old) old.parentNode.removeChild(old);
            var main = row.querySelector('.rp-lmain') || row;
            var sp = document.createElement('span');
            sp.className = 'rp-lchain-state rp-lcs-' + (kind || 'ok');
            sp.textContent = text;
            main.appendChild(sp);
            keepLogBottom();
        } catch (e) {}
    }
    function setChainState(num, text, kind) {
        try {
            if (!num || !chainRowByNum[num]) return;
            setRowState(chainRowByNum[num], text, kind);
        } catch (e) {}
    }
    function chainNumNow() {
        try { return (chainStack && chainStack.length) ? chainStack.length : 1; } catch (e) { return 1; }
    }

    // 抽卡条目（参考 MDPro3 的 AddOpeningDrawMessageToLog：一次列出抽到的卡）
    //   能看到的场合（回放/自己抽）显示卡图，看不到的（观战对手抽卡）显示卡背
    function logDrawRow(ctl, codes, count) {
        try {
            var arr = (codes || []).slice(0, 8);
            var n = count || arr.length || 0;
            // PATCH(白神服) 2026-11-19: 查看器内部已经是「视角座位」（0=下方/我），
            //   不再有 myDuelPos 概念（那是双翻转的来源）。所以"是不是我抽的" = ctl === 0。
            var mine = (ctl === 0);
            // 自己的抽卡一定有卡号（自己看得到）；观战/对手通常 arr 为空，画卡背。
            var canSee = arr.length > 0 && (replayMode || ctl === 0 || !window.__ypWatchMode);
            var row = document.createElement('div');
            row.className = 'rp-lrow side-' + (ctl === 0 ? 'a' : 'b');
            var html = '<span class="rp-lbar"></span>';
            if (canSee && arr.length) {
                html += '<span class="rp-lthumbs">';
                arr.forEach(function (c) {
                    html += '<img class="rp-lthumb" src="' + (typeof PIC_THUMB === 'function' ? PIC_THUMB(c, 60)
                        : ('/thumbcard/' + c + '.jpg?w=60&v=20261118d')) + '" data-code="' + c + '" alt="">';
                });
                html += '</span>';
            } else {
                // PATCH(白神服) 2026-11-17: 看不到卡号时（观战/对手）画**真实的卡背图**，
                //   原来用 .rp-lthumb.back 只画一个空框，看着像"没有卡"（用户实测 ✗）
                html += '<span class="rp-lthumbs">';
                for (var i = 0; i < Math.min(5, n || 1); i++) {
                    html += '<img class="rp-lthumb" src="' + CARD_BACK_URI + '" alt="">';
                }
                if (n > 5) html += '<span class="rp-lmore">+' + (n - 5) + '</span>';
                html += '</span>';
            }
            html += '<span class="rp-lmain"><span class="rp-laction">抽卡</span>'
                + '<span class="rp-lnote">' + (n || 0) + ' 张</span>';
            if (canSee && arr.length) {
                html += '<span class="rp-lnames">' + arr.map(function (c) { return escHtml(cardName(c)); }).join('、') + '</span>';
            }
            html += '</span>';
            row.innerHTML = html;
            row.querySelectorAll('img[data-code]').forEach(function (th) {
                th.style.cursor = 'zoom-in';
                th.onclick = function () { try { showCardShowcase(Number(th.getAttribute('data-code')), '抽卡'); } catch (e) {} };
            });
            logBody.appendChild(row);
            while (logBody.children.length > 500) logBody.removeChild(logBody.firstChild);
            keepLogBottom();
        } catch (e) {
            try { log(playerName(ctl) + ' 抽卡 ' + (count || 0) + ' 张'); } catch (e2) {}
        }
    }

    function logHtml(html) {
        var div = document.createElement('div');
        div.className = 'rp-log-line';
        div.innerHTML = html;
        logBody.appendChild(div);
        while (logBody.children.length > 500) logBody.removeChild(logBody.firstChild);
        keepLogBottom();
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
    // zoom 会参与布局（transform: scale 不会），用 zoom 才能让场地框高度贴合实际画面、不出现上下空白
    var ZOOM_OK = (function () {
        try { return !!(window.CSS && CSS.supports && CSS.supports('zoom', '0.5')); } catch (e) { return false; }
    })();

    function fitBoard() {
        if (!boardEl || !fieldEl.clientWidth) return;
        var availW = fieldEl.clientWidth - 12;
        var availH = fieldEl.clientHeight - 12;
        try { if (fieldEl.classList.contains('tilt3d')) availH = Math.round(availH * 1.55); } catch (e) {}
        var bw = boardEl.scrollWidth || boardEl.offsetWidth;
        var bh = boardEl.scrollHeight || boardEl.offsetHeight;
        if (!bw || !bh) return;
        // PATCH(白神服) 2026-11-06: 原来只允许缩小（Math.min(1, …)），手机横屏场地两侧/上下大片黑边，
        //   手牌也被压得很小（用户实测）。横屏手机允许放大到 1.8 倍把空间用满。
        // PATCH(白神服) 2026-11-07: 横屏手机（Safari）里 CSS zoom 的布局高度不减，
        //   场地容器 overflow 又把上下裁掉 → 玩家看到的画面「上下场地被框遮住、显示不全」（用户实测 ✗）。
        //   改为按可用高度**直接算格子尺寸**（不靠缩放），保证整块棋盘正好放得下。
        try {
            var _short = window.matchMedia && window.matchMedia('(orientation: landscape) and (max-height: 760px)').matches;
            if (_short && availH > 120) {
                // 竖向预算：4 行格子 + 中线 1 行 + 双手牌
                var _handH = Math.max(28, Math.round(availH * 0.13));
                var _cellH = Math.max(34, Math.floor((availH - 2 * _handH - 24) / 5));
                // 排行榜/资料卡弹窗：只把盘面内场地缩到 78px 格（默认 86），
                // 外层弹窗/回放框不动。
                try {
                    if (/[?&]embed=1(?:&|$)/.test(location.search)) {
                        _cellH = Math.min(_cellH, 84);
                        _handH = Math.min(_handH, 70);
                    }
                } catch (e) {}
                var _cellW = _cellH;      // 正方形格子（横置卡片不再被压小）
                fieldEl.style.setProperty('--yp-cell-h', _cellH + 'px');
                fieldEl.style.setProperty('--yp-cell-w', _cellW + 'px');
                fieldEl.style.setProperty('--yp-hand-h', _handH + 'px');
                boardEl.style.zoom = '';
                boardEl.style.transform = '';
                // 上面只是按预算改格子；行距/手牌/中线加起来仍可能超出，
                // 布局稳定后再按实际高度兜底缩一次，避免手机横屏上下被裁。
                setTimeout(function () {
                    try {
                        if (!boardEl) return;
                        var _bh = boardEl.scrollHeight || boardEl.offsetHeight;
                        var _bw = boardEl.scrollWidth || boardEl.offsetWidth;
                        var _ah = fieldEl.clientHeight - 8;
                        var _aw = fieldEl.clientWidth - 8;
                        if (!_bh || !_bw) return;
                        var _fit = Math.min(1, _ah / _bh, _aw / _bw);
                        if (_fit < 0.98) {
                            if (ZOOM_OK) boardEl.style.zoom = String(_fit);
                            else boardEl.style.transform = 'scale(' + _fit + ')';
                        }
                    } catch (e) {}
                }, 0);
                return;
            }
        } catch (e) {}

        var _kMax = 1;
        try {
            if (window.matchMedia && window.matchMedia('(orientation: landscape) and (max-height: 700px)').matches) _kMax = 1.8;
            else if (window.innerWidth <= 1024) _kMax = 1.25;
        } catch (e) {}
        var k = Math.min(_kMax, availW / bw, availH / bh);
        if (ZOOM_OK) {
            boardEl.style.zoom = k !== 1 ? String(k) : '';
            boardEl.style.transform = '';
        } else {
            boardEl.style.transform = k < 1 ? 'scale(' + k + ')' : '';
        }
        // PATCH(白神服) 2026-11-08: 立体视角（rotateX）会改变视觉占用，按 zoom 算出的 k
        //   不一定正好塞进容器 → 手机横屏会出现"场地太大看不全"（用户实测 ✗）。
        //   这里量一次实际矩形，超出就逐步缩小，直到装得下（最多 6 次）。
        try {
            var _kk = k;
            for (var _it = 0; _it < 6; _it++) {
                var _br = boardEl.getBoundingClientRect(), _fr = fieldEl.getBoundingClientRect();
                if (!_br.width || !_fr.width) break;
                var _over = Math.max(_br.bottom - _fr.bottom, _br.right - _fr.right);
                if (_over <= 2) break;
                _kk *= 0.92;
                if (ZOOM_OK) boardEl.style.zoom = String(_kk);
                else boardEl.style.transform = 'scale(' + _kk + ')';
            }
        } catch (e) {}
    }

    function createFieldDOM() {
        // 上=对手(P1)，下=自己(P0)
        // 行 = [外轨][5格][外轨]：对手的牌堆凸在左外轨、自己凸在右外轨，对侧外轨留空，
        //     因此双方 5 格怪兽/魔陷列上下对齐（对称）。
        // 中线行：除外P1(左外轨) | 额外区P1 | 回合/阶段 | 额外区P0 | 除外P0(右外轨)
        // PATCH(白神服) 2026-11-07: 3D 立体场地 —— 外面套一层透视容器，
        //   棋盘用 rotateX 倾斜（桌面/横屏默认开启，?flat=1 或窄屏自动关）。
        var html =
            '<div class="rp-scene"><div class="rp-board">'
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
            + '</div></div>';
        fieldEl.innerHTML = html;
        try { if (window.__frApi && window.__frApi.reset) window.__frApi.reset(); } catch (e) {}
        boardEl = fieldEl.querySelector('.rp-board');
        try {
            var _q3 = new URLSearchParams(location.search);
            var _flat = _q3.get('flat') === '1';
            var _wide = window.innerWidth >= 900 && window.innerHeight >= 480;
            fieldEl.classList.toggle('tilt3d', !_flat && _wide);
        } catch (e) {}
        // PATCH(白神服) 2026-11-05: 名签/LP 移到**独立图层**（贴场地容器的四个角），
        //   不再放在 .rp-side 里 —— 否则手牌一多/手牌变高就把它们顶出视口（用户要求"治本"）。
        (function () {
            var layer = document.createElement('div');
            layer.className = 'rp-nametag-layer';
            Array.prototype.slice.call(fieldEl.querySelectorAll('.rp-nametag')).forEach(function (t) {
                layer.appendChild(t);
            });
            fieldEl.appendChild(layer);
        })();

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

        function zoneRow(loc, count, mirrored) {
            // 对手半场镜像：与游戏客户端一致（对手的 zone 4 显示在最左，zone 0 在最右），
            // 这样"对手在自己视角最左边放的怪"在观战者画面里出现在右边，与客户端一致
            var cells = '';
            var order = [];
            for (var i = 0; i < count; i++) order.push(i);
            if (mirrored) order.reverse();
            for (var k = 0; k < order.length; k++) {
                cells += '<div class="rp-cell" data-zone="' + controller + ':' + loc + ':' + order[k] + '"></div>';
            }
            return cells;
        }
        var mzone = zoneRow(LOC.MZONE, 5, isOpp);
        var szone = zoneRow(LOC.SZONE, 5, isOpp);
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

    // 中间回合标签：回合方 + 回合数（如 自己回合3）
    function renderTurnLabel() {
        if (bulkApplyActive) return;
        if (!turnLabelEl) return;
        var who = turnPlayer === 0 ? '自己' : '对方';
        turnLabelEl.textContent = turnCount ? who + '回合' + turnCount : who + '回合';
    }

    function renderPlayerHead(controller) {
        if (bulkApplyActive) return;
        var p = playerByDuelPos(controller);
        var name = p ? (p.realName || p.name || '') : '';
        var pEl = playerNameEls[controller];
        if (pEl) pEl.textContent = name || ('玩家' + (controller + 1));
        var _showLp = (typeof lpShown !== 'undefined' && typeof lpShown[controller] === 'number') ? lpShown[controller] : lp[controller];
        if (lpEls[controller]) lpEls[controller].textContent = 'LP ' + _showLp;
    }

    function releaseStaleHolds() {
        try {
            Array.prototype.forEach.call(fieldEl.querySelectorAll('.rp-cell'), function (c) {
                if (c._fxHold && (!c._fxHoldAt || Date.now() - c._fxHoldAt > 1200)) fxReleaseCell(c);
            });
        } catch (e) {}
    }

    // ══════════ 协议补充：指示物 / 连锁序号 / 掷币掷骰 ══════════
    //   PATCH(白神服) 2026-11-15: 参照 YGOPro3 客户端的消息覆盖度，补齐回放里丢信息的消息
    var cellCounters = {};       // 'ctl:loc:seq' -> { code, map: {ctype: count} }
    var equipLinks = [];         // MSG_EQUIP: {equip:{ctl,loc,seq}, target:{ctl,loc,seq}}
    var disabledFieldMask = 0;   // MSG_FIELD_DISABLED：被封锁的怪兽/魔陷区
    var cardTargets = [];        // MSG_CARD_TARGET: {source, target} 对象标记
    var cellChain = {};          // 'ctl:loc:seq' -> 连锁序号
    var chainStack = [];

    function cellKeyOf(ctl, loc, seq) { return ctl + ':' + (loc | 0) + ':' + (seq | 0); }

    function counterSigOf(statKey) {
        var rec = cellCounters[statKey];
        if (!rec || !rec.map) return '';
        return Object.keys(rec.map).sort().map(function (k) { return k + 'x' + rec.map[k]; }).join(',');
    }

    function counterTotalOf(statKey) {
        var rec = cellCounters[statKey];
        if (!rec || !rec.map) return 0;
        var n = 0;
        Object.keys(rec.map).forEach(function (k) { n += rec.map[k]; });
        return n;
    }

    // 给某个格位闪一下（成为对象 / 连锁被无效）
    function leafFlash(key, color, ms) {
        try {
            if (!key) return;
            var p = String(key).split(':');
            if (p.length < 3) return;
            var cell = cellElFor(Number(p[0]), Number(p[1]), Number(p[2]));
            if (!cell) return;
            cell.style.transition = 'box-shadow .15s ease';
            cell.style.boxShadow = '0 0 14px 3px ' + (color || '#ff4a4a');
            setTimeout(function () { cell.style.boxShadow = ''; }, ms || 420);
        } catch (e) {}
    }

    function refreshCell(ctl, loc, seq) {
        try {
            var cell = cellElFor(ctl, loc, seq);
            if (cell) { cell._statSig = ''; cell._code = null; }
            if (typeof updateZone === 'function') updateZone(ctl, loc);
            if (((loc | 0) & 0x7f) === LOC.MZONE && (seq | 0) >= 5) refreshEmz();
        } catch (e) {}
    }

    function addCounterTo(ctl, loc, seq, code, ctype, cnt, remove) {
        var key = cellKeyOf(ctl, loc, seq);
        // MSG_ADD_COUNTER 没有可靠 code（经常为 0）；用目标格当前卡号补上，
        // 否则 refreshCell 会把它判成“换了卡”并立刻删掉整个 counter。
        if (!code) {
            try {
                var _cc = field[ctl] && field[ctl][(loc & 0x7f) + ':' + seq];
                if (_cc) code = toCode(_cc.code || _cc.knownCode || 0);
            } catch (e) {}
        }
        var rec = cellCounters[key];
        if (!rec || rec.code !== code) rec = cellCounters[key] = { code: code, map: {} };
        var cur = rec.map[ctype] || 0;
        cur = remove ? Math.max(0, cur - (cnt || 1)) : cur + (cnt || 1);
        if (cur > 0) rec.map[ctype] = cur; else delete rec.map[ctype];
        if (!Object.keys(rec.map).length) delete cellCounters[key];
        refreshCell(ctl, loc, seq);
        if (!remove) counterMountFx(ctl, loc, seq, Math.min(3, cnt || 1));
        else counterRemoveFx(ctl, loc, seq, Math.min(3, cnt || 1));
    }

    // 指示物被取除：从卡飞回场地中央，避免角标是“瞬间消失”
    function counterRemoveFx(ctl, loc, seq, n) {
        try {
            var cell = cellElFor(ctl, loc, seq);
            var tr = cell && cell.getBoundingClientRect();
            if (!tr || !tr.width) return;
            var pane = fieldEl.getBoundingClientRect();
            var tx = pane.left + pane.width / 2, ty = pane.top + pane.height * 0.44;
            for (var i = 0; i < Math.max(1, n); i++) {
                var el = document.createElement('div');
                el.className = 'rp-counter-fly rp-counter-out';
                el.textContent = '−';
                el.style.left = (tr.left + tr.width / 2 - 10) + 'px';
                el.style.top = (tr.top + tr.height / 2 - 10) + 'px';
                document.body.appendChild(el);
                var dx = tx - (tr.left + tr.width / 2), dy = ty - (tr.top + tr.height / 2);
                var anim = el.animate([
                    { transform: 'translate(0,0) scale(1)', opacity: 1 },
                    { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.5)', opacity: 0 }
                ], { duration: 420, delay: i * 60, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
                (function (e) { anim.onfinish = function () { if (e.parentNode) e.parentNode.removeChild(e); }; })(el);
            }
        } catch (e) {}
    }

    // 指示物"挂载"动画：从场地中央飞向目标卡（YGOPro 的 counter 出现方式），
    // 同时让新角标 pop 一下。纯视觉，不改模型。
    function counterMountFx(ctl, loc, seq, n) {
        try {
            var cell = cellElFor(ctl, loc, seq);
            var tr = cell && cell.getBoundingClientRect();
            if (!tr || !tr.width) return;
            var pane = fieldEl.getBoundingClientRect();
            var sx = pane.left + pane.width / 2, sy = pane.top + pane.height * 0.44;
            for (var i = 0; i < Math.max(1, n); i++) {
                var el = document.createElement('div');
                el.className = 'rp-counter-fly';
                el.textContent = '+';
                el.style.left = (sx - 10) + 'px';
                el.style.top = (sy - 10) + 'px';
                document.body.appendChild(el);
                var dx = (tr.left + tr.width / 2) - sx;
                var dy = (tr.top + tr.height / 2) - sy;
                var anim = el.animate([
                    { transform: 'translate(0,0) scale(.5)', opacity: 0 },
                    { transform: 'translate(' + dx * 0.55 + 'px,' + (dy * 0.55 - 26) + 'px) scale(1.15)', opacity: 1, offset: 0.55 },
                    { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.75)', opacity: 0.9 }
                ], { duration: 520, delay: i * 80, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
                (function (e) {
                    anim.onfinish = function () { if (e.parentNode) e.parentNode.removeChild(e); };
                })(el);
            }
            var badge = cell.querySelector('.rp-counter');
            if (badge) {
                badge.classList.remove('rp-counter-pop');
                void badge.offsetWidth;
                badge.classList.add('rp-counter-pop');
                setTimeout(function () { badge.classList.remove('rp-counter-pop'); }, 520);
            }
        } catch (e) {}
    }

    // 装备标记：YGOPro 会在被装备的怪/卡上显示装备关系（MSG_EQUIP 只有位置，没有卡号）
    function equipLocOf(o) {
        if (!o) return null;
        var c = Number(o.controller);
        var l = Number(o.location), s = Number(o.sequence);
        if (!(c === 0 || c === 1) || !(l >= 0)) return null;
        return { ctl: c, loc: l & 0x7f, seq: s };
    }
    function refreshEquipMarks() {
        try {
            var _eqSig = equipLinks.map(function (l) {
                var _ec = field[l.equip.ctl] && field[l.equip.ctl][l.equip.loc + ':' + l.equip.seq];
                var _tc = field[l.target.ctl] && field[l.target.ctl][l.target.loc + ':' + l.target.seq];
                return l.equip.ctl + ':' + l.equip.loc + ':' + l.equip.seq + '>' + l.target.ctl + ':' + l.target.loc + ':' + l.target.seq
                    + ':' + (_ec ? 1 : 0) + (_tc ? 1 : 0);
            }).join('|');
            if (_eqSig === window.__equipMarkSig && document.querySelectorAll('.rp-equip-mark').length) return;
            window.__equipMarkSig = _eqSig;
            Array.prototype.forEach.call(document.querySelectorAll('.rp-equip-mark'), function (e) {
                if (e.parentNode) e.parentNode.removeChild(e);
            });
            var byTarget = {};
            var keep = [];
            equipLinks.forEach(function (link) {
                var e = link.equip, t = link.target;
                if (!e || !t) return;
                var ec = field[e.ctl] && field[e.ctl][e.loc + ':' + e.seq];
                var tc = field[t.ctl] && field[t.ctl][t.loc + ':' + t.seq];
                if (!ec || !tc) return;      // 任一离场/被替换 → 标记自动失效
                keep.push(link);
                var tk = t.ctl + ':' + t.loc + ':' + t.seq;
                byTarget[tk] = byTarget[tk] || [];
                if (ec.code) byTarget[tk].push(cardName(ec.code));
            });
            equipLinks = keep;
            Object.keys(byTarget).forEach(function (tk) {
                var p = tk.split(':').map(Number);
                var cell = cellElFor(p[0], p[1], p[2]);
                if (!cell) return;
                var mark = document.createElement('div');
                mark.className = 'rp-equip-mark';
                mark.textContent = '⚙';
                mark.title = '装备：' + byTarget[tk].join('、');
                if (!cell.querySelector('.rp-card')) return;
                cell.appendChild(mark);
            });
        } catch (e) {}
    }

    // 掷币/掷骰：屏幕上飘一个结果，日志也记一行
    function tossFx(isCoin, results, who) {
        try {
            var old = document.getElementById('ypTossFx');
            if (old) old.remove();
            var box = document.createElement('div');
            box.id = 'ypTossFx';
            var title = document.createElement('div');
            title.className = 'yp-toss-title';
            title.textContent = (who || '') + (isCoin ? '掷硬币' : '掷骰子');
            box.appendChild(title);
            var row = document.createElement('div');
            row.className = 'yp-toss-row';
            (results || [1]).forEach(function (v, i) {
                var el = document.createElement('div');
                el.className = isCoin ? 'yp-coin' : 'yp-die';
                el.style.animationDelay = (i * 90) + 'ms';
                el.textContent = isCoin ? (v ? '正' : '反') : String(v);
                row.appendChild(el);
            });
            box.appendChild(row);
            document.body.appendChild(box);
            setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 2300);
        } catch (e) {}
    }

    function tossToast(text) {
        try {
            var el = document.createElement('div');
            el.textContent = text;
            el.style.cssText = 'position:absolute;left:50%;top:42%;transform:translate(-50%,-50%) scale(.9);'
                + 'z-index:60;padding:10px 18px;border-radius:12px;pointer-events:none;'
                + 'background:rgba(18,14,26,.92);border:1px solid rgba(212,175,55,.7);color:#ffe9a8;'
                + 'font:700 15px/1.3 "Microsoft YaHei",system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.6);'
                + 'transition:opacity .35s ease,transform .35s ease;opacity:0';
            fieldEl.appendChild(el);
            requestAnimationFrame(function () {
                el.style.opacity = '1';
                el.style.transform = 'translate(-50%,-50%) scale(1)';
            });
            setTimeout(function () {
                el.style.opacity = '0';
                setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
            }, 1400);
        } catch (e) {}
    }

    // ── 发动/公开时的「放大展示」──────────────────────────────
    //   参照 YGOPro3 客户端：手卡发动/被公开时，把那 1 张卡放大浮在场地右侧短暂展示，
    //   看完自动淡出。比只把手牌格翻正面直观得多（用户要求）。
    var _showcaseEl = null, _showcaseTimer = 0;
    /**
     * 卡组翻开/确认的卡片列表（抄 ygopro 客户端 ClientField::ShowLocationCard 的排版：
     * 一排卡图、每张下面写位置），用于强欲而金满之壶、卡组顶确认这类「看一眼卡组」的效果。
     */
    var _revealListEl = null, _revealListTimer = 0;
    function showRevealList(cards, ctl) {
        try {
            // PATCH(白神服) 2026-11-17: 只对「一次翻多张」弹列表 —— 单张公开（检索/抽到明牌）太频繁，
            //   一直弹会挡住场地（用户反馈：老是显示卡组公开）。单张走日志/明牌显示即可。
            if (!cards || cards.length < 2) return;
            if (_revealListEl && _revealListEl.parentNode) _revealListEl.parentNode.removeChild(_revealListEl);
            clearTimeout(_revealListTimer);
            var box = document.createElement('div');
            box.className = 'rp-reveal-list';
            box.style.left = '50%';
            box.style.top = '50%';
            box.style.transform = 'translate(-50%, -50%)';
            var title = document.createElement('div');
            title.className = 'rp-reveal-title';
            title.textContent = '卡组公开（' + cards.length + ' 张）';
            try {
                var xb = document.createElement('div');
                xb.textContent = '✕';
                xb.title = '关闭';
                xb.style.cssText = 'position:absolute;right:6px;top:4px;width:18px;height:18px;line-height:18px;'
                    + 'text-align:center;border-radius:9px;background:rgba(255,255,255,.12);color:#cfe6ff;cursor:pointer;'
                    + 'font-size:11px';
                xb.onclick = function (ev) { ev.stopPropagation(); if (box.parentNode) box.parentNode.removeChild(box); };
                box.appendChild(xb);
            } catch (e) {}
            box.appendChild(title);
            var row = document.createElement('div');
            row.className = 'rp-reveal-row';
            cards.slice(0, 8).forEach(function (c) {
                var cell = document.createElement('div');
                cell.className = 'rp-reveal-item';
                var im = document.createElement('img');
                im.src = picChain(c.code)[0] || CARD_BACK_URI;
                im.alt = '';
                im.title = cardName(c.code) || ('#' + c.code);
                cell.appendChild(im);
                var lab = document.createElement('div');
                lab.className = 'rp-reveal-pos';
                lab.textContent = '卡组' + (c.sequence !== undefined ? (' ' + ((c.sequence | 0) + 1)) : '');
                cell.appendChild(lab);
                row.appendChild(cell);
            });
            if (cards.length > 8) {
                var more = document.createElement('div');
                more.className = 'rp-reveal-more';
                more.textContent = '+' + (cards.length - 8);
                row.appendChild(more);
            }
            box.appendChild(row);
            box.onclick = function () { if (box.parentNode) box.parentNode.removeChild(box); };
            document.body.appendChild(box);
            _revealListEl = box;
            _revealListTimer = setTimeout(function () {
                if (box.parentNode) box.parentNode.removeChild(box);
            }, 6000);
        } catch (e) {}
    }

    function showCardShowcase(code, tag) {
        code = toCode(code);
        if (!code) return;
        try {
            if (_showcaseEl && _showcaseEl.parentNode) {
                var same = _showcaseEl.getAttribute('data-showcode') === String(code);
                _showcaseEl.parentNode.removeChild(_showcaseEl);
                _showcaseEl = null;
                clearTimeout(_showcaseTimer);
                if (same && (Date.now() - Number(_showcaseEl && 0)) < 0) return;
            }
            var wrap = document.createElement('div');
            wrap.className = 'rp-showcase';
            wrap.setAttribute('data-showcode', String(code));
            wrap.style.cssText = 'position:absolute;right:9px;top:50%;transform:translateY(-50%) scale(.92);'
                + 'z-index:80;pointer-events:none;opacity:0;transition:opacity .22s ease,transform .22s ease;'
                + 'display:flex;flex-direction:column;align-items:center;gap:3px;';
            var box = document.createElement('div');
            box.style.cssText = 'padding:3px;border-radius:6px;background:rgba(12,10,16,.92);'
                + 'border:1px solid rgba(212,175,55,.75);box-shadow:0 8px 20px rgba(0,0,0,.7);';
            var im = buildCardImg(code);
            im.style.cssText = 'display:block;width:clamp(52px,8vw,75px);aspect-ratio:421/614;'
                + 'object-fit:cover;border-radius:4px';
            box.appendChild(im);
            wrap.appendChild(box);
            var lab = document.createElement('div');
            lab.textContent = (tag ? ('【' + tag + '】') : '') + (cardName(code) || ('#' + code));
            lab.style.cssText = 'max-width:clamp(55px,9vw,82px);overflow:hidden;text-overflow:ellipsis;'
                + 'white-space:nowrap;font:700 7px/1.3 "Microsoft YaHei",system-ui,sans-serif;'
                + 'color:#ffe9a8;background:rgba(12,10,16,.86);border:1px solid rgba(212,175,55,.4);'
                + 'border-radius:4px;padding:1px 4px';
            wrap.appendChild(lab);
            fieldEl.appendChild(wrap);
            _showcaseEl = wrap;
            requestAnimationFrame(function () {
                wrap.style.opacity = '1';
                wrap.style.transform = 'translateY(-50%) scale(1)';
            });
            _showcaseTimer = setTimeout(function () {
                if (!wrap.parentNode) return;
                wrap.style.opacity = '0';
                wrap.style.transform = 'translateY(-50%) scale(.96)';
                setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 260);
                if (_showcaseEl === wrap) _showcaseEl = null;
            }, 2400);
        } catch (e) {}
    }

    // ── 对局统计（「具体信息」面板用）：NS/SP/EF/ATK ─────────────
    //   NS=通常召唤（Summoning） SP=特殊召唤（SpSummoning） EF=效果发动（Chaining）
    var duelCount = [ { ns: 0, sp: 0, ef: 0 }, { ns: 0, sp: 0, ef: 0 } ];
    //   PATCH(白神服) 2026-11-17: 特殊召唤按「召唤理由」分类（抄 MDPro3 DuelLog 的做法）
    //   · MDPro3 的 lastSpSummonReason 来自 MSG_MOVE 的 reason 字段，用 CardReason 位判断
    //     仪式 0x100000 / 融合 0x40000 / 同调 0x80000 / 超量 0x200000 / 灵摆 0x400000(=MDPro3 扩展) / 连接 0x10000000
    //   · 统计口径也照着改：只在 **Summoned / SpSummoned**（召唤成功）时计数，
    //     被神字辈无效掉的召唤留在 Summoning/SpSummoning 阶段，不再算进去
    var lastSpSummonReason = 0;
    var pendingSummon = [null, null];          // 刚发生、还没确认成功的召唤（被无效时回滚计数）
    // PATCH(白神服) 2026-11-17: 「从卡组把落穴盖放」这类效果 —— 卡先被 ConfirmCards 公开，
    //   再 MSG_SET 盖到场上。Set 消息里对手视角 code=0，于是画成纯卡背（用户实测 ✗）。
    //   这里记下最近公开过的卡号，盖放时若 code=0 就把它们认成明牌。
    var recentRevealByCtl = { 0: [], 1: [] };
    var pendingSetReveal = {};   // ctl:loc:seq → {code,at}：卡组/墓地 → 场上盖放，Set 后临时翻开
    function rememberRevealed(ctl, code) {
        try {
            if (ctl !== 0 && ctl !== 1) return;
            var cd = toCode(code);
            if (!cd) return;
            var arr = recentRevealByCtl[ctl] || (recentRevealByCtl[ctl] = []);
            arr.push({ code: cd, at: Date.now() });
            if (arr.length > 24) arr.splice(0, arr.length - 24);
        } catch (e) {}
    }
    function lastRevealedCode(ctl, ms) {
        try {
            var arr = recentRevealByCtl[ctl] || [];
            var now = Date.now();
            for (var i = arr.length - 1; i >= 0; i--) {
                if (now - arr[i].at <= (ms || 15000)) return arr[i].code;
            }
        } catch (e) {}
        return 0;
    }
    var lastMoveCtl = -1, lastMoveIdx = -1;    // 最近一次 Move 的落点控制者（召唤消息没带 ctl 时兜底）
    var SP_KIND_LABEL = { ritual: '仪式', fusion: '融合', synchro: '同调', xyz: '超量',
      link: '连接', pendulum: '灵摆', other: '其它' };
    function emptySpKind() {
        return { ritual: 0, fusion: 0, synchro: 0, xyz: 0, link: 0, pendulum: 0, other: 0 };
    }
    duelCount[0].kinds = emptySpKind();
    duelCount[1].kinds = emptySpKind();
    /** hex 里 code 字段的起始偏移：有的链路带消息类型字节(1)，有的不带(0) */
    function hexBase(hex, code) {
        if (!hex || hex.length < 8) return 1;
        var want = toCode(code);
        if (!want) return 1;
        if (hexU32(hex, 1) === want) return 1;
        if (hexU32(hex, 0) === want) return 0;
        return 1;
    }
    /** 召唤类消息的 ctl：布局 code(4) ctl(1) loc(1) seq(1) pos(1) */
    function ctlFromSummonHex(hex, code) {
        if (!hex || hex.length < 10) return -1;
        var base = hexBase(hex, code);
        var c = hexU8(hex, base + 4);
        if (c === 0 || c === 1) return c;
        var c2 = hexU8(hex, 5);          // 旧布局兜底
        return (c2 === 0 || c2 === 1) ? c2 : -1;
    }
    /** 场上找这只怪在谁的区域（最后一道兜底：按 code + seq 定位） */
    function ctlFromFieldByCode(code, seq) {
        try {
            var want = toCode(code);
            if (!want) return -1;
            var hit = [];
            [0, 1].forEach(function (c) {
                var fld = field[c] || {};
                Object.keys(fld).forEach(function (k) {
                    if (k.indexOf(LOC.MZONE + ':') !== 0) return;
                    var card = fld[k];
                    if (!card || toCode(card.code) !== want) return;
                    var s = Number(k.split(':')[1]);
                    if (seq === undefined || s === seq) hit.push(c);
                });
            });
            if (hit.length === 1) return hit[0];
            if (hit.length > 1) return -1;
        } catch (e) {}
        return -1;
    }
    /** 从消息里取控制者：f.controller → hex → 最近一次 Move 的落点 → 场上按卡号定位 */
    /** Move 的 hex → card code（兼容带/不带消息类型字节两种布局，用 from/to 的 loc 校验） */
    function moveCodeFromHex(hex) {
        if (!hex || hex.length < 34) return 0;
        function locOk(v) { var p = v & 0x7f; return p === 1 || p === 2 || p === 4 || p === 8 || p === 16 || p === 32 || p === 64 || p === 0x80 || p === 0x100 || p === 0x200; }
        // base=1（带类型字节）：from.loc 在 6，to.loc 在 10
        if (locOk(hexU8(hex, 6)) && locOk(hexU8(hex, 10))) return hexU32(hex, 1);
        // base=0（不带类型字节）：from.loc 在 5，to.loc 在 9
        if (locOk(hexU8(hex, 5)) && locOk(hexU8(hex, 9))) return hexU32(hex, 0);
        return 0;
    }
    /** 从「公开/确认卡牌」缓存里找某座位某序号的卡号（Move 无卡号时补） */
    function revealedCodeAt(ctl, loc, seq) {
        try {
            if (ctl !== 0 && ctl !== 1) return 0;
            if (loc === undefined || loc === null) return 0;
            var plain = loc & 0x7f;
            if (plain === LOC.HAND) {
                // pendingHandReveal[ctl:seq] = { code, at }（ConfirmCards 先到、卡后到手牌）
                var pend = pendingHandReveal[ctl + ':' + seq];
                if (pend && pend.code) return toCode(pend.code);
            }
            var key = ctl + ':' + plain + ':' + seq;
            var c = field[ctl] && field[ctl][plain + ':' + seq];
            if (c && c.code) return toCode(c.code);
            if (knownSeen[key]) return toCode(knownSeen[key]);
        } catch (e) {}
        return 0;
    }

    function ctlFromMsg(f, m, strict) {
        try {
            if (f && f.controller !== undefined && f.controller !== null) {
                var fc = Number(f.controller);
                if (fc === 0 || fc === 1) return fc;
            }
            if (f && f.chainCardLocation && f.chainCardLocation.controller !== undefined && f.chainCardLocation.controller !== null) {
                var cc = Number(f.chainCardLocation.controller);
                if (cc === 0 || cc === 1) return cc;
            }
            var hx = m && m.hex;
            var n = m && m.name;
            if (hx) {
                if (n === 'Summoning' || n === 'SpSummoning' || n === 'FlipSummoning'
                    || n === 'Summoned' || n === 'SpSummoned' || n === 'FlipSummoned') {
                    var cs = ctlFromSummonHex(hx, f && f.code);
                    if (cs >= 0) return cs;
                }
                var c = hexU8(hx, 5);
                if (c === 0 || c === 1) return c;
            }
            if (lastMoveCtl >= 0 && typeof idx === 'number' && lastMoveIdx >= 0 && idx - lastMoveIdx <= 6) {
                return lastMoveCtl;
            }
            var cf = ctlFromFieldByCode(f && f.code, f && f.sequence);
            if (cf >= 0) return cf;
        } catch (e) {}
        return strict ? -1 : 0;
    }

    function bumpDuelCount(kind, ctl) {
        try {
            if (ctl !== 0 && ctl !== 1) return;   // 无法判定归属时宁可不计，也不能全记到自己头上
            var c = ctl;
            if (!duelCount[c]) duelCount[c] = { ns: 0, sp: 0, ef: 0 };
            duelCount[c][kind] = (duelCount[c][kind] || 0) + 1;
        } catch (e) {}
    }
    /** 召唤被无效：输出「召唤无效」并把刚放上场的卡撤掉（MDPro3 里 Summoning→无 Summoned 即未成立） */
    function cancelPendingSummon(ctl) {
        try {
            var p = pendingSummon[ctl];
            if (!p) return false;
            if (typeof idx === 'number' && p.idx !== undefined && idx - p.idx > 12) { pendingSummon[ctl] = null; return false; }
            var nm = p.code ? cardName(p.code) : '怪兽';
            try {
                logCardRow({ ctl: ctl, code: p.code || 0, action: '召唤无效', name: nm, chain: true });
            } catch (e) { log('✖ 召唤无效：' + nm, 'rp-log-battle'); }
            // 模型回退：把刚盖上去的那张从场上撤掉（真正的去向由随后的 Move 决定）
            try {
                if (p.loc !== null && p.seq !== null) {
                    var key = p.loc + ':' + p.seq;
                    if (field[ctl] && field[ctl][key]) {
                        delete field[ctl][key];
                        try { updateZone(ctl, p.loc); } catch (e) {}
                    }
                }
            } catch (e) {}
            // 统计回滚（不能依赖 undoPendingSummon：这里马上要清 pending）
            try {
                if (p.kind === 'ns') {
                    duelCount[ctl].ns = Math.max(0, (duelCount[ctl].ns || 0) - 1);
                } else if (p.kind === 'sp') {
                    duelCount[ctl].sp = Math.max(0, (duelCount[ctl].sp || 0) - 1);
                    if (p.spKind && duelCount[ctl].kinds) {
                        duelCount[ctl].kinds[p.spKind] = Math.max(0, (duelCount[ctl].kinds[p.spKind] || 0) - 1);
                    }
                }
            } catch (e) {}
            pendingSummon[ctl] = null;
            return true;
        } catch (e) { return false; }
    }

    /** 召唤被无效（神字辈等）→ 把刚才先记上的 NS/SP 扣回去（MDPro3：只统计成立的召唤） */
    function undoPendingSummon(ctl) {
        try {
            var p = pendingSummon[ctl];
            if (!p) return;
            if (typeof idx === 'number' && p.idx !== undefined && idx - p.idx > 12) { pendingSummon[ctl] = null; return; }
            if (!duelCount[ctl]) return;
            if (p.kind === 'ns') {
                duelCount[ctl].ns = Math.max(0, (duelCount[ctl].ns || 0) - 1);
            } else if (p.kind === 'sp') {
                duelCount[ctl].sp = Math.max(0, (duelCount[ctl].sp || 0) - 1);
                if (p.spKind && duelCount[ctl].kinds) {
                    duelCount[ctl].kinds[p.spKind] = Math.max(0, (duelCount[ctl].kinds[p.spKind] || 0) - 1);
                }
            }
            pendingSummon[ctl] = null;
        } catch (e) {}
    }

    function bumpSpKind(ctl, reason, code) {
        try {
            var c = (ctl === 0 || ctl === 1) ? ctl : 0;
            if (!duelCount[c]) return;
            if (!duelCount[c].kinds) duelCount[c].kinds = emptySpKind();
            var kind = spKindOf(reason, code);
            duelCount[c].kinds[kind] = (duelCount[c].kinds[kind] || 0) + 1;
        } catch (e) {}
    }
    /** 特召类型：优先用 reason 位（MDPro3 口径），拿不到再按卡种兜底 */
    function spKindOf(reason, code) {
        var R = Number(reason) >>> 0;
        if (R & 0x100000) return 'ritual';
        if (R & 0x40000) return 'fusion';
        if (R & 0x80000) return 'synchro';
        if (R & 0x200000) return 'xyz';
        if (R & 0x400000) return 'pendulum';
        if (R & 0x10000000) return 'link';
        try {
            var st = summonTypeOf(code);
            if (st === 'ritual' || st === 'fusion' || st === 'synchro' || st === 'xyz' || st === 'link') return st;
            if (st === 'pendulum') return 'pendulum';
        } catch (e) {}
        return 'other';
    }

    // 场上攻击表示怪兽的攻击力合计（表侧、攻击表示）
    function attackAtkSum(ctl) {
        var sum = 0;
        try {
            Object.keys(field[ctl] || {}).forEach(function (k) {
                if (k.indexOf(LOC.MZONE + ':') !== 0) return;
                var card = field[ctl][k];
                if (!card || card.faceDown || !card.code) return;
                var pos = card.pos === undefined ? 1 : card.pos;
                var isDef = (pos & 0x4) !== 0;          // 守备表示
                if (isDef) return;
                var st = statFor(ctl + ':' + k, card.code) || cardStatByCode[String(card.code)] || null;
                var atk = st && typeof st.atk === 'number' ? st.atk : null;
                if (atk === null) {
                    var meta = cardMetaMap[String(card.code)];
                    atk = (meta && typeof meta.atk === 'number') ? meta.atk : 0;
                }
                if (atk > 0) sum += atk;
            });
        } catch (e) {}
        return sum;
    }

    function updateAllZones() {
        releaseStaleHolds();
        if (bulkApplyActive) return;
        [0, 1].forEach(function (c) {
            [LOC.HAND, LOC.MZONE, LOC.SZONE].forEach(function (loc) {
                updateZone(c, loc);
            });
        });
        updatePiles();
        refreshEmz();
        // 阶段/回合
        if (phaseEl) phaseEl.textContent = phaseText || '对局开始';
        renderTurnLabel();
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
                if (cd) return { card: cd, flip: ctl === 1, ctl: ctl, seq: seq };
            }
            return null;
        }
        var L = content([[0, 5], [1, 6]]);
        var R = content([[0, 6], [1, 5]]);
        // PATCH(白神服) 2026-11-07: 额外怪兽区左右两格要各自用自己的序号取攻守 ——
        //   原来两边都写死 ':5'，放在 seq 6 的那只永远查不到实时攻守 → 显示基础攻击力（用户实测 ✗）
        setCellCard(zoneEls['emz:L'], L ? L.card : null, L ? L.flip : false, L ? isDefense(L.card.pos) : false,
            L ? (L.ctl + ':' + LOC.MZONE + ':' + L.seq) : null, true);
        setCellCard(zoneEls['emz:R'], R ? R.card : null, R ? R.flip : false, R ? isDefense(R.card.pos) : false,
            R ? (R.ctl + ':' + LOC.MZONE + ':' + R.seq) : null, true);
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
        // PATCH(白神服) 2026-11-08: 牌堆厚度按用户要求画：
        //   · **底部对齐格子**（最下面那张贴住格子底边，往上一层层叠）
        //   · 水平方向朝**棋盘中心**偏移：左侧牌堆往右下露边，右侧牌堆往左下露边
        try {
            var _n = badge ? parseInt(badge, 10) : 0;
            if (card && _n > 1) {
                var _depth = Math.min(6, Math.max(1, Math.round(_n / 7)));
                window.__pileDepthLast = _depth;
                // 判断这堆在棋盘的左半边还是右半边
                var _pos = null;
                try {
                    var _brd = el.closest('.rp-board') || document.querySelector('#replayField .rp-board');
                    if (_brd) {
                        var _cr = el.getBoundingClientRect(), _rr = _brd.getBoundingClientRect();
                        _pos = ((_cr.left + _cr.width / 2) < (_rr.left + _rr.width / 2)) ? 'left' : 'right';
                    }
                } catch (e) {}
                var _dx = 0;      // 用户确认：真 3D 视角下**往上堆**就对，不用管左右朝向
                for (var _li = _depth; _li >= 1; _li--) {
                    var _lay = document.createElement('div');
                    _lay.className = 'rp-pile-depth';
                    _lay.style.cssText = 'position:absolute;left:50%;bottom:' + ((_depth - _li) * 2) + 'px;height:100%;aspect-ratio:59/86;width:auto;'
                        + 'border-radius:3px;background:#3a1a26;border:1px solid #6b2a3a;z-index:0;'
                        // PATCH(白神服) 2026-11-08: 去掉 translateZ —— 它让厚度层沿"棋盘法线"往后沉，
                        //   和场地往前倾的方向相反，看起来像"卡堆向后倒"（用户实测 ✗）。
                        //   现在只在棋盘平面内向上错开，和场地同一个透视，看起来就是在桌上叠起来。
                        + 'transform:translateX(-50%);';
                    el.appendChild(_lay);
                }
            }
        } catch (e) {}

        if (card) {
            // PATCH(白神服) 2026-11-07: 卡组/额外/墓地的卡背要**显式**给尺寸 ——
            //   之前只靠 CSS 的 .rp-cell .rp-card，某些时机（首帧/重绘/样式还没生效）
            //   卡会被拉伸到整格，于是出现「一会儿占满、一会儿正常」的两套表现（用户实测 ✗）。
            //   这里强制：高 100%、宽按卡牌比例、不拉伸；并把可能残留的单元格背景清掉。
            var node = cardNode(card, flip);
            try {
                node.style.width = 'auto';
                // PATCH(白神服) 2026-11-08: 卡背恢复满格高度 —— 卡堆本来就该比格子高（用户说明）：
                //   最下面那张已经贴住格子上下边，往上垒必然越出上边界，这是正常的。
                node.style.height = '100%';
                // PATCH(白神服) 2026-11-07: 恢复「卡背在最上、厚度向下、最底层贴格子底边」的堆叠
                //   （用户图示）。配合 .rp-cell.rp-pile 的 z-index，抬起的部分不会被上一行盖住。
                var _nb2 = badge ? parseInt(badge, 10) : 0;
                var _dc2 = (_nb2 > 1) ? Math.min(6, Math.max(1, Math.round(_nb2 / 7))) : 0;
                node.style.bottom = (_dc2 * 2) + 'px';
                node.style.aspectRatio = '59 / 86';
                // 卡背底部对齐格子底边（与厚度层同基准）
                node.style.position = 'absolute';
                node.style.left = '50%';
                // 内联 transform 会覆盖 CSS 的 .rp-flip → 把翻转合成进来
                node.style.transform = 'translateX(-50%)' + (flip ? ' rotate(180deg)' : '');
                node.style.flex = '0 0 auto';
                node.style.backgroundSize = '100% 100%';
                node.style.zIndex = '1';
                el.style.backgroundImage = '';
            } catch (e) {}
            el.appendChild(node);
        }
        el._sig = sig;
    }
    // PATCH(白神服) 2026-11-07: 角标与模型对账（兜底）——
    //   出现过「模型是 1、界面长期显示 37」的情况（用户实测），
    //   这里每 1.2 秒比对一次，发现不一致就强制重画该牌堆。
    function syncPileBadges() {
        try {
            if (!loaded) return;
            [0, 1].forEach(function (c) {
                var pairs = [['deck', deckCount[c]], ['extra', extraCount[c]]];
                pairs.forEach(function (pr) {
                    var el = midEls[pr[0] + ':' + c];
                    if (!el) return;
                    var b = el.querySelector('.rp-pile-count');
                    var want = (pr[1] === null || pr[1] === undefined) ? '?' : String(pr[1]);
                    var has = b ? b.textContent : null;
                    if (has !== want && !(pr[1] === 0 && has === null)) {
                        el._sig = '';          // 强制下次 fillPile/pile 更新重画
                    }
                });
            });
            // 只用一次 updatePiles 收尾（它内部有 _sig 判断）
            updatePiles();
        } catch (e) {}
    }
    setInterval(syncPileBadges, 1200);

    // PATCH(白神服) 2026-11-18: 手牌 DOM 与模型对账 ——
    //   出现过「模型只剩 2 张、手牌行还留着 4 张（多出两张卡背）」的情况：
    //   某些 Move/UpdateData 只改了模型没触发手牌重画。这里每 0.5 秒比一次数量，
    //   不一致就强制重画该方手牌，清掉遗留节点。
    function syncHandDom() {
        try {
            if (!loaded || bulkApplyActive) return;
            [0, 1].forEach(function (c) {
                var cont = zoneEls[c + ':' + LOC.HAND];
                if (!cont) return;
                var n = 0;
                Object.keys(field[c] || {}).forEach(function (k) {
                    if (k.indexOf(LOC.HAND + ':') === 0) n++;
                });
                if (cont.children.length !== n) {
                    cont._sig = '';
                    updateZone(c, LOC.HAND);
                }
            });
        } catch (e) {}
    }
    setInterval(syncHandDom, 500);
    // 盖卡自愈：确认/盖回后 v2 节点偶发仍透明，超过 1.2s 强制旧卡背兜底
    setInterval(selfHealHidden, 800);
    setInterval(reconcileFieldDom, 1000);
    setInterval(healSetFromLog, 600);

    // 座位对齐：**已废弃「按张数猜」**（PATCH 2026-11-19）
    //   原来靠"额外/卡组张数交叉匹配"去猜 srvpro 有没有换边，猜错就把名字对调 ——
    //   这就是「桌位名字偶尔对换」的来源。现在座位映射完全由协议决定：
    //     · 玩家：MSG_START.playerType 低 4 位 = 自己的决斗位，房间 pos 取 STOC 的 playerPosition
    //     · 观战：MSG_START.playerType = 0x10/0x11（0x11 = 换边）
    //   由 duel-client.js 算好 seatOrder 下发，这里只保留变量兼容旧调用。
    var metaAligned = false;
    function autoAlignSeatsByCounts() { metaAligned = true; return true; }

    function updatePiles() {
        if (bulkApplyActive) return;
        [0, 1].forEach(function (c) {
            var gc = locCards(c, LOC.GRAVE);
            var _gov = graveCountOverride[c];
            var _gcnt = (_gov === null || _gov === undefined) ? gc.length : _gov;
            var gtop = (_gov === null || _gov === undefined) ? gc[gc.length - 1] : null;
            fillPile(midEls['grave:' + c],
                'g' + _gcnt + '|' + (gtop ? (gtop.code + (gtop.faceDown ? 'd' : 'u')) : ''),
                _gcnt ? String(_gcnt) : null,
                _gcnt ? (gtop || { code: 0, faceDown: true }) : null,
                !!(c === 1 && gtop));      // 对手墓地顶牌转 180°
            var dcount = (deckCount[c] === null || deckCount[c] === undefined) ? null : deckCount[c];
            var dtop = deckTopCode[c];
            fillPile(midEls['deck:' + c],
                'd' + (dcount === null ? '?' : dcount) + '|' + (dtop || '') + '|' + (deckReversed[c] ? 1 : 0),
                (dcount === null ? '?' : String(dcount)),
                (dcount === null) ? { code: 0, faceDown: true }
                    : (dcount ? (dtop ? { code: dtop, faceDown: false, pos: 1 } : { code: 0, faceDown: true }) : null),
                (c === 1) !== !!deckReversed[c]);       // 对手卡组转 180°；ReverseDeck 再翻一次
            // PATCH(白神服) 2026-11-19: 未知时**显示 ?**，不再拿「公开的额外列表长度」兜底。
            //   公开列表只是表侧额外的子集（0~15 张），拿它当张数会随每次公开来回跳
            //   （15→3→15），正是「额外张数反复变动」的观感来源。
            var xcount = (extraCount[c] === null || extraCount[c] === undefined) ? null : extraCount[c];
            var _xf = (extraFaceUp[c] || []);
            var _xTop = _xf.length ? _xf[_xf.length - 1] : 0;
            fillPile(midEls['extra:' + c],
                'x' + (xcount === null ? '?' : xcount) + '|' + _xTop,
                (xcount === null ? '?' : String(xcount)),
                (xcount === null) ? { code: 0, faceDown: true } : (xcount ? (_xTop ? { code: _xTop, faceDown: false } : { code: 0, faceDown: true }) : null),
                c === 1);       // 对手额外也转 180°
            var bc = locCards(c, LOC.REMOVED);
            var btop = bc[bc.length - 1];
            fillPile(midEls['removed:' + c],
                'r' + bc.length + '|' + (btop ? (btop.code + (btop.faceDown ? 'd' : 'u')) : ''),
                bc.length ? String(bc.length) : null,
                bc.length ? btop : null,
                !!(c === 1 && btop));      // 对手除外顶牌转 180°
        });
    }

    // 更新某玩家某区：手牌签名比对（未变不重绘，防每步闪）；场上逐格精确填
    // 对手(controller=1)的正面场上卡上下倒置，方便区分归属；手牌不倒
    // 把某个玩家（视图侧）已知卡号丢给 duel-client 批量预读效果文本
    var _pfSent = {};
    function prefetchOwnHints(controller) {
        try {
            if (controller !== 0) return;                 // 只预读自己的（对手手牌本来就未知）
            if (!window.__prefetchHints) return;
            var codes = [];
            Object.keys(field[controller] || {}).forEach(function (k) {
                var c = field[controller][k];
                if (c && typeof c.code === 'number' && c.code > 0 && !_pfSent[c.code]) {
                    _pfSent[c.code] = 1;
                    codes.push(c.code);
                }
            });
            if (codes.length) window.__prefetchHints(codes);
        } catch (e) {}
    }

    function updateZone(controller, loc) {
        if (bulkApplyActive) return;
        // PATCH(白神服) 2026-11-07: 自己的卡（手牌/场上/额外）效果文本**全局预读**，
        //   别等点了"发动效果"才去拉两种选项文本（用户要求）
        try { prefetchOwnHints(controller); } catch (e) {}
        if (loc === LOC.HAND) {
            var container = zoneEls[controller + ':' + LOC.HAND];
            if (!container) return;
            // 检索到手的卡（刚被公开过）→ 本次重画按正面显示
            var _hadRev = markPendingReveal(controller);
            if (_hadRev) container._sig = '';
            // 普通手牌变动（抽卡/使用/丢弃）→ 之前公开过的卡回到卡背
            if (!revealingHand && !_hadRev) {
                Object.keys(field[controller] || {}).forEach(function (k) {
                    if (k.indexOf(LOC.HAND + ':') === 0) {
                        var c = field[controller][k];
                        if (c && c.revealed) {
                            // 只有**手牌张数变了**（或在 12 秒后）才恢复卡背；
                            //   否则同张数的快照重建会把刚公开的卡立刻抹掉（用户实测：检索的场地一闪而过 ✗）
                            var _changed = (c.revealedHand && _revealHandCount[controller] !== undefined
                                            && handSizeOf(controller) !== _revealHandCount[controller]);
                            var _expired = c.revealedAt && (Date.now() - c.revealedAt > 12000);
                            if (!_changed && !_expired) return;
                            delete c.revealed;
                            if (c.revealedHand) {
                                // 公开过的卡 → 恢复成里侧卡背（把补上的卡号也抹掉）
                                c.faceDown = true;
                                c.code = 0;
                                delete c.knownCode;
                                delete c.revealedHand;
                            }
                        }
                    }
                });
            }
            var cards = locCards(controller, LOC.HAND);
            var sig = cards.map(function (c) { return c.code + (c.faceDown ? 'd' : 'u'); }).join(',');
            if (container._sig === sig) return;
            giveImgsIn(container);
            container.innerHTML = '';
            cards.forEach(function (card) {
                // PATCH(白神服) 2026-11-07: 自己的手牌（视图 ctl 0）只要有卡号就必须正面显示 ——
                //   有些快照把自家手牌标成里侧，导致整手牌变卡背（用户实测 ✗）
                var c2 = card;
                try {
                    // PATCH(白神服) 2026-11-17: **回放里双方手卡都是公开的**（复盘用）
                    //   原来只对"自己"（视图 ctl 0）强制正面，对手手牌永远是卡背
                    if (replayMode && card && card.code && card.faceDown) {
                        c2 = { code: card.code, faceDown: false, pos: card.pos, uid: card.uid,
                               mats: card.mats, knownCode: card.knownCode };
                    } else if (controller === 0 && !window.__ypWatchMode && card && card.code && card.faceDown) {
                        c2 = { code: card.code, faceDown: false, pos: card.pos, uid: card.uid,
                               mats: card.mats, knownCode: card.knownCode };
                    }
                } catch (e) {}
                // PATCH(白神服) 2026-11-17: 手牌卡带上**真实 seq**（引擎序号）——
                //   手牌有空洞时（用掉 seq1 后剩 0/2/3），DOM 顺序 ≠ seq，
                //   交互层按 DOM 下标回服会点 A 丢 B（用户实测 ✗）
                try { if (c2 && !c2.uid && card && card.uid) c2.uid = card.uid; } catch (e) {}
                var _hn = cardNode(c2, false);
                // 消息驱动：没收到"进入手牌"的 Move 之前，这张手牌不显示（开局快照不算）
                try {
                    if (ENTITY_MOVE && !_handAdmitBypass) {
                        var _ak = controller + ':' + card.seq;
                        if (!_handAdmitted[_ak]) {
                            _hn.style.visibility = 'hidden';
                            _hn.setAttribute('data-pending', '1');
                        }
                    }
                } catch (e) {}
                try {
                    _hn.setAttribute('data-seq', String(card.seq));
                    _hn.setAttribute('data-code', String(card.code || 0));
                } catch (e) {}
                container.appendChild(_hn);
            });
            container._sig = sig;
            return;
        }
        // MZONE / SZONE：按 sequence 逐格
        // PATCH(白神服) 2026-11-08: 原来只渲染 seq 0..4 —— 场地区（魔陷 seq5）和
        //   额外怪兽区（怪兽 seq5/6）永远画不出来（用户实测：显示卡背/空白 ✗）
        for (var seq = 0; seq < 7; seq++) {
            var cellKey = controller + ':' + loc + ':' + seq;
            var cell = zoneEls[cellKey];
            var card = cell ? (field[controller] ? field[controller][loc + ':' + seq] : null) : null;
            // PATCH(白神服) 2026-11-08: 对手侧**所有**卡都转 180°（含盖卡），像对坐在桌边（用户要求）
            setCellCard(cell, card, controller === 1 && !!card,
                !!card && loc === LOC.MZONE && isDefense(card.pos),   // 只有怪兽区守备横置
                cellKey, loc === LOC.MZONE);                          // 只有怪兽区显示攻守
        }
        // 场地区：魔陷区的 seq=5 格（场地魔法）单独显示在怪兽行外轨
        if (loc === LOC.SZONE) {
            var fKey = controller + ':' + LOC.SZONE + ':5';
            var fCell = zoneEls[fKey];
            var fCard = field[controller] ? field[controller][LOC.SZONE + ':5'] : null;
            setCellCard(fCell, fCard, controller === 1 && !!fCard && !fCard.faceDown, false, fKey, false);   // 场地/魔陷不倒不横置、不显示攻守
        }
    }

    // 卡图节点池：同一卡号复用已解码的 <img>，离场回收、再上场直接取用（不再重新加载）
    var cardImgs = {};
    // PATCH(白神服) 2026-11-05: 内存卡图缓存 —— 同一张卡在本局里反复出现时直接复用解码好的图，
    //   不再每次新建 <img> 走一遍网络/解码（用户要求：局内缓存，回大厅清掉）。
    var imgCache = {};
    function warmImg(code) {
        if (!code || imgCache[code]) return;
        try {
            var im = new Image();
            im.decoding = 'async';
            im.onload = function () { imgCache[code] = im; };
            im.src = cardImgSrc(code);
            imgCache[code] = im;   // 先占位（同一张卡并发只建一个）
        } catch (e) {}
    }
    function clearImageCache() {
        try { imgCache = {}; cardImgs = {}; } catch (e) {}
        // 把场上已挂的 <img> 也释放掉（它们还会被 DOM 引用，但解码缓存已清）
        try { Array.prototype.forEach.call(document.querySelectorAll('#replayField img'), function (n) { n.removeAttribute('decoding'); }); } catch (e) {}
        return true;
    }
    // 卡图回退链：DIY → 先行(SuperPre) → OCG → moecube 镜像1/2/3 → cover.jpg
    // PATCH(白神服) 2026-11-16: **先行卡号段（100000000~198999999）要优先用先行图床** ——
    //   siro 图床对先行号会返回另一张图（同名/占位），观战里就显示成"卡图不对"（用户实测 ✗）
    function isPreCode(code) {
        var n = Number(code) || 0;
        return n >= 100000000 && n < 199000000;
    }
    // 卡背（内联 SVG，data URI）：日志里卡号未知时用它，不再显示 cover.jpg/空白
    // PATCH(白神服) 2026-11-17: 卡背用官网原本那张（cover2.jpg，replay-viewer.css 用的也是它）
    var CARD_BACK_URI = 'cover2.jpg?v=20261117a';
    try { window.__liveCardBack = CARD_BACK_URI; } catch (e) {}
    // 外部图床 DNS 不可用时，失败一次后不再对每张卡重复 proxying，
    // 控制台会少掉大量 ERR_NAME_NOT_RESOLVED（仍以 /thumbcard + 卡背兜底）。
    try {
        window.addEventListener('error', function (e) {
            var t = e && e.target;
            if (!t || !t.tagName || t.tagName !== 'IMG') return;
            var s = String(t.currentSrc || t.src || '');
            if (/moecube|momo|ygopro-super|cdn\d/i.test(s)) window.__cdnDead = true;
        }, true);
    } catch (e) {}

    function picChain(code) {
        var diy = cardImgSrc(code);
        var pre = SUPER_PRE_PIC + code + '.jpg';
        // PATCH(白神服) 2026-11-16: /thumbcard 放**第一位**（服务端已缓存/校验，最快最稳），
        //   图床只作为它的后备 —— 否则 OCG 卡先撞 DIY 404、再等 CDN 超时，画面上就是长时间黑卡
        if (window.__cdnDead) {
            return [
                '/thumbcard/' + code + '.jpg?w=300&v=20261118d',
                diy,
                'cover2.jpg?v=20261108a'
            ];
        }
        if (isPreCode(code)) {
            return [
                '/thumbcard/' + code + '.jpg?w=300&v=20261118d',
                pre,
                diy,
                OCG_PIC + code + '.jpg',
                'https://cdn01.moecube.com:444/ygopro/pics/' + code + '.jpg',
                'https://cdn02.moecube.com:444/ygopro/pics/' + code + '.jpg',
                'https://cdn03.moecube.com:444/ygopro/pics/' + code + '.jpg',
                '/thumbcard/' + code + '.jpg?w=300&v=20261118d',
                'cover2.jpg?v=20261108a'
            ];
        }
        return [
            '/thumbcard/' + code + '.jpg?w=300&v=20261118d',
            diy,
            pre,
            OCG_PIC + code + '.jpg',
            'https://cdn01.moecube.com:444/ygopro/pics/' + code + '.jpg',
            'https://cdn02.moecube.com:444/ygopro/pics/' + code + '.jpg',
            'https://cdn03.moecube.com:444/ygopro/pics/' + code + '.jpg',
            'cover2.jpg?v=20261108a'
        ];
    }
    function wireImgChain(im, code) {
        var chain = picChain(code);
        var i = 0;
        im.onerror = function () {
            i++;
            if (i < chain.length) {
                im.src = chain[i];
            } else {
                // 所有卡图源都失败时不能留一张 opacity:0 的透明图（看起来就是空格）；
                // 退回卡背，至少能看出这里盖着一张卡。
                try {
                    im.onerror = null;
                    im.src = CARD_BACK_URI;
                    im.style.opacity = '1';
                    im.className = 'rp-img-fallback-back';
                } catch (e) {}
            }
        };
    }
    // ── 卡图就绪门控（用户要求：卡图没加载出来之前不要播动画，否则就是一张黑卡一闪而过）──
    var _imgReadyP = {};     // code -> Promise
    var _imgSrcOk = {};      // code -> 加载成功的那条 URL（动画/浮层直接用这条）
    var _imgLoaded = {};     // code -> true
    var IMG_WAIT_MS = 2200;
    function imgLoadedFlag(code) { return !!_imgLoaded[Number(code) || 0]; }
    function preloadImg(code) {
        code = Number(code) || 0;
        if (!code) return Promise.resolve();
        if (_imgLoaded[code]) return Promise.resolve();
        if (_imgReadyP[code]) return _imgReadyP[code];
        _imgReadyP[code] = new Promise(function (res) {
            var done = false;
            function fin(ok, src) {
                if (done) return;
                done = true;
                if (ok) { _imgLoaded[code] = true; if (src) _imgSrcOk[code] = src; }
                res();
            }
            var chain = picChain(code);
            var i = 0;
            function next() {
                if (done) return;
                if (i >= chain.length) { fin(false); return; }
                var url = chain[i++];
                try {
                    var im = new Image();
                    im.decoding = 'async';
                    im.onload = function () { fin(true, url); };
                    im.onerror = function () { next(); };
                    im.src = url;
                } catch (e) { next(); }
            }
            next();
            setTimeout(function () { fin(false); }, IMG_WAIT_MS);
        });
        return _imgReadyP[code];
    }
    function imgSrcFor(code) {
        code = Number(code) || 0;
        return _imgSrcOk[code] || (picChain(code)[0]);
    }
    function preloadImgs(codes) {
        var list = (codes || []).map(function (c) { return Number(c) || 0; }).filter(Boolean);
        if (!list.length) return Promise.resolve();
        var uniq = [];
        list.forEach(function (c) { if (uniq.indexOf(c) < 0) uniq.push(c); });
        return Promise.all(uniq.map(preloadImg));
    }
    function whenImgReady(code, cb) {
        if (!code) { try { cb(); } catch (e) {} return; }
        preloadImg(code).then(function () { try { cb(); } catch (e) {} });
    }

    function buildCardImg(code) {
        warmImg(code);          // 预热到内存缓存（同卡复用）
        var im = document.createElement('img');
        im._code = code;
        im.style.opacity = '0';
        im.style.transition = 'opacity .18s ease';
        try {
            im.addEventListener('load', function () {
                _imgLoaded[Number(code) || 0] = true;
                im.style.opacity = '1';
            });
        } catch (e) {}
        wireImgChain(im, code);
        im.src = picChain(code)[0];
        if (_imgLoaded[Number(code) || 0]) im.style.opacity = '1';
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
    // def=true：守备表示 → 横置
    // PATCH(白神服) 2026-11-05: 记录「某格曾正面出现过」的卡号 ——
    //   盖回去（或对手盖卡被效果展示后又盖上）时就能"若隐若现"地显示已知卡面（用户要求）。
    // PATCH(白神服) 2026-11-17: **实体移动**（?move=entity）
    //   旧做法：目标格新建一张卡 + 飞一个 ghost 替身 → 视觉上是"物体 + 动画"两个东西。
    //   新做法：同一张卡的 DOM 节点**跨格复用**，移动时把它从旧格子摘下来塞进新格子，
    //          再用 FLIP 从旧位置过渡到新位置 → 真正"这个物体在移动"。
    // PATCH(白神服) 2026-11-17: **手牌消息驱动** —— 开局快照里已经有手牌，
    //   但客户端是"卡组→手牌"的 Move 才让手牌出现（所以玩家看到的是逐张飞入）。
    //   这里用准入表：手牌格只有在收到进入手牌的 Move 之后才允许显示。
    var _handAdmitted = {};      // 'ctl:seq' → true
    var _handAdmitBypass = false; // 兜底：消息太少/没有 Move 时全放开
    var _entityCardEls = {};       // uid → 该卡的 DOM 节点
    // PATCH(白神服) 2026-11-18: **默认开启实体移动 + 消息驱动手牌**
    //   用户反复"没看出区别" → 说明默认路径才是他要的；保留 ?move=classic 回退
    var ENTITY_MOVE = false;   // PATCH(白神服) 2026-11-18: FLIP 方案效果不达预期，默认回到稳定版；?move=entity 仍可试用
    try { if (/[?&]move=entity(?:&|$)/.test(location.search)) ENTITY_MOVE = true; } catch (e) {}

    var knownSeen = {};
    // PATCH(白神服) 2026-11-05: 锁定消息流对手牌的增删（观战追上实时后由 handc 权威接管）
    var handLock = false;
    var lastEffect = { name: '', idx: -1 };
    var lastAttackInfo = null;   // 最近一次攻击（判定卷回用）
    var replayMode = false;      // 回放模式：双方手牌公开（复盘用）
    var pendSummonAt = 0;        // 最近一次「灵摆召唤」事件时间（BecomeTarget 两侧 P 区判定）
    var pendZones = {};          // 最近收到的 BecomeTarget 里的 P 区（ctl -> {0/4: at}）   // 最近发动效果的那张卡（用于「检索」日志）
    function markKnown(key, code) {
        if (!key || !code) return;
        knownSeen[key] = code;
        // PATCH(白神服) 2026-11-06: 同时写到**该格子里的那张卡对象**上（明牌信息必须跟着卡走，
        //   不能只按格子坐标记 —— 同格换卡会导致新卡显示成上一张，用户实测 ✗）
        try {
            var parts = String(key).split(':');
            if (parts.length >= 3) {
                var c0 = field[parts[0]] && field[parts[0]][parts[1] + ':' + parts[2]];
                if (c0) c0.knownCode = code;
            }
        } catch (e) {}
    }

    function cardNode(card, flip, def) {
        var _uidAttr = (card && card.uid) ? String(card.uid) : '';
        var w = document.createElement('div');
        w.className = 'rp-card';
        if (_uidAttr) w.setAttribute('data-uid', _uidAttr);   // 供 v2 渲染器复用节点
        if (!card) { w.className += ' rp-card-empty'; return w; }
        // 卡号不是数字（解析器对象）→ 当成未知卡，按里侧画卡背（否则会渲染成空白格）
        // 卡号无效时优先用 knownCode 兜底（额外怪兽区/场地区见过卡号的情况）
        if (card.code !== undefined && toCode(card.code) === 0 && !card.faceDown && card.knownCode) {
            card = { code: toCode(card.knownCode), faceDown: false, pos: card.pos, uid: card.uid, mats: card.mats, knownCode: card.knownCode };
        }
        if (card.code !== undefined && toCode(card.code) === 0 && !card.faceDown) {
            card = { code: 0, faceDown: true, pos: card.pos, uid: card.uid, mats: card.mats, knownCode: card.knownCode };
        }
        // PATCH(白神服) 2026-11-07: 被效果公开/检索展示的卡 —— 在**手牌里也要正面显示**，
        //   直到下一次手牌变动才回到卡背（用户要求：检索上来的卡给对手看一眼）
        if (card.revealed && toCode(card.code)) {
            w.className += ' rp-card-revealed';
            w.title = (cardName(toCode(card.code)) || String(card.code)) + '（已公开）';
            w.appendChild(takeImg(toCode(card.code)));
            if (def) w.className += ' rp-def';
            if (flip) w.className += ' rp-flip';
            try { w.style.transform = def ? (flip ? 'rotate(90deg)' : 'rotate(-90deg)') : (flip ? 'rotate(180deg)' : ''); } catch (e) {}
            return w;
        }
        if (card.faceDown) {
            // 明牌过的卡（曾正面出现 / 被效果展示过）→ 盖着也显示卡面，只是半透明"若隐若现"
            var _known = card.knownCode || 0;
            if (_known) {
                w.className += ' rp-card-known';
                w.title = (cardName(_known) || String(_known)) + '（已明牌）';
                w.appendChild(takeImg(_known));
            } else {
                w.className += ' rp-card-down';
                w.title = '盖牌';
            }
        }
        else if (!card.code) {
            // PATCH(白神服) 2026-11-05: 有卡但卡号未知（手牌里被效果展示/发动时最容易遇到）→ 画**背面**，
            //   不能画成空白格（用户实测：从手牌发动效果时那张手卡"没有卡图"= 一片空白 ✗）
            //   ⚠ 真正的空槽位走的是 cardNode(null) 的 rp-card-empty 分支，不受这里影响。
            w.className = 'rp-card rp-card-down';
            w.title = '未知卡';
        }
        else {
            var nm = cardName(card.code);
            w.title = escapeHtml(nm || card.code);
            w.appendChild(takeImg(card.code));
            // PATCH: 等级角标**不放在卡面里** —— 守备表示时卡面会 rotate(-90deg)，
            //   角标在卡内就会跟着转走（玩家实测："守备怪兽的等级应该保持在左上角"）。
            //   → 角标改由 setCellCard() 挂到**格位**上（格位不旋转）。
        }
        if (def) w.className += ' rp-def';
        if (flip) w.className += ' rp-flip';
        // PATCH(白神服) 2026-11-07: 横置方向**直接写内联样式** ——
        //   只靠 CSS 类时，盖放的怪兽（对手侧）有时仍是竖着的卡背（用户实测 ✗）。
        //   内联 inline style 优先级最高，不受后续样式表/类顺序影响。
        try {
            if (def) {
                w.style.transform = flip ? 'rotate(90deg)' : 'rotate(-90deg)';
                w.style.transformOrigin = '50% 50%';
            } else if (flip) {
                w.style.transform = 'rotate(180deg)';
                w.style.transformOrigin = '50% 50%';
            }
        } catch (e) {}
        return w;
    }

    // 单元格精确更新：同卡同状态/同朝向/同素材数/同攻守数据不动 DOM；否则重建并回收旧图
    // statKey: "ctl:loc:seq"，用于查该格实时攻守数据
    /** 原地翻面动画（照 MDPro3 的 CardPlane 绕 Y 转 180°，0.15s）——
     *  不另建浮层，直接用格子里的那张卡，所以尺寸/朝向永远正确（魔陷不会被转横） */
    function flipNodeIn(cell, def, horizontal) {
        try {
            if (!cell) return;
            var node = cell.querySelector('.rp-card');
            if (!node) return;
            var base = def ? 'rotate(-90deg)' : '';
            // 魔法/陷阱翻开：从左侧翻开（rotateY）；怪兽翻面：从上侧翻开（rotateX）
            var axis = horizontal ? 'rotateY' : 'rotateX';
            node.style.transition = 'none';
            node.animate([
                { transform: 'perspective(900px) ' + base + ' ' + axis + '(-180deg)', offset: 0 },
                { transform: 'perspective(900px) ' + base + ' ' + axis + '(0deg)', offset: 1 }
            ], { duration: 150, easing: 'cubic-bezier(.4,0,.2,1)' });
        } catch (e) {}
    }

    function setCellCard(cell, card, flip, def, statKey, withStat) {
        if (!cell) return;
        // 禁止令离场/换卡：宣言只属于当时那张卡，格子空了或换人了就清掉，
        // 否则新盖到同格的魔法陷阱会继承上一条宣言卡名（用户实测 ✗）。
        try {
            if (statKey) {
                var _annOwner = announcedOwner[statKey];
                if (!card) {
                    // 快照/重画会短暂出现空格：不要立刻抹掉宣言，等 600ms 仍为空再清。
                    // 禁止令发动后的那一瞬间原来是 uid 变了一下就被清，用户实测 ✗。
                    if (announcedByCell[statKey] && !announcedClearTimer[statKey]) {
                        announcedClearTimer[statKey] = setTimeout(function () {
                            delete announcedClearTimer[statKey];
                            try {
                                var _p = String(statKey).split(':');
                                var _c = field[Number(_p[0])] && field[Number(_p[0])][Number(_p[1]) + ':' + Number(_p[2])];
                                if (!_c) {
                                    delete announcedByCell[statKey];
                                    delete announcedOwner[statKey];
                                    updateZone(Number(_p[0]), Number(_p[1]));
                                }
                            } catch (e) {}
                        }, 600);
                    }
                } else {
                    if (announcedClearTimer[statKey]) {
                        clearTimeout(announcedClearTimer[statKey]);
                        delete announcedClearTimer[statKey];
                    }
                    if (_annOwner) {
                        // 只按卡号判断换卡；uid 会随快照变，不能拿它清宣言。
                        if (_annOwner.code && card.code && _annOwner.code !== card.code) {
                            delete announcedByCell[statKey];
                            delete announcedOwner[statKey];
                        } else if (!_annOwner.code && card.code) {
                            _annOwner.code = card.code;
                        }
                    }
                }
            }
        } catch (e) {}
        if (card) {
            // 正面出现过 → 记住卡号；之后盖回去就靠它显示"若隐若现"
            // PATCH(白神服) 2026-11-06: 明牌只在**这张卡自己身上**记 —— 原来按「格子坐标」记
            //   （ctl:loc:seq），同格换了一张卡之后，新盖下的卡会继承上一张的「明牌」信息
            //   → 明明是 A 被翻开过，B 盖在这里却显示成 A 的半透明卡图（用户实测 ✗）。
            //   现在：正面出现过就把卡号写到该卡自己的 knownCode 上；卡离场对象销毁，信息随之消失。
            if (!card.faceDown && card.code) card.knownCode = card.code;
            if (!card.faceDown) card._hideKnown = false;
            // 里侧但卡号已知（自己盖的卡 / 被效果翻开过的卡）→ 半透明显示卡面
            // PATCH(白神服) 2026-11-07: 观战视角下**对手的盖卡**不能因为"自己知道卡号"就变半透明 ——
            //   那会让盖卡看起来像明牌（用户实测：观战里盖卡变成透明卡 ✗）。
            //   只有被效果真正公开过（ConfirmCards 写入 knownCode）才显示呼吸。
            // PATCH(白神服) 2026-11-18: 效果盖放翻开展示结束后要显示纯卡背；
            //   _hideKnown 标记的卡不再把 code 回填到 knownCode。
            if (card.faceDown && card.code && !card._hideKnown && (!flip || !window.__ypWatchMode)) card.knownCode = card.code;
            var f = !!flip, d = !!def;
            var _statRec = statKey ? cardStatByKey[statKey] : null;
            // PATCH(白神服) 2026-11-17: 素材「闪一下就消失」——后续快照没带 overlay 查询时
            //   mats 会变回 0，那一次重建（innerHTML=''）就把叠图抹掉了。
            //   这里用**上一帧记住的素材信息**兜底，只有明确换卡/素材归零才清。
            var _prevMats = cell._matN | 0;
            var _prevCodes = cell._matCodes || [];
            var mats = card.mats || (_statRec && _statRec.mats) || 0;
            var _ovCodes = (card.overlayCodes && card.overlayCodes.length)
                ? card.overlayCodes : ((_statRec && _statRec.overlayCodes) || []);
            // 只有「这份数据根本没提素材」(undefined) 才沿用上一帧；
            // 明确 mats===0（素材取除）时要真清掉
            var _explicitZero = (card.mats === 0 && card.overlayCodes !== undefined);
            if (!mats && _prevMats && !card.faceDown && !_explicitZero) { mats = _prevMats; }
            else if (_explicitZero) { _ovCodes = []; }
            if ((!_ovCodes || !_ovCodes.length) && _prevCodes.length) _ovCodes = _prevCodes;
            try { cell._matN = mats | 0; cell._matCodes = (_ovCodes || []).slice(0, 6); } catch (e) {}
            var st = (!card.faceDown && statKey) ? statFor(statKey, card.code) : null;
            // PATCH: 是否算"调整"来自实时类型(type & 0x1000)，而 statFor() 的返回值不含 type ✗
            //   → 只把 statSig(st) 当签名时，"被效果赋予调整"这类**只变 type** 的更新不会触发重建，
            //   角标颜色就永远不变（玩家实测：强袭黑羽·泪雨之千鸟刀鸟 应显示为调整却仍是白色）。
            var __tunBit = 0;
            try {
                var __rr = cardStatByKey[statKey];
                if (__rr && typeof __rr.type === 'number') __tunBit = (__rr.type & 0x1000) ? 1 : 0;
            } catch (e) {}
            var _ann = (announcedByCell[statKey] || []).join('、');
            var sig = statSig(st) + '|t' + __tunBit + '|a' + _ann
                + '|cnt' + counterSigOf(statKey) + '|ch' + (cellChain[statKey] || 0);
            // PATCH: 等级/攻守被效果改过时，角标要显示**当前**等级（取实时 stat，取不到才用基础值）
            var __liveLv = null;
            try {
                if (!card.faceDown && statKey) {
                    var __st = statFor(statKey, card.code);
                    if (__st && typeof __st.level === 'number' && __st.level) __liveLv = __st.level;
                }
            } catch (e) {}
            if (__liveLv) {
                var __lb2 = cell.querySelector('.rp-lv');
                if (__lb2 && __lb2.textContent !== ('L' + __liveLv)) {
                    __lb2.textContent = 'L' + __liveLv;
                    cell._statSig = '';           // 触发重建，让下面那段重画时带上新等级
                }
            }
            if (cell._code === card.code && cell._down === !!card.faceDown && cell._flip === f
                && cell._def === d && cell._mats === mats && cell._statSig === sig
                && cell.querySelector('.rp-card') && cell.style.opacity !== '0') return;
            // PATCH(白神服) 2026-11-17: 表示形式变更（攻击↔守备）**原地旋转**，不重建节点 ——
            //   参考 MDPro3 的 ModelAt/ResetModelRotation：先重置旋转，再按新朝向设一次
            //   重建的话卡片会"啪"地跳成横/竖，没有过渡（用户要求有动画）
            try {
                var _node = cell.querySelector('.rp-card');
                if (_node && cell._code === card.code && cell._down === !!card.faceDown
                    && cell._mats === mats && cell._statSig === sig && cell.style.opacity !== '0') {
                    if (cell._def !== d || cell._flip !== f) {
                        _node.classList.toggle('rp-def', !!d);
                        _node.classList.toggle('rp-flip', !!f);
                        _node.style.transition = 'transform .16s ease';
                        _node.style.transform = d ? (f ? 'rotate(90deg)' : 'rotate(-90deg)')
                                                  : (f ? 'rotate(180deg)' : 'rotate(0deg)');
                        cell._def = d;
                        cell._flip = f;
                        return;
                    }
                }
            } catch (e) {}
            var _wasDown = !!cell._down;
            // 实体移动：本格要变空 → 先把这张卡的节点寄存起来（不销毁），等移动的另一头复用
            if (ENTITY_MOVE && card && card.uid) {
                try { cell._uid = String(card.uid); } catch (e) {}
            }
            // 实体移动：如果这张卡（uid）已经有节点，就把它摘出来复用，并记录旧位置
            var _reuseEl = null, _fromRect = null;
            if (ENTITY_MOVE && card && card.uid) {
                var _k = String(card.uid);
                var _rec = _entityCardEls[_k];
                if (_rec && _rec.el) {
                    _fromRect = (_rec.el.parentNode ? _rec.el.getBoundingClientRect() : _rec.rect) || _rec.rect;
                    if (_rec.el.parentNode) _rec.el.parentNode.removeChild(_rec.el);
                    _reuseEl = _rec.el;
                    delete _entityCardEls[_k];
                }
            }
            // 实体移动：格子变空时，把这里的卡片节点寄存起来，等目的地复用（不销毁、不回收）
            if (ENTITY_MOVE) {
                try {
                    var _oldNode = cell.querySelector('.rp-card');
                    var _oldUid = _oldNode && _oldNode.getAttribute('data-uid');
                    if (_oldNode && _oldUid) {
                        _entityCardEls[_oldUid] = { el: _oldNode, rect: _oldNode.getBoundingClientRect(), ts: Date.now() };
                    }
                    // 清理超过 2 秒没被复用的寄存节点，避免泄漏
                    var _now = Date.now();
                    Object.keys(_entityCardEls).forEach(function (k) {
                        var r = _entityCardEls[k];
                        if (!r || !r.el) { delete _entityCardEls[k]; return; }
                        if (!r.el.parentNode && _now - (r.ts || 0) > 2000) {
                            if (r.el.parentNode) r.el.parentNode.removeChild(r.el);
                            delete _entityCardEls[k];
                        }
                    });
                } catch (e) {}
            }
            giveImgsIn(cell);
            cell.innerHTML = '';
            var _node = _reuseEl || cardNode(card, f, d);
            cell.appendChild(_node);
            if (ENTITY_MOVE && card && card.uid) {
                try {
                    _entityCardEls[String(card.uid)] = { el: _node, rect: _node.getBoundingClientRect(), ts: Date.now() };
                } catch (e) {}
            }
            // FLIP：先瞬移到旧位置，再过渡到新位置（同一个节点，真正的位移）
            if (_fromRect) {
                try {
                    // PATCH(白神服) 2026-11-18: 终点矩形必须在**下一帧**量 —— 刚 append 时
                    //   格子可能还没应用守备/翻转的 transform，量到的位置偏左（用户实测）。
                    var _nodeRef = _node, _from = _fromRect;
                    _nodeRef.style.transition = 'none';
                    requestAnimationFrame(function () {
                        try {
                            var _to = _nodeRef.getBoundingClientRect();
                            var _dx = _from.left - _to.left, _dy = _from.top - _to.top;
                            var _sc = _to.width ? (_from.width / _to.width) : 1;
                            if (Math.abs(_dx) < 1 && Math.abs(_dy) < 1 && Math.abs(_sc - 1) < 0.02) return;
                            // 把节点自身的旋转（守备 -90 / 对手 180）一起带上 ——
                            //   只用 translate+scale 会把 CSS 里的 rotate 覆盖掉，飞行中看着歪（用户实测）
                            var _ang = 0;
                            try {
                                var _mm = getComputedStyle(_nodeRef).transform;
                                if (_mm && _mm !== 'none' && _mm.indexOf('matrix(') === 0) {
                                    var _v = _mm.slice(7, -1).split(',').map(Number);
                                    _ang = Math.round(Math.atan2(_v[1], _v[0]) * 180 / Math.PI);
                                }
                            } catch (e) {}
                            _nodeRef.style.transform = 'translate(' + _dx + 'px,' + _dy + 'px)'
                                + ' scale(' + _sc + ')' + (_ang ? (' rotate(' + _ang + 'deg)') : '');
                            requestAnimationFrame(function () {
                                _nodeRef.style.transition = 'transform .28s cubic-bezier(.22,.61,.36,1)';
                                _nodeRef.style.transform = '';
                            });
                        } catch (e) {}
                    });
                } catch (e) {}
            }
            // PATCH(白神服) 2026-11-17: 里侧 → 表侧：**原地翻面**（mdpro3 方式，不用浮层）
            try {
                if (_wasDown && !card.faceDown) {
                    var _flipLoc = statKey ? Number(String(statKey).split(':')[1]) : 0;
                    flipNodeIn(cell, d, _flipLoc === LOC.SZONE);
                }
            } catch (e) {}
            // PATCH: 等级角标挂在**格位**上（不随卡面旋转）——
            //   守备表示时卡面会 rotate(-90deg)，角标若在卡内就跟着转走
            //   （玩家实测："守备怪兽的等级应该保持在左上角，而不是卡图的左上角"）。
            (function () {
                // PATCH: 右上角**属性角标**（和等级同款；挂格位上、不随卡面旋转 ✓）
                //   玩家要求：有些卡会"当作送去墓地那只的属性"使用，前端必须能看到属性；
                //   风地炎水光暗不同颜色，位置和等级差不多 ✓
                var __am = cardMetaMap[String(card.code)];
                var __ab = (card.faceDown || !__am) ? 0 : (__am.attribute || 0);
                var __aOld = cell.querySelector('.rp-attr');
                var __keys = [1, 2, 4, 8, 16, 32, 64];
                var __names = ['地', '水', '炎', '风', '光', '暗', '神'];
                var __cls = ['earth', 'water', 'fire', 'wind', 'light', 'dark', 'divine'];
                var __ai = __keys.indexOf(__ab);
                if (__ai < 0) { if (__aOld) __aOld.parentNode.removeChild(__aOld); }
                else {
                    var __a = __aOld || document.createElement('span');
                    __a.className = 'rp-attr rp-attr-' + __cls[__ai];
                    __a.textContent = __names[__ai];
                    __a.title = '属性：' + __names[__ai];
                    if (!__aOld) cell.appendChild(__a);
                }
                var _meta = cardMetaMap[String(card.code)];
                var _lv = (card.faceDown || !_meta || !_meta.level) ? 0 : _meta.level;
                var _old = cell.querySelector('.rp-lv');
                if (!_lv) { if (_old) _old.parentNode.removeChild(_old); return; }
                var _isT = ((_meta.subs) || []).indexOf('调整') >= 0;
                var _lb = _old || document.createElement('span');
                _lb.className = 'rp-lv' + (_isT ? ' rp-lv-tuner' : '');
                _lb.textContent = 'L' + _lv;
                _lb.title = (_isT ? '调整怪 · ' : '') + '等级 ' + _lv;
                if (!_old) cell.appendChild(_lb);
            })();
            // ── 指示物角标（叠在等级角标下面）+ 连锁序号角标 ──
            (function () {
                var key = statKey;
                var oldC = cell.querySelector('.rp-counter');
                // 格位换过卡（卡号不同）→ 旧计数作废
                if (key && cellCounters[key] && card.code && cellCounters[key].code !== toCode(card.code)) {
                    delete cellCounters[key];
                }
                var total = key ? counterTotalOf(key) : 0;
                if (!total) { if (oldC) oldC.parentNode.removeChild(oldC); }
                else {
                    var cEl = oldC || document.createElement('span');
                    cEl.className = 'rp-counter';
                    var parts = [];
                    var rec = cellCounters[key];
                    if (rec && rec.map) {
                        Object.keys(rec.map).forEach(function (t) { parts.push('类型' + t + ' × ' + rec.map[t]); });
                    }
                    cEl.textContent = '◆' + total;
                    cEl.title = '指示物：' + parts.join('、');
                    if (!oldC) cell.appendChild(cEl);
                }
                // PATCH(白神服) 2026-11-19: **不再画卡图上的 C1/C2 金色连锁角标**（用户要求去掉）。
                //   连锁信息已经在线条/日志里，卡图角标既挡卡面又和「◆指示物」挤在一起。
                //   数据（cellChain）保留，sig 里仍带着它，避免不必要的重绘判断变化。
                var oldH = cell.querySelector('.rp-chain');
                if (oldH) oldH.parentNode.removeChild(oldH);
            })();
            // PATCH: 效果改过等级（如黑羽-沙尘之哈麦丹 以 2 星怪兽为对象把自身等级 +2）时，
            // 角标要显示**当前**等级 —— 取实时 stat，取不到就用卡表基础值（实测玩家指出过 ✗）。
            try {
                if (!card.faceDown && statKey) {
                    var __lv2 = statFor(statKey, card.code);
                    var __lb3 = cell.querySelector('.rp-lv');
                    if (__lb3) {
                        if (__lv2 && typeof __lv2.level === 'number' && __lv2.level) {
                            __lb3.textContent = 'L' + __lv2.level;
                            __lb3.title = '等级 ' + __lv2.level + '（实时）';
                        }
                        // 是否算"调整"要看**实时类型**（效果可动态赋予调整 0x1000）。
                        // ⚠ 注意：statFor() 的返回对象是"挑选过的字段"，**不含 type** —— 必须直接读该格缓存记录。
                        var __rec = cardStatByKey[statKey];
                        var __isT = null;
                        if (__rec && typeof __rec.type === 'number') __isT = (__rec.type & 0x1000) !== 0;
                        if (__isT === null) {
                            var __mm2 = cardMetaMap[String(card.code)];
                            __isT = (((__mm2 && __mm2.subs) || []).indexOf('调整') >= 0);
                        }
                        __lb3.classList.toggle('rp-lv-tuner', !!__isT);
                        __lb3.title = (__isT ? '调整怪 · ' : '') + __lb3.textContent.replace('L', '等级 ') + '（实时）';
                    }
                }
            } catch (e) {}
            if (mats <= 0) {
                try {
                    var _stale = cell.querySelectorAll('.rp-mat');
                    for (var _si = 0; _si < _stale.length; _si++) _stale[_si].parentNode.removeChild(_stale[_si]);
                } catch (e) {}
                try { cell._matN = 0; cell._matCodes = []; } catch (e) {}
            }
            if (mats > 0) {
                // PATCH(白神服) 2026-11-18: 超量素材按宿主卡尺寸摆（用户实测 ✗ 之前是格子尺寸）：
                //   · 有素材卡号就显示卡图（不是卡背）
                //   · 与宿主卡同宽高，朝外侧错开 12%，逐层再错 6%
                //   · 垫在宿主卡下面（z-index 0 / 宿主 1）
                try {
                    var _matCodes = (_ovCodes || []);
                    var _matN = Math.max(_matCodes.length, Math.min(mats, 6));
                    var _isOpp = !!flip;              // flip=true 表示对手侧（整块倒置）
                    var _hw = (_node && _node.offsetWidth) ? _node.offsetWidth : Math.round(cell.clientWidth * 59 / 86);
                    var _hh = (_node && _node.offsetHeight) ? _node.offsetHeight : cell.clientHeight;
                    var _hl = (_node && _node.offsetLeft) ? _node.offsetLeft : Math.round((cell.clientWidth - _hw) / 2);
                    var _ht = (_node && _node.offsetTop) ? _node.offsetTop : 0;
                    try { if (_node) _node.style.zIndex = '1'; } catch (e) {}
                    for (var mi = _matN - 1; mi >= 0; mi--) {
                        var mim = document.createElement('img');
                        mim.className = 'rp-mat' + (_isOpp ? ' opp' : '');
                        var _mc = _matCodes[mi] || 0;
                        mim.src = _mc ? (picChain(_mc)[0] || CARD_BACK_URI) : CARD_BACK_URI;
                        mim.alt = '';
                        if (_mc) { mim.setAttribute('data-code', String(_mc)); mim.title = cardName(_mc) || ('#' + _mc); }
                        mim.style.width = _hw + 'px';
                        mim.style.height = _hh + 'px';
                        mim.style.boxSizing = 'border-box';
                        var _ox = _hw * (0.12 + 0.06 * mi);
                        var _oy = _hh * 0.05;
                        if (_isOpp) {
                            mim.style.left = (_hl - _ox) + 'px';
                            mim.style.top = (_ht - _oy) + 'px';
                        } else {
                            mim.style.left = (_hl + _ox) + 'px';
                            mim.style.top = (_ht + _oy) + 'px';
                        }
                        mim.style.zIndex = '0';
                        cell.appendChild(mim);
                    }
                } catch (e) {}
                var mb = document.createElement('span');
                mb.className = 'rp-mats';
                mb.textContent = '◆' + mats;   // 超量素材数
                mb.title = '超量素材 ' + mats;
                cell.appendChild(mb);
            }
            // 攻守角标 + 连接标记箭头（仅怪兽区；魔陷/场地区不显示攻守）
            // PATCH(白神服) 2026-11-17: 衍生物**也有实时攻守**（用户实测：token 的攻守会变），
            //   所以不做特殊屏蔽，按普通怪兽一起显示
            var isMonsterStat = st && (st.type === undefined || (st.type & 0x1) !== 0);
            if (withStat && st && isMonsterStat) {
                var badge = document.createElement('span');
                var isLink = !!st.link;
                var cur = st.atk;
                var base = st.batk;
                // siro-unknown-stat: 攻守是「？」的卡，卡池/query 里给的是 **-2** ✗（实测 117 张）
                //   → 直接画成 "-2" 是错的 ✓（玩家反馈：「-2攻击力的怪兽的攻击力其实是？攻击力」）
                try {
                    if (typeof cur === 'number' && cur < 0) cur = '?';
                    if (typeof base === 'number' && base < 0) base = '?';
                } catch (e) {}
                var curDef = st.def;
                try { if (typeof curDef === 'number' && curDef < 0) curDef = '?'; } catch (e) {}
                var txt;
                if (isLink) {
                    txt = (cur !== undefined ? cur : '?') + '/L' + st.link;
                } else if (curDef !== undefined) {
                    txt = (cur !== undefined ? cur : '?') + '/' + curDef;
                } else if (cur !== undefined) {
                    txt = String(cur);          // 守备力未知时只显示攻击力，不显示 "?"
                } else {
                    txt = '';
                }
                if (txt) {
                    badge.className = 'rp-stat' + (d ? ' def-pos' : '')
                        + ((base !== undefined && cur !== undefined && base !== cur) ? ' atk-up' : '');
                    badge.textContent = txt;
                    badge.title = (cardName(card.code) || card.code)
                        + (isLink ? ('  攻击 ' + cur + '  连接 ' + st.link)
                            : ('  攻击 ' + cur + (curDef !== undefined ? '  守备 ' + curDef : '  守备 ?')))
                        + (base !== undefined ? ('  (基础 ' + base + '/' + (st.bdef !== undefined ? (st.bdef < 0 ? '?' : st.bdef) : '?') + ')') : '');
                    cell.appendChild(badge);
                }
                if (isLink && st.marker) {
                    var marks = linkMarkerDirs(st.marker, f);
                    marks.forEach(function (dir) {
                        var a = document.createElement('i');
                        a.className = 'rp-lmark ' + dir;
                        cell.appendChild(a);
                    });
                }
            }
            try {
                var _oldAnn = cell.querySelector('.rp-announce');
                if (_ann) {
                    if (!_oldAnn) {
                        _oldAnn = document.createElement('div');
                        _oldAnn.className = 'rp-announce';
                        cell.appendChild(_oldAnn);
                    }
                    _oldAnn.textContent = _ann;
                } else if (_oldAnn) {
                    _oldAnn.parentNode.removeChild(_oldAnn);
                }
            } catch (e) {}
            cell._code = card.code;
            cell._down = !!card.faceDown;
            cell._flip = f;
            cell._def = d;
            cell._mats = mats;
            cell._statSig = sig;
            // PATCH(白神服) 2026-11-07: **盖放的卡不参与演出隐藏** ——
            //   之前盖卡会被上一段动画留下的 _fxHold 一直压成 opacity:0，
            //   看起来就是"动画结束卡就消失了"（用户实测 ✗）
// 清掉可能残留的"整格卡背"（旧版兜底写进去的，会让盖卡看起来铺满格子）
            cell.style.backgroundImage = '';
            cell.style.backgroundColor = '';
            cell.style.opacity = (cell._fxHold && !card.faceDown) ? '0' : '';
            if (card.faceDown) { cell._fxHold = false; }
            if (!card.faceDown) warmCardImg(card.code);
        } else {
            if (cell._code !== undefined || cell.innerHTML !== '') {
                cell.style.backgroundImage = '';
                cell.style.backgroundColor = '';
                giveImgsIn(cell);
                cell.innerHTML = '';
                cell._code = null;
                cell._down = false;
                cell._flip = false;
                cell._def = false;
                cell._mats = 0;
                cell._statSig = '';
            }
        }
    }

    // 连接标记位 → 方向类名；对手的卡整体倒置，上下需要互换
    function linkMarkerDirs(marker, mirrorV) {
        var map = [
            [LMARK.TOP, 'top'], [LMARK.BOTTOM, 'bottom'], [LMARK.LEFT, 'left'], [LMARK.RIGHT, 'right'],
            [LMARK.TL, 'tl'], [LMARK.TR, 'tr'], [LMARK.BL, 'bl'], [LMARK.BR, 'br'],
        ];
        var out = [];
        map.forEach(function (pair) {
            if (!(marker & pair[0])) return;
            var dir = pair[1];
            // PATCH(白神服) 2026-11-17: 对手的场是**倒着摆的（旋转 180°）**，
            //   连接箭头要**上下左右全反转**（用户实测：只换左右不对）
            if (mirrorV) {
                dir = ({ top: 'bottom', bottom: 'top', left: 'right', right: 'left',
                    tl: 'br', br: 'tl', tr: 'bl', bl: 'tr' })[dir] || dir;
            }
            out.push(dir);
        });
        return out;
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
            if (attempt >= trySrcs.length) { cardDomCache[code] = 'cover2.jpg?v=20261108a'; return; }
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
    /** 卡片**元素**的矩形（比格子小一圈）。特效/翻转/移动动画都该用这个，别用格子矩形 ——
     *  否则动画里的卡图会"占满格子"（用户实测 ✗） */
    function cardRectAt(ctl, locRaw, seq) {
        try {
            var key = ctl + ':' + (locRaw & 0xff) + ':' + seq;
            var cell = zoneEls[key];
            if (!cell && (locRaw & 0xff) === LOC.MZONE && seq >= 5) cell = zoneEls[emzKey(ctl, seq)];
            if (cell) {
                var cardEl = cell.querySelector('.rp-card');
                if (cardEl) {
                    var r = cardEl.getBoundingClientRect();
                    if (r.width > 2) return r;
                }
            }
        } catch (e) {}
        return rectAt(ctl, locRaw, seq);
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
        }
        if (l2 === LOC.MZONE && seq >= 5) {
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
    // 取格子元素（与 rectAt 同样的定位规则，用于临时隐藏/高亮）
    /**
     * 攻击动作（照 ygopro 客户端 duelclient.cpp 的 MSG_ATTACK）：
     *   客户端算 atk_t = 攻击者与目标的**中点**、atk_r = 朝向目标的旋转，
     *   让攻击怪朝中点冲过去再回位；直接攻击时中点在对方玩家半场。
     *   这里用 WAAPI 做同样的"冲向中点 → 回位"。
     */
    function attackLungeAnim(aCtl, aLocRaw, aSeq, tCtl, tLocRaw, tSeq) {
        try {
            var aEl = cellElFor(aCtl, aLocRaw, aSeq);
            var aNode = aEl && aEl.querySelector('.rp-card');
            if (!aNode) return;
            var aR = aNode.getBoundingClientRect();
            var tx, ty;
            if (tCtl === 0 || tCtl === 1) {
                var tEl = cellElFor(tCtl, tLocRaw, tSeq);
                var tNode = tEl && tEl.querySelector('.rp-card');
                if (!tNode) return;
                var tR = tNode.getBoundingClientRect();
                tx = (aR.left + aR.width / 2 + tR.left + tR.width / 2) / 2;
                ty = (aR.top + aR.height / 2 + tR.top + tR.height / 2) / 2;
            } else {
                // 直接攻击：中点落在对方半场中央（客户端 xd=3.95, yd=±3.5）
                tx = aR.left + aR.width / 2;
                ty = aR.top + (aCtl === 0 ? -160 : 160);
            }
        } catch (e) {}
    }

    function cellElFor(ctl, locRaw, seq) {
        var l2 = locRaw & 0xff;
        if (l2 === LOC.MZONE && seq >= 5) return zoneEls[emzKey(ctl, seq)] || null;
        if (l2 === LOC.SZONE && seq === 5) return zoneEls[ctl + ':' + LOC.SZONE + ':5'] || null;
        return zoneEls[ctl + ':' + l2 + ':' + seq] || null;
    }

    // 移动动画的“目标常驻节点”key：与 field-render 的 key 规则一致。
    // 同时给 uid/z 两种候选，避免节点刚重建时 uid 还没写上的空档。
    function animHideKeysAt(ctl, locRaw, seq) {
        try {
            var cell = cellElFor(ctl, locRaw, seq);
            if (!cell) return '';
            var z = cell.getAttribute('data-zone');
            var out = [];
            var l2 = locRaw & 0x7f;
            var mcard = field[ctl] && field[ctl][l2 + ':' + seq];
            if (mcard && mcard.uid) out.push('u' + mcard.uid);
            var card = cell.querySelector('.rp-card');
            var uid = card && card.getAttribute('data-uid');
            if (uid && uid !== '0' && out.indexOf('u' + uid) < 0) out.push('u' + uid);
            if (z) out.push('z:' + z);
            return out.join(',');
        } catch (e) { return ''; }
    }
    function animHideKeysForHandSlot(el) {
        try {
            var hand = el && el.closest ? el.closest('.rp-hand') : null;
            if (!hand) return '';
            var card = el.classList && el.classList.contains('rp-card') ? el : el.querySelector('.rp-card');
            if (!card) return '';
            var cards = hand.querySelectorAll('.rp-card');
            var idx = Array.prototype.indexOf.call(cards, card);
            if (idx < 0) return '';
            return 'h:' + (hand.getAttribute('data-zone') || '') + ':i' + idx;
        } catch (e) { return ''; }
    }
    function animHideKeysForHandSeq(ctl, seq) {
        try {
            var hand = document.querySelector('.rp-hand[data-zone="' + ctl + ':2"]');
            if (!hand) return '';
            var cards = hand.querySelectorAll('.rp-card');
            return animHideKeysForHandSlot(cards[seq]);
        } catch (e) { return ''; }
    }
    // 手牌来源格：按卡号定位（不依赖 seq，防止压缩/洗牌后错位导致没动画）
    // PATCH(白神服) 2026-11-05: 手牌 → 场上的移动动画原来只按"卡号"找起点，
    //   隐藏手牌（观战/对手）卡号是 0、Move 里给的是真实卡号 → 找不到起点 → **完全没有移动动画**（用户实测）。
    //   现在：卡号找不到就按序号找，再不行就取最后一张手牌当起点。
    function rectAtHandBySeq(ctl, seq) {
        var cont = zoneEls[ctl + ':' + LOC.HAND];
        if (!cont || !cont.children.length) return null;
        var i = Math.min(Math.max(seq | 0, 0), cont.children.length - 1);
        var el = cont.children[i];
        return el ? el.getBoundingClientRect() : null;
    }
    function rectAtHandAny(ctl) {
        var cont = zoneEls[ctl + ':' + LOC.HAND];
        if (!cont || !cont.children.length) return null;
        var el = cont.children[cont.children.length - 1];
        return el ? el.getBoundingClientRect() : null;
    }

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

    // 翻开盖卡：卡片 3D 翻转（盖牌→正面）
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

    // 超量叠放：素材卡飞向宿主并缩小叠入
    function overlayStackFx(srcRect, dstRect, cardCode) {
        if (animSuppress || !srcRect || !dstRect || !srcRect.width || !dstRect.width) return;
        var g = fxEl('rp-fly', srcRect.width, srcRect.height, srcRect.left, srcRect.top);
        g.style.transition = 'none';   // 用 WAAPI 精确控制
        if (cardCode) {
            var im = buildCardImg(cardCode);
            im.style.width = '100%';
            im.style.height = '100%';
            im.style.objectFit = 'cover';
            g.appendChild(im);
        }
        var tx = (dstRect.left + dstRect.width / 2) - srcRect.width / 2 - srcRect.left;
        var ty = (dstRect.top + dstRect.height / 2) - srcRect.height / 2 - srcRect.top;
        function done() { if (g.parentNode) g.parentNode.removeChild(g); }
        try {
            g.animate([
                { transform: 'translate(0px,0px) scale(1)', opacity: 1, offset: 0 },
                { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(0.55)', opacity: 1, offset: 0.7 },
                { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(0.28)', opacity: 0, offset: 1 }
            ], { duration: 330, easing: 'cubic-bezier(.3,.7,.4,1)' }).onfinish = done;
        } catch (e) { /* 忽略 */ }
        setTimeout(done, 430);
    }

    // ══════════ 召唤演出（融合/同调/超量/灵摆/连接）══════════
    var matBuf = [];   // 最近用于召唤的素材：{code, rect, idx}

    function pushMat(code, rect) {
        if (!rect) return;
        matBuf.push({ code: code, rect: rect, idx: idx });
        if (matBuf.length > 12) matBuf.shift();
    }
    function takeMats() {
        var out = matBuf.filter(function (m) { return idx - m.idx <= 14; });
        matBuf = [];
        return out;
    }
    function centerOf(rect) { return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; }

    // 单颗光球（含拖尾）从 (sx,sy) 飞向 target
    function spawnOrbGroup(sx, sy, target, color, swirl, delay0) {
        var dx = target.x - sx, dy = target.y - sy;
        var near = Math.sqrt(dx * dx + dy * dy) < 45;
        var dur = near ? 780 : 560;
        for (var t = 0; t < 3; t++) {
            (function (sx0, sy0, dx0, dy0, delay, size, alpha, isNear, durMs) {
                setTimeout(function () {
                    var o = fxEl('rp-orb', size, size, sx0 - size / 2, sy0 - size / 2);
                    o.style.background = color;
                    o.style.boxShadow = '0 0 12px 4px ' + color;
                    o.style.opacity = String(alpha);
                    var frames;
                    if (isNear) {
                        frames = [
                            { transform: 'translate(0px,0px) scale(1)', opacity: alpha, offset: 0 },
                            { transform: 'translate(-86px,-60px) scale(1.12)', opacity: alpha, offset: 0.36 },
                            { transform: 'translate(-48px,-104px) scale(1.05)', opacity: alpha, offset: 0.6 },
                            { transform: 'translate(12px,-42px) scale(0.85)', opacity: alpha * 0.85, offset: 0.84 },
                            { transform: 'translate(0px,0px) scale(0.2)', opacity: 0, offset: 1 }
                        ];
                    } else {
                        var midX = dx0 * 0.45 + (swirl ? dy0 * 0.22 : 0);
                        var midY = dy0 * 0.45 - (swirl ? dx0 * 0.22 : 0);
                        frames = [
                            { transform: 'translate(0px,0px) scale(1)', opacity: alpha, offset: 0 },
                            { transform: 'translate(' + midX + 'px,' + midY + 'px) scale(1.15)', opacity: alpha, offset: 0.55 },
                            { transform: 'translate(' + dx0 + 'px,' + dy0 + 'px) scale(0.2)', opacity: 0, offset: 1 }
                        ];
                    }
                    var anim = null;
                    try {
                        anim = o.animate(frames, { duration: durMs, easing: 'cubic-bezier(.35,.6,.35,1)' });
                    } catch (e) { /* ignore */ }
                    if (anim) { anim.onfinish = function () { if (o.parentNode) o.parentNode.removeChild(o); }; }
                    setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, durMs + delay + 240);
                }, delay);
            })(sx, sy, dx, dy, (delay0 || 0) + t * 45, 16 - t * 4, 1 - t * 0.3, near, dur);
        }
        return dur + (delay0 || 0);
    }

    // 彩色光球（带拖尾）飞向中心 —— 超量金色 / 连接红色
    // 素材本来就在目标位置（位移≈0）时，改为向左上角绕一圈再回到目标
    function fxOrbs(srcRects, target, color, swirl) {
        var n = Math.max(1, srcRects.length);
        for (var i = 0; i < n; i++) {
            var r = srcRects[i] || null;
            var sx = r ? r.left + r.width / 2 : target.x;
            var sy = r ? r.top + r.height / 2 : target.y;
            spawnOrbGroup(sx, sy, target, color, swirl, 0);
        }
    }

    // 同调：绿色同调环 + 等级数量的星星汇聚
    function fxSynchro(target, starCount) {
        var R = 56;
        var ring = fxEl('rp-syn-ring', R, R, target.x - R / 2, target.y - R / 2);
        try {
            var a1 = ring.animate([
                { transform: 'scale(0.3) rotate(0deg)', opacity: 0, offset: 0 },
                { transform: 'scale(1) rotate(160deg)', opacity: 1, offset: 0.45 },
                { transform: 'scale(1.25) rotate(320deg)', opacity: 0.95, offset: 0.75 },
                { transform: 'scale(1.7) rotate(420deg)', opacity: 0, offset: 1 }
            ], { duration: 880, easing: 'ease-out' });
            a1.onfinish = function () { if (ring.parentNode) ring.parentNode.removeChild(ring); };
        } catch (e) { }
        setTimeout(function () { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 1000);
        var n = Math.max(1, Math.min(12, starCount || 1));
        for (var i = 0; i < n; i++) {
            (function (k) {
                setTimeout(function () {
                    var ang = (Math.PI * 2 * k) / n - Math.PI / 2;
                    var sx = target.x + Math.cos(ang) * 78;
                    var sy = target.y + Math.sin(ang) * 78;
                    var st = fxEl('rp-star', 20, 20, sx - 10, sy - 10);
                    var dx = target.x - sx, dy = target.y - sy;
                    var an = null;
                    try {
                        an = st.animate([
                            { transform: 'translate(0px,0px) rotate(0deg) scale(1)', opacity: 1, offset: 0 },
                            { transform: 'translate(' + dx * 0.55 + 'px,' + dy * 0.55 + 'px) rotate(220deg) scale(0.9)', opacity: 1, offset: 0.6 },
                            { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(400deg) scale(0.2)', opacity: 0, offset: 1 }
                        ], { duration: 780, easing: 'ease-in-out' });
                    } catch (e) { }
                    if (an) { an.onfinish = function () { if (st.parentNode) st.parentNode.removeChild(st); }; }
                    setTimeout(function () { if (st.parentNode) st.parentNode.removeChild(st); }, 950);
                }, 120 + k * 55);
            })(i);
        }
    }

    // 融合：橙色 + 蓝色「扭曲螺旋」汇聚（柔化、非几何）→ 中心爆闪
    function fxFusion(target) {
        var S = 210;
        function spiralLayer(color, delay, dir, turns, width) {
            setTimeout(function () {
                if (animSuppress) return;
                var wrap = fxEl('rp-spiral', S, S, target.x - S / 2, target.y - S / 2);
                wrap.appendChild(makeSpiralSvg(color, turns, width));
                var an = null;
                try {
                    an = wrap.animate([
                        { transform: 'rotate(0deg) scale(1.4)', opacity: 0, offset: 0 },
                        { transform: 'rotate(' + (dir * 130) + 'deg) scale(1.18)', opacity: 0.95, offset: 0.3 },
                        { transform: 'rotate(' + (dir * 330) + 'deg) scale(0.8)', opacity: 0.95, offset: 0.7 },
                        { transform: 'rotate(' + (dir * 560) + 'deg) scale(0.12)', opacity: 0, offset: 1 }
                    ], { duration: 1000, easing: 'cubic-bezier(.45,.15,.3,1)' });
                } catch (e) { /* ignore */ }
                if (an) { an.onfinish = function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }; }
                setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 1160);
            }, delay);
        }
        spiralLayer('rgba(255,150,40,0.95)', 0, 1, 2.4, 7);
        spiralLayer('rgba(70,170,255,0.95)', 140, -1, 2.0, 6);
        setTimeout(function () {
            if (animSuppress) return;
            var fl = fxEl('rp-fx-hit', 130, 130, target.x - 65, target.y - 65);
            setTimeout(function () { fl.style.opacity = '0'; setTimeout(function () { if (fl.parentNode) fl.parentNode.removeChild(fl); }, 320); }, 90);
        }, 850);
    }

    // 生成一条柔化扭曲螺旋（SVG 旋臂，模糊后呈流体质感）
    function makeSpiralSvg(color, turns, width) {
        var NS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '-50 -50 100 100');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        var d = '';
        var steps = 140;
        for (var i = 0; i <= steps; i++) {
            var t = i / steps;
            var ang = t * Math.PI * 2 * (turns || 2);
            var r = 6 + t * 38;
            var x = Math.cos(ang) * r;
            var y = Math.sin(ang) * r;
            d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2);
        }
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', String(width || 6));
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('opacity', '0.95');
        svg.appendChild(path);
        return svg;
    }

    // 超量：素材光球 → 星系黑洞 → 爆炸
    function fxFusionXyz(target, srcRects) {
        fxOrbs(srcRects, target, '#ffd700', true);
        // 星系/黑洞
        setTimeout(function () {
            if (animSuppress) return;
            var gal = fxEl('rp-galaxy', 40, 40, target.x - 20, target.y - 20);
            try {
                var g = gal.animate([
                    { transform: 'scale(0.2) rotate(0deg)', opacity: 0, offset: 0 },
                    { transform: 'scale(1.1) rotate(240deg)', opacity: 1, offset: 0.55 },
                    { transform: 'scale(1.5) rotate(420deg)', opacity: 0.95, offset: 0.8 },
                    { transform: 'scale(0.25) rotate(560deg)', opacity: 0, offset: 1 }
                ], { duration: 620, easing: 'ease-in' });
                g.onfinish = function () { if (gal.parentNode) gal.parentNode.removeChild(gal); };
            } catch (e) { }
            setTimeout(function () { if (gal.parentNode) gal.parentNode.removeChild(gal); }, 760);
        }, 470);
        // 爆炸
        setTimeout(function () {
            if (animSuppress) return;
            var hit = fxEl('rp-fx-hit', 150, 150, target.x - 75, target.y - 75);
            setTimeout(function () { hit.style.opacity = '0'; setTimeout(function () { if (hit.parentNode) hit.parentNode.removeChild(hit); }, 330); }, 100);
            for (var i = 0; i < 12; i++) {
                var sp = fxEl('rp-orb', 10, 10, target.x - 5, target.y - 5);
                sp.style.background = '#ffe27a';
                sp.style.boxShadow = '0 0 10px 3px #ffd700';
                var ang = (Math.PI * 2 * i) / 12, dist = 70 + Math.random() * 50;
                var an = null;
                try {
                    an = sp.animate([
                        { transform: 'translate(0px,0px) scale(1)', opacity: 1, offset: 0 },
                        { transform: 'translate(' + Math.cos(ang) * dist + 'px,' + Math.sin(ang) * dist + 'px) scale(0.3)', opacity: 0, offset: 1 }
                    ], { duration: 480, easing: 'ease-out' });
                } catch (e) { }
                if (an) { an.onfinish = function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }; }
                setTimeout(function (el) { if (el.parentNode) el.parentNode.removeChild(el); }, 620, sp);
            }
        }, 1020);
    }

    // 灵摆：同一悬点垂下两条锁链（蓝水晶 / 红水晶），起点一致、反向交错摆动
    // batchOpen：本次灵摆召唤批次（整批只触发一次）；active：特效当前是否在画面上
    var pendFx = { batchOpen: false, active: false, ctl: -1, el: null, timer: 0 };
    var PEND_SWING_MS = 1500;
    var PEND_AMP = 34;              // 摆动幅度（度）
    function pendBegin(ctl) {
        if (animSuppress || pendFx.batchOpen) return;   // 同一批连续召唤只触发一次
        if (ctl === undefined) ctl = 0;
        pendFx.batchOpen = true;
        var pane = fieldEl.getBoundingClientRect();
        var cx = pane.left + pane.width / 2;
        var pivotY = ctl === 0 ? (pane.top + pane.height * 0.53) : (pane.top + pane.height * 0.47);
        var H = 112;                          // 锁链长度
        var wrap = fxEl('rp-pend-wrap' + (ctl === 0 ? '' : ' is-up'), 0, 0, cx, pivotY);
        // 共用悬点装饰（吊环）
        var ring = document.createElement('div');
        ring.className = 'rp-pend-ring';
        wrap.appendChild(ring);
        // 一条锁链 + 一颗水晶；两条起点完全一致（都挂在悬点上），方向相反
        function arm(kind, fromCss) {
            var el = document.createElement('div');
            el.className = 'rp-pend-arm ' + kind;
            el.style.left = '-6px';
            el.style.top = '0px';
            el.style.height = H + 'px';
            el.style.transformOrigin = '50% 0%';
            var inner = document.createElement('div');
            inner.className = 'rp-pend-inner';
            if (ctl === 1) inner.style.transform = 'rotate(180deg)';
            inner.appendChild(makeChainSvg(kind, H));
            inner.appendChild(makeGemSvg(kind));
            el.appendChild(inner);
            wrap.appendChild(el);
            try {
                // 蓝：左→右→左；红：右→左→右（起始都在中位）
                el.animate([
                    { transform: 'rotate(0deg)', offset: 0 },
                    { transform: 'rotate(' + (PEND_AMP * fromCss) + 'deg)', offset: 0.3 },
                    { transform: 'rotate(' + (-PEND_AMP * fromCss) + 'deg)', offset: 0.7 },
                    { transform: 'rotate(' + (PEND_AMP * fromCss) + 'deg)', offset: 1 }
                ], { duration: PEND_SWING_MS, easing: 'ease-in-out', fill: 'forwards' });
            } catch (e) { /* ignore */ }
        }
        arm('is-blue', 1);    // 正角=向左摆 → 左 右 左
        arm('is-red', -1);    // 负角=向右摆 → 右 左 右
        pendFx.active = true;
        pendFx.ctl = ctl;
        pendFx.el = wrap;
        pendExtend();
        // 动画结束：保持末态片刻，特效消失
        setTimeout(function () {
            if (!pendFx.batchOpen) return;
            setTimeout(pendHide, 200);
        }, PEND_SWING_MS + 10);
    }

    // 锁链：交替朝向的链节（SVG，描边金属渐变）
    function makeChainSvg(kind, H) {
        var NS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'rp-pend-chain-svg');
        svg.setAttribute('width', '14');
        svg.setAttribute('height', String(H));
        svg.setAttribute('viewBox', '0 0 14 ' + H);
        var defs = document.createElementNS(NS, 'defs');
        var gid = 'rp-chain-' + kind + '-' + Math.floor(Math.random() * 1e6);
        var grad = document.createElementNS(NS, 'linearGradient');
        grad.setAttribute('id', gid);
        grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
        grad.setAttribute('x2', '1'); grad.setAttribute('y2', '0');
        [['0%', '#f4f7ff'], ['45%', '#9aa6bd'], ['55%', '#6d7891'], ['100%', '#e8edf8']].forEach(function (st) {
            var s = document.createElementNS(NS, 'stop');
            s.setAttribute('offset', st[0]);
            s.setAttribute('stop-color', st[1]);
            grad.appendChild(s);
        });
        defs.appendChild(grad);
        svg.appendChild(defs);
        var step = 9.6;
        var n = Math.max(2, Math.floor(H / step));
        for (var i = 0; i < n; i++) {
            var cy = 5 + i * step;
            var vertical = i % 2 === 0;
            var link = document.createElementNS(NS, 'ellipse');
            link.setAttribute('cx', '7');
            link.setAttribute('cy', cy.toFixed(1));
            link.setAttribute('rx', vertical ? '3.1' : '4.6');
            link.setAttribute('ry', vertical ? '4.6' : '3.1');
            link.setAttribute('fill', 'none');
            link.setAttribute('stroke', 'url(#' + gid + ')');
            link.setAttribute('stroke-width', '1.5');
            svg.appendChild(link);
        }
        return svg;
    }

    // 水晶：五面宝石（顶面 + 冠部刻面 + 底部尖端），带高光与内发光
    function makeGemSvg(kind) {
        var NS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'rp-pend-gem-svg');
        svg.setAttribute('width', '32');
        svg.setAttribute('height', '44');
        svg.setAttribute('viewBox', '-16 -24 32 44');
        var defs = document.createElementNS(NS, 'defs');
        var uid = kind + '-' + Math.floor(Math.random() * 1e6);
        var body = document.createElementNS(NS, 'linearGradient');
        body.setAttribute('id', 'gem-body-' + uid);
        body.setAttribute('x1', '0.15'); body.setAttribute('y1', '0');
        body.setAttribute('x2', '0.85'); body.setAttribute('y2', '1');
        var cols = kind === 'is-blue'
            ? [['0%', '#f2fbff'], ['28%', '#8ad6ff'], ['62%', '#2f7fe6'], ['100%', '#0b3488']]
            : [['0%', '#fff2f2'], ['28%', '#ff9c9c'], ['62%', '#e02a37'], ['100%', '#7d0a12']];
        cols.forEach(function (st) {
            var s = document.createElementNS(NS, 'stop');
            s.setAttribute('offset', st[0]);
            s.setAttribute('stop-color', st[1]);
            body.appendChild(s);
        });
        defs.appendChild(body);
        var shine = document.createElementNS(NS, 'linearGradient');
        shine.setAttribute('id', 'gem-shine-' + uid);
        shine.setAttribute('x1', '0'); shine.setAttribute('y1', '0');
        shine.setAttribute('x2', '0'); shine.setAttribute('y2', '1');
        [['0%', 'rgba(255,255,255,0.85)'], ['100%', 'rgba(255,255,255,0)']].forEach(function (st) {
            var s = document.createElementNS(NS, 'stop');
            s.setAttribute('offset', st[0]);
            s.setAttribute('stop-color', st[1]);
            shine.appendChild(s);
        });
        defs.appendChild(shine);
        svg.appendChild(defs);
        // 主体：顶面 -14,-8 / 冠部 -13,-13 … 底部尖端 0,18
        var poly = document.createElementNS(NS, 'polygon');
        poly.setAttribute('points', '0,-15 11,-7 7,7 0,18 -7,7 -11,-7');
        poly.setAttribute('fill', 'url(#gem-body-' + uid + ')');
        poly.setAttribute('stroke', kind === 'is-blue' ? 'rgba(200,240,255,0.9)' : 'rgba(255,220,220,0.9)');
        poly.setAttribute('stroke-width', '1');
        svg.appendChild(poly);
        // 刻面：从顶面顶点连到各腰点
        [[0, -15, 0, 18], [0, -15, 11, -7], [0, -15, -11, -7], [-7, 7, 7, 7]].forEach(function (seg) {
            var ln = document.createElementNS(NS, 'line');
            ln.setAttribute('x1', seg[0]); ln.setAttribute('y1', seg[1]);
            ln.setAttribute('x2', seg[2]); ln.setAttribute('y2', seg[3]);
            ln.setAttribute('stroke', 'rgba(255,255,255,0.45)');
            ln.setAttribute('stroke-width', '0.8');
            svg.appendChild(ln);
        });
        // 左上高光
        var hl = document.createElementNS(NS, 'polygon');
        hl.setAttribute('points', '0,-15 -5.5,-5 -2,2');
        hl.setAttribute('fill', 'url(#gem-shine-' + uid + ')');
        svg.appendChild(hl);
        var spark = document.createElementNS(NS, 'ellipse');
        spark.setAttribute('cx', '-3.4');
        spark.setAttribute('cy', '-6.5');
        spark.setAttribute('rx', '2.1');
        spark.setAttribute('ry', '3.2');
        spark.setAttribute('fill', 'rgba(255,255,255,0.75)');
        svg.appendChild(spark);
        return svg;
    }
    // 兼容旧入口（若在 SpSummoning 才拿到种类）
    function fxPendulum(ctl) {
        if (pendFx.batchOpen) { pendExtend(); return; }
        pendBegin(ctl);
    }
    function pendExtend() {
        if (!pendFx.batchOpen) return;
        clearTimeout(pendFx.timer);
        pendFx.timer = setTimeout(function () { pendBatchEnd(); }, 3200);
    }
    // 只把钟摆元素淡出（不影响批次）
    function pendHide() {
        if (!pendFx.active) return;
        pendFx.active = false;
        var el = pendFx.el;
        pendFx.el = null;
        if (el) {
            el.style.transition = 'opacity 0.28s ease';
            el.style.opacity = '0';
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 340);
        }
    }
    // 本批连续特殊召唤结束：撤掉钟摆（若有），允许下次灵摆召唤重新触发
    function pendBatchEnd() {
        clearTimeout(pendFx.timer);
        pendHide();
        pendFx.batchOpen = false;
        pendFx.ctl = -1;
    }

    // 召唤演出：临时隐藏卡片，等特效到位后再现身
    function fxHoldCell(cell, ms) {
        if (!cell) return;
        cell._fxHold = true;
        cell._fxHoldAt = Date.now();
        cell.style.opacity = '0';
        // PATCH(白神服) 2026-11-06: 以前只有传了 ms 才会自动恢复 →
        //   召唤演出没走到 fxRevealPop（比如演出期间卡被效果改成守备表示）时，
        //   这一格就永久 opacity:0，玩家看到的是"卡片变成透明的"（用户实测 ✗）。
        //   现在无论有没有 ms，都兜一个 1.2 秒后强制现身；另有 updateAllZones 里的超时清理。
        setTimeout(function () { fxReleaseCell(cell); }, Math.max(ms || 0, 1200));
    }
    function fxReleaseCell(cell) {
        if (!cell) return;
        cell._fxHold = false;
        cell.style.opacity = '';
    }
    // 现身：卡片由小变大（保留翻转/横置角度）
    function fxRevealPop(cell, flip, def) {
        if (!cell) return;
        cell._fxHold = false;
        cell.style.opacity = '';
        var node = cell.querySelector('.rp-card');
        if (!node) return;
        var rot = '';
        if (flip && def) rot = 'rotate(90deg) ';
        else if (flip) rot = 'rotate(180deg) ';
        else if (def) rot = 'rotate(-90deg) ';
        var scaleEnd = def ? ' scale(0.68)' : '';
        try {
            node.animate([
                { transform: rot + 'scale(0.15)', opacity: 0, offset: 0 },
                { transform: rot + 'scale(1.12)' + scaleEnd, opacity: 1, offset: 0.68 },
                { transform: rot + 'scale(1)' + scaleEnd, opacity: 1, offset: 1 }
            ], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)' });
        } catch (e) { /* ignore */ }
    }

    // 连接素材的连接值：连接怪按其连接值算（连接3 → 3 个球），非连接怪算 1 个
    function linkValueOf(code) {
        if (!code) return 1;
        var st = cardStatByCode[String(code)];
        if (st && st.link) return st.link;
        var m = cardMetaMap[String(code)];
        if (m && (m.cat || '').indexOf('连接') >= 0 && m.level) return m.level;   // 连接怪的等级字段即连接值
        return 1;
    }

    // 连接：每个素材按自身连接值放出等量红色光球飞向召唤位 → 到位后连接怪由小变大现身 + 六边形数码特效
    function fxLink(target, mats, cellEl, flip, def) {
        var groups = (mats && mats.length) ? mats : [{ code: 0, rect: null }];
        var delay = 0, spawned = 0;
        groups.forEach(function (mt) {
            var n = linkValueOf(mt.code);
            var r = mt.rect;
            var bx = r ? r.left + r.width / 2 : target.x;
            var by = r ? r.top + r.height / 2 : target.y;
            for (var k = 0; k < n && spawned < 12; k++) {
                // 同一素材的多个球稍微散开，便于看出"几个球"
                var ang = (Math.PI * 2 * k) / Math.max(1, n) - Math.PI / 2;
                var rad = n > 1 ? 13 : 0;
                spawnOrbGroup(bx + Math.cos(ang) * rad, by + Math.sin(ang) * rad, target, '#ff3b3b', true, delay);
                delay += 90;
                spawned++;
            }
        });
        var landAt = Math.max(760, delay + 260);
        setTimeout(function () {
            if (animSuppress) { fxReleaseCell(cellEl); return; }
            // 素材到位：卡片由小变大现身 + 数码特效
            fxRevealPop(cellEl, flip, def);
            hexRingFx(target, 130, 0, 980, 2.6, '#8ef0ff');
            hexRingFx(target, 100, 60, 1060, 2.2, '#d8fbff');
            hexRingFx(target, 70, 120, 1140, 1.8, '#7fe9ff');
            for (var i = 0; i < 6; i++) {
                (function (k) {
                    setTimeout(function () {
                        if (animSuppress) return;
                        var ang = (Math.PI * 2 * k) / 6 + Math.random() * 0.3;
                        var dist = 44 + Math.random() * 26;
                        var hx = hexRingFx(target, 26, Math.random() * 90, 420, 1.6, '#aef4ff');
                        var el = hx.el;
                        var an = null;
                        try {
                            an = el.animate([
                                { transform: 'translate(0px,0px) scale(0.4) rotate(0deg)', opacity: 0, offset: 0 },
                                { transform: 'translate(' + Math.cos(ang) * dist + 'px,' + Math.sin(ang) * dist + 'px) scale(1) rotate(120deg)', opacity: 1, offset: 0.35 },
                                { transform: 'translate(' + Math.cos(ang) * (dist + 34) + 'px,' + Math.sin(ang) * (dist + 34) + 'px) scale(0.6) rotate(240deg)', opacity: 0, offset: 1 }
                            ], { duration: 520, easing: 'ease-out' });
                        } catch (e) { /* ignore */ }
                        if (an) { an.onfinish = function () { if (el.parentNode) el.parentNode.removeChild(el); }; }
                        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 620);
                    }, 60 + k * 45);
                })(i);
            }
            var fl = fxEl('rp-hex-flash', 140, 140, target.x - 70, target.y - 70);
            setTimeout(function () { fl.style.opacity = '0'; setTimeout(function () { if (fl.parentNode) fl.parentNode.removeChild(fl); }, 320); }, 130);
        }, landAt);
    }

    // 单个六边形环（返回元素，便于外部再动画）
    function hexRingFx(target, size, rotate0, dur, scaleTo, stroke, cb) {
        var NS = 'http://www.w3.org/2000/svg';
        var wrap = fxEl('rp-hex', size, size, target.x - size / 2, target.y - size / 2);
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        var poly = document.createElementNS(NS, 'polygon');
        poly.setAttribute('points', '50,3 92,26 92,74 50,97 8,74 8,26');
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', stroke || '#8ef0ff');
        poly.setAttribute('stroke-width', '2.5');
        poly.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(poly);
        wrap.appendChild(svg);
        var an = null;
        try {
            an = wrap.animate([
                { transform: 'rotate(' + rotate0 + 'deg) scale(0.35)', opacity: 0, offset: 0 },
                { transform: 'rotate(' + (rotate0 + 60) + 'deg) scale(' + (scaleTo * 0.75) + ')', opacity: 1, offset: 0.5 },
                { transform: 'rotate(' + (rotate0 + 140) + 'deg) scale(' + scaleTo + ')', opacity: 0, offset: 1 }
            ], { duration: dur, easing: 'ease-out' });
        } catch (e) { /* ignore */ }
        if (an) { an.onfinish = function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }; }
        setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, dur + 120);
        return { el: wrap, anim: an };
    }

    // 召唤演出总入口：按召唤种类播放（cellEl 用于"素材到位后卡片才现身"）
    function summonShowFx(code, rect, cellEl, flip, def, ctlOf) {
        if (animSuppress || !rect || !rect.width) return;
        if (!imgLoadedFlag(code)) { whenImgReady(code, function () { summonShowFx(code, rect, cellEl, flip, def, ctlOf); }); return; }
        var type = summonTypeOf(code);
        if (!type) return;
        var target = centerOf(rect);
        var mats = takeMats();
        var srcRects = mats.map(function (m) { return m.rect; }).filter(Boolean);
        if (!srcRects.length) srcRects = [rect];
        if (type === 'link') {
            fxHoldCell(cellEl, 2600);           // 兜底：确保仍处于隐藏
            // 每个素材按其连接值放球：连接3的怪放 3 个球，普通怪放 1 个球
            fxLink(target, mats.length ? mats : [{ code: 0, rect: rect }], cellEl, flip, def);
            return;
        }
        if (type === 'xyz') fxFusionXyz(target, srcRects);
        else if (type === 'synchro') fxSynchro(target, cardLevel(code));
        else if (type === 'fusion') fxFusion(target);
        else if (type === 'pendulum') fxPendulum(ctlOf);
    }

    // 移动方向：手牌/卡组是竖直 0°，怪兽区守备横置（自己 -90 / 对方 +90），
    // 对方场上正面卡整体倒置 180°。flyGhost 在飞行过程中从这个角度转到目标角度。
    function ghostAngle(loc, zone, ctl) {
        try {
            var l = (loc | 0) & 0x7f;
            var p = zone ? (zone.position !== undefined ? zone.position : zone.pos) : 0;
            if (l === LOC.MZONE) {
                if (isDefense(p)) return (ctl === 1) ? 90 : -90;
                return (ctl === 1) ? 180 : 0;
            }
            if (l === LOC.SZONE && ctl === 1) return 180;
        } catch (e) {}
        return 0;
    }

    // 场地是否处于 3D 倾斜：手牌层是反向转平的，所以只有手牌 0°，其余区域跟棋盘 24°
    function ghostTilt(loc) {
        try {
            var l = (loc | 0) & 0x7f;
            if (l === LOC.HAND) return 0;
            if (fieldEl && fieldEl.classList.contains('tilt3d')) return 24;
        } catch (e) {}
        return 0;
    }

    // 移动动画：幽灵卡从原格滑到目标格（flip = 对手的卡需倒置显示）
    function flyGhost(cardCode, down, s, d, flip, sAng, dAng, sTilt, dTilt, hideKeys) {
        if (animSuppress || !s || !d || !s.width || !d.width) return;
        // PATCH(白神服) 2026-11-18: 卡组/额外/墓地的起点是**方形格子**（86×86），
        //   直接拿格子当起点会让卡图按 cover 裁成上下截断。这里先把方形起点
        //   收成卡牌比例（59/86），居中放在格子里。
        try {
            var _ar = s.width / Math.max(1, s.height);
            if (_ar > 0.85) {
                var _cw = s.height * 59 / 86, _ch = s.height;
                if (_cw > s.width) { _cw = s.width; _ch = s.width * 86 / 59; }
                s = { left: s.left + (s.width - _cw) / 2, top: s.top + (s.height - _ch) / 2, width: _cw, height: _ch };
            }
        } catch (e) {}
        var g = fxEl('rp-fly' + (down || !cardCode ? ' rp-fly-down' : ''), s.width, s.height, s.left, s.top);
        var _flyToken = null;
        try {
            g._flyAt = Date.now();
            if (hideKeys) g.setAttribute('data-hide-key', String(hideKeys));
            if (hideKeys && window.__frApi && window.__frApi.beginFly) {
                _flyToken = window.__frApi.beginFly(hideKeys);
                g._flyToken = _flyToken;
            }
        } catch (e) {}
        if (!down && cardCode) {
            var im = buildCardImg(cardCode);
            im.style.width = '100%';
            im.style.height = '100%';
            im.style.objectFit = 'cover';
            g.appendChild(im);
        }
        // PATCH(白神服) 2026-11-17: 跨区域移动（卡组→手卡 等）起点和终点尺寸不同，
        //   恢复尺寸补间，但加合理性区间；宽高分别缩放配合 3D 倾斜。
        var _sTilt = Number(sTilt) || 0;
        var _dTilt = Number(dTilt) || 0;
        var _cosS = Math.max(0.2, Math.cos(_sTilt * Math.PI / 180));
        var _cosD = Math.max(0.2, Math.cos(_dTilt * Math.PI / 180));
        // 保持卡牌比例：只用一个等比缩放；倾斜后投影高度 ≈ s.h * k * cos(dTilt)
        var _k = Math.min(d.width / Math.max(1, s.width), d.height / Math.max(1, s.height * _cosD));
        if (!isFinite(_k) || _k < 0.3 || _k > 2.8) _k = 1;
        var _tx = (d.left + d.width / 2) - (s.left + s.width / 2);
        var _ty = (d.top + d.height / 2) - (s.top + s.height / 2);
        g.style.transformOrigin = '50% 50%';
        g.style.transform = 'perspective(1500px) rotate(' + (Number(sAng) || 0) + 'deg)'
            + ' rotateX(' + _sTilt + 'deg) scale(1,' + (1 / _cosS) + ')';
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                g.style.transform = 'perspective(1500px) translate(' + _tx + 'px,' + _ty + 'px)'
                    + ' rotate(' + (Number(dAng) || 0) + 'deg)'
                    + ' rotateX(' + _dTilt + 'deg)'
                    + ' scale(' + _k + ')';
            });
        });
        // PATCH(白神服) 2026-11-17: 飞行结束后再淡出（原来 200ms 就淡出，和 0.26s 位移撞在一起，看着一顿）
        setTimeout(function () {
            g.style.opacity = '0';
            setTimeout(function () {
                if (g.parentNode) g.parentNode.removeChild(g);
                try {
                    if (_flyToken && window.__frApi && window.__frApi.endFly) window.__frApi.endFly(_flyToken);
                    else if (hideKeys && window.__frApi && window.__frApi.showKeys) window.__frApi.showKeys(hideKeys);
                    if (window.__frApi && window.__frApi.syncGhosts) window.__frApi.syncGhosts();
                } catch (e) {}
            }, 160);
        }, 270);
    }

    // 发效果：把卡片“放到镜头前”闪一下，并从中央向外扩散金色圆环
    function effectFlash(cardCode, fromRect, flip) {
        if (animSuppress || !cardCode) return;
        var pane = fieldEl.getBoundingClientRect();
        var cx = pane.left + pane.width / 2;
        var cy = pane.top + pane.height / 2;
        var BW = 150, BH = 210;
        var el = fxEl('rp-fx-card' + (flip ? ' rp-flip' : ''), BW, BH, cx - BW / 2, cy - BH / 2);
        // PATCH(白神服) 2026-11-05: 卡图没加载完时原来是一张**透明卡**（用户实测 ✗）
        //   → 先把卡背垫在下面，图片 onload 后再撤掉，任何时刻都不会是空框。
        el.style.background = 'url(cover2.jpg) center/center no-repeat';
        el.style.backgroundSize = 'cover';
        var im = buildCardImg(cardCode);
        im.addEventListener('load', function () { el.style.background = ''; });
        im.style.position = 'absolute';
        im.style.inset = '0';
        im.style.width = '100%';
        im.style.height = '100%';
        // 不要再把 src 覆写成 cardImgSrc()（DIY 大图目录）：官方卡在 DIY 目录里
        // 通常是 404，但场上/日志用的是 /thumbcard，所以中间大图老是空白。
        // buildCardImg 已经走 picChain（/thumbcard 优先），保留它自己的图源链。
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
        if (!imgLoadedFlag(cardCode)) { whenImgReady(cardCode, function () { attackFx(cardCode, fromRect, targetRect); }); return; }
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
            var im = buildCardImg(cardCode);
            im.style.width = '100%';
            im.style.height = '100%';
            im.style.objectFit = 'cover';
            g.appendChild(im);
        }
        // 变换原点在左上角：位移按左上角差值算，终点与目标格完全重合
        var dx = (tx - tw / 2) - fromRect.left;
        var dy = (ty - th / 2) - fromRect.top;
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
        // PATCH(白神服) 2026-11-17: 实体移动模式下**不再飞替身** ——
        //   卡节点自己会从起点滑到终点；再飞一个 ghost 就成了
        //   "卡已经在终点 + 替身还在路上"（用户实测：一眼看过去没区别）
        if (ENTITY_MOVE) return;
        flyGhost(cardCode, down, s, d);
    }

    // 召唤落地：怪兽入场后在脚下展开召唤圆环
    // 照 MDPro3 的 GameCard.AnimationPosition()：
    //   攻击表示 → 交叉双剑亮一下；守备表示 → 盾牌放大淡出
    //   （它是 fxp/Icon 特效，我们这边用字符 + WAAPI 做同节奏的轻量版）
    function positionIconFx(rect, def) {
        try {
            if (!rect || !rect.width) return;
            var el = document.createElement('div');
            el.className = 'rp-posfx';
            var w = rect.width, h = rect.height;
            el.style.cssText = 'position:fixed;left:' + (rect.left + rect.width / 2 - w / 2) + 'px;'
                + 'top:' + (rect.top + rect.height / 2 - h / 2) + 'px;width:' + w + 'px;height:' + h + 'px;'
                + 'display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:82;'
                + 'font-size:' + Math.round(Math.min(w, h) * 0.62) + 'px;line-height:1;color:#fff;'
                + 'text-shadow:0 0 12px rgba(255,220,120,.9),0 2px 6px rgba(0,0,0,.8);opacity:0';
            el.textContent = def ? '🛡' : '⚔';
            document.body.appendChild(el);
            var frames = def
                ? [{ opacity: 0, transform: 'scale(.55)' }, { opacity: .95, transform: 'scale(1)' },
                   { opacity: .95, transform: 'scale(1.08)' }, { opacity: 0, transform: 'scale(1.15)' }]
                : [{ opacity: 0, transform: 'scale(.5) rotate(-12deg)' }, { opacity: 1, transform: 'scale(1) rotate(0deg)' },
                   { opacity: 1, transform: 'scale(1.05) rotate(8deg)' }, { opacity: 0, transform: 'scale(1.1) rotate(12deg)' }];
            var anim = el.animate(frames, { duration: def ? 700 : 800, easing: 'ease-out' });
            anim.onfinish = function () { if (el.parentNode) el.parentNode.removeChild(el); };
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1100);
        } catch (e) {}
    }

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

    // 攻击属性 → 光球色板
    var ORB_PALETTE = {
        fire:   { c: '#ff8a2a', d: '#ff3b12', g: 'rgba(255,90,30,0.78)' },
        water:  { c: '#3aa0ff', d: '#125bd1', g: 'rgba(50,140,255,0.78)' },
        wind:   { c: '#45e07a', d: '#0f9b45', g: 'rgba(50,220,110,0.75)' },
        earth:  { c: '#c08a52', d: '#6e4526', g: 'rgba(170,115,65,0.72)' },
        light:  { c: '#ffe066', d: '#e0a000', g: 'rgba(255,215,80,0.82)' },
        dark:   { c: '#b46cff', d: '#6a1fb0', g: 'rgba(160,80,255,0.8)' },
        divine: { c: '#fff2b0', d: '#e8c34a', g: 'rgba(255,240,170,0.85)' }
    };
    function attackAttr(code) {
        try {
            var a = Number((cardMetaMap[String(toCode(code))] || {}).attribute) || 0;
            if (a & 4) return 'fire';
            if (a & 2) return 'water';
            if (a & 8) return 'wind';
            if (a & 1) return 'earth';
            if (a & 16) return 'light';
            if (a & 32) return 'dark';
            if (a & 64) return 'divine';
        } catch (e) {}
        return 'light';
    }
    function paintOrb(el, attr) {
        try {
            var p = ORB_PALETTE[attr] || ORB_PALETTE.light;
            el.style.setProperty('--orb', p.c);
            el.style.setProperty('--orb-deep', p.d);
            el.style.setProperty('--orb-glow', p.g);
        } catch (e) {}
    }

    // 攻击传输：攻击者 → 目标的能量导管，短暂脉冲传输三次后回调发球
    function transmissionFx(ax, ay, tx, ty, attr, done) {
        if (animSuppress) { if (done) done(); return; }
        duelSfx('transmission');
        try {
            var p0 = ORB_PALETTE[attr] || ORB_PALETTE.light;
            var dx = tx - ax, dy = ty - ay;
            var len = Math.sqrt(dx * dx + dy * dy) || 1;
            var ang = Math.atan2(dy, dx);
            var wrap = document.createElement('div');
            wrap.className = 'rp-fx-transmit';
            wrap.style.left = ax + 'px';
            wrap.style.top = ay + 'px';
            wrap.style.width = len + 'px';
            wrap.style.transform = 'rotate(' + ang + 'rad)';
            var beam = document.createElement('div');
            beam.className = 'rp-fx-transmit-beam';
            beam.style.background = 'linear-gradient(90deg, rgba(255,255,255,0) 0%, ' + p0.c + ' 18%, ' + p0.c + ' 82%, rgba(255,255,255,0) 100%)';
            beam.style.boxShadow = '0 0 12px 3px ' + p0.g;
            wrap.appendChild(beam);
            document.body.appendChild(wrap);
            try {
                wrap.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }],
                    { duration: 520, easing: 'ease-out' });
            } catch (e) {}
            for (var i = 0; i < 3; i++) {
                (function (k) {
                    setTimeout(function () {
                        if (animSuppress) return;
                        var pulse = document.createElement('div');
                        pulse.className = 'rp-transmit-pulse';
                        pulse.style.background = p0.c;
                        pulse.style.boxShadow = '0 0 10px 2px ' + p0.g;
                        wrap.appendChild(pulse);
                        try {
                            pulse.animate([
                                { transform: 'translateX(0px) scale(0.55)', opacity: 0, offset: 0 },
                                { transform: 'translateX(' + (len * 0.18) + 'px) scale(1)', opacity: 1, offset: 0.22 },
                                { transform: 'translateX(' + len + 'px) scale(0.9)', opacity: 0, offset: 1 }
                            ], { duration: 190, easing: 'cubic-bezier(.3,.5,.5,1)' });
                        } catch (e) {}
                        setTimeout(function () { if (pulse.parentNode) pulse.parentNode.removeChild(pulse); }, 230);
                    }, k * 130);
                })(i);
            }
            setTimeout(function () {
                if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
                if (done) done();
            }, 470);
        } catch (e) {
            if (done) done();
        }
    }

    // 攻击特效：发射带拖尾的能量球
    // 攻击能量球：可指定飞行时长，命中时回调（用于爆炸/破碎同步）
    function attackBallFx(fromRect, targetRect, flightMs, onImpact, attr) {
        if (animSuppress || !fromRect || !fromRect.width) return;
        duelSfx('attackBall');
        var _attr = attr || 'light';
        var dur = flightMs || 290;
        var sx = fromRect.left + fromRect.width / 2, sy = fromRect.top + fromRect.height / 2;
        var tx, ty;
        if (targetRect && targetRect.width) {
            tx = targetRect.left + targetRect.width / 2;
            ty = targetRect.top + targetRect.height / 2;
        } else {
            var pane = fieldEl.getBoundingClientRect();
            tx = pane.left + pane.width / 2;
            ty = pane.top + pane.height * 0.42;
        }
        var dx = tx - sx, dy = ty - sy;
        var size = Math.max(18, Math.min(30, fromRect.width * 0.34));
        // 主球 + 3 个滞后小球（拖尾），略带弧线
        for (var t = 0; t < 4; t++) {
            (function (k) {
                setTimeout(function () {
                    var s = size * (1 - k * 0.17);
                    var o = fxEl('rp-ball' + (k === 0 ? ' rp-ball-core' : ''), s, s, sx - s / 2, sy - s / 2);
                    paintOrb(o, _attr);
                    var midX = dx * 0.5;
                    var midY = dy * 0.5 - Math.abs(dy) * 0.12 - 16;
                    var an = null;
                    try {
                        an = o.animate([
                            { transform: 'translate(0px,0px) scale(1)', opacity: k === 0 ? 1 : (0.8 - k * 0.16), offset: 0 },
                            { transform: 'translate(' + midX + 'px,' + midY + 'px) scale(' + (k === 0 ? 1.15 : 0.85) + ')', opacity: k === 0 ? 1 : (0.62 - k * 0.16), offset: 0.5 },
                            { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0.55)', opacity: 0, offset: 1 }
                        ], { duration: dur, easing: 'cubic-bezier(.35,.5,.5,1)' });
                    } catch (e) { /* ignore */ }
                    if (an) { an.onfinish = function () { if (o.parentNode) o.parentNode.removeChild(o); }; }
                    setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, dur + 160);
                }, k * Math.max(14, dur * 0.09));
            })(t);
        }
        // 命中：冲击环 + 火花
        setTimeout(function () {
            if (animSuppress) return;
            var hit = fxEl('rp-fx-hit', 96, 96, tx - 48, ty - 48);
            setTimeout(function () { hit.style.opacity = '0'; setTimeout(function () { if (hit.parentNode) hit.parentNode.removeChild(hit); }, 300); }, 70);
            for (var i = 0; i < 8; i++) {
                var sp = fxEl('rp-ball', 9, 9, tx - 4.5, ty - 4.5);
                paintOrb(sp, _attr);
                var ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
                var dist = 42 + Math.random() * 34;
                var an2 = null;
                try {
                    an2 = sp.animate([
                        { transform: 'translate(0px,0px) scale(1)', opacity: 1, offset: 0 },
                        { transform: 'translate(' + Math.cos(ang) * dist + 'px,' + Math.sin(ang) * dist + 'px) scale(0.3)', opacity: 0, offset: 1 }
                    ], { duration: 380, easing: 'ease-out' });
                } catch (e) { /* ignore */ }
                if (an2) { an2.onfinish = function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }; }
                setTimeout(function (el) { if (el.parentNode) el.parentNode.removeChild(el); }, 520, sp);
            }
            if (onImpact) onImpact();
        }, dur);
    }

    // 洗切卡组：卡背在牌堆上方散开、交错换位再收回
    function shufflePileFx(ctl, pileKey, force) {
        if (animSuppress && !force) return;
        try {
            var pile = fieldEl.querySelector('[data-pile="' + pileKey + ':' + ctl + '"]');
            if (!pile) return;
            var r = pile.getBoundingClientRect();
            if (!r.width || !r.height) return;
            var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            // 卡背原图 177×254；按真实比例取尺寸，避免 width/height 各自取上限后变成正方形
            var CARD_AR = 177 / 254;
            var w = Math.max(26, Math.min(58, r.width * 0.72, r.height * 0.72 * CARD_AR));
            var h = w / CARD_AR;
            var wrap = document.createElement('div');
            wrap.className = 'rp-shuffle-fx';
            wrap.style.left = cx + 'px';
            wrap.style.top = cy + 'px';
            document.body.appendChild(wrap);
            var n = 7;
            for (var i = 0; i < n; i++) {
                (function (k) {
                    var d = document.createElement('div');
                    d.className = 'rp-shuffle-card';
                    d.style.width = w + 'px';
                    d.style.height = h + 'px';
                    d.style.backgroundImage = 'url("' + CARD_BACK_URI + '")';
                    var t = k - (n - 1) / 2;
                    var dx = t * (w * 0.34);
                    var dy = -Math.abs(t) * (h * 0.12) - 4;
                    var rot = t * 8;
                    d.style.zIndex = String(10 + k);
                    wrap.appendChild(d);
                    try {
                        d.animate([
                            { transform: 'translate(-50%,-50%) translate(0px,0px) rotate(0deg) scale(0.96)', opacity: 0.95, offset: 0 },
                            { transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg) scale(1.04)', opacity: 1, offset: 0.34 },
                            { transform: 'translate(-50%,-50%) translate(' + (-dx * 0.75) + 'px,' + (dy * 0.65) + 'px) rotate(' + (-rot) + 'deg) scale(1)', opacity: 1, offset: 0.68 },
                            { transform: 'translate(-50%,-50%) translate(0px,0px) rotate(0deg) scale(0.9)', opacity: 0, offset: 1 }
                        ], { duration: 640, delay: k * 34, easing: 'cubic-bezier(.35,.1,.2,1)', fill: 'both' });
                    } catch (e) {}
                })(i);
            }
            var glow = document.createElement('div');
            glow.className = 'rp-shuffle-glow';
            glow.style.width = (r.width + 26) + 'px';
            glow.style.height = (r.height + 26) + 'px';
            glow.style.left = (r.left - 13) + 'px';
            glow.style.top = (r.top - 13) + 'px';
            document.body.appendChild(glow);
            try {
                glow.animate([
                    { opacity: 0, transform: 'scale(0.82)' },
                    { opacity: 0.95, transform: 'scale(1.04)', offset: 0.35 },
                    { opacity: 0, transform: 'scale(1.14)' }
                ], { duration: 760, easing: 'ease-out' });
            } catch (e) {}
            setTimeout(function () {
                if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
                if (glow.parentNode) glow.parentNode.removeChild(glow);
            }, 980);
        } catch (e) {}
    }

    // 攻击编排：①攻击方红圈 ②能量传输三次 ③光球飞出 ④命中爆炸；目标会破坏时同步碎卡
    function attackMarkFx(aRect, tRect, direct, killedCode, defCtl, attackerCode) {
        if (animSuppress || !aRect || !aRect.width) return;
        var _attr = attackAttr(attackerCode);
        cellMarkFx(aRect, 'red');
        var tr = tRect;
        pendingImpact = null;
        var fireBall = function () {
            attackBallFx(aRect, tr, 340, function () {
                if (killedCode && tr && tr.width) {
                    // 预计会被破坏：先在目标处蓄能，等真正的送墓消息再爆炸+破碎（保证同步）
                    chargeOrbFx(tr, defCtl, _attr);
                    pendingImpact = { code: killedCode, rect: tr, defCtl: defCtl, done: false };
                    setTimeout(function () {
                        if (pendingImpact && pendingImpact.code === killedCode && !pendingImpact.done) {
                            pendingImpact = null;
                            if (tr && tr.width) boomFx(tr, _attr);
                            if (tr && tr.width && !direct) cellMarkFx(tr, 'gold');
                        }
                    }, 1500);
                } else {
                    if (tr && tr.width && !direct) cellMarkFx(tr, 'gold');
                }
            }, _attr);
        };
        if (tRect && tRect.width) {
            transmissionFx(aRect.left + aRect.width / 2, aRect.top + aRect.height / 2,
                tRect.left + tRect.width / 2, tRect.top + tRect.height / 2, _attr, fireBall);
        } else {
            fireBall();
        }
    }

    // 命中处的蓄能光球（等待破坏结算）
    function chargeOrbFx(rect, defCtl, attr) {
        if (animSuppress || !rect || !rect.width) return;
        var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        var o = fxEl('rp-ball rp-ball-core rp-ball-charge', 26, 26, cx - 13, cy - 13);
        paintOrb(o, attr || 'light');
        var an = null;
        try {
            an = o.animate([
                { transform: 'scale(0.5)', opacity: 0.5, offset: 0 },
                { transform: 'scale(1.15)', opacity: 1, offset: 0.5 },
                { transform: 'scale(0.7)', opacity: 0.55, offset: 1 }
            ], { duration: 420, iterations: 3, easing: 'ease-in-out' });
        } catch (e) { /* ignore */ }
        setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 1400);
    }

    // 爆炸：冲击环 + 火花（不含碎卡，碎卡由调用方同时触发）
    function boomFx(rect, attr) {
        if (animSuppress || !rect || !rect.width) return;
        var tx = rect.left + rect.width / 2, ty = rect.top + rect.height / 2;
        var hit = fxEl('rp-fx-hit', 130, 130, tx - 65, ty - 65);
        setTimeout(function () { hit.style.opacity = '0'; setTimeout(function () { if (hit.parentNode) hit.parentNode.removeChild(hit); }, 320); }, 90);
        for (var i = 0; i < 12; i++) {
            var sp = fxEl('rp-ball', 10, 10, tx - 5, ty - 5);
            paintOrb(sp, attr || 'light');
            var ang = (Math.PI * 2 * i) / 12 + Math.random() * 0.4;
            var dist = 50 + Math.random() * 42;
            var an = null;
            try {
                an = sp.animate([
                    { transform: 'translate(0px,0px) scale(1)', opacity: 1, offset: 0 },
                    { transform: 'translate(' + Math.cos(ang) * dist + 'px,' + Math.sin(ang) * dist + 'px) scale(0.3)', opacity: 0, offset: 1 }
                ], { duration: 420, easing: 'ease-out' });
            } catch (e) { /* ignore */ }
            if (an) { an.onfinish = function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }; }
            setTimeout(function (el) { if (el.parentNode) el.parentNode.removeChild(el); }, 560, sp);
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
        if (c > 0) return { code: c, direct: false, killedCode: killedFromLookahead(atkCtl) };
        if (!defCards.length) return { code: 0, direct: true, killedCode: 0 };   // 场上无怪兽 → 直接攻击
        if (c === -1 && defCards.length === 1) {
            return { code: defCards[0].code, direct: false, killedCode: killedFromLookahead(atkCtl) };
        }
        // 多名候选：看战斗结果定目标（防守方被破坏离场=目标）
        var la = lookAheadDefender(atkCtl);
        if (la > 0) return { code: la, direct: false, killedCode: la };
        return { code: 0, direct: false, killedCode: 0 };                        // 仍无法确定
    }
    // 本次战斗防守方是否会被破坏（前瞻结果）
    function killedFromLookahead(atkCtl) {
        var la = lookAheadDefender(atkCtl);
        return la > 0 ? la : 0;
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

    // 伤害/恢复数字提示：-3000 红字上飘 / +N 绿字上飘（可指定颜色）
    function dmgFloat(ctl, value, sign, colorOverride) {
        if (animSuppress) return;
        var side = fieldEl.querySelector(ctl === 1 ? '.rp-opp' : '.rp-self');
        if (!side) return;
        var sr = side.getBoundingClientRect();
        var x = sr.left + sr.width / 2;
        var y = sr.top + sr.height * (ctl === 1 ? 0.45 : 0.55);
        var el = fxEl('rp-dmg-num', 0, 0, 0, 0);
        el.textContent = (sign === '+' ? '+' : '-') + value;
        el.style.color = colorOverride || (sign === '+' ? '#8dff9e' : '#ff5b6e');
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
    // 座位(pos, 建房顺序) ↔ 决斗位(消息流里的 player 索引) 可能互换：
    // 用 Win 消息的 player(真实决斗位) 与 DB 里 winner 的座位比对判定
    var metaSwap = false;
    var revealingHand = false;
    var recentRevealed = {};
    var announcedByCell = {};
    var announcedOwner = {};   // cellKey → {uid, code}：禁止令这类“宣言”属于哪张卡
    var announcedClearTimer = {};
    var extraFaceUp = { 0: [], 1: [] };   // 表侧表示的额外卡组内容（灵摆）
    function addExtraFaceUp(ctl, code) {
        try {
            if (!(ctl === 0 || ctl === 1) || !code) return;
            extraFaceUp[ctl].push(code);
            updatePiles();
        } catch (e) {}
    }
    function removeExtraFaceUp(ctl, code) {
        try {
            if (!(ctl === 0 || ctl === 1)) return;
            var a = extraFaceUp[ctl];
            var i = a.lastIndexOf(code);
            if (i >= 0) a.splice(i, 1);
            updatePiles();
        } catch (e) {}
    }
    var startDeck = [null, null];
    var startExtra = [null, null];
    var startSwapFlag = null;   // 观战：1=服务端标记换边，0=没换，null=未知（老录像）   // Start 里的初始卡组张数（按视图座位）
    var lastChainCell = null;   // 最近发动/连锁的卡所在格   // cellKey -> [卡名...]（如禁止令宣言）
    var _revealHandCount = {};   // ctl → 公开时的张数（张数变了才恢复卡背）
    function handSizeOf(ctl) {
        var n = 0;
        Object.keys(field[ctl] || {}).forEach(function (k) { if (k.indexOf(LOC.HAND + ':') === 0) n++; });
        return n;
    }
    var _pendingRevealHand = {};
    var pendingHandReveal = {};
    var _revealNames = [];
    var _revealCodes = [];   // 同批次公开的卡号（用来给日志出卡图）   // 'ctl:seq' → {code, at}：ConfirmCards 先到、卡后到手牌时用   // "code:ctl" → 下一次手牌重建时标记为公开      // code → 被公开的时间（用于检索到手的卡短暂亮牌）   // 正在因为「公开卡牌」重画手牌（此时不清 revealed）
    function duelSeat(d) { return metaSwap ? (1 - d) : d; }
    // PATCH(白神服) 2026-11-19：**座位只映射一次**。
    //   历史包袱：duel-client.js 在消息边界就把"决斗位 1 → 视角 0"整体翻过来了，
    //   而这里又用 setMyDuelPos 再翻一次 —— 两边相乘等于没翻，但名字/张数各走不同的
    //   路径，于是出现「名字偶尔对换」。现在约定：
    //     · 消息层的翻转只在 duel-client.js 做（它也负责 Start/ReloadField 的整体块交换）
    //     · 查看器内部一律使用「视角座位」（0=下方/我），seatOf 只保留给回放用
    //     · 名字来自 seatOrder：视角座位 → 房间 pos，由 duel-client 依据协议算好后下发
    //       （玩家：mySeat/myDuelPos；观战：MSG_START playerType 的 0x10/0x11）
    var myDuelPos = null;
    var seatOrder = null;           // [视角0 对应的房间pos, 视角1 对应的房间pos]
    var seatOrderExplicit = false;  // duel-client 是否已明确下发（回放不设，走 startSwapFlag 兜底）
    function seatOf(duelPos) {
        if (myDuelPos === 0 || myDuelPos === 1) return (myDuelPos === 1) ? (1 - duelPos) : duelPos;
        return duelSeat(duelPos);
    }
    function playerByDuelPos(d) {
        if (!meta || !meta.players) return null;
        var seat = seatOf(d);
        var rp = seat;
        try {
            if (seatOrder && (seatOrder[seat] === 0 || seatOrder[seat] === 1)) rp = seatOrder[seat];
        } catch (e) {}
        return meta.players.find(function (p) { return p.pos === rp; }) || null;
    }
    function playerName(pos) {
        var p = playerByDuelPos(pos);
        if (p) return p.realName || p.name || ('P' + pos);
        return 'P' + pos;
    }

    function handleMessage(m) {

        var n = m.name;
        var f = m.f || {};
        // 灵摆：本次连续灵摆召唤期间不重复触发；批次结束后才允许下次灵摆召唤再触发
        if (pendFx.batchOpen) {
            if (n === 'SpSummoning' || n === 'Summoning' || n === 'Move' || n === 'Hint') {
                pendExtend();
            } else if (VISIBLE_MSG[n]) {
                pendBatchEnd();
            }
        }
        switch (n) {
            case 'Start': {
                try { var _oldWin = document.querySelector('.rp-win-banner'); if (_oldWin) _oldWin.remove(); } catch (e) {}
                // PATCH(白神服) 2026-11-19: **实时模式不要把播放指针拨回 0**。
                //   回放里 Start = 回到开头重播；但实时对局中再收到一条 Start（换局/重连占位）
                //   若把 idx 归零，flush 会从头再消费一遍队列 → Start 又执行 → idx 又归零……
                //   变成 20 万次的假死循环（用户表现：整页卡住、卡组张数乱跳）。
                if (!liveMode) idx = 0;
                // 重置场地
                field = { 0: {}, 1: {} };
                // PATCH(白神服) 2026-11-19: **新一局必须清掉攻守缓存**。
                //   原来 cardStatByKey/cardStatByCode 跨局保留 → 上一局同一格子的实时攻守
                //   （被加减过的数值）会套到本局刚放上去的怪兽身上（用户实测：第二把
                //   同一格怪的攻击力变成上一把的数值 ✗）。
                try { cardStatByKey = {}; cardStatByCode = {}; } catch (e) {}
                lp = [8000, 8000];
                turnPlayer = 0;
                turnCount = 0;
                phaseText = '';
                // 卡组张数 = 开局主卡组数(mainc)，此后由 Draw/Move 增减
                // PATCH(白神服) 2026-11-19: 新一局重置为「未知」，并清掉来源优先级 ——
                //   否则上一局的 reload/deckcount 优先级会挡住本局的 Start。
                deckCount = [null, null];
                extraCount = [null, null];
                resetPilePriority();
                deckTopCode = [null, null];
                graveCountOverride = [null, null];
                deckReversed = [false, false];
                equipLinks = [];
                disabledFieldMask = 0;
                cardTargets = [];
                handCountAtStart = [0, 0];
                // PATCH(白神服) 2026-11-07: MSG_START 自带 player0/player1 的 deckCount/extraCount，
                //   之前只读 meta（大厅带过来的 m0/x0），没有 meta 时开局额外就显示 0，
                //   直到有卡进/出额外才被 Move 增量纠正（用户实测 ✗）。这里两条路都读。
                var _startPlaceholder = false;
                try {
                    var _pl = [[0, f.player0 || {}], [1, f.player1 || {}]];
                    _pl.forEach(function (pair) {
                        var dp2 = seatOf(pair[0]);
                        if (dp2 !== 0 && dp2 !== 1) return;
                        var o = pair[1] || {};
                        var dc2 = (typeof o.deckCount === 'number') ? o.deckCount : (typeof o.deck === 'number' ? o.deck : null);
                        var ec2 = (typeof o.extraCount === 'number') ? o.extraCount : (typeof o.extra === 'number' ? o.extra : null);
                        var hc2 = (typeof o.handCount === 'number') ? o.handCount : (typeof o.hand === 'number' ? o.hand : null);
                        // PATCH(白神服) 2026-11-19: srvpro 重连时发的是一条第 4 行 0/0 的**占位 Start**
                        //   （refresh-field-service.ts: sendMsgStart 写死 deckCount:0, extraCount:0）。
                        //   整块按"未知"处理，等紧随其后的 ReloadField 填 —— 否则重连后卡组/额外显示 0。
                        if (dc2 !== null && dc2 <= 0) { _startPlaceholder = true; return; }
                        if (dc2 !== null && dc2 > 0) setPileAbs(dp2, 'deck', dc2, 'start');
                        if (ec2 !== null) setPileAbs(dp2, 'extra', ec2, 'start');
                        if (hc2 !== null) handCountAtStart[dp2] = hc2;
                    });
                    if (typeof f.deck0 === 'number' && f.deck0 > 0) setPileAbs(seatOf(0), 'deck', f.deck0, 'start');
                    if (typeof f.deck1 === 'number' && f.deck1 > 0) setPileAbs(seatOf(1), 'deck', f.deck1, 'start');
                    if (typeof f.extra0 === 'number') setPileAbs(seatOf(0), 'extra', f.extra0, 'start');
                    if (typeof f.extra1 === 'number') setPileAbs(seatOf(1), 'extra', f.extra1, 'start');
                } catch (e) {}

                // PATCH(白神服) 2026-11-07: **回放一律不翻座位** ——
                //   BO3 里每局的 playerType 会变（0x10/0x11），按它翻会导致同一场比赛
                //   第 1、3 局上下互换（用户实测：R#6540/6543/6544 里 1、3 反了 ✗）。
                //   固定「DB pos0 = 下方」，整场比赛两侧选手位置一致。
                try { metaSwap = false; } catch (e) {}
                // PATCH(白神服) 2026-11-07: MSG_START 的库解码经常是空对象（f={}），
                //   于是「自己打」时卡组/额外张数读不到（用户实测：不显示 ✗）。
                //   这里直接从 hex 解：lp0(3..6) lp1(7..10) deck0(11..12) extra0(13..14) deck1(15..16) extra1(17..18)
                try {
                    var _hx = (m && m.hex) ? m.hex : (f && f.__hex) ? f.__hex : '';
                    // 协议是小端：低字节在前（原来按大端读 → 40 读成 10240，全部判定非法 ✗）
                    function _u16b(b, i) {
                        var lo = parseInt(b.substr(i * 2, 2), 16) || 0;
                        var hi = parseInt(b.substr(i * 2 + 2, 2), 16) || 0;
                        return lo | (hi << 8);
                    }
                    function _u32(b, i) {
                        var b0 = parseInt(b.substr(i * 2, 2), 16) || 0;
                        var b1 = parseInt(b.substr(i * 2 + 2, 2), 16) || 0;
                        var b2 = parseInt(b.substr(i * 2 + 4, 2), 16) || 0;
                        var b3 = parseInt(b.substr(i * 2 + 6, 2), 16) || 0;
                        return (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;
                    }
                    if (_hx && _hx.length >= 38) {
                        var _lp0 = _u32(_hx, 3), _lp1 = _u32(_hx, 7);
                        var _d0 = _u16b(_hx, 11), _x0 = _u16b(_hx, 13);
                        var _d1 = _u16b(_hx, 15), _x1 = _u16b(_hx, 17);
                        var _s0 = seatOf(0); if (_s0 !== 0 && _s0 !== 1) _s0 = 0;
                        var _s1 = seatOf(1); if (_s1 !== 0 && _s1 !== 1) _s1 = 1;
                        // PATCH(白神服) 2026-11-19: 重连的占位 Start 在 hex 里也是 0/0 →
                        //   和上面 player0/1 一样，整块按"未知"处理，别把额外写成 0。
                        var _hexPlaceholder = (_d0 <= 0 && _d1 <= 0);
                        if (!_hexPlaceholder) {
                            if (_d0 > 0 && _d0 <= 80) { setPileAbs(_s0, 'deck', _d0, 'start'); startDeck[_s0] = _d0; }
                            if (_x0 >= 0 && _x0 <= 30) { setPileAbs(_s0, 'extra', _x0, 'start'); startExtra[_s0] = _x0; }
                            if (_d1 > 0 && _d1 <= 80) { setPileAbs(_s1, 'deck', _d1, 'start'); startDeck[_s1] = _d1; }
                            if (_x1 >= 0 && _x1 <= 30) { setPileAbs(_s1, 'extra', _x1, 'start'); startExtra[_s1] = _x1; }
                        }
                        if (_hexPlaceholder) _startPlaceholder = true;
                        // ★ 服务端换边标记（最可靠来源，srvpro room.ts）：
                        //   观战者收到的 MSG_START playerType = isPosSwapped ? 0x11 : 0x10
                        //   普通玩家收到 0x00/0x01（那是"自己的座位"，不代表换边）
                        try {
                            var _pt = (f && typeof f.playerType === 'number') ? f.playerType
                                : (m && m.hex && m.hex.length >= 4 ? parseInt(m.hex.substr(2, 2), 16) : null);
                            if (_pt !== null && (_pt & 0xf0)) startSwapFlag = ((_pt & 0x0f) === 1) ? 1 : 0;
                        } catch (e) {}
                        if (_lp0 > 0) { lp[_s0] = _lp0; lpShown[_s0] = _lp0; }
                        if (_lp1 > 0) { lp[_s1] = _lp1; lpShown[_s1] = _lp1; }
                    }
                } catch (e) {}

                (meta && meta.players || []).forEach(function (p) {
                    var dp = seatOf(p.pos);
                    if (dp !== 0 && dp !== 1) return;
                    // PATCH(白神服) 2026-11-19: meta 只是大厅记录，优先级低于 Start/Reload，
                    //   只能在「还未知」时兜底，绝不能覆盖本局已经拿到的权威值。
                    //   重连的占位 Start（0/0）时连 meta 也不要用 —— 那是上一局的旧数字，
                    //   等 ReloadField 的权威快照（只隔一两条消息）。
                    if (!_startPlaceholder) {
                        if (p.mainc) setPileAbs(dp, 'deck', p.mainc, 'meta');
                        if (p.extrac !== undefined && p.extrac !== null) setPileAbs(dp, 'extra', p.extrac, 'meta');
                    }
                    if (p.handc !== undefined && p.handc !== null) handCountAtStart[dp] = p.handc;
                    // PATCH(白神服 2026-10-17): 血量 —— MSG_START 的玩家信息里本来就有 lp ✓，
                    //   但这里一直没读 ✗，而 lp 数组写死 [8000,8000] ✓
                    //   → 玩家**刷新/重连**时服务端发的是全量快照(Start)，血量不会重发 LpUpdate ✗
                    //   → 于是双方血量都显示回 8000（用户实测 ✗）。这里从快照里读回来 ✓
                    if (p.lp !== undefined && p.lp !== null && (dp === 0 || dp === 1)) {
                        lp[dp] = p.lp;
                        lpShown[dp] = p.lp;
                        try { if (lpEls[dp]) lpEls[dp].textContent = 'LP ' + lp[dp]; } catch (e) {}
                    }
                });
                // 应用服务端换边标记：**只用于名字映射**，不再去翻 meta.players（那是反复对换的来源）
                try {
                    if (startSwapFlag !== null && !seatOrderExplicit) {
                        seatOrder = (startSwapFlag === 1) ? [1, 0] : [0, 1];
                    }
                    metaAligned = true;
                } catch (e) {}
                createFieldDOM();
                // PATCH(白神服) 2026-11-07: 建好场地后**立刻**按已经读到的张数画牌堆 ——
                //   原来要等下一条消息触发 updatePiles，于是开局卡组/额外只显示数字、没有卡背，
                //   而且数字也要慢半拍才出来（用户实测 ✗）。
                try { updatePiles(); fitBoard(); } catch (e) {}
                try { markCountSource('start'); } catch (e) {}
                log('对局开始（房间 ' + (meta.roomName || '') + '）');
                logHtml('VS <b>' + escapeHtml(playerName(0)) + '</b> 对战 <b>' + escapeHtml(playerName(1)) + '</b>');
                break;
            }
            case 'UpdateData': {
                // PATCH: 处理「重连快照」。服务端在玩家重连时不重放整局，而是发
                //   MSG_START + NewTurn/NewPhase + **每个区域一条 UpdateData 全量** + 当前请求；
                //   而原实现的 UpdateData 分支只重建手牌/额外数量，**场上区一律不管** ——
                //   于是"重连回来场上卡全没"（实测：模型 怪兽区/魔陷区/墓地全空）。
                //   这里对"成片区域"按快照整区重建（UpdateData 对这些区域本来就是权威全量）。
                (function () {
                    var zl = f.location !== undefined ? (f.location & 0xff) : null;
                    // 卡组：原实现只记数量（deckCount），**把卡号丢了** —— 于是「天变地异」这类
                    // "卡组翻过来打（顶端公开）"的效果下，玩家看不到双方卡组顶端的卡（实测被反馈）。
                    // 服务端只在**该公开时才发**卡组全量（平时根本不发），所以"收到过就说明可以公开"。
                    if (zl === LOC.DECK && f.player !== undefined && f.player >= 0 && f.player <= 1 && Array.isArray(f.cards)) {
                        window.__ypDeck = window.__ypDeck || { 0: [], 1: [] };
                        var raw0 = f.raw || [];
                        window.__ypDeck[f.player] = f.cards.map(function (c, i) {
                            return { code: c, sequence: (raw0[i] && typeof raw0[i].sequence === 'number') ? raw0[i].sequence : i };
                        }).filter(function (x) { return !!x.code; })
                          .sort(function (a, b) { return a.sequence - b.sequence; });
                    }
                    // 额外卡组：原实现只记数量（extraCount），**把卡号丢了** → "查看列表"读模型时是空的
                    // （玩家反馈："为什么额外是空的"）。这里把卡号存到侧通道，供交互层列表使用。
                    // PATCH(白神服) 观战：额外卡组张数同步 —— 原来只在 Move 时增减，
                    //   而观战者的额外卡组是隐藏的、出场走的是快照 → 数字一直停在 15（用户实测）。
                    // PATCH(白神服) 2026-11-19: UpdateData 一律**不碰张数**。
                    //   它给出的只是"当前公开可见的那部分卡"（对手额外通常只有表侧的几张），
                    //   拿 cards.length 当张数会让 15→3→15 来回跳；张数只认
                    //   Start / ReloadField / DeckCount / SwapGraveDeck + Move/Draw 增减。
                    if (zl === LOC.EXTRA && f.player !== undefined && f.player >= 0 && f.player <= 1 && Array.isArray(f.cards)) {
                        updatePiles();
                    }
                    if (zl === LOC.DECK && f.player !== undefined && f.player >= 0 && f.player <= 1 && Array.isArray(f.cards)) {
                        updatePiles();
                    }
                    if (zl === LOC.EXTRA && f.player !== undefined && f.player >= 0 && f.player <= 1 && Array.isArray(f.cards)) {
                        window.__ypExtra = window.__ypExtra || { 0: [], 1: [] };
                        window.__ypExtra[f.player] = f.cards.filter(function (c) { return !!c; })
                            .map(function (c) { return (typeof c === 'number') ? c : ((c && c.code) || 0); });
                    }
                    // PATCH(白神服) 观战：手牌全量快照（洗牌/换备/效果导致手牌变化时服务端会发）
                    //   原来手牌只靠 Draw 累加、靠 Move 递减，隐藏卡没有卡号 → 减不掉 →
                    //   观战时「对方手牌越打越多」（用户实测：显示 11 张，实际 5 张）。
                    //   UpdateData(HAND) 是权威全量，直接按它重建。
                    if (zl === LOC.HAND && !handLock && f.player !== undefined && f.player >= 0 && f.player <= 1) {
                    // PATCH(白神服) 2026-11-07: 手牌快照为空时先把该玩家所有手牌条目清掉 ——
                    //   原来只按 cards 长度重建，0 张时旧条目/占位符会残留（用户实测：0 手卡还显示一堆 ✗）
                    try {
                        // 只有**确实是数组**的快照才能判断"手牌为空" ——
                        //   否则 UpdateData 解不出来（f.cards 缺失）时会被当成 0 张，整只手牌被清空 ✗
                        var _hcArr = Array.isArray(f.cards) ? f.cards : null;
                        var _hc0 = _hcArr ? _hcArr.length : -1;
                        if (_hc0 === 0) {
                            Object.keys(field[f.player] || {}).forEach(function (k) {
                                if (k.indexOf(LOC.HAND + ':') === 0) delete field[f.player][k];
                            });
                            updateZone(f.player, LOC.HAND);
                            return;      // 该玩家手牌已清空，跳过后续重建（在 IIFE 内，用 return）
                        }
                    } catch (e) {}
                        var hn = Array.isArray(f.cards) ? f.cards.length
                            : (typeof f.count === 'number' ? f.count : -1);
                        // PATCH(白神服) 观战：手牌不可能超过 20 张；某些快照的 cards 数组带的是
                        // 整副牌/占位（长度 40+），照它重建会「手牌明明空了却显示一大排」（用户实测）
                        // → 超过 20 一律当无效快照丢弃，交由 /api/lobby/spectate 的 handc 校正。
                        if (hn > 20) hn = -1;
                        // PATCH(白神服) 2026-11-06: 手牌快照**一律按它重建**（服务端全量，最权威）。
                        //   之前为了防"重复快照导致翻倍"，加了「只允许首次铺底 + 变小」的限制 ——
                        //   结果把**合法的变多**（抽卡后的快照）也丢掉了，
                        //   于是手牌张数越走越少/对不上，反过来又出现"0 张却显示一堆"的错乱（用户实测 ✗）。
                        //   真正需要防的是 hn>20 的坏快照，上面已经挡掉了。
                        if (hn >= 0) {
                            // 先记住"已公开"的手牌（同序号），重建后原样保留 ——
                            //   否则检索上手的卡被快照重建一冲就没了（用户实测：观战看不到检索的场地 ✗）
                            var _prevRev = {};
                            Object.keys(field[f.player] || {}).forEach(function (k) {
                                if (k.indexOf(LOC.HAND + ':') !== 0) return;
                                var cc = field[f.player][k];
                                if (cc && cc.revealedHand) _prevRev[Number(k.split(':')[1])] = cc;
                            });
                            Object.keys(field[f.player] || {}).forEach(function (k) {
                                if (k.indexOf(LOC.HAND + ':') === 0) delete field[f.player][k];
                            });
                            var hraw = f.raw || [];
                            for (var hi = 0; hi < hn; hi++) {
                                var hc = Array.isArray(f.cards) ? f.cards[hi] : 0;
                                // PATCH(白神服) 2026-11-07: 有的快照 cards 里是对象（query 数据），
                                //   直接当 0 会让**自己的手牌**也变成卡背（用户实测 ✗）
                                //   → 先试对象里的 code，再试 raw[i].code，都没有才当隐藏卡
                                if (typeof hc !== 'number') hc = toCode(hc);
                                var hq = hraw[hi] || {};
                                if (!hc && hq && typeof hq.code === 'number' && hq.code > 0) hc = hq.code;
                                var hpos = (typeof hq.position === 'number') ? hq.position : 0;
                                // 回放：手牌全部公开（有卡号就正面）
                                var hDown = hc ? (replayMode ? false : isFaceDown(hpos)) : true;
                                addCardAt(f.player, LOC.HAND, hi, hc, hDown, hpos);
                        // 该槽位刚被 ConfirmCards 公开过（卡号未知）= 检索上手的卡 → 补卡号并正面显示
                        try {
                            var _pr = pendingHandReveal[f.player + ':' + hi];
                            if (_pr && !hc && (Date.now() - _pr.at) < 8000) {
                                var _nc0 = field[f.player][LOC.HAND + ':' + hi];
                                if (_nc0) {
                                    _nc0.code = _pr.code;
                                    _nc0.faceDown = false;
                                    _nc0.revealed = true;
                                    _nc0.revealedHand = true;
                                    _nc0.revealedAt = Date.now();
                                    _revealHandCount[f.player] = hn;
                                }
                                delete pendingHandReveal[f.player + ':' + hi];
                            }
                        } catch (e) {}
                                if (_prevRev && _prevRev[hi]) {
                                    var _keep = _prevRev[hi];
                                    var _nc = field[f.player][LOC.HAND + ':' + hi];
                                    // 只有“同一张卡”才保留公开状态：新快照明确给了卡号且与旧卡一致。
                                    // 不能只按序号继承 —— 手牌 6→4（丢弃2）→6（抽2）时序号会复用，
                                    // 旧“公开过的弃牌”会被套到刚抽到的两张上（用户实测 ✗）。
                                    if (_nc && _keep.code && _nc.code === _keep.code) {
                                        _nc.code = _keep.code;
                                        _nc.faceDown = false;
                                        _nc.revealed = true;
                                        _nc.revealedHand = true;
                                        _nc.revealedAt = _keep.revealedAt;
                                        _revealHandCount[f.player] = hn;
                                    }
                                }
                            }
                            updateZone(f.player, LOC.HAND);
                            try {
                                (window.__handLog = window.__handLog || []).push({ t: 'UD', p: f.player, n: hn, len: (f.cards || []).length });
                                if (window.__handLog.length > 200) window.__handLog.shift();
                            } catch (e) {}
                        }
                    }
                    var zones = [LOC.MZONE, LOC.SZONE, LOC.GRAVE, LOC.REMOVED];
                    if (zl === null || zones.indexOf(zl) < 0) return;
                    if (f.player === undefined || f.player < 0 || f.player > 1) return;
                    if (!Array.isArray(f.cards)) return;
                    var raw = f.raw || [];
                    var _fieldZone = (zl === LOC.MZONE || zl === LOC.SZONE);
                    var _existingZoneKeys = Object.keys(field[f.player] || {}).filter(function (k) {
                        return k.indexOf(zl + ':') === 0;
                    });
                    // 场上区域：只有“第一次铺底”才按快照重建；之后一律字段级合并，
                    // 不再 delete 整区（YGOPro UpdateFieldCard 的行为）。
                    var _seedFieldZone = _fieldZone && _existingZoneKeys.length === 0;
                    // PATCH(白神服) 观战：快照里「未知里侧卡」（code=0 且 position 没带里侧位）不能被清掉 ——
                    //   否则盖牌只在盖放瞬间出现，下一条快照就被抹掉（用户实测）。
                    //   先把当前区里这类卡记下来，重建后原样保留。
                    var prevUnknown = {};
                    if (!_fieldZone || _seedFieldZone) {
                    Object.keys(field[f.player] || {}).forEach(function (k) {
                        if (k.indexOf(zl + ':') !== 0) return;
                        var c0 = field[f.player][k];
                        // PATCH(白神服) 2026-11-08: 除了"未知里侧卡"，也要保留**自己盖的卡**的明牌信息
                        //   （服务端快照里我方盖卡也可能 code=0，重建会把 knownCode 丢掉 →
                        //    自己的盖卡变成纯卡背，看不出是什么，用户实测 ✗）
                        if (c0 && c0.faceDown && (!c0.code || c0.knownCode)) prevUnknown[k] = c0;
                    });
                    // 先清空该区域
                    Object.keys(field[f.player] || {}).forEach(function (k) {
                        if (k.indexOf(zl + ':') === 0) delete field[f.player][k];
                    });
                    for (var i = 0; i < f.cards.length; i++) {
                        // 怪兽 0..6（5 格 + 2 额外怪兽区）、魔陷 0..5（5 格 + 场地），越界一律跳过
                        if (zl === LOC.MZONE && i > 6) continue;
                        if (zl === LOC.SZONE && i > 5) continue;
                        var code = f.cards[i];
                        // PATCH(白神服) 2026-11-07: 快照里的 entry 可能是解析器对象（空 query），
                        //   以前是 continue 跳过 → 这一格被当成空位清掉，
                        //   盖着的卡于是"被快照一冲就消失"（用户实测 ✗）。
                        //   现在统一转成卡号（对象解析不出就是 0），走下面"未知卡"分支保留旧卡。
                        if (typeof code !== 'number') code = toCode(code) || 0;
                        var q = raw[i] || {};
                        var pos = (typeof q.position === 'number') ? q.position : 0;
                        if (!code) {
                            // PATCH(白神服) 2026-11-07: **先看上一轮同格有没有卡** ——
                            //   盖卡的快照常常既没有卡号、position 也是 0（服务端抹掉了），
                            //   旧逻辑先判断"既无卡号又不是里侧 → 当空位跳过"，
                            //   于是盖着的卡被快照一冲就消失（用户实测 ✗）
                            var _pk2 = zl + ':' + i;
                            if (prevUnknown[_pk2]) {
                                var _keep2 = prevUnknown[_pk2];
                                _keep2.pos = pos || _keep2.pos;
                                field[f.player][_pk2] = _keep2;
                                continue;
                            }
                            if (pos && isFaceDown(pos)) { addCardAt(f.player, zl, i, 0, true, pos); }
                            // 没有旧卡、position 也不明确 → 视为空位（不写幽灵卡）
                            continue;
                        }
                        addCardAt(f.player, zl, i, code, isFaceDown(pos), pos);
                    }
                    // 观战快照可能只带“可见卡”而数组比整区短；被截断的里侧卡不能因此消失。
                    var _needZoneSlots = (zl === LOC.MZONE) ? 7 : 6;
                    if (f.cards.length < _needZoneSlots) {
                        Object.keys(prevUnknown).forEach(function (k) {
                            if (!field[f.player][k]) field[f.player][k] = prevUnknown[k];
                        });
                    }
                    } else {
                        // 场上区域字段级合并：只更新快照里明确给出的字段，
                        // 不删除旧卡、不把 code=0/position=0 当成清空。
                        for (var _ui = 0; _ui < f.cards.length; _ui++) {
                            if (zl === LOC.MZONE && _ui > 6) continue;
                            if (zl === LOC.SZONE && _ui > 5) continue;
                            var _uc = f.cards[_ui];
                            if (typeof _uc !== 'number') _uc = toCode(_uc) || 0;
                            var _uq = raw[_ui] || {};
                            var _up = (typeof _uq.position === 'number') ? _uq.position : 0;
                            var _uk = zl + ':' + _ui;
                            var _uv = field[f.player] && field[f.player][_uk];
                            if (_uv) {
                                // 表侧公开卡在快照里变成“彻底空位”→ 它已经离场；
                                // 里侧未知卡仍保留（observer 快照会抹掉 code/position）。
                                if (!_uc && !_up && !_uv.faceDown) {
                                    delete field[f.player][_uk];
                                    continue;
                                }
                                if (_uc && _uv.code !== _uc) _uv.code = _uc;
                                if (_up) {
                                    _uv.pos = _up;
                                    _uv.position = _up;
                                    _uv.faceDown = isFaceDown(_up);
                                    if (_uv.faceDown) _uv.code = _uv.code || _uc;
                                }
                                // mats/knownCode/overlayCodes 保留，快照没带就不改
                            } else if (_uc || (_up && isFaceDown(_up))) {
                                addCardAt(f.player, zl, _ui, _uc, isFaceDown(_up), _up);
                            }
                        }
                    }
                    if (zl === LOC.MZONE || zl === LOC.SZONE) { updateZone(f.player, zl); refreshEmz(); }
                    else {
                        if (zl === LOC.GRAVE) graveCountOverride[f.player] = null;
                        updatePiles();
                    }
                })();
                // UpdateData 语义复杂，雏形不重建场上区；
                // 但 手牌(2) 全量列表与 额外卡组(64) 是权威的；另外其中带卡牌 query 数据（攻守/等级/连接标记）
                var ingested = ingestUpdateDataStats(m);
                var udLoc = f.location !== undefined ? (f.location & 0xff) : null;
                // PATCH(白神服) 2026-11-08: **删掉这里第二套手牌/额外处理** ——
                //   上面那段已经按 UpdateData(HAND/EXTRA) 重建过手牌与额外张数了，
                //   这里又调一次 syncHand()（还带着"变大就忽略"的旧限制）→
                //   同一条快照被两套逻辑各写一次，手牌张数偶尔对不上（用户一直怀疑的"第三方显示"就是它 ✗）。
                //   额外的张数同样以上面那段为准（含"只接受变小"的保护）。
                // 攻守数据有变化 → 刷新对应区域（角标/连接箭头）
                if (ingested && udLoc !== null && f.player !== undefined && f.player >= 0 && f.player <= 1) {
                    if (udLoc === LOC.MZONE || udLoc === LOC.SZONE) updateZone(f.player, udLoc);
                }
                break;
            }
            case 'Draw': {
                var pl = f.player;
                var cards = f.cards || [];
                duelSfx('move');
                // 抽卡是 MSG_DRAW（不是 Move）→ 这里也要给手牌"准入"
                try {
                    if (ENTITY_MOVE) {
                        if (cards && cards.length && typeof cards[0] === 'object') {
                            cards.forEach(function (c) {
                                if (!c) return;
                                var seq = (c.sequence !== undefined) ? c.sequence : c.seq;
                                if (seq !== undefined) _handAdmitted[pl + ':' + seq] = true;
                            });
                        } else {
                            // 没有具体卡号时，先按"这个玩家的手牌都放行"处理
                            _handAdmitBypass = true;
                        }
                    }
                } catch (e) {}
                var drawN = cards.length || (f.count || 0);
                if (drawN) bumpPile(pl, 'deck', -drawN, 'draw');   // 未知时保持未知（不再 (x||0)-n）
                deckTopCode[pl] = null;
                logDrawRow(pl, cards, drawN);
                try {
                    (window.__handLog = window.__handLog || []).push({ t: 'Draw', p: pl, n: drawN, codes: cards.length,
                        after: (function () { var k = 0; Object.keys(field[pl] || {}).forEach(function (x) { if (x.indexOf(LOC.HAND + ':') === 0) k++; }); return k; })() });
                    if (window.__handLog.length > 200) window.__handLog.shift();
                } catch (e) {}
                cards.forEach(function (code) {
                    addToHand(pl, code);
                });
                // PATCH(白神服) 观战：隐藏手牌（cards 为空）**不再在这里加占位** ——
                //   手牌张数统一由 MSG_UPDATE_DATA(HAND) 的权威快照维护；
                //   两边都改会导致「显示很多 → 又变正常 → 又变多」的抖动（用户实测）。
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
                                    flyGhost(c, false, dkR, slotEl.getBoundingClientRect(), false,
                                        0, 0, ghostTilt(LOC.DECK), ghostTilt(LOC.HAND),
                                        animHideKeysForHandSlot(slotEl));
                                }, ci * 50);
                            }
                        });
                    }
                }
                break;
            }
            case 'NewTurn': {
                // PATCH(白神服) 2026-11-18: 面板按「本回合」显示 ——
                //   NS/SP/EF 每回合清零；ATK 是当前场上攻击表示怪兽的实时合计，不清零。
                // PATCH(白神服) 2026-11-19: 删掉「按先手玩家猜座位」的启发式 ——
                //   它和 autoAlignSeatsByCounts 一样会在中途把两侧名字对调（用户看到的
                //   「名字偶尔对换」）。座位现在完全由 seatOrder 决定，见 playerByDuelPos。
                metaAligned = true;
                turnPlayer = f.player;
                turnCount++;              // 回合计数
                // PATCH(白神服) 2026-11-18: 「具体信息」的 NS/SP/EF 按**本回合**统计 ——
                //   每回合开始清零；ATK 不在这里存，duelStats 里按当前场上攻击表示实时求和。
                try {
                    duelCount = [
                        { ns: 0, sp: 0, ef: 0, kinds: emptySpKind() },
                        { ns: 0, sp: 0, ef: 0, kinds: emptySpKind() }
                    ];
                    pendingSummon = [null, null];
                } catch (e) {}
                phaseText = '回合开始';
                renderPlayerHead(0);
                renderPlayerHead(1);
                if (phaseEl) phaseEl.textContent = phaseText;
                renderTurnLabel();
                // 高亮当前回合方
                [0, 1].forEach(function (c) {
                    var side = fieldEl.querySelector(c === 1 ? '.rp-opp' : '.rp-self');
                    if (side) side.classList.toggle('rp-active-side', turnPlayer === c);
                });
                log((turnCount ? ('第 ' + turnCount + ' 回合 · ') : '') + playerName(turnPlayer) + ' 的回合', 'rp-log-phase');
                break;
            }
            case 'NewPhase': {
                phaseText = PHASE_NAMES[f.phase] || ('阶段' + f.phase);
                if (phaseEl) phaseEl.textContent = phaseText;
                log('— ' + phaseText + ' —', 'rp-log-phase');
                duelSfx('phase');
                if (!animSuppress) phaseBanner(phaseText);
                break;
            }
            case 'UpdateCard': {
                /* PATCH(白神服): 对手里侧卡（盖放/里侧守备）主要靠 MSG_UPDATE_CARD 带 **position** 进来 ✗
                   原实现没有这个分支 → 对手盖的卡永远进不了模型 → **场上不显示卡背**（用户实测 ✓）
                   position 的里侧位 = 0x8（POS_FACEDOWN）✓ → faceDown=true → 查看器画卡背 ✓ */
                (function () {
                    var ctl = f.controller, loc = (f.location !== undefined ? (f.location | 0) & 0x7f : undefined),
                        seq = f.sequence;
                    var pos = f.position;
                    if (ctl === undefined || (ctl !== 0 && ctl !== 1)) return;
                    if (loc === undefined || seq === undefined) return;
                    if (!field[ctl]) field[ctl] = {};
                    var key = loc + ':' + seq;
                    var cur = field[ctl][key];
                    if (!cur) {
                        // UpdateCard 理论上只更新已有卡；缺卡时按 Move 兜底建一张，
                        // 但不能覆盖已有对象（会丢素材/known/叠放信息）。
                        cur = { code: (f.code !== undefined && f.code) ? f.code : 0, faceDown: false, pos: 0 };
                        field[ctl][key] = cur;
                    }
                    if (f.code !== undefined && f.code) cur.code = f.code;
                    var pv = (pos !== undefined) ? pos : cur.pos;
                    if (pos !== undefined) {
                        cur.pos = pv;
                        cur.position = pv;
                        cur.faceDown = (pos & 0x8) !== 0 || (pos & 0x2) !== 0;
                    }
                    // YGOProMsgUpdateCard 的攻守/等级在 f.card（CardQuery）里，不是平铺字段。
                    // 持续效果（如墓地 C5 给场上 C5 +400）就是靠这条更新，之前完全没 ingest，
                    // 所以角标一直显示基础攻击力。
                    try {
                        var _uq = f.card || f.query || f.info || null;
                        if (_uq) {
                            if (_uq.attack !== undefined && _uq.atk === undefined) _uq.atk = _uq.attack;
                            if (_uq.defense !== undefined && _uq.def === undefined) _uq.def = _uq.defense;
                            if (_uq.baseAttack !== undefined && _uq.batk === undefined) _uq.batk = _uq.baseAttack;
                            if (_uq.baseDefense !== undefined && _uq.bdef === undefined) _uq.bdef = _uq.baseDefense;
                        }
                        if (_uq && (_uq.attack !== undefined || _uq.atk !== undefined
                            || _uq.defense !== undefined || _uq.def !== undefined
                            || _uq.level !== undefined || _uq.rank !== undefined)) {
                            var _uk = ctl + ':' + loc + ':' + seq;
                            var _um = mergeStat(cardStatByKey[_uk], _uq);
                            if (_uq.code) _um.code = _uq.code;
                            cardStatByKey[_uk] = _um;
                            if (_uq.code) {
                                var _uc = mergeStat(cardStatByCode[_uq.code], _uq);
                                _uc.code = _uq.code;
                                // 卡号级缓存不能保存“某一只场上怪”的实时攻守/等级，
                                // 否则同卡号另一只没查到时会串值；场上只认 cardStatByKey。
                                delete _uc.atk; delete _uc.def; delete _uc.batk; delete _uc.bdef;
                                cardStatByCode[_uq.code] = _uc;
                            }
                        }
                    } catch (e2) {}
                    updateZone(ctl, loc); updateAllZones();
                })();
                break;
            }
            case 'Set': {
                // PATCH(白神服): 查看器原来**没有 Set 分支** ✗ —— 引擎盖卡发 MSG_SET，
                //   所以盖下去的卡根本没进模型 → 场地上一片空白（用户实测："看到盖放动画，落地后就消失了" ✗）
                //   这里补上：写进模型（faceDown）+ 刷新该格。
                (function () {
                    var f2 = (typeof f !== 'undefined' && f) ? f : m;
                    var ctl = (f2.controller !== undefined) ? f2.controller
                        : (m && m.hex ? hexU8(m.hex, 5) : (f2.info ? f2.info.controller : undefined));
                    var loc = ((f2.location !== undefined) ? f2.location
                        : (m && m.hex ? hexU8(m.hex, 6) : (f2.info ? f2.info.location : undefined)));
                    var seq = (f2.sequence !== undefined) ? f2.sequence
                        : (m && m.hex ? hexU8(m.hex, 7) : (f2.info ? f2.info.sequence : undefined));
                    var code = (f2.code !== undefined) ? f2.code : 0;
                    // 实战/观战的 envelope 有时把 controller/location/sequence 传成字符串，
                    // 严格 !== 会直接 return，盖放的卡就完全不进模型（回放是数字所以正常）。
                    ctl = Number(ctl);
                    loc = Number(loc);
                    seq = Number(seq);
                    code = Number(code) || 0;
                    // 观战/实战的 observer 视图可能把 Set 的 location 抹成 0；
                    // 只要 f 字段不合法就用 hex 里的真实字节兜底（回放通常直接是数字）。
                    try {
                        if (m && m.hex) {
                            var _hc = hexU8(m.hex, 5), _hl = hexU8(m.hex, 6), _hs = hexU8(m.hex, 7);
                            if (ctl !== 0 && ctl !== 1) ctl = _hc;
                            if (loc !== 4 && loc !== 8) loc = _hl;
                            if (typeof seq !== 'number' || isNaN(seq) || seq < 0 || seq > 5) seq = _hs;
                        }
                    } catch (e) {}
                    // ★ 字段校验（用户实测定位 ✓）：回放/部分消息里 f 是空的 ✗ → 上面靠 hex 兜底，
                    //   可能读出垃圾值 ✗ → 就会把"盖卡"写进不存在的格子 →
                    //   表现：**场上本该空着的格子显示卡背**（玩家一眼看出来 ✓）
                    //   这里只接受合法范围：控制者 0/1、区域 4/8、序号 0..5 ✓ 否则直接跳过 ✓
                    if (ctl !== 0 && ctl !== 1) { return; }
                    if (loc !== 4 && loc !== 8) { return; }
                    if (typeof seq !== 'number' || seq < 0 || seq > 5) { return; }
                    var pos = (f2.position !== undefined) ? f2.position : (f2.current !== undefined ? f2.current : 0x8);
                    if (ctl === 0 || ctl === 1) {
                        if (!field[ctl]) field[ctl] = {};
                        var pl = (loc | 0) & 0x7f;
                        // PATCH(白神服) 2026-11-07:
                        //   · 自己盖的卡自己是知道的 → knownCode 记上，按半透明明牌显示
                        //   · 对手盖卡 code=0 → 不记，保持纯卡背（隐私）
                        //   · 怪兽盖放必须是里侧守备（横置），不能竖放
                        var _setCode = toCode(code);
                        // PATCH(白神服) 2026-11-17: 效果盖放（卡组→场上）时 Set 常不带 code，
                        //   但前面 ConfirmCards 已经公开过 → 认成明牌显示（用户要求：落穴盖下去要能看到）
                        if (!_setCode) _setCode = lastRevealedCode(ctl, 15000);
                        var _setPos = (pl === LOC.MZONE) ? 0x8 : pos;
                        var _setKey = pl + ':' + seq;
                        var _revealSet = false;
                        try {
                        var _psr = pendingSetReveal[ctl + ':' + pl + ':' + seq];
                        // Set 的 code 常被服务端抹掉；用 Move 记下的卡号补上，
                        // 否则效果盖放会画成纯卡背，看起来“没有这张卡”。
                        if (!_setCode && _psr && _psr.code) _setCode = _psr.code;
                        if (_psr && (Date.now() - _psr.at) < 5000
                            && (!_setCode || !_psr.code || _setCode === _psr.code)) {
                            _revealSet = true;
                            delete pendingSetReveal[ctl + ':' + pl + ':' + seq];
                        }
                        } catch (e) {}
                        var _prevSet = field[ctl][_setKey];
                        // 自己盖的卡：允许 knownCode → CSS rp-card-known 显示“若隐若现”
                        // （卡背打底 + 低透明度卡面）。对手/观战的盖卡保持纯卡背。
                        var _ownSet = (ctl === 0 && !replayMode && !window.__ypWatchMode);
                        var _setKnown = (_ownSet && _setCode) ? _setCode : 0;
                        if (_prevSet) {
                            // Move 已经建过这张卡：保留对象身份/素材/known 信息，只改盖放字段。
                            if (_setCode) _prevSet.code = _setCode;
                            _prevSet.faceDown = true;
                            _prevSet.revealed = false;
                            _prevSet.pos = _setPos;
                            _prevSet.position = _setPos;
                            _prevSet.sequence = seq;
                            _prevSet.knownCode = _setKnown;
                            _prevSet._hideKnown = !_setKnown;
                            _prevSet._hiddenAt = Date.now();
                        } else {
                            field[ctl][_setKey] = {
                                code: _setCode, faceDown: true, pos: _setPos, sequence: seq, position: _setPos,
                                knownCode: _setKnown, _hideKnown: !_setKnown, _hiddenAt: Date.now()
                            };
                        }
                        updateZone(ctl, pl);
                        // 效果盖放前通常有一条“卡组/墓地 → 场上”的 Move，v2 会在替身飞行期间
                        // 把常驻卡节点藏起来。Set 已经落定时清掉替身/格子 hold，否则观战/实战会一直空白
                        //（回放因为 animSuppress 不生成替身，所以一直是正常的）。
                        try {
                            // 不手动删 .rp-fly：Set 只改状态；Move 替身按自己的
                            // beginFly/endFly 生命周期自然结束，避免截断无关动画
                            // 或提前解除其他替身的目标隐藏（YGOPro 的 Set 不新建对象）。
                            var _setNowCell = cellElFor(ctl, pl, seq);
                            if (_setNowCell) { _setNowCell._fxHold = false; _setNowCell.style.opacity = ''; }
                            if (window.__frApi && window.__frApi.syncGhosts) window.__frApi.syncGhosts();
                        } catch (e) {}
                        // 效果盖放不再做“翻开展示 1.3 秒再盖回”的模型翻转：
                        // 那套动画需要临时把 faceDown 改成 false，任何一次 updateZone/快照
                        // 卡在展示阶段就会把盖卡留成不可见/透明节点。
                        // YGOPro 里 Set 就是直接落成卡背，这里只保留卡背状态。
                        try {
                            var _setCellEl2 = cellElFor(ctl, pl, seq);
                            if (_setCellEl2) {
                                _setCellEl2._fxHold = false;
                                _setCellEl2.style.opacity = '';
                                _setCellEl2.classList.remove('rp-force-back');
                            }
                        } catch (e) {}
                        // PATCH(白神服) 2026-11-05: 盖放是「手牌 → 场上」，引擎只发 MSG_SET 没有 Move，
                        //   原来只把卡放进场上区、**没有从手牌移除** → 每次盖放都留一张"幽灵手牌"，
                        //   手牌会越来越多（用户实测：手上没卡了却显示 12 张卡背 ✗）。
                        try { removeFromHandByCode(ctl, code); updateZone(ctl, LOC.HAND); } catch (e) {}
                        log(playerName(ctl) + ' 盖上 1 张卡（' + (pl === 4 ? '怪兽区' : '魔陷区') + ' ' + (seq + 1) + '）');
                        updateAllZones && updateAllZones();
                    }
                })();
                break;
            }
            case 'PosChange': {
                // 表示形式变更（守备↔攻击）
                // payload: code(4) controller(1) location(1) sequence(1) previousPosition(1) currentPosition(1)
                var pcCode = hexU32(m.hex, 1);
                var pcCtl = hexU8(m.hex, 5);
                var pcLoc = hexU8(m.hex, 6);
                var pcSeq = hexU8(m.hex, 7);
                var pcPrev = hexU8(m.hex, 8);
                var pcCur = hexU8(m.hex, 9) || (f.currentPosition || 0);
                var pcName = cardName(pcCode) || ('#' + pcCode);
                // PATCH(白神服): 表示形式变更里**里侧**要同步到模型 ——
                //   0x8 = 里侧守备（0x2 = 表侧?/里侧攻击，按需一并处理）→ 不同步的话
                //   "怪变里侧守备会直接消失"（用户实测 ✗）：模型里 faceDown=false，卡面按正面去画但取不到卡图 → 空白
                try {
                    var _fd = !!((pcCur | 0) & 0x8);
                    var _pc = (field[pcCtl] ? field[pcCtl][pcLoc + ':' + pcSeq] : null);
                    if (!_pc && pcCode) {
                        // 按卡号在场上扫一遍
                        [0, 1].forEach(function (c) {
                            if (!field[c]) return;
                            Object.keys(field[c]).forEach(function (k) {
                                if (field[c][k] && field[c][k].code === pcCode) _pc = field[c][k];
                            });
                        });
                    }
                    if (_pc) {
                        _pc.faceDown = _fd;
                        _pc.pos = (pcCur | 0);
                        _pc.position = (pcCur | 0);
                        if (_fd) _pc.code = _pc.code || pcCode;   // 保留卡号（我们知道自己盖的是什么）
                        updateZone(pcCtl, pcLoc);
                    }
                } catch (e) {}

                // 先按 (controller,location,sequence) 精确找，找不到再按卡号在场上扫
                var pcCard = field[pcCtl] ? field[pcCtl][pcLoc + ':' + pcSeq] : null;
                if (!pcCard || (pcCard.code && pcCard.code !== pcCode)) {
                    pcCard = null;
                    var pcLocs = [LOC.MZONE, LOC.SZONE];
                    for (var pli = 0; pli < pcLocs.length && !pcCard; pli++) {
                        for (var psq = 0; psq < 7; psq++) {
                            var pcCand = field[pcCtl] ? field[pcCtl][pcLocs[pli] + ':' + psq] : null;
                            if (pcCand && pcCand.code === pcCode) {
                                pcCard = pcCand; pcLoc = pcLocs[pli]; pcSeq = psq; break;
                            }
                        }
                    }
                }
                if (pcCard) {
                    pcCard.pos = pcCur;                       // 更新表示形式（守备横置 / 攻击竖置）
                    pcCard.faceDown = isFaceDown(pcCur);
                    updateZone(pcCtl, pcLoc);
                    // 表示形式变化特效（攻击=双剑 / 守备=盾牌），照 MDPro3 的 AnimationPosition
                    try {
                        if (!animSuppress && !isFaceDown(pcCur))
                            positionIconFx(cardRectAt(pcCtl, pcLoc, pcSeq), isDefense(pcCur));
                    } catch (e) {}
                    if (pcLoc === LOC.MZONE && pcSeq >= 5) refreshEmz();   // 额外怪兽区(seq5/6)单独刷新
                }
                var pcIsMonster = (pcLoc === LOC.MZONE);
                var pcPosText = function (p) {
                    if (!pcIsMonster) return isFaceDown(p) ? '里侧' : '表侧';   // 魔陷：只分表侧/里侧
                    if (isFaceDown(p)) return '里侧' + (isDefense(p) ? '守备' : '攻击');
                    return isDefense(p) ? '守备' : '攻击';
                };
                log(playerName(pcCtl) + ' ' + pcName + '：' + (pcIsMonster ? '表示形式 ' : '')
                    + pcPosText(pcPrev) + ' → ' + pcPosText(pcCur));
                break;
            }
            case 'Move': {
                var code = f.code;
                var prev = f.previous || {};
                var cur = f.current || {};
                // 实战/观战的 envelope 有时 current 只有极少字段；用 hex 补齐目的地，
                // 否则 moveCard 不知道要落到哪个格，日志有“卡组▶魔陷”但场上空白。
                try {
                    if (m && m.hex && (cur.location === undefined || !cur.location)) {
                        var _hb = hexBase(m.hex, code);
                        var _hToCtl = hexU8(m.hex, _hb + 8);
                        var _hToLoc = hexU8(m.hex, _hb + 9);
                        var _hToSeq = hexU8(m.hex, _hb + 10);
                        var _hToPos = hexU8(m.hex, _hb + 11);
                        if (_hToLoc) {
                            cur = {
                                controller: (_hToCtl === 0 || _hToCtl === 1) ? _hToCtl : (prev.controller !== undefined ? prev.controller : 0),
                                location: _hToLoc,
                                sequence: _hToSeq,
                                position: _hToPos
                            };
                        }
                    }
                } catch (e) {}
                // 进手牌 → 准入该手牌格（消息驱动）
                try {
                    if (ENTITY_MOVE && cur && (cur.location & 0x7f) === LOC.HAND && prev
                        && (prev.location & 0x7f) !== LOC.HAND) {
                        var _hc = (cur.controller !== undefined) ? cur.controller
                            : ((prev.controller !== undefined) ? prev.controller : 0);
                        var _hs = (cur.sequence !== undefined) ? cur.sequence : 0;
                        _handAdmitted[_hc + ':' + _hs] = true;
                        _handAdmitCount = (_handAdmitCount || 0) + 1;
                    }
                    // 兜底：跑了不少消息还一张都没准入 → 说明这台回放的抽卡没有 Move，直接全放开
                    if (ENTITY_MOVE && !_handAdmitBypass && idx > 80) {
                        _handAdmitBypass = true;
                    }
                } catch (e) {}
                // PATCH(白神服) 2026-11-17: 把"某张卡从 A 挪到 B"告诉 v2 渲染器，
                //   让它用**同一个卡节点**从 A 滑到 B（而不是"卡 + 一段动画"两个东西）。
                try {
                    if (window.__frOnMove && cur && cur.location) {
                        window.__frOnMove({
                            code: toCode(code),
                            fromCtl: prev.controller, fromLoc: prev.location, fromSeq: prev.sequence,
                            toCtl: cur.controller, toLoc: cur.location, toSeq: cur.sequence
                        });
                    }
                } catch (e) {}
                // MSG_MOVE: type(1) code(4) from(4) to(4) reason(4) → reason 在偏移 13
                try {
                    if (m && m.hex && m.hex.length >= 30) {
                        var mbase = hexBase(m.hex, code);
                        var mvReason = hexU32(m.hex, mbase + 12);
                        var toCtl = hexU8(m.hex, mbase + 8);
                        var toLoc = hexU8(m.hex, mbase + 9);
                        if (toCtl === 0 || toCtl === 1) { lastMoveCtl = toCtl; lastMoveIdx = idx; }
                        if ((mvReason & 0x800) && (toLoc & 0x04)) lastSpSummonReason = mvReason;
                    }
                } catch (e) {}
                var name = cardName(code);
                var pRawM = prev.location;
                var cRawM = cur.location;
                var prevOv = pRawM !== undefined && (pRawM & 0x80) !== 0;   // 来源=叠放素材
                var curOv = cRawM !== undefined && (cRawM & 0x80) !== 0;    // 去向=叠放素材
                var pPlain = pRawM === undefined ? null : (pRawM & 0x7f);
                var cPlain = cRawM === undefined ? null : (cRawM & 0x7f);
                // 卡片移动音；破坏（DESTROY/BATTLE）用专门的破坏音
                try {
                    if (!prevOv && !curOv) {
                        var _mvReasonSfx = Number(f.reason || 0);
                        try {
                            if (m.hex && m.hex.length >= 30) {
                                var _mvBaseSfx = hexBase(m.hex, code);
                                _mvReasonSfx = hexU32(m.hex, _mvBaseSfx + 12);
                            }
                        } catch (e) {}
                        var _destroySfx = (pPlain === LOC.MZONE || pPlain === LOC.SZONE)
                            && (cPlain === LOC.GRAVE || cPlain === LOC.REMOVED)
                            && ((_mvReasonSfx & 0x1) || (_mvReasonSfx & 0x4));
                        duelSfx(_destroySfx ? 'destroy' : 'move');
                    }
                } catch (e) {}
                // 效果从卡组/墓地直接盖到场上：Move 先到，Set 随后到。
                // 记下来，Set 时临时把这张卡翻开给玩家看，再盖回去。
                try {
                    if ((pPlain === LOC.DECK || pPlain === LOC.GRAVE)
                        && (cPlain === LOC.SZONE || cPlain === LOC.MZONE) && code) {
                        pendingSetReveal[(cur.controller !== undefined ? cur.controller : 0) + ':' + cPlain + ':' + cur.sequence]
                            = { code: toCode(code), at: Date.now() };
                    }
                } catch (e) {}
                var mCon = prev.controller !== undefined ? prev.controller : 0;
                var mConC = cur.controller !== undefined ? cur.controller : mCon;
                var mSeqP = prev.sequence !== undefined ? prev.sequence : 0;
                var mSeqC = cur.sequence !== undefined ? cur.sequence : 0;

                // 动画：移动前记下来源矩形
                var animPreSrc = null;
                if (!animSuppress && !prevOv && pRawM !== undefined) {
                    if (pPlain === LOC.HAND) {
                        animPreSrc = rectAtHandByCode(mCon, code)
                            || rectAtHandBySeq(mCon, mSeqP)
                            || rectAtHandAny(mCon);
                    } else if (pPlain === LOC.MZONE || pPlain === LOC.SZONE || pPlain === LOC.GRAVE
                        || pPlain === LOC.REMOVED || pPlain === LOC.DECK || pPlain === LOC.EXTRA) {
                        animPreSrc = cardRectAt(mCon, pRawM, mSeqP);
                    }
                }
                // 卡组/额外卡组计数（叠放素材不计）
                if (!prevOv && !curOv) {
                    // PATCH(白神服) 2026-11-07: 张数增减要分别记到「来源方」和「目标方」——
                    //   原来统一写到 mCon（来源控制者），卡从别处回卡组/回额外时张数会记错人，
                    //   表现出来就是「魔兽的大饵把额外除外了，额外张数却还是 15」（用户实测 ✗）
                    // PATCH(白神服) 2026-11-19: 统一走 bumpPile —— 值未知时保持未知，
                    //   不再用它 `(x||0)±1` 把"未知"变成 1 / 0（那是张数忽大忽小的另一半原因）。
                    if (pPlain === LOC.DECK) { bumpPile(mCon, 'deck', -1, 'move'); deckTopCode[mCon] = null; }
                    // 检索：卡组 → 手牌，且这张卡刚被公开（ConfirmCards）→ 让它正面显示一会儿
                    if (pPlain === LOC.DECK && cPlain === LOC.HAND) {
                        // PATCH(白神服) 2026-11-07: **检索=公开信息**，只要服务端给了卡号就直接亮牌，
                        //   不再依赖"3 秒内先收到 ConfirmCards"（顺序不固定，经常收不到 → 不显示 ✗）
                        try {
                            var _cd = toCode(code);
                            if (_cd) _pendingRevealHand[_cd + ':' + mConC] = true;
                        } catch (e) {}
                    }
                    if (cPlain === LOC.DECK) { bumpPile(mConC, 'deck', +1, 'move'); }
                    if (pPlain === LOC.EXTRA) {
                        bumpPile(mCon, 'extra', -1, 'move');
                        removeExtraFaceUp(mCon, toCode(code));
                    }
                    if (cPlain === LOC.EXTRA) {
                        // PATCH(白神服) 2026-11-07: 灵摆从场上送墓 → **表侧**回额外卡组，
                        //   消息里 current.location 常带 0x80（叠加位），旧代码把整次移动当"素材"跳过 →
                        //   额外张数不增加、也看不到表侧灵摆卡（用户实测 ✗）。这里无条件计数。
                        bumpPile(mConC, 'extra', +1, 'move');
                        var _posx = (cur.position !== undefined) ? (cur.position | 0) : 0;
                        var _up = !isFaceDown(_posx) && (!!toCode(code));
                        if (_up) addExtraFaceUp(mConC, toCode(code));
                    }
                }
                if (cur.location !== undefined) {
                    var hostRectForFx = null;
                    if (curOv) {
                        // ── 素材叠放 ──
                        if (cPlain === LOC.MZONE) {
                            // 宿主已在场上：直接给宿主格 +1（sequence = 宿主格序号）
                            var hostCard = field[mConC] ? field[mConC][LOC.MZONE + ':' + mSeqC] : null;
                            if (hostCard) {
                                hostCard.mats = (hostCard.mats || 0) + 1;
                                // 记住素材卡号（查询没带 overlayCodes 的录像靠这里补）
                                try {
                                    var _mcode = toCode(code);
                                    if (_mcode) {
                                        hostCard.overlayCodes = hostCard.overlayCodes || [];
                                        hostCard.overlayCodes.push(_mcode);
                                    }
                                } catch (e) {}
                                hostRectForFx = rectAt(mConC, LOC.MZONE, mSeqC);
                            }
                        } else {
                            // 宿主还在额外卡组（sequence = 额外卡组序号）：先记着，宿主落地时再叠
                            var pkey = mConC + ':' + mSeqC;
                            if (!pendingMats[pkey]) pendingMats[pkey] = { count: 0, rects: [], codes: [] };
                            pendingMats[pkey].count++;
                            try { var _pmc = toCode(code); if (_pmc) pendingMats[pkey].codes.push(_pmc); } catch (e) {}
                            if (animPreSrc) pendingMats[pkey].rects.push(animPreSrc);
                        }
                        // 素材来源若是场上怪兽，从场上移除（素材卡本身不入场）
                        if (!prevOv && pPlain !== null && pPlain !== LOC.HAND) {
                            removeAt(mCon, pPlain, mSeqP);
                        } else if (!prevOv && pPlain === LOC.HAND) {
                            removeFromHandByCode(mCon, code);
                        }
                        if (hostRectForFx && animPreSrc) overlayStackFx(animPreSrc, hostRectForFx, code);
                        pushMat(code, animPreSrc);   // 素材入缓冲（供超量/融合演出用）
                    } else {
                        var _graveBefore = (!prevOv && pPlain === LOC.GRAVE) ? countLoc(mCon, LOC.GRAVE) : -1;
                        moveCard(prev, cur, code);                        // 宿主从额外卡组落地：把之前叠放的素材归到它头上，并播叠放动画
                        // 墓地 → 卡组/手牌：如果 moveCard 因 seq/卡号错位没能删掉来源，
                        // 墓地张数会保持不变，界面就“回收了却还在”。这里兜底删一张同卡号。
                        if (_graveBefore >= 0 && (cPlain === LOC.DECK || cPlain === LOC.HAND)
                            && countLoc(mCon, LOC.GRAVE) >= _graveBefore && code) {
                            try {
                                var _gc2 = toCode(code);
                                var _gkeys = Object.keys(field[mCon] || {}).filter(function (k) {
                                    return k.indexOf(LOC.GRAVE + ':') === 0;
                                });
                                for (var _gi = 0; _gi < _gkeys.length; _gi++) {
                                    var _gv = field[mCon][_gkeys[_gi]];
                                    if (_gv && (!_gc2 || !_gv.code || _gv.code === _gc2)) {
                                        delete field[mCon][_gkeys[_gi]];
                                        break;
                                    }
                                }
                                updatePiles();
                            } catch (e) {}
                        }
                        if (!prevOv && pPlain === LOC.EXTRA) {
                            var lk = mConC + ':' + mSeqP;
                            var pendMats = pendingMats[lk];
                            var landed = field[mConC] ? field[mConC][(cPlain || 0) + ':' + mSeqC] : null;
                            if (pendMats && landed) {
                                landed.mats = (landed.mats || 0) + pendMats.count;
                                try {
                                    if (pendMats.codes && pendMats.codes.length) {
                                        landed.overlayCodes = (landed.overlayCodes || []).concat(pendMats.codes);
                                    }
                                } catch (e) {}
                                var hostR = rectAt(mConC, cRawM, mSeqC);
                                if (hostR) {
                                    pendMats.rects.forEach(function (r, i) {
                                        setTimeout(function () { overlayStackFx(r, hostR, code); }, 60 + i * 70);
                                    });
                                }
                            }
                            delete pendingMats[lk];
                        }
                        // 记录最近一次怪兽落地（供 SpSummoning 判断召唤种类/是否来自额外卡组）
                        if (cPlain === LOC.MZONE) {
                            lastLand = { code: code, fromExtra: (pPlain === LOC.EXTRA), idx: idx, ctl: mConC, seq: mSeqC, rawLoc: cRawM };
                            var landType = summonTypeOf(code);
                            // 连接怪：落地瞬间就先隐藏（避免特效前闪一下），等素材红球飞到位再由小变大现身
                            if (!animSuppress && pPlain === LOC.EXTRA && landType === 'link') {
                                var linkCell = cellElFor(mConC, cRawM, mSeqC);
                                if (linkCell) fxHoldCell(linkCell, 1800);
                            }
                            // 灵摆动画不在这里触发 ✗（原来按"这张卡是不是灵摆怪"就起钟摆 →
                            //   普通召唤/效果特召一只灵摆怪也会播灵摆召唤动画，用户实测 ✗）
                            //   正确做法：只有引擎的**灵摆召唤**事件（SpSummoning 且 summonType=7）才播 ✓
                            //   见下面 SpSummoning 分支。
                        }
                        // 素材进缓冲：场上/手牌/卡组 → 墓地（非战斗破坏）
                        if (!animSuppress && !inBattle && cPlain === LOC.GRAVE
                            && (pPlain === LOC.MZONE || pPlain === LOC.SZONE || pPlain === LOC.HAND || pPlain === LOC.DECK)) {
                            pushMat(code, animPreSrc);
                        }
                    }
                    // 素材取除（素材 → 墓/手/除外等）：宿主计数 -1
                    if (prevOv && !curOv) {
                        if (pPlain === LOC.MZONE) {
                            var hc = field[mCon] ? field[mCon][LOC.MZONE + ':' + mSeqP] : null;
                            if (hc) {
                                hc.mats = Math.max(0, (hc.mats || 0) - 1);
                                try {
                                    var _rc0 = toCode(code);
                                    if (_rc0 && hc.overlayCodes && hc.overlayCodes.length) {
                                        var _ri0 = hc.overlayCodes.lastIndexOf(_rc0);
                                        if (_ri0 >= 0) hc.overlayCodes.splice(_ri0, 1);
                                    }
                                } catch (e) {}
                            }
                            var hRect = hc ? rectAt(mCon, LOC.MZONE, mSeqP) : null;
                            var dRectD = rectAt(mConC, cRawM, mSeqC);
                            if (hRect && dRectD) flyGhost(code || 0, false, hRect, dRectD, false,
                                ghostAngle(LOC.MZONE, hc, mCon), ghostAngle(cPlain, cur, mConC),
                                ghostTilt(LOC.MZONE), ghostTilt(cPlain),
                                animHideKeysAt(mConC, cPlain, mSeqC));
                        }
                    }
                    // 刷新涉及区域
                    if (!prevOv && pPlain !== null && (mCon !== mConC || pPlain !== cPlain)) {
                        updateZone(mCon, pPlain);
                    }
                    if (!curOv) updateZone(mConC, cPlain);
                    updateAllZones();
                    // SwapGraveDeck 后墓地卡号未知，用 override 维持张数；之后每张 Move 继续增减
                    try {
                        if (graveCountOverride[mCon] !== null && graveCountOverride[mCon] !== undefined) {
                            if (!prevOv && pPlain === LOC.GRAVE) graveCountOverride[mCon] = Math.max(0, graveCountOverride[mCon] - 1);
                            if (!curOv && cPlain === LOC.GRAVE) graveCountOverride[mCon] = graveCountOverride[mCon] + 1;
                            updatePiles();
                        }
                    } catch (e) {}
                    // 超量宿主离开场上（去墓地/除外/手牌/额外/成为素材）：
                    // 旧格必须清掉素材叠图和 mats，不能把素材留在原地。
                    try {
                        var _hostLeftField = !prevOv && (pPlain === LOC.MZONE || pPlain === LOC.SZONE)
                            && (curOv || (cPlain !== LOC.MZONE && cPlain !== LOC.SZONE));
                        if (_hostLeftField) {
                            var _oldHostKey = pPlain + ':' + mSeqP;
                            var _curOld = field[mCon] && field[mCon][_oldHostKey];
                            if (_curOld && (!code || !_curOld.code || _curOld.code === toCode(code))) {
                                delete field[mCon][_oldHostKey];
                            }
                            var _oldCell = cellElFor(mCon, pPlain, mSeqP);
                            if (_oldCell) {
                                _oldCell._matN = 0;
                                _oldCell._matCodes = [];
                                Array.prototype.forEach.call(_oldCell.querySelectorAll('.rp-mat, .rp-mats'), function (e) {
                                    if (e.parentNode) e.parentNode.removeChild(e);
                                });
                            }
                            updateZone(mCon, pPlain);
                        }
                    } catch (e) {}
                    // 落到怪兽/魔陷区的 Move：实时消息有时没有后续 Set/UpdateCard，
                    // 模型格必须兜底补上；魔陷区一律先画里侧卡背。
                    try {
                        if (!curOv && (cPlain === LOC.SZONE || cPlain === LOC.MZONE)) {
                            if (!field[mConC]) field[mConC] = {};
                            var _dstKey = cPlain + ':' + mSeqC;
                            if (field[mConC] && !field[mConC][_dstKey]) {
                                var _dstDown = isFaceDown(cur.position);
                                addCardAt(mConC, cPlain, mSeqC, toCode(code), _dstDown, cur.position || 0x8);
                                updateZone(mConC, cPlain);
                            }
                            if (cPlain === LOC.SZONE) {
                                Array.prototype.forEach.call(document.querySelectorAll('.rp-fly:not(.rp-fly-atk)'), function (g) {
                                    if (g.parentNode) g.parentNode.removeChild(g);
                                });
                                var _dstCell = cellElFor(mConC, cPlain, mSeqC);
                                if (_dstCell) { _dstCell._fxHold = false; _dstCell.style.opacity = ''; }
                                if (window.__frApi && window.__frApi.syncGhosts) window.__frApi.syncGhosts();
                            }
                        }
                    } catch (e) {}
                    // 常规移动动画
                    if (animPreSrc && !curOv && !prevOv) {
                        var sameCell = pPlain === cPlain && mCon === mConC
                            && (prev.sequence === undefined || cur.sequence === undefined || prev.sequence === cur.sequence);
                        if (cPlain === LOC.GRAVE && (pPlain === LOC.MZONE || pPlain === LOC.SZONE)) {
                            // 若这次破坏正是攻击命中的目标：爆炸与破碎同时发生
                            if (pendingImpact && !pendingImpact.done && pendingImpact.code === code) {
                                var impRect = pendingImpact.rect;
                                var impCtl = pendingImpact.defCtl;
                                pendingImpact.done = true;
                                pendingImpact = null;
                                try { if (window.__frOnLeave) window.__frOnLeave({ code: code, rect: impRect }); } catch (e) {}
                                boomFx(impRect);
                                var gPileEl2 = midEls['grave:' + (impCtl === undefined ? mConC : impCtl)];
                                shatterFx(impRect, gPileEl2 ? gPileEl2.getBoundingClientRect() : null);
                            } else {
                                var gPileEl = midEls['grave:' + mConC];
                                try { if (window.__frOnLeave) window.__frOnLeave({ code: code, rect: animPreSrc }); } catch (e) {}
                                shatterFx(animPreSrc, gPileEl ? gPileEl.getBoundingClientRect() : null);
                            }
                        } else if (sameCell) {
                            if (prev.position !== undefined && cur.position !== undefined
                                && isFaceDown(prev.position) && !isFaceDown(cur.position) && code) {
                                var flipRect = animPreSrc;
                                setTimeout(function () { flipNodeIn(cellElFor(mConC, cPlain, mSeqC), cPlain === LOC.MZONE && isDefense(cur.position), cPlain === LOC.SZONE); }, 40);
                            }
                        } else {
                            var dRect = rectAt(mConC, cRawM, mSeqC);
                            // 连接召唤：不播"卡图滑行"（否则会在演出前露出卡图），交给素材红球+数码特效
                            var isLinkLand = (!prevOv && pPlain === LOC.EXTRA && cPlain === LOC.MZONE
                                && summonTypeOf(code) === 'link');
                            if (dRect && !isLinkLand) {
                                flyGhost(code || 0, isFaceDown(cur.position) || cPlain === LOC.DECK || cPlain === LOC.EXTRA, animPreSrc, dRect,
                                    false, ghostAngle(pPlain, prev, mCon), ghostAngle(cPlain, cur, mConC),
                                    ghostTilt(pPlain), ghostTilt(cPlain),
                                    (cPlain === LOC.MZONE || cPlain === LOC.SZONE) ? animHideKeysAt(mConC, cPlain, mSeqC)
                                        : (cPlain === LOC.HAND ? animHideKeysForHandSeq(mConC, mSeqC) : ''));
                                if (cPlain === LOC.MZONE) {
                                    var ringRect = dRect;
                                    setTimeout(function () { summonRingFx(ringRect); }, 200);
                                }
                            }
                        }
                    }
                }
                // 日志：素材进出不刷屏
                var from = (!prevOv && pRawM !== undefined) ? (LOC_NAME[pPlain] || '') : '';
                var to = (!curOv && cRawM !== undefined) ? (LOC_NAME[cPlain] || '') : '';
                if (to) {
                    var mover = cur.controller !== undefined ? playerName(cur.controller) : '';
                    // PATCH(白神服) 2026-11-07: 检索/回收要写清「哪张卡的效果 → 拿到了哪张卡」
                    //   例：天空侠：卡组 → 手卡 泡泡侠（用户要求）
                    var _isSearch = (!prevOv && !curOv && from && to === '手卡'
                        && (pPlain === LOC.DECK || pPlain === LOC.GRAVE || pPlain === LOC.REMOVED));
                    var _src = '';
                    try {
                        // 用时间窗（10 秒）而不是消息条数：连锁处理可能夹很多条消息，
                        //   按条数算经常"过期"导致检索日志丢了来源卡（用户实测）
                        if (lastEffect && lastEffect.name && (Date.now() - (lastEffect.at || 0) <= 10000)) _src = lastEffect.name;
                    } catch (e) {}
                    if (_isSearch && _src) {
                        // 观战视野里"检索到的那张卡"可能没有卡号（服务端只让人知道自己检索了什么）
                        //   → 卡名未知时写「未知卡」，但至少把「谁检索的」写清楚
                        log((mover ? mover + '：' : '') + _src + '：' + from + ' → ' + to + ' ' + (name || '未知卡'), 'rp-log-hint');
                        lastEffect = { name: '', idx: -1, at: 0 };   // 用完就清，避免影响后面别的移动
                    } else {
                        // PATCH(白神服) 2026-11-17: 实战里 Move 的 envelope 常常不带 code →
                        //   日志就成了「卡片  手牌 ▶ 怪兽」没图没名（用户实测）。
                        //   这里退回 hex 解卡号；再拿不到就用「公开」缓存里同座位/序号的卡号。
                        var _mvCode = toCode(code);
                        if (!_mvCode) {
                            try { _mvCode = moveCodeFromHex(m && m.hex); } catch (e) {}
                        }
                        if (!_mvCode) {
                            try { _mvCode = revealedCodeAt(mConC, cPlain, mSeqC); } catch (e) {}
                        }
                        if (!_mvCode && pPlain === LOC.HAND) {
                            try { _mvCode = revealedCodeAt(mConC, pPlain, mSeqP); } catch (e) {}
                        }
                        var _mvName = name;
                        if (!_mvName && _mvCode) { try { _mvName = cardName(_mvCode); } catch (e) {} }
                        var _mvRow = logCardRow({
                            ctl: mConC, code: _mvCode, action: '',
                            name: _mvName || '卡片',
                            from: (!prevOv && pRawM !== undefined) ? pRawM : null,
                            to: (!curOv && cRawM !== undefined) ? cRawM : null
                        });
                        try {
                            if (_mvRow && !curOv && cPlain === LOC.SZONE) {
                                _mvRow.setAttribute('data-set-ctl', String(mConC));
                                _mvRow.setAttribute('data-set-loc', String(cPlain));
                                _mvRow.setAttribute('data-set-seq', String(mSeqC));
                                _mvRow.setAttribute('data-set-code', String(_mvCode || 0));
                                _mvRow.setAttribute('data-set-pos', String(cur.position || 0));
                                _mvRow.setAttribute('data-set-at', String(Date.now()));
                            }
                        } catch (e) {}
                        // PATCH(白神服) 2026-11-17: 卡组→手牌的**检索**日志常常先到（没有卡号），
                        //   紧接着才有「公开手牌：界放的肆世坏」那条 ConfirmCards。
                        //   这里把这一行记下来，等公开消息回来再补卡图/卡名（用户实测：日志显示卡背 ✗）
                        if (_mvRow && !_mvCode) {
                            try {
                                if (!window.__pendingMoveRows) window.__pendingMoveRows = [];
                                window.__pendingMoveRows.push({
                                    ctl: mConC, loc: cPlain, seq: mSeqC, row: _mvRow, at: Date.now()
                                });
                                if (window.__pendingMoveRows.length > 40) window.__pendingMoveRows.shift();
                            } catch (e) {}
                        }
                    }
                }
                break;
            }
            case 'FlipSummoning': {
                // PATCH(白神服) 2026-11-17: **翻转召唤没处理** → 被翻开的怪一直画成里侧守备
                //   （用户实测 R#9473：撒旦老人 翻召成攻击表示，画面上还是盖卡 ✗）
                //   payload: code(4) controller(1) location(1) sequence(1) position(1)
                var fsCode = hexU32(m.hex, 1) || (f.code || 0);
                var fsCtl = (f.controller !== undefined) ? f.controller : hexU8(m.hex, 5);
                var fsLoc = (f.location !== undefined) ? f.location : hexU8(m.hex, 6);
                var fsSeq = (f.sequence !== undefined) ? f.sequence : hexU8(m.hex, 7);
                var fsPos = (f.position !== undefined && f.position) ? f.position : (hexU8(m.hex, 8) || 1);
                duelSfx('flipMonster');
                try {
                    var fsCard = field[fsCtl] ? field[fsCtl][fsLoc + ':' + fsSeq] : null;
                    if (!fsCard || (fsCard.code && fsCard.code !== fsCode)) {
                        fsCard = null;
                        [0, 1].forEach(function (c) {
                            if (fsCard || !field[c]) return;
                            Object.keys(field[c]).forEach(function (k) {
                                if (!fsCard && field[c][k] && field[c][k].code === fsCode) fsCard = field[c][k];
                            });
                        });
                    }
                    if (fsCard) {
                        var _wasFd = !!fsCard.faceDown;
                        fsCard.pos = fsPos;
                        fsCard.position = fsPos;
                        fsCard.faceDown = isFaceDown(fsPos);
                        if (fsCard.faceDown) fsCard.code = fsCard.code || fsCode;
                        updateZone(fsCtl, fsLoc);
                        try {
                            if (!animSuppress) positionIconFx(cardRectAt(fsCtl, fsLoc, fsSeq), isDefense(fsPos));
                        } catch (e) {}
                        // 里侧 → 表侧：播翻面动画
                        if (_wasFd && !fsCard.faceDown) {
                            var _fr = rectAt(fsCtl, fsLoc, fsSeq);
                            flipNodeIn(cellElFor(fsCtl, fsLoc & 0x7f, fsSeq), (fsLoc & 0x7f) === LOC.MZONE && isDefense(fsPos));
                        }
                    }
                } catch (e) {}
                try {
                    logCardRow({
                        ctl: fsCtl, code: toCode(fsCode), action: '翻转召唤',
                        name: cardName(fsCode) || ('#' + fsCode), note: isDefense(fsPos) ? '守备' : '攻击'
                    });
                } catch (e) {}
                break;
            }
            case 'FlipSummoned': {
                break;
            }
            case 'Summoning': {
                var _nsCtl = ctlFromMsg(f, m, true);
                if (_nsCtl === 0 || _nsCtl === 1) bumpDuelCount('ns', _nsCtl);
                pendingSummon[ctlFromMsg(f, m) === 1 ? 1 : 0] = {
                    kind: 'ns', idx: idx, code: toCode(f.code),
                    ctl: ctlFromMsg(f, m) === 1 ? 1 : 0,
                    loc: (f.location !== undefined) ? ((f.location | 0) & 0x7f) : null,
                    seq: (f.sequence !== undefined) ? (f.sequence | 0) : null
                };
                var sc = f.code;
                logCardRow({ ctl: ctlFromMsg(f, m), code: toCode(sc), action: '召唤', name: cardName(sc) });
                // 通常召唤音只在 Summoning（NS）播；SpSummoning 用 specialSummon
                duelSfx('summon');
                // 召唤通常先有 Move 到手牌→场上，这里仅日志
                break;
            }
            case 'Summoned': {
                pendingSummon[ctlFromMsg(f, m) === 1 ? 1 : 0] = null;   // 召唤成功 → 落定
                break;
            }
            case 'SpSummoning': {
                var _spCtl = ctlFromMsg(f, m, true);
                if (_spCtl !== 0 && _spCtl !== 1) {
                    var _fc2 = (f && f.controller !== undefined && f.controller !== null) ? Number(f.controller) : NaN;
                    _spCtl = (_fc2 === 0 || _fc2 === 1) ? _fc2 : -1;
                }
                var spCtl = (_spCtl === 1) ? 1 : 0;
                duelSfx('specialSummon');
                if (_spCtl === 0 || _spCtl === 1) bumpDuelCount('sp', _spCtl);
                var spk = spKindOf(lastSpSummonReason, f.code);
                if (_spCtl === 0 || _spCtl === 1) bumpSpKind(_spCtl, lastSpSummonReason, f.code);
                pendingSummon[spCtl] = { kind: 'sp', spKind: spk, idx: idx, code: toCode(f.code), ctl: spCtl,
                    loc: (f.location !== undefined) ? ((f.location | 0) & 0x7f) : null,
                    seq: (f.sequence !== undefined) ? (f.sequence | 0) : null,
                    down: isFaceDown(f.position), position: f.position };
                logCardRow({ ctl: ctlFromMsg(f, m), code: toCode(f.code), action: '特殊召唤', name: cardName(f.code) });
                // 召唤演出：融合/同调/超量/连接（来自额外卡组）、灵摆
                if (!animSuppress && lastLand && lastLand.code === f.code && idx - lastLand.idx <= 6) {
                    var st = summonTypeOf(f.code);
                    var extraType = st === 'fusion' || st === 'synchro' || st === 'xyz' || st === 'link';
                    // ★ 灵摆：必须看**引擎的召唤类型**（用户要求：绑事件、不绑卡 ✗）
                    //   MSG_SPSUMMONING 的 summonType：7 = 灵摆召唤（SUMMON_TYPE_PENDULUM）✓
                    //   原来用 summonTypeOf(卡号)（按卡的类别）→ 普通召唤一只灵摆怪也会播灵摆动画 ✗
                    // PATCH(白神服) 2026-11-17: **灵摆召唤要靠"批次"判定** ——
                    //   协议里 SpSummoning/Summoning 都**不带 summonType**（库定义已确认），
                    //   所以以前按"这张卡是灵摆怪"来播灵摆动画是错的（用户实测 ✗：
                    //   普通召唤/特召一只灵摆怪也会播灵摆召唤特效）
                    //   真正的灵摆召唤 = 一次同时把 1~5 只灵摆怪从手牌/额外摆到怪兽区：
                    //   短时间内连续多条 SpSummoning，且都是灵摆怪 → 记在批次里，首次触发时播一次。
                    var _stRaw = (f.summonType !== undefined) ? f.summonType
                        : (f.summonTypeRaw !== undefined ? f.summonTypeRaw : undefined);
                    var isPendSummon = (_stRaw !== undefined) && (((_stRaw | 0) & 0xff) === 7);
                    if (_stRaw === undefined && st === 'pendulum') {
                        // 只有「刚刚判定过灵摆召唤」（BecomeTarget 两侧 P 区，5 秒内）才播灵摆特效；
                        //   其余情况（灵摆怪被普通召唤/效果特召，比如纠罪巧）按普通召唤处理
                        // 候选窗口内（1.5s）紧跟的 SpSummoning 才算灵摆召唤；用完即清，避免连累后续特召
                        isPendSummon = (pendSummonAt > 0 && (Date.now() - pendSummonAt) <= 1500);
                        if (isPendSummon) {
                            pendSummonAt = 0;
                            window.__pendTriggers = (window.__pendTriggers || 0) + 1;
                            try { log('✧ 灵摆召唤', 'rp-log-phase'); } catch (e) {}
                        }
                    }
                    if ((extraType && lastLand.fromExtra) || isPendSummon) {
                        var sRect = rectAt(lastLand.ctl, lastLand.rawLoc, lastLand.seq);
                        var sCell = cellElFor(lastLand.ctl, lastLand.rawLoc, lastLand.seq);
                        var sCard = field[lastLand.ctl] ? field[lastLand.ctl][(lastLand.rawLoc & 0x7f) + ':' + lastLand.seq] : null;
                        var sFlip = lastLand.ctl === 1 && !!sCard && !sCard.faceDown;
                        var sDef = !!sCard && isDefense(sCard.pos);
                        if (sRect) summonShowFx(f.code, sRect, sCell, sFlip, sDef, lastLand.ctl);
                    }
                }
                break;
            }
            case 'Chaining': {
                var _efCtl = ctlFromMsg(f, m, true);
                if (_efCtl === 0 || _efCtl === 1) bumpDuelCount('ef', _efCtl);
                try {
                    var _sfxMeta = cardMetaMap[String(toCode(f.code))] || {};
                    var _sfxCat = String(_sfxMeta.cat || '');
                    duelSfx((_sfxCat.indexOf('陷阱') >= 0 || _sfxCat.indexOf('速攻') >= 0) ? 'trapQuick' : 'effect');
                } catch (e) { duelSfx('effect'); }
                try {
                    // 优先用服务端 Chaining.chainCount —— 这是权威连锁号。
                    // 以前按本地 chainStack 长度 +1：一旦上一条链缺 ChainEnd/ChainSolved，
                    // 新链的第一张会被算成 C2（用户实测 R#9817 ✗）。
                    var _cn = (typeof f.chainCount === 'number' && f.chainCount > 0)
                        ? (f.chainCount | 0)
                        : ((typeof chainStack !== 'undefined' && chainStack && chainStack.length) ? chainStack.length + 1 : 1);
                    if (_cn === 1) {
                        try { chainStack.length = 0; chainRowByNum = {}; } catch (e) {}
                    }
                    var _crow = logCardRow({
                        ctl: ctlFromMsg(f, m), code: toCode(f.code), action: '发动', name: cardName(f.code),
                        badge: _cn ? ('C' + _cn) : 'C', chain: true
                    });
                    if (_crow && _cn) chainRowByNum[_cn] = _crow;
                } catch (e) {}
                try {
                    chainStack.push({ code: toCode(f.code), ctl: f.controller, loc: f.location, seq: f.sequence });
                    var ck = cellKeyOf(f.controller, f.location, f.sequence);
                    cellChain[ck] = _cn || 1;
                    refreshCell(f.controller, f.location, f.sequence);
                } catch (e) {}
                // 记录最近发动/连锁那张卡所在格（宣言卡名 Hint 要挂到它上面）
                try {
                    var _cll = (f.location !== undefined) ? f.location
                        : (f.chainCardLocation && f.chainCardLocation.location);
                    var _clc = (f.controller !== undefined) ? f.controller
                        : (f.chainCardLocation && f.chainCardLocation.controller);
                    var _cls = (f.sequence !== undefined) ? f.sequence
                        : ((f.chainCardLocation && f.chainCardLocation.sequence) || 0);
                    if (_cll !== undefined && (_clc === 0 || _clc === 1)) {
                        lastChainCell = _clc + ':' + ((_cll | 0) & 0x7f) + ':' + (_cls | 0);
                    }
                } catch (e) {}
                // PATCH(白神服) 2026-11-07: 记住最近发动的卡，检索日志里要写"是谁检索的"
                try { lastEffect = { name: cardName(f.code) || '', idx: idx, at: Date.now() }; } catch (e) {}
                // PATCH(白神服) 2026-11-05: 从**手牌**发动的卡（手坑/手发效果）引擎已经把它亮给对手了，
                //   客户端也要把那把手牌翻成正面，否则对手手卡全是卡背、看不出是哪张发的（用户实测 ✗）。
                try {
                    var _clRaw = (f.location !== undefined) ? f.location
                        : (f.chainCardLocation && f.chainCardLocation.location);
                    var _cc = (f.controller !== undefined) ? f.controller
                        : (f.chainCardLocation && f.chainCardLocation.controller);
                    var _sq = (f.sequence !== undefined) ? f.sequence
                        : ((f.chainCardLocation && f.chainCardLocation.sequence) || 0);
                    if (_clRaw !== undefined && _cc !== undefined && ((_clRaw | 0) & 0x7f) === LOC.HAND) {
                        try { showCardShowcase(f.code, '发动'); } catch (e) {}
                        var _hk = LOC.HAND + ':' + (_sq | 0);
                        var _hc = field[_cc] ? field[_cc][_hk] : null;
                        if (_hc && (!_hc.code || _hc.faceDown)) {
                            _hc.code = f.code || _hc.code;
                            _hc.faceDown = false;
                        } else if (!_hc) {
                            // seq 对不上：只按**卡号**在手里找那一张（绝不能把整手牌都翻开 ✗）
                            var _hit = null;
                            Object.keys(field[_cc] || {}).forEach(function (k) {
                                if (_hit || k.indexOf(LOC.HAND + ':') !== 0) return;
                                var c0 = field[_cc][k];
                                if (c0 && c0.code && c0.code === f.code) _hit = c0;
                            });
                            if (_hit) { _hit.faceDown = false; }
                        }
                        updateZone(_cc, LOC.HAND);
                    }
                } catch (e) {}

                // 发效果动画：把卡“放到镜头前”闪一下；若该卡是盖着的(陷阱/魔法)先原地翻面
                if (!animSuppress && f.code) {
                    var cl0 = f.location;
                    var cc0 = f.controller;
                    if ((cl0 === undefined || cc0 === undefined) && f.chainCardLocation) {
                        cl0 = f.chainCardLocation.location;
                        cc0 = f.chainCardLocation.controller;
                    }
                    var seq0 = f.sequence !== undefined ? f.sequence : 0;
                    if (cl0 !== undefined && cc0 !== undefined) {
                        var l2 = cl0 & 0xff;
                        var cObj = field[cc0] ? field[cc0][l2 + ':' + seq0] : null;
                        if (cObj && cObj.faceDown) {
                            // 盖卡发动：翻成正面 + 翻牌动画，随后镜头闪光
                            cObj.faceDown = false;
                            if (l2 === LOC.SZONE || l2 === LOC.MZONE) updateZone(cc0, l2);
                            flipNodeIn(cellElFor(cc0, l2, seq0), l2 === LOC.MZONE && isDefense(cObj.pos), l2 === LOC.SZONE);
                            setTimeout(function () { effectFlash(f.code, cRect, false); }, 170);
                        } else {
                            var fr2 = cardRectAt(cc0, cl0, seq0);
                            effectFlash(f.code, fr2, false);
                        }
                    } else {
                        effectFlash(f.code, null, false);
                    }
                }
                break;
            }
            case 'Attack': {
                var atk = f.attacker || {};
                // PATCH(白神服) 2026-11-17: 攻击卷回（replay）——
                //   目标消失/被效果移走后，引擎会让攻击者重新选目标，表现为
                //   「上一条 Attack → AttackDisabled → 新的 Attack」。这里用时间窗 + 未进入伤害步骤判断。
                try {
                    // PATCH(白神服) 2026-11-17: 只认「上一条攻击被 AttackDisabled 判定未成立」的情况，
                    //   原来只要 40 条内有过攻击就报卷回 → 正常连续攻击也误报（用户实测 ✗）
                    if (lastAttackInfo && lastAttackInfo.pendingReplay) {
                        log('↻ 攻击卷回：' + (lastAttackInfo.name || '怪兽') + ' 重新选择攻击目标', 'rp-log-battle');
                        lastAttackInfo.pendingReplay = false;
                    }
                } catch (e) {}
                var aCtl = atk.controller !== undefined ? atk.controller : 0;
                var aSeq = atk.sequence !== undefined ? atk.sequence : 0;
                var aLocRaw = atk.location !== undefined ? atk.location : LOC.MZONE;
                var aCard = field[aCtl] ? field[aCtl][(aLocRaw & 0xff) + ':' + aSeq] : null;
                var aCode = aCard ? aCard.code : 0;
                // PATCH(白神服) 2026-11-16: 攻击消息自带攻击者的**表示形式**（byte 4）。
                //   引擎有时不发 PosChange（例如被效果改成攻击表示），模型里还停在"里侧守备/守备"
                //   → 明明宣了攻击却画成盖卡（用户实测 R#9473 撒旦老人 ✗）。这里用权威数据修正。
                try {
                    var _aPos = (atk && typeof atk.position === 'number') ? atk.position : hexU8(m.hex, 4);
                    if (_aPos !== undefined && _aPos !== null && _aPos !== 0 && aCard) {
                        var _aFd = isFaceDown(_aPos);
                        if (aCard.pos !== _aPos || !!aCard.faceDown !== _aFd) {
                            aCard.pos = _aPos;
                            aCard.position = _aPos;
                            aCard.faceDown = _aFd;
                            updateZone(aCtl, aLocRaw);
                        }
                    }
                } catch (e) {}
                var tg = attackResolve(aCtl);
                // PATCH(白神服) 2026-11-17: 目标信息（MSG_ATTACK 里 attacker 1..4 / target 5..8）——
                //   参考 MDPro3：攻击的目标、以及目标是攻/守都由消息给出，不靠"猜对面场上的卡"
                var _tCtl2 = hexU8(m.hex, 5), _tLoc2 = hexU8(m.hex, 6), _tSeq2 = hexU8(m.hex, 7), _tPos2 = hexU8(m.hex, 8);
                var _hasTarget = (_tCtl2 === 0 || _tCtl2 === 1) && ((_tLoc2 & 0x7f) === LOC.MZONE);
                var _tCard = (_hasTarget && field[_tCtl2]) ? field[_tCtl2][(_tLoc2 & 0x7f) + ':' + _tSeq2] : null;
                var _tCode = _tCard ? _tCard.code : 0;
                // 目标的表示形式也用它同步（否则打守备怪时对方可能还画成攻击）
                try {
                    if (_tCard && _tPos2) {
                        var _tFd = isFaceDown(_tPos2);
                        if (_tCard.pos !== _tPos2 || !!_tCard.faceDown !== _tFd) {
                            _tCard.pos = _tPos2; _tCard.position = _tPos2; _tCard.faceDown = _tFd;
                            updateZone(_tCtl2, _tLoc2 & 0x7f);
                        }
                    }
                } catch (e) {}
                var line = '⚔ ' + playerName(aCtl) + ' 的 ' + (cardName(aCode) || '怪兽');
                if (_hasTarget) {
                    line += ' 攻击 ' + (cardName(_tCode) || '怪兽');
                    if (_tPos2) line += '（' + (isDefense(_tPos2) ? '守备' : '攻击') + '表示）';
                } else if (tg && tg.code) line += ' 攻击 ' + (cardName(tg.code) || '怪兽');
                else if (tg && tg.direct) line += ' 直接攻击';
                else line += ' 发起攻击';
                log(line, 'rp-log-battle');
                // 卡片式日志：攻击者 → 目标（记住这一行，后面战斗各阶段回填状态）
                try {
                    battleRow = logCardRow({
                        ctl: aCtl, code: toCode(aCode), action: _hasTarget ? '攻击' : '直接攻击',
                        name: cardName(aCode) || ('#' + aCode),
                        note: _hasTarget ? ('→ ' + (cardName(_tCode) || '怪兽')) : '→ 玩家'
                    });
                } catch (e) {}
                // 攻击动作：冲向中点再回位（ygopro 的 MSG_ATTACK 表现）
                try { attackLungeAnim(aCtl, aLocRaw, aSeq, _hasTarget ? _tCtl2 : -1, _tLoc2, _tSeq2); } catch (e) {}
                try {
                    lastAttackInfo = {
                        idx: idx, ctl: aCtl, seq: aSeq,
                        name: cardName(aCode) || ('#' + aCode),
                        targetCtl: _hasTarget ? _tCtl2 : null,
                        targetSeq: _hasTarget ? _tSeq2 : null,
                        targetName: _hasTarget ? (cardName(_tCode) || '怪兽') : null
                    };
                } catch (e) {}
                // 攻击动画：红圈+箭头标记 → 能量球飞出 → 爆炸（若目标会破坏则同时碎卡）
                if (!animSuppress) {
                    var aRect = cardRectAt(aCtl, aLocRaw, aSeq);
                    var tRect = null;
                    var tCell = null;
                    var isDirect = !!(tg && tg.direct);
                    // PATCH(白神服) 2026-11-05: 攻击动画打错目标 —— 原来是按"防守方卡号"猜目标，
                    //   对手里侧怪兽/同名卡/多只怪兽时猜不准（实测：能量球飞到空地或我方场上 ✗）。
                    //   MSG_ATTACK 原始字节里就带着攻击目标：attacker(1..4) + target(5..8)，
                    //   target 全 0 = 直接攻击。优先用这个，猜不出来才退回旧逻辑。
                    try {
                        var _h = env.hex || '';
                        var _tCtl = hexU8(_h, 5), _tLoc = hexU8(_h, 6), _tSeq = hexU8(_h, 7);
                        if ((_tCtl === 0 || _tCtl === 1) && (_tLoc & 0x7f) === LOC.MZONE) {
                            var _tr = rectAt(_tCtl, _tLoc & 0x7f, _tSeq);
                            if (_tr) { tRect = _tr; tCell = cellElFor(_tCtl, LOC.MZONE, _tSeq); isDirect = false; }
                        }
                    } catch (e) {}
                    if (!tRect && tg && tg.code) {
                        var df = field[1 - aCtl] || {};
                        var dk = Object.keys(df).filter(function (k) { return k.indexOf('4:') === 0; })
                            .find(function (k) { return df[k].code === tg.code; });
                        if (dk) {
                            var dSeq = parseInt(dk.split(':')[1], 10);
                            tRect = rectAt(1 - aCtl, LOC.MZONE, dSeq);
                            tCell = cellElFor(1 - aCtl, LOC.MZONE, dSeq);
                        }
                    } else if (isDirect) {
                        // 直击：能量球射向对方手卡区中心（与客户端一致）
                        var hEl = zoneEls[(1 - aCtl) + ':' + LOC.HAND];
                        tRect = hEl ? hEl.getBoundingClientRect() : null;
                        if (!tRect) {
                            var lpEl2 = lpEls[1 - aCtl];
                            if (lpEl2) tRect = lpEl2.getBoundingClientRect();
                        }
                    }
                    attackMarkFx(aRect, tRect, isDirect, (tg && tg.killedCode) || 0, 1 - aCtl, aCode);
                }
                break;
            }
            case 'Battle': {
                // PATCH(白神服) 2026-11-17: 战斗结算消息（MSG_BATTLE，27 字节）——
                //   attacker{ctl,loc,seq,pos} atk def state | defender{ctl,loc,seq,pos} atk def state
                //   参考 MDPro3：战斗结果用它，不靠 Damage 反推
                try {
                    var bc = hexU8(m.hex, 1), bl = hexU8(m.hex, 2), bsq = hexU8(m.hex, 3);
                    var bAtk = hexU32(m.hex, 5), bAtt = hexU8(m.hex, 13);
                    var dc = hexU8(m.hex, 14), dl = hexU8(m.hex, 15), dsq = hexU8(m.hex, 16);
                    var bDefAtk = hexU32(m.hex, 18), bDefSt = hexU8(m.hex, 26);
                    var bCard = (field[bc] && field[bc]) ? field[bc][bl + ':' + bsq] : null;
                    var bName = cardName(bCard && bCard.code) || '怪兽';
                    var isDirectBattle = !dl;
                    var line = '⚔ 战斗结算：' + bName + '（ATK ' + bAtk + '）';
                    if (isDirectBattle) {
                        line += ' 直接攻击玩家';
                    } else {
                        var dCard = field[dc] ? field[dc][dl + ':' + dsq] : null;
                        line += ' vs ' + (cardName(dCard && dCard.code) || '怪兽') + '（ATK ' + bDefAtk + '）';
                    }
                    // battleState：0 = 未破坏；非 0 = 该方被破坏（实测 1 = 破坏）
                    if (bAtt) line += ' · 攻击方被破坏';
                    if (bDefSt) line += ' · 守备方被破坏';
                    log(line, 'rp-log-battle');
                    setRowState(battleRow, '⚔ 结算', 'ok');      // 战斗四段收尾
                    battleRow = null;
                    logCardRow({
                        ctl: bc, code: toCode(bCard && bCard.code), action: '战斗',
                        name: bName,
                        note: 'ATK ' + bAtk + (isDirectBattle ? ' → 玩家' : (' vs ATK ' + bDefAtk))
                    });
                } catch (e) {}
                break;
            }
            case 'AttackDisabled': {
                // PATCH(白神服) 2026-11-17: 攻击被无效（参考 MDPro3 的 GameMessage_AttackDisabled）——
                //   原来什么都不做，画面上能量球已经飞出去了还在打
                //   常见场景：**攻击卷回**（目标消失，引擎让攻击者重新选）
                inBattle = false;
                try {
                    if (lastAttackInfo) {
                        log('✖ 攻击未成立（' + (lastAttackInfo.name || '怪兽') + '）→ 可能卷回重选目标', 'rp-log-battle');
                        setRowState(battleRow, '✖ 未成立', 'bad');
                        lastAttackInfo.pendingReplay = true;
                    } else {
                        log('✖ 攻击被无效', 'rp-log-battle');
                    }
                } catch (e) {}
                break;
            }
            case 'DamageStepStart':
                inBattle = true;
                try { if (lastAttackInfo) lastAttackInfo.pendingReplay = false; } catch (e) {}
                setRowState(battleRow, '◆ 伤害步骤', 'ok');   // 战斗四段：宣言 → 伤害步骤
                break;
            case 'DamageStepEnd': inBattle = false; break;
            case 'Chained': {
                // YGOPro：该连锁位正式加入连锁（Chaining 是发动宣言，Chained 是入链确认）
                try {
                    var _chdN = (typeof f.chainCount === 'number' && f.chainCount > 0)
                        ? (f.chainCount | 0) : (hexU8(m.hex, 1) || chainNumNow());
                    if (_chdN) setChainState(_chdN, '⛓ 连锁', 'ok');
                } catch (e) {}
                break;
            }
            case 'ChainSolving': log('… 连锁处理中 …', 'rp-log-chain'); break;
            case 'ChainSolved': {
                setChainState(chainNumNow(), '✔ 处理', 'ok');
                log('连锁处理完毕', 'rp-log-chain');
                try {
                    var sc = chainStack.pop();
                    if (sc) {
                        var sk = cellKeyOf(sc.ctl, sc.loc, sc.seq);
                        chainStack.forEach(function (it, i) { cellChain[cellKeyOf(it.ctl, it.loc, it.seq)] = i + 1; });
                        delete cellChain[sk];
                        refreshCell(sc.ctl, sc.loc, sc.seq);
                    }
                } catch (e) {}
                break;
            }
            case 'ChainEnd': {
                log('— 连锁结束 —', 'rp-log-chain');
                // 兜底：如果服务端没有逐条 ChainSolved，连锁结束也要清角标/连线
                try {
                    var _ceKeys = Object.keys(cellChain || {});
                    chainStack = [];
                    cellChain = {};
                    _ceKeys.forEach(function (k) {
                        var p = k.split(':').map(Number);
                        refreshCell(p[0], p[1], p[2]);
                    });
                    refreshChainLines();
                } catch (e) {}
                break;
            }
            case 'Damage': {
                var dpl = f.player;
                setLp(dpl, (lp[dpl] || 8000) - (f.value || 0));
                renderPlayerHead(dpl);
                hurtFlash(dpl);   // 受伤方瞬间闪红
                dmgFloat(dpl, f.value, '-');   // -3000 提示
                if (inBattle) {
                    log(playerName(dpl) + ' 受到 ' + f.value + ' 战斗伤害（LP ' + lp[dpl] + '）', 'rp-log-damage');
                } else {
                    log(playerName(dpl) + ' 受到 ' + f.value + ' 点效果伤害（LP ' + lp[dpl] + '）', 'rp-log-damage');
                }
                break;
            }
            case 'Recover': {
                var rpl = f.player;
                // PATCH(白神服): 去掉 8000 上限 —— 8000 只是**起始**血量不是上限，成金哥布林/黄金城这类卡就是要把 LP 涨过 8000；原来 Math.min 导致有飘字但数字不变(用户实测)
            setLp(rpl, (lp[rpl] || 8000) + (f.value || 0));
                renderPlayerHead(rpl);
                dmgFloat(rpl, f.value, '+');   // +N 提示
                log(playerName(rpl) + ' 恢复 ' + f.value + ' LP');
                break;
            }
            case 'PayLpCost': {
                // 支付基本分（后端白名单不含金额 → 从原始 hex 解码：player(1B) + cost(4B LE)）
                var plp = m.f && m.f.player !== undefined ? m.f.player : hexU8(m.hex, 1);
                var cost = (m.f && typeof m.f.value === 'number') ? m.f.value : hexU32(m.hex, 2);
                if (cost > 0) {
                    setLp(plp, (lp[plp] || 8000) - cost);
                    renderPlayerHead(plp);
                    dmgFloat(plp, cost, '-', '#ffb347');       // 橙色 = 支付
                    lastPayLp = { player: plp, idx: idx };
                    logCardRow({ ctl: plp, action: '支付 LP', note: '-' + cost + ' → ' + lp[plp] });
                }
                break;
            }
            case 'LpUpdate': {
                // 绝对 LP（权威）：直接校准，避免累计误差
                var lup = f.player;
                if (typeof f.lp === 'number' && (lup === 0 || lup === 1)) {
                    var prevLp = lp[lup];
                    setLp(lup, f.lp);
                    renderPlayerHead(lup);
                    var dlp = f.lp - prevLp;
                    if (dlp !== 0 && !(lastPayLp && lastPayLp.player === lup && idx - lastPayLp.idx <= 3)) {
                        dmgFloat(lup, Math.abs(dlp), dlp > 0 ? '+' : '-');
                    }
                }
                break;
            }
            case 'Win': {
                var wpl = f.player;
                log(playerName(wpl) + ' 获胜！', 'rp-log-win');
                try {
                    cardTargets = [];
                    equipLinks = [];
                    refreshCardTargetMarks();
                    refreshCardTargetLines();
                    refreshEquipMarks();
                } catch (e) {}
                showWinBanner(playerName(wpl));
                break;
            }
            case 'AnnounceRace':
                try { log('宣言种族：' + (maskNames(f.availableRaces, RACE_NAMES) || '？'), 'rp-log-hint'); } catch (e) {}
                break;
            case 'AnnounceAttrib':
                try { log('宣言属性：' + (maskNames(f.availableAttributes, ATTR_NAMES) || '？'), 'rp-log-hint'); } catch (e) {}
                break;
            case 'AnnounceNumber':
                try {
                    log('宣言数字：' + ((f.numbers || []).join('、') || '？'), 'rp-log-hint');
                } catch (e) {}
                break;
            case 'AnnounceCard':
                try {
                    var _acNames = (f.opcodes || []).filter(function (c) { return !!c; })
                        .map(function (c) { return cardName(c) || ('#' + c); });
                    log('宣言卡：' + (_acNames.join('、') || '？'), 'rp-log-hint');
                } catch (e) {}
                break;
            case 'CardHint': {
                try {
                    var _chPos = equipLocOf(f);
                    var _chName = '';
                    if (_chPos) {
                        var _chCard = field[_chPos.ctl] && field[_chPos.ctl][_chPos.loc + ':' + _chPos.seq];
                        if (_chCard && _chCard.code) _chName = cardName(_chCard.code) || '';
                        leafFlash(cellKeyOf(_chPos.ctl, _chPos.loc, _chPos.seq), '#d4af37', 320);
                    }
                    var _chAct = CARD_HINT_NAMES[Number(f.type)];
                    if (_chName) log('提示：' + _chName + (_chAct ? ('（' + _chAct + '）') : ''), 'rp-log-hint');
                    else if (_chAct) log('提示：' + _chAct, 'rp-log-hint');
                } catch (e) {}
                break;
            }
            case 'PlayerHint': {
                try {
                    var _phType = Number(f.type) | 0;
                    var _phVal = Number(f.value) >>> 0;
                    var _phCode = _phVal >>> 4;
                    var _phOff = _phVal & 0xf;
                    if ((_phType === 6 || _phType === 7) && _phCode) {
                        // 6=PHINT_DESC_ADD, 7=REMOVE；value = 卡号<<4 | 说明序号
                        if (_phType === 6) {
                            var _phName = cardName(_phCode);
                            if (_phName) log('说明：' + _phName + (_phOff ? (' #' + _phOff) : ''), 'rp-log-hint');
                        }
                    } else if (f.hint) {
                        log('提示：' + String(f.hint), 'rp-log-hint');
                    }
                } catch (e) {}
                break;
            }
            case 'RockPaperScissors': {
                try {
                    var _rpsP = (f.player === 0 || f.player === 1) ? f.player : 0;
                    log('猜拳：等待 ' + playerName(_rpsP) + ' 选择', 'rp-log-hint');
                } catch (e) {}
                break;
            }
            case 'Hint': {
                // PATCH(白神服) 2026-11-05: 提示里有时是裸卡号（「对手已选 = 834483504」），
                //   能查到卡名就换成卡名，玩家才看得懂是什么卡。
                var _hintTxt = f.hint ? String(f.hint) : '';
                if (_hintTxt) {
                    _hintTxt = _hintTxt.replace(/\b(\d{5,9})\b/g, function (m) {
                        var _nm = '';
                        try { _nm = cardName(Number(m)) || ''; } catch (e) {}
                        return _nm ? (_nm + '（' + m + '）') : m;
                    });
                }
                if (_hintTxt) log('提示：' + _hintTxt, 'rp-log-hint');
                // PATCH(白神服) 2026-11-07: Hint type=8 = 宣言的卡号（禁止令这类）
                //   hex: [id=02][type][player][code i32 LE @3] —— 服务端日志里也是这么来的
                try {
                    if ((f && f.type) === 8 && m && m.hex && m.hex.length >= 14) {
                        var _hc = hexU32(m.hex, 3);
                        var _hn = _hc ? (cardName(_hc) || ('#' + _hc)) : '';
                        if (_hn && lastChainCell) {
                            announcedByCell[lastChainCell] = [_hn];
                            try {
                                var _op = String(lastChainCell).split(':');
                                var _oc = field[Number(_op[0])] && field[Number(_op[0])][Number(_op[1]) + ':' + Number(_op[2])];
                                announcedOwner[lastChainCell] = _oc ? { uid: _oc.uid, code: _oc.code } : null;
                            } catch (e) {}
                            var _cell2 = zoneEls[lastChainCell];
                            if (_cell2) { _cell2._code = null; _cell2._statSig = ''; }
                            var _pp = lastChainCell.split(':');
                            updateZone(Number(_pp[0]), Number(_pp[1]));
                            log('宣言：' + _hn, 'rp-log-hint');
                        }
                    }
                } catch (e) {}
                break;
            }
            case 'ShuffleHand': {
                // 手牌洗牌：cards 为新顺序，整体重建手牌
                if (f.player !== undefined && f.cards && f.cards.length && typeof f.cards[0] === 'number') {
                    syncHand(f.player, f.cards);
                    updateZone(f.player, LOC.HAND);
                }
                try {
                    if (!animSuppress) {
                        var _shCont = zoneEls[f.player + ':' + LOC.HAND];
                        if (_shCont) {
                            _shCont.classList.remove('rp-hand-shuffle');
                            void _shCont.offsetWidth;
                            _shCont.classList.add('rp-hand-shuffle');
                            setTimeout(function () { _shCont.classList.remove('rp-hand-shuffle'); }, 520);
                        }
                    }
                } catch (e) {}
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
                // PATCH(白神服) 2026-11-18: 这些选择/宣言类消息以前 fallthrough 到
                // ConfirmCards，被当成“公开手牌”，开局 SelectIdleCmd 会误报
                // 「公开 淘气仙星…共2张」（用户实测 ✗）。它们不应产生公开日志。
                break;
            case 'ConfirmCards': {
                // PATCH(白神服) 2026-11-07: 被效果翻开/确认过的卡 → 记成明牌（半透明显示）
                //   例：魔法除去 19159413 翻开对方盖卡后，那张卡应显示为「明牌」而不是纯卡背。
                try {
                    var _arr = (f && (f.cards || f.info)) || [];
                    // PATCH(白神服) 2026-11-07: 库经常把 ConfirmCards 解成空对象（f={}），
                    //   这里直接从 hex 解：id(0) player(1) skip(2) count(3)，之后每张 7 字节：
                    //   code(4, LE) controller(1) location(1) sequence(1)
                    if ((!_arr || !_arr.length) && m && m.hex && m.hex.length >= 4) {
                        try {
                            // PATCH(白神服) 2026-11-17: hex 有两种布局（带 / 不带消息类型字节），
                            //   原来只按"带"解析 → 实时链路里常见不带，导致 ConfirmCards 解不出卡号，
                            //   日志只能显示卡背（用户实测：界放的肆世坏显示卡背 ✗）
                            function _parseCC(base) {
                                var cnt = hexU8(m.hex, base + 2);
                                if (!cnt || cnt > 64) return [];
                                var out2 = [];
                                for (var ci = 0; ci < cnt; ci++) {
                                    var off = base + 3 + ci * 7;
                                    if ((off + 7) * 2 > m.hex.length) break;
                                    var loc2 = hexU8(m.hex, off + 5) & 0x7f;
                                    if (!(loc2 === 1 || loc2 === 2 || loc2 === 4 || loc2 === 8 || loc2 === 16 || loc2 === 32 || loc2 === 64)) return [];
                                    out2.push({
                                        code: hexU32(m.hex, off),
                                        controller: hexU8(m.hex, off + 4),
                                        location: hexU8(m.hex, off + 5),
                                        sequence: hexU8(m.hex, off + 6)
                                    });
                                }
                                return out2;
                            }
                            var _parsed = _parseCC(1);      // 带类型字节：id(0) player(1) skip(2) count(3) …
                            if (!_parsed.length) _parsed = _parseCC(0);   // 不带：player(0) skip(1) count(2) …
                            if (_parsed.length) _arr = _parsed;
                        } catch (e) {}
                    }
                    var _touched = {};
                    _arr.forEach(function (c) {
                        if (!c) return;
                        var cd = toCode((typeof c === 'number') ? c : c.code);
                        if (!cd) return;
                        var ctl = (typeof c === 'object') ? c.controller : undefined;
                        var loc0 = (typeof c === 'object') ? c.location : undefined;
                        var sq = (typeof c === 'object') ? c.sequence : undefined;
                        if (ctl === undefined || loc0 === undefined || sq === undefined) return;
                        var pl0 = (loc0 | 0) & 0x7f;
                        // 手牌：不管这一刻手牌槽里有没有卡，都先记下"这个槽位将被公开"
                        try {
                            // ⚠ 只有「这一格还没有卡号」或「卡号就是这个」时才登记公开，
                            //   否则会把另一侧的真实手卡卡图替换成这次公开的卡（用户实测 ✗）
                            if (pl0 === LOC.HAND) {
                                var _exist0 = field[ctl] ? field[ctl][pl0 + ':' + sq] : null;
                                if (!_exist0 || !_exist0.code || _exist0.code === cd) {
                                    pendingHandReveal[ctl + ':' + sq] = { code: cd, at: Date.now() };
                                }
                            }
                        } catch (e) {}
                        try { rememberRevealed(ctl, cd); } catch (e) {}
                        // 回填前面那条没有卡号的移动日志（卡组→手牌检索/公开）
                        try {
                            var _pend = window.__pendingMoveRows || [];
                            for (var _pi = _pend.length - 1; _pi >= 0; _pi--) {
                                var _p = _pend[_pi];
                                if (!_p || _p.ctl !== ctl || _p.seq !== sq) continue;
                                if ((_p.loc | 0) !== (pl0 | 0)) continue;
                                if (Date.now() - _p.at > 15000) continue;
                                var _r = _p.row;
                                if (_r && _r.parentNode) {
                                    var _img = _r.querySelector('img.rp-lthumb');
                                    if (_img) {
                                        _img.setAttribute('data-code', String(cd));
                                        _img.setAttribute('src', (typeof PIC_THUMB === 'function' ? PIC_THUMB(cd, 60)
                                            : ('/thumbcard/' + cd + '.jpg?w=60&v=20261118d')));
                                    }
                                    var _nm = _r.querySelector('.rp-lname');
                                    if (_nm) _nm.textContent = cardName(cd) || ('#' + cd);
                                }
                                _pend.splice(_pi, 1);
                            }
                        } catch (e) {}
                        try {
                            recentRevealed[cd] = Date.now();                 // 兼容旧逻辑
                            recentRevealed[cd + ':' + (ctl|0)] = Date.now();  // 按「卡号+控制者」记，避免同名牌串到对面手牌
                        } catch (e) {}
                        var card0 = field[ctl] ? field[ctl][pl0 + ':' + sq] : null;
                        // 不再跨侧回退：检索/公开的 controller 才是权威。
                        // 以前这里在"本侧同序号没牌"时去另一侧找 code=0 的手牌并补卡号，
                        // 结果把对方一张隐藏手牌标成了我方检索的卡（用户实测：检索卡公开到对面手上 ✗）。
                        // 找不到就交给 pendingHandReveal / Move 后按卡号补，绝不能改对方手牌。
                        if (card0) {
                            if (pl0 === LOC.HAND && card0.code && card0.code !== cd) {
                                // 这一格已经有别的卡 → 说明"公开"指的不是它，跳过（避免串图）
                                return;
                            }
                            if (pl0 === LOC.HAND) {
                                try { _revealNames.push(ctl + ':' + (cardName(cd) || ('#' + cd))); _revealCodes.push(cd); } catch (e) {}
                                try { pendingHandReveal[ctl + ':' + sq] = { code: cd, at: Date.now() }; } catch (e) {}
                                // 观战/对手视角：手牌里的卡本来是 code=0，这里补上真实卡号并正面显示
                                card0.code = cd;
                                card0.faceDown = false;
                                card0.revealed = true;
                                card0.revealedHand = true;
                                card0.revealedAt = Date.now();
                                // PATCH(白神服) 2026-11-17: 参考 ygopro 客户端 —— 公开卡牌只在**原本位置**亮出来
                                //   （手牌/场地），不再弹「【公开】」大图浮层（用户要求去掉这个动画）
                                // 标记"这格原本是隐藏卡、被这次公开补上了卡号" —— 之后真卡从别处
                                // 进手牌时据此删掉这个占位副本，避免同张卡出现两次（用户实测 ✗）
                                try { if (!card0._hadCodeBefore) card0._revealClone = true; } catch (e) {}
                                _revealHandCount[ctl] = handSizeOf(ctl);
                            } else {
                                card0.knownCode = cd;
                                card0._hideKnown = false;   // 已知卡 → 卡背打底 + 低透明度卡面
                                // 效果“翻开里侧卡给对方看”：只记录 knownCode，不做翻面动画。
                                // 原来这里临时 faceDown=false + 1.3s 盖回，任何 updateZone/快照
                                // 卡在展示阶段就会把盖卡留成透明节点 —— 盖放后看起来直接消失。
                            }
                        }
                        _touched[ctl + ':' + pl0] = true;
                    });
                    try {
                        // 卡组/额外被翻开 → 弹一排卡图（ygopro 客户端 ShowLocationCard 的做法）
                        var _deckReveal = (_arr || []).filter(function (c) {
                            if (!c || typeof c !== 'object') return false;
                            var l = (c.location | 0) & 0x7f;
                            return (l === LOC.DECK) && c.code;   // 只弹卡组公开，额外不弹
                        });
                        // ygopro 客户端在回放里对 ConfirmCards **不弹面板**，只出日志 + 原地翻亮
                        if (false) showRevealList(_deckReveal);
                    } catch (e) {}
                    try {
                        if (_revealNames.length) {
                            // 不再标「我方/对方」——ConfirmCards 里的 controller 偶尔不可靠，
                            //   标错会误导（用户实测：对方检索却写"我方"）。只报公开了什么卡。
                            var _txt = _revealNames.map(function (x) {
                                var pp2 = x.split(':');
                                return pp2.slice(1).join(':');
                            }).join('、');
                            // PATCH(白神服) 2026-11-17: 公开也要有卡图（参考 MDPro3 的公开一条带走）
                            //   原来只写一行纯文字提示，看不到是哪张卡
                            var _c0 = (_revealCodes && _revealCodes.length) ? _revealCodes[0] : 0;
                            var _ctl0 = 0;
                            try { _ctl0 = parseInt(String(_revealNames[0] || '0').split(':')[0], 10); } catch (e) {}
                            if (_c0) {
                                logCardRow({
                                    ctl: (_ctl0 === 1) ? 1 : 0, code: _c0, action: '公开', name: _txt,
                                    note: (_revealNames.length > 1) ? ('共 ' + _revealNames.length + ' 张') : ''
                                });
                            } else {
                                log('公开手牌：' + _txt, 'rp-log-hint');
                            }
                        }
                        _revealNames = [];
                        _revealCodes = [];
                    } catch (e) {}
                    Object.keys(_touched).forEach(function (k) {
                        var pp = k.split(':');
                        var _c0 = Number(pp[0]), _l0 = Number(pp[1]);
                        if (_l0 === LOC.HAND) {
                            var _cont = zoneEls[_c0 + ':' + LOC.HAND];
                            if (_cont) _cont._sig = '';          // 强制重画，让公开的卡显示正面
                            revealingHand = true;
                            try { updateZone(_c0, LOC.HAND); } finally { revealingHand = false; }
                        } else {
                            updateZone(_c0, _l0);
                        }
                    });
                } catch (e) {}
                break;
            }
            case 'Toss':
            case 'RockPaperScissors':
                // 选择类消息：回放时无需操作，直接跳过（可能有可视提示可选做）
                break;
            // ── 指示物 ──
            case 'AddCounter':
            case 'RemoveCounter': {
                var isRem = (m.name === 'RemoveCounter');
                // PATCH(白神服) 2026-11-17: MSG_ADD/REMOVE_COUNTER 的真实布局是
                //   countertype(2) controller(1) location(1) sequence(1) count(2)   ← 没有 code 字段
                //   原来按 code(4)+… 解 → 控制者/位置/数量全部错位（实战里指示物不加/加错格）
                var cHx = (m && m.hex) || '';
                var cBase = 1;                      // 带消息类型字节
                if (cHx.length >= 18 && !(hexU8(cHx, 3) <= 1)) cBase = 0;   // 不带：ctl 在 2
                var cCtl  = (f && f.controller !== undefined) ? f.controller : hexU8(cHx, cBase + 2);
                var cLoc  = (f && f.location !== undefined) ? f.location : hexU8(cHx, cBase + 3);
                var cSeq  = (f && f.sequence !== undefined) ? f.sequence : hexU8(cHx, cBase + 4);
                var cType = (f && (f.counterType !== undefined ? f.counterType : f.counter_type));
                if (cType === undefined || cType === null) cType = hexU8(cHx, cBase) | (hexU8(cHx, cBase + 1) << 8);
                var cCnt  = (f && f.count !== undefined) ? f.count
                    : (hexU8(cHx, cBase + 5) | (hexU8(cHx, cBase + 6) << 8));
                var cCode = (f && f.code) || 0;
                if (!cCnt || cCnt < 0) cCnt = 1;
                if (cCtl === 0 || cCtl === 1) {
                    addCounterTo(cCtl, cLoc, cSeq, toCode(cCode), cType, cCnt, isRem);
                    log((isRem ? '移除指示物 ' : '放置指示物 ') + cardName(cCode) + ' ×' + cCnt, 'rp-log-hint');
                }
                break;
            }

            // ── 召唤完成/翻转 ──
            case 'SpSummoned': {
                var _spDoneCtl = ctlFromMsg(f, m) === 1 ? 1 : 0;
                var _spDoneP = pendingSummon[_spDoneCtl];
                pendingSummon[_spDoneCtl] = null;   // 特召成功 → 落定
                lastSpSummonReason = 0;
                log('特殊召唤完成：' + cardName(f.code));
                // 里侧守备特召：展示/翻面后必须盖回卡背；观战里常因对象被快照替换/替身隐藏而空白
                try {
                    if (_spDoneP && _spDoneP.down) {
                        var _spCtlD = _spDoneP.ctl, _spLocD = _spDoneP.loc, _spSeqD = _spDoneP.seq, _spCodeD = _spDoneP.code;
                        setTimeout(function () {
                            ensureFaceDownCard(_spCtlD, _spLocD, _spSeqD, _spCodeD);
                        }, 1400);
                    }
                } catch (e) {}
                break;
            }
            case 'FlipSummoning':
                log('翻转召唤：' + cardName(f.code));
                break;
            case 'FlipSummoned': {
                // 翻转召唤完成 → 那一格变回正面
                try {
                    var fsCtl = (f.controller !== undefined) ? f.controller : 0;
                    var fsLoc = f.location, fsSeq = f.sequence;
                    var fk = cellKeyOf(fsCtl, fsLoc, fsSeq);
                    var fc = (field[fsCtl] || {})[fsLoc + ':' + fsSeq];
                    if (fc) { fc.faceDown = false; fc.pos = ((fc.pos | 0) & ~0x8) | 0x1; }
                    refreshCell(fsCtl, fsLoc, fsSeq);
                } catch (e) {}
                log('翻转召唤成功：' + cardName(f.code));
                break;
            }

            // ── 连锁被无效 / 错过时点 / 成为对象 ──
            case 'ChainDisabled':
            case 'ChainNegated':
                leafFlash(lastChainCell, '#ff4a4a');
                // 回填到对应连锁行（MDPro3：无效属于那条连锁，不另起一行）
                setChainState(chainNumNow(), '✖ 无效', 'bad');
                if (!chainRowByNum[chainNumNow()]) log('⊗ 连锁被无效', 'rp-log-chain');
                // 若刚发生的是「召唤/特殊召唤」，被无效 → 输出「召唤无效」+ 撤掉场上的卡 + 统计回滚
                try { cancelPendingSummon(0); cancelPendingSummon(1); } catch (e) {}
                undoPendingSummon(0);
                undoPendingSummon(1);
                break;
            case 'MissedEffect':
                log('⚠ 错过时点（效果无法发动）', 'rp-log-hint');
                break;
            case 'BecomeTarget': {
                // 照 MDPro3 DuelLog：BecomeTarget / RandomSelected 单独写一行「对象：卡名」，
                // 不能只写"发动"，否则看不出效果指向哪张卡（用户要求）。
                var _btList = [];
                try {
                    var _btCount = hexU8(m.hex, 1) || 0;
                    for (var _bi = 0; _bi < Math.min(_btCount, 8); _bi++) {
                        var _bo = 2 + _bi * 4;
                        _btList.push({
                            controller: hexU8(m.hex, _bo),
                            location: hexU8(m.hex, _bo + 1),
                            sequence: hexU8(m.hex, _bo + 2),
                            position: hexU8(m.hex, _bo + 3)
                        });
                    }
                } catch (e) {}
                if (!_btList.length && f && f.targets && f.targets.length) {
                    f.targets.forEach(function (v) {
                        var n = Number(v) >>> 0;
                        _btList.push({ controller: n & 0xff, location: (n >>> 8) & 0xff, sequence: (n >>> 16) & 0xff, position: (n >>> 24) & 0xff });
                    });
                }
                if (!_btList.length && f && f.location !== undefined) {
                    _btList.push({ controller: f.controller, location: f.location, sequence: f.sequence, position: f.position });
                }
                var _btNames = [];
                _btList.forEach(function (bt) {
                    var btCtl = (bt.controller === 0 || bt.controller === 1) ? bt.controller : 0;
                    var btCell = cellKeyOf(btCtl, bt.location, bt.sequence);
                    leafFlash(btCell, '#8ef0ff', 260);
                    var btCard = field[btCtl] ? field[btCtl][((bt.location | 0) & 0x7f) + ':' + bt.sequence] : null;
                    var btCode = (btCard && (btCard.code || btCard.knownCode)) ? (btCard.code || btCard.knownCode) : ((btCtl === f.controller && bt.sequence === f.sequence) ? f.code : 0);
                    var btName = btCode ? (cardName(btCode) || ('#' + btCode)) : '盖牌';
                    if (_btNames.indexOf(btName) < 0) _btNames.push(btName);
                });
                if (_btNames.length) log('对象：' + _btNames.join('、'), 'rp-log-hint');
                // PATCH(白神服) 2026-11-17: **灵摆召唤的真正信号**（照 MDPro3 的 GameMessage_BecomeTarget）——
                //   同时收到两条 BecomeTarget，分别指向同一玩家左右灵摆区（SZONE seq 0 / seq 4）→ P 召开始。
                //   MDPro3 就是据此播 PlaySummonPendulum() 的。
                try {
                    _btList.forEach(function (bt) {
                        var _bctl = bt.controller, _bloc = (bt.location | 0) & 0x7f, _bseq = bt.sequence;
                        if ((_bctl !== 0 && _bctl !== 1) || _bloc !== LOC.SZONE) return;
                        if (_bseq !== 0 && _bseq !== 4) return;
                        var _nowB = Date.now();
                        if (!pendZones[_bctl]) pendZones[_bctl] = {};
                        pendZones[_bctl][_bseq] = _nowB;
                        var _zl = pendZones[_bctl][0], _zr = pendZones[_bctl][4];
                        if (_zl && _zr && Math.abs(_zl - _zr) <= 1500) {
                            // 只是「候选」：两侧 P 区同时成为对象也可能是普通效果指向两张摆子，
                            //   真正的 P 召必须紧接着出现 SpSummoning（下面 SpSummoning 分支里校验）
                            pendSummonAt = _nowB;
                        }
                    });
                } catch (e) {}
                break;
            }

            case 'CardTarget': {
                try {
                    var _ct1 = f.card1, _ct2 = f.card2;
                    if ((!_ct1 || !_ct2) && m && m.hex && m.hex.length >= 10) {
                        _ct1 = {
                            controller: hexU8(m.hex, 1), location: hexU8(m.hex, 2),
                            sequence: hexU8(m.hex, 3), position: hexU8(m.hex, 4)
                        };
                        _ct2 = {
                            controller: hexU8(m.hex, 5), location: hexU8(m.hex, 6),
                            sequence: hexU8(m.hex, 7), position: hexU8(m.hex, 8)
                        };
                    }
                    var _cts = equipLocOf(_ct1), _ctt = equipLocOf(_ct2);
                    if (_cts && _ctt) {
                        var _ctSame = function (a, b) { return a && b && a.ctl === b.ctl && a.loc === b.loc && a.seq === b.seq; };
                        cardTargets = cardTargets.filter(function (x) {
                            return !(_ctSame(x.source, _cts) && _ctSame(x.target, _ctt));
                        });
                        cardTargets.push({ source: _cts, target: _ctt });
                        refreshCardTargetMarks();
                        refreshCardTargetLines();
                        var _ctc = field[_ctt.ctl] && field[_ctt.ctl][_ctt.loc + ':' + _ctt.seq];
                        var _ctsrc = field[_cts.ctl] && field[_cts.ctl][_cts.loc + ':' + _cts.seq];
                        var _ctTn = (_ctc && _ctc.code) ? cardName(_ctc.code) : '卡';
                        var _ctSn = (_ctsrc && _ctsrc.code) ? cardName(_ctsrc.code) : '';
                        log('对象：' + (_ctSn ? (_ctSn + ' → ') : '') + _ctTn, 'rp-log-hint');
                    }
                } catch (e) {}
                break;
            }
            case 'CancelTarget':
                cardTargets = [];
                refreshCardTargetMarks();
                refreshCardTargetLines();
                break;

            case 'RandomSelected': {
                try {
                    var _rsCodes = Array.isArray(f.cards) ? f.cards.slice() : [];
                    if (!_rsCodes.length && m && m.hex && m.hex.length >= 6) {
                        var _rsN = hexU8(m.hex, 1) || 0;
                        for (var _rsi = 0; _rsi < Math.min(_rsN, 8); _rsi++) {
                            _rsCodes.push((hexU8(m.hex, 2 + _rsi * 4)
                                | (hexU8(m.hex, 3 + _rsi * 4) << 8)
                                | (hexU8(m.hex, 4 + _rsi * 4) << 16)
                                | (hexU8(m.hex, 5 + _rsi * 4) << 24)) >>> 0);
                        }
                    }
                    var _rsNames = _rsCodes.filter(function (c) { return !!c; })
                        .map(function (c) { return cardName(c) || ('#' + c); });
                    log('随机选择：' + (_rsNames.length ? _rsNames.join('、') : '卡'), 'rp-log-hint');
                } catch (e) {}
                break;
            }

            // ── 掷币 / 掷骰 ──
            case 'TossCoin':
            case 'TossDice': {
                // payload: player(1) count(1) results[count](1 each)
                var tpPl = (f && typeof f.player === 'number') ? f.player : hexU8(m.hex, 1);
                var tpCnt = (f && typeof f.count === 'number') ? f.count : hexU8(m.hex, 2);
                if (!tpCnt || tpCnt < 1 || tpCnt > 8) tpCnt = 1;
                var results = [];
                if (f && Array.isArray(f.results) && f.results.length) {
                    results = f.results.slice(0, 8).map(function (v) { return Number(v) || 0; });
                } else if (f && f.result !== undefined) {
                    results = [Number(f.result) || 0];
                } else {
                    for (var ti = 0; ti < tpCnt; ti++) results.push(hexU8(m.hex, 3 + ti));
                }
                if (!results.length) results = [0];
                tpCnt = results.length;
                var who = (tpPl === 0 || tpPl === 1) ? playerName(tpPl) + ' ' : '';
                var isCoin = (m.name === 'TossCoin');
                var shown = results.map(function (v) {
                    if (!isCoin) return String(v);
                    return v ? '正' : '反';
                }).join('、');
                tossFx(isCoin, results, who);
                tossToast(who + (isCoin ? '硬币：' : '骰子：') + shown);
                log(who + '掷' + (isCoin ? '硬币' : '骰子') + '：' + shown, 'rp-log-hint');
                break;
            }

            // ── 洗牌 / 排序 / 翻卡组 ──
            case 'ShuffleDeck':
            case 'ShuffleExtra':
            case 'ShuffleSetCard':
            case 'SortCard':
            case 'ReverseDeck': {
                var pilMap = {
                    'ShuffleDeck': '卡组', 'ShuffleExtra': '额外卡组', 'ShuffleSetCard': '盖放的卡',
                    'SortCard': '卡组排序', 'ReverseDeck': '卡组翻转'
                };
                var pil = pilMap[m.name] || '卡组';
                if (typeof f.player === 'number') {
                    if (m.name === 'ShuffleDeck' || m.name === 'SortCard' || m.name === 'ReverseDeck') {
                        deckTopCode[f.player] = null;
                    }
                    if (m.name === 'ReverseDeck') {
                        deckReversed[f.player] = !deckReversed[f.player];
                        try { updatePiles(); } catch (e) {}
                    }
                    if (m.name === 'ShuffleSetCard') shuffleSetPulse();
                    if (m.name !== 'ShuffleSetCard' && !m.__shuffleFxDone) {
                        try { shufflePileFx(f.player, (m.name === 'ShuffleExtra') ? 'extra' : 'deck'); } catch (e) {}
                    }
                    var pileCell = fieldEl.querySelector('[data-pile="deck:' + f.player + '"]');
                    if (pileCell) {
                        pileCell.style.transition = 'box-shadow .2s ease';
                        pileCell.style.boxShadow = '0 0 12px rgba(142,240,255,.8)';
                        setTimeout(function () { pileCell.style.boxShadow = ''; }, 420);
                    }
                }
                log(pil + '洗牌', 'rp-log-hint');
                break;
            }

            // ── 卡组顶 / 确认卡组 ──
            case 'DeckTop': {
                try {
                    var _dtp = (f.player !== undefined) ? f.player : 0;
                    var _dtc = Array.isArray(f.codes) ? f.codes[0] : f.code;
                    deckTopCode[_dtp] = _dtc ? (Number(_dtc) & 0x7fffffff) : null;
                    updatePiles();
                } catch (e) {}
                var dtName = f.codes ? ('[' + f.codes.map(function (c) { return cardName(c); }).join('、') + ']') : '';
                log('卡组顶 ' + dtName, 'rp-log-hint');
                break;
            }
            case 'ConfirmDeckTop': {
                log('确认卡组顶 ' + (f.count || '') + ' 张', 'rp-log-hint');
                // PATCH(白神服) 2026-11-17: 「从卡组上面把 N 张翻开」（转生炎兽 狐狸这类效果）
                //   也要弹出卡组公开列表 —— 原来只写一行日志，看不到翻开的卡
                try {
                    var _dtCards = [];
                    var _dtCodes = f.codes || [];
                    var _dtList = f.cards || [];
                    if (_dtList && _dtList.length && typeof _dtList[0] === 'object') {
                        _dtList.forEach(function (c) {
                            if (c && c.code) _dtCards.push({ code: c.code, sequence: c.sequence, location: (c.location | 0) || LOC.DECK });
                        });
                    } else if (_dtCodes.length) {
                        _dtCodes.forEach(function (cd, i) { if (cd) _dtCards.push({ code: cd, sequence: i, location: LOC.DECK }); });
                    }
                    if (!_dtCards.length && m && m.hex && m.hex.length >= 8) {
                        var _cntD = hexU8(m.hex, 2);
                        for (var _di = 0; _di < _cntD && _di < 40; _di++) {
                            var _offD = 3 + _di * 7;
                            if ((_offD + 7) * 2 > m.hex.length) break;
                            var _cdD = hexU32(m.hex, _offD);
                            if (_cdD) _dtCards.push({ code: _cdD, sequence: hexU8(m.hex, _offD + 6), location: LOC.DECK });
                        }
                    }
                    if (_dtCards.length) showRevealList(_dtCards, (f.player === 1) ? 1 : 0);
                } catch (e) {}
                break;
            }

            // ── 场地无效 / 交换 / 手卡数修正 ──
            case 'FieldDisabled':
                try {
                    var _df = f.disabledField;
                    if (_df === undefined && m && m.hex) {
                        _df = (hexU8(m.hex, 1) | (hexU8(m.hex, 2) << 8)
                            | (hexU8(m.hex, 3) << 16) | (hexU8(m.hex, 4) << 24)) >>> 0;
                    }
                    disabledFieldMask = Number(_df) >>> 0;
                    refreshDisabledZones();
                } catch (e) {}
                log('场地效果被无效', 'rp-log-hint');
                break;
            case 'SwapGraveDeck': {
                try {
                    var _sgp = f.player;
                    if (_sgp === 0 || _sgp === 1) {
                        // PATCH(白神服) 2026-11-19: 交换后卡组张数 = 原墓地张数；原卡组张数变成墓地张数。
                        //   原卡组未知时保持未知（原来 (x||0) 会把未知记成 0）。
                        var _sgOldDeck = (deckCount[_sgp] === null || deckCount[_sgp] === undefined) ? null : deckCount[_sgp];
                        var _sgGrave = locCards(_sgp, LOC.GRAVE).length;
                        setPileAbs(_sgp, 'deck', _sgGrave, 'deckcount');
                        graveCountOverride[_sgp] = _sgOldDeck;
                        deckTopCode[_sgp] = null;
                        Object.keys(field[_sgp] || {}).forEach(function (k) {
                            if (k.indexOf(LOC.GRAVE + ':') === 0) delete field[_sgp][k];
                        });
                        updateAllZones(); updatePiles();
                    }
                } catch (e) {}
                log('卡组与墓地交换', 'rp-log-hint');
                break;
            }
            case 'TagSwap': {
                try {
                    var _tsp = f.player;
                    if (_tsp === 0 || _tsp === 1) {
                        if (Array.isArray(f.handCards)) syncHand(_tsp, f.handCards);
                        if (Array.isArray(f.extraCards) && f.extraCards.length) {
                            window.__ypExtra = window.__ypExtra || { 0: [], 1: [] };
                            window.__ypExtra[_tsp] = f.extraCards.slice().map(function (c) {
                                return (typeof c === 'number') ? c : ((c && c.code) || 0);
                            });
                            setPileAbs(_tsp, 'extra', window.__ypExtra[_tsp].filter(function (c) { return !!c; }).length, 'deckcount');
                        }
                        if (f.topCode) deckTopCode[_tsp] = Number(f.topCode) & 0x7fffffff;
                        updateAllZones(); updatePiles();
                    }
                } catch (e) {}
                log('双打换位', 'rp-log-hint');
                break;
            }
            case 'Swap':
                log('控制权交换', 'rp-log-hint');
                break;
            case 'HandRes': {
                // MSG_HAND_RES 是开局猜拳结果，不是“手卡数量修正”。
                // payload: u8 result；低 2 bit = P0 手势，高 2 bit = P1 手势（1..3 → 0..2）
                try {
                    var _hr = (f.result !== undefined) ? f.result : hexU8(m.hex, 1);
                    _hr = Number(_hr) & 0xff;
                    var _hrName = ['石头', '剪刀', '布'];
                    var _h1 = ((_hr & 0x3) - 1), _h2 = (((_hr >> 2) & 0x3) - 1);
                    var _h1t = _hrName[_h1] || '?', _h2t = _hrName[_h2] || '?';
                    var _winner = '';
                    if (_h1 >= 0 && _h2 >= 0 && _h1 !== _h2) {
                        _winner = ((_h1 - _h2 + 3) % 3 === 2) ? playerName(0) : playerName(1);
                    }
                    log('猜拳：' + playerName(0) + ' ' + _h1t + ' / ' + playerName(1) + ' ' + _h2t
                        + (_winner ? (' → ' + _winner + ' 先攻') : '（平局）'), 'rp-log-hint');
                } catch (e) { log('猜拳结果', 'rp-log-hint'); }
                break;
            }

            // ── 装备 / 重载 ──
            case 'Equip':
            case 'Unequip': {
                // MSG_EQUIP 只带 equip/target 的 controller/location/sequence，没有卡号；
                // 旧代码用 f.code → 日志永远是“装备：undefined”。
                var _eqName = function (o) {
                    try {
                        if (!o) return '';
                        var _c = (o.controller !== undefined) ? o.controller : 0;
                        var _l = (o.location !== undefined) ? ((o.location | 0) & 0x7f) : 0;
                        var _s = (o.sequence !== undefined) ? o.sequence : 0;
                        var _card = field[_c] && field[_c][_l + ':' + _s];
                        return _card && _card.code ? cardName(_card.code) : '';
                    } catch (e) { return ''; }
                };
                var _eqA = _eqName(f.equip) || (f.code ? cardName(f.code) : '');
                var _eqB = _eqName(f.target) || '';
                try {
                    var _eqL = equipLocOf(f.equip), _tgL = equipLocOf(f.target);
                    if (_eqL && _tgL) {
                        var _same = function (a, b) { return a && b && a.ctl === b.ctl && a.loc === b.loc && a.seq === b.seq; };
                        equipLinks = equipLinks.filter(function (x) { return !_same(x.equip, _eqL); });
                        if (m.name === 'Equip') equipLinks.push({ equip: _eqL, target: _tgL });
                    }
                    refreshEquipMarks();
                } catch (e) {}
                log((m.name === 'Equip' ? '装备：' : '解除装备：')
                    + (_eqA || '卡') + (_eqB ? (' → ' + _eqB) : ''), 'rp-log-hint');
                break;
            }
            case 'ReloadField': {
                log('重载场地数据', 'rp-log-hint');
                // YGOPro MSG_RELOAD_FIELD：重连/回放跳转时的全量场地快照。
                // 它没有卡号，只有每格 occupied/position/xyzCount；用于校正占位和表示形式。
                try {
                    if (Array.isArray(f.players) && f.players.length >= 2) {
                        for (var _rp = 0; _rp < 2; _rp++) {
                            var _rpi = f.players[_rp] || {};
                            // ReloadField 的 players[] 按**绝对座位**排列；v2 场地/张数按本地视角存。
                            // 不映射时 P2 重连会把双方卡组/额外数量反着显示。
                            var _pv = seatOf(_rp);
                            if (typeof _rpi.lp === 'number') lp[_pv] = _rpi.lp;
                            if (Array.isArray(_rpi.mzone)) {
                                for (var _rm = 0; _rm < Math.min(7, _rpi.mzone.length); _rm++) {
                                    var _rmc = _rpi.mzone[_rm] || {};
                                    var _rmk = LOC.MZONE + ':' + _rm;
                                    if (!_rmc.occupied) {
                                        if (field[_pv]) delete field[_pv][_rmk];
                                        continue;
                                    }
                                    if (!field[_pv]) field[_pv] = {};
                                    var _rmv = field[_pv][_rmk];
                                    var _rmpos = _rmc.position || 0x8;
                                    if (!_rmv) addCardAt(_pv, LOC.MZONE, _rm, 0, isFaceDown(_rmpos), _rmpos);
                                    else {
                                        _rmv.pos = _rmpos; _rmv.position = _rmpos;
                                        _rmv.faceDown = isFaceDown(_rmpos);
                                    }
                                    if (_rmc.xyzCount > 0) field[_pv][_rmk].mats = _rmc.xyzCount;
                                }
                            }
                            if (Array.isArray(_rpi.szone)) {
                                for (var _rs = 0; _rs < Math.min(8, _rpi.szone.length); _rs++) {
                                    var _rsc = _rpi.szone[_rs] || {};
                                    var _rsk = LOC.SZONE + ':' + _rs;
                                    if (!_rsc.occupied) {
                                        if (field[_pv]) delete field[_pv][_rsk];
                                        continue;
                                    }
                                    if (!field[_pv]) field[_pv] = {};
                                    var _rsv = field[_pv][_rsk];
                                    var _rspos = _rsc.position || 0x8;
                                    if (!_rsv) addCardAt(_pv, LOC.SZONE, _rs, 0, isFaceDown(_rspos), _rspos);
                                    else {
                                        _rsv.pos = _rspos; _rsv.position = _rspos;
                                        _rsv.faceDown = isFaceDown(_rspos);
                                    }
                                }
                            }
                            // PATCH(白神服) 2026-11-19: ReloadField 是重连时的**权威全量快照**
                            //   （srvpro refresh-field-service 会先发一条 deckCount=0 的占位 Start，
                            //   再发这条）→ 张数在这里无条件落地，且优先级最高。
                            if (typeof _rpi.deckCount === 'number') {
                                setPileAbs(_pv, 'deck', _rpi.deckCount, 'reload');
                                if (startDeck[_pv] === null || startDeck[_pv] === undefined) startDeck[_pv] = _rpi.deckCount;
                            }
                            if (typeof _rpi.extraCount === 'number') {
                                setPileAbs(_pv, 'extra', _rpi.extraCount, 'reload');
                                if (startExtra[_pv] === null || startExtra[_pv] === undefined) startExtra[_pv] = _rpi.extraCount;
                            }
                            // ReloadField 只给手牌数量：先按数量铺成卡背，后续 UpdateData(HAND) 会替换成具体卡
                            if (typeof _rpi.handCount === 'number') {
                                Object.keys(field[_pv] || {}).forEach(function (k) {
                                    if (k.indexOf(LOC.HAND + ':') === 0) delete field[_pv][k];
                                });
                                for (var _rh = 0; _rh < _rpi.handCount; _rh++) {
                                    addCardAt(_pv, LOC.HAND, _rh, 0, true, 0);
                                }
                                updateZone(_pv, LOC.HAND);
                            }
                            // 墓地/除外同理：先按数量铺占位，卡号等 UpdateData
                            ['graveCount', 'removedCount'].forEach(function (cntKey) {
                                if (typeof _rpi[cntKey] !== 'number') return;
                                var _loc = cntKey === 'graveCount' ? LOC.GRAVE : LOC.REMOVED;
                                Object.keys(field[_pv] || {}).forEach(function (k) {
                                    if (k.indexOf(_loc + ':') === 0) delete field[_pv][k];
                                });
                                for (var _rc = 0; _rc < _rpi[cntKey]; _rc++) {
                                    addCardAt(_pv, _loc, _rc, 0, true, 0);
                                }
                            });
                        }
                        // 重连时恢复连锁号（YGOPro ReloadField.chains）
                        if (Array.isArray(f.chains)) {
                            chainStack = [];
                            cellChain = {};
                            f.chains.forEach(function (ch, i) {
                                var _chCtl = (ch.chainCardController !== undefined) ? ch.chainCardController : ch.controller;
                                var _chLoc = (ch.chainCardLocation !== undefined) ? ch.chainCardLocation : ch.location;
                                var _chSeq = (ch.chainCardSequence !== undefined) ? ch.chainCardSequence : ch.sequence;
                                if (_chCtl === 0 || _chCtl === 1) {
                                    var _chCtlV = seatOf(_chCtl);
                                    chainStack.push({ code: toCode(ch.code), ctl: _chCtlV, loc: _chLoc, seq: _chSeq });
                                    cellChain[cellKeyOf(_chCtlV, _chLoc, _chSeq)] = i + 1;
                                }
                            });
                        }
                        updateAllZones(); updatePiles(); refreshEmz();
                        try { markCountSource('reload'); } catch (e) {}
                    } else {
                        updatePiles();
                    }
                } catch (e) {}
                break;
            }
            case 'ReleaseRelation':
                // 解放/关系解除：清掉对象线，避免残留指向已解放的卡
                cardTargets = [];
                refreshCardTargetMarks();
                refreshCardTargetLines();
                break;
            case 'Retry':
            case 'MatchKill':
                log((m.name === 'Retry' ? '重试对局' : '比赛中止'), 'rp-log-hint');
                try {
                    if (m.name === 'Retry') showStatusBanner('↻ 重试对局', '');
                    else showStatusBanner('⚠ 比赛中止', '房间已结束');
                } catch (e) {}
                break;

            case 'Waiting': {
                // YGOPro：等待对手加载/换备；观战里至少给出明确状态，不要看起来卡死
                try {
                    phaseText = '等待对手…';
                    if (phaseEl) phaseEl.textContent = phaseText;
                    log('等待对手…', 'rp-log-hint');
                } catch (e) {}
                break;
            }

            default:
                // 未知消息不阻塞
                break;
        }
    }

    // 场地操作辅助：field[c][loc:seq] = {code, faceDown, pos(原表示位)}
    var _uid = 1;

    function addCardAt(controller, loc, seq, code, down, posRaw) {
        if (!field[controller]) field[controller] = {};
        // PATCH(白神服) 2026-11-07: 墓地/除外 是**堆叠区**，同一序号不应覆盖已有卡 ——
        //   否则「从卡组堆墓」时如果服务端给的序号与已有卡相同，会覆盖 →
        //   墓地张数不增加、顶牌变成另一张或空白（用户实测 ✗）
        try {
            if ((loc === LOC.GRAVE || loc === LOC.REMOVED) && field[controller][loc + ':' + seq]) {
                var _max = -1;
                Object.keys(field[controller]).forEach(function (k) {
                    if (k.indexOf(loc + ':') !== 0) return;
                    var n = Number(k.split(':')[1]);
                    if (n > _max) _max = n;
                });
                seq = _max + 1;
            }
        } catch (e) {}
        var _key0 = loc + ':' + seq;
        var _old0 = field[controller][_key0];
        // PATCH(白神服) 2026-11-19: 这一格换成了**另一张卡**（或原本空着）→ 该格的
        //   实时攻守缓存作废，避免新怪沿用前一局/前一只的数值（用户实测：第二把同格
        //   怪兽攻击力变成上一把的数值 ✗）。同卡号覆盖（快照刷新）时保留，避免抖动。
        try {
            var _newCode = toCode(code);
            if (!_old0 || (!_newCode ? false : (_old0.code && _old0.code !== _newCode))) {
                delete cardStatByKey[controller + ':' + (loc & 0x7f) + ':' + seq];
            }
        } catch (e) {}
        field[controller][_key0] = {
            code: toCode(code),
            // 同一格同一张卡（同 code，或旧卡还没 code）沿用 uid ——
            // 否则每次快照都会换 uid，手牌/场上节点会重建、ConfirmCards 按 seq 也难对上。
            uid: (_old0 && (!code || !_old0.code || _old0.code === toCode(code))) ? _old0.uid : _uid++,
            faceDown: !!down,
            pos: posRaw,
            seq: seq,
        };
    }

    /**
     * PATCH(白神服) 2026-11-06: 从某个区域删一张卡的兜底版本。
     *   回收类效果（现世与冥界的逆转等）一次移动多张，服务端给的 sequence 会因为我们
     *   之前的增删与模型键不同步 → 直接 removeAt(seq) 删不到任何东西，
     *   表现就是「墓地里的卡被回收了却还在」（用户实测 ✗）。
     *   顺序：序号命中且卡号对得上 → 按卡号找 → 序号命中即可 → 最后一张。
     */
    function removeZoneCard(ctl, loc, seq, code) {
        if (!field[ctl]) return null;
        var key = loc + ':' + (seq !== undefined ? seq : 0);
        var cur = field[ctl][key];
        if (cur && (!code || cur.code === code)) { delete field[ctl][key]; return cur; }
        if (code) {
            var keys = Object.keys(field[ctl]).filter(function (k) { return k.indexOf(loc + ':') === 0; });
            for (var i = 0; i < keys.length; i++) {
                if (field[ctl][keys[i]] && field[ctl][keys[i]].code === code) {
                    var hit = field[ctl][keys[i]];
                    delete field[ctl][keys[i]];
                    return hit;
                }
            }
        }
        if (cur) { delete field[ctl][key]; return cur; }
        var ks2 = Object.keys(field[ctl]).filter(function (k) { return k.indexOf(loc + ':') === 0; });
        if (ks2.length) {
            var last = ks2[ks2.length - 1];
            var c2 = field[ctl][last];
            delete field[ctl][last];
            return c2;
        }
        return null;
    }

    function removeAt(controller, loc, seq) {
        if (field[controller]) delete field[controller][loc + ':' + seq];
        // 同格攻守缓存一并清掉：这张卡已经离开，缓存留着会被下一张卡误用
        try { delete cardStatByKey[controller + ':' + (loc & 0x7f) + ':' + seq]; } catch (e) {}
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
        if (handLock) return;
        if (!field[ctl]) return false;
        var keys = handKeys(ctl);
        if (!keys.length) return false;
        var found = -1;
        if (!code) {
            // PATCH(白神服) 观战：隐藏手牌没有卡号（code=0），原来直接 return false →
            //   手牌「只加不减」，越打越多（用户实测：显示 11 张，实际 5 张）。
            //   所有背面都一样，删最后一张即可。
            found = keys.length - 1;
        } else {
            for (var i = 0; i < keys.length; i++) {
                if (field[ctl][keys[i]].code === code) { found = i; break; }
            }
        }
        // PATCH(白神服) 2026-11-05: 按卡号找不到也要删一张 ——
        //   隐藏手牌（观战/对手）卡号都是 0，Move 出来时给的是真实卡号 → 永远匹配不上，
        //   于是手牌只增不减；空手牌时显示一堆卡背（用户实测 ✗）。删最后一张即可（背面都一样）。
        if (found < 0) found = keys.length - 1;
        delete field[ctl][keys[found]];
        var rest = keys.filter(function (k, j) { return j !== found; })
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
        if (handLock) return;
        if (!field[ctl]) field[ctl] = {};
        // PATCH(白神服) 2026-11-05: 洗牌同步同样只允许「首次铺底 / 变小」，
        //   隐藏手牌的快照/洗牌列表会重复给出整副手牌 → 张数翻倍（实测 0 手牌显示 10 张卡背 ✗）
        try {
            window.__handSeeded = window.__handSeeded || { 0: false, 1: false };
            var _cur = 0;
            Object.keys(field[ctl]).forEach(function (k) { if (k.indexOf(LOC.HAND + ':') === 0) _cur++; });
            var _n = (codes && codes.length) || 0;
            if (window.__handSeeded[ctl] && _n > _cur) return;   // 变大 → 忽略
            if (_n > 0) window.__handSeeded[ctl] = true;
        } catch (e) {}
        var next = {};
        Object.keys(field[ctl]).forEach(function (k) {
            if (k.indexOf(LOC.HAND + ':') !== 0) next[k] = field[ctl][k];
        });
        codes.forEach(function (c, i) {
            next[LOC.HAND + ':' + i] = { code: c, uid: _uid++, faceDown: !c, pos: 0 };   // PATCH: 卡号 0 = 服务端屏蔽（观战视角手牌）→ 画背面
        });
        field[ctl] = next;
    }

    /**
     * PATCH: 把某区域内 seq >= fromSeq 的卡整体挪 delta 位（-1 补位 / +1 让位）。
     * 服务端在移出/插入时会自己补位，客户端必须照做，否则 seq 会错开 ——
     * 表现就是"点右边那张，召唤出来的却是左边那张"。delta>0 时从大到小处理，避免互相覆盖。
     */
    function shiftSeqKeys(ctl, loc, fromSeq, delta) {
        if (!field[ctl] || !delta) return;
        var pfx = loc + ':';
        var keys = Object.keys(field[ctl]).filter(function (k) {
            if (k.indexOf(pfx) !== 0) return false;
            var s = parseInt(k.slice(pfx.length), 10);
            return !isNaN(s) && s >= fromSeq;
        });
        keys.sort(function (a, b) {
            var sa = parseInt(a.slice(pfx.length), 10), sb = parseInt(b.slice(pfx.length), 10);
            return delta > 0 ? sb - sa : sa - sb;
        });
        keys.forEach(function (k) {
            var s = parseInt(k.slice(pfx.length), 10);
            var card = field[ctl][k];
            delete field[ctl][k];
            card.seq = s + delta;
            field[ctl][loc + ':' + (s + delta)] = card;
        });
    }

    function moveCard(prev, cur, code) {
        // PATCH: 卡一旦离开某格，就把该格与"该卡号"的实时攻守缓存清掉。
        // 否则：同一张卡的新个体再次出场、占回同一格时，会沿用旧个体被装备/指示物加成过的攻守
        // （玩家实测："我明明是 1600，之前出场装备过，重新召唤就变成装备过的攻击力了"）。
        // 原实现的作废条件只比"卡号是否相同"（statFor 里），同卡号新个体正好躲过检查。
        try {
            if (prev && prev.controller !== undefined && prev.location !== undefined) {
                delete cardStatByKey[prev.controller + ':' + (prev.location & 0x7f) + ':' + (prev.sequence || 0)];
            }
            delete cardStatByCode[code];
        } catch (e) {}

        var pCon = prev.controller !== undefined ? prev.controller : 0;
        var pRaw = prev.location;
        var pLoc = pRaw !== undefined ? (pRaw & 0x7f) : undefined;
        var prevOverlay = pRaw !== undefined && (pRaw & 0x80) !== 0;   // 来源是叠放素材（不在模型里）
        var cCon = cur.controller !== undefined ? cur.controller : pCon;
        var cLoc = cur.location !== undefined ? (cur.location & 0x7f) : undefined;
        var cOverlay = cur.location !== undefined && (cur.location & 0x80) !== 0;
        var down = isFaceDown(cur.position);
        var posRaw = cur.position;
        var oldCard = null;

        if (prevOverlay) {
            // 叠放素材移出：不操作场地模型（计数由调用方处理）
        } else if (pLoc === LOC.HAND) {
            // PATCH: 服务端的 seq 才是真相 —— 优先按 seq 精确删（手牌有同名卡时按卡号删会删错），
            // 删完把后面的牌往前补位；两处都不做，手牌 seq 就会与服务端错开一位。
            var pSeq = prev.sequence !== undefined ? prev.sequence : 0;
            var atSeq = field[pCon] ? field[pCon][LOC.HAND + ':' + pSeq] : null;
            // PATCH(白神服) 2026-11-06: removeFromHandByCode 内部**已经把键重排成 0..n-1**了，
            //   这里再 shiftSeqKeys(pSeq, -1) 会再往前挪一格 → 每删一张手牌实际少两张
            //   （实测：回放模拟手牌 3 张，界面只显示 1 张）。
            var _compacted = false;
            if (atSeq && (code === undefined || !code || atSeq.code === code)) {
                removeAt(pCon, LOC.HAND, pSeq);
            } else {
                var removed = removeFromHandByCode(pCon, code);
                if (!removed) removeAt(pCon, LOC.HAND, pSeq);
                else _compacted = true;      // 已经紧凑过，不要再挪
            }
            if (!_compacted) shiftSeqKeys(pCon, LOC.HAND, pSeq, -1);
        } else if (pLoc !== undefined) {
            // PATCH(白神服) 2026-11-06: 用兜底删除（回收/一次移动多张时 sequence 容易和模型错开）
            oldCard = removeZoneCard(pCon, pLoc, prev.sequence, code);
        }

        if (cOverlay) {
            return;   // 素材本身不显示在场上（计数由调用方处理）
        }
        if (cLoc === LOC.HAND) {
            // PATCH: 服务端给了 seq 就插到那个位置（后面的牌往后挪一位），没给才追加末尾
            var cSeq = cur.sequence !== undefined ? cur.sequence : -1;
            // ★ 这个槽位已经被 ConfirmCards 公开过（检索上手 / 亮牌）→ 直接复用，别再插一张
            var _reuse = (cSeq >= 0 && field[cCon]) ? field[cCon][LOC.HAND + ':' + cSeq] : null;
            if (_reuse && code && _reuse.code === code && (_reuse.revealedHand || _reuse._revealClone)) {
                // 删掉别处同卡号的"公开占位副本"，只留这一格
                try {
                    Object.keys(field[cCon] || {}).forEach(function (k) {
                        if (k === LOC.HAND + ':' + cSeq) return;
                        if (k.indexOf(LOC.HAND + ':') !== 0) return;
                        var cc0 = field[cCon][k];
                        if (!cc0 || cc0.code !== code) return;
                        if (cc0.revealedHand || cc0._revealClone) delete field[cCon][k];
                    });
                } catch (e) {}
                _reuse.faceDown = false;
                _reuse.revealed = true;
                _reuse.revealedHand = true;
                _reuse.revealedAt = Date.now();
                delete _reuse._revealClone;
                _revealHandCount[cCon] = handSizeOf(cCon);
                updateZone(cCon, LOC.HAND);
            } else if (cSeq >= 0) {
                // pendingHandReveal 是按 seq 记的 → 插卡后它后面的槽位整体 +1，登记也要跟着挪
                try {
                    var _shiftPend = {};
                    Object.keys(pendingHandReveal).forEach(function (k) {
                        var pp = k.split(':');
                        if (Number(pp[0]) !== cCon) { _shiftPend[k] = pendingHandReveal[k]; return; }
                        var sq0 = Number(pp[1]);
                        _shiftPend[cCon + ':' + (sq0 >= cSeq ? sq0 + 1 : sq0)] = pendingHandReveal[k];
                    });
                    pendingHandReveal = _shiftPend;
                } catch (e) {}
                shiftSeqKeys(cCon, LOC.HAND, cSeq, 1);
                // PATCH(白神服) 2026-11-05: 移入手牌时若卡号未知（对手手牌/观战视角），
                //   原来固定 faceDown=false → 画成"空白卡"（没有卡图，用户实测 ✗）
                //   现在没卡号就当里侧（背面），有卡号才正面。
                addCardAt(cCon, LOC.HAND, cSeq, code !== undefined ? code : 0, !code, 0);
                // 刚插进来的这张如果正是"被公开/检索"的那张 → 就地亮牌
                try {
                    var _pr0 = pendingHandReveal[cCon + ':' + cSeq];
                    var _ncx = field[cCon] ? field[cCon][LOC.HAND + ':' + cSeq] : null;
                    if (_pr0 && _ncx && (_pr0.code === code || !code) && (Date.now() - _pr0.at) < 8000) {
                        _ncx.code = code || _pr0.code;
                        _ncx.faceDown = false;
                        _ncx.revealed = true;
                        _ncx.revealedHand = true;
                        _ncx.revealedAt = Date.now();
                        _revealHandCount[cCon] = handSizeOf(cCon);
                        delete pendingHandReveal[cCon + ':' + cSeq];
                    }
                    // 清理同卡号的"公开占位副本"
                    if (code) {
                        Object.keys(field[cCon] || {}).forEach(function (k) {
                            if (k === LOC.HAND + ':' + cSeq) return;
                            if (k.indexOf(LOC.HAND + ':') !== 0) return;
                            var cc1 = field[cCon][k];
                            if (cc1 && cc1._revealClone && cc1.code === code) delete field[cCon][k];
                        });
                    }
                } catch (e) {}
            } else {
                addToHand(cCon, code !== undefined ? code : 0);
            }
        } else if (cLoc !== undefined) {
            // PATCH(白神服) 2026-11-07: 观战视角下对手的移动消息会把 position 抹成 0、
            //   code 也是 0 —— 原来这里直接 return，格子上什么都不画（用户实测：盖卡位置空白 ✗）。
            //   未知卡一律按**里侧**画出来（至少是卡背）。
            if (!code && !down) down = true;
            addCardAt(cCon, cLoc, cur.sequence !== undefined ? cur.sequence : 0, code, down, posRaw);
            var newCard = field[cCon][cLoc + ':' + (cur.sequence !== undefined ? cur.sequence : 0)];
            // 宿主离开场上时素材不跟着进墓地/除外；墓地里的卡不应该继续挂素材叠图
            var _leftField = (pLoc === LOC.MZONE || pLoc === LOC.SZONE)
                && (cLoc !== LOC.MZONE && cLoc !== LOC.SZONE);
            if (newCard && oldCard && oldCard.mats && !_leftField) newCard.mats = oldCard.mats;
            if (newCard && oldCard && oldCard.overlayCodes && !_leftField) newCard.overlayCodes = oldCard.overlayCodes.slice();
        }
    }

    // 给刚上手、且刚被公开过的卡打上 revealed 标记（下一次手牌重建时生效）
    function markPendingReveal(controller) {
        var applied = false;
        try {
            var cands = [];
            Object.keys(_pendingRevealHand).forEach(function (k) {
                var parts = k.split(':');
                if (Number(parts[1]) === controller) cands.push({ code: Number(parts[0]), key: k });
            });
            if (!cands.length) return 0;
            Object.keys(field[controller] || {}).forEach(function (k) {
                if (k.indexOf(LOC.HAND + ':') !== 0) return;
                var c = field[controller][k];
                if (!c) return;
                for (var i = 0; i < cands.length; i++) {
                    if (cands[i].code === toCode(c.code) && !c.revealed) {
                        c.revealed = true;
                        delete _pendingRevealHand[cands[i].key];
                        applied = true;
                        break;
                    }
                }
            });
        } catch (e) {}
        return applied;
    }
    function addToHand(controller, code) {
        if (handLock) return;
        // PATCH(白神服) 2026-11-07: 观战/对手视角，检索上手且**卡号已知**的卡 → 标记为公开
        //   （服务端对"检索"类 Move 会把卡号补回来；普通抽卡仍是 0 → 不会被误公开）
        // 只有"刚被 ConfirmCards 公开过"的卡才亮牌（否则回放里所有手牌都会被当公开，整只手牌全亮 ✗）
        var _revealThis = false;
        try {
            var _rc = toCode(code);
            var _rt2 = _rc ? (recentRevealed[_rc + ':' + (controller|0)] || recentRevealed[_rc]) : 0;
            var _pend = _rc ? _pendingRevealHand[_rc + ':' + (controller|0)] : 0;
            _revealThis = (controller !== 0 && _rc > 0 && ((_rt2 && (Date.now() - _rt2) < 5000) || _pend));
        } catch (e) {}

        var seq = 0;
        while (field[controller] && field[controller][LOC.HAND + ':' + seq]) seq++;
        // PATCH(白神服) 2026-11-06: 原来 code=0（隐藏手牌）直接 return → 对手每次抽卡都不加，
        //   手牌张数只减不增；而「0 张时显示一堆卡背」的根因也是这种不一致（用户实测）。
        //   现在：没有卡号就加一张背面，抽几张加几张。
        if (code) addCardAt(controller, LOC.HAND, seq, code, false, 0);
        else addCardAt(controller, LOC.HAND, seq, 0, true, 0);
        try {
            if (_revealThis) {
                var _hk = LOC.HAND + ':' + seq;
                var _hc = field[controller] ? field[controller][_hk] : null;
                if (_hc) {
                    _hc.revealed = true;
                    _hc.revealedHand = true;
                    _hc.revealedAt = Date.now();
                    _revealHandCount[controller] = handSizeOf(controller);
                }
            }
        } catch (e) {}
    }

    function isFaceDown(pos) {
        if (pos === undefined) return false;
        return (pos & 0x8) !== 0 || (pos & 0x2) !== 0; // FACEDOWN_DEFENSE=8 FACEDOWN_ATTACK=2
    }

    // 守备表示：表侧守备 0x4 / 里侧守备 0x8
    function isDefense(pos) {
        if (pos === undefined) return false;
        return (pos & 0x4) !== 0 || (pos & 0x8) !== 0;
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    // ── 原始 payload hex 解码（用于后端白名单没提取的字段，如 PayLpCost 的金额）──
    function hexU8(hex, off) {
        if (!hex || hex.length < (off + 1) * 2) return 0;
        return parseInt(hex.substr(off * 2, 2), 16);
    }
    function hexU32(hex, off) {
        if (!hex || hex.length < (off + 4) * 2) return 0;
        var b0 = hexU8(hex, off), b1 = hexU8(hex, off + 1), b2 = hexU8(hex, off + 2), b3 = hexU8(hex, off + 3);
        return (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;
    }

    // ── 卡牌 query 数据解析（含攻守/等级/连接标记）──
    // 与 ygopro-msg-encode 的 CardQuery 字段顺序一致；每个 chunk = [len(4B)][flags(4B)][按标志位排列的字段]
    var QUERY = {
        CODE: 1, POSITION: 2, ALIAS: 4, TYPE: 8, LEVEL: 16, RANK: 32, ATTRIBUTE: 64, RACE: 128,
        ATTACK: 256, DEFENSE: 512, BASE_ATTACK: 1024, BASE_DEFENSE: 2048, REASON: 4096,
        REASON_CARD: 8192, EQUIP_CARD: 16384, TARGET_CARD: 32768, OVERLAY_CARD: 65536,
        COUNTERS: 131072, OWNER: 262144, STATUS: 524288, LSCALE: 2097152, RSCALE: 4194304, LINK: 8388608,
    };
    // 连接标记位（ocgcore）
    var LMARK = {
        BL: 1, BOTTOM: 2, BR: 4, LEFT: 8, RIGHT: 32, TL: 64, TOP: 128, TR: 256,
    };
    var cardStatByKey = {};    // "ctl:loc:seq" → {atk,def,batk,bdef,level,rank,link,marker,type}
    var cardStatByCode = {};   // code → 同上（兜底）

    function hexToBytes(hex) {
        var n = Math.floor(hex.length / 2);
        var out = new Uint8Array(n);
        for (var i = 0; i < n; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
        return out;
    }
    function parseCardQueryChunk(dv, offset, total) {
        if (offset + 4 > total) return null;
        var len = dv.getInt32(offset, true);
        if (len < 4 || offset + len > total) return null;
        if (len === 4) return { card: { empty: true }, length: 4 };
        var flags = dv.getUint32(offset + 4, true);
        var card = { flags: flags };
        var o = offset + 8;
        if (flags & QUERY.CODE) { card.code = dv.getInt32(o, true); o += 4; }
        if (flags & QUERY.POSITION) {
            var pd = dv.getUint32(o, true);
            card.controller = pd & 255; card.location = (pd >>> 8) & 255;
            card.sequence = (pd >>> 16) & 255; card.position = (pd >>> 24) & 255;
            o += 4;
        }
        if (flags & QUERY.ALIAS) { card.alias = dv.getInt32(o, true); o += 4; }
        if (flags & QUERY.TYPE) { card.type = dv.getInt32(o, true); o += 4; }
        if (flags & QUERY.LEVEL) { card.level = dv.getInt32(o, true); o += 4; }
        if (flags & QUERY.RANK) { card.rank = dv.getInt32(o, true); o += 4; }
        if (flags & QUERY.ATTRIBUTE) { card.attribute = dv.getInt32(o, true); o += 4; }
        if (flags & QUERY.RACE) { card.race = dv.getInt32(o, true); o += 4; }
        if (flags & QUERY.ATTACK) { card.atk = dv.getInt32(o, true); o += 4; }
        if (flags & QUERY.DEFENSE) { card.def = dv.getInt32(o, true); o += 4; }
        if (flags & QUERY.BASE_ATTACK) { card.batk = dv.getInt32(o, true); o += 4; }
        if (flags & QUERY.BASE_DEFENSE) { card.bdef = dv.getInt32(o, true); o += 4; }
        if (flags & QUERY.REASON) { o += 4; }
        if (flags & QUERY.REASON_CARD) { o += 4; }
        if (flags & QUERY.EQUIP_CARD) { o += 4; }
        if (flags & QUERY.TARGET_CARD) { var tc = dv.getInt32(o, true); o += 4 + tc * 4; }
        if (flags & QUERY.OVERLAY_CARD) {
            // PATCH(白神服) 2026-11-17: 记下**素材卡号**（原来只跳过数量）→ 点超量怪能列出素材
            var oc = dv.getInt32(o, true);
            o += 4;
            card.mats = oc || 0;
            if (oc > 0 && oc < 64) {
                card.overlayCodes = [];
                for (var _oi = 0; _oi < oc; _oi++) { card.overlayCodes.push(dv.getInt32(o, true)); o += 4; }
            } else { o += oc * 4; }
        }
        if (flags & QUERY.COUNTERS) { var cc = dv.getInt32(o, true); o += 4 + cc * 4; }
        if (flags & QUERY.OWNER) { o += 4; }
        if (flags & QUERY.STATUS) { card.status = dv.getInt32(o, true); o += 4; }
        if (flags & QUERY.LSCALE) { card.lscale = dv.getInt32(o, true); o += 4; }
        if (flags & QUERY.RSCALE) { card.rscale = dv.getInt32(o, true); o += 4; }
        if (flags & QUERY.LINK) { card.link = dv.getInt32(o, true); o += 4; card.marker = dv.getInt32(o, true); o += 4; }
        return { card: card, length: len };   // 用 chunk 长度推进，容错
    }
    function statSig(s) {
        if (!s) return '';
        return [s.atk, s.def, s.link, s.marker, s.level, s.rank].join('|');
    }
    // 字段级合并：query 可能只带部分字段（如只查攻击力），缺的字段保留旧值，避免守备力变 "?"
    function mergeStat(prev, c) {
        var out = {};
        function pick(name) {
            if (c[name] !== undefined) return c[name];
            if (prev && prev[name] !== undefined) return prev[name];
            return undefined;
        }
        ['atk', 'def', 'batk', 'bdef', 'level', 'rank', 'link', 'marker', 'type'].forEach(function (k) {
            var v = pick(k);
            if (v !== undefined) out[k] = v;
        });
        return out;
    }
    // 解析 UpdateData 的 hex，缓存攻守等数据；返回是否有更新
    function ingestUpdateDataStats(m) {
            // ⚠ 注意：查看器调用本函数时传的是**整个 envelope**（我们的形状是 {name, f:{...}}），
            //   所以 hex/raw/player/location 都要先看 m.f，再看 m 本身。
            var __o = (m && m.f && (m.f.raw || m.f.hex || m.f.cards)) ? m.f : m;
            // PATCH(白神服) 2026-11-07: 对局中服务端给的是 **hex**（可能没有 raw 结构化字段），
            //   原来这里要求 raw 才继续 → 攻守变化被直接丢弃（用户实测：攻击力不实时更新 ✗）
            if (!__o || ((!__o.raw || !__o.raw.length) && (!__o.hex || __o.hex.length < 6)
                && (!Array.isArray(__o.cards) || !__o.cards.length))) return false;
            // PATCH(白神服) 2026-11-18: 有些服务端/回放给的是**结构化 cards**（CardQuery 数组），
            //   既没有 hex 也没有 raw。持续效果（螺旋融合 +2600、觉醒盖亚 +N）就是这种格式，
            //   不接这里的话攻守永远停在卡池基础值。
            if (Array.isArray(__o.cards) && __o.cards.length) {
                var _cp = (__o.player === 0 || __o.player === 1) ? __o.player : -1;
                var _cl = (__o.location !== undefined ? (__o.location & 0x7f) : null);
                if (_cp < 0 || _cl === null) return false;
                var _chg = false, _seenStat = false;
                for (var _ci = 0; _ci < __o.cards.length; _ci++) {
                    var _cq = __o.cards[_ci] || {};
                    if (typeof _cq !== 'object') continue;   // UpdateData(HAND/DECK) 可能是纯卡号数组
                    if (_cq.attack !== undefined && _cq.atk === undefined) _cq.atk = _cq.attack;
                    if (_cq.defense !== undefined && _cq.def === undefined) _cq.def = _cq.defense;
                    if (_cq.baseAttack !== undefined && _cq.batk === undefined) _cq.batk = _cq.baseAttack;
                    if (_cq.baseDefense !== undefined && _cq.bdef === undefined) _cq.bdef = _cq.baseDefense;
                    if (_cq.code === undefined && _cq.atk === undefined && _cq.def === undefined
                        && _cq.level === undefined && _cq.rank === undefined) continue;
                    if (_cq.atk !== undefined || _cq.def !== undefined
                        || _cq.batk !== undefined || _cq.bdef !== undefined) _seenStat = true;
                    var _cs = (typeof _cq.sequence === 'number') ? _cq.sequence : _ci;
                    var _ck = _cp + ':' + _cl + ':' + _cs;
                    var _cm = mergeStat(cardStatByKey[_ck], _cq);
                    if (_cq.code) _cm.code = _cq.code;
                    else delete _cm.code;
                    if (statSig(cardStatByKey[_ck]) !== statSig(_cm)) _chg = true;
                    cardStatByKey[_ck] = _cm;
                }
                // ★ 只有 cards[] 真的带攻守/等级时才 return；纯卡号数组必须继续走
                //   raw/hex，否则 UpdateData 里另一半 query 数据会被整个跳过
                //   （b151 的结构化分支曾把这种混合报文挡在 raw 前面）。
                if (_seenStat) return _chg;
            }
            // 我们的 envelope 没有 hex，只有 raw（结构化 query 字段）→ 直接用它回填
            if (!__o.hex || __o.hex.length < 6) {
                var __pl = (__o.player === 0 || __o.player === 1) ? __o.player : -1;
                var __lc = (__o.location !== undefined ? (__o.location & 0x7f) : null);
                if (__pl < 0 || __lc === null) return false;
                // PATCH(白神服) 2026-11-19: 只有 cards[]、没有 raw 的 UpdateData（纯卡号快照）
                //   原来会走到这里对 undefined 取 .length → 抛异常，整条消息处理中断。
                if (!Array.isArray(__o.raw)) return false;
                var __ch = false;
                for (var __ri = 0; __ri < __o.raw.length; __ri++) {
                    var __rq = __o.raw[__ri] || {};
                    // 衍生物 query 的 code 可能是 0，但 atk/def 是有的；
                    // 以前 !__rq.code 直接 continue → 衍生物攻守永远不进缓存（用户实测 ✗）。
                    if (!__rq.code && __rq.atk === undefined && __rq.def === undefined && __rq.level === undefined) continue;
                    var __sq = (typeof __rq.sequence === 'number') ? __rq.sequence : __ri;
                    var __k = __pl + ':' + __lc + ':' + __sq;
                    var __mm = mergeStat(cardStatByKey[__k], __rq);
                    if (__rq.code) __mm.code = __rq.code;
                    else delete __mm.code;
                    if (statSig(cardStatByKey[__k]) !== statSig(__mm)) __ch = true;
                    cardStatByKey[__k] = __mm;
                }
                return __ch;
            }
        var bytes;
        try { bytes = hexToBytes(__o.hex); } catch (e) { return false; }
        if (bytes.length < 3) return false;
        var player = bytes[1];
        var location = bytes[2];
        if (player !== 0 && player !== 1) return false;
        var locPlain = location & 0x7f;
        var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        var off = 3, slot = 0, changed = false;
        while (off < bytes.length && slot < 64) {
            var r;
            try { r = parseCardQueryChunk(dv, off, bytes.length); } catch (e) { break; }
            if (!r || !r.length) break;
            var c = r.card;
            off += r.length;
            if (c && c.code && (c.atk !== undefined || c.def !== undefined || c.batk !== undefined
                || c.link !== undefined || c.level !== undefined)) {
                var key = player + ':' + locPlain + ':' + (c.sequence !== undefined ? c.sequence : slot);
                var mergedKey = mergeStat(cardStatByKey[key], c);
                // 衍生物的 CardQuery 常常 code=0（真实 token 卡号在场上模型里），
                // 不能把 0 写进统计记录的 code，否则 statFor 会因 code 不一致丢弃整条攻守。
                if (c.code) mergedKey.code = c.code;
                else delete mergedKey.code;
                // PATCH(白神服) 2026-11-17: 超量素材数量/卡号存在统计记录里 ——
                //   回放的开局快照不会走 Move，原来场上的卡 mats 一直是 0 → 看不到素材
                if (c.mats !== undefined) mergedKey.mats = c.mats;
                if (c.overlayCodes) mergedKey.overlayCodes = c.overlayCodes;
                if (statSig(cardStatByKey[key]) !== statSig(mergedKey)) changed = true;
                cardStatByKey[key] = mergedKey;
                var mergedCode = mergeStat(cardStatByCode[c.code], c);
                mergedCode.code = c.code;
                delete mergedCode.atk; delete mergedCode.def; delete mergedCode.batk; delete mergedCode.bdef;
                if (statSig(cardStatByCode[c.code]) !== statSig(mergedCode)) changed = true;
                cardStatByCode[c.code] = mergedCode;
            }
            slot++;
        }
        return changed;
    }
    // 取某格/某卡的攻守：优先实时 query 数据（字段级合并），其次卡池基础值
    // 连接怪没有守备力：改用连接值显示（卡池里 level=连接值、def=箭头掩码）
    function statFor(cellKey, code) {
        var sKey = cardStatByKey[cellKey] || null;
        if (sKey && sKey.code !== undefined && sKey.code !== 0 && sKey.code !== code) sKey = null;   // 该格已换成别的卡 → 旧记录作废；code=0 是衍生物/未知卡，保留
        // ★ 场上的攻守必须按“格位”取：同卡号的两只怪可以各自被加减攻守。
        //   cardStatByCode 只是卡号级缓存，不能作为场上格子的兜底，否则 A 的攻击力变化
        //   会通过卡号缓存串到同卡号的 B。非场上（手牌/卡组/墓地）才用卡号缓存。
        var _isFieldCell = false;
        try {
            var _cp = String(cellKey || '').split(':');
            if (_cp.length >= 2) {
                var _cl = Number(_cp[1]);
                _isFieldCell = !!(_cl & (4 | 8 | 256 | 512));
            }
        } catch (e) {}
        var sCode = _isFieldCell ? null : (cardStatByCode[code] || null);
        // 以"卡号记录"为底，用"本格记录"覆盖已知字段（两处互补，避免残缺记录丢字段）
        var s = (sKey || sCode) ? mergeStat(sCode, sKey || {}) : null;
        var m = cardMetaMap[String(code)];
        var isLinkMon = !!(s && s.link) || !!(m && (m.cat || '').indexOf('连接') >= 0);
        if (isLinkMon) {
            var out = s ? {
                atk: s.atk, batk: s.batk, level: s.level, rank: s.rank,
                link: s.link, marker: s.marker, type: s.type,
            } : {};
            if (out.link === undefined && m && m.level) out.link = m.level;                 // 连接值
            if (out.marker === undefined && m && typeof m.def === 'number') out.marker = m.def;  // 箭头掩码
            if (out.atk === undefined && m) out.atk = m.atk;
            if (out.batk === undefined) out.batk = out.atk;
            out.def = undefined;   // 连接怪不显示守备力
            return out;
        }
        if (s) {
            // 实时数据可能有残缺（只查了攻击力等）→ 用卡池基础值补齐，避免只有一半数字
            var out2 = {
                atk: s.atk, def: s.def, batk: s.batk, bdef: s.bdef,
                level: s.level, rank: s.rank, type: s.type,
            };
            if (out2.atk === undefined && m) out2.atk = m.atk;
            if (out2.def === undefined && m) out2.def = m.def;
            if (out2.batk === undefined) out2.batk = (m && m.atk !== undefined) ? m.atk : out2.atk;
            if (out2.bdef === undefined) out2.bdef = (m && m.def !== undefined) ? m.def : out2.def;
            if (out2.atk === undefined && out2.def === undefined) return null;
            return out2;
        }
        if (m && (m.atk !== undefined || m.def !== undefined)) {
            return { atk: m.atk, def: m.def, batk: m.atk, bdef: m.def, level: m.level };
        }
        return null;
    }

    // ── 播放推进 ──
    // 哪些消息算“可见步”：会写日志或改变场地。
    // UpdateData / UpdateCard / Select* / CardHint 等只是查询回声/等待输入，算填充消息。
    var VISIBLE_MSG = {
        Start: 1, Draw: 1, NewTurn: 1, NewPhase: 1, Move: 1, Attack: 1,
        Summoning: 1, SpSummoning: 1, Chaining: 1, ChainSolving: 1,
        ChainSolved: 1, ChainEnd: 1, Damage: 1, Recover: 1, PayLpCost: 1,
        Win: 1, Hint: 1,
    };

    // 取一条消息里涉及的卡号（用于"卡图加载完再推进"）
    function codesOfMsg(m) {
        try {
            if (!m) return [];
            var f = m.f || {};
            var out = [];
            if (f.code) out.push(Number(f.code));
            if (f.cards && f.cards.length) f.cards.forEach(function (c) { if (c) out.push(Number(c)); });
            return out.filter(Boolean);
        } catch (e) { return []; }
    }
    var _stepImgBusy = false;

    function playNext() {
        if (_stepImgBusy) return true;
        if (idx < messages.length - 1) {
            var _next = messages[idx + 1];
            var _codes = codesOfMsg(_next);
            if (_codes.length) {
                var _need = _codes.filter(function (c) { return !imgLoadedFlag(c); });
                if (_need.length) {
                    _stepImgBusy = true;
                    preloadImgs(_need).then(function () { _stepImgBusy = false; playNext(); });
                    return true;
                }
            }
            idx++;
            handleMessage(messages[idx]);
            // 应用这条消息后，再把"涉及的卡"告诉面板（观战/回放与画面严格同步）
            try {
                var _fc = messages[idx] && messages[idx].__code;
                if (_fc && window.__ypFollowCard) window.__ypFollowCard(_fc);
            } catch (e) {}
            selfHealHidden();
            // 消息处理器内部已做分区 updateZone；此处仅兜底更新计数/头
            renderPlayerHead(0);
            renderPlayerHead(1);
            updateProgress();
            return true;
        }
        return false;
    }

    // 推进到下一个“可见步”：中间夹的填充消息在同一 tick 内直接快进跳过（不计时）
    /** 自愈：模型里 faceDown 的卡如果格子里没有卡牌元素，就补画一次（观战里偶发空白 ✗） */
    // 里侧守备特殊召唤（影依猎鹰等）：展示/翻面结束后确保是卡背，而不是透明卡
    function ensureFaceDownCard(ctl, loc, seq, code) {
        try {
            ctl = Number(ctl); loc = Number(loc); seq = Number(seq);
            if ((ctl !== 0 && ctl !== 1) || (loc !== LOC.MZONE && loc !== LOC.SZONE) || !(seq >= 0 && seq <= 6)) return;
            if (!field[ctl]) field[ctl] = {};
            var key = loc + ':' + seq;
            var c = field[ctl][key];
            if (!c) {
                addCardAt(ctl, loc, seq, toCode(code), true, 0x8);
            } else {
                c.faceDown = true;
                c.revealed = false;
                c._hideKnown = true;
                c.knownCode = 0;
                c._hiddenAt = Date.now();
            }
            updateZone(ctl, loc);
            var cell = cellElFor(ctl, loc, seq);
            if (cell) { cell._fxHold = false; cell.style.opacity = ''; cell.classList.remove('rp-force-legacy'); }
            Array.prototype.forEach.call(document.querySelectorAll('.rp-fly:not(.rp-fly-atk)'), function (g) {
                if (g.parentNode) g.parentNode.removeChild(g);
            });
            if (window.__frApi && window.__frApi.syncGhosts) window.__frApi.syncGhosts();
        } catch (e) {}
    }

    // 最后兜底：只要日志里出现过“→魔陷”的 Move，而模型目标格为空，
    // 就按日志行上的 ctl/seq 补一张里侧卡。即使上面消息字段异常也能显示。
    function healSetFromLog() {
        try {
            var rows = document.querySelectorAll('.rp-lrow[data-set-loc="8"]');
            for (var i = rows.length - 1; i >= 0; i--) {
                var row = rows[i];
                if (row.getAttribute('data-set-healed') === '1') continue;
                var at = Number(row.getAttribute('data-set-at') || 0);
                if (!at || Date.now() - at > 8000) continue;
                var ctl = Number(row.getAttribute('data-set-ctl'));
                var seq = Number(row.getAttribute('data-set-seq'));
                if ((ctl !== 0 && ctl !== 1) || !(seq >= 0 && seq <= 5)) continue;
                if (!field[ctl]) field[ctl] = {};
                if (field[ctl][LOC.SZONE + ':' + seq]) { row.setAttribute('data-set-healed', '1'); continue; }
                var code = Number(row.getAttribute('data-set-code') || 0);
                if (!code) {
                    var im = row.querySelector('img.rp-lthumb');
                    if (im) {
                        code = Number(im.getAttribute('data-code') || 0);
                        if (!code) {
                            var mm = String(im.getAttribute('src') || '').match(/(\d{1,9})\.jpg/);
                            if (mm) code = Number(mm[1]);
                        }
                    }
                }
                addCardAt(ctl, LOC.SZONE, seq, code, isFaceDown(Number(row.getAttribute('data-set-pos') || 0)), Number(row.getAttribute('data-set-pos') || 0x8));
                updateZone(ctl, LOC.SZONE);
                row.setAttribute('data-set-healed', '1');
                // 同步清替身/恢复 v2
                Array.prototype.forEach.call(document.querySelectorAll('.rp-fly:not(.rp-fly-atk)'), function (g) {
                    if (g.parentNode) g.parentNode.removeChild(g);
                });
                var cell = cellElFor(ctl, LOC.SZONE, seq);
                if (cell) { cell._fxHold = false; cell.style.opacity = ''; }
                if (window.__frApi && window.__frApi.syncGhosts) window.__frApi.syncGhosts();
            }
        } catch (e) {}
    }

    // 盖放卡洗牌：YGOPro MSG_SHUFFLE_SET_CARD 的视觉提示
    function shuffleSetPulse() {
        if (animSuppress) return;
        try {
            var els = [];
            document.querySelectorAll('#replayField .rp-cell .rp-card.rp-card-down').forEach(function (el) { els.push(el); });
            els.forEach(function (el, i) {
                setTimeout(function () {
                    el.classList.remove('rp-set-shuffle');
                    void el.offsetWidth;
                    el.classList.add('rp-set-shuffle');
                    setTimeout(function () { el.classList.remove('rp-set-shuffle'); }, 520);
                }, i * 45);
            });
        } catch (e) {}
    }

    // 胜利横幅（YGOPro 的 Win 画面）
    function showWinBanner(name) {
        try {
            var old = document.querySelector('.rp-win-banner');
            if (old && old.parentNode) old.parentNode.removeChild(old);
            var b = document.createElement('div');
            b.className = 'rp-win-banner';
            b.innerHTML = '<div class="rp-win-title">🏆 胜利</div><div class="rp-win-name">' + escapeHtml(name || '') + '</div>';
            document.body.appendChild(b);
            setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 8000);
        } catch (e) {}
    }

    function showStatusBanner(title, sub) {
        try {
            var old = document.querySelector('.rp-win-banner');
            if (old && old.parentNode) old.parentNode.removeChild(old);
            var b = document.createElement('div');
            b.className = 'rp-win-banner';
            b.innerHTML = '<div class="rp-win-title">' + escapeHtml(title || '') + '</div>'
                + (sub ? ('<div class="rp-win-name">' + escapeHtml(sub) + '</div>') : '');
            document.body.appendChild(b);
            setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 6000);
        } catch (e) {}
    }

    // 模型 → DOM 幂等对账：所有 MZONE/SZONE 的卡在每个稳定帧都应有卡节点。
    // 动画飞行期间先跳过，避免把“正在飞的卡”提前画回目标格。
    function reconcileFieldDom() {
        try {
            if (bulkApplyActive || !fieldEl) return;
            // 格子 hold 超时先释放，否则 reconcile 会一直跳过
            try { releaseStaleHolds(); } catch (e) {}
            // 飞行替身若因动画中断一直没删：3.5s 后强制清掉，并解除 v2 隐藏
            try {
                var _ghosts = document.querySelectorAll('.rp-fly:not(.rp-fly-atk)');
                var _removedGhost = false;
                var _removedKeys = [];
                var _removedTokens = [];
                Array.prototype.forEach.call(_ghosts, function (g) {
                    if (!g._flyAt) { g._flyAt = Date.now(); return; }
                    if (Date.now() - g._flyAt > 3500) {
                        var _hk = g.getAttribute('data-hide-key');
                        if (_hk) _removedKeys.push(_hk);
                        if (g._flyToken) _removedTokens.push(g._flyToken);
                        if (g.parentNode) g.parentNode.removeChild(g);
                        _removedGhost = true;
                    }
                });
                if (_removedGhost) {
                    try {
                        if (window.__frApi && window.__frApi.endFly) {
                            _removedTokens.forEach(function (t) { window.__frApi.endFly(t); });
                        }
                        if (window.__frApi && window.__frApi.showKeys) {
                            _removedKeys.forEach(function (k) { window.__frApi.showKeys(k); });
                        }
                        if (window.__frApi && window.__frApi.syncGhosts) window.__frApi.syncGhosts();
                    } catch (e) {}
                }
            } catch (e) {}
            if (document.querySelector('.rp-fly:not(.rp-fly-atk)')) return;
            [0, 1].forEach(function (c) {
                [LOC.MZONE, LOC.SZONE].forEach(function (loc) {
                    Object.keys(field[c] || {}).forEach(function (k) {
                        if (k.indexOf(loc + ':') !== 0) return;
                        var seq = Number(k.split(':')[1]);
                        var card = field[c][k];
                        var cell = cellElFor(c, loc, seq);
                        if (!card || !cell) return;
                        if (cell._fxHold || cell.style.opacity === '0') return;
                        if (!cell.querySelector('.rp-card')) {
                            setCellCard(cell, card, c === 1,
                                loc === LOC.MZONE && isDefense(card.pos),
                                c + ':' + loc + ':' + seq, loc === LOC.MZONE);
                            return;
                        }
                        // 旧节点卡号明显不对 → 重画该格（不碰正在翻面的节点）
                        try {
                            var node = cell.querySelector('.rp-card');
                            var dc = Number(node.getAttribute('data-code') || 0);
                            if (card.code && dc && dc !== toCode(card.code)) updateZone(c, loc);
                        } catch (e) {}
                    });
                });
            });
            refreshEquipMarks();
            refreshDisabledZones();
            refreshCardTargetMarks();
            refreshCardTargetLines();
            refreshChainLines();
            if (window.__frApi && window.__frApi.syncGhosts) window.__frApi.syncGhosts();
        } catch (e) {}
    }

    function dumpDomField() {
        try {
            var out = {};
            [0, 1].forEach(function (c) {
                out[c] = {};
                Object.keys(field[c] || {}).forEach(function (k) {
                    if (k.indexOf(LOC.MZONE + ':') !== 0 && k.indexOf(LOC.SZONE + ':') !== 0) return;
                    var p = k.split(':');
                    var cell = cellElFor(c, Number(p[0]), Number(p[1]));
                    var card = cell && cell.querySelector('.rp-card');
                    out[c][k] = {
                        model: field[c][k],
                        dom: card ? { cls: card.className, title: card.title, code: card.getAttribute('data-code') } : null,
                        forceBack: !!(cell && cell.querySelector('.rp-force-back')),
                        cellOpacity: cell ? cell.style.opacity : null,
                        fxHold: !!(cell && cell._fxHold)
                    };
                });
            });
            return out;
        } catch (e) { return { err: e.message }; }
    }

    function assertFieldParity() {
        try {
            var bad = [];
            [0, 1].forEach(function (c) {
                Object.keys(field[c] || {}).forEach(function (k) {
                    if (k.indexOf(LOC.MZONE + ':') !== 0 && k.indexOf(LOC.SZONE + ':') !== 0) return;
                    var p = k.split(':');
                    var cell = cellElFor(c, Number(p[0]), Number(p[1]));
                    if (!cell || !cell.querySelector('.rp-card')) bad.push(c + ':' + k);
                });
            });
            return bad;
        } catch (e) { return ['err:' + e.message]; }
    }

    // MSG_FIELD_DISABLED：YGOPro 在被封锁的怪兽/魔陷格画白 X。
    // bit0-6 P0 怪兽、bit8-15 P0 魔陷、bit16-22 P1 怪兽、bit24-31 P1 魔陷。
    function refreshDisabledZones() {
        try {
            Array.prototype.forEach.call(document.querySelectorAll('.rp-zone-disabled'), function (e) {
                e.classList.remove('rp-zone-disabled');
            });
            var _mask = disabledFieldMask >>> 0;
            // 消息里的 bit 是决斗位；我方在 1 号位或回放判定交换时，左右两组要换过来
            if (myDuelPos === 1 || metaSwap) {
                _mask = (((_mask & 0xffff) << 16) | ((_mask >>> 16) & 0xffff)) >>> 0;
            }
            if (!_mask) return;
            for (var p = 0; p < 2; p++) {
                var mBase = p === 0 ? 0 : 16;
                var sBase = p === 0 ? 8 : 24;
                for (var m = 0; m < 7; m++) {
                    if (_mask & (1 << (mBase + m))) {
                        var mc = cellElFor(p, LOC.MZONE, m);
                        if (mc) mc.classList.add('rp-zone-disabled');
                    }
                }
                for (var s = 0; s < 8; s++) {
                    if (_mask & (1 << (sBase + s))) {
                        var sc = cellElFor(p, LOC.SZONE, s);
                        if (sc) sc.classList.add('rp-zone-disabled');
                    }
                }
            }
        } catch (e) {}
    }

    function refreshCardTargetMarks() {
        try {
            var _ctSig = cardTargets.map(function (p) {
                var _s = field[p.source.ctl] && field[p.source.ctl][p.source.loc + ':' + p.source.seq];
                var _t = field[p.target.ctl] && field[p.target.ctl][p.target.loc + ':' + p.target.seq];
                return p.source.ctl + ':' + p.source.loc + ':' + p.source.seq + '>'
                    + p.target.ctl + ':' + p.target.loc + ':' + p.target.seq + ':' + (_s ? 1 : 0) + (_t ? 1 : 0);
            }).join('|');
            if (_ctSig === window.__targetMarkSig && document.querySelectorAll('.rp-target-mark').length) return;
            window.__targetMarkSig = _ctSig;
            Array.prototype.forEach.call(document.querySelectorAll('.rp-target-mark'), function (e) {
                if (e.parentNode) e.parentNode.removeChild(e);
            });
            var keep = [];
            cardTargets.forEach(function (pair) {
                var s = pair.source, t = pair.target;
                if (!s || !t) return;
                var sc = field[s.ctl] && field[s.ctl][s.loc + ':' + s.seq];
                var tc = field[t.ctl] && field[t.ctl][t.loc + ':' + t.seq];
                if (!sc || !tc) return;
                keep.push(pair);
                var cell = cellElFor(t.ctl, t.loc, t.seq);
                if (!cell || !cell.querySelector('.rp-card')) return;
                var mark = document.createElement('div');
                mark.className = 'rp-target-mark rp-target-pop';
                mark.textContent = '◎';
                mark.title = '效果对象' + (sc.code ? ('：' + cardName(sc.code)) : '');
                cell.appendChild(mark);
            });
            cardTargets = keep;
        } catch (e) {}
    }

    function refreshCardTargetLines() {
        try {
            Array.prototype.forEach.call(document.querySelectorAll('.rp-target-line'), function (e) {
                if (e.parentNode) e.parentNode.removeChild(e);
            });
            cardTargets.forEach(function (pair) {
                var s = pair.source, t = pair.target;
                if (!s || !t) return;
                var sr = rectAt(s.ctl, s.loc, s.seq);
                var tr = rectAt(t.ctl, t.loc, t.seq);
                if (!sr || !tr) return;
                var x1 = sr.left + sr.width / 2, y1 = sr.top + sr.height / 2;
                var x2 = tr.left + tr.width / 2, y2 = tr.top + tr.height / 2;
                var dx = x2 - x1, dy = y2 - y1;
                var len = Math.sqrt(dx * dx + dy * dy);
                if (!len) return;
                var line = document.createElement('div');
                line.className = 'rp-target-line';
                line.style.left = x1 + 'px';
                line.style.top = y1 + 'px';
                line.style.width = len + 'px';
                line.style.transform = 'rotate(' + Math.atan2(dy, dx) + 'rad)';
                document.body.appendChild(line);
            });
        } catch (e) {}
    }

    function refreshChainLines() {
        try {
            Array.prototype.forEach.call(document.querySelectorAll('.rp-chain-line'), function (e) {
                if (e.parentNode) e.parentNode.removeChild(e);
            });
            if (!chainStack || chainStack.length < 2) return;
            var pts = [];
            chainStack.forEach(function (it) {
                var r = rectAt(it.ctl, it.loc, it.seq);
                if (r) pts.push({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
            });
            for (var i = 1; i < pts.length; i++) {
                var dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
                var len = Math.sqrt(dx * dx + dy * dy);
                if (!len) continue;
                var line = document.createElement('div');
                line.className = 'rp-chain-line';
                line.style.left = pts[i - 1].x + 'px';
                line.style.top = pts[i - 1].y + 'px';
                line.style.width = len + 'px';
                line.style.transform = 'rotate(' + Math.atan2(dy, dx) + 'rad)';
                document.body.appendChild(line);
            }
        } catch (e) {}
    }

    function selfHealHidden() {
        try {
            // 清理已经离场/翻正的兜底卡背
            Array.prototype.forEach.call(document.querySelectorAll('.rp-force-back'), function (fb) {
                try {
                    var cell0 = fb.closest ? fb.closest('.rp-cell') : null;
                    var z0 = cell0 && cell0.getAttribute('data-zone');
                    if (!z0) { fb.remove(); return; }
                    var vv = null;
                    if (z0.indexOf('emz:') === 0) {
                        // 额外怪兽区：emz:L = P0 seq5 / P1 seq6，emz:R = P0 seq6 / P1 seq5
                        var _side = z0 === 'emz:L';
                        vv = (field[0] && field[0][LOC.MZONE + ':' + (_side ? 5 : 6)])
                            || (field[1] && field[1][LOC.MZONE + ':' + (_side ? 6 : 5)]);
                    } else {
                        var pp = z0.split(':').map(Number);
                        vv = field[pp[0]] && field[pp[0]][pp[1] + ':' + pp[2]];
                    }
                    if (!vv || !vv.faceDown) fb.remove();
                } catch (e) { fb.remove(); }
            });
            [0, 1].forEach(function (c) {
                Object.keys(field[c] || {}).forEach(function (k) {
                    var v = field[c][k];
                    var parts = k.split(':');
                    var loc = Number(parts[0]), seq = Number(parts[1]);
                    if (loc !== LOC.MZONE && loc !== LOC.SZONE) return;
                    var cell = cellElFor(c, loc, seq);
                    if (!cell) return;
                    if (!v || !v.faceDown) { cell.classList.remove('rp-force-legacy'); var _fb0 = cell.querySelector('.rp-force-back'); if (_fb0) _fb0.remove(); return; }
                    if (!cell.querySelector('.rp-card')) {
                        setCellCard(cell, v, c === 1, loc === LOC.MZONE && isDefense(v.pos), c + ':' + loc + ':' + seq, loc === LOC.MZONE);
                    }
                    if (!v._hiddenAt) v._hiddenAt = Date.now();
                    if (Date.now() - v._hiddenAt < 1200) return;
                    // 已有可见的 v2/旧卡 → 不要叠兜底卡背（否则会看到两层卡背）
                    var _cellRect = cell.getBoundingClientRect();
                    var _cx = _cellRect.left + _cellRect.width / 2;
                    var _cy = _cellRect.top + _cellRect.height / 2;
                    var _visible = false;
                    try {
                        var _legacy = cell.querySelector('.rp-card');
                        if (_legacy && getComputedStyle(_legacy).opacity !== '0') _visible = true;
                    } catch (e) {}
                    if (!_visible) {
                        try {
                            var _frs = document.querySelectorAll('#frRoot .fr-card');
                            for (var _fi = 0; _fi < _frs.length; _fi++) {
                                var _fe = _frs[_fi];
                                if (getComputedStyle(_fe).opacity === '0') continue;
                                var _rr = _fe.getBoundingClientRect();
                                if (!_rr.width) continue;
                                if (_cx >= _rr.left - 2 && _cx <= _rr.right + 2
                                    && _cy >= _rr.top - 2 && _cy <= _rr.bottom + 2) { _visible = true; break; }
                            }
                        } catch (e) {}
                    }
                    if (_visible) {
                        var _fbv = cell.querySelector('.rp-force-back');
                        if (_fbv) _fbv.remove();
                        return;
                    }
                    // 直接盖一层纯卡背：即使 v2 节点存在但内容透明/错位也一定能看见
                    var _fb = cell.querySelector('.rp-force-back');
                    if (!_fb) {
                        _fb = document.createElement('div');
                        _fb.className = 'rp-force-back';
                        cell.appendChild(_fb);
                    }
                    try { _fb.style.backgroundImage = 'url("' + CARD_BACK_URI + '")'; } catch (e) {}
                });
            });
        } catch (e) {}
    }

    // PATCH(白神服) 2026-11-19: 卡图"只等一次"。
    //   原来 need = 所有没加载成功的 code —— 某张图 404 之后 imgLoadedFlag 永远是 false，
    //   于是每推进一条消息都要再等 2.2 秒（IMG_WAIT_MS），实时对局直接变成卡顿/积压；
    //   更糟的是 preload 的 promise 若已 resolve，.then 会立刻回到 flushMessages →
    //   再撞同一个门 → 微任务死循环，主线程被饿死（用户看到的就是「卡死 + 张数乱跳」）。
    //   现在尝试过的 code 记进 _imgTried，不再重复拦截、也不再重复等待。
    var _imgTried = {};
    function playNextVisible() {
        if (_stepImgBusy) return true;
        // 先扫一遍：算出这一"可见步"会推进到哪、涉及哪些卡，等卡图加载完再真正应用
        var guard = 0, j = idx, codes = [];
        while (j < messages.length - 1 && guard++ < 50000) {
            j++;
            try {
                codes = codes.concat(codesOfMsg(messages[j]));
            } catch (e) {}
            if (VISIBLE_MSG[messages[j].name]) break;
        }
        var need = codes.filter(function (c) { return !imgLoadedFlag(c) && !_imgTried[Number(c) || 0]; });
        if (need.length) {
            need.forEach(function (c) { _imgTried[Number(c) || 0] = 1; });
            _stepImgBusy = true;
            preloadImgs(need).then(function () {
                _stepImgBusy = false;
                // PATCH(白神服) 2026-11-19: 卡图就绪后怎么续跑，分两种场景：
                //   · 自己打（交互）：要**立刻**把队列清空，否则出牌会慢半拍；
                //   · 观战 / 回放：必须**按节奏一步一步**来。原来这里无条件 flush，
                //     观战一旦碰到要等卡图的消息就会把整段历史一口气播完
                //     （用户反馈：观战播放速度太快 ✗）。
                //   用 setTimeout 让出一次事件循环，避免微任务递归把主线程饿死。
                setTimeout(function () {
                    try {
                        var _interactive = liveMode && !window.__ypWatchMode && !replayMode;
                        if (_interactive) flushMessages(); else playNextVisible();
                    } catch (e) {}
                }, 0);
            });
            return true;
        }
        while (idx < messages.length - 1 && guard++ < 50000) {
            if (idx >= j) break;
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
        log('暂不支持回退，请用进度条重播', 'rp-log-hint');
    }

    // PATCH(白神服) 2026-11-19: 立即把队列消息全部应用（交互/实时模式用）。
    //   旧实现的两个致命问题：
    //   ① 卡图未加载时 playNextVisible() 会「不前进但返回 true」→ while 空转 20 万次；
    //   ② 循环结束后还有一句 `idx = messages.length-1; handleMessage(messages[idx])`，
    //      把中间所有消息（Draw / Move / UpdateData …）**整段跳过** —— 模型从此错位，
    //      表现就是「卡组/额外张数反复变动」「场上少卡」。
    //   现在：不前进就停；等卡图加载完由 preloadImages 的回调续跑。
    var _flushing = false;
    function flushMessages() {
        if (_flushing) return 0;          // 防重入（图片回调可能再触发一次）
        _flushing = true;
        var guard = 0, applied = 0;
        try {
            while (idx < messages.length - 1 && guard++ < 200000) {
                if (_stepImgBusy) break;
                var before = idx;
                var more = playNextVisible();
                if (idx < before) break;     // 防御：某条消息把指针拨回（回放的 Start）
                if (idx !== before) applied++;
                if (idx === before) break;   // 没推进（等图 / 到末尾）
                if (!more) break;
            }
        } finally { _flushing = false; }
        if (applied) {
            try { renderPlayerHead(0); renderPlayerHead(1); updateProgress(); } catch (e) {}
        }
        return applied;
    }

    // PATCH(白神服) 2026-11-19: 「这一步的动画播完了吗」
    //   观战/回放要求**每一步等动画演完再走下一步**（用户要求），否则卡片还在飞、
    //   下一条消息就把状态改了，看着像是快进。
    //   读 Web Animations：只看场地/手牌（#replayField、v2 图层 #frRoot）和特效层
    //   （rp-fly / rp-fx…）里的**一次性**动画；无限循环的呼吸光不算，避免永远等不到头。
    function paceAnimLeftMs() {
        try {
            if (!document.getAnimations) return 0;
            var list = document.getAnimations();
            var maxLeft = 0;
            for (var i = 0; i < list.length; i++) {
                var a = list[i];
                if (!a || a.playState !== 'running') continue;
                var ct = (a.effect && a.effect.getComputedTiming) ? a.effect.getComputedTiming() : null;
                if (!ct || !isFinite(ct.endTime)) continue;     // 无限循环 → 不算
                var el = a.effect.target;
                if (!el || el.nodeType !== 1) continue;
                var inBoard = false;
                try {
                    inBoard = !!(el.closest && (el.closest('#replayField') || el.closest('#frRoot')));
                } catch (e) {}
                var cls = String(el.className || '');
                var isFx = /(^|\s)rp-(fly|fx|ghost|impact|attack|damage|summon|cellmark)/.test(cls);
                // 不少特效（攻击⚔/伤害数字）是**没有 class 的裸 div 直接挂到 body**，
                //   只按 class 过滤会漏 → 观战照样一步接一步把动画切掉。
                var isBodyFx = false;
                try { isBodyFx = (el.parentElement === document.body); } catch (e) {}
                if (!inBoard && !isFx && !isBodyFx) continue;
                var cur = Number(a.currentTime) || 0;
                var left = ct.endTime - cur;
                if (left > maxLeft) maxLeft = left;
            }
            return maxLeft;
        } catch (e) { return 0; }
    }

    function startAuto() {
        stopAuto();
        playing = true;
        playPauseBtn.textContent = '⏸ 暂停';
        // 基准：1x ≈ 333ms/可见步 → 右侧日志约每秒 3 行（填充消息不计时）
        var interval = Math.max(40, Math.floor(1000 / 3 / speed));
        var _waitSince = 0;
        function pendingImgs() {
            try {
                var n = 0, imgs = document.querySelectorAll('#replayField img');
                for (var i = 0; i < imgs.length; i++) {
                    var im = imgs[i];
                    if (!im) continue;
                    if (im.dataset && im.dataset.skipGate === '1') continue;
                    if (!im.complete || im.naturalWidth === 0) n++;
                }
                return n;
            } catch (e) { return 0; }
        }
        var _lastStepAt = 0;
        function tick() {
            if (!playing) return;
            // PATCH(白神服) 2026-11-07: 显示优先 —— 场地上还有卡图没加载完就先等，
            //   别急着播下一步动画（用户要求）。每步最多等 1.2 秒，避免死等 404 图。
            try {
                var _pend = pendingImgs();
                if (_pend > 0) {
                    if (!_waitSince) _waitSince = Date.now();
                    if (Date.now() - _waitSince < 1200) { timer = setTimeout(tick, 90); return; }
                }
                _waitSince = 0;
            } catch (e) {}
            // PATCH(白神服) 2026-11-19: **等这一步的动画播完**再推进（观战快进的根治）。
            //   原来只按固定 333ms 走，卡片还在飞行/翻转就切下一步，看起来像快进。
            try {
                var _animLeft = paceAnimLeftMs();
                if (_animLeft > 40) {
                    timer = setTimeout(tick, Math.min(150, Math.max(50, _animLeft)));
                    return;
                }
            } catch (e) {}
            // 动画播完后还要留一个最小间隔（1x ≈ 333ms），避免一条接一条糊在一起
            if (_lastStepAt && Date.now() - _lastStepAt < interval) {
                timer = setTimeout(tick, Math.max(40, interval - (Date.now() - _lastStepAt)));
                return;
            }
            if (!playNextVisible()) {
                if (liveMode) { timer = setTimeout(tick, interval); return; }   // PATCH: 实时模式，等新消息
                stopAuto();
                log('回放结束', 'rp-log-win');
                return;
            }
            _lastStepAt = Date.now();
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
                if (i >= chain.length) { cardDomCache[code] = 'cover2.jpg?v=20261108a'; return resolve(); }
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
            var cursor = 0, done = 0;
            function nextBatch() {
                var batch = [];
                while (cursor < total && batch.length < 8) batch.push(codes[cursor++]);
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
                // 判定 座位(pos) ↔ 决斗位(消息player) 是否互换：用 Win 消息的真实决斗位对照 DB winner 座位
                metaSwap = false;
                var winMsg = null;
                for (var wi = 0; wi < messages.length; wi++) {
                    if (messages[wi].name === 'Win') { winMsg = messages[wi]; break; }
                }
                if (winMsg && winMsg.f && (winMsg.f.player === 0 || winMsg.f.player === 1)) {
                    var seatWinner = (data.players || []).find(function (p) { return p.winner; });
                    if (seatWinner) metaSwap = (winMsg.f.player !== seatWinner.pos);
                }
                // 显示顺序按决斗位（0 在前 = 自己）
                var orderedPlayers = (data.players || []).slice().sort(function (a, b) {
                    return duelSeat(a.pos) - duelSeat(b.pos);
                });
                metaEl.textContent = data.roomName + ' · ' + orderedPlayers.map(function (p) {
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
                log('加载失败：' + e.message, 'rp-log-err');
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
        try { if (window.__frApi && window.__frApi.reset) window.__frApi.reset(); } catch (e) {}
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
        try { reconcileFieldDom(); } catch (e) {}
        updateProgress();
    });
    try {
        var _savedSpeed = parseFloat(localStorage.getItem('siro_replay_speed'));
        if (_savedSpeed > 0 && isFinite(_savedSpeed)) speed = _savedSpeed;
    } catch (e) {}
    document.querySelectorAll('.rp-speed').forEach(function (btn) {
        try {
            if (parseFloat(btn.getAttribute('data-s')) === speed) {
                document.querySelectorAll('.rp-speed').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
            }
        } catch (e) {}
        btn.addEventListener('click', function () {
            speed = parseFloat(btn.getAttribute('data-s'));
            document.querySelectorAll('.rp-speed').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            try { localStorage.setItem('siro_replay_speed', String(speed)); } catch (e) {}
            if (playing) { stopAuto(); startAuto(); }
        });
    });

    // 窗口尺寸变化时重新缩放棋盘，保证不出现滚动条
    var _fitTimer = 0;
    window.addEventListener('resize', function () {
        clearTimeout(_fitTimer);
        _fitTimer = setTimeout(function () {
            fitBoard();
            try { refreshEquipMarks(); refreshDisabledZones(); refreshCardTargetMarks(); refreshCardTargetLines(); } catch (e) {}
        }, 80);
    });

    // ── 弹窗 API：回放码旁“▶ 回放”按钮调用 openReplay ──
    var modalEl = $('replayModal');
    if (modalEl) {
        window.openReplay = function (code) {
            modalEl.style.display = 'flex';
            loadReplay(code || '');
            setTimeout(fitBoard, 80);
        };
        var closeBtnEl = $('replayClose');
        function closeModal() {
            modalEl.style.display = 'none';
            stopAuto();
        }
        if (closeBtnEl) closeBtnEl.addEventListener('click', closeModal);
        modalEl.addEventListener('click', function (e) {
            if (e.target === modalEl) closeModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modalEl.style.display !== 'none') closeModal();
        });
    }
    // ===== PATCH: 实时模式接口（由 make-viewer-live.mjs 注入）=====
    window.__live = {
        /** PATCH(白神服) 2026-11-03: 观战/批量场景下关闭移动动画（避免一次涌入大量消息时卡死） */
        setAnimSuppress: function (val) { animSuppress = !!val; },
        /** PATCH(白神服): 强制重绘一次（改名/观战同步后刷新抬头与场地） */
        redraw: function () {
            try { updateAllZones(); updatePiles(); renderPlayerHead(0); renderPlayerHead(1); renderTurnLabel(); updateProgress(); prefetchOwnHints(0); } catch (e) {}
        },
        /** PATCH(白神服) 2026-11-03: 一次性应用大量消息（观战同步）——只更新模型，最后统一渲染一次 */
        bulkApply: function (envs) {
            if (!envs || !envs.length) return 0;
            for (var i = 0; i < envs.length; i++) messages.push(envs[i]);
            idx = messages.length - 1;
            var prevSuppress = animSuppress;
            animSuppress = true;
            bulkApplyActive = true;
            try {
                for (var j = 0; j < envs.length; j++) handleMessage(envs[j]);
            } finally {
                bulkApplyActive = false;
                animSuppress = prevSuppress;
                try { updateAllZones(); updatePiles(); renderPlayerHead(0); renderPlayerHead(1); renderTurnLabel(); updateProgress(); prefetchOwnHints(0); } catch (e) {}
            }
            return envs.length;
        },
        /** 重置场地并进入实时模式。metaIn 形如 {roomName, players:[{pos,name,mainc}]} */
        reset: function (metaIn) {
            try { cellCounters = {}; cellChain = {}; chainStack.length = 0; } catch (e) {}
            try { cardStatByKey = {}; cardStatByCode = {}; } catch (e) {}
            try {
                equipLinks = [];
                cardTargets = [];
                disabledFieldMask = 0;
                var _w = document.querySelector('.rp-win-banner');
                if (_w) _w.remove();
                refreshEquipMarks(); refreshCardTargetMarks(); refreshCardTargetLines(); refreshChainLines();
                refreshDisabledZones();
            } catch (e) {}
            try {
                Object.keys(announcedClearTimer).forEach(function (k) { clearTimeout(announcedClearTimer[k]); });
                announcedClearTimer = {}; announcedByCell = {}; announcedOwner = {};
            } catch (e) {}
            try { duelCount = [ { ns: 0, sp: 0, ef: 0 }, { ns: 0, sp: 0, ef: 0 } ]; } catch (e) {}
            stopAuto();
            meta = metaIn || { players: [] };
            metaSwap = false;                 // 实时/观战：决斗位 0 固定画在下方
            messages = [];
            idx = -1;
            field = { 0: {}, 1: {} };
            lp = [8000, 8000];
            // 卡组/额外张数直接从 meta 来（不必依赖抓到 Start 那条消息）
            // PATCH(白神服) 2026-11-07: 重连/刷新后还没收到 Start 时，张数应该是「未知」而不是 0
            //   （显示 0 会让人以为卡组空了；真正拿到 Start 再填准确值）
            deckCount = [null, null];
            extraCount = [null, null];
            resetPilePriority();
            try { markCountSource('reset'); } catch (e) {}
            deckTopCode = [null, null];
            graveCountOverride = [null, null];
            deckReversed = [false, false];
            equipLinks = [];
            disabledFieldMask = 0;
            cardTargets = [];
            // meta 的张数只是大厅记录（优先级最低），只能给"未知"兜底；
            //   真正的值由随后的 Start / ReloadField / DeckCount 覆盖。
            (meta.players || []).forEach(function (p) {
                if (p.pos === 0 || p.pos === 1) {
                    if (p.mainc) setPileAbs(p.pos, 'deck', p.mainc, 'meta');
                    if (p.extrac !== undefined && p.extrac !== null) setPileAbs(p.pos, 'extra', p.extrac, 'meta');
                }
            });
            turnPlayer = 0;
            turnCount = 0;
            phaseText = '';
            pendingMats = {};
            lastLand = null;
            pendingImpact = null;
            lastPayLp = null;
            inBattle = false;
            animSuppress = false;
            preloading = false;
            loaded = true;
            logBody.innerHTML = '';
            mainEl.style.display = 'flex';
            if (controlsEl) controlsEl.style.display = 'none';   // 实时模式不显示播放控件
            createFieldDOM();
            try { if (window.__frApi && window.__frApi.reset) window.__frApi.reset(); } catch (e) {}
            liveMode = true;
            renderPlayerHead(0);
            renderPlayerHead(1);
            updatePiles();
            updateProgress();
            if (typeof fitBoard === 'function') { try { fitBoard(); } catch (e) {} }
            log('— 实时对局已接入 —', 'rp-log-phase');
        },
        /** 追加一条消息 {name, f, hex}；播放循环会自动取走 */
        /** PATCH(白神服): 用服务端权威张数直接设定某方手牌（观战对账用） */
        // 左侧卡片信息大图：本站缩略图优先（服务端有缓存、命中率高）
        infoPicChain: function (code) {
            return ['/thumbcard/' + code + '.jpg?w=360&v=20261118d'].concat(picChain(code));
        },
        preloadImg: preloadImg,
        preloadImgs: preloadImgs,
        imgLoadedFlag: imgLoadedFlag,
        stepVisible: function () { return playNextVisible(); },
        setReplayMode: function (on) {
            replayMode = !!on;
            try {
                // 强制重画双方手牌（sig 里带 faceDown，直接清掉让它重建）
                [0, 1].forEach(function (c) {
                    var el = zoneEls[c + ':' + LOC.HAND];
                    if (el) { el._sig = ''; updateZone(c, LOC.HAND); }
                });
            } catch (e) {}
            return replayMode;
        },
        setLp: setLp,
        fieldDump: function () {
            try {
                var out = [];
                [0, 1].forEach(function (c) {
                    Object.keys(field[c] || {}).forEach(function (k) {
                        var v = field[c][k];
                        if (!v) return;
                        out.push({ ctl: c, key: k, code: v.code, pos: v.pos, faceDown: !!v.faceDown });
                    });
                });
                return out;
            } catch (e) { return []; }
        },
        lpPair: function () {
            try { return [ (lp && lp[0]) || 0, (lp && lp[1]) || 0 ]; } catch (e) { return [0, 0]; }
        },
        debugCounts: function () {
            try {
                return { deck: deckCount.slice(), extra: extraCount.slice(),
                         source: countSource, trace: countTrace.slice(-10),
                         myDuelPos: myDuelPos, metaSwap: metaSwap,
                         meta: (typeof meta !== 'undefined' ? meta : null) };
            } catch (e) { return { err: e.message }; }
        },
        /** 重连/刷新时恢复牌堆张数（服务端可能不再重发 Start/DeckCount）
         *  PATCH(白神服) 2026-11-19：走统一入口 + 来源优先级。
         *   src='snapshot' 只会补"未知"的一侧，绝不会盖掉 Start/DeckCount/ReloadField 的值。 */
        setCounts: function (deck, extra, src) {
            try {
                var take = function (which, a) {
                    if (!Array.isArray(a)) return;
                    for (var i = 0; i < 2; i++) {
                        var v = a[i];
                        if (v === null || v === undefined || v === '' || isNaN(Number(v))) continue;
                        setPileAbs(i, which, Number(v), src || 'snapshot');
                    }
                };
                take('deck', deck);
                take('extra', extra);
                markCountSource(src || 'setCounts');
                updatePiles();
                return true;
            } catch (e) { return false; }
        },
        /** 视角座位 → 房间 pos 的映射（[视角0, 视角1]）。由 duel-client 依据协议算好后下发 */
        /** 观战/回放节奏用：这一步的动画还剩多少毫秒（0 = 已播完） */
        paceLeft: function () { try { return paceAnimLeftMs(); } catch (e) { return 0; } },
        setSeatOrder: function (order) {
            try {
                if (order && (order[0] === 0 || order[0] === 1) && (order[1] === 0 || order[1] === 1)
                    && order[0] !== order[1]) {
                    seatOrder = [order[0], order[1]];
                    seatOrderExplicit = true;
                } else {
                    seatOrder = null;
                    seatOrderExplicit = false;
                }
                renderPlayerHead(0);
                renderPlayerHead(1);
                return true;
            } catch (e) { return false; }
        },
        /** 供观战/实战客户端直接触发洗牌 FX（force=true 时忽略批量静音） */
        shufflePileFx: function (ctl, pile, force) {
            try { shufflePileFx(ctl, pile, force); return true; } catch (e) { return false; }
        },
        cardCodeAt: function (ctl, loc, seq) {
            try {
                var k = (loc | 0) + ':' + (seq | 0);
                var c = field[ctl] ? field[ctl][k] : null;
                if (!c) return 0;
                var n = (typeof c.code === 'number' && c.code) ? c.code
                    : (typeof c.knownCode === 'number' ? c.knownCode : 0);
                return n | 0;
            } catch (e) { return 0; }
        },
        announceByCode: function (code, names) {
            // 按卡号找场上的那张卡（优先场上，其次额外/墓地），给它挂宣言标签
            try {
                var c0 = Number(code) | 0;
                if (!c0) return false;
                var hit = null;
                [LOC.MZONE, LOC.SZONE, LOC.EXTRA, LOC.GRAVE].forEach(function (loc) {
                    if (hit) return;
                    [0, 1].forEach(function (ctl) {
                        if (hit) return;
                        Object.keys(field[ctl] || {}).forEach(function (k) {
                            if (hit) return;
                            var v = field[ctl][k];
                            if (v && v.code === c0 && k.indexOf(loc + ':') === 0) hit = ctl + ':' + k;
                        });
                    });
                });
                if (!hit) return false;
                announcedByCell[hit] = (names || []).slice();
                var cell = zoneEls[hit];
                if (cell) { cell._code = null; cell._statSig = ''; }
                var pp = hit.split(':');
                updateZone(Number(pp[0]), Number(pp[1]));
                return true;
            } catch (e) { return false; }
        },
        setAnnounced: function (cellKey, names) {
            try {
                if (!names || !names.length) {
                    delete announcedByCell[cellKey];
                    delete announcedOwner[cellKey];
                } else {
                    announcedByCell[cellKey] = names.slice();
                    try {
                        var _op2 = String(cellKey).split(':');
                        var _oc2 = field[Number(_op2[0])] && field[Number(_op2[0])][Number(_op2[1]) + ':' + Number(_op2[2])];
                        announcedOwner[cellKey] = _oc2 ? { uid: _oc2.uid, code: _oc2.code } : null;
                    } catch (e) {}
                }
                var cell = zoneEls[cellKey];
                if (cell) { cell._code = null; cell._statSig = ''; }
                var p2 = String(cellKey).split(':');
                if (p2.length >= 2) updateZone(Number(p2[0]), Number(p2[1]));
            } catch (e) {}
        },
        debugStats: function () {
            try {
                var o = {};
                Object.keys(cardStatByKey || {}).slice(0, 40).forEach(function (k) { o[k] = cardStatByKey[k]; });
                return o;
            } catch (e) { return { err: e.message }; }
        },
        swapSides: function () {
            // 手动换边：只交换「视角座位 → 房间 pos」的映射（seatOrder），
            // 绝不再去改 meta.players 的 pos —— 那是原来「名字自己对调、下次又对调回来」的根源。
            try {
                var cur = (seatOrder && seatOrder.length === 2) ? seatOrder.slice() : [0, 1];
                seatOrder = [cur[1], cur[0]];
                seatOrderExplicit = true;
                renderPlayerHead(0);
                renderPlayerHead(1);
                return true;
            } catch (e) { return false; }
        },
        startDeck: function () { try { return startDeck.slice(); } catch (e) { return [null, null]; } },
        startSwapFlag: function () { try { return startSwapFlag; } catch (e) { return null; } },
        duelStats: function () {
            try {
                function pack(i) {
                    return {
                        ns: duelCount[i].ns || 0, sp: duelCount[i].sp || 0, ef: duelCount[i].ef || 0,
                        atk: attackAtkSum(i),
                        kinds: JSON.parse(JSON.stringify(duelCount[i].kinds || emptySpKind()))
                    };
                }
                return { 0: pack(0), 1: pack(1) };
            } catch (e) { return { 0: {}, 1: {} }; }
        },
        picChainOf: function (code) { try { return picChain(code); } catch (e) { return []; } },
        /** 某格怪兽的超量素材卡号列表（点超量怪看素材用） */
        /** 弹一张卡的放大展示（素材列表点击用） */
        /** 给新渲染器（field-render.js）用的纯数据模型 */
        getModel: function () {
            var out = { zones: [], hands: [] };
            try {
                for (var ctl = 0; ctl < 2; ctl++) {
                    var cards = field[ctl] || {};
                    Object.keys(cards).forEach(function (k) {
                        var c = cards[k];
                        if (!c || !c.code) return;
                        var parts = k.split(':');
                        var loc = Number(parts[0]) | 0, seq = Number(parts[1]) | 0;
                        if (loc !== LOC.MZONE && loc !== LOC.SZONE) return;
                        out.zones.push({
                            ctl: ctl, loc: loc, seq: seq, uid: c.uid || (ctl + '_' + k),
                            def: isDefense(c.pos), faceDown: !!c.faceDown,
                            src: cardImgSrc(c.code)
                        });
                    });
                }
                for (var hc = 0; hc < 2; hc++) {
                    var hs = locCards(hc, LOC.HAND) || [];
                    hs.forEach(function (c) {
                        if (!c || !c.code) return;
                        out.hands.push({ ctl: hc, uid: c.uid || ('h' + hc + '_' + c.seq), src: cardImgSrc(c.code) });
                    });
                }
            } catch (e) {}
            return out;
        },
        /** 取某格卡的引擎 uid（图层按 uid 复用节点，才能跨区连续移动） */
        uidAt: function (ctl, loc, seq) {
            try {
                var c = field[ctl] && field[ctl][((loc | 0) & 0x7f) + ':' + (seq | 0)];
                return (c && c.uid) ? String(c.uid) : '';
            } catch (e) { return ''; }
        },
        showCard: function (code, label) { try { showCardShowcase(code, label || ''); } catch (e) {} },
        materialsAt: function (ctl, loc, seq) {
            try {
                var c = field[ctl] && field[ctl][((loc | 0) & 0x7f) + ':' + (seq | 0)];
                if (c && c.overlayCodes && c.overlayCodes.length) return c.overlayCodes.slice();
                var arr = (c && c.matsCodes) || [];
                return arr.slice();
            } catch (e) { return []; }
        },
        /** 交互层补一条"卡片式"日志（如禁止令宣言：左边要有小图） */
        logCard: function (o) { try { logCardRow(o || {}); } catch (e) {} },
        cardBackUri: function () { return CARD_BACK_URI; },
        startExtra: function () { try { return startExtra.slice(); } catch (e) { return [null, null]; } },
        seatsAligned: function () { try { return metaAligned; } catch (e) { return false; } },
        handCount: function (ctl) {
            try {
                var n = 0;
                Object.keys(field[ctl] || {}).forEach(function (k) { if (k.indexOf(LOC.HAND + ':') === 0) n++; });
                return n;
            } catch (e) { return 0; }
        },
        setMyDuelPos: function (pos) {
            myDuelPos = (pos === 0 || pos === 1) ? pos : null;
        },
        dumpField: function () {
            try {
                var o = {};
                [0, 1].forEach(function (c) {
                    o[c] = {};
                    Object.keys(field[c] || {}).forEach(function (k) {
                        var v = field[c][k];
                        o[c][k] = {
                            code: v && v.code, down: v && v.faceDown, pos: v && v.pos,
                            known: v && v.knownCode, rv: v && v.revealed,
                            mats: v && v.mats, overlays: v && v.overlayCodes,
                            uid: v && v.uid
                        };
                    });
                });
                return o;
            } catch (e) { return { err: e.message }; }
        },
        dumpDom: dumpDomField,
        assertParity: assertFieldParity,
        reconcile: function () { reconcileFieldDom(); return assertFieldParity(); },
        setHandCount: function (ctl, n) {
            try {
                if (ctl !== 0 && ctl !== 1) return 0;
                n = Math.max(0, Math.min(20, n | 0));
                if (!field[ctl]) field[ctl] = {};
                var keys = Object.keys(field[ctl]).filter(function (k) { return k.indexOf(LOC.HAND + ':') === 0; });
                if (keys.length === n) return n;
                keys.forEach(function (k) { delete field[ctl][k]; });
                for (var i = 0; i < n; i++) addCardAt(ctl, LOC.HAND, i, 0, true, 0);
                updateZone(ctl, LOC.HAND);
                return n;
            } catch (e) { return -1; }
        },
        /** PATCH(白神服): 观战追上实时后锁定消息流对手牌的增删（由 handc 对账接管） */
        setHandLock: function (v) { handLock = !!v; return handLock; },
        /** PATCH(白神服): 清空内存卡图缓存（回大厅时调用） */
        clearImageCache: clearImageCache,
        push: function (env) { messages.push(env); },
        /** 批量追加（迟到进页面时补齐历史用） */
        pushMany: function (envs) { for (var i = 0; i < envs.length; i++) messages.push(envs[i]); },
        setSpeed: function (x) { speed = x; },
        /** 加载卡名/卡种表（/api/cards）。实时模式不走 loadReplay，必须手动触发一次，
         *  否则日志里"召唤 xx"后面是空的，也认不出召唤种类（融合/同调/超量/连接/灵摆）。 */
        loadCards: function () { return loadCardNames(); },
        /** 卡图多源回退链（DIY → 先行 → OCG → 镜像 → cover.jpg），供交互层画卡图按钮用 */
        picChain: function (code) { return picChain(code); },
        /** 卡号 → 卡名（依赖 loadCards() 先加载过；没有就返回空串） */
        cardName: function (code) { return cardName(code); },
        /** 牌局座位（绝对 0/1）→ 当前画面显示名（已按 myDuelPos/metaSwap 映射） */
        playerName: function (pos) { try { return playerName(pos); } catch (e) { return ''; } },
        /**
         * 某个区域里现在有哪些卡 —— 交互层用它做"点开墓地/除外/额外查看列表"这类功能。
         * loc 用位值（DECK=1 HAND=2 MZONE=4 SZONE=8 GRAVE=16 REMOVED=32 EXTRA=64）。
         */
        cardsAt: function (ctl, loc) {
            var want = loc & 0x7f;
            var out = [];
            Object.keys(field[ctl] || {}).forEach(function (k) {
                var p = k.split(':');
                if (parseInt(p[0], 10) !== want) return;
                var c = field[ctl][k];
                out.push({ seq: parseInt(p[1], 10), code: c.code || c.knownCode || 0, pos: c.pos, faceDown: !!c.faceDown });
            });
            out.sort(function (a, b) { return a.seq - b.seq; });
            return out;
        },
        /**
         * 立即把队列里的消息全部应用掉（交互模式用）。
         * 回放的 3 可见步/秒节奏对"自己出牌"太慢；flush 保留动画代码路径，
         * 只是不等定时器 —— CSS 过渡/飞行元素照常播。
         */
        flush: function () {
            return flushMessages();
        },
        play: function () { startAuto(); },
        pause: function () { stopAuto(); },
        status: function () { return { live: liveMode, buffered: messages.length, played: idx, playing: playing }; },
        /** PATCH(白神服): 诊断用 —— 列出各消息名及条数（排查观战缺消息） */
        msgNames: function () {
            var out = {};
            for (var i = 0; i < messages.length; i++) {
                var n = (messages[i] && messages[i].name) || '?';
                out[n] = (out[n] || 0) + 1;
            }
            return out;
        },
        /** PATCH(白神服): 诊断用 —— 统计已收到的各类消息条数 */
        countMsgs: function (name) {
            var n = 0;
            for (var i = 0; i < messages.length; i++) { if (messages[i] && messages[i].name === name) n++; }
            return n;
        },
    };
}

// 弹窗常驻 DOM，直接初始化（不再依赖分区懒加载）
initReplayViewer();
