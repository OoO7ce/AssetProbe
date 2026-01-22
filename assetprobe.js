const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ANSI 颜色码
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// 根据状态码获取颜色
function getStatusColor(status) {
  if (!status) return colors.gray;

  if (status >= 200 && status < 300) return colors.green;   // 成功 - 绿色
  if (status >= 300 && status < 400) return colors.yellow;  // 重定向 - 黄色
  if (status >= 400 && status < 500) return colors.yellow;  // 客户端错误 - 黄色
  if (status >= 500) return colors.red;                    // 服务器错误 - 红色
  return colors.gray;
}

// 显示帮助信息
function showHelp() {
  console.log(`
\x1b[36m
  ▄▄▄▄                           ▄▄▄▄▄▄▄               ▄▄
▄██▀▀██▄                    ██   ███▀▀███▄             ██
███  ███ ▄█▀▀▀ ▄█▀▀▀ ▄█▀█▄ ▀██▀▀ ███▄▄███▀ ████▄ ▄███▄ ████▄ ▄█▀█▄
███▀▀███ ▀███▄ ▀███▄ ██▄█▀  ██   ███▀▀▀▀   ██ ▀▀ ██ ██ ██ ██ ██▄█▀
███  ███ ▄▄▄█▀ ▄▄▄█▀ ▀█▄▄▄  ██   ███       ██    ▀███▀ ████▀ ▀█▄▄▄
\x1b[0m
  \x1b[32m+------------------------------------------------------------+\x1b[0m
                        \x1b[33mAssetProbe\x1b[0m \x1b[36mv1.0.0\x1b[0m
                \x1b[36m资产发现与侦察工具\x1b[0m - Asset Discovery Tool
  \x1b[32m+------------------------------------------------------------+\x1b[0m

用法:
  node get-title-proxy.js [选项]

选项:
  -u, --url <地址>         要访问的网站地址
  -p, --proxy <地址>       代理服务器地址
                           格式: IP:端口 或 http://IP:端口
                           示例: 127.0.0.1:7890
  -b, --batch <文件>       批量处理URL列表文件
                           文件中每行一个URL，支持 # 注释
  -c, --concurrency <数量>  并发处理数量（默认: 5）
                           增加可提高速度，但会消耗更多资源
                           示例: -c 10 (同时处理10个)
  -s, --screenshot [文件]   保存网页截图
                           可选指定文件名，默认自动生成
                           示例: -s screenshot.png
                           示例: -s (自动命名)
  -f, --full               截取完整页面（包括滚动部分）
  -q, --quiet              静默模式，不显示网络请求详情
  -h, --help               显示帮助信息

示例:
  # 不使用代理访问
  node get-title-proxy.js -u https://www.example.com

  # 使用代理访问
  node get-title-proxy.js -u https://www.bilibili.com -p 127.0.0.1:7890

  # 批量处理（默认并发数为5）
  node get-title-proxy.js -b urls.txt -p 127.0.0.1:7890

  # 批量处理（增加并发数提高速度）
  node get-title-proxy.js -b urls.txt -c 10 -q

  # 批量处理并截图
  node get-title-proxy.js -b urls.txt -s -c 5 -q

  # 访问并截图（自动命名）
  node get-title-proxy.js -u https://www.bilibili.com -p 127.0.0.1:7890 -s

  # 访问并截图（指定文件名）
  node get-title-proxy.js -u https://www.bilibili.com -s bilibili.png

  # 截取完整页面
  node get-title-proxy.js -u https://www.example.com -s -f

  # 静默模式 + 截图
  node get-title-proxy.js -u https://www.example.com -p 127.0.0.1:7890 -q -s

批量处理文件格式 (urls.txt):
  https://www.bilibili.com
  https://www.baidu.com
  https://github.com
  # 这是注释，会被忽略

注意:
  - 代理地址可以省略 http:// 前缀，程序会自动处理
  - 截图默认保存为 PNG 格式
  - 截图按域名/IP自动分类保存到 screenshots 文件夹
  - 默认超时时间: 60秒
  - 默认等待时间: 2秒

截图保存路径示例:
  screenshots/www_bilibili_com/screenshot_2025-12-30T14-30-00.png

常见代理端口:
  - Clash:    7890
  - V2Ray:    10809 (HTTP) 或 10808 (SOCKS5)
  - SSR:      1080
`);
}

