# AssetProbe

[![npm version](https://badge.fury.io/js/assetprobe.svg)](https://www.npmjs.com/package/assetprobe)
[![npm downloads](https://img.shields.io/npm/dm/assetprobe)](https://www.npmjs.com/package/assetprobe)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![GitHub stars](https://img.shields.io/github/stars/OoO7ce/AssetProbe?style=social)](https://github.com/OoO7ce/AssetProbe)

Web asset discovery and reconnaissance tool with batch processing, screenshot, HTML report generation, and web application fingerprinting.

资产发现与侦察工具，支持批量处理、网页截图、HTML 报告生成和 Web 应用指纹识别。

## ✨ 主要功能

- 🌐 **动态渲染**：支持 SPA、React/Vue/Angular 等需要 JavaScript 渲染的网站
- 🔄 **并发处理**：批量处理 URL，默认并发数 5，可调范围 10-100
- 📸 **网页截图**：支持截图和完整页面截图
- 📊 **多格式报告**：自动生成 HTML 报告和 JSON 格式导出
- 🔍 **智能分类**：批量截图按时间戳自动分类保存
- 🎯 **指纹识别**：基于 17,000+ 指纹库自动识别 Web 应用和技术栈

## 🎯 应用场景

### 1. 资产发现与管理

- **内网资产扫描**：快速扫描 IP 段或域名列表，识别 Web 服务
- **资产分类**：通过网站标题快速识别系统类型
- **可视化归档**：通过截图直观记录网站当前状态
- **批量验证**：检查大量资产是否存活

### 2. 安全测试辅助

- **信息收集**：快速识别存活站点，收集标题和截图
- **端口扫描验证**：配合端口扫描结果，验证 Web 服务
- **代理支持**：通过代理访问测试不同网络环境
- **目标筛选**：通过截图筛选高价值目标

### 3. 网站健康检查

- **批量监控**：定期检查关键网站状态
- **可用性报告**：生成 HTML 报告展示监控结果
- **失败追踪**：统一标记"站点无法访问"

**核心价值**：
- ⚡ **高效**：并发处理比逐个访问快 10-50 倍
- 👁️ **直观**：截图+标题比纯文本更易理解
- 📊 **自动化**：批量处理+报告生成

## 📦 安装

### 环境要求

- **Node.js** >= 18.0.0
- **npm** 或 **yarn**

### 方式一：通过 npm 全局安装（推荐）

```bash
npm install -g assetprobe
```

安装后可直接使用 `assetprobe` 命令：

```bash
assetprobe -u https://www.example.com
assetprobe -b urls.txt -c 10
```

### 方式二：从源码安装

```bash
# 克隆项目
git clone https://github.com/OoO7ce/AssetProbe.git
cd AssetProbe

# 安装依赖（会自动下载 Chromium 浏览器）
npm install

# 运行
npm start -- -u https://www.example.com
# 或
node assetprobe.js -u https://www.example.com
```

**注意**：首次安装时会自动下载 Chromium 浏览器（约 300MB），请耐心等待。

## 🚀 使用方法

### 全局安装后

如果你通过 `npm install -g assetprobe` 安装：

```bash
# 查看帮助
assetprobe --help

# 访问单个网站
assetprobe -u https://www.example.com

# 使用代理访问
assetprobe -u https://www.example.com -p 127.0.0.1:7890

# 截图
assetprobe -u https://www.example.com -s

# 静默模式
assetprobe -u https://www.example.com -q
```

### 从源码运行

如果你从源码安装：

```bash
# 查看帮助
node assetprobe.js --help

# 访问单个网站
node assetprobe.js -u https://www.example.com
```

### 批量处理

**全局安装后：**

```bash
# 批量处理 URL 列表
assetprobe -b urls.txt

# 批量处理并截图
assetprobe -b urls.txt -s -q

# 批量处理并导出 JSON
assetprobe -b urls.txt -j results.json

# 批量处理并导出 JSON（自动命名）
assetprobe -b urls.txt -j

# 调整并发数
assetprobe -b urls.txt -c 20
```

**从源码运行：** 将 `assetprobe` 替换为 `node assetprobe.js`

**URL 列表文件格式 (urls.txt):**
```
https://www.example.com
https://www.example.org

# 这是注释，会被忽略
https://192.168.1.1:8080
```

## 📊 报告导出

### HTML 报告

批量处理完成后自动生成 HTML 报告，包含：

- 📈 统计概览（总任务数、成功数、失败数）
- 📋 结果列表（URL、标题、状态码）
- 🖼️ 截图预览（缩略图，点击放大）
- 🎨 现代白色系主题，流畅动画效果

### JSON 导出

**全局安装后：**

```bash
# 单个 URL 导出
assetprobe -u https://example.com -j results.json

# 批量处理导出（自动命名）
assetprobe -b urls.txt -j
```

**从源码运行：**

```bash
# 单个 URL 导出
node assetprobe.js -u https://example.com -j results.json

# 批量处理导出（自动命名）
node assetprobe.js -b urls.txt -j
```

JSON 报告包含完整的数据：URL、状态码、标题、重定向 URL、Web 应用指纹等。

## 📐 参数说明

| 参数 | 说明 |
|------|------|
| `-u, --url <地址>` | 要访问的网站地址 |
| `-p, --proxy <地址>` | 代理服务器地址（格式：`IP:端口` 或 `http://IP:端口`） |
| `-b, --batch <文件>` | 批量处理 URL 列表文件 |
| `-c, --concurrency <数量>` | 并发处理数量（默认：5） |
| `-s, --screenshot [文件]` | 保存网页截图 |
| `-f, --full` | 截取完整页面 |
| `-q, --quiet` | 静默模式，不显示网络请求详情 |
| `-j, --json [文件]` | 导出 JSON 格式报告 |
| `-h, --help` | 显示帮助信息 |

## 🖼️ 截图说明

### 单个 URL 模式

- 按域名/IP 自动分类保存
- 文件命名：`screenshot_时间戳.png`
- 可自定义文件名

### 批量模式

- 时间戳文件夹：`screenshots/batch/时间戳/`
- 文件命名：`域名.png`
- 自动生成 HTML 报告

### 文件夹结构

```
screenshots/
├── www.example.com/           # 单个模式
│   └── screenshot_2025-12-31.png
└── batch/                      # 批量模式
    └── 2025-12-31T10-00-00/
        ├── report.html        # HTML 报告
        ├── www.example.com.png
        └── www.example.org.png
```

## ⚡ 性能优化

- **默认并发数**：5
- **可调并发范围**：5-100
- **批量模式超时**：30 秒
- **批量模式等待**：500 毫秒

**性能对比：**
```
串行处理：100 URL × 2 秒 = 200 秒
并发 5：   100 URL ÷ 5 × 2 秒 = 40 秒
并发 20：  100 URL ÷ 20 × 2 秒 = 10 秒
并发 50：  100 URL ÷ 50 × 2 秒 = 4 秒
```

## 📋 状态码说明

| 状态码范围 | 含义 | 显示 |
|-----------|------|------|
| 200-299 | 成功 | 200 ✓ |
| 300-399 | 重定向 | 301 ↪ |
| 400-499 | 客户端错误 | 404 ⚠️ |
| 500-599 | 服务器错误 | 500 ❌ |
| 连接失败 | 站点无法访问 | 站点无法访问 ✗ |

## 📝 注意事项

1. **首次运行**：`npm install` 会自动下载 Chromium 浏览器（约 170MB）
2. **代理地址**：可省略 `http://` 前缀，程序会自动处理
3. **超时时间**：单个模式 60 秒，批量模式 30 秒
4. **反爬虫**：某些网站可能有反爬虫机制，建议合理设置请求频率
5. **写入权限**：截图文件会保存在当前目录，请确保有写入权限

## 📂 项目结构

```
assetprobe/
├── assetprobe.js              # 主程序
├── debug-fingerprints.js      # 指纹调试工具
├── package.json               # 项目配置
├── README.md                  # 使用说明
├── CLAUDE.md                  # Claude Code 开发指南
├── webapp-fingerprints.json   # Web 应用指纹库（17,000+）
├── assetprobe-mcp/            # MCP Server 子项目
│   ├── index.js               # MCP 服务器入口
│   ├── package.json           # MCP 项目配置
│   └── README.md              # MCP 使用说明
├── screenshots/               # 截图保存目录（自动创建）
└── node_modules/              # 依赖包
```

## 🔧 开发相关

### NPM 脚本

```bash
npm start                      # 运行主程序
npm run debug-fingerprint      # 调试指纹识别
npm run install-browser        # 手动安装浏览器
```

### 全局安装（开发）

如果你想从本地源码全局安装：

```bash
# 在项目根目录
npm link

# 或使用 npm 全局安装
npm install -g ./

# 测试
assetprobe --help
```

### 卸载

```bash
# 卸载全局安装
npm uninstall -g assetprobe
```

### MCP Server

项目包含 MCP Server，可集成到 Claude Desktop 或其他 AI 助手：

详见 [assetprobe-mcp/README.md](assetprobe-mcp/README.md)

## 📄 许可证

ISC License

## 👤 作者

Ark

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

## ⭐ 如果这个项目对你有帮助

请给一个 ⭐ Star 支持一下！

- 你可以通过点击 GitHub 页面右上角的 Star 按钮来支持本项目
- 分享给需要的朋友
- 提供反馈和建议

## 🙏 致谢

- [Playwright](https://playwright.dev/) - 现代化的浏览器自动化工具
- Web 应用指纹库基于开源项目整理

---

**Made with ❤️ by Ark**
