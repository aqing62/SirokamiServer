# 称号商店（用天梯积分购买称号）

> 上线版本：V2.0.0 · 2026-11-20
> 入口：官网「玩家排名」页 → 搜索栏**左侧**「🛒 称号商店」

---

## 1. 规则

- 每个赛季**结算时**，把每个人**当赛季最终天梯积分**按 **1 分 = 1 称号点**发放；
  例：啊倾 S4 最终 927 分 → 结算后获得 927 称号点。
- 称号点**跨赛季累计、不清零**，没有过期时间。
- 商店称号有稀有度：**白 / 绿 / 蓝 / 黄 / 红**（普通 / 优秀 / 稀有 / 史诗 / 传说）。
  **紫色是任务称号**（成就称号、赛季段位称号等，由系统发放，不在商店出售）。
- 玩家排名页会在玩家名下方显示其主 / 副称号，并按稀有度上色（紫 = 任务称号）
  数据来自 `/api/ladder/titles`，30 秒缓存；在个人中心保存称号/显示名会**立即失效缓存**，再进排名页就能看到新称号。展示口径与游戏内一致
  （主称号没设时退回赛季称号，不会把没装备的称号顶上来）。
- 论坛（帖子列表、帖子详情、评论）的作者名旁也会显示称号，同一套稀有度配色与同一个接口。

### 特殊胜利任务称号（紫色，11 个）

由 `ygotitles.js` 从回放里检测：`Win.f.type` 命中 victory 码，**且**对应卡确实在这局出现过
（防止服务器注入的“死三/超时”码误判）。发放后进入 `srv_user.titles`，在个人中心自选装备。

| victory 码 | 触发方式 | 称号 |
|---|---|---|
| `0x10` | 「被封印的艾克佐迪亚」特殊胜利 | 唤起奇迹之人 |
| `0x11` | 「终焉的倒计时」特殊胜利 | 终焉已至 |
| `0x12` | 「毒蛇神 维诺米纳迦」特殊胜利 | 蛇神降临 |
| `0x13` | 「光之创造神 哈拉克提」特殊胜利 | 神！ |
| `0x15` | 「通灵盘」特殊胜利 | 死灵的主人 |
| `0x17` | 「No.88 机关傀儡-命运狮子」特殊胜利 | 命运的交响曲 |
| `0x1c` | 「幻煌龙的天涡」特殊胜利 | 水至天祸 |
| `0x1e` | 「飞行象」特殊胜利 | 小飞象来咯 |
| `0x21` | 「混沌虚数No.1000」特殊胜利 | 归虚梦演 |
| `0x23` | 「电子龙·集流体」特殊胜利 | 致命五连击 |
| `0x50` | 「鳞翅帝-内生攻击者」特殊胜利 | 完全态 |

```bash
cd /root/servers/siro
node ygotitles.js --special-backfill 999999 --dry   # 预览
node ygotitles.js --special-backfill 999999         # 回扫历史（按 winReason 过滤，很快）
node ygotitles.js                                   # 新对局增量扫描（cron 里跑同一个即可）
```

> ⚠ `0x11` 与服务器“死三/比赛超时”注入的 Win 码相同，所以必须做卡牌校验；
> 只按 `duel_record.winReason` 直接发会误发「终焉已至」。
>
> ⚠ **座位方向**：回放里的 `Win.f.player` 是“回放本地座位”，谁保存的回放会整体翻转，
> 不能直接当房间座位用。`ygotitles.js` 以 `duel_record_player.winner` 为准确认胜者，
> 再用「第一条 NewTurn 的 player」对比 `isFirst` 判断是否翻转，换算到回放座位后才校验卡牌
> （2026-11-21 修正过一次误发：艾克佐迪亚的称号曾被发给败者）。
>
> 同一问题也影响旧成就（`一拳超人`/`光合作用`/`百战` 等）——它们的 `stats[pos]` 也是按回放座位算的。
> 已按修正后的映射全量重算：`node ygotitles.js --rebuild-achievements`
> （会先收回 18 个旧成就称号，清空 `ygo_duel_stat`/`ygo_daily_*` 后按时间顺序重扫全部天梯；跑之前先备份）。

- 商店里买到的称号会进入 `srv_user.titles`（称号库），
  玩家在**个人中心 → 称号展示**里自选「主称号 / 副称号」，游戏内下次登录生效。
