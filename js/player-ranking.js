(function () {
  'use strict';

  const API_URL = 'https://api.ygopro3.cn/api/ladder';
  const section = document.getElementById('section-player-ranking');
  const tableBody = document.getElementById('rankTableBody');
  const searchInput = document.getElementById('rankingSearchInput');
  const searchBtn = document.getElementById('rankingSearchBtn');
  const clearBtn = document.getElementById('rankingClearBtn');

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
        </tr>`;
      })
      .join('');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

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

  // Events
  searchBtn.addEventListener('click', fetchRanking);
  clearBtn.addEventListener('click', clearSearch);
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
