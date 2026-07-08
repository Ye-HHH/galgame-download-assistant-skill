import { cli, Strategy } from '@jackwener/opencli/registry';

const SITE = 'https://www.singureo.com';
const OSS = 'https://pan.singureo.com';

function fmtSize(bytes) {
  if (!bytes || bytes === 0) return '-';
  const u = ['B', 'K', 'M', 'G', 'T'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + u[i];
}

cli({
  site: 'singureo',
  name: 'search',
  description: '搜索 singureo.com → OSS(Alist) 获取 CDN 直链。',
  domain: 'www.singureo.com',
  strategy: Strategy.COOKIE,
  access: 'read',
  args: [
    { name: 'query', positional: true, required: true, help: '搜索关键词' },
    { name: 'limit', type: 'int', default: 5, help: '最大结果数' },
  ],
  columns: ['slug', 'title', 'category', 'downloads', 'detail_url'],

  func: async (browser, kwargs) => {
    const { query, limit = 5 } = kwargs;

    // Stay on singureo.com for the entire flow
    await browser.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Run everything in ONE browser.evaluate from singureo.com context
    const results = await browser.evaluate(
      async ({ site, oss, q, max }) => {
        // ---- search ----
        const idxRes = await fetch(`${site}/search-index.json`);
        const idxData = await idxRes.json();
        const ql = q.toLowerCase();
        const matches = [];
        for (const item of idxData.items || []) {
          const t = (item.title || '').toLowerCase();
          const d = (item.description || '').toLowerCase();
          if (t.includes(ql) || d.includes(ql)) {
            matches.push({ slug: item.slug, title: item.title || '', categories: item.categories || [] });
            if (matches.length >= max) break;
          }
        }
        if (!matches.length) return [];

        const results = [];

        for (const item of matches) {
          // ---- get OSS folder from game page ----
          const pageRes = await fetch(`${site}/posts/${item.slug}/`);
          const html = await pageRes.text();
          const re = /\/go\?url=([A-Za-z0-9+\/=]+)/g;
          let folderPath = '';
          let m;
          while ((m = re.exec(html)) !== null) {
            const url = decodeURIComponent(atob(m[1]));
            if (url.startsWith(`${oss}/OSS/`) && !url.includes('模拟器')) {
              folderPath = url.replace(oss, '');
              break;
            }
          }
          if (!folderPath) continue;

          // ---- list files via Alist API (cross-origin, but Alist allows it) ----
          const listRes = await fetch(`${oss}/api/fs/list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: folderPath, password: '' }),
          });
          const listData = await listRes.json();
          if (listData.code !== 200) continue;

          const files = (listData.data?.content || []).filter((f) => !f.is_dir);
          if (!files.length) continue;

          // ---- get CDN raw_url for each file ----
          const downloads = [];
          for (const f of files.slice(0, 10)) {
            const fullPath = folderPath + '/' + f.name;
            try {
              const getRes = await fetch(`${oss}/api/fs/get`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: fullPath, password: '' }),
              });
              const getData = await getRes.json();
              const rawUrl = getData.code === 200 ? getData.data?.raw_url || '' : '';
              downloads.push({
                name: f.name,
                size: f.size ? (f.size / 1073741824).toFixed(2) + 'GB' : '?',
                size_bytes: f.size || 0,
                cdn_url: rawUrl,
              });
            } catch {
              // skip failed file
            }
          }

          if (downloads.length) {
            results.push({
              slug: item.slug,
              title: item.title,
              category: (item.categories || []).join(', '),
              downloads,
              detail_url: `${site}/posts/${item.slug}/`,
            });
          }
        }

        return results;
      },
      { site: SITE, oss: OSS, q: query, max: limit }
    );

    return results;
  },
});
