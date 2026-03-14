/**
 * Semantic Scholar API Integration
 * 获取论文元数据、引用数、影响力评分等信息
 */

class SemanticScholarAPI {
    constructor() {
        this.baseURL = 'https://api.semanticscholar.org/graph/v1';
        this.paperFields = [
            'paperId', 'title', 'abstract', 'venue', 'year',
            'citationCount', 'influentialCitationCount',
            'authors', 'publicationDate', 'url',
            'externalIds', 'fieldsOfStudy'
        ];
        this.cache = {};
        this.rateLimitDelay = 100; // ms between requests
        this.lastRequestTime = 0;
    }

    /**
     * 获取单篇论文信息
     * @param {string} paperId - Semantic Scholar Paper ID 或 arXiv ID
     * @returns {Promise<Object>} 论文信息
     */
    async getPaper(paperId) {
        // 检查缓存
        if (this.cache[paperId]) {
            return this.cache[paperId];
        }

        try {
            // 速率限制
            await this.rateLimitWait();

            const url = `${this.baseURL}/paper/${paperId}?fields=${this.paperFields.join(',')}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            // 缓存结果
            this.cache[paperId] = data;

            return data;
        } catch (error) {
            console.error(`Failed to fetch paper ${paperId}:`, error);
            return null;
        }
    }

    /**
     * 按 arXiv ID 获取论文
     * @param {string} arxivId - arXiv ID (e.g., "2301.00001")
     * @returns {Promise<Object>} 论文信息
     */
    async getPaperByArxiv(arxivId) {
        return this.getPaper(`arXiv:${arxivId}`);
    }

    /**
     * 批量获取论文信息
     * @param {Array<string>} paperIds - 论文 ID 数组
     * @returns {Promise<Array<Object>>} 论文信息数组
     */
    async getPapersBatch(paperIds) {
        const results = [];
        
        for (const paperId of paperIds) {
            const paper = await this.getPaper(paperId);
            if (paper) {
                results.push(paper);
            }
        }

        return results;
    }

    /**
     * 搜索论文
     * @param {string} query - 搜索查询
     * @param {number} limit - 结果数量限制
     * @returns {Promise<Array<Object>>} 搜索结果
     */
    async searchPapers(query, limit = 10) {
        try {
            await this.rateLimitWait();

            const url = `${this.baseURL}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${this.paperFields.join(',')}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error(`Failed to search papers:`, error);
            return [];
        }
    }

    /**
     * 获取论文引用关系
     * @param {string} paperId - 论文 ID
     * @param {string} type - 'citations' 或 'references'
     * @returns {Promise<Array<Object>>} 引用或参考论文列表
     */
    async getPaperCitations(paperId, type = 'citations', limit = 100) {
        try {
            await this.rateLimitWait();

            const url = `${this.baseURL}/paper/${paperId}/${type}?fields=${this.paperFields.join(',')}&limit=${limit}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error(`Failed to fetch ${type}:`, error);
            return [];
        }
    }

    /**
     * 获取某位作者的论文
     * @param {string} authorId - 作者 ID
     * @returns {Promise<Array<Object>>} 作者的论文列表
     */
    async getAuthorPapers(authorId, limit = 100) {
        try {
            await this.rateLimitWait();

            const url = `${this.baseURL}/author/${authorId}/papers?fields=${this.paperFields.join(',')}&limit=${limit}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error(`Failed to fetch author papers:`, error);
            return [];
        }
    }

    /**
     * 获取作者信息
     * @param {string} authorId - 作者 ID
     * @returns {Promise<Object>} 作者信息
     */
    async getAuthor(authorId) {
        try {
            await this.rateLimitWait();

            const url = `${this.baseURL}/author/${authorId}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Failed to fetch author:`, error);
            return null;
        }
    }

    /**
     * 速率限制等待
     */
    async rateLimitWait() {
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        if (timeSinceLastRequest < this.rateLimitDelay) {
            await new Promise(resolve =>
                setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
            );
        }
        this.lastRequestTime = Date.now();
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.cache = {};
    }

    /**
     * 获取缓存大小
     */
    getCacheSize() {
        return Object.keys(this.cache).length;
    }

    /**
     * 导出缓存为 JSON
     */
    exportCache() {
        return JSON.stringify(this.cache, null, 2);
    }

    /**
     * 从 JSON 导入缓存
     */
    importCache(jsonData) {
        try {
            this.cache = JSON.parse(jsonData);
            return true;
        } catch (error) {
            console.error('Failed to import cache:', error);
            return false;
        }
    }
}

