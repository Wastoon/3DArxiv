# MyArxiv Pro - 完整升级指南

## 📦 包含内容

本升级包包含以下文件：

1. **index_new.html** - 全新的现代化 UI 界面
2. **search-sort.js** - 搜索、排序、收藏系统
3. **highlight_config.rhai** - 改进的高亮规则
4. **api-integration.js** - Semantic Scholar & arXiv API 集成

---

## 🚀 快速开始

### 1. 替换前端文件

```bash
# 备份原有文件
cp includes/index.hbs includes/index.hbs.backup

# 使用新的 HTML 文件
cp index_new.html includes/index.hbs
```

### 2. 添加新的 JavaScript 模块

```bash
# 创建 js 目录
mkdir -p statics/js

# 复制 JavaScript 文件
cp search-sort.js statics/js/
cp api-integration.js statics/js/
```

### 3. 更新 HTML 中的脚本引入

在 `index_new.html` 的 `<head>` 中添加：

```html
<script src="./js/search-sort.js"></script>
<script src="./js/api-integration.js"></script>
```

### 4. GitHub Actions 工作流更新（可选）

在 `.github/workflows/update-feed.yml` 中添加数据增强步骤：

```yaml
- name: Enhance paper data
  run: |
    node scripts/enhance-papers.js
```

---

## ✨ 新增功能详解

### 1. 现代化 UI 设计

**特性：**
- 🎨 渐变背景和卡片设计
- 🌓 深色/浅色模式
- 📱 完全响应式布局
- ⚡ 流畅的交互动画

**使用方式：**
- 点击右上角 🌙 按钮切换主题
- 论文卡片悬停显示阴影效果
- 标签页切换流畅过渡

### 2. 智能搜索系统

**功能：**
- 📖 全文模糊搜索（标题、摘要、作者、关键词）
- 🎯 实时搜索结果
- 🔗 支持高级搜索操作符

**代码示例：**

```javascript
// 初始化搜索引擎
const searchEngine = new PaperSearchEngine(allPapers);

// 基础搜索
const results = searchEngine.search('attention transformer');

// 高级搜索
const advanced = searchEngine.advancedSearch({
    keyword: 'language model',
    author: 'Yoshua Bengio',
    conference: 'NeurIPS',
    dateFrom: '2023-01-01',
    dateTo: '2024-01-01',
    citationsMin: 10
});
```

### 3. 智能排序引擎

**排序方式：**
- 📅 **按日期** - 最新发布优先
- 📊 **按引用数** - 高被引用论文优先
- 📈 **按热度** - 综合热度评分
- 🎯 **按相关性** - 搜索时自动评分

**热度算法：**
```
热度分数 = (引用数评分 × 0.7 + 浏览量评分 × 0.3) × 时间加权
```

### 4. 论文收藏系统

**功能：**
- ⭐ 保存感兴趣的论文
- 🏷️ 添加自定义标签
- 📝 记录个人笔记
- 📊 按标签分类查看

**代码示例：**

```javascript
// 初始化收藏管理器
const bookmarks = new BookmarkManager();

// 添加收藏
bookmarks.add('2301.00001', 
    { title: 'Paper Title' },
    ['NLP', 'Important'],
    'This paper is about...'
);

// 查询收藏
const savedPapers = bookmarks.getAll();

// 按标签筛选
const nlpPapers = bookmarks.filterByTag('NLP');

// 导出为 BibTeX
const bibtex = bookmarks.exportBibTeX(allPapers);
```

### 5. 高质量数据集成

#### Semantic Scholar API

获取论文引用数、影响力等信息：

```javascript
const semanticScholar = new SemanticScholarAPI();

// 获取单篇论文
const paper = await semanticScholar.getPaperByArxiv('2301.00001');
console.log(paper.citationCount);     // 引用数
console.log(paper.influentialCitationCount);  // 有影响力的引用

// 搜索论文
const results = await semanticScholar.searchPapers('attention mechanism', 10);

// 获取论文关系
const citations = await semanticScholar.getPaperCitations('arxiv:2301.00001');
```

#### arXiv API

直接从 arXiv 获取最新论文：

