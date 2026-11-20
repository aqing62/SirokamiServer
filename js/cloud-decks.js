/* 云端卡组 UI（组卡器共用：老版 index.html / 新版 next.html）
   统一的「保存 / 读取 / 删除」弹窗，替代原来的 prompt() 序号列表。

   读取列表按用户要求做成**卡片网格**：一行 3 个，首张卡图 + 卡组名。

   用法：
     CloudDecks.save()     保存当前卡组
     CloudDecks.open()     读取（卡片网格，格子上也能删）
*/
(function () {
  'use strict';
  if (window.CloudDecks) return;

  function toast(text) {
    var old = document.getElementById('cdxToast');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.id = 'cdxToast';
    el.textContent = text;
    el.className = 'cdx-toast';
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2600);
  }

  function api(path, body) {
    return fetch(path, body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { cache: 'no-store' })
      .then(function (r) { return r.json().catch(function () { return {}; }); });
  }

  function ydkText() {
    try {
      if (window.DeckBuilder && window.DeckBuilder.ydkText) return window.DeckBuilder.ydkText() || '';
      if (window.DeckBuilder && window.DeckBuilder.ydk) return window.DeckBuilder.ydk() || '';
    } catch (e) {}
    return '';
  }

  function loadYdk(text) {
    try {
      if (window.DeckBuilder && window.DeckBuilder.loadYdkText) return window.DeckBuilder.loadYdkText(text);
    } catch (e) {}
    return false;
  }

  function deckText(d) {
    return '#main\n' + (d.main || []).join('\n') + '\n#extra\n' + (d.extra || []).join('\n')
      + '\n!side\n' + (d.side || []).join('\n');
  }

  // 卡图地址：用站点自己的缩略图接口（官方卡 + DIY 都能出图，体积小）
  function thumb(id) { return id ? ('/thumbcard/' + id + '.jpg?w=200') : ''; }

  function injectCss() {
    if (document.getElementById('cdxCss')) return;
    var st = document.createElement('style');
    st.id = 'cdxCss';
    st.textContent = [
      '.cdx-mask{position:fixed;inset:0;z-index:100070;background:rgba(4,3,8,.72);backdrop-filter:blur(3px);',
      'display:flex;align-items:center;justify-content:center;padding:16px}',
      '.cdx-box{width:min(620px,94vw);max-height:min(82vh,680px);display:flex;flex-direction:column;',
      'background:linear-gradient(180deg,#1a1720,#14121a);border:1px solid rgba(212,175,55,.42);border-radius:14px;',
      'box-shadow:0 24px 60px rgba(0,0,0,.65);color:#ece6da;font:14px/1.45 "Microsoft YaHei",system-ui,sans-serif;overflow:hidden}',
      '.cdx-head{display:flex;align-items:center;gap:10px;padding:14px 16px 12px;border-bottom:1px solid rgba(255,255,255,.07)}',
      '.cdx-title{font-weight:800;color:#e9c96a;font-size:15px;letter-spacing:.5px}',
      '.cdx-sub{font-size:12px;color:#8d8798;margin-left:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cdx-x{margin-left:auto;width:30px;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,.12);',
      'background:transparent;color:#b9b3c4;font-size:16px;line-height:1;cursor:pointer;flex:none}',
      '.cdx-x:hover{background:rgba(255,255,255,.08);color:#fff}',
      '.cdx-searchwrap{padding:10px 16px 4px}',
      '.cdx-search{width:100%;box-sizing:border-box;padding:9px 12px;border-radius:9px;',
      'border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#f2eee6;font:inherit;outline:none}',
      '.cdx-search:focus{border-color:rgba(212,175,55,.65)}',
      '.cdx-list{overflow:auto;padding:10px 14px 12px;flex:1;scrollbar-width:thin}',
      '.cdx-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
      '.cdx-tile{position:relative;padding:7px 7px 9px;border-radius:11px;cursor:pointer;',
      'background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);transition:border-color .15s,background .15s,transform .15s}',
      '.cdx-tile:hover{background:rgba(212,175,55,.09);border-color:rgba(212,175,55,.55);transform:translateY(-1px)}',
      '.cdx-tile-img{position:relative;width:100%;aspect-ratio:5 / 7;border-radius:8px;overflow:hidden;',
      'background:radial-gradient(circle at 50% 40%,#221e2b,#14121a);display:flex;align-items:center;justify-content:center}',
      '.cdx-tile-img img{width:100%;height:100%;object-fit:cover;display:block}',
      '.cdx-tile-img .ph{font-size:11px;color:#6c6678;letter-spacing:1px}',
      '.cdx-tile-name{margin-top:7px;font-size:12.5px;font-weight:700;text-align:center;color:#f3ecdd;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.cdx-tile-meta{margin-top:2px;font-size:10.5px;color:#9b95a6;text-align:center;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.cdx-tile .cur{position:absolute;top:11px;left:11px;z-index:2;font-size:10px;padding:1px 6px;border-radius:999px;',
      'background:rgba(20,16,26,.88);border:1px solid rgba(212,175,55,.75);color:#e9c96a}',
      '.cdx-tile .del{position:absolute;top:9px;right:9px;z-index:2;width:24px;height:24px;border-radius:7px;',
      'border:1px solid rgba(216,30,68,.55);background:rgba(20,12,16,.85);color:#ff9db0;cursor:pointer;',
      'font-size:12px;line-height:1;opacity:0;transition:opacity .12s}',
      '.cdx-tile:hover .del,.cdx-tile:focus-within .del{opacity:1}',
      '@media (hover:none){.cdx-tile .del{opacity:.85}}',
      '.cdx-empty{padding:30px 12px;text-align:center;color:#8d8798;font-size:13px;line-height:1.9}',
      '.cdx-foot{display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid rgba(255,255,255,.07);',
      'font-size:12px;color:#8d8798}',
      '.cdx-btn{padding:8px 16px;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:transparent;',
      'color:#cfc8bd;cursor:pointer;font:inherit}',
      '.cdx-btn:hover{background:rgba(255,255,255,.08)}',
      '.cdx-btn.gold{background:linear-gradient(135deg,#D4AF37,#FFD700);border-color:transparent;color:#1a1a2e;font-weight:800}',
      '.cdx-btn.gold:disabled{opacity:.5;cursor:not-allowed}',
      '.cdx-input{width:100%;box-sizing:border-box;padding:11px 13px;border-radius:10px;',
      'border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#f2eee6;font:inherit;outline:none}',
      '.cdx-input:focus{border-color:rgba(212,175,55,.7)}',
      '.cdx-input:-webkit-autofill{-webkit-box-shadow:0 0 0 1000px #23202b inset!important;-webkit-text-fill-color:#f2eee6!important}',
      '.cdx-body{padding:6px 16px 4px}',
      '.cdx-hint{font-size:12px;color:#8d8798;margin:8px 2px 0}',
      '.cdx-toast{position:fixed;left:50%;top:64px;transform:translateX(-50%);background:rgba(24,22,28,.97);',
      'color:#fff;padding:10px 18px;border-radius:10px;border:1px solid rgba(212,175,55,.55);z-index:100090;',
      'font-size:13px;max-width:82vw}',
      '@media (max-width:520px){',
      '.cdx-box{max-height:88vh}',
      '.cdx-list{padding:8px 10px 10px}',
      '.cdx-grid{gap:8px}',
      '.cdx-tile{padding:5px 5px 7px}',
      '.cdx-tile-name{font-size:11.5px}',
      '.cdx-tile-meta{display:none}',
      '}'
    ].join('');
    document.head.appendChild(st);
  }

  function modal(opts) {
    injectCss();
    var mask = document.createElement('div');
    mask.className = 'cdx-mask';
    var box = document.createElement('div');
    box.className = 'cdx-box';
    box.innerHTML =
      '<div class="cdx-head"><span class="cdx-title">' + opts.title + '</span>'
      + '<span class="cdx-sub" id="cdxSub"></span>'
      + '<button class="cdx-x" id="cdxClose" title="关闭">✕</button></div>'
      + (opts.search ? '<div class="cdx-searchwrap"><input class="cdx-search" id="cdxSearch" placeholder="搜索卡组名…"></div>' : '')
      + '<div class="cdx-list" id="cdxList"></div>'
      + '<div class="cdx-foot"><span id="cdxFoot"></span>'
      + '<span style="flex:1"></span>'
      + '<button class="cdx-btn" id="cdxRefresh">刷新</button>'
      + '<button class="cdx-btn" id="cdxCancel">关闭</button></div>';
    mask.appendChild(box);
    document.body.appendChild(mask);
    function close() { if (mask.parentNode) mask.parentNode.removeChild(mask); }
    box.querySelector('#cdxClose').onclick = close;
    box.querySelector('#cdxCancel').onclick = close;
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc, true); }
    }, true);
    return { mask: mask, box: box, close: close };
  }

  // ── 读取 / 删除：卡片网格，一行 3 个 ──────────────────
  function openList() {
    var m = modal({ title: '☁ 云端卡组', search: true });
    var listEl = m.box.querySelector('#cdxList');
    var subEl = m.box.querySelector('#cdxSub');
    var footEl = m.box.querySelector('#cdxFoot');
    var searchEl = m.box.querySelector('#cdxSearch');
    var items = [];
    var filter = '';

    function tile(item) {
      var el = document.createElement('div');
      el.className = 'cdx-tile';
      el.tabIndex = 0;
      el.innerHTML =
        (item.active ? '<span class="cur">当前</span>' : '')
        + '<button class="del" title="删除这套卡组">🗑</button>'
        + '<div class="cdx-tile-img"></div>'
        + '<div class="cdx-tile-name"></div>'
        + '<div class="cdx-tile-meta"></div>';
      el.querySelector('.cdx-tile-name').textContent = item.name;
      el.querySelector('.cdx-tile-meta').textContent =
        '主' + (item.main || 0) + ' · 额' + (item.extra || 0) + ' · 副' + (item.side || 0);

      var imgWrap = el.querySelector('.cdx-tile-img');
      var src = thumb(item.first);
      if (src) {
        var im = document.createElement('img');
        im.loading = 'lazy';
        im.alt = item.name;
        im.src = src;
        im.onerror = function () {
          if (im.parentNode) im.parentNode.removeChild(im);
          imgWrap.innerHTML = '<span class="ph">空卡组</span>';
        };
        imgWrap.appendChild(im);
      } else {
        imgWrap.innerHTML = '<span class="ph">空卡组</span>';
      }

      el.addEventListener('click', function () { doLoad(item.name); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLoad(item.name); });
      el.querySelector('.del').addEventListener('click', function (e) {
        e.stopPropagation();
        if (!confirm('确定删除「' + item.name + '」？删了就找不回来了')) return;
        api('/api/duel/decks/delete', { name: item.name }).then(function (r) {
          if (r && r.ok) { toast('已删除「' + item.name + '」'); refresh(); }
          else toast('删除失败：' + ((r && r.error) || '未知错误'));
        }).catch(function (err) { toast('删除失败：' + err.message); });
      });
      return el;
    }

    function render() {
      listEl.innerHTML = '';
      var list = items.filter(function (it) { return !filter || it.name.toLowerCase().indexOf(filter) >= 0; });
      if (!list.length) {
        listEl.innerHTML = '<div class="cdx-empty">' + (items.length
          ? '没有匹配的卡组'
          : '账号里还没有云端卡组<br>组好卡后点「☁ 保存」') + '</div>';
      } else {
        var grid = document.createElement('div');
        grid.className = 'cdx-grid';
        list.forEach(function (it) { grid.appendChild(tile(it)); });
        listEl.appendChild(grid);
      }
      footEl.textContent = '共 ' + items.length + ' 套';
    }

    function refresh() {
      subEl.textContent = '读取中…';
      api('/api/duel/decks').then(function (j) {
        var raw = (j && (j.items || [])) || [];
        if (!raw.length && j && (j.names || []).length) {
          raw = (j.names || []).map(function (n) { return { name: String(n).replace(/\.ydk$/i, '') }; });
        }
        items = raw.map(function (x) {
          return {
            name: String(x.name).replace(/\.ydk$/i, ''),
            main: x.main, extra: x.extra, side: x.side,
            first: x.first, active: !!x.active
          };
        });
        subEl.textContent = (j && j.dir) ? j.dir : '';
        if (!items.length && j && /未登录/.test(j.dir || '')) {
          listEl.innerHTML = '<div class="cdx-empty">请先登录账号<br>登录后这里会列出你保存的云端卡组</div>';
          footEl.textContent = '';
          return;
        }
        render();
      }).catch(function (e) {
        subEl.textContent = '';
        listEl.innerHTML = '<div class="cdx-empty">读取失败：' + (e.message || e) + '</div>';
      });
    }

    function doLoad(name) {
      toast('正在读取「' + name + '」…');
      api('/api/duel/deck?name=' + encodeURIComponent(name)).then(function (d) {
        if (!d || !d.main) { toast('没读到这套卡组'); return; }
        var r = loadYdk(deckText(d));
        if (r) {
          window.__cloudDeckName = name;
          toast('已读取「' + name + '」（主' + r.main + ' / 额' + r.extra + ' / 副' + r.side + '）');
          m.close();
        } else toast('载入失败（组卡器还没就绪，稍等再点一次）');
      }).catch(function (e) { toast('读取失败：' + e.message); });
    }

    m.box.querySelector('#cdxRefresh').onclick = refresh;
    if (searchEl) searchEl.addEventListener('input', function () {
      filter = this.value.trim().toLowerCase();
      render();
    });
    refresh();
  }

  // ── 保存 ─────────────────────────────────────────────
  function save() {
    var ydk = ydkText();
    if (!ydk) { toast('当前卡组是空的，先加点卡'); return; }
    var cur = window.__cloudDeckName || '';
    var m = modal({ title: '☁ 保存到账号' });
    var bodyEl = m.box.querySelector('#cdxList');
    bodyEl.style.padding = '12px 16px 4px';
    bodyEl.innerHTML = '<div class="cdx-body" style="padding:0">'
      + '<label class="cdx-hint" style="display:block;margin-bottom:6px">卡组名</label>'
      + '<input class="cdx-input" id="cdxName" maxlength="48" placeholder="例如：转生炎兽 · 天梯">'
      + '<div class="cdx-hint">同名会覆盖账号里已有的那套</div>'
      + '</div>';
    var input = bodyEl.querySelector('#cdxName');
    input.value = cur;
    m.box.querySelector('#cdxFoot').textContent = '账号：当前登录用户';
    var btn = document.createElement('button');
    btn.className = 'cdx-btn gold';
    btn.textContent = '保存';
    btn.onclick = function () {
      var name = (input.value || '').trim();
      if (!name) { toast('请输入卡组名'); input.focus(); return; }
      btn.disabled = true;
      api('/api/duel/decks/upload', { name: name, ydk: ydk }).then(function (j) {
        btn.disabled = false;
        if (j && j.ok) {
          window.__cloudDeckName = name;
          toast('已保存「' + name + '」（主' + (j.main || 0) + ' / 额' + (j.extra || 0) + ' / 副' + (j.side || 0) + '）');
          m.close();
        } else toast('保存失败：' + ((j && j.error) || '未知错误'));
      }).catch(function (e) {
        btn.disabled = false;
        toast('保存失败：' + e.message);
      });
    };
    m.box.querySelector('.cdx-foot').insertBefore(btn, m.box.querySelector('#cdxRefresh'));
    setTimeout(function () { input.focus(); input.select && input.select(); }, 30);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });
  }

  window.CloudDecks = { open: openList, remove: openList, save: save, toast: toast };
})();
