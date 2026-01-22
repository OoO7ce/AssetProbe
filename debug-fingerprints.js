const { chromium } = require('playwright');

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

// 调试指纹识别 - 显示提取到的实际数据
async function debugFingerprint(url) {
  console.log(`\n🔍 正在分析: ${url}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(url, {
      waitUntil: 'load',
      timeout: 30000
    });

    // 等待动态内容加载（等待标题出现或超时）
    try {
      await page.waitForFunction(() => {
        return document.title && document.title.length > 0;
      }, { timeout: 15000 });
    } catch (e) {
      console.log('⚠️  15秒后仍未获取到标题，继续分析...');
    }

    // 先提取主页面的信息（在获取icon之前，因为page会导航到icon URL）
    let mainPageTitle = '';
    let mainPageHtml = '';
    let mainPageHeaders = {};

    try {
      mainPageTitle = await page.title();
      mainPageHtml = await page.content();
      mainPageHeaders = response.headers();
    } catch (e) {
      // 如果页面已经重定向，尝试重新获取
      try {
        mainPageTitle = await page.title();
        mainPageHtml = await page.content();
        mainPageHeaders = response.headers();
      } catch (e2) {
        console.log('⚠️  页面发生重定向，部分信息可能不完整');
        mainPageTitle = 'N/A';
        mainPageHtml = '';
        mainPageHeaders = {};
      }
    }

    // 1. 获取 Icon Hash（Shodan 方式：base64 → MurmurHash3）
    console.log('═══ 1. Icon Hash (Shodan: base64 + MurmurHash3) ═══');
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

      console.log(`Icon URL: ${iconUrl}`);

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
        console.log(`✅ Icon Hash: ${hash}`);
      } else {
        console.log('❌ 无法获取 Icon');
      }
    } catch (e) {
      console.log(`❌ Icon 获取失败: ${e.message}`);
    }

    // 2. Headers（使用主页面的headers）
    console.log('\n═══ 2. Response Headers ═══');
    Object.entries(mainPageHeaders).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    // 3. Title（使用主页面的title）
    console.log('\n═══ 3. Page Title ═══');
    console.log(`  ${mainPageTitle}`);

    // 4. HTML 内容（使用主页面的HTML，供人工查看和提取body特征）
    console.log('\n═══ 4. HTML Content (前2000字符) ═══');
    console.log(mainPageHtml.substring(0, 2000));
    if (mainPageHtml.length > 2000) {
      console.log(`\n... (总长度: ${mainPageHtml.length} 字符)`);
    }

    console.log('\n✅ 分析完成！\n');
    console.log('💡 提示：\n');
    console.log('   1. 将 Icon Hash 添加到指纹库的 icon 字段\n');
    console.log('   2. 从 Headers 中查找特征字符串，添加到 header 字段\n');
    console.log('   3. 从 HTML Content 中查找特征字符串，添加到 body 字段\n');
    console.log('   4. 将 Page Title 中的关键字添加到 title 字段\n');

  } catch (error) {
    console.error(`\n❌ 错误: ${error.message}\n`);
  } finally {
    await browser.close();
  }
}

const url = process.argv[2];
if (!url) {
  console.log('\n用法: node debug-fingerprint.js <URL>\n');
  process.exit(1);
}

debugFingerprint(url);
