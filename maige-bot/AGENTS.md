# AGENTS.md — 麦格（Maige）项目

> 给任何接手本项目的 coding agent：读完这份就知道怎么改。参考 LangBot 的 agent-friendly 约定。

## 项目是什么

MiniMax Code 桌面版里的全能 bot 插件「麦格」：人格化问答 + 多模态创作 + 多 agent 团队 + 管理面板。
载体是 MCode 本地 Plugin + 自定义 Agent + Mini App，不是独立服务。

## 组成部分与位置

| 部分 | 位置 | 改它之前要知道 |
|---|---|---|
| 麦格插件（人格/技能/Hook） | `~/.minimax/plugins/maige-bot/` | Plugin V1 规范；改 skill 后 bump `.minimax-plugin/plugin.json` 的 version |
| 团队 agent（班底） | `~/.minimax/agents/<name>/` | `agent.md` frontmatter 必须带 `team: maige` + `display: 名字` 才会被面板收录；可由面板招聘（`[[HIRE]]` / 团队 tab），移除入回收站；种子在 `maige-bot/seed/agents/` |
| 麦格（Mini App） | `miniapps/maige-bot/`（本工作区） | 改完必须 `node maige-bot/ops/test-panel.mjs` 全过，再 publish。每 bot 可选模型 + 可选 maxTokens 分档（`config.models` / `config.maxTokens`） |
| 面板服务端 | `miniapps/maige-bot/miniapp/node/` | `server.mjs` 只剩启动/状态/路由；纯逻辑在 `core/`（host/parse/fs/http/llm/tasks/roles/avatar/tools/orchestrator）。新增能力优先放 `core/` 并补单测 |
| 麦格.app（独立 GUI） | 工作区根目录 `麦格.app` | 由 `maige-bot/ops/build-app.sh` 生成；构建产物**不入库**（`.gitignore` 已排除 `*.app/`）；独立入口 `standalone.mjs`，端口 17878 |
| 测试 | `test/`（CI）+ `maige-bot/ops/`（集成） | `test/unit.test.mjs`、`test/api.test.mjs` 零依赖、不调 LLM，CI 必跑；`ops/test-panel.mjs` 是真实 LLM 集成测试，本地手动跑 |
| 项目文档中心 | `maige-bot/`（本工作区） | 迭代记到 `ops/changelog.md`，调研存 `research/` |
| 麦格记忆文件 | `maige-bot/memory/*.md` | 每条一个 .md，frontmatter: name/description/source(user\|maige\|tool)/date/sensitive |
| 能力包 | `maige-bot/capabilities/*.md` | 每包一个 .md，frontmatter: name/description；面板「能力库」tab 读取，挂到 bot 即注入其 system prompt |
| 整活单 | `maige-bot/tasks/*.md` | 每张一个 .md，frontmatter: id/title/kind/status/created/updated/createdBy/assignee/deliverables；状态机 draft→ready→making→done（image/text 开单直通 ready），攻坚分工时正文点名即 assignee 到人，成员用 `[[DELIVER]]` 交付成品 |

## 面板开发约定

- **零依赖**：只用 Node 内置模块 + 浏览器原生 API，不引 npm 包；纯逻辑放 `miniapp/node/core/`（可单测）
- **安全边界**：文件访问经 `realpath` 白名单校验（fail-closed）；LLM/MiniMax 凭据只在 Node 进程，
  不进 Client/日志/错误响应；`config.json` 写盘权限 600
- **CSRF**：浏览器带 `Origin` 的写请求必须带 `x-maige-csrf: 1`（客户端 `api()` 自动加）；
  带 body 的写请求必须是 `application/json`。跨站简单请求因此无法触发任意动作
- **视觉基线**：`--mcode-*` CSS 变量 + `prefers-color-scheme`；禁 emoji、禁远程资源；
  交互元素带 aria-label/可见文本
- **群聊引擎**：模型走**自带模型**层（`core/host.mjs` + `config.providers`）：用户配置的 provider 优先，
  其次内建 `mcode`（config.yaml 的 OpenAI 兼容 provider），最后 `env`（`MAIGE_LLM_*`）；
  `thinking: {type:'disabled'}` 只发给 `thinking:true` 的 provider（dashscope/Qwen 系，否则 content 为空），
  其余 OpenAI 兼容端点不收这个陌生字段；`stream_options` 同理按 provider 开关；
  接力用 `[[CALL:key]]`，同棒最多 3 人并行、一轮最多 4 棒
