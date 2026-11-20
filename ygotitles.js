#!/usr/bin/env node
/**
 * 白神服 · 天梯娱乐称号（隐藏成就）
 *
 * 只统计天梯随机匹配（duel_record.name LIKE 'M,RANDOM#%'）。
 * 称号写入 srv_user.titles —— 只在个人中心与游戏内可见，站内不做任何提示。
 *
 * 成就列表见 ACHIEVEMENTS 注释（条件对玩家隐藏）。
 *
 * 用法：
 *   node ygotitles.js                        # 增量扫描
 *   node ygotitles.js --backfill 2000        # 回扫最近 N 条天梯记录（全部成就）
 *   node ygotitles.js --special-backfill 999999  # 只回扫特殊胜利任务称号（快）
 *   node ygotitles.js --dry                  # 只打印判定，不写库
 *   node ygotitles.js --verbose              # 打印每局解析结果
 */

const { Client } = require('/root/servers/ygopro/srvpro-siro/node_modules/pg');

const PG = { host: '127.0.0.1', port: 5432, user: 'postgres', password: 'jwyxym', database: 'srvpro2_siro' };
const REPLAY_BASE = 'http://127.0.0.1:8092/api/forum/replay/';
const LADDER_LIKE = 'M,RANDOM#%';

/**
 * 特殊胜利 → 任务称号（紫色，不在商店出售）。
 * type = replay 里 Win.f.type，也就是客户端的 victory 码。
 * cards = 必须在这局回放里出现过的卡（防止服务器注入码误判：
 *   例如死三/比赛超时也会写 0x11，但它没有「终焉的倒计时」这张卡）。
 */
const SPECIAL_WINS = [
  { type: 0x10, title: '唤起奇迹之人', cards: [33396948, 33396949, 33396950], name: '被封印的艾克佐迪亚' },
  { type: 0x11, title: '终焉已至',     cards: [95308449], name: '终焉的倒计时' },
  { type: 0x12, title: '蛇神降临',     cards: [8062132],  name: '毒蛇神 维诺米纳迦' },
  { type: 0x13, title: '神！',         cards: [10000040], name: '光之创造神 哈拉克提' },
  { type: 0x15, title: '死灵的主人',   cards: [94212438], name: '通灵盘' },
  { type: 0x17, title: '命运的交响曲', cards: [48995978, 6165656], name: 'No.88 机关傀儡-命运狮子' },
  { type: 0x1c, title: '水至天祸',     cards: [97795930], name: '幻煌龙的天涡' },
  { type: 0x1e, title: '小飞象来咯',   cards: [66765023], name: '飞行象' },
  { type: 0x21, title: '编号的起点与终点', cards: [15862758], name: '混沌虚数No.1000 梦幻虚光神 原数天灵·原数天地' },
  { type: 0x23, title: '致命五连击',   cards: [64502301], name: '电子龙·集流体' },
  { type: 0x50, title: '完全态',       cards: [49811595], name: '鳞翅帝-内生攻击者' },
];
const SPECIAL_BY_TYPE = new Map(SPECIAL_WINS.map(x => [x.type, x]));

const DRY = process.argv.includes('--dry');
const VERBOSE = process.argv.includes('--verbose');
const backfillArg = process.argv.indexOf('--backfill');
const BACKFILL = backfillArg > 0 ? parseInt(process.argv[backfillArg + 1], 10) || 0 : 0;
const specialArg = process.argv.indexOf('--special-backfill');
const SPECIAL_BACKFILL = specialArg > 0 ? parseInt(process.argv[specialArg + 1], 10) || 0 : 0;

