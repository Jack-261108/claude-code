# Homebrew formula template

这个目录保存主仓库内的 Homebrew 分发模板，真正发布时建议同步到独立 tap 仓库：`Jack-261108/homebrew-claude-code-best`。

## 发布流程

1. 运行 `bun run build`
2. 运行 `bun run package:release`
3. 主仓库 release workflow 会上传 formula 到 GitHub Release
4. `sync-homebrew-tap.yml` 会在 release published 后自动把 `packaging/homebrew/claude-code-best.rb` 同步到独立 tap 仓库分支并创建 PR
5. 如果同一 release tag 的 PR 已存在，workflow 会复用并更新该 PR，而不是重复创建
6. 对受控的同步 PR，workflow 会自动开启 GitHub auto-merge；若 tap 仓库 checks 未通过，则会等待通过后再合并
7. workflow 对同一 release tag 启用并发保护，避免重复同步任务互相覆盖
8. 若创建 / 更新 / auto-merge 失败，workflow summary 会输出分支、PR 编号/链接与手动恢复指引，便于重试或人工接管
9. 如需人工介入，仍可在 tap 仓库中手动审查该 PR
10. 主仓库 CI 会通过仓库内脚本额外校验 `.github/workflows/*.yml`；release workflow 会列出真实发布产物名并上传 `manifest.json`，tap sync workflow 会读取该 manifest 并汇总 PR / auto-merge / 恢复状态

## 所需 secrets / env

- `HOMEBREW_TAP_TOKEN`：对独立 tap 仓库具备 contents / pull requests 写权限的 token
- `TAP_REPOSITORY`：目标 tap 仓库，例如 `Jack-261108/homebrew-claude-code-best`
- `TAP_DEFAULT_BRANCH`：tap 默认分支，默认 `main`
- `TAP_FORMULA_PATH`：formula 路径，默认 `Formula/claude-code-best.rb`

## 手动恢复

可通过 `workflow_dispatch` 手动触发 `sync-homebrew-tap.yml`，并指定：

- `sync_mode=full`：完整同步（默认）
- `sync_mode=auto-merge-only`：只为当前 tag 对应的 open PR 重新开启 auto-merge
- `sync_mode=summary-only`：只输出当前恢复信息到 workflow summary，不执行写操作
