# CLAUDE_FOR_GAMES

每个游戏都放在 `games/<游戏名>/` 下，彼此完全隔离：

- 各自有自己的 `package.json`、依赖、`.env`、测试和启动脚本，不共享任何代码；
- 在某个游戏目录里 `npm test` / `npm start` 只影响这个游戏；
- 新游戏 = 新建一个 `games/<name>/` 目录；也可以按游戏分开分支开发（例如 `game/war-council`），互不干扰。

| 游戏 | 目录 | 简介 |
| --- | --- | --- |
| War Council（英文版，支持 1v1 对战） | [`games/war-council`](games/war-council) | 实时战棋：三位将领由 SubQ 决策模型实时驱动（读战报 + 看战场图），你用自然语言（甚至情绪）统率他们 |

API Key 等密钥只放在各游戏目录下的 `.env`（已被 git 忽略），不要提交到仓库。
