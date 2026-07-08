import { cli, Strategy } from '@jackwener/opencli/registry';

cli({
  site: 'mihoyo',
  name: 'search',
  description: '搜索 mihoyo.ink（柚哩遊戲分享站）的 Galgame 资源。返回文件名、大小、CDN直链、解压密码。',
  domain: 'mihoyo.ink',
  strategy: Strategy.COOKIE,
  access: 'read',
  args: [
    { name: 'query', positional: true, required: true, help: '搜索关键词（支持中文/日文/英文）' },
    { name: 'limit', type: 'int', default: 20, help: '最大结果数 (1-100)' },
    { name: 'page', type: 'int', default: 1, help: '页码' },
    { name: 'scope', type: 'int', default: 0, help: '搜索范围: 0=全部, 1=当前目录' },
  ],
  columns: ['name', 'size', 'size_bytes', 'type', 'path', 'raw_url', 'download_url', 'password', 'source', 'modified'],

  func: async (browser, kwargs) => {
    const { query, limit = 20, page = 1, scope = 0 } = kwargs;

    // Navigate to establish browser session (bypasses Cloudflare)
    await browser.goto('https://mihoyo.ink/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Run everything in browser context — the API is public but Cloudflare
    // prefers browser TLS fingerprints over raw Node.js fetch.
    const results = await browser.evaluate(async (params) => {
      const { query, limit, page, scope } = params;

      // ---- helpers (must be defined inside evaluate) ----

      function formatSize(bytes) {
        if (!bytes || bytes === 0) return '-';
        const units = ['B', 'K', 'M', 'G', 'T'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(2) + units[i];
      }

      function getPassword(parent, name) {
        if (!parent) return '';
        // 柚哩Gal and 南+合集 all use south-plus
        if (parent.includes('柚哩Gal') || parent.includes('南+合集')) {
          return 'south-plus';
        }
        // 终点汉化 has its own password — check filename for hints
        if (parent.includes('终点汉化')) {
          const m = name.match(/[（(](.+?)[）)]/);
          return m ? m[1] : '(终点密码，见文件名括号)';
        }
        // 梓澪の妙妙屋 生肉/补丁区 no password
        if (parent.includes('梓澪の妙妙屋')) {
          if (parent.includes('浮士德') || parent.includes('合集系列')) return '';
          if (parent.includes('补 丁') || parent.includes('补丁')) return '';
        }
        return '';
      }

      function getSource(parent) {
        if (!parent) return 'unknown';
        if (parent.includes('GAL仓库')) return '柚哩Gal';
        if (parent.includes('梓澪の妙妙屋')) return '梓澪の妙妙屋';
        if (parent.includes('南+合集')) return '南+合集';
        return 'other';
      }

      // ---- Step 1: search ----

      const searchRes = await fetch('https://mihoyo.ink/api/fs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent: '/',
          keywords: query,
          scope: scope,
          page: page,
          per_page: Math.min(limit, 100),
          password: '',
        }),
      });

      const searchData = await searchRes.json();
      if (searchData.code !== 200) {
        throw new Error('Search API error: ' + searchData.message);
      }

      const items = searchData.data.content;
      if (!items || items.length === 0) return [];

      // ---- Step 2: fetch raw_url in parallel batches (max 5 concurrent) ----

      async function fetchRawUrl(fullPath) {
        try {
          const res = await fetch('https://mihoyo.ink/api/fs/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: fullPath, password: '' }),
          });
          const data = await res.json();
          return (data.code === 200 && data.data && data.data.raw_url)
            ? data.data.raw_url
            : '';
        } catch {
          return '';
        }
      }

      async function batchFetch(paths, concurrency = 5) {
        const results = new Array(paths.length);
        let idx = 0;

        async function worker() {
          while (idx < paths.length) {
            const i = idx++;
            results[i] = await fetchRawUrl(paths[i]);
          }
        }

        await Promise.all(
          Array.from({ length: Math.min(concurrency, paths.length) }, () => worker())
        );
        return results;
      }

      // Collect file paths (skip directories)
      const filePaths = items
        .filter((item) => !item.is_dir)
        .map((item) => item.parent + '/' + item.name);

      // Batch-fetch all raw_urls
      const rawUrls = await batchFetch(filePaths, 5);

      // ---- Step 3: build output ----

      let urlIdx = 0;
      return items.map((item) => {
        const fullPath = item.parent + '/' + item.name;
        const encodedPath = encodeURIComponent(fullPath).replace(/%2F/g, '/');
        const rawUrl = item.is_dir ? '' : (rawUrls[urlIdx++] || '');

        return {
          name: item.name,
          size: formatSize(item.size),
          size_bytes: item.size,
          type: item.is_dir ? 'dir' : 'file',
          path: fullPath,
          raw_url: rawUrl,
          download_url: 'https://mihoyo.ink/d' + fullPath,
          password: getPassword(item.parent, item.name),
          source: getSource(item.parent),
          modified: item.modified || '',
        };
      });
    }, { query, limit, page, scope });

    return results;
  },
});