- **编排**：单聊/群聊/圆桌（`圆桌：主题`）/攻坚（`攻坚：任务`）都在 `core/orchestrator.mjs`；
  攻坚最多 8 棒，允许回头叫已发言者
- **停止**：每个会话的回合持有 AbortController（`core/orchestrator.mjs` 的 beginTurn/cancelTurn），
  `POST /api/chat/stop` 可中断正在进行的模型请求；`callLlm` 收外部 signal，中止抛 `llm_aborted`（不算故障）；
  中止后不再续跑新回合，并落一条「已停止当前回合」系统消息
- **回合预算**：`core/budget.mjs`（纯函数）+ `config.budget {maxTokens,maxMinutes}`（0=不限，分钟可小数）。
  每次调用前 `allot` 把 max_tokens 收敛到剩余预算；每次回复后 `account` 记账并检查；
  时长预算额外挂一个到点 abort 的 timer；停止原因分 user/tokens/time，收尾文案由 `budgetReasonText` 给。
  `runTurn` 有"本轮无产出即退出"的保护，避免预算为 0 时空转
- **记忆**：非敏感记忆注入所有发言者 system prompt（敏感记忆两道门，永不自动注入）；
  会话里发「记住：…」确定性落盘
- **搜索**：多源降级（必应 → 搜狗 → DuckDuckGo，各 7s 超时），只保留 http(s) 链接；失败要诚实
- **安装向导**：检测不到模型服务且首次打开 → 弹引导配模型；跳过/保存都记 localStorage 不再打扰
- **数据导出**：设置页「数据」一键导出 zip（记忆/任务/作品/配置），落作品库
- **快捷口令**：聊天输入框打 `/` 出候选（上下键/Enter/Esc）；口令卡片同步
- **移动端**：640px 以下会话列表收抽屉、聊天全宽
- **压缩**：会话超阈值把旧消息压成纪要（env MAIGE_COMPRESS_* 可调）；`media`/`card` 消息用占位描述，
  不把空行喂给模型
- **工具层**：bot 回复里的 `[[SEARCH]]/[[READ]]/[[LS]]/[[WRITE]]/[[TASK]]/[[HIRE]]/[[CONFIG]]/[[GENERATE_IMAGE]]/[[SPEAK]]/[[GENERATE_VIDEO]]/[[DELIVER]]/[[REMEMBER]]`
  由 `core/tools.mjs` 解析执行；读/列限定工作区，写只进作品库；不给 shell；
  `[[CONFIG:key:model:值]]` 的值格式是 `provider/model`（裸模型 id 落到默认 provider）；
  `[[DELIVER:任务id:文件名]]` 把成品挂回整活单并标记 done（交付契约闭环）；
  `[[REMEMBER:正文]]` 主动记忆（bot 发现值得记的事自动落盘）
- **自带模型**：provider 存 `config.providers`（id/name/baseURL/apiKey/models/defaultModel/thinking），
  增删改走 `GET/POST/PUT/DELETE /api/providers`；key 不回显（只回 `hasKey`）；`mcode`/`env` 为保留 id
- **输出可见**：搜索结果/作品/整活单用 `card` 消息（结构化数据，文案由客户端 i18n 渲染），
  生成图/语音用 `media` 消息内联展示
- **流式**：callLlm 传 onChunk 走 SSE，增量进 conv.draft；客户端自适应轮询（忙 700ms/闲 2s）
- **图片**：附图/粘贴 → dataDir/images/（消息存引用 id）；最近带图消息以 content 数组进视觉调用
- **新增端点后**：更新 `ops/test-panel.mjs` 并跑通；纯逻辑同时补 `test/` 单测；版本号断言从 manifest 读取，不写死

## 验证清单（交付前）

1. `node --check` 面板 server
2. `node --test test/unit.test.mjs test/api.test.mjs`（CI 同款，零依赖）
3. `node maige-bot/ops/test-panel.mjs` 全过（真实 LLM 集成）
4. `miniapp publish` + `open` + Browser 验收（结构/交互/console 零错误）
5. 更新 changelog、README、AGENTS.md（防止文档漂移）

## 团队调度（在麦格会话里）

麦格是 Chief：Sleuth 查证 → Quill/Frame 产出 → Barb 评审 → 麦格收口。
新角色按需招聘（用户确认后 `mavis agent create`），不写死阵容。
麦格可用 `[[CONFIG:key:maxTokens/model:值]]` 自治调成员配置（不能改自己），人也可随时 `PUT /api/bot` 覆盖——双向都有配置权。
