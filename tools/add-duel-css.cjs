// add-duel-css.cjs —— 往决斗页模板加样式段的**唯一正确入口**：
//   node add-duel-css.cjs "<标记注释>" "<CSS 内容>"   （两者都会自动包进 <style> 并校验）
const fs = require('fs');
const F = 'D:/YGO/Server/SirokamiServer/tools/duel-page.template.html';
const mark = process.argv[2] || '/* siro-css-block */';
const css = process.argv[3] || '';
let t = fs.readFileSync(F, 'utf8');
if (!css) { console.log('没给 CSS 内容 ✗'); process.exit(1); }
if (t.includes(mark)) { console.log('已存在标记 ' + mark + ' ✓'); process.exit(0); }
t = t.replace('</head>', '<style>\n' + mark + '\n' + css + '\n</style>\n</head>');
// 通用校验：所有我加的标记都必须在 <style> 里；标签必须平衡
function inside(tt, idx) { return tt.lastIndexOf('<style>', idx) > tt.lastIndexOf('</style>', idx); }
fs.writeFileSync(F, t);
const i = t.indexOf(mark);
const o = (t.match(/<style>/g) || []).length, c = (t.match(/<\/style>/g) || []).length;
console.log('已加：' + mark);
console.log('  在 <style> 里: ' + (inside(t, i) ? '是 ✓' : '否 ✗'));
console.log('  标签平衡: ' + o + '/' + c + ' ' + (o === c ? '✓' : '✗'));
if (!inside(t, i) || o !== c) { console.log('  ✗ 校验没过，请人工检查'); process.exit(1); }
