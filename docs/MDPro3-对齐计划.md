# 白神服 × MDPro3 逻辑对齐大计划

> 原则：**逻辑抄 MDPro3，UI 保留白神服自己的**（引擎不同，表现层不走 Unity 那套）。
> 参考来源：`Assets/Scripts/MDPro3/Duel/DuelLog.cs`、`GameCard.cs`、`DuelMessage.cs`、
> `MasterDuel/YgomDebug/DuelLogForAnalysis.cs`（统计/分类口径）。

---

## 阶段 0 —— 已经对齐（已上线）

| # | 项目 | MDPro3 依据 | 状态 |
|---|---|---|---|
| 0.1 | 特召按 reason 位分类（仪式/融合/同调/超量/连接/灵摆） | `DuelLog.CheckSpSummon` + `lastSpSummonReason` | ✅ |
| 0.2 | 召唤被无效不计入统计 | `undoPendingSummon`（对应 MDPro3 只统计成立召唤） | ✅ |
| 0.3 | 攻击卷回只在 `AttackDisabled` 后触发 | `GameMessage_AttackDisabled` | ✅ |
| 0.4 | 连接箭头对手侧 180° 旋转 | 场地整块倒置 | ✅ |
| 0.5 | 手牌 seq 与 DOM 顺序解耦（点 A 不会丢 B） | 引擎 seq 为准 | ✅ |
| 0.6 | 发动日志「発動 + 卡名」，效果名只在多选项 | `DuelLog` 的 action 文案 | ✅ |
| 0.7 | 禁止令宣言写进 `announcedByCell`，重绘不丢 | 宣言跟随卡片状态 | ✅ |
| 0.8 | 未知卡图 → 官网卡背 `cover2.jpg` | 盖卡/未知统一卡背 | ✅ |

---

## 阶段 1 —— 日志与消息状态机（下一步，风险低、收益大）

| # | 项目 | MDPro3 对照 | 做法 |
|---|---|---|---|
| 1.1 | 连锁链路合成一条 | `DuelLog` 的 `chainSolving` + `ChainSolved`：同一条连锁的「发动→无效→处理」有归属 | 日志项带 `chainId`，后续 `ChainNegated/ChainSolved` 更新**同一条**（追加「✖ 无效」/「✔ 处理」），不再散成三行 |
| 1.2 | 召唤无效演出与日志 | `Summoning` 后必须有 `Summoned` 才算成立 | 记录 pending summon；只收到 `ChainNegated` 时输出「召唤无效」，并把刚放上场的卡退回（模型层） |
| 1.3 | 战斗四段状态机 | `Attack` → `AttackDisabled` → `DamageStepStart/End` → `Battle` | 统一 `battleState`，日志按段输出；卷回只在 `AttackDisabled` 后出现（0.3 已完成，1.3 是补齐四段） |
| 1.4 | 公开顺序分批 | `DuelLog` 按 `ConfirmCards` 的 kind 分批（卡组/手牌/墓地/额外） | `ConfirmCards` 只输出一条「公开 N 张（来源）」+ 缩略图行，不再逐张弹 |
| 1.5 | 抽卡/检索区分 | MDPro3 抽卡与检索是不同 action | `Draw` = 抽卡；`Move(DECK→HAND)` = 检索/加入手卡，带来源卡（0.x 已补卡号，1.5 补来源） |

---

## 阶段 2 —— 场地表现（逻辑对齐，不动 UI 风格）

| # | 项目 | MDPro3 对照 | 做法 |
|---|---|---|---|
| 2.1 | 表示形式/翻转时序 | `GameCard.MoveAsync`（旋转 0.18s / 翻面 0.15s） | 已有，按 moveTime 调参即可 |
| 2.2 | 攻击/守备图标（⚔/🛡） | `AnimationPosition()` | 已有 |
| 2.3 | 灵摆召唤批次 | `inPendulumSummon` + `PlaySummonPendulum` | 已有（BecomeTarget + SpSummoning 判定） |
| 2.4 | 衍生物/素材角标 | `GameCard` 的 overlay/token 显示 | 统计素材数、衍生物不显示攻守 |
| 2.5 | 盖卡被翻开后回卡背 | 明牌信息只在当次展示 | 已有 `knownSeen`，补 12s 过期 |

---

## 阶段 3 —— 统计与「具体信息」面板

| # | 项目 | MDPro3 对照 | 做法 |
|---|---|---|---|
| 3.1 | 特召分类 ✅ | 已对齐 | — |
| 3.2 | 统计口径：全场累计（不是每回合） | `DuelLogForAnalysis` 的 `m_DataTypeNumDict` 按整场累计 | 去掉按回合清零；另加「本回合」小字（可选） |
| 3.3 | NS/SP/EF/ATK 之外补充：破坏数、无效数 | 分析器的数据类型计数 | `duelStats()` 增加 `destroyed/negated` |
| 3.4 | 灵摆一次多只的计数口径 | MDPro3 日志按批次 | 可选：展开「灵摆召唤 ×3」，统计仍按只数 |

---

## 阶段 4 —— 交互层（白神服自有）

| # | 项目 | 说明 |
|---|---|---|
| 4.1 | 手牌 seq（✅） | 点击/高亮都按 `data-seq` |
| 4.2 | 发动日志简写（✅） | 「发动」/「发动 · 卡名」，多选项才带提示 |
| 4.3 | 禁止令宣言（✅） | `announcedByCell` 持久化 + 日志带卡图 |
| 4.4 | 备牌/观战流程 | 保持现状，不与 MDPro3 对齐 |

---

## 执行方式

- 每个阶段按编号逐条提交，单条改动单独 commit + 实测（回放 R# / 实战）后再合并下一条。
- 涉及 `js/viewer-live.js`（查看器逻辑）与 `js/duel-client.js`（交互层）两处；
  查看器改动一律带 `?v=` 版本号递增，避免玩家拿到旧缓存。
- 不改 srvpro，不动桌面布局。
