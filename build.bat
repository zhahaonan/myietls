@echo off
echo 🚀 开始构建 MyIELTS Voice 项目...

REM 1. 构建前端
echo 🔧 构建前端...
cd frontend
if not exist node_modules npm install
npm run build
cd ..

REM 2. 复制前端构建结果到后端
echo 📦 复制前端资源...
xcopy /E /I frontend\dist backend\dist

REM 3. 构建Docker镜像
echo 🐳 构建Docker镜像...
cd backend
docker build -t myielts-voice .

echo ✅ 构建完成！
echo 使用以下命令运行：
echo docker run -p 7860:7860 myielts-voice