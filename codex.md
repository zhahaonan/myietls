# MyIELTS Voice — 项目结构与流程梳理

## 总览
- 前端：React + Vite（TypeScript），位于项目根目录。
- 后端：FastAPI（Python），位于 `backend/`，提供 OpenAI 风格的 `/v1/chat/completions`。
- AI/语音：前后端使用 Gemini；前端使用阿里云 TTS，并带浏览器语音合成回退。

## 顶层结构
- `App.tsx`：应用主入口与流程编排（学生/教师视图、tab、成就、导出等）。
- `index.tsx`：React 入口挂载。
- `components/`：UI 模块（训练、模考、错题、教师等）。
- `constants.tsx`：静态数据与题库初始配置。
- `types.ts`：前端共享类型定义。
- `services/`：前端服务层（API 调用、音频工具）。
- `engine/`：前端 AI/TTS 工具封装。
- `backend/`：FastAPI 服务与多智能体评测管线。

## 前端模块
- `App.tsx`
  - 负责主 UI 流程：建档、策略引导、学生/教师视图切换。
  - 管理全局状态：用户资料、成就、模考结果、tab 选择等。
- `components/ProfileSetup.tsx`
  - 采集用户画像与目标分数。
- `components/PracticeBank.tsx`
  - 训练主流程（P1/P2/P3）。
  - 使用 Gemini 在前端润色答案并生成像素风图像。
  - 录音并调用后端评测。
- `components/MockTest.tsx`
  - 全流程模考：TTS 播报、录音、提交评测、成绩回显。
- `components/MistakeNotebook.tsx`
  - 错题回顾与标记已练。
- `components/TeacherDashboard.tsx`
  - 教师端展示（当前为占位/汇总）。
- `components/PixelAvatar.tsx`
  - 头像渲染。

## 前端服务层
- `services/apiService.ts`
  - `callIELTSAgent(...)` 向 `http://localhost:8000/v1/chat/completions` 提交 `audio + part + question + level`。
  - 解析 OpenAI 风格返回：转写、分数、智能体思考、反馈、XP。
  - `speakWithAliyun(...)` 调用 `engine/TTSProvider`。
- `services/audioService.ts`
  - PCM 编解码与音频缓冲处理。

## 前端 AI 工具
- `engine/LLMProvider.ts`
  - 基于 `@google/genai` 的多角色封装。
- `engine/RAGProvider.ts`
  - 轻量 RAG 逻辑（本地片段过滤，偏示例）。
- `engine/TTSProvider.ts`
  - 阿里云 DashScope TTS（失败时回退浏览器 `SpeechSynthesis`）。

## 后端结构
- `backend/main.py`
  - FastAPI 应用。
  - `POST /v1/chat/completions`：接收音频与元数据，返回 OpenAI 风格结果。
  - `GET /api/question-bank`：返回题库 JSON。
- `backend/engine/camel_agents.py`
  - “CAMEL”多智能体评测流程：
    - Gemini 音频 STT 转写。
    - RAG 检索。
    - Examiner + Critic + GM 产出分数与反馈 JSON。
- `backend/engine/rag.py`
  - 简化版 RAG + 题库加载。
- `backend/engine/providers.py`
  - 抽象 Provider 定义与 Groq 模拟实现。
- `backend/engine/graph.py`
  - LangGraph 实验管线（当前未在 `main.py` 默认启用）。

## 核心用户流程（学生端）
1. **建档**
   - `ProfileSetup` 采集用户资料与目标。
2. **策略引导**
   - `CoreStrategyGuide` 使用 `constants.tsx` 的策略题。
3. **练习题库**
   - 选择 P1/P2/P3 与题目/素材。
   - Gemini 润色答案 + 生成像素图。
   - 录音并调用后端评测。
   - 展示智能体思考、转写高亮、更新错题与 XP。
4. **模考**
   - 考官 TTS 播报。
   - 录音上传评测。
   - 成绩反馈更新历史与成就。
5. **错题本**
   - 回顾并标记已练的错误。

## 后端评测流程
1. 前端提交音频与题目信息到 `/v1/chat/completions`。
2. `CamelIELTSAgent`：
   - Gemini 音频 STT → 转写。
   - RAG 获取相应评分提示。
   - Examiner + Critic + GM 合成 JSON 结果。
3. 返回 OpenAI 风格结构：
   - `choices[0].message.content`：最终反馈
   - `choices[0].message.metadata`：转写、分数、思考链、XP
4. 前端解析并展示。

## 运行提示
- 前端：`npm run dev`
- 后端：`uvicorn` 监听 `0.0.0.0:8000`
- 依赖 `API_KEY`（前后端 Gemini）。
- `engine/TTSProvider.ts` 内有阿里云 TTS Key（硬编码）。