```javascript
const arxiv = new ArXivAPI();

// 获取特定分类的最新论文
const papers = await arxiv.getLatestByCategory('cs.CL', 20);

// 按关键词搜索
const results = await arxiv.searchByKeyword('transformer', 10);

// 获取论文详情
const paper = await arxiv.getPaperDetails('2301.00001');
```

#### 综合数据增强

```javascript
const enhancer = new PaperEnhancer();

// 增强单篇论文
const enriched = await enhancer.enhancePaper(paper);

// 批量增强
const enrichedPapers = await enhancer.enhancePapersBatch(papers);
```

### 6. 改进的高亮规则

**新增高亮类别：**
- 🤖 **模型** - BERT, GPT, Transformer, ViT, CLIP, LLaMA 等
- 🔧 **方法** - Pre-training, Fine-tuning, Prompt, RLHF 等
- 📊 **论文类型** - Dataset, Benchmark, Survey, Analysis 等
- 🎯 **应用** - QA, Summarization, Image Generation, Dialogue 等
- 👨‍🔬 **作者** - 扩展的高影响力研究者列表
- 🏆 **会议** - ACL, CVPR, NeurIPS, ICCV 等顶级会议

### 7. 统计仪表板

**展示内容：**
- 📚 按分类统计论文数
- 🏆 各会议论文分布
- 👥 顶级作者排行
- 📈 论文发布时间线

---

## 📊 数据结构

### 论文对象格式

```javascript
{
    id: "2301.00001",              // 论文 ID
    title: "Paper Title",          // 标题
    authors: ["Author 1", ...],    // 作者列表
    abstract: "Summary...",        // 摘要
    date: "2023-01-01",           // 发表日期
    url: "https://arxiv.org/...",  // 论文链接
    category: "cs.CL",             // 分类
    conference: "NeurIPS 2022",    // 会议/期刊
    
    // 来自 Semantic Scholar 的数据
    citations: 42,                 // 引用次数
    influentialCitations: 5,       // 有影响力的引用
    
    // 计算字段
    relevance: 0.95,               // 相关性评分
    views: 1000,                   // 浏览量
    isNew: true,                   // 是否新发布
    isUpdated: false               // 是否已更新
}
```

### 收藏对象格式

```javascript
{
    paperId: "2301.00001",
    title: "Paper Title",
    tags: ["NLP", "Important"],
    notes: "Personal notes...",
    savedAt: "2024-01-15T10:30:00Z",
    readStatus: "unread"  // 'unread', 'reading', 'read'
}
```

---

## 🔧 配置与自定义

### 1. 修改搜索权重

在 `search-sort.js` 中：

```javascript
// 修改 Fuse.js 配置
keys: [
    { name: 'title', weight: 0.5 },      // 提高标题权重
    { name: 'abstract', weight: 0.2 },   // 降低摘要权重
    { name: 'authors', weight: 0.2 },
    { name: 'keywords', weight: 0.1 }
]
```

### 2. 自定义高亮规则

在 `highlight_config.rhai` 中添加：

```rhai
let custom_keywords = [
    "Your Custom Model",
    "Your Method",
    "Your Application"
];

let titles = titles_model + custom_keywords;
```

### 3. 自定义 UI 颜色

在 `index_new.html` 中修改 CSS 变量：

```css
:root {
    --primary: #your-color;
    --secondary: #your-accent;
    --accent: #your-highlight;
    /* ... */
}
```

### 4. 调整 API 速率限制

在 `api-integration.js` 中：

```javascript
// Semantic Scholar
semanticScholar.rateLimitDelay = 200;  // 毫秒

// 请求超时
const timeout = 10000;  // 10秒
```

---

## 📈 性能优化

### 1. 本地缓存

Semantic Scholar 数据自动缓存在内存中：

```javascript
const size = semanticScholar.getCacheSize();
console.log(`Cached ${size} papers`);

// 手动导出缓存
const cacheJson = semanticScholar.exportCache();
localStorage.setItem('ssCache', cacheJson);

// 导入缓存
semanticScholar.importCache(cacheJson);
```

### 2. 虚拟滚动（大数据集优化）

对于超过 1000 篇论文，建议启用虚拟滚动：

```javascript
// 使用第三方库如 vue-virtual-scroller
import VirtualScroller from 'vue-virtual-scroller';
```

### 3. 搜索索引预构建

