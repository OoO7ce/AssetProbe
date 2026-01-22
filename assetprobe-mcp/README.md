# AssetProbe MCP Server

AssetProbe (资产发现与侦察工具) MCP Server - 基于 Model Context Protocol 的 Web 资产探测和指纹识别工具。

## 功能特性

- 🔍 **URL 探测** - 获取网页标题、状态码和最终跳转URL
- 🎯 **指纹识别** - 自动识别 Web 应用和技术栈（基于 17,000+ 指纹库）
- 🚀 **批量处理** - 支持并发批量探测多个 URL
- 🔌 **代理支持** - 支持 HTTP/SOCKS 代理

## 安装

### 1. 安装依赖

```bash
cd assetprobe-mcp
npm install
```

### 2. 安装 Playwright 浏览器

```bash
npx playwright install chromium
```

## 配置

### Claude Desktop 配置

在 Claude Desktop 的配置文件中添加此 server：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "assetprobe": {
      "command": "node",
      "args": ["e:/learn/fr/assetprobe-mcp/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**注意**: 请将路径 `e:/learn/fr/assetprobe-mcp/index.js` 替换为你的实际路径（使用正斜杠 `/`）。

### Cline (VSCode) 配置

在 VSCode 设置中添加 MCP server 配置：

```json
{
  "cline.mcpServers": {
    "assetprobe": {
      "command": "node",
      "args": ["e:/learn/fr/assetprobe-mcp/index.js"]
    }
  }
}
```

## 可用工具

### 1. probe_url

探测单个 URL，获取详细信息。

**参数**:
- `url` (必需): 要探测的 URL 地址
- `proxy` (可选): 代理服务器地址，格式: `IP:端口` 或 `http://IP:端口`

**示例**:
```
请探测 https://www.baidu.com
```

```
使用代理 127.0.0.1:7890 探测 https://www.google.com
```

### 2. batch_probe

批量探测多个 URL。

**参数**:
- `urls` (必需): URL 列表数组
- `proxy` (可选): 代理服务器地址
- `concurrency` (可选): 并发数（默认 5）

**示例**:
```
批量探测以下URL:
- https://www.baidu.com
- https://www.bing.com
- https://github.com
```

## 返回结果格式

### 单个 URL 探测结果

```json
{
  "success": true,
  "url": "https://www.example.com",
  "status": 200,
  "title": "Example Domain",
  "webapps": [
    {
      "name": "Nginx",
      "confidence": 80
    },
    {
      "name": "Ubuntu",
      "confidence": 60
    }
  ]
}
```

### 批量探测结果

```json
{
  "total": 3,
  "success": 2,
  "failed": 1,
  "results": [
    {
      "success": true,
      "url": "https://www.baidu.com",
      "status": 200,
      "title": "百度一下，你就知道",
      "webapps": [...]
    },
    ...
  ]
}
```

## 使用示例

### 基础使用

```
探测 https://www.github.com 并告诉我它使用了什么技术栈
```

```
批量探测这些网站:
- https://www.baidu.com
- https://www.bing.com
- https://www.stackoverflow.com
```

### 使用代理

```
使用代理 127.0.0.1:7890 探测 https://www.youtube.com
```

### 指纹分析

```
探测 https://www.example.com 并详细分析它的Web应用指纹
```

## 指纹库

MCP Server 使用同目录下的 `webapp-fingerprints.json` 指纹库（17,000+ 指纹），包含：

- CMS 系统（WordPress, Drupal, Joomla 等）
- Web 框架（Django, Flask, Spring 等）
- 服务器软件（Nginx, Apache, IIS 等）
- 前端框架（React, Vue, Angular 等）
- CDN/WAF（Cloudflare, Akamai 等）

## 技术细节

- **浏览器**: Playwright (Chromium)
- **传输方式**: stdio
- **并发控制**: 默认 5（可配置）
- **超时时间**: 30 秒
- **指纹匹配**: icon + title + header + body 四维度

## 故障排查

### 无法连接 MCP Server

1. 检查路径是否正确（使用正斜杠 `/`）
2. 确认依赖已安装: `npm install`
3. 确认 Playwright 浏览器已安装: `npx playwright install chromium`

### 探测失败

1. 检查网络连接
2. 尝试使用代理
3. 某些网站可能需要更长的加载时间

## 开发

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

## 许可证

MIT License

## 相关项目

- [AssetProbe 主项目](../assetprobe.js) - 命令行版本的资产探测工具
- [webapp-fingerprints.json](../webapp-fingerprints.json) - Web 应用指纹库

## 支持

如有问题或建议，请提交 Issue。
