// Web Push (VAPID) gönderimi: ek paket olmadan, Node'un kendi şifreleme kütüphanesiyle.
// İçeriksiz ("boş") bildirim gönderilir; asıl metni servis çalışanı sunucudan alır. Böylece mesaj push servisine hiç gitmez.
const crypto = require('crypto');
const b64u = (b) => Buffer.from(b).toString('base64url');
const pub = () => process.env.VAPID_PUBLIC || '';
const priv = () => process.env.VAPID_PRIVATE || '';
const configured = () => { try { return Buffer.from(pub(), 'base64url').length === 65 && Buffer.from(priv(), 'base64url').length === 32; } catch (e) { return false; } };
function keyObject() {
  const p = Buffer.from(pub(), 'base64url');
  return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(p.subarray(1, 33)), y: b64u(p.subarray(33, 65)), d: priv() }, format: 'jwk' });
}
function jwt(aud, subject) {
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' })), body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: keyObject(), dsaEncoding: 'ieee-p1363' });
  return head + '.' + body + '.' + b64u(sig);
}
// Yalnızca bilinen push servislerine gönderilir (sunucu rastgele adrese istek atmasın diye).
const HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
function okEndpoint(u) {
  try {
    const x = new URL(u);
    if (process.env.PUSH_ALLOW_LOCAL === '1' && /^(127\.0\.0\.1|localhost)$/.test(x.hostname)) return true;
    return x.protocol === 'https:' && !x.port && HOSTS.some((r) => r.test(x.hostname)) && u.length < 600;
  } catch (e) { return false; }
}
const subjectOf = (host) => process.env.VAPID_SUBJECT || 'https://' + (host || 'kripto-pusula.vercel.app');
// { ok, status, gone }: gone = abonelik artık geçersiz, silinmeli.
async function send(endpoint, host) {
  if (!configured() || !okEndpoint(endpoint)) return { ok: false, status: 0, gone: false };
  const aud = new URL(endpoint).origin;
  try {
    const r = await fetch(endpoint, { method: 'POST', headers: { authorization: `vapid t=${jwt(aud, subjectOf(host))}, k=${pub()}`, ttl: '86400', urgency: 'high', 'content-length': '0' }, signal: AbortSignal.timeout(10000) });
    return { ok: r.status >= 200 && r.status < 300, status: r.status, gone: r.status === 404 || r.status === 410 };
  } catch (e) { return { ok: false, status: 0, gone: false }; }
}
const idOf = (endpoint) => crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 32);
// Yeni anahtar çifti üretir (bir kez, kurulumda).
function generate() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const j = publicKey.export({ format: 'jwk' }), d = privateKey.export({ format: 'jwk' }).d;
  return { VAPID_PUBLIC: b64u(Buffer.concat([Buffer.from([4]), Buffer.from(j.x, 'base64url'), Buffer.from(j.y, 'base64url')])), VAPID_PRIVATE: d };
}
module.exports = { configured, send, okEndpoint, idOf, generate, jwt, pub };
