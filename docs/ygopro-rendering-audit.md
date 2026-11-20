# 从 YGOPro 反推回放/观战渲染方案

参考对象：`sherry_chaos/ygopro`（C++ / Irrlicht），本地解压于
`E:\ygopro-server-src\_ygopro_ref\ygopro-master`。

这次不是继续给单个效果打补丁，而是把 YGOPro 的**状态模型 / 消息语义 / 动画层**整理出来，对照当前 `viewer-live.js`，给出一套能收敛显示类 bug 的改造方向。

---

## 1. YGOPro 的核心：先有持久卡对象，再渲染

### 1.1 ClientCard 是持久对象

`gframe/client_card.h`：

- 卡对象保存 `code / location / sequence / position / status`
- `overlayTarget`：这张卡叠在谁下面
- `overlayed`：这张卡下面叠了哪些卡
- `ClearData()` 只清卡面数据（攻守/等级/种类等），**不删除卡对象**
- `UpdateInfo()` 按 query flag 做字段级合并

`gframe/client_field.h`：

- `mzone / szone / hand / deck / grave / remove / extra` 都是 `ClientCard*` 容器
- `overlay_cards` 单独保存所有素材对象

关键点：**一张卡从卡组到场上、进墓地、变成素材，始终是同一个对象指针**。
`RemoveCard/AddCard` 只是把这个指针从一个容器挪到另一个容器。

### 1.2 MSG_MOVE 才是落点权威

`gframe/duelclient.cpp` 的 `MSG_MOVE`（约 2789 行起）分四种情况：

1. 普通区 → 普通区
   - `GetCard()` 拿到旧对象
   - `RemoveCard()` 从旧区移除
   - `AddCard()` 放进新区
   - 始终复用同一个 `ClientCard*`

2. 普通区 → 素材区
   - 从旧区移除
   - `overlayTarget->overlayed.push_back(pcard)`
   - `pcard->location = LOCATION_OVERLAY`
   - `pcard->sequence = overlayed.size() - 1`

3. 素材区 → 普通区
   - `olcard->overlayed.erase(begin + pcard->sequence)`
   - 把后面的素材 `sequence` 重新编号
   - `AddCard()` 到目标区
   - `MoveCard()` 做位置补间

4. 素材区 → 素材区
   - 从旧宿主 erase
   - 新宿主 push_back
   - 两边重新编号

所以超量去素材、素材转移都不靠“mats 数字减一”，而是**删掉素材对象 + 重排 sequence**。

### 1.3 MSG_UPDATE_DATA 只合并字段，不重建区域

`gframe/duelclient.cpp` 的 `MSG_UPDATE_DATA`：

```cpp
mainGame->dField.UpdateFieldCard(player, location, pbuf);
```

`gframe/client_field.cpp:318`：

```cpp
for (auto cit = lst->begin(); cit != lst->end(); ++cit) {
    len = BufferIO::ReadInt32(data);
    if (len > LEN_HEADER)
        (*cit)->UpdateInfo(data);
    data += len - 4;
}
```

`UpdateFieldCard`：

- 拿到该区域**已有的卡对象列表**
- 逐张调用 `UpdateInfo`
- **不新增、不删除、不按数组重建区域**

`ClientCard::UpdateInfo()`：

- 只有 query flag 里带的字段才更新
- `QUERY_CODE` 才改 code
- `QUERY_POSITION` 才改 position
- 没带的字段保留原值
- `flag == 0` 时 `ClearData()`，也只是清卡面数据，不把卡从区域删掉

这解决的就是我们这边反复出现的：

- 快照没带 `overlayCodes` → `mats=0` → 全部素材消失
- 快照数组被截断 → 整区 delete 重建 → 里侧卡消失
- 快照缺 position → 盖卡被当成表侧/空位

### 1.4 MSG_SET 在 YGOPro 里不碰模型

`gframe/duelclient.cpp:3027`：

```cpp
case MSG_SET: {
    // 读 code/controller/location/sequence/position
    // 只播 SOUND_SET，写一条日志
    return true;
}
```

也就是说：

- **落点由前面的 `MSG_MOVE` 完成**
- `MSG_SET` 只是“盖放音效 + 日志”
- `MSG_SPSUMMONING` 也只负责音效/展示，不负责放卡

这解释了为什么我们一直想在 `Set` 里补卡会不断出问题：**我们拿一个纯表现消息当了状态消息**。

---

## 2. 动画层：只移动对象，不隐藏对象

`ClientField::MoveCard()` 只做：

- 计算旧位置和新位置
- 给 `curPos / curRot` 设补间
- 对象每帧照常绘制

没有：

- 把常驻卡 `opacity:0`
- 给格子加 `_fxHold`
- 用 `.rp-fly` 替身遮住常驻卡
- 靠 `flyHidden` 决定一张卡是否显示

动画是**对象位置的变化**，不是“藏掉对象再放一个替身”。

我们现在的 v2 方案之所以频繁出现“模型有卡但画面空白”，就是因为把动画状态写进了常驻节点的可见性：

```js
flyHidden / cellHidden / _fxHold / opacity:0
```

任何一个收尾没清，卡就永久消失。

---

## 3. 当前 viewer-live.js 与 YGOPro 的差异

