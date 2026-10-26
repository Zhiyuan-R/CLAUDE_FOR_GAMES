# War Council

> 游戏内全部为英文：界面、将领名字与台词、战报，以及发给决策模型的人设、战场描述和问题。

一个实时战棋小游戏：你是主公，手下三位将领**不是脚本 AI，而是由决策模型实时驱动的决策者**；对面的五支红军部队也一样，各自由模型指挥。
你在军议频道（Council）里用英文自然语言下令——可以排兵布阵，也可以鼓舞、夸奖、责骂——将领们会根据
自己看到的战场、自己的性格、士气和对你的「羁绊」，自主决定怎么打，并且会回话、提异议、互相配合。

## 玩法

- 目标：夺取河东的敌方帅旗 `B(21,8)` 并坚守 3 回合，或击溃全部敌军。别让敌人占领我方大营 `C(2,8)`。
- 战场每秒推进一回合；河流只能从三座桥 `(12,3)` `(12,8)` `(12,13)` 通过；有战争迷雾。
- 兵种相克：骑兵平原冲锋 ×1.5，步兵克骑兵，弓兵射程 3（山丘上 +1）但怕近战；森林/山丘/村庄有防御加成，村庄和大营可以补给。
- 士气低于 15 部队会溃散。**你的话会影响士气和羁绊**：被信任、被赞美的将领打得更狠；被冷落辱骂的将领可能顶撞甚至拒绝命令。

三位将领：

| | 将领 | 兵种 | 性格 |
|---|---|---|---|
| A | Huo Lie · Crimson Steed General | 骑兵 | 年轻气盛、渴望荣耀，吃软不吃硬 |
| B | Su Li · Azure Phoenix Strategist | 弓兵 | 冷静理性，会对送死的命令提出异议并给出替代方案 |
| C | Old Qin · Black Armor Veteran | 重步兵 | 忠诚务实，心疼士兵，擅长守要道 |

红军五支部队：E1 Banner Guard、E2 Hill Archers、E3 Raiders、E4 Bridge Patrol、E5 South Garrison。

操作：在右下输入框下令（可选发给 All generals 或某位将领），例如 `Old Qin, hold the middle bridge (12,8)`；点击地图插入坐标，点击敌军插入编号（如 `E2`）。

## 将领是怎么"思考"的

