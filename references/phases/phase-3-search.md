# Phase 3: Search Sites

**Entry**: Phase 2 complete, name table ready, user confirmed which games.

**Exit**: All games found, download links + sizes + passwords extracted, summary table presented, user confirmed. → Phase 4.

---

## Before Searching

- **mihoyo.ink → 使用 adapter**（一条命令出结果，无需浏览器操作）
- **其他站点 → 使用 OpenCLI browser** (`opencli browser dl <cmd>`)
- Never WebSearch/WebFetch for site searching.
- **Read reference docs first:**
  - `references/sites/mihoyo.md` — mihoyo.ink 站点结构参考（adapter 已封装搜索逻辑，此文档供了解目录结构/补丁位置）
  - `references/sites.md` — all other sites
  - `references/cjk-input.md` — CJK input protocol（仅 browser driver 站点需要）

## shinnku.com (Adapter) 🚀

**优先使用 adapter，不要用 browser driver 手动操作。**

```bash
opencli shinnku search "<query>" --limit 20 -f json
```

返回结构化 JSON：
```json
{
  "name": "euphoria.7z",
  "size": "1.95 GB",
  "category": "熟肉",
  "path": "/files/shinnku/0/win/euphoria.7z",
  "cdn_url": "https://zd.shinnku.top/file/shinnku/0/win/euphoria.7z",
  "detail_url": "https://www.shinnku.com/files/shinnku/0/win/euphoria.7z"
}
```

**CDN URL**: adapter 已自动构造，熟肉 `cdn_url` 可直接用于 IDM（Referer: `https://www.shinnku.com/`）。生肉 `cdn_url` 为空，需访问 `detail_url` 获取。

**使用方式：**
1. 用 Phase 2 确认的名称分别搜索
2. 按 `category` 筛选：优先熟肉，排除手机（apk/krkr/ons）
3. 文件名以 `[日期][会社]` 格式命名，可用来判断版本和年代

## mihoyo.ink (Adapter) 🚀

**优先使用 adapter，不要用 browser driver 手动操作。**

```bash
opencli mihoyo search "<query>" --limit 20 -f json
```

返回结构化 JSON：
```json
{
  "name": "[ゆずソフト] 千恋*万花 [无码] [steam官中].7z",
  "size": "7.82G",
  "size_bytes": 8391407615,
  "type": "file",
  "raw_url": "https://galgamedownload.date/...",
  "download_url": "https://mihoyo.ink/d/...",
  "password": "",
  "source": "梓澪の妙妙屋",
  "path": "/梓澪の妙妙屋(第三方)/..."
}
```

**使用方式：**
1. 用 Phase 2 确认的所有名称（中/日/英）分别搜索
2. 筛选结果：排除 `type: dir`；排除 apk（除非用户要手机版）；排除补丁（<500MB，除非 PATH B）
3. 同一个游戏搜到多个版本 → 按版本优先级选择（见下方）
4. adapter 已自动推断密码（`south-plus` / 终点密码 / 无密码），直接使用即可

**注意：** `raw_url` 可能含有时效性 sign 参数（南+合集的文件），提取后尽快传给 IDM。

## inarigal.com (Adapter) 🚀

```bash
opencli inarigal search "<query>" --limit 5 -f json
```

返回结构化 JSON：
```json
{
  "id": 763,
  "title_cn": "euphoria",
  "title_jp": "euphoria",
  "developer": "CLOCKUP",
  "downloads": [
    {
      "title": "HD步兵版",
      "type": "汉化",
      "size": "5.6G",
      "download_url": "https://inarigal.com/getdownloadurl/2441",
      "password": ""
    }
  ]
}
```

**下载流程**：`download_url` 是代理链接，Phase 4 时浏览器访问它会 302 重定向到 `soraflie.top` CDN（带 Authorization token，有时效），捕获重定向后立即交 IDM。

**密码**：从 API 的 `unzip_password` 字段获取。文件解压可能不需要密码。

## galzy.moe (Adapter) 🚀

```bash
opencli galzy search "<query>" --limit 3 -f json
```

返回结构化 JSON：
```json
{
  "vid": "v6540",
  "title": "euphoria",
  "developer": "CLOCKUP",
  "file_count": 10,
  "files": [
    {
      "name": "【PC电脑端中文】.part1.rar",
      "size": "4.0GB",
      "path": "/GalGame/.../【PC电脑端中文】.part1.rar"
    }
  ]
}
```