```javascript
// 应用启动时预构建索引
const searchEngine = new PaperSearchEngine(allPapers);
// Fuse.js 自动建立索引，首次搜索会稍慢
```

---

## 🔌 集成示例

### 完整的页面初始化

```javascript
// 1. 加载数据
const papers = await fetch('./cache.json').then(r => r.json());

// 2. 初始化搜索引擎
const searchEngine = new PaperSearchEngine(papers);

// 3. 初始化收藏管理
const bookmarks = new BookmarkManager();

// 4. 初始化数据增强器（可选）
const enhancer = new PaperEnhancer();
const enrichedPapers = await enhancer.enhancePapersBatch(papers);

// 5. 渲染页面
renderPapers(enrichedPapers);
```

### 集成到现有项目

如果你使用 React / Vue：

```javascript
// React 示例
import { PaperSearchEngine, BookmarkManager } from './search-sort.js';
import { PaperEnhancer } from './api-integration.js';

function MyArxiv() {
    const [papers, setPapers] = useState([]);
    const [searchEngine] = useState(new PaperSearchEngine(papers));
    const [bookmarks] = useState(new BookmarkManager());

    // 搜索处理
    const handleSearch = (query) => {
        const results = searchEngine.search(query);
        setPapers(results);
    };

    // 收藏处理
    const handleBookmark = (paperId) => {
        bookmarks.add(paperId);
    };

    return (
        <div>
            {/* UI 组件 */}
        </div>
    );
}
```

---

## 🐛 故障排除

### 问题 1: API 请求超时

**解决方案：**
```javascript
// 增加超时时间
const timeout = 15000;  // 15秒

// 或启用请求重试
async function fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fetch(url);
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}
```

### 问题 2: 搜索结果不准确

**解决方案：**
```javascript
// 调整 Fuse.js 阈值
fuse = new Fuse(papers, {
    threshold: 0.1  // 降低阈值以获得更多结果
});
```

### 问题 3: 缓存过大

**解决方案：**
```javascript
// 定期清理缓存
function clearOldCache() {
    const cacheSize = semanticScholar.getCacheSize();
    if (cacheSize > 1000) {
        semanticScholar.clearCache();
    }
}
```

---

## 📚 API 文档速查

### PaperSearchEngine

| 方法 | 说明 | 示例 |
|------|------|------|
| `search(query)` | 模糊搜索 | `search('attention')` |
| `advancedSearch(filters)` | 高级搜索 | `advancedSearch({keyword, author, conference})` |
| `sort(papers, sortBy, ascending)` | 排序 | `sort(papers, 'citations', false)` |
| `getStats()` | 获取统计 | `getStats()` |

### BookmarkManager

| 方法 | 说明 | 示例 |
|------|------|------|
| `add(paperId, paperData, tags, notes)` | 添加收藏 | `add('2301.00001', {...}, ['tag1'])` |
| `remove(paperId)` | 删除收藏 | `remove('2301.00001')` |
| `addTag(paperId, tag)` | 添加标签 | `addTag('2301.00001', 'important')` |
| `getAll()` | 获取所有收藏 | `getAll()` |
| `exportJSON()` | 导出 JSON | `exportJSON()` |
| `exportBibTeX(papers)` | 导出 BibTeX | `exportBibTeX(papers)` |

### SemanticScholarAPI

| 方法 | 说明 | 示例 |
|------|------|------|
| `getPaper(paperId)` | 获取论文 | `getPaper('arxiv:2301.00001')` |
| `searchPapers(query, limit)` | 搜索 | `searchPapers('attention', 10)` |
| `getPaperCitations(paperId)` | 获取引用 | `getPaperCitations('arxiv:2301.00001')` |
| `getAuthorPapers(authorId)` | 获取作者论文 | `getAuthorPapers('author123')` |

---

## 💡 最佳实践

1. **使用本地缓存** - 减少 API 调用
2. **异步加载** - 不阻塞 UI
3. **输入验证** - 检查用户输入
4. **错误处理** - 使用 try-catch
5. **性能监控** - 记录 API 响应时间

---

## 📄 许可证

此升级基于原项目，遵循 GPL-2.0 许可证。

---

## 🤝 贡献

欢迎提交 PR 和 Issue！

---

## 📞 支持

有问题？查看 GitHub Issues 或提交新问题。

---

**最后更新：2024年1月** ✨
