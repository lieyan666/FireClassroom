<!--
 * @Author: Lieyan
 * @Date: 2025-07-21 22:19:00
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-07-21 22:48:23
 * @FilePath: /FireClassroom/README.md
 * @Description: 
 * @Contact: QQ: 2102177341  Website: lieyan.space  Github: @lieyan666
 * @Copyright: Copyright (c) 2025 by lieyanDevTeam, All Rights Reserved. 
-->
# FireClassroom

## AI写的
---

基于Node.js构建的智能在线教室系统，支持根据课表时间实时显示当前课程状态。

## ✨ 功能特性

- **实时时钟显示** - 基于原有时钟功能，显示当前时间
- **智能课程状态** - 根据当前时间自动显示课程状态（上课中/空闲）
- **课程信息展示** - 显示当前课程和下节课程的详细信息
- **课表管理** - 支持可视化课表管理和编辑
- **课程管理** - 完整的课程信息管理系统
- **主题切换** - 支持明暗主题切换
- **全屏模式** - 支持全屏显示，适合教室投影
- **响应式设计** - 适配各种设备屏幕

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 启动服务器
```bash
npm start
```

### 访问系统
- 教室主页: http://localhost:3000
- 管理后台: http://localhost:3000/admin.html
- API接口: http://localhost:3000/api/current-status

## 📁 项目结构

```
FireClassroom/
├── server.js              # Node.js服务器主文件
├── package.json           # 项目配置和依赖
├── public/                # 静态文件目录
│   ├── index.html        # 教室主页
│   └── admin.html        # 管理后台
└── data/                 # 数据文件目录（自动生成）
    ├── config.json       # 系统配置
    ├── courses.json      # 课程信息
    └── schedule.csv      # 课表数据
```

## 🎯 使用说明

### 教室主页
1. 显示当前时间（大字体时钟）
2. 显示当前课程状态：
   - **正在上课**: 显示课程名称、教师、教室、时间
   - **当前空闲**: 显示空闲状态
3. 显示下节课程信息
4. 支持主题切换和全屏模式

### 管理后台
1. **课程管理**: 添加、删除课程信息
2. **课表管理**: 可视化课表编辑
3. **系统配置**: 修改学校名称、学期等基本信息

## 🛠️ 技术栈

- **后端**: Node.js + Express
- **前端**: 原生HTML/CSS/JavaScript
- **数据存储**: JSON文件 + CSV文件
支持根据课表时间的线上记时教室
