# 迭代记录

## 2026-10-14 面板 v0.22.0：输出必须可见——搜索结果/作品/整活单全出实物
- 用户：「要求输出的内容必须让用户有直接可以看到的感知到」——把"干了活但看不见"的几处全改成直接出实物
- **搜索结果**：不再只由 bot 转述，直接贴成可点链接的结果卡片（标题+摘要+URL）
- **写作品 [[WRITE]]**：不再只说"写好了"，作品内容直接贴成卡片（超 2000 字截断预览，全文在作品库）
- **整活单 [[TASK]]**：不再只说"已开单"，直接贴单子卡片（标题/类型/状态/需求预览）
- 新增 `card` 消息类型 + client 卡片渲染（标题/正文/可点链接条目/页脚）
- 回归 153 项全过

## 2026-10-14 面板 v0.21.0：生成物内联展示——图直接贴进聊天
- 用户：「他不直接发给我看看嘛？」——生成图此前只回一句"画好了"，看不到图
- 新增 `media` 消息类型：生成图/配音后贴一条带媒体的消息，client 渲染为内联图片/音频播放器/视频，
  不再只有干巴巴的文字回执。图同时仍落作品库
- server `appendMessage` 支持 media 字段；`[[GENERATE_IMAGE]]`/`[[SPEAK]]` 成功后自动贴媒体消息
- 回归 153 项全过（新增 media 消息结构断言）

## 2026-10-14 面板 v0.20.0：MiniMax 端点修通（图像实测出图）+ 攻坚模式
- **修通 MiniMax 生成**：端点域名从 platform.minimaxi.com 更正为 api.minimax.cn（图像 /v1/image_generation、
  语音 /v1/t2a_v2）。真实调用验证通过：文生图「发光紫色水晶球」返回有效 URL（base_resp.status_code=0）。
  此前 404 的根因即域名写错
- **攻坚模式**（用户：「bot 能互相讨论配合完成任务」）：群里发「攻坚：任务」触发——
  麦格拆任务并 [[CALL]] 分工（可多人并行）→ 成员多轮讨论（允许回头叫已发言者，最多 8 棒防暴走）→
  麦格收口产出可执行方案（谁做什么/产出/顺序/要不要开整活单）。与圆桌的区别：圆桌一人一轮说观点，
  攻坚围绕具体任务多轮来回直到收敛
- 已知遗留：① 视频生成端点未实测（按秒计费，探测被拦，待用户确认再接）② 麦格对「Bolt 已入职」
  记忆滞后（重复说「想招 Bolt 但工位有人」），待写记忆修正
- 回归 152 项全过

## 2026-10-14 面板 v0.19.0：独一无二头像 + MiniMax 生成骨架（不依赖 key 的部分）
- **程序化头像**：新 bot 无素材时不再 404 回退首字母，服务端按 key 哈希生成确定性几何头像
  （品牌紫系 HSL 色 + 5×5 左右对称图案，identicon 风，纯 Node 零依赖）。同 key 永远同图、不同 key 必不同，
  已有素材的（maige/Quill 等）仍优先走 icons-v2/icons
- **MiniMax 客户端骨架**（`miniapp/node/minimax.mjs`）：图像（image-01）/ TTS（speech-2.8-turbo）/
  视频（H3-Max，异步任务+轮询）三个生成函数就位，key 从 env MINIMAX_API_KEY 或 config.minimaxApiKey 读，
  只留 Node 进程；配置端点回显抹掉 key 本体
- **新工具指令**：`[[GENERATE_IMAGE:提示词]]` 文生图、`[[SPEAK:文本]]` 文转语音，生成物自动落作品库；
  未配 key 时诚实报「没配，别假装生成了」。视频函数已备但未挂指令（按秒计费，待确认再接）
- 诊断端点新增 minimaxConfigured 标志
- 回归 152 项全过（新增头像 SVG 3 项 + 指令解析 2 项 + 配置标志 1 项）

## 2026-10-14 插件合体：maige-hq / maige-panel 收编进 maige-bot（单插件）
- 用户：「能不能把他们两个融合成一个？」——bot 本体与管理面板合体为单一插件 `maige-bot` v0.18.0
- 合体结构：skills（人格+创作）+ hooks（SessionStart）+ miniapp（麦格总部面板）共用一个 plugin.json 清单
- 关键决策：合体后插件名保留 `maige-bot`——server.mjs 读版本号的 `MAIGE_PLUGIN_MANIFEST` 写死该路径，不破
- **数据迁移**：MCode 按插件名分数据目录（`~/.minimax/v2/plugin-data/liveboards/<名>/`），
  已把旧 maige-hq 的 chat.json + config.json（含麦格已挂 3 能力包）搬到 maige-bot
