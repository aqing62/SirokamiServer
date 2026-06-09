/**
 * 白神服Sirokami — 八强卡组页面
 * 优化版: Promise.all 并行加载 + DOMContentLoaded + 改进错误处理
 */
const FOLDER_TO_TOURNAMENT = {
    "1": "第一届OT赛事",
    "2": "第二届OT赛事",
    "3": "第三届OT赛事",
    "4": "第四届OT赛事",
    "5": "第一届G-Ext赛事",
};

const OCG_URL = "https://cdn.233.momobako.com/ygopro/pics/";
const DIY_URL = "https://api.ygopro3.cn/pics/siro/";
const FALLBACK = "cover.jpg";

function initEightDecksModule() {
    (async () => {
    const tournamentList = await getTournamentList();
    renderButtons(document.getElementById("buttonContainer"), tournamentList);
    renderButtons(document.getElementById("popupButtonContainer"), tournamentList);
    if (tournamentList.length > 0) loadDecks(tournamentList[0][0]);
    initFilterPopup();
    })();
}

async function getTournamentList() {
    try {
        const resp = await fetch("decks/");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();

        const folderRegex = /<a\s+href=["']([^"']+)\/["'].*?>([^<]+)<\/a>/gi;
        const folderNames = [];
        let match;
        while ((match = folderRegex.exec(text)) !== null) {
            const name = match[1].trim();
            if (FOLDER_TO_TOURNAMENT[name]) folderNames.push(name);
        }

        return folderNames.sort().map(name => [
            name,
            FOLDER_TO_TOURNAMENT[name] || `未知赛事(${name})`,
        ]);
    } catch (e) {
        console.error("读取赛事文件夹失败：", e);
        return [];
    }
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
            loadDecks(folder);
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

async function loadDecks(targetFolder) {
    const container = document.getElementById("container");
    container.innerHTML = "加载中...";

    try {
        const resp = await fetch(`decks/${targetFolder}/`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();

        const ydkRegex = /<a\s+href=["']([^"']+\.ydk)["'].*?>([^<]+)<\/a>/gi;
        const files = [];
        let match;
        while ((match = ydkRegex.exec(text)) !== null) {
            files.push(decodeURIComponent(match[1].trim()));
        }

        container.innerHTML = "";
        if (files.length === 0) {
            container.innerHTML =
                "<div style='grid-column:1/-1;text-align:center;padding:30px;'>该赛事暂无卡组</div>";
            return;
        }

        // 并行加载所有卡组文件
        const results = await Promise.allSettled(
            files.map(file =>
                loadOne(`decks/${targetFolder}/${encodeURIComponent(file)}`)
            )
        );

        results.forEach((result, i) => {
            if (result.status === 'rejected') {
                console.warn(`加载失败: ${files[i]}`, result.reason);
            }
        });

    } catch (e) {
        console.error("加载卡组失败：", e);
        container.innerHTML =
            "<div style='grid-column:1/-1;text-align:center;padding:30px;'>加载失败，请检查文件夹是否存在</div>";
    }
}

async function loadOne(path) {
    try {
        const resp = await fetch(path);
        const text = await resp.text();
        const encodedName = path.split("/").pop();
        const deckName = decodeURIComponent(encodedName).replace(/\.ydk$/i, "");

        let main = [], extra = [], side = [], sec = "";
        const lines = text.split("\n").map(l => l.trim());

        for (const line of lines) {
            if (line === "#main") { sec = "main"; continue; }
            if (line === "#extra") { sec = "extra"; continue; }
            if (line === "!side") { sec = "side"; continue; }
            if (isNaN(line)) continue;

            if (sec === "main") main.push(line);
            else if (sec === "extra") extra.push(line);
            else if (sec === "side") side.push(line);
        }

        createDeckCard(deckName, main, extra, side);
    } catch (e) {
        console.warn("加载卡组失败:", path, e);
    }
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
