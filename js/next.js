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
                { icon: 'build', label: '组卡', sub: '自己搭一套', next: 'r_builder' },
                { icon: 'box', label: '预组', sub: '现成卡组', next: 'r_preset' },
                { icon: 'star', label: '常用卡', sub: '高分 / 泛用', next: 'r_popular' }
            ]
        },
        r_builder: {
            q: '自己组卡',
            steps: [
                '左边搜卡、右边成组，<b>点卡片</b>直接加入，点组内卡片上的 <b>✕</b> 移除',
                '融合 / 同调 / 超量 / 连接 会自动归到<b>额外卡组</b>，其余进主卡组',
                '顶部实时显示<b>主 / 额外 / 副</b>张数与<b>总分</b>（不超过上限），禁用卡不能加入',
                '组好后可 <b>下载 YDK</b>，直接放进客户端的 deck 目录'
            ],
            cta: [
                { icon: 'build', label: '开始组卡', screen: 'builder' },
                { icon: 'box', label: '看预组', screen: 'preset' }
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
                { icon: 'bracket', label: '打开历届八强', screen: 'eight' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },
        r_popular: {
            q: '常用高分卡',
            steps: [
                '天梯统计出的<b>使用率榜 / 胜率榜</b>，以及按用途分好的<b>常用卡分组</b>',
                '组卡器里点<b>「查询高分卡」</b>，会高亮卡组内 8 分及以上的卡'
            ],
            cta: [
                { icon: 'chart', label: '打开常用卡', screen: 'popular' },
                { icon: 'layers', label: '打开卡池', goto: 'pool' }
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
        room:     { title: '房间与规则', sub: '房间密码规则代码',           goto: 'room',      render: 'room' },
        download: { title: '下载与安装', sub: 'MDPro3 客户端 · DIY 卡包',   goto: 'download',  render: 'download' },
        match:    { title: '比赛相关',   sub: '瑞士轮积分 · 淘汰赛对阵',   goto: 'tournament', render: 'match' },
        pool:     { title: '卡池',       sub: '全卡检索 · 类型筛选 · 分值角标', goto: 'pool',      render: 'pool' },
        builder:  { title: '组卡',       sub: '经典版组卡器 · 三栏同款',      goto: 'pool',     render: 'builder' },
        banlist:  { title: '卡表',       sub: '禁止 · 限制 · 准限制',        goto: 'banlist',   render: 'banlist' },
        preset:   { title: '预组卡组',   sub: '现成卡组，直接抄',           goto: 'preset',    render: 'preset' },
        popular:  { title: '常用卡',     sub: '使用率 · 胜率统计',           goto: 'pool',      render: 'popular' },
        rank:     { title: '天梯排名',   sub: 'TOP50 · 段位 · 积分',         goto: 'ranking',   render: 'ladder' },
        eight:    { title: '历届八强',   sub: '历届赛事八强卡组',           goto: 'tournament', render: 'eight' },
        login:    { title: '登录账号',   sub: '天梯计分 / 投稿需要登录',     goto: 'login',     render: 'login' }
    };

    var screenEl = null;

    // 蓝黑主题开关（历届八强屏用）：body 加 .nx-blue，背景叠层与底色一起渐变切换
    function nxBlueTheme(on) {
        if (!document.body) return;
        document.body.classList.toggle('nx-blue', !!on);
    }

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
        // 离开组卡屏时把老组卡器整块放回隐藏宿主（连带关掉它的样式）
        if (screenEl.dataset.screen === 'builder' && id !== 'builder' && typeof nxBuilderDetach === 'function') nxBuilderDetach();
        // 蓝黑主题只在历届八强屏生效（背景整体交叉淡入淡出）
        nxBlueTheme(id === 'eight');
        screenEl.hidden = false;
        screenEl.dataset.screen = id || '';       // 供 CSS 按屏调宽度（组卡那种三栏要更宽）
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
                ev.stopPropagation();   // 不能被全局"点空白返回"接走，否则打开浮层的同时页面会偷偷退一级
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

        // 滚轮按"行"吸附：一格滚轮(≈100)刚好走一个玩家，和居中的滚轮式布局对齐
        var WHEEL_STEP = 100;
        var wheelAcc = 0;
        var wheelAt = 0;
        function rowStep() {
            var h = items[0] ? items[0].offsetHeight : 0;
            return h > 0 ? h : 40;
        }
        function onWheel(e) {
            e.preventDefault();
            var now = Date.now();
            if (now - wheelAt > 140) wheelAcc = 0;   // 手势间隔久则清零，避免连走两行
            wheelAt = now;
            var max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
            var step = rowStep();
            wheelAcc += e.deltaY;
            var guard = 0;
            while (Math.abs(wheelAcc) >= WHEEL_STEP && guard++ < 2) {
                var dir = wheelAcc > 0 ? 1 : -1;
                target = Math.max(0, Math.min(max, target + dir * step));
                wheelAcc -= dir * WHEEL_STEP;
            }
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

    // ── 卡图预加载（带三级兜底）并缓存最终地址 ────────────────
    var _picCache = {};           // id → 最终可用地址
    function loadOnePic(id) {
        if (_picCache[id]) return Promise.resolve(_picCache[id]);
        return new Promise(function (resolve) {
            var step = 0;
            var img = new Image();
            function tryNext() {
                if (step >= PIC_CHAIN.length) {
                    _picCache[id] = PIC_CHAIN[0] + id + '.jpg';   // 都不行 → 交给页面上的兜底逻辑
                    resolve(_picCache[id]);
                    return;
                }
                img.src = PIC_CHAIN[step] + id + '.jpg';
            }
            img.onload = function () {
                _picCache[id] = PIC_CHAIN[step] + id + '.jpg';
                resolve(_picCache[id]);
            };
            img.onerror = function () { step++; tryNext(); };
            tryNext();
        });
    }
    function picOf(id) { return _picCache[id] || (PIC_CHAIN[0] + id + '.jpg'); }
    function isDiyPic(url) { return String(url).indexOf(PIC_DIY) === 0; }

    // 预加载一套卡组用到的所有卡图（去重后并发，带进度回调）
    function preloadDeckPics(ids, onProgress) {
        var uniq = [];
        (ids || []).forEach(function (id) { if (uniq.indexOf(id) < 0) uniq.push(id); });
        var total = uniq.length, done = 0;
        if (onProgress) onProgress(0, total);
        return Promise.all(uniq.map(function (id) {
            return loadOnePic(id).then(function (u) {
                done++;
                if (onProgress) onProgress(done, total);
                return u;
            });
        }));
    }

    // 加载态：三个同心线圈旋转 + 进度文字
    function showDeckLoading(box) {
        box.innerHTML =
            '<div class="nx-deck-loading">' +
                '<div class="nx-load-rings"><i></i><i></i><i></i></div>' +
                '<div class="nx-load-text">正在加载卡图 <b>0</b> / 0</div>' +
            '</div>';
    }
    function setDeckLoading(box, n, total) {
        var t = box.querySelector('.nx-load-text');
        if (t) t.innerHTML = '正在加载卡图 <b>' + n + '</b> / ' + total;
    }

    // 卡图：逐级兜底，成功于 DIY 图床时打 DIY 角标
    function wireDeckImage(img, tile, id) {
        var step = 0;
        img.addEventListener('load', function () {
            if (isDiyPic(img.getAttribute('src')) && !tile.querySelector('.nx-deck-diy')) {
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
    var _tipClosed = false;      // 关闭/切视图期间禁止再弹出，防止效果框卡在屏幕上
    function tipEl() {
        if (_tipEl) return _tipEl;
        _tipEl = document.createElement('div');
        _tipEl.className = 'nx-card-tip';
        document.body.appendChild(_tipEl);
        return _tipEl;
    }
    function showCardTip(ev, id) {
        var c = cardInfo(id);
        if (_tipClosed) return;        // 浮层正在关闭/切视图，不再弹出
        var tip = tipEl();
        if (!c) return;                // 查不到卡片信息时保持现状，避免浮层被杂散事件闪掉
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
        clearTimeout(tip._hideTimer);   // 关键：撤销上一次的延迟隐藏，否则它会在这次显示之后才触发把浮层闪掉
        tip.style.display = 'block';
        tip.classList.remove('is-out');
        tip.classList.remove('is-in');
        void tip.offsetWidth;          // 重排以重播入场动画（边框左→右展开，随后文字缓入）
        tip.classList.add('is-in');
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
    // force=true 时立即收起（用于浮层被销毁/切视图，避免来不及收就没了触发 mouseleave 的元素而卡住）
    function hideCardTip(force) {
        if (!_tipEl) return;
        var tip = _tipEl;
        clearTimeout(tip._hideTimer);
        if (force) {
            tip.style.display = 'none';
            tip.classList.remove('is-in', 'is-out');
            return;
        }
        if (tip.style.display === 'none') return;
        tip.classList.remove('is-in');
        tip.classList.add('is-out');                 // 反向且更快：边框回收 + 文字快速淡出
        tip._hideTimer = setTimeout(function () {
            tip.style.display = 'none';
            tip.classList.remove('is-out');
        }, 130);
    }

    var _cardList = null;      // 原始数组（卡池用）
    function loadCardMap() {
        if (_cardMap) return Promise.resolve(_cardMap);
        return fetch('/api/cards').then(function (r) { return r.json(); }).then(function (cards) {
            _cardMap = {};
            _cardList = cards || [];
            _cardList.forEach(function (c) { _cardMap[String(c.id)] = c; });
            return _cardMap;
        }).catch(function () { _cardMap = {}; _cardList = []; return _cardMap; });
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
        _tipClosed = true;              // 上锁：关闭过程中的杂物事件不再弹效果框
        hideCardTip(true);              // 立即收起（不等 130ms 淡出，避免卡在屏幕上）
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
        hideCardTip(true);     // 切视图会移除卡片，不会再有 mouseleave，必须主动收起效果框
        playSfx('back');
        var v = document.getElementById('nxPovView');
        el.classList.add('is-returning');
        if (v) v.classList.add('is-leaving');            // 内容退场
        setTimeout(function () {
            if (v) { v.classList.remove('is-leaving'); v.hidden = true; v.innerHTML = ''; }
            var inner = el.querySelector('.nx-pov-inner');
            if (inner) { inner.style.transition = 'none'; inner.style.transform = 'none'; }
            el.classList.remove('is-viewing', 'is-viewing-done');   // 线圈恢复可见并回到布局
            var ch = unfreezeChoices(el);
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
        if (el && el.dataset.mode === 'deck') { closePlayerOverlay(); return; }   // 预组：只读卡组，直接关
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
        _tipClosed = false;            // 解锁效果框
        playSfx('click');
        // 入场动画只在"刚打开"时生效一次；播完去掉标记，避免返回时基础规则再次触发放两遍入场
        el.classList.add('is-entering');
        setTimeout(function () { el.classList.remove('is-entering'); }, 900);

        // 线圈按钮：接入与主菜单一致的悬停收敛 + 磁吸/拖拽
        var btns = el.querySelectorAll('.nx-pov-opt');
        for (var i = 0; i < btns.length; i++) {
            bindHoverRegular(btns[i]);
            bindMagnet(btns[i]);                 // 磁吸（拖拽形变也依赖它记录指针位置）
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

        el.addEventListener('mouseleave', function () { hideCardTip(true); });   // 兜底
        // 点空白：内容态 → 回到两个线圈；线圈态 → 关闭
        el.addEventListener('click', function (ev) {
            ev.stopPropagation();      // 关键：不能穿透到全局"点空白返回"，否则页面会跟着返回一级并重播入场动画
            var t = ev.target;
            if (t && t.closest && t.closest('.nx-pov-opt, .nx-duel-replay')) return;   // 交互元素不响应
            if (el.classList.contains('is-viewing')) povBackToChoices();
            else closePlayerOverlay();
        });
    }

    // 解绑磁吸（冻结/退出动画期间不再被指针牵引）
    function unbindMagnet(btn) {
        var i = _magBtns.indexOf(btn);
        if (i >= 0) _magBtns.splice(i, 1);
        btn.style.translate = '';
    }
    // 把两个线圈"就地冻结"：移到覆盖层下（覆盖层没有 transform，不会跟着内层上滑），并用绝对定位停在当前视觉位置
    function freezeChoices(el, cr) {
        var ch = el.querySelector('.nx-pov-choices');
        if (!ch || ch.dataset.frozen === '1') return ch;
        cr = cr || ch.getBoundingClientRect();
        el.appendChild(ch);                     // 挂到覆盖层，脱离内层的位移影响
        var hr = el.getBoundingClientRect();
        ch.style.position = 'absolute';
        ch.style.left = (cr.left - hr.left) + 'px';
        ch.style.top = (cr.top - hr.top) + 'px';
        ch.style.width = cr.width + 'px';
        ch.style.margin = '0';
        ch.dataset.frozen = '1';
        Array.prototype.forEach.call(ch.querySelectorAll('.nx-option'), unbindMagnet);
        return ch;
    }
    function unfreezeChoices(el) {
        var ch = el.querySelector('.nx-pov-choices');
        if (!ch) return ch;
        ch.style.cssText = '';
        ch.dataset.frozen = '';
        var inner = el.querySelector('.nx-pov-inner');
        var view = document.getElementById('nxPovView');
        if (inner && ch.parentNode !== inner) inner.insertBefore(ch, view);   // 放回内层（内容视图之前）
        // 回到布局后重新接上磁吸
        Array.prototype.forEach.call(ch.querySelectorAll('.nx-option'), function (b) { bindMagnet(b); });
        return ch;
    }

    // 展示某一项内容（线圈收起 → 内容淡入）
    function povShowView(kind) {
        var el = povEl();
        if (!el) return;
        var view = document.getElementById('nxPovView');
        var inner = el.querySelector('.nx-pov-inner');
        var first = !el.classList.contains('is-viewing');

        if (first && inner) {
            // 先在"居中态"记下位置 → 切到顶部对齐后补一个位移，再动画归零：
            // 这样内容是从中间平滑滑到顶部的，而不是瞬间跳一下（跳完再加载卡片会显得"整体上闪"）
            var chEl = el.querySelector('.nx-pov-choices');
            var crOld = chEl ? chEl.getBoundingClientRect() : null;
            var beforeTop = inner.getBoundingClientRect().top;
            el.classList.add('is-viewing');
            var afterTop = inner.getBoundingClientRect().top;
            var dy = beforeTop - afterTop;
            if (dy > 2) {
                inner.style.transition = 'none';
                inner.style.transform = 'translateY(' + dy.toFixed(1) + 'px)';
                void inner.offsetWidth;
                inner.style.transition = 'transform .34s cubic-bezier(.22,.9,.28,1)';
                inner.style.transform = 'translateY(0)';
            }
            freezeChoices(el, crOld);   // 放在补偿位移之后算，线圈才会停在原视觉位置
        } else {
            el.classList.add('is-viewing');
        }
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
            renderDeckInto(box, d.deck,
                esc(d.roomName || '') + ' · ' + esc(d.winner || '') + ' vs ' + esc(d.opponent || '') + ' · ' + fmtTime(d.time),
                (p.name || '卡组') + '-' + (d.roomName || ''));
        }).catch(function () {
            var box = document.getElementById('nxPovView');
            if (box) box.innerHTML = '<div class="nx-empty">卡组读取失败</div>';
        });
    }

    // ── 卡组下载（YDK 文本，格式与经典版 downloadYdk 一致）──
    var _deckDlAt = 0;
    function deckToYdk(deck) {
        var lines = ['#created by Sirokami'];
        if ((deck.main || []).length) { lines.push('#main'); deck.main.forEach(function (id) { lines.push(String(id)); }); }
        if ((deck.extra || []).length) { lines.push('#extra'); deck.extra.forEach(function (id) { lines.push(String(id)); }); }
        if ((deck.side || []).length) { lines.push('!side'); deck.side.forEach(function (id) { lines.push(String(id)); }); }
        return lines.join('\n');
    }
    function downloadDeckYdk(deck, name, btn) {
        var now = Date.now();
        if (now - _deckDlAt < 5000) return;          // 与经典版一致：5 秒冷却
        _deckDlAt = now;
        try {
            var blob = new Blob([deckToYdk(deck)], { type: 'text/plain;charset=utf-8' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = (String(name || 'deck').replace(/[\\/:*?"<>|]/g, '_')) + '.ydk';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        } catch (e) { /* 忽略 */ }
        playSfx('click');
        if (btn) {
            var old = btn.getAttribute('data-txt') || '下载 YDK';
            btn.textContent = '已下载';
            setTimeout(function () { btn.textContent = old; }, 1400);
        }
    }

    // 渲染一套卡组：先预加载全部卡图 → 再一屏全显示（含分值/DIY 角标、悬停效果浮层）
    // 「选手详情 · 卡组信息」与「预组卡组」共用这一段
    function renderDeckInto(box, deck, meta, dlName) {
        if (!box || !deck) return;
        hideCardTip(true);     // 重渲染前先收掉旧的效果框
        // ① 先播加载动画：等卡图全部就绪再渲染，入场动画才不会"播完了图还没出来"
        showDeckLoading(box);
        var allIds = [].concat(deck.main || [], deck.extra || [], deck.side || []);
        var preload = preloadDeckPics(allIds, function (n, t) { setDeckLoading(box, n, t); });
        var guard = new Promise(function (r) { setTimeout(r, 12000); });   // 个别图卡住也不至于一直转圈
        return Promise.race([preload, guard]).then(function () {
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
                            var badge = (sc && (sc.forbidden || (sc.score || 0) > 0))
                                ? '<span class="nx-deck-score' + (sc.forbidden ? ' is-forbidden' : '') + '">' +
                                  (sc.forbidden ? '禁' : sc.score) + '</span>'
                                : '';
                            return '<div class="nx-deck-tile" data-id="' + id + '">' +
                                '<div class="nx-deck-photo">' +
                                    '<img class="nx-deck-img" src="' + picOf(id) + '" alt="">' +
                                    badge +
                                '</div>' +
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
                var total = deckScore(deck);
                box.innerHTML =
                    '<div class="nx-deck-info">' +
                        '<span class="nx-deck-info-item">总分 <b>' + total + '</b>/' + _scoreLimit + '</span>' +
                        (total > _scoreLimit ? '<span class="nx-deck-info-warn">超出上限</span>' : '') +
                        '<span class="nx-deck-info-item">主 <b>' + (deck.main || []).length + '</b></span>' +
                        '<span class="nx-deck-info-item">额外 <b>' + (deck.extra || []).length + '</b></span>' +
                        '<span class="nx-deck-info-item">副 <b>' + (deck.side || []).length + '</b></span>' +
                        '<button class="nx-deck-dl" type="button" title="下载卡组 (YDK)">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
                                '<path d="M12 4v11"></path><path d="M7.5 11.5 12 16l4.5-4.5"></path><path d="M5 19h14"></path>' +
                            '</svg><span data-txt="下载 YDK">下载 YDK</span>' +
                        '</button>' +
                    '</div>' +
                    (meta ? '<div class="nx-deck-meta">' + meta + '</div>' : '') +
                    '<div class="nx-deck-fit" id="nxDeckFit">' +
                        '<div class="nx-deck-cols">' +
                            '<div class="nx-deck-col-main">' + group('主卡组', deck.main) + '</div>' +
                            '<div class="nx-deck-col-side">' + group('额外卡组', deck.extra) + group('副卡组', deck.side) + '</div>' +
                        '</div>' +
                    '</div>';
                // 下载 YDK（与经典版同一套格式）
                var dlBtn = box.querySelector('.nx-deck-dl');
                if (dlBtn) {
                    dlBtn.addEventListener('click', function (ev) {
                        ev.stopPropagation();          // 不穿透到"点空白返回"
                        downloadDeckYdk(deck, dlName, dlBtn.querySelector('span') || dlBtn);
                    });
                }
                // 卡图逐级兜底（OCG → SuperPre → DIY，DIY 成功打角标）+ 悬停效果浮层
                Array.prototype.forEach.call(box.querySelectorAll('.nx-deck-tile'), function (tile) {
                    var id = tile.getAttribute('data-id');
                    var img = tile.querySelector('.nx-deck-img');
                    if (img) wireDeckImage(img, tile, id);
                    tile.addEventListener('mouseenter', function (ev) { showCardTip(ev, id); });
                    tile.addEventListener('mousemove', function (ev) { if (_tipEl && _tipEl.style.display === 'block') positionCardTip(ev, _tipEl); });
                    tile.addEventListener('mouseleave', hideCardTip);
                });
                // 一屏全显示：首次渲染就定好列数（同一帧内完成，用户看不到中间态），之后只做缩放微调
                fitDeckScale(box, true);
                scheduleDeckFit(box);
                Array.prototype.forEach.call(box.querySelectorAll('.nx-deck-img'), function (img) {
                    img.addEventListener('load', function () { refitDeckSoon(box); });
                    img.addEventListener('error', function () { refitDeckSoon(box); });
                });
            });
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
            var NAME_H = 4;              // 卡名已去掉，只留一点点行间余量（卡图更大）
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
            // 手机端固定一行 10 张（窄屏上按高度算会偏少，看着太挤）
            var n = window.innerWidth <= 768 ? 10 : bestCols(count, col.getBoundingClientRect().width, availH);
            if (n > 0) {
                grid.style.gridTemplateColumns = 'repeat(' + n + ', minmax(0, 1fr))';
                // 对角序号（左上 → 右下），供入场动画错开
                var tiles = grid.querySelectorAll('.nx-deck-tile');
                for (var i = 0; i < tiles.length; i++) {
                    tiles[i].style.setProperty('--i', (Math.floor(i / n) + (i % n)));
                }
            }
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
    // relayout=true 才重算列数（只在首次渲染与窗口尺寸变化时）；
    // 入场后的周期性校正只做缩放，否则会中途改列数 → 卡片重排、动画被打断
    function fitDeckScale(box, relayout) {
        var fit = document.getElementById('nxDeckFit');
        if (!fit) return;

        // ① 必须先复位（否则量到的是上一次缩放后的布局，列数会算错 → 底部溢出）
        fit.style.zoom = '';
        fit.style.transform = 'none';
        fit.style.transformOrigin = 'top center';
        box.style.height = '';
        box.style.overflow = '';
        fit.classList.remove('is-compact');
        // 手机端一行 10 张，卡名会挤成一团 → 直接走紧凑模式（隐藏卡名、收紧间距）
        if (window.innerWidth <= 768) fit.classList.add('is-compact');

        function bottom() { return fit.getBoundingClientRect().bottom; }

        // ② 复位状态下按真实可用高度选列数（只在 relayout 时做）
        if (relayout) {
            layoutDeckGrids(box);
            // 还放不下：先牺牲卡名再选一次列数
            if (bottom() > window.innerHeight - 6) {
                fit.classList.add('is-compact');
                layoutDeckGrids(box);
            }
        }

        // ③ 最后仍放不下才等比缩放
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
    // 内容尺寸稳定前的多次"仅缩放"校正（不改列数，因此不会打断动画）
    function scaleOnly(box, times, gap) {
        if (!box) return;
        (box._scaleTimers || []).forEach(clearTimeout);
        box._scaleTimers = (times || [0]).map(function (t, i) {
            return setTimeout(function () {
                if (document.body.contains(box)) fitDeckScale(box, false);
            }, (gap || 0) * i + t);
        });
    }
    function refitDeckSoon(box) {
        if (!box) return;
        clearTimeout(box._fitTimer);
        box._fitTimer = setTimeout(function () { fitDeckScale(box, false); }, 260);
    }
    // 渲染后只做缩放校正（列数已在首次渲染时定好，绝不在动画期间重排）
    function scheduleDeckFit(box) {
        scaleOnly(box, [0, 140, 420, 900], 0);
    }
    window.addEventListener('resize', function () {
        var box = document.getElementById('nxPovView');
        if (box && box.querySelector('.nx-deck-fit')) fitDeckScale(box, true);   // 尺寸变化才重排列数
    });

    // ── 首字母排序／索引：与经典版 chronicle-decks.js 同一套中文拼音规则 ──
    var PINYIN_MAP = {
        '白': 'B', '爆': 'B', '饼': 'B', '不': 'B', '超': 'C', '点': 'D', '电': 'D', '二': 'E',
        '方': 'F', '芳': 'F', '风': 'F', '古': 'G', '光': 'G', '黑': 'H', '坏': 'H', '幻': 'H',
        '机': 'J', '急': 'J', '军': 'J', '卡': 'K', '克': 'K', '恐': 'K', '雷': 'L', '龙': 'L',
        '毛': 'M', '魔': 'M', '七': 'Q', '青': 'Q', '三': 'S', '手': 'S', '熟': 'S', '淘': 'T',
        '通': 'T', '王': 'W', '武': 'W', '新': 'X', '虚': 'X', '玄': 'X', '异': 'Y', '云': 'Y',
        '泽': 'Z', '真': 'Z', '珠': 'Z', '罪': 'Z'
    };
    var PINYIN_ANCHORS = [
        ['A', '阿'], ['B', '八'], ['C', '擦'], ['D', '搭'], ['E', '蛾'], ['F', '发'], ['G', '嘎'],
        ['H', '哈'], ['J', '击'], ['K', '喀'], ['L', '拉'], ['M', '妈'], ['N', '拿'], ['O', '噢'],
        ['P', '啪'], ['Q', '期'], ['R', '然'], ['S', '撒'], ['T', '塌'], ['W', '挖'], ['X', '昔'],
        ['Y', '压'], ['Z', '匝']
    ];
    var _pyCollator = null;
    try { _pyCollator = new Intl.Collator('zh-Hans-CN'); } catch (e) { _pyCollator = null; }
    function pinyinInitialOf(ch) {
        if (PINYIN_MAP[ch]) return PINYIN_MAP[ch];
        if (!_pyCollator) return 'Z';
        var best = 'A';
        for (var i = 0; i < PINYIN_ANCHORS.length; i++) {
            if (_pyCollator.compare(ch, PINYIN_ANCHORS[i][1]) >= 0) best = PINYIN_ANCHORS[i][0];
        }
        return best;
    }
    function sortCore(name) {
        var s = String(name == null ? '' : name);
        var parts = s.split(/[-－—–_]/);
        var core = (parts.length > 1 ? parts[parts.length - 1] : parts[0]).trim();
        return core || s.trim();
    }
    function initialKey(name) {
        var core = sortCore(name);
        var c = core.charAt(0);
        if (!c) return '#';
        if (/[A-Za-z]/.test(c)) return c.toUpperCase();
        if (/[0-9]/.test(c)) return '#';
        if (/[\u4e00-\u9fff]/.test(c)) return pinyinInitialOf(c);
        return '#';
    }
    function deckSortRank(name) {
        var c = sortCore(name).charAt(0);
        if (!c) return '2';
        if (/[0-9]/.test(c)) return '1';
        if (/[A-Za-z]/.test(c) || /[\u4e00-\u9fff]/.test(c)) return '0';
        return '2';
    }
    function compareChronicleDecks(a, b) {
        var ra = deckSortRank(a.name), rb = deckSortRank(b.name);
        if (ra !== rb) return ra < rb ? -1 : 1;
        var ka = initialKey(a.name), kb = initialKey(b.name);
        if (ka !== kb) return ka < kb ? -1 : 1;
        var ca = sortCore(a.name), cb = sortCore(b.name);
        if (_pyCollator) { var r = _pyCollator.compare(ca, cb); if (r) return r; }
        return String(a.name).localeCompare(String(b.name));
    }

    // ── 预组卡组（卡片 → 预组）：数据与经典版同一份 decks/chronicle_decks.json ──
    var _nxBarTouchAt = 0;      // 最近一次触碰预组工具带的时间（防误触用）
    var CHRONICLE_URL = 'decks/chronicle_decks.json?v=20261006p';
    var _presetCache = null;
    function loadChronicleDecks() {
        if (_presetCache) return Promise.resolve(_presetCache);
        return fetch(CHRONICLE_URL).then(function (r) { return r.json(); })
            .then(function (d) { _presetCache = (d && d.decks) || []; return _presetCache; })
            .catch(function () { _presetCache = []; return _presetCache; });
    }
    function renderPreset(body) {
        body.innerHTML = '<div class="nx-deck-loading"><div class="nx-load-rings"><i></i><i></i><i></i></div>' +
            '<div class="nx-load-text">正在加载预组 <b>0</b></div></div>';
        loadChronicleDecks().then(function (decks) {
            if (!decks.length) {
                body.innerHTML = '<div class="nx-empty">暂无可用的预组卡组</div>';
                return;
            }
            var sorted = decks.slice().sort(compareChronicleDecks);   // 首字母 A→Z（中文按拼音）

            // 横向 3D 卡flow：滚轮左右切换，中间最近，同屏 5 个；每套用 3 张卡图做扇形
            function fanHtml(d) {
                var ids = (d.main || []).slice(0, 3);
                if (!ids.length) ids = [0];
                var out = '';
                // 后画的在下层：c2(最远) → c1 → c0(封面)
                for (var k = 2; k >= 0; k--) {
                    var cid = ids[k] || ids[0] || 0;
                    out += '<img class="nx-cf-card nx-cf-c' + k + '" data-cid="' + cid +
                        '" src="' + PIC_CHAIN[0] + cid + '.jpg" loading="lazy" alt="">';
                }
                return out;
            }
            body.innerHTML =
                '<div class="nx-cf-bar">' +
                    '<div class="nx-cf-letters" id="nxCfLetters"></div>' +
                    '<div class="nx-cf-search" id="nxCfSearchWrap">' +
                        '<button class="nx-cf-lens" id="nxCfLens" type="button" aria-label="搜索">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
                                '<circle cx="10.4" cy="10.4" r="6.6"></circle>' +
                                '<line x1="15.4" y1="15.4" x2="21" y2="21"></line>' +
                            '</svg>' +
                        '</button>' +
                        '<input id="nxCfSearch" type="text" placeholder="搜索卡组名 / 首字母" autocomplete="off" spellcheck="false">' +
                        '<button class="nx-cf-clear" id="nxCfClear" type="button" aria-label="清除搜索" hidden>✕</button>' +
                        '<span class="nx-cf-count" id="nxCfCount"></span>' +
                    '</div>' +
                '</div>' +
                '<div class="nx-cf" id="nxCf">' +
                    '<div class="nx-cf-stage" id="nxCfStage">' +
                        sorted.map(function (d, i) {
                            var meta = '主 ' + (d.main || []).length +
                                ((d.extra || []).length ? ' · 额外 ' + d.extra.length : '') +
                                ((d.side || []).length ? ' · 副 ' + d.side.length : '');
                            return '<button class="nx-cf-item" type="button" data-di="' + i +
                                '" data-name="' + esc(String(d.name).toLowerCase()) +
                                '" data-py="' + initialKey(d.name) + '">' +
                                '<span class="nx-cf-fan">' + fanHtml(d) + '</span>' +
                                '<span class="nx-cf-name">' + esc(d.name) + '</span>' +
                                '<span class="nx-cf-meta">' + meta + '</span>' +
                            '</button>';
                        }).join('') +
                    '</div>' +
                    '<div class="nx-cf-hint" id="nxCfHint">滑动 / 滚轮切换 · 点中间打开 · ← → 也可</div>' +
                    '<div class="nx-cf-empty" id="nxCfEmpty" hidden>没有匹配的卡组</div>' +
                '</div>';

            var cf = document.getElementById('nxCf');
            var stage = document.getElementById('nxCfStage');
            var items = Array.prototype.slice.call(stage.querySelectorAll('.nx-cf-item'));
            var cur = 0;

            function paint(extraX) {
                extraX = extraX || 0;
                var SPACING = spacing();                 // 间距随卡片宽度自适应（手机端不再把两侧卡推出屏幕）
                for (var i = 0; i < items.length; i++) {
                    var off = i - cur, a = Math.abs(off), el = items[i];
                    if (a > 2) {                       // 同屏只保留 5 个
                        el.style.opacity = '0';
                        el.style.pointerEvents = 'none';
                        el.style.transform = 'translate(-50%, -50%) translate3d(' + (off * SPACING + extraX) + 'px, 0, -520px) scale(.4)';
                        el.style.zIndex = '1';
                        el.classList.remove('is-center');   // 关键：旧的中心必须清掉，否则会留着一圈金边
                        continue;
                    }
                    var x = off * SPACING + extraX;    // 水平间距（含拖动位移）
                    var z = -a * 135;                  // 越远越后退（中间最近）
                    var ry = -off * 27;                // 侧转（3D）
                    var sc = 1 - a * 0.17;
                    // 先按自身尺寸居中（translate -50%,-50%），再做 3D 位姿
                    el.style.transform = 'translate(-50%, -50%) translate3d(' + x + 'px, ' + (a * 8) + 'px, ' + z + 'px) rotateY(' + ry + 'deg) scale(' + sc + ')';
                    el.style.opacity = a === 0 ? '1' : (a === 1 ? '.85' : '.42');
                    el.style.zIndex = String(100 - a);
                    el.style.pointerEvents = 'auto';
                    el.classList.toggle('is-center', a === 0);
                }
                highlightLetter();
            }
            paint();

            // 每套的 3 张卡图：兜底 + 角标
            items.forEach(function (el, i) {
                var fan = el.querySelector('.nx-cf-fan');
                Array.prototype.forEach.call(el.querySelectorAll('.nx-cf-card'), function (img) {
                    var cid = parseInt(img.getAttribute('data-cid'), 10) || 0;
                    wireDeckImage(img, fan || el, cid);
                });
            });

            // 拖动跟手（鼠标/触屏通用）：松手后按距离与甩动速度吸附到某一格
            var dragX = 0, dragging = false, dragStartX = 0, dragStartT = 0, dragMoved = false, suppressClick = false;
            function spacing() {
                var iw = (items[0] && items[0].offsetWidth) || 196;
                return Math.round(iw * 1.32);
            }
            cf.addEventListener('pointerdown', function (ev) {
                if (ev.pointerType === 'mouse' && ev.button !== 0) return;
                dragging = true; dragMoved = false; dragX = 0;
                dragStartX = ev.clientX; dragStartT = Date.now();
                cf.classList.add('is-dragging');
            });
            cf.addEventListener('pointermove', function (ev) {
                if (!dragging) return;
                dragX = ev.clientX - dragStartX;
                if (Math.abs(dragX) > 8) dragMoved = true;
                if (dragMoved) paint(dragX);           // 跟手
            });
            function endDrag() {
                if (!dragging) return;
                dragging = false;
                cf.classList.remove('is-dragging');
                var sp = spacing();
                var dt = Math.max(1, Date.now() - dragStartT);
                var v = dragX / dt;                     // px/ms
                var n = Math.round(-dragX / sp);        // 拖动距离换算格数
                if (Math.abs(v) > 0.5) n = -Math.sign(dragX) * Math.max(1, Math.abs(n));   // 快速甩动至少一格
                if (n) {
                    cur = Math.max(0, Math.min(items.length - 1, cur + n));
                    playSfx('click');
                }
                dragX = 0;
                paint(0);
                if (dragMoved) { suppressClick = true; setTimeout(function () { suppressClick = false; }, 60); }
            }
            cf.addEventListener('pointerup', endDrag);
            cf.addEventListener('pointercancel', endDrag);
            cf.addEventListener('pointerleave', function () { if (dragging) endDrag(); });

            // 滚轮：一格一步。阈值取 100（鼠标一格常是 100 或 120），
            // 且手势间隔超过 140ms 视为新手势、清零累积量，避免一格走两格。
            var acc = 0;
            var wheelAt = 0;
            cf.addEventListener('wheel', function (ev) {
                ev.preventDefault();
                var now = Date.now();
                if (now - wheelAt > 140) acc = 0;
                wheelAt = now;
                var d = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
                acc += d;
                var guard = 0;
                while (Math.abs(acc) >= 100 && guard++ < 2) {
                    var dir = acc > 0 ? 1 : -1;
                    var next = Math.max(0, Math.min(items.length - 1, cur + dir));
                    acc -= dir * 100;
                    if (next !== cur) { cur = next; playSfx('click'); }
                }
                paint();
            }, { passive: false });

            // 点击：两侧的移到中间；中间的打开卡组
            // 注意：搜索过滤后 items 会被重排，所以下标必须动态取，不能闭包捕获
            items.forEach(function (el) {
                el.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    if (suppressClick) { ev.preventDefault(); return; }   // 刚拖动过，不当作点击
                    var at = items.indexOf(el);
                    if (at < 0) return;
                    if (at !== cur) { cur = at; paint(0); playSfx('click'); return; }
                    playSfx('click');
                    var d = sorted[parseInt(el.getAttribute('data-di'), 10)];
                    if (!d) return;
                    openDeckView(d, d.name, '预组卡组', '编年史卡组池 · 主 ' + (d.main || []).length + ' 张');
                });
            });

            // ── 顶部 A–Z 索引条 + 搜索 ─────────────────────────
            var lettersEl = document.getElementById('nxCfLetters');
            var searchEl = document.getElementById('nxCfSearch');
            var countEl = document.getElementById('nxCfCount');
            var ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
            var allItems = items.slice();

            // 高亮当前中间那套卡组的首字母
            function highlightLetter() {
                if (!lettersEl) return;
                var cEl = items[cur];
                var cP = cEl ? cEl.getAttribute('data-py') : '';
                Array.prototype.forEach.call(lettersEl.children, function (b) {
                    b.classList.toggle('is-on', b.getAttribute('data-py') === cP);
                });
            }

            function buildLetters() {
                if (!lettersEl) return;
                var has = {};
                items.forEach(function (el) { has[el.getAttribute('data-py')] = 1; });
                lettersEl.innerHTML = ALPHA.map(function (L) {
                    return '<button type="button" class="nx-cf-letter' + (has[L] ? '' : ' is-empty') +
                        '" data-py="' + L + '">' + L + '</button>';
                }).join('') +
                (has['#'] ? '<button type="button" class="nx-cf-letter" data-py="#">#</button>' : '');
                Array.prototype.forEach.call(lettersEl.querySelectorAll('.nx-cf-letter'), function (b) {
                    b.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        if (b.classList.contains('is-empty')) return;
                        var L = b.getAttribute('data-py');
                        for (var i = 0; i < items.length; i++) {
                            if (items[i].getAttribute('data-py') === L) {
                                cur = i; paint(0); playSfx('click'); break;
                            }
                        }
                    });
                });
                if (countEl) countEl.textContent = items.length + ' / ' + allItems.length;
                highlightLetter();
            }

            function applySearch() {
                var q = (searchEl && searchEl.value || '').trim().toLowerCase();
                var kept = q ? allItems.filter(function (el) {
                    return (el.getAttribute('data-name') || '').indexOf(q) >= 0 ||
                           (el.getAttribute('data-py') || '').toLowerCase() === q;
                }) : allItems.slice();
                // 被排除的必须先藏起来：paint 只处理 items 里的元素，残留的会一直留在屏幕上
                allItems.forEach(function (el) {
                    var on = kept.indexOf(el) >= 0;
                    el.style.display = on ? '' : 'none';
                    if (!on) {
                        el.classList.remove('is-center');
                        el.style.opacity = '0';
                        el.style.pointerEvents = 'none';
                    }
                });
                // 复用同一批 DOM（事件不丢），按原顺序重新挂载
                kept.forEach(function (el) { stage.appendChild(el); });
                items = kept;
                cur = 0;
                paint(0);
                buildLetters();
                var emptyEl = document.getElementById('nxCfEmpty');
                if (emptyEl) emptyEl.hidden = kept.length > 0;
                var hintEl = document.getElementById('nxCfHint');
                if (hintEl) hintEl.hidden = kept.length === 0;
            }
            // ── 折叠式搜索：点放大镜 → 它向左让位、让出的路径变成输入框；回车 → 转一圈并弹性回位 ──
            var searchWrap = document.getElementById('nxCfSearchWrap');
            var lensBtn = document.getElementById('nxCfLens');
            var clearBtn = document.getElementById('nxCfClear');
            // 工具带（字母 + 搜索）内的任何触碰都记录时间，用于全局返回的防误触判定
            var barEl = document.querySelector('.nx-cf-bar');
            if (barEl) {
                ['pointerdown', 'click'].forEach(function (evt) {
                    barEl.addEventListener(evt, function () { _nxBarTouchAt = Date.now(); }, true);
                });
            }
            function refreshClear() {
                if (clearBtn) clearBtn.hidden = !(searchEl && searchEl.value.trim()) || (searchWrap && searchWrap.classList.contains('is-open'));
            }
            function openSearch() {
                if (!searchWrap) return;
                searchWrap.classList.add('is-open');
                refreshClear();
                setTimeout(function () { if (searchEl) { searchEl.focus(); searchEl.select(); } }, 80);
            }
            function closeSearch(spin) {
                if (!searchWrap) return;
                searchWrap.classList.remove('is-open');
                if (spin && lensBtn) {                     // 顺时针转一周（带弹性），同时随输入框收起而弹性回位
                    lensBtn.classList.remove('is-spin');
                    void lensBtn.offsetWidth;
                    lensBtn.classList.add('is-spin');
                }
                refreshClear();
            }
            function submitSearch() { applySearch(); closeSearch(true); }

            if (lensBtn) {
                lensBtn.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    if (!searchOpen()) { openSearch(); return; }
                    submitSearch();
                });
            }
            if (clearBtn) {
                clearBtn.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    if (searchEl) searchEl.value = '';
                    applySearch();
                    refreshClear();
                });
            }
            function searchOpen() { return !!(searchWrap && searchWrap.classList.contains('is-open')); }
            if (searchEl) {
                searchEl.addEventListener('input', function () { applySearch(); refreshClear(); });   // 边打边过滤，回车才收起并转圈
                searchEl.addEventListener('keydown', function (ev) {
                    ev.stopPropagation();                       // 别让 Esc / 方向键穿透到全局
                    if (ev.key === 'Enter') { ev.preventDefault(); submitSearch(); }
                    else if (ev.key === 'Escape') { ev.preventDefault(); applySearch(); closeSearch(false); searchEl.blur(); }
                });
                searchEl.addEventListener('click', function (ev) { ev.stopPropagation(); });
                searchEl.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
            }
            buildLetters();

            // 键盘左右（在输入框里打字的左右键不拦截）
            function onKey(ev) {
                if (!document.getElementById('nxCf')) { document.removeEventListener('keydown', onKey); return; }
                var t = ev.target;
                if (t && t.closest && t.closest('input, textarea')) return;   // 输入框内不拦截
                if (ev.key === 'ArrowLeft') { cur = Math.max(0, cur - 1); paint(); }
                else if (ev.key === 'ArrowRight') { cur = Math.min(items.length - 1, cur + 1); paint(); }
            }
            document.addEventListener('keydown', onKey);
        });
    }

    // 只展示一套卡组的浮层（不进两个线圈那一步），供预组使用
    function openDeckView(deck, name, sub, meta) {
        closePlayerOverlay();
        var el = document.createElement('div');
        el.className = 'nx-pov is-viewing is-viewing-done';
        el.id = 'nxPov';
        el.dataset.mode = 'deck';
        el.innerHTML =
            '<div class="nx-pov-dim"></div>' +
            '<div class="nx-pov-inner">' +
                '<div class="nx-pov-title"><b>' + esc(name) + '</b><span>' + esc(sub || '') + '</span></div>' +
                '<div class="nx-pov-view" id="nxPovView"></div>' +
            '</div>';
        document.body.appendChild(el);
        document.body.classList.add('nx-zoomed');
        document.addEventListener('keydown', povKey, true);
        _tipClosed = false;            // 解锁效果框
        el.addEventListener('click', function (ev) {
            ev.stopPropagation();                       // 不穿透到全局"点空白返回"
            var t = ev.target;
            if (t && t.closest && t.closest('.nx-deck-tile')) return;   // 点卡面不关闭（要看效果浮层）
            closePlayerOverlay();
        });
        var box = document.getElementById('nxPovView');
        if (box) renderDeckInto(box, deck, meta || '', name || '卡组');
    }

    // ── 常用卡（卡片 → 常用卡）：/api/ladder/card-stats ──────
    var CARDSTATS_API = 'https://api.ygopro3.cn/api/ladder/card-stats';
    var _statsCache = null;
    function loadCardStats() {
        if (_statsCache) return Promise.resolve(_statsCache);
        return fetch(CARDSTATS_API + '?t=' + Date.now())
            .then(function (r) { return r.json(); })
            .then(function (d) { _statsCache = d || {}; return _statsCache; })
            .catch(function () { _statsCache = { totalDuels: 0, topUsed: [], topWinRate: [] }; return _statsCache; });
    }
    function renderPopular(body) {
        var listKey = (body.dataset && body.dataset.tab) || 'used';
        body.innerHTML = '<div class="nx-deck-loading"><div class="nx-load-rings"><i></i><i></i><i></i></div>' +
            '<div class="nx-load-text">正在统计常用卡 <b>0</b></div></div>';
        loadCardStats().then(function (d) {
            var used = d.topUsed || [], win = d.topWinRate || [];
            var list = listKey === 'win' ? win : used;

            var tabs = [
                { k: 'used', label: '使用率榜', n: used.length },
                { k: 'win', label: '胜率榜', n: win.length },
                { k: 'groups', label: '分组浏览', n: '' }
            ].map(function (t) {
                return '<button class="nx-stats-tab' + (t.k === listKey ? ' is-on' : '') + '" type="button" data-tab="' + t.k + '">' +
                    t.label + (t.n === '' ? '' : '<i>' + t.n + '</i>') + '</button>';
            }).join('');

            if (listKey === 'groups') {
                loadCommonGroups().then(function (groups) {
                    if (!groups.length) { body.innerHTML = '<div class="nx-empty">暂无分组数据</div>'; return; }
                    var gi = Math.max(0, Math.min(groups.length - 1, parseInt(body.dataset.group || '0', 10) || 0));
                    var g = groups[gi];
                    body.innerHTML =
                        '<div class="nx-stats-top nx-reveal" style="--i:0">' +
                            '<div class="nx-stats-tabs">' + tabs + '</div>' +
                            '<div class="nx-stats-count">共 <b>' + groups.length + '</b> 个分组</div>' +
                        '</div>' +
                        '<div class="nx-group-chips nx-reveal" style="--i:1">' + groups.map(function (x, i) {
                            return '<button class="nx-group-chip' + (i === gi ? ' is-on' : '') + '" type="button" data-gi="' + i + '">' +
                                esc(x.name) + '<i>' + (x.cards || []).length + '</i></button>';
                        }).join('') + '</div>' +
                        '<div class="nx-card-grid" id="nxStatsGrid"></div>';
                    paintCardTiles(document.getElementById('nxStatsGrid'), (g.cards || []), { plain: true });
                    bindStatsTabs(body);
                    Array.prototype.forEach.call(body.querySelectorAll('.nx-group-chip'), function (b) {
                        b.addEventListener('click', function (ev) {
                            ev.stopPropagation();
                            var i = parseInt(b.getAttribute('data-gi'), 10) || 0;
                            if (i === gi) return;
                            body.dataset.group = String(i);
                            hideCardTip(true);
                            playSfx('click');
                            renderPopular(body);
                        });
                    });
                });
                return;
            }

            if (!list.length) { body.innerHTML = '<div class="nx-empty">暂无统计数据</div>'; return; }
            body.innerHTML =
                '<div class="nx-stats-top nx-reveal" style="--i:0">' +
                    '<div class="nx-stats-tabs">' + tabs + '</div>' +
                    '<div class="nx-stats-count">统计 <b>' + (d.totalDuels || 0) + '</b> 场对局</div>' +
                '</div>' +
                '<div class="nx-card-grid" id="nxStatsGrid"></div>';
            paintCardTiles(document.getElementById('nxStatsGrid'), list, {});
            bindStatsTabs(body);
        });
    }
    function bindStatsTabs(body, rerender) {
        var run = rerender || renderPopular;
        Array.prototype.forEach.call(body.querySelectorAll('.nx-stats-tab'), function (b) {
            b.addEventListener('click', function (ev) {
                ev.stopPropagation();
                if ((body.dataset.tab || 'used') === b.getAttribute('data-tab')) return;
                body.dataset.tab = b.getAttribute('data-tab');
                hideCardTip(true);
                playSfx('click');
                run(body);
            });
        });
    }

    // 玩家整理的分组（data/common_cards.json）
    var COMMON_GROUPS_URL = 'data/common_cards.json?v=20261006x';
    var _groupsCache = null;
    function loadCommonGroups() {
        if (_groupsCache) return Promise.resolve(_groupsCache);
        return fetch(COMMON_GROUPS_URL)
            .then(function (r) { return r.json(); })
            .then(function (d) { _groupsCache = (d && d.groups) || []; return _groupsCache; })
            .catch(function () { _groupsCache = []; return _groupsCache; });
    }
    // 渲染一批卡图瓦片（榜单 / 分组 / 卡表共用）
    // opts.lazy=true 时不预加载，直接进场并交给浏览器懒加载（卡表这种几百张的场景）
    function paintCardTiles(box, ids, opts) {
        opts = opts || {};
        box.innerHTML = '';
        var ready = opts.lazy ? Promise.resolve() : (function () {
            var loadTxt = document.createElement('div');
            loadTxt.className = 'nx-deck-loading';
            loadTxt.innerHTML = '<div class="nx-load-rings"><i></i><i></i><i></i></div><div class="nx-load-text">正在加载卡图 <b>0</b> / ' + ids.length + '</div>';
            box.appendChild(loadTxt);
            return preloadDeckPics(ids, function (n, t) {
                var e = loadTxt.querySelector('.nx-load-text');
                if (e) e.innerHTML = '正在加载卡图 <b>' + n + '</b> / ' + t;
            });
        })();
        ready.then(function () {
            // 分值/禁限表也一起等：所有卡图瓦片都要带分数角标
            return Promise.all([loadCardMap(), loadScoreMap()]);
        }).then(function () {
            box.innerHTML = ids.map(function (x, i) {
                var id = opts.plain ? x : x.cardId;
                var nm = (opts.names && opts.names[id]) || cardName(id);
                var sc = _scoreMap && _scoreMap[id];
                var stat = (!opts.plain && x.usageRate)
                    ? '<span class="nx-card-stats"><i class="is-use">' + esc(x.usageRate) + '</i>' +
                      '<i class="is-win">' + esc(x.winRate || '-') + '</i></span>'
                    : '';
                return '<div class="nx-card-tile' + (opts.plain ? ' is-plain' : '') + '" data-id="' + id + '" style="--i:' + Math.min(i, 60) + '">' +
                    (opts.plain ? '' : '<span class="nx-card-rank">' + (i + 1) + '</span>') +
                    // 角标要放进卡图容器里：分值左下、DIY 右下（由 wireDeckImage 塞进同一个容器），两者才对得齐
                    '<span class="nx-card-photo">' +
                        '<img class="nx-card-img" src="' + picOf(id) + '" alt="">' +
                        ((sc && (sc.forbidden || (sc.score || 0) > 0))
                            ? '<span class="nx-deck-score' + (sc.forbidden ? ' is-forbidden' : '') + '">' + (sc.forbidden ? '禁' : sc.score) + '</span>'
                            : '') +
                    '</span>' +
                    '<span class="nx-card-name">' + esc(nm) + '</span>' + stat +
                '</div>';
            }).join('');
            Array.prototype.forEach.call(box.querySelectorAll('.nx-card-tile'), function (tile) {
                var id = parseInt(tile.getAttribute('data-id'), 10) || 0;
                var img = tile.querySelector('.nx-card-img');
                if (img) wireDeckImage(img, tile.querySelector('.nx-card-photo') || tile, id);
                tile.addEventListener('mouseenter', function (ev) { showCardTip(ev, id); });
                tile.addEventListener('mousemove', function (ev) { if (_tipEl && _tipEl.style.display === 'block') positionCardTip(ev, _tipEl); });
                tile.addEventListener('mouseleave', hideCardTip);
                if (opts.onPick) {                       // 组卡页：点卡片直接加入卡组
                    tile.classList.add('is-pickable');
                    tile.addEventListener('click', function (ev) { ev.stopPropagation(); opts.onPick(id); });
                }
            });
        });
    }

    // ── 比赛（战绩 → 比赛）：/api/tournament?slot=swiss|elim ──
    var TOUR_API = '/api/tournament';
    var _tourCache = {};
    function loadTournament(slot) {
        if (_tourCache[slot] !== undefined) return Promise.resolve(_tourCache[slot]);
        return fetch(TOUR_API + '?slot=' + encodeURIComponent(slot) + '&t=' + Date.now())
            .then(function (r) { return r.json(); })
            .then(function (d) { _tourCache[slot] = (d && d.data) || null; return _tourCache[slot]; })
            .catch(function () { _tourCache[slot] = null; return null; });
    }
    function tourNameMap(t) {
        var m = {};
        (t.participants || []).forEach(function (p) { m[p.id] = p.name || ('#' + p.id); });
        return m;
    }
    // 小分（challonge 的 tieBreaker 是放大过的整数，常见为千分之一）
    function fmtTieBreak(v) {
        if (v == null) return '-';
        var n = Number(v);
        if (!isFinite(n)) return '-';
        if (Math.abs(n) >= 1000) return (n / 1000).toFixed(2);
        return String(Math.round(n * 100) / 100);
    }
    function renderMatch(body) {
        var tab = (body.dataset && body.dataset.tab) || 'swiss';
        body.innerHTML = '<div class="nx-deck-loading"><div class="nx-load-rings"><i></i><i></i><i></i></div>' +
            '<div class="nx-load-text">正在读取赛事 <b>0</b></div></div>';
        Promise.all([loadTournament('swiss'), loadTournament('elim')]).then(function (res) {
            var swiss = res[0], elim = res[1];
            if (!swiss && !elim) { body.innerHTML = '<div class="nx-empty">暂时读不到赛事数据</div>'; return; }
            var cur = tab === 'elim' ? (elim || swiss) : (swiss || elim);
            var names = tourNameMap(cur);
            var tabs = [
                { k: 'swiss', label: '瑞士轮', n: swiss ? (swiss.participants || []).length : 0 },
                { k: 'elim', label: '淘汰赛', n: elim ? (elim.participants || []).length : 0 }
            ].map(function (x) {
                return '<button class="nx-stats-tab' + (x.k === tab ? ' is-on' : '') + '" type="button" data-tab="' + x.k + '">' +
                    x.label + '<i>' + x.n + '</i></button>';
            }).join('');
            var statusTxt = { Finished: '已结束', Running: '进行中', Upcoming: '未开始' }[cur.status] || cur.status || '';

            body.innerHTML =
                '<div class="nx-stats-top nx-reveal" style="--i:0">' +
                    '<div class="nx-stats-tabs">' + tabs + '</div>' +
                    '<div class="nx-stats-count">' + esc(cur.name || '赛事') +
                        (statusTxt ? '<i class="nx-tour-status' + (cur.status === 'Running' ? ' is-live' : '') + '">' + esc(statusTxt) + '</i>' : '') +
                    '</div>' +
                '</div>' +
                '<div id="nxMatchBody"></div>';

            var box = document.getElementById('nxMatchBody');
            if (tab === 'elim') paintBracket(box, cur, names);
            else paintSwiss(box, cur, names);
            bindStatsTabs(body, renderMatch);
        });
    }
    // 瑞士轮积分榜：复刻天梯那套列表（含 3D 滚动与居中吸附）
    function paintSwiss(box, t, names) {
        var list = (t.participants || []).slice().sort(function (a, b) {
            var ra = (a.score && a.score.rank) || 999, rb = (b.score && b.score.rank) || 999;
            if (ra !== rb) return ra - rb;
            return ((b.score && b.score.score) || 0) - ((a.score && a.score.score) || 0);
        });
        if (!list.length) { box.innerHTML = '<div class="nx-empty">暂无选手</div>'; return; }
        var rounds = {};
        (t.matches || []).forEach(function (m) { rounds[m.round] = 1; });
        var roundCount = Object.keys(rounds).length;

        box.innerHTML =
            '<div class="nx-tour-meta nx-reveal" style="--i:1">共 <b>' + list.length + '</b> 位选手 · ' +
                '<b>' + roundCount + '</b> 轮 · ' + (t.matches || []).length + ' 场对局</div>' +
            '<div class="nx-list-head nx-reveal" style="--i:2">' +
                '<span>#</span><span>选手</span><span>积分</span><span>战绩</span><span>小分</span><span>状态</span>' +
            '</div>' +
            '<div class="nx-scroll nx-reveal" style="--i:3" id="nxSwissScroll"><div class="nx-list">' +
                list.map(function (p, i) {
                    var s = p.score || {};
                    return '<div class="nx-row nx-item3d" data-player="' + esc(p.name || '') + '">' +
                        '<span class="c-rank">' + (s.rank || (i + 1)) + '</span>' +
                        '<span class="c-name">' + esc(p.name || ('#' + p.id)) + '</span>' +
                        '<span class="c-tier"><span class="nx-tour-score">' + (s.score || 0) + '</span></span>' +
                        '<span class="c-wld">' + (s.win || 0) + '胜 ' + (s.lose || 0) + '负' + (s.draw ? ' ' + s.draw + '平' : '') + '</span>' +
                        '<span class="c-rating">' + fmtTieBreak(s.tieBreaker) + '</span>' +
                        '<span class="c-rate">' + (p.quit ? '退赛' : '') + '</span>' +
                    '</div>';
                }).join('') +
            '</div></div>';
        bindScroll3D(document.getElementById('nxSwissScroll'));
        bindTourRows(box);
    }
    // 淘汰赛对阵图：按轮次分列，组内按 bracketIndex 排序
    function paintBracket(box, t, names) {
        var byRound = {};
        (t.matches || []).forEach(function (m) {
            var r = m.round || 1;
            (byRound[r] = byRound[r] || []).push(m);
        });
        var roundKeys = Object.keys(byRound).map(Number).sort(function (a, b) { return a - b; });
        if (!roundKeys.length) { box.innerHTML = '<div class="nx-empty">暂无对阵</div>'; return; }
        var total = roundKeys.length;
        function roundLabel(r) {
            if (r === total) return '决赛';
            if (r === total - 1) return '半决赛';
            return '第 ' + r + ' 轮';
        }
        box.innerHTML =
            '<div class="nx-tour-meta nx-reveal" style="--i:1">共 <b>' + (t.participants || []).length + '</b> 位选手 · ' +
                '<b>' + roundKeys.length + '</b> 轮 · ' + (t.matches || []).length + ' 场对局</div>' +
            '<div class="nx-bracket nx-reveal" style="--i:2">' +
                roundKeys.map(function (r, ri) {
                    var ms = byRound[r].slice().sort(function (a, b) {
                        return (a.bracketIndex || 0) - (b.bracketIndex || 0);
                    });
                    return '<div class="nx-br-col">' +
                        '<div class="nx-br-col-title">' + roundLabel(r) + '<i>' + ms.length + ' 场</i></div>' +
                        ms.map(function (m) {
                            function side(pid, score, isWinner) {
                                var nm = pid ? (names[pid] || ('#' + pid)) : null;
                                return '<div class="nx-br-side' + (isWinner ? ' is-win' : '') + (nm ? '' : ' is-empty') + '">' +
                                    '<span class="nx-br-name">' + (nm ? esc(nm) : '待定') + '</span>' +
                                    '<span class="nx-br-score">' + (nm && score != null ? score : '') + '</span>' +
                                '</div>';
                            }
                            var done = m.status === 'Finished' || m.status === 'finished';
                            return '<div class="nx-br-match' + (done ? ' is-done' : '') + (m.isThirdPlaceMatch ? ' is-third' : '') + '">' +
                                (m.isThirdPlaceMatch ? '<span class="nx-br-tag">三四名</span>' : '') +
                                side(m.player1Id, m.player1Score, m.winnerId && m.winnerId === m.player1Id) +
                                side(m.player2Id, m.player2Score, m.winnerId && m.winnerId === m.player2Id) +
                            '</div>';
                        }).join('') +
                    '</div>';
                }).join('') +
            '</div>';
    }
    function bindTourRows(box) {
        Array.prototype.forEach.call(box.querySelectorAll('.nx-row[data-player]'), function (r) {
            r.addEventListener('click', function (ev) {
                ev.stopPropagation();
                var n = r.getAttribute('data-player');
                if (n) openPlayerOverlay({ name: n, tier: '赛事选手', rating: '' }, { x: ev.clientX, y: ev.clientY });
            });
        });
    }

    // ── 卡池（卡片 → 卡池）：/api/cards 全量 17k+，分页 + 下钻式分类筛选 ──
    var POOL_PAGE = 120;
    // 分类：怪兽/魔法/陷阱，各自再分子类（子类计数由数据实时统计）
    var POOL_SUBS = {
        '怪兽': ['效果', '通常', '超量', '融合', '连接', '调整', '同调', '灵摆', '特殊召唤', '衍生物', '反转', '仪式', '灵魂', '二重', '同盟', '卡通'],
        '魔法': ['通常', '速攻', '永续', '场地', '装备', '仪式'],
        '陷阱': ['通常', '永续', '反击']
    };
    function poolMatchSub(c, sub) {
        var ti = c.typeInfo || {};
        var st = ti.subTypes || [];
        if (st.indexOf(sub) >= 0) return true;
        // 魔法/陷阱的「通常」是"没有子类标签"；怪兽的「通常」本身就是一个子类标签（上面已命中）
        if (sub === '通常' && ti.baseType !== '怪兽' && st.length === 0) return true;
        return false;
    }
    function renderPool(body) {
        var st = body._pool || (body._pool = { q: '', kind: 'all', sub: '', page: 1, list: null, lensOpen: false });
        body.innerHTML = '<div class="nx-deck-loading"><div class="nx-load-rings"><i></i><i></i><i></i></div>' +
            '<div class="nx-load-text">正在读取卡池 <b>0</b></div></div>';
        loadCardMap().then(function () {
            var all = (_cardList || []).slice().sort(function (a, b) { return a.id - b.id; });
            var kindCount = { 'all': all.length }, subCount = {};
            all.forEach(function (c) {
                var b = (c.typeInfo && c.typeInfo.baseType) || '';
                if (kindCount[b] == null) kindCount[b] = 0;
                kindCount[b]++;
                if (!b) return;
                POOL_SUBS[b].forEach(function (s) { if (poolMatchSub(c, s)) { var k = b + '/' + s; subCount[k] = (subCount[k] || 0) + 1; } });
            });
            function matchKind(c) {
                if (st.kind === 'all') return true;
                if (((c.typeInfo && c.typeInfo.baseType) || '') !== st.kind) return false;
                if (st.sub) return poolMatchSub(c, st.sub);
                return true;
            }
            function filtered() {
                var q = st.q.trim().toLowerCase();
                return all.filter(function (c) {
                    if (!matchKind(c)) return false;
                    if (!q) return true;
                    return String(c.name || '').toLowerCase().indexOf(q) >= 0 || String(c.id).indexOf(q) >= 0;
                });
            }
            // 分类药丸：未选类型时显示「全部 / 怪兽 / 魔法 / 陷阱」；
            // 选定类型后三个大类让位，改成该类型的子类（点「全部」回到大类）
            function chipsHtml() {
                if (st.kind === 'all') {
                    return ['all', '怪兽', '魔法', '陷阱'].map(function (k) {
                        return '<button class="nx-stats-tab' + (k === 'all' ? ' is-on' : '') + '" type="button" data-kind="' + k + '">' +
                            (k === 'all' ? '全部' : k) + '<i>' + (kindCount[k] || 0) + '</i></button>';
                    }).join('');
                }
                var subs = POOL_SUBS[st.kind] || [];
                return '<button class="nx-stats-tab" type="button" data-kind="all">全部</button>' +
                    '<button class="nx-stats-tab' + (st.sub ? '' : ' is-on') + '" type="button" data-kind="' + st.kind + '" data-sub="">' +
                        '全部' + st.kind + '<i>' + (kindCount[st.kind] || 0) + '</i></button>' +
                    subs.filter(function (s) { return subCount[st.kind + '/' + s]; }).map(function (s) {
                        return '<button class="nx-stats-tab' + (st.sub === s ? ' is-on' : '') + '" type="button" data-kind="' + st.kind + '" data-sub="' + s + '">' +
                            s + '<i>' + (subCount[st.kind + '/' + s] || 0) + '</i></button>';
                    }).join('');
            }
            body.innerHTML =
                '<div class="nx-cf-bar nx-pool-bar">' +
                    '<div class="nx-pool-kinds" id="nxPoolKinds">' + chipsHtml() + '</div>' +
                    '<div class="nx-cf-search' + (st.lensOpen || st.q ? ' is-open' : '') + '" id="nxPoolSearchWrap">' +
                        '<button class="nx-cf-lens" id="nxPoolLens" type="button" aria-label="搜索">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
                                '<circle cx="10.4" cy="10.4" r="6.6"></circle><line x1="15.4" y1="15.4" x2="21" y2="21"></line>' +
                            '</svg>' +
                        '</button>' +
                        '<input id="nxPoolSearch" type="text" placeholder="卡名 / 卡号" autocomplete="off" spellcheck="false" value="' + esc(st.q) + '">' +
                        '<button class="nx-cf-clear" id="nxPoolClear" type="button" aria-label="清除" hidden>✕</button>' +
                        '<span class="nx-cf-count" id="nxPoolCount"></span>' +
                    '</div>' +
                '</div>' +
                '<div id="nxPoolGrid"></div>';
            var grid = document.getElementById('nxPoolGrid');
            var wrap = document.getElementById('nxPoolSearchWrap');
            var input = document.getElementById('nxPoolSearch');
            var lens = document.getElementById('nxPoolLens');
            var clearBtn = document.getElementById('nxPoolClear');
            var countEl = document.getElementById('nxPoolCount');

            function suite() { return filtered(); }
            function reset(toPage) { st.page = toPage || 1; paintPage(); }
            function refreshCount(list) {
                if (countEl) countEl.textContent = (list ? list.length : 0) + ' 张';
                if (clearBtn) clearBtn.hidden = !(st.q.trim()) || (wrap && wrap.classList.contains('is-open'));
            }
            function paintPage() {
                st.list = suite();
                refreshCount(st.list);
                renderPagedCards(grid, st.list.map(function (c) { return c.id; }), {
                    per: POOL_PAGE,
                    page: st.page || 1,
                    onGo: function (p) { st.page = p; paintPage(); }
                });
            }
            // 分类下钻：点大类 → 三个大类让位、显示该类型子类；点子类 → 只筛子类；点「全部」→ 回到大类
            function onKindClick(ev) {
                ev.stopPropagation();
                var b = ev.currentTarget;
                var k = b.getAttribute('data-kind');
                var sub = b.getAttribute('data-sub') || '';
                if (k === st.kind && sub === st.sub) return;
                st.kind = k;
                st.sub = sub;
                hideCardTip(true);
                playSfx('click');
                reset(1);
                // 只重画药丸行，避免整屏重建（输入框焦点也保住）
                var row = document.getElementById('nxPoolKinds');
                if (row) { row.innerHTML = chipsHtml(); bindKindChips(); }
            }
            function bindKindChips() {
                Array.prototype.forEach.call(body.querySelectorAll('#nxPoolKinds .nx-stats-tab'), function (b) {
                    b.addEventListener('click', onKindClick);
                });
            }
            bindKindChips();
            // 折叠式搜索（与预组同款交互）
            function poolOpen() { return wrap.classList.contains('is-open'); }
            function poolRefreshClear() { refreshCount(st.list); }
            function closePoolSearch(spin) {
                wrap.classList.remove('is-open');
                st.lensOpen = false;
                if (spin && lens) { lens.classList.remove('is-spin'); void lens.offsetWidth; lens.classList.add('is-spin'); }
                poolRefreshClear();
            }
            if (lens) {
                lens.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    if (!poolOpen()) { wrap.classList.add('is-open'); st.lensOpen = true; poolRefreshClear(); setTimeout(function () { input.focus(); input.select(); }, 80); return; }
                    st.q = input.value || ''; st.lensOpen = false; reset(1); closePoolSearch(true);
                });
            }
            if (clearBtn) {
                clearBtn.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    input.value = ''; st.q = ''; reset(1); poolRefreshClear();
                });
            }
            if (input) {
                var timer = null;
                input.addEventListener('input', function () {
                    clearTimeout(timer);
                    timer = setTimeout(function () { st.q = input.value || ''; reset(1); poolRefreshClear(); }, 180);
                });
                input.addEventListener('keydown', function (ev) {
                    ev.stopPropagation();
                    if (ev.key === 'Enter') { ev.preventDefault(); st.q = input.value || ''; reset(1); closePoolSearch(true); }
                    else if (ev.key === 'Escape') { ev.preventDefault(); st.q = input.value || ''; reset(1); closePoolSearch(false); input.blur(); }
                });
                input.addEventListener('click', function (ev) { ev.stopPropagation(); });
                input.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
            }
            if (wrap) {
                ['pointerdown', 'click'].forEach(function (t) {
                    wrap.addEventListener(t, function () { _nxBarTouchAt = Date.now(); }, true);
                });
            }
            reset(1);
        });
    }

    // ── 卡表（卡片 → 卡表）：解析 lflist.conf 的 #forbidden / #limit / #semi limit ──
    var LFLIST_URL = 'lflist.conf?v=20261007a';
    var _lflistCache = null;
    function loadLflist() {
        if (_lflistCache) return Promise.resolve(_lflistCache);
        return fetch(LFLIST_URL).then(function (r) { return r.text(); }).then(function (txt) {
            var out = { forbidden: [], limit: [], semi: [] };
            var cur = null;
            (txt || '').split(/\r?\n/).forEach(function (line) {
                var low = line.toLowerCase();
                if (low.indexOf('#forbidden') >= 0) { cur = 'forbidden'; return; }
                if (low.indexOf('#limit') >= 0) { cur = 'limit'; return; }
                if (low.indexOf('#semi limit') >= 0 || low.indexOf('#semi-limit') >= 0) { cur = 'semi'; return; }
                if (low.indexOf('#no limit') >= 0) { cur = null; return; }
                if (!cur || line.charAt(0) === '#' || line.charAt(0) === '!' || line.charAt(0) === '$') return;
                var m = line.match(/^(\d+)\s+(\d+)\s*--\s*(.*?)(?:\s+#.*)?$/);
                if (!m) return;
                var id = parseInt(m[1], 10);
                if (!id) return;
                var bucket = out[cur];
                for (var i = 0; i < bucket.length; i++) if (bucket[i].id === id) return;
                bucket.push({ id: id, name: (m[3] || '').trim() });
            });
            _lflistCache = out;
            return out;
        }).catch(function () { _lflistCache = { forbidden: [], limit: [], semi: [] }; return _lflistCache; });
    }
    function renderBanlist(body) {
        var mode = (body.dataset && body.dataset.mode) || 'g';       // g=G表(分值) / ot=OT表(规制)
        var tab = (body.dataset && body.dataset.tab) || 'forbidden';
        var bst = body._ban || (body._ban = { page: 1, q: '', lensOpen: false, names: null });
        body.innerHTML = '<div class="nx-deck-loading"><div class="nx-load-rings"><i></i><i></i><i></i></div>' +
            '<div class="nx-load-text">正在读取卡表 <b>0</b></div></div>';

        function modeTabs(gCount, otCount) {
            return [
                { k: 'g', label: 'G 表 · 分值', n: gCount },
                { k: 'ot', label: 'OT 表 · 规制', n: otCount }
            ].map(function (x) {
                return '<button class="nx-stats-tab' + (x.k === mode ? ' is-on' : '') + '" type="button" data-mode="' + x.k + '">' +
                    x.label + (x.n === '' ? '' : '<i>' + x.n + '</i>') + '</button>';
            }).join('');
        }
        // 顶部：表切换 + 搜索（与卡池/预组同款折叠放大镜）
        function topHtml(gCount, otCount, countHtml) {
            return '<div class="nx-stats-top nx-reveal" style="--i:0">' +
                '<div class="nx-stats-tabs">' + modeTabs(gCount, otCount) + '</div>' +
                '<div class="nx-cf-search' + (bst.lensOpen || bst.q ? ' is-open' : '') + '" id="nxBanSearchWrap">' +
                    '<button class="nx-cf-lens" id="nxBanLens" type="button" aria-label="搜索">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
                            '<circle cx="10.4" cy="10.4" r="6.6"></circle><line x1="15.4" y1="15.4" x2="21" y2="21"></line>' +
                        '</svg>' +
                    '</button>' +
                    '<input id="nxBanSearch" type="text" placeholder="卡名 / 卡号" autocomplete="off" spellcheck="false" value="' + esc(bst.q) + '">' +
                    '<button class="nx-cf-clear" id="nxBanClear" type="button" aria-label="清除" hidden>✕</button>' +
                    '<span class="nx-cf-count">' + countHtml + '</span>' +
                '</div>' +
            '</div>';
        }
        // 搜索绑定（重渲染后自动恢复焦点与光标，边打边筛）
        function bindBanSearch(raw, nameOf) {
            var wrap = document.getElementById('nxBanSearchWrap');
            var input = document.getElementById('nxBanSearch');
            var lens = document.getElementById('nxBanLens');
            var clearBtn = document.getElementById('nxBanClear');
            if (!wrap || !input) return;
            function refreshClear() {
                if (clearBtn) clearBtn.hidden = !bst.q.trim() || bst.lensOpen;
            }
            function doFilter(val) {
                bst.q = val;
                bst.page = 1;
                hideCardTip(true);
                renderBanlist(body);
            }
            if (lens) {
                lens.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    if (!bst.lensOpen && !bst.q) {
                        bst.lensOpen = true;
                        wrap.classList.add('is-open');
                        refreshClear();
                        input.focus();
                        return;
                    }
                    bst.lensOpen = false;
                    lens.classList.remove('is-spin'); void lens.offsetWidth; lens.classList.add('is-spin');
                    doFilter(input.value || '');
                });
            }
            if (clearBtn) {
                clearBtn.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    input.value = '';
                    doFilter('');
                });
            }
            var timer = null;
            input.addEventListener('input', function () {
                clearTimeout(timer);
                timer = setTimeout(function () { doFilter(input.value || ''); }, 220);
            });
            input.addEventListener('keydown', function (ev) {
                ev.stopPropagation();
                if (ev.key === 'Enter') { ev.preventDefault(); clearTimeout(timer); bst.lensOpen = false; doFilter(input.value || ''); }
                else if (ev.key === 'Escape') { ev.preventDefault(); clearTimeout(timer); bst.lensOpen = false; doFilter(input.value || ''); input.blur(); }
            });
            ['click', 'pointerdown'].forEach(function (t) { input.addEventListener(t, function (ev) { ev.stopPropagation(); }); });
            ['pointerdown', 'click'].forEach(function (t) { wrap.addEventListener(t, function () { _nxBarTouchAt = Date.now(); }, true); });
            refreshClear();
            // 重渲染后把焦点和光标位置接回去
            if (bst.lensOpen || bst.q) {
                input.focus();
                try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) { /* 忽略 */ }
            }
        }
        function byQuery(list, nameOf) {
            var q = (bst.q || '').trim().toLowerCase();
            if (!q) return list;
            return list.filter(function (x) {
                var nm = nameOf(x) || '';
                return String(nm).toLowerCase().indexOf(q) >= 0 || String(x.id).indexOf(q) >= 0;
            });
        }

        if (mode === 'g') {
            // G 表：/api/scores 的分值表（禁用的排最前）
            Promise.all([loadScoreMap(), loadCardMap()]).then(function () {
                var arr = Object.keys(_scoreMap || {}).map(function (k) {
                    var s = _scoreMap[k] || {};
                    return { id: parseInt(k, 10), score: s.score || 0, forbidden: !!s.forbidden };
                }).filter(function (x) { return x.id; });
                var lim = _scoreLimit || 100;
                arr.sort(function (a, b) {
                    if (a.forbidden !== b.forbidden) return a.forbidden ? -1 : 1;
                    if (b.score !== a.score) return b.score - a.score;
                    return a.id - b.id;
                });
                var forb = arr.filter(function (x) { return x.forbidden; }).length;
                var shown = byQuery(arr, function (x) { return cardName(x.id); });
                body.innerHTML =
                    topHtml(arr.length, '', '上限 <b>' + lim + '</b> 分 · 禁用 <b>' + forb + '</b> 张') +
                    '<div class="nx-info-hint nx-reveal" style="--i:1">组卡时按每张卡的分值累计，总分不超过上限；标「禁」的卡不能投入</div>' +
                    '<div id="nxBanGrid"></div>';
                renderPagedCards(document.getElementById('nxBanGrid'), shown.map(function (x) { return x.id; }), {
                    per: POOL_PAGE,
                    page: bst.page,
                    onGo: function (p) { bst.page = p; renderBanlist(body); }
                });
                bindBanSearch(arr, function (x) { return cardName(x.id); });
                bindBanlistTabs(body);
            });
            return;
        }

        loadLflist().then(function (d) {
            var tabs = [
                { k: 'forbidden', label: '禁止', n: d.forbidden.length },
                { k: 'limit', label: '限制 1 张', n: d.limit.length },
                { k: 'semi', label: '准限制 2 张', n: d.semi.length }
            ].map(function (x) {
                return '<button class="nx-stats-tab' + (x.k === tab ? ' is-on' : '') + '" type="button" data-tab="' + x.k + '">' +
                    x.label + '<i>' + x.n + '</i></button>';
            }).join('');
            var total = d.forbidden.length + d.limit.length + d.semi.length;
            var list = d[tab] || [];
            var nameMap = {};
            list.forEach(function (x) { if (x.name) nameMap[x.id] = x.name; });
            var nameOf = function (x) { return nameMap[x.id] || cardName(x.id); };
            var shown = byQuery(list, nameOf);
            body.innerHTML =
                topHtml('', total, 'OT 规制共 <b>' + total + '</b> 张受限卡') +
                '<div class="nx-stats-tabs nx-stats-sub nx-reveal" style="--i:1">' + tabs + '</div>' +
                '<div id="nxBanGrid"></div>';
            renderPagedCards(document.getElementById('nxBanGrid'), shown.map(function (x) { return x.id; }), {
                per: POOL_PAGE,
                page: bst.page,
                names: nameMap,
                onGo: function (p) { bst.page = p; renderBanlist(body); }
            });
            bindBanSearch(list, nameOf);
            bindBanlistTabs(body);
        });
    }
    function bindBanlistTabs(body) {
        Array.prototype.forEach.call(body.querySelectorAll('.nx-stats-tab'), function (b) {
            b.addEventListener('click', function (ev) {
                ev.stopPropagation();
                var mk = b.getAttribute('data-mode');
                var tk = b.getAttribute('data-tab');
                var changed = (mk && mk !== ((body.dataset.mode) || 'g')) || (tk && tk !== ((body.dataset.tab) || 'forbidden'));
                if (!changed) return;
                if (mk) body.dataset.mode = mk;
                if (tk) body.dataset.tab = tk;
                if (body._ban) body._ban.page = 1;        // 换表/换档都回到第 1 页
                hideCardTip(true);
                playSfx('click');
                renderBanlist(body);
            });
        });
    }

    // ── 房间（决斗 → 房间）：房间密码代码一览 ────────────────
    var ROOM_CODES = [
        ['（不输入）', 'Genesys-Ext 模式（默认）'],
        ['LF2', 'OT 合表模式'],
        ['NF', '无禁限模式'],
        ['M', '三局两胜 BO3'],
        ['T', '双打模式'],
        ['C', '编年史模式（随机卡组）'],
        ['LP8000', '设置基本分（LP+数字）'],
        ['TM300', '设置回合时限（秒）'],
        ['ST5', '设置开局手卡数'],
        ['DR1', '设置回合抽卡数'],
        ['NS', '不洗切卡组']
    ];
    function renderRoom(body) {
        body.innerHTML =
            '<div class="nx-info-hint nx-reveal" style="--i:0">在房间密码里填下面的代码即可切换规则，' +
                '多个代码用 <b>,</b> 组合，代码后加 <b>#</b> 再接房间名</div>' +
            '<div class="nx-info-list nx-reveal" style="--i:1">' + ROOM_CODES.map(function (x) {
                return '<div class="nx-info-row"><code>' + esc(x[0]) + '</code><span>' + esc(x[1]) + '</span></div>';
            }).join('') + '</div>' +
            '<div class="nx-info-hint nx-reveal" style="--i:2">例：<b>T,C#32</b> = 双打编年史房间，房间名 <b>32</b></div>';
    }

    // ── 下载（决斗 → 下载）：客户端 / 卡包 / 平台 ─────────────
    var DOWNLOADS = [
        { t: 'MDPro3 客户端', h: '夸克网盘', u: 'https://pan.quark.cn/s/ca2e4e7a8c63#/list/share', i: 'download' },
        { t: 'DIY 卡包', h: 'siro.ypk（右键可复制链接）', u: 'https://api.ygopro3.cn/file/siro.ypk', i: 'box' },
        { t: '萌卡平台', h: 'mycard.world', u: 'https://mycard.world/', i: 'globe' }
    ];
    function renderDownload(body) {
        body.innerHTML =
            '<div class="nx-dl-list nx-reveal" style="--i:0">' + DOWNLOADS.map(function (d) {
                return '<a class="nx-dl-row" href="' + esc(d.u) + '" target="_blank" rel="noopener">' +
                    '<span class="nx-dl-icon">' + iconSvg(d.i) + '</span>' +
                    '<span class="nx-dl-texts"><b>' + esc(d.t) + '</b><i>' + esc(d.h) + '</i></span>' +
                    '<span class="nx-dl-go">→</span>' +
                '</a>';
            }).join('') + '</div>' +
            '<div class="nx-info-hint nx-reveal" style="--i:1">卡包放在客户端的 <b>expansions</b> 目录，重启后生效</div>';
    }

    // ── 登录（战绩 → 登录）：读取当前账号状态 ─────────────────
    function renderLogin(body) {
        body.innerHTML = '<div class="nx-deck-loading"><div class="nx-load-rings"><i></i><i></i><i></i></div>' +
            '<div class="nx-load-text">正在读取账号 <b>0</b></div></div>';
        fetch('/api/forum/profile?t=' + Date.now(), { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (p) {
                var u = (p && (p.user || p.profile || p.data)) || p || null;
                var name = u && (u.username || u.name || u.nickname);
                if (!name) throw new Error('未登录');
                body.innerHTML =
                    '<div class="nx-login-card nx-reveal" style="--i:0">' +
                        '<div class="nx-login-row"><span>账号</span><b>' + esc(name) + '</b></div>' +
                        (u.rating != null ? '<div class="nx-login-row"><span>积分</span><b>' + esc(u.rating) + '</b></div>' : '') +
                        (u.tier ? '<div class="nx-login-row"><span>段位</span><b>' + esc(u.tier) + '</b></div>' : '') +
                    '</div>' +
                    '<div class="nx-info-hint nx-reveal" style="--i:1">天梯计分、投稿卡组都会记在这个账号下</div>';
            })
            .catch(function () {
                body.innerHTML =
                    '<div class="nx-info-hint nx-reveal" style="--i:0">还没有登录。<br>登录后可参与天梯计分、投稿卡组与回放。</div>' +
                    '<a class="nx-big-link nx-reveal" style="--i:1" href="index.html?goto=login">打开经典版登录</a>';
            });
    }

    // 分页外壳：上下各一条翻页栏 + 当页卡图网格（供卡池 / 卡表用，避免一次性塞几千个节点）
    function pagerHtml(page, pages, total) {
        return '<div class="nx-pager">' +
            '<button class="nx-page-btn" type="button" data-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>‹ 上一页</button>' +
            '<span class="nx-page-info">第 <b>' + page + '</b> / ' + pages + ' 页 · 共 <b>' + total + '</b> 张</span>' +
            '<button class="nx-page-btn" type="button" data-page="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + '>下一页 ›</button>' +
        '</div>';
    }
    function renderPagedCards(host, ids, opts) {
        opts = opts || {};
        var per = opts.per || 120;
        var pages = Math.max(1, Math.ceil(ids.length / per));
        var page = Math.min(Math.max(1, opts.page || 1), pages);
        var slice = ids.slice((page - 1) * per, page * per);
        host.innerHTML =
            pagerHtml(page, pages, ids.length) +
            '<div class="nx-card-grid" id="nxPagedGrid"></div>' +
            (pages > 1 ? pagerHtml(page, pages, ids.length) : '');
        paintCardTiles(document.getElementById('nxPagedGrid'), slice,
            { plain: true, lazy: true, names: opts.names, onPick: opts.onPick });
        Array.prototype.forEach.call(host.querySelectorAll('.nx-page-btn'), function (b) {
            b.addEventListener('click', function (ev) {
                ev.stopPropagation();
                if (b.disabled) return;
                var p = parseInt(b.getAttribute('data-page'), 10) || 1;
                var body = host.closest ? host.closest('.nx-screen-body') : null;
                if (body) body.scrollTop = 0;          // 翻页后回到顶部
                playSfx('click');
                if (opts.onGo) opts.onGo(p);
            });
        });
        return { page: page, pages: pages };
    }

    // ── 组卡（卡片 → 组卡）：直接移植经典版组卡器 ──
    //    老组卡器（deck-builder.js）自带数据与全部细节功能，这里只负责：
    //    进屏时把它的整块 DOM 搬进内容区并启用其样式，离屏时再放回隐藏宿主。
    function nxBuilderCss(on) {
        ['nxClassicCssBuilder', 'nxClassicCssList', 'nxClassicCssDeckView'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.media = on ? 'all' : 'not all';
        });
    }
    function nxBuilderDetach() {
        var host = document.getElementById('nxBuilderHost');
        var ph = document.getElementById('nxBuilderHome');
        if (host && ph && host.parentNode !== ph) ph.appendChild(host);
        if (host) host.hidden = true;
        nxBuilderCss(false);
    }
    function renderBuilder(body) {
        var host = document.getElementById('nxBuilderHost');
        if (!host) { body.innerHTML = '<div class="nx-empty">组卡器未载入</div>'; return; }
        nxBuilderCss(true);
        host.hidden = false;
        body.innerHTML = '';
        body.appendChild(host);                     // 整块搬进来：状态、事件、内部滚动都原样保留
        // 老组卡器是被"组卡模式"按钮激活的，这里替它点一下
        try {
            if (window.DeckBuilder) window.DeckBuilder.enable();
            else {
                var tg = document.getElementById('deckBuilderToggle');
                if (tg) tg.click();
            }
        } catch (e) { /* 忽略 */ }
        // 老样式里有些绝对定位/滚动假设，套进新屏幕后补一点容器样式
        var layout = document.getElementById('dbLayout');
        if (layout) layout.style.display = '';
    }

    // ── 历届八强（战绩 → 比赛 → 打开历届八强）：数据 decks/decks_data.json ──
    //    呈现方式对齐预组屏：扇形卡图 + 玩家/卡组名 + 张数，点开走同一套卡组视图（openDeckView）
    var EIGHT_URL = 'decks/decks_data.json?v=20261007z2';
    var _eightCache = null;
    function loadEightDecks() {
        if (_eightCache) return Promise.resolve(_eightCache);
        return fetch(EIGHT_URL)
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var list = (d && d.tournaments) || [];
                // 最新一届排最前（folder 即届次编号，按数字倒序；没有 folder 的按原顺序垫后）
                list = list.slice().sort(function (a, b) {
                    var na = parseInt(a.folder, 10), nb = parseInt(b.folder, 10);
                    if (isNaN(na) && isNaN(nb)) return 0;
                    if (isNaN(na)) return 1;
                    if (isNaN(nb)) return -1;
                    return nb - na;
                });
                _eightCache = list;
                return _eightCache;
            })
            .catch(function () { _eightCache = []; return _eightCache; });
    }
    function deckScoreOf(deck) {
        var t = 0;
        ['main', 'extra', 'side'].forEach(function (k) {
            (deck[k] || []).forEach(function (id) {
                var s = _scoreMap && _scoreMap[id];
                if (s && !s.forbidden) t += (s.score || 0);
            });
        });
        return t;
    }
    function renderEight(body) {
        var st = body._eight || (body._eight = { ti: 0 });
        body.innerHTML = '<div class="nx-deck-loading"><div class="nx-load-rings"><i></i><i></i><i></i></div>' +
            '<div class="nx-load-text">正在读取历届八强 <b>0</b></div></div>';
        Promise.all([loadEightDecks(), loadScoreMap(), loadCardMap()]).then(function (res) {
            var tours = res[0] || [];
            if (!tours.length) { body.innerHTML = '<div class="nx-empty">暂无八强卡组数据</div>'; return; }
            var ti = Math.max(0, Math.min(tours.length - 1, st.ti || 0));
            var tour = tours[ti];
            var decks = tour.decks || [];
            var lim = _scoreLimit || 100;

            body.innerHTML =
                '<div class="nx-stats-top nx-reveal" style="--i:0">' +
                    '<div class="nx-stats-tabs nx-eight-tours">' + tours.map(function (x, i) {
                        return '<button class="nx-stats-tab' + (i === ti ? ' is-on' : '') + '" type="button" data-ti="' + i + '">' +
                            esc(x.name || ('第 ' + (i + 1) + ' 届')) + '<i>' + ((x.decks || []).length) + '</i></button>';
                    }).join('') + '</div>' +
                    '<div class="nx-stats-count">共 <b>' + decks.length + '</b> 套八强卡组</div>' +
                '</div>' +
                '<div class="nx-eight-grid">' + decks.map(function (d, i) {
                    var fan = (d.main || []).slice(0, 3);
                    if (!fan.length) fan = [0];
                    var sc = deckScoreOf(d);
                    // 大字＝卡组名，小字＝选手名（没有卡组名时大字用选手名）
                    var big = d.deckName || d.player || d.displayName || ('第 ' + (i + 1) + ' 名');
                    var small = d.deckName ? (d.player || '') : '';
                    return '<button class="nx-eight-card" type="button" data-hi="' + i + '" style="--i:' + i + '">' +
                        '<span class="nx-eight-fan">' +
                            // 后画的在下层：c2 → c1 → c0（封面）
                            [2, 1, 0].map(function (k) {
                                var cid = fan[k] || fan[0] || 0;
                                return '<img class="nx-eight-img nx-eight-c' + k + '" data-cid="' + cid + '" src="' + PIC_CHAIN[0] + cid + '.jpg" loading="lazy" alt="">';
                            }).join('') +
                        '</span>' +
                        '<span class="nx-eight-rank">' + (i + 1) + '</span>' +
                        '<span class="nx-eight-name">' + esc(big) + '</span>' +
                        (small ? '<span class="nx-eight-sub">' + esc(small) + '</span>' : '') +
                        '<span class="nx-eight-meta">主 ' + (d.main || []).length +
                            ' · 额外 ' + (d.extra || []).length +
                            ((d.side || []).length ? ' · 副 ' + d.side.length : '') +
                            ' · <b class="' + (sc > lim ? 'is-over' : '') + '">' + sc + '</b>/' + lim + '</span>' +
                    '</button>';
                }).join('') + '</div>';

            // 卡图三级兜底（与预组同款）
            Array.prototype.forEach.call(body.querySelectorAll('.nx-eight-card'), function (card) {
                Array.prototype.forEach.call(card.querySelectorAll('.nx-eight-img'), function (img) {
                    var cid = parseInt(img.getAttribute('data-cid'), 10) || 0;
                    wireDeckImage(img, card.querySelector('.nx-eight-fan') || card, cid);
                });
            });
            // 点开 → 与预组相同的卡组视图
            Array.prototype.forEach.call(body.querySelectorAll('.nx-eight-card'), function (card) {
                card.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    var d = decks[parseInt(card.getAttribute('data-hi'), 10) || 0];
                    if (!d) return;
                    playSfx('click');
                    var title = d.deckName || d.player || d.displayName || '八强卡组';
                    var sub = [tour.name || '历届八强', d.player, d.deckName].filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(' · ');
                    openDeckView(d, title, sub, '历届八强 · 主 ' + (d.main || []).length + ' 张');
                });
            });
            // 换届
            Array.prototype.forEach.call(body.querySelectorAll('.nx-eight-tours .nx-stats-tab'), function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    var i = parseInt(b.getAttribute('data-ti'), 10) || 0;
                    if (i === ti) return;
                    st.ti = i;
                    hideCardTip(true);
                    playSfx('click');
                    renderEight(body);
                });
            });
        });
    }

    var RENDERERS = { ladder: renderLadder, preset: renderPreset, popular: renderPopular, match: renderMatch, pool: renderPool, banlist: renderBanlist, room: renderRoom, download: renderDownload, login: renderLogin, builder: renderBuilder, eight: renderEight };

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
            // 关键：用「原位中心」而不是含偏移的当前中心，避免力←→位置的自反馈振荡。
            // 用元素自身的矩形减去当前位移来求原位中心 —— 这样浮层里(固定定位)的线圈也算得对，
            // 主菜单里 stage+offsetLeft 的旧算法等价于此。
            var rc = b.getBoundingClientRect();
            var cx = rc.left + rc.width / 2 - ((b._mx || 0) + (b._tx || 0));
            var cy = rc.top + rc.height / 2 - ((b._my || 0) + (b._ty || 0));
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
                var ar = A.getBoundingClientRect(), br = B.getBoundingClientRect();
                var ax = ar.left + ar.width / 2, ay = ar.top + ar.height / 2;   // 含位移的当前中心
                var bx = br.left + br.width / 2, by = br.top + br.height / 2;
                var ux = bx - ax, uy = by - ay;
                var dd = Math.sqrt(ux * ux + uy * uy) || 0.001;
                var minD = (ar.width + br.width) / 2 + MAG.gap;
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
        // 离开功能屏：组卡屏要把移植来的老组卡器整块放回隐藏宿主（连带关掉它的样式）
        if (screenEl && screenEl.dataset.screen === 'builder' && screenEl.hidden === false && typeof nxBuilderDetach === 'function') nxBuilderDetach();
        // 离开功能屏：蓝黑主题也跟着退场（背景渐变淡回红黑）
        if (screenEl && screenEl.dataset.screen === 'eight') nxBlueTheme(false);
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
    // 防误触：预组顶部那条工具带（字母索引 + 搜索）整体不参与返回，
    //         并且刚从那条带子上点过（260ms 内）也不算"点空白"，避免放大的触点被误判成返回。
    document.addEventListener('click', function (ev) {
        if (busy) return;
        if (document.body.classList.contains('nx-boot')) return;   // 开场期间不响应
        if (historyStack.length <= 1) return;                      // 没有上一步
        // 功能屏同样支持点空白返回（已无返回按钮）
        var t = ev.target;
        // 目标已被事件处理器从 DOM 里摘掉（例如组卡器点卡片上的 × 移除该卡）：
        // 此时 closest() 已经走不到祖先，会被误判成"点空白"，这里直接放行。
        if (t && t.nodeType === 1 && !document.contains(t)) return;
        // 注意：功能屏里的"信息型/移植型"元素（卡片瓦片、对阵块、分页栏、信息行…）都是 div/a 之上还有大片可点区域，
        // 点它们不该被当成"点空白"，否则点一张卡就会退回上一层。
        // #dbLayout / #nxBuilderHost 是整块移植过来的经典版组卡器，它内部凡可点处都不参与返回判定。
        if (t && t.closest && t.closest(
            'button, a, input, select, textarea, label,' +
            ' .nx-option, .nx-cta, .nx-dbg-btn, .nx-version, .nx-debug, .nx-row, .nx-pov, .nx-cf-bar,' +
            ' .nx-card-grid, .nx-card-tile, .nx-pager, .nx-info-list, .nx-info-row, .nx-dl-list,' +
            ' .nx-br-match, .nx-bracket, .nx-login-card, .nx-login-row, .nx-stats-top, .nx-stats-tabs,' +
            ' .nx-tour-meta, .nx-group-chips, .nx-screen-todo,' +
            ' #dbLayout, #nxBuilderHost, .deck-builder-panel, .db-panel, .db-card, .db-cards,' +
            ' .deck-viewer-modal-overlay, .deck-viewer-modal, .card-img-wrapper, .clipboard-toast'
        )) return;
        if (Date.now() - _nxBarTouchAt < 260) return;               // 刚碰过工具带，视为误触
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
