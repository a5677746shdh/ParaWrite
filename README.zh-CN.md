# ParaWrite

[English](README.md) | [中文](README.zh-CN.md)

ParaWrite 是一款开源写作辅助工具，灵感来自 DeepL 的「替代译文」功能。通过可配置的 LLM API 进行流式翻译，并支持上下文同义词、词典释义与句子改写。

**版本 1.0.0** — 首个公开发布版本。详见 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md)（英文：[CHANGELOG.md](CHANGELOG.md)）。

## 界面展示

| 桌面端（三栏） | 平板端（双栏） |
|:---:|:---:|
| ![桌面端布局](docs/snapshots/desktop-layout.jpg) | ![平板端布局](docs/snapshots/tablet-layout.jpg) |

| 移动端（堆叠） | 同义词与替代表达 |
|:---:|:---:|
| ![移动端布局](docs/snapshots/mobile-layout.jpg) | ![词语面板](docs/snapshots/synonyms-panel.jpg) |

| 主界面 | 登录弹窗 |
|:---:|:---:|
| ![主界面](docs/snapshots/main-interface.jpg) | ![登录弹窗](docs/snapshots/login-dialog.jpg) |

更多 UI 规范见 [docs/UI-DESIGN.md](docs/UI-DESIGN.md)。

## 功能特性

- **流式翻译** — DeepL 风格源/译文双栏，响应式三栏/双栏/堆叠布局
- **词语面板** — 点击译文单词获取同义词、双语词典与替代表达
- **术语表** — YAML 配置领域术语注入翻译；`other` 回退键；可选源/译文栏标注（`app.point_out_glossary`）
- **翻译记录** — 登录后自动保存；收藏、分页、多选批量删除
- **可配置 LLM 后端** — 通过 YAML 接入 OpenAI 兼容 API、Claude、Ollama
- **用户偏好** — 每账户独立 `app` / `theme` / 术语表 YAML
- **PWA** — 可安装，支持离线壳

## 环境要求

- Node.js **≥ 22**
- pnpm **9.15**（见 `package.json` 中的 `packageManager`）

## 快速开始

```bash
pnpm install
cp config/config.example.yaml config/config.yaml
export OPENAI_API_KEY=your-key-here   # 或在 config.yaml 中配置
pnpm dev
```

- 前端：http://localhost:5173（`/api` 代理到后端）
- 后端：http://localhost:8787

生产环境：

```bash
pnpm build
pnpm start    # 在 :8787 提供 API 与前端静态资源
```

Docker 与 beta 打包见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 架构概览

```
parawrite/
├── apps/web/       # Vite + React 前端（PWA）
├── apps/server/    # Hono API + 静态文件服务
├── packages/core/  # 共享引擎、词典、配置、类型
├── config/         # YAML 模板（密钥已 gitignore）
├── data/           # SQLite 用户数据（已 gitignore）
├── docker/         # 生产 Docker
└── docs/           # 技术文档
```

## 文档

| 文档 | 说明 |
|------|------|
| [docs/README.md](docs/README.md) | 文档索引 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 系统设计与请求流 |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | YAML 配置说明 |
| [docs/API.md](docs/API.md) | HTTP API 与 SSE 协议 |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker、beta 包、环境变量 |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | 本地开发与构建 |
| [docs/UI-DESIGN.md](docs/UI-DESIGN.md) | UI 规范与界面截图 |

## 许可证

MIT — 见 [LICENSE](LICENSE)。