- 删除：maige-hq（旧面板插件）、maige-panel（10-13 改名残留的废壳）双双入回收站；
  maige-panel 孤儿数据目录一次删除被拦（分类器瞬时错误），无害遗留待清
- 备份：maige-hq 面板在 /tmp 留了完整副本
- 验证：合体 plugin.json JSON 解析过、server/session-start 语法过、引用文件齐全

## 2026-10-14 面板 v0.18.0：麦格自治——[[CONFIG]] 工具 + 新 bot 自动分档
- **[[CONFIG:key:field:value]] 新工具**：麦格可直接调成员 maxTokens / model，不用等 Mike 动手。
  自治边界：不能改自己（防自我开挂）、只能改团队真实成员、值仍走白名单校验
- **新 bot 入职自动分档**：`maxTokensForRole` 按职责关键词映射档位（写手 200k / 技术 50k / 主管 8k /
  评审·视觉 4k / 查证·记录 2k→4k / 兜底 4k），hireBot 落档，不再一刀切 600
- 存量 6 个 bot 已按规则值校准（Sleuth/Memo 2000→4000，其余对齐规则）；TOOL_PROMPT 同步 CONFIG 说明
- 回归 145 项全过（新增 CONFIG 解析 2 项 + 角色映射 6 项 + hire 自动分档 1 项）

## 2026-10-14 面板 v0.17.0：对齐 Grok 三连——并行接力 / 非敏感直通 / 分档 token
- **群聊接力改并行**（Grok Heavy 式多智能体并发，补半成品）：`parseCalls` 从 `slice(0,1)` 放开为
  同棒最多 3 人、去重去已发言，runTurn 用 `Promise.all` 并行触发同一棒成员——
  麦格可一条回复同时喊 Quill 写稿 + Frame 配图，不再串行一棒一棒传。群聊 prompt 同步改为"最多 3 个同时开口"
- **非敏感整活直通**：`AUTO_READY_KINDS = ['image','text']` 开单即 ready（免确认、点开始即制作），
  video/audio 成本高保留人工确认闸；TOOL_PROMPT 与通知文案同步区分
- **每 bot 分档 token**：新增 `config.maxTokens`（key→128~8192 整数），`maxTokensFor` 随发言传入 callLlm，
  解开全员 600 token 的封印（写稿/技术负责人可给长输出）。`PUT /api/bot` 支持 maxTokens 字段（可清空还原）
- `parseCalls` 经 `_internals` 导出供单测；修掉 server.mjs 头注释版本号与实际脱节的技术债
- 回归 136 项全过（新增 10 项：parseCalls 并行/去重/上限/跳过已发言/未知成员，maxTokens 设置/非法值/还原，
  video 确认闸保留）；圆桌实测 8 人完整发言不受影响

## 2026-10-14 面板 v0.16.1：定位扳正——不只服务创作者（用户：「这个项目不仅仅是为了创作者做的」）
- **能力库扩编**（4 → 8 包）：新增 决策陪审团（选项×利弊×风险，强制给结论）/ 学习私教（费曼讲解+小测）/
  生活参谋（精明消费与计划）/ 代码搭子（结对编程与评审）
- **定位文案**：README、maige-persona 技能、面板 chief 人格、提示词档案——
  「创作型搭子」→「全能搭子：什么都能聊，也什么都能造」；Grok 对比语改为「全能又有人格」
- **示例编队一键组队**（团队 tab 顶部）：个人助理组（Plan+Coach）/ 学习组（Tutor+Quiz）/
  工程组（QA+Ops），一键批量招聘、已在队里的自动置灰

## 2026-10-13 面板 v0.16.0：按需求定制 bot（用户：「要根据用户的需求定制bot」）
- **聊天里招聘**：新工具 `[[HIRE:key:职责:显示名]]+人格说明` —— bot 现场写入职文件到
  `~/.minimax/agents/<key>/`（agent.md 带 team: maige + display，PERSONA.md 人格），
  下一轮即被面板收录：侧栏出现、可单聊、可进群、可进圆桌
