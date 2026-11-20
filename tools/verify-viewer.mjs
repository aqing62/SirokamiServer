// 白神服 · 查看器自验证脚本（本地工具，不上传服务器）
// 用法: node _verify.mjs [场景名]
// 目前场景: chain（连锁状态回填）
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 10190 + Math.floor(Math.random() * 8);
const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-verify-'));
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
let id = 0;
const pending = new Map();
const errs = [];
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

const scenario = process.argv[2] || 'chain';

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await withT(send('Network.setCacheDisabled', { cacheDisabled: true }), 8000);
  await withT(send('Page.navigate', { url: 'https://siro.ygopro3.cn/duel.html?t=' + Date.now() }), 9000).catch(() => {});
  await sleep(9000);

  if (scenario === 'chain') {
    const out = await ev([
      "(function(){",
      "  var CODE = 89631139;",
      "  var msgs = [",
      "    { name: 'Chaining', hex: '', f: { code: CODE, controller: 0, location: 4, sequence: 0 } },",
      "    { name: 'ChainNegated', hex: '', f: {} },",
      "    { name: 'Chaining', hex: '', f: { code: 55144522, controller: 0, location: 8, sequence: 0 } },",
      "    { name: 'ChainSolved', hex: '', f: {} }",
      "  ];",
      "  try { window.__live.bulkApply(msgs); } catch (e) { return 'ERR ' + e.message; }",
      "  var rows = [].slice.call(document.querySelectorAll('.rp-lrow.chain'));",
      "  return JSON.stringify({ rows: rows.length, texts: rows.map(function(r){ return r.textContent.replace(/\\s+/g,' ').trim().slice(0,60); }) });",
      "})()"
    ].join('\n'));
    console.log('chain:', out);
  }

  console.log('ERRS:', JSON.stringify(errs.slice(0, 3)));
} catch (e) {
  console.error('FAIL:', e.message);
} finally {
  try { ws.close(); } catch (e) {}
  try { child.kill(); } catch (e) {}
  setTimeout(() => process.exit(0), 200);
}
