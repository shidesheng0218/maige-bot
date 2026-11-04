// 多 agent 编排层：单聊/群聊/圆桌/攻坚、接力、工具轮次、上下文压缩。
// 依赖运行时状态，用工厂注入；模块本身不持有全局会话。

import { callLlm } from './llm.mjs';
import { parseTool, parseCalls } from './parse.mjs';
import { budgetExceeded, effectiveMaxTokens, budgetReasonText } from './budget.mjs';

/** 检测回复里是否有"看起来像工具指令但没匹配上"的内容（格式漂移，防静默失败）。
 *  合法 [[CALL:key]] 是接力指令，不是工具，先剔除；否则每次正常点名都会被误判重试。
 *  宽松匹配 [[指令名 + 可选空格 + : 或全角：]]。 */
export function hasStrayToolIntent(text) {
  const withoutCalls = String(text || '').replace(/\[\[\s*CALL\s*[:：]\s*[A-Za-z0-9._-]+\s*\]\]/g, '');
  return /\[\[[A-Z][A-Z_]*\s*[:：]/.test(withoutCalls);
}

/** 去掉所有 [[...]] 指令，只留人话（格式漂移兜底展示用） */
function stripDirectives(text) {
  return String(text || '').replace(/\[\[[\s\S]*?\]\]/g, '').trim();
}

/**
 * @param {object} deps
 */
export function createOrchestrator(deps) {
  const {
    getConv, appendMessage, getMembers, buildChiefSystem, buildMemberSystem,
    withCapabilities, memoryBlock, resolveModelFor, defaultProvider, maxTokensFor, execTool, lastImageDataUrl,
    persistChat, logError, notify, context, getOwnerName,
    TOOL_PROMPT, TOOL_ROUNDS, COMPRESS_TRIGGER, COMPRESS_KEEP, COMPRESS_EVERY,
    getBudget,
  } = deps;

  // ---------- 回合控制器（「停止」+ 预算） ----------
  // 每个会话同时只跑一个回合；回合持有 AbortController 与累计用量。
  // 停止来源：user（用户点停止）/ tokens（token 预算）/ time（时长预算）。
  const turnCtl = new Map();
  function beginTurn(convId) {
    const ctl = {
      controller: new AbortController(),
      cancelled: false,
      reason: null,
      tokens: 0,
      startedAt: Date.now(),
      budget: getBudget ? getBudget() : null,
      timer: null,
    };
    // 时长预算：到点自动中止（比"每次调用前检查"更准，长请求也能被掐断）
    if (ctl.budget && ctl.budget.maxMinutes > 0) {
      ctl.timer = setTimeout(() => {
        if (turnCtl.get(convId) !== ctl) return;
        ctl.cancelled = true;
        ctl.reason = 'time';
        try { ctl.controller.abort(); } catch { /* 已中止 */ }
      }, ctl.budget.maxMinutes * 60000);
      ctl.timer.unref?.();
    }
    turnCtl.set(convId, ctl);
    return ctl;
  }
  function endTurn(convId) {
    const ctl = turnCtl.get(convId);
    if (ctl?.timer) clearTimeout(ctl.timer);
    turnCtl.delete(convId);
  }
  /** 中止某会话正在跑的回合；没有在跑返回 false */
  function cancelTurn(convId, reason = 'user') {
    const ctl = turnCtl.get(convId);
    if (!ctl) return false;
    ctl.cancelled = true;
    if (!ctl.reason) ctl.reason = reason;
    try { ctl.controller.abort(); } catch { /* 已中止 */ }
    return true;
  }
  function isCancelled(convId) {
    return !!turnCtl.get(convId)?.cancelled;
  }
  function turnSignal(convId) {
    return turnCtl.get(convId)?.controller?.signal;
  }
  function isRunning(convId) {
    return turnCtl.has(convId);
  }
  /** 回合实时状态（面板显示用量/剩余；未运行返回 null） */
  function turnInfo(convId) {
    const ctl = turnCtl.get(convId);
    if (!ctl) return null;
    return {
      tokens: ctl.tokens,
      elapsedMs: Date.now() - ctl.startedAt,
      maxTokens: ctl.budget?.maxTokens || 0,
      maxMinutes: ctl.budget?.maxMinutes || 0,
    };
  }
  function addUsage(convId, usage) {
    const ctl = turnCtl.get(convId);
    if (ctl && usage?.total_tokens) ctl.tokens += usage.total_tokens;
  }
  /** 记录本次发言消耗（speakWithTools 每次调用后都要记账） */
  function account(convId, usage) {
    addUsage(convId, usage);
    const ctl = turnCtl.get(convId);
    if (!ctl) return true;
    const hit = budgetExceeded(ctl.budget, { tokens: ctl.tokens, elapsedMs: Date.now() - ctl.startedAt });
    if (hit) {
      ctl.cancelled = true;
      ctl.reason = hit;
      try { ctl.controller.abort(); } catch { /* 已中止 */ }
      return false;
    }
    return true;
  }
  /** 发起调用前的预算检查：返回本次可用的 max_tokens；0 表示预算已尽 */
  function allot(convId, botLimit) {
    const ctl = turnCtl.get(convId);
    if (!ctl) return botLimit || undefined;
    const hit = budgetExceeded(ctl.budget, { tokens: ctl.tokens, elapsedMs: Date.now() - ctl.startedAt });
    if (hit) {
      ctl.cancelled = true;
      ctl.reason = hit;
      return 0;
    }
    const cap = effectiveMaxTokens(botLimit, ctl.budget, ctl.tokens);
    if (cap === 0) {
      // 剩余预算连一次最小调用都不够：明确标记为预算耗尽（不能只返回 0，否则外层会空转）
      ctl.cancelled = true;
      ctl.reason = 'tokens';
    }
    return cap;
  }
  /** 回合收尾：按停止原因给出解释，再清状态 */
  async function finishTurn(convId, conv) {
    conv.typing = null;
    conv.running = false;
    const ctl = turnCtl.get(convId);
    const reason = ctl?.reason || null;
    const budget = ctl?.budget || null;
    endTurn(convId);
    if (reason) await appendMessage(convId, 'system', '系统', budgetReasonText(reason, budget), 'system').catch(() => {});
  }

  /** 消息的可读文本：media/card 消息没有正文，用占位描述，避免空行污染上下文与纪要 */
  function textOf(m) {
    if (m.text) return m.text;
    if (m.kind === 'media' && m.media) {
      const label = m.media.kind === 'image' ? '图片' : m.media.kind === 'audio' ? '语音' : '视频';
      return `[${label}：${m.media.name || ''}（已展示给用户）]`;
    }
    if (m.kind === 'card' && m.card) {
      if (m.card.type === 'search') return `[搜索结果：${m.card.query || ''}（${(m.card.items || []).length} 条）]`;
      if (m.card.type === 'task') return `[整活单：${m.card.title || ''}（${m.card.status || ''}）]`;
      if (m.card.type === 'work') return `[作品：${m.card.name || ''}]`;
      return '[结果卡片]';
    }
    return '';
  }

  async function maybeCompress(convId) {
    const conv = getConv(convId);
    const provider = defaultProvider();
    if (!provider || conv.messages.length <= COMPRESS_TRIGGER) return;
    const coveredIdx = conv.summary ? conv.messages.findIndex((m) => m.id === conv.summary.upToId) : -1;
    if (conv.summary && conv.messages.length - (coveredIdx + 1) < COMPRESS_EVERY) return;
    const cutoff = conv.messages.length - COMPRESS_KEEP;
    if (cutoff <= coveredIdx + 1) return;
    const oldMsgs = conv.messages.slice(Math.max(coveredIdx + 1, 0), cutoff);
    if (!oldMsgs.length) return;
    const text = oldMsgs.map((m) => {
      const who = m.kind === 'user' ? ownerLabel() : m.kind === 'system' ? `【${m.name}】` : m.name;
      return `${who}: ${textOf(m)}`;
    }).filter((line) => !/: $/.test(line)).join('\n');
    const prev = conv.summary ? '已有纪要：\n' + conv.summary.text + '\n\n' : '';
    try {
      const reply = await callLlm(provider,
        '你是对话压缩器。把对话历史压缩成纪要，保留：用户偏好与决定、关键事实、未完成的承诺、在做的事。口语化中文，不超过 200 字。',
        prev + '新增对话：\n' + text + '\n\n请输出合并后的完整纪要（不超过 200 字，直接给纪要本身）：');
      // 压缩本身消耗的 token 也记入回合预算，避免长会话的"后台开销"逃逸出预算
      addUsage(convId, reply.usage);
      conv.summary = { text: reply.text, upToId: conv.messages[cutoff - 1].id, at: new Date().toISOString() };
      await persistChat().catch(() => {});
      await appendMessage(convId, 'system', '系统', '前面的对话已压缩成纪要（消息都还在，模型读纪要+最近原文）。', 'system');
      context.logger.info('maige-bot.chat.compressed');
    } catch (e) {
      logError('compress', e.message); // 压缩失败不阻塞对话
    }
  }

  /** 发言者显示名：user 消息用配置的 ownerName，否则回退 Mike */
  function ownerLabel() {
    return (typeof getOwnerName === 'function' && getOwnerName()) || 'Mike';
  }
  function buildTranscript(conv, limit) {
    const recent = conv.messages.slice(-limit);
    const lines = recent.map((m) => {
      const who = m.kind === 'user' ? ownerLabel() : m.kind === 'system' ? '【' + m.name + '】' : m.name;
      return `${who}: ${textOf(m)}`;
    }).filter((line) => !/: $/.test(line)); // 丢掉纯空内容（如无正文的系统提示）
    const head = conv.summary ? '以下是更早对话的纪要（细节以此为准）：\n' + conv.summary.text + '\n\n' : '';
    return head + '以下是最近对话：\n\n' + lines.join('\n') + '\n\n现在轮到你发言（只说你要说的话，不要带名字前缀）：';
  }

  /** 一位发言者发言：流式产出（draft 实时可见）+ 可用工具（最多 TOOL_ROUNDS 轮）；
   *  返回最后一条原文（供群聊解析 CALL 接力） */
  async function speakWithTools(convId, speaker, system, opts = {}) {
    const conv = getConv(convId);
    conv.typing = speaker.key;
    let strayRetried = false;
    let finalToolRetried = false;
    for (let round = 0; round < TOOL_ROUNDS; round++) {
      let reply;
      conv.draft = { sender: speaker.key, name: speaker.displayName, text: '' };
      try {
        const transcript = buildTranscript(conv, 20);
        const img = await lastImageDataUrl(conv);
        const userContent = img
          ? [{ type: 'text', text: transcript }, { type: 'image_url', image_url: { url: img } }]
          : transcript;
        if (isCancelled(convId)) return null;
        const sel = resolveModelFor(speaker.key);
        if (!sel) throw new Error('no_model_provider');
        // 预算：本次调用的 max_tokens 不超过回合剩余量（0 = 预算已尽，不再发起调用）
        const cap = allot(convId, maxTokensFor(speaker.key));
        if (cap === 0) return null;
        reply = await callLlm(
          sel.provider,
          (await withCapabilities(system, speaker.key)) + (await memoryBlock(conv)) + TOOL_PROMPT,
          userContent,
          sel.model,
          (partial) => { conv.draft = { sender: speaker.key, name: speaker.displayName, text: partial }; },
          cap,
          turnSignal(convId),
        );
      } catch (e) {
        conv.draft = null;
        if (e.message === 'llm_aborted' || isCancelled(convId)) return null; // 用户点了停止：不报错
        logError('chat', `${speaker.displayName}: ${e.message}`);
        await appendMessage(convId, 'system', '系统', `${speaker.displayName} 信号断了（${e.message}），这轮先到这里。`, 'system');
        return null;
      }
      conv.draft = null;
      const withinBudget = account(convId, reply.usage); // 记账并检查预算（token/时长）
      const tool = parseTool(reply.text);
      if (!tool) {
        // 格式漂移：模型想调工具但写法没被解析到，别静默放过——先回注提示重试一次；
        // 若第二次仍是漂移格式，至少把它说的人话贴出来，不能整轮吞掉。
        if (hasStrayToolIntent(reply.text)) {
          if (!strayRetried) {
            strayRetried = true;
            await appendMessage(convId, 'system', '工具', '检测到你的回复里有类似工具指令的格式，但没被正确识别。请对照工具说明重新输出该指令（注意 [[指令:参数]] 的格式，不要有多余空格）。', 'system');
            continue;
          }
          const visible = stripDirectives(reply.text);
          if (visible) await appendMessage(convId, speaker.key, speaker.displayName, visible, 'agent', reply.usage);
          return reply.text;
        }
        const clean = reply.text.replace(/\[\[\s*CALL\s*[:：]\s*[A-Za-z0-9._-]+\s*\]\]/g, '').trim();
        if (clean) await appendMessage(convId, speaker.key, speaker.displayName, clean, 'agent', reply.usage);
        return reply.text;
      }
      // 收口最后一棒：只允许交付类工具，搜索/讨论类直接打回，避免攻坚收口又变成新一轮调研
      if (opts.final && !['task', 'write', 'deliver'].includes(tool.name)) {
        if (!finalToolRetried) {
          finalToolRetried = true;
          await appendMessage(convId, 'system', '工具', '这是攻坚收口的最后一棒：不要再搜索/讨论/叫人。只输出方案正文，并用 [[TASK:类型:标题]] 开单。', 'system');
          continue;
        }
        const visible = stripDirectives(reply.text);
        if (visible) await appendMessage(convId, speaker.key, speaker.displayName, visible, 'agent', reply.usage);
        return reply.text;
      }
      // 指令前的正文（方案/说明）要贴出来；WRITE/TASK/DELIVER 指令后的正文是成品/需求，不贴。
      const toolAt = reply.text.indexOf(tool.raw);
      const beforeTool = toolAt >= 0 ? reply.text.slice(0, toolAt) : reply.text;
      const spoken = (tool.name === 'write' || tool.name === 'task' || tool.name === 'deliver'
        ? beforeTool
        : reply.text.replace(tool.raw, ''))
        .replace(/\[\[\s*CALL\s*[:：]\s*[A-Za-z0-9._-]+\s*\]\]/g, '')
        .trim();
      if (spoken) await appendMessage(convId, speaker.key, speaker.displayName, spoken, 'agent', reply.usage);
      if (!withinBudget) return reply.text; // 预算已尽：保留已产出的文字，不再执行工具
      const result = await execTool(tool, speaker.displayName, convId);
      await appendMessage(convId, 'system', '工具', result.note, 'system');
      // 终端动作（写作品/开单/交付/招聘）一回复只做一次：模型常在同一轮里重复输出同一张单，
      // 继续跑只会造成重复开单；剩余动作让它下一轮或写进方案正文。
      if (['write', 'task', 'deliver', 'hire'].includes(tool.name)) return reply.text;
    }
    await appendMessage(convId, 'system', '系统', `${speaker.displayName} 的工具调用到上限了，先说到这。`, 'system');
    return null;
  }

  /** 单聊轮转：只有一位发言者（可用工具） */
  async function runDmTurn(convId, speaker, system) {
    await speakWithTools(convId, speaker, system);
  }

  /** 圆桌模式：群里发「圆桌：主题」触发——麦格开场，每位成员一轮，麦格收尾 */
  async function runRoundtable(convId, topic) {
    const conv = getConv(convId);
    if (conv.running) return;
    conv.running = true;
    beginTurn(convId);
    try {
      const members = await getMembers();
      const chief = members[0];
      await appendMessage(convId, 'system', '圆桌', `圆桌开始，主题：${topic}（每位成员一轮，麦格收尾）`, 'system');
      notify('麦格 · 圆桌', `主题：${topic.slice(0, 60)}`);
      const order = [chief, ...members.slice(1), chief];
      for (let i = 0; i < order.length; i++) {
        const m = order[i];
        const base = m.key === 'maige' ? buildChiefSystem(members, 'group') : buildMemberSystem(m, 'group');
        let extra;
        if (i === 0) {
          extra = `\n\n【圆桌开场】主题是「${topic}」。你作为主管用 1-2 句把话题钉住：给一个鲜明判断，不要客套，不要罗列观点。`;
        } else if (i === order.length - 1) {
          extra = `\n\n【圆桌收尾】主题是「${topic}」。用 2-3 句收口：点出最有价值的分歧或共识，给一个明确结论或行动建议；不要重复开场的话，不要复述别人原话，不要叫人接棒。`;
        } else {
          extra = `\n\n【圆桌模式】主题是「${topic}」。轮到你发言：1-3 句口语观点，给真态度，可以反对或补充前面的人；不要客套，不要复述别人的话，不要叫人接棒。`;
        }
        await speakWithTools(convId, m, base + extra);
      }
      await appendMessage(convId, 'system', '圆桌', '圆桌结束', 'system');
      context.logger.info('maige-bot.roundtable.done');
    } finally {
      await finishTurn(convId, conv);
    }
  }

  /** 攻坚模式：群里发「攻坚：任务」触发——麦格拆任务分工 → 成员多轮讨论（可互 CALL）→ 麦格收口出方案。
   *  与圆桌的区别：圆桌是一人一轮各说观点；攻坚是围绕一个具体任务，多轮来回直到收敛，产出分工与结论。 */
  async function runSprint(convId, task) {
    const conv = getConv(convId);
    if (conv.running) return;
    conv.running = true;
    beginTurn(convId);
    try {
      const members = await getMembers();
      const chief = members[0];
      await appendMessage(convId, 'system', '攻坚', `攻坚开始，任务：${task}（麦格拆任务 → 成员讨论 → 麦格收口出方案）`, 'system');
      notify('麦格 · 攻坚', `任务：${task.slice(0, 60)}`);
      const brief = (m) => (m.key === 'maige' ? buildChiefSystem(members, 'group') : buildMemberSystem(m, 'group'))
        + `\n\n【攻坚模式】当前任务：「${task}」。`;
      // 第 1 棒：麦格拆任务、点名分工
      const kickoff = await speakWithTools(convId, chief, brief(chief)
        + '你是主管，先把这个任务拆成具体子项，用 [[CALL:成员key]] 把活儿派给最该上的人（可同时派多人）。说清楚每人干什么、产出什么。');
      const spoke = new Set(['maige']);
      let queue = kickoff ? parseCalls(kickoff, members, spoke) : [];
      const others = members.filter((m) => m.key !== 'maige').map((m) => m.key);
      if (!queue.length) {
        // 主管没点名（或点名格式仍没解析出来）：按默认编队挑 3 人，保证攻坚不是独角戏
        queue = others.slice(0, 3);
        if (queue.length) {
          await appendMessage(convId, 'system', '攻坚', `主管没点名，按默认编队先上：${queue.join('、')}`, 'system');
        }
      } else if (queue.length < 3) {
        // 只点 1-2 人时补足到 3 人：真实模型常写成"先让 X 去调研，之后再 Y/Z"，但编排器不会等待状态，
        // 只叫一个人会让攻坚退化成单聊；并行补人至少保证多视角讨论。
        const add = others.filter((k) => !queue.includes(k)).slice(0, 3 - queue.length);
        if (add.length) {
          const first = queue[0];
          queue = [...queue, ...add];
          await appendMessage(convId, 'system', '攻坚', `主管点名了 ${first}，补上 ${add.join('、')} 一起讨论`, 'system');
        }
      }
      // 中间棒：被点名的人发言（可用工具、可再 CALL 别人接着讨论），最多 8 棒防暴走
      let hops = 0;
      while (queue.length && hops < 8) {
        const batch = queue.filter((k) => !spoke.has(k)).slice(0, 3);
        if (!batch.length) { // 都在叫已发言的人：挑一个已发言的接着讨论（允许来回）
          const again = queue.find((k) => members.some((m) => m.key === k));
          if (!again) break;
          batch.push(again);
        }
        for (const k of batch) spoke.add(k);
        const texts = await Promise.all(batch.map((key) => {
          const m = members.find((x) => x.key === key);
          if (!m) return null;
          return speakWithTools(convId, m, brief(m)
            + '轮到你。围绕任务说你这部分怎么做、需要什么配合；可以让别人补充（[[CALL:key]]，对方已说过话也能再叫，攻坚允许来回）。');
        }));
        const next = [];
        for (const tx of texts) {
          if (!tx) continue;
          for (const k of parseCalls(tx, members, new Set())) { // 攻坚允许回头叫已发言者
            if (k !== 'maige' && !next.includes(k)) next.push(k); // 收口前别把麦格叫回来
          }
        }
        queue = next;
        hops++;
      }
      // 收口：麦格汇总讨论产出方案，并按分工把子任务开成整活单（assignee 到人）
      await speakWithTools(convId, chief, brief(chief)
        + '【攻坚收口·最后一棒】讨论阶段已结束。不要再回应成员、不要再安排搜索、不要再叫任何人。'
        + '现在必须做三件事：1) 用 5-8 行给出可执行方案（谁做什么、产出什么、先后顺序）；'
        + '2) 方案里需要产出成品的部分，用 [[TASK:类型:标题]] 开整活单（正文写清需求+交付标准），单子会自动挂到对应成员头上；'
        + '一条回复只开一张最关键的单，其余产出在方案里写清谁负责；'
        + '3) 用一句话告诉 Mike 下一步。简洁，能落地。', { final: true });
      await appendMessage(convId, 'system', '攻坚', '攻坚结束', 'system');
      context.logger.info('maige-bot.sprint.done');
    } finally {
      await finishTurn(convId, conv);
    }
  }

  async function runTurn(convId, forcedSpeakerKey) {
    const conv = getConv(convId);
    if (conv.running) return; // 进行中的回合结束时会看到新用户消息并续跑，不会漏答
    conv.running = true;
    beginTurn(convId);
    try {
      const members = await getMembers();
      let forced = forcedSpeakerKey;
      for (;;) {
        if (isCancelled(convId)) break; // 用户点了停止：不再续跑
        await maybeCompress(convId);
        const before = conv.messages.length;
        if (convId === 'chief') {
          await runDmTurn(convId, { key: 'maige', displayName: '麦格' }, buildChiefSystem(members, 'dm'));
        } else if (convId.startsWith('m:')) {
          const speaker = members.find((m) => m.key === convId.slice(2));
          if (!speaker) {
            await appendMessage(convId, 'system', '系统', '这位成员不在团队里了。', 'system');
          } else {
            await runDmTurn(convId, speaker, buildMemberSystem(speaker, 'dm'));
          }
        } else {
          // 群聊：主管先答，@点名优先，[[CALL:key]] 接力，同棒多人并行（最多 3 人/棒、4 棒/轮）
          const lastUser = [...conv.messages].reverse().find((m) => m.kind === 'user');
          let currentKeys;
          if (typeof forced === 'string' && forced !== 'maige') {
            currentKeys = [forced];
          } else if (lastUser) {
            const mentioned = members.find((m) => m.key !== 'maige'
              && (lastUser.text.includes('@' + m.displayName) || lastUser.text.includes('@' + m.key)));
            currentKeys = mentioned ? [mentioned.key] : ['maige'];
          } else {
            currentKeys = ['maige'];
          }
          const spoke = new Set();
          for (let hop = 0; hop < 4 && currentKeys.length; hop++) {
            const batch = currentKeys.filter((k) => !spoke.has(k));
            if (!batch.length) break;
            for (const k of batch) spoke.add(k);
            const texts = await Promise.all(batch.map((key) => {
              const speaker = members.find((m) => m.key === key);
              if (!speaker) return null;
              const system = key === 'maige' ? buildChiefSystem(members, 'group') : buildMemberSystem(speaker, 'group');
              return speakWithTools(convId, speaker, system);
            }));
            const next = [];
            for (const rawText of texts) {
              if (!rawText) continue;
              for (const k of parseCalls(rawText, members, spoke)) {
                if (!next.includes(k)) next.push(k);
              }
            }
            currentKeys = next;
          }
        }
        // 回合结束时若最后一条仍是用户消息（跑的时候又来了新消息），接着答
        if (isCancelled(convId)) break;
        if (conv.messages.length === before) break; // 本轮没有任何产出：退出，避免空转
        const last = conv.messages[conv.messages.length - 1];
        if (!last || last.kind !== 'user') break;
        forced = null;
      }
    } finally {
      await finishTurn(convId, conv);
    }
  }

  return {
    speakWithTools, runDmTurn, runRoundtable, runSprint, runTurn, maybeCompress, buildTranscript,
    cancelTurn, isRunning, turnInfo,
  };
}