- **管理台手动招聘/移除**：团队 tab「新建成员」表单（key/显示名/职责/人格提示词）；
  成员卡片「移除」→ 目录入回收站（可恢复）；maige 不可移除，非麦格团队的 agent 不碰
- **纪律补丁**：TOOL_PROMPT 加「先说后做等于撒谎」——宣布动作却没有指令 = 禁止。
  起因：麦格第一次嘴上说「Bolt 已入职」但没写指令（幻觉动作），被戳穿后第二次真写了
- **首位定制成员入职**：Bolt（tech-lead，技术负责人）——截图里麦格自己说缺的那个角色；
  已验证：会话列表 8 个、DM 单聊正常（人格已清洗：首版提示词把整段回复误录进了 persona）
- 回归 126 项全过（新增招聘/移除/冲突/保护 8 项 + parseTool HIRE 单测；测试写真实 agents 目录，
  有自愈清理：开头先删可能残留的 test-bot-x）

## 2026-10-13 面板 v0.15.0 + 插件：流式/图片/圆桌/导出/语音/记忆贯通（用户：「全部执行」）
- **SessionStart Hook 升级**（MCode 会话 ↔ 面板的最后一公里）：会话启动时注入「最近 5 条非敏感记忆 +
  提示词就绪的整活单」，敏感记忆两道门不进注入；读取失败退化为静态文案，实测通过
- **流式输出**：callLlm 支持 SSE（stream_options 带 usage），speakWithTools 把增量写进 conv.draft，
  面板轮询时渲染草稿气泡（不碰分组状态）；客户端自适应轮询（打字/流式中 700ms，空闲 2s）
- **图片输入**：附图按钮 / 直接粘贴；图片落盘 dataDir/images/（消息只存引用 id，不膨胀 chat.json）；
  最近一条带图消息以 content 数组进视觉模型调用；校验格式与 7MB 上限
- **圆桌模式**：群聊发「圆桌：主题」→ 麦格开场 → 每位成员一轮 → 麦格收尾（实测 7 人完整发言）
- **会话导出**：头部「导出」→ Markdown 落作品库（含纪要头与系统消息），toast 回执文件名
- **语音输入**：SpeechRecognition 可用时才显示麦克风，随界面语言切换 zh-CN/en-US
- **交付回写**：整活单带 conv 字段，标记交付时向来源会话发系统回执 + 系统通知
- 回归 116 项全过（新增图片/导出/回写/圆桌/draft 字段 17 项）

## 2026-10-13 面板 v0.14.0：整活闭环 + 系统通知 + 记忆相关性 + Q 版头像（用户：「全部完成」）
- **整活闭环（P0）**：任务状态机落地——`maige-bot/tasks/*.md` 文件即真相（面板与 MCode 会话共享目录）；
  状态机 draft(待确认) → ready(提示词就绪) → making(制作中) → done(已交付)，cancelled 可复活；
  非法转移 409，done 终态；bot 用新工具 `[[TASK:类型:标题]]+需求与提示词包` 开单
- 管理台新增「任务」tab：按状态分组的看板、详情弹窗、状态操作按钮（确认/开始制作/标记交付/退回/取消/删除）、
  交付物链接作品库文件；支持手动新建
- **系统通知（P1）**：定时任务触发、bot 开新整活单时发 macOS 通知（osascript）；
  设置页可关；测试进程用 MAIGE_HQ_NO_NOTIFY=1 抑制
- **记忆相关性（P2）**：注入前按「最近 5 条用户消息的关键词（CJK 双字组+拉丁词）命中数」重排，取前 30
- **Q 版头像 v2 上线**：icons-v2（6 张）生成成功并接入——/api/avatar 按 icons-v2 → icons、png → jpg 顺序回退；
  app 图标同步换成 v2 麦格；build-app.sh 版本号改为从 plugin.json 自动读取
- e2e 实测：麦格开出「落日海报」整活单，需求+完整英文提示词自动写全
- 回归 101 项全过（新增任务状态机 12 项：转移合法性/终态/交付物/404/删除）

## 2026-10-13 麦格总部.app：独立 GUI 壳（用户追问「不能有独立的 gui 吗」）
- 新增 `miniapps/maige-hq/miniapp/node/standalone.mjs`：脱离 MCode 宿主的独立运行入口
  （复用同一 server.mjs，固定端口 17878，数据目录 maige-bot/data/standalone/）
