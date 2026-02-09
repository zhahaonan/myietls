FROM modelscope-registry.cn-beijing.cr.aliyuncs.com/modelscope-repo/python:3.10

WORKDIR /home/user/app

COPY . /home/user/app

RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip cache purge

RUN (useradd -m -u 1000 user || true) && \
    chown -R user:user /home/user/app
USER user

ENV PYTHONPATH=/home/user/app:$PYTHONPATH

EXPOSE 7860

ENTRYPOINT ["python", "-u", "app.py"]
