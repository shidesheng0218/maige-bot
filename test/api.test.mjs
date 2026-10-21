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