# YGOPro 功能对齐清单（2026-11-18）

参考：`sherry_chaos/ygopro` C++ 客户端（`gframe/duelclient.cpp`、`client_field.cpp`）。

状态：`✅` 已实现 / `◐` 部分实现 / `☐` 未实现。

## 一、消息覆盖

| 消息 | 状态 | 说明 |
|---|---|---|
| `MSG_START` | ✅ | 重置、发牌、座位对齐、牌堆铺底 |
| `MSG_DRAW` | ✅ | 手牌、卡组计数、抽卡动画 |
| `MSG_NEW_TURN` | ✅ | 回合数、回合方、统计清零 |
| `MSG_NEW_PHASE` | ✅ | 阶段文字、横幅、音效 |
| `MSG_MOVE` | ✅ | 四类落点、素材、墓地/除外、动画 |
| `MSG_SET` | ✅ | 盖放、揭示、回盖；复用 Move 对象 |
| `MSG_SUMMONING` | ✅ | 通常召唤、召唤演出 |
| `MSG_SPSUMMONING` | ✅ | 特殊召唤、灵摆/连接/超量演出 |
| `MSG_FLIPSUMMONING` | ✅ | 翻转召唤 |
| `MSG_POS_CHANGE` | ✅ | 表示形式、翻面动画 |
| `MSG_UPDATE_DATA` | ✅ | 场上字段级合并；手牌/额外/墓地快照 |
| `MSG_UPDATE_CARD` | ✅ | 原地合并，不替换对象 |
| `MSG_RELOAD_FIELD` | ✅ | 场地占位/表示/XYZ 数/连锁/手牌·墓地·除外张数；具体卡等 UpdateData |
| `MSG_FIELD_DISABLED` | ✅ | 白色 X，按 `myDuelPos/metaSwap` 交换两组 bit |
| `MSG_CHAINING` | ✅ | C1/C2 角标、连锁栈、顺序连线 |
| `MSG_CHAINED` | ✅ | 入链确认，回填该连锁位状态 |
| `MSG_CHAIN_SOLVED` | ✅ | 逐条弹出角标 |
| `MSG_CHAIN_END` | ✅ | 兜底清理角标/连线 |
| `MSG_CARD_TARGET` | ✅ | `◎` + 源→对象连线/箭头 |
| `MSG_CANCEL_TARGET` | ✅ | 立即清除 |
| `MSG_BECOME_TARGET` | ✅ | 高亮/对象日志/灵摆判定 |
| `MSG_EQUIP` / `UNEQUIP` | ✅ | 目标 `⚙`、装备名日志 |
| `MSG_ADD_COUNTER` / `REMOVE` | ✅ | 指示物角标（含 EMZ） |
| `MSG_ATTACK` | ✅ | 攻击/目标/直击、突进、能量球 |
| `MSG_BATTLE` | ✅ | 战斗结算、四段日志 |
| `MSG_ATTACK_DISABLED` | ✅ | 攻击未成立/卷回 |
| `MSG_DAMAGE_STEP_START/END` | ✅ | 战斗阶段状态 |
| `MSG_DAMAGE` / `RECOVER` / `LPUPDATE` | ✅ | LP、飘字、音效 |
| `MSG_PAY_LPCOST` | ✅ | 支付 LP |
| `MSG_WIN` | ✅ | 胜利横幅、清理标记 |
| `MSG_DECK_TOP` | ✅ | 卡组顶明牌 |
| `MSG_CONFIRM_DECKTOP` | ✅ | 卡组顶公开列表 |
| `MSG_CONFIRM_CARDS` | ✅ | 翻开/确认列表 |
| `MSG_RANDOM_SELECTED` | ✅ | 日志列出随机选中卡 |
| `MSG_SHUFFLE_DECK` | ✅ | 洗牌音效/牌堆动画 |
| `MSG_SHUFFLE_HAND` | ✅ | 手牌重排 + 抖动 |
| `MSG_SHUFFLE_SET_CARD` | ✅ | 盖卡抖动提示 |
| `MSG_REVERSE_DECK` | ✅ | 卡组方向、顶牌朝向 |
| `MSG_SWAP_GRAVE_DECK` | ◐ | 张数/占位交换；卡号未知等 UpdateData |
| `MSG_TAG_SWAP` | ◐ | 手牌/额外/卡组顶；场地靠后续 UpdateData |
| `MSG_HAND_RES` | ✅ | 猜拳结果/先攻 |
| `MSG_ROCK_PAPER_SCISSORS` | ✅ | 等待猜拳提示 |
| `MSG_TOSS_COIN` / `DICE` | ✅ | 结果 toast/日志 |
| `MSG_ANNOUNCE_RACE/ATTRIB/CARD/NUMBER` | ✅ | 宣言内容日志 |
| `MSG_CARD_HINT` | ✅ | 卡名 + 解放/送墓等动作 |
| `MSG_PLAYER_HINT` | ◐ | PHINT_DESC_ADD 已记录“说明：卡名”；完整说明文本未展示 |
| `MSG_WAITING` | ✅ | 等待对手状态 |
| `MSG_MATCH_KILL` / `RETRY` | ✅ | 日志 |
| `MSG_RELEASE_RELATION` | ✅ | 清除对象线 |