/**
 * arXiv API 集成
 * 从 arXiv 官方 API 获取论文信息
 */
class ArXivAPI {
    constructor() {
        this.baseURL = 'http://export.arxiv.org/api/query?';
    }

    /**
     * 搜索论文
     * @param {Object} options - 搜索选项
     * @returns {Promise<Array<Object>>} 论文列表
     */
    async search(options = {}) {
        const {
            query = '',
            category = '',
            sortBy = 'submittedDate',
            sortOrder = 'descending',
            limit = 10,
            start = 0
        } = options;

        try {
            let searchQuery = '';

            if (category) {
                searchQuery = `cat:${category}`;
            }

            if (query) {
                const queryPart = `(ti:${query} OR abs:${query})`;
                searchQuery = searchQuery ? `${searchQuery} AND ${queryPart}` : queryPart;
            }

            const params = new URLSearchParams({
                search_query: searchQuery,
                sortBy: sortBy,
                sortOrder: sortOrder,
                start: start,
                max_results: limit
            });

            const url = this.baseURL + params.toString();
            const response = await fetch(url);
            const text = await response.text();

            // 解析 XML 响应
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'application/xml');

            const entries = xmlDoc.getElementsByTagName('entry');
            const papers = [];

            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                const paper = {
                    id: entry.getElementsByTagName('id')[0]?.textContent.split('/abs/')[1] || '',
                    title: entry.getElementsByTagName('title')[0]?.textContent || '',
                    authors: Array.from(entry.getElementsByTagName('author')).map(
                        a => a.getElementsByTagName('name')[0]?.textContent || ''
                    ),
                    summary: entry.getElementsByTagName('summary')[0]?.textContent || '',
                    published: entry.getElementsByTagName('published')[0]?.textContent || '',
                    updated: entry.getElementsByTagName('updated')[0]?.textContent || '',
                    pdf_url: entry.getElementsByTagName('link')[0]?.getAttribute('href') || '',
                    arxiv_id: entry.getElementsByTagName('id')[0]?.textContent.split('/abs/')[1] || ''
                };
                papers.push(paper);
            }

            return papers;
        } catch (error) {
            console.error('Failed to fetch from arXiv:', error);
            return [];
        }
    }

    /**
     * 按分类获取最新论文
     */
    async getLatestByCategory(category = 'cs.CL', limit = 10) {
        return this.search({ category, limit });
    }

    /**
     * 按关键词搜索
     */
    async searchByKeyword(keyword, limit = 10) {
        return this.search({ query: keyword, limit });
    }

    /**
     * 获取单篇论文详情
     */
    async getPaperDetails(arxivId) {
        const papers = await this.search({
            query: arxivId,
            limit: 1
        });
        return papers.length > 0 ? papers[0] : null;
    }
}

/**
 * 论文数据增强器 - 综合多个 API 源
 */
class PaperEnhancer {
    constructor() {
        this.semanticScholar = new SemanticScholarAPI();
        this.arxiv = new ArXivAPI();
    }

    /**
     * 增强论文数据
     * @param {Object} paper - 原始论文数据
     * @returns {Promise<Object>} 增强后的论文数据
     */
    async enhancePaper(paper) {
        const enhanced = { ...paper };

        // 从 Semantic Scholar 获取引用数据
        if (paper.arxiv_id) {
            try {
                const ssData = await this.semanticScholar.getPaperByArxiv(paper.arxiv_id);
                if (ssData) {
                    enhanced.citations = ssData.citationCount || 0;
                    enhanced.influentialCitations = ssData.influentialCitationCount || 0;
                    enhanced.fieldsOfStudy = ssData.fieldsOfStudy || [];
                    enhanced.venue = ssData.venue || enhanced.conference || '';
                }
            } catch (error) {
                console.warn(`Failed to enhance paper ${paper.arxiv_id}:`, error);
            }
        }

        return enhanced;
    }

    /**
     * 批量增强论文数据
     * @param {Array<Object>} papers - 论文数组
     * @returns {Promise<Array<Object>>} 增强后的论文数组
     */
    async enhancePapersBatch(papers) {
        const enhanced = [];
        for (const paper of papers) {
            const enrichedPaper = await this.enhancePaper(paper);
            enhanced.push(enrichedPaper);
        }
        return enhanced;
    }

    /**
     * 获取论文的完整信息
     */
    async getFullPaperInfo(arxivId) {
        const paper = await this.arxiv.getPaperDetails(arxivId);
        if (paper) {
            return this.enhancePaper(paper);
        }
        return null;
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SemanticScholarAPI, ArXivAPI, PaperEnhancer };
}
