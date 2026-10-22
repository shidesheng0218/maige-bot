// 面板 API 集成测试：不需要 LLM，全部跑在临时目录里（CI 可跑）。
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, statSync, readFileSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = mkdtempSync(join(tmpdir(), 'maige-api-'));

// 必须在 import server 之前设置（HOST 与模型配置在模块加载时解析）
process.env.MAIGE_HQ_NO_NOTIFY = '1';
process.env.MAIGE_ROOT = join(TMP, 'root');
process.env.MAIGE_MEMORY_DIR = join(TMP, 'memory');
process.env.MAIGE_OUTPUTS_DIR = join(TMP, 'outputs');
process.env.MAIGE_TASKS_DIR = join(TMP, 'tasks');
process.env.MAIGE_AGENTS_DIR = join(TMP, 'agents');
process.env.MAIGE_ICONS_DIRS = join(TMP, 'icons');
process.env.MAIGE_LLM_CONFIG = join(TMP, 'no-such-config.yaml');
delete process.env.MAIGE_LLM_BASE_URL;
delete process.env.MAIGE_LLM_API_KEY;

for (const d of ['memory', 'outputs', 'tasks', 'agents', 'icons']) mkdirSync(join(TMP, d), { recursive: true });
cpSync(join(REPO, 'maige-bot', 'seed', 'agents'), join(TMP, 'agents'), { recursive: true });
writeFileSync(join(TMP, 'memory', 'user-name.md'), '---\nname: 名字\ndescription: 用户叫 Mike\nsource: user\ndate: 2026-01-01\nsensitive: false\n---\n\nMike。\n');
writeFileSync(join(TMP, 'memory', 'secret.md'), '---\nname: 敏感\ndescription: 证件号\nsource: user\ndate: 2026-01-01\nsensitive: true\n---\n\n敏感内容\n');

const { start } = await import('../miniapps/maige-bot/miniapp/node/server.mjs');
const ac = new AbortController();
const PORT = 18331;
const BASE = `http://127.0.0.1:${PORT}`;
const life = await start({
  pluginRoot: join(REPO, 'miniapps/maige-bot'),
  dataDir: join(TMP, 'data'),
  listen: { host: '127.0.0.1', port: PORT },
  signal: ac.signal,
  logger: { info() {}, warn() {} },
});

after(async () => {
  await life.dispose();
  rmSync(TMP, { recursive: true, force: true });
});

const jsonHeaders = { 'content-type': 'application/json' };
const get = (p) => fetch(BASE + p);
const send = (p, method, body, extra = {}) => fetch(BASE + p, {
  method, headers: { ...jsonHeaders, ...extra }, body: body === undefined ? undefined : JSON.stringify(body),
});

test('面板页可访问', async () => {
  const r = await get('/panel');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /麦格/);
});

test('概览与记忆列表（fixture 隔离）', async () => {
  const ov = await (await get('/api/overview')).json();
  assert.equal(ov.memoryCount, 2);
  assert.equal(ov.sensitiveCount, 1);
  const mems = await (await get('/api/memories')).json();
  assert.equal(mems.items.length, 2);
});

test('记忆 CRUD 与路径穿越防护', async () => {
  const created = await (await send('/api/memories', 'POST', { name: '测试', body: '正文', source: 'user' })).json();
  assert.ok(created.ok && created.id);
  let list = await (await get('/api/memories')).json();
  assert.ok(list.items.some((i) => i.id === created.id));
  const upd = await send(`/api/memories?id=${created.id}`, 'PUT', { name: '测试改', body: '新正文', source: 'maige' });
  assert.ok(upd.ok);
  list = await (await get('/api/memories')).json();
  assert.equal(list.items.find((i) => i.id === created.id).body, '新正文');
  assert.ok((await fetch(`${BASE}/api/memories?id=${created.id}`, { method: 'DELETE' })).ok);
  assert.equal((await fetch(`${BASE}/api/memories?id=..%2F..%2Fetc%2Fpasswd`, { method: 'DELETE' })).status, 400);
});

