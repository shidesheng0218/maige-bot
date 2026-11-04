// 纯解析层：工具指令、agent frontmatter、记忆文件的读写格式。无 I/O 副作用，便于单测。

export const ID_PATTERN = /^[A-Za-z0-9._-]+$/;
export const SOURCES = ['user', 'maige', 'tool'];

/** 解析 agent.md frontmatter 为键值对 */
export function parseAgentFrontmatter(raw) {
  const out = {};
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (kv) out[kv[1].toLowerCase()] = kv[2].trim();
  }
  return out;
}

/** 解析 bot 回复里的工具指令（一条回复最多认 1 个，WRITE/TASK/HIRE 必须是回复的结尾）。
 *  对空格和全角冒号宽容：模型常写 [[CALL: x]] / [[TASK：text：标题]]，不能因此静默失败。
 *  模型偶尔一条回复写多个指令：取文本里最后出现的那个——WRITE/TASK/DELIVER 按约定写在末尾，
 *  不能被前面的 [[SEARCH]] 抢掉（真实实测里出现过「开了单却只执行了搜索」）。 */
export function parseTool(text) {
  const s = String(text || '');
  const found = [];
  const add = (re, build) => {
    const m = s.match(re);
    if (m) found.push({ at: m.index ?? 0, value: build(m) });
  };
  add(/\[\[\s*SEARCH\s*[:：]\s*([^\]]+?)\s*\]\]/, (m) => ({ name: 'search', arg: m[1].trim(), raw: m[0] }));
  add(/\[\[\s*READ\s*[:：]\s*([^\]]+?)\s*\]\]/, (m) => ({ name: 'read', arg: m[1].trim(), raw: m[0] }));
  add(/\[\[\s*LS\s*[:：]\s*([^\]]+?)\s*\]\]/, (m) => ({ name: 'ls', arg: m[1].trim(), raw: m[0] }));
  add(/\[\[\s*WRITE\s*[:：]\s*([^\]\n]+?)\s*\]\]\s*\n([\s\S]+)$/, (m) => ({ name: 'write', arg: m[1].trim(), content: m[2].trim(), raw: m[0] }));
  add(/\[\[\s*TASK\s*[:：]\s*([A-Za-z]+)\s*[:：]\s*([^\]\n]+?)\s*\]\]\s*\n([\s\S]+)$/, (m) => ({ name: 'task', kind: m[1].trim().toLowerCase(), arg: m[2].trim(), content: m[3].trim(), raw: m[0] }));
  add(/\[\[\s*HIRE\s*[:：]\s*([a-z][a-z0-9-]{1,30})\s*[:：]\s*([^\]\n:：]+?)\s*[:：]\s*([^\]]+?)\s*\]\]\s*\n([\s\S]+)$/, (m) => ({ name: 'hire', arg: m[1].trim(), role: m[2].trim(), display: m[3].trim(), content: m[4].trim(), raw: m[0] }));
  add(/\[\[\s*CONFIG\s*[:：]\s*([a-z][a-z0-9-]{1,30})\s*[:：]\s*(maxTokens|model)\s*[:：]\s*([^\]]+?)\s*\]\]/, (m) => ({ name: 'config', arg: m[1].trim(), field: m[2].trim(), value: m[3].trim(), raw: m[0] }));
  add(/\[\[\s*GENERATE_IMAGE\s*[:：]\s*([^\]\n]+?)\s*\]\]/, (m) => ({ name: 'generate_image', arg: m[1].trim(), raw: m[0] }));
  add(/\[\[\s*SPEAK\s*[:：]\s*([^\]\n]+?)\s*\]\]/, (m) => ({ name: 'speak', arg: m[1].trim(), raw: m[0] }));
  add(/\[\[\s*DELIVER\s*[:：]\s*([A-Za-z0-9._-]+)\s*[:：]\s*([^\]\n]+?)\s*\]\]\s*\n([\s\S]+)$/, (m) => ({ name: 'deliver', taskId: m[1].trim(), arg: m[2].trim(), content: m[3].trim(), raw: m[0] }));
  add(/\[\[\s*GENERATE_VIDEO\s*[:：]\s*([^\]\n]+?)\s*\]\]/, (m) => ({ name: 'generate_video', arg: m[1].trim(), raw: m[0] }));
  add(/\[\[\s*REMEMBER\s*[:：]\s*([^\]]+?)\s*\]\]/, (m) => ({ name: 'remember', arg: m[1].trim(), raw: m[0] }));
  if (!found.length) return null;
  found.sort((a, b) => a.at - b.at);
  // 终端指令（WRITE/TASK/DELIVER/HIRE）的内容一直吃到回复结尾，优先级最高；
  // 它们正文里出现的 [[SEARCH]] 属于需求描述，不能被当成要执行的工具。
  const terminal = found.filter((x) => ['write', 'task', 'deliver', 'hire'].includes(x.value.name));
  return (terminal.length ? terminal[terminal.length - 1] : found[found.length - 1]).value;
}

/** 解析一次发言里的接力指令 [[CALL:key]]：去重、跳过已发言者、最多 3 人 */
export function parseCalls(text, members, alreadySpoke) {
  const calls = [];
  for (const m of text.matchAll(/\[\[\s*CALL\s*[:：]\s*([A-Za-z0-9._-]+)\s*\]\]/g)) {
    const key = m[1];
    if (key === 'maige' && alreadySpoke.has('maige')) continue;
    if (members.some((x) => x.key === key) && !alreadySpoke.has(key) && !calls.includes(key)) calls.push(key);
  }
  return calls.slice(0, 3);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** 解析单条记忆 .md 文件（frontmatter + 正文） */
export function parseMemory(id, raw) {
  const item = { id, name: id, description: '', source: 'maige', date: '', sensitive: false, body: '' };
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  item.body = (m ? m[2] : raw).trim();
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
      if (!kv) continue;
      const key = kv[1].toLowerCase();
      const value = kv[2].trim();
      if (key === 'name' && value) item.name = value;
      if (key === 'description') item.description = value;
      if (key === 'source' && SOURCES.includes(value)) item.source = value;
      if (key === 'date') item.date = value;
      if (key === 'sensitive') item.sensitive = value === 'true';
    }
  }
  return item;
}

/** 序列化记忆为 .md 文件内容 */
export function serializeMemory(item) {
  const esc = (v) => String(v ?? '').replace(/\r?\n/g, ' ').trim();
  return [
    '---',
    `name: ${esc(item.name)}`,
    `description: ${esc(item.description)}`,
    `source: ${SOURCES.includes(item.source) ? item.source : 'maige'}`,
    `date: ${esc(item.date) || today()}`,
    `sensitive: ${item.sensitive ? 'true' : 'false'}`,
    '---',
    '',
    `${String(item.body ?? '').trim()}`,
    '',
  ].join('\n');
}

/** 校验客户端提交的记忆字段，返回 { error } 或 { value } */
export function normalizeMemoryInput(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'invalid_body' };
  const name = String(raw.name ?? '').trim();
  if (!name || name.length > 60) return { error: 'invalid_name' };
  const body = String(raw.body ?? '').trim();
  if (!body) return { error: 'invalid_body_content' };
  return {
    value: {
      name,
      description: String(raw.description ?? '').trim().slice(0, 200),
      source: SOURCES.includes(raw.source) ? raw.source : 'user',
      sensitive: raw.sensitive === true,
      body: body.slice(0, 8000),
      date: typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : today(),
    },
  };
}