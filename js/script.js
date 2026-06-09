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
    'section-card-pool':  ['css-card-pool'],
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
        // 主页不隐藏
        if (!sidebar.classList.contains('hidden')) {
            // 仅在子页模式下延迟隐藏
            if (trigger.style.display !== 'none') {
                hoverTimer = setTimeout(() => sidebar.classList.add('hidden'), 400);
            }
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

// ── 侧边栏 + 公告 (DOMContentLoaded) ─────────────────────
document.addEventListener('DOMContentLoaded', function () {
    // CSS加载完成，显示页面
    document.body.classList.remove('loading');
    document.body.classList.add('loaded');

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