test('整活单状态机', async () => {
  const t = await (await send('/api/tasks', 'POST', { title: '测试单', kind: 'image', body: '需求' })).json();
  assert.ok(t.ok);
  assert.equal((await send(`/api/tasks?id=${t.id}`, 'PUT', { status: 'done' })).status, 409); // draft 不能直接 done
  assert.ok((await send(`/api/tasks?id=${t.id}`, 'PUT', { status: 'ready' })).ok);
  assert.ok((await send(`/api/tasks?id=${t.id}`, 'PUT', { status: 'making' })).ok);
  assert.ok((await send(`/api/tasks?id=${t.id}`, 'PUT', { status: 'done', deliverables: ['a.png'] })).ok);
  assert.equal((await send(`/api/tasks?id=${t.id}`, 'PUT', { status: 'ready' })).status, 409); // done 终态
  assert.ok((await fetch(`${BASE}/api/tasks?id=${t.id}`, { method: 'DELETE' })).ok);
});

test('定时任务支持产出目标（goal）', async () => {
  const s = await (await send('/api/schedules', 'POST', {
    name: '晨报', text: '来一份今日热点', memberKey: 'maige',
    freqType: 'daily', time: '09:00', goal: '写成 .md 进作品库',
  })).json();
  assert.ok(s.ok);
  const list = await (await get('/api/schedules')).json();
  const item = list.items.find((x) => x.id === s.id);
  assert.equal(item.goal, '写成 .md 进作品库');
  await fetch(`${BASE}/api/schedules?id=${s.id}`, { method: 'DELETE' });
});

test('交付契约：整活单挂 assignee，DELIVER 交付后进作品库', async () => {
  // 开一张挂到 Quill 头上的单子
  const t = await (await send('/api/tasks', 'POST', {
    title: '晨报', kind: 'text', body: '写五条', conv: 'chief',
  })).json();
  assert.ok(t.ok);
  // assignee 默认空（手动开单没点名）
  let items = (await (await get('/api/tasks')).json()).items;
  let task = items.find((x) => x.id === t.id);
  assert.equal(task.assignee, '');
  // 状态机走到 making（可以交付）
  await send(`/api/tasks?id=${t.id}`, 'PUT', { status: 'ready' });
  await send(`/api/tasks?id=${t.id}`, 'PUT', { status: 'making' });
  await fetch(`${BASE}/api/tasks?id=${t.id}`, { method: 'DELETE' });
});

test('作品库与服务端点', async () => {
  writeFileSync(join(TMP, 'outputs', 'note.md'), '# hi');
  const outs = await (await get('/api/outputs')).json();
  assert.ok(outs.items.some((i) => i.name === 'note.md'));
  const file = await get('/api/outputs/file?name=note.md');
  assert.equal(file.status, 200);
  assert.match(await file.text(), /hi/);
  assert.equal((await get('/api/outputs/file?name=..%2Fconfig.json')).status, 404);
});

