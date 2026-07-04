/**
 * 白神服Sirokami — 比赛相关页面
 * v3: 对接Tabulator排表系统 + 保留历届卡组浏览
 */
const OCG_URL = "https://cdn.233.momobako.com/ygopro/pics/";
const DIY_URL = "https://api.ygopro3.cn/pics/siro/";
const FALLBACK = "cover.jpg";
const POLL_INTERVAL = 30000;  // 30秒轮询

// ── 旧八强卡组数据 ──────────────────────────────────────
let decksData = null;  // { tournaments: [...] }
let oldDecksLoaded = false;

// ── 比赛数据 ────────────────────────────────────────────
let tournamentData = null;  // Tabulator API 返回的完整数据
let pollTimer = null;


function initEightDecksModule() {
    // 启动轮询
    fetchTournamentData();
    pollTimer = setInterval(fetchTournamentData, POLL_INTERVAL);

    // 右上角按钮 → 打开历届卡组 modal
    document.getElementById('oldDecksTrigger').onclick = openOldDecksModal;

    // Modal 关闭
    document.getElementById('oldDecksClose').onclick = closeOldDecksModal;
    document.getElementById('oldDecksOverlay').onclick = function(e) {
        if (e.target === this) closeOldDecksModal();
    };

    // ESC 关闭
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeOldDecksModal();
    });

    // 后台预加载旧卡组数据
    loadDecksDataIfNeeded();
}


// ================================================================
//  比赛数据：获取 & 渲染
// ================================================================