**下载流程**：adapter 返回文件列表和路径，Phase 4 时：
1. 浏览器打开 `detail_url`（如 `https://galzy.moe/v6540`）
2. 点击分卷（如 "(分卷) 【PC电脑端中文】.rar"）→ 弹窗出现
3. 弹窗列出分卷文件 + "复制链接"按钮 → 点击获得 CDN URL（`line.transmission3.eu.org/...?sign=...`）
4. 弹窗底部的"解压密码"一并提取

**注意**：CDN sign 有时效，提取后尽快交 IDM。

## CJK Input (Browser Driver 站点)

Chinese/Japanese/Korean text corrupts through bash. → Read `references/cjk-input.md`.

Quick summary:
- **shinnku**: eval with `encodeURIComponent(String.fromCodePoint(...))`
- ⛔ NEVER truncate state with head/tail — search modal at very END of DOM

## Search Workflow

**Find → Extract → Next.** Never batch-search then backtrack.

1. Search all name variants (CN/JP/EN from Phase 2)
2. Click best result → detail page → extract CDN immediately
3. **MUST record 3 things per game: CDN + password + size**

## Password Collection ⛔

⛔ **EVERY game download must have a password recorded before Phase 4. No exceptions.**

Common mihoyo passwords by source directory:
| 来源目录 | 密码 |
|----------|------|
| 柚哩Gal / GAL仓库 | `south-plus` |
| 终点汉化 | 看文件括号内标注 |
| 南+合集 | `south-plus` |
| 梓澪の妙妙屋(浮士德) | 无密码 |
| 梓澪の妙妙屋(补丁) | 无密码 |
| galgamedownload.date (生肉) | 无密码 |

**Check methods:**
- mihoyo detail page → look for 解压密码 section in footer
- shinnku detail page → check page text for 密码/解压
- Click "复制链接" if needed to see full page info
- If password is NOT found → **mark as UNKNOWN in summary, ask user before Phase 4**

## Path Decision

```
Found 熟肉? → PATH A: Direct download (Phase 4)
No 熟肉?   → PATH B: 生肉 + Patch (two downloads, then Phase 4)
```

For PATH B: both parts mandatory. Track status: [生肉✅/❌] [补丁✅/❌].

## Search Priority Tiers

**逐层搜索，上层找到足够结果就停止，不再搜下层。** 每层并行搜索（所有 adapter 命令同时发出），层内全部返回后再决定是否进下一层。

### Tier 1 — IDM 直链（优先）

**所有游戏先搜这层。找到足够的熟肉资源就停。**

| # | 站点 | 命令 | 下载方式 |
|---|------|------|----------|
| 1 | **shinnku.com** 🚀 | `opencli shinnku search "query" -f json` | CDN 直链 → IDM |
| 2 | **mihoyo.ink** 🚀 | `opencli mihoyo search "query" -f json` | CDN 直链 → IDM |

**停止条件**：每个游戏至少找到 1 个熟肉资源。

### Tier 2 — 代理下载（需要额外步骤）

**Tier 1 搜不到某个游戏时，对该游戏搜这层。**

| # | 站点 | 命令 | 下载方式 |
|---|------|------|----------|
| 3 | **inarigal.com** 🚀 | `opencli inarigal search "query" -f json` | 访问 `getdownloadurl/id` → 捕获重定向 URL → IDM |
| 4 | **galzy.moe** 🚀 | `opencli galzy search "query" -f json` | 浏览器点分卷 → 弹窗 → 复制链接 → IDM |

**停止条件**：每个游戏至少找到 1 个可用资源。

### Tier 3 — 网盘/论坛（手动）

**前两层都没找到，或者用户要百度盘版本。**

| # | 站点 | 搜索方式 | 下载方式 |
|---|------|----------|----------|
| 5 | **fh-xy.net** | `opencli browser dl` → 点🔍搜索 | 百度/夸克链接+提取码 |
| 6 | **qingju.org** | `opencli browser dl` → 搜索框 | 百度盘, lz4 |
| 7 | **kungal.com / touchgal.ink** | `opencli browser dl` | 跳转网盘 |

### Patch Sites（PATH B 专用）

需要找汉化补丁时搜索：