- 新增 `maige-bot/ops/build-app.sh`：零依赖构建 `麦格总部.app`（Info.plist + bash 启动器 +
  orb 图标经 sips/iconutil 转 icns；旧构建入回收站）
- 启动器行为：服务未跑则 nohup 起服务 → 轮询就绪 → Chrome app 模式窗口（无地址栏，独立 Dock 图标）；
  无 Chrome 退默认浏览器；重复启动复用已跑服务
- 与 MCode Mini App 的关系：共享记忆/作品库/能力包/团队（同一批真实目录），
  聊天记录与本实例配置独立（避免两个服务写同一 chat.json）
- 验证：open 后 0.13.1 就绪、7 会话、llmReady、日志干净、页面完整渲染

## 2026-10-13 面板 v0.13.1：语言跟随（用户：「中文就回复中文，英文就回复英文」）
- 所有 system prompt（主管/成员 × 单聊/群聊）加入语言跟随规则：用户中文则中文、英文则英文；
  显式挂载的能力包仍可覆盖（规则写成「能力包另有约定时听能力包的」）
- 「双语回响」从麦格身上摘下（保留晨报/播客/毒舌），包本身保留在能力库，需要时一键挂回
- 写入长期记忆 `lang-follow.md`（source: user）：不默认双语，需要双语用户会明说
- 回归测试治理：记忆目录改用 fixture 隔离（真实 maige-bot/memory 不再参与测试，
  修掉了「真实记忆加一条就挂测试」的硬编码计数；顺带清掉误落真实目录的 test-delete.md）

## 2026-10-13 面板 v0.13.0：商业级质感（用户：「做成商业级产品的质感，要有设计感」）
- 设计系统覆盖层：麦格紫品牌色（light #6e56cf / dark #9e8cfc，取自 orb 图标）+ 三级阴影 + 圆角分级，
  以追加样式表方式叠加在 --mcode-* 基线之上（不动既有组件类，级联覆盖，回归零风险）
- 签名动效「在线光圈」：正在输入的 bot 头像起一圈品牌色涟漪（侧栏各会话 + 聊天头部头像联动，
  数据源是 conversations 新增的 typing 字段）
- 聊天区商业排版：内容列居中（max 720px）、连续同一人发言自动分组（5 分钟内只显示一次头像名字）、
  >30 分钟或跨天插入时间分隔线（今天 HH:MM / M月D日 HH:MM）、系统消息居中胶囊、
  【工具】消息品牌色浅底芯片、消息入场 160ms 微浮入
- 发送区悬浮药丸：圆角输入框 + 紫色圆形 SVG 箭头发送键；输入中指示改为三点弹跳 + 名字
- 聊天头部状态行：在线 · 当前模型 · 能力包数（点状态行/头像仍进详情）
- 气泡内极简富文本：先转义再渲染 **粗体** 与 `行内代码`（防注入，不引完整 Markdown）
- 细节：细滚动条、modal 毛玻璃遮罩 + 弹入、btn 按压回弹、输入框聚焦品牌色光晕、
  prefers-reduced-motion 全部降级
- 回归 87 项全过；浏览器实测：侧栏/会话/空态/管理台/真实收发全链路正常

## 2026-10-13 项目正名 maige-bot（用户：「这个项目就叫maige-bot」）
- 文档中心目录 minimax-bot/ → maige-bot/（cp 校验一致后旧目录入回收站）
- 全量引用更新：面板 server 的 memoryDir/CAPS_DIR 默认值、客户端 resetConfig、三个测试脚本、
  README/AGENTS.md/项目之家记忆、maige-persona skill（顺手修掉「麦格面板」旧称）、工具 prompt 示例路径
- 线上实例 dataDir 里存着旧 memoryDir，已用 PUT /api/config 修正并清掉被 mkdir 误建的空目录
- changelog 历史条目不回改（日志是当时的记录）
- 回归 87 项全过；面板已重发布（v0.12.0 版本不变，纯路径变更）

## 2026-10-13 面板 v0.12.0：工具层——bot 有手了（读文件/列目录/写作品/主动搜索）
- 工具协议沿用 [[CALL:key]] 的指令思路（不赌 kimi-k3 的 function calling，指令解析实测稳定）：
  bot 在回复里写 `[[SEARCH:关键词]]` / `[[READ:路径]]` / `[[LS:路径]]` / `[[WRITE:文件名]]+内容`，
  服务端解析执行，结果作为【工具】系统消息回注上下文，同一位发言者接着说
