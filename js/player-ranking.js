(function () {
  'use strict';

  const API_URL = 'https://api.ygopro3.cn/api/ladder';
  const DECKS_API_URL = 'https://api.ygopro3.cn/api/ladder/decks';
  const CARD_STATS_URL = 'https://api.ygopro3.cn/api/ladder/card-stats';
  const OCG_PIC_URL = 'https://cdn.233.momobako.com/ygopro/pics/';
  const DIY_PIC_URL = 'https://api.ygopro3.cn/pics/siro/';
  const FALLBACK_PIC = 'cover.jpg';
  const section = document.getElementById('section-player-ranking');
  const tableBody = document.getElementById('rankTableBody');
  const searchInput = document.getElementById('rankingSearchInput');
  const searchBtn = document.getElementById('rankingSearchBtn');
  const clearBtn = document.getElementById('rankingClearBtn');
  const deckModalOverlay = document.getElementById('deckModalOverlay');
  const deckModalTitle = document.getElementById('deckModalTitle');
  const deckModalBody = document.getElementById('deckModalBody');
  const deckModalClose = document.getElementById('deckModalClose');

  let currentData = [];
  let searchMode = false;

  function renderTable(players, highlightName) {
    if (!players || !players.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="ranking-empty">
              ${searchMode ? '未找到该玩家' : '暂无天梯数据'}
              <span>${searchMode ? '请检查输入的名称是否正确' : '在M#比赛房间完成登录对局后将自动收录'}</span>
            </div>
          </td>
        </tr>`;
      return;
    }

    tableBody.innerHTML = players
      .map((p, i) => {
        const isHighlight = highlightName && p.name === highlightName;
        const streakStr = p.streak > 1 ? ` 🔥${p.streak}连胜` : '';
        return `
        <tr class="${isHighlight ? 'search-highlight' : ''}">
          <td class="rank-num">${i + 1}</td>
          <td class="rank-name">${escapeHtml(p.name)}</td>
          <td class="rank-rating">${p.rating}</td>
          <td class="rank-record">${p.wins}胜 ${p.losses}负 ${p.draws}平</td>
          <td class="rank-winrate">${p.winRate}</td>
          <td class="rank-record">${p.total}场</td>
          <td class="rank-streak">${streakStr || '-'}</td>
          <td><button class="deck-btn" data-player="${escapeHtml(p.name)}">卡组</button></td>
        </tr>`;
      })
      .join('');

    // Bind deck button events
    tableBody.querySelectorAll('.deck-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const playerName = btn.getAttribute('data-player');
        fetchPlayerDeck(playerName);
      });
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function sortCards(ids) {
    return (ids || []).slice().sort(function (a, b) { return a - b; });
  }

  function cardImgs(ids) {
    if (!ids || !ids.length) return '<div class="deck-empty-tip">无</div>';
    return sortCards(ids).map(function (id) {
      return '<img src="' + OCG_PIC_URL + id + '.jpg" class="deck-card-img" alt="' + id + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + DIY_PIC_URL + id + '.jpg\';this.onerror=function(){this.src=\'' + FALLBACK_PIC + '\';}">';
    }).join('');
  }

  async function fetchPlayerDeck(playerName) {
    deckModalTitle.textContent = playerName + ' - 最近胜局卡组';
    deckModalBody.innerHTML = '<div class="deck-loading">加载中...</div>';
    deckModalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
      const url = DECKS_API_URL + '?player=' + encodeURIComponent(playerName) + '&limit=1';
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();

      if (!data.decks || !data.decks.length) {
        deckModalBody.innerHTML = '<div class="deck-empty">该玩家暂无天梯胜局记录</div>';
        return;
      }

      const deck = data.decks[0];
      deckModalTitle.textContent = playerName + ' VS ' + deck.opponent + ' (' + deck.score + '胜)';

      var extraSide = (deck.deck.extra || []).concat(deck.deck.side || []);

      deckModalBody.innerHTML = `
        <div class="deck-info">
          <span class="deck-info-item">房间: ${escapeHtml(deck.roomName)}</span>
          <span class="deck-info-item">时间: ${formatTime(deck.time)}</span>
        </div>
        <div class="deck-two-col">
          <div class="deck-col deck-col-main">
            <div class="deck-section-title">主卡组 (${deck.deck.main.length}张)</div>
            <div class="deck-cards-grid deck-cards-main" style="grid-template-columns:repeat(${Math.ceil(deck.deck.main.length / 4)},1fr);grid-template-rows:repeat(4,1fr);">${cardImgs(deck.deck.main)}</div>
          </div>
          <div class="deck-col deck-col-side">
            ${deck.deck.extra.length ? '<div class="deck-section-title">额外卡组 (' + deck.deck.extra.length + '张)</div><div class="deck-cards-grid deck-cards-extra">' + cardImgs(deck.deck.extra) + '</div>' : ''}
            ${deck.deck.side.length ? '<div class="deck-section-title">副卡组 (' + deck.deck.side.length + '张)</div><div class="deck-cards-grid deck-cards-side">' + cardImgs(deck.deck.side) + '</div>' : ''}
            ${!deck.deck.extra.length && !deck.deck.side.length ? '<div class="deck-empty-tip">无</div>' : ''}
          </div>
        </div>
      `;
    } catch (e) {
      deckModalBody.innerHTML = '<div class="deck-empty">加载失败: ' + e.message + '</div>';
    }
  }

  function formatTime(iso) {
    var d = new Date(iso);
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0');
  }

  function closeDeckModal() {
    deckModalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Manual wheel scroll for modal
  deckModalOverlay.addEventListener('wheel', function (e) {
    var modal = deckModalOverlay.querySelector('.deck-modal');
    if (modal) {
      modal.scrollTop += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });

  // Modal close events
  deckModalClose.addEventListener('click', closeDeckModal);
  deckModalOverlay.addEventListener('click', function (e) {
    if (e.target === deckModalOverlay) closeDeckModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDeckModal();
  });

  async function fetchRanking() {
    const search = (searchInput.value || '').trim();
    let url = API_URL;
    if (search) {
      url += '?search=' + encodeURIComponent(search);
    }

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      currentData = data.players || [];
      searchMode = !!search;
      renderTable(currentData, search || undefined);
    } catch (e) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="ranking-empty">
              数据加载失败
              <span>${e.message}</span>
            </div>
          </td>
        </tr>`;
    }
  }

  function clearSearch() {
    searchInput.value = '';
    searchMode = false;
    fetchRanking();
  }

  async function fetchCardStats() {
    deckModalTitle.textContent = '📊 卡片使用率/胜率 TOP50';
    deckModalBody.innerHTML = '<div class="deck-loading">加载中...</div>';
    deckModalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
      const resp = await fetch(CARD_STATS_URL);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();

      deckModalBody.innerHTML = `
        <div class="stats-tabs">
          <button class="stats-tab active" data-tab="usage">🔥 使用率 TOP53</button>
          <button class="stats-tab" data-tab="winrate">🏆 胜率 TOP53</button>
        </div>
        <div class="stats-panel active" id="statsPanelUsage">${renderPodiumGrid(data.topUsed)}</div>
        <div class="stats-panel" id="statsPanelWinrate">${renderPodiumGrid(data.topWinRate)}</div>
        <div class="stats-footer">统计对局数: ${data.totalDuels}场</div>
      `;

      // Tab switching
      deckModalBody.querySelectorAll('.stats-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          deckModalBody.querySelectorAll('.stats-tab').forEach(function (t) { t.classList.remove('active'); });
          deckModalBody.querySelectorAll('.stats-panel').forEach(function (p) { p.classList.remove('active'); });
          tab.classList.add('active');
          var panelId = tab.getAttribute('data-tab') === 'usage' ? 'statsPanelUsage' : 'statsPanelWinrate';
          document.getElementById(panelId).classList.add('active');
        });
      });
    } catch (e) {
      deckModalBody.innerHTML = '<div class="deck-empty">加载失败: ' + e.message + '</div>';
    }
  }

  function statCardImg(c) {
    return '<div class="stat-card" title="#' + c.cardId + ' 使用率' + c.usageRate + ' 胜率' + c.winRate + ' 胜' + c.wins + '/' + c.total + '">' +
      '<img src="' + OCG_PIC_URL + c.cardId + '.jpg" class="deck-card-img" alt="' + c.cardId + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + DIY_PIC_URL + c.cardId + '.jpg\';this.onerror=function(){this.src=\'' + FALLBACK_PIC + '\';}">' +
      '<div class="stat-card-info"><span class="stat-card-rate">使用' + c.usageRate + '</span><span class="stat-card-count">胜率' + c.winRate + ' (' + c.wins + '/' + c.total + ')</span></div>' +
      '</div>';
  }

  function renderPodiumGrid(cards) {
    if (!cards || !cards.length) return '<div class="deck-empty">暂无数据</div>';
    var top3 = cards.slice(0, 3);
    var rest = cards.slice(3, 53);
    var html = '';
    if (top3.length >= 2) {
      html += '<div class="stats-podium">' +
        '<div class="podium-top">' + statCardImg(top3[0]) + '</div>' +
        '<div class="podium-bottom">' + statCardImg(top3[1]) + statCardImg(top3[2]) + '</div>' +
        '</div>';
    }
    if (rest.length) {
      html += '<div class="deck-cards-grid">' + rest.map(statCardImg).join('') + '</div>';
    }
    return html;
  }

  // Events
  searchBtn.addEventListener('click', fetchRanking);
  clearBtn.addEventListener('click', clearSearch);
  document.getElementById('cardStatsBtn').addEventListener('click', fetchCardStats);
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') fetchRanking();
  });

  // Load on section show
  const observer = new MutationObserver(function (mutations) {
    for (const m of mutations) {
      if (
        m.type === 'attributes' &&
        m.attributeName === 'class' &&
        section.classList.contains('active')
      ) {
        fetchRanking();
      }
    }
  });
  observer.observe(section, { attributes: true, attributeFilter: ['class'] });

  // Also load on first click of sidebar button
  document.getElementById('playerRankingBtn').addEventListener('click', function () {
    fetchRanking();
  });
})();
