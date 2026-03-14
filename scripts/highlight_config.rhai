// MyArxiv Enhanced Highlight Configuration
// 支持更智能的关键词、作者、会议识别

// ========== Title Highlighting ==========
let titles_model = [
    "BERT", "GPT", "T5", "RoBERTa", "XLNet", "ALBERT", "ELECTRA", 
    "Transformer", "Attention", "LSTM", "GRU", "CNN", "RNN",
    "Vision Transformer", "ViT", "DALL-E", "Stable Diffusion", "Diffusion",
    "CLIP", "BLIP", "LLaMA", "Llama", "Alpaca", "Claude", "ChatGPT",
    "Mistral", "Phi", "Qwen", "Gemini", "PaLM", "LaMDA"
];

let titles_method = [
    "Pre-train", "Pretrain", "Pretraining", "Finetuning", "Fine-tune", "Fine-tuning",
    "Prompt", "Prompting", "In-Context Learning", "Few-shot", "Zero-shot",
    "Self-Supervised", "Self-supervised", "Self Supervised",
    "Transfer Learning", "Multi-task", "Multitask", "Instruction Tuning",
    "Reinforcement Learning", "RL", "RLHF", "Distillation", "Knowledge Distillation",
    "Quantization", "Pruning", "Compression", "Efficient", "Optimization"
];

let titles_type = [
    "Dataset", "Benchmark", "Survey", "Tutorial", "Review",
    "Analysis", "Evaluation", "Diagnostic", "Interpretability",
    "Explainability", "Robustness", "Adversarial", "Fairness",
    "Bias", "Ethics", "Federated", "Privacy", "Security"
];

let titles_application = [
    "Question Answering", "QA", "Machine Translation", "Summarization",
    "Sentiment Analysis", "Named Entity Recognition", "NER", 
    "Image Generation", "Image Understanding", "Object Detection",
    "Semantic Segmentation", "Action Recognition", "Pose Estimation",
    "Recommendation", "Ranking", "Information Retrieval", "Search",
    "Speech Recognition", "ASR", "Text-to-Speech", "TTS",
    "Dialogue", "Conversation", "Chatbot", "Multimodal", "Vision-Language"
];

// 合并所有标题高亮关键词
let titles = titles_model + titles_method + titles_type + titles_application;

// ========== Author Highlighting ==========
// 添加更多高影响力研究者
let authors_array = [
    // 深度学习先驱
    "Yann LeCun", "Geoffrey Hinton", "Yoshua Bengio",
    "Andrew Ng", "Ian Goodfellow", "Kaiming He",
    
    // Transformer & NLP
    "Ashish Vaswani", "Attention Is All You Need",
    "Ilya Sutskever", "Andrej Karpathy", "Alec Radford",
    "Tom Brown", "Dario Amodei", "Sam Altman",
    "Yejin Choi", "Noah Smith", "Emily Bender",
    
    // 计算机视觉
    "Ross Girshick", "Sergey Ioffe", "Christian Szegedy",
    "Kaiming He", "Jian Sun", "Xiangyu Zhang",
    
    // 多模态学习
    "Jiasen Lu", "Lei Zhang", "Pengchuan Zhang",
    "Zexian Huang", "Pan Lu",
    
    // 强化学习
    "David Silver", "Thore Graepel", "Oriol Vinyals",
    "OpenAI", "DeepMind", "Meta AI", "Anthropic"
];

// ========== Conference & Journal Highlighting ==========
let conferences = [
    // Top-tier NLP
    "ACL", "EMNLP", "NAACL", "LREC", "COLING",
    
    // Top-tier Vision
    "CVPR", "ICCV", "ECCV", "ICCVW",
    
    // Top-tier ML
    "ICML", "NeurIPS", "ICLR", "JMLR",
    
    // General AI
    "IJCAI", "AAAI", "ICAPS", "UAI", "AISTATS",
    
    // Multimodal & New
    "MMVPR", "SIGGRAPH", "MM", "IUAAI",
    
    // Specialized
    "TACL", "JAIR", "Machine Learning", "Science", "Nature",
    "PNAS", "IEEE", "ACM", "NIPS", "ICIP", "ISMIR"
];

// ========== 高亮规则执行函数 ==========

