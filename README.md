[简体中文](./README_CN.md) | English

# AssetProbe

[![npm version](https://img.shields.io/npm/v/assetprobe)](https://www.npmjs.com/package/assetprobe)
[![npm downloads](https://img.shields.io/npm/dm/assetprobe)](https://www.npmjs.com/package/assetprobe)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/npm/l/assetprobe)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/m0b1u3/AssetProbe?style=social)](https://github.com/m0b1u3/AssetProbe)

Web asset discovery and reconnaissance tool with batch processing, screenshot, HTML report generation, and web application fingerprinting.

## Features

- 🌐 **Dynamic Rendering**: Powered by Playwright, renders JavaScript-heavy sites (SPA, React, Vue, Angular)
- 🔄 **Concurrent Processing**: Batch process URLs with configurable concurrency (default: 5, range: 5-100)
- 📸 **Screenshot**: Capture screenshots or full-page screenshots
- 📊 **Multi-format Reports**: Auto-generated HTML reports and JSON exports
- 🎯 **Fingerprint Recognition**: Identify web apps, middleware, and programming languages

## Use Cases

### 1. Asset Discovery & Management

- **Internal Network Scanning**: Quickly scan IP ranges or domain lists to identify web services
- **Asset Classification**: Quickly identify system types through website titles
- **Visual Archiving**: Visually record current website states through screenshots
- **Batch Verification**: Check if large number of assets are alive

### 2. Security Testing Assistance

- **Information Gathering**: Quickly identify live sites, collect titles and screenshots
- **Port Scan Verification**: Verify web services with port scan results
- **Proxy Support**: Access and test different network environments via proxy
- **Target Filtering**: Filter high-value targets through screenshots

### 3. Website Health Check

- **Batch Monitoring**: Regularly check key website status
- **Availability Reports**: Generate HTML reports showing monitoring results
- **Failure Tracking**: Uniformly mark "site inaccessible"

**Core Value**:
- ⚡ **Efficient**: Concurrent processing is 10-50x faster than sequential
- 👁️ **Visual**: Screenshots + titles are easier to understand than plain text
- 📊 **Automated**: Batch processing + report generation

## Installation

### Requirements

- **Node.js** >= 18.0.0
- **npm** or **yarn**

### Option 1: Install via npm (Recommended)

```bash
npm install -g assetprobe
```

After installation, use `assetprobe` directly:

```bash
assetprobe -u https://www.example.com
assetprobe -b urls.txt -c 10
```

### Option 2: Install from Source

```bash
# Clone the project
git clone https://github.com/m0b1u3/AssetProbe.git
cd AssetProbe

# Install dependencies (Chromium browser will be downloaded automatically)
npm install

# Run
npm start -- -u https://www.example.com
# or
node assetprobe.js -u https://www.example.com
```

**Note**: Chromium browser (~300MB) will be downloaded automatically on first run.

## Usage

### Basic Usage

```bash
# View help
assetprobe --help

# Access single website
assetprobe -u https://www.example.com

# Access with proxy
assetprobe -u https://www.example.com -p 127.0.0.1:7890

# Take screenshot
assetprobe -u https://www.example.com -s

# Full page screenshot
assetprobe -u https://www.example.com -s -f

# Export JSON to console
assetprobe -u https://www.example.com -j

# Save JSON to file
assetprobe -u https://www.example.com -j -o results.json
```

### Batch Processing

```bash
# Batch process URL list
assetprobe -b urls.txt

# Batch process with screenshot (auto-generate HTML report)
assetprobe -b urls.txt -s

# Batch process with JSON export
assetprobe -b urls.txt -j

# Save JSON to file
assetprobe -b urls.txt -j -o results.json

# Adjust concurrency (default 5, range 5-100)
assetprobe -b urls.txt -c 20
```

**URL List File Format (urls.txt)**:
```
https://www.example.com
https://www.example.org

# This is a comment, will be ignored
https://192.168.1.1:8080
```

## Report Export

### HTML Report

After batch processing, HTML reports are auto-generated with:

- 📈 Statistics overview (total, success, failed, success rate)
- 📋 Result list (URL, title, status code, web app fingerprint)
- 🔍 Search and filter
- 🖼️ Screenshot preview (thumbnail, click to enlarge)
- 🎨 Modern white theme with smooth animations

### JSON Report

```bash
# Single URL - output to console
assetprobe -u https://example.com -j

# Single URL - save to file
assetprobe -u https://example.com -j -o results.json

# Batch - output to console
assetprobe -b urls.txt -j
```

JSON report contains:
- Timestamp
- Results: URL, status code, title
- Web app fingerprint (vendor, product, confidence)
- Middleware detection
- Programming language detection
- Error codes for failed requests

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-u, --url <address>` | Website address to visit | - |
| `-p, --proxy <address>` | Proxy server (format: `IP:PORT` or `http://IP:PORT`) | - |
| `-b, --batch <file>` | URL list file for batch processing | - |
| `-c, --concurrency <number>` | Concurrent processing count | 5 |
| `-s, --screenshot [file]` | Save website screenshot | - |
| `-f, --full` | Capture full page | - |
| `-j, --json` | Output JSON to console | - |
| `-o, --output <file>` | Save JSON to file | - |
| `-h, --help` | Show help | - |

## Screenshot Notes

### Single URL Mode

- Save automatically by domain/IP
- Filename: `screenshot_timestamp.png`
- Custom filename supported

### Batch Mode

- Timestamp folder: `screenshots/batch/timestamp/`
- Filename: `domain.png`
- Auto-generate HTML report

### Folder Structure

```
screenshots/
├── www.example.com/           # Single mode
│   └── screenshot_2025-12-31.png
└── batch/                      # Batch mode
    └── 2025-12-31T10-00-00/
        ├── report.html        # HTML report
        ├── results.json      # JSON report
        ├── www.example.com.png
        └── www.example.org.png
```

## Performance Optimization

- **Default Concurrency**: 5 (balance of performance and stability)
- **Adjustable Range**: 5-100
- **Batch Mode Timeout**: 30 seconds
- **Batch Mode Wait**: 500ms

**Performance Comparison:**
```
Sequential: 100 URL × 2 sec = 200 sec (3.3 min)
Concurrent 5:   100 URL ÷ 5 × 2 sec = 40 sec
Concurrent 20:  100 URL ÷ 20 × 2 sec = 10 sec
Concurrent 50:  100 URL ÷ 50 × 2 sec = 4 sec
```

## Status Code Reference

| Status Code | Meaning | Example |
|-------------|---------|---------|
| 200-299 | Success | 200 ✓ |
| 300-399 | Redirect | 301 ↪ |
| 400-499 | Client Error | 404 ⚠️ |
| 500-599 | Server Error | 500 ❌ |
| Connection Failed | Site unreachable | Site unreachable ✗ |

## Development

### NPM Scripts

```bash
npm start                      # Run main program
npm run install-browser        # Install browser manually
```

### Global Install (Development)

If you want to install globally from local source:

```bash
# In project root
npm link

# Or use npm global install
npm install -g ./

# Test
assetprobe --help
```

### Uninstall

```bash
# Uninstall global install
npm uninstall -g assetprobe
```

## Project Structure

```
assetprobe/
├── assetprobe.js              # Main program
├── package.json               # Project config
├── README.md                  # Documentation (English)
├── README_CN.md               # Documentation (Chinese)
├── LICENSE                    # License
├── .npmignore                 # npm ignore rules
├── webapp-fingerprints.json   # Web app fingerprint database
├── middleware-fingerprints.json # Middleware fingerprint database
├── language-fingerprints.json  # Programming language fingerprint database
└── screenshots/               # Screenshot directory (auto-created)
```

## Notes

1. **First Run**: `npm install` will automatically download Chromium (~300MB)
2. **Proxy Address**: Can omit `http://` prefix, program handles automatically
3. **Timeout**: Single mode 60 seconds, batch mode 30 seconds
4. **Anti-crawler**: Some websites may have anti-crawler mechanisms, set request frequency reasonably
5. **Write Permission**: Screenshots are saved in current directory, ensure write permission
6. **Concurrency**: Start with low concurrency and increase gradually (5 → 10 → 20)

## License

[ISC License](LICENSE)

## Author

m0b1u3

## Contributing

Contributions are welcome! Please follow:

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat: add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## ⭐ If This Project Helps You

Please give a ⭐ Star to support!

- Click the Star button on the GitHub page
- Share with friends who need it
- Provide feedback and suggestions
- Submit PRs to improve the project

## Acknowledgments

- [Playwright](https://playwright.dev/) - Modern browser automation tool
- Web app fingerprint database organized from open source projects

---

**Made with ❤️ by m0b1u3**
