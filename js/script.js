/**
 * 白神服Sirokami — 导航控制 + 懒初始化
 * 单页应用：所有section在index.html中，侧边栏切换显示
 */

// ── 初始化标记 ──────────────────────────────────────────
const _inited = {};

// ── 样式表映射 ──────────────────────────────────────────
const CSS_MAP = {
    'section-main':       [],
    'section-card-list':  ['css-card-list'],
    'section-card-pool':  ['css-card-pool', 'css-new-cards'],
    'section-eight-decks':['css-eight-decks'],
    'section-xiaobai':    ['css-xiaobai'],
};

// ── Section 切换 ────────────────────────────────────────
function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');

    // 动态启停样式表
    document.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
        if (l.id !== 'css-style') l.media = 'not all';
    });
    (CSS_MAP[sectionId] || []).forEach(id => {
        const link = document.getElementById(id);
        if (link) link.media = 'all';
    });

    // 侧边栏：主页始终显示，子页隐藏（鼠标靠近右边缘滑出）
    const sidebar = document.getElementById('sidebar');
    const trigger = document.getElementById('sidebarTrigger');
    if (sectionId === 'section-main') {
        sidebar.classList.remove('hidden');
        trigger.style.display = 'none';
    } else {
        sidebar.classList.add('hidden');
        trigger.style.display = 'block';
    }

    // 返回按钮动画重播
    const backBtn = target.querySelector('.back-btn');
    if (backBtn) {
        backBtn.classList.remove('animate-in');
        void backBtn.offsetWidth;
        backBtn.classList.add('animate-in');
    }

    // 懒初始化
    lazyInit(sectionId);
}

// ── 侧边栏悬停滑出 ──────────────────────────────────────
(function () {
    let hoverTimer = 0;
    const sidebar = document.getElementById('sidebar');
    const trigger = document.getElementById('sidebarTrigger');
    if (!sidebar || !trigger) return;

    function showSidebar() {
        clearTimeout(hoverTimer);
        sidebar.classList.remove('hidden');
    }
    function hideSidebar() {
        // 主页永远不收起
        const main = document.getElementById('section-main');
        if (main && main.classList.contains('active')) return;
        // 子页触发区不可见时也不收起
        if (trigger.style.display === 'none') return;
        if (!sidebar.classList.contains('hidden')) {
            hoverTimer = setTimeout(() => {
                if (!sidebar.matches(':hover') && !trigger.matches(':hover')) {
                    sidebar.classList.add('hidden');
                }
            }, 500);
        }
    }

    trigger.addEventListener('mouseenter', showSidebar);
    sidebar.addEventListener('mouseenter', showSidebar);
    trigger.addEventListener('mouseleave', hideSidebar);
    sidebar.addEventListener('mouseleave', hideSidebar);
})();

function lazyInit(sectionId) {
    if (_inited[sectionId]) return;
    _inited[sectionId] = true;

    switch (sectionId) {
        case 'section-card-list':
            if (typeof initCardListModule === 'function') initCardListModule();
            break;
        case 'section-card-pool':
            if (typeof initCardPoolModule === 'function') initCardPoolModule();
            break;
        case 'section-eight-decks':
            if (typeof initEightDecksModule === 'function') initEightDecksModule();
            break;
        case 'section-xiaobai':
            initXiaobaiModule();
            break;
    }
}

// ── 全局滚轮缓动 ──────────────────────────────────────
(function () {
    let target = window.scrollY;
    let current = target;
    let animating = false;

    window.addEventListener('wheel', function (e) {
        // 手机端交给原生滚动
        if (window.innerWidth <= 768) return;
        // 如果事件来自模态框或可滚动弹窗内，交给原生滚动处理
        const el = e.target.closest('.new-cards-grid, .new-cards-overlay, .filter-modal, .pool-filter-overlay, .filter-popup, .mobile-open');
        if (el) return;
        e.preventDefault();
        target += e.deltaY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        target = Math.max(0, Math.min(target, max));
        if (!animating) {
            animating = true;
            requestAnimationFrame(step);
        }
    }, { passive: false });

    function step() {
        // 缓动插值 (ease-out)
        current += (target - current) * 0.12;
        window.scrollTo(0, Math.round(current));
        if (Math.abs(target - current) > 0.5) {
            requestAnimationFrame(step);
        } else {
            current = target;
            window.scrollTo(0, target);
            animating = false;
        }
    }
})();

