# Phase 0: Dependency Check

**Entry**: User triggers the skill.

**Exit**: All required deps verified (or missing ones noted). → Phase 1.

## Reuse Rule

⛔ **Do NOT re-run the full check if this project has passed Phase 0 in a prior session.**
- Check project memory/CLAUDE.md for recorded toolchain status.
- If all tools were previously verified, skip to Phase 1 with a one-line confirmation.
- Only run individual checks for tools that may have changed (e.g., extension disconnected).

---

## Toolchain

| Dependency | Check command | Used for | Required? |
|-----------|---------------|----------|-----------|
| OpenCLI | `opencli doctor` | Browser search on all sites | **Yes** |
| IDM bridge | `ls idm_bridge.py` in skill dir | Direct link downloads | For IDM mode |
| Baidu client | `ls "D:/APP/BaiduNetdisk/BaiduNetdisk.exe"` | 百度盘 (auto-capture) | For 百度 mode |
| BaiduPCS-Go | `which BaiduPCS-Go` | 百度盘 CLI (fast) | Optional |
| bdpan CLI | `bdpan whoami` | 百度盘 fallback | Deprecated |
| Python | `python --version` or `"/c/Program Files/Python312/python.exe" --version` | idm_bridge.py, wait_download.py, extract_and_clean.py | **Yes** |
| 7z | `ls "/c/Program Files/NVIDIA Corporation/NVIDIA app/7z.exe"` | Archive extraction | Nice to have |

Report what's available. If OpenCLI or Python is missing, stop — everything depends on them. Other missing deps → note which download modes will be unavailable.

## Adapter Registration

本 skill 通过 OpenCLI adapter 加速搜索。Adapter 文件在 skill 仓库的 `adapters/` 目录下，需要注册到 `~/.opencli/clis/` 才能被 OpenCLI 识别。

### 注册步骤（每次会话只需执行一次）

```bash
# 检查是否已注册
ls ~/.opencli/clis/mihoyo/search.js 2>/dev/null && echo "mihoyo adapter OK" || echo "需要注册"

# 如果未注册，从 skill 目录复制
mkdir -p ~/.opencli/clis/mihoyo
cp <skill_dir>/adapters/mihoyo/search.js ~/.opencli/clis/mihoyo/search.js
```

### 验证

```bash
opencli mihoyo search "test" --limit 1 -f json 2>&1 | head -5
```

如果返回 JSON（不是 "Unknown command"），说明注册成功。

### 注意事项
- 注册是一次性的——adapter 文件复制到 `~/.opencli/clis/` 后，OpenCLI 会持久识别
- 更新 skill 时，重新执行 `cp` 覆盖旧 adapter
- 如果 `opencli mihoyo` 报 "Unknown command"，检查 `opencli doctor` 确认无报错

## Permissions

Before any download work, ensure these are in `.claude/settings.local.json`:

`Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebFetch`, `WebSearch`, `Skill`, `Agent`

If missing, add them with Python.
