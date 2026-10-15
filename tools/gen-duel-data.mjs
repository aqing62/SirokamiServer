#!/usr/bin/env node
/**
 * gen-duel-data.mjs —— 给「嵌官网的决斗客户端」生成两份大表
 *
 *   ① cardtext（懒加载，约 5MB）：/<卡号> → { d:效果文本, r:种族位, a:属性位, s:setcode, t:type位 }
 *   ② strings（约 40KB）：{ system, victory, counter, setname }
 *
 * 数据源（**顺序即优先级，先到先得** —— 与 srvpro2 的合并规则一致）：
 *   - 站点自己的 DIY_Sirokami.cdb（2841 张 DIY 卡）
 *   - 游戏服 /root/servers/ygopro/cards-pre/ 里的先行卡（test-release + test-update，**只读不搬**）
 *   - 官方 cards_ocg.cdb（14981 张 OCG 卡）
 *   - 官方 strings.conf
 *
 * 用法: node tools/gen-duel-data.mjs [strings.conf] [输出目录]
 *   默认（生产）：/root/servers/siro/DIY_Sirokami.cdb + cards_ocg.cdb
 *                 /root/servers/ygopro/ygopro-database/locales/zh-CN/strings.conf
 *                 /root/servers/siro/data
 *
 * 输出：<输出目录>/duel-cards-text.json、<输出目录>/duel-strings.json
 *   ⚠ 这两个文件体积大（5MB 级），**不进 git**；每次更新卡库/禁限表后重跑一次即可。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const CDBS = [
  '/root/servers/siro/DIY_Sirokami.cdb',                    // DIY 卡
  '/root/servers/ygopro/cards-pre/test-release.cdb',        // 先行卡（预发布 release）
  '/root/servers/ygopro/cards-pre/test-update.cdb',         // 先行卡（预发布 update）
  '/root/servers/siro/cards_ocg.cdb',                       // 官方 OCG
];
const STRINGS_CONF = process.argv[2] || '/root/servers/ygopro/ygopro-database/locales/zh-CN/strings.conf';
const OUT_DIR = process.argv[3] || '/root/servers/siro/data';

// sql.js 从游戏服的 node_modules 里借（那边一定有）
const SQLJS_DIR = '/root/servers/ygopro/srvpro-siro/node_modules/sql.js/dist';
const require = createRequire('/root/servers/ygopro/srvpro-siro/package.json');
const initSqlJs = require(path.join(SQLJS_DIR, 'sql-wasm.js'));

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── ① cards-text（两个库合并，先到先得） ──
{
  const SQL = await initSqlJs({ locateFile: (f) => path.join(SQLJS_DIR, f) });
  const out = {};
  let n = 0;
  for (const cdbPath of CDBS) {
    if (!fs.existsSync(cdbPath)) {
      console.log('  [警告] ' + cdbPath + ' 不存在，跳过');
      continue;
    }
    const db = new SQL.Database(new Uint8Array(fs.readFileSync(cdbPath)));
    const stmt = db.prepare(
      'SELECT d.id AS id, d.type AS type, d.race AS race, d.attribute AS attribute, d.setcode AS setcode, t.desc AS desc ' +
      'FROM datas d LEFT JOIN texts t ON t.id = d.id',
    );
    let added = 0;
    while (stmt.step()) {
      const r = stmt.getAsObject();
      const id = Number(r.id);
      if (out[id] !== undefined) continue;   // 先到先得：DIY 库优先
      out[id] = { d: r.desc || '', r: r.race || 0, a: r.attribute || 0, s: r.setcode || 0, t: r.type || 0 };
      added++;
    }
    db.close();
    console.log('  ' + path.basename(cdbPath) + '：新增 ' + added + ' 张');
    n += added;
  }
  const file = path.join(OUT_DIR, 'duel-cards-text.json');
  fs.writeFileSync(file, JSON.stringify(out), 'utf8');
  console.log(`✓ ${file}：合计 ${n} 张卡，${(fs.statSync(file).size / 1048576).toFixed(2)} MB`);
}

// ── ② strings ──
{
  const SECTIONS = ['system', 'victory', 'counter', 'setname'];
  const out = {};
  for (const s of SECTIONS) out[s] = {};
  const text = fs.readFileSync(STRINGS_CONF, 'utf8');
  let n = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('!')) continue;
    const m = line.match(/^!(\w+)\s+(0x[0-9a-fA-F]+|\d+)\s+(.*)$/);
    if (!m) continue;
    const [, sec, idRaw, val] = m;
    if (!out[sec]) continue;
    out[sec][Number(idRaw)] = val.trim();
    n++;
  }
  const file = path.join(OUT_DIR, 'duel-strings.json');
  fs.writeFileSync(file, JSON.stringify(out), 'utf8');
  console.log(
    `✓ ${file}：共 ${n} 条（system ${Object.keys(out.system).length} / victory ${Object.keys(out.victory).length} / ` +
    `counter ${Object.keys(out.counter).length} / setname ${Object.keys(out.setname).length}），${(fs.statSync(file).size / 1024).toFixed(0)} KB`,
  );
}