- 余额是**流水算出来的**（Σ 赛季发放 + Σ 人工调整 − Σ 已消费），
  没有单独的余额字段 → 重复结算、补发、回滚都不会算错。

---

## 2. 数据流

```
游戏服（赛季重置）
  POST /api/ladder/reset?season=S4
    resetSeason()
      ├─ 结算赛季称号（原有逻辑，写 srv_user.ladderTitle / titles）
      ├─ ① snapshotSeasonPoints()  ← 新增：清空积分前，把最终积分写进 ygo_ladder_season_result
      ├─ ② 清空 player_rating
      └─ ③ 废弃录像

官网（vote_server.py :8092）
  GET  /api/title-shop        → 目录 + 余额 + 已拥有 + 本赛季积分 + 发放记录
  POST /api/title-shop/buy    → 校验余额/去重 → 写 ygo_title_shop_purchase → 并入 srv_user.titles
  GET  /api/ladder/titles     → 玩家排名用：主/副称号 + 稀有度（紫=任务称号，30 秒缓存，保存称号后立即失效）
```

---

## 3. 表结构（首次访问/启动自动 `CREATE TABLE IF NOT EXISTS`）

| 表 | 作用 | 写入方 |
|---|---|---|
| `ygo_ladder_season_result` | 赛季积分流水：`(season, accountName)` 主键，rating = 发放的称号点 | 游戏服 resetSeason（兜底：`tools/settle-season.py`） |
| `ygo_title_shop_purchase` | 购买记录：`(accountName, title)` 主键，天然防重复购买 | 官网 |
| `ygo_title_shop_adjust` | 人工调整（补偿/回收），`delta` 正负都行，平时不用 | 手工 SQL |
| `ygo_site_config` | 键值配置；`ladderSeason` = 当前赛季名（游戏服结算时读它打标签） | 官网启动时 |

> 建表语句在 `vote_server.py` 的 `TITLE_SHOP_DDL` 和
> `src/feats/ladder/ladder-service.ts` 的 `snapshotSeasonPoints()` 里各有一份（保持一致），
> 谁先跑都能建出来。

---

## 4. 赛季结算（游戏服）

### 正常流程

赛季结束时（例如 S4 → 11/30 结束、12/1 重置），调用：

```bash
curl -k -X POST "https://127.0.0.1:50009/api/ladder/reset?username=<管理员>&pass=<密码>&season=S4"
```

- `season` 建议**显式传**；不传时游戏服会读官网写的 `ygo_site_config.ladderSeason`；
  再读不到就按年月兜底（如 `S202611`）。
- 返回里多了两个字段：`season`、`seasonResults`（写入的账号数）。
- **幂等**：同一赛季重复调用只会更新数值，不会重复发称号点。

### 官网 → 游戏服的赛季名同步

官网 `vote_server.py` 顶部的 `SEASON_NAME` 是唯一需要改的地方：

```python
SEASON_NAME = "S4"
SEASON_START = "2026-11-01"
SEASON_END = "2026-11-30"
```

启动时会把 `SEASON_NAME` 写进 `ygo_site_config.ladderSeason`，
游戏服重置时自动用它给积分快照打标签 → 两边赛季名不会对不上。

> ⚠ **换赛季的顺序很重要**：
> 1. 先在游戏服跑 `reset`（此时官网配置里还是旧赛季名 S4 → 结算结果打 S4 标签）；
> 2. 再改官网 `SEASON_NAME/START/END` 并重启官网（写入 S5）。
>
> 如果反过来（先把官网改成 S5 再 reset），S4 的积分会被记成 S5。
> 怕搞错就**永远在 reset 时显式带 `?season=S4`**。

### 兜底脚本（游戏服还没更新时）

```bash
cd /root/servers/ygopro/siro-web   # 官网目录（vote_server.py 所在目录）
python3 tools/settle-season.py --dry-run        # 只看会发多少
python3 tools/settle-season.py --season S4      # 按当前 player_rating 写入
```

脚本复用 `vote_server.py` 的 psql 连接配置，幂等；适合「游戏服还是旧版、
但赛季已经要重置了」的情况。注意：**必须在游戏服清空 `player_rating` 之前跑**。

---

## 5. 部署