const DDL = `
CREATE TABLE IF NOT EXISTS ygo_title_award (
    "accountName"  varchar(64)  NOT NULL,
    title          varchar(64)  NOT NULL,
    "duelRecordId" bigint       NOT NULL,
    detail         text         NOT NULL DEFAULT '',
    "achievedAt"   timestamp    NOT NULL DEFAULT now(),
    PRIMARY KEY ("accountName", title)
);
CREATE TABLE IF NOT EXISTS ygo_title_state (
    key   varchar(64) PRIMARY KEY,
    value text        NOT NULL
);
CREATE TABLE IF NOT EXISTS ygo_daily_win (
    "accountName" varchar(64) NOT NULL,
    "winDate"     date        NOT NULL,
    PRIMARY KEY ("accountName", "winDate")
);
CREATE TABLE IF NOT EXISTS ygo_daily_duel (
    "accountName" varchar(64) NOT NULL,
    "duelDate"    date        NOT NULL,
    PRIMARY KEY ("accountName", "duelDate")
);
CREATE TABLE IF NOT EXISTS ygo_duel_stat (
    "recordId"        bigint      NOT NULL,
    "accountName"     varchar(64) NOT NULL,
    won               boolean     NOT NULL DEFAULT false,
    "maxHit"          integer     NOT NULL DEFAULT 0,
    "maxTurnDamage"   integer     NOT NULL DEFAULT 0,
    "effectDamage"    integer     NOT NULL DEFAULT 0,
    recovered         integer     NOT NULL DEFAULT 0,
    "finalLp"         integer     NOT NULL DEFAULT 8000,
    "minLp"           integer     NOT NULL DEFAULT 8000,
    "handEmpty"       boolean     NOT NULL DEFAULT false,
    "fieldEmpty"      boolean     NOT NULL DEFAULT false,
    "noSummon3"       boolean     NOT NULL DEFAULT false,
    "playedOn"        date        NOT NULL,
    PRIMARY KEY ("recordId", "accountName")
);
`;

async function ensureSchema(c) { await c.query(DDL); }

async function stateGet(c, key, def) {
  const r = await c.query('SELECT value FROM ygo_title_state WHERE key=$1', [key]);
  return r.rows.length ? r.rows[0].value : def;
}
async function stateSet(c, key, value) {
  await c.query('INSERT INTO ygo_title_state(key, value) VALUES($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value', [key, String(value)]);
}