// 从URL获取文件夹名称（域名或IP）
function getFolderName(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const port = urlObj.port;

    // 如果有端口号，添加到文件夹名
    if (port) {
      return `${hostname}_${port}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    }

    return hostname.replace(/[^a-zA-Z0-9_.-]/g, '_');
  } catch (e) {
    // 如果URL解析失败，返回默认名称
    return 'unknown';
  }
}

// 生成截图文件名和完整路径
function generateScreenshotPath(url, customName = null, batchMode = false, batchDir = null) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

  // 创建截图文件夹路径
  const screenshotsDir = path.join(process.cwd(), 'screenshots');

  let targetDir;
  if (batchMode) {
    // 批量模式：使用指定的批次文件夹
    if (batchDir) {
      targetDir = path.join(screenshotsDir, 'batch', batchDir);
    } else {
      targetDir = path.join(screenshotsDir, 'batch');
    }
  } else {
    // 单个URL模式：按域名分类
    const folderName = getFolderName(url);
    targetDir = path.join(screenshotsDir, folderName);
  }

  // 确保目录存在
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 生成文件名
  let filename;
  if (customName) {
    // 如果用户指定了文件名，使用指定的名称
    filename = customName.endsWith('.png') ? customName : `${customName}.png`;
  } else {
    // 批量模式使用URL作为文件名前缀，单个模式使用时间戳
    if (batchMode) {
      // 从URL生成文件名
      const urlObj = new URL(url);
      const urlFilename = urlObj.hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
      filename = `${urlFilename}.png`;
    } else {
      filename = `screenshot_${timestamp}.png`;
    }
  }

  return path.join(targetDir, filename);
}

// 解析命令行参数
function parseArgs(args) {
  const result = {
    url: null,
    batchFile: null,
    proxy: null,
    screenshot: null,
    fullPage: false,
    quiet: false,
    help: false,
    concurrency: 5  // 默认并发数（性能最佳值）
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if (arg === '-u' || arg === '--url') {
      result.url = args[++i];
    } else if (arg === '-p' || arg === '--proxy') {
      result.proxy = args[++i];
    } else if (arg === '-b' || arg === '--batch') {
      result.batchFile = args[++i];
    } else if (arg === '-c' || arg === '--concurrency') {
      result.concurrency = parseInt(args[++i]) || 10;
    } else if (arg === '-s' || arg === '--screenshot') {
      // 检查下一个参数是否是选项（以 - 开头）
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        result.screenshot = args[++i];
      } else {
        result.screenshot = true; // 自动生成文件名
      }
    } else if (arg === '-f' || arg === '--full') {
      result.fullPage = true;
    } else if (arg === '-q' || arg === '--quiet') {
      result.quiet = true;
    }
  }

  return result;
}

// 加载指纹库
function loadFingerprints() {
  try {
    const filePath = path.join(__dirname, 'webapp-fingerprints.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`${colors.yellow}⚠️  无法加载指纹库: ${error.message}${colors.reset}`);
    return {};
  }
}

// MurmurHash3 算法（32位）- 与 Shodan/FOFA 一致
function murmurhash3(data) {
  const len = data.length;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  const r1 = 15;
  const r2 = 13;
  const m = 5;
  const n = 0xe6546b64;

  let h1 = 0;

  const nblocks = Math.floor(len / 4);

  // Body
  for (let i = 0; i < nblocks; i++) {
    let k1 = data.readUInt32LE(i * 4);

    k1 = Math.imul(k1, c1);
    k1 = (k1 << r1) | (k1 >>> (32 - r1));
    k1 = Math.imul(k1, c2);

    h1 ^= k1;
    h1 = (h1 << r2) | (h1 >>> (32 - r2));
    h1 = Math.imul(h1, m) + n;
  }

  // Tail
  const tail = len % 4;
  let k1 = 0;

  switch (tail) {
    case 3:
      k1 ^= data[2 + nblocks * 4] << 16;
    case 2:
      k1 ^= data[1 + nblocks * 4] << 8;
    case 1:
      k1 ^= data[nblocks * 4];

      k1 = Math.imul(k1, c1);
      k1 = (k1 << r1) | (k1 >>> (32 - r1));
      k1 = Math.imul(k1, c2);

      h1 ^= k1;
  }

  // Finalization
  h1 ^= len;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  // 转换为有符号整数 (匹配 Python mmh3 的默认行为)
  return h1 | 0;
}

// 获取 Icon Hash（Shodan 方式：base64 → MurmurHash3）
async function getIconHash(page, url) {
  try {
    // 按优先级顺序查找icon：icon > shortcut icon > apple-touch-icon > mask-icon
    const iconUrl = await page.evaluate(() => {
      const rels = ['icon', 'shortcut icon', 'apple-touch-icon', 'mask-icon'];
      for (const rel of rels) {
        const icon = document.querySelector(`link[rel="${rel}"], link[rel~="${rel}"]`);
        if (icon && icon.href) {
          return icon.href;
        }
      }
      return '/favicon.ico';
    });

    const absoluteUrl = new URL(iconUrl, url).href;

    // 使用 fetch API 直接获取icon，绕过 Playwright 的下载拦截
    const iconBuffer = await page.evaluate(async (iconUrl) => {
      try {
        const response = await fetch(iconUrl);
        if (!response.ok) {
          return null;
        }
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        // 将 ArrayBuffer 转为 base64
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        return btoa(binary);
      } catch (e) {
        return null;
      }
    }, absoluteUrl);

    if (iconBuffer) {
      // Shodan/FOFA 方式：base64 + 每76字符换行 + MurmurHash3
      let base64 = iconBuffer;
      // MIME标准: 每76个字符插入换行符
      base64 = base64.replace(/(.{76})/g, '$1\n');
      // 确保末尾也有换行符
      if (!base64.endsWith('\n')) {
        base64 += '\n';
      }
      const hash = murmurhash3(Buffer.from(base64, 'utf-8'));
      return hash.toString();
    }
  } catch (e) {
    // 静默失败，不输出错误
  }
  return null;
}

// 获取 Headers（转为字符串）
function getHeaderString(response) {
  const headers = response.headers();
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

// 匹配条件（支持 && 和 ||）
function matchCondition(conditionStr, content, matchFn) {
  // 先按 || 分割（OR关系）
  const orParts = conditionStr.split(' || ').map(s => s.trim());

  // OR：任意一个满足即可
  return orParts.some(orPart => {
    // 再按 && 分割（AND关系）
    const andParts = orPart.split(' && ').map(s => s.trim());

    // AND：所有都要满足
    return andParts.every(andPart => matchFn(andPart, content));
  });
}

// Web 应用指纹识别
async function identifyWebApp(response, page, url, batchMode = false) {
  const fingerprints = loadFingerprints();
  const detected = [];

  // 如果指纹库为空，返回空数组
  if (Object.keys(fingerprints).length === 0) {
    return detected;
  }

  // 等待动态内容加载（优先等待标题出现）
  // 批量模式：等待1秒（加快速度）
  // 单个模式：等待最多10秒
  const titleTimeout = batchMode ? 1000 : 10000;
  try {
    await page.waitForFunction(() => {
      return document.title && document.title.length > 0;
    }, { timeout: titleTimeout });
  } catch (e) {
    // 超时继续，使用已有的标题
  }

  // 先提取主页面的信息（在获取icon之前，因为page会导航到icon URL）
  const mainPageTitle = await page.title();

  const mainPageHtml = await page.content();
  const mainPageHtmlLower = mainPageHtml.toLowerCase(); // 缓存toLowerCase结果
  const headerStr = getHeaderString(response);
  const headerStrLower = headerStr.toLowerCase(); // 缓存toLowerCase结果
  const mainPageTitleLower = mainPageTitle.toLowerCase(); // 缓存toLowerCase结果

  // 提取 4 个维度
  const iconHash = await getIconHash(page, url);

  // 遍历每个应用（优化：按速度排序匹配）
  for (const [appName, features] of Object.entries(fingerprints)) {
    let confidence = 0;

    // 1. 先匹配 icon（最快，hash比较）
    if (features.icon && iconHash) {
      const iconValue = features.icon[0];
      if (matchCondition(iconValue, iconHash, (v, c) => v === c)) {
        confidence += features.icon[1];
      }
    }

    // 2. 再匹配 title（很快，字符串很短）
    if (features.title) {
      const titleValue = features.title[0];
      if (matchCondition(titleValue, mainPageTitleLower, (v, c) => c.includes(v.toLowerCase()))) {
        confidence += features.title[1];
      }
    }

    // 3. 再匹配 header（较慢，但比body快）
    if (features.header) {
      const headerValue = features.header[0];
      if (matchCondition(headerValue, headerStrLower, (v, c) => c.includes(v.toLowerCase()))) {
        confidence += features.header[1];
      }
    }

    // 4. 最后匹配 body（最慢，整个HTML）
    if (features.body) {
      const bodyValue = features.body[0];
      if (matchCondition(bodyValue, mainPageHtmlLower, (v, c) => c.includes(v.toLowerCase()))) {
        confidence += features.body[1];
      }
    }

    // 置信度 > 0，记录结果
    if (confidence > 0) {
      detected.push({
        name: appName,
        confidence: confidence
      });
    }
  }

  // 按置信度排序，返回置信度最高的前3个
  const sorted = detected.sort((a, b) => b.confidence - a.confidence);
  return sorted.slice(0, 3);
}

// 并发控制处理URL列表
async function processUrlsConcurrently(urls, options) {
  const { proxyServer, screenshot, fullPage, quiet, concurrency } = options;
  const results = [];
  let successCount = 0;
  let failCount = 0;
  let completedCount = 0;

  // 批量模式：生成批次时间戳文件夹（始终生成，用于HTML报告）
  const batchTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const batchDir = batchTimestamp;

  // 创建任务队列
  const tasks = urls.map((url, index) => ({
    url,
    index,
    screenshotPath: screenshot ? generateScreenshotPath(url, null, true, batchDir) : null
  }));

  // 用于按顺序保存结果
  const resultSlots = new Array(urls.length);

  // 记录开始时间
  const startTime = Date.now();

  console.log(`✅ 开始批量处理...\n`);

  // 逐个处理URL（带并发控制）
  const processing = new Set();

  for (let i = 0; i < tasks.length; i++) {
    // 如果达到并发限制，等待一个完成
    while (processing.size >= concurrency) {
      await Promise.race(processing);
    }

    // 处理当前任务（每个任务启动独立的浏览器）
    const task = tasks[i];
    const promise = processUrl(task.url, {
      proxyServer,
      screenshotPath: task.screenshotPath,
      fullPage,
      quiet,
      batchMode: true,
      batchCollectMode: false
    }).then(result => {
      // 增加完成计数
      completedCount++;

      // 保存结果
      resultSlots[task.index] = { ...result, index: task.index, url: task.url };

      // 统计
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }

      // 立即输出结果，序号表示完成进度
      const prefix = `${colors.cyan}[${completedCount}/${urls.length}]${colors.reset} `;
      if (result.success) {
        const statusColor = getStatusColor(result.status);
        const coloredStatus = `${statusColor}${result.status}${colors.reset}`;
        const shortTitle = result.title.length > 50 ? result.title.substring(0, 47) + '...' : result.title;
        const shortUrl = task.url.length > 40 ? task.url.substring(0, 37) + '...' : task.url;

        // 格式化 Web 应用显示（显示前3个）
        let webappsStr = '';
        if (result.webapps && result.webapps.length > 0) {
          const displayApps = result.webapps.slice(0, 3);
          webappsStr = ' - ' + displayApps.map(app => {
            const percent = Math.round(app.confidence * 100);
            return `${colors.green}${app.name} [${percent}%]${colors.reset}`;
          }).join(' | ');
        }

        console.log(`${prefix}${shortUrl} - ${coloredStatus} - ${shortTitle}${webappsStr}`);
      } else {
        const shortUrl = task.url.length > 40 ? task.url.substring(0, 37) + '...' : task.url;
        console.log(`${prefix}${shortUrl} - ${colors.red}❌${colors.reset} ${result.errorCode || 'Error'}`);
      }

      return result;
    }).finally(() => {
      processing.delete(promise);
    });

    processing.add(promise);
    results.push(promise);
  }

  // 等待所有任务完成
  await Promise.all(processing);

  // 计算总耗时
  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(2);

  // 获取所有结果的详细信息（包含截图路径）
  const detailedResults = resultSlots.map(slot => ({
    ...slot,
    screenshotPath: slot.screenshotPath || null
  }));

  return { results, successCount, failCount, batchDir, detailedResults, totalTime };
}

// 生成HTML报告
function generateHTMLReport(results, batchDir, totalCount) {
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  // 计算统计数据
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  // 生成HTML内容
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>批量处理报告 - ${timestamp}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
      background: #e8eaed;
      color: #1a1a1a;
      padding: 40px 20px;
      font-size: 14px;
      line-height: 1.6;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      animation: fadeIn 0.6s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding: 30px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      animation: slideDown 0.6s ease-out;
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .header h1 {
      font-size: 32px;
      font-weight: 400;
      margin-bottom: 12px;
      color: #1a1a1a;
      letter-spacing: 1px;
    }
    .header p {
      font-size: 13px;
      color: #666;
    }
    .stats {
      display: flex;
      gap: 20px;
      margin-bottom: 40px;
    }
    .stat-item {
      flex: 1;
      background: white;
      padding: 28px;
      border-radius: 12px;
      border: 1px solid #d0d7de;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0;
      animation: scaleIn 0.5s ease-out forwards;
    }
    .stat-item:nth-child(1) { animation-delay: 0.1s; }
    .stat-item:nth-child(2) { animation-delay: 0.2s; }
    .stat-item:nth-child(3) { animation-delay: 0.3s; }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
    .stat-item:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      border-color: #bbb;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    .stat-value {
      font-size: 40px;
      font-weight: 700;
      transition: all 0.3s ease;
    }
    .stat-value.success { color: #1a7f37; }
    .stat-value.failed { color: #cf222e; }
    .stat-value.total { color: #0969da; }

    .results-section {
      animation: fadeInUp 0.6s ease-out 0.4s both;
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .results-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
      color: #1a1a1a;
      letter-spacing: 0.5px;
      padding-bottom: 12px;
      border-bottom: 2px solid #d0d7de;
    }
    .result-item {
      display: grid;
      grid-template-columns: 50px 2fr 1fr 1.5fr 1fr 130px;
      gap: 20px;
      align-items: center;
      background: white;
      padding: 16px 20px;
      margin-bottom: 12px;
      border-radius: 8px;
      border: 1px solid #d0d7de;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0;
      animation: slideInLeft 0.5s ease-out forwards;
    }
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-30px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .result-item:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border-color: #bbb;
    }
    .result-item.success {
      border-left: 4px solid #1a7f37;
    }
    .result-item.failed {
      border-left: 4px solid #cf222e;
    }

    .result-index {
      color: #6e7781;
      font-weight: 600;
      font-size: 14px;
    }

    .result-url {
      color: #1a1a1a;
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .result-title {
      color: #656d76;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .result-status {
      display: inline-flex;
      align-items: center;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    .result-status.success {
      background: #1a7f37;
      color: white;
    }
    .result-status.failed {
      background: #cf222e;
      color: white;
    }

    .result-webapps {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .app-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      background: #e3f2fd;
      color: #1565c0;
      white-space: nowrap;
    }
    .app-badge:hover {
      background: #bbdefb;
    }

    .screenshot-thumb {
      width: 130px;
      height: 75px;
      overflow: hidden;
      cursor: pointer;
      border-radius: 6px;
      border: 1px solid #d0d7de;
      background: #f6f8fa;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    }
    .screenshot-thumb:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      border-color: #bbb;
    }
    .screenshot-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.3s ease;
    }
    .screenshot-thumb.empty {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6e7781;
      font-size: 11px;
      background: #f6f8fa;
    }

    .lightbox {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      z-index: 9999;
      align-items: center;
      justify-content: center;
      padding: 40px;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .lightbox.active {
      display: flex;
      opacity: 1;
    }
    .lightbox-content {
      max-width: 90%;
      max-height: 90%;
      border-radius: 8px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      transform: scale(0.9);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid #333;
    }
    .lightbox.active .lightbox-content {
      transform: scale(1);
    }
    .lightbox-close {
      position: absolute;
      top: 30px;
      right: 40px;
      cursor: pointer;
      z-index: 10000;
      transition: all 0.3s ease;
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
    }
    .lightbox-close::before,
    .lightbox-close::after {
      content: '';
      position: absolute;
      width: 24px;
      height: 2px;
      background: white;
      border-radius: 2px;
      transition: all 0.3s ease;
    }
    .lightbox-close::before {
      transform: rotate(45deg);
    }
    .lightbox-close::after {
      transform: rotate(-45deg);
    }
    .lightbox-close:hover::before {
      transform: rotate(135deg);
    }
    .lightbox-close:hover::after {
      transform: rotate(-135deg);
    }
    .lightbox-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>批量处理报告</h1>
      <p>${timestamp}</p>
    </div>

    <div class="stats">
      <div class="stat-item">
        <div class="stat-label">总任务数</div>
        <div class="stat-value total">${totalCount}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">成功</div>
        <div class="stat-value success">${successCount}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">失败</div>
        <div class="stat-value failed">${failCount}</div>
      </div>
    </div>

    <div class="results-section">
      <div class="results-title">处理结果</div>
`;

  // 生成每个结果项
  results.forEach((result, index) => {
    const statusClass = result.success ? 'success' : 'failed';
    const statusText = result.success ? '✓' : '✗';
    const statusCode = result.success ? result.status : '站点无法访问';
    const delay = (index * 0.05).toFixed(2);

    html += `
      <div class="result-item ${statusClass}" style="animation-delay: ${delay}s">
        <div class="result-index">#${index + 1}</div>
        <div class="result-url" title="${escapeHtml(result.url)}">${escapeHtml(result.url)}</div>
        <div class="result-title" title="${escapeHtml(result.title || 'N/A')}">${escapeHtml(result.title || 'N/A')}</div>
        <div class="result-webapps">
    `;

    // Web 应用列
    if (result.webapps && result.webapps.length > 0) {
      result.webapps.forEach(app => {
        const percent = Math.round(app.confidence * 100);
        html += `<span class="app-badge" title="置信度: ${percent}%">${escapeHtml(app.name)} (${percent}%)</span>`;
      });
    } else {
      html += `<span style="color: #6e7781; font-size: 12px;">未识别</span>`;
    }

    html += `
        </div>
        <div class="result-status ${statusClass}">${statusCode} ${statusText}</div>
    `;

    // 截图缩略图
    if (result.screenshotPath) {
      const screenshotName = path.basename(result.screenshotPath);
      html += `
        <div class="screenshot-thumb" onclick="openLightbox('${screenshotName}')">
          <img src="${screenshotName}" alt="screenshot">
        </div>
      `;
    } else {
      html += `<div class="screenshot-thumb empty">无截图</div>`;
    }

    html += `</div>`;
  });

  html += `
    </div>
  </div>

  <!-- Lightbox Modal -->
  <div class="lightbox" id="lightbox" onclick="closeLightbox()">
    <div class="lightbox-close"></div>
    <img class="lightbox-content" id="lightbox-img" src="" alt="screenshot">
  </div>

  <script>
    function openLightbox(src) {
      event.stopPropagation();
      document.getElementById('lightbox').classList.add('active');
      document.getElementById('lightbox-img').src = src;
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('active');
      document.getElementById('lightbox-img').src = '';
      document.body.style.overflow = 'auto';
    }

    // ESC key to close
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeLightbox();
      }
    });
  </script>
</body>
</html>`;

  return html;
}

// HTML转义函数
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// 从文件读取URL列表
function readUrlsFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const urls = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')); // 过滤空行和注释
    return urls;
  } catch (error) {
    console.error(`❌ 无法读取文件: ${filePath}`);
    console.error(`   ${error.message}`);
    return null;
  }
}