| 维度 | YGOPro | 当前 viewer-live |
|---|---|---|
| 卡的身份 | 持久 `ClientCard*` | `field[ctl]["loc:seq"]` 普通对象，快照/Set 会替换 |
| 区域更新 | `UpdateInfo` 字段级合并 | `UpdateData` 先 delete 整区再按数组重建 |
| 落点权威 | `MSG_MOVE` | `Move` + `Set` + 补丁兜底混用 |
| 素材 | `overlayTarget/overlayed` 关系 | `mats` 数字 + `overlayCodes` 数组 + 快照猜测 |
| Set | 纯音效/日志 | 创建卡、pendingSetReveal、回盖 timer |
| 动画 | 对象 transform 补间 | 常驻 DOM + `.rp-fly` 替身 + 隐藏标记 |
| 回放/实时 | 同一对象模型 | 回放静态流 / 实时增量+observer 缺字段 |
| 渲染 | 单一绘制层 | 旧 DOM 布局锚点 + v2 卡图覆盖层 |

核心问题不是“动画没写好”，而是：

> **状态、动画、渲染三层没有分离；每遇到一个边界情况就加一个隐藏/补卡补丁，补丁之间互相覆盖。**

---

## 4. 建议的改造路线

### P0：状态模型，先让 Move 成为唯一落点权威

目标：

- `MSG_MOVE` 正常/素材/离场全部由 `moveCard()` 处理
- `Set` 不再创建卡，只做展示/音效
- `SpSummoning/SpSummoned` 不再补卡/改位置，只做演出
- 补卡兜底全部移除

具体：

1. `Set` 分支只保留：
   - 日志
   - 盖放音效
   - 如果需要展示，读已有卡对象做展示
2. `Move` 分支保证：
   - 来源删除
   - 目标新增
   - `position` 直接来自 Move 的 `current.position`
3. `UpdateData`：
   - **禁止** `delete` 整区
   - 按 `location/sequence` 找已有对象
   - 只更新 query 里出现的字段
   - 快照缺字段时保留旧值
4. 素材：
   - 改成 `overlayTarget` / `overlays` 关系
   - 去素材按 `sequence` 删除 + 重排
   - 不再用 `mats === 0` 判断清空

### P1：渲染层，常驻卡永远可见

原则：

- 常驻卡节点不做 `opacity:0`
- 动画用**独立克隆节点**，克隆节点可以透明/飞行
- 动画结束只删克隆，不动常驻节点
- 删除 `_fxHold` / `flyHidden` / `cellHidden` 作为“持久可见性”的语义
- 每帧/每次批量结束后做一次 `renderFromModel()`，幂等重画

这样即使动画收尾失败，最坏结果只是“多一个克隆”，不会“卡消失”。

### P2：单一渲染入口

现在有：

- 旧 `.rp-card` 布局
- v2 `.fr-card`
- 卡背兜底层
- 各种 timer

建议收敛成：

```text
model (Card objects)
  └─ renderBoard() 读 model，画所有格子
       ├─ 常驻卡层（永远可见）
       └─ 动画克隆层（可临时存在）
```

动画只操作克隆层，任何状态变化都走 `renderBoard()`。

### P3：诊断与回归

已有 trace 工具可以继续用，建议固化成：

```js
__live.dumpField()
__live.dumpDom()
__live.assertParity()
```

测试用例至少覆盖：

- 普通盖放
- 效果盖放（卡组/墓地 → 魔陷）
- 里侧守备特殊召唤（影依猎鹰）
- 超量 2 素材 → 去 1 → 去 0
- 素材转移
- 场上 → 墓地/除外
- 观战历史补发 + 实时切换
- 断线重连
- 翻面确认展示

每条用例比较：

```text
model 里的卡 == DOM 里可见的卡
```

---

## 5. 为什么回放正常、观战/实战不正常

不是两个引擎，而是：

- 回放：完整消息流、批量渲染、`animSuppress` 常开、没有实时队列
- 观战/实战：observer 字段被抹、快照不完整、动画真实执行、消息顺序/补发复杂

同一套 `viewer-live.js`，实时路径多出了：

1. 缺字段的 `UpdateData`
2. 会被替换的卡对象
3. 会遮常驻节点的 `.rp-fly`
4. 动画 timer / `_fxHold`
5. `Set/SpSummoning` 与 `Move` 的时序差

所以回放能过，不代表实时能过。

---

## 6. 建议先做的最小闭环

不要一次重写。先做三步：

1. **`UpdateData` 不再 delete 整区**，改成按 seq 找对象合并字段
2. **`Set` 不再建卡**，只做展示；所有落点交给 `Move`
3. **常驻卡不再用 opacity 隐藏**，移动动画改用克隆层

这三步做完，最近的：

- 效果盖放消失
- 里侧特召消失
- 超量素材全消失
- 快照冲掉盖卡

会一起收敛，而不是继续逐个打补丁。

---

## 7. 参考源码位置

- `gframe/client_card.h`：`overlayTarget` / `overlayed` / `UpdateInfo` / `ClearData`
- `gframe/client_field.cpp:203`：`AddCard`
- `gframe/client_field.cpp:259`：`RemoveCard`
- `gframe/client_field.cpp:318`：`UpdateFieldCard`（字段级合并）
- `gframe/duelclient.cpp:1452`：`MSG_UPDATE_DATA`
- `gframe/duelclient.cpp:2789`：`MSG_MOVE` 四种情况
- `gframe/duelclient.cpp:3027`：`MSG_SET` 只播音效/日志
- `gframe/client_field.cpp:1059`：素材叠放位置计算
