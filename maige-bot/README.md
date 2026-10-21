# maige-bot

> 在 MiniMax Code 桌面版里做一个「类 Grok」的全能 bot 插件：人格化问答 + 联网锐评 + 多模态创作（图/视频/语音/音乐）。
> **bot 名字：麦格（Maige）**，插件名 `maige-bot`。

## 定位

Grok 的核心体验：随时在、全能问答、通网、有人格、能整活。
麦格在 MCode 桌面版里复刻这个体验，并用 MiniMax 的多模态能力做差异化——
**Grok 主打"聪明"，麦格主打"全能又有人格"：什么都能聊，也什么都能造**。
不为创作者专设——问答、决策、调研、工程、生活、情绪和创作，都是日常。

## 架构（当前 v0.18.0，单插件合体）

插件实体（MiniMax Code 本地 Plugin V1）：`~/.minimax/plugins/maige-bot/`
**bot 本体与管理面板已合体为一个插件**（2026-10-14，原独立面板插件已收编删除）：

```
maige-bot/
├── .minimax-plugin/plugin.json    # 清单：skills + hooks + miniapp 全声明
├── package.json                   # mcode.miniApp → miniapp/miniapp.json
├── icon.png / icon-dark.png       # 图标
├── skills/
│   ├── maige-persona/SKILL.md     # 人格层：双模式/快捷口令/记忆/问答锐评/代码
│   └── maige-studio/SKILL.md      # 创作间：图/梗图/视频/语音/音乐/双人播客
├── hooks/hooks.json               # SessionStart 事件声明
├── scripts/session-start.mjs      # 会话开始注入「麦格已就位」上下文
└── miniapp/                       # 管理面板「麦格」（内嵌）
    ├── miniapp.json               # runtime: process, entry node/server.mjs, surface /panel
    ├── client/index.html          # 面板 UI
    └── node/server.mjs            # 面板服务（群聊引擎/工具层/记忆/作品库/整活单）
```

v0.2.0 竞品借鉴（Grok/豆包/Kimi/ChatGPT/Claude Cowork）：
双模式人格 · 快捷口令（锐评/晨报/悲歌/播客）·「教麦格」记忆 · MAIGE.md 项目级覆盖 · 定时整活 · 双人播客 · 创作模板库

v0.3.0 记忆与边界治理（参考 dsh-bot，详见 `research/dsh-bot.md`）：
记忆来源标签（[user]/[maige]/[tool]）· 敏感两道门（硬门永不记）· 记忆时效标注 ·
可审查可删除 · 越界审批摆动作 · 豁免带期限 · 不打扰原则 · 状态诚实（没测过≠没问题）

## 麦格团队（v0.4.0，参考 DS Bot 的 Chief + 多 bot 群聊模式）

麦格当主管（Chief），背后 5 个真 agent（MCode 自定义 agent，`~/.minimax/agents/`，可被 task 真实调度）：

| 成员 | 调用名 | 职责 |
|------|--------|------|
| Quill | moke-writer | 文案/脚本/歌词成文 |
| Frame | huajiang-visual | 视觉创意/提示词/分镜 |
| Barb | lengjiao-reviewer | 评审挑刺、压力测试 |
| Sleuth | suyuan-researcher | 联网查证、出处整理 |
| Memo | suji-recorder | 纪要归档 |

流水线：Sleuth 查证 → Quill/Frame 产出 → Barb 评审 → 麦格收口。
触发：对麦格说「开个会」「团队上」；小活麦格自己接，不兴师动众。
已实测：task → 溯源 agent 真实查证任务，按规范返回证据清单与置信度分级。

**动态组队（v0.5.0）**：班底只是起点。任务需要新角色时麦格递「招聘启事」，你确认后现场创建
（frontmatter 带 `team: maige` 标记），面板团队页自动收录。「让 XX 走人」确认后移除。

本目录（`Documents/minimax项目/maige-bot/`）是**项目文档中心**：人设原案、玩法设计、平台调研、迭代记录。

**麦格（Mini App）v0.25.0**：`miniapps/maige-bot/`（已发布，local 来源）
- **群聊**：多 agent 实时对话——麦格 Chief 首发、@提及点名、成员人格接话（同棒最多 3 人并行接力）、正在输入状态、
  消息搜索、token 用量（每条消息带消耗，成员栏聚合）；引擎直连 config.yaml 的 OpenAI 兼容 provider（kimi-k3），消息持久化
- **概览**：KPI（记忆数/作品数/敏感数/麦格版本）、最近记忆与作品、快捷口令速查
- **团队**：成员卡片动态扫描（`team: maige` 标记），新招聘的成员自动入列
- **记忆管理**：完整 CRUD——新增/编辑表单、详情弹窗、删除确认；来源徽章 + 敏感标记
- **作品库**：画廊浏览、点击预览（图片大图/音视频内联播放）、目录可切换
- **设置**：记忆目录与作品目录可配置、插件版本信息
- 麦格记忆统一落在 `maige-bot/memory/`，每条一个 .md（frontmatter: name/description/source/date/sensitive）
- 回归测试：`node maige-bot/ops/test-panel.mjs`（153 项集成回归；另有 test/ 零依赖单测 26 项进 CI）

## 使用方式

插件放入 plugins 目录后由 MiniMax Code 自动识别（新会话生效）：
- 叫一声「麦格」→ 进入人格化对话（全能问答、锐评、陪聊）
- 「麦格，画个梗图 / 做段视频 / 写首歌 / 配个音」→ 进入创作流程
- 会话开始时 Hook 自动告知模型麦格可用

## 验证状态（2026-10-13）

- ✅ plugin.json / hooks.json JSON 解析通过，字段符合 V1 规范
- ✅ session-start.mjs 通过 `node --check`（node v24.18.0）
- ✅ Hook 模拟运行输出合规的 SessionStart additionalContext
- ✅ Desktop 识别：SessionStart hook 注入已在本会话生效（见 plugin-hook-context）
- ✅ v0.2.0 迭代后 JSON 重新验证通过

## 路线图

- **P0 ✅** 插件 v0.1.0：人格 + 创作双技能 + SessionStart Hook
- **P1** 实测调教：真实对话中修人设漂移、补充语气示例
- **P2** 能力扩展：按需增加 MCP（如固定的实时信息源）或更多细分技能
- **P3** 跨端外溢：人设资产可复用到星野智能体 / Agent Expert / MaxClaw（调研见 `platforms/platform-paths.md`）

## 文档索引

| 文件 | 内容 |
|------|------|
| `persona/persona-v1.md` | 人设原案（名字候选、五维、语气、边界） |
| `prompts/system-prompt.md` | 提示词母版（插件 skill 的源头） |
| `skills/skills-design.md` | 多模态玩法清单 |
| `assets/avatar-prompts.md` | 形象概念（可用于生成 bot 头像/表情包素材） |
| `platforms/platform-paths.md` | 星野 / Agent Expert / MaxClaw 外溢路径调研 |
| `ops/changelog.md` | 迭代记录 |
