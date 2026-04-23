#!/usr/bin/env node
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

// ANSI 颜色码
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

// 根据状态码获取颜色
function getStatusColor(status) {
  if (!status) return colors.gray;

  if (status >= 200 && status < 300) return colors.green; // 成功 - 绿色
  if (status >= 300 && status < 400) return colors.yellow; // 重定向 - 黄色
  if (status >= 400 && status < 500) return colors.yellow; // 客户端错误 - 黄色
  if (status >= 500) return colors.red; // 服务器错误 - 红色
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
                        \x1b[33mAssetProbe\x1b[0m \x1b[36mv1.3.0\x1b[0m
                \x1b[36m资产发现与侦察工具\x1b[0m - Asset Discovery Tool
  \x1b[32m+------------------------------------------------------------+\x1b[0m

用法:
  assetprobe [选项]

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
  -j, --json               输出纯 JSON 到控制台（无其他提示信息）
  -o, --output <文件>      保存 JSON 报告到文件
                           示例: -o results.json
  -h, --help               显示帮助信息

示例:
  # 不使用代理访问
  assetprobe -u https://www.example.com

  # 使用代理访问
  assetprobe -u https://www.bilibili.com -p 127.0.0.1:7890

  # 批量处理（默认并发数为5，增加并发数提高速度）
  assetprobe -b urls.txt -c 10

  # 批量处理并截图
  assetprobe -b urls.txt -s -c 5

  # 访问并截图（自动命名）
  assetprobe -u https://www.example.com -s

  # 访问并截图（指定文件名）
  assetprobe -u https://www.bilibili.com -s bilibili.png

  # 截取完整页面
  assetprobe -u https://www.example.com -s -f

  # 使用代理 + 截图
  assetprobe -u https://www.example.com -p 127.0.0.1:7890 -s

  # 输出 JSON 到控制台
  assetprobe -u https://www.example.com -j

  # 保存 JSON 到文件
  assetprobe -u https://www.example.com -o results.json
  assetprobe -b urls.txt -o results.json

批量处理文件格式 (urls.txt):
  https://www.example.com
  https://www.baidu.com
  https://github.com
  # 这是注释，会被忽略

注意:
  - 代理地址可以省略 http:// 前缀，程序会自动处理
  - 截图默认保存为 PNG 格式
  - 截图按域名/IP自动分类保存到 screenshots 文件夹
  - 默认超时时间: 60秒
  - 默认等待时间: 2秒
  - 批量处理结果会显示：Web应用指纹、中间件、编程语言

截图保存路径示例:
  screenshots/www_example_com/screenshot_2025-12-30T14-30-00.png

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
      return `${hostname}_${port}`.replace(/[^a-zA-Z0-9_.-]/g, "_");
    }

    return hostname.replace(/[^a-zA-Z0-9_.-]/g, "_");
  } catch (e) {
    // 如果URL解析失败，返回默认名称
    return "unknown";
  }
}

// 生成截图文件名和完整路径
function generateScreenshotPath(
  url,
  customName = null,
  batchMode = false,
  batchDir = null,
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);

  // 创建截图文件夹路径
  const screenshotsDir = path.join(process.cwd(), "screenshots");

  let targetDir;
  if (batchMode) {
    // 批量模式：使用指定的批次文件夹
    if (batchDir) {
      targetDir = path.join(screenshotsDir, "batch", batchDir);
    } else {
      targetDir = path.join(screenshotsDir, "batch");
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
    filename = customName.endsWith(".png") ? customName : `${customName}.png`;
  } else {
    // 批量模式使用URL作为文件名前缀，单个模式使用时间戳
    if (batchMode) {
      // 从URL生成文件名
      const urlObj = new URL(url);
      const urlFilename = urlObj.hostname.replace(/[^a-zA-Z0-9.-]/g, "_");
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
    json: false,
    output: null,
    help: false,
    concurrency: 5, // 默认并发数（性能最佳值）
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      result.help = true;
    } else if (arg === "-u" || arg === "--url") {
      result.url = args[++i];
    } else if (arg === "-p" || arg === "--proxy") {
      result.proxy = args[++i];
    } else if (arg === "-b" || arg === "--batch") {
      result.batchFile = args[++i];
    } else if (arg === "-c" || arg === "--concurrency") {
      result.concurrency = parseInt(args[++i]) || 10;
    } else if (arg === "-s" || arg === "--screenshot") {
      // 检查下一个参数是否是选项（以 - 开头）
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("-")) {
        result.screenshot = args[++i];
      } else {
        result.screenshot = true; // 自动生成文件名
      }
    } else if (arg === "-f" || arg === "--full") {
      result.fullPage = true;
    } else if (arg === "-j" || arg === "--json") {
      // -j 只输出 JSON 到控制台，不保存
      result.json = true;
    } else if (arg === "-o" || arg === "--output") {
      // -o 保存 JSON 到文件
      result.output = args[++i];
    }
  }

  return result;
}

// 加载指纹库
function loadFingerprints() {
  try {
    const filePath = path.join(__dirname, "webapp-fingerprints.json");
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.warn(
      `${colors.yellow}[WARN]  无法加载指纹库: ${error.message}${colors.reset}`,
    );
    return {};
  }
}

// 指纹库缓存和索引
let fingerprintsCache = null;
let iconIndexCache = null;
let middlewareFingerprintsCache = null;
let languageFingerprintsCache = null;

// 加载 Middleware 指纹库
function loadMiddlewareFingerprints() {
  try {
    const filePath = path.join(__dirname, "middleware-fingerprints.json");
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

// 加载 Language 指纹库
function loadLanguageFingerprints() {
  try {
    const filePath = path.join(__dirname, "language-fingerprints.json");
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

// 遍历指纹库（支持混合结构：嵌套和平铺）
function iterateFingerprints(fingerprints, callback) {
  for (const [key, value] of Object.entries(fingerprints)) {
    // 检查是否为嵌套结构（公司->产品）
    // 如果值的第一个key是icon/title/header/body，则是平铺结构
    const firstSubKey = Object.keys(value)[0];
    const isNested =
      firstSubKey && !["icon", "title", "header", "body"].includes(firstSubKey);

    if (isNested) {
      // 嵌套结构：公司 -> 产品
      for (const [productName, features] of Object.entries(value)) {
        callback(productName, features, key);
      }
    } else {
      // 平铺结构
      callback(key, value, null);
    }
  }
}

function buildIconIndex(fingerprints) {
  if (iconIndexCache) {
    return iconIndexCache;
  }

  const iconIndex = {};
  iterateFingerprints(fingerprints, (appName, features, company) => {
    if (features.icon && features.icon[0]) {
      // icon 可能包含多个值（用 || 分隔）
      const iconValues = features.icon[0].split(" || ").map((s) => s.trim());
      for (const iconValue of iconValues) {
        if (!iconIndex[iconValue]) {
          iconIndex[iconValue] = [];
        }
        iconIndex[iconValue].push({ name: appName, features, company });
      }
    }
  });

  iconIndexCache = iconIndex;
  return iconIndex;
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
      const rels = ["icon", "shortcut icon", "apple-touch-icon", "mask-icon"];
      for (const rel of rels) {
        const icon = document.querySelector(
          `link[rel="${rel}"], link[rel~="${rel}"]`,
        );
        if (icon && icon.href) {
          return icon.href;
        }
      }
      return "/favicon.ico";
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
        let binary = "";
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
      base64 = base64.replace(/(.{76})/g, "$1\n");
      // 确保末尾也有换行符
      if (!base64.endsWith("\n")) {
        base64 += "\n";
      }
      const hash = murmurhash3(Buffer.from(base64, "utf-8"));
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
    .join("\n");
}

// 匹配条件（支持 && 和 ||）
function matchCondition(conditionStr, content, matchFn) {
  // 先按 || 分割（OR关系）
  const orParts = conditionStr.split(" || ").map((s) => s.trim());

  // OR：任意一个满足即可
  return orParts.some((orPart) => {
    // 再按 && 分割（AND关系）
    const andParts = orPart.split(" && ").map((s) => s.trim());

    // AND：所有都要满足
    return andParts.every((andPart) => matchFn(andPart, content));
  });
}

// Web 应用指纹识别（使用索引优化）
async function identifyWebApp(response, page, url, batchMode = false) {
  // 使用缓存的指纹库
  if (!fingerprintsCache) {
    fingerprintsCache = loadFingerprints();
  }
  const fingerprints = fingerprintsCache;

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
    await page.waitForFunction(
      () => {
        return document.title && document.title.length > 0;
      },
      { timeout: titleTimeout },
    );
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

  // 提取 icon hash
  const iconHash = await getIconHash(page, url);

  // 使用索引优化：先通过 icon 快速过滤候选应用
  let candidates = [];
  if (iconHash) {
    const iconIndex = buildIconIndex(fingerprints);
    const matchedApps = iconIndex[iconHash];
    if (matchedApps && matchedApps.length > 0) {
      candidates = matchedApps;
    }
  }

  // 如果没有匹配的 icon，应用全部遍历
  if (candidates.length === 0) {
    candidates = [];
    iterateFingerprints(fingerprints, (name, features, company) => {
      candidates.push({ name, features, company });
    });
  }

  // 遍历候选应用进行匹配
  for (const candidate of candidates) {
    const appName = candidate.name;
    const features = candidate.features;
    const company = candidate.company || null;

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
      if (
        matchCondition(titleValue, mainPageTitleLower, (v, c) =>
          c.includes(v.toLowerCase()),
        )
      ) {
        confidence += features.title[1];
      }
    }

    // 3. 再匹配 header（较慢，但比body快）
    if (features.header) {
      const headerValue = features.header[0];
      if (
        matchCondition(headerValue, headerStrLower, (v, c) =>
          c.includes(v.toLowerCase()),
        )
      ) {
        confidence += features.header[1];
      }
    }

    // 4. 最后匹配 body（最慢，整个HTML）
    if (features.body) {
      const bodyValue = features.body[0];
      if (
        matchCondition(bodyValue, mainPageHtmlLower, (v, c) =>
          c.includes(v.toLowerCase()),
        )
      ) {
        confidence += features.body[1];
      }
    }

    // 置信度 > 0，记录结果
    if (confidence > 0) {
      detected.push({
        name: appName,
        company: company,
        confidence: confidence,
      });
    }
  }

  // 按置信度排序，返回置信度最高的前3个
  const sorted = detected.sort((a, b) => b.confidence - a.confidence);
  return sorted.slice(0, 3);
}

// Middleware 指纹识别（按JSON顺序匹配，匹配成功立即返回）
function identifyMiddleware(response) {
  if (!middlewareFingerprintsCache) {
    middlewareFingerprintsCache = loadMiddlewareFingerprints();
  }
  const fingerprints = middlewareFingerprintsCache;
  const headerStr = getHeaderString(response).toLowerCase();

  // 按JSON中的顺序遍历，找到第一个匹配的就返回
  for (const [appName, features] of Object.entries(fingerprints)) {
    if (features.header) {
      const headerValue = features.header[0];
      if (
        matchCondition(headerValue, headerStr, (v, c) =>
          c.includes(v.toLowerCase()),
        )
      ) {
        return [appName];
      }
    }
  }

  return [];
}

// Language 指纹识别（按JSON顺序匹配，匹配成功立即返回）
function identifyLanguage(response) {
  if (!languageFingerprintsCache) {
    languageFingerprintsCache = loadLanguageFingerprints();
  }
  const fingerprints = languageFingerprintsCache;
  const headerStr = getHeaderString(response).toLowerCase();

  // 按JSON中的顺序遍历，找到第一个匹配的就返回
  for (const [appName, features] of Object.entries(fingerprints)) {
    if (features.header) {
      const headerValue = features.header[0];
      if (
        matchCondition(headerValue, headerStr, (v, c) =>
          c.includes(v.toLowerCase()),
        )
      ) {
        return [appName];
      }
    }
  }

  return [];
}

// 并发控制处理URL列表
async function processUrlsConcurrently(urls, options) {
  const { proxyServer, screenshot, fullPage, concurrency, jsonOutput } =
    options;
  const results = [];
  let successCount = 0;
  let failCount = 0;
  let completedCount = 0;

  // 批量模式：生成批次时间戳文件夹（始终生成，用于HTML报告）
  const batchTimestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, -5);
  const batchDir = batchTimestamp;

  // 创建任务队列
  const tasks = urls.map((url, index) => ({
    url,
    index,
    screenshotPath: screenshot
      ? generateScreenshotPath(url, null, true, batchDir)
      : null,
  }));

  // 用于按顺序保存结果
  const resultSlots = new Array(urls.length);

  // 记录开始时间
  const startTime = Date.now();

  // 非 JSON 模式：显示头部
  if (!jsonOutput) {
    console.log(`[OK] 开始批量处理...\n`);
  }

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
      batchMode: true,
      batchCollectMode: false,
    })
      .then((result) => {
        // 增加完成计数
        completedCount++;

        // 保存结果
        resultSlots[task.index] = {
          ...result,
          index: task.index,
          url: task.url,
        };

        // 统计
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }

        // 非 JSON 模式下输出结果
        if (!jsonOutput) {
          const prefix = `${colors.cyan}[${completedCount}/${urls.length}]${colors.reset} `;
          if (result.success) {
            const statusColor = getStatusColor(result.status);
            const coloredStatus = `${statusColor}${result.status}${colors.reset}`;
            const shortTitle =
              (result.title || "").length > 50
                ? result.title.substring(0, 47) + "..."
                : result.title || "";
            const shortUrl =
              task.url.length > 50
                ? task.url.substring(0, 47) + "..."
                : task.url;

            let webappsStr = "";
            if (result.webapps && result.webapps.length > 0) {
              const displayApps = result.webapps.slice(0, 3);
              webappsStr =
                " - " +
                displayApps
                  .map((app) => {
                    const appPercent = Math.round(app.confidence * 100);
                    return `${colors.green}${app.name} [${appPercent}%]${colors.reset}`;
                  })
                  .join(" | ");
            }

            // 中间件
            let middlewareStr = "";
            if (result.middleware && result.middleware.length > 0) {
              middlewareStr = ` - ${colors.blue}中间件: ${result.middleware.join(" | ")}${colors.reset}`;
            }

            // 语言
            let languagesStr = "";
            if (result.languages && result.languages.length > 0) {
              languagesStr = ` - ${colors.blue}语言: ${result.languages.join(" | ")}${colors.reset}`;
            }

            console.log(
              `${prefix}${shortUrl} - ${coloredStatus} - ${shortTitle}${webappsStr}${middlewareStr}${languagesStr}`,
            );
          } else {
            const shortUrl =
              task.url.length > 50
                ? task.url.substring(0, 47) + "..."
                : task.url;
            console.log(
              `${prefix}${shortUrl} - ${colors.red}[FAIL]${colors.reset} ${result.errorCode || "Error"}`,
            );
          }
        }

        return result;
      })
      .finally(() => {
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
  const detailedResults = resultSlots.map((slot) => ({
    ...slot,
    screenshotPath: slot.screenshotPath || null,
  }));

  return {
    results,
    successCount,
    failCount,
    batchDir,
    detailedResults,
    totalTime,
  };
}

// 生成HTML报告（现代化设计）
function buildPremiumHTMLReport(results, batchDir, totalCount) {
  const timestamp = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
  });
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  const successRate =
    totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : "0.0";
  const failedRate = (100 - parseFloat(successRate)).toFixed(1);
  const reportLabel = batchDir ? `批次 ${escapeHtml(batchDir)}` : "单次扫描";
  const hasScreenshots = results.some((result) => result.screenshotPath);

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="AssetProbe Web 资产探测报告">
  <title>AssetProbe 扫描报告 - ${timestamp}</title>
  <style>
    :root {
      --bg: #f4f0e7;
      --bg-ink: #e9e1d2;
      --panel: rgba(255, 252, 244, 0.82);
      --panel-solid: #fffaf0;
      --panel-soft: rgba(20, 50, 38, 0.055);
      --line: rgba(38, 58, 47, 0.14);
      --line-strong: rgba(38, 58, 47, 0.26);
      --text: #17261f;
      --muted: #66766c;
      --subtle: #87958b;
      --accent: #b7df33;
      --accent-ink: #1f2d0c;
      --success: #168a55;
      --success-bg: rgba(22, 138, 85, 0.1);
      --danger: #c44c42;
      --danger-bg: rgba(196, 76, 66, 0.1);
      --warning: #b7791f;
      --cyan: #147c8b;
      --shadow: 0 24px 80px rgba(73, 60, 38, 0.16);
      --radius-xl: 28px;
      --radius-lg: 20px;
      --radius-md: 14px;
      --radius-sm: 10px;
      --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    * {
      box-sizing: border-box;
    }

    [hidden] {
      display: none !important;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      min-height: 100dvh;
      color: var(--text);
      font-family: "Aptos", "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
      line-height: 1.5;
      background:
        radial-gradient(circle at 12% 8%, rgba(183, 223, 51, 0.22), transparent 28rem),
        radial-gradient(circle at 86% 16%, rgba(20, 124, 139, 0.13), transparent 26rem),
        linear-gradient(135deg, #fffaf0 0%, var(--bg) 48%, #ece4d2 100%);
      -webkit-font-smoothing: antialiased;
      font-variant-numeric: tabular-nums;
    }

    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: 0.18;
      background-image:
        linear-gradient(rgba(38, 58, 47, 0.055) 1px, transparent 1px),
        linear-gradient(90deg, rgba(38, 58, 47, 0.045) 1px, transparent 1px);
      background-size: 36px 36px;
      mask-image: linear-gradient(to bottom, #000, transparent 78%);
    }

    .shell {
      width: min(1500px, calc(100% - 40px));
      margin: 0 auto;
      padding: 34px 0 56px;
    }

    .hero {
      position: relative;
      overflow: hidden;
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
      gap: 24px;
      min-height: 320px;
      padding: 34px;
      border: 1px solid var(--line);
      border-radius: var(--radius-xl);
      background:
        linear-gradient(140deg, rgba(255,255,255,0.92), rgba(255,250,240,0.72)),
        rgba(255, 252, 244, 0.84);
      box-shadow: var(--shadow);
      animation: enter 580ms var(--ease) both;
    }

    .hero::after {
      content: "ASSETPROBE";
      position: absolute;
      right: -28px;
      bottom: -36px;
      color: rgba(23, 38, 31, 0.045);
      font-size: clamp(56px, 12vw, 170px);
      font-weight: 800;
      letter-spacing: -0.08em;
      line-height: 1;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      width: fit-content;
      margin-bottom: 26px;
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--accent);
      background: rgba(183, 223, 51, 0.18);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .pulse {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 0 8px rgba(183, 223, 51, 0.16);
    }

    h1 {
      max-width: 780px;
      margin: 0;
      font-size: clamp(42px, 7vw, 92px);
      line-height: 0.9;
      letter-spacing: -0.07em;
      text-wrap: balance;
    }

    .hero-copy {
      max-width: 690px;
      margin: 22px 0 0;
      color: var(--muted);
      font-size: clamp(15px, 1.8vw, 18px);
      text-wrap: pretty;
    }

    .hero-side {
      position: relative;
      z-index: 1;
      align-self: stretch;
      display: grid;
      gap: 14px;
      align-content: end;
    }

    .meta-card {
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: rgba(255, 255, 255, 0.56);
      backdrop-filter: blur(18px);
    }

    .meta-label,
    .stat-label {
      color: var(--subtle);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .meta-value {
      margin-top: 8px;
      color: var(--text);
      font-size: 15px;
      font-weight: 650;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin: 18px 0;
    }

    .stat-card {
      position: relative;
      overflow: hidden;
      padding: 22px;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,250,240,0.62));
      transition: transform 240ms var(--ease), border-color 240ms var(--ease), background 240ms var(--ease);
      animation: enter 520ms var(--ease) both;
    }

    .stat-card:nth-child(2) { animation-delay: 60ms; }
    .stat-card:nth-child(3) { animation-delay: 120ms; }
    .stat-card:nth-child(4) { animation-delay: 180ms; }

    .stat-card:hover {
      transform: translateY(-4px);
      border-color: var(--line-strong);
      background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,250,240,0.78));
    }

    .stat-value {
      margin-top: 14px;
      color: var(--text);
      font-size: clamp(32px, 5vw, 54px);
      font-weight: 780;
      line-height: 0.95;
      letter-spacing: -0.05em;
    }

    .stat-note {
      margin-top: 12px;
      color: var(--muted);
      font-size: 13px;
    }

    .stat-card.success .stat-value { color: var(--success); }
    .stat-card.failed .stat-value { color: var(--danger); }
    .stat-card.rate .stat-value { color: var(--accent); }

    .toolbar {
      position: sticky;
      top: 14px;
      z-index: 5;
      display: grid;
      grid-template-columns: minmax(260px, 1fr) auto auto;
      gap: 12px;
      margin: 18px 0;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: rgba(255, 252, 244, 0.86);
      backdrop-filter: blur(18px);
      box-shadow: 0 18px 50px rgba(73, 60, 38, 0.14);
    }

    .search {
      position: relative;
    }

    .search input,
    .sort-trigger {
      width: 100%;
      height: 46px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      color: var(--text);
      background: rgba(255, 255, 255, 0.72);
      font: inherit;
      outline: none;
      transition: border-color 180ms var(--ease), box-shadow 180ms var(--ease), background 180ms var(--ease);
    }

    .search input {
      padding: 0 16px 0 44px;
    }

    .search-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--accent);
      font-size: 14px;
    }

    .search input:focus,
    .sort-trigger:focus-visible,
    .filter-btn:focus-visible,
    .lightbox-close:focus-visible {
      border-color: rgba(183, 223, 51, 0.9);
      box-shadow: 0 0 0 4px rgba(183, 223, 51, 0.18);
    }

    .filter-group {
      display: flex;
      gap: 8px;
    }

    .filter-btn {
      height: 46px;
      padding: 0 16px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      color: var(--muted);
      background: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      transition: transform 180ms var(--ease), color 180ms var(--ease), background 180ms var(--ease), border-color 180ms var(--ease);
    }

    .filter-btn:hover {
      transform: translateY(-1px);
      color: var(--text);
      border-color: var(--line-strong);
    }

    .filter-btn:active {
      transform: translateY(1px) scale(0.98);
    }

    .filter-btn.active {
      color: var(--accent-ink);
      border-color: transparent;
      background: var(--accent);
    }

    .sort-dropdown {
      position: relative;
      min-width: 170px;
    }

    .sort-trigger {
      position: relative;
      padding: 0 42px 0 14px;
      border-color: rgba(38, 58, 47, 0.18);
      background: rgba(255, 255, 255, 0.78);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
      cursor: pointer;
      text-align: left;
    }

    .sort-trigger::after {
      content: "";
      position: absolute;
      right: 16px;
      top: 50%;
      width: 8px;
      height: 8px;
      border-right: 2px solid var(--text);
      border-bottom: 2px solid var(--text);
      transform: translateY(-65%) rotate(45deg);
      transition: transform 180ms var(--ease);
    }

    .sort-dropdown.open .sort-trigger::after {
      transform: translateY(-35%) rotate(225deg);
    }

    .sort-trigger:hover {
      border-color: rgba(38, 58, 47, 0.32);
      background: rgba(255, 255, 255, 0.94);
    }

    .sort-options {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      z-index: 12;
      display: grid;
      gap: 4px;
      padding: 6px;
      border: 1px solid rgba(38, 58, 47, 0.16);
      border-radius: var(--radius-md);
      color: var(--text);
      background: #fffaf0;
      box-shadow: 0 18px 42px rgba(73, 60, 38, 0.18);
      opacity: 0;
      pointer-events: none;
      transform: translateY(-4px) scale(0.98);
      transform-origin: top;
      transition: opacity 160ms var(--ease), transform 160ms var(--ease);
    }

    .sort-dropdown.open .sort-options {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }

    .sort-option {
      min-height: 36px;
      padding: 0 12px;
      border: 0;
      border-radius: 10px;
      color: var(--text);
      background: transparent;
      cursor: pointer;
      font: inherit;
      text-align: left;
      transition: background 160ms var(--ease), color 160ms var(--ease);
    }

    .sort-option:hover,
    .sort-option:focus-visible {
      outline: none;
      background: rgba(38, 58, 47, 0.08);
    }

    .sort-option.active {
      color: var(--accent-ink);
      background: var(--accent);
      font-weight: 750;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: end;
      margin: 28px 2px 14px;
    }

    .section-title {
      margin: 0;
      font-size: clamp(24px, 3vw, 34px);
      letter-spacing: -0.045em;
    }

    .section-count {
      color: var(--muted);
      font-size: 14px;
      font-weight: 650;
    }

    .result-list {
      display: grid;
      gap: 12px;
    }

    .result-item {
      display: grid;
      grid-template-areas: "idx url title apps status shot";
      grid-template-columns: 58px minmax(260px, 1.55fr) minmax(180px, 0.85fr) minmax(210px, 1fr) minmax(118px, 0.5fr) 150px;
      gap: 14px;
      align-items: center;
      min-height: 116px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: linear-gradient(120deg, rgba(255,255,255,0.86), rgba(255,250,240,0.62));
      animation: rowIn 420ms var(--ease) both;
      transition: transform 220ms var(--ease), border-color 220ms var(--ease), background 220ms var(--ease);
    }

    .result-item:hover {
      transform: translateX(4px);
      border-color: var(--line-strong);
      background: linear-gradient(120deg, rgba(255,255,255,0.98), rgba(255,250,240,0.78));
    }

    .result-index {
      grid-area: idx;
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border: 1px solid var(--line);
      border-radius: 14px;
      color: var(--subtle);
      background: rgba(20, 50, 38, 0.045);
      font-size: 13px;
      font-weight: 800;
    }

    .result-url {
      grid-area: url;
      color: var(--text);
      font-size: 15px;
      font-weight: 700;
      overflow-wrap: anywhere;
      min-width: 0;
    }

    .result-title {
      grid-area: title;
      color: var(--muted);
      font-size: 13px;
      overflow-wrap: anywhere;
      min-width: 0;
    }

    .result-status {
      grid-area: status;
      width: fit-content;
      max-width: 100%;
      padding: 8px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.02em;
      overflow-wrap: anywhere;
      white-space: normal;
    }

    .result-status.success {
      color: var(--success);
      background: var(--success-bg);
    }

    .result-status.failed {
      color: var(--danger);
      background: var(--danger-bg);
    }

    .result-webapps {
      grid-area: apps;
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }

    .app-badge,
    .empty-badge {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 5px 9px;
      border: 1px solid rgba(120, 220, 232, 0.18);
      border-radius: 9px;
      color: #0d6470;
      background: rgba(20, 124, 139, 0.1);
      font-size: 12px;
      font-weight: 700;
    }

    .empty-badge {
      border-color: var(--line);
      color: var(--subtle);
      background: rgba(20, 50, 38, 0.045);
    }

    .screenshot-thumb {
      grid-area: shot;
      position: relative;
      width: 150px;
      height: 84px;
      padding: 0;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--panel-soft);
      cursor: zoom-in;
      appearance: none;
      -webkit-appearance: none;
      transition: transform 220ms var(--ease), border-color 220ms var(--ease);
    }

    .screenshot-thumb:hover {
      transform: scale(1.04);
      border-color: rgba(215, 255, 114, 0.52);
    }

    .screenshot-thumb img {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      object-fit: cover;
    }

    .screenshot-thumb.empty {
      display: grid;
      place-items: center;
      cursor: default;
      color: var(--subtle);
      font-size: 12px;
      font-weight: 750;
    }

    .empty-state {
      display: none;
      padding: 34px;
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius-lg);
      color: var(--muted);
      background: rgba(255, 255, 255, 0.6);
      text-align: center;
    }

    .lightbox {
      position: fixed;
      inset: 0;
      z-index: 20;
      display: none;
      place-items: center;
      padding: 28px;
      background: rgba(244, 240, 231, 0.88);
      backdrop-filter: blur(18px);
    }

    .lightbox.active {
      display: grid;
      animation: fadeIn 180ms var(--ease) both;
    }

    .lightbox-content {
      max-width: min(1200px, 94vw);
      max-height: 86vh;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
    }

    .lightbox-close {
      position: fixed;
      top: 24px;
      right: 24px;
      width: 44px;
      height: 44px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--text);
      background: rgba(255, 255, 255, 0.72);
      cursor: pointer;
      font-size: 22px;
    }

    @keyframes enter {
      from { opacity: 0; transform: translateY(18px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes rowIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @media (max-width: 1180px) {
      .hero,
      .toolbar {
        grid-template-columns: 1fr;
      }

      .stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .result-item {
        grid-template-areas:
          "idx shot"
          "url shot"
          "title shot"
          "apps shot"
          "status shot";
        grid-template-columns: minmax(0, 1fr) 150px;
        align-items: start;
      }

      .screenshot-thumb {
        justify-self: end;
        align-self: center;
      }
    }

    @media (max-width: 720px) {
      .shell {
        width: min(100% - 24px, 1500px);
        padding-top: 14px;
      }

      .hero {
        padding: 24px;
        min-height: auto;
      }

      .stats {
        grid-template-columns: 1fr;
      }

      .toolbar,
      .filter-group {
        display: grid;
      }

      .section-head {
        display: block;
      }

      .section-count {
        margin-top: 8px;
      }

      .result-item {
        grid-template-areas:
          "idx"
          "url"
          "title"
          "apps"
          "status"
          "shot";
        grid-template-columns: 1fr;
        min-height: auto;
      }

      .result-index {
        width: fit-content;
        padding: 0 12px;
      }

      .result-url,
      .result-title,
      .result-webapps,
      .result-status,
      .screenshot-thumb {
        justify-self: start;
      }

      .screenshot-thumb {
        width: min(100%, 240px);
        height: 136px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero" aria-labelledby="report-title">
      <div>
        <div class="eyebrow"><span class="pulse"></span>Web asset reconnaissance</div>
        <h1 id="report-title">AssetProbe 扫描报告</h1>
        <p class="hero-copy">本报告汇总 URL 探测结果、HTTP 状态、页面标题、Web 指纹命中和截图证据，用于快速筛选可访问资产与异常目标。</p>
      </div>
      <aside class="hero-side" aria-label="报告元信息">
        <div class="meta-card">
          <div class="meta-label">生成时间</div>
          <div class="meta-value">${timestamp}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">报告范围</div>
          <div class="meta-value">${reportLabel}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">截图证据</div>
          <div class="meta-value">${hasScreenshots ? "已包含页面缩略图" : "未启用截图"}</div>
        </div>
      </aside>
    </section>

    <section class="stats" aria-label="扫描统计">
      <article class="stat-card total">
        <div class="stat-label">目标总数</div>
        <div class="stat-value">${totalCount}</div>
        <div class="stat-note">本次纳入报告的 URL 数量</div>
      </article>
      <article class="stat-card success">
        <div class="stat-label">访问成功</div>
        <div class="stat-value">${successCount}</div>
        <div class="stat-note">浏览器成功完成主页面加载</div>
      </article>
      <article class="stat-card failed">
        <div class="stat-label">访问失败</div>
        <div class="stat-value">${failCount}</div>
        <div class="stat-note">连接、超时或页面加载失败</div>
      </article>
      <article class="stat-card rate">
        <div class="stat-label">成功率</div>
        <div class="stat-value">${successRate}%</div>
        <div class="stat-note">失败占比 ${failedRate}%</div>
      </article>
    </section>

    <nav class="toolbar" aria-label="结果筛选">
      <label class="search">
        <span class="search-icon">⌕</span>
        <input type="search" id="searchInput" placeholder="搜索 URL 或页面标题" aria-label="搜索 URL 或页面标题">
      </label>
      <div class="filter-group" role="group" aria-label="状态筛选">
        <button class="filter-btn active" type="button" data-filter="all">全部</button>
        <button class="filter-btn" type="button" data-filter="success">成功</button>
        <button class="filter-btn" type="button" data-filter="failed">失败</button>
      </div>
      <div class="sort-dropdown" id="sortDropdown">
        <button class="sort-trigger" id="sortButton" type="button" aria-haspopup="listbox" aria-expanded="false">
          <span id="sortLabel">按扫描顺序</span>
        </button>
        <div class="sort-options" role="listbox" aria-label="排序方式">
          <button class="sort-option active" type="button" role="option" aria-selected="true" data-sort="index">按扫描顺序</button>
          <button class="sort-option" type="button" role="option" aria-selected="false" data-sort="url">按 URL</button>
          <button class="sort-option" type="button" role="option" aria-selected="false" data-sort="status">按状态</button>
        </div>
      </div>
    </nav>

    <section aria-labelledby="results-title">
      <div class="section-head">
        <h2 class="section-title" id="results-title">资产明细</h2>
        <div class="section-count">显示 <span id="visibleCount">${totalCount}</span> / ${totalCount} 条</div>
      </div>
      <div class="result-list" id="resultsContainer">
`;

  results.forEach((result, index) => {
    const statusClass = result.success ? "success" : "failed";
    const statusText = result.success ? "OK" : "FAIL";
    const statusCode = result.success
      ? result.status
      : result.errorCode || "无法访问";
    const title = result.title || "未获取到标题";
    const delay = Math.min(index * 0.035, 1.2).toFixed(2);
    const webappSearchText =
      result.webapps && result.webapps.length > 0
        ? result.webapps.map((app) => app.name).join(" ")
        : "";
    const searchableText = [
      result.url,
      title,
      statusCode,
      statusText,
      webappSearchText,
    ].join(" ");

    html += `
        <article class="result-item ${statusClass}" data-status="${statusClass}" data-index="${index}" data-search="${escapeHtml(searchableText)}" style="animation-delay: ${delay}s">
          <div class="result-index">#${index + 1}</div>
          <div class="result-url" title="${escapeHtml(result.url)}">${escapeHtml(result.url)}</div>
          <div class="result-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
          <div class="result-webapps">
`;

    if (result.webapps && result.webapps.length > 0) {
      result.webapps.forEach((app) => {
        const percent = Math.round(app.confidence * 100);
        html += `            <span class="app-badge" title="置信度 ${percent}%">${escapeHtml(app.name)} · ${percent}%</span>\n`;
      });
    } else {
      html += `            <span class="empty-badge">未识别指纹</span>\n`;
    }

    html += `          </div>
          <div class="result-status ${statusClass}">${escapeHtml(String(statusCode))} · ${statusText}</div>
`;

    if (result.screenshotPath) {
      const screenshotName = path.basename(result.screenshotPath);
      html += `          <button class="screenshot-thumb" type="button" onclick="openLightbox(event, '${escapeHtml(screenshotName)}')" aria-label="查看 ${escapeHtml(result.url)} 的截图">
            <img src="${escapeHtml(screenshotName)}" alt="${escapeHtml(result.url)} 的页面截图">
          </button>\n`;
    } else {
      html += `          <div class="screenshot-thumb empty">无截图</div>\n`;
    }

    html += `        </article>\n`;
  });

  html += `      </div>
      <div class="empty-state" id="emptyState">没有匹配的资产。请调整搜索词或筛选条件。</div>
    </section>
  </main>

  <div class="lightbox" id="lightbox" onclick="closeLightbox()" role="dialog" aria-modal="true" aria-label="截图预览">
    <button class="lightbox-close" type="button" onclick="closeLightbox()" aria-label="关闭截图预览">×</button>
    <img class="lightbox-content" id="lightbox-img" src="" alt="页面截图预览">
  </div>

  <script>
    let currentFilter = 'all';
    let currentSort = 'index';
    let searchQuery = '';

    function openLightbox(event, src) {
      event.stopPropagation();
      const lightbox = document.getElementById('lightbox');
      const lightboxImg = document.getElementById('lightbox-img');
      lightbox.classList.add('active');
      lightboxImg.src = src;
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      const lightbox = document.getElementById('lightbox');
      const lightboxImg = document.getElementById('lightbox-img');
      lightbox.classList.remove('active');
      lightboxImg.src = '';
      document.body.style.overflow = 'auto';
    }

    function normalizeSearchText(value) {
      return (value || '').toString().normalize('NFKC').trim().toLowerCase();
    }

    function filterAndSortResults() {
      const container = document.getElementById('resultsContainer');
      const emptyState = document.getElementById('emptyState');
      const items = Array.from(container.querySelectorAll('.result-item'));
      const filteredItems = items.filter(item => {
        const status = item.dataset.status;
        const searchableText = normalizeSearchText(item.dataset.search || item.textContent);
        const statusMatch = currentFilter === 'all' || status === currentFilter;
        const searchMatch = !searchQuery || searchableText.includes(searchQuery);
        return statusMatch && searchMatch;
      });

      filteredItems.sort((a, b) => {
        if (currentSort === 'url') {
          return a.querySelector('.result-url').textContent.localeCompare(b.querySelector('.result-url').textContent);
        }
        if (currentSort === 'status') {
          return a.dataset.status.localeCompare(b.dataset.status);
        }
        return Number(a.dataset.index) - Number(b.dataset.index);
      });

      items.forEach(item => {
        item.hidden = true;
      });

      filteredItems.forEach(item => {
        item.hidden = false;
        container.appendChild(item);
      });

      document.getElementById('visibleCount').textContent = filteredItems.length;
      emptyState.style.display = filteredItems.length === 0 ? 'block' : 'none';
    }

    document.getElementById('searchInput').addEventListener('input', event => {
      searchQuery = normalizeSearchText(event.target.value);
      filterAndSortResults();
    });

    document.querySelectorAll('.filter-btn').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        currentFilter = button.dataset.filter;
        filterAndSortResults();
      });
    });

    const sortDropdown = document.getElementById('sortDropdown');
    const sortButton = document.getElementById('sortButton');
    const sortLabel = document.getElementById('sortLabel');
    const sortOptions = document.querySelectorAll('.sort-option');

    function closeSortDropdown() {
      sortDropdown.classList.remove('open');
      sortButton.setAttribute('aria-expanded', 'false');
    }

    sortButton.addEventListener('click', event => {
      event.stopPropagation();
      const isOpen = sortDropdown.classList.toggle('open');
      sortButton.setAttribute('aria-expanded', String(isOpen));
    });

    sortOptions.forEach(option => {
      option.addEventListener('click', event => {
        event.stopPropagation();
        currentSort = option.dataset.sort;
        sortLabel.textContent = option.textContent;
        sortOptions.forEach(item => {
          item.classList.remove('active');
          item.setAttribute('aria-selected', 'false');
        });
        option.classList.add('active');
        option.setAttribute('aria-selected', 'true');
        closeSortDropdown();
        filterAndSortResults();
      });
    });

    document.addEventListener('click', event => {
      if (!sortDropdown.contains(event.target)) {
        closeSortDropdown();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeLightbox();
        closeSortDropdown();
      }
    });
  </script>
</body>
</html>`;

  return html;
}

function generateHTMLReport(results, batchDir, totalCount) {
  return buildPremiumHTMLReport(results, batchDir, totalCount);
}

// HTML转义函数
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// 生成 JSON 报告
function generateJSONReport(results, batchDir, totalCount, totalTime) {
  const timestamp = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
  });

  // 统计数据
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  const successRate =
    totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : "0.0";

  // 构建报告对象（简化metadata）
  const report = {
    timestamp: timestamp,
    results: results.map((result, index) => {
      const item = {
        index: index + 1,
        url: result.url,
        success: result.success,
      };

      if (result.success) {
        item.title = result.title || "";
        item.status_code = result.status || null;
        item.final_url = result.url;

        // Web 应用识别结果
        if (result.webapps && result.webapps.length > 0) {
          item.webapps = result.webapps.map((app) => ({
            vendor: app.company || "",
            product: app.name,
            confidence: Math.round(app.confidence * 100) + "%",
          }));
        } else {
          item.webapps = [];
        }

        // 中间件识别结果
        if (result.middleware && result.middleware.length > 0) {
          item.middleware = result.middleware;
        } else {
          item.middleware = [];
        }

        // 语言识别结果
        if (result.languages && result.languages.length > 0) {
          item.languages = result.languages;
        } else {
          item.languages = [];
        }
      } else {
        // 错误只输出 error_code，不输出详细错误信息
        item.error_code = result.errorCode || "Error";
      }

      return item;
    }),
  };

  return JSON.stringify(report, null, 2);
}

// 从文件读取URL列表
function readUrlsFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const urls = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")); // 过滤空行和注释
    return urls;
  } catch (error) {
    console.error(`[FAIL] 无法读取文件: ${filePath}`);
    console.error(`   ${error.message}`);
    return null;
  }
}

// 处理单个URL
async function processUrl(url, options) {
  const {
    proxyServer,
    screenshotPath,
    fullPage,
    batchMode,
    batchCollectMode,
    jsonMode,
  } = options;

  // 批量收集模式、批量模式或JSON模式：完全不输出，只返回结果
  if (batchCollectMode || batchMode || jsonMode) {
    // 不输出任何内容
  } else {
    console.log(`\n${"─".repeat(66)}`);
    console.log(`[URL] 正在访问: ${url}`);
    if (proxyServer) {
      console.log(`[PROXY] 使用代理: ${proxyServer}`);
    } else {
      console.log(`[WARN]  未使用代理`);
    }
    if (screenshotPath) {
      const filename = path.basename(screenshotPath);
      console.log(`[PIC] 截图保存: ${filename}`);
      if (fullPage) {
        console.log(`[PIC] 完整页面截图`);
      }
    }
  }

  // 启动浏览器
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-web-security", "--disable-features=VizDisplayCompositor"],
  });

  // 创建浏览器上下文
  const contextOptions = {
    ignoreHTTPSErrors: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  // 如果提供了代理，添加到配置中
  if (proxyServer) {
    const proxyAddr = proxyServer.startsWith("http")
      ? proxyServer
      : `http://${proxyServer}`;
    contextOptions.proxy = { server: proxyAddr };
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // 设置超时
  page.setDefaultTimeout(batchMode ? 30000 : 60000);

  // 用于保存主页面的响应状态
  let mainPageStatus = null;

  // 监听主页面响应，获取状态码
  page.on("response", (response) => {
    if (response.url() === url || response.url() === url + "/") {
      mainPageStatus = response.status();
    }
  });

  try {
    if (!batchMode && !jsonMode) {
      console.log("[LOADING] 正在加载页面...");
    }

    // 发起页面请求并获取响应
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: batchMode ? 30000 : 60000,
    });

    // 如果没有通过监听获取到状态码，直接从响应中获取
    if (!mainPageStatus && response) {
      mainPageStatus = response.status();
    }

    // 等待一下确保页面加载
    await page.waitForTimeout(batchMode ? 500 : 2000);

    // Web 应用指纹识别（内部会再等待1500ms并获取标题）
    const webapps = await identifyWebApp(response, page, url, batchMode);

    // Middleware 和 Language 指纹识别
    const middleware = identifyMiddleware(response);
    const languages = identifyLanguage(response);

    // 在指纹识别后再次获取标题（此时已经等待足够时间）
    const title = await page.title();
    const finalUrl = page.url();

    // 状态码显示和颜色
    let statusText = `${mainPageStatus || "N/A"}`;
    let statusColor = getStatusColor(mainPageStatus);
    const coloredStatus = `${statusColor}${statusText}${colors.reset}`;

    // 批量收集模式、批量模式或JSON模式：不输出，只返回结果
    if (batchCollectMode || batchMode || jsonMode) {
      if (screenshotPath) {
        await page.screenshot({
          path: screenshotPath,
          fullPage: fullPage,
        });
      }
      return {
        success: true,
        url: finalUrl,
        status: mainPageStatus,
        title,
        screenshotPath,
        webapps,
        middleware,
        languages,
      };
    }

    // 单个URL模式：完整框框输出
    // Web应用显示（不在框框内，独立显示）
    let webappsStr = "";
    if (webapps && webapps.length > 0) {
      webappsStr = webapps
        .slice(0, 3)
        .map((app) => {
          const percent = Math.round(app.confidence * 100);
          // 格式：公司名-原产品名
          const company = app.company || "";
          const displayName = company ? `${company}-${app.name}` : app.name;
          return `${displayName} [${percent}%]`;
        })
        .join(" | ");
    }

    console.log("");
    console.log(`最终URL: ${finalUrl}`);
    console.log(`状态码: ${coloredStatus}`);
    console.log(`网站标题: ${title}`);

    // Web应用
    if (webappsStr) {
      console.log(`Web应用: ${webappsStr}`);
    }

    // Middleware
    if (middleware.length > 0) {
      console.log(`中间件: ${middleware.join(" | ")}`);
    }

    // Language
    if (languages.length > 0) {
      console.log(`语言: ${languages.join(" | ")}`);
    }
    console.log("");

    // 保存截图
    if (screenshotPath) {
      console.log("[SAVE] 正在保存截图...");
      await page.screenshot({
        path: screenshotPath,
        fullPage: fullPage,
      });

      const absolutePath = path.resolve(screenshotPath);
      const stats = fs.statSync(screenshotPath);
      const fileSizeKB = (stats.size / 1024).toFixed(2);

      console.log(
        `[OK] 截图已保存: ${absolutePath} 文件大小: ${fileSizeKB} KB`,
      );
    }

    return {
      success: true,
      url: finalUrl,
      status: mainPageStatus,
      title,
      webapps,
      middleware,
      languages,
    };
  } catch (error) {
    // 批量收集模式、批量模式或JSON模式：不输出，只返回错误代码
    if (batchCollectMode || batchMode || jsonMode) {
      let errorMsg = error.message;

      // 提取错误代码（如 ERR_CONNECTION_RESET）
      const errMatch = errorMsg.match(/net::(ERR_\w+)/);
      if (errMatch) {
        errorMsg = errMatch[1];
      } else {
        // 对于 Playwright 错误，显示友好信息
        if (errorMsg.includes("page.goto") || errorMsg.includes("goto")) {
          errorMsg = "Connection Error";
        } else if (errorMsg.includes("timeout")) {
          errorMsg = "Timeout";
        } else {
          errorMsg = "Error";
        }
      }
      return { success: false, url, error: error.message, errorCode: errorMsg };
    }
    console.error("\n[FAIL] 发生错误:");
    console.error(`   类型: ${error.name}`);
    console.error(`   信息: ${error.message}`);
    console.error("");
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
      console.error("[FAIL] URL列表为空或文件不存在\n");
      process.exit(1);
    }

    // JSON 模式下不输出任何进度信息
    if (!args.json) {
      console.log(`\n[BATCH] 批量处理模式`);
      console.log(`[FILE] 文件: ${args.batchFile}`);
      console.log(`[URL] URL数量: ${urls.length}`);
      if (args.proxy) {
        console.log(`[PROXY] 使用代理: ${args.proxy}`);
      }
      if (args.screenshot) {
        console.log(`[PIC] 启用截图`);
      }
      console.log(`[CONC] 并发数: ${args.concurrency}`);
    }

    // 并发处理所有URL
    const { successCount, failCount, batchDir, detailedResults, totalTime } =
      await processUrlsConcurrently(urls, {
        proxyServer: args.proxy,
        screenshot: args.screenshot,
        fullPage: args.fullPage,
        concurrency: args.concurrency,
        jsonOutput: !!args.json, // 传递 JSON 模式标志
      });

    // JSON 模式：输出 JSON 到控制台
    if (args.json) {
      const jsonReport = generateJSONReport(
        detailedResults,
        batchDir,
        urls.length,
        totalTime,
      );

      // 输出 JSON 到控制台
      console.log(jsonReport);

      // 保存到文件（如果指定了 -o 参数）
      if (args.output) {
        const jsonPath = args.output;
        const jsonDir = path.dirname(jsonPath);
        if (jsonDir !== "." && !fs.existsSync(jsonDir)) {
          fs.mkdirSync(jsonDir, { recursive: true });
        }
        fs.writeFileSync(jsonPath, jsonReport, "utf-8");
      }

      return;
    }

    // 保存 JSON 到文件（如果指定了 -o 参数）
    if (args.output) {
      const jsonReport = generateJSONReport(
        detailedResults,
        batchDir,
        urls.length,
        totalTime,
      );
      const jsonPath = args.output;
      const jsonDir = path.dirname(jsonPath);
      if (jsonDir !== "." && !fs.existsSync(jsonDir)) {
        fs.mkdirSync(jsonDir, { recursive: true });
      }
      fs.writeFileSync(jsonPath, jsonReport, "utf-8");
    }

    // 非 JSON 模式：正常输出结果（移除统计头部，直接输出结果）

    // 只有使用截图时才生成HTML报告
    if (args.screenshot) {
      const htmlReport = generateHTMLReport(
        detailedResults,
        batchDir,
        urls.length,
      );
      const reportPath = path.join(
        process.cwd(),
        "screenshots",
        "batch",
        batchDir,
        "report.html",
      );

      // 确保目录存在
      const reportDirPath = path.join(
        process.cwd(),
        "screenshots",
        "batch",
        batchDir,
      );
      if (!fs.existsSync(reportDirPath)) {
        fs.mkdirSync(reportDirPath, { recursive: true });
      }

      fs.writeFileSync(reportPath, htmlReport, "utf-8");
      console.log(`[FILE] HTML报告: screenshots/batch/${batchDir}/report.html`);
      console.log(`[DIR] 截图保存: screenshots/batch/${batchDir}/`);
    }

    return;
  }

  // 单个URL模式
  if (!args.url) {
    console.log("[FAIL] 错误: 请提供要访问的 URL 或使用 -b 指定批量文件\n");
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

  // 处理单个 URL
  const result = await processUrl(targetUrl, {
    proxyServer,
    screenshotPath,
    fullPage: args.fullPage,
    jsonMode: args.json,
  });

  // JSON 模式：输出 JSON 到控制台
  if (args.json) {
    const jsonReport = generateJSONReport([result], null, 1, "0");
    console.log(jsonReport);

    // 保存到文件（如果指定了 -o 参数）
    if (args.output) {
      const jsonPath = args.output;
      const jsonDir = path.dirname(jsonPath);
      if (jsonDir !== "." && !fs.existsSync(jsonDir)) {
        fs.mkdirSync(jsonDir, { recursive: true });
      }
      fs.writeFileSync(jsonPath, jsonReport, "utf-8");
    }
    return;
  }

  // 保存 JSON 到文件（如果指定了 -o 参数）
  if (args.output) {
    const jsonReport = generateJSONReport([result], null, 1, "0");
    const jsonPath = args.output;
    const jsonDir = path.dirname(jsonPath);
    if (jsonDir !== "." && !fs.existsSync(jsonDir)) {
      fs.mkdirSync(jsonDir, { recursive: true });
    }
    fs.writeFileSync(jsonPath, jsonReport, "utf-8");
    if (result.success) {
      console.error(
        `\n${colors.green}[OK] 成功${colors.reset} - ${colors.cyan}${result.title || "N/A"}${colors.reset}`,
      );
      console.error(`[PIC] JSON报告已保存: ${jsonPath}`);
    } else {
      console.error(
        `\n${colors.red}[FAIL] 失败${colors.reset} - ${result.errorCode || "Error"}`,
      );
      console.error(`[PIC] JSON报告已保存: ${jsonPath}`);
    }
  }
})();
