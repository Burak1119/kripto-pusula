// Haberler: herkese açık RSS yayınlarını toplar. Anahtar gerekmez.
const FEEDS = [
  ['CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'],
  ['Cointelegraph', 'https://cointelegraph.com/rss'],
  ['Cointelegraph TR', 'https://tr.cointelegraph.com/rss'],
  ['Decrypt', 'https://decrypt.co/feed'],
  ['The Block', 'https://www.theblock.co/rss.xml'],
];
const TTL = 5 * 60 * 1000;
let cache = null;

const unwrap = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#8217;/g, '’').replace(/&#8216;/g, '‘');
const tag = (block, name) => {
  const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>', 'i'));
  return m ? decode(unwrap(m[1]).replace(/<[^>]+>/g, '')).trim() : '';
};

async function readFeed([source, url]) {
  const r = await fetch(url, { headers: { 'user-agent': 'KriptoPusula/1.0', accept: 'application/rss+xml, text/xml' } });
  if (!r.ok) throw new Error(source + ' ' + r.status);
  const xml = await r.text();
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  return items.slice(0, 15).map((it) => {
    const link = tag(it, 'link');
    const date = Date.parse(tag(it, 'pubDate')) || Date.now();
    return { title: tag(it, 'title'), link, source, date };
  }).filter((n) => n.title && /^https?:\/\//.test(n.link));
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=600');
  if (!cache || Date.now() - cache.ts > TTL) {
    const results = await Promise.allSettled(FEEDS.map(readFeed));
    const news = results.filter((x) => x.status === 'fulfilled').flatMap((x) => x.value)
      .sort((a, b) => b.date - a.date).slice(0, 80);
    if (news.length || !cache) cache = { ts: Date.now(), news };
  }
  res.end(JSON.stringify({ updated: cache.ts, news: cache.news }));
};