async function fetchReplay(id) {
  const r = await fetch(REPLAY_BASE + id, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

const num = (v, d = 0) => { const n = Number(v); return isFinite(n) ? n : d; };

/** 解析一局，返回每个座位的统计 */
function analyze(replay) {
  const msgs = replay.messages || [];
  const st = { 0: newStat(), 1: newStat() };
  const deck = { 0: null, 1: null };

  const start = msgs.find(m => m.name === 'Start' && m.hex && m.hex.length >= 30);
  if (start) {
    const u16 = (off) => {
      const p = start.hex.substr(off * 2, 4).match(/../g);
      return p ? parseInt(p.reverse().join(''), 16) : 0;
    };
    const d0 = u16(11), d1 = u16(15);
    if (d0 > 0 && d0 <= 80) deck[0] = d0;
    if (d1 > 0 && d1 <= 80) deck[1] = d1;
  }

  let turn = 0;
  let battleDepth = 0;            // DamageStep 内 = 战斗伤害
  let winners = [];
  let winTypes = [];

  for (const m of msgs) {
    const f = m.f || {};
    const name = m.name;

    if (name === 'NewTurn') {
      turn++;
      for (const p of [0, 1]) {
        if (st[p].turnDamage > st[p].maxTurnDamage) st[p].maxTurnDamage = st[p].turnDamage;
        st[p].turnDamage = 0;
      }
      continue;
    }
    if (name === 'DamageStepStart') { battleDepth++; continue; }
    if (name === 'DamageStepEnd') { battleDepth = Math.max(0, battleDepth - 1); continue; }

    if (name === 'LpUpdate' && (f.player === 0 || f.player === 1)) {
      const v = num(f.lp, null);
      if (v !== null) {
        st[f.player].lp = v;
        if (v < st[f.player].minLp) st[f.player].minLp = v;
      }
      continue;
    }
    if (name === 'Damage' && (f.player === 0 || f.player === 1)) {
      const dmg = num(f.value, 0);
      const p = f.player;                       // 受伤害方
      if (dmg > st[p].maxHit) st[p].maxHit = dmg;
      st[p].turnDamage += dmg;
      if (battleDepth === 0) st[1 - p].effectDamage += dmg;
      else st[1 - p].battleDamage += dmg;
      continue;
    }
    if (name === 'Recover' && (f.player === 0 || f.player === 1)) {
      st[f.player].recovered += num(f.value, 0);
      continue;
    }
    if (name === 'Draw' && (f.player === 0 || f.player === 1)) {
      const n = Array.isArray(f.cards) ? f.cards.length : 1;
      st[f.player].hand += n;
      if (deck[f.player] !== null) deck[f.player] = Math.max(0, deck[f.player] - n);
      continue;
    }
    if (name === 'Move') {
      const pv = f.previous || {}, cu = f.current || {};
      const pl = num(pv.location) & 0x7f, cl = num(cu.location) & 0x7f;
      const ctl = num(cu.controller, num(pv.controller, 0));
      if (pl === 2) st[ctl].hand = Math.max(0, st[ctl].hand - 1);
      if (cl === 2) st[ctl].hand += 1;
      if (pl === 4 || pl === 8) st[ctl].field = Math.max(0, st[ctl].field - 1);
      if (cl === 4 || cl === 8) st[ctl].field += 1;
      if (pl === 64 && deck[ctl] !== null) deck[ctl] = Math.max(0, deck[ctl] - 1);
      if (cl === 64 && deck[ctl] !== null) deck[ctl] += 1;
      continue;
    }
    if ((name === 'Summoning' || name === 'SpSummoning') && turn <= 3) {
      const ctl = num(f.controller, 0);
      if (ctl === 0 || ctl === 1) st[ctl].summonedEarly = true;
      continue;
    }
    if (name === 'Win') {
      const w = num(f.player, -1);
      if (w === 0 || w === 1) {
        winners.push(w);
        winTypes.push({ player: w, type: num(f.type, -1) });
      }
    }
  }

  for (const p of [0, 1]) {
    if (st[p].turnDamage > st[p].maxTurnDamage) st[p].maxTurnDamage = st[p].turnDamage;
    st[p].deckLeft = deck[p];
    st[p].summonedEarly = !!st[p].summonedEarly;
  }
  const uniqWins = [];
  const seenWin = new Set();
  for (const w of winTypes) {
    const k = w.player + ':' + w.type;
    if (!seenWin.has(k)) { seenWin.add(k); uniqWins.push(w); }
  }
  return { stats: st, winners: [...new Set(winners)], winTypes: uniqWins };
}

function newStat() {
  return {
    lp: 8000, minLp: 8000, hand: 5, field: 0,
    maxHit: 0, turnDamage: 0, maxTurnDamage: 0,
    effectDamage: 0, battleDamage: 0, recovered: 0,
    summonedEarly: false, deckLeft: null,
  };
}

function nameOfPlayer(replay, pos) {
  const list = replay.players || [];
  const p = list.find(x => x.pos === pos) || list[pos];
  return p ? (p.name || '') : '';
}

async function accountOf(c, recordId, playerName) {
  // duel_record_player: name = 账号名，realName = 游戏内显示名
  // replay 里拿到的是显示名，所以按 realName 找，取回 name（账号）
  const r = await c.query(
    'SELECT name, "realName" FROM duel_record_player WHERE "duelRecordId"=$1 AND ("realName"=$2 OR name=$2) LIMIT 1',
    [recordId, playerName]);
  if (r.rows.length) return r.rows[0].name;   // 账号
  return playerName;
}

async function award(c, account, title, recordId, detail) {
  const got = await c.query('SELECT 1 FROM ygo_title_award WHERE "accountName"=$1 AND title=$2', [account, title]);
  if (got.rows.length) return false;
  if (DRY) { console.log('[dry] ' + account + ' <- ' + title + ' (' + detail + ')'); return true; }
  const u = await c.query('SELECT titles FROM srv_user WHERE "accountName"=$1', [account]);
  if (!u.rows.length) return false;
  let list = [];
  try { list = JSON.parse(u.rows[0].titles || '[]'); } catch (e) { list = []; }
  if (!Array.isArray(list)) list = [];
  if (!list.includes(title)) list.push(title);
  await c.query('UPDATE srv_user SET titles=$1, "updateTime"=now() WHERE "accountName"=$2', [JSON.stringify(list), account]);
  await c.query('INSERT INTO ygo_title_award("accountName", title, "duelRecordId", detail) VALUES($1,$2,$3,$4)', [account, title, recordId, detail]);
  console.log('[AWARD] ' + account + ' <- ' + title + ' (' + detail + ')');
  return true;
}

/** 连败：从最近往前数，连续 won=false 的局数（含本局） */
async function loseStreak(c, account, recordId) {
  const r = await c.query('SELECT won FROM ygo_duel_stat WHERE "accountName"=$1 AND "recordId" <= $2 ORDER BY "recordId" DESC LIMIT 60', [account, recordId]);
  let n = 0;
  for (const row of r.rows) { if (row.won) break; n++; }
  return n;
}

/** 连续每天都有对局（以 dateISO 结尾） */
async function duelDayStreak(c, account, dateISO) {
  const r = await c.query('SELECT "duelDate"::text AS d FROM ygo_daily_duel WHERE "accountName"=$1 AND "duelDate" <= $2 ORDER BY "duelDate" DESC LIMIT 60', [account, dateISO]);
  const days = r.rows.map(x => x.d);
  if (!days.length || days[0] !== dateISO) return 0;
  let n = 1;
  const cur = new Date(dateISO + 'T00:00:00Z');
  for (let i = 1; i < days.length; i++) {
    cur.setUTCDate(cur.getUTCDate() - 1);
    if (days[i] === cur.toISOString().slice(0, 10)) n++; else break;
  }
  return n;
}

/** 回放里这张卡是否出现在该座位（手牌 / 场上 / 墓地 / 卡组 / 除外都算） */
function replayHasCardForSeat(replay, cards, seat) {
  const set = new Set(cards.map(Number));
  for (const m of (replay.messages || [])) {
    const f = m.f || {};
    if (set.has(num(f.code, -1))) {
      const ctl = num(f.controller,
        num((f.current || {}).controller, num((f.previous || {}).controller, -1)));
      if (ctl === seat || ctl < 0) return true;
    }
    if (f.card && set.has(num(f.card.code, -1))) {
      const ctl = num(f.card.controller, num(f.controller, -1));
      if (ctl === seat || ctl < 0) return true;
    }
    if (Array.isArray(f.cards) && num(f.player, -1) === seat
        && f.cards.some(x => set.has(num(x, -1)))) return true;
  }
  return false;
}

/** 给一局里所有「特殊胜利」的赢家发任务称号，返回新增条数 */
async function awardSpecialWins(c, row, replay, winTypes) {
  let added = 0;
  for (const w of (winTypes || [])) {
    const spec = SPECIAL_BY_TYPE.get(w.type);
    if (!spec) continue;
    // 0x11 会和「死三」注入码撞车，必须确认那张特殊胜利卡真的在回放里
    if (!replayHasCardForSeat(replay, spec.cards, w.player)) continue;
    const pname = nameOfPlayer(replay, w.player);
    if (!pname) continue;
    const acct = await accountOf(c, row.id, pname);
    if (!acct) continue;
    if (await award(c, acct, spec.title, row.id,
      'special win 0x' + w.type.toString(16) + ' (' + spec.name + ')')) added++;
  }
  return added;
}

/** 只回扫特殊胜利：按 winReason 过滤，不重复跑普通成就统计 */
async function specialBackfill(c, limit) {
  const types = SPECIAL_WINS.map(x => x.type);
  const rows = (await c.query(
    'SELECT id, name, "startTime" FROM duel_record WHERE name LIKE $1 '
    + 'AND "winReason" = ANY($2::int[]) ORDER BY id DESC LIMIT $3',
    [LADDER_LIKE, types, limit])).rows;
  console.log('special backfill: ' + rows.length + ' records' + (DRY ? ' (dry)' : ''));
  let added = 0;
  for (const row of rows) {
    try {
      const replay = await fetchReplay(row.id);
      const { winTypes } = analyze(replay);
      const n = await awardSpecialWins(c, row, replay, winTypes);
      added += n;
      if (VERBOSE || n > 0) console.log('[special] ' + row.id + ' +' + n);
    } catch (e) {
      console.warn('skip ' + row.id + ': ' + e.message);
    }
  }
  console.log('special awards added: ' + added);
}

async function scanRecord(c, row) {
  // 自战（同一账号两边座位）不计入成就：先看这条记录有几个不同账号
  try {
    const d = await c.query('SELECT count(distinct name)::int AS n FROM duel_record_player WHERE "duelRecordId"=$1', [row.id]);
    if ((d.rows[0].n || 0) < 2) { if (VERBOSE) console.log('[skip self-duel] ' + row.id); return; }
  } catch (e) {}
  let replay;
  try { replay = await fetchReplay(row.id); } catch (e) { console.warn('skip ' + row.id + ': ' + e.message); return; }
  const { stats, winners, winTypes } = analyze(replay);
  if (!winners.length && !VERBOSE) { /* 无胜负（如平局/中断）也统计对局数 */ }
  const dateISO = new Date(row.startTime || Date.now()).toISOString().slice(0, 10);
  if (VERBOSE) {
    console.log('[info] ' + row.id + ' w=' + JSON.stringify(winners)
      + ' winTypes=' + JSON.stringify(winTypes)
      + ' hit=' + stats[0].maxHit + '/' + stats[1].maxHit
      + ' turn=' + stats[0].maxTurnDamage + '/' + stats[1].maxTurnDamage
      + ' eff=' + stats[0].effectDamage + '/' + stats[1].effectDamage
      + ' rec=' + stats[0].recovered + '/' + stats[1].recovered
      + ' lp=' + stats[0].lp + '/' + stats[1].lp);
  }
  // 特殊胜利任务称号（通灵盘 / 艾克佐迪亚 / 终焉倒计时…）
  await awardSpecialWins(c, row, replay, winTypes);

  for (const pos of [0, 1]) {
    const pname = nameOfPlayer(replay, pos);
    if (!pname) continue;
    const acct = await accountOf(c, row.id, pname);
    const s = stats[pos];
    const won = winners.includes(pos);

    if (!DRY) {
      await c.query(`INSERT INTO ygo_duel_stat("recordId","accountName",won,"maxHit","maxTurnDamage","effectDamage",recovered,"finalLp","minLp","handEmpty","fieldEmpty","noSummon3","playedOn")
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT ("recordId","accountName") DO NOTHING`,
        [row.id, acct, won, s.maxHit, s.maxTurnDamage, s.effectDamage, s.recovered, s.lp, s.minLp,
          s.hand === 0 && won, s.field === 0 && won, !s.summonedEarly, dateISO]);
      await c.query('INSERT INTO ygo_daily_duel("accountName","duelDate") VALUES($1,$2) ON CONFLICT DO NOTHING', [acct, dateISO]);
      if (won) await c.query('INSERT INTO ygo_daily_win("accountName","winDate") VALUES($1,$2) ON CONFLICT DO NOTHING', [acct, dateISO]);
    }

    // ── 单局成就 ──
    if (s.maxHit > 30000) await award(c, acct, '力量结合', row.id, 'single hit ' + s.maxHit);
    if (s.maxHit >= 10000) await award(c, acct, '一拳超人', row.id, 'single hit ' + s.maxHit);
    if (s.effectDamage > 8000) await award(c, acct, '燃烧偶像', row.id, 'effect damage ' + s.effectDamage);
    if (s.recovered >= 5000) await award(c, acct, '光合作用', row.id, 'recovered ' + s.recovered);
    if (!s.summonedEarly && (s.turns || 0) >= 4) await award(c, acct, '卡手大师', row.id, 'no summon in first 3 turns');

    if (won) {
      const foe = stats[1 - pos];
      if (foe && foe.deckLeft === 0) await award(c, acct, '黏住', row.id, 'opponent deckout');
      if (s.lp < 100) await award(c, acct, '极限选手', row.id, 'win with ' + s.lp + ' LP');
      if (s.hand === 0 && s.field === 0) await award(c, acct, '奇迹', row.id, 'win with empty hand and field');
    }

    // ── 累计成就 ──
    const otk = await c.query(`SELECT count(*)::int AS n FROM ygo_duel_stat WHERE "accountName"=$1 AND won AND "maxTurnDamage">=8000`, [acct]);
    const otkCount = DRY ? 0 : otk.rows[0].n;
    if (otkCount >= 10) await award(c, acct, 'OTK爱好者', row.id, 'otk x' + otkCount);
    if (otkCount >= 50) await award(c, acct, 'OTK收藏家', row.id, 'otk x' + otkCount);
    if (otkCount >= 100) await award(c, acct, 'OTK狂热粉', row.id, 'otk x' + otkCount);

    // 累计场次用**全量历史**（duel_record + duel_record_player），
    // 而不是只统计已扫描的 ygo_duel_stat —— 否则回扫窗口之前的老比赛不算，百战会被低估
    const gamesCount = DRY ? 0 : await ladderGames(c, acct);
    if (gamesCount >= 100) await award(c, acct, '百战', row.id, 'games ' + gamesCount);
    if (gamesCount >= 1000) await award(c, acct, '千战', row.id, 'games ' + gamesCount);
    if (gamesCount >= 10000) await award(c, acct, '万战', row.id, 'games ' + gamesCount);

    if (!DRY) {
      const streak = await loseStreak(c, acct, row.id);
      if (streak >= 10) await award(c, acct, '温暖', row.id, 'lose streak ' + streak);
      if (streak >= 20) await award(c, acct, '不胜神话', row.id, 'lose streak ' + streak);

      const dayStreak = await duelDayStreakFull(c, acct, dateISO);
      if (dayStreak >= 30) await award(c, acct, '绝对努力', row.id, 'daily streak ' + dayStreak);

      const winStreak = await (async () => {
        const r = await c.query('SELECT "winDate"::text AS d FROM ygo_daily_win WHERE "accountName"=$1 AND "winDate" <= $2 ORDER BY "winDate" DESC LIMIT 30', [acct, dateISO]);
        const days = r.rows.map(x => x.d);
        if (!days.length || days[0] !== dateISO) return 0;
        let n = 1;
        const cur = new Date(dateISO + 'T00:00:00Z');
        for (let i = 1; i < days.length; i++) {
          cur.setUTCDate(cur.getUTCDate() - 1);
          if (days[i] === cur.toISOString().slice(0, 10)) n++; else break;
        }
        return n;
      })();
      if (winStreak >= 7) await award(c, acct, '日积月累', row.id, 'daily win streak ' + winStreak);
    }
  }
}

/** 天梯累计场次（全量历史） */
async function ladderGames(c, account) {
  const r = await c.query(
    'SELECT count(*)::int AS n FROM duel_record d JOIN duel_record_player p ON p."duelRecordId"=d.id'
    + ' WHERE d.name LIKE $1 AND p.name=$2'
    + ' AND (SELECT count(distinct q.name) FROM duel_record_player q WHERE q."duelRecordId"=d.id) >= 2',
    [LADDER_LIKE, account]);
  return r.rows.length ? r.rows[0].n : 0;
}

/** 天梯有对局的日期（全量历史，升序） */
async function ladderDays(c, account) {
  const r = await c.query(
    'SELECT DISTINCT d."startTime"::date::text AS d FROM duel_record d JOIN duel_record_player p'
    + ' ON p."duelRecordId"=d.id WHERE d.name LIKE $1 AND p.name=$2 ORDER BY 1 DESC LIMIT 120',
    [LADDER_LIKE, account]);
  return r.rows.map(x => x.d);
}

/** 以 dateISO 结尾的连续有对局天数（用全量历史算） */
async function duelDayStreakFull(c, account, dateISO) {
  const days = await ladderDays(c, account);
  if (!days.length || days[0] !== dateISO) return 0;
  let n = 1;
  const cur = new Date(dateISO + 'T00:00:00Z');
  for (let i = 1; i < days.length; i++) {
    cur.setUTCDate(cur.getUTCDate() - 1);
    if (days[i] === cur.toISOString().slice(0, 10)) n++; else break;
  }
  return n;
}

/** --recount：按全量历史补发「场次/连续天数」类成就（不需要逐局解析） */
async function recountAll(c) {
  const rows = (await c.query(
    'SELECT p.name AS account, max(d.id) AS lastid, max(d."startTime")::date::text AS lastday'
    + ' FROM duel_record d JOIN duel_record_player p ON p."duelRecordId"=d.id'
    + ' WHERE d.name LIKE $1 GROUP BY 1 ORDER BY 2 DESC', [LADDER_LIKE])).rows;
  console.log('recount accounts: ' + rows.length);
  for (const row of rows) {
    const acct = row.account;
    if (!acct) continue;
    const games = await ladderGames(c, acct);
    if (games >= 100) await award(c, acct, '百战', row.lastid, 'games ' + games);
    if (games >= 1000) await award(c, acct, '千战', row.lastid, 'games ' + games);
    if (games >= 10000) await award(c, acct, '万战', row.lastid, 'games ' + games);
    const streak = await duelDayStreakFull(c, acct, row.lastday);
    if (streak >= 30) await award(c, acct, '绝对努力', row.lastid, 'daily streak ' + streak);
  }
}

/** 撤销由"自战"记录产生的称号（并清掉这些记录的统计行），然后重新算场次类成就 */
async function purgeSelfDuels(c) {
  const selfIds = (await c.query(`
    SELECT d.id FROM duel_record d
    WHERE (d.name LIKE 'M#%' OR d.name LIKE '%,RANDOM#%')
      AND (SELECT count(distinct q.name) FROM duel_record_player q WHERE q."duelRecordId" = d.id) < 2
  `)).rows.map(r => r.id);
  console.log('self-duel records: ' + selfIds.length);
  if (!selfIds.length) return;

  const bad = (await c.query(
    'SELECT "accountName", title FROM ygo_title_award WHERE "duelRecordId" = ANY($1::bigint[])',
    [selfIds])).rows;
  console.log('awards from self-duel: ' + bad.length);
  await c.query('DELETE FROM ygo_title_award WHERE "duelRecordId" = ANY($1::bigint[])', [selfIds]);

  for (const row of bad) {
    const still = await c.query('SELECT 1 FROM ygo_title_award WHERE "accountName"=$1 AND title=$2',
      [row.accountName, row.title]);
    if (still.rows.length) continue;              // 别处也达成过 → 保留
    const u = await c.query('SELECT titles FROM srv_user WHERE "accountName"=$1', [row.accountName]);
    if (!u.rows.length) continue;
    let list = [];
    try { list = JSON.parse(u.rows[0].titles || '[]'); } catch (e) { list = []; }
    if (!Array.isArray(list)) list = [];
    const next = list.filter(t => t !== row.title);
    if (next.length !== list.length) {
      await c.query('UPDATE srv_user SET titles=$1, "updateTime"=now() WHERE "accountName"=$2',
        [JSON.stringify(next), row.accountName]);
      console.log('[REVOKE] ' + row.accountName + ' -x- ' + row.title);
    }
  }

  await c.query('DELETE FROM ygo_duel_stat WHERE "recordId" = ANY($1::bigint[])', [selfIds]);
  await c.query('DELETE FROM ygo_daily_win w WHERE NOT EXISTS (SELECT 1 FROM ygo_duel_stat s WHERE s."accountName"=w."accountName" AND s.won AND s."playedOn"=w."winDate")');
  console.log('purge done');
}

async function main() {
  const c = new Client(PG);
  await c.connect();
  try {
    await ensureSchema(c);
    if (SPECIAL_BACKFILL > 0) {
      await specialBackfill(c, SPECIAL_BACKFILL);
      const ns = await c.query('SELECT count(*)::int AS n FROM ygo_title_award');
      console.log('awards total: ' + ns.rows[0].n);
      return;
    }
    if (process.argv.includes('--purge-self')) {
      await purgeSelfDuels(c);
      await recountAll(c);
      const n1 = await c.query('SELECT count(*)::int AS n FROM ygo_title_award');
      console.log('awards total: ' + n1.rows[0].n);
      return;
    }
    if (process.argv.includes('--recount')) {
      await recountAll(c);
      const n0 = await c.query('SELECT count(*)::int AS n FROM ygo_title_award');
      console.log('awards total: ' + n0.rows[0].n);
      return;
    }
    let lastId = parseInt(await stateGet(c, 'lastDuelRecordId', '0'), 10) || 0;
    let rows;
    if (BACKFILL > 0) {
      rows = (await c.query('SELECT id, name, "startTime" FROM duel_record WHERE name LIKE $1 ORDER BY id DESC LIMIT $2', [LADDER_LIKE, BACKFILL])).rows.reverse();
    } else {
      rows = (await c.query('SELECT id, name, "startTime" FROM duel_record WHERE name LIKE $1 AND id > $2 ORDER BY id ASC LIMIT 500', [LADDER_LIKE, lastId])).rows;
    }
    console.log('scanning ' + rows.length + ' ladder duels' + (DRY ? ' (dry)' : ''));
    for (const row of rows) {
      await scanRecord(c, row);
      if (!DRY && BACKFILL === 0) { lastId = row.id; await stateSet(c, 'lastDuelRecordId', lastId); }
    }
    if (BACKFILL > 0 && !DRY && rows.length) await stateSet(c, 'lastDuelRecordId', Math.max(...rows.map(r => r.id)));
    const n = await c.query('SELECT count(*)::int AS n FROM ygo_title_award');
    console.log('awards total: ' + n.rows[0].n);
  } finally {
    await c.end();
  }
}

main().catch(e => { console.error('FAIL: ' + e.message); process.exit(1); });
