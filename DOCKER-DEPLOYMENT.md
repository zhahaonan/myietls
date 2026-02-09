# MyIELTS Voice - Docker部署指南

## 部署架构
```
用户浏览器 ←→ 魔搭创空间容器 ←→ AI服务（Gemini, OpenAI, DashScope）
     ↓              ↓
  React前端 ←→ Gradio后端+FastAPI
```

## Docker镜像构建与部署

### 1. 镜像构建流程
```dockerfile
# 基础镜像：魔搭创空间Python 3.10环境
FROM modelscope-registry.cn-beijing.cr.aliyuncs.com/modelscope-repo/python:3.10

# 工作目录设置
WORKDIR /home/user/app

# 安全性优化：创建非root用户
RUN useradd -m -u 1000 user
USER user

# 文件复制与依赖安装
COPY --chown=user:user . /home/user/app
RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip cache purge

# 环境变量配置
ENV PYTHONPATH=/home/user/app:$PYTHONPATH
ENV GRADIO_SERVER_NAME=0.0.0.0
ENV GRADIO_SERVER_PORT=7860

# 端口暴露与启动命令
EXPOSE 7860
ENTRYPOINT ["python", "-u", "app.py"]
```

### 2. 魔搭创空间部署流程

#### 部署前准备：
1. **环境变量设置**（在魔搭创空间控制台）：
   ```
   API_KEY=your_gemini_api_key
   GEMINI_API_KEY=your_gemini_api_key
   OPENAI_API_KEY=your_openai_api_key
   DASHSCOPE_API_KEY=your_dashscope_api_key
   ```

2. **代码推送**：
   ```bash
   git add .
   git commit -m "Docker部署配置"
   git push
   ```

#### 3. Docker构建机制

**构建阶段**：
- 自动拉取最新代码
- 安装requirements.txt中的所有依赖
- 优化缓存以减少构建时间

**运行阶段**：
- 启动Gradio应用（端口7860）
- 加载所有后端模块（CamelAgents, RAG, TTS）
- 监听0.0.0.0以接受外部请求

#### 4. 文件上传处理机制

**前端 → 后端 → AI处理**：
```
1. 用户录音 → 前端MediaRecorder API
2. Blob对象 → FormData包装
3. POST /v1/ielts/evaluate → 后端接收
4. 音频解析 → Gemini Native Audio处理
5. 多Agent评估 → 结果返回
```

#### 5. 服务架构组件

**核心服务**：
- **Gradio UI**: 提供Web界面
- **FastAPI**: RESTful API服务
- **Camel Agents**: 多智能体评估系统
- **RAG模块**: 语义检索增强
- **TTS服务**: 文字转语音

**AI服务集成**：
- **Gemini Pro**: 核心AI能力
- **DashScope**: 语音合成
- **OpenAI兼容接口**: Part 1回答生成

#### 6. 容器资源优化

**内存管理**：
- 使用`pip cache purge`清理缓存
- 优化依赖安装顺序
- 非root用户运行提高安全性

**性能优化**：
- 预加载AI模型
- 缓存常用数据
- 异步处理音频文件

#### 7. 部署验证步骤

**健康检查**：
1. 访问 `{APP_URL}` - 检查Gradio界面
2. 测试API端点 - 验证后端连接
3. 上传小音频文件 - 验证文件处理流程

**故障排查**：
- 查看魔搭创空间日志
- 检查环境变量配置
- 验证API密钥有效性

#### 8. 生产环境最佳实践

**安全性**：
- 不在代码中硬编码API密钥
- 使用魔搭创空间环境变量
- CORS配置适当限制

**可扩展性**：
- 模块化设计便于维护
- 配置外置便于调整
- 日志记录便于调试