> **上线顺序（重要）**：① 官网先更新并重启（建表 + 写 `ladderSeason`）
> → ② 游戏服更新并重启（挑没人打的时候）→ ③ 赛季结束时按 §4 调 `reset`。
> 如果先重置再更新，这次结算不会有积分快照（用 §4 兜底脚本补）。

### 5.1 官网（SirokamiServer）

改动的文件：

```
vote_server.py              # 新增称号商店 API / 建表 / 购买 / 余额 / 排名称号接口
index.html                  # 入口按钮 + 商店弹窗 + 公告 + 脚本/样式引用
css/title-shop.css          # 商店样式（新增，**全站常驻**）
css/player-ranking.css      # 排名称号稀有度配色
js/title-shop.js            # 商店前端（新增；切页面自动关闭）
js/script.js                # 全站样式白名单里加入 css-title-shop
js/player-ranking.js        # 玩家名下方显示称号（按稀有度上色）
data/title-shop.json        # 称号目录（新增，改它就能改商品）
tools/settle-season.py      # 结算兜底脚本（新增）
docs/title-shop.md          # 本文档（新增）
```

> ⚠ **商店样式必须放在 `css/title-shop.css`（全站常驻）**，不要搬回
> `css/player-ranking.css`。商店弹窗在 body 级，而排名页的 CSS 切到别的页面
> 会被 `media="not all"` 停用 —— 放回去就会出现“返回主页后商店变成一坨无样式文字”的 bug。

部署：

```bash
cd /root/servers/siro
# 更新文件后重启官网进程
pm2 restart siro-web
```

启动日志里应出现：

```
称号商店目录已加载: 29 个称号
当前赛季标识已写入 ygo_site_config: S4
```

> 页面用了版本号缓存：`index.html` 里 `css/title-shop.css?v=20261120a` /
> `js/title-shop.js?v=20261120c` / `js/script.js?v=20261120c` /
> `css/player-ranking.css?v=20261120c`，以后改这些文件记得把 `?v=` 往上加一位。

### 5.2 游戏服（srvpro2-siro）

改动的文件：

```
src/feats/ladder/ladder-service.ts                  # 源码
dist/src/feats/ladder/ladder-service.js             # 运行产物（本地已同步手改，仅作对照）
docs/title-shop-season.patch                        # 源码补丁（在游戏服仓库里）
```

**推荐用补丁**（服务器上这个文件可能有别的未提交改动，直接覆盖会丢）：

```bash
cd /root/servers/ygopro/srvpro-siro
git apply --check docs/title-shop-season.patch   # 先干跑，确认能打上
git apply docs/title-shop-season.patch
npx tsc                                          # 重新编译 dist
node tools/apply-patches.cjs                     # 平时有跑就照旧跑
pm2 restart srvpro2_siro:50010
```

补丁内容就三块，冲突了手工贴也一样：

1. `POST /api/ladder/reset` 里把 `?season=` 传给 `resetSeason`；
2. 新增 `resolveSeasonKey()` / `snapshotSeasonPoints()` 两个方法；
3. `resetSeason()` 里在 `ratingRepo.clear()` **之前**调用快照，并返回 `season/seasonResults`。

不想编译的话，也可以直接覆盖 `dist/src/feats/ladder/ladder-service.js`
（本地这份已改好、过了 `node --check` 和单测；服务器 dist 若有别的本地补丁，先备份）。

> ⚠ 重启会中断正在进行的对局，挑没人打的时候做。
> 只做「赛季重置」的话，**必须在重置之前**把游戏服更新到这一版，否则不会写积分快照
> （此时用 §4 的兜底脚本补）。

---

## 6. 改商品 / 改价格

编辑 `data/title-shop.json`，**存盘即生效**（按文件 mtime 自动重载，不用重启）：

```json
{ "title": "赢骰就给我", "price": 1000, "rarity": "蓝", "desc": "掷硬币的那一刻就已经赢了。" }
```

- `price`：称号点（1 点 = 赛季结算 1 积分）；必须 > 0。
- `rarity`：`白` / `绿` / `蓝` / `黄` / `红`（写别的值按 `白` 处理）。
  商店和玩家排名都按这个上色；**紫色留给任务称号**，不要写进商店目录。