1. **mihoyo.ink** — `梓澪の妙妙屋/补丁/汉化补丁归档/`
2. **2dfan.com** — 浏览器搜索
3. **ai2.moe** — `references/sites/ai2moe.md`
4. **moyu.moe**

### 注意

- ⛔ **Tier 内并行，Tier 间串行** — 搜完 Tier 1 全部站点 → 汇总 → 不够再进 Tier 2
- 429 限流 → 等 30 秒重试，不要连续刷
- Tier 2 搜到 inarigal 结果 → 记下 `download_url`（即 `getdownloadurl/id`），Phase 4 访问它获取真正 CDN
- Tier 2 搜到 galzy 结果 → 记录文件信息，Phase 4 浏览器操作获取下载链接+密码

## Auto-Extract Info

Use `opencli browser dl eval` to extract programmatically:
- **Links**: `document.querySelectorAll('a[href*="pan.baidu.com"], a[href*="pan.quark.cn"], a[href*="shinnku.top"], ...')`
- **提取码**: regex `提取码[：:]\s*([a-zA-Z0-9]+)`
- **解压密码**: regex `(解压密码|密码)[：:]\s*(.+?)(?:\s|$|\))`
- **File sizes**: `大小[：:]\s*([\d.]+ ?[GM]B)` or `([\d.]+ ?[GM]B)` near filename

## Version Selection

Priority: 熟肉 > 生肉, 汉化/官中 > 机翻, non-Steam > Steam, 无码 > 有码(if available), single file > split, smaller > larger, exclude apk/krkr/ons unless mobile.

## Multi-Keyword Search

Pass 1 — Full names (JP + CN). Pass 2 — Partial terms fallback. JP → CN → EN → partial → series.

---

# Phase 3.4: Extract Download Links

→ See `references/sites.md` for per-site instructions.

**Universal flow:**
- **Step A**: Read `opencli browser dl state` of detail page. Look for buttons ("复制链接", "下载", "点击此处下载") and <a> links with cloud URLs.
- **Step B**: Extract real URL. Page URL itself is rarely the download link.
- **Step C**: Feed to IDM bridge. Never paste into IDM manually.

**Path/filename rules:**
- Path: Windows backslash from config → `save_directory`.
- Filename: ASCII ONLY. ✅ `NUKITASHI1.rar` ❌ `LAMUNATION！.7z`

```bash
python idm_bridge.py "<cdn_url>" "<referer>" "<save_dir>\\" "<ascii_filename>" --silent
```

**Referer mapping:**
- shinnku → `"https://www.shinnku.com/"`
- mihoyo.ink / galgamedownload.date / ali-cdn.mihoyo.fans → `"https://mihoyo.ink/"`

**Per-site quick reference:**
- **mihoyo.ink 🚀**: `opencli mihoyo search "query" -f json` → 直接用 `raw_url` 和 `password` 字段 → IDM。Referer: `https://mihoyo.ink/`
- **shinnku**: detail page → "点击此处下载" <a> href = CDN URL
- **inarigal**: "下载资源" → countdown → `opencli browser dl network` capture
- **fh-xy / galgame.dev**: links in post body, regex passwords
- **qingju**: blog post body → 百度 links + 提取码, lz4 + password `qingju`
- **kungal**: "获取链接" button → extract href
- **ai2.moe**: 3-layer flow → `references/sites/ai2moe.md`. IDM + cookie, Python fallback.

---

# Phase 3.5: Verify & Present

### Verify Links

Open multiple OpenCLI tabs to verify each link is alive. Dead link → check backups from same post.

### Present Summary

```
=== IDM 直链 (首选) ===
| # | 作品 | 来源 | 大小 |
|---|------|------|------|

=== 百度盘 (bdpan) ===
| # | 作品 | 链接 | 提取码 |
|---|------|------|--------|

=== 其他网盘 (手动) ===
| # | 作品 | 链接 | 密码 |
|---|------|------|------|
```

### HARD BOUNDARY

⛔ **Do NOT start any download before user explicitly confirms.**
- STOP after presenting the table
- Wait for: "下吧", "全下", "挑这几部下"
- If accidentally started a download during search, tell user immediately
- Only after confirmation → Phase 4

### Fallback

If nothing usable found:
1. Tell user which sites searched + what was found
2. Ask: "要不要添加其他站点？还是 WebSearch 全网搜索？"
3. New site URLs → add to search list, re-run Phase 3
