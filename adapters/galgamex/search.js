import { cli, Strategy } from '@jackwener/opencli/registry';

const SITE = 'https://www.galgamex.net';

// galgamex uses Next.js RSC. The "资源下载" tab + download buttons are
// React components. OpenCLI adapter's browser.evaluate() cannot trigger
// React RSC updates (isolated execution context limitation). Use Phase 4
// with opencli browser dl eval which goes through the Chrome extension
// and CAN trigger React events.

cli({
  site: 'galgamex',
  name: 'search',
  description: '搜索 galgamex.net。下载链接需 Phase 4 用 opencli browser dl eval 提取。',
  domain: 'www.galgamex.net',
  strategy: Strategy.COOKIE,
  access: 'read',
  args: [
    { name: 'query', positional: true, required: true, help: '搜索关键词' },
    { name: 'limit', type: 'int', default: 5, help: '最大结果数' },
  ],
  columns: ['id', 'title', 'detail_url'],

  func: async (browser, kwargs) => {
    const { query, limit = 5 } = kwargs;

    await browser.goto(`${SITE}/search?q=${encodeURIComponent(query)}`, {
      waitUntil: 'domcontentloaded', timeout: 15000,
    });
    await new Promise((r) => setTimeout(r, 4000));

    return await browser.evaluate((max) => {
      return Array.from(document.querySelectorAll('a[href*="/game/"]'))
        .filter((a) => a.href.match(/\/game\/[a-z0-9]+/))
        .slice(0, max)
        .map((a) => ({
          id: a.href.split('/game/')[1]?.split(/[?#]/)[0] || '',
          title: a.textContent.trim().replace(/\s+/g, ' '),
          detail_url: a.href,
        }));
    }, limit);
  },
});
