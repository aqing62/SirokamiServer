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

    // ── 问答树：每个节点最多 3 个选项；answer=结果节点 ──
    var FLOW = {
        root: {
            q: '你今天想做什么？',
            hint: '一步一步来，我会带你到对应功能',
            options: [
                { icon: 'cards', label: '打牌', sub: '进服对局', next: 'play' },
                { icon: 'layers', label: '组卡', sub: '卡组编辑', next: 'deck' },
                { icon: 'chart', label: '看战绩', sub: '天梯 / 榜单', next: 'stats' }
            ]
        },

        // ── 打牌 ──
        play: {
            q: '想怎么打？',
            hint: '三种模式规则不同，按你的目的选',
            options: [
                { icon: 'bolt', label: '天梯匹配', sub: '计分 / 上分', next: 'r_ladder' },
                { icon: 'house', label: '和朋友开房', sub: '娱乐 / 不计分', next: 'r_room' },
                { icon: 'book', label: '编年史', sub: '随机卡组', next: 'r_chronicle' }
            ]
        },
        r_ladder: {
            q: '打天梯',
            hint: '这是全服积分赛，赢了加分、输了不扣（投降会扣）',
            steps: [
                '进游戏后选 <b>M#</b> 房间（或随机匹配），<b>双方都要登录</b>官网账号',
                '系统会提示 <b>「天梯对局已生效」</b>，本局胜负计入积分',
                '胜利 <b>+10</b>、每日首胜 <b>+2</b>；当天第 N 次投降扣 N 分',
                '打满 <b>5 场定级赛</b> + 遇到 <b>3 名不同对手</b>，才会出现在排行榜'
            ],
            cta: [
                { icon: 'bracket', label: '打开比赛相关', goto: 'tournament' },
                { icon: 'chart', label: '看我的排名', goto: 'ranking' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },
        r_room: {
            q: '和朋友开房',
            hint: '自定义房间，不计天梯分，适合试卡组',
            steps: [
                '建房时在<b>房间名/密码</b>填规则代码：<b>M</b>=三局两胜、<b>T</b>=双打、<b>LP8000</b>=改基本分',
                '不填代码就是默认 <b>Genesys-Ext</b> 模式（禁卡表按 G-Ext 分值，卡组总分 ≤100）',
                '想玩随机卡组就用 <b>C</b>（编年史模式）'
            ],
            cta: [
                { icon: 'house', label: '查房间代码', goto: 'chronicle' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },
        r_chronicle: {
            q: '编年史模式',
            hint: '双方随机分配卡组，纯拼操作',
            steps: [
                '建房用 <b>C</b> 代码（可组合：<b>T,C#32</b> = 双打编年史）',
                '服务器随机发卡组，就位后<b>直接开打</b>',
                '想先看看有哪些卡组可以去经典版「编年史卡组池」翻'
            ],
            cta: [
                { icon: 'book', label: '看卡组池', goto: 'chronicle' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },

        // ── 组卡 ──
        deck: {
            q: '组卡这边你想干嘛？',
            hint: 'G-Ext 卡组总分上限 100 分',
            options: [
                { icon: 'build', label: '从零组一套', sub: '组卡模式', next: 'r_build' },
                { icon: 'gauge', label: '查卡片分值', sub: '禁限分值', next: 'r_score' },
                { icon: 'copy', label: '抄别人的卡组', sub: '投稿 / 八强', next: 'r_ref' }
            ]
        },
        r_build: {
            q: '组卡模式',
            hint: '搜卡 → 点一下看详情 → 再点一下加入卡组',
            steps: [
                '左侧详情区：<b>点第一下看详情，再点一下直接加入</b>（额外怪兽自动进额外卡组）',
                '<b>🔗 相关卡片</b>：按效果里「」关键词 + 同字段（系列）搜索，找配合更省事',
                '搜索框支持<b>空格分隔多关键词</b>（如 <code>真红眼 融合</code> = 同时包含两者）',
                '右侧 <b>⚙ 筛选</b> 按类型/属性/种族/攻守/分值筛选，<b>清空</b>一键还原'
            ],
            cta: [
                { icon: 'build', label: '打开组卡模式', goto: 'deck' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },
        r_score: {
            q: '卡片分值（禁限分值）',
            hint: '本服默认 GeneSys-Ext 禁卡表',
            steps: [
                '分值越高越强：卡组里所有卡的 G-Ext 分值<b>总和不能超过 100</b>',
                '标 <b>🚫</b> 的是禁止使用；<b>-1</b> 也表示禁卡',
                '<b>同名卡分值合并</b>：异画、同名补充卡按原卡计分'
            ],
            cta: [
                { icon: 'gauge', label: '查禁限分值', goto: 'cards' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },
        r_ref: {
            q: '参考别人的卡组',
            hint: '三个来源，都是实战卡组',
            steps: [
                '<b>编年史卡组池</b>：按首字母分组、可搜索，投稿卡组会突出显示',
                '<b>历届八强</b>：往届比赛的上位卡组（在「比赛相关」右上角）',
                '<b>天梯胜者卡组</b>：在游戏内用 <code>/winnerdeck 玩家名</code> 查看'
            ],
            cta: [
                { icon: 'book', label: '打开卡组池', goto: 'chronicle' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },

        // ── 看战绩 ──
        stats: {
            q: '想看哪方面的战绩？',
            hint: '榜单/对局/回放都在这里',
            options: [
                { icon: 'chart', label: '天梯排名', sub: '段位 / 积分', next: 'r_rank' },
                { icon: 'play', label: '看回放', sub: '复盘对局', next: 'r_replay' },
                { icon: 'bracket', label: '比赛相关', sub: '八强 / 对局', next: 'r_tour' }
            ]
        },
        r_rank: {
            q: '天梯排名',
            hint: '当前是 S3 赛季（每赛季一个月，月末结算发称号）',
            steps: [
                '榜上按积分排序，段位按<b>活跃玩家百分比</b>：巅峰 / 大师 8% / 钻石 18% / 黄金 35% / 白银 60%',
                '要上榜需<b>打完 5 场定级赛</b> + <b>遇到 3 名不同对手</b>（未满足时 <code>/rating</code> 会提示还差多少）',
                '积分 ≥150 可开通<b>投稿 DIY 卡</b>资格'
            ],
            cta: [
                { icon: 'chart', label: '打开排行榜', goto: 'ranking' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },
        r_replay: {
            q: '回放',
            hint: '输入回放码即可复盘，手机端上=画面、下=日志',
            steps: [
                '回放码形如 <b>R#3801</b>：在个人对局记录、论坛、比赛页都能看到',
                '播放器支持 <b>0.5x ~ 4x</b> 变速、逐步前进/后退、拖动进度条跳转',
                '会自动演出发动/召唤/攻击特效，并标注表示形式变化'
            ],
            cta: [
                { icon: 'play', label: '打开回放播放器', goto: 'replay' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        },
        r_tour: {
            q: '比赛相关',
            hint: '瑞士轮 + 淘汰赛两块，上方滑块切换',
            steps: [
                '<b>瑞士轮</b>：当前排名、每轮对阵、晋级线（前 8 名）',
                '<b>淘汰赛</b>：瑞士轮打完后才会生成对阵图（未生成时显示「待公布」）',
                '右上角还有 <b>历届八强</b>（往届卡组）和 <b>当前对局</b>（服务器实时房间）'
            ],
            cta: [
                { icon: 'bracket', label: '打开比赛相关', goto: 'tournament' },
                { icon: 'undo', label: '重新选', back: true }
            ]
        }
    };

    // ── DOM ──
    var stage = document.getElementById('nxStage');
    var qEl = document.getElementById('nxQuestion');
    var optEl = document.getElementById('nxOptions');
    var resEl = document.getElementById('nxResult');
    var stepsEl = document.getElementById('nxSteps');
    var ctaEl = document.getElementById('nxCta');
    var backEl = document.getElementById('nxBack');
    var verEl = document.getElementById('nxVersion');

    var historyStack = [];   // 走过的节点（用于返回 + 面包屑）
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
            var pullTerm = pullAmt * 0.52 * Math.cos(a - pullDir);   // 0.52 = 最大甩长比例（与 MAG.dragMax 一致）
            var rr = radius * (1
                + wobble * Math.sin(a * 3 + seed) * 0.62
                + wobble * Math.cos(a * 2 + seed * 1.7) * 0.34
                + wobble * Math.sin(a * 5 + seed * 2.3) * 0.16
                + pullTerm);
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
        { cls: 'nxb1', r: 51, seed: 0.7, pts: 10, wob: 0.055, msp: 0.50, mph: 0.0 },
        { cls: 'nxb2', r: 49, seed: 2.1, pts: 12, wob: 0.072, msp: -0.66, mph: 1.7 },
        { cls: 'nxb3', r: 47, seed: 3.9, pts: 11, wob: 0.088, msp: 0.84, mph: 3.1 },
        { cls: 'nxb4', r: 45, seed: 5.4, pts: 13, wob: 0.104, msp: -1.02, mph: 4.6 }
    ];

    function ringSvg(gold) {
        var cls = 'nx-ring' + (gold ? ' nx-ring-gold' : '');
        var inner = RING_LAYERS.map(function (L) {
            return '<g class="nx-rot">'
                + '<path class="' + L.cls + '" d="' + blobPath(L.r, L.seed, L.pts, L.wob) + '"'
                + ' data-r="' + L.r + '" data-seed="' + L.seed + '" data-pts="' + L.pts + '"'
                + ' data-wob="' + L.wob + '" data-msp="' + L.msp + '" data-mph="' + L.mph + '"></path>'
                + '</g>';
        }).join('');
        return '<svg class="' + cls + '" viewBox="0 0 120 120" aria-hidden="true">' + inner + '</svg>';
    }


    // ── 活体变形：形状持续改变（抖动相位缓慢游走 + 抖动幅度起伏呼吸） ──
    var _blobs = [];
    var _blobLast = 0;
    var _tickLast = 0;   // 上一帧时间戳（算 dt）
    var _pullTickId = 0; // 帧号（用于每帧只算一次拉拽）
    var _breathT = 0;    // 呼吸相位累加器（只按运行时间增长）


    // ── 磁吸跟随 + 相互规避 ──────────────────────────────────
    // 按钮被光标"黏住"：靠近时轻微跟手，光标移远（超过 release 距离）才脱离；
    // 按钮之间保持最小间距，互相推开避免重叠。位移用 translate 属性，不影响 transform。
    var MAG = { stick: 130, release: 240, maxPull: 38, ease: 0.16, gap: 14, repK: 0.5,
                dragR: 380,      // 拉拽作用半径（指针在此范围内移动才影响该按钮）
                speedRef: 650,   // 达到此速度(px/s)即满强度（普通鼠标速度就能触发）
                dragMax: 0.52,   // 最大甩长比例（沿运动方向拉长）
                velEase: 0.35,   // 指针速度平滑
                dragEase: 0.16 };// 形变自身的缓动（产生拖尾滞后）
    var _magBtns = [];
    var _magPx = null, _magPy = null;
    var _magLast = 0;
    var _magVx = 0, _magVy = 0;              // 平滑后的指针速度 px/s
    var _magSample = null;                   // 待处理的指针采样
    var _magPrevPx = null, _magPrevPy = null, _magPrevT = 0;

    function bindMagnet(btn) {
        btn._mx = 0; btn._my = 0;
        btn._stuck = false;
        btn._rx = 0; btn._ry = 0;
        btn._tx = 0; btn._ty = 0;
        if (_magBtns.indexOf(btn) === -1) _magBtns.push(btn);
    }

    function resetMagnet() { _magBtns = []; }

    function magTick(now) {
        requestAnimationFrame(magTick);

    // 尺寸变化时重算问句上移量（延迟到布局稳定）
    var _liftTimer = 0;
    window.addEventListener('resize', function () {
        clearTimeout(_liftTimer);
        _liftTimer = setTimeout(layoutQuestionLift, 120);
    });
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
            _magVx *= 0.90; _magVy *= 0.90;      // 鼠标停下 → 甩长自然回弹（约 0.3~0.4s）
            if (Math.abs(_magVx) < 2) _magVx = 0;
            if (Math.abs(_magVy) < 2) _magVy = 0;
        }

        var stageRect = stage.getBoundingClientRect();

        // 1) 目标偏移：磁吸（带滞回，靠近才吸、走远才松）
        for (var i = 0; i < _magBtns.length; i++) {
            var b = _magBtns[i];
            b._rx = 0; b._ry = 0;
            if (!b.parentNode) { b._tx = 0; b._ty = 0; continue; }
            var cx = stageRect.left + b.offsetLeft + b.offsetWidth / 2 + b._mx;
            var cy = stageRect.top + b.offsetTop + b.offsetHeight / 2 + b._my;
            var tx = 0, ty = 0;
            if (_magPx !== null) {
                var dx = _magPx - cx, dy = _magPy - cy;
                var d = Math.sqrt(dx * dx + dy * dy);
                if (b._stuck) { if (d > MAG.release) b._stuck = false; }
                else if (d < MAG.stick) b._stuck = true;
                if (b._stuck) {
                    // 越近拉得越紧（0.18~0.5），并限制最大位移
                    var k = 0.5 * Math.min(1, MAG.stick / Math.max(48, d));
                    tx = dx * k; ty = dy * k;
                    var m = Math.sqrt(tx * tx + ty * ty);
                    if (m > MAG.maxPull) { tx = tx / m * MAG.maxPull; ty = ty / m * MAG.maxPull; }
                }
            }
            b._tx = tx; b._ty = ty;
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

        // 3) 平滑趋近目标 + 写回 translate 变量
        for (var q = 0; q < _magBtns.length; q++) {
            var o = _magBtns[q];
            if (!o.parentNode) continue;
            var goalX = o._tx + o._rx, goalY = o._ty + o._ry;
            var step = Math.min(1, MAG.ease * (dt * 60));
            o._mx += (goalX - o._mx) * step;
            o._my += (goalY - o._my) * step;
            if (Math.abs(o._mx) < 0.02 && Math.abs(goalX) < 0.02) o._mx = 0;
            if (Math.abs(o._my) < 0.02 && Math.abs(goalY) < 0.02) o._my = 0;
            o.style.setProperty('--mx', o._mx.toFixed(2) + 'px');
            o.style.setProperty('--my', o._my.toFixed(2) + 'px');
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
    requestAnimationFrame(magTick);
    function collectBlobs() {
        _blobs = Array.prototype.slice.call(document.querySelectorAll('.nx-ring path[data-blob-ready]'));
    }

    function blobTick(now) {
        requestAnimationFrame(blobTick);
        var animOff = document.documentElement.classList.contains('nx-anim-off');
        if (animOff || document.hidden) { _blobLast = now; return; }   // 关动效/后台标签页时不做计算
        if (now - _blobLast < 32) return;                              // 约 30fps
        _blobLast = now;
        // 逐帧时间差：单帧最大 100ms（切后台/隐藏回来不会一次性补算）
        if (!_tickLast) _tickLast = now;
        var dt = Math.min(0.1, (now - _tickLast) / 1000);
        _tickLast = now;
        _breathT += dt;
        var _pullTick = ++_pullTickId;                 // 每帧只算一次拉拽向量
        var _srect = _magPx !== null ? stage.getBoundingClientRect() : null;   // 呼吸相位也只按运行时间累加

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
            var reg = 0;
            var pull = 0, pullAng = 0;
            if (owner) {
                // 拉拽：按钮视觉中心 → 光标 的方向，越近越强（缓动，避免抖动）
                if (owner._pullStamp !== _pullTick) {      // 同一按钮的 4 层只算一次
                    owner._pullStamp = _pullTick;
                    var tgDx = 0, tgDy = 0;
                    var vsp = Math.sqrt(_magVx * _magVx + _magVy * _magVy);
                    if (_srect && owner.parentNode && vsp > 12) {
                        // 靠近程度：指针离按钮越近，甩长越明显
                        var ocx = _srect.left + owner.offsetLeft + owner.offsetWidth / 2 + (owner._mx || 0);
                        var ocy = _srect.top + owner.offsetTop + owner.offsetHeight / 2 + (owner._my || 0);
                        var pdx = _magPx - ocx, pdy = _magPy - ocy;
                        var pd = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
                        var prox = Math.max(0, Math.min(1, (MAG.dragR - pd) / MAG.dragR));
                        var sf = Math.min(1, vsp / MAG.speedRef);
                        var amt = prox * sf;                  // 0~1（线性，更容易看出效果）
                        tgDx = (_magVx / vsp) * amt;          // 方向 = 指针移动方向
                        tgDy = (_magVy / vsp) * amt;
                    }
                    owner._dux = (owner._dux || 0) + (tgDx - (owner._dux || 0)) * MAG.dragEase;
                    owner._duy = (owner._duy || 0) + (tgDy - (owner._duy || 0)) * MAG.dragEase;
                }
                var pmag = Math.sqrt((owner._dux || 0) * (owner._dux || 0) + (owner._duy || 0) * (owner._duy || 0));
                if (pmag > 0.001) { pull = Math.min(1, pmag); pullAng = Math.atan2(owner._duy || 0, owner._dux || 0); }
                else { pull = 0; }
                if (owner._nxReg === undefined) owner._nxReg = 0;
                if (owner._nxRegTarget === undefined) owner._nxRegTarget = 0;
                owner._nxReg += (owner._nxRegTarget - owner._nxReg) * 0.085;

                if (Math.abs(owner._nxRegTarget - owner._nxReg) < 0.002) owner._nxReg = owner._nxRegTarget;
                reg = owner._nxReg;
            }
            // 相位逐帧累加（关键：不用绝对时间，避免暂停后恢复时“补算”导致突然飞快）
            if (p._nxPhase === undefined) p._nxPhase = mph;
            p._nxPhase += msp * (1 - reg * 0.85) * dt;
            // 抖动幅度呼吸 + 按规整度收敛为正圆（只变圆，不回到初始形状）
            var amp = wob * (0.62 + 0.5 * Math.sin(_breathT * 0.5 + mph * 1.3)) * (1 - reg);
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

    // 标记可变形路径并启动循环（渲染后调用）
    function startBlobMorph() {
        resetMagnet();
        var btns = document.querySelectorAll('.nx-option, .nx-cta');
        for (var bi = 0; bi < btns.length; bi++) bindMagnet(btns[bi]);
        var list = document.querySelectorAll('.nx-ring path');
        for (var i = 0; i < list.length; i++) list[i].setAttribute('data-blob-ready', '1');
        collectBlobs();
    }
    requestAnimationFrame(blobTick);

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

    var _deferOptions = false;   // 开场期间：等打字机打完再出按钮
    var _afterTyped = null;      // 打字完成后的自定义收尾（开场：先滑回常态位再出按钮）

    function buildOptions(node) {
        optEl.hidden = false;
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
        backEl.hidden = historyStack.length <= 1;
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
        backEl.hidden = historyStack.length <= 1;

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
                if (c.back) { setTimeout(goBack, 140); return; }
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



    backEl.addEventListener('click', goBack);

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
