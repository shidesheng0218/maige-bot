// 角色 → 输出上限分档（纯函数）：新 bot 入职时按职责关键词自动取档。

export const MAX_TOKENS_LIMIT = 1000000;
export const DEFAULT_MAX_TOKENS = 4000;

export const ROLE_MAX_TOKENS = [
  { match: /写|文案|编剧|歌词|脚本|创作|成文/, tokens: 200000 },
  { match: /技术|代码|工程|开发|架构/, tokens: 50000 },
  { match: /主管|chief|收口|总结/, tokens: 8000 },
  { match: /评审|挑刺|压力测试|审/, tokens: 4000 },
  { match: /视觉|分镜|画面|美术|设计/, tokens: 4000 },
  { match: /查证|调研|搜索|溯源|研究/, tokens: 2000 },
  { match: /记录|纪要|归档|备忘/, tokens: 2000 },
];

export function maxTokensForRole(role) {
  const text = String(role || '');
  for (const r of ROLE_MAX_TOKENS) {
    if (r.match.test(text)) return r.tokens;
  }
  return DEFAULT_MAX_TOKENS;
}