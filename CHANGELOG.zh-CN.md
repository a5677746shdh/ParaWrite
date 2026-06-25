# 更新日志

本文件记录 ParaWrite 的所有重要变更。英文版见 [CHANGELOG.md](CHANGELOG.md)。

## [未发布]

## [0.6.2] — 2026-06-26

### 新增
- 原文为空时显示粘贴按钮，有内容时显示清空（刷子图标）
- 剪贴板读取辅助函数（粘贴）
- `docs/UI-DESIGN.md` 按钮图标规范（内联 SVG、`refer/` 参考流程）

### 变更
- 文档说明 `refer/` 等本地目录须保留，清理工作区时勿删
- Beta 与生产 Docker：ARM64 上预编译包下载失败时可本地编译 `better-sqlite3`

## [0.6.1] — 2026-06-25

### 新增
- `selection_copy_enabled`：多选词（≥2 词）时复制按钮改为复制选中片段
- `word_lookup_mode`：`immediate`（立即）| `manual`（手动）| `adaptive`（区分：一栏/两栏手动，三栏立即）；仍兼容旧值 `off`/`on`/`auto`
- 译文栏左下角「查词」按钮（手动查词模式）
- 多选指导：非连续点选时短暂高亮选区两侧相邻词
- 原文/译文栏底部图标按钮（退格清空、复制、朗读）；朗读光晕动效，再次点击停止
- 词面板分项增量展示：同义词、词典、替代项各自返回后立即显示
- 词面板加载动效（轨道滑块往复动画，替代「加载中」文字）
- 中文更新日志（本文件）

### 变更
- 区域复制开启时，复制按钮样式与选词高亮一致
- 词面板关闭按钮改为圆形带背景；取消选词按钮与选词框样式统一
- 词典服务复用缓存的 LLM 引擎实例
- 面板 API 支持 `AbortSignal`，切换选区或重新翻译时取消进行中的请求

### 修复
- 手动/区分查词模式：选词不再自动请求，仅点击「查词」后发起
- 立即查词模式下多选词防抖（400 ms），减少 API 调用
- 词面板不再等全部请求完成才显示，已返回的分项即时展示
- 开始翻译时取消进行中的查词请求；TokenEditor 定时器卸载清理

## [0.6.0] — 2026-06-25

### 新增
- 英文技术文档 `docs/`（架构、配置、API、部署、开发）
- 中文 README（`README.zh-CN.md`）
- PWA 清单截图与 `display_override` 安装界面
- Android TWA：`config/assetlinks.json` 发布于 `/.well-known/assetlinks.json`
- `.env.example`、CI 工作流、CONTRIBUTING.md、SECURITY.md、Issue/PR 模板

### 变更
- README 精简为简介、快速开始与文档索引
- UI 截图在 `docs/snapshots/` 中改为英文文件名
- core、server、web 关键模块补充模块头注释
- PWA `theme_color` 与白色顶栏一致（Android TWA 状态栏）

### 修复
- 弹窗/底部 sheet 滚动不再穿透背后页面（body 滚动锁定）
- iOS Safari：堆叠布局下原文/译文栏自适应高度

## [0.5.2] — 2026-06-25

### 变更
- 启动时模型 API 检查改为非阻塞；引擎与分词器实例缓存
- 前端性能：Zustand 浅比较选择器、词面板增量加载、diff 记忆化
- 登录「保持登录」默认不勾选；未勾选时为会话 Cookie
- 精简页头、词面板、设置对话框、历史分页的 DOM 结构

### 移除
- 遗留接口 `GET /api/dictionary/:lang/:word` 与未使用的 `fetchDictionary` 客户端

## [0.5.1] — 2026-06-25

### 新增
- 启动时检查已配置模型的 API 可用性，按模型输出日志

### 变更
- 用户数据目录默认迁至项目根 `data/`（非 `config/data/`）；beta compose 挂载 `/data` 卷
- 配置路径（`glossary.file`、`users.data_dir`）相对于应用根目录解析
- UI 按钮水平内边距统一（`px-6`）；同义词与替代项芯片更紧凑
- 历史筛选标签：收藏在左，全部在右

## [0.5.0] — 2026-06-25

### 新增
- 可选用户登录与翻译历史（SQLite）— `users.login.mode`：disabled / restricted / open
- 历史面板：收藏、分页、翻译成功后自动保存
- YAML 自定义主题色（`theme`）映射为 CSS 变量
- UI 设计指南 `docs/UI-DESIGN.md`
- 登录「保持登录」（会话 Cookie vs 持久 Cookie）
- 受限注册白名单（`allowed_usernames`）；已有用户始终可登录

### 变更
- 重置对话框更名为「选项」— 界面语言、重载、重启、登出归入设置齿轮
- 语义色 token（`deepl-error`、`deepl-success` 等）替代硬编码颜色
- 服务商/模型下拉按标签宽度自适应；页头布局优化