- `enabled`：写 `false` 可临时下架（下架后已购买的人仍保留称号）。
- 删除商品不影响已购买记录。
- **改 `title` 等于换了一个新称号**：老买家记录里还是旧名字，
  `srv_user.titles` 里也是旧名字（不会自动跟着改）。改名请三思。

---

## 7. 验收清单

- [ ] 打开「玩家排名」→ 搜索栏左侧出现「🛒 称号商店」（桌面/手机都检查）
- [ ] 玩家排名每行显示主/副称号，颜色按稀有度（白/绿/蓝/黄/红），任务称号为紫色
- [ ] 未登录：能看目录，按钮是「登录后购买」，点它弹登录框
- [ ] 登录后：显示称号点余额、本赛季当前积分、赛季结束预计发放
- [ ] 买一个便宜称号：余额减少、卡片变「已拥有」、弹「已购买…」提示
- [ ] 重复购买：提示「你已经拥有这个称号了」
- [ ] 余额不足：按钮显示「还差 N 点」
- [ ] 个人中心 → 称号展示：列表里出现刚买的称号，能设主/副称号
- [ ] 换主/副称号后，返回玩家排名立刻显示新称号
- [ ] 游戏内重新登录：称号正常显示
- [ ] 结算：`POST /api/ladder/reset?season=...` 返回 `seasonResults` > 0，商店「赛季发放记录」出现该赛季
- [ ] 重复调用结算：余额不翻倍（流水幂等）

---

## 8. 常见问题

**Q：为什么余额和「累计获得」对不上？**
余额 = 累计获得 + 人工调整 − 已消费。`ygo_title_shop_adjust` 有记录时会多/少。

**Q：能不能给某个玩家补发/扣称号点？**
```sql
INSERT INTO ygo_title_shop_adjust("accountName", delta, reason)
VALUES ('aqing', 200, '活动补偿');   -- 扣就写负数
```
刷新商店即生效。

**Q：赛季结算了，但商店里没有发放记录？**
1) 游戏服是不是旧版（没有 `snapshotSeasonPoints`）→ 用 §4 兜底脚本；
2) 赛季名是不是对不上（`ygo_ladder_season_result.season` 与官网 `SEASON_NAME`）；
3) 该玩家当赛季 rating 是否为 0（0 分不发）。

**Q：切到别的页面后商店还开着 / 变成一坨无样式文字？**
2026-11-20 已修复：① 商店样式改为全站常驻 `css/title-shop.css`；
② 切到别的 section 时 `title-shop.js` 会自动关闭弹窗；③ 遮罩改用独立的 `.ts-overlay`。
如果又出现，依次检查：`index.html` 是否引用了 `css/title-shop.css`、
`js/script.js` 的样式白名单里是否有 `css-title-shop`、弹窗是否还在 `section` 里面。

**Q：游戏里称号不显示？**
`selectedTitle` 是登录时读取的 → 让玩家重新登录；个人中心保存后有提示「游戏内下次登录生效」。

**Q：榜单里有名字，但不显示称号？**
先确认该账号 `selectedTitle` / `selectedTitle2` / `ladderTitle` 是否都为空 —— 三个都空就不显示
（不会拿没装备的称号顶上）。另外玩家改过显示名时，`player_rating.displayName`（打天梯时的旧名）
和 `srv_user.displayName`（当前名）可能不一致；2026-11-20 起 `/api/ladder/titles`
**同时用两个名字做键**，所以「炎兽Lv999 / 烟火一刹」这类改名玩家也能正常显示。

**Q：想清空某人的已购称号（退款）？**
```sql
DELETE FROM ygo_title_shop_purchase WHERE "accountName"='xxx' AND title='xxx';
-- 需要的话再从 srv_user.titles 里去掉（JSON 数组）
```
余额会自动按流水重算。

---

## 9. 回滚

- 官网：还原 `vote_server.py` / `index.html` / `css/player-ranking.css`，
  删除 `js/title-shop.js`（不删也只是入口按钮消失后不再加载），重启。
- 游戏服：还原 `ladder-service.ts`（dist 同步）后 `npx tsc` + 重启。
  已写入 `ygo_ladder_season_result` 的数据可以保留，不影响旧逻辑（旧代码不读它）。
- 数据表可以留着，不占空间也不影响游戏服/官网其它功能。