## 二、视觉/交互

| 功能 | 状态 | 说明 |
|---|---|---|
| 场地/额外怪兽区 | ✅ | `emz:L/R`、P0/P1 映射、对账 |
| 盖卡/卡背 | ✅ | 59:86 卡背、兜底、防双层 |
| 装备标记 | ✅ | `⚙` + 多装备 title |
| 对象连线 | ✅ | 青色线 + 箭头 |
| 连锁顺序线 | ✅ | 金色 C1→C2 连线 |
| 场地封锁 X | ✅ | `FieldDisabled` |
| 胜利横幅 | ✅ | 🏆 + 玩家名 |
| 手牌公开/回放双方手牌 | ✅ | `replayMode` |
| 卡组/墓地/除外/额外列表 | ✅ | 点牌堆查看 |
| 卡图放大 | ✅ | 回放双击 / 手机长按 |
| 回放快捷键 | ✅ | 空格/箭头/±/Home/End/R/F/Esc |
| 回放速度记忆 | ✅ | `siro_replay_speed` |
| 卡组顶明牌 | ✅ | DeckTop |
| 自定义牌堆厚度 | ✅ | `fillPile` |
| 实时卡信息跟随日志 | ✅ | `autoInfo` |
| 悬停覆盖/移开恢复 | ✅ | 回放/实战 |
| 对手/自己座位交换 | ✅ | 观战 `⇅` |
| 手机横屏 | ✅ | 布局适配 |
| 服务器权威倒计时 | ✅ | `STOC_TIME_LIMIT` |
| 换备等待不自动退房 | ✅ | 客户端看门狗 |
| 站内聊天 | ✅ | 决斗/观战日志栏输入条 |
| 观战人数 | ✅ | `STOC_HS_WATCH_CHANGE` → 徽标 N 人观战 |

## 三、已知差距

1. **动画仍复用 `.rp-fly` 替身**：已改为只隐藏 `data-hide-key` 指定的目标节点（u/z/h），不再按卡号批量隐藏；样式/时长不变，永久节点靠替身结束/超时恢复。
2. **TagSwap 场地**：只同步手牌/额外/卡组顶，MZONE/SZONE 依赖后续 UpdateData。
3. **ReloadField 手牌/墓地/除外**：已按数量铺卡背；具体卡仍等 UpdateData。
4. **重连路径**：YGOPro C++ 用 `MSG_RELOAD_FIELD` 全量重建；srvpro 玩家重连实际发 `DuelStart + lastDuelRecord.toPlayback(observerViewForWatchers)`，客户端需保留本地 `myDuelPos`，并对重放 Start 的 0 张做快照兜底。
5. **PlayerHint**：PHINT_DESC_ADD/REMOVE 的说明计数未展示。
6. **本地 `.yrp` 文件回放**：当前只支持服务器 R#（`.yrp` 里是响应流，不是可直接渲染的消息流）。
7. **聊天**：决斗/观战已有输入条；回放页无聊天（回放无连接）。
8. **FieldDisabled 极端换边**：已按 `myDuelPos/metaSwap` 交换两组 bit；观战手动换边仍需实战验证。
9. **卡片说明文本**：依赖 `/api/cards` 与文本表，DIY/先行卡缺文本时不显示。

## 四、验证基线

- R#9706 / 9750 / 9820：5 个进度点 `assertParity()` 全空。
- R#9817：`Set + 空 UpdateData` 后模型/DOM 仍保留盖卡，parity 空。
- 回放页自动加载无 JS 异常；duel.html watch 冒烟无 JS 异常。
- 23 份回放（R#9600–9820 步进）共 42 种消息类型，当前 `viewer-live.js` 的 `case` 覆盖全部，无缺失消息。

## 五、当前版本

```text
viewer-live.js    20261118b157
field-render.js   20261118c44
replay-viewer.css 20261118c42
duel-client.js    20261118cb
replay.html       快捷键/双击/长按/全屏
```
