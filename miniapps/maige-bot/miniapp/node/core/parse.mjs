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

/** 解析 bot 回复里的工具指令（一条回复最多认 1 个，WRITE/TASK/HIRE 必须是回复的结尾） */
export function parseTool(text) {
  let m = text.match(/\[\[SEARCH:([^\]]+)\]\]/);
  if (m) return { name: 'search', arg: m[1].trim(), raw: m[0] };
  m = text.match(/\[\[READ:([^\]]+)\]\]/);
  if (m) return { name: 'read', arg: m[1].trim(), raw: m[0] };
  m = text.match(/\[\[LS:([^\]]+)\]\]/);
  if (m) return { name: 'ls', arg: m[1].trim(), raw: m[0] };
  m = text.match(/\[\[WRITE:([^\]\n]+)\]\]\s*\n([\s\S]+)$/);
  if (m) return { name: 'write', arg: m[1].trim(), content: m[2].trim(), raw: m[0] };
  m = text.match(/\[\[TASK:([A-Za-z]+):([^\]\n]+)\]\]\s*\n([\s\S]+)$/);
  if (m) return { name: 'task', kind: m[1].trim().toLowerCase(), arg: m[2].trim(), content: m[3].trim(), raw: m[0] };
  m = text.match(/\[\[HIRE:([a-z][a-z0-9-]{1,30}):([^\]\n:]+):([^\]]+)\]\]\s*\n([\s\S]+)$/);
  if (m) return { name: 'hire', arg: m[1].trim(), role: m[2].trim(), display: m[3].trim(), content: m[4].trim(), raw: m[0] };
  // [[CONFIG:key:field:value]] 调整成员配置（field: maxTokens/model）
  m = text.match(/\[\[CONFIG:([a-z][a-z0-9-]{1,30}):(maxTokens|model):([^\]]+)\]\]/);
  if (m) return { name: 'config', arg: m[1].trim(), field: m[2].trim(), value: m[3].trim(), raw: m[0] };
  // [[GENERATE_IMAGE:提示词]] 文生图；[[SPEAK:文本]] 文转语音
  m = text.match(/\[\[GENERATE_IMAGE:([^\]\n]+)\]\]/);
  if (m) return { name: 'generate_image', arg: m[1].trim(), raw: m[0] };
  m = text.match(/\[\[SPEAK:([^\]\n]+)\]\]/);
  if (m) return { name: 'speak', arg: m[1].trim(), raw: m[0] };
  // [[DELIVER:任务id:文件名]] 换行后接内容——把成品挂回整活单（验收交付）
  m = text.match(/\[\[DELIVER:([A-Za-z0-9._-]+):([^\]\n]+)\]\]\s*\n([\s\S]+)$/);
  if (m) return { name: 'deliver', taskId: m[1].trim(), arg: m[2].trim(), content: m[3].trim(), raw: m[0] };
  m = text.match(/\[\[GENERATE_VIDEO:([^\]\n]+)\]\]/);
  if (m) return { name: 'generate_video', arg: m[1].trim(), raw: m[0] };
  return null;
}

/** 解析一次发言里的接力指令 [[CALL:key]]：去重、跳过已发言者、最多 3 人 */
export function parseCalls(text, members, alreadySpoke) {
  const calls = [];
  for (const m of text.matchAll(/\[\[CALL:([A-Za-z0-9._-]+)\]\]/g)) {
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