# MyIELTS Voice 前端部署指南

## 项目概述
这是一个基于React的IELTS口语练习平台前端，可以与部署在魔搭创空间的后端服务进行交互。

## 部署架构
```
前端 (Vite + React) ←→ 魔搭创空间后端 (Gradio + FastAPI)
     ↓
用户浏览器
```

## 环境变量配置

在魔搭创空间部署时，需要设置以下环境变量：

### 必需的环境变量：
- `VITE_API_BASE`: 后端API地址（通常是魔搭创空间分配的域名）
- `VITE_API_KEY`: Gemini API密钥
- `VITE_OPENAI_API_KEY`: OpenAI API密钥（可选）
- `VITE_DASHSCOPE_API_KEY`: 阿里云DashScope API密钥（用于TTS）

### 示例配置：
```bash
VITE_API_BASE=https://your-modelspace-app.modelscope.cn
VITE_API_KEY=your_actual_gemini_api_key
VITE_DASHSCOPE_API_KEY=your_actual_dashscope_api_key
```

## 前端功能特性

### 1. 文件上传机制
前端通过以下方式处理音频文件上传：

```typescript
// 在MockTest组件中
const handleResponseComplete = async (blob: Blob) => {
  const formData = new FormData();
  formData.append("audio", blob, "response.wav");
  formData.append("part", `Part ${currentPart}`);
  formData.append("question", currentQuestionText);
  formData.append("level", profile.currentLevel);
  
  const response = await fetch(`${API_BASE}/v1/ielts/evaluate`, {
    method: "POST",
    body: formData,
  });
};
```

### 2. 实时录音功能
- 使用浏览器MediaRecorder API进行录音
- 支持实时音频流处理
- 自动格式转换为WAV格式

### 3. 多Part支持
- Part 1: 基础问答
- Part 2: 个人陈述
- Part 3: 深入讨论

## 部署步骤

### 1. 构建前端
```bash
npm install
npm run build
```

### 2. 配置环境变量
在`.env`文件中设置正确的API地址

### 3. 部署到静态托管服务
- 可以部署到Vercel、Netlify等静态托管平台
- 或者直接在魔搭创空间中作为静态文件部署

## 与后端交互流程

1. **用户录音** → 前端捕获音频流
2. **文件上传** → 通过FormData发送到后端
3. **AI评估** → 后端调用多Agent系统进行评估
4. **结果返回** → 前端展示评分和反馈
5. **游戏化反馈** → XP积分、成就系统更新

## API端点映射

| 功能 | 前端调用 | 后端端点 | 说明 |
|------|----------|----------|------|
| IELTS评估 | `/v1/ielts/evaluate` | `POST /v1/ielts/evaluate` | 音频评估 |
| Part1回答 | `/v1/chat/completions` | `POST /v1/chat/completions` | 生成参考答案 |
| TTS合成 | 本地处理 | `POST /v1/audio/speech` | 文字转语音 |

## 注意事项

1. **CORS配置**: 确保后端允许前端域名访问
2. **HTTPS要求**: 生产环境建议使用HTTPS
3. **API密钥安全**: 不要在前端代码中硬编码API密钥
4. **文件大小限制**: 注意音频文件大小限制

## 调试技巧

1. 检查浏览器控制台网络请求
2. 验证环境变量是否正确加载
3. 确认后端服务是否正常运行
4. 测试API连通性

## 故障排除

### 常见问题：
1. **CORS错误**: 检查后端CORS配置
2. **404错误**: 确认API端点地址正确
3. **录音失败**: 检查浏览器权限设置
4. **API密钥错误**: 验证环境变量配置