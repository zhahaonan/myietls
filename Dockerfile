# 使用魔搭创空间官方Python 3.10基础镜像
FROM modelscope-registry.cn-beijing.cr.aliyuncs.com/modelscope-repo/python:3.10

# 设置工作目录
WORKDIR /home/user/app

# 复制依赖文件并安装，利用Docker缓存层优化构建速度
COPY requirements.txt .

# 升级pip并安装依赖，清理缓存以减小镜像大小
RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip cache purge

# 复制应用代码
COPY . .

# 如果存在前端dist目录，复制静态文件（使用RUN命令进行条件复制）
RUN if [ -d "dist" ]; then cp -r dist /home/user/app/; fi

# 创建非root用户并更改文件所有权
RUN useradd -m -u 1000 user && \
    chown -R user:user /home/user/app
USER user

# 设置环境变量
ENV PYTHONPATH=/home/user/app:$PYTHONPATH
ENV GRADIO_SERVER_NAME=0.0.0.0
ENV GRADIO_SERVER_PORT=7860

# 暴露端口
EXPOSE 7860

# 设置启动命令
ENTRYPOINT ["python", "-u", "app.py"]