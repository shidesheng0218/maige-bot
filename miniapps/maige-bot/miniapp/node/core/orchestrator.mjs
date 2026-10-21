// 多 agent 编排层：单聊/群聊/圆桌/攻坚、接力、工具轮次、上下文压缩。
// 依赖运行时状态，用工厂注入；模块本身不持有全局会话。

import { callLlm } from './llm.mjs';
import { parseTool, parseCalls } from './parse.mjs';

/**
 * @param {object} deps
 */
export function createOrchestrator(deps) {
  const {
    getConv, appendMessage, getMembers, buildChiefSystem, buildMemberSystem,
    withCapabilities, memoryBlock, modelFor, maxTokensFor, execTool, lastImageDataUrl,
    persistChat, logError, notify, context, llm, llmReady,
    TOOL_PROMPT, TOOL_ROUNDS, COMPRESS_TRIGGER, COMPRESS_KEEP, COMPRESS_EVERY,
  } = deps;

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
    if (!llmReady || conv.messages.length <= COMPRESS_TRIGGER) return;
    const coveredIdx = conv.summary ? conv.messages.findIndex((m) => m.id === conv.summary.upToId) : -1;
    if (conv.summary && conv.messages.length - (coveredIdx + 1) < COMPRESS_EVERY) return;
    const cutoff = conv.messages.length - COMPRESS_KEEP;
    if (cutoff <= coveredIdx + 1) return;
    const oldMsgs = conv.messages.slice(Math.max(coveredIdx + 1, 0), cutoff);
    if (!oldMsgs.length) return;
    const text = oldMsgs.map((m) => {
      const who = m.kind === 'user' ? 'Mike' : m.kind === 'system' ? `【${m.name}】` : m.name;
      return `${who}: ${textOf(m)}`;
    }).filter((line) => !/: $/.test(line)).join('\n');
    const prev = conv.summary ? '已有纪要：\n' + conv.summary.text + '\n\n' : '';
    try {
      const reply = await callLlm(llm,
        '你是对话压缩器。把对话历史压缩成纪要，保留：用户偏好与决定、关键事实、未完成的承诺、在做的事。口语化中文，不超过 200 字。',
        prev + '新增对话：\n' + text + '\n\n请输出合并后的完整纪要（不超过 200 字，直接给纪要本身）：');
      conv.summary = { text: reply.text, upToId: conv.messages[cutoff - 1].id, at: new Date().toISOString() };
      await persistChat().catch(() => {});
      await appendMessage(convId, 'system', '系统', '前面的对话已压缩成纪要（消息都还在，模型读纪要+最近原文）。', 'system');
      context.logger.info('maige-bot.chat.compressed');
    } catch (e) {
      logError('compress', e.message); // 压缩失败不阻塞对话
    }
  }

  function buildTranscript(conv, limit) {
    const recent = conv.messages.slice(-limit);
    const lines = recent.map((m) => {
      const who = m.kind === 'user' ? 'Mike' : m.kind === 'system' ? '【' + m.name + '】' : m.name;
      return `${who}: ${textOf(m)}`;
    }).filter((line) => !/: $/.test(line)); // 丢掉纯空内容（如无正文的系统提示）
    const head = conv.summary ? '以下是更早对话的纪要（细节以此为准）：\n' + conv.summary.text + '\n\n' : '';
    return head + '以下是最近对话：\n\n' + lines.join('\n') + '\n\n现在轮到你发言（只说你要说的话，不要带名字前缀）：';
  }

  /** 一位发言者发言：流式产出（draft 实时可见）+ 可用工具（最多 TOOL_ROUNDS 轮）；
   *  返回最后一条原文（供群聊解析 CALL 接力） */
  async function speakWithTools(convId, speaker, system) {
    const conv = getConv(convId);
    conv.typing = speaker.key;
    for (let round = 0; round < TOOL_ROUNDS; round++) {
      let reply;
      conv.draft = { sender: speaker.key, name: speaker.displayName, text: '' };
      try {
        const transcript = buildTranscript(conv, 20);
        const img = await lastImageDataUrl(conv);
        const userContent = img
          ? [{ type: 'text', text: transcript }, { type: 'image_url', image_url: { url: img } }]
          : transcript;
        reply = await callLlm(
          llm,
          (await withCapabilities(system, speaker.key)) + (await memoryBlock(conv)) + TOOL_PROMPT,
          userContent,
          modelFor(speaker.key),
          (partial) => { conv.draft = { sender: speaker.key, name: speaker.displayName, text: partial }; },
          maxTokensFor(speaker.key),
        );
      } catch (e) {
        conv.draft = null;
        logError('chat', `${speaker.displayName}: ${e.message}`);
        await appendMessage(convId, 'system', '系统', `${speaker.displayName} 信号断了（${e.message}），这轮先到这里。`, 'system');
        return null;
      }
      conv.draft = null;
      const tool = parseTool(reply.text);
      if (!tool) {
        const clean = reply.text.replace(/\[\[CALL:[A-Za-z0-9._-]+\]\]/g, '').trim();
        if (clean) await appendMessage(convId, speaker.key, speaker.displayName, clean, 'agent', reply.usage);
        return reply.text;
      }
      // WRITE/TASK 的内容不贴进聊天（太长），其余情况下指令之外的独白正常贴出
      const spoken = reply.text.replace(tool.raw, '').replace(/\[\[CALL:[A-Za-z0-9._-]+\]\]/g, '').trim();
      if (spoken && tool.name !== 'write' && tool.name !== 'task') {
        await appendMessage(convId, speaker.key, speaker.displayName, spoken, 'agent', reply.usage);
      }
      const result = await execTool(tool, speaker.displayName, convId);
      await appendMessage(convId, 'system', '工具', result.note, 'system');
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
    try {
      const members = await getMembers();
      const chief = members[0];
      await appendMessage(convId, 'system', '圆桌', `圆桌开始，主题：${topic}（每位成员一轮，麦格收尾）`, 'system');
      notify('麦格 · 圆桌', `主题：${topic.slice(0, 60)}`);
      const order = [chief, ...members.slice(1), chief];
      for (const m of order) {
        const base = m.key === 'maige' ? buildChiefSystem(members, 'group') : buildMemberSystem(m, 'group');
        await speakWithTools(convId, m, base
          + `\n\n【圆桌模式】主题是「${topic}」。轮到你发言：1-3 句口语观点，给真态度，可以反对或补充前面的人；不要客套，不要复述别人的话，不要叫人接棒。`);
      }
      await appendMessage(convId, 'system', '圆桌', '圆桌结束', 'system');
      context.logger.info('maige-bot.roundtable.done');
    } finally {
      conv.typing = null;
      conv.running = false;
    }
  }

  /** 攻坚模式：群里发「攻坚：任务」触发——麦格拆任务分工 → 成员多轮讨论（可互 CALL）→ 麦格收口出方案。
   *  与圆桌的区别：圆桌是一人一轮各说观点；攻坚是围绕一个具体任务，多轮来回直到收敛，产出分工与结论。 */
  async function runSprint(convId, task) {
    const conv = getConv(convId);
    if (conv.running) return;
    conv.running = true;
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
      // 收口：麦格汇总讨论产出方案
      await speakWithTools(convId, chief, brief(chief)
        + '讨论到这里，你来收口：把大家的意见汇总成一份可执行的方案——谁做什么、产出什么、先后顺序、有没有整活单要开。简洁，能落地。');
      await appendMessage(convId, 'system', '攻坚', '攻坚结束', 'system');
      context.logger.info('maige-bot.sprint.done');
    } finally {
      conv.typing = null;
      conv.running = false;
    }
  }

  async function runTurn(convId, forcedSpeakerKey) {
    const conv = getConv(convId);
    if (conv.running) return; // 进行中的回合结束时会看到新用户消息并续跑，不会漏答
    conv.running = true;
    try {
      const members = await getMembers();
      let forced = forcedSpeakerKey;
      for (;;) {
        await maybeCompress(convId);
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
        const last = conv.messages[conv.messages.length - 1];
        if (!last || last.kind !== 'user') break;
        forced = null;
      }
    } finally {
      conv.typing = null;
      conv.running = false;
    }
  }

  return { speakWithTools, runDmTurn, runRoundtable, runSprint, runTurn, maybeCompress, buildTranscript };
}