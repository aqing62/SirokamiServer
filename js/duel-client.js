/**
 * play.js —— 可亲自打的网页客户端（P2 交互层）
 *
 * 分层（自下而上）：
 *   1. 传输/协议：ygopro-web-browser.js（YGO.*，解帧 + 解码 + 适配器 + 卡组解析）
 *   2. 渲染：viewer-live.js（官网回放查看器的场地/动画/日志 + 4 处补丁 + flush()）
 *   3. 交互（本文件）：大厅（昵称/房间/卡组/准备/开始）+ 出牌（选择/连锁/宣告 → CTOS_RESPONSE）
 *
 * 关键设计：
 *   - **位置从 DOM 反推**：场地格位带 data-zone="<controller>:<location>:<sequence>"、手牌是
 *     [data-zone="<c>:2"] 里的第 i 个 .rp-card —— 所以点击事件不需要查看器暴露内部状态。
 *   - **应答字节交给协议库**：`msg.prepareResponse(...)` 已实现每种消息的编码（唯一例外是
 *     SELECT_SUM 的必选卡占位，见下方 sumResponse()，库的实现与服务端读法不一致）。
 *   - **立即应用**：交互不能用回放的 3 步/秒节奏，收到消息即 `__live.flush()`。
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LOC = { DECK: 1, HAND: 2, MZONE: 4, SZONE: 8, GRAVE: 16, REMOVED: 32, EXTRA: 64, OVERLAY: 128, FZONE: 256, PZONE: 512 };
  /** 可点按钮：居中弹窗里的 + 场地中线上（战阶/主二/结束回合） */
  var YP_BTN_SEL = '#ypPromptBtns .yp-btn, #ypCtl .yp-btn';

  // 默认牌组（本机卡库里确定存在的通常怪兽；每张 ≤3 张凑 40）—— 将来改为读官网已保存的卡组
  var DEFAULT_CODES = [32864, 487395, 549481, 732302, 756652, 1184620, 1761063, 1784619, 1929294, 2118022, 2311603, 2468169, 2483611, 2830619];

  var q = new URLSearchParams(location.search);
  var state = {
    url: q.get('ws') || ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + ':7912'),
    room: q.get('room') || '',
    name: q.get('name') || localStorage.getItem('yp_name') || ('玩家' + Math.floor(Math.random() * 900 + 100)),
    sock: null, scanner: null,
    mySeat: -1, myDuelPos: -1, isHost: false,
    ready: {},             // 座位 → 是否 READY
    deck: null,
    joined: false, duelStarted: false,
    pending: null,         // 当前等待应答的请求 {msg, kind, ...}
    armed: null,           // 已选"操作类型"，等待点卡（如 召唤/攻击/发动）
    picked: [],            // 多选已选中的位置
    lastRetry: 0,
  };

  // ─────────────────────────────── 小工具

  function setHud(text, cls) {
    var el = $('hudState');
    if (el) { el.textContent = text; el.className = 'yp-state ' + (cls || ''); }
  }
  function logLine(text, cls) {
    var body = $('replayLogBody');
    if (!body) return;
    var d = document.createElement('div');
    d.className = 'rp-log-line ' + (cls || '');
    d.textContent = text;
    body.appendChild(d);
    while (body.children.length > 500) body.removeChild(body.firstChild);
    body.scrollTop = body.scrollHeight;
  }
  function cardNameOf(code) {
    // 查看器的卡名表是闭包内的；直接用 title/图片反查代价高，这里用 DOM 上已有的 title
    return '';
  }
  function deckFromCodes(codes) {
    var main = [];
    for (var r = 0; r < 3 && main.length < 40; r++) for (var i = 0; i < codes.length && main.length < 40; i++) main.push(codes[i]);
    while (main.length < 40) main.push(codes[0]);
    return new YGO.YGOProDeck({ main: main, extra: [], side: [] });
  }

  // ─────────────────────────────── 座位翻转（决斗位 1 → 视角 0）
  //
  // 服务端所有对局消息里的 player/controller 都是**决斗位**编号（MSG_START 给的
  // playerNumber 就是我的决斗位）。而查看器把"决斗位 0"固定画在下方（__live.reset 里
  // metaSwap = false）。我抽到决斗位 1 时若原样转发就会出现：
  //     名签写着"我在下方"，而我的卡（正面朝上的手牌、我的怪兽）全画在上面 —— 世界镜像了。
  // 所以在转发的边界把整个世界翻过来：决斗位 1 ↔ 0。查看器始终活在"我在决斗位 0、在下方"
  // 的世界里，viewer-live.js 一行都不用改。
  function flipSeat(n) { return state.myDuelPos === 1 ? (1 - n) : n; }

  /** hex 里内嵌的座位字节（查看器有几处直接读 hex，不走 f 字段）——只翻 0/1 值 */
  function flipHexByte(hex, byteIdx) {
    if (!hex || hex.length < (byteIdx + 1) * 2) return hex;
    var at = byteIdx * 2;
    var v = parseInt(hex.substr(at, 2), 16);
    if (v !== 0 && v !== 1) return hex;
    return hex.slice(0, at) + (v === 0 ? '01' : '00') + hex.slice(at + 2);
  }

  /**
   * 翻转一个 envelope 的座位编号。f 字段与 hex 字节都要翻：
   *   - UpdateData：查看器用 m.hex 第 1 字节判"这是谁的手牌"（player）
   *   - PosChange ：controller 在 hex 第 5 字节（payload = code(4) ctl loc seq prevPos curPos）
   *   - Move      ：previous / current 的 controller 在 hex 第 5 / 第 9 字节
   *   - PayLpCost ：f.player 与 hex 第 1 字节都读
   */
  function flipEnvelope(env) {
    if (!env || state.myDuelPos !== 1) return env;
    var f = env.f || (env.f = {});
    if (typeof f.player === 'number') f.player = flipSeat(f.player);
    if (typeof f.controller === 'number') f.controller = flipSeat(f.controller);
    if (f.attacker && typeof f.attacker.controller === 'number') f.attacker.controller = flipSeat(f.attacker.controller);
    ['previous', 'current'].forEach(function (k) {
      var zone = f[k];
      if (zone && typeof zone.controller === 'number') zone.controller = flipSeat(zone.controller);
    });
    if (env.name === 'UpdateData' || env.name === 'PayLpCost') env.hex = flipHexByte(env.hex, 1);
    else if (env.name === 'PosChange') env.hex = flipHexByte(env.hex, 5);
    else if (env.name === 'Move') { env.hex = flipHexByte(env.hex, 5); env.hex = flipHexByte(env.hex, 9); }
    return env;
  }

  // ─────────────────────────────── 里侧怪兽的"翻转"（翻转召唤）
  //
  // ⚠ 引擎对"里侧怪变更表示形式"发的是 **MSG_FLIPSUMMONING(64)**，**不发 POS_CHANGE(53)**
  //   （实测报文序列：… 65, 6,6,6,6, 16 …）。查看器只认 POS_CHANGE，于是卡一直盖着
  //   —— 玩家反馈的"点了变更表示形式还是盖着的"就是这个。
  //   这里按 FLIPSUMMONING 的字段**合成一个 POS_CHANGE** 喂给查看器（复用它更新模型+重画+写日志），
  //   再补一个翻面动画（真实客户端有，查看器的实时路径没有）。

  /** 合成 POS_CHANGE 信封：hex = [id=53][code i32le][ctl][loc][seq][prevPos][curPos] */
  function synthPosChange(code, ctl, loc, seq, prev, cur) {
    var inner = new Uint8Array(10);
    inner[0] = 53;
    new DataView(inner.buffer).setInt32(1, code, true);
    inner[5] = flipSeat(ctl) & 0xff;                    // 翻到"我恒为 0"的查看器世界
    inner[6] = loc & 0xff; inner[7] = seq & 0xff;
    inner[8] = prev & 0xff; inner[9] = cur & 0xff;
    var hex = '';
    for (var i = 0; i < inner.length; i++) hex += inner[i].toString(16).padStart(2, '0');
    return { name: 'PosChange', f: {}, hex: hex };
  }

  /** 翻面/转向动画：给那张卡加一会儿动画类（CSS keyframes，见 play.html） */
  /**
   * 卡片动画。两种**不能混用**（玩家实测指出）：
   *   · mode='flip'  翻转召唤（盖牌→表侧）：翻面动画
   *   · mode='rot'   表示形式变更（攻击↔守备）：**向左/向右转 90°**，不是翻面 ✗
   * 坐标一律交给 viewZoneOf()（它已经处理"服务端绝对坐标 → 我的视角"的翻转与额外怪兽区映射）——
   * ⚠ 之前这里又调了一次 flipSeat()，等于**翻了两遍**，动画会跑到对面格上。
   */
  /** 从（**已翻转的**）hex 里取字节 —— 和查看器的取法完全一致 */
  function hexU8At(hex, i) {
    if (!hex || hex.length < (i + 1) * 2) return 0;
    return parseInt(hex.substr(i * 2, 2), 16) || 0;
  }
  function hexU32At(hex, i) {
    return ((hexU8At(hex, i)) | (hexU8At(hex, i + 1) << 8) | (hexU8At(hex, i + 2) << 16) | (hexU8At(hex, i + 3) << 24)) >>> 0;
  }
  /**
   * 直接按"**已经是我的视角**的坐标"播动画。
   * ⚠ 必须用这个：flipEnvelope() 会把 hex 里的座位字节也翻转 ✓，查看器用的就是翻转后的 hex ✓，
   *   而动画若去解**原始字节**再翻一次，两层就会不一致（对方卡的动画会跑到我方格上/干脆没有 ✗，
   *   玩家实测："红箭头(我方)有动画，绿箭头(对方)没动画"）。
   */
  function animateZoneKey(ctlView, loc, seq, mode) {
    var plain = (loc === undefined ? LOC.MZONE : loc) & 0x7f;
    var key = (plain === LOC.MZONE && seq >= 5) ? emzKey(ctlView, seq) : (ctlView + ':' + plain + ':' + seq);
    var cell = document.querySelector('[data-zone="' + key + '"]');
    if (!cell) return;
    var card = cell.querySelector('.rp-card') || cell;
    // 三种动画：rot-def（攻击→守备，向左转 90°）/ rot-atk（守备→攻击，转回直立）/ flip（翻面）
    var cls = (mode === 'rot-atk') ? 'yp-rot-atk' : (mode === 'rot' || mode === 'rot-def') ? 'yp-rot-def' : 'yp-flip-anim';
    var all = '.yp-flip-anim, .yp-rot-def, .yp-rot-atk';
    Array.prototype.forEach.call(document.querySelectorAll(all), function (el) {
      el.classList.remove('yp-flip-anim', 'yp-rot-def', 'yp-rot-atk');
    });
    card.classList.remove('yp-flip-anim', 'yp-rot-def', 'yp-rot-atk');
    void card.offsetWidth;
    card.classList.add(cls);
    setTimeout(function () { card.classList.remove(cls); }, 800);
  }
  function animateCard(ctl, loc, seq, mode) {
    var key = viewZoneOf({ controller: ctl, location: (loc === undefined ? LOC.MZONE : loc), sequence: seq || 0 });
    var cell = document.querySelector('[data-zone="' + key + '"]');
    if (!cell) return;
    var card = cell.querySelector('.rp-card') || cell;
    var cls = (mode === 'rot-atk') ? 'yp-rot-atk' : (mode === 'rot' || mode === 'rot-def') ? 'yp-rot-def' : 'yp-flip-anim';
    // ⚠ 先把**全页面**残留的动画类清掉：上一次动画的元素若还没到 800ms 清理时间，
    //   会和这一次同时播放（玩家实测："两张会一起播放变更表示形式动画"）。
    Array.prototype.forEach.call(document.querySelectorAll('.yp-flip-anim, .yp-rot-anim'), function (el) {
        el.classList.remove('yp-flip-anim', 'yp-rot-anim');
    });
    card.classList.remove('yp-flip-anim', 'yp-rot-anim');
    void card.offsetWidth;                              // 强制重排，保证连续两次也能重放动画
    card.classList.add(cls);
    setTimeout(function () { card.classList.remove(cls); }, 800);
  }
  function animateFlipCard(ctl, loc, seq) { animateCard(ctl, loc, seq, 'flip'); }
  function animatePosChange(ctl, loc, seq, toDefense) { animateCard(ctl, loc, seq, 'rot'); }

  /**
   * 自己按**真实布局**解 MSG_SELECT_CHAIN（实测报文：12 字节头 + 每项 13 字节）：
   *   [0]=id(16) [1]=player [2]=count [3]=specialCount [4]=**forced** [5..8]=hint0 [9..12]=hint1
   *   每项： [0]=EDESC 标记 [1..4]=code(i32le) [5..8]=info_location [9..12]=description(i32le)
   *   info_location = controller | (location<<8) | (sequence<<16) | (position<<24)   ← ocgcore card.cpp:252
   * ⚠ `ygopro-msg-encode` 按**另一版布局**解码（没有 forced 字节、每项 10 字节）→ 链项整体错位，
   *   更要紧的是**拿不到"必须连锁"这个标志**，而引擎正是用它判 RETRY：
   *   `if(returns.ivalue[0] < 0 && forced) → MSG_RETRY`（playerop.cpp:325）。
   * 自检：长度必须恰好 = 13 + count*13，否则返回 null 让调用方退回库的解码。
   */
  function decodeChainsRaw(raw) {
    try {
      // ── 实测布局（291 条真实帧，夹具 evidence/selectchain-sample.json）──
      //   raw 的入口 = 从**对局消息号**开始的字节：
      //     [0]=id(16) [1]=player [2]=count [3]=specialCount [4..7]=hint0 [8..11]=hint1
      //     之后每项 13 字节：[EDESC标记(1)][code(4)][info_location(4)][description(4)]
      //   ⇒ 帧长 = **12 + count*13**（count=0 → 12 字节，与实测 len=12 吻合 ✓）
      //   ⚠ 三个曾经的错误假设（都是这条报文一直解不对的原因）：
      //     ① 以为头是 13 字节、项从 13 开始 → 实际头 12、项从 **12** 开始 ✗
      //     ② 以为 raw[4] 是 forced → 实际 raw[4] 是 **hint0 的第一个字节** ✗
      //     ③ 以为服务端会发 forced → **这一版服务端根本不发** ✗（引擎源码里有，实测 291 条都没有）
      //   ⇒ 客户端**无法**判断"能不能放弃"⇒「不连锁」必须永远给（见 chain 分支的注释 ✓）
      if (!raw || raw.length < 12) return null;
      var cnt = raw[2];
      if (raw.length !== 12 + cnt * 13) return null;          // 布局不匹配 → 不用它
      var out = [];
      for (var i = 0; i < cnt; i++) {
        var o = 12 + i * 13;
        var code = (raw[o + 1] | (raw[o + 2] << 8) | (raw[o + 3] << 16) | (raw[o + 4] << 24)) >>> 0;
        var info = (raw[o + 5] | (raw[o + 6] << 8) | (raw[o + 7] << 16) | (raw[o + 8] << 24)) >>> 0;
        var desc = (raw[o + 9] | (raw[o + 10] << 8) | (raw[o + 11] << 16) | (raw[o + 12] << 24)) >>> 0;
        out.push({
          code: code, edesc: raw[o], desc: desc, forced: 0,
          controller: info & 0xff, location: (info >>> 8) & 0xff,
          sequence: (info >>> 16) & 0xff, position: (info >>> 24) & 0xff,
        });
      }
      return { count: cnt, specialCount: raw[3], forced: false, chains: out };
    } catch (e) {
      return null;
    }
  }

  // ─────────────────────────────── 发送

  function send(msg) {
    if (!state.sock || state.sock.readyState !== 1) return;
    var body = msg.toPayload();
    var payload = new Uint8Array(1 + body.length);
    payload[0] = msg.identifier;
    payload.set(body, 1);
    state.sock.send(YGO.encodeFrame(payload));
  }

  /**
   * 用官网注入的账号自动登录游戏服（让网页对战计入天梯）。
   *   官网在页面里注入：window._duelUser = { name, account, pass }
   *   游戏服的登录就是聊天命令 `/login 「账号」「密码」`（srvpro2 的 login 服务）；
   *   登录成功后 client.loggedIn = true、账号绑定，天梯才会统计这局。
   *   没注入（未登录官网 / 本地联调）就什么都不做，行为与以前一致。
   */
  function autoLoginIfNeeded() {
    try {
      if (state.autoLoginTries >= 2) return;
      var u = window._duelUser;
      if (!u || !u.account || !u.pass) return;
      state.autoLoginTries = (state.autoLoginTries || 0) + 1;
      send(chatFrame('/login ' + u.account + ' ' + u.pass));
      logLine('已用官网账号自动登录游戏服：' + u.account + '（第 ' + state.autoLoginTries + ' 次，登录成功这局才计天梯）', 'rp-log-hint');
      // 没收到「登录成功」就再补一次（进房握手时序偶尔会吃掉第一条聊天）
      if (state.autoLoginTries < 2) {
        setTimeout(function () {
          if (!state.loggedInOk) autoLoginIfNeeded();
        }, 2500);
      }
    } catch (e) {
      logLine('自动登录失败：' + (e && e.message), 'rp-log-err');
    }
  }

  /**
   * 手工拼一条聊天帧（CTOS_CHAT = 22，载荷是 UTF-16LE 文本）。
   * ⚠ 为什么要手拼：bundle 的入口只导出了客户端需要的那几个 YGOProCtos*，
   *   `YGO.YGOProCtosChat` **不存在**（实测报 "…sChat is not a constructor"）。
   *   send() 只要求对象带 identifier + toPayload()，所以这样最省事、也不依赖导出表。
   */
  function chatFrame(text) {
    var buf = new Uint8Array(text.length * 2 + 2);   // 末尾补一个 NUL（与真客户端一致）
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      buf[i * 2] = c & 0xff;
      buf[i * 2 + 1] = (c >> 8) & 0xff;
    }
    return { identifier: 22, toPayload: function () { return buf; } };
  }
  function respond(body) {
    if (state.previewMode) { state.previewMode = false; clearPending(); return; }   // UI 预览：不真发
    if (!body) { logLine('⚠ 无法构造应答（实现缺失）', 'rp-log-err'); return; }
    // 记下"最近一次发出的应答"：服务端回 MSG_RETRY 时能把"发了什么"打出来，定位是哪一步被拒
    var hex = '';
    try { for (var i = 0; i < body.length && i < 24; i++) hex += body[i].toString(16).padStart(2, '0'); } catch (e) {}
    state.lastResponse = {
      kind: state.pending ? state.pending.kind : '(局外)',
      name: state.pending ? state.pending.msg.constructor.name.replace(/^YGOProMsg/, '') : '',
      size: body.length, hex: hex,
    };
    state.responses = (state.responses || 0) + 1;
    send(new YGO.YGOProCtosResponse().fromPartial({ response: body }));
    clearPending();
  }

  /**
   * 发送"第 n 个候选"类应答（召唤/特殊召唤/改表示/盖放/发动/攻击）。
   * ⚠ 必须用 `YGO.IndexResponse(n)` 而不是 `{index:n}`：库的 `isIndexResponse()` 认的是一个 symbol，
   *    普通对象会被当成"卡描述符"去按字段找卡，字段全 undefined 时匹配到**第一张**
   *    —— 表现就是"选了右边那张怪，召唤出来的是最左边那只"（实测踩过）。
   *    这里再加一道字节自检：编码结果必须等于 (n<<16)|type，否则手写兜底。
   */
  function respondIndexed(m, type, index) {
    // ⚠ 参数缺失时**绝不能**硬发字节：之前牌堆菜单误走这条路，type/index 都是 undefined →
    //   兜底把 undefined 当 0 手写成了 `00000000`，等于替玩家提交了"选项 0" → 服务端 MSG_RETRY。
    //   遇到这种情况只记日志、不发包（宁可不动，也不要发一个语义错误的应答）。
    if (typeof type !== 'number' || typeof index !== 'number' || type < 0 || index < 0) {
      logLine('⚠ 内部错误：应答参数不合法（type=' + type + ' index=' + index + '）→ 已放弃发送（没有替你乱选）', 'rp-log-err');
      return false;
    }
    var expect = (((index << 16) >>> 0) | (type >>> 0)) >>> 0;
    var body = null;
    try { body = m.prepareResponse(type, YGO.IndexResponse(index)); } catch (e) { body = null; }
    var got = body && body.length >= 4 ? ((body[0] | (body[1] << 8) | (body[2] << 16) | (body[3] << 24)) >>> 0) : -1;
    if (!body || body.length < 4 || got !== expect) {
      logLine('⚠ 应答编码自检失败（type=' + type + ' index=' + index + ' 得到 ' + got + '，期望 ' + expect + '）→ 手写字节', 'rp-log-err');
      var b = new Uint8Array(4);
      new DataView(b.buffer).setUint32(0, expect, true);
      body = b;
    }
    respond(body);
    return true;
  }

  // ─────────────────────────────── 大厅

  /**
   * 官网注入的「当前使用卡组」（决斗大厅里选好的）→ 用它，而不是内置默认卡组。
   * 没注入（未登录官网 / 本地联调）才退回内置默认卡组。
   */
  function deckFromInjection() {
    var u = window._duelUser;
    var d = u && u.deck;
    if (!d || !d.main || !d.main.length) return null;
    return { main: d.main.slice(), extra: (d.extra || []).slice(), side: (d.side || []).slice() };
  }
  function applyInjectedDeck() {
    var d = deckFromInjection();
    if (!d) return false;
    state.deck = d;
    logLine('已使用官网选定的卡组：' + ((window._duelUser && window._duelUser.deckName) || '当前使用卡组')
      + '（主 ' + d.main.length + ' / 额外 ' + d.extra.length + ' / 副 ' + d.side.length + '）', 'rp-log-hint');
    return true;
  }

  function joinRoom() {
    if (!state.room) { setHud('请先填房间名', 'warn'); return; }
    if (!applyInjectedDeck() && !state.deck) state.deck = deckFromCodes(DEFAULT_CODES);
    loadStrings();                                    // 提示文案表（strings.conf → /api/strings）
    if (!state.cardsById) {
      fetch('/api/cards').then(function (r) { return r.ok ? r.json() : []; }).then(function (j) {
        var by = {}; (j || []).forEach(function (c) { by[c.id] = c; });
        state.cardsById = by;
        logLine('已加载卡片基础表（' + Object.keys(by).length + ' 张）', 'rp-log-hint');
      }).catch(function () { state.cardsById = {}; });
    }
    localStorage.setItem('yp_name', state.name);
    setHud('连接中…');    state.sock = new WebSocket(state.url);
    state.sock.binaryType = 'arraybuffer';
    state.scanner = new YGO.FrameScanner({ onError: function (e) { console.warn(e.message); } });
    state.sock.onopen = function () {
      send(new YGO.YGOProCtosPlayerInfo().fromPartial({ name: state.name }));
      // lflist：卡表序号。服务端 `room.js` 的判定是：
      //   `hostinfo.lflist >= 0` → 取 lflist.conf 里第 N 个表（**从 0 开始数**）；**`-1` → 空表 = 无禁限**。
      //   ⚠ 所以**不能默认发 0**：0 会被解释成"第一张卡表(2026.10)"，等于把无禁限房变成有禁限 ✗（实测踩过）。
      //   不指定时**干脆不发这个字段**，让服务端用它自己的默认值；要无禁限就显式 `?lflist=-1`。
      var jf = { version: 0x1362, gameid: 0, pass: state.room };
      if (state.lflist !== undefined && state.lflist !== null) jf.lflist = state.lflist;
      send(new YGO.YGOProCtosJoinGame().fromPartial(jf));
      setHud('已连接，进房中…（卡表：' + (state.lflist === -1 ? '无禁限' :
        (state.lflist !== undefined && state.lflist !== null ? ('第 ' + state.lflist + ' 个表' + (state.lflistName ? ' ' + state.lflistName : '')) : '服务端默认')) + '）', 'ok');
    };
    state.sock.onmessage = function (ev) {
      var frames = state.scanner.push(new Uint8Array(ev.data));
      for (var i = 0; i < frames.length; i++) onFrame(frames[i]);
    };
    state.sock.onclose = function () { setHud('连接已断开', 'err'); };
    state.sock.onerror = function () { setHud('连接错误', 'err'); };
  }

  /**
   * 上传卡组 + 准备。
   * ⚠ 重连场景（刷新后重进）必须**等卡组真的到位**再发：`?ydk=` 是异步 fetch 的，
   *   如果这时抢跑，就会用"默认卡组"顶替（或什么都没发出去）→ 服务端永远等不到 READY，
   *   玩家看到的就是"重进卡住了"（实测被反馈过）。所以：没卡组时先等，最多等 6 秒。
   */
  function uploadDeckAndReady(attempt) {
    attempt = attempt || 0;
    if (!state.deck) {
      if (attempt === 0) logLine('… 等卡组加载完成后再准备（重连/首次进房）', 'rp-log-hint');
      if (attempt < 20) { setTimeout(function () { uploadDeckAndReady(attempt + 1); }, 300); return; }
      logLine('⚠ 卡组迟迟没加载好 → 先用内置默认卡组顶上（避免卡在"等准备"）', 'rp-log-err');
      state.deck = deckFromCodes(DEFAULT_CODES);
    }
    if (state.readySent) return;                       // 别重复发（会打乱服务端状态机）
    state.readySent = true;
    send(new YGO.YGOProCtosUpdateDeck().fromPartial({ deck: state.deck }));
    send(new YGO.YGOProCtosHsReady());
    logLine('已上传牌组（' + state.deck.main.length + ' 张）并点了准备');
  }

  // ─────────────────────────────── 收包

  /** 重连恢复：服务端重放整局时可能不再发 MSG_START → 用 localStorage 里记的座位/决斗位补上，
   *  否则客户端的左右翻转（flipSeat）会按错误的方向画，玩家看到的是镜像盘面。 */
  function restoreDuelPosIfNeeded() {
    if (state.myDuelPos >= 0) return false;
    var raw = null;
    try { raw = localStorage.getItem('yp_duel_' + state.room); } catch (e) {}
    if (!raw) return false;
    var saved;
    try { saved = JSON.parse(raw); } catch (e) { return false; }
    if (!saved || typeof saved.duelPos !== 'number') return false;
    state.myDuelPos = saved.duelPos;
    if (typeof saved.seat === 'number' && state.mySeat < 0) state.mySeat = saved.seat;
    state.duelStarted = true;
    // ⚠ **不要在这里 reset 查看器**：重放里还会来一条 MSG_START，onDuelStart 已经会 reset；
    //   这里再清一次会把"重放过程中已经重建好的场地模型"抹掉 —— 玩家看到的就是"重连回来场上卡全没了"
    //   （实测复现：模型 怪兽区/魔陷区/墓地全空，但日志里整局都重放过了）。这里只把视角/座位补回来。
    setUiPhase('duel');
    logLine('↻ 已按上次记录恢复视角（决斗位 ' + state.myDuelPos + '）—— 服务端正在重放这一局', 'rp-log-phase');
    return true;
  }

  /**
   * 对局结束（MSG_WIN）：回到大厅，允许再准备一局。
   * 服务端在胜负后会把房间退回"准备"状态（players 的 READY 被清掉），
   * 但如果客户端不把 duelStarted 复位，renderLobby 会一直早退 → 玩家看到的就是"打完了还卡在场上"。
   */
  function onDuelEnd(m) {
    var meWin = m && m.player !== undefined && flipSeat(m.player) === 0;
    var reason = '';
    if (m && m.type !== undefined) {
      var vt = victoryText(m.type);                 // strings.conf 的 !victory 表：0=投降 1=基本分变成0 …
      reason = vt ? ('（' + vt + '）') : '';
    }
    logLine('★ 对局结束：' + (meWin ? '你赢了' : '你输了') + reason, 'rp-log-win');
    state.duelStarted = false;
    state.myDuelPos = -1;
    state.readySent = false;               // 回大厅后可以再准备下一局
    state.lastPosChange = null; state.lastSearch = null; state.lastSummoning = null; state.lastFromHand = null;
    state.picked = []; state.armed = null;
    clearPending();
    hideChooser(); hideTopBar();
    try { localStorage.removeItem('yp_duel_' + state.room); } catch (e) {}
    setUiPhase('room');                             // 回到房间界面（带转场）
    renderLobby();
    setHud('对局结束 ' + (meWin ? '（你赢了）' : '（你输了）') + reason + ' —— 点「准备」可以再来一局', meWin ? 'ok' : 'warn');
    logLine('↩ 已回到大厅：点「准备」开下一局（房间里可以继续打多局）', 'rp-log-phase');
  }

  function onFrame(frame) {
    if (state.debug === undefined) { try { state.debug = new URLSearchParams(location.search).get('debug') === '1'; } catch (e) { state.debug = false; } }
    var msg = YGO.YGOProStoc.getInstanceFromPayload(frame);
    if (!msg) return;
    var inner = YGO.framePayload(frame);

    // 对局中刷新页面：重放的消息先到，用记录把视角/座位补回来
    if (msg instanceof YGO.YGOProStocGameMsg || msg instanceof YGO.YGOProMsgResponseBase) restoreDuelPosIfNeeded();

    if (msg instanceof YGO.YGOProStocJoinGame) {
      state.joined = true;
      $('roomInfo').textContent = '房间 ' + state.room;
      return;
    }
    if (msg instanceof YGO.YGOProStocTypeChange) {
      state.mySeat = msg.playerPosition;
      state.isHost = !!msg.isHost;
      logLine('我进房了：座位 ' + state.mySeat + (state.isHost ? '（房主）' : '') + (state.mySeat === 7 ? '（观战）' : ''));
      // 拿到座位 = 真正进房了 → 这时才发 /login 自动登录（早于这一刻服务端会收不到）
      if (state.mySeat !== 7) setTimeout(autoLoginIfNeeded, 800);
      if (state.mySeat === 7) {
        // 观战 = 两个座位都有人。最常见原因：你上次断线后服务端**保留了你的席位**（约 3 分钟），
        // 换个昵称再进就挤不进座位了 —— 所以把"怎么办"直接写清楚（玩家反馈过"进不去房间了"）。
        logLine('⚠ 两个座位都已占用 → 你进来是观战者。若刚断过线：用**原来的昵称**重新加入即可接回原座位；'
          + '否则请换一个房间名开新局。', 'rp-log-err');
        setHud('房间满了（你是观战者）：用原昵称可接回自己那一席，或换个房间名开新局', 'warn');
        // 天梯模式房名固定（M#），座位可能被"断线保留"占着 → **自动重试进房**，
        // 否则玩家会卡在观战者状态、连"准备"按钮都没有（实测被反馈："点不了准备"）。
        if (state.room === 'M#' && !state.observerRetry) {
          state.observerRetry = 0;
          var retryJoin = function () {
            if (state.mySeat !== 7 || state.observerRetry >= 10) return;
            state.observerRetry++;
            logLine('↻ 座位暂时被占，6 秒后自动重试进房（第 ' + state.observerRetry + '/10 次）', 'rp-log-hint');
            setTimeout(function () {
              if (state.mySeat === 7) {
                try { if (state.sock) state.sock.close(); } catch (e) {}
                joinRoom();
                retryJoin();
              }
            }, 6000);
          };
          retryJoin();
        }
        return;
      }
      // 进房即可上传牌组（但先等玩家名单）
      setHud('已进房' + (state.isHost ? '（房主）' : ''), 'ok');
      renderLobby();
      return;
    }
    if (msg instanceof YGO.YGOProStocHsPlayerEnter) {
      if (msg.name) { state.playerNames = state.playerNames || {}; state.playerNames[msg.pos] = msg.name; }
      renderLobby();
      return;
    }
    if (msg instanceof YGO.YGOProStocHsPlayerChange) {
      var pos = msg.playerPosition, st = msg.playerState;
      if (st === 9) state.ready[pos] = true; else if (st === 10 || st === 11 || st === 8) state.ready[pos] = false;
      renderLobby(); maybeStart();
      return;
    }
    if (msg instanceof YGO.YGOProStocChat) {
      logLine('[聊天] ' + msg.msg, 'rp-log-hint');
      // 自动登录的回执：服务端登录成功会发「登录成功！账号: X 显示名: Y 权限: Z」
      if (msg.msg && msg.msg.indexOf('登录成功') >= 0) {
        state.loggedInOk = true;
        setHud('已登录官网账号，本局计入天梯 ✓', 'ok');
      } else if (msg.msg && msg.msg.indexOf('密码错误') >= 0) {
        setHud('自动登录失败：密码错误（本局不计天梯）', 'err');
      }
      // 服务端按昵称重连"未完成的对局"（enableReconnect）。实测服务端会把你放回**原座位**并提示
      // "请选择你在本局决斗中使用的卡组并准备"，随后**重放整局消息**把盘面重建好再继续实时。
      // 所以恢复对局 = 同名重进 + 上传卡组 + 准备 —— 这里直接自动化掉，省得玩家以为"卡住了"。
      if (msg.msg && msg.msg.indexOf('未完成的对局') >= 0) {
        state.reconnecting = true;
        setHud('检测到未完成的对局 → 正在自动重新连接（上传卡组并准备）…', 'warn');
        logLine('↻ 服务端认为这个昵称上有未完成的对局：自动上传卡组并准备，把对局接回来', 'rp-log-phase');
        // 一定要发：刷新后本地的 ready 状态可能还是"已准备"，但服务端眼里你是新连上来的
        setTimeout(function () {
          logLine('↻ 发送 UPDATE_DECK + READY（重连握手）', 'rp-log-phase');
          uploadDeckAndReady();
        }, 600);
      }
      return;
    }
    if (msg instanceof YGO.YGOProStocErrorMsg) {
      var reason = { 1: 'JOINERROR', 2: 'DECKERROR', 3: 'SIDEERROR', 4: 'VERERROR' }[msg.msg] || msg.msg;
      var extra = '';
      if (msg.msg === 2 || msg.msg === 3) {
        var code = msg.code >>> 0;
        var R = { 1: '禁限卡表', 2: 'OCG 独有', 3: 'TCG 独有', 4: '未知卡', 5: '单卡数量', 6: '主卡组', 7: '额外卡组', 8: '副卡组', 9: '不允许' };
        extra = '（' + (R[code >>> 28] || '?') + ' 卡号 ' + (code & 0x0fffffff) + '）';
      }
      setHud('服务端错误 ' + reason + ' ' + extra, 'err');
      logLine('⚠ 服务端错误 ' + reason + ' code=' + msg.code + extra, 'rp-log-err');
      return;
    }
    if (msg instanceof YGO.YGOProStocSelectHand) {
      setUiPhase('duel');   // 猜拳开始 → 房间 UI 退场（这是对局流程的第一步，玩家要求此时就退场）
      setHud('请出拳');
      // 参照真实客户端：猜拳是三个**手势图**按钮（不是文字），这里用内联 SVG 画（不依赖任何素材）
      var handBtns = [
        { t: '石头', svg: GESTURE.rock, f: function () { send(new YGO.YGOProCtosHandResult().fromPartial({ res: 2 })); afterLobbyAnswer('已出拳'); } },
        { t: '剪刀', svg: GESTURE.scissors, f: function () { send(new YGO.YGOProCtosHandResult().fromPartial({ res: 1 })); afterLobbyAnswer('已出拳'); } },
        { t: '布', svg: GESTURE.paper, f: function () { send(new YGO.YGOProCtosHandResult().fromPartial({ res: 3 })); afterLobbyAnswer('已出拳'); } },
      ];
      showActions(handBtns, '猜拳：请出拳');
      return;
    }
    if (msg instanceof YGO.YGOProStocSelectTp) {
      setUiPhase('duel');   // 猜拳/先后攻一开始就让房间 UI 退场（原来等到 MSG_START 才退）
      setHud('请选择先后攻');
      // 顺序按玩家要求 & 真实客户端（截图里是先攻在上、后攻在下）：上=先攻，下=后攻
      showActions([{ t: '我先攻', f: function () { send(new YGO.YGOProCtosTpResult().fromPartial({ res: 1 })); afterLobbyAnswer('已选先攻'); } },
                   { t: '我后攻', f: function () { send(new YGO.YGOProCtosTpResult().fromPartial({ res: 0 })); afterLobbyAnswer('已选后攻'); } }],
                  '请选择先后攻', { vertical: true });
      return;
    }
    if (msg instanceof YGO.YGOProStocTimeLimit) {
      // 只有被点名的玩家回；交互模式下无脑回也无害（服务端按状态机忽略错的）
      send(new YGO.YGOProCtosTimeConfirm());
      return;
    }

    if (msg instanceof YGO.YGOProStocGameMsg) {
      var innerBytes = inner.subarray(1);
      var id = innerBytes[0];
      // 记录最近的报文号序列（排查"某个动作后服务端到底发了什么"用）
      state.recentIds = state.recentIds || [];
      state.recentIds.push(id);
      if (state.recentIds.length > 40) state.recentIds.shift();
      if (id === 4) onDuelStart(msg.msg);
      else if (id === 5) onDuelEnd(msg.msg);                 // MSG_WIN：回大厅
      if (YGO.isMapped(id)) {
        var env = YGO.toEnvelope(msg.msg, innerBytes);
        if (env) {
          // 把 Hint 的 desc 编号换成 strings.conf 里的真实文案（真实客户端就是这么显示的）
          if (env.name === 'Hint' && env.f && env.f.desc !== undefined) {
            var ht2 = sysText(env.f.desc);
            if (ht2) {
              env.f.hint = ht2;
              // 记下最后一条提示：ocgcore 会在弹选择之前先发一条提示（"请选择要加入手卡的卡"…），
              // 用它当选择提示条的标题，就和真实客户端一致了（服务端的 SELECT_* 本身不带文案）
              state.lastHint = ht2;
            }
          }
          // 「天变地异」：引擎在 reverse_deck 时发 MSG_REVERSE_DECK + 每个玩家一条 MSG_DECK_TOP（顶端卡号）
          if (env.name === 'ReverseDeck') { window.__ypDeckTop = null; logLine('卡组已翻转（天变地异等）—— 等顶端公开', 'rp-log-phase'); }
          if (env.name === 'DeckTop') {
            window.__ypDeckTop = window.__ypDeckTop || {};
            window.__ypDeckTop[env.f.player] = { code: env.f.code, faceDown: !!env.f.faceDown };
            logLine('卡组顶端公开：' + (env.f.faceDown ? '（里侧）' : cardLabel(env.f.code)) + '（座位 ' + env.f.player + '）', 'rp-log-hint');
          }
          flipEnvelope(env);
          // ?debug=1：把每条对局消息的短名与关键字段打出来（排查"重放没落到模型上"这类问题）
          if (state.debug) {
            var ff = env.f || {};
            var __rawBrief = undefined;
            if (ff.raw && ff.raw.length) {
              __rawBrief = ff.raw.slice(0, 6).map(function (c) {
                return (c.code || 0) + ':a' + (c.atk === undefined ? '?' : c.atk) + '/d' + (c.def === undefined ? '?' : c.def) +
                       '/L' + (c.level === undefined ? '?' : c.level) + '/t' + (c.type === undefined ? '?' : (c.type >>> 0).toString(16));
              });
            }
            logLine('[debug] #' + id + ' ' + env.name + ' ' + JSON.stringify({
              code: ff.code, player: ff.player, controller: ff.controller, location: ff.location, sequence: ff.sequence,
              previous: ff.previous, current: ff.current, count: ff.count, cards: ff.cards ? ('[' + ff.cards.length + ']') : undefined,
              raw: __rawBrief,
            }), 'rp-log-hint');
          }
          window.__live.push(env); window.__live.flush(); refreshPhaseLabel();
        }
      }
      // 交互请求单独处理（查看器对这些消息只记日志）
      if (msg.msg instanceof YGO.YGOProMsgResponseBase) onRequest(msg.msg, innerBytes);
      else if (id === 1) {
        state.retries = (state.retries || 0) + 1;
        var lr = state.lastResponse;
        logLine('⚠ 服务端拒绝了上一次选择（MSG_RETRY）：我发的是 ' +
          (lr ? (lr.name + ' / ' + lr.kind + ' / ' + lr.size + ' 字节 ' + lr.hex) : '(无记录)') +
          '；' + (state.lastRequest ? '已把选择面板恢复，请换个组合再试' : '请重新选择'), 'rp-log-err');
        // ⚠ 关键：服务端不一定重发这一问，所以本地要把**上一次的请求**恢复出来（否则玩家就"卡在选择页外"了）
        if (!state.pending && state.lastRequest) {
          state.pending = state.lastRequest;
          state.picked = [];
          renderPending();
          setHud('这个组合服务端不接受（合计/数量不满足），已剔除不满足条件的卡，请重新选择', 'warn');
        } else if (state.pending) {
          state.picked = [];
          renderPending();
        }
      }
      else if (id === 50) {                                  // MSG_MOVE：记录"哪张卡从手牌出场了"
        var mv = msg.msg;
        var fromPlain = mv.previous && mv.previous.location !== undefined ? (mv.previous.location & 0x7f) : -1;
        var toPlain = mv.current && mv.current.location !== undefined ? (mv.current.location & 0x7f) : -1;
        if (fromPlain === LOC.HAND && (toPlain === LOC.MZONE || toPlain === LOC.SZONE)) {
          state.lastFromHand = { code: mv.code, seq: mv.previous.sequence, to: toPlain };
        }
        if (fromPlain === LOC.DECK && toPlain === LOC.HAND) {
          state.lastSearch = { code: mv.code, to: 'HAND' };        // 卡组检索（黑旋风这类）成功
        }
      } else if (id === 60) state.lastSummoning = msg.msg.code;
      else if (id === 64 || id === 65) {                     // 翻转召唤：合成 POS_CHANGE 让查看器把卡翻过来
        // ⚠ 同样按**原始字节**解（库对象里 code/controller/location/sequence 都不存在 ✗）：
        //   MSG_FLIPSUMMONING：[0]=id [1..4]=code(le) [5]=controller [6]=location [7]=sequence [8]=position
        var h64 = env.hex || '';
        var fmCode = hexU32At(h64, 1);
        var fmCtl = hexU8At(h64, 5), fmLoc = hexU8At(h64, 6), fmSeq = hexU8At(h64, 7);
        var fm = msg.msg;                                   // 仅作兜底（缺字节时）
        if (id === 64 && (fmCode || (fm && typeof fm.code === 'number'))) {
          if (!fmCode && fm) { fmCode = fm.code; fmCtl = fm.controller || 0; fmLoc = fm.location === undefined ? LOC.MZONE : fm.location; fmSeq = fm.sequence || 0; }
          // 里侧守备(0x8) → 表侧攻击(0x1)：这就是"变更表示形式"在里侧怪上的表现
          state.lastPosChange = { code: fmCode, previous: 0x8, current: 0x1, controller: fmCtl, location: fmLoc, sequence: fmSeq, flipSummon: true };
          window.__live.push(synthPosChange(fmCode, fmCtl, fmLoc === undefined ? LOC.MZONE : fmLoc, fmSeq || 0, 0x8, 0x1));
          window.__live.flush();
          logLine('↕ ' + cardLabel(fmCode) + '：翻转召唤（里侧守备 → 表侧攻击，座位 ' + fmCtl + ' seq' + fmSeq + '）', 'rp-log-phase');
          animateZoneKey(fmCtl, fmLoc, fmSeq, 'flip');
        }
      }
      else if (id === 53) {                                  // MSG_POS_CHANGE：表示形式变更
        // ⚠ 必须按**原始字节**解，不能用库对象 msg.msg —— 库里这套字段并不存在（实测全是 undefined ✗），
        //   于是动画每次都退化成"我方怪兽区 seq0"= 最左边那只（玩家实测："动画依旧是最左边的怪兽播放"✗）。
        //   ocgcore 的布局：[0]=id [1..4]=code(le) [4字节] [5]=controller [6]=location [7]=sequence
        //                   [8]=previousPosition [9]=currentPosition
        // 用 env.hex（= flipEnvelope 已经按我的视角翻好的那份），与查看器取数完全一致 ✓
        var h53 = env.hex || '';
        var pcCode = hexU32At(h53, 1);
        var pcCtl = hexU8At(h53, 5), pcLoc = hexU8At(h53, 6), pcSeq = hexU8At(h53, 7);
        var pcPrev = hexU8At(h53, 8), pcCur = hexU8At(h53, 9);
        state.lastPosChange = { code: pcCode, previous: pcPrev, current: pcCur, controller: pcCtl, location: pcLoc, sequence: pcSeq };
        logLine('↕ ' + cardLabel(pcCode) + ' 表示形式变化：0x' + Number(pcPrev).toString(16) + ' → 0x' + Number(pcCur).toString(16) +
          '（座位 ' + pcCtl + ' / 区域 ' + pcLoc + ' / seq' + pcSeq + '）', 'rp-log-hint');
        // 守备位(0x4) → 变成守备就是"向左转"，否则"转回直立"（两个方向必须不同 ✗）
        animateZoneKey(pcCtl, pcLoc, pcSeq, (pcCur & 0x4) ? 'rot-def' : 'rot-atk');
      }
      else if (id === 40) {                                  // 新回合：提示是谁的回合
        var tp = msg.msg.player;                             // 绝对决斗位 → 翻到我的视角
        window.__myTurn = (flipSeat(tp) === 0);
        if (window.__myTurn) setHud('★ 你的回合', 'ok');
        else setHud('对手的回合，等待…');
      } else if (id === 3) setHud('等待对手操作…');            // MSG_WAITING
      return;
    }
  }

  function onDuelStart(m) {
    state.duelStarted = true;
    state.myDuelPos = m.playerNumber;
    setUiPhase('duel');    // 对局开始 → 展开盘面/日志（与猜拳阶段同一个入口，保证两边状态一致）
    // 记住这一局的座位与决斗位：刷新页面重连时，服务端**重放整局**但不一定再发 MSG_START，
    // 没有它客户端就不知道该把谁画在下方（flipSeat 会用错），所以持久化下来。
    try { localStorage.setItem('yp_duel_' + state.room, JSON.stringify({ seat: state.mySeat, duelPos: state.myDuelPos, name: state.name })); } catch (e) {}
    // ⚠ MSG_START 的 player0/player1 是**绝对决斗位**（参考客户端 game.cpp:LocalPlayer 印证：
    //   客户端自己按 isFirst 换位）。所以"我"的卡组数是 player[myDuelPos]，不是永远 player0
    //   —— 之前写死 player0 会让决斗位 1 的玩家（P2）看到自己的卡组数与对手对调。
    var myInfo = state.myDuelPos === 1 ? m.player1 : m.player0;
    var opInfo = state.myDuelPos === 1 ? m.player0 : m.player1;
    // 重连时服务端重放的 MSG_START 里卡组数是 0（实测）→ 别把已经显示的卡组数冲成 0：
    // 我方用自己的牌组长度兜底，对手沿用上一局的已知值。
    var myCount = (myInfo && myInfo.deckCount) || (state.deck && state.deck.main ? state.deck.main.length : 0) || (state.lastDeckCount && state.lastDeckCount[0]) || 0;
    var opCount = (opInfo && opInfo.deckCount) || (state.lastDeckCount && state.lastDeckCount[1]) || 0;
    state.lastDeckCount = [myCount, opCount];
    var me = { pos: 0, name: state.name, mainc: myCount };
    var opp = { pos: 1, name: (state.playerNames && state.playerNames[1 - state.mySeat]) || '对手', mainc: opCount };
    // 玩家视角下消息里的 0 = 自己 → 视角固定"我在下"
    // ⚠ 重连时服务端会把整局**重放**一遍，而 `MSG_START` 可能排在重放流的**后段** ——
    //   这时无条件 reset 会把"刚被重放重建好的场地"连同日志一起清空（玩家报的"重连回来场上卡没了"）。
    //   所以只在**盘面确实是空的时候**才 reset（全新一局）。
    var boardEmpty = true;
    try {
      if (window.__live && window.__live.cardsAt) {
        [1, 2, 4, 8, 16, 32, 64].forEach(function (loc) {
          [0, 1].forEach(function (ctl) { if ((window.__live.cardsAt(ctl, loc) || []).length) boardEmpty = false; });
        });
      }
    } catch (e) { boardEmpty = true; }
    if (boardEmpty) {
      window.__live.reset({ roomName: state.room, players: [me, opp] });
    } else {
      logLine('↻ 盘面已在重放中，跳过清场（重连恢复）', 'rp-log-phase');
    }
    if (window.__live.loadCards) window.__live.loadCards().catch(function () {});
    $('lobby').style.display = 'none';
    logLine('★ 对局开始：我在下方（决斗位 ' + state.myDuelPos + '）'
      + (state.myDuelPos === 1 ? '，已把服务端的绝对座位号翻到我的视角' : ''), 'rp-log-phase');
    // 阶段框要等查看器把场地 DOM 建好再摆
    setTimeout(function () { layoutOverlays(); syncCtl(); }, 120);
  }

  // ─────────────────────────────── 大厅渲染 / 开始

  /**
   * 决斗准备面板（照真实客户端版式）：
   *   左 = 决斗者名单（带 ✕ 踢人）+「→ 观战」「准备」+ 卡组选择（服务器 deck 目录）
   *   右 = 房间规则（由房间名前缀 + 服务端默认推导：禁限卡表 / 卡片允许 / 决斗模式 / 基本分 / 手卡 / 抽卡 / 是否检查卡组）
   * 房间名前缀规则见 spikes/live-field/README.md 第 42 条（NC#=跳过检查、NF#=无禁限、DIY#、LF<n>#…）。
   */
  var roomPrefixModes = null;
  function parseRoomPrefix() {
    var name = String(state.room || '');
    var m = name.match(/^(.+)#/);
    var p = m ? m[1].toUpperCase() : '';
    var out = { prefix: p, noCheck: false, noLflist: false, custom: false, lflistN: null, label: '' };
    if (/\bNOCHECK\b|^NC$/.test(p)) { out.noCheck = true; out.label = '跳过卡组检查'; }
    if (/\bNOLFLIST\b|^NF$/.test(p)) { out.noLflist = true; out.label = (out.label ? out.label + ' · ' : '') + '无禁限'; }
    if (/\bCUSTOM\b|^DIY$/.test(p)) { out.custom = true; out.label = (out.label ? out.label + ' · ' : '') + '自定义卡允许'; }
    var lf = p.match(/^(?:LFLIST|LF)(\d+)$/);
    if (lf) { out.lflistN = Number(lf[1]); out.label = (out.label ? out.label + ' · ' : '') + ('卡表 LF' + out.lflistN); }
    return out;
  }
  function renderRoomRules() {
    var box = $('roomRules');
    if (!box) return;
    var r = parseRoomPrefix();
    var rows = [
      ['禁限卡表', r.noLflist ? 'N/A（无禁限）' : (r.lflistN ? ('第 ' + r.lflistN + ' 张表') : '服务器默认（2026.10）')],
      ['卡片允许', r.custom ? '自定义 / DIY 也允许' : (r.noCheck ? '所有卡片' : '按卡库与规则')],
      ['决斗模式', '单局模式'],
      ['', '============'],
      ['初始基本分', '8000'],
      ['初始手卡数', '5'],
      ['每回合抽卡', '1'],
      ['', r.noCheck ? '*不检查卡组' : (r.noLflist ? '*无禁限（仍检查卡组结构）' : '*按服务器规则检查卡组')],
    ];
    box.innerHTML = '';
    rows.forEach(function (kv) {
      var d = document.createElement('div');
      if (!kv[0]) { d.innerHTML = '<span class="ok">' + kv[1] + '</span>'; }
      else { d.innerHTML = '<span class="k">' + kv[0] + '：</span>' + kv[1]; }
      box.appendChild(d);
    });
    if (r.label) {
      var t = document.createElement('div');
      t.innerHTML = '<span class="ok">房间名规则：' + r.label + '</span>';
      box.appendChild(t);
    }
  }
  /**
   * 账号名：接入官网后由官网会话给出（`window._duelUser.name`，或站点的 /api/duel/whoami）。
   * 本地联调没有会话时才退回手输昵称 —— 天梯里名字必须来自账号，不能自己乱填。
   */
  /**
   * 同一房间**固定用同一个昵称**。
   *
   * 为什么必须这样：srvpro2 的断线重连是**按昵称认人**（席位保留约 3 分钟）。
   * 若重进同一房间换了昵称，旧昵称的座位仍然挂着 → 房间里就出现"另一个我卡在里面" ✗（玩家实测）。
   * 用同一昵称重进 = 服务端把你**接回原座位** ✓，不会产生分身 ✓。
   *
   * 取值顺序：账号名（接入官网后天然稳定 ✓）> 本房间上次用过的昵称 > 随机新名（并记下来）。
   */
  function nameForRoom(room) {
    var k = 'yp_name_' + (room || '');
    var saved = null;
    try { saved = localStorage.getItem(k); } catch (e) {}
    var acc = accountName();
    var n = acc || saved || ('玩家' + Math.floor(Math.random() * 9000 + 1000));
    try { localStorage.setItem(k, n); } catch (e) {}
    if (saved && acc && saved !== acc) {
      logLine('提示：这个房间上次用的昵称是「' + saved + '」，本次按账号名「' + acc + '」进。' +
        '若房间里出现同名旧席位（断线保留约 3 分钟），用旧昵称重进可接回它。', 'rp-log-hint');
    }
    return n;
  }

  function accountName() {
    try {
      if (window._duelUser && window._duelUser.name) return String(window._duelUser.name);
      if (window._communityUsername) return String(window._communityUsername);
    } catch (e) {}
    return '';
  }
  /** 天梯房间名：固定前缀 `M#`（srvpro2 里 `M#` → mode=1 匹配模式），后面的号由服务端分配。
   *  `?room=` 仅本地联调用；正常玩家看不到房间号输入。 */
  /** 当前卡组名（导入 .ydk / ?ydk= 后显示在天梯面板上） */
  function showDeckName() {
    var el = $('deckName');
    if (!el) return;
    var n = state.deckName || (state.deck ? ('已载入（主 ' + state.deck.main.length + ' / 额外 ' + (state.deck.extra || []).length + '）') : '未选择');
    el.textContent = n;
  }

  function ladderRoom() {
    var q = null;
    try { q = new URLSearchParams(location.search); } catch (e) {}
    var forced = q && q.get('room');
    return forced || 'M#';
  }

  function renderRoomPlayers() {
    var box = $('roomPlayers');
    if (!box) return;
    box.innerHTML = '';
    var names = state.playerNames || {};              // ⚠ 没进房时这里是 undefined：绝不能直接用（否则抛异常）
    var readyMap = state.ready || {};
    [0, 1].forEach(function (seat) {
      var row = document.createElement('div');
      row.className = 'yp-player-row';
      // 不提供踢人（天梯是系统配对的，玩家不该有踢人权 —— 玩家要求去掉）
      var nm = document.createElement('div');
      nm.className = 'nm' + (state.mySeat === seat ? ' me' : '');
      nm.textContent = names[seat] || (seat === state.mySeat ? (accountName() || '（我）') : '（空）');
      var st = document.createElement('div');
      st.className = 'st';
      st.textContent = readyMap[seat] ? 'READY' : '';
      row.appendChild(nm); row.appendChild(st);
      box.appendChild(row);
    });
  }
  /** 卡组选择下拉：列出服务器 deck 目录里的 .ydk；选中即载入 */
  function loadDeckList() {
    var sel = $('deckList');
    if (!sel || sel._loaded) return;
    sel._loaded = true;
    fetch('/api/decks').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.names) return;
      sel.innerHTML = '';
      var o0 = document.createElement('option');
      o0.value = ''; o0.textContent = '（内置默认卡组）';
      sel.appendChild(o0);
      j.names.forEach(function (n) {
        var o = document.createElement('option');
        o.value = n; o.textContent = n.replace(/\.ydk$/i, '');
        sel.appendChild(o);
      });
      logLine('卡组目录：' + j.names.length + ' 个（' + j.dir + '）', 'rp-log-hint');
    }).catch(function () {});
  }
  function pickDeckFromServer(name) {
    if (!name) return;
    fetch('/api/deck?name=' + encodeURIComponent(name)).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.main) { logLine('读取卡组失败：' + (j && j.error ? j.error : '未知'), 'rp-log-err'); return; }
      state.deck = { main: j.main, extra: j.extra || [], side: j.side || [] };
      state.readySent = false;
      logLine('已载入卡组 ' + j.name + '（主 ' + j.main.length + ' / 额外 ' + (j.extra || []).length + ' / 副 ' + (j.side || []).length + '）', 'rp-log-ok');
      setHud('已选择卡组：' + j.name + '（主 ' + j.main.length + ' 张）→ 点「准备」', 'ok');
    }).catch(function (e) { logLine('读取卡组异常：' + e.message, 'rp-log-err'); });
  }

  /**
   * 房间 UI ↔ 对局 UI 的切换（带转场动画）。
   *   房间里（含猜拳/先后攻阶段）→ 只显示「决斗准备」面板；
   *   对局中（MSG_START 之后）→ 只显示盘面 + 日志。
   * ⚠ 之前这两块各自被不同地方 toggle（renderLobby / onDuelStart 互相打架），
   *   出现"猜拳时房间 UI 没退场""进对局后看不见盘面"（实测被反馈）。现在**只有一个入口**。
   */
  function setUiPhase(phase) {
    var lobby = $('lobby'), modal = $('replayModal');
    if (!lobby || !modal) return;
    if (state.uiPhase === phase) return;
    var first = !state.uiPhase;
    state.uiPhase = phase;
    var showEl = phase === 'duel' ? modal : lobby;
    var hideEl = phase === 'duel' ? lobby : modal;
    // 转场：旧的淡出并上移，新的淡入；首帧（刚打开页面）不做动画，避免闪一下
    hideEl.classList.remove('yp-fade-in');
    if (!first) hideEl.classList.add('yp-fade-out');
    setTimeout(function () {
      hideEl.style.display = 'none';
      hideEl.classList.remove('yp-fade-out');
    }, first ? 0 : 240);
    showEl.style.display = '';
    showEl.classList.remove('yp-fade-out');
    if (!first) {
      showEl.classList.remove('yp-fade-in');
      void showEl.offsetWidth;                       // 重启动画
      showEl.classList.add('yp-fade-in');
      setTimeout(function () { showEl.classList.remove('yp-fade-in'); }, 360);
    }
    logLine(phase === 'duel' ? '▸ 进入对局界面（房间界面退场）' : '◂ 回到房间界面', 'rp-log-phase');
  }

  function renderLobby() {
    // 盘面/日志的显隐统一交给 setUiPhase()（这里不再各自 toggle，避免两边打架）
    if (state.duelStarted) return;          // 对局开始后别再被大厅提示覆盖顶栏
    var names = state.playerNames || {};
    var inRoom = Object.keys(names).sort();
    $('lobbyInfo').textContent = inRoom.length
      ? ('座位：' + inRoom.map(function (p) { return p + ' ' + names[p] + (state.ready[p] ? '(已准备)' : ''); }).join(' / '))
      : '（房里只有你，等对手进来）';
    $('btnReady').style.display = state.mySeat >= 0 && state.mySeat !== 7 ? '' : 'none';
    renderRoomPlayers();     // 决斗者名单（带 ✕ 踢人）+ 准备状态
    renderRoomRules();       // 右侧房间规则（由房间名前缀 + 服务端默认推导）
    showDeckName();          // 当前卡组名（导入 .ydk 后显示）
    $('btnStart').style.display = state.isHost ? '' : 'none';
    var bothReady = !!(state.ready[0] && state.ready[1]);
    // 不禁用「开始决斗」：禁用按钮点了毫无反应，玩家会以为界面坏了（实测被反馈）。
    // 保持可点，点下去由 onclick 告诉你"差什么"（你还没准备 / 对手还没准备）。
    $('btnStart').disabled = false;
    $('btnStart').title = bothReady ? '开始决斗'
      : ('还不能开始：' + ((state.mySeat >= 0 && state.ready[state.mySeat]) ? '对手还没准备' : '你还没点「准备」'));
    // 把"卡在哪一步"直接写在顶栏，省得盯着屏幕猜
    if (state.mySeat === 7) setHud('房间满了（你是观战者）：用原昵称可接回自己那一席，或换个房间名开新局', 'warn');
    else if (state.mySeat < 0) return;
    else if (inRoom.length < 2) {
      if (state.isHost) setHud('房里现在只有你一人（对手进程还没进来）。对手要跑：node duel.mjs --solo --room ' + state.room, 'warn');
      else setHud('等对手进来…', 'warn');
    } else if (!state.ready[state.mySeat]) setHud('点「准备」上传卡组并准备', 'warn');
    else if (!bothReady) setHud('你已准备，等对手准备…');
    else if (state.isHost) setHud('★ 双方已准备 → 点「开始决斗」', 'ok');
    else setHud('双方已准备，等房主开始…', 'ok');
  }
  function maybeStart() {
    if (!state.isHost) return;
    if (state.ready[0] && state.ready[1] && !state.startedSent) {
      state.startedSent = true;
      logLine('双方已准备 → 发 HS_START');
      send(new YGO.YGOProCtosHsStart());
    }
  }

  // ─────────────────────────────── 交互层

  function clearPending() { state.pending = null; state.armed = null; state.picked = []; state.lastPick = null; hideCardMenu(); hideChooser(); hideTopBar(); clearHighlights(); showActions([]); syncCtl(); setHud(''); }

  /** 记住"玩家刚选了什么"（召唤/特召/发动哪张卡）—— 下一次选素材时用它给提示标题点名，
   *  玩家就能看出"这是黑翼强袭龙的（除外同调调整＋黑翼龙）那种特召" */
  function rememberPick(label, info) {
    state.lastPick = { label: label, code: (info && info.code) || 0 };
  }
  /** 猜拳/先后攻这类"局外应答"：发完就把按钮收掉，免得重复点 */
  function afterLobbyAnswer(text) { showActions([]); setHud(text, 'ok'); }
  function clearHighlights() {
    Array.prototype.forEach.call(document.querySelectorAll('.yp-pick, .yp-picked, .yp-act, .yp-act-multi'), function (el) {
      el.classList.remove('yp-pick'); el.classList.remove('yp-picked');
      el.classList.remove('yp-act'); el.classList.remove('yp-act-multi');
    });
    // 额外牌堆上的角标跟着清掉（否则换个请求还会留着上一次的数字）
    var pile = document.querySelector('[data-pile="extra:0"]');
    if (pile) {
      var b = pile.querySelector('.yp-pile-badge');
      if (b && b.parentNode) b.parentNode.removeChild(b);
    }
  }

  /** 请求 → 面板。已实现的：idle/battle cmd、chain、card、tribute、unselect、place、position、yesno/effectyn、option、announce*、counter */
  function onRequest(m, raw) {
    var id = m.identifier;
    // 服务端会在这条请求**之前**发一条 MSG_HINT（文案），这里把它固化成这次请求的标题
    var hintTitle = state.lastHint || '';
    state.lastHint = '';
    var P = { msg: m, raw: raw, hintTitle: hintTitle };   // raw = 原始包体（?debug=1 时打印）
    if (m instanceof YGO.YGOProMsgSelectIdleCmd) P.kind = 'idle';
    else if (m instanceof YGO.YGOProMsgSelectBattleCmd) P.kind = 'battle';
    else if (id === 16) P.kind = 'chain';
    else if (m instanceof YGO.YGOProMsgSelectCard) P.kind = 'card';
    else if (m instanceof YGO.YGOProMsgSelectTribute) P.kind = 'tribute';
    else if (m instanceof YGO.YGOProMsgSelectUnselectCard) P.kind = 'unselect';
    else if (m instanceof YGO.YGOProMsgSelectPlaceCommon) P.kind = 'place';
    else if (m instanceof YGO.YGOProMsgSelectPosition) P.kind = 'position';
    else if (id === 12 || id === 13) P.kind = 'yesno';
    else if (id === 14) P.kind = 'option';
    else if (id >= 140 && id <= 143) P.kind = 'announce';
    else if (id === 22) P.kind = 'counter';
    else if (id === 23) P.kind = 'sum';
    else if (id === 25 || id === 21) P.kind = 'sort';
    else P.kind = 'unknown';
    state.pending = P;
    state.lastRequest = P;         // RETRY 时用它把选择面板恢复出来（服务端不一定重发这一问）
    state.picked = [];
    // 每个交互请求都记一行：这样"没给我选项"这类问题时，一眼能看出是**没收到请求**还是**收到了没渲染**
    var brief = '';
    if (typeof m.min === 'number') brief += ' min=' + m.min + ' max=' + m.max;
    if (typeof m.count === 'number') brief += ' count=' + m.count;
    if (m.cards) brief += ' 候选=' + m.cards.length;
    if (m.chains) brief += ' 连锁项=' + m.chains.length;
    if (m.options) brief += ' 选项=[' + m.options.join(',') + ']';
    if (m.sumVal !== undefined) brief += ' 目标合计=' + m.sumVal;
    if (m.positions !== undefined) brief += ' positions=0x' + Number(m.positions).toString(16);
    logLine('◀ 请求 ' + m.constructor.name.replace(/^YGOProMsg/, '') + '（' + P.kind + '）' + brief, 'rp-log-hint');
    renderPending();
  }

  function renderPending() {
    var P = state.pending;
    if (!P) return;
    var m = P.msg;
    clearHighlights();
    showActions([]);
    switch (P.kind) {
      case 'idle': {
        var orphanIdle = buildCardActions(P);
        var extraHint = (P.extraActs && P.extraActs.length)
          ? ('；额外卡组有 ' + P.extraActs.length + ' 只可特召 → 点左边的「额外」牌堆')
          : '';
        setHud((P.acts && P.acts.size
          ? '主要阶段：点你要用的卡 → 弹出操作（召唤/盖放/发动…）'
          : '主要阶段：没有可操作的卡，直接进战阶或结束回合') + extraHint);
        // 阶段级按钮挂到场地中线上：中=进战阶，右=结束回合；洗牌这类工具按钮放左侧
        P.ctl = {
          mid: m.canBp ? { t: '进战阶', f: function () { respond(m.prepareResponse(6)); } } : null,
          right: { t: '结束回合', f: function () { respond(m.prepareResponse(7)); } },
          utils: m.canShuffle ? [{ t: '切洗手牌', f: function () { respond(m.prepareResponse(8)); } }] : null,
        };
        syncCtl();
        // ⚠ "没有格位"的操作（墓地/除外的效果、额外卡组的特召）**不再丢到画面中央的"其它操作"** ——
        //   玩家明确要求：墓地的效果应该是"墓地发光 → 点墓地 → 发动效果/查看列表"。
        //   这里把它们收进 P.orphanActs，交给 markPilesForPending() 挂到对应牌堆上（否则会彻底点不到）。
        P.orphanActs = [];
        var btns = [];       // ⚠ 这行曾被误删 → 有"无格位操作"时 btns.push 抛 ReferenceError，
                             //   整个主要阶段渲染中断（进战阶/结束回合都出不来）。回归套件抓到的。
        orphanIdle.forEach(function (a) {
          var pile = pileKeyOf({ info: a.info });
          if (pile) { P.orphanActs.push(a); return; }           // 归到牌堆菜单里
          btns.push({ t: a.label, f: function () { respondIndexed(m, a.type, a.index); } });
        });
        markPilesForPending();          // 墓地/除外里有可发动的效果 → 牌堆发光（点击弹"发动效果/查看列表"）
        showActions(btns, btns.length ? '其它操作' : '');
        break;
      }
      case 'battle': {
        var orphanBattle = buildCardActions(P);
        var extraHintB = (P.extraActs && P.extraActs.length)
          ? ('；额外卡组有 ' + P.extraActs.length + ' 只可特召 → 点左边的「额外」牌堆')
          : '';
        setHud((P.acts && P.acts.size ? '战斗阶段：点要攻击的怪兽 → 弹出操作' : '战斗阶段：请选择操作') + extraHintB);
        // 战阶中，中间按钮变成"进主要阶段2"
        P.ctl = {
          mid: m.canM2 ? { t: 'M2', title: '进入主要阶段2', f: function () { respond(m.prepareResponse(2)); } } : null,
          right: { t: '结束回合', f: function () { respond(m.prepareResponse(3)); } },
          utils: null,
        };
        syncCtl();
        P.orphanActs = [];
        var b = [];
        orphanBattle.forEach(function (a) {
          var pile = pileKeyOf({ info: a.info });
          if (pile) { P.orphanActs.push(a); return; }    // 墓地的效果同样走牌堆菜单
          b.push({ t: a.label, f: function () { respondIndexed(m, a.type, a.index); } });
        });
        markPilesForPending();
        showActions(b, b.length ? '其它操作' : '');
        break;
      }
      case 'chain': {
        // 优先用"按真实布局自己解"的结果（含关键的**消息级 forced**）；长度不符才退回库的解码
        var dec = decodeChainsRaw(state.pending.raw);
        var chains = dec ? dec.chains : (m.chains || []);
        // ⚠ 只有在**自己按真实布局解成功**时才敢信 forced ✓；
        //   自解失败退回库解码时，库那份**没有 forced 字段**，连锁项里的同名标记含义不同 ✗
        //   —— 之前用它去猜，结果把"可选发动"误判成"必须"，连「不连锁」按钮都被藏了
        //   （玩家实测："这张卡有什么不能放弃的吗？又不是必发效果"）。
        //   所以：自解失败时一律**给出「不连锁」**，真被服务端拒还有 RETRY 兜底 ✓。
        var forced = dec ? !!dec.forced : false;
        if (!dec && (m.chains || []).length) {
          logLine('（连锁请求的报文长度与预期布局不符，退回按库解码：长度 ' +
            ((state.pending.raw || []).length) + '，库 count=' + m.count + '）', 'rp-log-hint');
        }
        // ?debug=1 时把连锁请求的原始字节和库解出来的字段都打出来 —— 用来核对
        // "服务端到底有没有消息级 forced 字节"（库与引擎的布局版本可能不一致，靠猜容易错）
        if (state.debug) {
          var rawSrc = (state.pending && state.pending.raw) || [];
          var rawHex = '';
          for (var ri = 0; ri < Math.min(rawSrc.length || 0, 48); ri++) rawHex += rawSrc[ri].toString(16).padStart(2, '0');
          logLine('[debug] SelectChain len=' + (rawSrc.length || 0) + ' raw=' + rawHex +
            ' 自解=' + (dec ? ('count=' + dec.count + ' forced=' + dec.forced + ' chains=' + JSON.stringify(dec.chains)) : '布局不符(退回库解码)') +
            ' 库解count=' + m.count, 'rp-log-hint');
        }
        // 没有可连锁项且不强制 → 自动跳过连锁，不弹窗
        if (!chains.length && !forced) {
          logLine('（没有可连锁的效果 → 自动不连锁）', 'rp-log-hint');
          respond(m.prepareResponse(null));
          return;
        }
        if (!chains.length && forced) {
          logLine('⚠ 服务端要求"必须连锁"却没给候选（异常），先按不连锁发一次', 'rp-log-err');
          respond(m.prepareResponse(null));
          return;
        }
        setHud('连锁时点：' + chains.length + ' 个可连锁项（点卡图发动，或选「不连锁」）');
        // 用**卡图**而不是文字：每项就是那张卡的正脸，强制发动的加"强制"角标
        var cb = chains.map(function (c, i) {
          return {
            t: cardLabel(c.code), img: c.code, sub: c.forced ? '强制' : '',
            // 连锁项的 desc 也是 strings.conf 编号：作为按钮说明显示（如"诱发类效果"）
            tip: sysText(c.desc) ? fillDesc(sysText(c.desc), [zoneText(c.location, c.sequence), cardLabel(c.code)]) : '',
            f: (function (idx) { return function () { respond(m.prepareResponse(YGO.IndexResponse(idx))); }; })(i),
          };
        });
        // ⚠ `forced` 的引擎语义（playerop.cpp:325）是"**不能取消**（不能回 -1）"，不是"必须发动某张卡"：
        //    所以措辞写成"本次不能放弃"，避免玩家误以为系统在强迫他发动效果。
        // ⚠ 永远给出「不连锁」：forced 这个字节我这边**两次都判断错**（自解布局对不上/读到的不是那一位 ✗），
        //   宁可让玩家能放弃；真遇到引擎强制的场合，服务端会 RETRY，我的恢复逻辑会把面板重新弹出来并提示 ✓
        //   （玩家两次反馈："这张卡有什么不能放弃的吗？又不是必发效果" / "怎么又不能放弃了"）。
        cb.push({ t: '不连锁', f: function () { respond(m.prepareResponse(null)); } });
        showActions(cb, '请选择要发动的效果 / 或选「不连锁」' + (forced ? '（服务端提示：这一问可能需要给出连锁）' : ''));
        break;
      }
      case 'card': case 'tribute': case 'sum': {
        // 提示走场地顶部的细条（不挡场地），中央面板只留"确定/取消"这类真需要点的。
        // 标题带上"是谁的效果"（玩家反馈：用黑翼强袭龙的效果特召时，没标注是哪种召唤方式）。
        var head = takeHint('请选择卡');
        var who = state.lastPick && state.lastPick.code ? (cardLabel(state.lastPick.code) + '：') : '';
        var selText = who + head + '（' + m.min + '–' + m.max + '）' + (m.cancelable ? '（可取消）' : '');
        showTopBar(selText + '　已选 ' + state.picked.length);
        setHud(selText);
        if (P.kind === 'sum') { highlightSumCandidates(P, m); filterSumCands(P); }
        else highlightCandidates(P, m.cards || []);
        if (P.kind === 'sum') state.sumText = sumProgressText(P);   // "合计 X / 目标 Y"
        // 候选都在哪些区域（日志里写清楚，便于玩家反馈"素材没进选项"这类问题）
        var wheres = {};
        (P.cands || []).forEach(function (cd) { wheres[candWhere(cd.info)] = (wheres[candWhere(cd.info)] || 0) + 1; });
        if (P.kind === 'sum') logLine('   opParam=[' + (P.cands || []).map(function (cd) { return (cd.info.opParam === undefined ? '?' : cd.info.opParam); }).join(',') + ']', 'rp-log-hint');
        logLine('   候选分布：' + (Object.keys(wheres).map(function (k) { return k + '×' + wheres[k]; }).join('、') || '无')
          + ((P.cands || []).some(function (cd) { return cd.fixed; }) ? '（含引擎固定的卡）' : ''), 'rp-log-hint');
        // 候选在卡组/墓地/除外（没有格位）→ 用居中卡图选择盘接管（黑旋风这类"从卡组加手牌"）
        var usedChooser = showNoCellChooser(P);
        var okMin = (typeof m.min === 'number') ? m.min : 0;
        var ok = {
          t: state.picked.length < okMin ? ('确定（还需选 ' + (okMin - state.picked.length) + ' 张）') : ('确定(' + state.picked.length + ')'),
          disabled: state.picked.length < okMin, key: 'ok',
          f: function () { submitMulti(P); },
        };
        var b2 = [];
        // ⚠ 选择盘自己也带「确定/取消」，别再在提示面板渲染一份：两个居中的层会叠在一起，
        //   真实鼠标会点在**上面那个**，于是"点了确定却没反应"（实测踩过）。
        if (!usedChooser) {
          b2.push(ok);
          if (m.cancelable) b2.push({ t: '取消', f: function () { respond(m.prepareResponse(null)); } });
        }
        showActions(b2, usedChooser ? '在上面的卡图盘里点卡选择，然后按盘里的「确定」' : selText);
        break;
      }
      case 'unselect': {
        var uhead = takeHint('请选择卡');
        showTopBar(uhead + '（' + m.min + '–' + m.max + '，点一下提交一张）' + (m.finishable ? '（可结束选择）' : ''));
        setHud(uhead + '：点一下提交一张' + (m.finishable ? '（可结束）' : ''));
        highlightCandidates(P, (m.selectableCards || []).concat(m.unselectableCards || []));
        showNoCellChooser(P);      // 墓地的卡也没有格位 → 走选择盘（点一下即提交）
        var b3 = [];
        if (m.finishable || m.cancelable) b3.push({ t: '结束选择', f: function () { respond(m.prepareResponse(null)); } });
        showActions(b3, '逐张选择（点卡提交）');
        break;
      }
      case 'place': {
        showTopBar(takeHint('请选择位置') + '　已选 ' + state.picked.length + '/' + m.count);
        setHud('请点击高亮的格子放置（' + state.picked.length + '/' + m.count + '）');
        var places = m.getSelectablePlaces ? m.getSelectablePlaces() : [];
        highlightPlaces(P, places);
        if (places.length === 1 && m.count <= 1) setTimeout(function () { respond(m.prepareResponse([places[0]])); }, 60);
        else showActions([{ t: '已选 ' + state.picked.length + '/' + m.count + '（点高亮格子）', f: function () {} }],
                         '请选择要放置的位置');
        break;
      }
      case 'position': {
        setHud('请选择表示形式（攻击＝正放，守备＝横放）');
        var pb = [];
        var pc = m.code || 0;
        // 参照真实客户端：用**卡图**表达，守备画成横置；里侧用卡背
        if (m.positions & 0x1) pb.push({ t: cardLabel(pc) + '·攻击', img: pc, f: function () { respond(m.prepareResponse(0x1)); } });
        if (m.positions & 0x2) pb.push({ t: '里侧·攻击', img: pc, faceDown: true, f: function () { respond(m.prepareResponse(0x2)); } });
        if (m.positions & 0x4) pb.push({ t: cardLabel(pc) + '·守备', img: pc, rotate: true, f: function () { respond(m.prepareResponse(0x4)); } });
        if (m.positions & 0x8) pb.push({ t: '里侧·守备', img: pc, faceDown: true, rotate: true, f: function () { respond(m.prepareResponse(0x8)); } });
        showActions(pb, '请选择表示形式');
        break;
      }
      case 'yesno': {
        // 是/否（含"是否发动效果"）——用服务端 desc 在 strings.conf 里的**原句**（真实客户端就是这样），
        // 里面的 %ls 用它自己带的卡号/区域补上，例如
        //   "是否在[魔法与陷阱区域]发动[黑旋风]的诱发类效果？"
        var yc = m.code || 0;
        var rawText = sysText(m.desc);
        var sentence = rawText ? fillDesc(rawText, [zoneText(m.location, m.sequence), cardLabel(yc)]) : '';
        if (!sentence) sentence = yc ? ('是否发动 ' + cardLabel(yc) + ' ？') : '是否发动 / 适用？';
        var yesBtn = yc
          ? { t: '发动 / 是', img: yc, f: function () { respond(m.prepareResponse(true)); } }
          : { t: '是', f: function () { respond(m.prepareResponse(true)); } };
        setHud(sentence);
        showActions([yesBtn, { t: '不发动 / 否', f: function () { respond(m.prepareResponse(false)); } }], sentence);
        break;
      }
      case 'option': {
        // MSG_SELECT_OPTION：应答是 **int32 的选项下标**（引擎校验 0 <= i < size，playerop.cpp: select_option）。
        // ⚠ 必须用 IndexResponse(i)：库的 prepareResponse 收到**数字**时会去 options.indexOf(数字)（当成"选项值"找），
        //   找不到就抛异常 → 点了没反应（实测踩过）。
        // 选项值本身是**任意 32 位整数**：多数是卡号（如"选一只怪"），也可能是 strings.conf 的文案编号。
        // 所以标签要依次尝试：卡名 → strings.conf 文案 → 退化成"选项 N"，**不能出现空按钮**。
        var opts = m.options || [];
        setHud('请选择要适用的效果（' + opts.length + ' 个）');
        showTopBar('请选择要适用的效果（' + opts.length + ' 个）');
        showActions(opts.map(function (v, i) {
          var meta = state.cardsById && state.cardsById[v];
          var txt = sysText(v);
          var label, img = 0;
          if (meta) { label = meta.name || ('#' + v); img = v; }          // 卡号 → 卡图 + 卡名
          else if (txt) label = txt;                                       // strings.conf 文案（如"送去墓地"）
          else label = '选项 ' + (i + 1) + '（#' + v + '）';
          return {
            t: label, img: img || undefined, sub: opts.length > 1 ? ('#' + v) : '',
            tip: txt && meta ? txt : '',
            f: (function (idx) { return function () { respond(m.prepareResponse(YGO.IndexResponse(idx))); }; })(i),
          };
        }), '请选择要适用的效果');
        break;
      }
      case 'announce': {
        setHud('请宣言');
        var ab = [];
        if (m.identifier === 141) {           // 属性：7 位 —— 用 strings.conf 的真实名字（暗/光/地…）
          for (var i = 0; i < 7; i++) if (m.availableAttributes & (1 << i)) ab.push({ t: (attrName(1 << i) || ('属性' + (i + 1))), f: (function (b) { return function () { respond(m.prepareResponse(b)); }; })(1 << i) });
        } else if (m.identifier === 140) {    // 种族：25 位 —— 同样用真实名字（龙/战士/魔法师…）
          for (var j = 0; j < 25; j++) if (m.availableRaces & (1 << j)) ab.push({ t: (raceName(1 << j) || ('种族' + (j + 1))), f: (function (b) { return function () { respond(m.prepareResponse(b)); }; })(1 << j) });
        } else if (m.identifier === 143) {    // 数字：提交下标
          ab = (m.numbers || []).map(function (n, k) { return { t: '数字 ' + n, f: (function (idx) { return function () { respond(m.prepareResponse(idx)); }; })(k) }; });
        } else if (m.identifier === 142) {    // 卡名宣言（如「禁止令」）
          var inp = '';
          try { inp = prompt('宣言卡名（输入卡号；留空＝宣言一个不存在的名字）', '') || ''; } catch (e) { inp = ''; }
          var code = inp ? Number(inp) : 0;
          // ⚠ prompt 被浏览器拦截或玩家取消时**必须照样应答**，否则对局就永远卡在这一问
          if (!code) logLine('（没输入卡号 → 按"宣言一个不存在的名字"继续，避免卡死）', 'rp-log-hint');
          respond(m.prepareResponse(code));
          return;
        }
        showActions(ab.slice(0, 40), '请宣言');
        break;
      }
      case 'sort': {
        setHud('排序：保持默认顺序即可（也可逐个上移）');
        var idxs = (m.cards || []).map(function (_, i) { return i; });
        showActions([{ t: '保持默认顺序', f: function () {
          // 位置 i 放原序号 i（identity 排列）
          respond(m.prepareResponse(idxs.map(function (i) { return YGO.IndexResponse(i); })));
        } }], '请为卡组排序');
        break;
      }
      case 'counter': {
        setHud('指示物：全部不选（0）');
        showActions([{ t: '确定（移除 0）', f: function () {
          respond(m.prepareResponse((m.cards || []).map(function (_, i) { return { card: YGO.IndexResponse(i), count: 0 }; })));
        } }], '请选择要移除的指示物');
        break;
      }
      default: {
        // 未实现的交互请求：**绝不能只挂个按钮等着** —— 玩家没注意 = 对局永久卡死
        // （怪裁定牌组很容易踩到冷门请求）。策略：先算一个"最无害的合法应答"，
        // 立即给出按钮，同时在 4 秒后**自动兜底提交**并大声记日志。
        var name2 = (m && m.constructor && m.constructor.name) || ('id' + (m && m.identifier));
        setHud('未实现的交互：' + name2 + ' —— 4 秒后自动用最无害的应答继续', 'warn');
        logLine('⚠ 未实现的交互请求 ' + name2 + '（id=' + (m && m.identifier) + '）：4 秒后自动兜底，避免卡死', 'rp-log-err');
        var cand = null;
        try { cand = m.defaultResponse ? m.defaultResponse() : null; } catch (e) { cand = null; }
        if (!cand) { try { cand = m.prepareResponse(null); } catch (e2) { cand = null; } }
        if (!cand) { try { cand = m.prepareResponse(YGO.IndexResponse(0)); } catch (e3) { cand = null; } }
        var answered = false;
        var doFallback = function (why) {
          if (answered) return;
          answered = true;
          if (cand) { respond(cand); logLine('（未实现请求已自动兜底提交：' + why + '）', 'rp-log-hint'); }
          else { respond(new Uint8Array([0, 0, 0, 0])); logLine('（未实现请求无可用编码 → 已发 0 兜底：' + why + '）', 'rp-log-err'); }
        };
        showActions(
          [{ t: '用最无害的应答继续', f: function () { doFallback('手动'); } }],
          '未实现的交互：' + name2 + '（4 秒后自动继续）');
        setTimeout(function () { doFallback('超时自动'); }, 4000);
      }
    }
  }

  /** 多选提交：SELECT_SUM 要自己拼（库不写必选卡占位，服务端会 RETRY） */
  function submitMulti(P) {
    var m = P.msg;
    if (P.kind === 'sum') { respond(sumResponse(m, state.picked)); return; }
    if (state.picked.length < (m.min || 0)) { setHud('至少要选 ' + m.min + ' 张', 'warn'); return; }
    respond(m.prepareResponse(state.picked.map(function (p) { return YGO.IndexResponse(p.index); })));
  }

  function sumResponse(m, picked) {
    var M = m.mustSelectCount || 0;
    var body = new Uint8Array(1 + M + picked.length);
    body[0] = M + picked.length;
    // 前 M 字节是必选卡占位（服务端从下标 M 开始读）
    for (var i = 0; i < picked.length; i++) body[1 + M + i] = picked[i].index;
    return body;
  }

  // ─────────────────────────────── 卡图按钮 / 卡牌选择盘（参照真实客户端）
  //
  // 真实客户端里"要不要发动/连锁"、"选攻击还是守备"都是**看卡图点**，不是读文字。
  // 这里统一用查看器同一套多源回退链（DIY → 先行 → OCG → 镜像 → cover.jpg）画卡图。

  var FACE_DOWN_IMG = 'cover2.jpg';   // 官网的卡背就是 cover2.jpg（replay-viewer.css 用的也是它）

  /** 猜拳手势（内联 SVG，白色描边风格，跟真实客户端的三个手形按钮对应） */
  // 猜拳手势图（对应协议：石头=res 2 / 剪刀=res 1 / 布=res 3）
  // ⚠ 曾经把"石头"和"布"的图画反（玩家指出：石头显示成张开五指 ✗）—— 改动前先对着下面的注释确认 ✓
  var GESTURE = {
    rock: '<svg viewBox="0 0 64 64" class="yp-gesture"><rect x="12" y="16" width="40" height="34" rx="8" fill="#e9eef5"/><rect x="10" y="12" width="8" height="22" rx="4" fill="#e9eef5"/><rect x="22" y="8" width="8" height="26" rx="4" fill="#e9eef5"/><rect x="34" y="10" width="8" height="24" rx="4" fill="#e9eef5"/><rect x="46" y="14" width="8" height="20" rx="4" fill="#e9eef5"/></svg>',
    scissors: '<svg viewBox="0 0 64 64" class="yp-gesture"><g stroke="#e9eef5" stroke-width="7" stroke-linecap="round"><line x1="24" y1="46" x2="40" y2="12"/><line x1="40" y1="46" x2="24" y2="12"/></g><circle cx="32" cy="44" r="9" fill="#e9eef5"/></svg>',
    paper: '<svg viewBox="0 0 64 64" class="yp-gesture"><circle cx="32" cy="40" r="16" fill="#e9eef5"/><rect x="14" y="14" width="10" height="18" rx="5" fill="#e9eef5"/><rect x="26" y="10" width="10" height="22" rx="5" fill="#e9eef5"/><rect x="38" y="14" width="10" height="18" rx="5" fill="#e9eef5"/><rect x="10" y="30" width="9" height="14" rx="4.5" fill="#e9eef5" transform="rotate(-20 14 37)"/></svg>',
  };

  /** 卡号 → 可读标签（名字来自查看器的 cardName 表；没加载出来就退回卡号） */
  function cardLabel(code) {
    var n = window.__live && window.__live.cardName ? window.__live.cardName(code) : '';
    return n || ('#' + code);
  }

  // ── 提示文本表（strings.conf）：协议里的 desc 就是它的编号 ──
  //   真实客户端（gframe/data_manager.cpp: GetDesc）规则：desc <= MAX_STRING_ID 时直接查 !system 表；
  //   文本里的 %ls / %d 由**各消息自己**用卡名、区域名、数字填，这里按消息类型补。
  function loadStrings() {
    if (state.strings) return Promise.resolve(state.strings);
    return fetch('/api/strings').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { state.strings = j || {}; return state.strings; })
      .catch(function () { state.strings = {}; return state.strings; });
  }
  /** desc 编号 → 文案（查不到就返回空串，调用方自己退回原有说法） */
  function sysText(id) {
    if (!id || !state.strings || !state.strings.system) return '';
    return state.strings.system[id] || '';
  }
  function victoryText(id) {
    if (id === undefined || !state.strings || !state.strings.victory) return '';
    return state.strings.victory[id] || '';
  }
  /** 用参数依次填 %ls / %d（有几个填几个，填不满就把剩余占位符抹掉，避免露出 %ls） */
  function fillDesc(text, args) {
    if (!text) return '';
    var i = 0;
    var out = text.replace(/%ls|%d|%s/g, function () {
      var v = args && i < args.length ? args[i++] : null;
      return v === null || v === undefined ? '' : String(v);
    });
    return out.replace(/\[?%(ls|d|s)\]?/g, '').replace(/\[\]/g, '');
  }
  /** 区域名（填 %ls 用；真实客户端用 getZoneName） */
  function zoneText(loc, seq) {
    var p = (loc === undefined ? 0 : loc) & 0x7f;
    var map = { 1: '卡组', 2: '手牌', 4: '怪兽区域', 8: '魔法与陷阱区域', 16: '墓地', 32: '除外区域', 64: '额外卡组', 256: '场地魔法区域' };
    return (map[p] || '场上') + (seq === undefined ? '' : '[' + (seq + 1) + ']');
  }

  function cardImgEl(code, opts) {
    opts = opts || {};
    var im = document.createElement('img');
    im.className = 'yp-cardimg' + (opts.cls ? ' ' + opts.cls : '');
    im.alt = String(code || '');
    if (opts.faceDown || !code) { im.src = FACE_DOWN_IMG; im.classList.add('yp-cardback'); return im; }
    var chain = window.__live && window.__live.picChain ? window.__live.picChain(code) : [String(code) + '.jpg'];
    var i = 0;
    im.onerror = function () { i++; if (i < chain.length) im.src = chain[i]; };
    im.src = chain[0];
    return im;
  }

  /** 图片按钮：{ t, img, rotate, faceDown, svg, sub, tip, disabled, key } */
  function makeBtn(b) {
    if (b.img === undefined && !b.rotate && !b.faceDown && !b.svg) {
      var el0 = document.createElement('button');
      el0.className = 'yp-btn';
      el0.textContent = b.t;
      el0.disabled = !!b.disabled;
      if (b.key) el0.setAttribute('data-key', b.key);
      el0.onclick = b.f;
      return el0;
    }
    var wrap = document.createElement('button');
    wrap.className = 'yp-btn yp-btn-card' + (b.rotate ? ' yp-rot' : '') + (b.disabled ? ' yp-off' : '') + (b.fixed ? ' yp-chooser-fixed' : '');
    wrap.disabled = !!b.disabled || !!b.fixed;
    wrap.title = b.tip ? (b.t + '｜' + b.tip) : (b.t || '');
    var holder = document.createElement('span');
    holder.className = 'yp-cardimg-holder';
    if (b.svg) holder.innerHTML = b.svg;                    // 猜拳手势这类没有卡图的，用内联 SVG
    else holder.appendChild(cardImgEl(b.img, { rotate: b.rotate, faceDown: b.faceDown }));
    wrap.appendChild(holder);
    if (b.t) {
      var cap = document.createElement('span');
      cap.className = 'yp-cardcap';
      cap.textContent = b.t;
      wrap.appendChild(cap);
    }
    if (b.tip) {                                            // 连锁项/效果说明：卡图下面一行小字
      var tp = document.createElement('span');
      tp.className = 'yp-cardtip';
      tp.textContent = b.tip;
      wrap.appendChild(tp);
    }
    if (b.sub) {
      var sb = document.createElement('span');
      sb.className = 'yp-cardsub';
      sb.textContent = b.sub;
      wrap.appendChild(sb);
    }
    wrap.onclick = b.f;
    return wrap;
  }

  // ─────────────────────────────── 居中卡牌选择盘
  //
  // 用于"额外卡组能出哪些怪""没有对应格位的操作"这类需要看卡面挑的场景：
  // 弹在场地正中，网格排卡图，点哪张就提交哪个操作。

  function chooserEl() { return document.getElementById('ypChooser'); }
  function hideChooser() {
    var el = chooserEl();
    if (el && el.parentNode) el.parentNode.removeChild(el);
    state.chooserOpen = false;
  }
  /**
   * 居中卡图选择盘。
   * @param items {label, code, sub, rotate, faceDown, index, f}
   * @param opts  {multi, onToggle(item, on), footer:[{t,f}], selected:Set(index)}
   *
   * 为什么需要它：查看器把**卡组/墓地/除外/额外**都画成一个"牌堆"，没有逐格 DOM ——
   * 「黑旋风」这类"从卡组把怪加入手牌"的效果，候选卡**没有任何格子可点**，
   * 于是玩家拿不到选项（实测：发动黑旋风后召唤黑羽，卡在这一步）。
   * 这类候选一律走这个选择盘：点卡图切换/确认。
   */
  function showChooser(title, items, opts) {
    hideChooser();
    opts = opts || {};
    var box = document.createElement('div');
    box.id = 'ypChooser';
    box.className = 'yp-chooser';
    var head = document.createElement('div');
    head.className = 'yp-chooser-title';
    head.textContent = title;
    // 右上角 ✕：任何选择盘都能关掉（玩家要求："这个窗口能不能加个X"）。
    // 关掉只是收起这个面板，请求仍然挂着 —— 场上/牌堆的入口还在，随时能再打开继续选。
    var closeBtn = document.createElement('button');
    closeBtn.className = 'yp-chooser-close';
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.title = '关闭（不提交，可随时再打开继续选）';
    closeBtn.onclick = function (e) { e.stopPropagation(); hideChooser(); };
    head.appendChild(closeBtn);
    box.appendChild(head);
    var grid = document.createElement('div');
    grid.className = 'yp-chooser-grid';

    function refreshFoot() {
      var foot = box.querySelector('.yp-chooser-foot');
      if (!foot || !opts.footer) return;
      foot.innerHTML = '';
      opts.footer.forEach(function (b) {
        var el = document.createElement('button');
        el.className = 'yp-btn';
        el.textContent = typeof b.t === 'function' ? b.t() : b.t;
        el.disabled = typeof b.disabled === 'function' ? b.disabled() : !!b.disabled;
        el.onclick = function (e) { e.stopPropagation(); b.f(); };
        foot.appendChild(el);
      });
    }

    items.forEach(function (it) {
      var b = makeBtn({
        t: it.label, img: it.code, sub: it.sub, rotate: it.rotate, faceDown: it.faceDown, fixed: it.fixed,
        f: function () {
          if (!opts.multi) { hideChooser(); it.f(); return; }
          var on = !b.classList.contains('yp-chooser-on');
          if (on && opts.maxReached && opts.maxReached()) return;
          b.classList.toggle('yp-chooser-on', on);
          if (opts.onToggle) opts.onToggle(it, on);
          refreshFoot();
        },
      });
      b.classList.add('yp-chooser-item');
      if (it.fixed) { b.classList.add('yp-chooser-fixed'); b.disabled = true; }   // 引擎固定的卡：展示但不可点
      if (opts.selected && opts.selected.has(it.index)) b.classList.add('yp-chooser-on');
      // 悬停列表里的卡 → 左侧常驻信息面板显示这张卡的详情（玩家要求：查看列表/额外/墓地/除外时也要能看）
      if (it.code) {
        b.addEventListener('mouseenter', function () {
          if (state.infoCode !== it.code) showCardInfo(it.code);
        });
      }
      grid.appendChild(b);
    });
    box.appendChild(grid);
    if (opts.footer) {
      var foot = document.createElement('div');
      foot.className = 'yp-chooser-foot';
      box.appendChild(foot);
      refreshFoot();
    }
    // 阻止点击穿透到场地
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    document.body.appendChild(box);
    layoutChooser();
    state.chooserOpen = true;
  }

  /**
   * 没有格位的候选（卡组/墓地/除外/额外）→ 居中多选卡图盘。
   * 返回 true 表示已经用选择盘接管了这次选择。
   */
  /**
   * 候选选择框：**列出全部候选**（不只"没有格位"的那些）。
   *
   * 为什么必须这样（玩家反馈："场上的调整怪没出现在素材里"）：场上/手牌的候选虽然已经用
   * 橙色虚线在场地高亮了，但玩家看的是**这个框**；框里只列墓地那些没有格位的卡，就会以为
   * "场上那张根本没进素材"。这是**通用**修正 —— 任何"选素材/选对象"的请求，框里都能看到全部候选，
   * 并且标明每张在哪（`我方怪兽区[1]`、`墓地[4]`…），点框里哪张就选哪张。
   *
   * 返回 true 表示已经用选择框接管了这次选择（调用方就不必再渲染一份「确定/取消」）。
   */
  function showNoCellChooser(P) {
    var all = P.cands || [];
    if (!all.length) return false;
    var m = P.msg;
    var isUnselect = P.kind === 'unselect';
    var pickable = all.filter(function (cd) { return !cd.fixed; });
    if (!pickable.length) return false;
    var zoneLabel = { 1: '卡组', 2: '手牌', 4: '怪兽区', 8: '魔陷区', 16: '墓地', 32: '除外', 64: '额外', 256: '场地' };
    // 标题写清"要给谁凑、还差多少"（玩家问过"这里我为什么不能调5星"）——
    // 要出几星是**上一步选哪只额外怪**决定的：服务端只给"需要的等级合计"(sumVal)，
    // 客户端必须把它和那只怪的名字显示出来，玩家才知道差多少。
    var targetName = (state.lastPick && state.lastPick.code) ? (cardLabel(state.lastPick.code) + ' ') : '';
    var needSum = (m.sumVal !== undefined && m.sumVal > 0) ? ('，需要等级合计 ' + m.sumVal) : '';
    showChooser(
      targetName + takeHintCached(P) + '（' + m.min + '–' + m.max + '，共 ' + pickable.length + ' 张可选' + needSum +
        (isUnselect ? '，点一张提交一张' : '，凑满自动确定') + '）',
      all.map(function (cd) {
        var info = cd.info || {};
        var plain = (info.location === undefined ? 0 : info.location) & 0x7f;
        var where = seatName(info.controller) + (zoneLabel[plain] || ('loc' + plain)) +
          '[' + ((info.sequence === undefined ? 0 : info.sequence) + 1) + ']';
        // 场上/手牌的候选也进框（同时场上仍保留橙色虚线高亮，两条路都能选）
        // 卡号未知 **或这张卡是里侧表示**（对手盖卡）时：**不要请求卡图**，直接画卡背。
        // 原因：请求不存在/未收录的卡号，镜像站会返回"先行卡 卡图未解锁"那张占位图（玩家截图报过 ✗）。
        // ygopro 表示形式位：1=表侧攻击 2=里侧攻击 4=表侧守备 8=里侧守备 → 里侧 = (pos & (2|8))
        var pos0 = (info.position !== undefined ? info.position : info.pos) || 0;
        var faceDown = !!(pos0 & (0x2 | 0x8));
        if (!faceDown) {
          // 再看一眼场地模型：服务端没给 position 时，用查看器记的 faceDown 兜底
          try {
            var model = (window.__live && window.__live.cardsAt) ? window.__live.cardsAt(flipSeat(info.controller || 0), (info.location || 0) & 0x7f) : null;
            if (model) for (var mi = 0; mi < model.length; mi++) if (model[mi].seq === info.sequence) { faceDown = !!model[mi].faceDown; break; }
          } catch (e) {}
        }
        var known = !!info.code && !faceDown;
        return {
          label: known ? cardLabel(info.code) : '里侧卡片', code: known ? info.code : 0,
          faceDown: !known,
          sub: (cd.fixed ? '固定 · ' : '') + where,
          index: cd.index, fixed: cd.fixed, onField: !!cd.el,
          f: function () { if (!cd.fixed) respond(m.prepareResponse(YGO.IndexResponse(cd.index))); },
        };
      }),
      isUnselect ? {} : {
        multi: true,
        selected: new Set(state.picked.map(function (p) { return p.index; })),
        maxReached: function () { return state.picked.length >= (m.max || 99); },
        onToggle: function (it, on) {
          var cd = all.filter(function (x) { return x.index === it.index; })[0];
          if (!cd) return;
          var at = state.picked.indexOf(cd);
          if (on && at < 0) state.picked.push(cd);
          else if (!on && at >= 0) state.picked.splice(at, 1);
          if (cd.el) cd.el.classList.toggle('yp-picked', !!on);
          renderActionCount();
          maybeAutoSubmit(P);            // 选满自动确定（单张候选 → 点一下即提交）
        },
        footer: [
          {
            t: function () { return state.picked.length < (m.min || 0) ? ('确定（还需选 ' + ((m.min || 0) - state.picked.length) + ' 张）') : ('确定(' + state.picked.length + ')'); },
            disabled: function () { return state.picked.length < (m.min || 0) || (m.sumVal !== undefined && sumGateUsable(P) && !pickedSumOk(m, state.picked)); },   // 数量没够 / 合计没凑满就禁用（否则点了会被引擎拒）
            f: function () { hideChooser(); submitMulti(P); },
          },
          { t: '取消', f: function () { hideChooser(); if (m.cancelable) respond(m.prepareResponse(null)); else renderPending(); } },
        ],
      },
    );
    return true;
  }
  function layoutChooser() {
    var box = chooserEl();
    if (!box) return;
    var r = fieldRect();
    var w = box.offsetWidth, h = box.offsetHeight;
    var left = r ? r.left + (r.width - w) / 2 : (window.innerWidth - w) / 2;
    var top = r ? r.top + (r.height - h) / 2 : Math.max(80, (window.innerHeight - h) / 2);
    box.style.left = Math.round(Math.max(8, left)) + 'px';
    box.style.top = Math.round(Math.max(8, top)) + 'px';
  }

  // ── 位置 → DOM 格位 ──
  // ⚠ 额外怪兽区（EMZ）在查看器里不是 MZONE 的第 5/6 格，而是中线带上的 emz:L / emz:R 两个共用格，
  //   映射规则抄查看器自己的 emzKey()：我(0)＝左 seq5/右 seq6；对手(1)＝左 seq6/右 seq5。
  //   连接怪只能放这里 —— 漏了这条映射，服务端问"放哪里"时一个格子都不会亮。
  function emzKey(viewCtl, seq) {
    return viewCtl === 0 ? (seq === 5 ? 'emz:L' : 'emz:R') : (seq === 5 ? 'emz:R' : 'emz:L');
  }
  /** 候选/位置对象 → DOM 的 data-zone 值（viewer 世界；席位已翻到我方视角） */
  function viewZoneOf(c) {
    var loc = c.location !== undefined ? c.location : c.zone;
    var plain = loc & 0x7f;
    var seq = c.sequence !== undefined ? c.sequence : 0;
    var ctl = flipSeat(c.controller !== undefined ? c.controller : (c.player !== undefined ? c.player : 0));
    if (plain === LOC.MZONE && seq >= 5) return emzKey(ctl, seq);
    return ctl + ':' + plain + ':' + seq;
  }
  function locKeyOf(c) { return viewZoneOf(c); }
  function cellForCandidate(c) {
    var loc = c.location !== undefined ? c.location : c.zone;
    if ((loc & 0x7f) === LOC.HAND) {
      var cont = document.querySelector('[data-zone="' + flipSeat(c.controller || 0) + ':' + LOC.HAND + '"]');
      return cont ? cont.children[c.sequence || 0] : null;
    }
    return document.querySelector('[data-zone="' + viewZoneOf(c) + '"]');
  }
  /**
   * SELECT_SUM 的"合计刚好"校验（对齐引擎 playerop.cpp:565 select_sum_check1）：
   *   每张候选带 sum_param，低 16 位 o1 / 高 16 位 o2 是这张卡**可贡献的两个取值**；
   *   引擎要求最终所选（含 must 卡）能**恰好凑出 sumVal**（严格相等）。
   * 由此做两件事：
   *   ① 顶部显示"已选合计 X / 目标 Y"；
   *   ② 每次选完，把"再怎么选也凑不出目标"的卡从可选项里去掉（玩家反馈：等级不对的卡不该还能选）。
   */
  /**
   * SELECT_SUM：每张候选的 `opParam` 是这张卡**可贡献的两个取值**（低 16 位 o1 / 高 16 位 o2）。
   * ⚠ 字段名是 `opParam`（`ygopro-msg-encode` 的 `YGOProMsgSelectSum_CardInfo`，i32 @ offset 7）——
   *   之前我写成了 `sumParam`，读到的一直是 undefined → 当成 0 → **所有候选都被判成"凑不出目标"而隐藏**，
   *   玩家看到的就是"点了一张之后可选项全空了"。兼容 `sumParam` 以防库版本差异。
   */
  function sumOpts(c) {
    var p = c ? (c.opParam !== undefined ? c.opParam : c.sumParam) : 0;
    p = p || 0;
    var o1 = p & 0xffff, o2 = (p >>> 16) & 0xffff;
    return o2 > 0 ? [o1, o2] : [o1];
  }
  /** 这一问的候选里有没有可用的 opParam（没有就说明拿不到数据，必须放弃过滤而不是全隐藏） */
  function sumDataUsable(P) {
    var m = P.msg;
    if (!m || !m.sumVal) return false;
    return (P.cands || []).some(function (cd) { return (sumOpts(cd.info)[0] || 0) !== 0 || (sumOpts(cd.info)[1] || 0) !== 0; });
  }
  /**
   * 我手里的 sum 数据能不能信？（拿它去"禁用确定 / 隐藏候选"之前必须先过这一关）
   * ⚠ 玩家反馈："选完素材的时候，确定不亮" —— 把按钮可用性绑死在**我自己算的合计**上，
   *   只要我对 `opParam` 的解读与服务端有一点不一致（例如固定卡的 opParam 为 0、或取值不是等级），
   *   按钮就会**永远点不亮**，比"多给可选项"严重得多。
   *   所以先验证"用全部候选到底能不能凑出目标"：凑不出 → 判定数据不可信 → **不做任何限制**。
   */
  function sumGateUsable(P) {
    if (!sumDataUsable(P)) return false;
    var m = P.msg;
    var must = (m.mustSelectCards || []).map(sumOpts);
    var all = (P.cands || []).filter(function (cd) { return !cd.fixed; }).map(function (cd) { return sumOpts(cd.info); });
    if (!must.concat(all).some(function (o) { return (o[0] || 0) !== 0 || (o[1] || 0) !== 0; })) return false;
    return sumReachable(m.sumVal, must, all, Math.max(1, (m.max || 1) + (P.cands || []).length));
  }
  /** 用 DP 判断：在"必选的卡"之外，再从未必选池里挑若干张，能否恰好凑出 target（且总数不超过 maxCount） */
  function sumReachable(target, requiredOpts, optionalOpts, maxAdd) {
    if (target < 0 || target > 65535) return false;
    var reach = new Set([0]);
    for (var i = 0; i < requiredOpts.length; i++) {
      var next = new Set();
      reach.forEach(function (s) { requiredOpts[i].forEach(function (v) { var t = s + v; if (t <= target) next.add(t); }); });
      reach = next;
      if (!reach.size) return false;
    }
    // 再考虑"可选加入"的卡（最多再加 maxAdd 张）
    for (var k = 0; k < Math.max(0, maxAdd); k++) {
      var n2 = new Set(reach);
      reach.forEach(function (s) { optionalOpts.forEach(function (opts) { opts.forEach(function (v) { var t = s + v; if (t <= target) n2.add(t); }); }); });
      reach = n2;
      if (reach.has(target)) return true;
    }
    return reach.has(target);
  }
  /** 当前这一问的"合计进度"文案 */
  function sumProgressText(P) {
    var m = P.msg;
    if (m.sumVal === undefined) return '';
    var mustSum = (m.mustSelectCards || []).reduce(function (a, c) { return a + Math.min.apply(null, sumOpts(c)); }, 0);
    var pickedSum = state.picked.reduce(function (a, cd) { return a + Math.min.apply(null, sumOpts(cd.info)); }, 0);
    return '　合计 ' + (mustSum + pickedSum) + ' / 目标 ' + m.sumVal;
  }
  /** 把"凑不出目标"的候选去掉（剩下的才可点） */
  function filterSumCands(P) {
    var m = P.msg;
    if (m.sumVal === undefined) return;
    // 防呆：数据不可信（拿不到 opParam / 用全部候选也凑不出目标）时**完全不过滤** ——
    // 宁可多给可选项，也不能把玩家选成空白或把"确定"卡死
    if (!sumGateUsable(P)) {
      (P.cands || []).forEach(function (cd) { cd.hidden = false; if (cd.el) cd.el.classList.add('yp-pick'); });
      logLine('   （sum 取值数据不可信或凑不出目标 → 已关闭"自动剔除"与合计限制，交给服务端判定）', 'rp-log-hint');
      return;
    }
    var mustOpts = (m.mustSelectCards || []).map(sumOpts);
    var pickedSet = new Set(state.picked);
    var pickedOpts = state.picked.map(function (cd) { return sumOpts(cd.info); });
    var restOpts = (P.cands || []).filter(function (cd) { return !cd.fixed && !pickedSet.has(cd); }).map(function (cd) { return sumOpts(cd.info); });
    P.cands.forEach(function (cd) {
      if (cd.fixed || pickedSet.has(cd)) { cd.hidden = false; return; }
      var req = mustOpts.concat(pickedOpts, [sumOpts(cd.info)]);
      // 其余候选里还能再挑 max - 已选 - 1 张
      var others = restOpts.filter(function (o) { return o !== sumOpts(cd.info); });
      var maxAdd = Math.max(0, (m.max || 1) - state.picked.length - 1);
      cd.hidden = !sumReachable(m.sumVal, req, others, maxAdd);
      if (cd.el) cd.el.classList.toggle('yp-pick', !cd.hidden);
    });
  }
  function candWhere(c) {
    var loc = c && c.location !== undefined ? (c.location & 0x7f) : 0;
    return seatName(c && c.controller) + locName(loc);
  }

  function highlightCandidates(P, cards) {
    P.cands = cards.map(function (c, i) {
      return { info: c, index: candidateIndex(c, i), el: cellForCandidate(c), fixed: false };
    });
    P.cands.forEach(function (cd) { if (cd.el) cd.el.classList.add('yp-pick'); });
  }

  /**
   * MSG_SELECT_SUM：候选分两半 —— `mustSelectCards`（引擎已固定选好，不用玩家点）与
   * `cards`（玩家要凑的部分）。**固定那半也要放进列表展示**（标成"固定"），
   * 否则玩家会以为"场上的素材没进选项"（玩家反馈过）。
   */
  function highlightSumCandidates(P, m) {
    var must = m.mustSelectCards || [];
    var sel = m.cards || [];
    highlightCandidates(P, sel);
    must.forEach(function (c) {
      var el = cellForCandidate(c);
      if (el) el.classList.add('yp-picked');                 // 固定卡用"已选中"样式标出来
      P.cands.push({ info: c, index: -1, el: el, fixed: true });
    });
  }
  function highlightPlaces(P, places) {
    P.places = places;
    places.forEach(function (pl) {
      // DOM 用"翻转+EMZ 映射"后的键；pl 原样保留（应答要回服务端的绝对地址）
      pl._viewZone = viewZoneOf(pl);
      var el = document.querySelector('[data-zone="' + pl._viewZone + '"]');
      if (el) { el.classList.add('yp-pick'); pl._el = el; }
    });
  }
  function armPick(P, type, list) {
    P.armedMode = { type: type, list: list };
    setHud('已选「' + type + '」→ 请点场上的目标卡');
    highlightCandidates(P, list);
  }

  // ── 点卡 → 弹出该卡可用的操作菜单 ──
  // 对齐真实客户端（KoishiPro）：先点手牌/场上的卡，菜单就出现在卡旁边，
  // 里面是**这张卡**能做的事（召唤 / 盖放 / 发动 / 攻击 / 表示形式），点一下即提交；
  // 而不是以前那样"先在动作条选操作类型，再回去点卡"。
  // 菜单项顺序（按玩家要求对齐真实客户端）：
  //   手牌怪兽：发动效果 → 特殊召唤 → 召唤 → 变更表示形式 → 盖放
  //   场上怪兽（战阶）：发动效果 → 攻击 → 变更表示形式
  var ACTION_GROUPS = {
    idle: [
      ['发动效果', 5, 'activatableCards'],
      ['特殊召唤', 1, 'spSummonableCards'],
      ['召唤', 0, 'summonableCards'],
      ['变更表示形式', 2, 'reposableCards'],
      ['盖放', 3, 'msetableCards'],
      ['盖放', 4, 'ssetableCards'],
    ],
    battle: [
      ['发动效果', 0, 'activatableCards'],
      ['攻击', 1, 'attackableCards'],
      ['变更表示形式', 2, 'reposableCards'],
    ],
  };

  /** 候选卡在列表里的下标（查看器与服务端约定：叠放素材取 subsequence） */
  function candidateIndex(c, i) {
    return (c.subsequence !== undefined && c.subsequence >= 0 && (c.location & 0x80)) ? c.subsequence : i;
  }

  /**
   * 把"哪些卡能做哪些操作"摊平成 元素 → [操作]。
   * @returns 没有对应 DOM 格位的操作（例如**额外卡组的卡**：它没有独立格子，
   *          只能通过左边的"额外"牌堆点进去）——这些交给调用方摆到额外牌堆/选择盘上。
   */
  function buildCardActions(P) {
    var groups = ACTION_GROUPS[P.kind];
    if (!groups) { P.acts = null; P.extraActs = []; return []; }
    var m = P.msg, acts = new Map(), orphans = [], extras = [];
    groups.forEach(function (g) {
      var list = m[g[2]];
      if (!list || !list.length) return;
      list.forEach(function (c, i) {
        var act = { label: g[0], type: g[1], index: candidateIndex(c, i), info: c };
        var plain = c.location !== undefined ? (c.location & 0x7f) : 0;
        if (plain === LOC.EXTRA) { extras.push(act); return; }   // 额外卡组：走牌堆点选
        var el = cellForCandidate(c);
        if (!el) { orphans.push(act); return; }
        var arr = acts.get(el) || [];
        arr.push(act);
        acts.set(el, arr);
      });
    });
    // ── 去重：**同一张卡 + 同一种应答类型 + 同一标签**才算重复 ──
    //   ① 要修的原始问题：像「怪粉坏兽 加达拉」这种"自身方式特殊召唤"，服务端同时列在
    //      activatableCards 与 spSummonableCards 里 → 菜单出现两个「特殊召唤」✗（玩家实测）
    //   ② ⚠ 但**不能只按标签去重**：额外卡组的候选标签全都是「特殊召唤」✗，
    //      只比标签会把「有很多怪满足条件」压成一张（玩家实测："明明有很多怪满足召唤条件"✗）
    //   → 键 = 标签 | 类型 | 卡号 | 区域 | 序号：同卡同型的重复去掉 ✓，不同卡各自保留 ✓
    function dupKeyOf(a) {
      var info = a.info || {};
      return [a.label, a.type, info.code, info.location, info.sequence].join('|');
    }
    acts.forEach(function (list, el) {
      var seen = {}, kept = [];
      list.forEach(function (a) {
        var k = dupKeyOf(a);
        if (seen[k]) return;
        seen[k] = 1;
        kept.push(a);
      });
      acts.set(el, kept);
    });
    function dedupeByKey(arr) {
      var seen = {}, kept = [];
      arr.forEach(function (a) { var k = dupKeyOf(a); if (!seen[k]) { seen[k] = 1; kept.push(a); } });
      return kept;
    }
    orphans = dedupeByKey(orphans);
    extras = dedupeByKey(extras);
    P.acts = acts;
    P.extraActs = extras;
    acts.forEach(function (list, el) {
      el.classList.add('yp-act');
      if (list.length > 1) el.classList.add('yp-act-multi');
    });
    // 额外牌堆：只要里面有可特召的怪，就让它可点（点了弹居中卡牌选择盘）
    var pile = document.querySelector('[data-pile="extra:0"]');   // 查看器世界里我的额外卡组恒为 0
    if (pile) {
      if (extras.length) { pile.classList.add('yp-act'); pile.title = '额外卡组：点这里选要出场的怪兽'; }
      else pile.classList.remove('yp-act');
      setPileBadge(pile, extras.length);
    }
    return orphans;
  }

  /** 额外牌堆上的小角标（不占位、不挡操作，只提示"这里有几只可以出"） */
  function setPileBadge(pile, n) {
    var b = pile.querySelector('.yp-pile-badge');
    if (!n) { if (b) b.parentNode.removeChild(b); return; }
    if (!b) {
      b = document.createElement('span');
      b.className = 'yp-pile-badge';
      pile.appendChild(b);
    }
    b.textContent = n;
  }

  /** 额外卡组选择盘：显示所有可从额外卡组特召的怪（卡图 + 名称） */
  function showExtraChooser(P) {
    var list = P.extraActs || [];
    if (!list.length) return false;
    var title = ((state.lastPick && state.lastPick.code) ? cardLabel(state.lastPick.code) + ' 的效果：' : '')
      + '请选择要特殊召唤的卡';
    showChooser(title, list.map(function (a) {
      var code = a.info.code || 0;
      var seq = a.info.sequence === undefined ? 0 : a.info.sequence;
      // 参照真实客户端（图9）：额外卡组的候选标出位置，如"额外[4]"
      return {
        label: cardLabel(code), code: code, sub: '额外[' + (seq + 1) + ']',
        f: function () {
          // 记住这次特召的是哪张（下一次选素材时提示里会点名，玩家能看出是"哪种召唤方式"）
          rememberPick('特殊召唤', a.info);
          logLine('► 特殊召唤：' + cardLabel(code) + '（额外[' + (seq + 1) + '] → index ' + a.index + '）', 'rp-log-hint');
          respondIndexed(P.msg, a.type, a.index);
        },
      };
    }));
    return true;
  }

  function menuEl() { return document.getElementById('ypCardMenu'); }
  function hideCardMenu() {
    var m = menuEl();
    if (m && m.parentNode) m.parentNode.removeChild(m);
    state.menuFor = null;
  }
  function showCardMenu(el, actions, pt) {
    hideCardMenu();
    var box = document.createElement('div');
    box.id = 'ypCardMenu';
    box.className = 'yp-menu';
    actions.forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'yp-menu-item';
      b.textContent = a.label || a.t || '';
      // 悬停菜单里的条目 → 左侧信息面板显示那张卡（和列表一致的手感）
      if (a.info && a.info.code) {
        b.addEventListener('mouseenter', function () {
          if (state.infoCode !== a.info.code) showCardInfo(a.info.code);
        });
      }
      b.onclick = function (ev) {
        ev.stopPropagation();
        var P = state.pending;
        hideCardMenu();
        // ⚠ 菜单项有两种：① 卡片操作（带 type/index，走 respondIndexed）；② 自带回调（牌堆菜单的
        //   「查看列表」这类，用 a.f）。之前一律走 ①，于是牌堆菜单点下去发的是 `type=undefined`
        //   的垃圾应答 → 服务端 MSG_RETRY（实测：日志里 "SelectIdleCmd 00000000"）。
        if (typeof a.f === 'function') { a.f(); return; }
        if (!P) return;
        // 把"点了哪张卡 → 发了哪个下标"记进日志：手卡选错卡时一眼能看出是映射错还是命中错
        var info = a.info || {};
        logLine('► ' + (a.label || a.t) + '：' + cardLabel(info.code) +
          '（' + seatName(info.controller) + locName(info.location) + ' seq' + info.sequence +
          ' → index ' + a.index + '）', 'rp-log-hint');
        rememberPick(a.label || a.t, info);   // 记住"这一手选了什么"，下一步选素材的提示会点名
        respondIndexed(P.msg, a.type, a.index);
      };
      box.appendChild(b);
    });
    document.body.appendChild(box);
    // 打开卡片菜单时，顺手把这张卡的信息显示到左侧（真实客户端也是这个手感）
    var firstInfo = actions[0] && actions[0].info;
    if (firstInfo && firstInfo.code) showCardInfo(firstInfo.code);
    // 菜单出现在**鼠标位置**（参照真实客户端），右/下放不下就翻到另一侧
    var mx = pt && pt.x !== undefined ? pt.x : null;
    var my = pt && pt.y !== undefined ? pt.y : null;
    if (mx === null || my === null) {
      var r0 = el.getBoundingClientRect();
      mx = r0.left + r0.width / 2; my = r0.top + r0.height / 2;
    }
    var w = box.offsetWidth, h = box.offsetHeight;
    var left = mx + 8;
    if (left + w > window.innerWidth - 8) left = Math.max(8, mx - w - 8);
    var top = my - 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8);
    top = Math.max(8, top);
    box.style.left = Math.round(left) + 'px';
    box.style.top = Math.round(top) + 'px';
    state.menuFor = el;
  }

  /** 手柄日志用的可读名 */
  function seatName(ctl) { return ctl === undefined ? '?' : (flipSeat(ctl) === 0 ? '我方' : '对手'); }
  function locName(loc) {
    if (loc === undefined) return '';
    var p = loc & 0x7f;
    var map = { 1: '卡组', 2: '手牌', 4: '怪兽区', 8: '魔陷区', 16: '墓地', 32: '除外', 64: '额外', 256: '场地' };
    return (map[p] || ('loc' + p)) + (loc & 0x80 ? '·素材' : '');
  }

  /**
   * 解析"这次点击对应哪个可操作元素"。
   * ⚠ 场地上的怪：操作挂在**格位**（`[data-zone]`）上，而卡图是格位里的 `.rp-card` ——
   *   攻击表示的怪占满整个格子，点下去命中的是**卡图**，必须**往上找祖先**才能拿到格位上的操作；
   *   只认"点到的那个元素"会漏掉"变更表示形式/发动效果"（实测踩过：攻击表示的怪点不出表示形式）。
   * 手牌则是反过来：操作挂在 `.rp-card` 自己身上 ✓ 两种都能覆盖。
   */
  function actElForClick(el, target, acts) {
    var node = target;
    while (node && node !== document.body) {
      if (acts.has(node)) return node;
      node = node.parentNode;
    }
    return actInsideCell(el, acts);
  }

  /**
   * 命中判定：按坐标找"可操作的卡"。
   * ⚠ 只当**格位**的兜底用（场地格位比卡面大，点在格位边缘也该算点在这张卡上）。
   *   手牌绝不能走这个容差：手牌容器横跨整个场地，右侧那一大片空白离最后一张牌不到 28px，
   *   一放容差就变成"点空白也弹菜单"（实测被玩家指出）。
   * @param tol 容差像素（默认 4px，只用于修子像素/边缘偏差）
   */
  function hitActEl(x, y, acts, tol) {
    tol = tol === undefined ? 4 : tol;
    var best = null, bestD = Infinity;
    acts.forEach(function (_, el) {
      var r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      var inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      if (inside) { best = el; bestD = -1; return; }
      if (bestD === -1) return;
      var dx = Math.max(r.left - x, 0, x - r.right);
      var dy = Math.max(r.top - y, 0, y - r.bottom);
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = el; }
    });
    if (bestD === -1) return best;
    return bestD <= tol ? best : null;
  }
  /** 被点的"格位"里包含的可操作卡（点场上的格子边缘时用；手牌容器不算） */
  function actInsideCell(el, acts) {
    if (!el || !el.contains || (el.classList && el.classList.contains('rp-hand'))) return null;
    var found = null;
    acts.forEach(function (_, actEl) { if (!found && (actEl === el || el.contains(actEl))) found = actEl; });
    return found;
  }
  /** 点到的是"哪张可操作卡"：格位里的卡面、或格位本身（不含手牌容器的空白） */
  function resolveActEl(el, acts) {
    if (acts.has(el)) return el;
    return actInsideCell(el, acts);
  }

  /**
   * 牌堆（墓地/除外/额外/卡组）的"可发动"状态与菜单（玩家要求）：
   *   · 墓地里**有可发动的效果** → 牌堆发光；
   *   · 点牌堆 → 弹小菜单：**发动效果**（只列可发动的那几张）/ **查看列表**（列全部）；
   *   · 这些"没有格位"的候选**不再丢到画面中央的"其它操作"**里（玩家反馈过）。
   */
  function pileKeyOf(cd) {
    var info = cd.info || {};
    var plain = (info.location === undefined ? 0 : info.location) & 0x7f;
    var viewCtl = flipSeat(info.controller || 0);
    var kind = plain === LOC.GRAVE ? 'grave' : plain === LOC.REMOVED ? 'removed' : plain === LOC.EXTRA ? 'extra' : null;
    return kind ? (kind + ':' + viewCtl) : null;
  }
  /** 用当前请求里"没有格位"的候选，给对应牌堆加发光/角标 */
  /**
   * 卡组顶端公开（「天变地异」这类效果：服务端会把卡组全量发过来）。
   * 规则：**只要收到过卡组内容**（平时服务端根本不发）→ 就在牌堆上画出顶端那张。
   * 每秒随 markPilesForPending() 一起重画，天然跟随对局变化。
   */
  function renderDeckTops() {
    [0, 1].forEach(function (ctl) {
      var pile = document.querySelector('[data-pile="deck:' + ctl + '"]');
      if (!pile) return;
      // 优先用 MSG_DECK_TOP 给的"顶端卡号"（天变地异就是这样公开的），其次才用整副卡组列表
      var dt = window.__ypDeckTop && window.__ypDeckTop[ctl];
      var list = (window.__ypDeck && window.__ypDeck[ctl]) || [];
      var top = dt ? { code: dt.faceDown ? 0 : dt.code, faceDown: !!dt.faceDown } : (list.length ? list[0] : null);
      var old = pile.querySelector('.yp-pile-top');
      if (!top) { if (old) old.parentNode.removeChild(old); return; }
      var dt0 = window.__ypDeckTop && window.__ypDeckTop[ctl];
      var code = top.code;
      var backOnly = !code || (dt0 && dt0.faceDown);
      if (old && old.getAttribute('data-code') === String(code) && old.getAttribute('data-back') === String(!!backOnly)) return;
      if (old) old.parentNode.removeChild(old);
      var img = document.createElement('img');
      img.className = 'yp-pile-top';
      img.setAttribute('data-code', String(code));
      img.setAttribute('data-back', String(!!backOnly));
      img.alt = backOnly ? '里侧卡片' : cardLabel(code);
      img.title = '卡组顶端：' + (backOnly ? '（里侧）' : cardLabel(code));
      // 里侧（或卡号未知）顶端：**画卡背**，绝不请求 0.jpg（镜像站会给"卡图未解锁"占位图 ✗）
      var chain = backOnly ? [FACE_DOWN_IMG]
        : ((window.__live && window.__live.picChain) ? window.__live.picChain(code) : [code + '.jpg']);
      var i = 0;
      img.onerror = function () { i++; if (i < chain.length) img.src = chain[i]; };
      img.src = chain[0];
      img.addEventListener('mouseenter', function () { if (state.infoCode !== code) showCardInfo(code); });
      pile.appendChild(img);
    });
  }

  /**
   * 牌堆（墓地/除外/额外/卡组）的可点状态与可发动列表。
   *
   * ⚠ 这里的条目有**两个来源**，都必须收：
   *   ① `P.cands`：正在"选卡/选素材"的请求里、没有格位的候选；
   *   ② `P.orphanActs`：**主要阶段/战斗阶段**里"墓地·除外的效果"（如黑羽-刻夜之佐达③"把墓地的这张卡除外
   *      才能发动"）—— 它们没有格位，以前会出现在画面中央的"其它操作"，玩家要求挪到牌堆菜单里。
   *   只收 ① 的话，idle 阶段的墓地效果就会**既不在中央、也不在墓地菜单**，等于彻底点不到（实测被玩家抓到）。
   */
  function markPilesForPending() {
    var P = state.pending;
    var byPile = {};
    if (P && P.cands) {
      P.cands.forEach(function (cd) {
        if (cd.el || cd.fixed) return;                     // 有格位的走场上高亮
        var k = pileKeyOf(cd);
        if (!k) return;
        (byPile[k] = byPile[k] || []).push(cd);
      });
    }
    if (P && P.orphanActs) {
      P.orphanActs.forEach(function (a) {
        var k = pileKeyOf({ info: a.info });
        if (!k) return;
        (byPile[k] = byPile[k] || []).push(a);
      });
    }
    PILE_KINDS.forEach(function (k) {
      var el = document.querySelector('[data-pile="' + k + ':0"]');
      if (!el) return;
      var list = byPile[k] || [];
      el.classList.toggle('yp-pile-glow', list.length > 0);
      el.title = list.length
        ? ('这里有 ' + list.length + ' 张可以操作 —— 点开（发动效果 / 查看列表）')
        : (k === 'grave' ? '墓地：点开查看列表' : k === 'removed' ? '除外区域：点开查看列表' : '点开查看列表');
    });
    if (P) P.pileActs = byPile;
  }
  var PILE_KINDS = ['grave', 'removed', 'extra', 'deck'];

  /** 统一的"提交这一条"：候选条目用 index，动作条目用 type+index */
  function submitPileEntry(P, e) {
    if (!P) return;
    if (typeof e.type === 'number') respondIndexed(P.msg, e.type, e.index);
    else respond(P.msg.prepareResponse(YGO.IndexResponse(e.index)));
  }

  /** 点牌堆弹出的小菜单（发动效果 / 查看列表）——参照真实客户端 */
  function showPileMenu(pileKey, pt) {
    var P = state.pending;
    var acts = (P && P.pileActs && P.pileActs[pileKey]) || [];
    var items = [];
    if (acts.length) {
      items.push({
        label: '发动效果（' + acts.length + '）',
        f: function () {
          hideCardMenu();
          var kindName = pileKey.split(':')[0] === 'grave' ? '墓地' : pileKey.split(':')[0] === 'removed' ? '除外' : '这里';
          showChooser('可发动的效果（' + kindName + '，' + acts.length + ' 张）', acts.map(function (cd) {
            return {
              label: cardLabel(cd.info.code), code: cd.info.code,
              sub: kindName + '[' + ((cd.info.sequence === undefined ? 0 : cd.info.sequence) + 1) + ']',
              f: function () {
                hideChooser();
                logLine('► 发动效果：' + cardLabel(cd.info.code) + '（' + kindName + ' seq' + cd.info.sequence + '）', 'rp-log-hint');
                rememberPick('发动效果', cd.info);
                submitPileEntry(P, cd);          // 候选条目用 index、动作条目用 type+index（统一处理）
              },
            };
          }));
        },
      });
    }
    items.push({
      label: '查看列表',
      f: function () { hideCardMenu(); showPileList(pileKey); },
    });
    showCardMenu(document.querySelector('[data-pile="' + pileKey + '"]'), items, pt);
  }
  function showPileList(pileKey) {
    var parts = String(pileKey).split(':');
    var kind = parts[0], ctlView = Number(parts[1] || 0);
    var locMap = { grave: LOC.GRAVE, removed: LOC.REMOVED, extra: LOC.EXTRA, deck: LOC.DECK };
    var loc = locMap[kind];
    if (!loc) return false;
    var cards = (window.__live && window.__live.cardsAt) ? window.__live.cardsAt(ctlView, loc) : [];
    // 额外卡组：查看器只记数量、不存卡号（历史遗留），改从查看器补丁写入的侧通道取
    if (loc === LOC.EXTRA && !cards.length && window.__ypExtra && window.__ypExtra[ctlView]) {
      cards = window.__ypExtra[ctlView].map(function (code, i) { return { seq: i, code: code, pos: 0, faceDown: false }; });
    }
    var P = state.pending;
    // 当前请求在这片区域里的候选（按 sequence 对齐）
    var candBySeq = {};
    if (P && P.cands) P.cands.forEach(function (cd) {
      var info = cd.info || {};
      if ((info.location & 0x7f) !== loc) return;
      if (flipSeat(info.controller || 0) !== ctlView) return;
      candBySeq[info.sequence] = cd;
    });
    var hasCand = Object.keys(candBySeq).length > 0;
    var canActivate = hasCand && Object.keys(candBySeq).some(function (s) {
      return (candBySeq[s].info.location & 0x7f) === loc;
    });
    var title = (kind === 'grave' ? '墓地' : kind === 'removed' ? '除外区域' : kind === 'extra' ? '额外卡组' : '卡组') +
      '（' + (ctlView === 0 ? '我方' : '对方') + '，' + cards.length + ' 张）' + (hasCand ? ' —— 点卡选择' : ' —— 仅供查看');
    var items = cards.map(function (c) {
      var cd = candBySeq[c.seq];
      return {
        label: cardLabel(c.code) + (c.faceDown && !c.code ? '（里侧）' : ''), code: c.code,
        sub: '#' + (c.seq + 1), faceDown: !c.code,
        f: cd ? function () { respond(P.msg.prepareResponse(YGO.IndexResponse(cd.index))); } : function () {},
      };
    });
    if (!items.length) items.push({ label: '（空的）', code: 0, sub: '', f: function () {} });
    var footer = [
      {
        // 参照真实客户端：牌堆菜单里就有「发动」（该区域没有可发动的卡时置灰，而不是干脆不显示）
        t: '发动效果', disabled: !canActivate,
        f: function () {
          if (!canActivate) return;
          var firstKey = Object.keys(candBySeq)[0];
          var cd = candBySeq[firstKey];
          hideChooser();
          respondIndexed(P.msg, 5, cd.index);     // 5 = ACTIVATE（和"点卡菜单→发动效果"同一条路径）
        },
      },
      { t: '查看列表', disabled: true, f: function () {} },   // 当前就开着列表，放一个条目对齐真实客户端的菜单形状
      { t: '关闭', f: function () { hideChooser(); } },
    ];
    showChooser(title, items, { footer: footer });
    return true;
  }

  // ── 左侧卡片信息面板（参照真实客户端）──
  //   数据分两处：卡名/攻守/类别来自 /api/cards（查看器已加载），效果文本/种族/属性/setcode 来自
  //   /api/cardtext（体积大，**懒加载**：第一次要显示面板时才拉）。

  var RACE_NAMES = null, ATTR_NAMES = null;
  function raceName(bit) {  // 种族位 → 名字（strings.conf: !system 1020+i）
    var i = Math.log2(bit || 0);
    return Number.isInteger(i) && i >= 0 && i < 25 ? (sysText(1020 + i) || '') : '';
  }
  function attrName(bit) {  // 属性位 → 名字（!system 1010+i）
    var i = Math.log2(bit || 0);
    return Number.isInteger(i) && i >= 0 && i < 7 ? (sysText(1010 + i) || '') : '';
  }
  function setNames(setcode) {  // setcode 4 组 16 位，各取低 12 位查 !setname（去重 + 规范化空白）
    var out = [];
    for (var k = 0; k < 4; k++) {
      var v = (setcode >>> (k * 16)) & 0xffff;
      var id = v & 0xfff;
      if (!id) continue;
      var nm = (state.strings && state.strings.setname) ? state.strings.setname[id] : '';
      if (!nm) continue;
      nm = String(nm).replace(/\s+/g, ' ').trim();      // strings.conf 里用制表符分隔日文/中文名
      if (nm && out.indexOf(nm) < 0) out.push(nm);
    }
    return out;
  }
  var SPELL_KINDS = [[0x80, '仪式'], [0x2000000, '速攻'], [0x20000, '永续'], [0x40000, '装备'], [0x80000, '场地'], [0x100000, '反击'], [0x10000, '通常']];
  function typeLine(code, meta, txt) {
    var type = (txt && txt.t) || 0;
    if (type & 1) {                                    // 怪兽：只用标志位，对齐真实客户端的 [怪兽|效果|调整]
      var flags = [];
      var push = function (bit, name) { if ((type & bit) && flags.indexOf(name) < 0) flags.push(name); };
      push(0x10, '通常'); push(0x20, '效果'); push(0x80, '仪式'); push(0x40, '融合');
      push(0x2000, '同调'); push(0x800000, '超量'); push(0x4000000, '连接');   // ⚠ 超量=0x800000（0x100000 是魔陷的'反击'）
      push(0x1000000, '灵摆'); push(0x1000, '调整'); push(0x4000, '衍生物');
      if (!flags.length && ((meta && meta.typeInfo && meta.typeInfo.monsterCategory) || '')) flags.push(meta.typeInfo.monsterCategory);
      var line = '[怪兽' + (flags.length ? '|' + flags.join('|') : '') + ']';
      var r = raceName(txt && txt.r), a = attrName(txt && txt.a);
      if (r || a) line += ' ' + r + (a ? '/' + a : '');
      return line;
    }
    if (type & 2) {
      var kinds = SPELL_KINDS.filter(function (k) { return type & k[0]; }).map(function (k) { return k[1]; });
      if (!kinds.length) kinds.push('通常');            // 没有速攻/永续/装备/场地/仪式等位 = 通常魔法
      return '[魔法|' + kinds.join('|') + ']';
    }
    if (type & 4) {
      var tk = [];
      if (type & 0x100000) tk.push('反击'); else if (type & 0x20000) tk.push('永续');
      if (!tk.length) tk.push('通常');
      return '[陷阱|' + tk.join('|') + ']';
    }
    return '';
  }
  function statLine(meta, txt) {
    var type = (txt && txt.t) || 0;
    var lv = (meta && meta.level) || 0;
    var s = '';
    if (type & 0x4000000) s = 'L' + lv;                        // 连接：链接值
    else if (type & 1 && lv) s = '★' + lv;
    if (type & 1) {
      var atk = meta && typeof meta.atk === 'number' ? meta.atk : '?';
      var def = meta && typeof meta.def === 'number' ? meta.def : '?';
      if (type & 0x4000000) s += (s ? ' ' : '') + atk + '/—';
      else s += (s ? ' ' : '') + atk + '/' + def;
    }
    return s;
  }
  function loadCardTexts() {
    if (state.cardTexts) return Promise.resolve(state.cardTexts);
    if (state.cardTextsLoading) return state.cardTextsLoading;
    setHud('正在加载卡片信息库…');
    state.cardTextsLoading = fetch('/api/cardtext').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { state.cardTexts = j || {}; logLine('已加载卡片信息库（' + Object.keys(state.cardTexts).length + ' 张）', 'rp-log-hint'); return state.cardTexts; })
      .catch(function () { state.cardTexts = {}; return state.cardTexts; });
    return state.cardTextsLoading;
  }
  function metaOf(code) {
    var m = window.__live && window.__live.cardName ? null : null;
    try { if (state.cardsById && state.cardsById[code]) return state.cardsById[code]; } catch (e) {}
    return null;
  }
  /** 显示左侧卡片信息面板（卡图 + 名称/卡号 + 类别/种族属性 + 等级攻守 + 系列 + 效果文本） */
  function showCardInfo(code) {
    if (!code) return;
    var box = $('ypCardInfo');
    if (!box) return;
    state.infoCode = code;
    // 卡图：**预加载后再替换**（旧图先留着），并且占位框已按卡牌比例固定高度 → 中途不闪、不跳动
    var im = $('ypInfoImg'), hint = $('ypInfoImgHint');
    var chain = (window.__live && window.__live.picChain) ? window.__live.picChain(code) : [code + '.jpg'];
    var probe = new Image();
    var ci = 0;
    probe.onload = function () {
      if (state.infoCode !== code) return;              // 期间又悬停了别的卡 → 丢弃这次结果
      im.src = probe.src;
      im.classList.add('ready');
      if (hint) hint.style.display = 'none';
    };
    probe.onerror = function () { ci++; if (ci < chain.length) probe.src = chain[ci]; };
    if (hint && !im.classList.contains('ready')) hint.style.display = '';
    probe.src = chain[0];
    var meta = metaOf(code);
    var txt = state.cardTexts ? state.cardTexts[code] : null;
    $('ypInfoName').textContent = cardLabel(code) + ' [' + code + ']';
    $('ypInfoType').textContent = typeLine(code, meta, txt) || '';
    $('ypInfoStat').textContent = statLine(meta, txt) || '';
    var sets = setNames(txt ? txt.s : 0);
    $('ypInfoSeries').textContent = sets.length ? ('系列：' + sets.join('、')) : '';
    $('ypInfoText').textContent = txt ? String(txt.d || '（无效果文本）').replace(/\r/g, '') : '（正在加载效果文本…）';
    layoutCardInfo();
    if (!txt) loadCardTexts().then(function () { if (state.infoCode === code) showCardInfo(code); });
  }
  function hideCardInfo() {
    // 面板是**常驻**的（三栏布局的左栏）：鼠标移开只是停止更新，内容留着，方便对照
    state.infoCode = 0;
  }
  function layoutCardInfo() { /* 三栏布局：信息面板是网格左栏，位置由 CSS 决定，无需 JS 摆放 */ }

  // ── 场地点击：点卡弹操作菜单，也是"选卡"，也是"放置" ──
  function onBoardClick(ev) {
    var el = ev.target.closest('[data-zone], [data-pile]');
    if (!el) return;
    var P = state.pending;
    var pileKey = el.getAttribute && el.getAttribute('data-pile');

    // 0) 牌堆：**任何时候都能点开**（不依赖当前有没有待应答的请求）——
    //    真实客户端也是点墓地就能看内容。规则：
    //      · 额外卡组有可特召的怪 → 直接弹"选择要特殊召唤的卡"选择盘；
    //      · 其它牌堆 → 弹小菜单：有可发动效果时给「发动效果」，恒有「查看列表」。
    if (pileKey && /^(grave|removed|extra|deck):/.test(pileKey)) {
      var extraPick = (pileKey === 'extra:0' && P && P.extraActs && P.extraActs.length);
      if (extraPick) { showExtraChooser(P); ev.stopPropagation(); return; }
      showPileMenu(pileKey, { x: ev.clientX, y: ev.clientY });
      ev.stopPropagation();
      return;
    }
    if (!P) return;
    if (!el.getAttribute || !el.getAttribute('data-zone')) return;

    // 1) 点"有操作可做"的卡 → 在鼠标位置弹出操作菜单
    //    规则：① 点在卡面/格位里 → 从点到的那层**往上找**挂操作的元素（格位或卡面）→ 认它；
    //          ② 点在场合格位空白处 → 认格位里的卡（小容差）；
    //          ③ 点在手牌右侧那种空白 → **什么都不做**，绝不"就近猜"。
    if (P.acts && P.acts.size) {
      var pt = { x: ev.clientX, y: ev.clientY };
      var cardEl = actElForClick(el, ev.target, P.acts) || hitActEl(pt.x, pt.y, P.acts, 4);
      if (cardEl) {
        showCardMenu(cardEl, P.acts.get(cardEl), pt);
        ev.stopPropagation();
        return;
      }
      var onCardNo = ev.target.closest ? ev.target.closest('.rp-card') : null;
      if (onCardNo) logLine('（这张卡现在没有可做的操作）', 'rp-log-hint');
      ev.stopPropagation();
      return;                                                          // 空白处：明确不弹任何东西
    }

    if (P.kind === 'place' && P.places) {
      var zone = el.getAttribute('data-zone');       // 普通格位 "0:4:2"，额外怪兽区 "emz:L"/"emz:R"
      var pl = P.places.filter(function (x) { return x._viewZone === zone; })[0];
      if (!pl) return;
      state.picked.push(pl);
      el.classList.add('yp-picked');
      if (state.picked.length >= P.msg.count) { respond(P.msg.prepareResponse(state.picked)); }
      else setHud('已选 ' + state.picked.length + '/' + P.msg.count);
      ev.stopPropagation();
      return;
    }

    if (!P.cands) return;
    // 手牌：点的是第 i 个 .rp-card → 用序号匹配
    var hand = el.classList.contains('rp-hand') ? el.children : null;
    var cand = null;
    for (var i = 0; i < P.cands.length; i++) {
      var cd = P.cands[i];
      if (!cd.el) continue;
      if (cd.el === el) { cand = cd; break; }
      if (hand && cd.el.parentNode === el) cand = cd;
    }
    if (!cand) return;

    if (P.armedMode) {                     // 已选操作类型 → 提交 (index<<16)+type
      var res = P.msg.prepareResponse(P.armedMode.type, YGO.IndexResponse(cand.index));
      respond(res);
      ev.stopPropagation();
      return;
    }
    if (P.kind === 'unselect') {           // 逐张提交
      respond(P.msg.prepareResponse(YGO.IndexResponse(cand.index)));
      ev.stopPropagation();
      return;
    }
    // 多选：切换选中态
    var at = state.picked.indexOf(cand);
    if (at >= 0) { state.picked.splice(at, 1); cand.el.classList.remove('yp-picked'); }
    else {
      if (state.picked.length >= (P.msg.max || 99)) { setHud('最多选 ' + P.msg.max + ' 张', 'warn'); return; }
      state.picked.push(cand);
      cand.el.classList.add('yp-picked');
    }
    renderActionCount();
    maybeAutoSubmit(P);          // 选满就自动确定（单张选择 = 点一下即提交）
    ev.stopPropagation();
  }

  /** 取"这一问该说什么"：优先用服务端刚发的提示文案（strings.conf），否则退回自己的说法。
   *  注意**不要在读取时消费掉** —— 顶部提示条与卡图选择盘都要用同一句（消费了后者就退化成兜底文案）。
   *  真正清空是在 onRequest（存进 P.hintTitle 之后）与 clearPending 里做。 */
  function takeHint(fallback) {
    return (state.pending && state.pending.hintTitle) || state.lastHint || fallback;
  }

  /** 选择盘已打开时，把"凑不出目标"的条目也灰掉（顶部条与盘内状态保持一致） */
  function refreshChooserMarks(P) {
    var box = chooserEl();
    if (!box) return;
    var hidden = (P.cands || []).filter(function (cd) { return cd.hidden; });
    var items = box.querySelectorAll('.yp-chooser-item');
    for (var i = 0; i < items.length; i++) {
      var cap = items[i].querySelector('.yp-cardcap');
      var label = cap ? cap.textContent : '';
      var isHidden = hidden.some(function (cd) { return cardLabel(cd.info.code) === label; });
      items[i].classList.toggle('yp-chooser-weak', isHidden);
      // 玩家要求："不符合条件的卡要从可选项中**消失**"（不是灰着，而是不再出现）
      items[i].style.display = isHidden ? 'none' : '';
      if (!items[i].classList.contains('yp-chooser-on') && !items[i].classList.contains('yp-chooser-fixed')) items[i].disabled = isHidden;
    }
  }

  function renderActionCount() {
    var P = state.pending;
    if (!P) return;
    var min = (P.msg && typeof P.msg.min === 'number') ? P.msg.min : 0;
    var picked = state.picked.length;
    if (P.kind === 'card' || P.kind === 'tribute' || P.kind === 'sum') {
      var txt = '已选 ' + picked + '（需 ' + P.msg.min + '–' + P.msg.max + '）';
      setHud(txt);
      var sumTxt = P.kind === 'sum' ? (sumProgressText(P) || ('　合计 0 / 目标 ' + P.msg.sumVal)) : '';
      showTopBar(takeHintCached(P) + '　已选 ' + picked + sumTxt + (picked >= (P.msg.max || 99) ? '（选满自动确定）' : ''));
      if (P.kind === 'sum') { filterSumCands(P); if (state.chooserOpen) refreshChooserMarks(P); }
      // 「确定」按钮跟着选中数变：没选够就禁用（否则点了没反应，玩家以为卡死 —— 实测被指出）
      var okEl = document.querySelector('#ypPromptBtns [data-key="ok"]');
      if (okEl) {
        okEl.disabled = picked < min;
        okEl.textContent = picked < min ? ('确定（还需选 ' + (min - picked) + ' 张）') : ('确定(' + picked + ')');
      }
    }
    if (P.kind === 'unselect') showTopBar('已选 ' + picked + ' 张（点一下提交一张）');
    if (P.kind === 'place') showTopBar('已选位置 ' + picked + '/' + P.msg.count);
  }

  /** 这一问的标题（顶部提示条 / 卡图选择盘共用同一句） */
  function takeHintCached(P) {
    if (!P.hintTitle) P.hintTitle = takeHint('请选择卡');
    return P.hintTitle;
  }

  /** 选卡类操作：选满上限就自动提交（真实客户端也是这个手感，省掉一次「确定」） */
  /** 已选的那些卡能否**恰好**消耗掉目标合计（每张取 o1 或 o2 之一）——对齐引擎 select_sum_check1 */
  function pickedSumOk(m, picked) {
    if (!m || !m.sumVal) return false;
    var req = (m.mustSelectCards || []).concat(picked.map(function (cd) { return cd.info; })).map(sumOpts);
    var reach = { 0: true };
    for (var i = 0; i < req.length; i++) {
      var next = {};
      Object.keys(reach).forEach(function (s) {
        req[i].forEach(function (v) { var t2 = Number(s) + v; if (t2 <= m.sumVal) next[t2] = true; });
      });
      reach = next;
      if (!Object.keys(reach).length) return false;
    }
    return !!reach[m.sumVal];
  }

  function maybeAutoSubmit(P) {
    var max = (P.msg && typeof P.msg.max === 'number') ? P.msg.max : 0;
    var min = (P.msg && typeof P.msg.min === 'number') ? P.msg.min : 0;
    // SELECT_SUM：合计**恰好**凑到目标就自动确定（和真实客户端一致，玩家不用再点确定；
    //   而且只选了一部分就点确定会被引擎 MSG_RETRY 拒掉 —— 实测玩家踩过）
    if (P.msg && P.msg.sumVal !== undefined && sumGateUsable(P) &&
        state.picked.length >= min && pickedSumOk(P.msg, state.picked)) {
      logLine('（合计已凑满 ' + P.msg.sumVal + ' → 自动确定）', 'rp-log-hint');
      hideChooser();
      submitMulti(P);
      return true;
    }
    if (!max) return false;
    if (state.picked.length < max) return false;
    logLine('（已选满 ' + max + ' 张 → 自动确定）', 'rp-log-hint');
    hideChooser();
    submitMulti(P);
    return true;
  }

  // ─────────────────────────────── 动作条

  // ─────────────────────────────── 界面层：居中弹窗 + 场地控件条
  //
  // 参照真实客户端：
  //   · 选择类提示（诱发时点 / 是否连锁 / 表示形式 / 猜拳…）弹在**场地正中间**；
  //   · 阶段与战阶/结束回合贴在**场地中线**上：左=当前阶段，中=进战阶（战阶中变"进主要阶段2"），
  //     右=结束回合；
  //   · 卡片操作菜单出现在**鼠标位置**。

  function fieldRect() {
    var el = $('replayField');
    var r = el && el.getBoundingClientRect();
    return (r && r.width > 40) ? r : null;
  }
  /** 把弹窗与控件条摆到场地上的位置（场地尺寸/窗口变化后要重摆） */
  function layoutOverlays() {
    var r = fieldRect();
    var pr = $('ypPrompt');
    if (!r) {
      // 还没进场（大厅/猜拳/先后攻阶段没有场地）→ 弹窗居中在视口里，别挤在左上角
      if (pr && pr.style.display !== 'none') {
        var w0 = pr.offsetWidth, h0 = pr.offsetHeight;
        pr.style.left = Math.round(Math.max(8, (window.innerWidth - w0) / 2)) + 'px';
        pr.style.top = Math.round(Math.max(96, (window.innerHeight - h0) / 2 - 40)) + 'px';
      }
      return;
    }
    var ctl = $('ypCtl');
    if (ctl) {
      // 控件条贴在场地"中线"上：优先用**额外怪兽区**(emz)那条带子对齐 —— 它就是场地正中间那一行，
      // 比按 fieldRect 高度取 50% 精确（场地上下有牌堆/墓地等不对称区域，取 50% 会看着"错位"）。
      var emz = document.querySelector('[data-zone="emz:L"]') || document.querySelector('[data-zone="emz:R"]');
      var lineY = emz ? (emz.getBoundingClientRect().top + emz.getBoundingClientRect().height / 2) : (r.top + r.height * 0.5);
      ctl.style.left = Math.round(r.left + 10) + 'px';
      ctl.style.top = Math.round(lineY - 16) + 'px';
      ctl.style.width = Math.round(r.width - 20) + 'px';
    }
    var pr = $('ypPrompt');
    if (pr && pr.style.display !== 'none') {
      var w = pr.offsetWidth, h = pr.offsetHeight;
      pr.style.left = Math.round(r.left + (r.width - w) / 2) + 'px';
      // 选择盘开着时把提示条挪到场地下方，免得两层叠在一起（点不到的假按钮）
      var frac = state.chooserOpen ? 0.84 : 0.42;
      pr.style.top = Math.round(r.top + r.height * frac - h / 2) + 'px';
    }
    layoutTopBar();
  }

  function showActions(btns, title, opts) {
    var box = $('ypPromptBtns');
    var ttl = $('ypPromptTitle');
    var panel = $('ypPrompt');
    if (!box || !panel) return;
    // vertical：竖向排列（猜拳/先后攻这类"上下选择"的按钮，对齐真实客户端的上下布局）
    box.classList.toggle('yp-prompt-vertical', !!(opts && opts.vertical));
    box.innerHTML = '';
    btns.forEach(function (b) { box.appendChild(makeBtn(b)); });
    if (ttl) { ttl.textContent = title || ''; ttl.style.display = title ? '' : 'none'; }
    panel.style.display = btns.length ? 'flex' : 'none';
    layoutOverlays();
  }
  function hidePrompt() { var p = $('ypPrompt'); if (p) p.style.display = 'none'; }

  /** 场地顶部的进度提示条（"请选择要作为同调素材的卡(3/6)"这类，参照真实客户端） */
  function showTopBar(text) {
    var el = $('ypTopBar');
    if (!el) return;
    el.textContent = text || '';
    el.style.display = text ? 'block' : 'none';
    layoutTopBar();
  }
  function hideTopBar() { var el = $('ypTopBar'); if (el) el.style.display = 'none'; }
  function layoutTopBar() {
    var el = $('ypTopBar');
    if (!el || el.style.display === 'none') return;
    var r = fieldRect();
    var w = el.offsetWidth;
    if (r) {
      el.style.left = Math.round(r.left + (r.width - w) / 2) + 'px';
      el.style.top = Math.round(r.top + 8) + 'px';
    } else {
      el.style.left = Math.round(Math.max(8, (window.innerWidth - w) / 2)) + 'px';
      el.style.top = '80px';
    }
  }

  /** 场地控件条的期望状态：setFieldCtl 记录，refreshPhaseLabel 每次消息后重新套用（保活） */
  var ctlState = { phase: '', mid: null, right: null, utils: null };

  /**
   * 把控件条同步成"当前 pending 该有的样子"。
   * 按钮是 state.pending 的纯函数：这样每来一条消息（refreshPhaseLabel）重画也不会
   * 把已有的战阶/结束回合按钮冲掉，也不会在 pending 结束后留下残影。
   */
  function syncCtl() {
    var c = (state.pending && state.pending.ctl) || null;
    applyCtl({
      phase: currentPhaseText(),
      mid: c && c.mid ? c.mid : null,
      right: c && c.right ? c.right : null,
      utils: c && c.utils ? c.utils : null,
    });
  }

  function applyCtl(st) {
    ctlState.phase = st.phase || '';
    ctlState.mid = st.mid || null;
    ctlState.right = st.right || null;
    ctlState.utils = st.utils || null;
    var ph = $('ypPhase'), m = $('ypCtlMid'), rt = $('ypCtlRight'), ut = $('ypUtil');
    if (ph) ph.textContent = ctlState.phase;
    var mk = function (host, btn) {
      if (!host) return;
      host.innerHTML = '';
      if (!btn) return;
      var el = document.createElement('button');
      el.className = 'yp-btn';
      el.textContent = btn.t;
      el.disabled = !!btn.disabled;
      el.onclick = btn.f;
      host.appendChild(el);
    };
    mk(ut, ctlState.utils && ctlState.utils.length ? ctlState.utils[0] : null);
    if (ut && ctlState.utils) {
      for (var i = 1; i < ctlState.utils.length; i++) {
        var el2 = document.createElement('button');
        el2.className = 'yp-btn';
        el2.textContent = ctlState.utils[i].t;
        el2.onclick = ctlState.utils[i].f;
        ut.appendChild(el2);
      }
    }
    mk(m, ctlState.mid);
    mk(rt, ctlState.right);
    var ctl = $('ypCtl');
    // 用 grid 显示（见 play.html：1fr auto 1fr 才能让中间按钮真正居中），不能写死 flex
    if (ctl) ctl.style.display = (ctlState.phase || ctlState.mid || ctlState.right || (ctlState.utils && ctlState.utils.length)) ? 'grid' : 'none';
    layoutOverlays();
  }
  /** 当前阶段：读查看器已经算好的阶段/回合文本 */
  function currentPhaseText() {
    var turn = document.querySelector('.rp-turn-label');
    var ph = document.querySelector('.rp-phase');
    var t = (turn && turn.textContent) || '';
    var p = (ph && ph.textContent) || '';
    return (t + ' ' + p).trim() || '对战进行中';
  }
  function refreshPhaseLabel() {
    syncCtl();
  }

  // ─────────────────────────────── 绑定

  // ── 客户端错误上报（阶段 A：线上可诊断）──
  //   为什么必须有：玩家只会说"卡住了"，没有堆栈就无法定位（这几天的 bug 全靠玩家描述 + 我猜 ✗）。
  //   做法：捕获未处理异常/未处理的 Promise 拒绝 → 记进对局日志 + 附最近 30 条报文号，
  //        并 POST 到站点接口（本地由 serve.mjs 的 /api/clientlog 收集，生产由官网接管 ✓）。
  (function __ypErrHook() {
    var seen = 0;
    function report(kind, detail, stack) {
      if (seen++ > 20) return;                       // 防刷屏
      var recent = (state && state.recentIds ? state.recentIds.slice(-30) : []);
      var payload = {
        kind: kind, detail: String(detail || ''), stack: String(stack || '').split('\n').slice(0, 6).join(' | '),
        room: (state && state.room) || '', name: (state && state.name) || '',
        seat: state ? state.mySeat : -1, duelPos: state ? state.myDuelPos : -1,
        pendingKind: (state && state.pending && state.pending.kind) || '',
        url: location.href, ua: navigator.userAgent, when: new Date().toISOString(), recentIds: recent,
      };
      try { logLine('⚠ 客户端异常[' + kind + ']：' + payload.detail + '（已上报）', 'rp-log-err'); } catch (e) {}
      try {
        fetch('/api/clientlog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .catch(function () {});
      } catch (e) {}
    }
    window.addEventListener('error', function (e) {
      report('error', (e && e.message) || 'unknown', e && e.error && e.error.stack);
    });
    window.addEventListener('unhandledrejection', function (e) {
      var r = e && e.reason;
      report('promise', (r && r.message) || r, r && r.stack);
    });
  })();

  document.addEventListener('DOMContentLoaded', function () {
    // 房间页不显示对局页面：一进页面就收起盘面/日志，对局开始(onDuelStart)再展开
    setUiPhase('room');       // 一进页面就是房间界面（盘面隐藏），首帧不做动画
    // 本地联调（URL 带 ?room=）时露出「昵称 / 房间名 / 加入房间」这一行；正式天梯不显示
    try {
      var qs0 = new URLSearchParams(location.search);
      var row0 = $('roomJoinRow');
      if (row0 && qs0.get('room')) {
        row0.style.display = '';
        if ($('inRoom')) $('inRoom').value = qs0.get('room');
        if ($('inName') && qs0.get('name')) $('inName').value = qs0.get('name');
      }
    } catch (e) {}
    // ⚠ 这里**不能**放房间面板的渲染：它曾在最前面抛异常（playerNames 为 undefined），
    //   打断整个处理器 → 所有按钮都没绑定 → "填了房间名点加入没反应"（实测被反馈）。
    //   现在渲染挪到本处理器**最后**（各自 try/catch，见下方）。
    $('replayField').addEventListener('click', onBoardClick, true);
    // 悬停卡片 → 左侧信息面板（参照真实客户端）；点卡时也会显示（showCardMenu 里已接）
    $('replayField').addEventListener('mouseover', function (ev) {
      var card = ev.target.closest ? ev.target.closest('.rp-card') : null;
      if (!card) return;
      var img = card.querySelector('img');
      var code = 0;
      if (img) { var m = String(img.getAttribute('src') || '').match(/(\d+)\.jpg/); if (m) code = Number(m[1]); }
      if (code && code !== state.infoCode) showCardInfo(code);
    }, true);
    $('replayField').addEventListener('mouseout', function (ev) {
      var to = ev.relatedTarget;
      if (to && to.closest && (to.closest('#ypCardInfo') || to.closest('.rp-card'))) return;  // 移到面板/另一张卡 → 不关
      hideCardInfo();
    }, true);
    // 场地尺寸随窗口变化 → 重摆弹窗、控件条与卡牌选择盘
    window.addEventListener('resize', function () { layoutOverlays(); layoutChooser(); layoutCardInfo(); });
    setInterval(function () {
      // ── 相位看门狗：房间/对局两块 UI 的显隐**每秒校正一次**。
      //    为什么需要它：查看器（replay-viewer）自己会在收到对局消息时把盘面 display 打开，
      //    与我的相位切换打架 → 出现"猜拳时房间 UI 没退场""进对局后看不见盘面"（实测被反馈）。
      try {
        var wantRoom = state.uiPhase !== 'duel';
        var mEl = $('replayModal'), lEl = $('lobby');
        if (mEl) mEl.style.display = wantRoom ? 'none' : '';
        if (lEl) lEl.style.display = wantRoom ? '' : 'none';
      } catch (e) {}
      if (state.duelStarted) {
        layoutOverlays(); if (state.chooserOpen) layoutChooser(); refreshPhaseLabel();
        markPilesForPending();        // 牌堆发光会被高亮清理抹掉 → 每秒重挂一次（自愈）
        renderDeckTops();             // 卡组公开时（天变地异等）画出顶端那张
      }
    }, 1000);
    // 点别处就收起卡片菜单（capture：先于场地点击，点另一张卡时旧的先关掉）
    document.addEventListener('click', function (ev) {
      var m = menuEl();
      if (!m) return;
      if (m.contains(ev.target)) return;
      hideCardMenu();
    }, true);
    // 房间面板的静态渲染：**放在所有事件绑定之后**，并且各自 try/catch ——
    // 之前它排在最前面，一处抛异常就打断整个处理器 → 所有按钮都没绑定 →
    // 玩家看到的是"填了房间名点加入没反应"（实测被反馈）。UI 小毛病绝不能拖死交互。
    [['决斗者名单', renderRoomPlayers], ['房间规则', renderRoomRules], ['卡组名', showDeckName]].forEach(function (p) {
      try { p[1](); } catch (e) { console.warn('房间面板渲染失败(' + p[0] + ')：' + e.message); }
    });
    $('btnJoin').onclick = function () {
      // 昵称：账号名 > 输入框 > **按房间记住的昵称**（换名重进会在房间留下"另一个我" ✗）
      state.name = accountName() || $('inName').value.trim() || nameForRoom($('inRoom').value.trim() || state.room);
      state.room = $('inRoom').value.trim() || state.room;
      joinRoom();
    };
    $('btnReady').onclick = uploadDeckAndReady;
    // 换个随机房间名：断线后想开新局时最省事（旧房间席位会被服务端保留约 3 分钟，不能复用）
    var rr = $('btnRandRoom');
    if (rr) rr.onclick = function () {
      var r = 'try-' + Math.random().toString(36).slice(2, 6);
      state.room = r;
      $('inRoom').value = r;
      logLine('↻ 已换房间名：' + r + '（新局需要对手进程也在这个房间：`node duel.mjs --solo --room ' + r + '`）', 'rp-log-hint');
      setHud('房间名已换成 ' + r + ' → 点「加入房间」开新局', 'ok');
    };
    // 「开始决斗」：**不要禁用**（禁用按钮点了没反应 → 玩家以为界面坏了，实测被反馈）。
    // 保持可点，点的时候把"还差什么"直接说出来。
    // 卡组选择下拉：选中即从服务器 deck 目录载入
    var imp = $('btnImportDeck');
    if (imp) imp.onclick = function () { var f = $('ydkFile'); if (f) f.click(); };
    var deal = $('deckList');
    if (deal) deal.onchange = function () { pickDeckFromServer(deal.value); };
    // → 观战：把座位让出来（真实客户端也是这个按钮）
    var ob = $('btnObserver');
    if (ob) ob.onclick = function () {
      try { send(new YGO.YGOProCtosHsToObserver()); logLine('→ 转为观战者（座位让出）', 'rp-log-hint'); }
      catch (e) { logLine('转观战失败：' + e.message, 'rp-log-err'); }
    };
    // 退出房间：断开连接、回大厅（可换房间名/昵称再进）
    var ex = $('btnExit');
    if (ex) ex.onclick = function () {
      try { if (state.sock) state.sock.close(); } catch (e) {}
      state.duelStarted = false; state.mySeat = -1; state.myDuelPos = -1; state.readySent = false;
      setUiPhase('room'); renderLobby();
      logLine('已退出房间（可换房间名或昵称再进）', 'rp-log-phase');
      setHud('已退出房间', 'warn');
    };
    $('btnStart').onclick = function () {
      var bothReady = !!(state.ready[0] && state.ready[1]);
      if (!bothReady) {
        var meReady = state.mySeat >= 0 ? !!state.ready[state.mySeat] : false;
        var msg = !meReady ? '还不能开始：**你还没点「准备」**（先点左边的「准备」上传卡组）'
                           : '还不能开始：**对手还没准备**（等对手点「准备」）';
        setHud(msg.replace(/\*\*/g, ''), 'warn');
        logLine('⚠ ' + msg.replace(/\*\*/g, ''), 'rp-log-err');
        return;
      }
      logLine('→ 发 CTOS_HS_START（开始决斗）', 'rp-log-hint');
      send(new YGO.YGOProCtosHsStart());
    };
    $('ydkFile').onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          state.deck = YGO.YGOProDeck.fromYdkString(String(reader.result));
          logLine('已载入卡组：' + f.name + '（主 ' + state.deck.main.length + ' / 额外 ' + state.deck.extra.length + ' / 副 ' + state.deck.side.length + '）');
        } catch (err) { setHud('卡组解析失败：' + err.message, 'err'); }
      };
      reader.readAsText(f, 'utf-8');
    };
    // 鼠标移到候选卡上给个提示
    $('inName').value = state.name;
    $('inRoom').value = state.room;
    setHud('填房间名 → 加入');

    // ?ydk=<url> ：自动载入指定卡组（本机测试用；接官网时改成读玩家在官网保存的卡组接口）
    var ydkUrl = q.get('ydk');
    if (ydkUrl) {
      fetch(ydkUrl).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (txt) {
          state.deck = YGO.YGOProDeck.fromYdkString(txt);
          logLine('已载入卡组 ' + ydkUrl + '（主 ' + state.deck.main.length + ' / 额外 ' + state.deck.extra.length + ' / 副 ' + state.deck.side.length + '）');
        })
        .catch(function (e) { setHud('卡组载入失败：' + e.message, 'err'); });
    }
    // ?auto=1 ：进页面就自动加入 + 准备（自动化测试用）
    if (q.get('lflist') !== null) {
      state.lflist = Number(q.get('lflist'));        // -1 = 无禁限；0/1/2… = 第 N 个表（从 0 数）
      fetch('/api/lflists').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (j && j.names && state.lflist >= 0 && j.names[state.lflist]) {
          state.lflistName = j.names[state.lflist];
          logLine('卡表：第 ' + state.lflist + ' 个「' + state.lflistName + '」（共 ' + j.count + ' 个）', 'rp-log-hint');
        } else if (state.lflist === -1) {
          logLine('卡表：无禁限（lflist=-1，服务端用空表 blankLFList）', 'rp-log-hint');
        }
      }).catch(function () {});
    }
    if (q.get('auto') === '1') setTimeout(function () { joinRoom(); setTimeout(uploadDeckAndReady, 1500); }, 300);
    // 天梯：没有 ?room=（即不是本地联调）就**自动进匹配队列**，玩家不需要点任何按钮
    if (!q.get('room')) setTimeout(function () {
      state.room = ladderRoom();
      // ⚠ 昵称按**房间**固定：否则换名重进会在房间里留下"另一个我"（服务端按昵称保留席位 ✗）
      state.name = nameForRoom(state.room);
      logLine('天梯：自动进入匹配（房间 ' + state.room + '，账号 ' + state.name + '）', 'rp-log-phase');
      joinRoom();
    }, 400);
  });

  // 调试/自动化探针（也方便你自己在控制台里看状态）
  window.__yp = {
    state: function () {
      return {
        seat: state.mySeat, isHost: state.isHost, duelPos: state.myDuelPos,
        joined: state.joined, started: state.duelStarted,
        ready: state.ready, retries: state.retries || 0, responses: state.responses || 0,
        pendingKind: state.pending ? state.pending.kind : null,
        pendingName: state.pending ? state.pending.msg.constructor.name : null,
        pendingMin: state.pending && state.pending.msg && typeof state.pending.msg.min === 'number' ? state.pending.msg.min : null,
        pendingMax: state.pending && state.pending.msg && typeof state.pending.msg.max === 'number' ? state.pending.msg.max : null,
        chooser: !!state.chooserOpen,
        /** 额外牌堆上的角标（几只能特召）与提示条是否在挡场地 —— 排查"浮窗挡住操作"用 */
        extraActs: state.pending && state.pending.extraActs ? state.pending.extraActs.length : 0,
        extraBadge: (function () {
          var b = document.querySelector('[data-pile="extra:0"] .yp-pile-badge');
          return b ? b.textContent : null;
        })(),
        promptShown: (function () {
          var p = $('ypPrompt');
          return !!(p && p.style.display !== 'none');
        })(),
        promptText: (function () {
          var p = $('ypPrompt');
          return p && p.style.display !== 'none' ? ($('ypPromptBtns') || {}).textContent || '' : '';
        })(),
        lastFromHand: state.lastFromHand || null,          // 服务端实际执行的"从手牌出场"
        lastSummoning: state.lastSummoning || null,
        lastSearch: state.lastSearch || null,              // 服务端实际执行的"卡组 → 手牌"（黑旋风这类检索）
        lastPosChange: state.lastPosChange || null,        // 服务端实际执行的表示形式变更
        recentIds: (state.recentIds || []).slice(-16),     // 最近收到的报文号（排查用）
        lastResponse: state.lastResponse || null,          // 最近一次发出的应答（RETRY 排查用）
        picked: state.picked.length, armed: state.armedMode ? state.armedMode.type : null,
      };
    },
    actions: function () {
      return Array.prototype.map.call(document.querySelectorAll(YP_BTN_SEL), function (b) { return b.textContent; });
    },
    click: function (text) {
      var btns = Array.prototype.slice.call(document.querySelectorAll(YP_BTN_SEL));
      var b = btns.filter(function (x) { return x.textContent.indexOf(text) >= 0; })[0];
      if (!b) return false;
      b.click();
      return true;
    },
    /** 场地左侧的阶段文本 / 中线中间按钮（战阶/主二）*/
    phase: function () { return ($('ypPhase') || {}).textContent || ''; },
    /** 控件条期望状态（诊断用） */
    ctl: function () {
      return {
        phase: ctlState.phase,
        mid: ctlState.mid ? ctlState.mid.t : null,
        right: ctlState.right ? ctlState.right.t : null,
        utils: ctlState.utils ? ctlState.utils.map(function (u) { return u.t; }) : null,
        domRight: (($('ypCtlRight') || {}).innerHTML || ''),
      };
    },
    clickPick: function (n) {
      var els = document.querySelectorAll('#replayField .yp-pick');
      if (!els[n || 0]) return false;
      els[n || 0].click();
      return true;
    },
    /**
     * UI 预览（不过真实对局）：把某个面板用假数据画出来，方便看卡图按钮长什么样。
     *   __yp.preview('position', { code: 3040496 })        // 攻/守表示形式（卡图：正放 / 横放 / 卡背）
     *   __yp.preview('chain', { chains: [{code, forced}] })// 连锁发动（卡图按钮）
     *   __yp.preview('yesno', { code: 3040496 })            // 是否发动
     */
    preview: function (what, opts) {
      opts = opts || {};
      state.previewMode = true;
      state.picked = [];
      var stub = {
        identifier: what === 'position' ? 19 : what === 'chain' ? 16 : what === 'card' ? 15 : what === 'option' ? 14 : what === 'sum' ? 23 : 12,
        options: opts.options || [],
        mustSelectCards: opts.mustSelectCards || [],
        sumVal: opts.sumVal || 0,
        selectableCards: opts.selectableCards || [],
        activatableCards: opts.activatableCards || [],
        summonableCards: opts.summonableCards || [],
        spSummonableCards: opts.spSummonableCards || [],
        msetableCards: opts.msetableCards || [],
        ssetableCards: opts.ssetableCards || [],
        reposableCards: opts.reposableCards || [],
        attackableCards: opts.attackableCards || [],
        unselectableCards: opts.unselectableCards || [],
        code: opts.code || 3040496,
        positions: opts.positions !== undefined ? opts.positions : (0x1 | 0x4),
        chains: opts.chains || [],
        cards: opts.cards || [],
        min: opts.min !== undefined ? opts.min : 1,
        max: opts.max !== undefined ? opts.max : 1,
        cancelable: opts.cancelable ? 1 : 0,
        selectableCount: 0,
        prepareResponse: function () { return null; },
        defaultResponse: function () { return null; },
      };
      if (what === 'card' || what === 'sum' || what === 'unselect') state.lastHint = opts.hint || '';   // 顶部提示条会用它当标题
      state.pending = { msg: stub, kind: what, raw: opts.raw || null };
      renderPending();
      return true;
    },
    /** 手牌 DOM 实况：每张卡的卡号/名字/屏幕矩形/它能做的操作（含发出去的下标）——排查"选错卡"用 */
    handInfo: function () {
      var out = [];
      var cont = document.querySelector('[data-zone="0:2"]');
      if (!cont) return out;
      var acts = (state.pending && state.pending.acts) || null;
      Array.prototype.forEach.call(cont.children, function (el, i) {
        var img = el.querySelector('img');
        var code = img ? Number((String(img.getAttribute('src')).match(/(\d+)\.jpg/) || [])[1] || 0) : 0;
        var r = el.getBoundingClientRect();
        var my = acts && acts.get(el) ? acts.get(el) : [];
        out.push({
          dom: i, code: code, title: el.getAttribute('title') || '',
          rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
          acts: my.map(function (a) { return a.label + '#' + a.index; }),
          // 挂在这个元素上的候选"自称是哪张卡" —— 与元素显示的卡号不一致就说明 seq 漂移了
          actsInfo: my.map(function (a) {
            var o = a.info || {};
            return { label: a.label, index: a.index, code: o.code, seq: o.sequence, location: o.location, controller: o.controller };
          }),
        });
      });
      return out;
    },
    /** 立即重画卡组顶端，并返回侧通道内容（自检用） */
    /** 自检用：在指定格子上播放动画（'rot' 旋转 / 'flip' 翻面），返回命中的格位 */
    animTest: function (ctl, loc, seq, mode) { animateZoneKey(flipSeat(ctl), loc, seq, mode); return viewZoneOf({ controller: ctl, location: loc, sequence: seq }); },
    deckTops: function () {
      renderDeckTops();
      return { deck: window.__ypDeck || null, extra: window.__ypExtra || null };
    },
    /** 菜单项顺序（调试/自检用）：idle / battle 两组各按什么顺序排 */
    actionGroups: function () {
      var out = {};
      Object.keys(ACTION_GROUPS).forEach(function (k) { out[k] = ACTION_GROUPS[k].map(function (g) { return g[0]; }); });
      return out;
    },
    /** 打开/关闭逐条消息的 debug 日志（等价于 URL 上的 ?debug=1，但可以运行时开） */
    setDebug: function (on) { state.debug = !!on; return state.debug; },
    /** 额外卡组牌堆（点了会弹"可以出场的怪兽"选择盘） */    clickExtraPile: function () {
      var el = document.querySelector('[data-pile="extra:0"]');
      if (!el) return false;
      el.click();
      return true;
    },
    /** 居中选择盘：列出条目文本；clickChooser 点第 n 个 */
    chooser: function () {
      var box = document.getElementById('ypChooser');
      if (!box) return null;
      return {
        title: (box.querySelector('.yp-chooser-title') || {}).textContent || '',
        items: Array.prototype.map.call(box.querySelectorAll('.yp-chooser-item'), function (b) {
          return (b.querySelector('.yp-cardcap') || {}).textContent || b.textContent;
        }),
      };
    },
    clickChooser: function (n) {
      var box = document.getElementById('ypChooser');
      if (!box) return false;
      var items = box.querySelectorAll('.yp-chooser-item');
      if (!items[n || 0]) return false;
      items[n || 0].click();
      return true;
    },
    /** 当前提示面板里的按钮（含卡图按钮的说明文字） */
    promptButtons: function () {
      return Array.prototype.map.call(document.querySelectorAll('#ypPromptBtns .yp-btn'), function (b) {
        return {
          text: (b.querySelector('.yp-cardcap') || {}).textContent || b.textContent,
          hasImg: !!b.querySelector('.yp-cardimg'),
          rotated: b.classList.contains('yp-rot'),
          faceDown: !!(b.querySelector('.yp-cardimg') || {}).classList ? b.querySelector('.yp-cardimg').classList.contains('yp-cardback') : false,
        };
      });
    },
    /** 当前弹出的卡片菜单项（没有菜单就是空数组） */
    menu: function () {
      return Array.prototype.map.call(document.querySelectorAll('#ypCardMenu .yp-menu-item'), function (b) { return b.textContent; });
    },
    clickMenu: function (text) {
      var items = Array.prototype.slice.call(document.querySelectorAll('#ypCardMenu .yp-menu-item'));
      var b = items.filter(function (x) { return x.textContent.indexOf(text) >= 0; })[0];
      if (!b) return false;
      b.click();
      return true;
    },
    /** 有多少张卡是"可操作"的（会弹菜单的） */
    actCards: function () { return document.querySelectorAll('#replayField .yp-act').length; },
    /**
     * 自动化用：在当前 pending 里挑一个操作执行（点卡 → 点菜单项）。
     * want 是标签优先级数组，如 ['盖放','召唤']；**按 want 的顺序**找，而不是按卡自己的动作顺序
     * （否则"优先盖放"会被写成"先召唤"—— 自动化测试就吃过这个亏）。
     */
    playAction: function (want) {
      var P = state.pending;
      if (!P || !P.acts || !P.acts.size) return false;
      var prefers = (want && want.length) ? [].concat(want) : null;
      var chosen = null;
      if (prefers) {
        for (var pi = 0; pi < prefers.length && !chosen; pi++) {
          P.acts.forEach(function (list, el) {
            if (chosen) return;
            for (var i = 0; i < list.length; i++) {
              if (list[i].label === prefers[pi]) { chosen = { el: el, act: list[i] }; return; }
            }
          });
        }
      } else {
        P.acts.forEach(function (list, el) { if (!chosen) chosen = { el: el, act: list[0] }; });
      }
      if (!chosen) return false;
      showCardMenu(chosen.el, P.acts.get(chosen.el));
      var items = Array.prototype.slice.call(document.querySelectorAll('#ypCardMenu .yp-menu-item'));
      var b = items.filter(function (x) { return x.textContent === chosen.act.label; })[0];
      if (!b) { hideCardMenu(); return false; }
      b.click();
      return true;
    },
    /** 自动化用：按**操作类型**精确执行（0召唤/1特召/2变更表示形式/3怪兽盖放/4魔陷盖放/5发动效果） */
    playActionType: function (type) {
      var P = state.pending;
      if (!P || !P.acts || !P.acts.size) return false;
      var chosen = null;
      P.acts.forEach(function (list, el) {
        if (chosen) return;
        for (var i = 0; i < list.length; i++) if (list[i].type === type) { chosen = { el: el, act: list[i] }; return; }
      });
      if (!chosen) return false;
      showCardMenu(chosen.el, P.acts.get(chosen.el));
      var items = Array.prototype.slice.call(document.querySelectorAll('#ypCardMenu .yp-menu-item'));
      var b = items.filter(function (x) { return x.textContent === chosen.act.label; })[0];
      if (!b) { hideCardMenu(); return false; }
      b.click();
      return true;
    },
    debug: function () {
      var P = state.pending;
      var hands = {};
      Array.prototype.forEach.call(document.querySelectorAll('.rp-hand'), function (el) {
        hands[el.getAttribute('data-zone')] = el.children.length;
      });
      return {
        pendingKind: P ? P.kind : null,
        armed: P && P.armedMode ? P.armedMode.type : null,
        candCount: P && P.cands ? P.cands.length : 0,
        candWithEl: P && P.cands ? P.cands.filter(function (c) { return !!c.el; }).length : 0,
        candSample: P && P.cands ? P.cands.slice(0, 4).map(function (c) {
          return { loc: c.info.location, ctl: c.info.controller, seq: c.info.sequence, idx: c.index, hasEl: !!c.el };
        }) : [],
        pickEls: document.querySelectorAll('#replayField .yp-pick').length,
        hands: hands,
        handHtmlLen: (document.querySelector('.rp-hand') || {}).innerHTML ? document.querySelector('.rp-hand').innerHTML.length : 0,
      };
    },
  };
})();
