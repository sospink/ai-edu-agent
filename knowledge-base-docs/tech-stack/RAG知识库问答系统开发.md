# RAG 知识库问答系统开发

## 什么是 RAG？

RAG（Retrieval-Augmented Generation，检索增强生成）是一种结合信息检索和文本生成的技术，让大语言模型能够基于外部知识库回答问题。

## RAG 的工作原理

```
用户问题 → 向量化 → 相似度检索 → 获取相关文档 → 构建 Prompt → LLM 生成回答
```

### 核心流程

1. **文档处理**：将文档分割成小块（chunks）
2. **向量化**：使用 Embedding 模型将文本转为向量
3. **存储**：将向量存入向量数据库
4. **检索**：根据用户问题检索相关文档
5. **生成**：将检索结果和问题一起发给 LLM 生成回答

## 技术栈选择

### Embedding 模型

| 模型 | 特点 | 适用场景 |
|-----|------|---------|
| OpenAI text-embedding-3 | 效果好，需付费 | 生产环境 |
| BGE-large-zh | 中文效果好，开源 | 中文场景 |
| sentence-transformers | 多语言支持 | 通用场景 |
| Jina Embeddings | 长文本支持好 | 长文档 |

### 向量数据库

| 数据库 | 特点 | 适用场景 |
|-------|------|---------|
| Chroma | 轻量级，易上手 | 开发测试 |
| Pinecone | 云服务，免运维 | 快速上线 |
| Milvus | 高性能，可扩展 | 大规模生产 |
| Weaviate | 功能丰富 | 复杂场景 |
| pgvector | PostgreSQL 扩展 | 已有 PG 的项目 |

## 代码实现

### 1. 文档加载和分割

```python
from langchain.document_loaders import TextLoader, PDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter

# 加载文档
loader = TextLoader("knowledge.txt", encoding="utf-8")
documents = loader.load()

# 分割文档
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,      # 每块大小
    chunk_overlap=50,    # 重叠大小
    separators=["\n\n", "\n", "。", "！", "？", "，", " "]
)
chunks = text_splitter.split_documents(documents)
```

### 2. 向量化和存储

```python
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma

# 初始化 Embedding 模型
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",
    openai_api_key="your-api-key"
)

# 创建向量数据库
vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory="./chroma_db"
)

# 持久化
vectorstore.persist()
```

### 3. 检索和问答

```python
from langchain.chat_models import ChatOpenAI
from langchain.chains import RetrievalQA

# 初始化 LLM
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.7
)

# 创建检索器
retriever = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 3}  # 返回最相关的 3 个文档
)

# 创建问答链
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=retriever,
    return_source_documents=True
)

# 提问
result = qa_chain({"query": "什么是 Agent？"})
print(result["result"])
```

## 优化技巧

### 1. 分块策略优化

```python
# 按语义分块
from langchain.text_splitter import SemanticChunker

semantic_splitter = SemanticChunker(
    embeddings=embeddings,
    breakpoint_threshold_type="percentile"
)

# 按标题分块（适合结构化文档）
from langchain.text_splitter import MarkdownHeaderTextSplitter

headers_to_split_on = [
    ("#", "Header 1"),
    ("##", "Header 2"),
    ("###", "Header 3"),
]
markdown_splitter = MarkdownHeaderTextSplitter(
    headers_to_split_on=headers_to_split_on
)
```

### 2. 检索优化

```python
# 混合检索：结合关键词和向量检索
from langchain.retrievers import BM25Retriever, EnsembleRetriever

# BM25 关键词检索
bm25_retriever = BM25Retriever.from_documents(chunks)
bm25_retriever.k = 3

# 向量检索
vector_retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

# 混合检索
ensemble_retriever = EnsembleRetriever(
    retrievers=[bm25_retriever, vector_retriever],
    weights=[0.4, 0.6]
)
```

### 3. 重排序（Reranking）

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import CohereRerank

# 使用 Cohere Rerank
compressor = CohereRerank(
    cohere_api_key="your-cohere-key",
    top_n=3
)

compression_retriever = ContextualCompressionRetriever(
    base_compressor=compressor,
    base_retriever=retriever
)
```

### 4. Prompt 优化

```python
from langchain.prompts import PromptTemplate

template = """你是一个专业的 AI 助手。请根据以下上下文回答用户的问题。

上下文信息：
{context}

用户问题：{question}

回答要求：
1. 只基于上下文信息回答，不要编造
2. 如果上下文中没有相关信息，请说明
3. 回答要简洁准确
4. 适当引用原文

回答："""

prompt = PromptTemplate(
    template=template,
    input_variables=["context", "question"]
)
```

## 评估指标

### 1. 检索质量
- **召回率**：相关文档被检索到的比例
- **精确率**：检索结果中相关文档的比例
- **MRR**：第一个相关结果的排名倒数

### 2. 生成质量
- **准确性**：回答是否正确
- **相关性**：回答是否切题
- **完整性**：回答是否全面
- **忠实度**：是否基于检索内容

## 常见问题

**Q: 检索结果不相关怎么办？**
A: 1) 优化分块策略 2) 调整 Embedding 模型 3) 使用混合检索 4) 添加重排序

**Q: 回答出现幻觉怎么办？**
A: 1) 优化 Prompt，强调只基于上下文 2) 降低温度参数 3) 添加引用来源

**Q: 长文档处理慢怎么办？**
A: 1) 使用异步处理 2) 批量向量化 3) 增量更新索引

## 生产部署建议

1. **向量数据库选型**：根据数据量和查询量选择
2. **缓存策略**：缓存常见问题的答案
3. **监控告警**：监控检索延迟和准确率
4. **A/B 测试**：持续优化检索和生成效果
5. **成本控制**：合理设置 Token 限制
