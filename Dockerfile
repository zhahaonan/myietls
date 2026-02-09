# 使用魔搭创空间官方Python 3.10基础镜像
FROM modelscope-registry.cn-beijing.cr.aliyuncs.com/modelscope-repo/python:3.10

# 设置工作目录
WORKDIR /home/user/app

# 复制项目文件 (以root用户身份)
COPY . /home/user/app

# 升级pip并安装依赖 (以root用户身份)
RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip cache purge

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