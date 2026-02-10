---
title: MyIELTS Voice
emoji: 🎙️
colorFrom: blue
colorTo: indigo
sdk: gradio
app_file: app.py
pinned: false
---

# MyIELTS Voice 雅思口语智能教练

<div align="center">
  <h3>🎮 游戏化驱动 · 🤖 全员 AI 赋能 · 🎯 沉浸式备考</h3>
  <p>基于 Gemini + Multi-Agent 架构的新一代雅思口语备考平台</p>
</div>

## ✨ 核心特性

- **🤖 全 AI 驱动 (AI-Native)**
  - **听**: Gemini Native Audio 实时语音识别，精准捕捉口音与停顿。
  - **说**: DashScope (阿里灵积) 高保真语音合成，提供英/美/澳/印四种考官口音。
  - **想**: CAMEL 多智能体架构 (考官 + 评论家 + GM) 互相博弈，提供最客观的评分与建议。
  - **看**: 实时生成像素风场景插图，通过视觉锚点辅助记忆素材。

- **🎮 游戏化体验**
  - **RPG 升级**: 通过练习获得 XP，解锁成就勋章。
  - **Boss 战**: 模拟真实考试流程，挑战不同性格的 AI 考官。
  - **技能树**: 解锁 "Quick Shot" (短问题) 和 "Linker Master" (衔接词) 等口语技能。

- **📚 智能题库 (RAG)**
  - **Part 1**: 结合个人画像 (Profile) 动态生成高分范例。
  - **Part 2**: 提供万能素材原型 (Hero, Villain, Place...)，以一当十。
  - **Part 3**: 深度辩论模式，锻炼逻辑思维。

## 🤖 多智能体架构 (Multi-Agent System)

本系统采用 **CAMEL Role-Playing** 架构，由三个独立的 AI 智能体协作完成评估：

| 智能体 (Agent) | 角色 (Persona) | 职责 (Responsibility) |
| :--- | :--- | :--- |
| **🕵️ Examiner** | **资深考官** | **初审评分**: 模拟雅思官方标准，负责对流利度 (Fluency)、词汇 (Lexical) 和语法 (Grammar) 进行打分，并生成严谨的评估报告。 |
| **⚖️ Critic** | **语言专家** | **复审 & 升级**: 审查 Examiner 的评分是否准确，并专门负责"语言升级"——找出考生回答中的基础词汇，提供更地道的习语和搭配 (Collocations)。 |
| **🎲 Game Master** | **游戏管理员** | **激励反馈**: 将冷冰冰的分数转化为游戏元素（XP 经验值、金币、成就勋章），并生成具有沉浸感和鼓励性的"氛围感"点评。 |

## 🚀 快速开始

### 1. 环境准备
- Node.js (v18+)
- Python (v3.10+)

### 2. 配置密钥
在项目根目录找到 `.env.local` 文件，填入以下 API Key：

### 3. 启动后端 (Python)
后端负责 AI 评估、语音处理和多智能体逻辑。
```bash
cd backend
pip install -r requirements.txt
python main.py
```
> 后端服务默认运行在 `http://localhost:8000`

### 4. 启动前端 (React + Vite)
前端提供沉浸式的交互界面。
```bash
# 回到项目根目录
npm install
npm run dev
```
> 前端页面默认运行在 `http://localhost:3000`

## 🏗️ 技术栈

### 🎨 前端 (Frontend)
- **核心框架**: [React 19](https://react.dev/) - 使用最新的 Hooks 和 Server Components 特性。
- **构建工具**: [Vite](https://vitejs.dev/) - 极速的开发服务器和打包工具。
- **样式方案**: [TailwindCSS](https://tailwindcss.com/) - 实用优先的 CSS 框架，快速构建现代 UI。
- **数据可视化**: [Recharts](https://recharts.org/) - 用于绘制能力雷达图和波形图。
- **音频处理**: Web Audio API - 原生浏览器音频采集与可视化。

### ⚙️ 后端 (Backend)
- **API 框架**: [FastAPI](https://fastapi.tiangolo.com/) - 高性能的异步 Python Web 框架。
- **AI 编排**: [Google Generative AI SDK](https://ai.google.dev/) - 深度集成 Gemini 模型家族。
- **接口兼容**: OpenAI SDK - 用于兼容智谱 AI 等第三方大模型服务。
- **PDF 处理**: PyPDF - 用于解析和导入雅思题库 PDF 文件。

### 🧠 算法
- **多智能体博弈 (CAMEL)**: 基于角色扮演 (Role-Playing) 的多 Agent 交互框架，通过角色间的对抗与协作产出高质量评估。
- **RAG (检索增强生成)**: 结合向量检索与关键词匹配，将雅思官方评分标准 (Band Descriptors) 动态注入 Prompt。
- **Native Audio STT**: 直接将音频 Token 输入大模型，跳过传统的"语音转文字"文本损耗，保留语调情感信息。
- **TTS (语音合成)**: 集成阿里云 DashScope 语音大模型，支持高表现力的实时语音生成。

## 📂 项目结构

```
myielts-voice/
├── backend/               # Python 后端
│   ├── engine/            # AI 核心引擎 (Agents, RAG, TTS)
│   ├── data/              # 题库数据
│   └── main.py            # FastAPI 入口
├── components/            # React 组件 (UI)
├── services/              # 前端 API 服务
├── .env.local             # 统一配置文件
└── README.md              # 项目说明
```

## 📝 开发指南

- **添加新题目**: 修改 `backend/data/processed/p1_bank.json`
- **调整评分标准**: 修改 `backend/engine/rag.py` 中的 RAG 逻辑
- **切换 TTS 音色**: 在 `.env.local` 中修改 `DASHSCOPE_TTS_VOICE`

---
*Created with ❤️ for IELTS Fighters*
