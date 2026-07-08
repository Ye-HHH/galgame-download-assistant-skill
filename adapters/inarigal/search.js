import { cli, Strategy } from '@jackwener/opencli/registry';

const API_BASE = 'https://api.gscsm.com.cname1541.yjs-cdn.com';
const SITE_BASE = 'https://inarigal.com';

cli({
  site: 'inarigal',
  name: 'search',
  description: '搜索 inarigal.com（稻荷GAL）。返回游戏信息+下载代理链接。CDN 直链需 Phase 4 逐个访问（防限流）。',
  domain: 'inarigal.com',
  strategy: Strategy.COOKIE,
  access: 'read',
  args: [
    { name: 'query', positional: true, required: true, help: '搜索关键词' },
    { name: 'limit', type: 'int', default: 5, help: '最大结果数' },
  ],
  columns: ['id', 'title_cn', 'title_jp', 'developer', 'downloads', 'detail_url'],

  func: async (browser, kwargs) => {
    const { query, limit = 5 } = kwargs;

    // Step 1: Search
    const searchResults = await browser.evaluate(async (url) => {
      const res = await fetch(url);
      const data = await res.json();
      return data.data?.list || [];
    }, `${API_BASE}/api/search?keywords=${encodeURIComponent(query)}&page=1`);

    if (!searchResults.length) return [];

    // Step 2: Get details
    const topGames = searchResults.slice(0, limit);
    const gameDetails = await browser.evaluate(async (params) => {
      const { apiBase, siteBase, games } = params;

      const results = [];
      for (const game of games) {
        try {
          const detailRes = await fetch(`${apiBase}/api/pages/detail`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: game.id }),
          });
          const detailData = await detailRes.json();
          const downloads = detailData.data?.downloads || {};

          const allDownloads = [];
          for (const cat of [
            { key: 'translated', label: '汉化' },
            { key: 'ai_translated', label: 'AI汉化' },
            { key: 'original', label: '生肉' },
            { key: 'patch', label: '补丁' },
          ]) {
            for (const dl of downloads[cat.key] || []) {
              allDownloads.push({
                title: dl.resource_title || '',
                type: cat.label,
                size: dl.size || '',
                is_pc: dl.is_pc,
                proxy_url: dl.download_url
                  ? `${siteBase}${dl.download_url}`
                  : '',
                password: dl.unzip_password || '',
                uploader: dl.uploader_name || '',
              });
            }
          }

          results.push({
            id: game.id,
            title_cn: game.title_cn || '',
            title_jp: game.title_jp || '',
            developer: (game.developer_name || []).join(', '),
            downloads: allDownloads,
            detail_url: `${siteBase}/detail/${game.id}`,
          });
        } catch {
          results.push({
            id: game.id,
            title_cn: game.title_cn || '',
            title_jp: game.title_jp || '',
            developer: (game.developer_name || []).join(', '),
            downloads: [],
            detail_url: `${siteBase}/detail/${game.id}`,
          });
        }
      }
      return results;
    }, { apiBase: API_BASE, siteBase: SITE_BASE, games: topGames });

    return gameDetails;
  },
});