// ── 桌面端入场动画控制器 ──────────────────────────────
function runIntroAnimation() {
    var overlay = document.getElementById('intro-overlay');
    var mainContent = document.querySelector('.main-content');
    var logoImg = mainContent.querySelector('.logo-img');
    var titleH1 = mainContent.querySelector('.server-title h1');
    var subtitle = mainContent.querySelector('.server-title p');
    var sections = mainContent.querySelectorAll('.section');
    var sidebarBtns = document.querySelectorAll('.sidebar .sidebar-btn');

    function delay(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

    // ── SVG 描边动画 ──────────────────────────────────
    function createStrokeSVG() {
        var cs = getComputedStyle(titleH1);
        var w = titleH1.offsetWidth;
        var h = titleH1.offsetHeight;

        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('stroke-svg');
        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

        var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        // 左对齐，与 h1 文字同原点
        text.setAttribute('x', '0');
        text.setAttribute('y', h * 0.78);
        text.setAttribute('text-anchor', 'start');
        text.setAttribute('font-size', parseFloat(cs.fontSize));
        text.setAttribute('font-weight', cs.fontWeight);
        text.setAttribute('font-family', cs.fontFamily);
        text.setAttribute('class', 'stroke-path');
        text.textContent = titleH1.textContent;

        svg.appendChild(text);
        titleH1.appendChild(svg);

        var len = text.getComputedTextLength();
        text.setAttribute('stroke-dasharray', len);
        text.setAttribute('stroke-dashoffset', len);

        return { svg: svg, text: text, len: len };
    }

    function animateStroke(text, len, duration) {
        return new Promise(function(resolve) {
            var start = performance.now();
            function tick(now) {
                var p = Math.min((now - start) / duration, 1);
                var ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
                text.setAttribute('stroke-dashoffset', len * (1 - ease));
                if (p < 1) {
                    requestAnimationFrame(tick);
                } else {
                    resolve();
                }
            }
            requestAnimationFrame(tick);
        });
    }

    async function sequence() {
        // 1. 先藏标题+小标题，再显示页面
        titleH1.classList.add('intro-stroke');
        subtitle.style.opacity = '0';
        document.body.classList.remove('loading');

        // 2. Logo 缩放弹入 + 黑屏同步淡出
        logoImg.classList.add('intro-zoom');
        await delay(400);
        overlay.classList.add('fade-out');  // 黑屏在 logo 缩放期间淡出
        await delay(900);
        logoImg.classList.add('zoom-done');
        // 强制 reflow 让 zoom-done 生效后再触发 glow 过渡
        void logoImg.offsetWidth;
        logoImg.classList.add('glow-in');

        // 3. 标题描边
        var svgData = createStrokeSVG();
        await delay(100);

        // 描边过半时：文字颜色先出现（发光等 SVG 删掉后再来）
        setTimeout(function() {
            svgData.text.setAttribute('fill', '#F0E68C');
            svgData.text.setAttribute('stroke-opacity', '0');
            svgData.text.style.transition = 'stroke-opacity 0.35s ease';
            titleH1.style.transition = 'color 0.5s ease';
            titleH1.style.color = '#F0E68C';
        }, 750);

        // UI 在描边期间就分段弹入
        sections.forEach(function(sec, i) {
            setTimeout(function() { sec.classList.add('reveal'); }, i * 120);
        });
        sidebarBtns.forEach(function(btn, i) {
            setTimeout(function() { btn.classList.add('reveal'); }, sections.length * 120 + i * 80);
        });

        await animateStroke(svgData.text, svgData.len, 1200);
        await delay(200);

        // 先删 SVG，再恢复 h1 样式
        svgData.svg.remove();
        titleH1.classList.remove('intro-stroke');
        titleH1.style.color = '';
        titleH1.style.textShadow = '';
        titleH1.style.transition = '';

        // 小标题缓入
        subtitle.style.transition = 'opacity 0.6s ease';
        subtitle.style.opacity = '1';

        // 等发光过渡完
        await delay(800);
        document.body.classList.add('loaded');
        overlay.remove();
    }

    sequence();
}

// ── 侧边栏 + 公告 (DOMContentLoaded) ─────────────────────
document.addEventListener('DOMContentLoaded', function () {

    // 侧边栏导航
    document.getElementById('eightDecksBtn').onclick = function () {
        showSection('section-eight-decks');
    };
    document.getElementById('xiaobaiBtn').onclick = function () {
        showSection('section-xiaobai');
    };
    document.getElementById('cardListBtn').onclick = function () {
        showSection('section-card-list');
    };
    document.getElementById('cardPoolInfoBtn').onclick = function () {
        showSection('section-card-pool');
    };

    // ── 桌面端入场动画 ──────────────────────────────────
    if (window.innerWidth > 768) {
        runIntroAnimation();
    } else {
        // 手机端直接显示
        document.body.classList.remove('loading');
        document.body.classList.add('loaded');
    }

    // 公告展开/收起
    const toggle = document.querySelector('.announcement-toggle');
    const close = document.querySelector('.announcement-close');
    const items = document.querySelectorAll('.announcement-box p');

    toggle.onclick = () => {
        items.forEach((el, i) => i >= 3 && (el.style.display = 'block'));
        toggle.style.display = 'none';
        close.style.display = 'block';
    };
    close.onclick = () => {
        items.forEach((el, i) => i >= 3 && (el.style.display = 'none'));
        toggle.style.display = 'block';
        close.style.display = 'none';
    };
});

// ═══════════════════════════════════════════════════════
// 晓白投票模块 (从 xiaobairenshe.html 提取)
// ═══════════════════════════════════════════════════════

function initXiaobaiModule() {
    var remaining = 0;
    var images = [];

    async function loadImages() {
        try {
            var resp = await fetch("api/images");
            images = await resp.json();
            renderGrid();
            await loadMyRemaining();
            await loadResults();
        } catch (e) {
            document.getElementById("imageGrid").innerHTML =
                '<p style="color:var(--red);">加载失败，请确认投票服务已启动 (端口8092)</p>';
        }
    }

    function renderGrid() {
        var grid = document.getElementById("imageGrid");
        if (images.length === 0) {
            grid.innerHTML = '<p style="color:#888;">暂无图片，请将图片放入 xiaobairenshe 文件夹</p>';
            return;
        }
        grid.innerHTML = "";
        images.forEach(function (img) {
            var name = img.replace(/\.[^.]+$/, "");
            var card = document.createElement("div");
            card.className = "img-card";
            card.innerHTML =
                '<img src="' + 'thumb/' + encodeURIComponent(img) +
                '" alt="' + name + '" loading="lazy"' +
                ' onclick="event.stopPropagation(); openLightbox(\'' + img + '\')"' +
                ' title="点击查看原图">' +
                '<div class="img-name">' + name + '</div>' +
                '<button class="vote-btn" data-img="' + img + '" onclick="vote(this, \'' + img + '\')">投票</button>';
            grid.appendChild(card);
        });
    }

    async function loadMyRemaining() {
        try {
            var resp = await fetch("api/my-votes");
            var data = await resp.json();
            remaining = data.remaining;
            updateRemainingUI();
            if (remaining <= 0) disableAllButtons();
        } catch (e) { }
    }

    function updateRemainingUI() {
        var el = document.getElementById("remainingVotes");
        el.textContent = remaining >= 0 ? remaining : "--";
        if (remaining <= 0) {
            el.style.color = "var(--red)";
            document.getElementById("voteStatus").innerHTML =
                '<span style="color:var(--red);">您的2票已全部投出，感谢参与！</span>';
        }
    }

    window.vote = async function (btn, img) {
        try {
            var resp = await fetch("api/vote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: img })
            });
            var data = await resp.json();
            if (resp.ok && data.ok) {
                remaining = data.remaining;
                btn.classList.add("voted");
                btn.textContent = "已投票 ✓";
                btn.disabled = true;
                updateRemainingUI();
                renderResults(data.votes);
                if (remaining <= 0) disableAllButtons();
            } else {
                alert(data.error || "投票失败");
                await loadMyRemaining();
                if (remaining <= 0) disableAllButtons();
                await loadResults();
            }
        } catch (e) {
            alert("网络错误，请重试");
        }
    };

    function disableAllButtons() {
        var btns = document.querySelectorAll(".vote-btn");
        for (var i = 0; i < btns.length; i++) {
            btns[i].disabled = true;
        }
    }

    async function loadResults() {
        try {
            var resp = await fetch("api/results");
            var data = await resp.json();
            renderResults(data.votes);
        } catch (e) { }
    }

    function renderResults(votes) {
        var section = document.getElementById("resultsSection");
        var list = document.getElementById("resultsList");
        if (!votes || Object.keys(votes).length === 0) {
            list.innerHTML = '<p style="color:#888;">暂无投票数据</p>';
            section.style.display = "block";
            return;
        }
        section.style.display = "block";
        var sorted = Object.entries(votes).sort(function (a, b) { return b[1] - a[1]; });
        var maxVotes = sorted[0] ? sorted[0][1] : 1;
        list.innerHTML = "";
        sorted.forEach(function (entry, i) {
            var img = entry[0];
            var count = entry[1];
            var name = img.replace(/\.[^.]+$/, "");
            var barWidth = (count / maxVotes * 100).toFixed(1);
            var row = document.createElement("div");
            row.className = "result-row";
            row.innerHTML =
                '<span class="result-rank">#' + (i + 1) + '</span>' +
                '<span class="result-name">' + name + '</span>' +
                '<div class="result-bar-wrap"><div class="result-bar" style="width:' + barWidth + '%;"></div></div>' +
                '<span class="result-count">' + count + '票</span>';
            list.appendChild(row);
        });
    }

    window.openLightbox = function (img) {
        document.getElementById("lightboxImg").src = 'img/' + encodeURIComponent(img);
        document.getElementById("lightbox").classList.add("active");
    };

    window.closeLightbox = function () {
        document.getElementById("lightbox").classList.remove("active");
    };

    // 启动加载
    loadImages();
}

