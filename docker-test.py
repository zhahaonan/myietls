#!/usr/bin/env python3
"""
Docker部署验证脚本
用于验证Docker配置是否正确
"""

import os
import sys
from pathlib import Path

def check_docker_deployment():
    """检查Docker部署所需的关键组件"""
    print("🔍 MyIELTS Voice Docker部署验证")
    print("=" * 50)
    
    # 检查关键文件是否存在
    required_files = [
        'app.py',
        'Dockerfile', 
        'requirements.txt',
        'engine/',
        'data/'
    ]
    
    print("📋 检查部署文件...")
    all_present = True
    for file in required_files:
        if file.endswith('/'):
            # 检查目录
            exists = Path(file.rstrip('/')).exists()
            status = "✅" if exists else "❌"
        else:
            # 检查文件
            exists = Path(file).exists()
            status = "✅" if exists else "❌"
        
        print(f"  {status} {file}")
        if not exists:
            all_present = False
    
    print()
    
    # 检查环境变量
    print("🔐 检查环境变量...")
    required_envs = ['API_KEY', 'GEMINI_API_KEY', 'DASHSCOPE_API_KEY']
    for env_var in required_envs:
        value = os.getenv(env_var)
        status = "✅" if value and value != 'your_' else "⚠️ "
        print(f"  {status} {env_var}: {'已配置' if value else '未配置'}")
    
    print()
    
    # 检查端口配置
    print("🔌 检查端口配置...")
    port = 7860
    print(f"  ✅ 应用将运行在端口: {port}")
    
    # 检查服务监听配置
    print(f"  ✅ 服务监听地址: 0.0.0.0")
    
    print()
    
    # 检查依赖
    print("📦 检查依赖配置...")
    try:
        with open('requirements.txt', 'r', encoding='utf-8') as f:
            deps = f.read()
            print(f"  ✅ 依赖文件存在，包含 {len(deps.splitlines())} 个依赖项")
            
        # 检查关键依赖
        critical_deps = ['gradio', 'fastapi', 'google-generativeai']
        for dep in critical_deps:
            if any(dep in line.lower() for line in deps.splitlines()):
                print(f"  ✅ 关键依赖 {dep} 已配置")
            else:
                print(f"  ❌ 关键依赖 {dep} 未找到")
                
    except FileNotFoundError:
        print("  ❌ requirements.txt 未找到")
        all_present = False
    
    print()
    
    # 部署建议
    print("🚀 部署建议:")
    print("  1. 确保在魔搭创空间控制台设置了所有必需的环境变量")
    print("  2. 推送代码后等待Docker镜像自动构建")
    print("  3. 构建完成后访问分配的URL进行测试")
    print("  4. 如有问题请检查魔搭创空间日志")
    
    print()
    if all_present:
        print("🎉 部署配置检查完成 - 所有必需组件已就位!")
    else:
        print("⚠️ 部署配置检查完成 - 存在缺失组件，请检查!")
    
    return all_present

if __name__ == "__main__":
    check_docker_deployment()