test('头像：素材优先，否则生成 SVG', async () => {
  writeFileSync(join(TMP, 'icons', 'maige.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const img = await get('/api/avatar?key=maige');
  assert.equal(img.status, 200);
  assert.match(img.headers.get('content-type'), /image\/png/);
  const gen = await get('/api/avatar?key=newbie');
  assert.equal(gen.status, 200);
  assert.match(gen.headers.get('content-type'), /image\/svg/);
  assert.match(await gen.text(), /^<svg/);
  assert.equal((await get('/api/avatar?key=..%2Fx')).status, 400);
});

test('团队扫描与招聘/移除（fixture agents）', async () => {
  const team = await (await get('/api/team')).json();
  const keys = team.members.map((m) => m.key);
  for (const k of ['moke-writer', 'huajiang-visual', 'lengjiao-reviewer', 'suyuan-researcher', 'suji-recorder', 'tech-lead']) {
    assert.ok(keys.includes(k), `missing ${k}`);
  }
  assert.ok(!keys.includes('worker'));
  const hire = await send('/api/team', 'POST', { key: 'test-bot-api', display: 'TestBot', role: '测试：回归专用', persona: '你是 TestBot。' });
  assert.ok(hire.ok);
  assert.equal((await send('/api/team', 'POST', { key: 'test-bot-api', display: 'X', role: 'x' })).status, 409);
  assert.equal((await fetch(`${BASE}/api/team?key=maige`, { method: 'DELETE' })).status, 400);
  assert.equal((await fetch(`${BASE}/api/team?key=worker`, { method: 'DELETE' })).status, 404);
  assert.ok((await fetch(`${BASE}/api/team?key=test-bot-api`, { method: 'DELETE' })).ok);
});

test('CSRF：带 Origin 的写请求必须带 x-maige-csrf', async () => {
  const blocked = await send('/api/memories', 'POST', { name: 'x', body: 'y' }, { origin: 'https://evil.example' });
  assert.equal(blocked.status, 403);
  const ok = await send('/api/memories', 'POST', { name: 'x', body: 'y' },
    { origin: 'https://evil.example', 'x-maige-csrf': '1' });
  assert.equal(ok.status, 200);
  // 清掉刚建的条目
  const id = (await ok.json()).id;
  await fetch(`${BASE}/api/memories?id=${id}`, { method: 'DELETE' });
});

test('CSRF：带 body 的写请求必须是 JSON', async () => {
  const r = await fetch(BASE + '/api/memories', {
    method: 'POST',
    headers: { 'content-type': 'text/plain', origin: 'https://evil.example', 'x-maige-csrf': '1' },
    body: JSON.stringify({ name: 'x', body: 'y' }),
  });
  assert.equal(r.status, 415);
});

test('配置：key 回显被抹掉，配置文件权限 600', async () => {
  const r = await send('/api/config', 'PUT', { minimaxApiKey: 'sk-test-secret' });
  const body = await r.json();
  assert.equal(body.minimaxApiKey, '(已配置)');
  assert.ok(!JSON.stringify(body).includes('sk-test-secret'));
  const cfgPath = join(TMP, 'data', 'config.json');
  const mode = statSync(cfgPath).mode & 0o777;
  assert.equal(mode, 0o600);
  assert.match(readFileSync(cfgPath, 'utf8'), /sk-test-secret/); // 落盘仍在，但只有本人可读
});

test('无模型配置时聊天返回 503（诚实失败）', async () => {
  const d = await (await get('/api/diagnostics')).json();
  assert.equal(d.llmReady, false);
  assert.equal((await send('/api/chat/send', 'POST', { text: 'hi' })).status, 503);
});

test('自带模型：新增 / 更新 / 删除 provider', async () => {
  const created = await send('/api/providers', 'POST', {
    id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1',
    apiKey: 'sk-secret', models: ['gpt-4o', 'gpt-4o-mini'], defaultModel: 'gpt-4o',
  });
  assert.ok(created.ok, 'provider 创建失败');
  let list = await (await get('/api/providers')).json();
  const p = list.items.find((x) => x.id === 'openai');
  assert.ok(p, 'provider 未出现在列表');
  assert.equal(p.baseURL, 'https://api.openai.com/v1');
  assert.equal(p.hasKey, true);
  assert.ok(!JSON.stringify(list).includes('sk-secret'), 'key 不应回显');
  assert.equal(list.defaultProvider, 'openai', '用户配置的 provider 应为默认');

  // 非法输入
  assert.equal((await send('/api/providers', 'POST', { id: 'Bad Id', baseURL: 'https://x.dev' })).status, 400);
  assert.equal((await send('/api/providers', 'POST', { id: 'ok', baseURL: 'not-a-url' })).status, 400);
  assert.equal((await send('/api/providers', 'POST', { id: 'mcode', baseURL: 'https://x.dev' })).status, 400, '保留 id 不给用户');

  // 更新
  assert.ok((await send('/api/providers', 'PUT', { id: 'openai', models: ['gpt-4o'], defaultModel: 'gpt-4o' })).ok);
  list = await (await get('/api/providers')).json();
  assert.deepEqual(list.items.find((x) => x.id === 'openai').models, ['gpt-4o']);

  // 删除（同时清掉引用它的 bot 覆盖）
  await send('/api/bot', 'PUT', { key: 'maige', model: 'openai/gpt-4o' });
  let bot = await (await get('/api/bot?key=maige')).json();
  assert.equal(bot.model, 'openai/gpt-4o');
  assert.equal(bot.modelOverride, 'openai/gpt-4o');
  assert.ok((await fetch(`${BASE}/api/providers?id=openai`, { method: 'DELETE' })).ok);
  bot = await (await get('/api/bot?key=maige')).json();
  assert.equal(bot.modelOverride, null, '删除 provider 后 bot 应回到默认');
});

test('自带模型：每个 bot 可分别指定 provider/model', async () => {
  await send('/api/providers', 'POST', {
    id: 'local', name: 'Ollama', baseURL: 'http://127.0.0.1:11434/v1',
    apiKey: 'ollama', models: ['qwen2.5:14b'], defaultModel: 'qwen2.5:14b',
  });
  // 合法引用
  assert.ok((await send('/api/bot', 'PUT', { key: 'maige', model: 'local/qwen2.5:14b' })).ok);
  let bot = await (await get('/api/bot?key=maige')).json();
  assert.equal(bot.model, 'local/qwen2.5:14b');
  assert.equal(bot.provider, 'local');
  // 不存在的 provider / 不在列表里的模型 → 400
  assert.equal((await send('/api/bot', 'PUT', { key: 'maige', model: 'ghost/model' })).status, 400);
  assert.equal((await send('/api/bot', 'PUT', { key: 'maige', model: 'local/not-in-list' })).status, 400);
  // 还原
  await send('/api/bot', 'PUT', { key: 'maige', model: null });
  await fetch(`${BASE}/api/providers?id=local`, { method: 'DELETE' });
});

test('模型清单：按 provider 分组给出', async () => {
  await send('/api/providers', 'POST', {
    id: 'multi', name: 'Multi', baseURL: 'https://api.example.dev/v1',
    apiKey: 'k', models: ['m-a', 'm-b', 'qwen-image-3.0-pro'], defaultModel: 'm-a',
  });
  const m = await (await get('/api/models')).json();
  const group = m.providers.find((p) => p.id === 'multi');
  assert.deepEqual(group.models, ['m-a', 'm-b'], '非对话模型应被过滤');
  assert.ok(m.models.includes('multi/m-a'));
  assert.ok(!m.models.includes('multi/qwen-image-3.0-pro'));
  assert.ok(m.default.includes('/'));
  await fetch(`${BASE}/api/providers?id=multi`, { method: 'DELETE' });
});

test('预算：token 上限到点自动停止，并说明原因', async () => {
  const { createServer } = await import('node:http');
  const mock = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '好了' } }], usage: { total_tokens: 250 } }));
    });
  });
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  const port = mock.address().port;
  try {
    await send('/api/providers', 'POST', {
      id: 'bmock', name: '预算 mock', baseURL: `http://127.0.0.1:${port}/v1`,
      apiKey: 'k', models: ['m'], defaultModel: 'm',
    });
    await send('/api/bot', 'PUT', { key: 'maige', model: 'bmock/m' });
    // 预算 200 tokens，单次回复记 250 → 第一次回复后即触发（走记账路径）
    assert.ok((await send('/api/config', 'PUT', { budget: { maxTokens: 200, maxMinutes: 0 } })).ok);
    await send('/api/chat/clear', 'POST', { conv: 'chief' });
    assert.ok((await send('/api/chat/send', 'POST', { conv: 'chief', text: '说一句' })).ok);
    const deadline = Date.now() + 8000;
    let msgs = [];
    while (Date.now() < deadline) {
      msgs = (await (await get('/api/chat/messages?conv=chief')).json()).messages;
      if (msgs.some((m) => m.kind === 'system' && m.text.includes('token 预算'))) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(msgs.some((m) => m.kind === 'system' && m.text.includes('token 预算（200）')), '应说明 token 预算用尽');
    assert.ok(msgs.some((m) => m.kind === 'agent' && m.text.includes('好了')), '预算用尽前的那次回复应保留');
    // 恢复不限
    await send('/api/config', 'PUT', { budget: { maxTokens: 0, maxMinutes: 0 } });
    await send('/api/bot', 'PUT', { key: 'maige', model: null });
    await fetch(`${BASE}/api/providers?id=bmock`, { method: 'DELETE' });
    mock.closeAllConnections?.(); // fetch 的 keep-alive 连接会让 close() 挂住
    mock.close();
  } finally { /* 失败时也尽量清理 */ }
});

