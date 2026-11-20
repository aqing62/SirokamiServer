(function () {
  'use strict';

  const API_URL = 'https://api.ygopro3.cn/api/ladder';
  const DECKS_API_URL = 'https://api.ygopro3.cn/api/ladder/decks';
  const DUELS_API_URL = 'https://api.ygopro3.cn/api/ladder/duels';
  // PATCH(白神服) 2026-11-15: 改走站点自己的接口 —— srvpro 那份会把自战统计进去
  const CARD_STATS_URL = '/api/ladder/card-stats';
  // 2026-11-20: 玩家称号（站点接口，带稀有度：白/绿/蓝/黄/红，紫=任务称号）
  const TITLES_URL = '/api/ladder/titles';
  const RARITY_KEYS = ['白', '绿', '蓝', '黄', '红', '紫'];
  const RARITY_NAMES = { '白': '普通', '绿': '优秀', '蓝': '稀有', '黄': '史诗', '红': '传说', '紫': '任务' };
  let _titlesCache = { t: 0, map: {} };
  const OCG_PIC_URL = 'https://cdn.233.momobako.com/ygopro/pics/';
  const SUPER_PRE_URL = 'https://cdn02.moecube.com:444/ygopro-super-pre/data/pics/';
  const DIY_PIC_URL = 'https://api.ygopro3.cn/pics/siro/';
  const FALLBACK_PIC = 'cover.jpg';
  let _lflistCache = null;
  let _lflistLimit = 100; // G-Ext 卡组总分上限（/api/scores 响应头 X-GExt-Limit）
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
        <tr class="${isHighlight ? 'search-highlight' : ''}" data-player="${escapeHtml(p.name)}">
          <td class="rank-num">${i + 1}</td>
          <td class="rank-name"><span class="rank-player">${escapeHtml(p.name)}</span>${titleLineHtml(p.name)}</td>
          <td class="rank-rating">${p.rating}</td>
          <td class="rank-record">${p.wins}胜 ${p.losses}负 ${p.draws}平</td>
          <td class="rank-winrate">${p.winRate}</td>
          <td class="rank-record">${p.total}场</td>
          <td class="rank-streak">${streakStr || '-'}</td>
          <td><button class="deck-btn" data-player="${escapeHtml(p.name)}">卡组</button></td>
        </tr>`;
      })
      .join('');

    // 查看对局记录：点玩家名 / 📜 / 行（避开卡组按钮）
    tableBody.querySelectorAll('tr[data-player]').forEach(function (row) {
      const openDuels = function (e) {
        if (e.target.closest && e.target.closest('.deck-btn')) return;
        const playerName = row.getAttribute('data-player');
        fetchPlayerDuels(playerName);
      };
      row.addEventListener('click', openDuels);
    });

    // Bind deck button events
    tableBody.querySelectorAll('.deck-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
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

  /** 拉玩家称号（60 秒缓存；接口挂了不影响榜单） */
  async function loadPlayerTitles(force) {
    if (!force && Date.now() - _titlesCache.t < 60000) return _titlesCache.map;
    try {
      const resp = await fetch(TITLES_URL + '?t=' + Date.now(), { cache: 'no-store' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      _titlesCache = { t: Date.now(), map: (data && data.titles) || {} };
    } catch (e) {
      // 45 秒后再试，期间继续用旧缓存
      _titlesCache.t = Date.now() - 45000;
    }
    return _titlesCache.map;
  }

  /** 玩家名下方的称号（主 + 副），按稀有度上色 */
  function titleLineHtml(name) {
    const list = _titlesCache.map[name];
    if (!list || !list.length) return '';
    const parts = list.map(function (t) {
      const rarity = RARITY_KEYS.indexOf(t.rarity) >= 0 ? t.rarity : '紫';
      return '<span class="rank-title" data-rarity="' + rarity + '" title="'
        + (RARITY_NAMES[rarity] || '任务') + '称号">' + escapeHtml(t.title) + '</span>';
    });
    return '<span class="rank-titles">' + parts.join('<i class="rank-title-dot">·</i>') + '</span>';
  }

  function sortCards(ids) {
    return (ids || []).slice().sort(function (a, b) { return a - b; });
  }

  // PATCH(白神服) 2026-11-03 先行卡图：按卡片来源选主图床
  //   先行卡（pre）必须首选 super-pre；本站/OCG 图床上很多先行卡是空白占位图（返回 200，
  //   不会触发 onerror，兜底救不回来）→ 直接按来源决定主 URL。
  function picUrls(id) {
    var c = resolveCardInfo(id);
    var src = c && c.source;
    if (src === 'pre') {
      return [SUPER_PRE_URL + id + '.jpg', OCG_PIC_URL + id + '.jpg', DIY_PIC_URL + id + '.jpg'];
    }
    if (src === 'diy') {
      // PATCH(白神服) 2026-11-07: DIY 卡优先用**本站图床**（它才是 DIY 图源）；
      //   只有本站缺图时才退到 super-pre / OCG（用户反馈：DIY 图源不能先试 super-pre）
      return [DIY_PIC_URL + id + '.jpg', SUPER_PRE_URL + id + '.jpg', OCG_PIC_URL + id + '.jpg'];
    }
    // 卡表里查不到来源时：DIY 卡号段（>= 60000000）按本站图床优先，避免再去 404 萌卡
    if (!c && parseInt(id, 10) >= 60000000) {
      return [DIY_PIC_URL + id + '.jpg', SUPER_PRE_URL + id + '.jpg', OCG_PIC_URL + id + '.jpg'];
    }
    return [OCG_PIC_URL + id + '.jpg', SUPER_PRE_URL + id + '.jpg', DIY_PIC_URL + id + '.jpg'];
  }

  /** 生成一张卡图 <img>：三级兜底 + 落到本站 DIY 图床时自动加 DIY 角标 */
  function cardImgHtml(id, cls) {
    var urls = picUrls(id);
    var handler = "this.onerror=function(){this.src='" + FALLBACK_PIC + "'}";
    for (var i = urls.length - 1; i >= 1; i--) {
      var inner = handler;
      var next = urls[i];
      handler = "this.onerror=function(){" + inner + ";this.src='" + next + "'}";
    }
    var onload = "this.onload=function(){var w=this.closest('.card-img-wrapper');"
      + "if(w&&this.src.indexOf('api.ygopro3.cn/pics/siro')>=0&&!w.querySelector('.card-diy-badge')){"
      + "var b=document.createElement('div');b.className='card-diy-badge';b.textContent='DIY';w.appendChild(b);}}";
    return '<img src="' + urls[0] + '" class="' + (cls || 'deck-card-img') + '" alt="' + id
      + '" loading="lazy" onload="' + onload + '" onerror="' + handler + '">';
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
      return '<div class="card-img-wrapper" data-card-id="' + id + '">' + cardImgHtml(id) + scoreBadge + '</div>';
    }).join('');
  }

  async function loadScoreMap() {
    if (_lflistCache) return _lflistCache;
    try {
      var resp = await fetch('/api/scores?t=' + Date.now());
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var limit = parseInt(resp.headers.get('X-GExt-Limit'), 10);
      if (!isNaN(limit) && limit > 0) _lflistLimit = limit;
      _lflistCache = await resp.json();
      return _lflistCache;
    } catch (e) {
      console.warn('Failed to load scores:', e);
      _lflistCache = {};
      return _lflistCache;
    }
  }

  // 计算卡组总分（主+额外+副，逐张累加分值）
  function calcDeckScore(deck, scoreMap) {
    var total = 0;
    if (!deck) return 0;
    ['main', 'extra', 'side'].forEach(function (sec) {
      var ids = deck[sec] || [];
      for (var i = 0; i < ids.length; i++) {
        var s = scoreMap && scoreMap[ids[i]];
        if (s) total += (s.score || 0);
      }
    });
    return total;
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
      ? '<div class="tooltip-atkdef">ATK ' + (card.atk < 0 ? '?' : card.atk) + ' / DEF ' + (((card.type | 0) & 0x4000000) ? '—' : (card.def < 0 ? '?' : card.def)) + '</div>'
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

  // ── 查看指定玩家的对局记录列表 ──
  async function fetchPlayerDuels(playerName) {
    deckModalTitle.textContent = '⚔ ' + playerName + ' 的对局记录';
    // 对局记录用小窗（卡组视图仍然用大窗）
    try {
      var _m1 = document.querySelector('#deckModalOverlay .deck-modal');
      if (_m1) _m1.classList.add('narrow');
    } catch (e) {}
    deckModalBody.innerHTML = '<div class="deck-loading">加载中...</div>';
    deckModalDl.style.display = 'none';
    deckModalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
      const url = DUELS_API_URL + '?player=' + encodeURIComponent(playerName) + '&limit=50';
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();

      const list = data.duels || [];
      if (!list.length) {
        deckModalBody.innerHTML = '<div class="deck-empty">该玩家暂无对局记录</div>';
        return;
      }

      const rows = list.map(function (d) {
        var t = new Date(d.time);
        var ts = (t.getMonth() + 1) + '/' + t.getDate() + ' ' +
          String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
        var resultTag = d.draw
          ? '<span class="duel-result duel-draw">平</span>'
          : (d.win
            ? '<span class="duel-result duel-win">胜</span>'
            : '<span class="duel-result duel-lose">负</span>');
        return '<div class="duel-item">'
          + resultTag
          + '<span class="duel-time">' + ts + '</span>'
          + '<span class="duel-room">' + escapeHtml(d.roomName || '') + '</span>'
          + '<span class="duel-name">' + escapeHtml(d.opponentName || '') + '</span>'
          + '<span class="duel-right">'
          + (d.ladder ? '<span class="duel-tag">天梯</span>' : '')
          + '<span class="duel-replay" data-code="' + escapeHtml(d.replayCode) + '" title="点击复制回放码">' + escapeHtml(d.replayCode) + '</span>'
          + '<button class="duel-watch" data-code="' + escapeHtml(d.replayCode) + '" title="弹窗播放回放">▶ 回放</button>'
          + '</span>'
          + '</div>';
      }).join('');

      deckModalBody.innerHTML =
        '<div class="duel-list" style="gap:0;">'
        + '<div style="color:#888;font-size:12px;padding:6px 2px 10px;">共 ' + list.length + ' 场 · 点击回放码复制</div>'
        + rows
        + '</div>';

      // 复制回放码
      deckModalBody.querySelectorAll('.duel-replay').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          var code = el.getAttribute('data-code') || '';
          var done = function () { alert('已复制回放码: ' + code); };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(done).catch(done);
          } else {
            done();
          }
        });
      });
      // 弹窗播放回放
      deckModalBody.querySelectorAll('.duel-watch').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (window.openReplay) window.openReplay(btn.getAttribute('data-code') || '');
        });
      });
    } catch (e) {
      deckModalBody.innerHTML = '<div class="deck-empty">加载失败: ' + e.message + '</div>';
    }
  }

  // 调试/外部调用（也方便网站其它地方直接打开对局记录）
  try { window.fetchPlayerDuels = fetchPlayerDuels; } catch (e) {}

  async function fetchPlayerDeck(playerName) {
    deckModalTitle.textContent = playerName + ' - 最近胜局卡组';
    try {
      var _m2 = document.querySelector('#deckModalOverlay .deck-modal');
      if (_m2) _m2.classList.remove('narrow');
    } catch (e) {}
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
      var totalScore = calcDeckScore(deck.deck, scoreMap);

      deckModalBody.innerHTML = `
        <div class="deck-info">
          <span class="deck-info-item">房间: ${escapeHtml(deck.roomName)}</span>
          <span class="deck-info-item">时间: ${formatTime(deck.time)}</span>
          <span class="deck-info-item deck-total-item">总分：<b>${totalScore}</b>/${_lflistLimit}${totalScore > _lflistLimit ? ' ⚠️超限' : ''}</span>
        </div>
        <div class="deck-two-col">
          <div class="deck-col deck-col-main">
            <div class="deck-section-title">主卡组 (${deck.deck.main.length}张)</div>
            <div class="deck-cards-grid deck-cards-main" style="grid-template-columns:repeat(${Math.max(10, Math.ceil(deck.deck.main.length / 4))},1fr);grid-template-rows:repeat(4,1fr);">${cardImgs(deck.deck.main, scoreMap)}</div>
          </div>
          <div class="deck-col deck-col-side">
            ${deck.deck.extra.length ? '<div class="deck-section-title">额外卡组 (' + deck.deck.extra.length + '张)</div><div class="deck-cards-grid deck-cards-extra">' + cardImgs(deck.deck.extra, scoreMap) + '</div>' : ''}
            ${deck.deck.side.length ? '<div class="deck-section-title">副卡组 (' + deck.deck.side.length + '张)</div><div class="deck-cards-grid deck-cards-side">' + cardImgs(deck.deck.side, scoreMap) + '</div>' : ''}
            ${!deck.deck.extra.length && !deck.deck.side.length ? '<div class="deck-empty-tip">无</div>' : ''}
          </div>
        </div>
      `;

      // 优先复用全局卡组悬浮（含官方卡效果补全），否则用本页的 DIY-only 悬浮
      if (window.DeckViewer && window.DeckViewer.attachCardHover) {
        window.DeckViewer.attachCardHover(deckModalBody);
      } else {
        attachDeckHover();
      }
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

  // 阻止滚轮事件冒泡到全局处理器，让浏览器原生处理弹窗滚动
  deckModalOverlay.addEventListener('wheel', function (e) {
    e.stopPropagation();
  }, { passive: true });

  // Modal close events
  deckModalClose.addEventListener('click', closeDeckModal);
  deckModalOverlay.addEventListener('click', function (e) {
    if (e.target === deckModalOverlay) closeDeckModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDeckModal();
  });

  async function fetchRanking(opts) {
    const search = (searchInput.value || '').trim();
    // 带时间戳防缓存：赛季重置后必须立刻看到最新榜单
    let url = API_URL + '?t=' + Date.now();
    if (search) {
      url += '&search=' + encodeURIComponent(search);
    }

    try {
      // 先拿称号：进入排名页时强制刷新（换完称号立刻可见），搜索时用 60 秒缓存
      await loadPlayerTitles(!!(opts && opts.refreshTitles));
      const resp = await fetch(url, { cache: 'no-store' });
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
      // PATCH(白神服) 2026-11-13: 先等卡表就绪 —— picUrls() 要靠 card.source 选图床，
      //   卡表没加载时 DIY 卡会退回 OCG 图床（70700025 之前就是这样显示错源 ✗）
      try { await loadCardInfoMap(); } catch (e) {}

      deckModalBody.innerHTML = `
        <div class="stats-tabs">
          <button class="stats-tab active" data-tab="usage">🔥 使用率 TOP53</button>
          <button class="stats-tab" data-tab="winrate">🏆 胜率 TOP53</button>
        </div>
        <div class="stats-panel active" id="statsPanelUsage">${renderPodiumGrid(data.topUsed)}</div>
        <div class="stats-panel" id="statsPanelWinrate">${renderPodiumGrid(data.topWinRate)}</div>
        <div class="stats-footer">${seasonLabel(data)} · 统计对局数: ${data.totalDuels} 场（已排除自战 / 同一账号占两边座位）</div>
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
      cardImgHtml(c.cardId) +
      '<div class="stat-card-info"><span class="stat-card-rate">使用' + c.usageRate + '</span><span class="stat-card-count">胜率' + c.winRate + ' (' + c.wins + '/' + c.total + ')</span></div>' +
      '</div>';
  }


  function seasonLabel(data) {
    var s = data && data.season;
    if (s && s.name) return '统计范围: ' + s.name + '（' + (s.start || '') + ' 起）';
    return '统计范围: 本赛季';
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

  // ── 先手 / 后手 胜率（数据来自游戏服数据库 duel_record_player.isFirst） ──
  const winratePanel = document.getElementById('winratePanel');
  const winrateSeason = document.getElementById('winrateSeason');
  const winrateScopes = document.getElementById('winrateScopes');
  const winrateMonths = document.getElementById('winrateMonths');
  const winrateNote = document.getElementById('winrateNote');
  let _winrateLoaded = false;

  function winrateBar(cls, label, rate) {
    if (rate === null || rate === undefined) return '';
    const pct = Math.max(0, Math.min(100, Number(rate)));
    return '<div class="winrate-row ' + cls + '">' +
      '<span class="winrate-label">' + label + '</span>' +
      '<span class="winrate-bar"><i style="width:' + pct.toFixed(2) + '%"></i></span>' +
      '<span class="winrate-value">' + pct.toFixed(2) + '%</span>' +
      '</div>';
  }

  function renderWinrate(d) {
    if (!winratePanel) return;
    const season = d.season || {};
    const sc = winrateSeason;

    // ① 当前赛季天梯 —— 主展示
    if (sc) {
      const range = (season.start || '') + (season.end ? ' ~ ' + season.end : '');
      sc.innerHTML =
        '<div class="winrate-season-head">' +
          '<span class="winrate-season-badge">' + escapeHtml(season.name || '当前赛季') + '</span>' +
          '<span class="winrate-season-name">当前赛季 · 天梯房先后手胜率</span>' +
          '<span class="winrate-season-games">' + (season.firstGames || 0).toLocaleString() + ' 场有效对局</span>' +
        '</div>' +
        '<div class="winrate-season-bars">' +
          winrateBar('first', '先手', season.firstWinRate) +
          winrateBar('second', '后手', season.secondWinRate) +
        '</div>' +
        '<div class="winrate-season-foot">' +
          '统计范围：' + escapeHtml(range) + ' · 仅 M# 房且双方均已登录的对局' +
          (season.firstWinRate !== null && season.secondWinRate !== null
            ? ' · 先手领先 ' + (season.firstWinRate - season.secondWinRate).toFixed(2) + ' 个百分点'
            : '') +
        '</div>';
    }

    if (winrateNote) {
      winrateNote.textContent = '每 5 分钟更新';
    }

    // ② 其它口径 —— 小字一行
    winrateScopes.innerHTML = (d.scopes || []).map(function (s) {
      return '<span class="winrate-mini">' +
        '<b>' + escapeHtml(s.label || s.key) + '</b>' +
        '<span class="f">先 ' + (s.firstWinRate === null ? '-' : s.firstWinRate + '%') + '</span>' +
        '<span class="s">后 ' + (s.secondWinRate === null ? '-' : s.secondWinRate + '%') + '</span>' +
        '<i>(' + (s.games || 0).toLocaleString() + ' 人次)</i>' +
        '</span>';
    }).join('');

    // ③ 按月趋势
    winrateMonths.innerHTML = (d.monthly || []).map(function (m) {
      const mon = String(m.month || '').replace('-', '/');
      return '<span class="winrate-month"><b>' + escapeHtml(mon) + '</b>' +
        '<span class="f">先 ' + (m.firstWinRate === null ? '-' : m.firstWinRate + '%') + '</span>' +
        ' <span class="s">后 ' + (m.secondWinRate === null ? '-' : m.secondWinRate + '%') + '</span>' +
        '</span>';
    }).join('');
    winratePanel.hidden = false;
  }

  async function fetchWinrate() {
    if (!winratePanel || _winrateLoaded) return;
    try {
      const resp = await fetch('/api/stats/first-second?t=' + Date.now());
      const d = await resp.json();
      if (!d || !d.ok) throw new Error((d && d.error) || '接口异常');
      renderWinrate(d);
      _winrateLoaded = true;
    } catch (e) {
      winrateScopes.innerHTML = '<div class="winrate-err">统计读取失败：' + escapeHtml(e.message || e) + '</div>';
      winratePanel.hidden = false;
      _winrateLoaded = true;   // 失败也不反复重试
    }
  }

  // Events
  searchBtn.addEventListener('click', fetchRanking);
  clearBtn.addEventListener('click', clearSearch);
  document.getElementById('cardStatsBtn').addEventListener('click', fetchCardStats);
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') fetchRanking();
  });

  // 进入排名页（含侧边栏点击）：80ms 去抖 —— class 先移除再加回会触发两次 Observer
  let _enterTimer = 0;
  function enterRanking() {
    clearTimeout(_enterTimer);
    _enterTimer = setTimeout(function () {
      fetchRanking({ refreshTitles: true });
      fetchWinrate();
    }, 80);
  }

  // Load on section show
  const observer = new MutationObserver(function () {
    if (section.classList.contains('active')) enterRanking();
  });
  observer.observe(section, { attributes: true, attributeFilter: ['class'] });

  // Also load on first click of sidebar button
  document.getElementById('playerRankingBtn').addEventListener('click', enterRanking);
})();
