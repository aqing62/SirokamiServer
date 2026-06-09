/**
 * 白神服Sirokami — 八强卡组页面
 * v2: 从 decks_data.json 加载预解析数据，无需目录扫描或 YDK 解析
 */
const OCG_URL = "https://cdn.233.momobako.com/ygopro/pics/";
const DIY_URL = "https://api.ygopro3.cn/pics/siro/";
const FALLBACK = "cover.jpg";

let decksData = null;  // { tournaments: [...] }

function initEightDecksModule() {
    (async () => {
        await loadDecksData();
        if (!decksData || !decksData.tournaments.length) {
            document.getElementById("container").innerHTML =
                "<div style='grid-column:1/-1;text-align:center;padding:30px;'>暂无赛事数据</div>";
            return;
        }
        const list = decksData.tournaments.map(t => [t.folder, t.name]);
        renderButtons(document.getElementById("buttonContainer"), list);
        renderButtons(document.getElementById("popupButtonContainer"), list);
        renderTournament(decksData.tournaments[0]);
        initFilterPopup();
    })();
}

async function loadDecksData() {
    try {
        const resp = await fetch("decks/decks_data.json");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        decksData = await resp.json();
    } catch (e) {
        console.error("加载卡组数据失败：", e);
        decksData = null;
    }
}

function renderTournament(t) {
    const container = document.getElementById("container");
    container.innerHTML = "";
    if (!t.decks.length) {
        container.innerHTML =
            "<div style='grid-column:1/-1;text-align:center;padding:30px;'>该赛事暂无卡组</div>";
        return;
    }
    t.decks.forEach(d => createDeckCard(d.displayName, d.main, d.extra, d.side));
}

function initFilterPopup() {
    const floatBtn = document.getElementById('filterFloatBtn');
    const mask = document.getElementById('filterMask');
    const popup = document.getElementById('filterPopup');
    const closeBtn = document.getElementById('filterCloseBtn');

    const openPopup = () => {
        mask.classList.add('show');
        popup.classList.add('show');
        document.body.style.overflow = 'hidden';
    };
    const closePopup = () => {
        mask.classList.remove('show');
        popup.classList.remove('show');
        document.body.style.overflow = '';
    };

    floatBtn.addEventListener('click', () => {
        popup.classList.contains('show') ? closePopup() : openPopup();
    });
    closeBtn.addEventListener('click', closePopup);
    mask.addEventListener('click', closePopup);

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) closePopup();
    });
}

function renderButtons(container, list) {
    container.innerHTML = "";
    if (list.length === 0) {
        container.innerHTML =
            "<div style='color:#ccc;text-align:center;padding:10px;'>暂无赛事</div>";
        return;
    }
    list.forEach(([folder, label]) => {
        const btn = document.createElement("button");
        btn.className = "folder-btn";
        btn.textContent = label;
        btn.onclick = () => {
            const t = decksData.tournaments.find(t => t.folder === folder);
            if (t) renderTournament(t);
            if (window.innerWidth <= 768) closeMobilePopup();
        };
        container.appendChild(btn);
    });
}

function closeMobilePopup() {
    document.getElementById('filterMask').classList.remove('show');
    document.getElementById('filterPopup').classList.remove('show');
    document.body.style.overflow = '';
}

function createDeckCard(name, main, extra, side) {
    const el = document.createElement("div");
    el.className = "deck";
    el.innerHTML = `
        <h3>${escapeHtml(name)}</h3>
        <div class="deck-sep"></div>
        <div class="deck-section">
            <div class="section-label">主卡组</div>
            <div class="cards">${imgs(main)}</div>
        </div>
        <div class="deck-section">
            <div class="section-label">额外卡组</div>
            <div class="cards">${imgs(extra)}</div>
        </div>
        <div class="deck-section">
            <div class="section-label">副卡组</div>
            <div class="cards">${imgs(side)}</div>
        </div>
    `;
    document.getElementById("container").appendChild(el);
}

function imgs(ids) {
    if (ids.length === 0) return '<div class="empty-tip">无卡牌</div>';
    return ids.map(id => `
        <img
            src="${OCG_URL}${id}.jpg"
            class="card-img"
            alt="卡牌${id}"
            loading="lazy"
            onerror="
                this.onerror=null;
                this.src='${DIY_URL}${id}.jpg';
                this.onerror=function(){this.src='${FALLBACK}';}
            ">`).join("");
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
