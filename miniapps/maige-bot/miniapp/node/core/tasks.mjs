// 整活单（任务）状态机与 .md 序列化（纯逻辑，便于单测）。

import { parseAgentFrontmatter } from './parse.mjs';

// draft 待确认 → ready 提示词就绪 → making 制作中 → done 已交付；cancelled 可复活到 draft
export const TASK_TRANSITIONS = {
  draft: ['ready', 'cancelled'],
  ready: ['making', 'draft', 'cancelled'],
  making: ['done', 'ready', 'cancelled'],
  done: [],
  cancelled: ['draft'],
};
export const TASK_KINDS = ['image', 'video', 'audio', 'text'];
// 非敏感任务类型：开单后免确认直通 ready；video/audio 成本高，保留人工确认闸
export const AUTO_READY_KINDS = ['image', 'text'];

export function serializeTask(t) {
  const esc = (v) => String(v ?? '').replace(/\r?\n/g, ' ').trim();
  return [
    '---',
    `id: ${esc(t.id)}`,
    `title: ${esc(t.title)}`,
    `kind: ${TASK_KINDS.includes(t.kind) ? t.kind : 'text'}`,
    `status: ${TASK_TRANSITIONS[t.status] ? t.status : 'draft'}`,
    `created: ${esc(t.created)}`,
    `updated: ${esc(t.updated)}`,
    `createdBy: ${esc(t.createdBy || 'user')}`,
    `assignee: ${esc(t.assignee || '')}`,
    `conv: ${esc(t.conv || '')}`,
    `deliverables: ${(t.deliverables || []).map(esc).join(', ')}`,
    '---',
    '',
    String(t.body ?? '').trim(),
    '',
  ].join('\n');
}

export function parseTask(fileName, raw) {
  const fm = parseAgentFrontmatter(raw);
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
  return {
    id: fm.id || fileName.replace(/\.md$/, ''),
    title: fm.title || fileName.replace(/\.md$/, ''),
    kind: TASK_KINDS.includes(fm.kind) ? fm.kind : 'text',
    status: TASK_TRANSITIONS[fm.status] ? fm.status : 'draft',
    created: fm.created || '',
    updated: fm.updated || '',
    createdBy: fm.createdby || 'user',
    assignee: fm.assignee || '',
    conv: fm.conv || '',
    deliverables: fm.deliverables ? fm.deliverables.split(',').map((s) => s.trim()).filter(Boolean) : [],
    body,
  };
}