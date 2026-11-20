/* ══════════════════════════════════════════════════════════════════════
 * 称号商店（V2.0.0）
 *
 * 入口：玩家排名页搜索栏左侧「🛒 称号商店」(#titleShopBtn)
 * 数据：GET  /api/title-shop        —— 目录 + 余额 + 已拥有 + 当前赛季积分
 *       POST /api/title-shop/buy    —— 购买（body: {title}）
 *
 * 称号点来源：每赛季结束时，游戏服在清空 player_rating 前把每个人的
 *   最终天梯积分写进 ygo_ladder_season_result；官网余额 = Σ发放 - Σ消费。
 * 购买后称号并入 srv_user.titles，玩家在「个人中心 → 称号展示」自选
 *   主 / 副称号，游戏内下次登录生效。
 * ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var btn = document.getElementById('titleShopBtn');
  var overlay = document.getElementById('titleShopOverlay');
  var bodyEl = document.getElementById('titleShopBody');
  var closeEl = document.getElementById('titleShopClose');
  if (!btn || !overlay || !bodyEl) return;

  var ALL = '全部';
  // 稀有度：白/绿/蓝/黄/红 = 商店五档；紫 = 任务称号（成就/赛季称号，不在商店出售）
  var RARITY_ORDER = ['白', '绿', '蓝', '黄', '红'];
  var RARITY_LABEL = { '白': '普通', '绿': '优秀', '蓝': '稀有', '黄': '史诗', '红': '传说', '紫': '任务' };
  function rarityLabel(r) { return RARITY_LABEL[r] || r || '普通'; }
  function rarityRank(r) {
    var i = RARITY_ORDER.indexOf(r);
    return i < 0 ? RARITY_ORDER.length : i;
  }
  var state = { data: null, loading: false, filter: ALL, buying: false };

  // ── 工具 ──────────────────────────────────────────────
  function esc(v) {
    var d = document.createElement('div');
    d.textContent = v == null ? '' : String(v);
    return d.innerHTML;
  }

  // 属性值转义（esc 不处理引号，标题里带引号时会把 data-title 截断）
  function attr(v) {
    return esc(v).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var toastEl = null;
  var toastTimer = 0;
  function toast(msg, isErr) {
    if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
    toastEl = document.createElement('div');
    toastEl.className = 'ts-toast' + (isErr ? ' err' : '');
    toastEl.textContent = msg;
    document.body.appendChild(toastEl);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
    }, 2800);
  }

  function request(path, opts) {
    opts = opts || {};
    opts.cache = 'no-store';
    opts.credentials = 'same-origin';
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () {
        return { ok: false, error: '服务返回异常（HTTP ' + r.status + '）' };
      });
    });
  }

  function isOpen() {
    return overlay.classList.contains('active');
  }

  // ── 打开 / 关闭 ───────────────────────────────────────
  function open() {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    load();
  }

  function close() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ── 拉数据 ────────────────────────────────────────────
  function load() {
    if (state.loading) return;
    state.loading = true;
    if (!state.data) bodyEl.innerHTML = '<div class="deck-loading">加载中...</div>';
    request('/api/title-shop?t=' + Date.now())
      .then(function (d) {
        if (!d || d.ok === false) throw new Error((d && d.error) || '加载失败');
        state.data = d;
        render();
      })
      .catch(function (e) {
        bodyEl.innerHTML = '<div class="ts-error">称号商店加载失败：' + esc(e.message || e) + '</div>';
      })
      .then(function () { state.loading = false; });
  }

  // ── 渲染 ──────────────────────────────────────────────
  function render() {
    var d = state.data || {};
    var items = d.items || [];
    var season = d.season || {};
    var rarities = [];
    items.forEach(function (it) {
      if (it && it.rarity && rarities.indexOf(it.rarity) < 0) rarities.push(it.rarity);
    });
    rarities.sort(function (a, b) { return rarityRank(a) - rarityRank(b); });

    var html = walletHtml(d, season);
    html += '<div class="ts-rule">'
      + '每赛季结束（<b>' + esc(season.end || '') + '</b>）按你<b>当赛季最终天梯积分</b>发放等量称号点（1 分 = 1 点），跨赛季累计不清零。'
      + '购买的称号会进入你的称号库，可在<b>个人中心 → 称号展示</b>里设为主 / 副称号。'
      + '</div>';
    html += '<div class="ts-tabs">' + [ALL].concat(rarities).map(function (r) {
      var label = r === ALL ? '全部' : rarityLabel(r);
      return '<button class="ts-tab' + (state.filter === r ? ' active' : '') + '" data-rarity="' + esc(r) + '">'
        + (r === ALL ? label : '<i class="ts-tab-dot" data-rarity="' + esc(r) + '"></i>' + esc(label)) + '</button>';
    }).join('') + '</div>';
    html += '<div class="ts-grid" id="tsGrid">' + gridHtml(items, d) + '</div>';
    html += historyHtml(d);
    bodyEl.innerHTML = html;
    bind();
  }

  function walletHtml(d, season) {
    if (!d.loggedIn) {
      return '<div class="ts-wallet">'
        + '<div class="ts-wallet-main">'
        + '<div class="ts-wallet-label">我的称号点</div>'
        + '<div class="ts-wallet-value empty">登录后查看</div>'
        + '<div class="ts-wallet-sub">登录官网账号后查看余额并购买称号</div>'
        + '</div>'
        + '<div class="ts-wallet-side"><button class="ts-login-btn" id="tsLoginBtn">点此登录</button></div>'
        + '</div>';
    }
    var rating = Number(season.currentRating || 0);
    var sub = rating > 0
      ? esc(season.name || '') + ' 赛季进行中：当前天梯 <b>' + rating + '</b> 分，赛季结束结算后预计发放 <b>' + rating + '</b> 称号点'
      : esc(season.name || '') + ' 赛季还没有天梯积分——完成定级赛并上分，赛季末就能换称号点';
    return '<div class="ts-wallet">'
      + '<div class="ts-wallet-main">'
      + '<div class="ts-wallet-label">我的称号点</div>'
      + '<div class="ts-wallet-value">' + Number(d.balance || 0).toLocaleString() + '<small>点</small></div>'
      + '<div class="ts-wallet-sub">' + sub + '</div>'
      + '</div>'
      + '<div class="ts-wallet-side">'
      + '<div><span>累计获得</span><b>' + Number(d.earned || 0).toLocaleString() + '</b></div>'
      + '<div><span>已消费</span><b>' + Number(d.spent || 0).toLocaleString() + '</b></div>'
      + '<div><span>现在能买</span><b>' + Number(d.purchasable || 0) + ' 个</b></div>'
      + '</div>'
      + '</div>';
  }

  function gridHtml(items, d) {
    var list = items.filter(function (it) {
      return state.filter === ALL || it.rarity === state.filter;
    });
    if (!list.length) return '<div class="ts-empty">这个分类下暂时没有称号</div>';

    return list.map(function (it) {
      var owned = !!it.owned;
      var price = Number(it.price || 0);
      var rarity = it.rarity || '白';
      var btnHtml;
      if (owned) {
        btnHtml = '<button class="ts-buy owned" disabled>已拥有</button>';
      } else if (!d.loggedIn) {
        btnHtml = '<button class="ts-buy login" data-title="' + attr(it.title) + '" data-login="1">登录后购买</button>';
      } else if (it.affordable) {
        btnHtml = '<button class="ts-buy" data-title="' + attr(it.title) + '" data-price="' + price + '">购买</button>';
      } else {
        btnHtml = '<button class="ts-buy poor" disabled>还差 ' + (price - Number(d.balance || 0)) + ' 点</button>';
      }
      return '<div class="ts-item' + (owned ? ' owned' : '') + '" data-rarity="' + esc(rarity) + '">'
        + '<div class="ts-item-top">'
        + '<span class="ts-tier" data-rarity="' + esc(rarity) + '">' + esc(rarityLabel(rarity)) + '</span>'
        + '<span class="ts-price">' + price + '</span>'
        + '</div>'
        + '<div class="ts-item-title">' + esc(it.title)
        + (owned ? '<span class="ts-owned-chip">已拥有</span>' : '') + '</div>'
        + '<div class="ts-item-desc">' + esc(it.desc || '') + '</div>'
        + btnHtml
        + '</div>';
    }).join('');
  }

  function historyHtml(d) {
    var hist = d.history || [];
    var owned = d.owned || [];
    if (!hist.length && !owned.length) return '';
    var html = '<div class="ts-history">';
    if (hist.length) {
      html += '<div class="ts-history-title">赛季发放记录</div><div class="ts-history-list">';
      hist.forEach(function (r) {
        html += '<span class="ts-history-item">' + esc(r.season) + ' 赛季 <b>+' + Number(r.rating || 0) + '</b> 点'
          + (r.date ? ' · ' + esc(r.date) : '') + '</span>';
      });
      html += '</div>';
    }
    if (owned.length) {
      html += '<div class="ts-history-title" style="margin-top:12px;">已购买称号</div><div class="ts-history-list">';
      owned.forEach(function (r) {
        html += '<span class="ts-history-item">' + esc(r.title) + ' <b>-' + Number(r.price || 0) + '</b> 点'
          + (r.date ? ' · ' + esc(r.date) : '') + '</span>';
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  // ── 交互 ──────────────────────────────────────────────
  function promptLogin() {
    var gl = document.getElementById('glModalOverlay');
    if (gl) gl.classList.add('active');
    else alert('请先登录官网账号');
  }

  function bind() {
    var grid = document.getElementById('tsGrid');
    if (grid) {
      grid.querySelectorAll('.ts-buy[data-title]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.getAttribute('data-login')) { promptLogin(); return; }
          buy(b.getAttribute('data-title'), Number(b.getAttribute('data-price')));
        });
      });
    }
    bodyEl.querySelectorAll('.ts-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        state.filter = t.getAttribute('data-rarity') || ALL;
        render();
      });
    });
    var lb = document.getElementById('tsLoginBtn');
    if (lb) lb.addEventListener('click', promptLogin);
  }

  function buy(title, price) {
    if (state.buying) return;
    if (!confirm('确定花费 ' + price + ' 称号点购买「' + title + '」吗？\n\n'
      + '购买后可在「个人中心 → 称号展示」设为主 / 副称号，游戏内下次登录生效。')) {
      return;
    }
    state.buying = true;
    request('/api/title-shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title }),
    }).then(function (d) {
      if (!d || d.ok === false) throw new Error((d && d.error) || '购买失败');
      state.data = d;
      render();
      toast('已购买「' + title + '」，去个人中心设置展示吧');
    }).catch(function (e) {
      toast(e.message || '购买失败', true);
    }).then(function () {
      state.buying = false;
    });
  }

  // ── 事件绑定 ──────────────────────────────────────────
  btn.addEventListener('click', open);
  if (closeEl) closeEl.addEventListener('click', close);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });
  overlay.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) close();
  });

  // 切到别的页面时自动关闭 —— 商店是全局弹窗，不该跨页面留着
  // （以前切走「玩家排名」时，排名页的 CSS 被卸载，弹窗会变成无样式的一坨）
  var rankingSection = document.getElementById('section-player-ranking');
  if (rankingSection && typeof MutationObserver === 'function') {
    new MutationObserver(function () {
      if (isOpen() && !rankingSection.classList.contains('active')) close();
    }).observe(rankingSection, { attributes: true, attributeFilter: ['class'] });
  }
  var prevShowSection = window.showSection;
  if (typeof prevShowSection === 'function') {
    window.showSection = function (id) {
      if (isOpen() && id !== 'section-player-ranking') close();
      return prevShowSection.apply(this, arguments);
    };
  }

  // 登录 / 退出后，如果商店正开着就自动刷新余额
  var prevOnLogin = window._onCommunityLogin;
  window._onCommunityLogin = function (u, p) {
    if (typeof prevOnLogin === 'function') prevOnLogin(u, p);
    if (isOpen()) { state.data = null; load(); }
  };
  var prevOnLogout = window._onCommunityLogout;
  window._onCommunityLogout = function () {
    if (typeof prevOnLogout === 'function') prevOnLogout();
    if (isOpen()) { state.data = null; load(); }
  };

  // 供其它页面/模块调用
  window.TitleShop = { open: open, close: close };
})();
