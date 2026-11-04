// 敏感记忆硬门：密码 / 密钥 / token / 证件号一律不落盘（代码层，不依赖模型自觉）。
// 纯函数，便于单测。只拦「像凭据/证件」的内容，避免误伤日常偏好。

const HARD_PATTERNS = [
  // 密码 / 口令：必须带「是/为/:/：/=」这类赋值语义，避免误伤「密码管理器很好用」
  /(?:密码|口令|password|passwd|pwd)\s*(?:是|为|[:：=])\s*\S+/i,
  // 密钥 / token / secret 的赋值形态
  /(?:api[_\s-]?key|apikey|access[_\s-]?key|secret|token|私钥|密钥)\s*(?:是|为|[:：=])\s*[^\s，。；,;]{4,}/i,
  // 常见凭据格式（不需要上下文也能判定）
  /\bsk-[A-Za-z0-9_-]{8,}\b/,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  // 中国身份证（18 位，末位可为 X）
  /\b\d{17}[\dXx]\b/,
  // 证件 / 银行卡：关键词后跟一长串数字
  /(?:身份证|证件号|银行卡|信用卡|卡号|护照号)\D{0,12}\d{6,}/,
];

/** 是否命中硬门（命中即永不写入、永不注入） */
export function isHardSensitive(text) {
  const s = String(text ?? '');
  if (!s.trim()) return false;
  return HARD_PATTERNS.some((re) => re.test(s));
}