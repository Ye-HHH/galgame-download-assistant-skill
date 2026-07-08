import { cli, Strategy } from '@jackwener/opencli/registry';

const VNDB_API = 'https://api.vndb.org/kana/vn';

cli({
  site: 'galzy',
  name: 'search',
  description: '搜索 galzy.moe（紫缘社）。自动弹窗提取 CDN 直链 + 解压密码。',
  domain: 'galzy.moe',
  strategy: Strategy.COOKIE,
  access: 'read',
  args: [
    { name: 'query', positional: true, required: true, help: '搜索关键词' },
    { name: 'limit', type: 'int', default: 3, help: '最大结果数' },
  ],
  columns: ['vid', 'title', 'developer', 'downloads', 'detail_url'],

  func: async (browser, kwargs) => {
    const { query, limit = 3 } = kwargs;

    // Step 1: Search VNDB
    const vndbRes = await fetch(VNDB_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: ['search', '=', query],
        fields: 'id, title, alttitle, released, developers.name',
        results: limit,
      }),
    });
    const vndbData = await vndbRes.json();
    if (!vndbData.results?.length) return [];

    const results = [];

    // Step 2: Visit each game page, open 分卷 modals, extract CDN links
    for (const vn of vndbData.results) {
      try {
        await browser.goto(`https://galzy.moe/${vn.id}`, {
          waitUntil: 'networkidle2',
          timeout: 20000,
        });
        await new Promise((r) => setTimeout(r, 4000));

        const detail = await browser.evaluate(async () => {
          const allDownloads = [];
          let password = '';

          // Find 分卷 elements (SPANs inside clickable DIVs)
          const folderEls = Array.from(
            document.querySelectorAll('*')
          ).filter((el) => {
            const t = el.textContent.trim();
            return (
              el.children.length === 0 &&
              el.tagName !== 'SCRIPT' &&
              el.tagName !== 'STYLE' &&
              t.includes('分卷') &&
              (t.includes('.rar') || t.includes('.7z') || t.includes('.zip'))
            );
          });

          // Deduplicate
          const seen = new Set();
          const unique = [];
          for (const el of folderEls) {
            const k = el.textContent.trim();
            if (!seen.has(k)) {
              seen.add(k);
              unique.push(el);
            }
          }

          for (const folderEl of unique) {
            // Click grandparent (the cursor-pointer div)
            const clickable = folderEl.parentElement?.parentElement;
            if (!clickable) continue;
            clickable.click();
            await new Promise((r) => setTimeout(r, 2500));

            const dialog = document.querySelector('[role=dialog]');
            if (!dialog) continue;

            // Extract password
            const pwdMatch = dialog.textContent.match(
              /解压密码[：:]\s*([^\s🍚]+)/
            );
            if (pwdMatch?.[1]) password = pwdMatch[1].trim();

            // Intercept clipboard.writeText
            const capturedUrls = [];
            const origWrite =
              navigator.clipboard.writeText.bind(navigator.clipboard);
            navigator.clipboard.writeText = (text) => {
              capturedUrls.push(text);
              return origWrite(text);
            };

            // Click copy buttons (empty button before "下载")
            const btns = Array.from(dialog.querySelectorAll('button'));
            for (let i = 0; i < btns.length - 1; i++) {
              if (
                btns[i].textContent.trim() === '' &&
                btns[i + 1].textContent.trim() === '下载'
              ) {
                btns[i].click();
                await new Promise((r) => setTimeout(r, 600));
              }
            }

            // Extract file names + sizes
            const fileMatches = [
              ...dialog.textContent.matchAll(
                /(.+?\.part\d+\.rar|【.+?】\.rar|.+?\.7z)\s*([\d.]+[GM]B)/g
              ),
            ];

            for (
              let i = 0;
              i < Math.min(fileMatches.length, capturedUrls.length);
              i++
            ) {
              allDownloads.push({
                name: fileMatches[i][1] || '',
                size: fileMatches[i][2] || '',
                cdn_url: capturedUrls[i] || '',
              });
            }

            // Close modal
            const closeBtn = Array.from(dialog.querySelectorAll('button')).find(
              (b) => b.textContent.trim() === 'Close'
            );
            if (closeBtn) {
              closeBtn.click();
              await new Promise((r) => setTimeout(r, 1000));
            }
          }

          return { downloads: allDownloads, password };
        });

        if (detail.downloads.length > 0) {
          results.push({
            vid: vn.id,
            title: vn.title,
            developer: (vn.developers || []).map((d) => d.name).join(', '),
            downloads: detail.downloads.map((d) => ({
              name: d.name,
              size: d.size,
              cdn_url: d.cdn_url,
              password: detail.password,
            })),
            detail_url: `https://galzy.moe/${vn.id}`,
          });
        }
      } catch {
        // skip
      }
    }

    return results;
  },
});
