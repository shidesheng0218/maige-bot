
      // ---------- 语言（中英双语，跟随浏览器，可被设置页覆盖） ----------
      var I18N = {
        zh: {
          'title': '麦格', 'brandSub': 'maige-bot', 'subtitle': '麦格（maige-bot）的管理面板：它记着什么、做过什么、团队里都有谁，都在这里看、在这里管。',
          'nav.admin': '管理台', 'nav.back': '← 返回聊天',
          'admin.title': '管理台', 'admin.desc': '概览、团队、记忆、作品库、能力库、定时任务与设置。',
          'side.members': '成员',
          'role.chief': '主管 · 大小事找它', 'role.group': '全员群聊',
          'tab.overview': '概览', 'tab.team': '团队', 'tab.memories': '记忆管理', 'tab.outputs': '作品库', 'tab.caps': '能力库', 'tab.tasks': '任务', 'tab.schedules': '定时任务', 'tab.settings': '设置',
          'sec.trend': 'Token 走势（近 14 天）', 'sec.rank': '成员消耗排行', 'sec.recentMemories': '最近记忆', 'sec.recentOutputs': '最近作品', 'sec.commands': '快捷口令',
          'sec.appearance': '外观', 'sec.dirs': '目录', 'sec.info': '插件信息', 'sec.diagnostics': '诊断', 'sec.notifications': '通知',
          'sec.providers': '模型服务',
          'sec.budget': '回合预算',
          'budget.hint': '一轮对话（含多 bot 多轮）的上限，达到任一上限自动停止。0 = 不限。可填小数分钟（如 0.5 = 30 秒）。',
          'budget.tokens': '每回合 token 上限',
          'budget.minutes': '每回合时长上限（分钟）',
          'providers.hint': '接你自己的 OpenAI 兼容模型服务（DeepSeek / Kimi / 通义 / OpenAI / Ollama / vLLM…）；每个 bot 可分别指定模型。',
          'provider.id': '标识（小写字母/数字/连字符）', 'provider.name': '显示名', 'provider.baseURL': 'Base URL',
          'provider.apiKey': 'API Key', 'provider.models': '模型列表（逗号分隔）', 'provider.defaultModel': '默认模型',
          'provider.thinking': '该服务需要显式关闭思考（dashscope / Qwen 系）',
          'provider.empty': '还没有自配模型服务——填上面那张表就能接自己的模型。',
          'provider.default': '默认', 'provider.builtin': '内置', 'provider.modelsUnit': '个模型', 'provider.noKey': '未填 key',
          'provider.err.required': '标识和 Base URL 必填', 'provider.confirmDelete': '删除模型服务「{name}」？引用它的 bot 会回到默认模型。',
          'toast.provider.saved': '模型服务已保存', 'toast.provider.deleted': '模型服务已删除', 'toast.fail.providers': '模型服务操作失败',
          'sec.search': '联网搜索',
          'search.hint': '免费源（必应/搜狗/DuckDuckGo）开箱即用做兜底；填 API key 可启用更稳的付费源，失败多的源会自动降权。',
          'search.free': '免费兜底（无需配置）', 'search.configured': '已配置', 'search.keySet': '已保存（重新填即更换）',
          'search.needKey': '请先填 API Key',
          'btn.refresh': '刷新', 'btn.addMemory': '新增记忆', 'btn.addSchedule': '新建任务', 'btn.saveConfig': '保存目录设置', 'btn.resetConfig': '恢复默认',
          'btn.exportData': '导出全部数据（zip）',
          'sec.data': '数据',
          'data.hint': '所有记忆、整活单、作品、面板配置都是本地文件。可以随时导出带走，或从备份恢复。',
          'wizard.title': '欢迎使用麦格',
          'wizard.desc': '检测到还没有可用的模型服务。麦格需要一个 OpenAI 兼容端点才能聊天——DeepSeek、Kimi、通义、OpenAI、Ollama 都可以。',
          'wizard.skip': '先跳过，以后再说',
          'wizard.save': '保存并开始使用',
          'toast.data.exported': '已导出到作品库',
          'btn.copyDiag': '复制诊断信息', 'btn.cancel': '取消', 'btn.delete': '删除', 'btn.save': '保存', 'btn.create': '创建', 'btn.close': '关闭', 'btn.edit': '编辑', 'btn.openFile': '打开原文件',
          'btn.clearChat': '清空', 'btn.send': '发送', 'btn.stop': '停止',
          'toast.stopped': '已停止当前回合', 'toast.stopIdle': '当前没有在跑的回合', 'toast.fail.stop': '停止失败',
          'theme.auto': '跟随系统', 'theme.light': '浅色', 'theme.dark': '深色',
          'lang.auto': '跟随浏览器', 'lang.zh': '中文', 'lang.en': 'English',
          'label.memoryDir': '记忆目录（绝对路径）', 'label.outputsDir': '作品目录（绝对路径）',
          'label.ownerName': '老板称呼（对话与通知里怎么叫你）',
          'info.panelVersion': '面板版本', 'info.maigeVersion': '麦格插件版本', 'info.memoryDir': '记忆目录', 'info.outputsDir': '作品目录',
          'kpi.memories': '记忆条目', 'kpi.outputs': '作品数量', 'kpi.sensitive': '敏感记忆', 'kpi.version': '麦格版本', 'kpi.tokens': '聊天消耗',
          'empty.memories': '麦格还没有记忆', 'empty.memories.desc': '对它说「记住：…」，或点右上角「新增记忆」。',
          'empty.memories.dir': '记忆目录还不存在', 'empty.team': '还没有团队成员',
          'toast.remembered': '已记住', 'toast.cleared': '已清空',
          'a11y.viewMemory': '查看记忆详情', 'a11y.deleteMemory': '删除记忆',
          'schedule.err.name': '请填写任务名', 'schedule.err.text': '请填写发言内容',
          'schedule.goal': '产出目标（可选）', 'schedule.goal.ph': '例如：把成品写成 .md 进作品库',
          'empty.outputs': '作品库还是空的', 'empty.outputs.desc': '叫麦格「整活」——画图、做视频、写歌——成品会出现在这里。',
          'empty.outputs.dir': '作品目录还不存在', 'empty.outputs.dir.desc': '麦格生成的作品默认会存到这里；也可以在「设置」里换一个目录。',
          'empty.schedules': '还没有定时任务', 'empty.schedules.desc': '建一个试试：比如每天早上 9 点让麦格发毒舌晨报。',
          'empty.usage': '还没有消耗数据——去聊天里说句话就有了',
          'empty.recentMemories': '还没有记忆', 'empty.recentOutputs': '还没有作品',
          'loading.memories': '正在读取记忆…', 'loading.outputs': '正在读取作品库…', 'loading.team': '正在读取团队…', 'loading.schedules': '正在读取任务…', 'loading.overview': '正在汇总…',
          'error.read': '读取失败', 'error.read.retry': '面板服务暂时不可用，点「刷新」重试。',
          'source.user': '用户说的', 'source.maige': '麦格推断', 'source.tool': '读到的',
          'badge.sensitive': '敏感',
          'confirm.delete.title': '删除这条记忆？', 'confirm.delete.text': '删除后麦格将不再记得这件事。',
          'form.add': '新增记忆', 'form.edit': '编辑记忆',
          'form.name': '名称', 'form.name.ph': '例如：咖啡偏好',
          'form.desc': '一句话摘要', 'form.desc.ph': '这条记忆是什么（决定麦格以后想不想得起它）',
          'form.source': '来源', 'form.sensitive': '标记为敏感', 'form.body': '正文', 'form.body.ph': '具体内容与上下文',
          'form.err.name': '请填写名称', 'form.err.body': '请填写正文',
          'schedule.title': '新建定时任务', 'schedule.name': '任务名', 'schedule.name.ph': '例如：每日晨报',
          'schedule.member': '发言人', 'schedule.text': '发言内容', 'schedule.text.ph': '例如：搜一下今天的新闻，给我 5 条毒舌晨报',
          'schedule.freq': '频率', 'schedule.freq.daily': '每天定点', 'schedule.freq.interval': '每隔 N 分钟',
          'schedule.time': '时间', 'schedule.minutes': '间隔（分钟）',
          'schedule.hint': '到点后，指定成员会在群聊里自动就这个话题发言',
          'schedule.never': '还未执行过', 'schedule.lastRun': '上次执行 ',
          'schedule.freq.dailyAt': '每天 ', 'schedule.freq.intervalMin': '每 {n} 分钟',
          'schedule.delete.confirm': '删除定时任务「{name}」？',
          'chat.typing': '正在输入…',
          'chat.ph.chief': '和麦格单聊，大小事都可以找它…',
          'chat.ph.member': '和 {name} 单聊…',
          'chat.ph.group': '发到群里；@成员名 可直接点名（如 @Quill）',
          'chat.empty': '群里还很安静', 'chat.empty.desc': '说点什么开场，或者 @ 某位成员直接点名（如 @Quill 写个开场白）。',
          'chat.empty.chief': '我是麦格，团队的主管',
          'chat.empty.chief.desc': '问答、锐评、出主意、派活整活——直接说。',
          'chat.empty.member': '还没和 {name} 聊过', 'chat.empty.member.desc': '打个招呼，或者直接派活。',
          'chat.notReady': '聊天未就绪', 'chat.notReady.desc': '未检测到可用的模型配置（需要本机 config.yaml 里的 OpenAI 兼容 provider）。',
          'chat.clear.confirm': '清空当前会话的全部记录？此操作不可恢复。',
          'card.search': '搜索「{q}」· {n} 条',
          'card.work': '作品 · {name}',
          'card.task': '整活单 · {title}',
          'card.meta': '类型：{kind} · 状态：{status}',
          'card.kind.image': '图', 'card.kind.video': '视频', 'card.kind.audio': '音频', 'card.kind.text': '文本',
          'card.status.draft': '待确认', 'card.status.ready': '已就绪', 'card.status.making': '制作中', 'card.status.done': '已交付', 'card.status.cancelled': '已取消',
          'card.footer.ready': '点开始即制作，可在任务区退回/取消',
          'card.footer.draft': '等确认提示词',
          'card.footer.work': '已进作品库 · {size}',
          'media.image': '图片', 'media.audio': '语音', 'media.video': '视频',
          'preview.noPreview': '该类型不支持预览，请打开原文件查看。',
          'toast.saved': '已保存', 'toast.deleted': '已删除', 'toast.created': '已创建', 'toast.copied': '诊断信息已复制',
          'toast.fail.save': '保存失败，请重试', 'toast.fail.delete': '删除失败，请重试', 'toast.fail.create': '创建失败，请重试',
          'toast.fail.config': '保存失败：请确认是绝对路径', 'toast.fail.send': '发送失败', 'toast.fail.clear': '清空失败',
          'toast.noClipboard': '当前环境不支持剪贴板', 'toast.fail.diag': '读取诊断失败', 'toast.fail.settings': '读取设置失败',
          'toast.defaults': '已填入默认路径，点「保存目录设置」生效',
          'team.hint': '点任意成员即可单聊；「麦格团队」是全员群聊，@名字 可点名。团队不是固定名单：任务需要新角色时，麦格会递上一份「招聘启事」，你点头它现场入职。',
          'status.ready': '已注册', 'status.missing': '文件缺失',
          'kind.image': '图片', 'kind.video': '视频', 'kind.audio': '音频', 'kind.file': '文件',
          'search.chat': '搜索消息…', 'search.noHit': '没有匹配「{term}」的消息',
          'outputs.dirLabel': '作品目录：', 'team.dirLabel': 'Agent 目录：', 'memory.dirLabel': '记忆目录：',
          'member.chief': '（主管）', 'usage.perMember': ' 次发言 · ', 'usage.unit': ' tok',
          'diag.summary.tpl': '模型 {llm} · 消息 {messages} 条 · 定时任务 {schedules} 个',
          'diag.llm.ready': '已连接', 'diag.llm.off': '未连接', 'diag.noErrors': '暂无错误记录',
          'bot.model': '模型', 'bot.model.hint': '换了从下一条消息生效；建议一个 bot 长期用一个模型',
          'bot.caps': '能力包', 'bot.persona': '人格设定', 'bot.usage': '用量',
          'bot.caps.empty': '还没有能力包——往 capabilities/ 目录丢 .md 文件即可',
          'bot.usage.none': '还没说过话', 'bot.defaultModel': '默认（{model}）',
          'caps.attached': '挂载：', 'caps.none': '未挂载', 'empty.caps': '能力库是空的',
          'loading.caps': '正在读取能力库…', 'a11y.botDetail': '查看 bot 详情', 'toast.fail.bot': '读取 bot 详情失败',
          'usage.fmt': '{calls} 次发言 · {tokens} tok',
          'divider.today': '今天', 'divider.date.md': '月{d}日', 'status.online': '在线', 'status.caps': '能力包 ×{n}',
          'caps.hint': '能力包是纯文本提示词包，挂到某个 bot 后从TA下一条消息起生效。新建：往目录里丢一个 .md 文件（frontmatter 写 name / description）。挂载入口：聊天页点顶部头像，或团队页点成员卡片。',
          'task.new': '新建整活单', 'task.title': '标题', 'task.kind': '类型',
          'task.brief': '需求（提示词包可以后补，也可以让 bot 写）', 'task.deliverables': '交付物（作品库文件名，逗号分隔）',
          'task.err.title': '请填写标题',
          'tasks.hint': '整活单是面板与 MCode 会话之间的交接：bot 开好单（提示词包写全），你确认后带回 MCode 会话让麦格制作，成品落作品库后单子标记交付。',
          'tasks.empty': '还没有整活单', 'tasks.empty.desc': '在聊天里说「整活：…」，bot 会把需求和提示词开成一张单；也可以手动新建。',
          'loading.tasks': '正在读取任务…',
          'tstatus.draft': '待确认', 'tstatus.ready': '提示词就绪', 'tstatus.making': '制作中', 'tstatus.done': '已交付', 'tstatus.cancelled': '已取消',
          'taction.confirm': '确认提示词', 'taction.start': '开始制作', 'taction.done': '标记已交付', 'taction.back': '退回', 'taction.revive': '恢复到待确认',
          'task.by': '开单：', 'settings.notify': '定时任务触发、新整活单创建时发 macOS 系统通知',
          'team.hire': '新建成员', 'hire.title': '招聘新成员', 'hire.submit': '招进来',
          'hire.key': '工位 key（小写字母/连字符）', 'hire.name': '显示名', 'hire.role': '职责（一句话）',
          'hire.role.ph': '麦格团队的技术负责人：技术选型、工程方案、代码评审',
          'hire.persona': '人格与能力说明（写给它自己的提示词）',
          'hire.persona.ph': '例如：你是 Bolt，麦格团队的技术负责人。说话直接给方案，先给结论再给理由；工程上保守，体验上挑剔。',
          'hire.err': '请填写 key、显示名与职责', 'hire.err.key': 'key 只能小写字母开头 + 小写字母/数字/连字符',
          'hire.exists': '这个 key 已经有人了', 'hire.done': '已入职',
          'team.fire': '移除', 'team.fire.confirm': '把 {name} 移出团队？（目录入回收站，可恢复）',
          'team.presets': '示例编队', 'team.current': '当前成员',
          'preset.hire': '一键组队', 'preset.hired': '已在队里',
          'preset.life': '个人助理组', 'preset.life.desc': '日程规划 + 习惯养成：把日子过成有节奏的系统。',
          'preset.study': '学习组', 'preset.study.desc': '私教 + 出题官：学任何东西，讲透再考倒你。',
          'preset.eng': '工程组', 'preset.eng.desc': '质量守门员 + 运维参谋：代码不止能跑，还得扛造。',
          'btn.export': '导出', 'toast.exported': '已导出到作品库：{name}', 'toast.export.empty': '当前会话还没有消息可导出',
          'chat.attach': '附图', 'chat.attach.remove': '移除图片', 'chat.mic': '语音输入', 'chat.micFail': '语音识别不可用',
        },
        en: {
          'title': 'Maige', 'brandSub': 'maige-bot', 'subtitle': 'The panel of Maige (maige-bot): what it remembers, what it made, who is on the team.',
          'nav.admin': 'Console', 'nav.back': '← Back to Chat',
          'admin.title': 'Console', 'admin.desc': 'Overview, team, memories, works, capabilities, schedules and settings.',
          'side.members': 'Bots',
          'role.chief': 'Chief of Staff', 'role.group': 'Group chat',
          'tab.overview': 'Overview', 'tab.team': 'Team', 'tab.memories': 'Memories', 'tab.outputs': 'Works', 'tab.caps': 'Capabilities', 'tab.tasks': 'Tasks', 'tab.schedules': 'Schedules', 'tab.settings': 'Settings',
          'sec.trend': 'Token Trend (14 days)', 'sec.rank': 'Usage by Member', 'sec.recentMemories': 'Recent Memories', 'sec.recentOutputs': 'Recent Works', 'sec.commands': 'Quick Commands',
          'sec.appearance': 'Appearance', 'sec.dirs': 'Directories', 'sec.info': 'Plugin Info', 'sec.diagnostics': 'Diagnostics', 'sec.notifications': 'Notifications',
          'sec.providers': 'Model Services',
          'sec.budget': 'Turn Budget',
          'budget.hint': 'Limits per conversation turn (across bots and rounds); the turn stops at whichever is reached first. 0 = unlimited. Decimals allowed (0.5 = 30s).',
          'budget.tokens': 'Max tokens per turn',
          'budget.minutes': 'Max minutes per turn',
          'providers.hint': 'Bring your own OpenAI-compatible model service (DeepSeek / Kimi / Qwen / OpenAI / Ollama / vLLM…); each bot can use a different model.',
          'provider.id': 'ID (lowercase letters, digits, dashes)', 'provider.name': 'Display name', 'provider.baseURL': 'Base URL',
          'provider.apiKey': 'API Key', 'provider.models': 'Models (comma separated)', 'provider.defaultModel': 'Default model',
          'provider.thinking': 'This service needs thinking disabled explicitly (dashscope / Qwen family)',
          'provider.empty': 'No model service configured yet — fill in the form above to plug in your own model.',
          'provider.default': 'Default', 'provider.builtin': 'Built-in', 'provider.modelsUnit': 'models', 'provider.noKey': 'no key',
          'provider.err.required': 'ID and Base URL are required', 'provider.confirmDelete': 'Delete model service “{name}”? Bots using it fall back to the default model.',
          'toast.provider.saved': 'Model service saved', 'toast.provider.deleted': 'Model service deleted', 'toast.fail.providers': 'Model service operation failed',
          'sec.search': 'Web Search',
          'search.hint': 'Free sources (Bing/Sogou/DuckDuckGo) work out of the box as fallback; add an API key to enable more reliable paid sources. Frequently-failing sources are auto-deprioritized.',
          'search.free': 'Free fallback (no setup)', 'search.configured': 'configured', 'search.keySet': 'Saved (re-enter to change)',
          'search.needKey': 'Enter an API key first',
          'btn.refresh': 'Refresh', 'btn.addMemory': 'Add Memory', 'btn.addSchedule': 'New Task', 'btn.saveConfig': 'Save Directories', 'btn.resetConfig': 'Reset Defaults',
          'btn.copyDiag': 'Copy Diagnostics', 'btn.cancel': 'Cancel', 'btn.delete': 'Delete', 'btn.save': 'Save', 'btn.create': 'Create', 'btn.close': 'Close', 'btn.edit': 'Edit', 'btn.openFile': 'Open File',
          'btn.clearChat': 'Clear', 'btn.send': 'Send', 'btn.stop': 'Stop',
          'toast.stopped': 'Turn stopped', 'toast.stopIdle': 'No turn is running', 'toast.fail.stop': 'Failed to stop',
          'theme.auto': 'System', 'theme.light': 'Light', 'theme.dark': 'Dark',
          'lang.auto': 'Browser', 'lang.zh': '中文', 'lang.en': 'English',
          'label.memoryDir': 'Memory directory (absolute path)', 'label.outputsDir': 'Outputs directory (absolute path)',
          'label.ownerName': 'Your name (how the bots address you in chats & notifications)',
          'info.panelVersion': 'Panel Version', 'info.maigeVersion': 'Maige Plugin Version', 'info.memoryDir': 'Memory Directory', 'info.outputsDir': 'Outputs Directory',
          'kpi.memories': 'Memories', 'kpi.outputs': 'Works', 'kpi.sensitive': 'Sensitive', 'kpi.version': 'Maige Version', 'kpi.tokens': 'Chat Tokens',
          'empty.memories': 'No memories yet', 'empty.memories.desc': 'Say "记住：…" to Maige, or click "Add Memory".',
          'empty.memories.dir': 'Memory directory missing', 'empty.team': 'No team members yet',
          'toast.remembered': 'Remembered', 'toast.cleared': 'Cleared',
          'a11y.viewMemory': 'View memory details', 'a11y.deleteMemory': 'Delete memory',
          'schedule.err.name': 'Task name required', 'schedule.err.text': 'Content required',
          'empty.outputs': 'No works yet', 'empty.outputs.desc': 'Ask Maige to create — images, videos, songs — they land here.',
          'empty.outputs.dir': 'Outputs directory missing', 'empty.outputs.dir.desc': 'Generated works go here by default; pick another in Settings.',
          'empty.schedules': 'No scheduled tasks', 'empty.schedules.desc': 'Try one: Maige posts a snarky morning briefing at 9am daily.',
          'empty.usage': 'No usage yet — say something in a chat first',
          'empty.recentMemories': 'No memories yet', 'empty.recentOutputs': 'No works yet',
          'loading.memories': 'Loading memories…', 'loading.outputs': 'Loading works…', 'loading.team': 'Loading team…', 'loading.schedules': 'Loading tasks…', 'loading.overview': 'Summarizing…',
          'error.read': 'Read failed', 'error.read.retry': 'Panel service unavailable. Click Refresh to retry.',
          'source.user': 'From user', 'source.maige': 'Maige inferred', 'source.tool': 'From source',
          'badge.sensitive': 'Sensitive',
          'confirm.delete.title': 'Delete this memory?', 'confirm.delete.text': 'Maige will no longer remember it.',
          'form.add': 'Add Memory', 'form.edit': 'Edit Memory',
          'form.name': 'Name', 'form.name.ph': 'e.g. Coffee preference',
          'form.desc': 'One-line summary', 'form.desc.ph': 'What this memory is (decides whether Maige recalls it)',
          'form.source': 'Source', 'form.sensitive': 'Mark as sensitive', 'form.body': 'Content', 'form.body.ph': 'Details and context',
          'form.err.name': 'Name required', 'form.err.body': 'Content required',
          'schedule.title': 'New Scheduled Task', 'schedule.name': 'Task name', 'schedule.name.ph': 'e.g. Daily briefing',
          'schedule.member': 'Speaker', 'schedule.text': 'What to say', 'schedule.text.ph': 'e.g. Search today\'s news and give me 5 snarky headlines',
          'schedule.freq': 'Frequency', 'schedule.freq.daily': 'Daily at', 'schedule.freq.interval': 'Every N minutes',
          'schedule.time': 'Time', 'schedule.minutes': 'Interval (minutes)',
          'schedule.hint': 'When due, the chosen member posts on this topic in the group chat',
          'schedule.never': 'Never ran', 'schedule.lastRun': 'Last run ',
          'schedule.freq.dailyAt': 'Daily ', 'schedule.freq.intervalMin': 'Every {n} min',
          'schedule.delete.confirm': 'Delete task "{name}"?',
          'chat.typing': ' is typing…',
          'chat.ph.chief': 'Chat with Maige — anything goes…',
          'chat.ph.member': 'Chat with {name}…',
          'chat.ph.group': 'Message the group; @name to call someone out (e.g. @Quill)',
          'chat.empty': 'The room is quiet', 'chat.empty.desc': 'Say something, or @ a member to call them out (e.g. @Quill for an opening line).',
          'chat.empty.chief': "I'm Maige, chief of the team",
          'chat.empty.chief.desc': 'Ask, rant, brainstorm, or commission a creation — just say it.',
          'chat.empty.member': 'No messages with {name} yet', 'chat.empty.member.desc': 'Say hi, or assign a task directly.',
          'chat.notReady': 'Chat not ready', 'chat.notReady.desc': 'No usable model config found (needs an OpenAI-compatible provider in config.yaml).',
          'chat.clear.confirm': 'Clear all messages in this conversation? This cannot be undone.',
          'card.search': 'Search “{q}” · {n} results',
          'card.work': 'Work · {name}',
          'card.task': 'Production task · {title}',
          'card.meta': 'Type: {kind} · Status: {status}',
          'card.kind.image': 'image', 'card.kind.video': 'video', 'card.kind.audio': 'audio', 'card.kind.text': 'text',
          'card.status.draft': 'pending review', 'card.status.ready': 'ready', 'card.status.making': 'in progress', 'card.status.done': 'delivered', 'card.status.cancelled': 'cancelled',
          'card.footer.ready': 'Start to produce; you can send it back or cancel from Tasks',
          'card.footer.draft': 'Waiting for prompt review',
          'card.footer.work': 'Saved to outputs · {size}',
          'media.image': 'Image', 'media.audio': 'Audio', 'media.video': 'Video',
          'preview.noPreview': 'Preview unavailable for this type. Open the file instead.',
          'toast.saved': 'Saved', 'toast.deleted': 'Deleted', 'toast.created': 'Created', 'toast.copied': 'Diagnostics copied',
          'toast.fail.save': 'Save failed, retry', 'toast.fail.delete': 'Delete failed, retry', 'toast.fail.create': 'Create failed, retry',
          'toast.fail.config': 'Save failed: absolute path required', 'toast.fail.send': 'Send failed', 'toast.fail.clear': 'Clear failed',
          'toast.noClipboard': 'Clipboard unavailable here', 'toast.fail.diag': 'Failed to read diagnostics', 'toast.fail.settings': 'Failed to load settings',
          'toast.defaults': 'Defaults filled in. Click "Save Directories" to apply.',
          'team.hint': 'Click any bot for a direct chat; "Maige Team" is the group chat — @name calls someone out. The roster is not fixed: when a task needs a new role, Maige proposes a hire and it appears here once you approve.',
          'status.ready': 'Ready', 'status.missing': 'Missing files',
          'kind.image': 'Image', 'kind.video': 'Video', 'kind.audio': 'Audio', 'kind.file': 'File',
          'search.chat': 'Search messages…', 'search.noHit': 'No messages matching "{term}"',
          'outputs.dirLabel': 'Outputs dir: ', 'team.dirLabel': 'Agents dir: ', 'memory.dirLabel': 'Memory dir: ',
          'member.chief': ' (Chief)', 'usage.perMember': ' posts · ', 'usage.unit': ' tok',
          'diag.summary.tpl': 'Model {llm} · {messages} messages · {schedules} tasks',
          'diag.llm.ready': 'connected', 'diag.llm.off': 'offline', 'diag.noErrors': 'No errors recorded',
          'bot.model': 'Model', 'bot.model.hint': 'Applies from the next message; keeping one model per bot is recommended',
          'bot.caps': 'Capability Packs', 'bot.persona': 'Persona', 'bot.usage': 'Usage',
          'bot.caps.empty': 'No packs yet — drop .md files into the capabilities/ directory',
          'bot.usage.none': 'No messages yet', 'bot.defaultModel': 'Default ({model})',
          'caps.attached': 'Attached: ', 'caps.none': 'not attached', 'empty.caps': 'No capability packs yet',
          'loading.caps': 'Loading capabilities…', 'a11y.botDetail': 'View bot details', 'toast.fail.bot': 'Failed to load bot details',
          'usage.fmt': '{calls} posts · {tokens} tok',
          'divider.today': 'Today', 'divider.date.md': '/{d}', 'status.online': 'Online', 'status.caps': '{n} packs',
          'caps.hint': 'A capability pack is a plain-text prompt pack — once attached to a bot it applies from its next message. To create one, drop a .md file into the directory (frontmatter: name / description). Attach from the chat header avatar or a team card.',
          'task.new': 'New Creation Task', 'task.title': 'Title', 'task.kind': 'Kind',
          'task.brief': 'Brief (the prompt package can come later — or let a bot write it)', 'task.deliverables': 'Deliverables (filenames in Works, comma-separated)',
          'task.err.title': 'Title required',
          'tasks.hint': 'A creation task is the handoff between this panel and your MCode session: a bot files it with a full prompt package, you confirm, bring it to MCode for production, then mark it delivered once the work lands in Works.',
          'tasks.empty': 'No creation tasks yet', 'tasks.empty.desc': 'Say "整活：…" in chat and a bot will file one with the prompt package; or create one manually.',
          'loading.tasks': 'Loading tasks…',
          'tstatus.draft': 'Draft', 'tstatus.ready': 'Prompt Ready', 'tstatus.making': 'In Production', 'tstatus.done': 'Delivered', 'tstatus.cancelled': 'Cancelled',
          'taction.confirm': 'Confirm Prompt', 'taction.start': 'Start Production', 'taction.done': 'Mark Delivered', 'taction.back': 'Send Back', 'taction.revive': 'Restore to Draft',
          'task.by': 'Filed by ', 'settings.notify': 'macOS notifications for scheduled tasks and new creation tasks',
          'team.hire': 'New Bot', 'hire.title': 'Hire a New Bot', 'hire.submit': 'Hire',
          'hire.key': 'Desk key (lowercase/hyphens)', 'hire.name': 'Display name', 'hire.role': 'Role (one line)',
          'hire.role.ph': 'Tech lead of the Maige team: stack choices, engineering plans, code review',
          'hire.persona': 'Persona & capability brief (the prompt written to it)',
          'hire.persona.ph': 'e.g. You are Bolt, tech lead of the Maige team. Answer with the plan first, reasoning second; conservative in engineering, picky about experience.',
          'hire.err': 'Key, name and role are required', 'hire.err.key': 'Key must start with a letter, lowercase letters/digits/hyphens only',
          'hire.exists': 'That key is taken', 'hire.done': 'Hired',
          'team.fire': 'Remove', 'team.fire.confirm': 'Remove {name} from the team? (The directory goes to the Trash and can be restored.)',
          'team.presets': 'Sample Squads', 'team.current': 'Current Members',
          'preset.hire': 'Hire the Squad', 'preset.hired': 'On the team',
          'preset.life': 'Personal Assistant Squad', 'preset.life.desc': 'Planning + habit coaching: turn your days into a system with rhythm.',
          'preset.study': 'Study Squad', 'preset.study.desc': 'Tutor + quizmaster: learn anything — explained simply, then tested hard.',
          'preset.eng': 'Engineering Squad', 'preset.eng.desc': 'QA gatekeeper + ops advisor: code that not only runs, but holds up.',
          'btn.export': 'Export', 'toast.exported': 'Exported to Works: {name}', 'toast.export.empty': 'Nothing to export in this conversation yet',
          'chat.attach': 'Attach image', 'chat.attach.remove': 'Remove image', 'chat.mic': 'Voice input', 'chat.micFail': 'Speech recognition unavailable',
        }
      };
      var lang = 'zh';
      try {
        var savedLang = localStorage.getItem('maige-lang') || 'auto';
        lang = savedLang === 'auto' ? (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en' : savedLang;
      } catch (e) { /* 默认 zh */ }
      function t(key, vars) {
        var s = (I18N[lang] && I18N[lang][key]) ?? I18N.zh[key] ?? key;
        if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
        return s;
      }
      function setLang(mode) {
        try { localStorage.setItem('maige-lang', mode); } catch (e) { /* 仅本会话生效 */ }
        lang = mode === 'auto' ? ((navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en') : mode;
        applyLang();
        ['auto', 'zh', 'en'].forEach(function (m) {
          var btn = document.getElementById('lang-' + m);
          if (btn) btn.setAttribute('aria-pressed', String(m === mode));
        });
      }
      function applyLang() {
        document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
        document.title = t('title');
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
          el.textContent = t(el.getAttribute('data-i18n'));
        });
        document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
          el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
        });
        document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
          el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
        });
      }

      // 主题：跟随系统，可被设置页覆盖（视图偏好存 localStorage）
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var themeOverride = null;
      try { themeOverride = localStorage.getItem('maige-theme') || 'auto'; } catch (e) { themeOverride = 'auto'; }
      function applyTheme() {
        var dark = themeOverride === 'dark' || (themeOverride !== 'light' && mq.matches);
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      }
      function setTheme(mode) {
        themeOverride = mode;
        try { localStorage.setItem('maige-theme', mode); } catch (e) { /* 存储不可用时仅本会话生效 */ }
        applyTheme();
        ['auto', 'light', 'dark'].forEach(function (m) {
          var btn = document.getElementById('theme-' + m);
          if (btn) btn.setAttribute('aria-pressed', String(m === mode));
        });
      }
      applyTheme();
      applyLang();
      ['auto', 'zh', 'en'].forEach(function (m) {
        var btn = document.getElementById('lang-' + m);
        if (btn) btn.setAttribute('aria-pressed', String(m === (localStorage.getItem('maige-lang') || 'auto')));
      });
      if (mq.addEventListener) mq.addEventListener('change', applyTheme);

      var $ = function (id) { return document.getElementById(id); };
      var els = {
        convList: $('conv-list'), brandAvatar: $('brand-avatar'),
        chatView: $('chat-view'), adminView: $('admin-view'),
        openAdmin: $('open-admin'), closeAdmin: $('close-admin'),
        chatPeer: $('chat-peer'), chatMessages: $('chat-messages'), chatTyping: $('chat-typing'),
        chatForm: $('chat-form'), chatInput: $('chat-input'), chatSend: $('chat-send'), chatClear: $('chat-clear'),
        chatSearch: $('chat-search'), chatExport: $('chat-export'), chatStop: $('chat-stop'),
        chatAttach: $('chat-attach'), chatFile: $('chat-file'), chatMic: $('chat-mic'), attachPreview: $('attach-preview'),
        tabs: {
          overview: $('tab-overview'), team: $('tab-team'), memories: $('tab-memories'), outputs: $('tab-outputs'), caps: $('tab-caps'), tasks: $('tab-tasks'), schedules: $('tab-schedules'), settings: $('tab-settings')
        },
        panels: {
          overview: $('panel-overview'), team: $('panel-team'), memories: $('panel-memories'), outputs: $('panel-outputs'), caps: $('panel-caps'), tasks: $('panel-tasks'), schedules: $('panel-schedules'), settings: $('panel-settings')
        },
        refreshSchedules: $('refresh-schedules'), addSchedule: $('add-schedule'),
        schedulesStatus: $('schedules-status'), scheduleList: $('schedule-list'),
        scheduleMask: $('schedule-mask'), scheduleForm: $('schedule-form'),
        schName: $('sch-name'), schMember: $('sch-member'), schText: $('sch-text'),
        schFreq: $('sch-freq'), schTime: $('sch-time'), schMinutes: $('sch-minutes'), schGoal: $('sch-goal'),
        schTimeWrap: $('sch-time-wrap'), schMinutesWrap: $('sch-minutes-wrap'),
        schError: $('sch-error'), schCancel: $('sch-cancel'), schSubmit: $('sch-submit'),
        themeAuto: $('theme-auto'), themeLight: $('theme-light'), themeDark: $('theme-dark'),
        copyDiagnostics: $('copy-diagnostics'), diagSummary: $('diag-summary'), errorList: $('error-list'),
        teamDir: $('team-dir'), teamGrid: $('team-grid'), teamStatus: $('team-status'), refreshTeam: $('refresh-team'),
        overviewStatus: $('overview-status'), overviewContent: $('overview-content'),
        kpiMemory: $('kpi-memory'), kpiOutputs: $('kpi-outputs'), kpiSensitive: $('kpi-sensitive'), kpiVersion: $('kpi-version'),
        kpiTokens: $('kpi-tokens'), usageChart: $('usage-chart'), usageLegend: $('usage-legend'), usageRank: $('usage-rank'),
        recentMemories: $('recent-memories'), recentOutputs: $('recent-outputs'), commandGrid: $('command-grid'),
        memoryDir: $('memory-dir'), memoryList: $('memory-list'), memoriesStatus: $('memories-status'),
        refreshMemories: $('refresh-memories'), addMemory: $('add-memory'),
        outputsDirNote: $('outputs-dir-note'), refreshOutputs: $('refresh-outputs'),
        outputsStatus: $('outputs-status'), gallery: $('gallery'),
        cfgMemoryDir: $('cfg-memory-dir'), cfgOutputsDir: $('cfg-outputs-dir'),
        cfgOwnerName: $('cfg-owner-name'),
        cfgBudgetTokens: $('cfg-budget-tokens'), cfgBudgetMinutes: $('cfg-budget-minutes'),
        cmdSuggest: $('cmd-suggest'),
        wizardMask: $('wizard-mask'), wzBase: $('wz-base'), wzKey: $('wz-key'),
        wzModels: $('wz-models'), wzDefault: $('wz-default'), wzError: $('wz-error'),
        wzSkip: $('wz-skip'), wzSave: $('wz-save'),
        exportData: $('export-data'),
        saveConfig: $('save-config'), resetConfig: $('reset-config'),
        providerList: $('provider-list'), providerForm: $('provider-form'),
        searchProviderList: $('search-provider-list'),
        pvId: $('pv-id'), pvName: $('pv-name'), pvBase: $('pv-base'), pvKey: $('pv-key'),
        pvModels: $('pv-models'), pvDefault: $('pv-default'), pvThinking: $('pv-thinking'),
        pvClear: $('pv-clear'),
        infoPanelVersion: $('info-panel-version'), infoMaigeVersion: $('info-maige-version'),
        infoMemoryDir: $('info-memory-dir'), infoOutputsDir: $('info-outputs-dir'),
        confirmMask: $('confirm-mask'), confirmText: $('confirm-text'), confirmCancel: $('confirm-cancel'), confirmOk: $('confirm-ok'),
        formMask: $('form-mask'), formTitle: $('form-title'), form: $('memory-form'),
        formName: $('form-name'), formDesc: $('form-desc'), formSource: $('form-source'),
        formSensitive: $('form-sensitive'), formBody: $('form-body'), formError: $('form-error'),
        formCancel: $('form-cancel'), formSubmit: $('form-submit'),
        detailMask: $('detail-mask'), detailTitle: $('detail-title'), detailMeta: $('detail-meta'),
        detailBody: $('detail-body'), detailClose: $('detail-close'), detailEdit: $('detail-edit'),
        previewMask: $('preview-mask'), previewTitle: $('preview-title'), previewBody: $('preview-body'),
        previewClose: $('preview-close'), previewOpen: $('preview-open'),
        capsDir: $('caps-dir'), refreshCaps: $('refresh-caps'), capsStatus: $('caps-status'), capsList: $('caps-list'),
        tasksDir: $('tasks-dir'), refreshTasks: $('refresh-tasks'), tasksStatus: $('tasks-status'), tasksBoard: $('tasks-board'),
        addTask: $('add-task'), taskMask: $('task-mask'), taskKindBadge: $('task-kind-badge'), taskStatusBadge: $('task-status-badge'),
        taskTitle: $('task-title'), taskMeta: $('task-meta'), taskBody: $('task-body'), taskDeliverables: $('task-deliverables'),
        taskDlField: $('task-dl-field'), taskDlInput: $('task-dl-input'), taskActions: $('task-actions'), taskClose: $('task-close'),
        tasknewMask: $('tasknew-mask'), tasknewForm: $('tasknew-form'),
        tnTitle: $('tn-title'), tnKind: $('tn-kind'), tnBody: $('tn-body'), tnError: $('tn-error'), tnCancel: $('tn-cancel'), tnSubmit: $('tn-submit'),
        cfgNotifications: $('cfg-notifications'),
        hireOpen: $('hire-open'), hireMask: $('hire-mask'), hireForm: $('hire-form'),
        hrKey: $('hr-key'), hrName: $('hr-name'), hrRole: $('hr-role'), hrPersona: $('hr-persona'),
        hrError: $('hr-error'), hrCancel: $('hr-cancel'), hrSubmit: $('hr-submit'),
        botMask: $('bot-mask'), botAvatar: $('bot-avatar'), botTitle: $('bot-title'), botRole: $('bot-role'),
        botModel: $('bot-model'), botCaps: $('bot-caps'), botPersona: $('bot-persona'), botUsage: $('bot-usage'),
        botError: $('bot-error'), botCancel: $('bot-cancel'), botSave: $('bot-save'),
        toast: $('toast')
      };

      var SOURCE_LABELS = { user: 'source.user', maige: 'source.maige', tool: 'source.tool' };
      var KIND_LABELS = { image: 'kind.image', video: 'kind.video', audio: 'kind.audio', file: 'kind.file' };
      function sourceLabel(k) { return t(SOURCE_LABELS[k] || k); }
      function kindLabel(k) { return t(KIND_LABELS[k] || k); }
      var COMMANDS = {
        zh: [
          { key: '/晨报', desc: '5 条毒舌晨报' },
          { key: '/锐评 话题', desc: '联网搜索后三段式锐评' },
          { key: '/攻坚 任务', desc: '拆任务分工 → 讨论 → 收口方案' },
          { key: '/圆桌 主题', desc: '全员一轮观点，麦格收尾' },
          { key: '/整活 内容', desc: '进入创作流程' },
          { key: '/悲歌', desc: '把吐槽编成歌词' },
          { key: '/播客 材料', desc: '生成双人对话音频' },
          { key: '/总结', desc: '总结会话或文件' },
          { key: '/正经 / 别闹', desc: '切换正经模式' },
          { key: '/记住：…', desc: '写入长期记忆' }
        ],
        en: [
          { key: '/晨报', desc: '5 snarky morning headlines' },
          { key: '/锐评 topic', desc: 'Web search, then a three-part hot take' },
          { key: '/攻坚 task', desc: 'Break down → discuss → wrap-up plan' },
          { key: '/圆桌 topic', desc: 'Everyone speaks once, Maige wraps up' },
          { key: '/整活 content', desc: 'Enter creation mode' },
          { key: '/悲歌', desc: 'Turn a rant into song lyrics' },
          { key: '/播客 material', desc: 'Generate a two-host podcast' },
          { key: '/总结', desc: 'Summarize the session or a file' },
          { key: '/正经 / 别闹', desc: 'Switch to serious mode' },
          { key: '/记住：…', desc: 'Write to long-term memory' }
        ]
      };

      var cmdSuggestIdx = -1;
      function hideCmdSuggest() { els.cmdSuggest.hidden = true; els.cmdSuggest.innerHTML = ''; cmdSuggestIdx = -1; }
      function showCmdSuggest(q) {
        var list = (COMMANDS[lang] || COMMANDS.zh).filter(function (c) {
          return c.key.toLowerCase().startsWith(q.toLowerCase());
        });
        if (!list.length) { hideCmdSuggest(); return; }
        els.cmdSuggest.innerHTML = '';
        list.forEach(function (c, i) {
          var item = document.createElement('div');
          item.className = 'cmd-item' + (i === cmdSuggestIdx ? ' active' : '');
          item.dataset.key = c.key;
          var k = document.createElement('span');
          k.className = 'cmd-key'; k.textContent = c.key;
          var d = document.createElement('span');
          d.className = 'cmd-desc';
          d.textContent = c.desc;
          item.appendChild(k); item.appendChild(d);
          item.addEventListener('mousedown', function (e) { e.preventDefault(); pickCmd(c.key); });
          item.addEventListener('mouseenter', function () { cmdSuggestIdx = i; });
          els.cmdSuggest.appendChild(item);
        });
        els.cmdSuggest.hidden = false;
      }
      function pickCmd(key) {
        els.chatInput.value = key + ' ';
        hideCmdSuggest();
        els.chatInput.focus();
      }
      function updateCmdSuggest() {
        var v = els.chatInput.value;
        if (v.startsWith('/')) showCmdSuggest(v);
        else hideCmdSuggest();
      }
      els.chatInput.addEventListener('input', updateCmdSuggest);
      els.chatInput.addEventListener('keydown', function (e) {
        if (els.cmdSuggest.hidden) return;
        var items = els.cmdSuggest.querySelectorAll('.cmd-item');
        if (!items.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); cmdSuggestIdx = (cmdSuggestIdx + 1) % items.length; updateActive(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); cmdSuggestIdx = (cmdSuggestIdx - 1 + items.length) % items.length; updateActive(); }
        else if (e.key === 'Enter' && cmdSuggestIdx >= 0) { e.preventDefault(); pickCmd(items[cmdSuggestIdx].dataset.key); }
        else if (e.key === 'Escape') { hideCmdSuggest(); }
        function updateActive() { items.forEach(function (el, i) { el.classList.toggle('active', i === cmdSuggestIdx); }); }
      });
      document.addEventListener('click', function (e) {
        if (!els.cmdSuggest.hidden && !els.cmdSuggest.contains(e.target) && e.target !== els.chatInput) hideCmdSuggest();
      });

      var pendingDeleteId = null;
      var editingId = null;
      var detailItem = null;
      var memoriesCache = [];
      var toastTimer = null;
      // ---------- 聊天状态 ----------
      var convs = [];              // 会话列表（/api/chat/conversations）
      var currentConv = 'chief';   // 默认和主管单聊（DS Bot 范式）
      var chatLastId = 0;
      var chatMembers = [];
      var chatPollTimer = null;
      var chatSearchTerm = '';
      var llmReady = true;
      var MEMBER_COLORS = ['var(--mcode-accent)', 'var(--mcode-success)', 'var(--mcode-warning)', 'var(--mcode-danger)', 'var(--mcode-text-muted)', 'var(--mcode-text-subtle)'];

      function showToast(text) {
        els.toast.textContent = text;
        els.toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, 2200);
      }

      function switchTab(which) {
        Object.keys(els.tabs).forEach(function (key) {
          els.tabs[key].setAttribute('aria-selected', String(key === which));
          els.panels[key].hidden = key !== which;
        });
        if (which === 'overview') loadOverview();
        if (which === 'team') loadTeam();
        if (which === 'memories') loadMemories();
        if (which === 'outputs') loadOutputs();
        if (which === 'caps') loadCaps();
        if (which === 'tasks') loadTasks();
        if (which === 'schedules') loadSchedules();
        if (which === 'settings') loadSettings();
      }

      function setStatus(el, kind, title, desc) {
        el.innerHTML = '';
        if (!kind) return;
        var block = document.createElement('div');
        block.className = 'state-block';
        if (kind === 'error') block.setAttribute('role', 'alert');
        if (kind === 'loading') {
          var sp = document.createElement('div');
          sp.className = 'spinner';
          block.appendChild(sp);
        }
        var tt = document.createElement('div');
        tt.className = 'state-title';
        tt.textContent = title;
        block.appendChild(tt);
        if (desc) {
          var d = document.createElement('div');
          d.className = 'state-desc';
          d.textContent = desc;
          block.appendChild(d);
        }
        el.appendChild(block);
      }

      function fmtDate(iso) { return iso ? iso.slice(0, 10) : '—'; }
      function fmtTime(iso) { return iso ? iso.slice(11, 16) : ''; }
      function fmtSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(1) + ' MB';
      }
      function api(path, options) {
        var opts = options || {};
        var method = (opts.method || 'GET').toUpperCase();
        var headers = Object.assign({}, opts.headers || {});
        // 访问令牌：面板页从 URL ?token= 拿一次，存 sessionStorage，之后所有 API 带 Bearer
        var tok = '';
        try { tok = sessionStorage.getItem('maige-token') || ''; } catch (e) { /* 仅本会话 */ }
        if (tok) headers['authorization'] = 'Bearer ' + tok;
        if (method !== 'GET') {
          // CSRF 防护：写请求带自定义头；跨站页面无法在不触发 preflight 的情况下伪造
          headers['x-maige-csrf'] = '1';
        }
        opts = Object.assign({}, opts, { headers: headers });
        return fetch(path, opts).then(function (r) {
          if (r.status === 401) { var err = new Error('unauthorized'); err.status = 401; throw err; }
          if (!r.ok) throw new Error('request_failed');
          return r.json();
        });
      }

      // ---------- 头像（icons v1，失败回退首字母） ----------
      function avatarEl(key, name, size) {
        var wrap = document.createElement('span');
        wrap.className = 'avatar';
        if (size) { wrap.style.width = size + 'px'; wrap.style.height = size + 'px'; }
        var img = document.createElement('img');
        var tok = '';
        try { tok = sessionStorage.getItem('maige-token') || ''; } catch (e) { /* 仅本会话 */ }
        var base = '/api/avatar?key=' + encodeURIComponent(key);
        img.src = tok ? base + '&token=' + encodeURIComponent(tok) : base;
        img.alt = name || key;
        img.loading = 'lazy';
        img.onerror = function () {
          img.remove();
          wrap.textContent = (name || key || '?').trim().slice(0, 1);
        };
        wrap.appendChild(img);
        return wrap;
      }

      // ---------- 会话列表（DS Bot：Chief 置顶 → 群聊 → 成员） ----------
      function loadConvs() {
        return api('/api/chat/conversations').then(function (data) {
          convs = data.items || [];
          llmReady = data.llmReady !== false;
          renderConvList();
          updateChatHead();
        }).catch(function () { /* 下轮重试 */ });
      }

      function convOf(id) {
        return convs.find(function (c) { return c.id === id; }) || null;
      }

      function renderConvList() {
        els.convList.innerHTML = '';
        var membersExist = false;
        convs.forEach(function (c) {
          if (c.kind === 'member' && !membersExist) {
            membersExist = true;
            var sect = document.createElement('div');
            sect.className = 'side-sect';
            sect.textContent = t('side.members');
            els.convList.appendChild(sect);
          }
          var btn = document.createElement('button');
          btn.className = 'conv' + (c.id === currentConv ? ' active' : '');
          btn.setAttribute('role', 'option');
          btn.setAttribute('aria-selected', String(c.id === currentConv));
          btn.dataset.conv = c.id;
          var avatarKey = c.kind === 'group' ? 'maige' : c.key;
          var convAvatar = avatarEl(avatarKey, c.name, 38);
          if (c.typing) convAvatar.classList.add('live');
          btn.appendChild(convAvatar);
          var meta = document.createElement('span');
          meta.className = 'conv-meta';
          var name = document.createElement('span');
          name.className = 'conv-name';
          name.appendChild(document.createTextNode(c.name));
          if (c.kind === 'chief') {
            var badge = document.createElement('span');
            badge.className = 'conv-badge';
            badge.textContent = 'Chief';
            name.appendChild(badge);
          }
          meta.appendChild(name);
          var sub = document.createElement('span');
          sub.className = 'conv-sub';
          if (c.preview) {
            sub.textContent = (c.preview.name ? c.preview.name + '：' : '') + c.preview.text;
          } else {
            sub.textContent = c.kind === 'chief' ? t('role.chief') : c.kind === 'group' ? t('role.group') : (c.role || '');
          }
          meta.appendChild(sub);
          btn.appendChild(meta);
          if (c.preview && c.preview.at) {
            var time = document.createElement('span');
            time.className = 'conv-time';
            time.textContent = fmtTime(c.preview.at);
            btn.appendChild(time);
          }
          btn.addEventListener('click', function () { selectConv(c.id); });
          els.convList.appendChild(btn);
        });
      }

      function selectConv(id) {
        if (currentConv === id) return;
        currentConv = id;
        chatLastId = 0;
        chatSearchTerm = '';
        els.chatSearch.value = '';
        renderConvList();
        updateChatHead();
        pollChat(true);
      }

      function updateChatHead() {
        var c = convOf(currentConv);
        els.chatPeer.innerHTML = '';
        if (!c) return;
        var avatarKey = c.kind === 'group' ? 'maige' : c.key;
        els.chatPeer.appendChild(avatarEl(avatarKey, c.name, 38));
        var wrap = document.createElement('div');
        var name = document.createElement('div');
        name.className = 'chat-peer-name';
        name.textContent = c.name;
        wrap.appendChild(name);
        var role = document.createElement('div');
        role.className = 'chat-peer-role';
        role.textContent = c.kind === 'chief' ? t('role.chief') : c.kind === 'group' ? t('role.group') : (c.role || '');
        wrap.appendChild(role);
        els.chatPeer.appendChild(wrap);
        els.chatInput.placeholder = c.kind === 'chief' ? t('chat.ph.chief')
          : c.kind === 'group' ? t('chat.ph.group')
          : t('chat.ph.member', { name: c.name });
        // 状态行：在线 · 模型 · 能力包数（群聊显示人数）
        if (c.kind === 'group') return;
        api('/api/bot?key=' + encodeURIComponent(c.key)).then(function (bot) {
          if (!convOf(currentConv) || convOf(currentConv).key !== c.key) return;
          var status = document.createElement('div');
          status.className = 'chat-peer-status';
          var dot = document.createElement('span');
          dot.className = 'status-dot';
          status.appendChild(dot);
          status.appendChild(document.createTextNode(
            t('status.online') + ' · ' + bot.model + (bot.capabilities.length ? ' · ' + t('status.caps', { n: bot.capabilities.length }) : '')
          ));
          role.replaceWith(status);
        }).catch(function () { /* 状态行失败不影响聊天 */ });
      }

      // ---------- 聊天 ----------
      var lastRenderMeta = null; // 上一条已渲染消息（用于分组与时间分隔线）

      /** 极简行内渲染：先转义，再 **粗体** / `代码`（防注入，不支持完整 Markdown） */
      function richText(el, text) {
        var esc = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        esc = esc.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        esc = esc.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
        el.innerHTML = esc;
      }

      function fmtDivider(iso) {
        var d = new Date(iso);
        var now = new Date();
        var hm = iso.slice(11, 16);
        if (d.toDateString() === now.toDateString()) return t('divider.today') + ' ' + hm;
        if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + t('divider.date.md', { d: d.getDate() }) + ' ' + hm;
        return iso.slice(0, 10) + ' ' + hm;
      }

      function maybeDivider(m) {
        var need = !lastRenderMeta
          || (new Date(m.at) - new Date(lastRenderMeta.at)) > 30 * 60000
          || new Date(m.at).toDateString() !== new Date(lastRenderMeta.at).toDateString();
        if (!need) return null;
        var div = document.createElement('div');
        div.className = 'time-divider';
        div.textContent = fmtDivider(m.at);
        return div;
      }

      function renderMessage(m) {
        var grouped = lastRenderMeta
          && m.kind === 'agent' && lastRenderMeta.kind === 'agent'
          && m.sender === lastRenderMeta.sender
          && (new Date(m.at) - new Date(lastRenderMeta.at)) < 5 * 60000;
        lastRenderMeta = { sender: m.sender, kind: m.kind, at: m.at };
        if (m.kind === 'system') {
          var sys = document.createElement('div');
          sys.className = 'msg system';
          var bubble = document.createElement('div');
          bubble.className = 'bubble' + (m.name === '工具' ? ' toolish' : '');
          bubble.textContent = m.text;
          sys.appendChild(bubble);
          return sys;
        }
        // 生成物消息（图/音/视频内联展示）：不带文字气泡，直接出媒体
        if (m.kind === 'media' && m.media && m.media.url) {
          var md = document.createElement('div');
          md.className = 'msg media';
          var wrap = document.createElement('div');
          wrap.className = 'media-wrap';
          if (m.media.kind === 'image') {
            var gimg = document.createElement('img');
            gimg.src = m.media.url; gimg.alt = m.media.name || ''; gimg.className = 'media-img';
            wrap.appendChild(gimg);
          } else if (m.media.kind === 'audio') {
            var aud = document.createElement('audio');
            aud.src = m.media.url; aud.controls = true; aud.className = 'media-audio';
            wrap.appendChild(aud);
          } else if (m.media.kind === 'video') {
            var vid = document.createElement('video');
            vid.src = m.media.url; vid.controls = true; vid.className = 'media-video';
            wrap.appendChild(vid);
          }
          md.appendChild(wrap);
          return md;
        }
        // 结构化结果卡片（搜索/作品/整活单）——数据由服务端给，文案在客户端按语言渲染
        if (m.kind === 'card' && m.card) {
          var card = m.card;
          var cardTitle = '';
          if (card.type === 'search') cardTitle = t('card.search', { q: card.query || '', n: (card.items || []).length });
          else if (card.type === 'work') cardTitle = t('card.work', { name: card.name || '' });
          else if (card.type === 'task') cardTitle = t('card.task', { title: card.title || '' });
          else cardTitle = card.title || '';

          var cd = document.createElement('div');
          cd.className = 'msg card';
          var cw = document.createElement('div');
          cw.className = 'card-wrap';
          if (cardTitle) {
            var ct = document.createElement('div');
            ct.className = 'card-title';
            ct.textContent = cardTitle;
            cw.appendChild(ct);
          }
          var cb = document.createElement('div');
          cb.className = 'card-body';
          if (card.items && card.items.length) {
            // 搜索/列表类：逐条渲染（仅 http(s) 链接可点）
            card.items.forEach(function (it) {
              var ci = document.createElement('div');
              ci.className = 'card-item';
              var cit = document.createElement('div');
              cit.className = 'card-item-title';
              if (it.url && /^https?:\/\//i.test(it.url)) {
                var a = document.createElement('a');
                a.href = it.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
                a.textContent = it.title || it.url;
                cit.appendChild(a);
              } else {
                cit.textContent = it.title || it.url || '';
              }
              ci.appendChild(cit);
              if (it.snippet) {
                var cs = document.createElement('div');
                cs.className = 'card-item-snippet';
                cs.textContent = it.snippet;
                ci.appendChild(cs);
              }
              cw.appendChild(ci);
            });
          } else if (card.type === 'task') {
            var meta = document.createElement('div');
            meta.className = 'card-body';
            meta.textContent = t('card.meta', {
              kind: t('card.kind.' + (card.kind || 'text')),
              status: t('card.status.' + (card.status || 'draft')),
            });
            cw.appendChild(meta);
            if (card.body) {
              var tb = document.createElement('div');
              tb.className = 'card-body';
              tb.style.marginTop = '6px';
              tb.textContent = card.body;
              cw.appendChild(tb);
            }
          } else if (card.body) {
            cb.textContent = card.body;
            cw.appendChild(cb);
          }
          var footerText = '';
          if (card.type === 'task') footerText = t(card.status === 'ready' ? 'card.footer.ready' : 'card.footer.draft');
          else if (card.type === 'work' && card.size) footerText = t('card.footer.work', { size: card.size });
          else if (card.footer) footerText = card.footer;
          if (footerText) {
            var cft = document.createElement('div');
            cft.className = 'card-item-snippet';
            cft.style.marginTop = '8px';
            cft.textContent = footerText;
            cw.appendChild(cft);
          }
          cd.appendChild(cw);
          return cd;
        }
        var div = document.createElement('div');
        div.className = 'msg ' + (m.kind === 'user' ? 'user' : 'agent') + (m.sender === 'maige' ? ' chief' : '') + (grouped ? ' grouped' : '');
        if (m.kind === 'agent') div.appendChild(avatarEl(m.sender, m.name, 30));
        var col = document.createElement('div');
        col.className = 'msg-col';
        if (m.kind === 'agent' && !grouped) {
          var name = document.createElement('span');
          name.className = 'msg-name';
          name.textContent = m.name;
          col.appendChild(name);
        }
        var bubble = document.createElement('div');
        bubble.className = 'bubble';
        richText(bubble, m.text);
        if (m.image) {
          var im = document.createElement('img');
          im.src = '/api/chat/image?id=' + encodeURIComponent(m.image);
          im.alt = '';
          im.className = 'msg-img';
          bubble.insertBefore(im, bubble.firstChild);
        }
        col.appendChild(bubble);
        if (m.usage && m.usage.total_tokens) {
          var usage = document.createElement('span');
          usage.className = 'msg-usage';
          usage.textContent = m.usage.total_tokens + ' tok';
          col.appendChild(usage);
        }
        div.appendChild(col);
        return div;
      }

      function emptyChatState() {
        var c = convOf(currentConv);
        var box = document.createElement('div');
        box.className = 'chat-empty';
        box.appendChild(avatarEl(c && c.kind === 'member' ? c.key : 'maige', c ? c.name : '麦格', 56));
        var title = document.createElement('div');
        title.className = 'state-title';
        var desc = document.createElement('div');
        desc.className = 'state-desc';
        if (!c || c.kind === 'chief') {
          title.textContent = t('chat.empty.chief');
          desc.textContent = t('chat.empty.chief.desc');
        } else if (c.kind === 'group') {
          title.textContent = t('chat.empty');
          desc.textContent = t('chat.empty.desc');
        } else {
          title.textContent = t('chat.empty.member', { name: c.name });
          desc.textContent = t('chat.empty.member.desc');
        }
        box.appendChild(title);
        box.appendChild(desc);
        return box;
      }

      var pollTick = 0;
      function pollChat(full) {
        // 搜索模式下暂停增量轮询，全量过滤展示
        var base = '/api/chat/messages?conv=' + encodeURIComponent(currentConv);
        var url = (full || chatSearchTerm) ? base : base + '&after=' + chatLastId;
        return api(url).then(function (data) {
          if (full) {
            els.chatMessages.innerHTML = '';
            chatLastId = 0;
            lastRenderMeta = null;
          }
          if (data.llmReady === false) {
            if (!els.chatMessages.children.length) {
              els.chatMessages.innerHTML = '';
              var nr = document.createElement('div');
              nr.className = 'chat-empty';
              var st = document.createElement('div'); st.className = 'state-title'; st.textContent = t('chat.notReady');
              var sd = document.createElement('div'); sd.className = 'state-desc'; sd.textContent = t('chat.notReady.desc');
              nr.appendChild(st); nr.appendChild(sd);
              els.chatMessages.appendChild(nr);
            }
            els.chatInput.disabled = true;
            els.chatSend.disabled = true;
            return;
          }
          els.chatInput.disabled = false;
          els.chatSend.disabled = false;
          if (chatSearchTerm) {
            var term = chatSearchTerm.toLowerCase();
            var hits = data.messages.filter(function (m) {
              return m.text.toLowerCase().includes(term) || (m.name || '').toLowerCase().includes(term);
            });
            els.chatMessages.innerHTML = '';
            lastRenderMeta = null;
            if (!hits.length) {
              var nh = document.createElement('div');
              nh.className = 'chat-empty';
              var st2 = document.createElement('div'); st2.className = 'state-title'; st2.textContent = t('search.noHit', { term: chatSearchTerm });
              nh.appendChild(st2);
              els.chatMessages.appendChild(nh);
            } else {
              hits.forEach(function (m) { els.chatMessages.appendChild(renderMessage(m)); });
            }
            return;
          }
          if (data.messages.length) {
            var empty = els.chatMessages.querySelector('.chat-empty');
            if (empty) empty.remove();
            var nearBottom = els.chatMessages.scrollTop + els.chatMessages.clientHeight >= els.chatMessages.scrollHeight - 60;
            data.messages.forEach(function (m) {
              var divider = maybeDivider(m);
              if (divider) els.chatMessages.appendChild(divider);
              els.chatMessages.appendChild(renderMessage(m));
              chatLastId = Math.max(chatLastId, m.id);
            });
            if (full || nearBottom) els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
            loadConvs(); // 有新消息顺手刷新侧栏预览
          } else if (full && !data.messages.length) {
            els.chatMessages.innerHTML = '';
            els.chatMessages.appendChild(emptyChatState());
          }
          // 输入中：三点动画 + 头部头像光圈
          var headAvatar = els.chatPeer.querySelector('.avatar');
          if (data.typing) {
            var speaker = chatMembers.find(function (m) { return m.key === data.typing; });
            els.chatTyping.innerHTML = '';
            var dots = document.createElement('span');
            dots.className = 'typing-dots';
            dots.appendChild(document.createElement('i'));
            dots.appendChild(document.createElement('i'));
            dots.appendChild(document.createElement('i'));
            els.chatTyping.appendChild(dots);
            var typingLabel = (speaker ? speaker.displayName : data.typing) + t('chat.typing');
            if (data.turn) {
              var used = [];
              used.push(data.turn.tokens + (data.turn.maxTokens ? '/' + data.turn.maxTokens : '') + ' tok');
              var mins = Math.floor((data.turn.elapsedMs || 0) / 60000);
              if (data.turn.maxMinutes) used.push(mins + '/' + data.turn.maxMinutes + ' min');
              typingLabel += ' · ' + used.join(' · ');
            }
            els.chatTyping.appendChild(document.createTextNode(typingLabel));
            els.chatTyping.hidden = false;
            if (headAvatar) headAvatar.classList.add('live');
          } else {
            els.chatTyping.hidden = true;
            if (headAvatar) headAvatar.classList.remove('live');
          }
          // 流式草稿：实时渲染（不碰 lastRenderMeta——草稿不是真消息）
          var oldDraft = els.chatMessages.querySelector('.msg.draft');
          if (oldDraft) oldDraft.remove();
          if (data.draft && data.draft.text) {
            var savedMeta = lastRenderMeta;
            var dEl = renderMessage({ kind: 'agent', sender: data.draft.sender, name: data.draft.name, text: data.draft.text, at: new Date().toISOString() });
            lastRenderMeta = savedMeta;
            dEl.classList.add('draft');
            els.chatMessages.appendChild(dEl);
            var dn = els.chatMessages.scrollTop + els.chatMessages.clientHeight >= els.chatMessages.scrollHeight - 120;
            if (dn) els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
          }
          // 每 3 次轮询刷新一次会话列表（侧栏预览 + 各会话的光圈状态）
          if (++pollTick % 3 === 0) loadConvs();
          // 停止按钮：只有回合在跑时出现
          if (els.chatStop) els.chatStop.hidden = !data.running;
          return data;
        }).catch(function () { return null; /* 轮询失败静默，下轮重试 */ });
      }

      // 自适应轮询：打字/流式中 700ms，空闲 2000ms
      function pollLoop() {
        Promise.resolve(pollChat(false)).then(function (data) {
          var fast = data && (data.typing || (data.draft && data.draft.text));
          chatPollTimer = setTimeout(pollLoop, fast ? 700 : 2000);
        });
      }

      // ---------- 附图 ----------
      var pendingImage = null;
      function setPendingImage(dataUrl) {
        pendingImage = dataUrl;
        els.attachPreview.innerHTML = '';
        els.attachPreview.hidden = !dataUrl;
        if (!dataUrl) return;
        var chip = document.createElement('span');
        chip.className = 'attach-chip';
        var im = document.createElement('img');
        im.src = dataUrl;
        im.alt = '';
        chip.appendChild(im);
        var rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = '×';
        rm.setAttribute('aria-label', t('chat.attach.remove'));
        rm.addEventListener('click', function () { setPendingImage(null); });
        chip.appendChild(rm);
        els.attachPreview.appendChild(chip);
      }
      function readImageFile(file) {
        if (!file || !/^image\//.test(file.type)) return;
        var reader = new FileReader();
        reader.onload = function () { setPendingImage(String(reader.result)); };
        reader.readAsDataURL(file);
      }

      // ---------- 发送 ----------
      function sendChat() {
        var text = els.chatInput.value.trim();
        if (!text && !pendingImage) return;
        els.chatInput.value = '';
        els.chatSend.disabled = true;
        var payload = { conv: currentConv, text: text };
        if (pendingImage) payload.image = pendingImage;
        setPendingImage(null);
        api('/api/chat/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function () {
          pollChat(false);
        }).catch(function () {
          showToast(t('toast.fail.send'));
        }).finally(function () {
          els.chatSend.disabled = false;
          els.chatInput.focus();
        });
      }

      function clearChat() {
        if (!window.confirm(t('chat.clear.confirm'))) return;
        api('/api/chat/clear', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conv: currentConv })
        }).then(function () {
          chatLastId = 0;
          pollChat(true);
          loadConvs();
          showToast(t('toast.cleared'));
        }).catch(function () { showToast(t('toast.fail.clear')); });
      }

      // ---------- bot 详情（模型 / 能力包 / 用量） ----------
      var botEditingKey = null;
      function openBot(key) {
        botEditingKey = key;
        els.botError.textContent = '';
        els.botMask.hidden = false;
        els.botTitle.textContent = key;
        els.botRole.textContent = '';
        els.botModel.innerHTML = '';
        els.botCaps.innerHTML = '';
        els.botPersona.textContent = '';
        els.botUsage.textContent = '';
        Promise.all([
          api('/api/bot?key=' + encodeURIComponent(key)),
          api('/api/models'),
          api('/api/capabilities')
        ]).then(function (rs) {
          if (botEditingKey !== key) return; // 已切换/关闭
          var bot = rs[0], models = rs[1], caps = rs[2];
          els.botAvatar.innerHTML = '';
          els.botAvatar.appendChild(avatarEl(bot.key, bot.displayName, 48));
          els.botTitle.textContent = bot.displayName + (bot.key === 'maige' ? ' · Chief' : '');
          els.botRole.textContent = bot.role || bot.key;
          // 模型下拉：默认 + 按模型服务分组的模型列表（自带模型）
          var opt0 = document.createElement('option');
          opt0.value = '';
          opt0.textContent = t('bot.defaultModel', { model: models['default'] || '-' });
          els.botModel.appendChild(opt0);
          (models.providers || []).forEach(function (p) {
            if (!p.models || !p.models.length) return;
            var group = document.createElement('optgroup');
            group.label = p.name + (p.builtin ? '' : ' · ' + p.id);
            p.models.forEach(function (m) {
              var opt = document.createElement('option');
              opt.value = p.id + '/' + m;
              opt.textContent = m;
              group.appendChild(opt);
            });
            els.botModel.appendChild(group);
          });
          els.botModel.value = bot.modelOverride || '';
          // 能力包勾选
          if (!caps.items.length) {
            els.botCaps.textContent = t('bot.caps.empty');
            els.botCaps.style.color = 'var(--mcode-text-subtle)';
            els.botCaps.style.fontSize = '12px';
          } else {
            var attached = bot.capabilities.map(function (c) { return c.id; });
            caps.items.forEach(function (p) {
              var label = document.createElement('label');
              label.className = 'cap-check';
              var cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.value = p.id;
              cb.checked = attached.includes(p.id);
              label.appendChild(cb);
              var wrap = document.createElement('span');
              var nm = document.createElement('div');
              nm.className = 'cap-name';
              nm.textContent = p.name;
              wrap.appendChild(nm);
              if (p.description) {
                var ds = document.createElement('div');
                ds.className = 'cap-desc';
                ds.textContent = p.description;
                wrap.appendChild(ds);
              }
              label.appendChild(wrap);
              els.botCaps.appendChild(label);
            });
          }
          els.botPersona.textContent = bot.persona || '—';
          els.botUsage.textContent = bot.usage.calls
            ? t('usage.fmt', { calls: bot.usage.calls, tokens: bot.usage.tokens })
            : t('bot.usage.none');
        }).catch(function () {
          els.botError.textContent = t('toast.fail.bot');
        });
      }

      function closeBot() { botEditingKey = null; els.botMask.hidden = true; }

      function saveBot() {
        var key = botEditingKey;
        if (!key) { closeBot(); return; }
        var checked = [];
        els.botCaps.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
          if (cb.checked) checked.push(cb.value);
        });
        els.botSave.disabled = true;
        api('/api/bot', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key: key, model: els.botModel.value || null, capabilities: checked })
        }).then(function () {
          showToast(t('toast.saved'));
          closeBot();
          loadConvs();
        }).catch(function () {
          els.botError.textContent = t('toast.fail.save');
        }).finally(function () {
          els.botSave.disabled = false;
        });
      }

      // ---------- 能力库 ----------
      function loadCaps() {
        els.capsList.innerHTML = '';
        setStatus(els.capsStatus, 'loading', t('loading.caps'));
        Promise.all([api('/api/capabilities'), api('/api/chat/members')]).then(function (rs) {
          var caps = rs[0];
          var members = rs[1].members || [];
          var nameOf = {};
          members.forEach(function (m) { nameOf[m.key] = m.displayName; });
          els.capsDir.textContent = caps.dir;
          els.capsList.innerHTML = '';
          if (!caps.items.length) {
            setStatus(els.capsStatus, 'empty', t('empty.caps'), t('bot.caps.empty'));
            return;
          }
          setStatus(els.capsStatus, null);
          caps.items.forEach(function (p) {
            var li = document.createElement('li');
            li.className = 'cap-card';
            var head = document.createElement('div');
            head.className = 'memory-head';
            var nm = document.createElement('span');
            nm.className = 'memory-name';
            nm.textContent = p.name;
            head.appendChild(nm);
            var idBadge = document.createElement('span');
            idBadge.className = 'badge';
            idBadge.textContent = p.id;
            head.appendChild(idBadge);
            li.appendChild(head);
            if (p.description) {
              var ds = document.createElement('p');
              ds.className = 'memory-desc';
              ds.textContent = p.description;
              li.appendChild(ds);
            }
            var att = document.createElement('div');
            att.className = 'cap-attached';
            att.textContent = t('caps.attached');
            if (!p.attachedTo.length) {
              att.appendChild(document.createTextNode(t('caps.none')));
            } else {
              p.attachedTo.forEach(function (k) {
                var b = document.createElement('span');
                b.className = 'badge badge-user';
                b.textContent = nameOf[k] || k;
                att.appendChild(b);
              });
            }
            li.appendChild(att);
            els.capsList.appendChild(li);
          });
        }).catch(function () {
          setStatus(els.capsStatus, 'error', t('error.read'), t('error.read.retry'));
        });
      }

      // ---------- 管理台开关 ----------
      function openAdmin() {
        els.adminView.hidden = false;
        els.chatView.hidden = true;
        var active = Object.keys(els.tabs).find(function (k) { return els.tabs[k].getAttribute('aria-selected') === 'true'; }) || 'overview';
        switchTab(active);
      }
      function closeAdminView() {
        els.adminView.hidden = true;
        els.chatView.hidden = false;
        pollChat(true);
      }

      // ---------- 概览 ----------
      function loadOverview() {
        els.overviewContent.hidden = true;
        setStatus(els.overviewStatus, 'loading', t('loading.overview'));
        Promise.all([api('/api/overview'), api('/api/info'), api('/api/chat/usage')]).then(function (results) {
          var ov = results[0];
          var info = results[1];
          var usage = results[2];
          setStatus(els.overviewStatus, null);
          els.overviewContent.hidden = false;
          els.kpiMemory.textContent = ov.memoryCount;
          els.kpiOutputs.textContent = ov.outputsCount;
          els.kpiSensitive.textContent = ov.sensitiveCount;
          els.kpiVersion.textContent = info.maigeVersion || '未安装';
          els.kpiTokens.textContent = usage.totalTokens >= 10000 ? (usage.totalTokens / 1000).toFixed(1) + 'k' : String(usage.totalTokens);
          renderUsageChart(usage.byDay || []);
          renderUsageRank(usage.byMember || []);

          els.recentMemories.innerHTML = '';
          if (!ov.recentMemories.length) {
            renderEmptyMini(els.recentMemories, t('empty.recentMemories'));
          } else {
            ov.recentMemories.forEach(function (m) {
              var li = document.createElement('li');
              li.className = 'mini-item';
              var badge = document.createElement('span');
              badge.className = 'badge badge-' + m.source;
              badge.textContent = sourceLabel(m.source);
              li.appendChild(badge);
              var name = document.createElement('span');
              name.textContent = m.name;
              li.appendChild(name);
              var meta = document.createElement('span');
              meta.className = 'meta';
              meta.textContent = fmtDate(m.date);
              li.appendChild(meta);
              els.recentMemories.appendChild(li);
            });
          }

          els.recentOutputs.innerHTML = '';
          if (!ov.recentOutputs.length) {
            renderEmptyMini(els.recentOutputs, t('empty.recentOutputs'));
          } else {
            ov.recentOutputs.forEach(function (o) {
              var li = document.createElement('li');
              li.className = 'mini-item';
              var kind = document.createElement('span');
              kind.className = 'badge';
              kind.textContent = kindLabel(o.kind);
              li.appendChild(kind);
              var name = document.createElement('span');
              name.textContent = o.name;
              li.appendChild(name);
              var meta = document.createElement('span');
              meta.className = 'meta';
              meta.textContent = fmtSize(o.size) + ' · ' + fmtDate(o.mtime);
              li.appendChild(meta);
              els.recentOutputs.appendChild(li);
            });
          }

          els.commandGrid.innerHTML = '';
          (COMMANDS[lang] || COMMANDS.zh).forEach(function (c) {
            var card = document.createElement('div');
            card.className = 'command-card';
            var k = document.createElement('div');
            k.className = 'command-key';
            k.textContent = c.key;
            card.appendChild(k);
            var d = document.createElement('div');
            d.className = 'command-desc';
            d.textContent = c.desc;
            card.appendChild(d);
            els.commandGrid.appendChild(card);
          });
        }).catch(function () {
          setStatus(els.overviewStatus, 'error', t('error.read'), t('error.read.retry'));
        });
      }

      function renderUsageChart(byDay) {
        var svg = els.usageChart;
        svg.innerHTML = '';
        els.usageLegend.innerHTML = '';
        var W = 640, H = 140, pad = 8;
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        var memberKeys = [];
        byDay.forEach(function (d) { Object.keys(d.byMember || {}).forEach(function (k) { if (!memberKeys.includes(k)) memberKeys.push(k); }); });
        if (!memberKeys.length) {
          var empty = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          empty.setAttribute('x', W / 2); empty.setAttribute('y', H / 2);
          empty.setAttribute('text-anchor', 'middle'); empty.setAttribute('font-size', '12');
          empty.setAttribute('fill', 'var(--mcode-text-subtle)');
          empty.textContent = t('empty.usage');
          svg.appendChild(empty);
          return;
        }
        var max = Math.max.apply(null, byDay.map(function (d) { return d.total; }).concat([1]));
        var colorOf = function (k) { return MEMBER_COLORS[memberKeys.indexOf(k) % MEMBER_COLORS.length]; };
        var slotW = (W - pad * 2) / byDay.length;
        var bw = slotW * 0.6;
        byDay.forEach(function (d, i) {
          var x = pad + i * slotW + (slotW - bw) / 2;
          var y = H - 18;
          memberKeys.forEach(function (k) {
            var v = (d.byMember || {})[k] || 0;
            if (!v) return;
            var h = Math.max(2, v / max * (H - 40));
            var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x); rect.setAttribute('y', y - h);
            rect.setAttribute('width', bw); rect.setAttribute('height', h);
            rect.setAttribute('fill', colorOf(k)); rect.setAttribute('rx', 2);
            var title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = d.date + ' · ' + k + '：' + v + ' tok';
            rect.appendChild(title);
            svg.appendChild(rect);
            y -= h;
          });
          if (i % 3 === 0 || i === byDay.length - 1) {
            var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', x); label.setAttribute('y', H - 4);
            label.setAttribute('font-size', '10'); label.setAttribute('fill', 'var(--mcode-text-subtle)');
            label.textContent = d.date.slice(5);
            svg.appendChild(label);
          }
        });
        memberKeys.forEach(function (k) {
          var lg = document.createElement('span');
          lg.className = 'lg';
          var sw = document.createElement('span');
          sw.className = 'sw';
          sw.style.background = colorOf(k);
          lg.appendChild(sw);
          lg.appendChild(document.createTextNode(k));
          els.usageLegend.appendChild(lg);
        });
      }

      function renderUsageRank(byMember) {
        els.usageRank.innerHTML = '';
        if (!byMember.length) {
          renderEmptyMini(els.usageRank, t('empty.usage'));
          return;
        }
        var max = Math.max.apply(null, byMember.map(function (m) { return m.tokens; }).concat([1]));
        byMember.forEach(function (m) {
          var li = document.createElement('li');
          li.className = 'mini-item';
          var name = document.createElement('span');
          name.textContent = m.name;
          name.style.minWidth = '80px';
          li.appendChild(name);
          var barWrap = document.createElement('span');
          barWrap.className = 'rank-bar-wrap';
          var bar = document.createElement('span');
          bar.className = 'rank-bar';
          bar.style.width = Math.max(2, m.tokens / max * 100) + '%';
          barWrap.appendChild(bar);
          li.appendChild(barWrap);
          var val = document.createElement('span');
          val.className = 'meta';
          val.textContent = m.tokens >= 10000 ? (m.tokens / 1000).toFixed(1) + 'k tok' : m.tokens + ' tok';
          li.appendChild(val);
          els.usageRank.appendChild(li);
        });
      }

      function renderEmptyMini(list, text) {
        var li = document.createElement('li');
        li.className = 'mini-item';
        li.style.color = 'var(--mcode-text-subtle)';
        li.textContent = text;
        list.appendChild(li);
      }

      // ---------- 团队 ----------
      function loadTeam() {
        els.teamGrid.innerHTML = '';
        setStatus(els.teamStatus, 'loading', t('loading.team'));
        api('/api/team').then(function (data) {
          els.teamDir.textContent = t('team.dirLabel') + data.agentsDir;
          els.teamGrid.innerHTML = '';
          renderPresets(data.members.map(function (m) { return m.key; }));
          if (!data.members.length) {
            setStatus(els.teamStatus, 'empty', t('empty.team'));
            return;
          }
          setStatus(els.teamStatus, null);
          data.members.forEach(function (m) {
            var card = document.createElement('article');
            card.className = 'member-card';
            var head = document.createElement('div');
            head.className = 'member-head';
            head.appendChild(avatarEl(m.key, m.displayName, 36));
            var name = document.createElement('span');
            name.className = 'member-name';
            name.textContent = m.displayName;
            head.appendChild(name);
            var key = document.createElement('span');
            key.className = 'member-key';
            key.textContent = m.key;
            head.appendChild(key);
            var status = document.createElement('span');
            status.className = 'member-status ' + (m.status === 'ready' ? 'ready' : 'missing');
            status.textContent = m.status === 'ready' ? t('status.ready') : t('status.missing');
            head.appendChild(status);
            var fire = document.createElement('button');
            fire.className = 'btn btn-text btn-danger';
            fire.textContent = t('team.fire');
            fire.setAttribute('aria-label', t('team.fire') + ' ' + m.displayName);
            fire.addEventListener('click', function (e) {
              e.stopPropagation();
              if (!window.confirm(t('team.fire.confirm', { name: m.displayName }))) return;
              api('/api/team?key=' + encodeURIComponent(m.key), { method: 'DELETE' }).then(function () {
                showToast(t('toast.deleted'));
                loadTeam();
                loadConvs();
              }).catch(function () { showToast(t('toast.fail.delete')); });
            });
            head.appendChild(fire);
            card.appendChild(head);
            // 点卡片打开 bot 详情（DS Bot 式）
            card.style.cursor = 'pointer';
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', t('a11y.botDetail') + ' ' + m.displayName);
            card.addEventListener('click', function () { openBot(m.key); });
            card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBot(m.key); } });
            if (m.description) {
              var role = document.createElement('div');
              role.className = 'member-role';
              role.textContent = m.description;
              card.appendChild(role);
            }
            if (m.persona) {
              var persona = document.createElement('div');
              persona.className = 'member-persona';
              persona.textContent = m.persona;
              card.appendChild(persona);
            }
            els.teamGrid.appendChild(card);
          });
        }).catch(function () {
          setStatus(els.teamStatus, 'error', t('error.read'), t('error.read.retry'));
        });
      }

      // ---------- 记忆 ----------
      function loadMemories() {
        els.memoryList.innerHTML = '';
        setStatus(els.memoriesStatus, 'loading', t('loading.memories'));
        api('/api/memories').then(function (data) {
          memoriesCache = data.items;
          els.memoryDir.textContent = t('memory.dirLabel') + data.dir;
          els.memoryList.innerHTML = '';
          if (!data.items.length) {
            setStatus(els.memoriesStatus, 'empty', data.dirExists ? t('empty.memories') : t('empty.memories.dir'),
              t('empty.memories.desc'));
            return;
          }
          setStatus(els.memoriesStatus, null);
          data.items.forEach(function (item) {
            els.memoryList.appendChild(renderMemoryCard(item));
          });
        }).catch(function () {
          setStatus(els.memoriesStatus, 'error', t('error.read'), t('error.read.retry'));
        });
      }

      function renderMemoryCard(item) {
        var li = document.createElement('li');
        li.className = 'memory-card';
        li.setAttribute('tabindex', '0');
        li.setAttribute('role', 'button');
        li.setAttribute('aria-label', t('a11y.viewMemory') + ' ' + item.name);

        var head = document.createElement('div');
        head.className = 'memory-head';
        var src = document.createElement('span');
        src.className = 'badge badge-' + item.source;
        src.textContent = sourceLabel(item.source);
        head.appendChild(src);
        if (item.sensitive) {
          var sen = document.createElement('span');
          sen.className = 'badge badge-sensitive';
          sen.textContent = t('badge.sensitive');
          head.appendChild(sen);
        }
        var name = document.createElement('span');
        name.className = 'memory-name';
        name.textContent = item.name;
        head.appendChild(name);
        var date = document.createElement('span');
        date.className = 'memory-date';
        date.textContent = fmtDate(item.date || item.mtime);
        head.appendChild(date);
        var actions = document.createElement('span');
        actions.className = 'memory-actions';
        var del = document.createElement('button');
        del.className = 'btn btn-text btn-danger';
        del.textContent = t('btn.delete');
        del.setAttribute('aria-label', t('a11y.deleteMemory') + ' ' + item.name);
        del.addEventListener('click', function (e) { e.stopPropagation(); askDelete(item); });
        actions.appendChild(del);
        head.appendChild(actions);
        li.appendChild(head);

        if (item.description) {
          var desc = document.createElement('p');
          desc.className = 'memory-desc';
          desc.textContent = item.description;
          li.appendChild(desc);
        }
        if (item.body && item.body !== item.description) {
          var ex = document.createElement('p');
          ex.className = 'memory-excerpt';
          ex.textContent = item.body;
          li.appendChild(ex);
        }

        li.addEventListener('click', function () { openDetail(item); });
        li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(item); } });
        return li;
      }

      // 详情
      function openDetail(item) {
        detailItem = item;
        els.detailTitle.textContent = item.name;
        els.detailMeta.textContent = sourceLabel(item.source) + ' · ' + fmtDate(item.date || item.mtime) + (item.sensitive ? ' · ' + t('badge.sensitive') : '');
        els.detailBody.textContent = item.body || '（无正文）';
        els.detailMask.hidden = false;
        els.detailClose.focus();
      }

      // 表单（新增/编辑）
      function openForm(item) {
        editingId = item ? item.id : null;
        els.formTitle.textContent = item ? t('form.edit') : t('form.add');
        els.formName.value = item ? item.name : '';
        els.formDesc.value = item ? item.description : '';
        els.formSource.value = item ? item.source : 'user';
        els.formSensitive.checked = item ? item.sensitive : false;
        els.formBody.value = item ? item.body : '';
        els.formError.textContent = '';
        els.formMask.hidden = false;
        els.formName.focus();
      }

      function submitForm() {
        var name = els.formName.value.trim();
        var body = els.formBody.value.trim();
        if (!name) { els.formError.textContent = t('form.err.name'); return; }
        if (!body) { els.formError.textContent = t('form.err.body'); return; }
        els.formSubmit.disabled = true;
        var payload = {
          name: name,
          description: els.formDesc.value.trim(),
          source: els.formSource.value,
          sensitive: els.formSensitive.checked,
          body: body
        };
        var isEdit = !!editingId;
        var req = isEdit
          ? api('/api/memories?id=' + encodeURIComponent(editingId), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
          : api('/api/memories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        req.then(function () {
          showToast(isEdit ? t('toast.saved') : t('toast.remembered'));
          closeForm();
          loadMemories();
        }).catch(function () {
          els.formError.textContent = t('toast.fail.save');
        }).finally(function () {
          els.formSubmit.disabled = false;
        });
      }

      function closeForm() { editingId = null; els.formMask.hidden = true; }

      // 删除
      function askDelete(item) {
        pendingDeleteId = item.id;
        els.confirmText.textContent = '「' + item.name + '」——' + t('confirm.delete.text');
        els.confirmMask.hidden = false;
        els.confirmCancel.focus();
      }
      function closeConfirm() { pendingDeleteId = null; els.confirmMask.hidden = true; }
      function doDelete() {
        var id = pendingDeleteId;
        if (!id) { closeConfirm(); return; }
        els.confirmOk.disabled = true;
        api('/api/memories?id=' + encodeURIComponent(id), { method: 'DELETE' }).then(function () {
          showToast(t('toast.deleted'));
          closeConfirm();
          loadMemories();
        }).catch(function () {
          showToast(t('toast.fail.delete'));
        }).finally(function () {
          els.confirmOk.disabled = false;
        });
      }

      // ---------- 作品库 ----------
      function loadOutputs() {
        els.gallery.innerHTML = '';
        setStatus(els.outputsStatus, 'loading', t('loading.outputs'));
        api('/api/outputs').then(function (data) {
          els.outputsDirNote.textContent = t('outputs.dirLabel') + data.dir;
          els.gallery.innerHTML = '';
          if (!data.dirExists) {
            setStatus(els.outputsStatus, 'empty', t('empty.outputs.dir'), t('empty.outputs.dir.desc'));
            return;
          }
          if (!data.items.length) {
            setStatus(els.outputsStatus, 'empty', t('empty.outputs'), t('empty.outputs.desc'));
            return;
          }
          setStatus(els.outputsStatus, null);
          data.items.forEach(function (item) {
            els.gallery.appendChild(renderWorkCard(item));
          });
        }).catch(function () {
          setStatus(els.outputsStatus, 'error', t('error.read'), t('error.read.retry'));
        });
      }

      function renderWorkCard(item) {
        var card = document.createElement('button');
        card.className = 'work-card';
        card.setAttribute('aria-label', t('a11y.viewMemory') + ' ' + item.name);
        var thumb = document.createElement('div');
        thumb.className = 'work-thumb';
        if (item.kind === 'image') {
          var img = document.createElement('img');
          img.src = item.url;
          img.alt = item.name;
          img.loading = 'lazy';
          thumb.appendChild(img);
        } else {
          var label = document.createElement('span');
          label.className = 'kind-label';
          label.textContent = kindLabel(item.kind);
          thumb.appendChild(label);
        }
        card.appendChild(thumb);
        var body = document.createElement('div');
        body.className = 'work-body';
        var name = document.createElement('div');
        name.className = 'work-name';
        name.textContent = item.name;
        body.appendChild(name);
        var meta = document.createElement('div');
        meta.className = 'work-meta';
        meta.textContent = fmtSize(item.size) + ' · ' + fmtDate(item.mtime);
        body.appendChild(meta);
        card.appendChild(body);
        card.addEventListener('click', function () { openPreview(item); });
        return card;
      }

      function openPreview(item) {
        els.previewTitle.textContent = item.name;
        els.previewBody.innerHTML = '';
        els.previewOpen.href = item.url;
        if (item.kind === 'image') {
          var img = document.createElement('img');
          img.src = item.url;
          img.alt = item.name;
          els.previewBody.appendChild(img);
        } else if (item.kind === 'video') {
          var video = document.createElement('video');
          video.src = item.url;
          video.controls = true;
          els.previewBody.appendChild(video);
        } else if (item.kind === 'audio') {
          var audio = document.createElement('audio');
          audio.src = item.url;
          audio.controls = true;
          els.previewBody.appendChild(audio);
        } else {
          var p = document.createElement('p');
          p.textContent = t('preview.noPreview');
          els.previewBody.appendChild(p);
        }
        els.previewMask.hidden = false;
        els.previewClose.focus();
      }

      function closePreview() {
        els.previewBody.innerHTML = '';
        els.previewMask.hidden = true;
      }

      // ---------- 整活单（任务状态机） ----------
      var TASK_STATUS_ORDER = ['draft', 'ready', 'making', 'done', 'cancelled'];
      var detailTask = null;

      function loadTasks() {
        els.tasksBoard.innerHTML = '';
        setStatus(els.tasksStatus, 'loading', t('loading.tasks'));
        api('/api/tasks').then(function (data) {
          els.tasksDir.textContent = data.dir;
          els.tasksBoard.innerHTML = '';
          if (!data.items.length) {
            setStatus(els.tasksStatus, 'empty', t('tasks.empty'), t('tasks.empty.desc'));
            return;
          }
          setStatus(els.tasksStatus, null);
          TASK_STATUS_ORDER.forEach(function (status) {
            var group = data.items.filter(function (x) { return x.status === status; });
            if (!group.length) return;
            var g = document.createElement('div');
            g.className = 'task-group';
            var gt = document.createElement('h3');
            gt.className = 'task-group-title';
            gt.textContent = t('tstatus.' + status) + '（' + group.length + '）';
            g.appendChild(gt);
            group.forEach(function (task) { g.appendChild(renderTaskCard(task)); });
            els.tasksBoard.appendChild(g);
          });
        }).catch(function () {
          setStatus(els.tasksStatus, 'error', t('error.read'), t('error.read.retry'));
        });
      }

      function renderTaskCard(task) {
        var card = document.createElement('article');
        card.className = 'task-card';
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        var head = document.createElement('div');
        head.className = 'memory-head';
        var kind = document.createElement('span');
        kind.className = 'badge';
        kind.textContent = task.kind;
        head.appendChild(kind);
        var status = document.createElement('span');
        status.className = 'badge badge-status-' + task.status;
        status.textContent = t('tstatus.' + task.status);
        head.appendChild(status);
        var title = document.createElement('span');
        title.className = 'task-title';
        title.textContent = task.title;
        head.appendChild(title);
        var meta = document.createElement('span');
        meta.className = 'task-meta';
        meta.textContent = fmtTime(task.updated);
        head.appendChild(meta);
        card.appendChild(head);
        if (task.body) {
          var ex = document.createElement('p');
          ex.className = 'task-excerpt';
          ex.textContent = task.body;
          card.appendChild(ex);
        }
        card.addEventListener('click', function () { openTask(task.id); });
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTask(task.id); } });
        return card;
      }

      function openTask(id) {
        api('/api/tasks').then(function (data) {
          var task = data.items.find(function (x) { return x.id === id; });
          if (!task) return;
          detailTask = task;
          els.taskKindBadge.textContent = task.kind;
          els.taskStatusBadge.textContent = t('tstatus.' + task.status);
          els.taskStatusBadge.className = 'badge badge-status-' + task.status;
          els.taskTitle.textContent = task.title;
          els.taskMeta.textContent = t('task.by') + task.createdBy + ' · ' + fmtTime(task.created) + (task.updated && task.updated !== task.created ? ' → ' + fmtTime(task.updated) : '');
          els.taskBody.textContent = task.body || '—';
          if (task.deliverables && task.deliverables.length) {
            els.taskDeliverables.hidden = false;
            els.taskDeliverables.innerHTML = '';
            task.deliverables.forEach(function (name) {
              var a = document.createElement('a');
              a.href = '/api/outputs/file?name=' + encodeURIComponent(name);
              a.target = '_blank';
              a.rel = 'noopener';
              a.textContent = name;
              els.taskDeliverables.appendChild(a);
              els.taskDeliverables.appendChild(document.createTextNode(' '));
            });
          } else {
            els.taskDeliverables.hidden = true;
          }
          els.taskDlField.hidden = task.status !== 'making';
          els.taskDlInput.value = '';
          renderTaskActions(task);
          els.taskMask.hidden = false;
          els.taskClose.focus();
        }).catch(function () { showToast(t('error.read')); });
      }

      function renderTaskActions(task) {
        els.taskActions.innerHTML = '';
        var acts = [];
        if (task.status === 'draft') acts.push({ label: t('taction.confirm'), to: 'ready', primary: true });
        if (task.status === 'ready') {
          acts.push({ label: t('taction.start'), to: 'making', primary: true });
          acts.push({ label: t('taction.back'), to: 'draft' });
        }
        if (task.status === 'making') {
          acts.push({ label: t('taction.done'), to: 'done', primary: true });
          acts.push({ label: t('taction.back'), to: 'ready' });
        }
        if (task.status === 'cancelled') acts.push({ label: t('taction.revive'), to: 'draft' });
        if (task.status !== 'done') acts.push({ label: t('tstatus.cancelled'), to: 'cancelled' });
        acts.forEach(function (a) {
          var btn = document.createElement('button');
          btn.className = 'btn' + (a.primary ? ' btn-primary' : '');
          btn.textContent = a.label;
          btn.addEventListener('click', function () { transitionTask(task, a.to); });
          els.taskActions.appendChild(btn);
        });
        var del = document.createElement('button');
        del.className = 'btn btn-text btn-danger';
        del.textContent = t('btn.delete');
        del.addEventListener('click', function () {
          api('/api/tasks?id=' + encodeURIComponent(task.id), { method: 'DELETE' }).then(function () {
            showToast(t('toast.deleted'));
            els.taskMask.hidden = true;
            loadTasks();
          }).catch(function () { showToast(t('toast.fail.delete')); });
        });
        els.taskActions.appendChild(del);
      }

      function transitionTask(task, to) {
        var payload = { status: to };
        if (to === 'done') {
          payload.deliverables = els.taskDlInput.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        }
        api('/api/tasks?id=' + encodeURIComponent(task.id), {
          method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
        }).then(function () {
          showToast(t('toast.saved'));
          els.taskMask.hidden = true;
          loadTasks();
        }).catch(function () { showToast(t('toast.fail.save')); });
      }

      // ---------- 示例编队（一键组队） ----------
      var TEAM_PRESETS = [
        {
          id: 'life', nameKey: 'preset.life', descKey: 'preset.life.desc',
          members: [
            { key: 'aide-planner', display: 'Plan', role: '麦格团队的规划师：日程安排、目标拆解、优先级排序', persona: '你是 Plan，麦格团队的规划师。把模糊的目标拆成今天能做的下一步；排序永远给理由；不堆砌清单，给取舍。' },
            { key: 'aide-coach', display: 'Coach', role: '麦格团队的习惯教练：习惯养成、复盘、轻量打鸡血', persona: '你是 Coach，麦格团队的习惯教练。复盘先肯定再点一个问题；打鸡血要具体，不喊口号；习惯建议小到不可能失败。' },
          ],
        },
        {
          id: 'study', nameKey: 'preset.study', descKey: 'preset.study.desc',
          members: [
            { key: 'tutor-bot', display: 'Tutor', role: '麦格团队的私教：费曼式讲透任何主题，出小测验收', persona: '你是 Tutor，麦格团队的私教。用生活类比讲课，不许用术语解释术语；讲完必出三道由易到难的小测；教会比讲完整重要。' },
            { key: 'quiz-bot', display: 'Quiz', role: '麦格团队的出题官：按主题出卷、判卷、讲评', persona: '你是 Quiz，麦格团队的出题官。出题覆盖理解/应用/陷阱三档；判卷给分数更给讲评；陷阱题要说明陷阱在哪。' },
          ],
        },
        {
          id: 'eng', nameKey: 'preset.eng', descKey: 'preset.eng.desc',
          members: [
            { key: 'qa-bot', display: 'QA', role: '麦格团队的质量守门员：测试用例、边界穷举、验收清单', persona: '你是 QA，麦格团队的质量守门员。先想「怎么让它坏」再想「怎么证明它对」；用例覆盖正常/边界/恶意三档；验收清单要能逐项打勾。' },
            { key: 'devops-bot', display: 'Ops', role: '麦格团队的运维参谋：部署、监控、故障排查手册', persona: '你是 Ops，麦格团队的运维参谋。先问现状再给方案；每个建议附回滚路径；故障排查按「先恢复、再定位、后根治」的顺序。' },
          ],
        },
      ];

      function renderPresets(currentKeys) {
        var wrap = $('preset-list');
        if (!wrap) return;
        wrap.innerHTML = '';
        TEAM_PRESETS.forEach(function (p) {
          var missing = p.members.filter(function (m) { return !currentKeys.includes(m.key); });
          var card = document.createElement('div');
          card.className = 'member-card';
          var head = document.createElement('div');
          head.className = 'member-head';
          var name = document.createElement('span');
          name.className = 'member-name';
          name.textContent = t(p.nameKey);
          head.appendChild(name);
          card.appendChild(head);
          var desc = document.createElement('div');
          desc.className = 'member-desc';
          desc.textContent = t(p.descKey);
          card.appendChild(desc);
          var roster = document.createElement('div');
          roster.className = 'member-persona';
          roster.textContent = p.members.map(function (m) { return m.display + '（' + m.role.split('：')[0].replace('麦格团队的', '') + '）'; }).join(' · ');
          card.appendChild(roster);
          var btn = document.createElement('button');
          btn.className = 'btn' + (missing.length ? ' btn-primary' : '');
          btn.style.marginTop = '10px';
          btn.textContent = missing.length ? t('preset.hire') : t('preset.hired');
          btn.disabled = !missing.length;
          btn.addEventListener('click', function () { hirePreset(p, btn); });
          card.appendChild(btn);
          wrap.appendChild(card);
        });
      }

      async function hirePreset(p, btn) {
        btn.disabled = true;
        btn.textContent = '…';
        for (const m of p.members) {
          try {
            await api('/api/team', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify(m),
            });
          } catch (e) { /* key_exists 等失败不阻塞其余成员 */ }
        }
        showToast(t('hire.done') + ' · ' + t(p.nameKey));
        loadTeam();
        loadConvs();
      }

      // ---------- 招聘 ----------
      function submitHire() {
        var key = els.hrKey.value.trim().toLowerCase();
        var display = els.hrName.value.trim();
        var role = els.hrRole.value.trim();
        if (!key || !display || !role) { els.hrError.textContent = t('hire.err'); return; }
        if (!/^[a-z][a-z0-9-]{2,30}$/.test(key)) { els.hrError.textContent = t('hire.err.key'); return; }
        els.hrSubmit.disabled = true;
        api('/api/team', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key: key, display: display, role: role, persona: els.hrPersona.value.trim() }),
        }).then(function () {
          showToast(t('hire.done') + ' · ' + display);
          els.hireMask.hidden = true;
          loadTeam();
          loadConvs();
        }).catch(function (err) {
          els.hrError.textContent = t('hire.err');
        }).finally(function () {
          els.hrSubmit.disabled = false;
        });
      }

      function submitTaskNew() {
        var title = els.tnTitle.value.trim();
        if (!title) { els.tnError.textContent = t('task.err.title'); return; }
        els.tnSubmit.disabled = true;
        api('/api/tasks', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: title, kind: els.tnKind.value, body: els.tnBody.value.trim() }),
        }).then(function () {
          showToast(t('toast.created'));
          els.tasknewMask.hidden = true;
          loadTasks();
        }).catch(function () {
          els.tnError.textContent = t('toast.fail.create');
        }).finally(function () {
          els.tnSubmit.disabled = false;
        });
      }

      // ---------- 定时任务 ----------
      function loadSchedules() {
        els.scheduleList.innerHTML = '';
        setStatus(els.schedulesStatus, 'loading', t('loading.schedules'));
        api('/api/schedules').then(function (data) {
          els.scheduleList.innerHTML = '';
          if (!data.items.length) {
            setStatus(els.schedulesStatus, 'empty', t('empty.schedules'), t('empty.schedules.desc'));
            return;
          }
          setStatus(els.schedulesStatus, null);
          data.items.forEach(function (s) {
            var li = document.createElement('li');
            li.className = 'schedule-card';
            var head = document.createElement('div');
            head.className = 'schedule-head';
            var name = document.createElement('span');
            name.className = 'schedule-name';
            name.textContent = s.name;
            head.appendChild(name);
            var badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = s.freqType === 'daily' ? t('schedule.freq.dailyAt') + s.time : t('schedule.freq.intervalMin', { n: s.minutes });
            head.appendChild(badge);
            var who = document.createElement('span');
            who.className = 'badge badge-user';
            who.textContent = s.memberKey === 'maige' ? '麦格' : s.memberKey;
            head.appendChild(who);
            var meta = document.createElement('span');
            meta.className = 'schedule-meta';
            meta.textContent = s.lastRunAt ? t('schedule.lastRun') + s.lastRunAt.slice(0, 16).replace('T', ' ') : t('schedule.never');
            head.appendChild(meta);
            var del = document.createElement('button');
            del.className = 'btn btn-text btn-danger';
            del.style.marginLeft = 'auto';
            del.textContent = t('btn.delete');
            del.setAttribute('aria-label', t('btn.delete') + ' ' + s.name);
            del.addEventListener('click', function () {
              if (!window.confirm(t('schedule.delete.confirm', { name: s.name }))) return;
              api('/api/schedules?id=' + encodeURIComponent(s.id), { method: 'DELETE' }).then(function () {
                showToast(t('toast.deleted'));
                loadSchedules();
              }).catch(function () { showToast(t('toast.fail.delete')); });
            });
            head.appendChild(del);
            li.appendChild(head);
            var text = document.createElement('p');
            text.className = 'schedule-text';
            text.textContent = s.text;
            li.appendChild(text);
            els.scheduleList.appendChild(li);
          });
        }).catch(function () {
          setStatus(els.schedulesStatus, 'error', t('error.read'), t('error.read.retry'));
        });
      }

      function openScheduleForm() {
        els.schName.value = '';
        els.schText.value = '';
        if (els.schGoal) els.schGoal.value = '';
        els.schFreq.value = 'daily';
        els.schTimeWrap.hidden = false;
        els.schMinutesWrap.hidden = true;
        els.schError.textContent = '';
        els.schMember.innerHTML = '';
        var members = chatMembers.length ? chatMembers : [{ key: 'maige', displayName: '麦格' }];
        members.forEach(function (m) {
          var opt = document.createElement('option');
          opt.value = m.key;
          opt.textContent = m.displayName + (m.key === 'maige' ? t('member.chief') : '');
          els.schMember.appendChild(opt);
        });
        els.scheduleMask.hidden = false;
        els.schName.focus();
      }

      function submitSchedule() {
        var name = els.schName.value.trim();
        var text = els.schText.value.trim();
        if (!name) { els.schError.textContent = t('schedule.err.name'); return; }
        if (!text) { els.schError.textContent = t('schedule.err.text'); return; }
        els.schSubmit.disabled = true;
        api('/api/schedules', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: name,
            text: text,
            memberKey: els.schMember.value,
            goal: els.schGoal ? els.schGoal.value.trim() : '',
            freqType: els.schFreq.value,
            time: els.schTime.value,
            minutes: parseInt(els.schMinutes.value, 10) || 60
          })
        }).then(function () {
          showToast(t('toast.created'));
          els.scheduleMask.hidden = true;
          loadSchedules();
        }).catch(function () {
          els.schError.textContent = t('toast.fail.create');
        }).finally(function () {
          els.schSubmit.disabled = false;
        });
      }

      // ---------- 设置 ----------
      // ---------- 模型服务（自带模型） ----------
      var providerItems = [];
      function providerPayload() {
        return {
          id: els.pvId.value.trim().toLowerCase(),
          name: els.pvName.value.trim(),
          baseURL: els.pvBase.value.trim(),
          apiKey: els.pvKey.value,
          models: els.pvModels.value.split(/[,\s]+/).map(function (s) { return s.trim(); }).filter(Boolean),
          defaultModel: els.pvDefault.value.trim(),
          thinking: els.pvThinking.checked,
        };
      }
      function clearProviderForm() {
        els.providerForm.reset();
        els.pvId.value = ''; els.pvName.value = ''; els.pvBase.value = '';
        els.pvKey.value = ''; els.pvModels.value = ''; els.pvDefault.value = '';
        els.pvThinking.checked = false;
      }
      function loadProviderIntoForm(p) {
        els.pvId.value = p.id;
        els.pvName.value = p.name || '';
        els.pvBase.value = p.baseURL || '';
        els.pvKey.value = ''; // key 不回显（服务端也不返回）
        els.pvModels.value = (p.models || []).join(', ');
        els.pvDefault.value = p.defaultModel || '';
        els.pvThinking.checked = !!p.thinking;
        els.pvId.focus();
      }
      function renderProviders(items, defId) {
        providerItems = items;
        els.providerList.innerHTML = '';
        if (!items.length) {
          var empty = document.createElement('div');
          empty.className = 'field-hint';
          empty.textContent = t('provider.empty');
          els.providerList.appendChild(empty);
          return;
        }
        items.forEach(function (p) {
          var row = document.createElement('div');
          row.className = 'provider-row';
          var nm = document.createElement('span');
          nm.className = 'pv-name';
          nm.textContent = p.name;
          row.appendChild(nm);
          if (p.id === defId) {
            var def = document.createElement('span');
            def.className = 'provider-badge';
            def.textContent = t('provider.default');
            row.appendChild(def);
          }
          if (p.builtin) {
            var bi = document.createElement('span');
            bi.className = 'provider-badge';
            bi.textContent = t('provider.builtin');
            row.appendChild(bi);
          }
          var meta = document.createElement('span');
          meta.className = 'pv-meta';
          meta.textContent = p.baseURL + ' · ' + (p.models || []).length + ' ' + t('provider.modelsUnit')
            + (p.hasKey ? '' : ' · ' + t('provider.noKey'));
          row.appendChild(meta);
          if (!p.builtin) {
            var actions = document.createElement('span');
            actions.className = 'pv-actions';
            var edit = document.createElement('button');
            edit.type = 'button'; edit.className = 'btn btn-sm';
            edit.textContent = t('btn.edit');
            edit.addEventListener('click', function () { loadProviderIntoForm(p); });
            actions.appendChild(edit);
            var del = document.createElement('button');
            del.type = 'button'; del.className = 'btn btn-sm';
            del.textContent = t('btn.delete');
            del.addEventListener('click', function () { removeProvider(p); });
            actions.appendChild(del);
            row.appendChild(actions);
          }
          els.providerList.appendChild(row);
        });
      }
      function loadProviders() {
        return api('/api/providers').then(function (d) {
          renderProviders(d.items || [], d.defaultProvider);
        }).catch(function () { showToast(t('toast.fail.providers')); });
      }
      // ---------- 搜索源（免费层兜底 + API 层配 key 启用） ----------
      function loadSearchProviders() {
        if (!els.searchProviderList) return;
        return api('/api/search-providers').then(function (d) {
          renderSearchProviders(d);
        }).catch(function () { /* 搜索源加载失败不阻塞设置页 */ });
      }
      function renderSearchProviders(d) {
        var wrap = els.searchProviderList;
        wrap.innerHTML = '';
        // 免费层：只读展示（兜底，无需配置）
        (d.free || []).forEach(function (e) {
          var row = document.createElement('div');
          row.className = 'provider-item';
          var label = document.createElement('span');
          label.textContent = e.name + ' · ' + t('search.free');
          label.style.color = 'var(--mcode-text-muted)';
          row.appendChild(label);
          wrap.appendChild(row);
        });
        // API 层：每个引擎一行（名称 + key 输入 + 保存/删除）
        (d.engines || []).forEach(function (e) {
          var row = document.createElement('div');
          row.className = 'provider-item';
          row.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap';
          var name = document.createElement('span');
          name.textContent = e.name + (e.configured ? ' · ' + t('search.configured') : '');
          name.style.minWidth = '110px';
          var input = document.createElement('input');
          input.className = 'input mono';
          input.type = 'password';
          input.placeholder = e.configured ? t('search.keySet') : 'API Key';
          input.style.cssText = 'flex:1;min-width:160px';
          var saveBtn = document.createElement('button');
          saveBtn.className = 'btn';
          saveBtn.textContent = t('btn.save');
          saveBtn.addEventListener('click', function () {
            var key = input.value.trim();
            if (!key) { showToast(t('search.needKey')); return; }
            api('/api/search-providers', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ engine: e.id, apiKey: key })
            }).then(function () { showToast(t('toast.saved')); loadSearchProviders(); })
              .catch(function () { showToast(t('toast.fail.config')); });
          });
          row.appendChild(name); row.appendChild(input); row.appendChild(saveBtn);
          if (e.configured) {
            var del = document.createElement('button');
            del.className = 'btn';
            del.textContent = t('btn.delete');
            del.addEventListener('click', function () {
              api('/api/search-providers?engine=' + encodeURIComponent(e.id), { method: 'DELETE' })
                .then(function () { loadSearchProviders(); })
                .catch(function () { showToast(t('toast.fail.config')); });
            });
            row.appendChild(del);
          }
          wrap.appendChild(row);
        });
      }
      function saveProvider() {
        var payload = providerPayload();
        if (!payload.id || !payload.baseURL) { showToast(t('provider.err.required')); return; }
        api('/api/providers', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
        }).then(function () {
          showToast(t('toast.provider.saved'));
          clearProviderForm();
          return loadProviders();
        }).catch(function () { showToast(t('toast.fail.providers')); });
      }
      function removeProvider(p) {
        if (!window.confirm(t('provider.confirmDelete', { name: p.name }))) return;
        api('/api/providers?id=' + encodeURIComponent(p.id), { method: 'DELETE' })
          .then(function () { showToast(t('toast.provider.deleted')); return loadProviders(); })
          .catch(function () { showToast(t('toast.fail.providers')); });
      }

      function loadSettings() {
        setTheme(themeOverride);
        loadProviders();
        loadSearchProviders();
        // 导出全部数据：打包 zip 到作品库，然后让用户自己取
        if (els.exportData) {
          els.exportData.addEventListener('click', function () {
            api('/api/data/export', { method: 'POST' }).then(function (r) {
              showToast(t('toast.data.exported') + '：' + (r.name || ''));
            }).catch(function () { showToast(t('toast.fail.config')); });
          });
        }
        api('/api/info').then(function (info) {
          els.cfgMemoryDir.value = info.memoryDir;
          els.cfgOutputsDir.value = info.outputsDir;
          els.cfgOwnerName.value = info.ownerName || 'Mike';
          if (info.budget) {
            els.cfgBudgetTokens.value = info.budget.maxTokens || 0;
            els.cfgBudgetMinutes.value = info.budget.maxMinutes || 0;
          }
          els.infoPanelVersion.textContent = info.panelVersion;
          els.infoMaigeVersion.textContent = info.maigeVersion || '—';
          els.infoMemoryDir.textContent = info.memoryDir;
          els.infoOutputsDir.textContent = info.outputsDir;
          els.cfgNotifications.checked = info.notifications !== false;
        }).catch(function () {
          showToast(t('toast.fail.settings'));
        });
        api('/api/diagnostics').then(function (diag) {
          els.diagSummary.textContent = t('diag.summary.tpl', {
            llm: diag.llmReady ? t('diag.llm.ready') : t('diag.llm.off'),
            messages: diag.messageCount, schedules: diag.scheduleCount
          });
          els.errorList.innerHTML = '';
          if (!diag.errors.length) {
            var li = document.createElement('li');
            li.className = 'error-item';
            li.textContent = t('diag.noErrors');
            li.style.color = 'var(--mcode-text-subtle)';
            els.errorList.appendChild(li);
            return;
          }
          diag.errors.forEach(function (e) {
            var li = document.createElement('li');
            li.className = 'error-item';
            var msg = document.createElement('div');
            msg.className = 'error-msg';
            msg.textContent = e.message;
            li.appendChild(msg);
            var meta = document.createElement('div');
            meta.className = 'error-meta';
            meta.textContent = e.at.slice(0, 16).replace('T', ' ') + ' · ' + e.source;
            li.appendChild(meta);
            els.errorList.appendChild(li);
          });
        }).catch(function () { /* 诊断失败不阻塞设置页 */ });
      }

      function saveConfig() {
        els.saveConfig.disabled = true;
        api('/api/config', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            memoryDir: els.cfgMemoryDir.value.trim(),
            outputsDir: els.cfgOutputsDir.value.trim(),
            ownerName: els.cfgOwnerName.value.trim() || 'Mike',
            budget: {
              maxTokens: Number(els.cfgBudgetTokens.value) || 0,
              maxMinutes: Number(els.cfgBudgetMinutes.value) || 0,
            },
          })
        }).then(function () {
          showToast(t('toast.saved'));
          loadSettings();
        }).catch(function () {
          showToast(t('toast.fail.config'));
        }).finally(function () {
          els.saveConfig.disabled = false;
        });
      }

      function resetConfig() {
        // 回退到服务端默认（不写死个人绝对路径，公开仓库友好）
        els.cfgMemoryDir.value = els.cfgMemoryDir.placeholder || '';
        els.cfgOutputsDir.value = els.cfgOutputsDir.placeholder || '';
        showToast(t('toast.defaults'));
      }

      // ---------- 事件绑定 ----------
      Object.keys(els.tabs).forEach(function (key) {
        els.tabs[key].addEventListener('click', function () { switchTab(key); });
      });
      els.openAdmin.addEventListener('click', openAdmin);
      els.closeAdmin.addEventListener('click', closeAdminView);
      els.refreshMemories.addEventListener('click', loadMemories);
      els.refreshTeam.addEventListener('click', loadTeam);
      els.chatForm.addEventListener('submit', function (e) { e.preventDefault(); sendChat(); });
      els.chatClear.addEventListener('click', clearChat);
      els.chatStop.addEventListener('click', function () {
        api('/api/chat/stop', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conv: currentConv }),
        }).then(function (r) {
          showToast(r.stopped ? t('toast.stopped') : t('toast.stopIdle'));
          els.chatStop.hidden = true;
        }).catch(function () { showToast(t('toast.fail.stop')); });
      });
      els.chatExport.addEventListener('click', function () {
        api('/api/chat/export', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conv: currentConv }),
        }).then(function (r) {
          showToast(t('toast.exported', { name: r.name }));
        }).catch(function () { showToast(t('toast.export.empty')); });
      });
      els.chatAttach.addEventListener('click', function () { els.chatFile.click(); });
      els.chatFile.addEventListener('change', function () {
        if (els.chatFile.files && els.chatFile.files[0]) readImageFile(els.chatFile.files[0]);
        els.chatFile.value = '';
      });
      els.chatInput.addEventListener('paste', function (e) {
        var files = e.clipboardData && e.clipboardData.files;
        if (files && files.length) {
          e.preventDefault();
          readImageFile(files[0]);
        }
      });
      // 语音输入：浏览器支持才显示（SpeechRecognition）
      (function initMic() {
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;
        els.chatMic.hidden = false;
        var rec = null;
        var recOn = false;
        els.chatMic.addEventListener('click', function () {
          if (recOn && rec) { rec.stop(); return; }
          rec = new SR();
          rec.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
          rec.interimResults = false;
          rec.onresult = function (e) {
            var text = e.results[0][0].transcript;
            els.chatInput.value = els.chatInput.value ? els.chatInput.value + ' ' + text : text;
            els.chatInput.focus();
          };
          rec.onend = function () { recOn = false; els.chatMic.classList.remove('recording'); };
          rec.onerror = function () { recOn = false; els.chatMic.classList.remove('recording'); showToast(t('chat.micFail')); };
          try {
            rec.start();
            recOn = true;
            els.chatMic.classList.add('recording');
          } catch (err) { /* 启动失败静默 */ }
        });
      })();
      els.chatPeer.addEventListener('click', function () {
        var c = convOf(currentConv);
        if (c && c.kind !== 'group') openBot(c.key);
      });
      els.botCancel.addEventListener('click', closeBot);
      els.botSave.addEventListener('click', saveBot);
      els.botMask.addEventListener('click', function (e) { if (e.target === els.botMask) closeBot(); });
      els.refreshCaps.addEventListener('click', loadCaps);
      els.refreshTasks.addEventListener('click', loadTasks);
      els.addTask.addEventListener('click', function () {
        els.tnTitle.value = ''; els.tnBody.value = ''; els.tnKind.value = 'text'; els.tnError.textContent = '';
        els.tasknewMask.hidden = false;
        els.tnTitle.focus();
      });
      els.tasknewForm.addEventListener('submit', function (e) { e.preventDefault(); submitTaskNew(); });
      els.tnCancel.addEventListener('click', function () { els.tasknewMask.hidden = true; });
      els.tasknewMask.addEventListener('click', function (e) { if (e.target === els.tasknewMask) els.tasknewMask.hidden = true; });
      els.taskClose.addEventListener('click', function () { els.taskMask.hidden = true; });
      els.taskMask.addEventListener('click', function (e) { if (e.target === els.taskMask) els.taskMask.hidden = true; });
      // 招聘
      els.hireOpen.addEventListener('click', function () {
        els.hrKey.value = ''; els.hrName.value = ''; els.hrRole.value = ''; els.hrPersona.value = ''; els.hrError.textContent = '';
        els.hireMask.hidden = false;
        els.hrKey.focus();
      });
      els.hireForm.addEventListener('submit', function (e) { e.preventDefault(); submitHire(); });
      els.hrCancel.addEventListener('click', function () { els.hireMask.hidden = true; });
      els.hireMask.addEventListener('click', function (e) { if (e.target === els.hireMask) els.hireMask.hidden = true; });
      els.cfgNotifications.addEventListener('change', function () {
        api('/api/config', {
          method: 'PUT', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ notifications: els.cfgNotifications.checked }),
        }).then(function () { showToast(t('toast.saved')); })
          .catch(function () { showToast(t('toast.fail.config')); });
      });
      els.chatSearch.addEventListener('input', function () {
        chatSearchTerm = els.chatSearch.value.trim();
        if (chatSearchTerm) pollChat(false);
      });
      els.chatSearch.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { els.chatSearch.value = ''; chatSearchTerm = ''; chatLastId = 0; pollChat(true); }
      });
      els.addMemory.addEventListener('click', function () { openForm(null); });
      els.refreshOutputs.addEventListener('click', loadOutputs);
      els.saveConfig.addEventListener('click', saveConfig);
      els.resetConfig.addEventListener('click', resetConfig);
      els.providerForm.addEventListener('submit', function (e) { e.preventDefault(); saveProvider(); });
      els.pvClear.addEventListener('click', clearProviderForm);
      els.refreshSchedules.addEventListener('click', loadSchedules);
      els.addSchedule.addEventListener('click', openScheduleForm);
      els.scheduleForm.addEventListener('submit', function (e) { e.preventDefault(); submitSchedule(); });
      els.schCancel.addEventListener('click', function () { els.scheduleMask.hidden = true; });
      els.scheduleMask.addEventListener('click', function (e) { if (e.target === els.scheduleMask) els.scheduleMask.hidden = true; });
      els.schFreq.addEventListener('change', function () {
        var isDaily = els.schFreq.value === 'daily';
        els.schTimeWrap.hidden = !isDaily;
        els.schMinutesWrap.hidden = isDaily;
      });
      els.themeAuto.addEventListener('click', function () { setTheme('auto'); });
      els.themeLight.addEventListener('click', function () { setTheme('light'); });
      els.themeDark.addEventListener('click', function () { setTheme('dark'); });
      $('lang-auto').addEventListener('click', function () { switchLang('auto'); });
      $('lang-zh').addEventListener('click', function () { switchLang('zh'); });
      $('lang-en').addEventListener('click', function () { switchLang('en'); });

      function switchLang(mode) {
        setLang(mode);
        // 重载当前界面，动态文案（空态/列表/toast/会话列表）全部换成新语言
        renderConvList();
        updateChatHead();
        chatLastId = 0;
        pollChat(true);
        if (!els.adminView.hidden) {
          var active = Object.keys(els.tabs).find(function (k) { return els.tabs[k].getAttribute('aria-selected') === 'true'; });
          if (active) switchTab(active);
        }
      }
      els.copyDiagnostics.addEventListener('click', function () {
        api('/api/diagnostics').then(function (diag) {
          var text = JSON.stringify(diag, null, 2);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () { showToast(t('toast.copied')); });
          } else {
            showToast(t('toast.noClipboard'));
          }
        }).catch(function () { showToast(t('toast.fail.diag')); });
      });
      els.confirmCancel.addEventListener('click', closeConfirm);
      els.confirmOk.addEventListener('click', doDelete);
      els.confirmMask.addEventListener('click', function (e) { if (e.target === els.confirmMask) closeConfirm(); });
      els.formCancel.addEventListener('click', closeForm);
      els.form.addEventListener('submit', function (e) { e.preventDefault(); submitForm(); });
      els.formMask.addEventListener('click', function (e) { if (e.target === els.formMask) closeForm(); });
      els.detailClose.addEventListener('click', function () { els.detailMask.hidden = true; });
      els.detailEdit.addEventListener('click', function () {
        els.detailMask.hidden = true;
        if (detailItem) openForm(detailItem);
      });
      els.detailMask.addEventListener('click', function (e) { if (e.target === els.detailMask) els.detailMask.hidden = true; });
      els.previewClose.addEventListener('click', closePreview);
      els.previewMask.addEventListener('click', function (e) { if (e.target === els.previewMask) closePreview(); });
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (!els.previewMask.hidden) closePreview();
        else if (!els.botMask.hidden) closeBot();
        else if (!els.taskMask.hidden) els.taskMask.hidden = true;
        else if (!els.tasknewMask.hidden) els.tasknewMask.hidden = true;
        else if (!els.hireMask.hidden) els.hireMask.hidden = true;
        else if (!els.detailMask.hidden) els.detailMask.hidden = true;
        else if (!els.formMask.hidden) closeForm();
        else if (!els.scheduleMask.hidden) els.scheduleMask.hidden = true;
        else if (!els.confirmMask.hidden) closeConfirm();
      });

      // ---------- 访问令牌：从 URL ?token= 提取并握手，之后所有 API 走 Bearer ----------
      (function authHandshake() {
        var q = new URLSearchParams(location.search);
        var tok = q.get('token');
        if (tok) {
          try { sessionStorage.setItem('maige-token', tok); } catch (e) { /* 仅本会话 */ }
          // 清掉 URL 里的 token，避免被复制分享
          try {
            var url = new URL(location.href);
            url.searchParams.delete('token');
            history.replaceState(null, '', url.toString());
          } catch (e) { /* 忽略 */ }
        }
        // 验证 token 有效（无效则清空，走未授权态）
        var stored = '';
        try { stored = sessionStorage.getItem('maige-token') || ''; } catch (e) { /* 仅本会话 */ }
        if (stored) {
          api('/api/auth').catch(function (e) {
            if (e && e.status === 401) {
              try { sessionStorage.removeItem('maige-token'); } catch (err) { /* 忽略 */ }
            }
          });
        }
      })();

      // ---------- 启动：品牌头像 → 成员 → 会话列表 → 自适应轮询 ----------
      (function boot() {
        els.brandAvatar.appendChild((function () {
          var img = document.createElement('img');
          var tok = '';
          try { tok = sessionStorage.getItem('maige-token') || ''; } catch (e) { /* 仅本会话 */ }
          img.src = tok ? '/api/avatar?key=maige&token=' + encodeURIComponent(tok) : '/api/avatar?key=maige';
          img.alt = '麦格';
          img.onerror = function () { img.remove(); els.brandAvatar.textContent = '麦'; };
          return img;
        })());
        api('/api/chat/members').then(function (data) { chatMembers = data.members || []; }).catch(function () {});
        loadConvs().then(function () { pollChat(true); });
        pollLoop();
        // 安装向导：检测不到模型服务且首次打开 → 弹出引导
        (function maybeWizard() {
          try { if (localStorage.getItem('maige-wizard-done')) return; } catch (e) { /* ignore */ }
          api('/api/models').then(function (m) {
            if ((m.models || []).length) return; // 已有可用模型，不打扰
            els.wizardMask.hidden = false;
          }).catch(function () { /* 面板没起来 */ });
          els.wzSkip.addEventListener('click', function () {
            try { localStorage.setItem('maige-wizard-done', '1'); } catch (e) { /* ignore */ }
            els.wizardMask.hidden = true;
          });
          els.wzSave.addEventListener('click', function () {
            var base = els.wzBase.value.trim();
            var key = els.wzKey.value.trim();
            var models = els.wzModels.value.split(/[,\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
            var def = els.wzDefault.value.trim() || models[0] || '';
            if (!base || !key) { els.wzError.textContent = t('provider.err.required'); return; }
            api('/api/providers', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ id: 'user', name: '我的模型', baseURL: base, apiKey: key, models: models, defaultModel: def }),
            }).then(function () {
              try { localStorage.setItem('maige-wizard-done', '1'); } catch (e) { /* ignore */ }
              els.wizardMask.hidden = true;
              showToast(t('toast.provider.saved'));
              loadConvs();
            }).catch(function () { els.wzError.textContent = t('toast.fail.providers'); });
          });
        })();
      })();