// ═══════════════════════════════════════════════════════
// 全局电路板流光背景
// ═══════════════════════════════════════════════════════
(function () {
    // 手机端不跑背景动画（省 GPU / 省电）
    if (window.innerWidth <= 768) return;
    const canvas = document.getElementById('bgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H;

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // ── 电路板路径 + 流光脉冲 ──────────────────────────
    const traces = [];
    const TRACE_COUNT = 12;
    const GLOW_RADIUS = 110;       // 光点照射半径
    const RED = [216, 30, 68];

    function buildSegments(startX, baseY) {
        const segs = [];
        let sx = startX, sy = baseY;
        const jogMax = bandH * 0.35; // 垂直抖动限制在半带内，避免越界
        while (sx < W + 200) {
            const len = 60 + Math.random() * 200;
            const ex = sx + len;
            const ey = (segs.length % 2 === 0)
                ? sy + (Math.random() - 0.5) * jogMax * 2
                : sy;
            segs.push({ x1: sx, y1: sy, x2: ex, y2: ey });
            sx = ex; sy = ey;
        }
        return segs;
    }

    function pathLength(segs) {
        return segs.reduce((s, seg) => s + Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1), 0);
    }

    function pointOnPath(segs, t) {
        // t: 0..1, returns {x, y} along path
        const total = pathLength(segs);
        let target = total * t;
        for (const seg of segs) {
            const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
            if (target <= len) {
                const r = len > 0 ? target / len : 0;
                return { x: seg.x1 + (seg.x2 - seg.x1) * r, y: seg.y1 + (seg.y2 - seg.y1) * r };
            }
            target -= len;
        }
        const last = segs[segs.length - 1];
        return { x: last.x2, y: last.y2 };
    }

    function distPointToSeg(px, py, seg) {
        const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.hypot(px - seg.x1, py - seg.y1);
        let t = ((px - seg.x1) * dx + (py - seg.y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const cx = seg.x1 + t * dx, cy = seg.y1 + t * dy;
        return Math.hypot(px - cx, py - cy);
    }

    // 创建轨迹（Y 均匀分布，避免重叠）
    const bandH = H / TRACE_COUNT; // 每条轨迹的垂直带高度
    for (let i = 0; i < TRACE_COUNT; i++) {
        const baseY = bandH * (i + 0.5); // 带中心
        const segs = buildSegments(-50, baseY);
        traces.push({
            segments: segs,
            baseY: baseY,
            totalLen: pathLength(segs),
            pulse: Math.random(),
            speed: 0.0003 + Math.random() * 0.0012,
            width: 1.5 + Math.random() * 2.5,
            flickerPhase: Math.random() * Math.PI * 2,
        });
    }

    function resetTrace(t) {
        t.segments = buildSegments(-50, t.baseY);
        t.totalLen = pathLength(t.segments);
        t.pulse = 0;
        t.speed = 0.0003 + Math.random() * 0.0012;
        t.width = 1.5 + Math.random() * 2.5;
        t.flickerPhase = Math.random() * Math.PI * 2;
    }

    // ── 临时画布（遮罩用） ──────────────────────────────
    const maskSize = GLOW_RADIUS * 2 + 30;
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = tmpCanvas.height = maskSize;
    const tCtx = tmpCanvas.getContext('2d');

    function drawFullTrace(ctx, trace) {
        const OFFSET = 1.5;
        // 逐段用法线偏移绘制高光/阴影边，整条路径完成后由遮罩统一渐隐
        trace.segments.forEach(seg => {
            const dx = seg.x2 - seg.x1;
            const dy = seg.y2 - seg.y1;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len * OFFSET;
            const ny =  dx / len * OFFSET;

            // 沟槽底色
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.strokeStyle = 'rgba(216,30,68,0.3)';
            ctx.lineWidth = trace.width + 2;
            ctx.lineCap = 'butt';
            ctx.stroke();

            // 法线方向高光（亮红）
            ctx.beginPath();
            ctx.moveTo(seg.x1 + nx, seg.y1 + ny);
            ctx.lineTo(seg.x2 + nx, seg.y2 + ny);
            ctx.strokeStyle = 'rgba(216,30,68,0.7)';
            ctx.lineWidth = 1;
            ctx.lineCap = 'butt';
            ctx.stroke();

            // 反法线方向阴影（暗）
            ctx.beginPath();
            ctx.moveTo(seg.x1 - nx, seg.y1 - ny);
            ctx.lineTo(seg.x2 - nx, seg.y2 - ny);
            ctx.strokeStyle = 'rgba(20,2,5,0.55)';
            ctx.lineWidth = 1;
            ctx.lineCap = 'butt';
            ctx.stroke();
        });
    }

    // ── 绘制 ──────────────────────────────────────────
    let frame = 0;
    function draw() {
        frame++;
        ctx.clearRect(0, 0, W, H);

        traces.forEach(t => {
            t.pulse += t.speed;
            if (t.pulse > 1.2) { resetTrace(t); return; }

            const dot = pointOnPath(t.segments, Math.min(t.pulse, 1));
            // 闪烁系数：多频叠加模拟不规则电火花
            const f = t.flickerPhase;
            const flicker = 0.4 + 0.6 * Math.abs(
                Math.sin(frame * 0.04 + f) * 0.7 +
                Math.sin(frame * 0.11 + f * 2.1) * 0.2 +
                Math.sin(frame * 0.17 + f * 3.7) * 0.1
            );

            // —— 电光脉冲（主画布） ——
            const glow = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, GLOW_RADIUS);
            glow.addColorStop(0, `rgba(216,30,68,${0.9 * flicker})`);
            glow.addColorStop(0.04, `rgba(216,30,68,${0.6 * flicker})`);
            glow.addColorStop(0.2, `rgba(216,30,68,${0.18 * flicker})`);
            glow.addColorStop(0.5, `rgba(216,30,68,${0.03 * flicker})`);
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, GLOW_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();

            // 电火花射线
            const sparkCount = Math.floor(2 + flicker * 6);
            for (let s = 0; s < sparkCount; s++) {
                const a = Math.random() * Math.PI * 2;
                const len = (4 + Math.random() * 16) * flicker;
                ctx.beginPath();
                ctx.moveTo(dot.x, dot.y);
                ctx.lineTo(dot.x + Math.cos(a) * len, dot.y + Math.sin(a) * len);
                ctx.strokeStyle = `rgba(216,30,68,${(0.25 + Math.random() * 0.45) * flicker})`;
                ctx.lineWidth = 0.4 + Math.random() * 0.9;
                ctx.stroke();
            }

            // 核心白点
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, 1.5 + flicker * 1.8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,220,220,${0.5 + flicker * 0.5})`;
            ctx.fill();

            // —— 路径照明（临时画布 + 径向渐变遮罩） ——
            const ox = dot.x - GLOW_RADIUS - 15;
            const oy = dot.y - GLOW_RADIUS - 15;

            tCtx.clearRect(0, 0, maskSize, maskSize);
            tCtx.save();
            tCtx.translate(-ox, -oy);

            // 完整路径一体绘制
            drawFullTrace(tCtx, t);

            // 径向渐变遮罩（平滑渐隐，无段边界）
            tCtx.globalCompositeOperation = 'destination-in';
            const mask = tCtx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, GLOW_RADIUS);
            mask.addColorStop(0, 'rgba(255,255,255,1)');
            mask.addColorStop(0.3, 'rgba(255,255,255,0.85)');
            mask.addColorStop(0.7, 'rgba(255,255,255,0.1)');
            mask.addColorStop(1, 'rgba(0,0,0,0)');
            tCtx.fillStyle = mask;
            tCtx.beginPath();
            tCtx.arc(dot.x, dot.y, GLOW_RADIUS, 0, Math.PI * 2);
            tCtx.fill();

            tCtx.restore();

            // 合成到主画布
            ctx.drawImage(tmpCanvas, ox, oy);
        });

            requestAnimationFrame(draw);
        }

        draw();
    })();