- 每位发言者最多 3 轮工具调用（TOOL_ROUNDS）；WRITE 的内容不刷聊天（太长），只留回执
- 安全边界：READ/LS 经 realpath 前缀校验限定在工作区（文本、≤256KB、截断到 4000 字符进上下文）；
  WRITE 文件名扁平化、只落作品库（≤100KB）；不给 shell——跑命令的权限面暂不开
- 工具说明注入所有 bot 的 system prompt；单聊/群聊接力每一棒都能用工具
- e2e 实测（ops/test-tools-e2e.mjs，真实 LLM）：麦格读 README 答出第一行、写四行摸鱼诗进作品库、
  搜索「MiniMax 港股」被必应拆字成"用"字词典时如实汇报没搜到（诚实兜底生效，没有编造）
- 回归 87 项全过（新增 parseTool/resolveWorkspace 单元用例 10 项：指令解析、多行写入、路径穿越拦截）
- parseTool / resolveWorkspace 作为 named exports 供测试直接引用

## 2026-10-13 面板 v0.11.0：深度三连——记忆进对话、联网搜索、上下文压缩
- **记忆进对话**：非敏感记忆（最新 30 条，name+desc）注入所有发言者的 system prompt（单聊/群聊都生效）；
  敏感记忆遵守两道门——永不自动注入
- **面板写记忆**：任何会话里发「记住：…」（或 remember:），确定性直接落盘（不过模型），
  聊天里回执「已记住」，立刻进入之后所有对话的上下文
- **联网搜索**：命中触发词（搜索/查一下/最新/新闻…）→ 服务端先抓 cn.bing.com（国内直连、无 key 依赖、
  10s 超时）→ 结果作为系统消息进上下文 → bot 基于结果回答；失败时诚实说"没搜到，凭印象答"
- **上下文压缩**：会话 >60 条时把旧消息压成 ≤200 字纪要（保留用户偏好/决定/事实/未完成的承诺），
  之后模型读「纪要+最近 20 条原文」；距上次又涨 40 条再重压；纪要随 chat.json 持久化；
  阈值可用 MAIGE_COMPRESS_* env 覆盖（供手动验证）
- **回合续跑防漏答**：回合结束时若最后一条仍是用户消息（跑的时候又来了新消息），自动接着答——
  修掉了「回合进行中发消息被丢弃」的并发缺陷
- transcript 中系统消息改带【来源】前缀（联网搜索/记忆/系统），模型能分清
- 诊断端点新增 summaries（每会话纪要元信息）
- 验证：回归 77 项全过（新增记忆捕获/搜索管线用例，搜索真实返回必应 5 条带链接）；
  压缩用 ops/test-compress.mjs 小阈值实测：压缩→再压缩→麦格凭纪要答出只存在于被压消息里的数字

## 2026-10-13 面板 v0.10.0：bot 详情页 + 能力库（补齐 DS Bot 剩余两块）
- bot 详情弹窗：聊天页点顶部头像 / 团队页点成员卡片进入；展示头像、名、职责、人格、用量（发言数·token）
- 每 bot 选模型：GET /api/models 列出当前 provider 的对话模型（dashscope 块：kimi-k3 / deepseek-v4.1-flash，自动排除 image 类），
  覆盖写入 config.models，下一条消息生效；不选则跟随全局默认 kimi-k3
