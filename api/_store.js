// Kalıcı depo: Upstash Redis (Vercel'de "Storage" bölümünden ücretsiz eklenir). REST ile konuşur, ek paket gerekmez.
// Vercel'in eklediği değişkenlerin adı seçilen ön eke göre değişir (KV_..., STORAGE_..., UPSTASH_...); hepsi aranır. Salt-okunur anahtar kullanılmaz.
const pick = (re) => { const k = Object.keys(process.env).find((x) => re.test(x) && !/READ_ONLY/.test(x) && process.env[x]); return k ? process.env[k] : ''; };
const base = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || pick(/REST_API_URL$|REST_URL$/);
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || pick(/REST_API_TOKEN$|REST_TOKEN$/);
const configured = () => !!(base() && token());
async function cmd(...args) {
  const r = await fetch(base(), { method: 'POST', headers: { authorization: 'Bearer ' + token(), 'content-type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Depo: ' + (j.error || r.status));
  return j.result;
}
const P = 'kp:';
module.exports = {
  configured,
  async getJson(k) { const v = await cmd('GET', P + k); return v ? JSON.parse(v) : null; },
  async setJson(k, v, ttl) { return ttl ? cmd('SET', P + k, JSON.stringify(v), 'EX', ttl) : cmd('SET', P + k, JSON.stringify(v)); },
  async del(k) { return cmd('DEL', P + k); },
  async sadd(k, m) { return cmd('SADD', P + k, m); },
  async srem(k, m) { return cmd('SREM', P + k, m); },
  async smembers(k) { return (await cmd('SMEMBERS', P + k)) || []; },
  async scard(k) { return cmd('SCARD', P + k); },
  async mgetJson(keys) { if (!keys.length) return []; return ((await cmd('MGET', ...keys.map((k) => P + k))) || []).map((v) => (v ? JSON.parse(v) : null)); },
  async rpush(k, v) { return cmd('RPUSH', P + k, JSON.stringify(v)); },
  async ltrim(k, a, b) { return cmd('LTRIM', P + k, a, b); },
  async expire(k, s) { return cmd('EXPIRE', P + k, s); },
  async lall(k) { return ((await cmd('LRANGE', P + k, 0, -1)) || []).map((v) => JSON.parse(v)); },
};