async function fetchTournamentData() {
    try {
        const resp = await fetch('/api/tournament');
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${resp.status}`);
        }
        const wrapper = await resp.json();
        // 兼容两种格式: { data: {...} } 或直接返回数据
        const data = wrapper.data || wrapper;
        // 仅数据变化时重新渲染
        const newJson = JSON.stringify(data);
        const oldJson = JSON.stringify(tournamentData);
        if (newJson !== oldJson) {
            tournamentData = data;
            renderTournamentView(data);
        }
    } catch (e) {
        console.error('获取比赛数据失败：', e);
        const main = document.getElementById('tournamentMain');
        if (!tournamentData) {
            main.innerHTML = `<div class="loading-hint">⚠️ 加载比赛数据失败: ${escapeHtml(String(e.message || e))}</div>`;
        }
    }
}


function renderTournamentView(data) {
    const header = document.getElementById('tournamentHeader');
    const main = document.getElementById('tournamentMain');

    if (!data || data.error) {
        header.style.display = 'none';
        main.innerHTML = `<div class="loading-hint">⚠️ ${escapeHtml((data && data.error) || '暂无比赛数据')}</div>`;
        return;
    }

    // 比赛信息头
    header.style.display = 'flex';
    document.getElementById('tourneyName').textContent = data.name || '未命名比赛';
    document.getElementById('tourneyRule').textContent = formatRule(data.rule);
    document.getElementById('tourneyStatus').textContent = formatStatus(data.status);
    document.getElementById('tourneyStatus').className =
        'badge status-badge status-' + (data.status || '').toLowerCase();

    // 按规则渲染
    const participants = data.participants || [];
    const matches = data.matches || [];
    const rule = data.rule || '';

    let html = '';
    html += renderRankingTable(participants);

    if (rule === 'Swiss') {
        html += renderSwissRounds(matches, participants);
    } else if (rule === 'SingleElimination' || rule === 'DoubleElimination') {
        html += renderBracket(matches, participants, rule);
    }

    main.innerHTML = html;
}


// ── 排名表 ──────────────────────────────────────────────

function renderRankingTable(participants) {
    if (!participants || participants.length === 0) return '';

    const sorted = [...participants].sort((a, b) => {
        const sa = a.score || {};
        const sb = b.score || {};
        if ((sb.score || 0) !== (sa.score || 0)) return (sb.score || 0) - (sa.score || 0);
        return (sb.win || 0) - (sa.win || 0);
    });

    let rows = '';
    sorted.forEach((p, i) => {
        const s = p.score || {};
        const rank = i + 1;
        const cls = rank <= 8 ? 'rank-top' : '';
        const quitMark = p.quit ? ' ⚠️' : '';
        rows += `<tr class="${cls}">
            <td class="rank-col">${rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</td>
            <td>${escapeHtml(p.name || '?')}${quitMark}</td>
            <td>${s.score || 0}</td>
            <td>${s.win || 0}</td>
            <td>${s.draw || 0}</td>
            <td>${s.lose || 0}</td>
            <td>${s.bye || 0}</td>
        </tr>`;
    });

    return `<div class="ranking-section">
        <h3 class="section-title">🏆 参赛者排名</h3>
        <div class="ranking-wrap">
            <table class="ranking-table">
                <thead><tr>
                    <th>#</th><th>玩家</th><th>积分</th><th>胜</th><th>平</th><th>负</th><th>轮空</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    </div>`;
}


// ── 瑞士轮 ──────────────────────────────────────────────

function renderSwissRounds(matches, participants) {
    if (!matches || matches.length === 0) return '';

    const nameMap = buildNameMap(participants);
    const rounds = new Map();
    matches.forEach(m => {
        const r = m.round || 1;
        if (!rounds.has(r)) rounds.set(r, []);
        rounds.get(r).push(m);
    });

    const sortedRounds = [...rounds.entries()].sort((a, b) => a[0] - b[0]);
    const maxRound = sortedRounds.length > 0 ? sortedRounds[sortedRounds.length - 1][0] : 1;

    // 轮次选择器
    let opts = '';
    for (let r = 1; r <= maxRound; r++) {
        const sel = r === maxRound ? ' selected' : '';
        opts += `<option value="${r}"${sel}>第 ${r} 轮</option>`;
    }

    let html = `<div class="swiss-section">
        <h3 class="section-title">⚔️ 对局</h3>
        <div class="round-selector">
            <select id="swissRoundSelect" onchange="switchSwissRound()">${opts}</select>
        </div>`;

    // 每轮一个容器，默认显示最后一轮
    sortedRounds.forEach(([roundNum, ms]) => {
        const show = roundNum === maxRound ? '' : ' style="display:none"';
        html += `<div class="round-group" data-round="${roundNum}"${show}>
            <h4 class="round-title">第 ${roundNum} 轮</h4>
            <div class="match-list">`;
        ms.forEach(m => {
            html += renderMatchCard(m, nameMap);
        });
        html += '</div></div>';
    });

    html += '</div>';
    return html;
}


// ── 淘汰赛对阵图 ────────────────────────────────────────

function renderBracket(matches, participants, rule) {
    if (!matches || matches.length === 0) return '';

    const nameMap = buildNameMap(participants);
    const isDouble = rule === 'DoubleElimination';

    const thirdPlaceMatches = matches.filter(m => m.isThirdPlaceMatch);
    const bracketMatches = matches.filter(m => !m.isThirdPlaceMatch);

    // 尝试构建树，失败则回退简单视图
    try {
        return renderBracketTree(bracketMatches, thirdPlaceMatches, nameMap, isDouble);
    } catch (e) {
        console.warn('对阵树构建失败，使用简单视图:', e);
        return renderBracketSimple(bracketMatches, thirdPlaceMatches, nameMap, isDouble);
    }
}


function renderBracketTree(matches, thirdPlaceMatches, nameMap, isDouble) {
    const matchById = new Map();
    matches.forEach(m => matchById.set(m.id, m));

    // 按轮次分组
    const roundsMap = new Map();
    matches.forEach(m => {
        const r = m.round || 1;
        if (!roundsMap.has(r)) roundsMap.set(r, []);
        roundsMap.get(r).push(m);
    });
    const totalRounds = roundsMap.size;
    const sortedRounds = [...roundsMap.entries()].sort((a, b) => a[0] - b[0]);

    // 找第一轮（没有比赛指向它们的）
    const kids = new Set();
    matches.forEach(m => { if (m.childMatchId && matchById.has(m.childMatchId)) kids.add(m.childMatchId); });
    const round1 = matches.filter(m => !kids.has(m.id)).sort((a, b) => a.id - b.id);

    // BFS 排序：从第一轮开始，按 childMatchId 链走
    const orderMap = new Map();
    let idx = 0;
    const visited = new Set();
    function walk(m) {
        if (visited.has(m.id)) return;
        visited.add(m.id);
        orderMap.set(m.id, idx++);
        if (m.childMatchId && matchById.has(m.childMatchId)) {
            walk(matchById.get(m.childMatchId));
        }
    }
    round1.forEach(walk);
    // 未访问到的排在后面
    matches.forEach(m => { if (!visited.has(m.id)) { orderMap.set(m.id, idx++); } });

    const layers = sortedRounds.map(([roundNum, ms]) => {
        const sorted = [...ms].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
        const label = getRoundLabels(totalRounds)[roundNum - 1] || '第' + roundNum + '轮';
        return { roundNum, matches: sorted, label };
    });

    const N = Math.pow(2, totalRounds - 1);
    const ROW_H = 110;   // 槽位间距
    const CARD_H = 100;  // 卡片实际高度

    let html = '<div class="bracket-section"><h3 class="section-title">🏆 淘汰赛对阵</h3>';
    if (isDouble) html += '<h4 class="bracket-subtitle">胜者组</h4>';
    html += '<div class="bracket-tree">';

    layers.forEach((layer, layerIdx) => {
        const isLast = layerIdx === layers.length - 1;
        const count = layer.matches.length;
        const step = N / count;

        html += `<div class="bracket-layer">
            <div class="bracket-layer-title">${layer.label}</div>
            <div class="bracket-layer-slots" style="height:${N * ROW_H}px;">`;

        layer.matches.forEach((m, i) => {
            const top = (i + 0.5) * step * ROW_H - ROW_H / 2;
            html += `<div class="bracket-slot" style="top:${top}px;">
                ${renderMatchCard(m, nameMap)}
            </div>`;
        });

        html += '</div></div>';
    });

    html += '</div>';

    if (thirdPlaceMatches.length > 0) {
        html += '<h4 class="bracket-subtitle" style="margin-top:32px;">🥉 季军赛</h4>';
        html += '<div class="match-list">';
        thirdPlaceMatches.forEach(m => { html += renderMatchCard(m, nameMap); });
        html += '</div>';
    }

    if (isDouble) {
        html += '<h4 class="bracket-subtitle" style="margin-top:24px;">败者组</h4>';
        html += '<p class="bracket-note">双败淘汰详细对阵请联系管理员查看</p>';
    }

    html += '</div>';
    return html;
}


function renderBracketSimple(matches, thirdPlaceMatches, nameMap, isDouble) {
    const maxRound = Math.max(...matches.map(m => m.round || 0), 0);
    const rounds = new Map();
    matches.forEach(m => {
        const r = m.round || 0;
        if (!rounds.has(r)) rounds.set(r, []);
        rounds.get(r).push(m);
    });
    const sortedRounds = [...rounds.entries()].sort((a, b) => a[0] - b[0]);
    const roundLabels = getRoundLabels(sortedRounds.length);

    let html = '<div class="bracket-section"><h3 class="section-title">🏆 淘汰赛对阵</h3>';
    html += '<div class="bracket-view">';
    sortedRounds.forEach(([roundNum, ms], ri) => {
        html += `<div class="bracket-round"><h5 class="bracket-round-title">${roundLabels[ri] || '第' + roundNum + '轮'}</h5><div class="bracket-matches">`;
        ms.forEach(m => { html += renderMatchCard(m, nameMap); });
        html += '</div></div>';
    });
    html += '</div>';
    if (thirdPlaceMatches.length > 0) {
        html += '<h4 class="bracket-subtitle" style="margin-top:24px;">🥉 季军赛</h4><div class="match-list">';
        thirdPlaceMatches.forEach(m => { html += renderMatchCard(m, nameMap); });
        html += '</div>';
    }
    html += '</div>';
    return html;
}


function getRoundLabels(count) {
    const labels = [];
    for (let i = count; i >= 1; i--) {
        if (i === 1) labels.push('🏆 决赛');
        else if (i === 2) labels.push('半决赛');
        else if (i === 3) labels.push('¼决赛');
        else if (i === 4) labels.push('⅛决赛');
        else labels.push(`第${i}轮`);
    }
    return labels;
}


// ── 对局卡片 ────────────────────────────────────────────

function renderMatchCard(m, nameMap) {
    const p1Name = nameMap.get(m.player1Id) || `选手#${m.player1Id}`;
    const p2Name = nameMap.get(m.player2Id) || `选手#${m.player2Id}`;
    const isFinished = m.status === 'Finished';
    const isLive = m.status === 'InProgress';
    const p1IsWinner = isFinished && m.winnerId === m.player1Id;

    // 胜者放右边
    const leftName = p1IsWinner ? p2Name : p1Name;
    const rightName = p1IsWinner ? p1Name : p2Name;
    const leftScore = p1IsWinner ? (m.player2Score ?? '-') : (m.player1Score ?? '-');
    const rightScore = p1IsWinner ? (m.player1Score ?? '-') : (m.player2Score ?? '-');

    let statusIcon = '';
    if (isLive) statusIcon = ' 🔴';
    else if (m.status === 'Pending') statusIcon = ' ⏳';

    return `<div class="match-card${isFinished ? ' finished' : ''}${isLive ? ' live' : ''}">
        <div class="match-player left">
            <span class="player-name">${escapeHtml(leftName)}</span>
            <span class="player-score">${isFinished || isLive ? leftScore : ''}</span>
        </div>
        <div class="match-vs">VS${statusIcon}</div>
        <div class="match-player right${isFinished ? ' winner' : ''}">
            <span class="player-score">${isFinished || isLive ? rightScore : ''}</span>
            <span class="player-name">${escapeHtml(rightName)}</span>
        </div>
    </div>`;
}


// ── 辅助 ────────────────────────────────────────────────

function switchSwissRound() {
    const sel = document.getElementById('swissRoundSelect');
    if (!sel) return;
    const r = sel.value;
    document.querySelectorAll('.round-group[data-round]').forEach(g => {
        g.style.display = g.dataset.round === r ? '' : 'none';
    });
}

function buildNameMap(participants) {
    const map = new Map();
    (participants || []).forEach(p => map.set(p.id, p.name));
    return map;
}

function formatRule(rule) {
    const map = {
        'SingleElimination': '单淘',
        'DoubleElimination': '双败淘汰',
        'Swiss': '瑞士轮'
    };
    return map[rule] || rule || '?';
}

function formatStatus(status) {
    const map = {
        'Ready': '未开始',
        'Running': '进行中',
        'Finished': '已结束'
    };
    return map[status] || status || '?';
}


// ================================================================
//  历届卡组 Modal（保留原八强卡组功能）
// ================================================================

async function loadDecksDataIfNeeded() {
    if (oldDecksLoaded) return;
    try {
        const resp = await fetch("decks/decks_data.json");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        decksData = await resp.json();
        oldDecksLoaded = true;
    } catch (e) {
        console.error("加载卡组数据失败：", e);
        decksData = null;
        oldDecksLoaded = true;
    }
}

function openOldDecksModal() {
    const overlay = document.getElementById('oldDecksOverlay');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';

    if (!oldDecksLoaded || !decksData || !decksData.tournaments.length) {
        loadDecksDataIfNeeded().then(() => renderOldDecks());
    } else {
        renderOldDecks();
    }
    initFilterPopup();
}

function closeOldDecksModal() {
    document.getElementById('oldDecksOverlay').classList.remove('show');
    document.body.style.overflow = '';
}

function renderOldDecks() {
    const container = document.getElementById("oldContainer");
    const btnContainer = document.getElementById("buttonContainer");
    const popupContainer = document.getElementById("popupButtonContainer");

    if (!decksData || !decksData.tournaments.length) {
        container.innerHTML = "<div style='text-align:center;padding:30px;color:#ccc;'>暂无赛事数据</div>";
        return;
    }

    const tours = [...decksData.tournaments].reverse();
    const list = tours.map(t => [t.folder, t.name]);
    renderOldButtons(btnContainer, list);
    renderOldButtons(popupContainer, list);

    // 渲染第一个赛事
    renderOldTournament(tours[0]);
}

function renderOldButtons(container, list) {
    if (!container) return;
    container.innerHTML = "";
    if (list.length === 0) {
        container.innerHTML = "<div style='color:#ccc;text-align:center;padding:10px;'>暂无赛事</div>";
        return;
    }
    list.forEach(([folder, label]) => {
        const btn = document.createElement("button");
        btn.className = "folder-btn";
        btn.textContent = label;
        btn.onclick = () => {
            const t = decksData.tournaments.find(t => t.folder === folder);
            if (t) renderOldTournament(t);
            if (window.innerWidth <= 768) closeMobilePopup();
        };
        container.appendChild(btn);
    });
}

function renderOldTournament(t) {
    const container = document.getElementById("oldContainer");
    if (!container) return;
    container.innerHTML = "";
    if (!t.decks.length) {
        container.innerHTML = "<div style='text-align:center;padding:30px;color:#ccc;'>该赛事暂无卡组</div>";
        return;
    }
    t.decks.forEach(d => createDeckCard(d.displayName, d.main, d.extra, d.side));
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
    document.getElementById("oldContainer").appendChild(el);
}

function initFilterPopup() {
    const floatBtn = document.getElementById('filterFloatBtn');
    const mask = document.getElementById('filterMask');
    const popup = document.getElementById('filterPopup');
    const closeBtn = document.getElementById('filterCloseBtn');

    if (!floatBtn || !mask || !popup || !closeBtn) return;

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

    floatBtn.onclick = () => {
        popup.classList.contains('show') ? closePopup() : openPopup();
    };
    closeBtn.onclick = closePopup;
    mask.onclick = closePopup;

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) closePopup();
    });
}

function closeMobilePopup() {
    const mask = document.getElementById('filterMask');
    const popup = document.getElementById('filterPopup');
    if (mask) mask.classList.remove('show');
    if (popup) popup.classList.remove('show');
    document.body.style.overflow = '';
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