## [0.4.1] — 2026-06-25

### 新增
- 再次点击已选词可取消选择；多词选区仅从边缘缩小（中间词点击忽略）
- 分句/从句选区沿用连续缩小规则；双击/三击清除整段选区

### 修复
- HTTP/Docker 下复制按钮 — Clipboard API 不可用时回退 `execCommand`
- PWA 更新后旧缓存 — `skipWaiting`/`clientsClaim` 及对 HTML/SW 禁用缓存

## [0.4.0] — 2026-06-25

### 新增
- 自定义术语表 `glossary.file` — 向提示词注入领域术语（ISO 639-2 键）
- 替代表达 diff 高亮 — 词面板中变更词/短语琥珀色标记
- 译文区连续点选相邻词扩展选区
- 按服务商配置代理（`proxy.url`）HTTP/HTTPS/SOCKS5（支持用户名密码）
- `app.phrase_word_threshold` — 超过词数阈值时隐藏同义词/词典（默认 + 按语言 ISO 639-2）
- `app.translate_on_enter` — 可选 Enter 翻译（Shift+Enter 换行）
- `app.alternatives_separator` — 按语言逗号/句号拆分替代项（默认逗号）
- 可选 TOTP：应用访问（`auth.access_totp_secret`）与后端重启（`auth.restart_totp_secret`）
- 配置文件 ISO 639-2 语言代码，运行时映射为 ISO 639-1
- 客户端语言检测（`franc`）用于自动源语言 — 支持正确互换语言

### 变更
- 改写范围限定为所选分句/短语，而非整句
- 复制按钮显示绿色对勾，1 秒冷却
- 认证与重启错误内联显示在按钮上

### 修复
- 自动源语言互换时交换检测到的语言（A↔B），而非将 `auto` 移到目标语
- 尚无法检测源语言时禁用互换按钮

## [0.3.1] — 2026-06-25

### 新增
- 启动日志含 ISO 时间戳与构建版本
- NAS/Docker 部署用 `config/parawrite.docker.example.yaml`
- `config/.gitignore` 防止本地密钥入库

### 变更
- Beta compose：`container_name: parawrite-beta`，`image: parawrite:<version>`
- Docker 基础镜像升级至 `node:22-alpine`
- 默认 DeepSeek 模型 → `deepseek-v4-flash`（本地 + docker 示例）
- 本地 `parawrite.yaml` gitignore；开发环境允许明文 API Key

## [0.3.0] — 2026-06-24

### 新增
- Beta 打包脚本（`pnpm package:beta`）输出至 `artifacts/parawrite-beta/`
- Beta 包内含 `CHANGELOG.md` 与 `VERSION.json`

### 变更
- 页头应用图标放大至 48×48 px
- 应用图标以原生 48 px 重新生成
- Docker 运行镜像安装 `wget` 用于健康检查
- Docker 构建在编译前生成版本号

### 修复
- Alpine 健康检查失败（缺少 `wget`）
- Beta Docker 构建因 compose 引用父级 `docker/` 目录失败（现自包含于 `artifacts/parawrite-beta/`）

## [0.2.0] — 2026-06-24

### 新增
- 应用品牌图标（favicon、PWA、页头 logo）
- 本地工作区目录 `artifacts/`、`ai-memory/`
- `prestart` 钩子在 `npm start` 前重建前端
- 完整 README（API 端点与配置说明）

### 变更
- 流式翻译按动画帧批量处理 SSE 块（减少重渲染）
- `Header` 与 `App` 使用 Zustand 选择性订阅
- `TextStats`、`TokenEditor` 记忆化优化性能
- 服务端重构为 `createApp(config)`，配置单次加载
- 自动翻译仅在源文实际变更时重新调度
- 翻译栏 flex 底栏贴底；源/译文列间分隔线撑满高度
- 词典 API 传递 `uiLang` 以支持双语释义
- 双语词典在 LLM 无结果时回退免费词典

### 修复
- 自动翻译定时器与 meta 加载竞态导致重复翻译
- 词典上下文失败（陈旧构建 / 缺少 `uiLang`）
- 分隔线未延伸至栏底
- 生产环境页头图标缺失（陈旧 `web/dist`）

### 移除
- README 中错误的 token 重排（上移/下移）描述
- `public/` 中冗余大图标副本
- 开发调试埋点

## [0.1.0] — 2026-06-24

### 新增
- 初始版本：DeepL 风格翻译 UI，可配置 LLM 服务商
- 流式翻译、词面板（同义词、词典、改写）
- YAML 配置服务商（OpenAI 兼容、Claude、Ollama）
- 混合词典（Free Dictionary、Wiktionary、LLM 回退）
- 响应式三栏/双栏/堆叠布局
- PWA、Docker 部署、界面中英双语
- 自动翻译防抖、快捷键（Ctrl/Cmd+Enter）
