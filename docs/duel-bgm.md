# 背景音乐（BGM）：首页 + 匹配等待 + 对局

> 相关：等待页面「40 秒没配到人就刷新」已经改成**原地换房重进**（`rerollRoomInPlace()`，
> `duel-client.js`）。整页刷新会重连 WebSocket、画面闪、音乐从头再来，而且把
> `state.rerollCount` 清空 → 每 40 秒无限重刷；现在只重置房间状态，日志/卡组/音乐都不动，
> 换房次数上限也真正生效了。

三首各管一段，**同一时刻只会响一首**：

| 场景 | 前端 | 服务端 key | 文件 | 默认 |
|---|---|---|---|---|
| 首页 `index.html` | `js/index-bgm.js` | `index/*`（多首轮播） | `/root/servers/bgm/index/*.mp3` | 关（🔇，要等第一次交互） |
| 大厅/匹配等待 `lobby.html`、`duel.html` 房间阶段 | `js/wait-bgm.js` | `wait` | `/root/servers/bgm/wait-bgm.mp3` | **开**（点一下页面就响） |
| 对局中 `duel.html` | `js/duel-bgm.js` | `duel` | `/root/servers/bgm/duel-bgm.mp3` | 开（开局瞬间自动切过来） |

切换点是 `duel-client.js` 的 `setUiPhase()`：
- `room`（房间/等对手/等准备）→ 停对局 BGM、放等待音乐；
- `duel`（猜拳/正式开局）→ 停等待音乐、放对局 BGM。
两个脚本的 `start()` 也会互相 `stop()`，即使手动点按钮也不会叠音。

等待音乐这首：`Gentle Piano Loop`，134.8s，64kbps / 1.03MB；原始 192kbps 在本地
`D:\YGO\Server\bgm-private\wait-bgm-original.mp3`。
决斗页右下角按钮顺序：音效(9px) / 对局 BGM(45px) / 等待音乐(81px)；大厅页只有等待音乐(9px)。

## 首页（index.html，多首轮流放）

| 环节 | 位置 |
|---|---|
| 歌单目录 | `/root/servers/bgm/index/*.mp3` —— **目录里有什么就放什么**，按文件名排序轮流播放 |
| 歌单接口 | `GET /api/bgm/list?scene=index` → `{"tracks":[{"k":"01 Noir Riff","name":"01 Noir Riff"}, …]}` |
| 取音频 | 每首歌各自领令牌：`/api/bgm/token?key=<k>` → `/api/bgm/<k>?t=…` |
| 前端 | `js/index-bgm.js`（每次进首页用「日期 % 歌数」决定从哪首开始，避免总是第一首） |
| 开关 | 右下角 🎵，或按 `B`；偏好存 `localStorage.siro_index_bgm_muted` |

**加歌**：把 mp3 丢进 `/root/servers/bgm/index/` 就行，刷新页面生效（不用重启、不用改代码）。
文件名会当歌名显示（按钮 tooltip），想排顺序就在前面加 `01 ` `02 `。

当前两首（都已压到 64kbps）：

| 文件 | 时长 | 大小 |
|---|---|---|
| `01 Noir Riff.mp3` | 174s | 1.33MB |
| `02 Smoky Room Minor.mp3` | 198s | 1.51MB |

原始 192kbps 版本留在本地 `D:\YGO\Server\bgm-private\index\orig-*.mp3`。

## 决斗页（单曲循环）

| 环节 | 位置 |
|---|---|
| 音频文件 | 服务器 `/root/servers/bgm/duel-bgm.mp3`（**站点根目录之外**，静态路由取不到） |
| 令牌接口 | `GET /api/bgm/token?key=duel` → `{"t": "<hmac>", "ttl": 1800}`，同时下发 `siro_bgm` cookie |
| 音频接口 | `GET /api/bgm/duel?t=<hmac>` → `audio/mpeg`，支持 Range，`Cache-Control: no-store` |
| 前端 | `js/duel-bgm.js`（duel.html 里在 duel-sounds 之后引入） |
| 开关 | 右下角 🎵 按钮（音效按钮左边），或按 `B`；偏好存 `localStorage.siro_bgm_muted` |

令牌是 `HMAC-SHA256(secret, key|cookie|30分钟桶)` 的前 32 位，**绑定浏览器 cookie**：
链接被转发到别的浏览器（没有那个 cookie）会 403。密钥首次运行自动生成在
`/root/servers/bgm/.secret`（600 权限）。

## 换歌 / 加歌

```bash
# 换决斗页这首：
scp "新歌.mp3" root@siro.ygopro3.cn:/root/servers/bgm/duel-bgm.mp3
# 文件是只读的，先 chmod 644 再覆盖：
ssh root@siro.ygopro3.cn 'chmod 644 /root/servers/bgm/duel-bgm.mp3'
# 换完不用重启：接口每次请求都现读文件
```

加第二首（例如大厅曲）：在 `vote_server.py` 的 `BGM_FILES` 里加一项
`"lobby": "lobby-bgm.mp3"`，前端把 `KEY` 改成 `lobby` 即可（同一个接口复用）。

### 当前这首的码率取舍（2026-11-20）

| 版本 | 码率 | 大小 | 服务器上的文件 | 本地源文件（`D:\YGO\Server\bgm-private`） |
|---|---|---|---|---|
| **现在用** | 64kbps | **1.55MB** | `/root/servers/bgm/duel-bgm.mp3` | `duel-bgm-64.mp3` |
| 备用 | 96kbps | 2.33MB | `/root/servers/bgm/duel-bgm-original.mp3` 不是这个（见下） | `duel-bgm-96.mp3` |
| 原始 | 182kbps | 4.42MB | —— | `duel-bgm-original.mp3` |

> 服务器上 `duel-bgm-original.mp3` 是**原始 182kbps** 那版（部署时备份的）。
> 想换回 96kbps：本地 `duel-bgm-96.mp3` 直接 scp 覆盖 `duel-bgm.mp3` 即可。

转码命令（本地有 ffmpeg）：

```bash
ffmpeg -y -i duel-bgm-original.mp3 -map_metadata -1 \
  -c:a libmp3lame -b:a 64k -ar 44100 -ac 2 duel-bgm-64.mp3
```


## 保密到什么程度（重要）

- ✅ 拦住了：右键另存、复制链接转发、猜路径（`/audio/xxx.mp3`、`/duel-bgm.mp3` 都是 404）、
  共享缓存二次分发（`no-store`）。
- ❌ 拦不住：拿到令牌 + cookie 的人用开发者工具/抓包把音频拉走；录屏录音。
  浏览器能播放的内容，技术上一定能被拿到 —— 这是原理限制，不是实现问题。

## 已知取舍

- 现在这首 203 秒、**64kbps / 1.55MB**（原始 182kbps / 4.42MB，缩了 65%）。
  每台设备首次进决斗页下 1.55MB；若觉得音质偏薄，换成本地的 96kbps 版（2.33MB）。
- 浏览器自动播放策略：必须等用户在页面上点一下才会出声（`js/duel-bgm.js` 里监听
  pointerdown/keydown），不是 bug。
- 静音状态下**不会**去下载音频（省流量）；取消静音才开始拉。
