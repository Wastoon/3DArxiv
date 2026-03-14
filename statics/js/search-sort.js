/**
 * MyArxiv - Advanced Search & Sort Module
 * 提供论文搜索、排序、过滤功能
 */

class PaperSearchEngine {
    constructor(papers = []) {
        this.papers = papers;
        this.initFuseIndex();
    }

    /**
     * 初始化 Fuse.js 搜索索引
     */
    initFuseIndex() {
        this.fuse = new Fuse(this.papers, {
            keys: [
                { name: 'title', weight: 0.4 },
                { name: 'abstract', weight: 0.3 },
                { name: 'authors', weight: 0.2 },
                { name: 'keywords', weight: 0.1 }
            ],
            threshold: 0.3,
            minMatchCharLength: 2,
            ignoreLocation: true,
            useExtendedSearch: true // 支持 'title:xxx' 这样的高级搜索
        });
    }

    /**
     * 模糊搜索
     * @param {string} query - 搜索查询
     * @returns {Array} 搜索结果
     */
    search(query) {
        if (!query.trim()) return this.papers;
        return this.fuse.search(query).map(result => ({
            ...result.item,
            score: result.score
        }));
    }

    /**
     * 高级搜索 - 支持多个过滤条件
     * @param {Object} filters - 过滤条件对象
     * @returns {Array} 过滤后的论文
     */
    advancedSearch(filters) {
        let results = this.papers;

        // 关键词搜索
        if (filters.keyword) {
            results = this.search(filters.keyword);
        }

        // 作者过滤
        if (filters.author) {
            results = results.filter(p =>
                p.authors.some(a =>
                    a.toLowerCase().includes(filters.author.toLowerCase())
                )
            );
        }

        // 会议/期刊过滤
        if (filters.conference) {
            results = results.filter(p =>
                p.conference?.toLowerCase().includes(filters.conference.toLowerCase())
            );
        }

        // 日期范围过滤
        if (filters.dateFrom) {
            results = results.filter(p => new Date(p.date) >= new Date(filters.dateFrom));
        }
        if (filters.dateTo) {
            results = results.filter(p => new Date(p.date) <= new Date(filters.dateTo));
        }

        // 引用数范围
        if (filters.citationsMin !== undefined) {
            results = results.filter(p => (p.citations || 0) >= filters.citationsMin);
        }
        if (filters.citationsMax !== undefined) {
            results = results.filter(p => (p.citations || 0) <= filters.citationsMax);
        }

        // 分类过滤
        if (filters.categories && filters.categories.length > 0) {
            results = results.filter(p => filters.categories.includes(p.category));
        }

        return results;
    }

    /**
     * 排序论文
     * @param {Array} papers - 论文数组
     * @param {string} sortBy - 排序方式
     * @param {boolean} ascending - 是否升序
     * @returns {Array} 排序后的论文
     */
    sort(papers = this.papers, sortBy = 'date', ascending = false) {
        const sorted = [...papers];

        const compareFn = (a, b) => {
            let aVal, bVal;

            switch (sortBy) {
                case 'date':
                    aVal = new Date(a.date);
                    bVal = new Date(b.date);
                    break;
                case 'citations':
                    aVal = a.citations || 0;
                    bVal = b.citations || 0;
                    break;
                case 'title':
                    aVal = a.title.toLowerCase();
                    bVal = b.title.toLowerCase();
                    break;
                case 'relevance':
                    aVal = a.relevance || 0;
                    bVal = b.relevance || 0;
                    break;
                case 'views':
                    aVal = a.views || 0;
                    bVal = b.views || 0;
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return ascending ? -1 : 1;
            if (aVal > bVal) return ascending ? 1 : -1;
            return 0;
        };

        return sorted.sort(compareFn);
    }

    /**
     * 计算论文相关性分数
     * @param {Object} paper - 论文对象
     * @param {Array} keywords - 关键字数组
     * @returns {number} 相关性分数 (0-1)
     */
    calculateRelevance(paper, keywords = []) {
        let score = 0;
        const titleWeight = 0.4;
        const abstractWeight = 0.3;
        const authorWeight = 0.2;
        const keywordWeight = 0.1;

        const titleLower = paper.title.toLowerCase();
        const abstractLower = (paper.abstract || '').toLowerCase();

        keywords.forEach(keyword => {
            const keywordLower = keyword.toLowerCase();

            if (titleLower.includes(keywordLower)) {
                score += titleWeight / keywords.length;
            }
            if (abstractLower.includes(keywordLower)) {
                score += abstractWeight / keywords.length;
            }
            if (paper.authors.some(a => a.toLowerCase().includes(keywordLower))) {
                score += authorWeight / keywords.length;
            }
            if (paper.keywords?.some(k => k.toLowerCase().includes(keywordLower))) {
                score += keywordWeight / keywords.length;
            }
        });

        return Math.min(score, 1);
    }

    /**
     * 热度评分 (基于引用数和浏览量)
     * @param {Object} paper - 论文对象
     * @returns {number} 热度分数
     */
    calculateTrendingScore(paper) {
        const citationWeight = 0.7;
        const viewWeight = 0.3;
        const recencyBoost = this.getRecencyBoost(paper.date);

        const maxCitations = Math.max(...this.papers.map(p => p.citations || 0)) || 1;
        const maxViews = Math.max(...this.papers.map(p => p.views || 0)) || 1;

        const citationScore = (paper.citations || 0) / maxCitations;
        const viewScore = (paper.views || 0) / maxViews;

        return (citationScore * citationWeight + viewScore * viewWeight) * recencyBoost;
    }

    /**
     * 新近性加权 (最近的论文获得更高分)
     * @param {string} date - 发表日期
     * @returns {number} 加权系数
     */
    getRecencyBoost(date) {
        const daysPassed = Math.floor(
            (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
        );

        // 今天: 1.5, 7天前: 1.0, 30天前: 0.8
        if (daysPassed <= 1) return 1.5;
        if (daysPassed <= 7) return 1.0 + (7 - daysPassed) / 7 * 0.5;
        if (daysPassed <= 30) return 0.8 + (30 - daysPassed) / 30 * 0.2;
        return 0.6;
    }

    /**
     * 获取统计数据
     * @returns {Object} 统计信息
     */
    getStats() {
        const stats = {
            total: this.papers.length,
            byCategory: {},
            byConference: {},
            byDate: {},
            topAuthors: {},
            avgCitations: 0,
            totalCitations: 0
        };

        this.papers.forEach(paper => {
            // 按分类统计
            stats.byCategory[paper.category] = (stats.byCategory[paper.category] || 0) + 1;

            // 按会议统计
            if (paper.conference) {
                stats.byConference[paper.conference] = (stats.byConference[paper.conference] || 0) + 1;
            }

            // 按作者统计
            paper.authors.forEach(author => {
                stats.topAuthors[author] = (stats.topAuthors[author] || 0) + 1;
            });

            // 按日期统计
            const dateKey = new Date(paper.date).toLocaleDateString('zh-CN');
            stats.byDate[dateKey] = (stats.byDate[dateKey] || 0) + 1;

            // 引用统计
            const citations = paper.citations || 0;
            stats.totalCitations += citations;
        });

        stats.avgCitations = Math.round(stats.totalCitations / stats.total);
        stats.topAuthors = Object.entries(stats.topAuthors)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .reduce((obj, [author, count]) => {
                obj[author] = count;
                return obj;
            }, {});

        return stats;
    }
}

/**
 * 收藏系统管理
 */
class BookmarkManager {
    constructor(storageKey = 'myarxiv_bookmarks') {
        this.storageKey = storageKey;
        this.bookmarks = this.load();
    }

    /**
     * 从 localStorage 加载收藏
     */
    load() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        } catch {
            return {};
        }
    }