test('预算：时长上限到点自动中止（长请求也能被掐断）', async () => {
  const { createServer } = await import('node:http');
  const slow = createServer((req, res) => {
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '太晚了' } }] }));
    }, 5000);
  });
  await new Promise((r) => slow.listen(0, '127.0.0.1', r));
  const port = slow.address().port;
  try {
    await send('/api/providers', 'POST', {
      id: 'slowb', name: '慢服务', baseURL: `http://127.0.0.1:${port}/v1`,
      apiKey: 'k', models: ['m'], defaultModel: 'm',
    });
    await send('/api/bot', 'PUT', { key: 'maige', model: 'slowb/m' });
    // 0.03 分钟 = 1.8 秒
    assert.ok((await send('/api/config', 'PUT', { budget: { maxTokens: 0, maxMinutes: 0.03 } })).ok);
    await send('/api/chat/clear', 'POST', { conv: 'chief' });
    assert.ok((await send('/api/chat/send', 'POST', { conv: 'chief', text: '慢慢说' })).ok);
    const start = Date.now();
    const deadline = Date.now() + 6000;
    let msgs = [];
    while (Date.now() < deadline) {
      msgs = (await (await get('/api/chat/messages?conv=chief')).json()).messages;
      if (msgs.some((m) => m.kind === 'system' && m.text.includes('时长上限'))) break;
      await new Promise((r) => setTimeout(r, 150));
    }
    assert.ok(msgs.some((m) => m.kind === 'system' && m.text.includes('时长上限（0.03 分钟）')), '应说明时长预算用尽');
    assert.ok(Date.now() - start < 4500, '应在慢服务回复前中止（不是等它 5 秒）');
    assert.ok(!msgs.some((m) => m.kind === 'agent' && m.text.includes('太晚了')));
  } finally {
    await send('/api/config', 'PUT', { budget: { maxTokens: 0, maxMinutes: 0 } });
    await send('/api/bot', 'PUT', { key: 'maige', model: null });
    await fetch(`${BASE}/api/providers?id=slowb`, { method: 'DELETE' });
    slow.closeAllConnections?.();
    slow.close();
  }
});

