import { cli, Strategy } from '@jackwener/opencli/registry';

cli({
  site: 'shinnku',
  name: 'search',
  description: '搜索 shinnku.com（真红小站）的 Galgame 资源。返回文件名、大小、CDN直链、版本类别。',
  domain: 'www.shinnku.com',
  strategy: Strategy.COOKIE,
  access: 'read',
  args: [
    { name: 'query', positional: true, required: true, help: '搜索关键词（支持中文/日文/英文）' },
    { name: 'limit', type: 'int', default: 20, help: '最大结果数 (1-100)' },
  ],
  columns: ['name', 'size', 'category', 'path', 'cdn_url', 'detail_url'],

  func: async (browser, kwargs) => {
    const { query, limit = 20 } = kwargs;
    const encoded = encodeURIComponent(query);

    // Navigate to search page
    await browser.goto(`https://www.shinnku.com/search?q=${encoded}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Wait for results to render
    await new Promise((r) => setTimeout(r, 3000));

    // Extract results from DOM
    const results = await browser.evaluate((max) => {
      const cards = document.querySelectorAll('.bg-card');
      const items = [];

      for (const card of cards) {
        if (items.length >= max) break;

        const link = card.querySelector('a[href*="/files/"]');
        if (!link) continue;

        const name = link.textContent.trim();
        const href = link.getAttribute('href') || '';

        // Category tag: <span class="pr-2">熟肉</span>
        const tagSpan = card.querySelector('span.pr-2');
        const category = tagSpan ? tagSpan.textContent.trim() : '';

        // Size: span.pr-2's parent textContent minus the category tag
        let size = '';
        if (tagSpan && tagSpan.parentElement) {
          const full = tagSpan.parentElement.textContent.trim();
          const sizeText = full.replace(category, '').trim();
          const sizeMatch = sizeText.match(/([\d.]+\s*(?:GB|MB|TB|KB))/i);
          size = sizeMatch ? sizeMatch[1] : sizeText;
        }

        // Construct CDN URL from file path
        let cdnUrl = '';
        if (href.startsWith('/files/shinnku/')) {
          // 熟肉: /files/shinnku/zd/... or /files/shinnku/0/win/...
          // CDN: https://zd.shinnku.top/file/shinnku/...
          const filePath = href.replace('/files/', '');
          cdnUrl = `https://zd.shinnku.top/file/${filePath}`;
        } else if (href.startsWith('/files/galgame0/')) {
          // 生肉: need to visit detail page for real CDN, skip for now
          cdnUrl = '';
        }

        items.push({
          name,
          size: size || '?',
          category: category || '未知',
          path: href,
          cdn_url: cdnUrl,
          detail_url: `https://www.shinnku.com${href}`,
        });
      }

      return items;
    }, limit);

    return results;
  },
});
