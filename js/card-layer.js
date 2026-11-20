/**
 * 白神服 · 卡牌图层（重构原型，第 1 步）
 * ------------------------------------------------------------------
 * 现在的问题：`setCellCard` 每次变化都 `cell.innerHTML=''` 重建 DOM，
 *   于是移动只能用「飞一个 ghost 再瞬间出现」的方式模拟，容易出 bug
 *   （卡图变大、闪一下、残留 ghost 等）。
 *
 * 目标架构（照 demo.ygopro3.cn 的做法）：
 *   卡牌节点**长期存在**，位置用 `transform: translate(x,y)` 表达，
 *   所有位移/进出场交给 CSS transition 补间 —— 不再重建节点、不再飞 ghost。
 *
 * 这一步只做「图层本身」，不改现有渲染：
 *   - 提供 create(container) → { place, remove, clear, nodeOf }
 *   - place() 只更新 transform / 内容，节点复用
 *   - 用 window.__cardLayerDemo() 可以在场上做一次「A→B 滑动」的隔离验证
 */
(function () {
  'use strict';

  var Z = 1000;             // 图层 z-index
  var CARD_W = 92, CARD_H = 128;   // 基准尺寸（真实尺寸由容器单元格决定）

  function create(container, opts) {
    opts = opts || {};
    var layer = document.createElement('div');
    layer.className = 'rp-clayer';
    layer.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;'
      + 'pointer-events:none;z-index:' + (opts.z || Z) + ';';
    container.appendChild(layer);

    var nodes = {};   // key → { el, img, state }
    var metrics = opts.metrics || null;   // { x(ctl,loc,seq), y(...), w, h }

    function ensure(key) {
      var rec = nodes[key];
      if (rec) return rec;
      var el = document.createElement('div');
      el.className = 'rp-clayer-card';
      el.style.cssText = 'position:absolute;left:0;top:0;width:' + CARD_W + 'px;height:' + CARD_H + 'px;'
        + 'border-radius:4px;overflow:hidden;background:#101010;transform-origin:50% 50%;'
        + 'box-shadow:0 6px 18px rgba(0,0,0,.5);will-change:transform;'
        + 'transition:transform .3s cubic-bezier(.22,.61,.36,1),opacity .2s ease;'
        + 'transform:translate3d(0,0,0);opacity:0;';
      var img = document.createElement('img');
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      img.alt = '';
      el.appendChild(img);
      layer.appendChild(el);
      rec = nodes[key] = { el: el, img: img, key: key, shown: false };
      return rec;
    }

    /**
     * 放置/更新一张卡
     * @param {string} key  稳定 key（建议 ctl:loc:seq）
     * @param {{x:number,y:number,w?:number,h?:number,code?:number,faceDown?:boolean}} pos
     */
    function place(key, pos) {
      var rec = ensure(key);
      // PATCH(白神服) 2026-11-17: 每 120ms 对账一次时，浮点/亚像素差异会让 transform 反复被写入，
      //   配合 transition 就变成"卡一直在轻微抖动"。这里做阈值去重：位置/尺寸/旋转几乎没变就不动 DOM。
      try {
        var _lv = rec.last || null;
        var _rot0 = (typeof pos.rot === 'number') ? pos.rot : 0;
        if (_lv && Math.abs(_lv.x - pos.x) < 0.8 && Math.abs(_lv.y - pos.y) < 0.8
            && Math.abs(_lv.w - (pos.w || _lv.w)) < 0.8 && Math.abs(_lv.h - (pos.h || _lv.h)) < 0.8
            && _lv.rot === _rot0 && _lv.src === (pos.src || null)) {
          return rec.el;
        }
        rec.last = { x: pos.x, y: pos.y, w: pos.w || (_lv ? _lv.w : 0), h: pos.h || (_lv ? _lv.h : 0), rot: _rot0, src: pos.src || null };
      } catch (e) {}
      if (pos.w) rec.el.style.width = pos.w + 'px';
      if (pos.h) rec.el.style.height = pos.h + 'px';
      if (pos.src) {
        if (rec.img.getAttribute('src') !== pos.src) rec.img.setAttribute('src', pos.src);
        rec.img.style.visibility = 'visible';
      } else if (pos.code !== undefined) {
        var src = pos.faceDown ? (opts.cardBack || 'cover2.jpg') : (opts.picOf ? opts.picOf(pos.code) : ('/thumbcard/' + pos.code + '.jpg'));
        if (rec.img.getAttribute('src') !== src) rec.img.setAttribute('src', src);
        rec.img.style.visibility = 'visible';
      }
      var _rot = (typeof pos.rot === 'number') ? pos.rot : 0;
      rec.el.style.transform = 'translate3d(' + Math.round(pos.x) + 'px,' + Math.round(pos.y) + 'px,0)'
        + (_rot ? (' rotate(' + _rot + 'deg)') : '');
      if (!rec.shown) {
        rec.shown = true;
        // 首帧之后再淡入，保证 transition 生效
        requestAnimationFrame(function () { rec.el.style.opacity = '1'; });
      }
      return rec.el;
    }

    function remove(key, fade) {
      var rec = nodes[key];
      if (!rec) return;
      delete nodes[key];
      if (fade === false) { if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el); return; }
      rec.el.style.opacity = '0';
      rec.el.style.transform += ' scale(.92)';
      setTimeout(function () { if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el); }, 240);
    }

    function clear() {
      Object.keys(nodes).forEach(function (k) { remove(k, false); });
      nodes = {};
    }

    return {
      layer: layer,
      place: place,
      remove: remove,
      clear: clear,
      nodeOf: function (k) { return nodes[k] ? nodes[k].el : null; },
      count: function () { return Object.keys(nodes).length; }
    };
  }

  window.__cardLayer = { create: create };

  /**
   * 同步模式（第 2 步原型）：把场上怪兽区的卡交给图层画，原来的 .rp-card 隐藏。
   * 只在 URL 带 ?layer=1 时启用，默认完全不影响现有渲染。
   */
  function startSync(fieldEl, opts) {
    opts = opts || {};
    var api = create(fieldEl, { z: opts.z || 1150, picOf: opts.picOf, cardBack: opts.cardBack });
    var hidden = [];
    function hideLegacy(el) {
      if (!el || el.getAttribute('data-layer-hidden') === '1') return;
      el.setAttribute('data-layer-hidden', '1');
      el.style.visibility = 'hidden';
      hidden.push(el);
    }
    var live = {};
    var badgeBoxes = {};   // key → { box, sig }
    var BADGE_SEL = '.rp-lv, .rp-attr, .rp-stat, .rp-mats, .rp-counter, .rp-chain, .rp-announced';

    /** 把格子里的角标（等级/属性/攻守/素材/指示物/连锁）复制到图层上方 ——
     *  角标是 .rp-cell 的子节点，而图层与 .rp-cell 是兄弟：
     *  不管角标自己的 z-index 多高，都会被整个图层盖住，所以只能复制一份到图层里。*/
    function syncBadges(key, cell, offX, offY) {
      var rec = badgeBoxes[key];
      var src = cell.querySelectorAll(BADGE_SEL);
      var html = '';
      var seen = {};
      for (var i = 0; i < src.length; i++) {
        var el = src[i];
        var cls = el.className;
        if (seen[cls]) continue;      // 同类只留第一个，避免重复
        seen[cls] = 1;
        var cs = getComputedStyle(el);
        html += '<span class="' + cls + '" style="position:absolute;'
          + 'left:' + (el.offsetLeft) + 'px;top:' + (el.offsetTop) + 'px;'
          + (cs.transform && cs.transform !== 'none' ? 'transform:' + cs.transform + ';' : '')
          + '">' + el.innerHTML.replace(/</g, '&lt;') + '</span>';
      }
      if (!rec) {
        var box = document.createElement('div');
        box.className = 'rp-clayer-badges';
        box.style.cssText = 'position:absolute;pointer-events:none;z-index:1300;';
        api.layer.appendChild(box);
        rec = badgeBoxes[key] = { box: box, sig: null };
      }
      var sig = html + '|' + offX + '|' + offY;
      if (rec.sig === sig) return;
      rec.sig = sig;
      rec.box.style.left = offX + 'px';
      rec.box.style.top = offY + 'px';
      rec.box.innerHTML = html;
    }
    function dropKey(key) {
      try { api.remove(key, false); } catch (e) {}
      delete live[key];
      var bb = badgeBoxes[key];
      if (bb) { if (bb.box.parentNode) bb.box.parentNode.removeChild(bb.box); delete badgeBoxes[key]; }
    }

    function reconcile() {
      try {
        // 查看器会重建 field 的 DOM（innerHTML=''），图层节点会跟着被摘掉 → 这里重新挂回去
        if (api.layer && api.layer.parentNode !== fieldEl) fieldEl.appendChild(api.layer);
        var fr = fieldEl.getBoundingClientRect();
        var seen = {};
        var cells = fieldEl.querySelectorAll('.rp-cell[data-zone]');
        for (var i = 0; i < cells.length; i++) {
          var cell = cells[i];
          var zone = String(cell.getAttribute('data-zone') || '').split(':');
          if (zone.length < 3 || Number(zone[1]) !== 4) continue;
          var node = cell.querySelector('.rp-card');
          var _uid = '';
          try {
            if (window.__live && window.__live.uidAt) {
              _uid = window.__live.uidAt(Number(zone[0]), 4, Number(zone[2]));
            }
          } catch (e) {}
          var key = _uid ? ('u:' + _uid) : zone.join(':');
          var code = cell.getAttribute('data-code') || cell._code;
          if (!node || !code) { if (live[key] || badgeBoxes[key]) dropKey(key); continue; }
          var r = node.getBoundingClientRect();
          if (!r.width) continue;
          // 用**未旋转**的布局尺寸 + 格子矩形 + 旋转角：
          //   原来直接拿旋转后的包围盒当宽高（守备时宽高互换），图却没转 → 竖着画在横框里
          // PATCH(白神服) 2026-11-17: 卡面应该**比格子小**（老渲染里是格子里的一张带边距的卡），
          //   所以尺寸取**卡面图片自身**的尺寸；盖卡没有 img，就退回卡节点尺寸。
          var artEl = node.querySelector('img') || node;
          var cr0 = artEl.getBoundingClientRect();
          var lw = artEl.offsetWidth || cr0.width;
          var lh = artEl.offsetHeight || cr0.height;
          var rot = 0;
          try {
            if (cell._def) rot = cell._flip ? 90 : -90;
            else if (cell._flip) rot = 180;
          } catch (e) {}
          seen[key] = 1;
          live[key] = 1;
          hideLegacy(node);
          // 沿用老节点里的图源（viewer 用的是 DIY 大图），避免退化成 60px 缩略图导致发虚
          var srcImg = node.querySelector('img');
          var srcUrl = srcImg ? (srcImg.getAttribute('src') || srcImg.currentSrc || '') : '';
          // 用**节点自身矩形的中心** + 未旋转尺寸来定位：
          //   原来用格子左上角，卡面比格子窄时就会"贴着左边"（用户实测 ✗）；
          //   旋转不改变中心，所以守备/倒置也能正确居中。
          // PATCH(白神服) 2026-11-17: 场地用了 CSS zoom 缩放时，getBoundingClientRect 给的是
          //   **已缩放后的视口坐标**，而图层内部坐标是未缩放 CSS px →
          //   直接用会再乘一次 zoom，卡就画得偏大/偏移（用户实测：卡比格子大、压到旁边）。
          //   这里统一除以 zoom 换回图层内部坐标。
          var _z = 1;
          try { _z = parseFloat(getComputedStyle(fieldEl).zoom) || (fieldEl.style.zoom ? parseFloat(fieldEl.style.zoom) : 1) || 1; } catch (e) { _z = 1; }
          if (!isFinite(_z) || _z <= 0) _z = 1;
          var _cx = (r.left + r.width / 2 - fr.left) / _z;
          var _cy = (r.top + r.height / 2 - fr.top) / _z;
          api.place(key, {
            x: _cx - lw / 2, y: _cy - lh / 2, w: lw, h: lh, rot: rot,
            code: Number(code), faceDown: cell._down === true, src: srcUrl || undefined
          });
          // 角标复制到图层之上（否则被图层整块盖住）
          try {
            var cr = cell.getBoundingClientRect();
            syncBadges(key, cell, (cr.left - fr.left) / _z, (cr.top - fr.top) / _z);
          } catch (e) {}
        }
        // PATCH(白神服) 2026-11-17: **手牌暂时不交给图层** ——
        //   按 uid 接管手牌后出现「只显示最右一张、其余消失，且卡片在左右反复瞬移」的错误，
        //   根因是手牌的 uid 映射不稳定（同一 uid 在不同 tick 取不到/取错）。
        //   先恢复老渲染，等场上的 uid 复用验证稳定后，再单独做手牌接管。

        Object.keys(live).forEach(function (k) {
          if (!seen[k]) dropKey(k);
        });
        // 角标副本比卡片多留了一种情况：格子还在但卡没了 → 兜底按 badgeBoxes 扫一遍
        Object.keys(badgeBoxes).forEach(function (k) {
          if (!seen[k]) {
            var bb = badgeBoxes[k];
            if (bb && bb.box.parentNode) bb.box.parentNode.removeChild(bb.box);
            delete badgeBoxes[k];
          }
        });
      } catch (e) {}
    }
    try { document.body.classList.add('rp-layer-mode'); } catch (e) {}
    var timer = setInterval(reconcile, 120);
    reconcile();
    return {
      stop: function () {
        clearInterval(timer);
        api.clear();
        try { document.body.classList.remove('rp-layer-mode'); } catch (e) {}
        hidden.forEach(function (el) { el.style.visibility = ''; el.removeAttribute('data-layer-hidden'); });
        hidden = [];
      },
      api: api
    };
  }

  window.__cardLayer.startSync = startSync;

  // ?layer=1 时自动挂载（仅怪兽区，原型）
  (function autoBoot() {
    try {
      if (!/[?&]layer=1(?:&|$)/.test(location.search)) return;
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        var f = document.getElementById('replayField');
        if (f && f.querySelector('.rp-cell[data-zone]')) {
          clearInterval(iv);
          window.__layerSync = startSync(f, { picOf: function (code) { return '/thumbcard/' + code + '.jpg'; } });
          console.log('[card-layer] sync started');
        } else if (tries > 200) { clearInterval(iv); }
      }, 100);
    } catch (e) {}
  })();


  /**
   * 隔离验证：在场上临时铺一层，放一张卡，再滑到另一格，然后清掉。
   * 控制台执行 __cardLayerDemo() 即可看到效果。
   */
  window.__cardLayerDemo = function () {
    try {
      var host = document.getElementById('replayField') || document.querySelector('.rp-board');
      if (!host) return 'no host';
      var prev = document.getElementById('rpCardLayerDemo');
      if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
      var api = create(host, { z: 1200 });
      api.layer.id = 'rpCardLayerDemo';
      var hr = host.getBoundingClientRect();
      var code = 89631139;
      api.place('demo', { x: hr.width * 0.25, y: hr.height * 0.55, code: code });
      setTimeout(function () {
        api.place('demo', { x: hr.width * 0.62, y: hr.height * 0.42, code: code });
      }, 420);
      setTimeout(function () { api.remove('demo'); }, 1600);
      return 'demo started';
    } catch (e) { return 'ERR ' + e.message; }
  };
})();
