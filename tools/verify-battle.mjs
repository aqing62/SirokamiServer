// 阶段 1.3 自验证：攻击日志行上要出现伤害步骤 / 结算 / 未成立 状态
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 10280 + Math.floor(Math.random() * 8);
const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-vbt-'));
const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${udd}`,
  '--window-size=1440,900', '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withT = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

async function wsUrl() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const t = (await r.json()).find((x) => x.type === 'page');
      if (t && t.webSocketDebuggerUrl) return t.webSocketDebuggerUrl;
    } catch (e) {}
    await sleep(300);
  }
  throw new Error('no cdp');
}
const ws = new WebSocket(await wsUrl());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map(); const errs = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception?.description || '').slice(0, 300));
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id;
  pending.set(mid, (m) => (m.error ? rej(new Error(method + ': ' + JSON.stringify(m.error))) : res(m.result)));
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const ev = async (expr, to = 90000) => {
  const r = await withT(send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }), to);
  if (r.exceptionDetails) return 'EXC ' + JSON.stringify(r.exceptionDetails).slice(0, 300);
  return r.result.value;
};
try {
  await send('Page.enable'); await send('Runtime.enable');
  await withT(send('Network.setCacheDisabled', { cacheDisabled: true }), 8000);
  await withT(send('Page.navigate', { url: 'https://siro.ygopro3.cn/duel.html?t=' + Date.now() }), 9000).catch(() => {});
  await sleep(9000);
  console.log(await ev([
    "(function(){",
    "  function h2(n){ return ('0' + (n & 0xff).toString(16)).slice(-2); }",
    "  function le32(n){ var s=''; for (var i=0;i<4;i++) s += h2(n >>> (i*8)); return s; }",
    "  var CODE = 89631139;",
    "  var attackHex = '6e' + '00' + '04' + '00' + '01' + '00000000';",
    "  var battleHex = '6f' + '00' + '04' + '00' + le32(3000) + '01' + '00000000' + '00' + '00000000' + '00';",
    "  window.__live.reset({ roomName: 't', players: [] });",
    "  // 造一张攻表怪在场，供日志取名",
    "  window.__live.bulkApply([{ name: 'UpdateData', hex: '', f: { player: 0, location: 4, cards: [CODE] } }]);",
    "  window.__live.bulkApply([{ name: 'Attack', hex: attackHex, f: { attacker: { controller: 0, location: 4, sequence: 0, position: 1 } } }]);",
    "  window.__live.bulkApply([{ name: 'DamageStepStart', hex: '71', f: {} }]);",
    "  window.__live.bulkApply([{ name: 'Battle', hex: battleHex, f: {} }]);",
    "  var rows = [].slice.call(document.querySelectorAll('.rp-lrow'));",
    "  var states = [].slice.call(document.querySelectorAll('.rp-lchain-state')).map(function(e){ return e.textContent; });",
    "  var battleRows = rows.filter(function(r){ return r.querySelector('.rp-lchain-state'); }).map(function(r){ return r.textContent.replace(/\\s+/g,' ').trim().slice(0,40); });",
    "  return JSON.stringify({ states: states, battleRows: battleRows });",
    "})()"
  ].join('\n')));
  console.log('ERRS:', JSON.stringify(errs.slice(0, 3)));
} catch (e) { console.error('FAIL:', e.message); }
finally { try { ws.close(); } catch (e) {} try { child.kill(); } catch (e) {} setTimeout(() => process.exit(0), 200); }
