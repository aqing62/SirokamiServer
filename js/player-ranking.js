(function () {
  'use strict';

  const API_URL = 'https://api.ygopro3.cn/api/ladder';
  const DECKS_API_URL = 'https://api.ygopro3.cn/api/ladder/decks';
  const CARD_STATS_URL = 'https://api.ygopro3.cn/api/ladder/card-stats';
  const OCG_PIC_URL = 'https://cdn.233.momobako.com/ygopro/pics/';
  const SUPER_PRE_URL = 'https://cdn02.moecube.com:444/ygopro-super-pre/data/pics/';
  const DIY_PIC_URL = 'https://api.ygopro3.cn/pics/siro/';
  const FALLBACK_PIC = 'cover.jpg';
  let _lflistCache = null;
  let _cardInfoMap = null;
  let _aliasMap = null;
  const section = document.getElementById('section-player-ranking');
  const tableBody = document.getElementById('rankTableBody');
  const searchInput = document.getElementById('rankingSearchInput');
  const searchBtn = document.getElementById('rankingSearchBtn');
  const clearBtn = document.getElementById('rankingClearBtn');
  const deckModalOverlay = document.getElementById('deckModalOverlay');
  const deckModalTitle = document.getElementById('deckModalTitle');
  const deckModalBody = document.getElementById('deckModalBody');
  const deckModalClose = document.getElementById('deckModalClose');
  const deckModalDl = document.getElementById('deckModalDl');

  let currentData = [];
  let searchMode = false;
  let _currentDeckData = null;
  let _currentPlayerName = '';
  let _lastDlTime = 0;

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

  function cardImgs(ids, scoreMap) {
    if (!ids || !ids.length) return '<div class="deck-empty-tip">无</div>';
    return sortCards(ids).map(function (id) {
      var scoreBadge = '';
      if (scoreMap && scoreMap[id]) {
        if (scoreMap[id].forbidden) {
          scoreBadge = '<div class="card-score-badge forbidden">🚫</div>';
        } else {
          scoreBadge = '<div class="card-score-badge">' + scoreMap[id].score + '</div>';
        }
      }
      return '<div class="card-img-wrapper" data-card-id="' + id + '"><img src="' + OCG_PIC_URL + id + '.jpg" class="deck-card-img" alt="' + id + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + SUPER_PRE_URL + id + '.jpg\';this.onerror=function(){this.onerror=null;this.src=\'' + DIY_PIC_URL + id + '.jpg\';this.onload=function(){var w=this.closest(\'.card-img-wrapper\');if(w&&!w.querySelector(\'.card-diy-badge\')){var b=document.createElement(\'div\');b.className=\'card-diy-badge\';b.textContent=\'DIY\';w.appendChild(b);}};this.onerror=function(){this.src=\'' + FALLBACK_PIC + '\';}}">' + scoreBadge + '</div>';
    }).join('');
  }

  async function loadScoreMap() {
    if (_lflistCache) return _lflistCache;
    try {
      var resp = await fetch('/api/scores');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      _lflistCache = await resp.json();
      return _lflistCache;
    } catch (e) {
      console.warn('Failed to load scores:', e);
      _lflistCache = {};
      return _lflistCache;
    }
  }

  async function loadCardInfoMap() {
    if (_cardInfoMap) return _cardInfoMap;
    // 优先复用卡池页面已加载的数据
    if (window._cardIndex && window._cardIndex.size) {
      _cardInfoMap = window._cardIndex;
      _aliasMap = _buildAliasMap(window._cardIndex);
      return _cardInfoMap;
    }
    try {
      var resp = await fetch('/api/cards');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var cards = await resp.json();
      _cardInfoMap = new Map();
      cards.forEach(function (c) { _cardInfoMap.set(parseInt(c.id), c); });
      _aliasMap = _buildAliasMap(_cardInfoMap);
      return _cardInfoMap;
    } catch (e) {
      console.warn('Failed to load card info:', e);
      _cardInfoMap = new Map();
      _aliasMap = {};
      return _cardInfoMap;
    }
  }

  function _buildAliasMap(cardMap) {
    var aliasMap = {};
    cardMap.forEach(function (card) {
      if (card.alias) aliasMap[parseInt(card.id)] = parseInt(card.alias);
    });
    return aliasMap;
  }

  function resolveCardInfo(cardId) {
    if (_cardInfoMap) {
      var card = _cardInfoMap.get(cardId);
      if (card) return card;
      var aliasId = _aliasMap && _aliasMap[cardId];
      if (aliasId) return _cardInfoMap.get(aliasId) || null;
    }
    return null;
  }

  // ── 卡图悬停 tooltip ──
  var _tooltipEl = null;
  function ensureTooltip() {
    if (_tooltipEl) return _tooltipEl;
    _tooltipEl = document.createElement('div');
    _tooltipEl.className = 'card-tooltip';
    _tooltipEl.style.display = 'none';
    document.body.appendChild(_tooltipEl);
    return _tooltipEl;
  }

  function showTooltip(e, card) {
    var tip = ensureTooltip();
    var isMonster = card.typeInfo && card.typeInfo.baseType === '怪兽';
    var atkDef = isMonster
      ? '<div class="tooltip-atkdef">ATK ' + (card.atk < 0 ? '?' : card.atk) + ' / DEF ' + (card.def < 0 ? '?' : card.def) + '</div>'
      : '';
    var raceAttr = isMonster
      ? '<div class="tooltip-raceattr">' + card.attrName + ' | ' + card.raceName + (card.level ? ' | Lv' + card.level : '') + '</div>'
      : '';
    tip.innerHTML = '<div class="tooltip-name">' + (card.name || '') + '</div>'
      + '<div class="tooltip-type">' + (card.typeInfo ? card.typeInfo.fullType : '') + '</div>'
      + raceAttr
      + atkDef
      + '<div class="tooltip-desc">' + (card.processedDesc || '') + '</div>';
    tip.style.display = 'block';

    // 定位：窄屏居中顶部，宽屏跟随鼠标
    if (window.innerWidth <= 768) {
      tip.style.left = Math.max(4, (window.innerWidth - tip.offsetWidth) / 2) + 'px';
      tip.style.top = '8px';
    } else {
      var x = e.clientX + 14;
      var y = e.clientY + 10;
      var tw = tip.offsetWidth;
      var th = tip.offsetHeight;
      if (x + tw > window.innerWidth - 10) x = e.clientX - tw - 14;
      if (y + th > window.innerHeight - 10) y = e.clientY - th - 10;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    }
  }

  function hideTooltip() {
    if (_tooltipEl) _tooltipEl.style.display = 'none';
  }

  function attachDeckHover() {
    deckModalBody.querySelectorAll('.card-img-wrapper').forEach(function (wrapper) {
      wrapper.addEventListener('mouseenter', function (e) {
        var cardId = parseInt(wrapper.getAttribute('data-card-id'));
        if (!cardId || !_cardInfoMap) return;
        var card = resolveCardInfo(cardId);
        if (card) showTooltip(e, card);
      });
      wrapper.addEventListener('mousemove', function (e) {
        if (!_tooltipEl || _tooltipEl.style.display === 'none') return;
        if (window.innerWidth > 768) {
          var x = e.clientX + 14;
          var y = e.clientY + 10;
          var tw = _tooltipEl.offsetWidth;
          var th = _tooltipEl.offsetHeight;
          if (x + tw > window.innerWidth - 10) x = e.clientX - tw - 14;
          if (y + th > window.innerHeight - 10) y = e.clientY - th - 10;
          _tooltipEl.style.left = x + 'px';
          _tooltipEl.style.top = y + 'px';
        }
      });
      wrapper.addEventListener('mouseleave', hideTooltip);
      // 移动端触摸
      wrapper.addEventListener('touchstart', function (e) {
        var cardId = parseInt(wrapper.getAttribute('data-card-id'));
        if (!cardId || !_cardInfoMap) return;
        var card = resolveCardInfo(cardId);
        if (card) {
          e.preventDefault();
          showTooltip(e.touches[0], card);
        }
      }, { passive: false });
      wrapper.addEventListener('touchend', hideTooltip);
    });
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
      _currentDeckData = deck.deck;
      _currentPlayerName = playerName;
      deckModalDl.style.display = 'inline-block';
      deckModalTitle.textContent = playerName + ' VS ' + deck.opponent + ' (' + deck.score + '胜)';

      var scoreMap = await loadScoreMap();
      var cardInfoMap = await loadCardInfoMap();

      deckModalBody.innerHTML = `
        <div class="deck-info">
          <span class="deck-info-item">房间: ${escapeHtml(deck.roomName)}</span>
          <span class="deck-info-item">时间: ${formatTime(deck.time)}</span>
        </div>
        <div class="deck-two-col">
          <div class="deck-col deck-col-main">
            <div class="deck-section-title">主卡组 (${deck.deck.main.length}张)</div>
            <div class="deck-cards-grid deck-cards-main" style="grid-template-columns:repeat(${Math.ceil(deck.deck.main.length / 4)},1fr);grid-template-rows:repeat(4,1fr);">${cardImgs(deck.deck.main, scoreMap)}</div>
          </div>
          <div class="deck-col deck-col-side">
            ${deck.deck.extra.length ? '<div class="deck-section-title">额外卡组 (' + deck.deck.extra.length + '张)</div><div class="deck-cards-grid deck-cards-extra">' + cardImgs(deck.deck.extra, scoreMap) + '</div>' : ''}
            ${deck.deck.side.length ? '<div class="deck-section-title">副卡组 (' + deck.deck.side.length + '张)</div><div class="deck-cards-grid deck-cards-side">' + cardImgs(deck.deck.side, scoreMap) + '</div>' : ''}
            ${!deck.deck.extra.length && !deck.deck.side.length ? '<div class="deck-empty-tip">无</div>' : ''}
          </div>
        </div>
      `;

      attachDeckHover();
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
    _currentDeckData = null;
    _currentPlayerName = '';
    deckModalDl.style.display = 'none';
  }

  function downloadCurrentDeck() {
    if (!_currentDeckData) return;
    var now = Date.now();
    if (now - _lastDlTime < 5000) return;
    _lastDlTime = now;

    var lines = ['#created by Sirokami'];
    var d = _currentDeckData;
    if (d.main && d.main.length) {
      lines.push('#main');
      for (var i = 0; i < d.main.length; i++) lines.push(String(d.main[i]));
    }
    if (d.extra && d.extra.length) {
      lines.push('#extra');
      for (var j = 0; j < d.extra.length; j++) lines.push(String(d.extra[j]));
    }
    if (d.side && d.side.length) {
      lines.push('!side');
      for (var k = 0; k < d.side.length; k++) lines.push(String(d.side[k]));
    }
    var content = lines.join('\n');
    var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (_currentPlayerName || 'deck').replace(/[\\/:*?"<>|]/g, '_') + '.ydk';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  deckModalDl.addEventListener('click', downloadCurrentDeck);

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
      '<img src="' + OCG_PIC_URL + c.cardId + '.jpg" class="deck-card-img" alt="' + c.cardId + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + SUPER_PRE_URL + c.cardId + '.jpg\';this.onerror=function(){this.onerror=null;this.src=\'' + DIY_PIC_URL + c.cardId + '.jpg\';this.onerror=function(){this.src=\'' + FALLBACK_PIC + '\';}}">' +
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