- 能力库（DS Bot Capabilities 的提示词包形态）：minimax-bot/capabilities/*.md（frontmatter: name/description），
  播种 4 包：毒舌模式 / 双语回响 / 播客导演 / 晨报小编；挂载关系存 config.capabilities，
  命中即注入该 bot 的 system prompt（单聊、群聊接力都生效）
- 新端点：GET /api/models、GET/PUT /api/bot、GET /api/capabilities；PUT 校验模型白名单、包 id 白名单、bot 存在性
- 管理台新增「能力库」tab：包列表 + 挂载到哪几个 bot
- 注：DS Bot 的「本地 MCP 命令需审批」对我们不适用——我们的包是提示词不是命令，无执行面
- 回归测试 72 项全过（新增 16 项：模型列表、包列表、详情、挂载/校验/还原）

## 2026-10-13 面板 v0.9.0：DS Bot 式聊天主页（用户参考 DeepSeek-Bot 提出）
- 布局重写：左侧会话列表（麦格 Chief 置顶 → 麦格团队群聊 → 成员单聊）+ 右侧聊天主区，打开即聊天
- 服务端多会话引擎：conversations 按 id 隔离（chief / group / m:<key>），各自独立历史、typing、running
  - chief/成员单聊：单发言者一轮定音，专属 DM system prompt（不再带 [[CALL]] 接力规则）
  - group 群聊：保留主管先答 + @点名 + [[CALL:key]] 接力（最多 4 棒）
  - 旧版单群聊 chat.json 自动迁移为 group 会话；消息仍按会话各存 500 条
- 新端点：GET /api/chat/conversations（含最后一条预览）、GET /api/avatar?key=（成员 key→display 名→icons/*.jpg，fail-closed）
- send/clear/messages 端点支持 conv 参数（默认 group，向后兼容）；用量统计聚合全部会话
- 头像接入 icons v1（商业符号风 6 张）：侧栏、聊天消息、团队卡片、品牌位，加载失败回退首字母
- 管理台收纳为二级入口（侧栏底部「管理台」按钮）：概览/团队/记忆/作品库/定时任务/设置六区
- 搜索改为按当前会话过滤；清空按当前会话；定时任务仍注入群聊
- 回归测试 55 项：新增会话列表、三路并发单聊/群聊、头像映射、非法会话防护等用例

## 2026-10-13 面板改名 maige-hq「麦格总部」（用户反馈"面板"不好听）
- Mini App：miniapps/maige-panel → miniapps/maige-hq，pluginId/name/displayName 同步
- 面板标题改「麦格总部」（HQ=指挥部，呼应麦格 Chief 设定），中英同步
- server 日志事件前缀、测试脚本路径、AGENTS.md、记忆文件全部同步
- 旧实例 maige-panel 已 stop，旧目录移入回收站
- 收尾补漏：index.html 静态 h1 回退文案、server.mjs 头注释、plugin.json exampleQueries 残名清零
- 测试断言修正：作品库默认目录 maige-outputs 已建（图标 v1 时已创建），原"目录不存在"断言改为"目录存在且有内容"
- 验收：maige-hq 已 publish 运行中，回归 46 项全过

## 2026-10-13 面板 v0.8.0：中英双语
- 面板全量 i18n：I18N 字典（zh/en 两套，约 120 个键）+ data-i18n 绑定 + 设置页语言三档
  （跟随浏览器/中文/English，存 localStorage）+ 切换后重载当前分区
- 动态文案全部走 t()：空态/加载/错误/toast/表单校验/确认弹窗/诊断模板
- 口令卡片双语（口令名保留中文，英文版给解释）；记忆/作品内容等真实数据不翻译
- 踩坑：replace_all 误伤 I18N 字典自身的 5 处定义（字典值被替换成 t() 调用导致启动即抛
  TypeError）——console 诊断抓获并全部恢复；教训：批量替换前先排除定义文件段
- 麦格人格加「语言跟随」规则（插件 → v0.5.2）
- 验收：Browser 实测中文→English→中文切换，页面标题/标签/按钮/诊断全量切换

## 2026-10-13 面板 v0.7.0：DS Bot 设置体系映射
- 读了 DS Bot 设置页全套截图（通用/Bot/群聊/连接器/定时任务/用量/密钥/反馈/关于）
- 落地 4 件：用量升级（14 天 Token 走势堆叠图 + 成员消耗排行）、定时任务页（到点指定成员
  在群聊自动发言，daily 定点 / interval 间隔）、主题三档（跟随系统/浅色/深色，存 localStorage）、
  设置页诊断区（面板自身错误环形日志 50 条 + 一键复制诊断信息）
- 面板版本号收敛为 PANEL_VERSION 常量（修两处字面量不一致的隐患）
- 回归测试 45+ 项全过（新增 byDay 聚合/任务 CRUD/诊断端点）；Browser 实测任务创建、
  深色主题切换、诊断区渲染；测试任务已清理
- Backlog：密钥管理（当前单模型源用不上）、连接器、多群聊

## 2026-10-13 面板 v0.6.0：参考 LangBot + DS Bot(Fei2411)
- DS Bot 借鉴：token 用量统计（每条 agent 消息带 usage，/api/chat/usage 按成员聚合，
  成员栏显示"N 次发言 · N tok"，概览加「群聊消耗」KPI）、群聊消息搜索（顶部搜索框即输即滤，Esc 恢复）
- LangBot 借鉴：项目补 AGENTS.md（位置/约定/验证清单），让其他 coding agent 可接手
- 修复：callLlm 返回值改对象后 parseCalls 未适配的 TypeError（回归测试抓获）
- 回归测试 38 项全过（含用量统计真实 LLM 调用）；Browser 实测搜索过滤正确
- Backlog（记录未做）：Capabilities 能力库（成员带工具进群聊）、长对话压缩策略、消息锚点

## 2026-10-13 麦格面板 v0.5.0：真群聊（第 3 档落地）
- 用户选择了"面板真群聊"：Mini App 自建群聊引擎
- 技术路径：解析 config.yaml 的 OpenAI 兼容 provider（dashscope/Alibaba 块）直连
  /chat/completions，kimi-k3 + thinking disabled（minimax 主 provider 的 key 是 MCode
  会话凭证，直连 401，已换路）
- 引擎：麦格 Chief 首发、@提及点名、[[CALL:key]] 指令接力（一轮最多 4 跳防暴走）、
  消息持久化 dataDir/chat.json、typing 状态
- 实测发现：麦格口头点名但没写指令 → 强化 chief prompt「光提名不算叫人」后修复
- 验收：E2E 实测 "Mike 报到 → 麦格应答" + "@Quill → Quill 以人格风格接话"全通过；
  回归测试 35 项全过（含群聊端到端）
- 模型：kimi-k3（dashscope）；注意 reasoning 模型必须 thinking disabled 否则 content 为空

## 2026-10-13 v0.5.1：班底改英文名（用户反馈中文名难听）
- 墨客→Quill / 画匠→Frame / 棱角→Barb / 溯源→Sleuth / 速记→Memo
- 同步更新：5 个 agent 的 displayName 与 agent.md、PERSONA.md（含互提引用）、
  麦格人格层团队表、回归测试断言
- 面板团队页无需改代码（读 frontmatter 的 display 字段，自动生效）
- maige-bot → v0.5.1

## 2026-10-13 v0.5.0：动态组队（用户反馈"固定阵容有限制"）
- 团队从"固定 5 人"改为"5 人班底 + 按需招聘"：任务缺角色时麦格递招聘启事，用户确认后现场创建
- 标记机制：agent.md frontmatter 带 `team: maige` + `display: 中文名`，新成员自动入列
- 面板团队页从硬编码名单改为动态扫描该标记（内置 worker/explore/verifier 自动排除）
- 招聘原则：宁缺毋滥、一职一能；「让 XX 走人」确认后移除
- maige-bot → v0.5.0，面板 → v0.4.0；回归测试 30 项全过

## 2026-10-13 麦格面板 v0.3.0：团队页
- 面板加第 5 个分区「团队」：5 个成员卡片（中文名/调用名/注册状态/职责/agent.md 描述/PERSONA 人格全文）
- Node 新增 /api/team：扫 ~/.minimax/agents/ 只读校验成员文件完整性（已注册/缺文件）
- 回归测试 29 项全过；Browser 验收团队页渲染正确、console 零错误

## 2026-10-13 v0.4.0：麦格团队（参考 DS Bot 多 bot 群聊）
- 用户展示 DS Bot 截图（Chief + AI 团队群聊协作），选定：通用混搭 + 全真 agent 团队
- 创建 5 个自定义 agent（~/.minimax/agents/）：墨客 moke-writer / 画匠 huajiang-visual /
  棱角 lengjiao-reviewer / 溯源 suyuan-researcher / 速记 suji-recorder，各配 agent.md + PERSONA.md
- 麦格 persona 加「团队调度」章节：Chief 模式、流水线、并行、播报、收口、克制原则
- 实测：task 调度溯源查证 MiniMax 上市日期，返回规范证据清单 + 置信度（结果正确）
- maige-bot 插件 → v0.4.0，exampleQueries 加「开个会」
- 注意：mavis agent create 的名字参数是 `name`（`agent_name` 不生效会生成随机名）

## 2026-10-13 麦格面板 v0.2.0：功能扩充
- 用户反馈「功能太少了」，从 2 页扩到 4 页
- 新增概览页：KPI 卡片（记忆/作品/敏感/版本）+ 最近记忆/作品 + 快捷口令速查
- 记忆管理补全 CRUD：新增/编辑表单（名称/摘要/来源/敏感/正文）、详情弹窗；编辑保留原始记录日期
- 作品库加预览：图片大图、视频/音频内联播放
- 新增设置页：记忆/作品目录配置 + 插件版本信息
- Node 新增端点：/api/overview、/api/info、POST/PUT /api/memories
- 验证：回归测试扩到 26 项全过；Browser 验收 PASS（概览 KPI、UI 全链路新增→落盘→删除→消失、console 零错误）

## 2026-10-13 麦格面板 Mini App v0.1.0 + maige-bot v0.3.1
- 应用户要求参考 dsh-bot 的自有 UI，用 miniapp-creator 搭建「麦格面板」
- 面板：记忆管理（列表/删除/确认弹窗）+ 作品库（画廊/目录可配）
- 记忆落地方案定稿：`minimax-bot/memory/` 每条记忆一个 .md（frontmatter 带 source/date/sensitive）
- persona skill 同步：记忆写入目标从「MCode 长期记忆」改为记忆文件
- 种子记忆：user-name（用户叫 Mike Shi）、maige-project-home
- 验证：Node API 测试 17 项全过（含路径穿越防护、真实删除）；Browser 验收 PASS
  （结构/视觉/Tab 切换/删除弹窗/console 零错误/network 零失败）；暗色主题结构性支持，视觉未单独验证
- maige-bot 插件 → v0.3.1

## 2026-10-13 v0.3.0：参考 dsh-bot 补记忆与边界治理
- 调研 wqty123/dsh-bot（DeepSeek Harness 常驻代理实体插件），笔记存 `research/dsh-bot.md`
- 落地（Skill 行为层）：记忆来源标签 / 敏感两道门（硬门永不记密码密钥证件）/ 记忆时效 /
  记忆可审查可删除（「你都记着我什么」）/ 越界审批摆动作 / 豁免带期限 / 不打扰原则 / 状态诚实
- 不落地（宿主层能力，不重复造）：常驻实体+任务队列+执行器、向量检索、入站连接
- plugin.json → 0.3.0，exampleQueries 加记忆审查入口

## 2026-10-13 决策：拒绝 GenUI 增强
- 用户明确选择「保留当前文本版插件」，不创建 GenUI Visualizer
- 理由（与分析一致）：麦格产出为对话与媒体成品，文本+文件交付已是最清晰的表面
- 后续版本不再主动提示该增强项

## 2026-10-13 v0.2.0：参考竞品迭代
- 竞品调研：Grok / 豆包桌面版 / Kimi Work / ChatGPT 桌面端 / Claude Cowork
- 借鉴落地（均在插件 Skill 层实现，系统层能力不硬抄）：
  - 双模式人格：整活模式 ⇄ 正经模式（Grok Fun/Regular）
  - 快捷口令表：锐评/晨报/整活/悲歌/播客/总结（Kimi "/"）
  - 「教麦格」记忆偏好，写入 MCode 长期记忆（Grok Skills）
  - MAIGE.md 项目级人设覆盖（Claude CLAUDE.md）
  - 定时整活：晨报/提醒（Cowork /schedule）
  - 双人播客玩法 + 创作模板库（豆包 AI 播客 / Grok Imagine 模板）
- 记录远期项（宿主系统层，插件够不着）：语音通话、划词/截图/悬浮窗、手机遥控
- plugin.json → 0.2.0，exampleQueries 更新

## 2026-10-13 方向调整：落地 MiniMax Code 桌面版插件
- 用户明确载体为 MiniMax Code 桌面版，要求全能型
- 创建本地 Plugin V1：`~/.minimax/plugins/maige-bot/`（v0.1.0）
- 能力组成：maige-persona（人格问答）+ maige-studio（多模态创作）+ SessionStart Hook
- 人设资产（麦格）复用进插件 skill；星野等平台路径降级为 P3 外溢选项
- 验证：JSON/脚本语法/Hook 模拟运行全部通过；Desktop 识别待新会话确认

## 2026-10-13 项目初始化
- 确定定位：人格化问答 + 多模态创作搭子（对标 Grok，差异化走多模态）
- 确定主战场：星野智能体；副战场：Agent Expert 2.0；远期：MaxClaw IM 渠道
- 完成人设 v1 草稿（推荐方向 C「脑洞创作搭子」，名字候选「麦格」）
- 完成系统提示词、开场白 ×3、形象生成提示词 ×3 套
- 待用户决策：名字 / 人格基调 / 形象风格