// 处理单个URL
async function processUrl(url, options) {
  const { proxyServer, screenshotPath, fullPage, quiet, batchMode, batchCollectMode } = options;

  // 批量收集模式或批量模式：完全不输出，只返回结果
  if (batchCollectMode || batchMode) {
    // 不输出任何内容
  } else {
    console.log(`\n${'─'.repeat(66)}`);
    console.log(`🌐 正在访问: ${url}`);
    if (proxyServer) {
      console.log(`🔌 使用代理: ${proxyServer}`);
    } else {
      console.log(`⚠️  未使用代理`);
    }
    if (screenshotPath) {
      const filename = path.basename(screenshotPath);
      console.log(`📸 截图保存: ${filename}`);
      if (fullPage) {
        console.log(`📄 完整页面截图`);
      }
    }
    console.log('');
  }

  // 启动浏览器
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });

  // 创建浏览器上下文
  const contextOptions = {
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  // 如果提供了代理，添加到配置中
  if (proxyServer) {
    const proxyAddr = proxyServer.startsWith('http') ? proxyServer : `http://${proxyServer}`;
    contextOptions.proxy = { server: proxyAddr };
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // 设置超时
  page.setDefaultTimeout(batchMode ? 30000 : 60000);

  // 用于保存主页面的响应状态
  let mainPageStatus = null;

  // 监听网络请求（仅在非静默模式下）
  if (!quiet) {
    page.on('request', request => {
      console.log(`  ➤ ${request.url()}`);
    });

    page.on('response', response => {
      console.log(`  ✓ ${response.status()} ${response.url()}`);
    });
  }

  // 监听主页面响应，获取状态码
  page.on('response', response => {
    if (response.url() === url || response.url() === url + '/') {
      mainPageStatus = response.status();
    }
  });

  try {
    if (!batchMode) {
      console.log('⏳ 正在加载页面...\n');
    }

    // 发起页面请求并获取响应
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: batchMode ? 30000 : 60000
    });

    // 如果没有通过监听获取到状态码，直接从响应中获取
    if (!mainPageStatus && response) {
      mainPageStatus = response.status();
    }

    // 等待一下确保页面加载
    await page.waitForTimeout(batchMode ? 500 : 2000);

    // Web 应用指纹识别（内部会再等待1500ms并获取标题）
    const webapps = await identifyWebApp(response, page, url, batchMode);

    // 在指纹识别后再次获取标题（此时已经等待足够时间）
    const title = await page.title();
    const finalUrl = page.url();

    // 状态码显示和颜色
    let statusText = `${mainPageStatus || 'N/A'}`;
    let statusColor = getStatusColor(mainPageStatus);
    const coloredStatus = `${statusColor}${statusText}${colors.reset}`;

    // 批量收集模式或批量模式：不输出，只返回结果
    if (batchCollectMode || batchMode) {
      if (screenshotPath) {
        await page.screenshot({
          path: screenshotPath,
          fullPage: fullPage
        });
      }
      return { success: true, url: finalUrl, status: mainPageStatus, title, screenshotPath, webapps };
    }

    // 单个URL模式：完整框框输出
    // Web应用显示（不在框框内，独立显示）
    let webappsStr = '';
    if (webapps && webapps.length > 0) {
      webappsStr = webapps.slice(0, 3).map(app => {
        const percent = Math.round(app.confidence * 100);
        return `${app.name} [${percent}%]`;
      }).join(' | ');
    }

    console.log('');
    console.log(`最终URL: ${finalUrl}`);
    console.log(`状态码: ${coloredStatus}`);
    console.log(`网站标题: ${title}`);

    // Web应用
    if (webappsStr) {
      console.log(`Web应用: ${webappsStr}`);
    }
    console.log('');

    // 保存截图
    if (screenshotPath) {
      console.log('💾 正在保存截图...');
      await page.screenshot({
        path: screenshotPath,
        fullPage: fullPage
      });

      const absolutePath = path.resolve(screenshotPath);
      const stats = fs.statSync(screenshotPath);
      const fileSizeKB = (stats.size / 1024).toFixed(2);

      console.log(`✅ 截图已保存: ${absolutePath}`);
      console.log(`   文件大小: ${fileSizeKB} KB\n`);
    }

    return { success: true, url: finalUrl, status: mainPageStatus, title, webapps };

  } catch (error) {
    // 批量收集模式或批量模式：不输出，只返回错误代码
    if (batchCollectMode || batchMode) {
      let errorMsg = error.message;

      // 提取错误代码（如 ERR_CONNECTION_RESET）
      const errMatch = errorMsg.match(/net::(ERR_\w+)/);
      if (errMatch) {
        errorMsg = errMatch[1];
      } else {
        // 对于 Playwright 错误，显示友好信息
        if (errorMsg.includes('page.goto') || errorMsg.includes('goto')) {
          errorMsg = 'Connection Error';
        } else if (errorMsg.includes('timeout')) {
          errorMsg = 'Timeout';
        } else {
          errorMsg = 'Error';
        }
      }
      return { success: false, url, error: error.message, errorCode: errorMsg };
    }
    console.error('\n❌ 发生错误:');
    console.error(`   类型: ${error.name}`);
    console.error(`   信息: ${error.message}`);
    console.error('');
    return { success: false, url, error: error.message };
  } finally {
    await browser.close();
  }
}

