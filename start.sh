#!/bin/bash
###
 # @Author: Lieyan
 # @Date: 2025-07-22 17:13:38
 # @LastEditors: Lieyan
 # @LastEditTime: 2025-07-22 17:14:21
 # @FilePath: /FireClassroom/start.sh
 # @Description: 
 # @Contact: QQ: 2102177341  Website: lieyan.space  Github: @lieyan666
 # @Copyright: Copyright (c) 2025 by lieyanDevTeam, All Rights Reserved. 
### 

# 设置颜色
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== 1. 拉取最新的代码 ===${NC}"
git pull
if [ $? -ne 0 ]; then
    echo "错误：Git pull 失败，请检查您的网络连接和 Git 配置。"
    exit 1
fi

echo -e "\n${GREEN}=== 2. 安装/更新项目依赖 ===${NC}"
npm install
if [ $? -ne 0 ]; then
    echo "错误：NPM install 失败，请检查您的 Node.js 和 npm 环境。"
    exit 1
fi

echo -e "\n${GREEN}=== 3. 启动 FireClassroom 服务器 ===${NC}"
npm start