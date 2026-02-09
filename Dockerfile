# 使用魔搭创空间官方Python 3.10基础镜像
FROM modelscope-registry.cn-beijing.cr.aliyuncs.com/modelscope-repo/python:3.10

# 设置工作目录
WORKDIR /home/user/app

# 创建非root用户以提高安全性
RUN useradd -m -u 1000 user
USER user

# 复制项目文件
COPY --chown=user:user . /home/user/app

# 升级pip并安装依赖
RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip cache purge

# 设置环境变量
ENV PYTHONPATH=/home/user/app:$PYTHONPATH
ENV GRADIO_SERVER_NAME=0.0.0.0
ENV GRADIO_SERVER_PORT=7860

# 暴露端口
EXPOSE 7860

# 设置启动命令
ENTRYPOINT ["python", "-u", "app.py"]