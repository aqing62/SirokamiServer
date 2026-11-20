/**
 * 白神服 · 卡牌渲染层（对齐 demo.ygopro3.cn 的做法）
 * ==================================================================
 * 核心：**卡片节点按 uid 常驻**，位置只改 transform —— 不重建、不飞替身。
 * 旧渲染只负责格子/牌堆/角标/日志。
 *
 * 定位方式（v3）：
 *   直接以旧渲染的 .rp-card 为锚点 —— 逐级累加 offsetLeft/offsetTop 得到布局坐标，
 *   再复用旧卡的 computed transform / transform-origin（守备旋转、倒置、牌堆居中位移）。
 *   这样与旧渲染逐像素一致，且不受场地 3D 投影影响。
 *   手牌区额外建一个同尺寸、同 transform 的图层，让手牌保持直立。
 *   场地卡继承 .rp-board 的 rotateX，自然贴着斜面躺下（B 方案）。
 */
(function () {
  'use strict';

  var _instSeq = 0;
  function create(host, opts) {
    _instSeq++;
    opts = opts || {};
    var root = document.createElement('div');
    root.className = 'fr-root';
    root.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;'
      + 'pointer-events:none;z-index:1100;';
    host.appendChild(root);

    var nodes = {};        // uid → { el, img, sig }
    var pos = {};          // 'ctl:loc:seq' → {x,y,w,h}
    var layers = {};       // 手牌区 data-zone → { el, hand }
    var lastCal = 0;
    var CARD_TRANSITION = 'transform .3s cubic-bezier(.22,.61,.36,1),opacity .2s ease';

    // 元素相对 stop 的布局坐标（**不含 stop 自身**的偏移；3D 投影不影响 offsetLeft）
    function localTo(el, stop) {
      var x = 0, y = 0, p = el;
      while (p && p !== stop) {
        x += p.offsetLeft || 0;
        y += p.offsetTop || 0;
        p = p.offsetParent;
      }
      return p === stop ? { x: x, y: y } : null;
    }

    function codeOf(src) {
      var m = String(src || '').match(/(\d{1,9})\.jpg/);
      return m ? Number(m[1]) : 0;
    }

    function calibrate() {
      try {
        var board = host;
        var scene = board.parentElement;
        var savedBoard = board.style.transform;
        var savedScene = scene ? scene.style.transform : '';
        var savedPersp = scene ? scene.style.perspective : '';
        board.style.transition = 'none';
        board.style.transform = 'none';
        if (scene) { scene.style.transform = 'none'; scene.style.perspective = 'none'; }
        var fr = board.getBoundingClientRect();
        var next = {};
        var cells = board.querySelectorAll('.rp-cell[data-zone]');
        for (var i = 0; i < cells.length; i++) {
          var c = cells[i];
          var z = c.getAttribute('data-zone');
          if (!z) continue;
          var r = c.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          next[z] = { x: r.left - fr.left, y: r.top - fr.top, w: r.width, h: r.height };
        }
        var piles = board.querySelectorAll('.rp-pile[data-pile]');
        for (var pi = 0; pi < piles.length; pi++) {
          var pEl = piles[pi];
          var pr = pEl.getBoundingClientRect();
          if (!pr.width || !pr.height) continue;
          next['pile:' + pEl.getAttribute('data-pile')] = {
            x: pr.left - fr.left, y: pr.top - fr.top, w: pr.width, h: pr.height
          };
        }
        var hands = board.querySelectorAll('.rp-hand[data-zone]');
        for (var h = 0; h < hands.length; h++) {
          var hEl = hands[h];
          var hr = hEl.getBoundingClientRect();
          next[hEl.getAttribute('data-zone') + ':hand'] = {
            x: hr.left - fr.left, y: hr.top - fr.top, w: hr.width, h: hr.height
          };
        }
        board.style.transform = savedBoard;
        if (scene) { scene.style.transform = savedScene; scene.style.perspective = savedPersp; }
        pos = next;
        lastCal = Date.now();
      } catch (e) {}
    }

    var _dbg = [];
    window.__frDebug = function () { return _dbg.slice(-80); };

    // 手牌要「反向转回直立」：旧渲染给 .rp-hand 加了 rotateX(-24deg)。
    // 新渲染节点若直接放在场地面里会跟着躺下，所以每个手牌区建一个同尺寸、
    // 同 transform 的图层，节点放进图层里 —— 位置/朝向自动与旧渲染一致。
    function handLayer(hand) {
      var zone = hand.getAttribute('data-zone') || ('hand-' + (hand.className || ''));
      var rec = layers[zone];
      if (rec && rec.hand === hand) return rec.el;
      if (!rec) {
        var el = document.createElement('div');
        el.className = 'fr-hand-layer';
        el.setAttribute('data-zone', zone);
        el.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;'
          + 'z-index:30;transform-style:preserve-3d;';
        root.appendChild(el);
        rec = layers[zone] = { el: el, hand: hand };
      }
      rec.hand = hand;
      if (rec.el.parentNode !== root) root.appendChild(rec.el);
      var o = localTo(hand, host);
      if (!o) return null;
      var cs = getComputedStyle(hand);
      rec.el.style.width = Math.round(hand.offsetWidth) + 'px';
      rec.el.style.height = Math.round(hand.offsetHeight) + 'px';
      rec.el.style.transformOrigin = cs.transformOrigin;
      rec.el.style.transform = 'translate3d(' + Math.round(o.x) + 'px,' + Math.round(o.y) + 'px,0)'
        + (cs.transform && cs.transform !== 'none' ? ' ' + cs.transform : '');
      return rec.el;
    }

    function pruneLayers() {
      var alive = {};
      var hands = host.querySelectorAll('.rp-hand');
      for (var i = 0; i < hands.length; i++) {
        var z = hands[i].getAttribute('data-zone');
        if (z) alive[z] = 1;
      }
      for (var k in layers) {
        if (!alive[k]) {
          if (layers[k].el.parentNode) layers[k].el.parentNode.removeChild(layers[k].el);
          delete layers[k];
        }
      }
    }

    function ensure(uid) {
      if (_dbg.length < 500) _dbg.push('+' + uid);
      var rec = nodes[uid];
      if (rec) return rec;
      var el = document.createElement('div');
      el.className = 'fr-card';
      el.setAttribute('data-key', String(uid));   // 便于自验/排查
      el.style.cssText = 'position:absolute;left:0;top:0;opacity:0;transform-origin:50% 50%;'
        + 'will-change:transform;border-radius:4px;overflow:hidden;background:transparent;'
        + 'z-index:1;transition:' + CARD_TRANSITION + ';';
      var img = document.createElement('img');
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      img.alt = '';
      el.appendChild(img);
      root.appendChild(el);
      rec = nodes[uid] = { el: el, img: img, sig: '', shown: 0, visHidden: 1 };
      return rec;
    }

    // 所有"这张卡现在该不该露"的条件集中在这里：常驻节点未 shown、离场、
    // 移动替身期间、召唤演出 hold（旧渲染把 cell 设成 opacity:0）都不能露。
    function updateNodeVisibility(rec) {
      if (!rec || !rec.el) return;
      var hide = !rec.forceShow && (!rec.shown || rec.hidden || rec.flyHidden || rec.cellHidden || rec.leaveHidden);
      if (hide) {
        rec.visHidden = 1;
        rec.el.style.transition = 'none';
        rec.el.style.opacity = '0';
      } else if (rec.visHidden !== 0) {
        rec.visHidden = 0;
        rec.el.style.transition = CARD_TRANSITION;
        rec.el.style.opacity = '1';
      }
    }

    // 场→墓地：旧渲染会立刻播破碎/爆裂，卡本身已从场上移除；
    // v2 常驻节点若等 miss 计数会多停几百 ms，看起来就是"动画放完了人才消失"。
    // viewer 在 shatterFx 前同步调用这里，先把本体藏掉，让破碎动画单独演。
    function onLeave(info) {
      var code = info && info.code;
      if (!code) return;
      for (var k in nodes) {
        var rec = nodes[k];
        if (rec.code !== code || !rec.shown) continue;
        rec.leaveHidden = 1;
        updateNodeVisibility(rec);
        (function (r) {
          setTimeout(function () {
            if (!r.leaveHidden) return;
            r.leaveHidden = 0;
            updateNodeVisibility(r);
          }, 1200);
        })(rec);
      }
    }

    function seedPos(uid, r) {
      try {
        // 第一次见到这张卡：给一个"来源点"，让它从牌堆/手牌位置滑到目标位置
        var src = pos['pile:deck:0'] || pos['pile:deck:1'];
        if (!src) return null;
        return { x: src.x, y: src.y, w: src.w, h: src.h };
      } catch (e) { return null; }
    }

    function place(uid, r, tf, origin, src, target) {
      var rec = ensure(uid);
      target = target || root;
      rec.inHand = target !== root;
      if (rec.el.parentNode !== target) {
        // 跨层（手牌 ↔ 场地）时不要从旧坐标补间过来，否则会横穿整个场地
        rec.el.style.transition = 'none';
        target.appendChild(rec.el);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { rec.el.style.transition = CARD_TRANSITION; });
        });
      }
      if (!rec.shown && target === root) {
        var seed = seedPos(uid, r);
        if (seed) {
          rec.el.style.transition = 'none';
          rec.el.style.width = Math.round(seed.w) + 'px';
          rec.el.style.height = Math.round(seed.h) + 'px';
          rec.el.style.transform = 'translate3d(' + Math.round(seed.x) + 'px,' + Math.round(seed.y) + 'px,0)';
          requestAnimationFrame(function () {
            requestAnimationFrame(function () { rec.el.style.transition = CARD_TRANSITION; });
          });
        }
      }
      var sig = [Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h),
        tf || 'none', origin || '', src || '', target === root ? 'r' : 'h'].join('|');
      if (rec.sig !== sig) {
        rec.sig = sig;
        rec.el.style.width = Math.round(r.w) + 'px';
        rec.el.style.height = Math.round(r.h) + 'px';
        if (src && rec.img.getAttribute('src') !== src) rec.img.setAttribute('src', src);
        var code = codeOf(src);
        if (code) rec.code = code;
        rec.el.style.transformOrigin = origin || '50% 50%';
        rec.el.style.transform = 'translate3d(' + Math.round(r.x) + 'px,' + Math.round(r.y) + 'px,0)'
          + (tf && tf !== 'none' ? ' ' + tf : '');
      }
      if (!rec.shown) {
        rec.shown = 1;
        if (target === root) {
          requestAnimationFrame(function () { updateNodeVisibility(rec); });
        } else {
          // 手牌：旧渲染正在用 .rp-fly 替身飞这一张。替身还在时先别亮本体，
          // 否则就是「手卡里一张 + 空中一张」两张同样的卡（用户实测过的老问题）。
          revealAfterFly(rec);
        }
      }
      // PATCH(白神服) 2026-11-18: 手牌节点可能因为上一轮 revealAfterFly 被 hidden 提前中止，
      //   导致 rec.shown 已是 1 但 opacity 永久停在 0（鼠标 hover 有信息、画面看不到卡）。
      //   只要当前没有待执行的 reveal，就按最新状态重算一次可见性。
      if (!rec.pendingReveal) updateNodeVisibility(rec);
      rec.alive = 1; rec.miss = 0;
    }

    function revealAfterFly(rec) {
      if (rec.pendingReveal) return;
      rec.pendingReveal = 1;
      var tries = 0;
      var recKey = rec.el && rec.el.getAttribute ? (rec.el.getAttribute('data-key') || '') : '';
      function wait() {
        if (!rec.el || rec.hidden) { rec.pendingReveal = 0; return; }
        var flying = false;
        try {
          var gs = document.querySelectorAll('.rp-fly:not(.rp-fly-atk)');
          for (var gi = 0; gi < gs.length; gi++) {
            var hk = gs[gi].getAttribute('data-hide-key') || '';
            if (recKey && hk.split(',').indexOf(recKey) >= 0) { flying = true; break; }
          }
        } catch (e) {}
        // 兜底：只等“确实指向这个手牌槽”的替身，最多 3 秒；
        // 其他区域的动画不能拖住手牌显示（否则抽卡后手牌会透明几秒）。
        if (flying && ++tries < 45) { setTimeout(wait, 70); return; }
        rec.pendingReveal = 0;
        updateNodeVisibility(rec);
      }
      setTimeout(wait, 60);
    }

    function drop(uid) {
      if (_dbg.length < 500) _dbg.push('-' + uid);
      var rec = nodes[uid];
      if (!rec) return;
      delete nodes[uid];
      rec.hidden = 1;
      updateNodeVisibility(rec);
      setTimeout(function () { if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el); }, 220);
    }

    var _flySeq = 0;
    function beginFly(raw) {
      var token = 'f' + (++_flySeq);
      try {
        String(raw || '').split(',').forEach(function (k) {
          k = String(k || '').trim();
          if (!k) return;
          var rec = nodes[k];
          if (!rec) return;
          rec.flyOwners = rec.flyOwners || {};
          rec.flyOwners[token] = 1;
          rec.flyHidden = 1;
          rec.flyHiddenAt = Date.now();
          updateNodeVisibility(rec);
        });
      } catch (e) {}
      return token;
    }
    function endFly(token) {
      if (!token) return;
      try {
        for (var k in nodes) {
          var rec = nodes[k];
          if (!rec.flyOwners || !rec.flyOwners[token]) continue;
          delete rec.flyOwners[token];
          if (Object.keys(rec.flyOwners).length === 0) {
            rec.flyOwners = null;
            rec.flyHidden = 0;
            rec.flyHiddenAt = 0;
            updateNodeVisibility(rec);
          }
        }
      } catch (e) {}
    }

    function syncFlyGhosts() {
      // 旧渲染移动卡时会画 .rp-fly 替身；v2 的常驻节点也在，二者同一张卡 → 双卡。
      // 新版：替身只声明**目标常驻节点 key**（data-hide-key，逗号分隔 u.../z.../h...），
      // 只隐藏这些目标节点，不再按卡号批量隐藏同名的其他卡。
      // 同时把“当前替身 token”登记为目标的 flyOwner；替身结束只释放自己的 token，
      // 不会误清另一个动画的隐藏状态（Set/连续移动时尤其重要）。
      var ghosts = document.querySelectorAll('.rp-fly:not(.rp-fly-atk)');
      var active = {};
      for (var i = 0; i < ghosts.length; i++) {
        var raw = ghosts[i].getAttribute('data-hide-key') || '';
        var tok = ghosts[i]._flyToken || '';
        raw.split(',').forEach(function (k) {
          k = String(k || '').trim();
          if (k) active[k] = tok || 1;
        });
      }
      for (var k in nodes) {
        var rec = nodes[k];
        if (active[k]) {
          var _at = active[k];
          if (_at && _at !== 1) {
            rec.flyOwners = rec.flyOwners || {};
            rec.flyOwners[_at] = 1;
          }
          if (!rec.flyHidden) {
            rec.flyHidden = 1;
            rec.flyHiddenAt = Date.now();
            updateNodeVisibility(rec);
          }
        } else if (rec.flyHidden && !rec.flyOwners) {
          // 已经离场的节点保持隐藏，交给 miss 计数；不要在这里恢复。
          // 但观战里替身/节点可能因快照错位一直不复位 → 1.8s 后强制恢复。
          var _staleFly = rec.flyHiddenAt && (Date.now() - rec.flyHiddenAt > 1800);
          if (rec.alive || (rec.shown && _staleFly)) {
            rec.flyHidden = 0;
            rec.flyHiddenAt = 0;
            updateNodeVisibility(rec);
          }
        }
      }
    }

    function syncCellHolds() {
      // 召唤演出（融合/同调/超量/连接）期间旧渲染把格子设成 opacity:0，
      // v2 节点不在格子里，必须跟着 hold，否则卡图会在演出结束前提前出现。
      for (var k in nodes) {
        var rec = nodes[k];
        if (!rec.alive) continue;
        var held = !!(rec.cell && (rec.cell.style.opacity === '0' || rec.cell._fxHold));
        if (held !== !!rec.cellHidden) {
          rec.cellHidden = held;
          updateNodeVisibility(rec);
        }
      }
    }

    function tick() {
      try {
        // 旧渲染会整体重建 .rp-board → 每 tick 重新解析宿主，否则根节点会被丢弃
        var h2 = document.querySelector('#replayField .rp-board') || document.getElementById('replayField');
        if (h2 && h2 !== host) { host = h2; pos = {}; lastCal = 0; host.appendChild(root); }
        else if (root.parentNode !== host) host.appendChild(root);
        if (!lastCal || Date.now() - lastCal > 30000) calibrate();
        pruneLayers();
        // 位置来源 = 旧渲染节点的**布局坐标**（offsetParent 链累加）：
        //   与旧渲染逐像素一致，且不受场地 3D 投影影响（getBoundingClientRect 是投影后的，不能用）。
        //   注意：不要累加 host 自己的 offset（root 的包含块就是 host）。
        var k;
        for (k in nodes) nodes[k].alive = 0;
        var shattering = false;
        try { shattering = !!document.querySelector('.rp-fx-shard'); } catch (e) {}
        var legacy = host.querySelectorAll('.rp-cell:not(.rp-pile) .rp-card, .rp-hand .rp-card');
        for (var i = 0; i < legacy.length; i++) {
          var el = legacy[i];
          try {
          if (el.classList && el.classList.contains('rp-card-empty')) continue;
          var uid = el.getAttribute('data-uid');
          var hand = el.closest ? el.closest('.rp-hand') : null;
          var key;
          if (hand) {
            // 手牌 uid 会随 UpdateData 快照重建而变（实测 1→41→51→63），
            // 按 uid 建节点会不停 fade 旧节点/淡入新节点 = 手卡闪烁。
            // 手牌用 DOM 下标做 key：同一槽位始终是同一个节点，快照重建不闪。
            var hcards = hand.querySelectorAll('.rp-card');
            var hidx = Array.prototype.indexOf.call(hcards, el);
            key = 'h:' + (hand.getAttribute('data-zone') || '') + ':i' + hidx;
          } else if (uid && uid !== '0') {
            key = 'u' + uid;
          } else {
            // 里侧盖卡常常没有 data-uid（uid 只在查看器模型里合成）。
            // 用格子坐标做稳定 key，这样翻面/回盖都复用同一个节点，动画不会断。
            var zEl = el.closest ? el.closest('[data-zone]') : null;
            if (!zEl) continue;
            key = 'z:' + zEl.getAttribute('data-zone');
          }
          var lw = el.offsetWidth, lh = el.offsetHeight;
          if (!lw || !lh) continue;
          var target = root, o;
          if (hand) {
            target = handLayer(hand);
            if (!target) continue;
            o = localTo(el, hand);
          } else {
            o = localTo(el, host);
          }
          if (!o) continue;
          var cs = getComputedStyle(el);
          var tf = cs.transform;
          var origin = cs.transformOrigin;
          var im = el.querySelector('img');
          var src = im ? (im.currentSrc || im.getAttribute('src') || '') : '';
          if (!src) {
            var down = el.className && (el.className.indexOf('rp-card-down') >= 0 || el.className.indexOf('rp-card-known') >= 0);
            var prevRec = nodes[key];
            var prev = prevRec && prevRec.img.getAttribute('src');
            var curCode = el.getAttribute('data-code') || '';
            var sameCard = !!(prevRec && prevRec.code && curCode && curCode !== '0'
              && String(prevRec.code) === String(curCode));
            // 手牌：同一张卡（data-code 与上一帧一致）才保留正面图；
            // 槽位换人时（例如无之炼狱离手、曼珠补位）绝不能把上一张的图留在这里。
            if (hand && sameCard && prev && prev.indexOf('cover2') < 0) src = prev;
            else src = (!down && sameCard && prev && prev.indexOf('cover2') < 0) ? prev : 'cover2.jpg?v=20261108a';
          }
          var recKey = key;
          var rec = ensure(recKey);
          rec.cell = el.closest ? el.closest('.rp-cell') : null;
          rec.el.classList.toggle('fr-known', !!(el.classList && el.classList.contains('rp-card-known')));
          place(recKey, { x: o.x, y: o.y, w: lw, h: lh }, tf, origin, src, target);
          } catch (e) { try { window.__frLastError = String(e && e.message || e); } catch (_) {} }
        }
        // PATCH(白神服) 2026-11-18: **不再删除节点** —— 模型短暂缺卡时只把节点隐藏。
        //   删除会让节点身份丢失（自验：播放后带标记节点 21 → 0），移动动画也就断了。
        //   节点最多等于"整局出现过的卡数"，几百个 div，代价可接受。
        for (k in nodes) {
          if (nodes[k].alive) {
            nodes[k].miss = 0;
            if (nodes[k].forceShow) {
              nodes[k].forceShow = 0;
              nodes[k].forceSince = 0;
            }
            if (nodes[k].hidden) {
              nodes[k].hidden = 0;
              updateNodeVisibility(nodes[k]);
            }
            continue;
          }
          nodes[k].miss = (nodes[k].miss || 0) + 1;
          if (nodes[k].forceShow && nodes[k].forceSince && Date.now() - nodes[k].forceSince > 8000) {
            nodes[k].forceShow = 0;
            nodes[k].forceSince = 0;
            updateNodeVisibility(nodes[k]);
          }
          // 手牌是"当前手牌集合"，旧 uid 消失就是真的离手了；宽限期只给场上卡，
          // 否则抽/弃/洗牌时旧手卡会在原位多停 1 秒，看起来就是"手卡多了一堆"。
          var limit = nodes[k].inHand ? 2 : (shattering ? 1 : 3);
          if (nodes[k].miss >= limit && !nodes[k].hidden) {
            nodes[k].hidden = 1;
            updateNodeVisibility(nodes[k]);
          }
        }
        syncFlyGhosts();
        syncCellHolds();
        // 手牌层里如果有本实例已经不认识的 key（上一局/上一实例残留），直接移除，
        // 避免 reset 后出现“看不见但仍在 DOM 里”的幽灵手牌节点。
        try {
          Array.prototype.forEach.call(document.querySelectorAll('.fr-hand-layer .fr-card'), function (el) {
            var _k = el.getAttribute('data-key');
            if (_k && !nodes[_k]) el.parentNode.removeChild(el);
          });
        } catch (e) {}
        // 手牌兜底：如果 v2 hand layer 的节点数少于旧 .rp-card（层 detached/被清空），
        // 直接让旧手牌可见，避免“hover 有信息但画面没手牌”。v2 正常时不触发。
        try {
          Array.prototype.forEach.call(document.querySelectorAll('.rp-hand'), function (hand) {
            var n = hand.querySelectorAll('.rp-card:not(.rp-card-empty)').length;
            if (!n) { hand.classList.remove('fr-hand-fallback'); return; }
            var zone = hand.getAttribute('data-zone') || '';
            var layer = document.querySelector('.fr-hand-layer[data-zone="' + zone + '"]');
            var v = 0, flying = false;
            if (layer) {
              Array.prototype.forEach.call(layer.querySelectorAll('.fr-card'), function (el) {
                var cs = getComputedStyle(el);
                if (cs.opacity !== '0' && cs.visibility !== 'hidden' && cs.display !== 'none'
                  && el.getClientRects().length) v++;
              });
            }
            try {
              Array.prototype.forEach.call(document.querySelectorAll('.rp-fly:not(.rp-fly-atk)'), function (g) {
                var hk = g.getAttribute('data-hide-key') || '';
                if (hk.indexOf('h:' + zone + ':') >= 0) flying = true;
              });
            } catch (e) {}
            if (!flying && v < n) hand.classList.add('fr-hand-fallback');
            else hand.classList.remove('fr-hand-fallback');
          });
        } catch (e) {}
        // 手牌自愈：备牌局/重连后 hand 节点可能停在 opacity:0（hover 有信息但看不见），
        // 只要没有“指向本槽”的替身、且节点仍 alive，就强制重算可见性。
        try {
          for (var _hk in nodes) {
            var _hr = nodes[_hk];
            if (!_hr || !_hr.inHand || !_hr.alive || !_hr.el || _hr.pendingReveal) continue;
            var _key = _hr.el.getAttribute('data-key') || '';
            var _flying = false;
            var _gs = document.querySelectorAll('.rp-fly:not(.rp-fly-atk)');
            for (var _gi = 0; _gi < _gs.length; _gi++) {
              var _ghk = _gs[_gi].getAttribute('data-hide-key') || '';
              if (_key && _ghk.split(',').indexOf(_key) >= 0) { _flying = true; break; }
            }
            if (_flying) continue;
            if (_hr.flyHidden || _hr.hidden || _hr.visHidden) {
              _hr.flyHidden = 0; _hr.hidden = 0; _hr.miss = 0;
              updateNodeVisibility(_hr);
            }
          }
        } catch (e) {}
      } catch (e) {}
    }

    function reset() {
      try {
        for (var k in nodes) {
          var rec = nodes[k];
          if (rec && rec.el && rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);
          delete nodes[k];
        }
        // 手牌 layer 也必须一起清；root.innerHTML 只删 DOM，layers 里还留着
        // 已 detached 的 fr-hand-layer → 备牌新一局手牌节点会挂到脱离文档的层上，永远不显示。
        for (var lk in layers) {
          try { if (layers[lk] && layers[lk].el && layers[lk].el.parentNode) layers[lk].el.parentNode.removeChild(layers[lk].el); } catch (e) {}
          delete layers[lk];
        }
        // 兜底：清掉任何残留的 hand layer（可能来自上一实例/手工 reset）
        try {
          Array.prototype.forEach.call(document.querySelectorAll('.fr-hand-layer'), function (el) {
            if (el.parentNode) el.parentNode.removeChild(el);
          });
        } catch (e) {}
        root.innerHTML = '';
      } catch (e) {}
    }
    function showKeys(raw) {
      try {
        String(raw || '').split(',').forEach(function (k) {
          k = String(k || '').trim();
          if (!k) return;
          var rec = nodes[k];
          if (!rec) return;
          // 动画结束：目标节点必须恢复可见，不依赖下一次 tick 的 alive 判定
          rec.flyHidden = 0;
          rec.flyHiddenAt = 0;
          rec.hidden = 0;
          rec.miss = 0;
          rec.shown = 1;
          // 目标格在动画结束后的短暂时间内优先显示；
          // 若 tick 的 alive 判定异常，也不会立刻把刚飞到的卡藏掉。
          rec.forceShow = 1;
          rec.forceSince = Date.now();
          updateNodeVisibility(rec);
        });
      } catch (e) {}
    }
    return { tick: tick, root: root, nodes: nodes, calibrate: calibrate, syncGhosts: syncFlyGhosts, onLeave: onLeave, reset: reset, showKeys: showKeys, beginFly: beginFly, endFly: endFly };
  }

  window.__fieldRender = { create: create };

  (function autoBoot() {
    try {
      // 默认启用 v2；需要旧渲染时用 ?render=v1 / legacy / off
      if (/[?&]render=(v1|legacy|off|0|false)(?:&|$)/i.test(location.search)) return;
      if (window.__frApi) { console.log('[field-render] reuse existing instance'); return; }
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        var host = document.querySelector('#replayField .rp-board');
        if (!host || !host.querySelector('.rp-cell[data-zone]')) {
          if (tries > 400) clearInterval(iv);
          return;
        }
        if (window.__frApi) { clearInterval(iv); return; }   // 竞态兜底：只建一次
        clearInterval(iv);
        document.body.classList.add('fr-mode');
        var api = window.__frApi = create(host);
        api.root.id = 'frRoot';
        api.instance = _instSeq;
        window.__frOnLeave = api.onLeave;
        api.calibrate();
        api.tick();
        setInterval(api.tick, 90);
        // .rp-fly 是旧渲染动态插到 body 的；等 90ms 的 tick 再隐藏会闪一下双卡。
        // 用 MutationObserver 在替身插入/移除的同一帧就同步一次。
        try {
          var mo = new MutationObserver(function (ms) {
            var hit = false;
            for (var mi = 0; mi < ms.length && !hit; mi++) {
              var list = ms[mi].addedNodes;
              for (var ni = 0; ni < list.length; ni++) {
                var n = list[ni];
                if (n && n.nodeType === 1 && n.classList && n.classList.contains('rp-fly')) { hit = true; break; }
              }
              if (!hit) {
                var list2 = ms[mi].removedNodes;
                for (var ri = 0; ri < list2.length; ri++) {
                  var r2 = list2[ri];
                  if (r2 && r2.nodeType === 1 && r2.classList && r2.classList.contains('rp-fly')) { hit = true; break; }
                }
              }
            }
            if (hit) { try { api.syncGhosts(); } catch (e) {} }
          });
          mo.observe(document.body, { childList: true, subtree: true });
        } catch (e) {}
        window.addEventListener('resize', function () { try { api.calibrate(); } catch (e) {} });
        console.log('[field-render] instance #' + _instSeq + ' started');
      }, 100);
    } catch (e) {}
  })();
})();
