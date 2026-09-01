# scripts

Script hỗ trợ phát triển. Sẽ được viết khi chốt tooling (`docs/open-questions.md` mục 3).

## Kế hoạch

| Script | Mục đích |
|--------|----------|
| `setup.ps1` / `setup.sh` | Cài dependencies cho cả frontend + backend một lượt |
| `dev` | Chạy đồng thời backend (localhost) + frontend (build/watch) |
| `build` | Build production, đóng gói extension (.zip) |
| `check` | Lint + typecheck + test toàn repo |
