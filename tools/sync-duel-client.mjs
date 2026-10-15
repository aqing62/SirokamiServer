#!/usr/bin/env node
/**
 * sync-duel-client.mjs —— 把 ygopro-web 的「决斗客户端」产物同步进官网
 *
 * 为什么要脚本：交接文档再三强调 **容器 DOM 必须与 play.html 完全一致**，
 * 客户端是按 id/class 找元素的，少一个节点就整页静默失效。手抄必错，所以这里自动提取。
 *
 * 用法: node tools/sync-duel-client.mjs [源目录] [官网目录]
 *   默认源目录：E:/ygopro-web/spikes/live-field
 *   默认官网目录：本脚本的上一级（D:/YGO/Server/SirokamiServer）
 *
 * 产出（**产物不要手改**，改完重跑本脚本）：
 *   js/ygopro-web-browser.js   ← ygopro-web-browser.js（协议编解码，挂 window.YGO）不要改
 *   js/viewer-live.js          ← viewer-live.js（盘面查看器，挂 window.__live）不要改
 *   js/duel-client.js          ← play.js（交互层，挂 window.__yp）
 *   css/duel-client.css        ← play.html 里所有 <style> 合并
 *   duel.html                  ← tools/duel-page.template.html + play.html 的 <body> 容器
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] || 'E:/ygopro-web/spikes/live-field';
const DST = process.argv[3] || path.resolve(import.meta.dirname, '..');
const TEMPLATE = path.join(import.meta.dirname, 'duel-page.template.html');

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };

function must(rel) {
  const p = path.join(SRC, rel);
  if (!fs.existsSync(p)) { console.error('✗ 源文件不存在: ' + p); process.exit(1); }
  return p;
}

// ── ① 三件套 JS：原样拷贝 ──
const COPIES = [
  ['ygopro-web-browser.js', 'js/ygopro-web-browser.js'],
  ['viewer-live.js', 'js/viewer-live.js'],
  ['play.js', 'js/duel-client.js'],
];
for (const [from, to] of COPIES) {
  const src = must(from);
  const dst = path.join(DST, to);
  fs.copyFileSync(src, dst);
  console.log(`✓ ${to}  ${(fs.statSync(dst).size / 1024).toFixed(0)} KB`);
}

// ── ② play.html → 样式 + 容器 DOM ──
const html = read(must('play.html'));

// 所有 <style>…</style>（play.html 里有两个：主样式表 + #ypCardInfo 那段）
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1].trim());
const css = [
  '/* ─────────────────────────────────────────────────────────────',
  ' * duel-client.css —— 决斗客户端的样式',
  ' * ⚠ 自动生成：由 tools/sync-duel-client.mjs 从 ygopro-web 的 play.html 提取',
  ' *   要改样式请改上游 play.html 再重跑脚本，不要手改本文件',
  ' * 依赖：css/replay-viewer.css（官网已有，场地/日志样式）+ cover2.jpg（卡背）',
  ' * ───────────────────────────────────────────────────────────── */',
  '',
  ...styles,
  '',
].join('\n\n');
write(path.join(DST, 'css/duel-client.css'), css);
console.log(`✓ css/duel-client.css  ${(Buffer.byteLength(css) / 1024).toFixed(1)} KB（合并 ${styles.length} 段样式）`);

// <body> 到第一个 <script 之间 = 容器骨架（客户端按 id/class 找的就是这些）
const bodyStart = html.search(/<body[^>]*>/i);
if (bodyStart < 0) { console.error('✗ play.html 里找不到 <body>'); process.exit(1); }
const afterBody = html.slice(bodyStart).replace(/^<body[^>]*>/i, '');
const scriptAt = afterBody.search(/<script/i);
const container = (scriptAt >= 0 ? afterBody.slice(0, scriptAt) : afterBody)
  .replace(/\s*<\/body>[\s\S]*$/i, '')
  .trim();

// 必须齐的关键节点（少一个客户端就会静默失效）
// 注：#ypChooser / #ypCardMenu 是客户端 JS **动态创建**的（play.js 里 box.id = ...），不在容器里
const NEEDED = ['id="lobby"', 'id="replayModal"', 'id="replayField"', 'id="replayLog"',
  'id="ypCtl"', 'id="ypPrompt"', 'id="ypCardInfo"', 'id="hud"'];
const missing = NEEDED.filter((k) => !container.includes(k) && !html.includes(k));
if (missing.length) {
  console.warn('⚠ 容器里没找到这些关键节点（可能在 play.html 其它位置或已改名）: ' + missing.join(' '));
}

// ── ③ 组装 duel.html ──
if (!fs.existsSync(TEMPLATE)) { console.error('✗ 模板不存在: ' + TEMPLATE); process.exit(1); }
const tpl = read(TEMPLATE);
if (!tpl.includes('@@DUEL_CONTAINER@@')) { console.error('✗ 模板里没有 @@DUEL_CONTAINER@@ 占位'); process.exit(1); }
const page = tpl.replace('@@DUEL_CONTAINER@@', container);
write(path.join(DST, 'duel.html'), page);
console.log(`✓ duel.html  ${(Buffer.byteLength(page) / 1024).toFixed(1)} KB（容器 ${(Buffer.byteLength(container) / 1024).toFixed(1)} KB）`);
console.log('\n提示：duel.html / css/duel-client.css 都是生成产物，改了会被下次同步覆盖 ✓');
