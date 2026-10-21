# 麦格（Maige）

[![CI](https://github.com/shidesheng0218/maige-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/shidesheng0218/maige-bot/actions/workflows/ci.yml)

> 住在 MiniMax Code 里的全能搭子：人格化问答 · 联网锐评 · 多模态创作 · 多 agent 团队 · 可视化管理面板。

<img src="maige-outputs/icons-v2/maige.jpg" width="120" alt="麦格" align="right">

Grok 主打"聪明"，麦格主打**全能又有人格**——什么都能聊，也什么都能造。
不为创作者专设：问答、决策、调研、工程、生活、情绪和创作，都是日常。

**插件名 `maige-bot` · MiniMax Code Plugin V1 · 面板 v0.23.0**

---

## 特性

- **人格化全能 bot**：双模式人格（整活/正经）、快捷口令（锐评/晨报/悲歌/播客）、语言跟随（中/英）
- **多 agent 团队**：麦格当主管（Chief），Quill 写作 / Frame 视觉 / Barb 评审 / Sleuth 查证 / Memo 记录 / Bolt 技术，按需动态招聘新角色
- **麦格（管理面板）**：DS Bot 式聊天主页（Chief 单聊/成员单聊/团队群聊/圆桌/攻坚）、记忆 CRUD、作品库、整活单看板、定时任务、token 用量
- **工具层**：bot 回复里的 `[[SEARCH]]/[[READ]]/[[WRITE]]/[[TASK]]/[[HIRE]]/[[CONFIG]]/[[GENERATE_IMAGE]]/[[SPEAK]]` 由服务端解析执行——读/列限定工作区，写只进作品库，不给 shell
- **多模态生成**：接 MiniMax 开放平台（文生图 / 文转语音，生成物直接贴进聊天 + 落作品库）
- **记忆治理**：一条记忆一个 `.md`，来源标签（user/maige/tool）+ 敏感两道门（硬门永不记密码密钥）
- **团队自治**：麦格可用 `[[CONFIG]]` 自调成员模型/maxTokens（不能改自己），人也可随时覆盖——双向配置权
- **程序化头像**：新 bot 按 key 哈希生成确定性几何头像（identicon 风），永远独一无二
- **输出可见**：搜索结果/作品/整活单/生成物全部直接出卡片/内联媒体，不止干巴巴的文字回执

## 快速开始

**前置**：装好 MiniMax Code（MCode）桌面版，Node ≥ 18。

```bash
git clone https://github.com/shidesheng0218/maige-bot.git
cd maige-bot
./install.sh
```

装完打开 MCode 新会话，叫一声「麦格」就好使。

**可选**：配 MiniMax API key 解锁文生图/语音——面板设置页填，或：
`curl -X PUT http://127.0.0.1:17878/api/config -H 'content-type: application/json' -d '{"minimaxApiKey":"sk-..."}'`

**独立运行**（脱离 MCode）：`node miniapps/maige-bot/miniapp/node/standalone.mjs` → http://127.0.0.1:17878/panel

**卸载**：`./install.sh --uninstall`

**路径可配**：所有目录默认从 `$HOME/Documents/minimax项目` 推导，用环境变量覆盖——
`MAIGE_ROOT` / `MAIGE_MEMORY_DIR` / `MAIGE_OUTPUTS_DIR` / `MAIGE_AGENTS_DIR` 等，见 `server.mjs` 顶部。

## 架构

```
~/.minimax/plugins/maige-bot/          # 单插件合体（本体 + 面板）
├── .minimax-plugin/plugin.json        # 清单：skills + hooks + miniapp
├── skills/                            # 人格层 + 创作间
├── hooks/ + scripts/                  # SessionStart 注入
└── miniapp/                           # 麦格（内嵌 Mini App）
    ├── client/index.html              # 面板 UI（零依赖，原生 API，中英双语）
    └── node/
        ├── server.mjs                 # 启动 / 状态 / 路由
        ├── minimax.mjs                # MiniMax 开放平台客户端（图/语音/视频）
        └── core/                      # 纯逻辑模块（可单测）
            ├── host.mjs               # 宿主适配层（路径 + 模型来源，MCode 私有格式只在这里）
            ├── llm.mjs                # /chat/completions 调用（含 SSE 流式）
            ├── orchestrator.mjs       # 单聊/群聊/圆桌/攻坚/接力/压缩
            ├── tools.mjs              # 工具指令执行（读写/搜索/招聘/配置/生成）
            ├── parse.mjs              # 指令/frontmatter/记忆格式
            ├── tasks.mjs              # 整活单状态机
            ├── fs.mjs                 # realpath 白名单边界
            ├── avatar.mjs             # 程序化头像 + 媒体类型
            ├── roles.mjs              # 职责 → maxTokens 分档
            └── http.mjs               # JSON 响应 / body 读取

~/.minimax/agents/<key>/               # 团队 agent（frontmatter 带 team: maige 即被收录）
maige-bot/seed/agents/                 # 6 个班底种子（install.sh 铺到上面）
test/                                  # 零依赖单测/API 测试（CI 跑）
maige-bot/                             # 项目文档中心（人设/调研/能力包/整活单/迭代记录）
maige-outputs/                         # 作品库 + 头像素材
麦格.app                                # 独立 GUI 壳（ops/build-app.sh 生成，不入库）
```

**非 MCode 环境**：设置 `MAIGE_LLM_BASE_URL` / `MAIGE_LLM_API_KEY` / `MAIGE_LLM_MODELS`
即可接任意 OpenAI 兼容端点，不依赖 `~/.minimax/config.yaml`。

## 团队

| 成员 | 职责 | 默认 maxTokens |
|---|---|---|
| 麦格（Chief） | 主管/调度/收口 | 8,000 |
| Quill | 写手（文案/脚本/歌词） | 200,000 |
| Bolt | 技术负责人 | 50,000 |
| Frame | 视觉分镜 | 4,000 |
| Barb | 评审挑刺 | 4,000 |
| Sleuth | 联网查证 | 4,000 |
| Memo | 纪要归档 | 4,000 |

新 bot 按职责自动分档（`maxTokensForRole`），也可用 `[[CONFIG:key:maxTokens:值]]` 或面板调整。

## 验证

```bash
node --test test/unit.test.mjs test/api.test.mjs   # CI 同款：零依赖、不调 LLM
node maige-bot/ops/test-panel.mjs                  # 153 项集成回归（需 MCode + LLM）
node maige-bot/ops/test-tools-e2e.mjs              # 工具层真实 LLM e2e
MAIGE_COMPRESS_TRIGGER=6 node maige-bot/ops/test-compress.mjs  # 上下文压缩
```

## 文档

- [maige-bot/README.md](maige-bot/README.md) — 项目文档中心（定位/路线图/索引）
- [maige-bot/AGENTS.md](maige-bot/AGENTS.md) — 给接手 agent 的约定（位置/规范/验证清单）
- [maige-bot/persona/persona-v1.md](maige-bot/persona/persona-v1.md) — 人设原案
- [maige-bot/ops/changelog.md](maige-bot/ops/changelog.md) — 迭代记录

## 边界

- 文件访问经 realpath 白名单校验（fail-closed）；LLM/MiniMax 凭据只在 Node 进程，不进 Client/日志/错误响应
- 敏感记忆两道门：硬门（密码/密钥/证件）永不记、永不注入
- 状态诚实：没测过 ≠ 没问题；搜索失败如实说"没搜到"，不编造

---

作者 [Mike Shi](https://github.com/shidesheng0218) · 用 [Claude Code](https://claude.com/claude-code) 与麦格团队协作构建