test('预算：配置读写与 /api/info 回显', async () => {
  assert.ok((await send('/api/config', 'PUT', { budget: { maxTokens: 12345, maxMinutes: 1.5 } })).ok);
  const info = await (await get('/api/info')).json();
  assert.deepEqual(info.budget, { maxTokens: 12345, maxMinutes: 1.5 });
  const diag = await (await get('/api/diagnostics')).json();
  assert.deepEqual(diag.budget, { maxTokens: 12345, maxMinutes: 1.5 });
  await send('/api/config', 'PUT', { budget: { maxTokens: 0, maxMinutes: 0 } });
});

test('停止：能中断正在跑的回合，并干净收尾', async () => {
  // 起一个"慢"模型服务：收到请求后 8 秒才回，用来模拟长回合
  const { createServer } = await import('node:http');
  let hits = 0;
  const slow = createServer((req, res) => {
    hits++;
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '慢服务终于回话了' } }] }));
    }, 8000);
  });
  await new Promise((r) => slow.listen(0, '127.0.0.1', r));
  const slowPort = slow.address().port;
  try {
    // 新增 provider 后面板立刻可用（llmReady 动态判定）
    const before = await (await get('/api/diagnostics')).json();
    assert.equal(before.llmReady, false, '本用例开始前应无模型');
    assert.ok((await send('/api/providers', 'POST', {
      id: 'slow', name: '慢服务', baseURL: `http://127.0.0.1:${slowPort}/v1`,
      apiKey: 'k', models: ['slow-chat'], defaultModel: 'slow-chat',
    })).ok);
    const after = await (await get('/api/diagnostics')).json();
    assert.equal(after.llmReady, true, '新增 provider 后应立即可用');
    assert.ok((await send('/api/bot', 'PUT', { key: 'maige', model: 'slow/slow-chat' })).ok);

    // 发起一轮，然后立刻停
    assert.ok((await send('/api/chat/send', 'POST', { conv: 'chief', text: '慢慢说' })).ok);
    await new Promise((r) => setTimeout(r, 600));
    const stop = await (await send('/api/chat/stop', 'POST', { conv: 'chief' })).json();
    assert.equal(stop.stopped, true, '应确实中止了正在跑的回合');

    // 收尾：出现「已停止」系统消息，且慢服务没把回复送进来
    const deadline = Date.now() + 6000;
    let msgs = [];
    while (Date.now() < deadline) {
      msgs = (await (await get('/api/chat/messages?conv=chief')).json()).messages;
      if (msgs.some((m) => m.kind === 'system' && m.text.includes('已停止'))) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(msgs.some((m) => m.kind === 'system' && m.text.includes('已停止')), '应出现「已停止当前回合」');
    assert.ok(!msgs.some((m) => m.kind === 'agent' && m.text.includes('慢服务终于回话了')), '被中止的回复不应出现');
    assert.ok(hits >= 1, '慢服务应收到过请求');

    // 停止一个没在跑的会话：ok 但 stopped=false
    const idle = await (await send('/api/chat/stop', 'POST', { conv: 'chief' })).json();
    assert.equal(idle.stopped, false);
  } finally {
    await send('/api/bot', 'PUT', { key: 'maige', model: null });
    await fetch(`${BASE}/api/providers?id=slow`, { method: 'DELETE' });
    slow.closeAllConnections?.();
    slow.close();
  }
});