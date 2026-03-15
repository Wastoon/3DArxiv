# 3DArxiv

> 每日自动追踪 3D Vision、Robotics、Digital Human 等领域的最新 ArXiv 论文，并通过语义知识图谱展示论文间的学术关联。

[![Update](https://img.shields.io/github/actions/workflow/status/Wastoon/3DArxiv/update-feed.yml?label=daily%20update&style=flat-square)](https://github.com/Wastoon/3DArxiv/actions)
[![License](https://img.shields.io/badge/license-GPL--2.0-blue?style=flat-square)](LICENSE)
[![Website](https://img.shields.io/badge/website-live-brightgreen?style=flat-square)](https://wastoon.github.io/3DArxiv/)

**[🌐 访问网站](https://wastoon.github.io/3DArxiv/)** · **[🕸️ 知识图谱](https://wastoon.github.io/3DArxiv/graph.html)** · **[📡 RSS 订阅](https://wastoon.github.io/3DArxiv/rss.xml)**

---

## 功能概览

### 📄 论文列表页
- **每日自动更新**，追踪 14 个领域的最新论文
- **全文搜索**：标题、作者、摘要、领域实时过滤，支持搜索历史
- **子方向标签**：VLA / Humanoid / Manipulation / NeRF·3DGS / Digital Human / Gaussian Avatar 等 14 个子方向一键筛选
- **精选过滤**：顶级作者（★）、顶级机构（★）、顶会论文（★★）快速定位
- **BibTeX 一键复制**：点击即生成标准 `@article` 引用格式
- **永久链接**：每篇论文有固定 URL anchor，可直接分享跳转
- **AI 一句话总结**：由 Gemini 自动预生成的中文 TL;DR（持续积累中）
- **收藏夹 + 笔记**：本地持久化，支持导出为文本
- **已读标记**：区分已读/未读论文
- **统计 Dashboard**：每日论文数趋势、领域分布、精选比例图表
- **领域导航**：快速跳转到任意领域区块
- **深色/浅色模式**、LaTeX 公式渲染、自动检测 GitHub 代码链接

### 🕸️ 3D 知识图谱
- **语义知识图谱**：基于 Gemini Embedding 计算论文间语义相似度
- **三类连线**：语义相似（紫色）/ 历史学术关联（绿色虚线）/ 共同作者（金色）
- **历史溯源**：每篇新论文通过 ArXiv API 搜索并连接历史相关论文，展示学术根源
- **节点视觉编码**：实心彩色节点（本周新论文）/ 半透明虚线圆（历史论文）
- **交互**：拖拽平移、滚轮/双指缩放、点击节点查看详情、子方向过滤、精选高亮
- **详情侧边栏**：标题、作者、摘要、相关论文列表、直接跳转 ArXiv

### 📡 RSS & 推送
- **RSS 2.0 Feed**：标准格式，兼容所有主流 RSS 阅读器（Feedly、Inoreader 等）
- **Telegram Bot 每日推送**：UTC 00:00（北京时间 08:00）自动推送当日精选论文

---

## 追踪领域

| 领域 | 每日上限 | 说明 |
|------|---------|------|
| Robotics (`cs.RO`) | 300 | 机器人学全领域 |
| 3D Vision | 120 | 3D 重建、多视角、点云 |
| NeRF | 80 | Neural Radiance Field |
| Gaussian Splatting | 60 | 3D Gaussian Splatting |
| Digital Human | 80 | 数字人、人体渲染、clothed human |
| Gaussian Avatar | 80 | Gaussian Avatar、4D Gaussian、SMPL |
| Human Body | 60 | 人体重建、姿态估计、参数化模型 |
| Video World Models | 100 | 视频世界模型 |
| Embodied Intelligence | 50 | 具身智能、VLA、灵巧操作 |
| End-to-End AD | 50 | 端到端自动驾驶、BEV、Occupancy |
| Foundation Models | 50 | 多模态基础模型、通用智能体 |
| Computation and Language (`cs.CL`) | 150 | NLP |
| Machine Learning (`cs.LG`) | 150 | 机器学习 |
| Multimedia (`cs.MM`) | 150 | 多媒体 |

---

## 技术架构

```
GitHub Actions (UTC 00:00 每日触发)
    │
    ├─ ArxivFeed binary      → 抓取 ArXiv API，生成 index.html + cache.json
    │
    ├─ generate_graph.py     → Gemini Embedding + ArXiv 搜索
    │   ├─ 计算新论文语义向量
    │   ├─ 搜索历史相关论文并计算相似度
    │   ├─ 增量更新 data/embeddings.json（持久化到 main 分支）
    │   └─ 输出 graph.json
    │
    ├─ generate_rss.py       → 生成 rss.xml
    │
    ├─ generate_summary.py   → Gemini 生成中文 TL;DR
    │   └─ 增量更新 summary.json（每次最多处理 60 篇新论文）
    │
    ├─ Deploy to gh-pages    → index.html / cache.json / graph.json /
    │                          rss.xml / summary.json / graph.html
    │
    └─ notify_telegram.py    → 推送当日精选论文到 Telegram
```

**前端技术栈：**
- 纯静态 HTML + CSS + JavaScript（无框架依赖）
- [ArxivFeed](https://github.com/NotCraft/ArxivFeed)（Handlebars 模板引擎，Rust 实现）
- [Chart.js](https://www.chartjs.org/)（统计图表）
- [Remix Icon](https://remixicon.com/)（图标库）
- [KaTeX](https://katex.org/)（LaTeX 公式渲染）
- 知识图谱：纯 Canvas 2D + 自实现力导向布局 + 网格加速

**后端/数据管道：**
- Python 3.11（标准库，无第三方依赖）
- [Gemini API](https://ai.google.dev/)：`gemini-2.0-flash`（TL;DR）+ `gemini-embedding-001`（语义向量）
- [ArXiv API](https://arxiv.org/help/api)（论文搜索）
- GitHub Actions + GitHub Pages（全免费部署）

---

## 部署你自己的版本

### 1. Fork 本仓库

点击右上角 **Fork**，创建到你的 GitHub 账号下。

### 2. 修改 config.toml

```toml
site_title = "MyArxiv"           # 网站名称
limit_days = 30                  # 缓存天数
cache_url  = "https://<你的用户名>.github.io/<仓库名>/cache.json"
```

按需增删 `[[sources]]` 搜索源，参考 [ArXiv 分类列表](https://arxiv.org/category_taxonomy)。

### 3. 配置 GitHub Secrets

在仓库 **Settings → Secrets and variables → Actions** 中添加：

| Secret 名称 | 说明 | 必须 |
|------------|------|------|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) 免费获取 | 推荐 |
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) 创建 Bot 获取 | 可选 |
| `TELEGRAM_CHAT_ID` | 你的 Telegram Chat ID | 可选 |

> `GEMINI_API_KEY` 用于生成 AI 摘要和语义知识图谱，免费版每天 100 万次请求，完全够用。没有此 Key 时，知识图谱会降级为 TF-IDF 相似度，AI 摘要功能不可用。

### 4. 启用 GitHub Pages

**Settings → Pages → Branch** 选择 `gh-pages`，保存。

### 5. 创建初始数据文件

在仓库根目录创建 `data/` 文件夹，并新建 `data/embeddings.json`，内容为 `{}`。

### 6. 触发首次构建

进入 **Actions → Update → Run workflow** 手动触发一次，等待约 10 分钟完成。

之后每天 UTC 00:00 自动触发。

### 7. 自定义高亮关键词和作者

编辑 `scripts/config.rhai`：

```rhai
// 标题高亮关键词
let titles_model  = ["Gaussian Splatting", "VLA", "Diffusion", ...];
let titles_method = ["Humanoid", "Manipulation", "Sim-to-Real", ...];

// 高亮作者（★ 标记）
let authors_array = ["Yann LeCun", "Sergey Levine", ...];

// 顶级机构（★ 标记）
let top_labs = ["NVIDIA", "MIT", "Stanford", ...];
```

---

## 项目结构

```
3DArxiv/
├── config.toml              # ArxivFeed 主配置（领域、缓存天数）
├── scripts/
│   ├── config.rhai          # 高亮关键词、作者、会议配置
│   ├── highlight_title.rhai
│   ├── highlight_author.rhai
│   ├── highlight_conference.rhai
│   ├── generate_graph.py    # 语义知识图谱生成
│   ├── generate_rss.py      # RSS Feed 生成
│   ├── generate_summary.py  # AI TL;DR 生成
│   └── notify_telegram.py   # Telegram 推送
├── includes/
│   └── index.hbs            # 主页 Handlebars 模板
├── statics/
│   ├── index.js             # 前端交互逻辑
│   ├── index.css            # 样式
│   └── graph.html           # 3D 知识图谱页面
├── data/
│   └── embeddings.json      # 语义向量缓存（自动维护，勿手动编辑）
└── .github/workflows/
    └── update-feed.yml      # GitHub Actions 工作流
```

---

## 致谢

本项目基于 [MyArxiv](https://github.com/MLNLP-World/MyArxiv) 模板构建，由 [ArxivFeed](https://github.com/NotCraft/ArxivFeed) 驱动数据管道。

---

<div align="center">
  <sub>数据每日自动更新 · 知识图谱持续积累 · 完全免费部署</sub>
</div>
