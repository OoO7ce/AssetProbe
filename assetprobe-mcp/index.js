#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// === MCP Server ===
const server = new Server(
  {
    name: 'assetprobe-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// === 加载指纹库 ===
function loadFingerprints() {
  try {
    const filePath = path.join(__dirname, '../webapp-fingerprints.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`无法加载指纹库: ${error.message}`);
    return {};
  }
}

// === MurmurHash3 算法 ===
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

  for (let i = 0; i < nblocks; i++) {
    let k1 = data.readUInt32LE(i * 4);
    k1 = Math.imul(k1, c1);
    k1 = (k1 << r1) | (k1 >>> (32 - r1));
    k1 = Math.imul(k1, c2);
    h1 ^= k1;
    h1 = (h1 << r2) | (h1 >>> (32 - r2));
    h1 = Math.imul(h1, m) + n;
  }

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

  h1 ^= len;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  return h1 | 0;
}

// === 获取 Icon Hash ===
async function getIconHash(page, url) {
  try {
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

    const iconBuffer = await page.evaluate(async (iconUrl) => {
      try {
        const response = await fetch(iconUrl);
        if (!response.ok) return null;
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
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
      let base64 = iconBuffer.replace(/(.{76})/g, '$1\n');
      if (!base64.endsWith('\n')) {
        base64 += '\n';
      }
      const hash = murmurhash3(Buffer.from(base64, 'utf-8'));
      return hash.toString();
    }
  } catch (e) {
    // 静默失败
  }
  return null;
}

// === 获取 Headers ===
function getHeaderString(response) {
  const headers = response.headers();
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

// === 匹配条件（支持 && 和 ||）===
function matchCondition(conditionStr, content, matchFn) {
  const orParts = conditionStr.split(' || ').map(s => s.trim());
  return orParts.some(orPart => {
    const andParts = orPart.split(' && ').map(s => s.trim());
    return andParts.every(andPart => matchFn(andPart, content));
  });
}

// === Web 应用指纹识别 ===
async function identifyWebApp(response, page, url) {
  const fingerprints = loadFingerprints();
  const detected = [];

  if (Object.keys(fingerprints).length === 0) {
    return detected;
  }

  try {
    await page.waitForFunction(() => {
      return document.title && document.title.length > 0;
    }, { timeout: 3000 });
  } catch (e) {
    // 超时继续
  }

  const mainPageTitle = await page.title();
  const mainPageHtml = await page.content();
  const mainPageHtmlLower = mainPageHtml.toLowerCase();
  const headerStr = getHeaderString(response);
  const headerStrLower = headerStr.toLowerCase();
  const mainPageTitleLower = mainPageTitle.toLowerCase();

  const iconHash = await getIconHash(page, url);

  for (const [appName, features] of Object.entries(fingerprints)) {
    let confidence = 0;

    if (features.icon && iconHash) {
      const iconValue = features.icon[0];
      if (matchCondition(iconValue, iconHash, (v, c) => v === c)) {
        confidence += features.icon[1];
      }
    }

    if (features.title) {
      const titleValue = features.title[0];
      if (matchCondition(titleValue, mainPageTitleLower, (v, c) => c.includes(v.toLowerCase()))) {
        confidence += features.title[1];
      }
    }

    if (features.header) {
      const headerValue = features.header[0];
      if (matchCondition(headerValue, headerStrLower, (v, c) => c.includes(v.toLowerCase()))) {
        confidence += features.header[1];
      }
    }

    if (features.body) {
      const bodyValue = features.body[0];
      if (matchCondition(bodyValue, mainPageHtmlLower, (v, c) => c.includes(v.toLowerCase()))) {
        confidence += features.body[1];
      }
    }

    if (confidence > 0) {
      detected.push({
        name: appName,
        confidence: confidence
      });
    }
  }

  const sorted = detected.sort((a, b) => b.confidence - a.confidence);
  return sorted.slice(0, 3);
}

// === 探测单个 URL ===
async function probeUrl(url, proxyServer = null) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });

  try {
    const contextOptions = {
      ignoreHTTPSErrors: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    if (proxyServer) {
      const proxyAddr = proxyServer.startsWith('http') ? proxyServer : `http://${proxyServer}`;
      contextOptions.proxy = { server: proxyAddr };
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    let mainPageStatus = null;

    page.on('response', response => {
      if (response.url() === url || response.url() === url + '/') {
        mainPageStatus = response.status();
      }
    });

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    if (!mainPageStatus && response) {
      mainPageStatus = response.status();
    }

    await page.waitForTimeout(2000);

    const webapps = await identifyWebApp(response, page, url);
    const title = await page.title();
    const finalUrl = page.url();

    await context.close();

    return {
      success: true,
      url: finalUrl,
      status: mainPageStatus,
      title: title,
      webapps: webapps.map(app => ({
        name: app.name,
        confidence: Math.round(app.confidence * 100)
      }))
    };

  } catch (error) {
    let errorMsg = error.message;
    const errMatch = errorMsg.match(/net::(ERR_\w+)/);
    if (errMatch) {
      errorMsg = errMatch[1];
    }
    return {
      success: false,
      url: url,
      error: errorMsg
    };
  } finally {
    await browser.close();
  }
}

// === 批量探测 URLs ===
async function batchProbe(urls, proxyServer = null, concurrency = 5) {
  const results = [];
  const processing = new Set();

  for (let i = 0; i < urls.length; i++) {
    while (processing.size >= concurrency) {
      await Promise.race(processing);
    }

    const promise = probeUrl(urls[i], proxyServer).then(result => {
      return result;
    }).finally(() => {
      processing.delete(promise);
    });

    processing.add(promise);
    results.push(promise);
  }

  await Promise.all(processing);
  return Promise.all(results);
}

// === 注册 Tools ===
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'probe_url',
        description: '探测单个URL，获取状态码、标题和Web应用指纹信息',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: '要探测的URL地址'
            },
            proxy: {
              type: 'string',
              description: '代理服务器地址（可选）格式: IP:端口 或 http://IP:端口'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'batch_probe',
        description: '批量探测多个URL，获取状态码、标题和Web应用指纹信息',
        inputSchema: {
          type: 'object',
          properties: {
            urls: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: '要探测的URL列表'
            },
            proxy: {
              type: 'string',
              description: '代理服务器地址（可选）格式: IP:端口 或 http://IP:端口'
            },
            concurrency: {
              type: 'number',
              description: '并发数（默认5）',
              default: 5
            }
          },
          required: ['urls']
        }
      }
    ]
  };
});

// === 处理 Tool 调用 ===
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'probe_url': {
        const { url, proxy } = args;
        const result = await probeUrl(url, proxy || null);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'batch_probe': {
        const { urls, proxy, concurrency = 5 } = args;
        const results = await batchProbe(urls, proxy || null, concurrency);

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        const summary = {
          total: urls.length,
          success: successCount,
          failed: failCount,
          results: results
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`未知工具: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            tool: name
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// === 启动 Server ===
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // stderr 用于调试输出
  console.error('AssetProbe MCP Server 已启动');
  console.error('版本: 1.0.0');
  console.error('传输方式: stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
