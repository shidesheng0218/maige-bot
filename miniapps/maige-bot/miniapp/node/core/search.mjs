// 联网搜索 provider 层：可插拔多源 + 健康度降权。纯逻辑，无 I/O 副作用，便于单测。
//
// 设计：搜索引擎分两层——
//  · 免费层（无 key）：必应 / 搜狗 / DuckDuckGo 刮 HTML，作为兜底；
//  · API 层（用户在设置页填 key 启用）：Tavily / Brave / Bing Web Search。
// 两层都实现同一接口 { id, name, search(query) → items }。健康度追踪每个源的连续失败次数，
// 失败多的自动降权；状态暴露给 /api/diagnostics。

export const HTTP_URL = /^https?:\/\//i;

/** 清洗 HTML 标签为纯文本 */
export function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

// ---------- 免费层（刮 HTML，无需 key） ----------

export const FREE_ENGINES = [
  {
    id: 'bing', name: '必应', kind: 'free',
    url: (q) => 'https://cn.bing.com/search?q=' + encodeURIComponent(q) + '&mkt=zh-CN',
    parse(html) {
      const items = [];
      for (const b of html.match(/<li class="b_algo"[\s\S]*?<\/li>/g) || []) {
        const m = b.match(/<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        if (!m) continue;
        const p = b.match(/<p[^>]*>([\s\S]*?)<\/p>/);
        items.push({ title: stripHtml(m[2]), url: m[1], snippet: p ? stripHtml(p[1]).slice(0, 160) : '' });
        if (items.length >= 5) break;
      }
      return items;
    },
  },
  {
    id: 'sogou', name: '搜狗', kind: 'free',
    url: (q) => 'https://www.sogou.com/web?query=' + encodeURIComponent(q),
    parse(html, base) {
      const items = [];
      for (const b of html.match(/<h3[^>]*class="vr-title"[\s\S]*?<\/h3>/g) || []) {
        const m = b.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        if (!m) continue;
        let url = m[1];
        if (url.startsWith('/')) url = new URL(url, base).href; // 搜狗跳转链接
        items.push({ title: stripHtml(m[2]), url, snippet: '' });
        if (items.length >= 5) break;
      }
      return items;
    },
  },
  {
    id: 'ddg', name: 'DuckDuckGo', kind: 'free',
    url: (q) => 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q),
    parse(html) {
      const items = [];
      for (const b of html.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g) || []) {
        const m = b.match(/href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        if (!m) continue;
        items.push({ title: stripHtml(m[2]), url: m[1], snippet: '' });
        if (items.length >= 5) break;
      }
      return items;
    },
  },
];

// ---------- API 层（用户配 key 启用） ----------

export const API_ENGINE_DEFS = {
  tavily: {
    name: 'Tavily',
    // POST https://api.tavily.com/search { api_key, query, max_results }
    async search(query, apiKey, fetchImpl) {
      const r = await fetchImpl('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, query, max_results: 5 }),
      });
      if (!r.ok) throw new Error('tavily_http_' + r.status);
      const j = await r.json().catch(() => null);
      return (j?.results || []).map((x) => ({ title: x.title || '', url: x.url || '', snippet: (x.content || '').slice(0, 160) }));
    },
  },
  brave: {
    name: 'Brave',
    // GET https://api.search.brave.com/res/v1/web/search?q=.. (X-Subscription-Token)
    async search(query, apiKey, fetchImpl) {
      const r = await fetchImpl('https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(query) + '&count=5', {
        headers: { 'x-subscription-token': apiKey, accept: 'application/json' },
      });
      if (!r.ok) throw new Error('brave_http_' + r.status);
      const j = await r.json().catch(() => null);
      return (j?.web?.results || []).map((x) => ({ title: x.title || '', url: x.url || '', snippet: (x.description || '').slice(0, 160) }));
    },
  },
};

/** 规范化一个用户配置的搜索源（白名单化）：{ engine, apiKey } */
export function normalizeSearchProvider(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const engine = String(raw.engine ?? '').trim().toLowerCase();
  if (!API_ENGINE_DEFS[engine]) return null;
  const apiKey = String(raw.apiKey ?? '').trim();
  if (!apiKey) return null;
  return { engine, apiKey };
}

/** 健康度追踪器：每个源记连续失败次数，排序时失败多的降权。纯内存，重启清零。 */
export function createHealthTracker() {
  const fails = new Map(); // id -> 连续失败次数
  return {
    recordSuccess(id) { fails.set(id, 0); },
    recordFailure(id) { fails.set(id, (fails.get(id) || 0) + 1); },
    score(id) { return fails.get(id) || 0; },
    snapshot() { return Object.fromEntries(fails); },
  };
}

/** 查询词项：拉丁词（≥3 字母，去常见停用词/复数）+ CJK 双字组 */
export function queryTerms(query) {
  const s = String(query || '');
  const terms = new Set();
  const STOP = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were', 'has', 'have', 'had',
    'not', 'but', 'you', 'your', 'our', 'their', 'its', 'about', 'into', 'over', 'under', 'after',
    'before', 'launch', 'launched', 'latest', 'news', '2023', '2024', '2025', '2026', '2027',
  ]);
  for (const w of s.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []) {
    if (STOP.has(w)) continue;
    const n = w.replace(/[^a-z0-9]/g, '').replace(/s$/, '');
    if (n.length >= 3) terms.add(n);
  }
  const plain = s.replace(/\s+/g, '');
  for (let i = 0; i < plain.length - 1; i++) {
    const g = plain.slice(i, i + 2);
    if (/[一-鿿]{2}/.test(g)) terms.add(g);
  }
  return terms;
}

/** 搜索结果相关性兜底：必应有时把英文查询拆成词典释义（Product→product_百度百科），
 *  这类"有结果但完全跑题"不能当成搜到了。命中 ≥2 个查询词项才算相关；查询太短时放宽。 */
export function isRelevant(query, items) {
  const terms = queryTerms(query);
  if (!terms.size) return true; // 无法判定时不误杀
  let best = 0;
  for (const it of Array.isArray(items) ? items : []) {
    const hay = `${it?.title || ''} ${it?.snippet || ''}`.toLowerCase();
    let n = 0;
    for (const t of terms) if (hay.includes(t)) n++;
    if (n > best) best = n;
  }
  return best >= Math.min(2, terms.size);
}

/** 组装有序搜索源列表：API 层（有 key 的）在前按健康度排序，免费层在后按健康度排序 */
export function buildEngineOrder(searchProviders, health) {
  const api = [];
  for (const p of Array.isArray(searchProviders) ? searchProviders : []) {
    const n = normalizeSearchProvider(p);
    if (!n) continue;
    const def = API_ENGINE_DEFS[n.engine];
    api.push({ id: 'api:' + n.engine, name: def.name, kind: 'api', apiKey: n.apiKey, def });
  }
  api.sort((a, b) => health.score(a.id) - health.score(b.id));
  const free = [...FREE_ENGINES].sort((a, b) => health.score(a.id) - health.score(b.id));
  return [...api, ...free];
}
