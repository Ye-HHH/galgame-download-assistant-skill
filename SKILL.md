---
name: galgame-download
description: GalGame 下载助手 — 搜索、筛选、下载 galgame 资源。支持全系列下载、模糊推荐、社团补完。TRIGGER: 用户想下载/找 galgame/视觉小说/ADV，提到游戏名/系列/社团（如"对魔忍""柚子社""白色相簿"），或要求找汉化补丁。全语言触发（中日英）。
---

# GalGame 下载助手

## Architecture

```
User request → OpenCLI adapters (优先) / browser driver (兜底) → search sites
    → IDM bridge / bdpan (download) → wait_download.py (poll)
    → extract_and_clean.py (extract + organize + clean)
```

Config in `references/config.json`, tools in `idm_bridge.py`, adapters in `adapters/`, phases in `references/phases/`.

### Adapter vs Browser Driver

| 站点 | 方式 | 命令 | 耗时 |
|------|------|------|------|
| **mihoyo.ink** | 🚀 Adapter | `opencli mihoyo search "query" -f json` | ~5s |
| **shinnku.com** | 🚀 Adapter | `opencli shinnku search "query" -f json` | ~8s |
| **inarigal.com** | 🚀 Adapter | `opencli inarigal search "query" -f json` | ~8s |
| **galzy.moe** | 🚀 Adapter | `opencli galzy search "query" -f json` | ~3s |
| 其他站点 | Browser Driver | `opencli browser dl <cmd>` | ~30s/站 |

Adapter 一次 Bash 返回结构化 JSON（含 CDN 直链+密码+大小），无需 Claude 分步操控浏览器。Adapter 文件在 `adapters/` 目录，Phase 0 自动注册到 `~/.opencli/clis/`。

---

## Workflow Router

按顺序执行，每个 Phase 结束后再进下一个。不要跳过或合并。

| Phase | 文档 | 做什么 | 出口条件 |
|-------|------|--------|----------|
| **0** | `references/phases/phase-0-check.md` | 检查工具链（OpenCLI/IDM/Baidu/7z） | 依赖确认完毕 |
| **1** | `references/phases/phase-1-setup.md` | 读 config → 确认保存目录 → TempPath → PC/手机 → 下载模式 | 目录存在，偏好确认 |
| **2** | `references/phases/phase-2-research.md` | WebSearch 研究游戏 → 呈现系列 → 编制名称表 | 用户确认下载清单 |
| **3** | `references/phases/phase-3-search.md` | 搜索站点 → 提取链接+大小+密码 → 版本筛选 → **3.5 汇总确认** | 用户说"下吧" |
| **4** | `references/phases/phase-4-download.md` | IDM / 百度盘 / 其他 提交下载 | 全部已提交，队列展示 |
| **5** | `references/phases/phase-5-wait.md` | 30s 快速检查 → 403 处理 → 轮询文件大小 | 全部文件到齐 |
| **6** | `references/phases/phase-6-extract.md` | 解压 → 整理 → 删包 → 清垃圾 → 写密码文件 | 完成 |

---

## Key Rules

### Search
- **Phase 2 mandatory** — research CN/JP/EN names BEFORE Phase 3
- **Phase 3**: Adapter 站点 → 一条命令出结果；非 adapter 站点 → Find → click → extract → next
- **Record `expected_size`** for every game — needed for Phase 5
- **mihoyo.ink**: `opencli mihoyo search "query" -f json` — CJK 由 adapter 内部处理，不会乱码
- **CJK input for browser driver sites** → `references/cjk-input.md`. `execCommand('insertText')` + `String.fromCodePoint()` ONLY

### Download
- **IDM path**: from config → `save_directory`, Windows backslash. `g:/` → invalid path `g:/\filename`
- **IDM filename**: ASCII only. No CJK, no full-width punctuation
- **IDM TempPath**: must be on same drive as save dir (Phase 1.2)
- **Never `idman /d` CLI** — no Referer; use `idm_bridge.py`
- **Never guess shinnku CDN** — visit detail page for real URL
- **inarigal**: time-limited tokens → IDM immediately
- **bdpan error -7**: API rate limit → browser manual
- **403 Forbidden** → `references/403-forbidden.md`

### Extract
- Single game → `<save_dir>/`, Series → `<save_dir>/SERIES_NAME/`
- Preserve archive internal folder name
- Delete archive on success (default), `--keep` to override
- Clean junk: .url, 广告*.txt, Thumbs.db, __MACOSX
- Password file: ASCII filename, Chinese content via Python chr()

### Workflow
- **Phase 3.5 is HARD BOUNDARY** — confirm with user before any download
- **Version preference**: 熟肉 > 生肉, 汉化/官中 > 机翻, non-Steam > Steam, single > split
- **ai2.moe**: 浏览器点击下载 → 轮询完成 → cp 到目标目录 → `references/sites/ai2moe.md`

### Site Cheatsheet
- **mihoyo.ink**: 🚀 `opencli mihoyo search "query" -f json` — 返回 CDN+密码+大小
- **shinnku.com**: 🚀 `opencli shinnku search "query" -f json` — 返回 CDN+大小+类别
- **fh-xy**: click 🔍, URL params don't work
- **qingju**: lz4 + password `qingju`
- **ai2.moe**: 3-layer flow, Cloudflare → `references/sites/ai2moe.md`
- All sites → `references/sites.md`