(async () => {
  const args = parseArgs(process.argv.slice(2));

  // 显示帮助
  if (args.help) {
    showHelp();
    return;
  }

  // 批量处理模式
  if (args.batchFile) {
    const urls = readUrlsFromFile(args.batchFile);

    if (!urls || urls.length === 0) {
      console.error('❌ URL列表为空或文件不存在\n');
      process.exit(1);
    }

    console.log(`\n📋 批量处理模式`);
    console.log(`📄 文件: ${args.batchFile}`);
    console.log(`🔗 URL数量: ${urls.length}`);
    if (args.proxy) {
      console.log(`🔌 使用代理: ${args.proxy}`);
    }
    if (args.screenshot) {
      console.log(`📸 启用截图`);
    }
    console.log(`⚡ 并发数: ${args.concurrency}`);
    console.log('');

    // 并发处理所有URL
    const { successCount, failCount, batchDir, detailedResults, totalTime } = await processUrlsConcurrently(urls, {
      proxyServer: args.proxy,
      screenshot: args.screenshot,
      fullPage: args.fullPage,
      quiet: args.quiet,
      concurrency: args.concurrency
    });

    // 显示结果（已在 processUrlsConcurrently 中输出）
    console.log('');
    console.log(`\n${'═'.repeat(66)}`);
    console.log(`📊 批量处理完成`);
    console.log(`${'═'.repeat(66)}`);
    console.log(`总计: ${urls.length} 个URL`);
    console.log(`✅ 成功: ${successCount} 个`);
    console.log(`❌ 失败: ${failCount} 个`);
    console.log(`⏱️  总耗时: ${totalTime} 秒`);

    // 生成HTML报告
    const htmlReport = generateHTMLReport(detailedResults, batchDir, urls.length);
    const reportPath = path.join(process.cwd(), 'screenshots', 'batch', batchDir, 'report.html');

    // 确保目录存在
    const reportDirPath = path.join(process.cwd(), 'screenshots', 'batch', batchDir);
    if (!fs.existsSync(reportDirPath)) {
      fs.mkdirSync(reportDirPath, { recursive: true });
    }

    fs.writeFileSync(reportPath, htmlReport, 'utf-8');
    console.log(`📄 HTML报告: screenshots/batch/${batchDir}/report.html`);

    if (args.screenshot) {
      console.log(`📁 截图保存: screenshots/batch/${batchDir}/`);
    }
    console.log(`${'═'.repeat(66)}\n`);

    return;
  }

  // 单个URL模式
  if (!args.url) {
    console.log('❌ 错误: 请提供要访问的 URL 或使用 -b 指定批量文件\n');
    showHelp();
    process.exit(1);
  }

  const targetUrl = args.url;
  const proxyServer = args.proxy;

  // 处理截图文件名
  let screenshotPath = null;
  if (args.screenshot) {
    if (args.screenshot === true) {
      // 自动生成文件名和路径
      screenshotPath = generateScreenshotPath(targetUrl);
    } else {
      // 使用指定的文件名，但仍然保存到对应的域名文件夹
      screenshotPath = generateScreenshotPath(targetUrl, args.screenshot);
    }
  }

  await processUrl(targetUrl, {
    proxyServer,
    screenshotPath,
    fullPage: args.fullPage,
    quiet: args.quiet
  });
})();