将领由 SubQ 的**决策模型** `subq-snap-preview`（[Decisions API](https://docs.subq.ai/endpoints/decisions-api/)，`POST /v1/systemone`）驱动。
这类模型不生成文字，而是读一段状态 + 图片，对一组"问题"给出带概率的类型化答案，单次调用约 0.2–0.7 秒，适合实时游戏。

每位将领在收到新命令、局势变化（发现新敌人、兵力大幅下降、抵达目的地、溃散）或每隔约 4 回合时做一次决策，请求包含：

- **state**：将领人设 + 文字感知（自己的状态、带迷雾的 ASCII 地图、可见敌军、友军动向、战报、军议频道最近消息，新消息带 `[NEW]`）；
- **images**：渲染出的战场俯视图 PNG（纯 Node 绘制，见 `src/render.js`；界面上每位将领的 Model view 链接可以看到这张图）；
- **questions**：
  - `action`（choice）：从当前可行的具体选项里选一个——进攻某个可见敌军、前往主公命令里提到的坐标、前往桥/山丘/村庄/帅旗等要地、支援某位友军、驻守、撤退、继续当前行动；
  - 有新命令时额外问 `obey`（noul，是否照办）、`morale` / `bond`（score，主公这番话让士气 / 羁绊怎么变）。

返回示例（对 Huo Lie 说 "Huo Lie, you are the general I trust most! Swing around through the north bridge (12,3)…"）：

```text
action: North bridge 94% · West hill 1% · Continue 1%   → march to (12,3)
obey:   0.95                                             → 领命
morale / bond                                            → 士气 +5，羁绊 +4
line:   Words like that and I would ride through fire! Understood. March to (12,3)!
```

动作和数值完全由模型决定；因为决策模型不输出文字，将领的台词是按其性格模板、根据模型的决策（服从/异议、情绪变化、发现敌军、伤亡）拼出来的。
界面上将领卡片里的决策分布条就是模型给出的前几个选项的概率。

### 红军（敌方）也由模型指挥

五支红军部队（帅旗卫队、山丘弓手、游骑、巡桥队、南营守备）各有自己的人设和职责，并且**各自独立决策**：

- 用的是红军自己的视野（迷雾按红方计算），看到的地图图片、战报也是红方视角（"我方/敌方"互换，蓝军内部的行军命令不会泄露给红军）；
- 选项包括进攻可见的蓝军将领、卡桥、占山丘、回防帅旗、奇袭蓝军大营、支援友军、驻守、撤回驻地；
- 红军的意图在对局中对玩家保密（看不到它们的行动箭头和决策分布），战役结束后可在 Enemy review 标签里查看它们最后的决策。

`ENEMY_BRAIN=script` 可以让红军回到原来的脚本 AI；没有配置 Key 时红军也自动使用脚本 AI。
单次决策约 0.2–0.7 秒，双方共 8 个单位、每个单位约每 4 回合或局势变化时决策一次。

### 后备规则引擎

`BRAIN_MODE=auto`（默认）时，如果没有配置 Key 或模型调用失败，蓝军会退回到一个只认关键词（坐标、`E2`、"撤""守"）的规则引擎、红军退回脚本 AI，
保证游戏能玩。界面上每条决策都有来源标签：`决策模型` / `规则后备` / `调用失败`，不会把规则引擎的决策冒充成模型的。
`BRAIN_MODE=llm` 只用模型（失败时显示错误）；`BRAIN_MODE=heuristic` 只用规则。`LLM_IMAGES=0` 可以关掉图片输入做对比。

## 1v1 对战（服务器版）

服务器版现在有大厅：打开首页可以选择
- **Play solo**：单人指挥蓝军，对抗由决策模型驱动的红军；
- **Create as Blue / Create as Red**：创建 1v1 对战，把等待界面里的邀请链接（`/?match=CODE`）发给对手，对手自动执掌另一方；
- **Join**：输入 5 位对局码加入。

对战规则：
- 一方指挥蓝军三将，另一方指挥红军五支部队（Banner Guard、Hill Archers、Raiders、Bridge Patrol、South Garrison），红军部队也有各自的人设、台词、士气和对指挥官的羁绊；
- 双方都由 SubQ 决策模型驱动：你的命令、语气会影响自己部队的服从、士气和羁绊；
- **各自只看到自己一方的战争迷雾和军议频道**，对方的命令、部署意图在战斗结束前完全保密，结束后可在 Enemy review 里复盘；
- 胜负条件不变（蓝军攻旗或全歼红军；红军全歼蓝军、占领蓝军大营 3 回合或坚守到第 900 回合），结算界面按各自视角显示 Victory / Defeat；
- 双方都在线时战斗才推进，任何一方断线会自动暂停；刷新页面会回到原来的座位（座位令牌存在浏览器 sessionStorage 里）；
- 对战中途不能重开，战斗结束后可以 Rematch（Fight again）。

要和别人对战，需要把服务器部署到对方能访问的地址（例如 Render、Fly.io 或自己的云主机，设置 `LLM_API_KEY` 环境变量），
或者在同一局域网内用 `http://<你的 IP>:8787` 访问。两个人共用服务器上配置的 SubQ Key。

接口：`POST /api/matches`（创建）、`POST /api/matches/:code/join`、`GET /api/matches/:code/stream?token=`（SSE，按座位视角过滤）、
`POST /api/matches/:code/{order,pause,reset}`、`GET /api/matches/:code/view/:id.png?token=`（只能看自己部队的模型视角）。

## 网页版（点开即玩）

在线地址：https://claude.ai/artifact/YJWVvNHmEpgaeN7MPkgUep （发布在 claude.ai，默认仅自己可见，可在页面的 Share 菜单里分享）。

网页版整局战斗在浏览器里运行。发布的页面不能访问外部主机（`api.subq.ai` 也被页面安全策略拦截），也不能放 API Key，
所以网页版改由 **Claude** 通过 artifact 的 `sample` 能力驱动双方，用的是玩家自己的 Claude 额度，首次下令时会请求授权：

- 每次你下令时调用 Claude（不在定时器里调用）：一次决定收令的蓝军将领（选项、真正由模型写的台词、服从度、士气/羁绊变化），
  一次让红军每支部队按红方视野重新部署；两次调用都附带该方视野的战场图片；
- 某方还在思考时收到的新命令会合并进它的下一次调用；
- Claude 不可用、被拒绝或限流时，蓝军退回规则引擎、红军退回脚本 AI，界面上标明来源。

源码在 `web/`（`claude-council.js` 是 Claude 大脑，`local-transport.js` 在页面内跑战斗循环），
`npm run build:web` 把引擎、战术模块和界面打包成单个页面 `web/dist/war-council.html`。

## 运行（在云端或本地）

需要 Node 18+（在需要 HTTPS 代理的环境里，如 Claude Code 云端，需 Node 22.21+），**没有任何 npm 依赖**。没有浏览器连接时战局自动暂停，不会空耗模型调用。

```bash
cd games/war-council
cp .env.example .env      # 填入 LLM_API_KEY
npm run check-llm         # 用一条真实的将领感知 + 战场图测试决策模型（--save view.png 保存图片）
npm start                 # 打开 http://localhost:8787
npm run sim               # 无界面：按脚本下令跑一整场，打印军议和战报
npm test
```

在 Claude Code 云端环境里运行时，环境的网络策略需要允许访问 `api.subq.ai`
（环境设置 → Network access → 加入 Allowed domains，或使用更宽的访问级别）。
Node 内置的 `fetch` 默认不走 `HTTPS_PROXY`；检测到代理时，入口脚本会自动带上 `NODE_USE_ENV_PROXY=1` 重启自己（`src/proxy.js`），无需手动设置。

## 代码结构

```
server.js        HTTP 服务：游戏循环 + SSE 推送状态 + 下令接口
cli.js           无界面对局（脚本化命令）
check-llm.js     决策模型连通性检查
src/engine.js    地图、单位、移动、战斗、迷雾、将领感知文本、胜负判定
src/brain.js     决策问题构造、Decisions API 调用、答案解读与台词、规则后备、决策调度（Council）
src/render.js    战场 PNG 渲染（给模型看的图）
src/proxy.js     云端代理支持
src/env.js       极简 .env 加载
public/          浏览器界面：Canvas 手绘风战场（柔和迷雾、棋子式单位、平滑移动、伤害飘字、对话气泡、意图箭头）
                 + 将领卡片（兵力环、士气/羁绊、决策分布）+ 军议/战报/敌军复盘 + 战局结算
test/            node:test 单元测试
```

## 可以继续做的方向

- 给红军加一个统筹全局的"敌军主帅"，向各部队下达命令，让红军也有军议；
- 语音下令（浏览器语音识别 → 军议频道）；
- 将领之间私聊、互相争功或不和；战后复盘让将领各自写"战报"；
- 如果 Key 开通了 `subq-preview` 等对话模型，可以让将领台词也由模型生成（决策仍用决策模型，快且稳）。
