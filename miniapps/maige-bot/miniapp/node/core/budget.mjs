// 回合预算：用户可配的每回合 token / 时长上限。0 表示不限。
// 纯函数，便于单测；单位：maxTokens = tokens，maxMinutes = 分钟（可为小数）。

export const BUDGET_LIMITS = {
  maxTokens: 10_000_000,
  maxMinutes: 240,
};

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** 规范化预算：面板配置优先，其次环境变量，最后 0（不限） */
export function normalizeBudget(raw, env = {}) {
  const maxTokens = Math.min(
    BUDGET_LIMITS.maxTokens,
    Math.round(num(raw?.maxTokens, num(env.MAIGE_TURN_MAX_TOKENS, 0))),
  );
  const maxMinutes = Math.min(
    BUDGET_LIMITS.maxMinutes,
    num(raw?.maxMinutes, num(env.MAIGE_TURN_MAX_MINUTES, 0)),
  );
  return { maxTokens, maxMinutes };
}

/** 预算是否已用尽：返回 'tokens' | 'time' | null。used = { tokens, elapsedMs } */
export function budgetExceeded(budget, used) {
  if (!budget) return null;
  if (budget.maxTokens > 0 && used.tokens >= budget.maxTokens) return 'tokens';
  if (budget.maxMinutes > 0 && used.elapsedMs >= budget.maxMinutes * 60000) return 'time';
  return null;
}

/** 本次调用可用的 max_tokens：既是 bot 的单条上限，又不超过回合预算剩余量。
 *  返回 0 表示剩余预算已不足以发起调用。 */
export function effectiveMaxTokens(botLimit, budget, usedTokens) {
  if (!budget || budget.maxTokens <= 0) return botLimit || undefined;
  const remaining = budget.maxTokens - usedTokens;
  if (remaining < 128) return 0;
  return botLimit ? Math.min(botLimit, remaining) : remaining;
}

/** 给用户看的原因文案（中文；面板侧按语言再包装也可） */
export function budgetReasonText(reason, budget) {
  if (reason === 'tokens') return `已达本回合 token 预算（${budget.maxTokens}），自动停止。可在设置里调整。`;
  if (reason === 'time') return `已达本回合时长上限（${budget.maxMinutes} 分钟），自动停止。可在设置里调整。`;
  return '已停止当前回合。';
}