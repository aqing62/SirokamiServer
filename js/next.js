/* ══════════════════════════════════════════════════════════
   新版引导（原型）：问答式调用原站功能
   · 每屏最多 3 个圆形按钮
   · 结果页给 1~2 个圆形 CTA，跳到经典版对应功能（?goto=xxx 深链）
   · 右上角滑块可随时切回经典版，老站功能一个都没少
   ══════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var CLASSIC = 'index.html';                 // 经典版入口
    var CTA_GOTO = function (g) { return CLASSIC + '?goto=' + encodeURIComponent(g); };

    // ── 问答树 ──────────────────────────────────────────────
    // 首屏：上=决斗 / 左=卡片 / 右=战绩
    // 决斗：上=房间 左=下载 右=比赛     卡片：2×2（卡池/卡表/预组/常用卡）
    // 战绩：上=天梯 左=登录 右=比赛
    var FLOW = {
        root: {
            q: '你今天想做什么？',
            options: [
                { icon: 'cards', label: '决斗', sub: '进服对局', next: 'duel' },
                { icon: 'layers', label: '卡片', sub: '卡池 / 卡表', next: 'card' },
                { icon: 'chart', label: '战绩', sub: '天梯 / 比赛', next: 'record' }
            ]
        },

        // ── 决斗 ──
        duel: {
            q: '想怎么决斗？',
            options: [
                { icon: 'house', label: '房间', sub: '开房 / 规则', next: 'r_room' },
                { icon: 'download', label: '下载', sub: '客户端 / 卡包', next: 'r_download' },
                { icon: 'bracket', label: '比赛', sub: '群赛 / 瑞士轮', next: 'r_match' }
            ]
        },
        r_room: {
            q: '房间与规则',
            steps: [
                '建房时在<b>房间名 / 密码</b>里填规则代码：<b>M</b>=三局两胜、<b>T</b>=双打、<b>NF</b>=无禁限、<b>LP8000</b>=改基本分',
                '不填代码就是默认 <b>Genesys-Ext</b> 禁卡表（卡组总分 ≤ 100）',
                '想让朋友进来，把<b>房间名</b>发给他即可；代码后加 <b>#</b> 再接房间名，例如 <b>T,C#32</b>'
            ],
            cta: [
                { icon: 'house', label: '打开房间代码', screen: 'room' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },
        r_download: {
            q: '下载客户端',
            steps: [
                '先下 <b>MDPro3 客户端</b>（夸克网盘）',
                '再下 <b>DIY 卡包 siro.ypk</b>，放进客户端的 <b>expansions</b> 目录（MDPro3 里也可直接填链接下载）',
                '也可以用<b>萌卡平台</b>；服务器地址 <b>ygopro3.cn : 50010</b>'
            ],
            cta: [
                { icon: 'download', label: '打开下载页', screen: 'download' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },
        r_match: {
            q: '比赛相关',
            steps: [
                '群赛在 <b>M#</b> 房间进行，打完会<b>自动上报</b>到官网「比赛相关」的瑞士轮',
                '官网「比赛相关」能看<b>实时对阵、排名与历届八强</b>',
                '淘汰赛对阵公布后再打淘汰轮（对阵未出时页面会显示「待公布」）'
            ],
            cta: [
                { icon: 'bracket', label: '打开比赛相关', screen: 'match' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },

        // ── 卡片（2×2） ──
        card: {
            q: '卡片相关',
            layout: 'grid',
            options: [
                { icon: 'layers', label: '卡池', sub: '查卡 / 分值', next: 'r_pool' },
                { icon: 'list', label: '卡表', sub: '禁限 / 规则', next: 'r_banlist' },
                { icon: 'box', label: '预组', sub: '现成卡组', next: 'r_preset' },
                { icon: 'star', label: '常用卡', sub: '高分 / 泛用', next: 'r_popular' }
            ]
        },
        r_pool: {
            q: '卡池信息',
            steps: [
                '「卡池信息」页可按<b>字段 / 分值 / 关键词</b>筛选，双击卡片直接加入卡组',
                '相关卡片搜索：用 <b>「」</b> 搜同字段卡，也能按卡名或效果搜',
                '分值 <b>-1</b> 就是禁用卡'
            ],
            cta: [
                { icon: 'layers', label: '打开卡池', screen: 'pool' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },
        r_banlist: {
            q: '禁限卡表',
            steps: [
                '「禁限分值」页列出全部禁限卡与各自分值',
                '房间密码可切规则：默认 <b>Genesys-Ext</b>、<b>LF2</b>=OT 合表、<b>NF</b>=无禁限'
            ],
            cta: [
                { icon: 'list', label: '打开禁限分值', screen: 'banlist' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },
        r_preset: {
            q: '现成卡组',
            steps: [
                '经典版有<b>编年史卡组池</b>：现成卡组按首字母分组，可搜索、可一键定位',
                '也可以直接抄<b>历届八强</b>的卡组'
            ],
            cta: [
                { icon: 'box', label: '看卡组池', screen: 'preset' },
                { icon: 'bracket', label: '打开历届八强', screen: 'match' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },
        r_popular: {
            q: '常用高分卡',
            steps: [
                '组卡器里点<b>「查询高分卡」</b>，会高亮卡组内 8 分及以上的卡',
                '卡池页可按<b>分值</b>筛选，快速找高分 / 泛用卡'
            ],
            cta: [
                { icon: 'layers', label: '打开卡池', goto: 'pool' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },

        // ── 战绩 ──
        record: {
            q: '看什么战绩？',
            options: [
                { icon: 'chart', label: '天梯', sub: '排名 / 积分', next: 'r_rank' },
                { icon: 'user', label: '登录', sub: '账号 / 计分', next: 'r_login' },
                { icon: 'bracket', label: '比赛', sub: '对阵 / 八强', next: 'r_match' }
            ]
        },
        r_rank: {
            q: '天梯排名',
            steps: [
                '「天梯排名」看全服 TOP50 与段位：巅峰 / 大师 8% / 钻石 18% / 黄金 35% / 白银 60%',
                '需打完 <b>5 场定级赛</b>且遇到 <b>3 名不同对手</b>才能上榜',
                '点玩家名可以看他的对局记录与回放'
            ],
            cta: [
                { icon: 'chart', label: '打开排名', screen: 'rank' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },
        r_login: {
            q: '登录账号',
            steps: [
                '官网右上角点<b>登录账号</b>',
                '天梯计分、投稿 DIY 都需要登录；游戏内也可以直接 <b>/login 用户名 密码</b>'
            ],
            cta: [
                { icon: 'user', label: '打开登录', screen: 'login' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        }
    };

    // ── 音效（从音效包里抽出的三段：点击 ×2 交替、返回 ×1）──
    var SFX = { on: true, click: [], back: null, idx: 0 };
    (function initSfx() {
        try { if (localStorage.getItem('siro_next_sfx') === '0') SFX.on = false; } catch (e) { /* 忽略 */ }
        try {
            SFX.click = ['audio/se-click-1.wav', 'audio/se-click-2.wav'].map(function (src) {
                var a = new Audio(src);
                a.preload = 'auto';
                a.volume = 0.45;
                return a;
            });
            SFX.back = new Audio('audio/se-back.wav');
            SFX.back.preload = 'auto';
            SFX.back.volume = 0.45;
        } catch (e) { /* 音频不可用时静默 */ }
    })();

    function playSfx(kind) {
        if (!SFX.on) return;
        var a = null;
        if (kind === 'back') {
            a = SFX.back;
        } else if (SFX.click.length) {
            SFX.idx = (SFX.idx + 1) % SFX.click.length;   // 两个点击音交替
            a = SFX.click[SFX.idx];
        }
        if (!a) return;
        try { a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* 忽略 */ }
    }

    // ── 功能屏幕（外壳）：每个按钮对应一个屏幕，先占位，后续逐页填内容 ──
    var SCREENS = {
        room:     { title: '房间与规则', sub: '房间名 / 密码里的规则代码', goto: 'room',      todo: '静态内容：房间代码表 + 规则说明（无需接口）' },
        download: { title: '下载与安装', sub: 'MDPro3 客户端 + DIY 卡包',  goto: 'download',  todo: '静态内容：下载入口与安装步骤' },
        match:    { title: '比赛相关',   sub: '瑞士轮 · 实时对阵 · 历届八强', goto: 'tournament', todo: '数据：/api/tournament?slot=swiss|elim' },
        pool:     { title: '卡池',       sub: '查卡 / 筛选 / 分值',         goto: 'pool',      todo: '复用卡池数据与筛选（微调 UI）' },
        banlist:  { title: '卡表',       sub: '禁限分值一览',               goto: 'banlist',   todo: '复用禁限表（微调 UI）' },
        preset:   { title: '预组卡组',   sub: '现成卡组，直接抄',           goto: 'preset',    todo: '数据：编年史卡组池 / 投稿卡组' },
        popular:  { title: '常用卡',     sub: '使用率统计',                 goto: 'pool',      todo: '数据：/api/ladder/card-stats' },
        rank:     { title: '天梯排名',   sub: 'TOP50 · 段位 · 积分',         goto: 'ranking',   render: 'ladder' },
        login:    { title: '登录账号',   sub: '天梯计分 / 投稿需要登录',     goto: 'login',     todo: '复用账号接口（/api/forum/*）' }
    };

    var screenEl = null;

    function jumpClassic(target) {
        if (!target) return;
        location.href = 'index.html?goto=' + encodeURIComponent(target);
    }

    function goScreen(id) {
        if (!SCREENS[id]) return;
        transition(function () {
            historyStack.push({ screen: id, label: SCREENS[id].title });
            renderCurrent();
        });
    }

    function renderScreen(id) {
        var s = SCREENS[id];
        if (!s || !screenEl) return;
        screenEl.hidden = false;
        screenEl.innerHTML =
            '<div class="nx-screen-head">' +
                '<div class="nx-screen-titles">' +
                    '<h2>' + esc(s.title) + '</h2>' +
                    '<p>' + esc(s.sub) + '</p>' +
                '</div>' +
            '</div>' +
            '<div class="nx-screen-body" id="nxScreenBody"></div>' +
            '<div class="nx-screen-foot">' +
                '<button class="nx-screen-classic" type="button">先在经典版打开</button>' +
                '<span class="nx-screen-hint">点空白处 / Esc 返回</span>' +
            '</div>';
        // 内容：自带渲染器优先，否则显示占位说明
        var bodyEl = document.getElementById('nxScreenBody');
        if (bodyEl) {
            if (s.render && RENDERERS[s.render]) RENDERERS[s.render](bodyEl);
            else bodyEl.innerHTML = '<p class="nx-screen-todo">这一页正在新写中</p>' +
                '<p class="nx-screen-todo-sub">' + esc(s.todo || '') + '</p>';
        }
        // 每次打开都重播入场动画（元素本身不会重建，直接加类只会播一次）
        screenEl.classList.remove('is-in');
        void screenEl.offsetWidth;            // 强制重排，重启动画
        screenEl.classList.add('is-in');
        // 逐条浮现的 --i 已在生成 HTML 时内联写入（动画启动后再设无效）
        var cl = screenEl.querySelector('.nx-screen-classic');
        if (cl) cl.addEventListener('click', function () { jumpClassic(s.goto); });
    }

    // ── 屏幕渲染器 ──────────────────────────────────────────
    var LADDER_API = 'https://api.ygopro3.cn/api/ladder';

    // 段位徽章配色：按段位名后缀取色
    function tierClass(tier) {
        var t = String(tier || '');
        if (t.indexOf('巅峰') !== -1) return 'is-peak';
        if (t.indexOf('大师') !== -1) return 'is-master';
        if (t.indexOf('钻石') !== -1) return 'is-diamond';
        if (t.indexOf('黄金') !== -1) return 'is-gold';
        if (t.indexOf('白银') !== -1) return 'is-silver';
        return 'is-rookie';
    }

    function rankMedal(i) {
        return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
    }

    function renderLadder(body) {
        body.innerHTML = '<div class="nx-loading"><span class="nx-spin"></span>正在读取天梯数据…</div>';
        if (FX.mock) { paintLadder(body, mockLadderData()); return; }   // 调试：测试选手
        fetch(LADDER_API + '?t=' + Date.now())
            .then(function (r) { return r.json(); })
            .then(function (data) { paintLadder(body, data); })
            .catch(function () {
                body.innerHTML = '<div class="nx-screen-err">天梯数据读取失败（接口：' + LADDER_API + '）' +
                    '<button class="nx-screen-retry" type="button">重试</button></div>';
                var btn = body.querySelector('.nx-screen-retry');
                if (btn) btn.addEventListener('click', function () { renderLadder(body); });
            });
    }

    // 测试选手数据（调试面板可切换，用于检查 3D 滚动效果）
    var MOCK_CUTOFFS = [
        { name: 'S3 巅峰', minRating: 150 }, { name: 'S3 大师', minRating: 120 },
        { name: 'S3 钻石', minRating: 90 }, { name: 'S3 黄金', minRating: 60 },
        { name: 'S3 白银', minRating: 30 }, { name: 'S3 参战者', minRating: 0 }
    ];
    var MOCK_NAMES = ['上善若水', '灵蛇', '奈奈川', 'Huager', '莱蒂丝', '卫星闪灵·蓝色喷流灵',
        '鲁多', '244英雄', 'd3007', '青眼の白龍', '炸金花爱好者', '黑魔导女孩', 'D-HERO 钻石人',
        '银河眼光子龙', '真红眼黑龙', '电子龙', '沉默魔术师', '不知火', '三金', '不死真红眼',
        'C5律神小队', '幻影英雄'];
    function mockLadderData() {
        var players = MOCK_NAMES.map(function (n, i) {
            var rating = Math.max(12, 186 - i * 7 - (i % 3) * 4);
            var tier = MOCK_CUTOFFS.filter(function (c) { return rating >= c.minRating; })[0];
            var wins = 8 + ((i * 3) % 12), losses = 2 + (i % 7), draws = i % 4 === 0 ? 1 : 0;
            var total = wins + losses + draws;
            return {
                name: n, rating: rating, wins: wins, losses: losses, draws: draws, total: total,
                streak: i % 5 === 0 ? 3 : (i % 3 === 0 ? 2 : 0),
                tier: tier ? tier.name : 'S3 参战者',
                winRate: (wins / total * 100).toFixed(1) + '%'
            };
        });
        return { players: players, total: players.length, tierCutoffs: MOCK_CUTOFFS };
    }

    function paintLadder(body, data) {
        var players = (data && data.players) || [];
        var cuts = (data && data.tierCutoffs) || [];
        var total = (data && data.total) || players.length;


        var head = '<div class="nx-ladder-top">' +
            '<div class="nx-ladder-count nx-reveal" style="--i:0"><b>' + total + '</b><span>人已上榜</span></div>' +
        '</div>';

        if (!players.length) {
            body.innerHTML = head +
                '<div class="nx-empty">本赛季还没有人上榜——打完 <b>5 场定级赛</b> 并遇到 <b>3 名不同对手</b> 就会出现在这里</div>';
            return;
        }

        var rows = players.map(function (p, i) {
            var tier = String(p.tier || '').replace(/^S\d+\s*/, '');
            return '<div class="nx-row nx-item3d" data-player="' + esc(p.name) + '" data-rating="' + p.rating +
                '" data-tier="' + esc(tier) + '">' +   // 不用入场动画：animation-fill 会盖掉 3D 的 opacity
                '<span class="c-rank">' + rankMedal(i) + '</span>' +
                '<span class="c-name">' + esc(p.name) +
                    (p.streak > 1 ? '<span class="nx-streak">' + p.streak + '连胜</span>' : '') + '</span>' +
                '<span class="c-tier"><span class="nx-tier-badge ' + tierClass(tier) + '">' + esc(tier) + '</span></span>' +
                '<span class="c-rating">' + p.rating + '</span>' +
                '<span class="c-wld">' + p.wins + '胜 ' + p.losses + '负' + (p.draws ? ' ' + p.draws + '平' : '') + '</span>' +
                '<span class="c-rate">' + esc(p.winRate || '-') + '</span>' +
            '</div>';
        }).join('');

        body.innerHTML = head +
            '<div class="nx-list-head nx-reveal" style="--i:1">' +
                '<span>#</span><span>玩家</span><span>段位</span><span>积分</span><span>战绩</span><span>胜率</span>' +
            '</div>' +
            '<div class="nx-scroll nx-reveal" style="--i:2" id="nxLadderScroll">' +
                '<div class="nx-list">' + rows + '</div>' +
            '</div>' +
            '<div class="nx-list-note">数据来自天梯服务 · 每场 M# 对局结束后更新</div>';

        var scroller = document.getElementById('nxLadderScroll');
        // 点击选手条 → 弹出对战记录 / 卡组
        Array.prototype.forEach.call(scroller.querySelectorAll('.nx-row'), function (r) {
            r.addEventListener('click', function (ev) {
                openPlayerOverlay(
                    { name: r.getAttribute('data-player'), rating: r.getAttribute('data-rating'), tier: r.getAttribute('data-tier') },
                    { x: ev.clientX, y: ev.clientY }
                );
            });
        });
        bindScroll3D(scroller);
    }

    // ── 滚动 3D（圆润弧形）＋ 惯性缓动滚动 ────────────────────
    // ① 距离用 sin 映射：中间平缓、两端陡 → 看起来是一条圆弧而不是直线锥（菱形）
    // ② wheel 事件累加目标值，rAF 里插值逼近 → 滚轮不再生硬
    // ③ 上下留白 = (容器高 - 行高)/2 → 首尾条目都能滚到正中，看得清
    function bindScroll3D(scroller) {
        if (!scroller) return;
        var items = Array.prototype.slice.call(scroller.querySelectorAll('.nx-item3d'));
        if (!items.length) return;

        var MAX_ROT = 26;    // 最大后仰角
        var DEPTH = 150;     // 最大后退距离
        var SCALE = 0.12;    // 最大缩小
        var FADE = 0.55;     // 最大变暗
        var BLUR = 1.2;      // 最大虚化

        function setPad() {
            var rowH = items[0].offsetHeight || 44;
            var pad = Math.max(0, Math.round((scroller.clientHeight - rowH) / 2));
            scroller.style.paddingTop = pad + 'px';
            scroller.style.paddingBottom = pad + 'px';
        }

        function paint() {
            var box = scroller.getBoundingClientRect();
            var cy = box.top + box.height / 2;
            var half = box.height / 2;
            for (var i = 0; i < items.length; i++) {
                var el = items[i];
                var r = el.getBoundingClientRect();
                var d = ((r.top + r.height / 2) - cy) / half;      // -1(上) ~ 1(下)
                if (d > 1) d = 1; else if (d < -1) d = -1;
                var k = Math.sin(d * Math.PI / 2);                 // 圆形缓动曲线
                var ad = Math.abs(k);
                el.style.transform =
                    'rotateX(' + (-k * MAX_ROT).toFixed(2) + 'deg) ' +
                    'translateZ(' + (-ad * DEPTH).toFixed(1) + 'px) ' +
                    'scale(' + (1 - ad * SCALE).toFixed(3) + ')';
                el.style.opacity = (1 - ad * FADE).toFixed(3);
                el.style.filter = ad > 0.03 ? 'blur(' + (ad * BLUR).toFixed(2) + 'px)' : 'none';
            }
        }

        // 惯性缓动滚动
        var target = scroller.scrollTop;
        var cur = target;
        var animating = false;
        var keep = 0;
        function loop() {
            cur += (target - cur) * 0.15;
            if (Math.abs(target - cur) < 0.4) {
                cur = target;
                scroller.scrollTop = cur;
                animating = false;
                paint();
                return;
            }
            scroller.scrollTop = cur;
            paint();
            requestAnimationFrame(loop);
        }
        function kick() { if (!animating) { animating = true; requestAnimationFrame(loop); } }

        function onWheel(e) {
            e.preventDefault();
            var max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
            target = Math.max(0, Math.min(max, target + e.deltaY * 1.15));
            kick();
        }
        scroller.addEventListener('wheel', onWheel, { passive: false, capture: true });

        scroller.addEventListener('scroll', function () {
            if (animating) return;              // 程序写入触发的 scroll 忽略
            cur = target = scroller.scrollTop;  // 键盘/触控板等原生滚动同步
            paint();
        }, { passive: true });

        window.addEventListener('resize', function () {
            setPad();
            requestAnimationFrame(paint);
        });

        setPad();
        requestAnimationFrame(paint);
        // 布局/字体/入场动画完成后尺寸才稳定，这里多补几次重绘，避免算出"所有行距离相同"（画面变成统一倾斜）
        setTimeout(function () { setPad(); paint(); }, 240);
        setTimeout(paint, 620);
        if (typeof ResizeObserver === 'function') {
            var ro = new ResizeObserver(function () { setPad(); paint(); });
            ro.observe(scroller);
        }
    }

    // ── 选手弹窗：左 对战记录 / 右 卡组 ──────────────────────
    var DUELS_API = 'https://api.ygopro3.cn/api/ladder/duels';
    var DECKS_API = 'https://api.ygopro3.cn/api/ladder/decks';
    var _cardMap = null;
    // 卡图地址（与经典版一致：DIY 走本站图床，OCG 走萌卡 CDN，另有备用）
    var PIC_DIY = 'https://api.ygopro3.cn/pics/siro/';
    var PIC_OCG = 'https://cdn.233.momobako.com/ygopro/pics/';
    var PIC_ALT = 'https://cdn02.moecube.com:444/ygopro-super-pre/data/pics/';

    var PIC_CHAIN = [PIC_OCG, PIC_ALT, PIC_DIY];   // 与老站一致：OCG → SuperPre → DIY
    var _scoreMap = null;
    var _scoreLimit = 100;

    function cardInfo(id) { return (_cardMap && _cardMap[String(id)]) || null; }

    // 禁限分值表（/api/scores）：{ id: {score, forbidden} }
    function loadScoreMap() {
        if (_scoreMap) return Promise.resolve(_scoreMap);
        return fetch('/api/scores?t=' + Date.now())
            .then(function (r) {
                var lim = parseInt(r.headers.get('X-GExt-Limit'), 10);   // 卡组总分上限，与老站一致
                if (!isNaN(lim) && lim > 0) _scoreLimit = lim;
                return r.json();
            })
            .then(function (d) { _scoreMap = d || {}; return _scoreMap; })
            .catch(function () { _scoreMap = {}; return _scoreMap; });
    }

    // 卡图：逐级兜底，成功于 DIY 图床时打 DIY 角标
    function wireDeckImage(img, tile, id) {
        var step = 0;
        img.addEventListener('load', function () {
            if (step === 2 && !tile.querySelector('.nx-deck-diy')) {
                var b = document.createElement('span');
                b.className = 'nx-deck-diy';
                b.textContent = 'DIY';
                (tile.querySelector('.nx-deck-photo') || tile).appendChild(b);
            }
        });
        img.addEventListener('error', function () {
            step++;
            if (step < PIC_CHAIN.length) img.src = PIC_CHAIN[step] + id + '.jpg';
            else img.classList.add('is-missing');
        });
    }

    // ── 卡片效果浮层（与老站一致：名称 / 类型 / 属性种族等级 / 攻守 / 效果文本）──
    var _tipEl = null;
    function tipEl() {
        if (_tipEl) return _tipEl;
        _tipEl = document.createElement('div');
        _tipEl.className = 'nx-card-tip';
        document.body.appendChild(_tipEl);
        return _tipEl;
    }
    function showCardTip(ev, id) {
        var c = cardInfo(id);
        var tip = tipEl();
        if (!c) { tip.style.display = 'none'; return; }
        var isMonster = c.typeInfo && c.typeInfo.baseType === '怪兽';
        var score = _scoreMap && _scoreMap[id];
        var scoreLine = score
            ? '<div class="nct-score">' + (score.forbidden ? '禁用卡' : '分值 ' + score.score) + '</div>'
            : '';
        tip.innerHTML =
            '<div class="nct-name">' + esc(c.name || ('#' + id)) + '</div>' +
            '<div class="nct-type">' + esc((c.typeInfo && c.typeInfo.fullType) || '') + '</div>' +
            (isMonster
                ? '<div class="nct-meta">' + esc(c.attrName || '') + ' | ' + esc(c.raceName || '') +
                  (c.level ? ' | Lv' + c.level : '') + '</div>' +
                  '<div class="nct-stat">ATK ' + (c.atk < 0 ? '?' : c.atk) + ' / DEF ' + (c.def < 0 ? '?' : c.def) + '</div>'
                : '') +
            scoreLine +
            '<div class="nct-desc">' + (c.processedDesc || c.desc || '') + '</div>' +
            (c.author ? '<div class="nct-author">' + esc(c.author) + '</div>' : '');
        tip.style.display = 'block';
        positionCardTip(ev, tip);
    }
    function positionCardTip(ev, tip) {
        var pad = 14;
        var x = ev.clientX + pad, y = ev.clientY + 10;
        var w = tip.offsetWidth, h = tip.offsetHeight;
        if (x + w > window.innerWidth - 10) x = Math.max(8, ev.clientX - w - pad);
        if (y + h > window.innerHeight - 10) y = Math.max(8, window.innerHeight - h - 10);
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
    }
    function hideCardTip() { if (_tipEl) _tipEl.style.display = 'none'; }

    function loadCardMap() {
        if (_cardMap) return Promise.resolve(_cardMap);
        return fetch('/api/cards').then(function (r) { return r.json(); }).then(function (cards) {
            _cardMap = {};
            cards.forEach(function (c) { _cardMap[String(c.id)] = c; });
            return _cardMap;
        }).catch(function () { _cardMap = {}; return _cardMap; });
    }
    function cardName(id) {
        var c = _cardMap && _cardMap[String(id)];
        return (c && (c.name || c.cnName)) || ('#' + id);
    }

    function fmtTime(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso).slice(0, 16).replace('T', ' ');
        function p(n) { return (n < 10 ? '0' : '') + n; }
        return (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }

    // 测试数据模式下造点假的，方便看版式
    function mockDuels(name) {
        var out = [];
        for (var i = 0; i < 8; i++) {
            out.push({
                time: new Date(Date.now() - i * 3600e3 * 3).toISOString(),
                roomName: 'M#' + (1100 + i * 7),
                opponentName: ['灵蛇', '奈奈川', 'Huager', '莱蒂丝', '鲁多', '244英雄'][i % 6],
                replayCode: 'R#' + (4200 + i * 13),
                win: i % 3 !== 1, draw: false, ladder: true
            });
        }
        return { player: name, total: out.length, duels: out };
    }
    function mockDeck() {
        var main = [], extra = [], side = [];
        for (var i = 0; i < 40; i++) main.push(10000000 + i * 137);
        for (var j = 0; j < 15; j++) extra.push(20000000 + j * 311);
        for (var k = 0; k < 15; k++) side.push(30000000 + k * 173);
        return { total: 1, decks: [{ roomName: 'M#1100', time: new Date().toISOString(), winner: '测试', opponent: '对手', score: 2, deck: { main: main, extra: extra, side: side } }] };
    }

    // ── 选手详情：点击处收缩整屏 → 两个线圈选项 ──────────────
    var _povPlayer = null;
    var _povOrigin = { x: 0.5, y: 0.5 };
    var _povDuels = null;
    var zoEls = [document.getElementById('nxStage'), document.querySelector('.nx-top'), document.querySelector('.nx-foot')].filter(Boolean);

    function povEl() { return document.getElementById('nxPov'); }

    function closePlayerOverlay() {
        var el = povEl();
        if (!el || el.classList.contains('is-closing')) return;
        hideCardTip();
        clearTimeout(el._choicesTimer);
        el.classList.add('is-closing');                  // 线圈/内容整体收缩消失
        document.body.classList.remove('nx-zoomed');     // 同时舞台放大复原
        setTimeout(function () {
            el.remove();
            document.removeEventListener('keydown', povKey, true);
        }, 520);
    }

    function povBackToChoices() {
        var el = povEl();
        if (!el) return;
        if (!el.classList.contains('is-viewing') || el.classList.contains('is-returning')) return;
        playSfx('back');
        var v = document.getElementById('nxPovView');
        el.classList.add('is-returning');
        if (v) v.classList.add('is-leaving');            // 内容退场
        setTimeout(function () {
            if (v) { v.classList.remove('is-leaving'); v.hidden = true; v.innerHTML = ''; }
            el.classList.remove('is-viewing', 'is-viewing-done');   // 线圈恢复可见并回到布局
            var ch = el.querySelector('.nx-pov-choices');
            if (ch) {                                    // 重播线圈回归动画
                ch.classList.remove('is-back');
                void ch.offsetWidth;
                ch.classList.add('is-back');
            }
            setTimeout(function () {
                el.classList.remove('is-returning');
                if (ch) ch.classList.remove('is-back');
            }, 560);
        }, 260);
    }

    function povKey(ev) {
        if (ev.key !== 'Escape') return;
        ev.stopPropagation();
        ev.preventDefault();
        var el = povEl();
        if (el && el.classList.contains('is-viewing')) povBackToChoices();
        else closePlayerOverlay();
    }

    function openPlayerOverlay(p, origin) {
        closePlayerOverlay();
        _povPlayer = p;
        _povOrigin = origin || { x: 0.5, y: 0.5 };

        // 点击点在视口内的归一化位置（遮罩径向渐变中心）
        var vw = window.innerWidth || 1, vh = window.innerHeight || 1;
        var nx = Math.max(0, Math.min(1, _povOrigin.x / vw));
        var ny = Math.max(0, Math.min(1, _povOrigin.y / vh));
        // 收缩原点：点击点相对舞台的位置
        var st = stage ? stage.getBoundingClientRect() : null;
        for (var zi = 0; zi < zoEls.length; zi++) {
            var zr = zoEls[zi].getBoundingClientRect();
            zoEls[zi].style.setProperty('--zo-x', (_povOrigin.x - zr.left) + 'px');
            zoEls[zi].style.setProperty('--zo-y', (_povOrigin.y - zr.top) + 'px');
        }

        var el = document.createElement('div');
        el.className = 'nx-pov';
        el.id = 'nxPov';
        el.style.setProperty('--ox', (nx * 100).toFixed(1) + '%');
        el.style.setProperty('--oy', (ny * 100).toFixed(1) + '%');
        el.innerHTML =
            '<div class="nx-pov-dim"></div>' +
            '<div class="nx-pov-inner">' +
                '<div class="nx-pov-title"><b>' + esc(p.name) + '</b>' +
                    '<span>' + esc(p.tier || '') + (p.rating ? ' · ' + esc(p.rating) + ' 分' : '') + '</span></div>' +
                '<div class="nx-pov-choices">' +
                    '<button class="nx-option nx-pov-opt" type="button" data-view="duels" style="--i:0">' +
                        ringSvg(false) + '<span class="nx-opt-icon">' + iconSvg('list') + '</span>' +
                        '<span class="nx-opt-label">对局信息</span><span class="nx-opt-sub">最近对战记录</span></button>' +
                    '<button class="nx-option nx-pov-opt" type="button" data-view="deck" style="--i:1">' +
                        ringSvg(true) + '<span class="nx-opt-icon">' + iconSvg('box') + '</span>' +
                        '<span class="nx-opt-label">卡组信息</span><span class="nx-opt-sub">最近胜局卡组</span></button>' +
                '</div>' +
                '<div class="nx-pov-view" id="nxPovView" hidden></div>' +
            '</div>';
        document.body.appendChild(el);
        document.body.classList.add('nx-zoomed');
        document.addEventListener('keydown', povKey, true);
        playSfx('click');

        // 线圈按钮：接入现成的悬停收敛 + 形状动画
        var btns = el.querySelectorAll('.nx-pov-opt');
        for (var i = 0; i < btns.length; i++) {
            bindHoverRegular(btns[i]);
            var paths = btns[i].querySelectorAll('.nx-ring path');
            for (var k = 0; k < paths.length; k++) paths[k].setAttribute('data-blob-ready', '1');
            (function (b) {
                b.addEventListener('click', function () {
                    var v = b.getAttribute('data-view');
                    playSfx('click');
                    povShowView(v);
                });
            })(btns[i]);
        }
        collectBlobs();

        // 点空白：内容态 → 回到两个线圈；线圈态 → 关闭
        el.addEventListener('click', function (ev) {
            var t = ev.target;
            if (t && t.closest && t.closest('.nx-pov-opt, .nx-duel-replay')) return;   // 交互元素不响应
            if (el.classList.contains('is-viewing')) povBackToChoices();
            else closePlayerOverlay();
        });
    }

    // 展示某一项内容（线圈收起 → 内容淡入）
    function povShowView(kind) {
        var el = povEl();
        if (!el) return;
        var view = document.getElementById('nxPovView');
        el.classList.add('is-viewing');
        clearTimeout(el._choicesTimer);
        el._choicesTimer = setTimeout(function () { el.classList.add('is-viewing-done'); }, 340);
        if (view) {
            view.hidden = false;
            view.classList.toggle('is-duels', kind === 'duels');   // 对局列表收窄居中
            view.innerHTML = '<div class="nx-loading"><span class="nx-spin"></span>读取中…</div>';
        }

        var p = _povPlayer || {};
        if (kind === 'duels') {
            var duelsP = FX.mock ? Promise.resolve(mockDuels(p.name))
                : fetch(DUELS_API + '?player=' + encodeURIComponent(p.name) + '&limit=50').then(function (r) { return r.json(); });
            duelsP.then(function (data) {
                var box = document.getElementById('nxPovView');
                if (!box) return;
                var list = (data && data.duels) || [];
                if (!list.length) { box.innerHTML = '<div class="nx-empty">还没有对局记录</div>'; return; }
                box.innerHTML = list.map(function (d) {
                    var tag = d.draw ? '平' : (d.win ? '胜' : '负');
                    var cls = d.draw ? 'is-draw' : (d.win ? 'is-win' : 'is-lose');
                    return '<div class="nx-duel">' +
                        '<span class="nx-duel-tag ' + cls + '">' + tag + '</span>' +
                        '<span class="nx-duel-opp">' + esc(d.opponentName || '未知') + '</span>' +
                        '<span class="nx-duel-meta">' + esc(d.roomName || '') + '</span>' +
                        '<span class="nx-duel-time">' + fmtTime(d.time) + '</span>' +
                        (d.replayCode ? '<button class="nx-duel-replay" type="button" data-code="' + esc(d.replayCode) + '">' + esc(d.replayCode) + '</button>' : '') +
                    '</div>';
                }).join('');
                Array.prototype.forEach.call(box.querySelectorAll('.nx-duel-replay'), function (b) {
                    b.addEventListener('click', function () {
                        var code = b.getAttribute('data-code');
                        try { navigator.clipboard.writeText(code); } catch (e) { /* 忽略 */ }
                        var old = b.textContent;
                        b.textContent = '已复制';
                        setTimeout(function () { b.textContent = old; }, 1200);
                    });
                });
            }).catch(function () {
                var box = document.getElementById('nxPovView');
                if (box) box.innerHTML = '<div class="nx-empty">对战记录读取失败</div>';
            });
            return;
        }

        // 卡组信息
        var decksP = FX.mock ? Promise.resolve(mockDeck())
            : fetch(DECKS_API + '?player=' + encodeURIComponent(p.name) + '&limit=1').then(function (r) { return r.json(); });
        decksP.then(function (data) {
            var box = document.getElementById('nxPovView');
            if (!box) return;
            var d = (data && data.decks && data.decks[0]) || null;
            if (!d || !d.deck) { box.innerHTML = '<div class="nx-empty">还没有可用于展示的卡组</div>'; return; }
            return Promise.all([loadCardMap(), loadScoreMap()]).then(function () {
                // 与老站 sortCards 一致：按卡片 ID 升序（相同卡自然相邻）
                function sortCards(ids) { return (ids || []).slice().sort(function (a, b) { return a - b; }); }
                function group(title, rawIds) {
                    var ids = sortCards(rawIds);
                    if (!ids.length) return '';
                    return '<div class="nx-deck-group"><div class="nx-deck-group-title">' + title + ' <i>' + ids.length + '</i></div>' +
                        '<div class="nx-deck-cards">' + ids.map(function (id) {
                            var nm = cardName(id);
                            var sc = _scoreMap && _scoreMap[id];
                            var badge = sc
                                ? '<span class="nx-deck-score' + (sc.forbidden ? ' is-forbidden' : '') + '">' +
                                  (sc.forbidden ? '禁' : sc.score) + '</span>'
                                : '';
                            return '<div class="nx-deck-tile" data-id="' + id + '">' +
                                '<div class="nx-deck-photo">' +
                                    '<img class="nx-deck-img" src="' + PIC_CHAIN[0] + id + '.jpg" loading="lazy" alt="">' +
                                    badge +
                                '</div>' +
                                '<span class="nx-deck-name">' + esc(nm) + '</span>' +
                            '</div>';
                        }).join('') + '</div></div>';
                }
                // 卡组总分（与老站同算法：按张数累加每张卡的分值）
                function deckScore(dk) {
                    var sum = 0;
                    ['main', 'extra', 'side'].forEach(function (sec) {
                        (dk[sec] || []).forEach(function (cid) {
                            var s = _scoreMap && _scoreMap[cid];
                            if (s) sum += (s.score || 0);
                        });
                    });
                    return sum;
                }
                var total = deckScore(d.deck);
                box.innerHTML =
                    '<div class="nx-deck-info">' +
                        '<span class="nx-deck-info-item">总分 <b>' + total + '</b>/' + _scoreLimit + '</span>' +
                        (total > _scoreLimit ? '<span class="nx-deck-info-warn">超出上限</span>' : '') +
                        '<span class="nx-deck-info-item">主 <b>' + (d.deck.main || []).length + '</b></span>' +
                        '<span class="nx-deck-info-item">额外 <b>' + (d.deck.extra || []).length + '</b></span>' +
                        '<span class="nx-deck-info-item">副 <b>' + (d.deck.side || []).length + '</b></span>' +
                    '</div>' +
                    '<div class="nx-deck-meta">' + esc(d.roomName || '') + ' · ' + esc(d.winner || '') + ' vs ' + esc(d.opponent || '') +
                        ' · ' + fmtTime(d.time) + '</div>' +
                    '<div class="nx-deck-fit" id="nxDeckFit">' +
                        '<div class="nx-deck-cols">' +
                            '<div class="nx-deck-col-main">' + group('主卡组', d.deck.main) + '</div>' +
                            '<div class="nx-deck-col-side">' + group('额外卡组', d.deck.extra) + group('副卡组', d.deck.side) + '</div>' +
                        '</div>' +
                    '</div>';
                // 卡图逐级兜底（OCG → SuperPre → DIY，DIY 成功打角标）+ 悬停效果浮层
                Array.prototype.forEach.call(box.querySelectorAll('.nx-deck-tile'), function (tile) {
                    var id = tile.getAttribute('data-id');
                    var img = tile.querySelector('.nx-deck-img');
                    if (img) wireDeckImage(img, tile, id);
                    tile.addEventListener('mouseenter', function (ev) { showCardTip(ev, id); });
                    tile.addEventListener('mousemove', function (ev) { if (_tipEl && _tipEl.style.display === 'block') positionCardTip(ev, _tipEl); });
                    tile.addEventListener('mouseleave', hideCardTip);
                });
                // 一屏全显示：放不下就整体等比缩小（不出现内部滚动条）
                fitDeckScale(box);
                scheduleDeckFit(box);
                Array.prototype.forEach.call(box.querySelectorAll('.nx-deck-img'), function (img) {
                    img.addEventListener('load', function () { refitDeckSoon(box); });
                    img.addEventListener('error', function () { refitDeckSoon(box); });
                });
            });
        }).catch(function () {
            var box = document.getElementById('nxPovView');
            if (box) box.innerHTML = '<div class="nx-empty">卡组读取失败</div>';
        });
    }

    // 卡组卡图尽量大：在可用高度内选列数（列越少卡越大），复刻老站"列数动态调整"的思路
    function layoutDeckGrids(box) {
        var fit = document.getElementById('nxDeckFit');
        if (!fit) return;
        var mainCol = fit.querySelector('.nx-deck-col-main');
        var sideCol = fit.querySelector('.nx-deck-col-side');
        var RATIO = 61 / 42;          // 卡图高/宽（老站 42:61）
        var GAP = 2;

        // 可用高度：内容顶部到屏幕底部，扣掉标题与信息行
        var fitTop = fit.getBoundingClientRect().top;
        var chromeH = 0;
        Array.prototype.forEach.call(fit.querySelectorAll('.nx-deck-group'), function (g) {
            var t = g.querySelector('.nx-deck-group-title');
            if (t) chromeH += t.getBoundingClientRect().height + 4;
        });
        var availH = Math.max(120, window.innerHeight - fitTop - 16 - chromeH);

        function bestCols(count, colWidth, avail) {
            if (!count || colWidth <= 0) return 0;
            var NAME_H = 24;             // 卡名两行的高度，算进去才能让卡名也显示得下
            for (var cols = 4; cols <= 24; cols++) {
                var real = Math.min(cols, count);
                var rows = Math.ceil(count / real);
                var w = (colWidth - (real - 1) * GAP) / real;
                var total = rows * (w * RATIO + NAME_H) + (rows - 1) * GAP;
                if (total <= avail) return real;
            }
            return Math.min(24, count);
        }
        function apply(col, gridSel, count) {
            if (!col || !count) return;
            var grid = col.querySelector(gridSel);
            if (!grid) return;
            var n = bestCols(count, col.getBoundingClientRect().width, availH);
            if (n > 0) grid.style.gridTemplateColumns = 'repeat(' + n + ', minmax(0, 1fr))';
        }
        var mainCount = fit.querySelectorAll('.nx-deck-col-main .nx-deck-tile').length;
        var extraCount = fit.querySelectorAll('.nx-deck-col-side .nx-deck-group:nth-child(1) .nx-deck-tile').length;
        var sideCount = fit.querySelectorAll('.nx-deck-col-side .nx-deck-group:nth-child(2) .nx-deck-tile').length;
        apply(mainCol, '.nx-deck-cards', mainCount);
        // 右栏两组的可用高度各占一半
        var saveAvail = availH;
        availH = Math.max(100, (saveAvail - 14) / 2);
        apply(sideCol, '.nx-deck-group:nth-child(1) .nx-deck-cards', extraCount);
        apply(sideCol, '.nx-deck-group:nth-child(2) .nx-deck-cards', sideCount);
        availH = saveAvail;
    }

    // 卡组一屏全显示：transform 等比缩放（transform 不参与布局，故显式设定外层高度）+ 迭代收敛
    // 注意：本环境 style.zoom 写入后不改变布局，所以必须用 transform。
    function fitDeckScale(box) {
        var fit = document.getElementById('nxDeckFit');
        if (!fit) return;

        // ① 必须先复位（否则量到的是上一次缩放后的布局，列数会算错 → 底部溢出）
        fit.style.zoom = '';
        fit.style.transform = 'none';
        fit.style.transformOrigin = 'top center';
        box.style.height = '';
        box.style.overflow = '';
        fit.classList.remove('is-compact');

        function bottom() { return fit.getBoundingClientRect().bottom; }

        // ② 复位状态下按真实可用高度选列数（尽量不缩放）
        layoutDeckGrids(box);

        // ③ 还放不下：先牺牲卡名再选一次列数
        if (bottom() > window.innerHeight - 6) {
            fit.classList.add('is-compact');
            layoutDeckGrids(box);
        }

        // ④ 最后仍放不下才等比缩放
        var contentH = function () { return fit.scrollHeight || 1; };
        for (var i = 0; i < 5; i++) {
            if (bottom() <= window.innerHeight - 6) break;
            var top = fit.getBoundingClientRect().top;
            var need = contentH();
            var avail = window.innerHeight - top - 10;
            var k = avail / need;
            if (k > 1) k = 1;
            if (k < 0.2) k = 0.2;
            fit.style.transform = k < 0.999 ? 'scale(' + k.toFixed(4) + ')' : 'none';
            box.style.height = Math.ceil(need * (k < 0.999 ? k : 1)) + 'px';
            box.style.overflow = 'hidden';
        }
    }
    function refitDeckSoon(box) {
        if (!box) return;
        clearTimeout(box._fitTimer);
        box._fitTimer = setTimeout(function () { fitDeckScale(box); }, 260);
    }
    // 渲染后连续校正：布局/字体/图片会在不同时刻改变高度，多次重算才能收敛
    function scheduleDeckFit(box) {
        if (!box) return;
        (box._fitTimers || []).forEach(clearTimeout);
        box._fitTimers = [0, 80, 200, 400, 700, 1100, 1700].map(function (d) {
            return setTimeout(function () {
                if (document.body.contains(box)) fitDeckScale(box);
            }, d);
        });
    }
    window.addEventListener('resize', function () {
        var box = document.getElementById('nxPovView');
        if (box && box.querySelector('.nx-deck-fit')) fitDeckScale(box);
    });

    var RENDERERS = { ladder: renderLadder };

    // ── DOM ──
    var stage = document.getElementById('nxStage');
    var qEl = document.getElementById('nxQuestion');
    var optEl = document.getElementById('nxOptions');
    var resEl = document.getElementById('nxResult');
    var stepsEl = document.getElementById('nxSteps');
    var ctaEl = document.getElementById('nxCta');
    var verEl = document.getElementById('nxVersion');

    var historyStack = [];   // 走过的节点（用于返回）
    var busy = false;        // 转场锁
    var typeTimer = null;

    function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }
    // 允许 <b> / <code> 之类少量标签
    function rich(s) { return String(s); }

    // 打字机效果
    function typeText(el, text, done) {
        clearInterval(typeTimer);
        el.textContent = '';
        var caret = document.createElement('i');
        caret.className = 'nx-caret';
        el.appendChild(caret);
        var i = 0;
        typeTimer = setInterval(function () {
            i += 1;
            caret.remove();
            el.textContent = text.slice(0, i);
            el.appendChild(caret);
            if (i >= text.length) {
                clearInterval(typeTimer);
                setTimeout(function () { caret.remove(); }, 700);
                if (done) done();
            }
        }, 26);
    }

    // ── 自绘线条图标（无 emoji）：24×24、无填充、1.6px 描边、圆头 ──
    var ICONS = {
        cards:   '<rect x="3.5" y="6" width="9" height="13" rx="1.6" transform="rotate(-9 8 12.5)"/><rect x="11.5" y="5" width="9" height="13" rx="1.6" transform="rotate(9 16 11.5)"/>',
        layers:  '<path d="M12 3.2 20 7.6l-8 4.4-8-4.4z"/><path d="M4 11.6 12 16l8-4.4"/><path d="M4 15.8 12 20.2l8-4.4"/>',
        chart:   '<path d="M4 20h16"/><path d="M7.5 20V11"/><path d="M12 20V5.5"/><path d="M16.5 20v-6"/>',
        bolt:    '<path d="M13.2 3 5.5 13.2h4.6l-1 7.8L17.8 10.8h-4.9z"/>',
        house:   '<path d="M3.6 11.2 12 4.5l8.4 6.7"/><path d="M6 10.4V19.5h12V10.4"/><path d="M10 19.5v-5h4v5"/>',
        book:    '<path d="M12 6.5v12.8"/><path d="M4 5.2h5.4A2.6 2.6 0 0 1 12 7.8v11.5a2.6 2.6 0 0 0-2.6-2.6H4z"/><path d="M20 5.2h-5.4A2.6 2.6 0 0 0 12 7.8v11.5a2.6 2.6 0 0 1 2.6-2.6H20z"/>',
        build:   '<rect x="4" y="4" width="16" height="16" rx="3.4"/><path d="M12 8.6v6.8"/><path d="M8.6 12h6.8"/>',
        gauge:   '<path d="M4.2 17.4a8.4 8.4 0 1 1 15.6 0"/><path d="M12 17.2l4.4-4.8"/><circle cx="12" cy="17.6" r="1.1"/>',
        copy:    '<rect x="8.4" y="8.4" width="11.2" height="11.2" rx="2.2"/><path d="M15.6 8.4V6.2a2.2 2.2 0 0 0-2.2-2.2H6.2A2.2 2.2 0 0 0 4 6.2v7.2a2.2 2.2 0 0 0 2.2 2.2h2.2"/>',
        bracket: '<rect x="3.2" y="4" width="6" height="6" rx="1.4"/><rect x="3.2" y="14" width="6" height="6" rx="1.4"/><rect x="15" y="9" width="5.8" height="6" rx="1.4"/><path d="M9.2 7h3.4a2 2 0 0 1 2 2v3.4"/><path d="M9.2 17h3.4a2 2 0 0 0 2-2v-3.4"/>',
        play:    '<circle cx="12" cy="12" r="8.2"/><path d="M10.4 9.2 15.2 12l-4.8 2.8z"/>',
        undo:    '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.2 4.2v4.6h-4.6"/>',
        download:'<path d="M12 3.5v11"/><path d="M7.6 10.4 12 14.8l4.4-4.4"/><path d="M4.5 19.5h15"/>',
        list:    '<path d="M4 6.5h1.2M8 6.5h12"/><path d="M4 12h1.2M8 12h12"/><path d="M4 17.5h1.2M8 17.5h12"/>',
        box:     '<path d="M3.6 8.2 12 3.6l8.4 4.6v7.6L12 20.4l-8.4-4.6z"/><path d="M3.6 8.2 12 12.8l8.4-4.6"/><path d="M12 12.8v7.6"/>',
        star:    '<path d="M12 3.8l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.8z"/>',
        user:    '<circle cx="12" cy="8.4" r="3.6"/><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0"/>',
    };

    function iconSvg(name) {
        var body = ICONS[name] || ICONS.chart;
        return '<svg class="nx-icon" viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
    }

    // ── 边缘圈：4 个不规则闭合细线圈套叠，形状各异，各自旋转 ──
    // 用 Catmull-Rom 转三次贝塞尔，生成平滑但不规则的闭合曲线（非椭圆）
    function blobPath(radius, seed, points, wobble, pull, pullAngle) {
        var pullAmt = pull || 0;
        var pullDir = pullAngle || 0;
        var pts = [];
        for (var i = 0; i < points; i++) {
            var a = (i / points) * Math.PI * 2;
            // 拉拽：朝 pullDir 方向 +cos 拉伸，反向 -cos 收窄（像被橡皮筋拽住）
            var pullTerm = pullAmt * 0.62 * Math.cos(a - pullDir);   // 0.62 = 最大甩长比例（与 MAG.dragMax 一致）
            var k = 1
                + wobble * Math.sin(a * 3 + seed) * 0.62
                + wobble * Math.cos(a * 2 + seed * 1.7) * 0.34
                + wobble * Math.sin(a * 5 + seed * 2.3) * 0.16
                + pullTerm;
            if (k < 0.42) k = 0.42;      // 收窄侧不至于捏穿
            if (k > 1.75) k = 1.75;      // 拉长侧上限
            var rr = radius * k;
            pts.push([60 + Math.cos(a) * rr, 60 + Math.sin(a) * rr]);
        }
        var d = 'M' + pts[0][0].toFixed(2) + ',' + pts[0][1].toFixed(2);
        for (var k = 0; k < pts.length; k++) {
            var p0 = pts[(k - 1 + pts.length) % pts.length];
            var p1 = pts[k];
            var p2 = pts[(k + 1) % pts.length];
            var p3 = pts[(k + 2) % pts.length];
            var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
            var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
            d += ' C' + c1x.toFixed(2) + ',' + c1y.toFixed(2)
                + ' ' + c2x.toFixed(2) + ',' + c2y.toFixed(2)
                + ' ' + p2[0].toFixed(2) + ',' + p2[1].toFixed(2);
        }
        return d + 'Z';
    }

    // 4 层：半径递减，抖动种子/幅度/旋转速度各不相同
    var RING_LAYERS = [
        { cls: 'nxb1', r: 51, seed: 0.7, pts: 10, wob: 0.055, msp: 0.50, mph: 0.0, fast: 1 },
        { cls: 'nxb2', r: 49, seed: 2.1, pts: 12, wob: 0.072, msp: -0.66, mph: 1.7, fast: 0 },
        { cls: 'nxb3', r: 47, seed: 3.9, pts: 11, wob: 0.088, msp: 0.84, mph: 3.1, fast: 1 },
        { cls: 'nxb4', r: 45, seed: 5.4, pts: 13, wob: 0.104, msp: -1.02, mph: 4.6, fast: 0 }
    ];

    function ringSvg(gold) {
        var cls = 'nx-ring' + (gold ? ' nx-ring-gold' : '');
        var inner = RING_LAYERS.map(function (L) {
            return '<g class="nx-rot">'
                + '<path class="' + L.cls + '" d="' + blobPath(L.r, L.seed, L.pts, L.wob) + '"'
                + ' data-r="' + L.r + '" data-seed="' + L.seed + '" data-pts="' + L.pts + '"'
                + ' data-wob="' + L.wob + '" data-msp="' + L.msp + '" data-mph="' + L.mph + '" data-fast="' + (L.fast ? 1 : 0) + '"></path>'
                + '</g>';
        }).join('');
        return '<svg class="' + cls + '" viewBox="0 0 120 120" aria-hidden="true">' + inner + '</svg>';
    }


    // ── 活体变形：形状持续改变（抖动相位缓慢游走 + 抖动幅度起伏呼吸） ──
    var _blobs = [];
    var _blobLast = 0;
    var _tickLast = 0;   // 上一帧时间戳（算 dt）
    var _pullTickId = 0; // 帧号（用于每帧只算一次拉拽）
    var _stageRect = null;   // 舞台矩形缓存（resize/渲染后失效）
    var _breathT = 0;    // 呼吸相位累加器（只按运行时间增长）


    // ── 磁吸跟随 + 相互规避 ──────────────────────────────────
    // 按钮被光标"黏住"：靠近时轻微跟手，光标移远（超过 release 距离）才脱离；
    // 按钮之间保持最小间距，互相推开避免重叠。位移用 translate 属性，不影响 transform。
    var MAG = { stick: 150, attract: 0.6, flat: 0.55, maxPull: 38, springK: 70, springC: 24, gap: 14, repK: 0.5,
                dragR: 170,      // 指针扫过时的作用半径（约 1.5 倍圆半径，只在靠近图标时触发）
                speedRef: 300,   // 按钮自身移动速度(px/s)达到此值即满强度
                ptrSpeedRef: 700,// 指针扫过速度的满强度阈值
                dragMax: 0.62,   // 最大甩长比例（沿运动方向拉长）
                dragDecay: 0.94, // 指针停下后的速度衰减（越大拖尾越久）
                velEase: 0.35,   // 指针速度平滑
                dragEase: 0.10 };// 形变自身的缓动（产生拖尾滞后）
    var _magBtns = [];
    var _magPx = null, _magPy = null;
    var _magLast = 0;
    var _magVx = 0, _magVy = 0;              // 平滑后的指针速度 px/s
    var _magSample = null;                   // 待处理的指针采样
    var _magPrevPx = null, _magPrevPy = null, _magPrevT = 0;

    function bindMagnet(btn) {
        btn._mx = 0; btn._my = 0;
        btn._vx = 0; btn._vy = 0;
        btn._rx = 0; btn._ry = 0;
        btn._tx = 0; btn._ty = 0;
        btn._ringGroups = Array.prototype.slice.call(btn.querySelectorAll('.nx-ring .nx-rot'));
        if (_magBtns.indexOf(btn) === -1) _magBtns.push(btn);
    }

    function resetMagnet() { _magBtns = []; }

    function magTick(now) {
        requestAnimationFrame(magTick);
        if (!_magBtns.length) return;
        if (document.hidden) { _magLast = 0; return; }
        if (!_magLast) _magLast = now;
        var dt = Math.min(0.05, (now - _magLast) / 1000);
        _magLast = now;
        // 指针速度：有采样就更新（EMA 平滑），一段时间没动就衰减到 0
        if (_magSample) {
            var st2 = _magSample; _magSample = null;
            if (_magPrevPx !== null) {
                var vdt = Math.max(0.008, (st2.t - _magPrevT) / 1000);
                var ivx = (st2.x - _magPrevPx) / vdt, ivy = (st2.y - _magPrevPy) / vdt;
                var ve = MAG.velEase;
                _magVx += (ivx - _magVx) * ve;
                _magVy += (ivy - _magVy) * ve;
            }
            _magPrevPx = st2.x; _magPrevPy = st2.y; _magPrevT = st2.t;
        } else if (now - _magPrevT > 90) {
            _magVx *= MAG.dragDecay; _magVy *= MAG.dragDecay;   // 指针停下后的衰减（拖尾）
            if (Math.abs(_magVx) < 2) _magVx = 0;
            if (Math.abs(_magVy) < 2) _magVy = 0;
        }

        // 空闲跳过：指针已静止且所有按钮都归位时，直接不干活（省电、避免无谓掉帧）
        var idle = (_magPx === null || now - _magPrevT > 400) && _magVx === 0 && _magVy === 0;
        if (idle) {
            var moving = false;
            for (var ii = 0; ii < _magBtns.length; ii++) {
                var bb = _magBtns[ii];
                if (Math.abs(bb._mx || 0) > 0.05 || Math.abs(bb._my || 0) > 0.05 ||
                    Math.abs(bb._dux || 0) > 0.005 || Math.abs(bb._duy || 0) > 0.005) { moving = true; break; }
            }
            if (!moving) return;
        }

        if (!_stageRect) _stageRect = stage.getBoundingClientRect();
        var stageRect = _stageRect;

        // 1) 目标偏移：磁吸（带滞回，靠近才吸、走远才松）
        for (var i = 0; i < _magBtns.length; i++) {
            var b = _magBtns[i];
            b._rx = 0; b._ry = 0;
            if (!b.parentNode) { b._tx = 0; b._ty = 0; continue; }
            // 关键：用「原位中心」而不是含偏移的当前中心，避免力←→位置的自反馈振荡
            var cx = stageRect.left + b.offsetLeft + b.offsetWidth / 2;
            var cy = stageRect.top + b.offsetTop + b.offsetHeight / 2;
            var tx = 0, ty = 0;
            var d = 1e9;
            if (_magPx !== null) {
                var dx = _magPx - cx, dy = _magPy - cy;
                d = Math.sqrt(dx * dx + dy * dy);
                // 连续力（无进出阈值开关）：内圈满力，到 stick 半径处平滑归零
                var t = d / MAG.stick;                 // 0=圆心, 1=作用边界
                if (t < 1) {
                    var s = 1;
                    if (t > MAG.flat) {                // 超过 flat 比例后平滑衰减到 0
                        var u = (t - MAG.flat) / (1 - MAG.flat);
                        s = 1 - u * u * (3 - 2 * u);
                    }
                    var k = MAG.attract * s;
                    tx = dx * k; ty = dy * k;
                    var m = Math.sqrt(tx * tx + ty * ty);
                    if (m > MAG.maxPull) { tx = tx / m * MAG.maxPull; ty = ty / m * MAG.maxPull; }
                }
            }
            if (!FX.magnet) { tx = 0; ty = 0; }        // 调试开关：关闭磁吸
            b._tx = tx; b._ty = ty;
            b._near = _magPx !== null && d < MAG.dragR;
        }

        // 2) 相互规避：两两检查，重叠就沿连线推开
        for (var a = 0; a < _magBtns.length; a++) {
            for (var c = a + 1; c < _magBtns.length; c++) {
                var A = _magBtns[a], B = _magBtns[c];
                if (!A.parentNode || !B.parentNode) continue;
                var ax = stageRect.left + A.offsetLeft + A.offsetWidth / 2 + A._mx + A._tx;
                var ay = stageRect.top + A.offsetTop + A.offsetHeight / 2 + A._my + A._ty;
                var bx = stageRect.left + B.offsetLeft + B.offsetWidth / 2 + B._mx + B._tx;
                var by = stageRect.top + B.offsetTop + B.offsetHeight / 2 + B._my + B._ty;
                var ux = bx - ax, uy = by - ay;
                var dd = Math.sqrt(ux * ux + uy * uy) || 0.001;
                var minD = (A.offsetWidth + B.offsetWidth) / 2 + MAG.gap;
                if (dd < minD) {
                    var push = (minD - dd) * MAG.repK;
                    var nx = ux / dd, ny = uy / dd;
                    A._rx -= nx * push; A._ry -= ny * push;
                    B._rx += nx * push; B._ry += ny * push;
                }
            }
        }

        // 3) 平滑趋近目标 + 写回位移
        for (var q = 0; q < _magBtns.length; q++) {
            var o = _magBtns[q];
            if (!o.parentNode) continue;
            var goalX = o._tx + o._rx, goalY = o._ty + o._ry;
            // 临界阻尼弹簧：a = K*(目标-位置) - C*速度（比一阶趋近更顺，且不会在阈值附近抖）
            o._vx = (o._vx || 0) + (MAG.springK * (goalX - o._mx) - MAG.springC * (o._vx || 0)) * dt;
            o._vy = (o._vy || 0) + (MAG.springK * (goalY - o._my) - MAG.springC * (o._vy || 0)) * dt;
            o._mx += o._vx * dt;
            o._my += o._vy * dt;
            // 静止判定：位置与速度都极小就归零，避免长期微抖
            if (Math.abs(o._mx) < 0.05 && Math.abs(goalX) < 0.05 && Math.abs(o._vx) < 1) { o._mx = 0; o._vx = 0; }
            if (Math.abs(o._my) < 0.05 && Math.abs(goalY) < 0.05 && Math.abs(o._vy) < 1) { o._my = 0; o._vy = 0; }
            o.style.translate = o._mx.toFixed(2) + 'px ' + o._my.toFixed(2) + 'px';
        }
    }

    // 指针追踪（仅鼠标/笔；触屏不做磁吸）
    document.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        _magPx = e.clientX; _magPy = e.clientY;
        _magSample = { x: e.clientX, y: e.clientY, t: (e.timeStamp || performance.now()) };
    }, { passive: true });
    document.addEventListener('mouseleave', function () { _magPx = null; _magPy = null; });
    window.addEventListener('blur', function () { _magPx = null; _magPy = null; });
    requestAnimationFrame(magTick);          // 启动磁吸/拉拽循环（仅一次）

    // 尺寸变化时重算问句上移量（只注册一次）
    var _liftTimer = 0;
    window.addEventListener('resize', function () {
        clearTimeout(_liftTimer);
        _stageRect = null;
        _liftTimer = setTimeout(layoutQuestionLift, 120);
    });
    function collectBlobs() {
        _blobs = Array.prototype.slice.call(document.querySelectorAll('.nx-ring path[data-blob-ready]'));
    }

    function blobTick(now) {
        requestAnimationFrame(blobTick);
        var animOff = document.documentElement.classList.contains('nx-anim-off');
        if (animOff || document.hidden) { _blobLast = now; return; }   // 关动效/后台标签页时不做计算
        // 不再用全局闸门：每条路径按自己的刷新节奏（交互中的按钮更密）
        _blobLast = now;
        // 逐帧时间差：单帧最大 100ms（切后台/隐藏回来不会一次性补算）
        if (!_tickLast) _tickLast = now;
        var dt = Math.min(0.1, (now - _tickLast) / 1000);
        _tickLast = now;
        _breathT += dt;
        var _pullTick = ++_pullTickId;                 // 每帧只算一次拉拽向量

        for (var i = 0; i < _blobs.length; i++) {
            var p = _blobs[i];
            if (!p.parentNode) continue;                               // 已被重绘移除
            var r = parseFloat(p.getAttribute('data-r'));
            var pts = parseInt(p.getAttribute('data-pts'), 10);
            var wob = parseFloat(p.getAttribute('data-wob'));
            var msp = parseFloat(p.getAttribute('data-msp')) || 0;
            var mph = parseFloat(p.getAttribute('data-mph')) || 0;
            // 悬停时"规整度"→1（线条收敛为正圆），移开后→0（回到呼吸扭曲），用指数插值过渡
            var owner = p._nxBtn;
            // 每层每帧都重算（不做节流/缓存）
            var reg = 0;
            if (owner) {
                // 拉拽：按钮被拖动/指针扫过 → 沿运动方向甩长（路径方案，实测比 SVG transform 快）
                var pull = 0, pullAng = 0;
                if (owner._pullStamp !== _pullTick) {
                    owner._pullStamp = _pullTick;
                    var tgDx = 0, tgDy = 0;
                    // 用元素自身的实际矩形中心（含磁吸位移与缩放），避免舞台偏移量在固定层里算错
                    var orect = owner.getBoundingClientRect();
                    var ocx = orect.left + orect.width / 2;
                    var ocy = orect.top + orect.height / 2;
                    // 驱动 1：按钮自身移动速度
                    if (owner._pcx !== undefined) {
                        var odt = Math.max(0.008, dt);
                        var ovx = (ocx - owner._pcx) / odt, ovy = (ocy - owner._pcy) / odt;
                        owner._ovx = (owner._ovx || 0) + (ovx - (owner._ovx || 0)) * 0.18;
                        owner._ovy = (owner._ovy || 0) + (ovy - (owner._ovy || 0)) * 0.18;
                        var ospd = Math.sqrt(owner._ovx * owner._ovx + owner._ovy * owner._ovy);
                        if (ospd > 3) {
                            var osf = Math.min(1, ospd / MAG.speedRef);
                            tgDx = (owner._ovx / ospd) * osf;
                            tgDy = (owner._ovy / ospd) * osf;
                        }
                    }
                    owner._pcx = ocx; owner._pcy = ocy;
                    // 驱动 2：指针快速扫过
                    var vsp = Math.sqrt(_magVx * _magVx + _magVy * _magVy);
                    if (vsp > 12) {
                        var pd3 = Math.sqrt((_magPx - ocx) * (_magPx - ocx) + (_magPy - ocy) * (_magPy - ocy)) || 1;
                        // 圆内(≤半径)满力，圆外到 dragR 平滑归零 → 靠近才明显、远处完全无感
                        var innerR = owner.offsetWidth / 2;
                        var prox3 = pd3 <= innerR ? 1
                            : Math.max(0, 1 - (pd3 - innerR) / Math.max(1, MAG.dragR - innerR));
                        var pamt3 = prox3 * Math.min(1, vsp / MAG.ptrSpeedRef);
                        if (pamt3 > Math.sqrt(tgDx * tgDx + tgDy * tgDy)) {
                            tgDx = (_magVx / vsp) * pamt3;
                            tgDy = (_magVy / vsp) * pamt3;
                        }
                    }
                    if (!FX.drag) { tgDx = 0; tgDy = 0; }   // 调试开关：关闭拉拽
                    owner._dux = (owner._dux || 0) + (tgDx - (owner._dux || 0)) * MAG.dragEase;
                    owner._duy = (owner._duy || 0) + (tgDy - (owner._duy || 0)) * MAG.dragEase;
                }
                var pmag = Math.sqrt((owner._dux || 0) * (owner._dux || 0) + (owner._duy || 0) * (owner._duy || 0));
                if (pmag > 0.001) { pull = Math.min(1, pmag); pullAng = Math.atan2(owner._duy || 0, owner._dux || 0); }
                if (owner._nxReg === undefined) owner._nxReg = 0;
                if (owner._nxRegTarget === undefined) owner._nxRegTarget = 0;
                owner._nxReg += (owner._nxRegTarget - owner._nxReg) * 0.085;

                if (Math.abs(owner._nxRegTarget - owner._nxReg) < 0.002) owner._nxReg = owner._nxRegTarget;
                reg = owner._nxReg;
            }
            // 相位逐帧累加（关键：不用绝对时间，避免暂停后恢复时“补算”导致突然飞快）
            if (p._nxPhase === undefined) p._nxPhase = mph;
            if (FX.wobble) p._nxPhase += msp * (1 - reg * 0.85) * dt;   // 调试开关：关闭扭曲时相位不动
            // 抖动幅度呼吸 + 按规整度收敛为正圆（只变圆，不回到初始形状）
            var amp = (FX.wobble ? (0.62 + 0.5 * Math.sin(_breathT * 0.5 + mph * 1.3)) : 0.8) * wob * (1 - reg);
            p.setAttribute('d', blobPath(r, p._nxPhase, pts, amp, pull, pullAng));
        }
    }


    // 悬停：线条收敛为正圆（_nxRegTarget=1），移开回到呼吸扭曲（=0）
    function bindHoverRegular(btn) {
        btn._nxReg = 0;
        btn._nxRegTarget = 0;
        btn._nxOwner = btn;
        var paths = btn.querySelectorAll('.nx-ring path');
        for (var i = 0; i < paths.length; i++) paths[i]._nxBtn = btn;
        btn.addEventListener('pointerenter', function () { btn._nxRegTarget = 1; });
        btn.addEventListener('pointerleave', function () { btn._nxRegTarget = 0; });
        btn.addEventListener('focus', function () { btn._nxRegTarget = 1; });
        btn.addEventListener('blur', function () { btn._nxRegTarget = 0; });
    }

    // ── 临时调试开关：磁吸 / 拉拽 / 扭曲 ──
    // 三项效果默认全开；此前"抽搐"的真因是磁吸自激振荡 + 拉拽作用范围过大(已修)，与扭曲无关
    var FX = { magnet: true, drag: true, wobble: true, mock: false };
    (function initFxPanel() {
        var KEY = 'siro_next_fx';
        try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (saved) for (var k in FX) if (typeof saved[k] === 'boolean') FX[k] = saved[k];
        } catch (e) { /* 忽略 */ }
        var panel = document.getElementById('nxDebug');
        if (!panel) return;
        function sync() {
            var btns = panel.querySelectorAll('.nx-dbg-btn');
            for (var i = 0; i < btns.length; i++) {
                var key = btns[i].getAttribute('data-fx');
                var on = key === 'sfx' ? SFX.on : !!FX[key];
                btns[i].classList.toggle('is-on', on);
            }
            try { localStorage.setItem(KEY, JSON.stringify(FX)); } catch (e) { /* 忽略 */ }
        }
        panel.addEventListener('click', function (ev) {
            var b = ev.target.closest ? ev.target.closest('.nx-dbg-btn') : null;
            if (!b) return;
            var key = b.getAttribute('data-fx');
            if (key === 'mock') {                      // 测试数据开关
                FX.mock = !FX.mock;
                b.classList.toggle('is-on', FX.mock);
                var bodyEl = document.getElementById('nxScreenBody');
                var curScreen = historyStack[historyStack.length - 1];
                if (bodyEl && curScreen && curScreen.screen) renderScreen(curScreen.screen);
                return;
            }
            if (key === 'sfx') {                       // 音效开关（单独存）
                SFX.on = !SFX.on;
                try { localStorage.setItem('siro_next_sfx', SFX.on ? '1' : '0'); } catch (e) { /* 忽略 */ }
                b.classList.toggle('is-on', SFX.on);
                if (SFX.on) playSfx('click');
                return;
            }
            FX[key] = !FX[key];
            sync();
        });
        sync();
    })();

    // 标记可变形路径并启动循环（渲染后调用）
    function startBlobMorph() {
        resetMagnet();
        var btns = document.querySelectorAll('.nx-option, .nx-cta');
        for (var bi = 0; bi < btns.length; bi++) bindMagnet(btns[bi]);
        var list = document.querySelectorAll('.nx-ring path');
        for (var i = 0; i < list.length; i++) list[i].setAttribute('data-blob-ready', '1');
        collectBlobs();
        _stageRect = null;   // 布局可能变化，缓存失效
    }

    requestAnimationFrame(blobTick);         // 启动形状循环（仅一次）

    function ripple(btn, ev) {
        var r = btn.getBoundingClientRect();
        var s = document.createElement('span');
        s.className = 'nx-ripple';
        var size = Math.max(r.width, r.height);
        s.style.width = s.style.height = size + 'px';
        var x = (ev && ev.clientX ? ev.clientX - r.left : r.width / 2);
        var y = (ev && ev.clientY ? ev.clientY - r.top : r.height / 2);
        s.style.left = x + 'px';
        s.style.top = y + 'px';
        btn.appendChild(s);
        setTimeout(function () { s.remove(); }, 620);
    }

    // 转场包装
    function transition(fn) {
        if (busy) return;
        busy = true;
        stage.classList.add('nx-leaving');
        setTimeout(function () {
            fn();
            stage.classList.remove('nx-leaving');
            stage.classList.add('nx-entering');
            setTimeout(function () { stage.classList.remove('nx-entering'); busy = false; }, 340);
        }, 200);
    }

    // 问句上移：把「问句到舞台顶部」的间距减半（响应式，随窗口变化重算）
    function layoutQuestionLift() {
        var stage = document.getElementById('nxStage');
        if (!qEl || !stage) return;
        qEl.style.setProperty('--q-lift', '0px');       // 归零后量原始位置
        var qr = qEl.getBoundingClientRect();
        var sr = stage.getBoundingClientRect();
        var gap = qr.top - sr.top;
        var lift = Math.max(0, Math.round(gap / 2));
        qEl.style.setProperty('--q-lift', lift + 'px');
        return lift;
    }

    // 渲染当前节点（按类型自动分流：选项节点 / 结果节点）
    function renderCurrent() {
        var top = historyStack[historyStack.length - 1];
        if (!top) return;
        if (!screenEl) screenEl = document.getElementById('nxScreen');
        // 屏幕节点：隐藏问答区，显示功能屏
        if (top.screen) {
            stage.classList.add('is-screen');
            renderScreen(top.screen);
            return;
        }
        stage.classList.remove('is-screen');
        if (screenEl) screenEl.hidden = true;
        var node = FLOW[top.key];
        if (!node) return;
        if (node.options) renderNode(node, top.key, _deferOptions);
        else renderResult(node, top.label);
        layoutQuestionLift();
    }

    function goTo(key, label) {
        transition(function () {
            var node = FLOW[key];
            if (!node) return;
            historyStack.push({ key: key, label: label || node.q });
            renderCurrent();
        });
    }

    function goBack() {
        if (historyStack.length <= 1 || busy) return;
        transition(function () {
            historyStack.pop();
            renderCurrent();
        });
    }

    // 点击空白区域返回上一步（点到按钮/链接/滑块等交互元素时不触发）
    document.addEventListener('click', function (ev) {
        if (busy) return;
        if (document.body.classList.contains('nx-boot')) return;   // 开场期间不响应
        if (historyStack.length <= 1) return;                      // 没有上一步
        // 功能屏同样支持点空白返回（已无返回按钮）
        var t = ev.target;
        if (t && t.closest && t.closest('button, a, input, select, textarea, label, .nx-option, .nx-cta, .nx-dbg-btn, .nx-version, .nx-debug')) return;
        playSfx('back');
        goBack();
    });
    document.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Escape') return;
        if (document.body.classList.contains('nx-boot')) return;
        if (ev.target && ev.target.closest && ev.target.closest('input, textarea, select')) return;
        playSfx('back');
        goBack();
    });

    var _deferOptions = false;   // 开场期间：等打字机打完再出按钮
    var _afterTyped = null;      // 打字完成后的自定义收尾（开场：先滑回常态位再出按钮）

    function buildOptions(node) {
        optEl.hidden = false;
        optEl.classList.toggle('is-grid', node.layout === 'grid');
        optEl.innerHTML = '';
        (node.options || []).forEach(function (opt, i) {
            var b = document.createElement('button');
            b.className = 'nx-option';
            b.style.setProperty('--i', i);
            b.innerHTML = ringSvg(false)
                + '<span class="nx-opt-icon">' + iconSvg(opt.icon) + '</span>'
                + '<span class="nx-opt-label">' + esc(opt.label) + '</span>'
                + (opt.sub ? '<span class="nx-opt-sub">' + esc(opt.sub) + '</span>' : '');
            b.addEventListener('click', function (ev) {
                ripple(b, ev);
                playSfx('click');
                setTimeout(function () { goTo(opt.next, opt.label); }, 120);
            });
            bindHoverRegular(b);
            optEl.appendChild(b);
        });
        startBlobMorph();
    }

    function renderNode(node, key, deferOptions) {
        resEl.hidden = true;
        stepsEl.innerHTML = '';
        ctaEl.innerHTML = '';
        if (deferOptions) {
            // 关键：按钮先进入布局（保证问句的"最终位置"已确定），仅用类隐藏外观，
            // 这样量出的 --q-dy 才是真正的滑动距离，避免之后布局跳变
            document.body.classList.add('nx-await-opts');
            buildOptions(node);
            typeText(qEl, node.q, function () {
                if (_afterTyped) { var cb = _afterTyped; _afterTyped = null; cb(); }
            });
        } else {
            typeText(qEl, node.q);
            buildOptions(node);
        }
    }

    function renderResult(node, label) {
        optEl.hidden = true;
        optEl.innerHTML = '';

        typeText(qEl, node.q);

        resEl.hidden = false;
        stepsEl.innerHTML = '';
        (node.steps || []).forEach(function (text, i) {
            var row = document.createElement('div');
            row.className = 'nx-step-row';
            row.style.setProperty('--i', i);
            row.innerHTML = '<span class="nx-step-no">' + (i + 1) + '</span>'
                + '<span class="nx-step-text">' + rich(text) + '</span>';
            stepsEl.appendChild(row);
        });

        ctaEl.innerHTML = '';
        ctaEl.classList.toggle('nx-tri', (node.cta || []).length === 3);
        (node.cta || []).forEach(function (c, i) {
            var b = document.createElement('button');
            b.className = 'nx-cta' + (c.back ? ' nx-cta-ghost' : '');
            b.style.setProperty('--i', i);
            b.innerHTML = ringSvg(!c.back)
                + '<span class="nx-cta-icon">' + iconSvg(c.icon) + '</span><span>' + esc(c.label) + '</span>';
            b.addEventListener('click', function (ev) {
                ripple(b, ev);
                playSfx(c.back ? 'back' : 'click');
                if (c.back) { setTimeout(goBack, 140); return; }
                // 新屏优先：不再把人送进旧页面
                if (c.screen) { setTimeout(function () { goScreen(c.screen); }, 140); return; }
                if (c.goto) {
                    b.querySelector('span:last-child').textContent = '跳转中…';
                    setTimeout(function () { location.href = CTA_GOTO(c.goto); }, 260);
                }
            });
            bindHoverRegular(b);
            ctaEl.appendChild(b);
        });
        startBlobMorph();
    }

    // 统一入口：写入根节点后渲染
    function renderAny(key, deferOptions) {
        if (!FLOW[key]) return;
        _deferOptions = !!deferOptions;
        historyStack = [{ key: key, label: '开始' }];
        renderCurrent();
        _deferOptions = false;
    }

    // ── 新旧版切换滑块 ──
    verEl.querySelectorAll('.nx-version-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var v = btn.getAttribute('data-v');
            verEl.dataset.v = v;
            verEl.querySelectorAll('.nx-version-btn').forEach(function (b) {
                b.classList.toggle('is-active', b === btn);
            });
            try { localStorage.setItem('siro_ui_version', v); } catch (e) { /* 忽略 */ }
            if (v === 'classic') {
                // 稍等一下让滑块动画走完，再切到经典版
                setTimeout(function () { location.href = CLASSIC; }, 320);
            }
        });
    });
    // 记忆上次选择：如果上次选了经典版，这次直接问一句（不强制跳）
    try {
        if (localStorage.getItem('siro_ui_version') === 'classic') {
            verEl.dataset.v = 'new';
            verEl.querySelectorAll('.nx-version-btn').forEach(function (b) {
                b.classList.toggle('is-active', b.getAttribute('data-v') === 'new');
            });
        }
    } catch (e) { /* 忽略 */ }

    // 初始渲染
    // ── 开场序列 ──────────────────────────────────────────────
    // 黑屏 → 欢迎大字(缓入缓出) → Sirokami 逐字散开 → 黑幕渐隐
    //   + 问句在「原 Sirokami 位置」打字 → 滑回常态位置 → 按钮出现
    (function boot() {
        var body = document.body;
        var animOff = document.documentElement.classList.contains('nx-anim-off');
        function finishNow(skip) {
            if (skip) body.classList.add('nx-skip');
            body.classList.remove('nx-boot', 'nx-bg-in', 'nx-question-in', 'nx-q-center');
            renderAny('root');
        }
        if (animOff) { finishNow(); return; }   // 关动效时直接进最终状态

        // 量出「屏幕正中」与「问句常态位置」的垂直差，供问句从中心滑回
        function measureDelta() {
            var q = document.getElementById('nxQuestion');
            if (!q) return;
            var r = q.getBoundingClientRect();
            var dy = Math.round(window.innerHeight / 2 - (r.top + r.height / 2));
            body.style.setProperty('--q-dy', dy + 'px');
        }

        var timers = [];
        function clearTimers() { timers.forEach(clearTimeout); timers = []; }

        // 阶段 3（2.6s）：黑幕渐隐 + 问句出现在屏幕正中并开始打字
        timers.push(setTimeout(function () {
            body.classList.add('nx-bg-in', 'nx-question-in', 'nx-q-jump', 'nx-q-center', 'nx-await-opts');
            body.classList.remove('nx-boot');
            // 就位这一帧不要位移过渡（否则会先出现在上方再滑到中央）；两帧后恢复过渡
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { body.classList.remove('nx-q-jump'); });
            });
            // 先渲染（按钮已进入布局但被隐藏），随后量出「中心 → 常态位」的真实差值
            renderAny('root', true);
            layoutQuestionLift();   // 先应用上移，再量「中心 → 常态位」的距离
            measureDelta();
            // 打字完成后：中央停留 → 滑回常态位置 → 放出按钮
            _afterTyped = function () {
                setTimeout(function () {
                    body.classList.remove('nx-q-center');
                    setTimeout(function () { body.classList.remove('nx-await-opts'); }, 700);
                }, 620);
            };
        }, 2600));

        // 任意点击/按键：跳过开场
        function skip() {
            if (!body.classList.contains('nx-boot')) return;
            clearTimers();
            finishNow(true);
            document.removeEventListener('pointerdown', skip, true);
            document.removeEventListener('keydown', skip, true);
        }
        document.addEventListener('pointerdown', skip, true);
        document.addEventListener('keydown', skip, true);
    })();

})();