// 标题高亮
fn highlight_title(title) {
    let highlighted = title;
    
    // 高亮关键词（从长到短，避免部分匹配）
    let sorted_keywords = titles.sort_by(|a, b| b.len() - a.len());
    
    for keyword in sorted_keywords {
        let pattern = `(?i)\\b${keyword}\\b`;
        highlighted = highlighted.replace(pattern, `<mark class="highlight-keyword">${keyword}</mark>`);
    }
    
    return highlighted;
}

// 作者高亮
fn highlight_author(authors) {
    let highlighted_authors = [];
    
    for author in authors {
        let should_highlight = false;
        
        // 检查是否在高亮作者列表中
        for highlight_author in authors_array {
            if author.to_lower_case().contains(highlight_author.to_lower_case()) {
                should_highlight = true;
                break;
            }
        }
        
        if should_highlight {
            highlighted_authors.push(`<mark class="highlight-author">${author}</mark>`);
        } else {
            highlighted_authors.push(author);
        }
    }
    
    return highlighted_authors;
}

// 会议/期刊高亮
fn highlight_conference(conference) {
    if conference.is_empty() {
        return "";
    }
    
    let conf_lower = conference.to_lower_case();
    
    for conf in conferences {
        if conf_lower.contains(conf.to_lower_case()) {
            return `<mark class="highlight-conference">${conference}</mark>`;
        }
    }
    
    return conference;
}

// ========== 智能提取与预处理 ==========

// 从论文内容提取关键字
fn extract_keywords(title, abstract) {
    let keywords = [];
    let combined = `${title} ${abstract}`;
    
    // 提取所有匹配的模型名称
    for model in titles_model {
        if combined.contains(model) && !keywords.contains(model) {
            keywords.push(model);
        }
    }
    
    // 提取所有匹配的方法
    for method in titles_method {
        if combined.contains(method) && !keywords.contains(method) {
            keywords.push(method);
        }
    }
    
    return keywords;
}

// 计算论文类型
fn classify_paper(title) {
    let paper_type = "Research";
    
    if title.contains("Survey") || title.contains("Review") {
        paper_type = "Survey";
    } else if title.contains("Dataset") || title.contains("Benchmark") {
        paper_type = "Dataset";
    } else if title.contains("Tutorial") || title.contains("Guide") {
        paper_type = "Tutorial";
    } else if title.contains("Analysis") || title.contains("Diagnostic") {
        paper_type = "Analysis";
    }
    
    return paper_type;
}

// ========== 新鲜度标记 ==========

fn get_freshness_badge(publish_date, update_date) {
    let now = current_timestamp();
    let publish_days = days_since(publish_date);
    let update_days = days_since(update_date);
    
    if update_days == 0 {
        return "♻"; // 今天更新
    } else if publish_days == 0 {
        return "✨"; // 今天发布
    } else if publish_days <= 7 {
        return "⭐"; // 最近一周
    }
    
    return ""; // 没有特殊标记
}

// ========== 关联论文识别 ==========

fn identify_related_papers(paper, all_papers) {
    let related = [];
    let keywords = extract_keywords(paper.title, paper.abstract);
    
    for other_paper in all_papers {
        if other_paper.id == paper.id {
            continue;
        }
        
        let match_count = 0;
        for keyword in keywords {
            if other_paper.title.contains(keyword) || other_paper.abstract.contains(keyword) {
                match_count += 1;
            }
        }
        
        // 如果有至少2个关键字匹配，认为相关
        if match_count >= 2 {
            related.push({
                id: other_paper.id,
                title: other_paper.title,
                relevance_score: match_count / keywords.len()
            });
        }
    }
    
    return related.sort_by(|a, b| b.relevance_score - a.relevance_score).slice(0, 5);
}

// ========== 主配置导出 ==========

let config = {
    // 高亮函数
    highlight_functions: {
        title: highlight_title,
        author: highlight_author,
        conference: highlight_conference
    },
    
    // 关键词库
    keywords: {
        models: titles_model,
        methods: titles_method,
        types: titles_type,
        applications: titles_application,
        all: titles
    },
    
    // 作者库
    authors: authors_array,
    
    // 会议库
    conferences: conferences,
    
    // 辅助函数
    utilities: {
        extract_keywords: extract_keywords,
        classify_paper: classify_paper,
        get_freshness_badge: get_freshness_badge,
        identify_related_papers: identify_related_papers
    }
};

// 返回配置对象
config