    /**
     * 保存到 localStorage
     */
    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.bookmarks));
    }

    /**
     * 添加或更新收藏
     */
    add(paperId, paperData = {}, tags = [], notes = '') {
        this.bookmarks[paperId] = {
            paperId,
            ...paperData,
            tags: tags || [],
            notes: notes || '',
            savedAt: new Date().toISOString(),
            readStatus: 'unread' // 'unread', 'reading', 'read'
        };
        this.save();
        return this.bookmarks[paperId];
    }

    /**
     * 删除收藏
     */
    remove(paperId) {
        delete this.bookmarks[paperId];
        this.save();
    }

    /**
     * 检查是否已收藏
     */
    exists(paperId) {
        return paperId in this.bookmarks;
    }

    /**
     * 获取所有收藏
     */
    getAll() {
        return Object.values(this.bookmarks);
    }

    /**
     * 按标签筛选收藏
     */
    filterByTag(tag) {
        return Object.values(this.bookmarks).filter(b =>
            b.tags.includes(tag)
        );
    }

    /**
     * 添加标签
     */
    addTag(paperId, tag) {
        if (this.bookmarks[paperId]) {
            if (!this.bookmarks[paperId].tags.includes(tag)) {
                this.bookmarks[paperId].tags.push(tag);
                this.save();
            }
        }
    }

    /**
     * 移除标签
     */
    removeTag(paperId, tag) {
        if (this.bookmarks[paperId]) {
            this.bookmarks[paperId].tags = this.bookmarks[paperId].tags.filter(t => t !== tag);
            this.save();
        }
    }

    /**
     * 更新笔记
     */
    updateNotes(paperId, notes) {
        if (this.bookmarks[paperId]) {
            this.bookmarks[paperId].notes = notes;
            this.save();
        }
    }

    /**
     * 更新阅读状态
     */
    setReadStatus(paperId, status) {
        if (this.bookmarks[paperId]) {
            this.bookmarks[paperId].readStatus = status;
            this.save();
        }
    }

    /**
     * 导出为 JSON
     */
    exportJSON() {
        return JSON.stringify(this.bookmarks, null, 2);
    }

    /**
     * 导出为 BibTeX
     */
    exportBibTeX(papers) {
        let bibtex = '';
        Object.keys(this.bookmarks).forEach(paperId => {
            const paper = papers.find(p => p.id === paperId);
            if (paper) {
                bibtex += `@article{${paperId},\n`;
                bibtex += `  title={${paper.title}},\n`;
                bibtex += `  author={${paper.authors.join(' and ')}},\n`;
                bibtex += `  year={${new Date(paper.date).getFullYear()}},\n`;
                bibtex += `  journal={${paper.category}}\n`;
                bibtex += `}\n\n`;
            }
        });
        return bibtex;
    }

    /**
     * 统计信息
     */
    getStats() {
        const bookmarks = Object.values(this.bookmarks);
        return {
            total: bookmarks.length,
            byTag: bookmarks.reduce((obj, b) => {
                b.tags.forEach(tag => {
                    obj[tag] = (obj[tag] || 0) + 1;
                });
                return obj;
            }, {}),
            byReadStatus: bookmarks.reduce((obj, b) => {
                obj[b.readStatus] = (obj[b.readStatus] || 0) + 1;
                return obj;
            }, {}),
            totalNotes: bookmarks.filter(b => b.notes).length
        };
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PaperSearchEngine, BookmarkManager };
}
