// HTTP 小工具：JSON 响应、错误、带大小上限的 body 读取。

export function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

export function sendError(res, status, code) {
  sendJson(res, status, { error: code });
}

export async function readBody(req, limit = 256 * 1024) {
  let body = '';
  for await (const chunk of req) body += chunk;
  if (body.length > limit) throw new Error('payload_too_large');
  return body ? JSON.parse(body) : {};
}