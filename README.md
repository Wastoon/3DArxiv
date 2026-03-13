<div align="center">

<h1>🗂️ 3DArxiv</h1>

**每日自动追踪 3D 视觉 · 机器人 · 具身智能 · 自动驾驶 · 大模型领域的最新 arXiv 论文**

[![Site](https://img.shields.io/badge/🌐_在线访问-wastoon.github.io/3DArxiv-blue?style=flat-square)](https://wastoon.github.io/3DArxiv/)
[![Update](https://img.shields.io/github/actions/workflow/status/Wastoon/3DArxiv/update-feed.yml?label=每日更新&style=flat-square)](https://github.com/Wastoon/3DArxiv/actions)
[![Based on MyArxiv](https://img.shields.io/badge/based_on-MyArxiv-orange?style=flat-square)](https://github.com/MLNLP-World/MyArxiv)
[![License](https://img.shields.io/github/license/Wastoon/3DArxiv?style=flat-square)](LICENSE)

</div>

---

## 项目简介

arXiv 每天发布大量论文，手动筛选效率极低。**3DArxiv** 是一个面向 3D 视觉 / 机器人 / 具身智能研究者的个人定制订阅站点，基于 [MyArxiv](https://github.com/MLNLP-World/MyArxiv) 构建，通过 GitHub Actions 每天自动抓取并部署到 GitHub Pages。

前端经过完整重新设计，支持全文搜索、精选过滤、统计图表、论文收藏、深色模式等功能，力求让浏览 arXiv 这件事变得高效且舒适。

---

## 功能特性

| 功能 | 说明 |
|------|------|
| 🔄 **每日自动更新** | GitHub Actions 定时抓取 arXiv 最新论文，无需手动操作 |
| 🔍 **全文搜索** | 同时搜索标题、作者、摘要、会议名称；按 `/` 快速聚焦搜索框 |
| ⭐ **精选过滤** | 一键只看顶会论文 / 大牛作者的工作 |
| 🏷️ **智能高亮** | 自动高亮关键词，标注顶级作者、顶会信息 |
| 📊 **统计图表** | 每日论文趋势、领域分布、精选比例可视化 |
| 🔖 **论文收藏** | 本地收藏感兴趣的论文，支持导出为文本 |
| 🌙 **深色 / 浅色模式** | 自动记忆主题偏好 |
| 📐 **LaTeX 渲染** | 摘要中的数学公式自动渲染 |

---

## 追踪领域

| 领域 | 每日上限 | arXiv 查询条件 |
|------|:-------:|--------------|
| Robotics | 300 | `cs.RO` |
| 3D Vision | 120 | `cs.CV` ∩ (3D / reconstruction / multiview) |
| NeRF | 80 | (`cs.CV` ∪ `cs.GR`) ∩ (NeRF / neural radiance) |
| Gaussian Splatting | 60 | (`cs.CV` ∪ `cs.GR`) ∩ gaussian splatting |
| Video World Models | 100 | (`cs.CV` ∪ `cs.AI` ∪ `cs.LG` ∪ `cs.RO`) ∩ video world model |
| Embodied Intelligence | 50 | (`cs.RO` ∪ `cs.AI`) ∩ (embodied / manipulation / VLA / dexterous) |
| End-to-End AD | 50 | (`cs.CV` ∪ `cs.RO`) ∩ (end-to-end / BEV / occupancy / planning) |
| Foundation Models | 50 | (`cs.RO` ∪ `cs.AI` ∪ `cs.LG`) ∩ (foundation model / multimodal) |
| Computation and Language | 150 | `cs.CL` |
| Information Retrieval | 150 | `cs.IR` |
| Machine Learning | 150 | `cs.LG` |
| Multimedia | 150 | `cs.MM` |

论文标注说明：

- `★★` — 顶级作者 **且** 来自顶级机构
- `★` — 顶级作者 **或** 来自顶级机构
- `CVPR 2025` 等蓝色标签 — 已在顶会 / 期刊发表
- `♻` — 已更新版本

---

## 使用说明

- 点击**标题**展开论文，查看作者、摘要及操作按钮
- 点击 **arXiv / PDF** 按钮跳转到对应页面
- 点击 **AI 中文摘要** 按钮跳转到 Claude 并预填摘要
- 点击 **🔖** 按钮收藏论文，在收藏夹面板中统一管理
- 按 `/` 快速聚焦搜索框，支持搜索标题 / 作者 / 摘要 / 会议名
- 按 `Tab` 展开 / 折叠所有论文
- 点击顶栏 **⭐ 精选** 只显示顶会 / 大牛论文
- 点击顶栏 **📊** 图标查看统计仪表盘

---

## 快速上手（Fork 此项目）

**1. Fork 仓库**

点击右上角 Fork，将仓库复制到你的 GitHub 账号下。

**2. 修改 `config.toml` 中的 cache_url**

```toml
cache_url = "https://<your-username>.github.io/<your-reponame>/cache.json"
```

**3. 开启 GitHub Pages**

进入仓库 → Settings → Pages，将 Branch 设置为 `gh-pages`。

首次 Build 完成后，访问 `https://<your-username>.github.io/<your-reponame>/` 即可。

---

## 定制化指南

### 修改追踪领域

编辑 `config.toml`，按需增删 `[[sources]]` 条目：

```toml
[[sources]]
limit = 100           # 每日最多抓取数量
category = "cs.RO"    # arXiv 分类或复合查询表达式
title = "Robotics"    # 页面显示的领域名称
```

复合查询示例（支持布尔表达式）：

```toml
category = "(cat:cs.CV)+AND+(3D+OR+reconstruction)"
```

### 修改高亮关键词 / 作者 / 顶会

编辑 `scripts/config.rhai`：

```js
// 标题高亮关键词（按类别组织）
let titles_method = ["Diffusion", "Gaussian Splatting", "VLA", "NeRF"];
let titles_type   = ["Survey", "Dataset", "Benchmark"];
let titles_model  = ["GPT", "CLIP", "SAM", "DINO"];
let titles = titles_method + titles_type + titles_model;

// 高亮作者
let authors_array = ["Yue Wang", "Marco Pavone", "Pieter Abbeel"];

// 顶会列表（已内置主流 AI 会议，可自行增补）
let conferences = ["CVPR", "ICCV", "ECCV", "NeurIPS", "ICRA", "IROS", ...];
```

### 修改更新时间

编辑 `.github/workflows/update-feed.yml`：

```yaml
- cron: "0 2 * * *"  # UTC 每天 02:00（即北京时间 10:00）
```

可使用 [crontab.guru](https://crontab.guru/) 生成 cron 表达式。

### 修改缓存天数

编辑 `config.toml`：

```toml
limit_days = 30   # 保留最近 N 天的论文
```

---

## 项目结构

```
3DArxiv/
├── config.toml                   # 主配置：领域、缓存天数、站点标题
├── scripts/
│   ├── config.rhai               # 高亮关键词、作者、顶会列表
│   ├── highlight_title.rhai
│   ├── highlight_author.rhai
│   └── highlight_conference.rhai
├── includes/
│   └── index.hbs                 # Handlebars HTML 模板
├── statics/
│   ├── index.css                 # 样式（学术专业风，深色/浅色双主题）
│   └── index.js                  # 搜索、过滤、图表、收藏等交互逻辑
└── .github/workflows/
    └── update-feed.yml           # GitHub Actions 自动更新流程
```

---

## 致谢

本项目基于 [MLNLP-World/MyArxiv](https://github.com/MLNLP-World/MyArxiv) 构建，核心抓取流程由 [ArxivFeed](https://github.com/NotCraft/ArxivFeed) 驱动，前端经过完整重新设计。感谢原项目的开源工作。
