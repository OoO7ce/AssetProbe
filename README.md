[简体中文](./README_CN.md) | English

# AssetProbe

[![npm version](https://badge.fury.io/js/assetprobe.svg)](https://www.npmjs.com/package/assetprobe)
[![npm downloads](https://img.shields.io/npm/dm/assetprobe)](https://www.npmjs.com/package/assetprobe)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/npm/l/assetprobe)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/OoO7ce/AssetProbe?style=social)](https://github.com/OoO7ce/AssetProbe)

Web asset discovery and reconnaissance tool with batch processing, screenshot, HTML report generation, and web application fingerprinting.

## Features

- 🌐 **Dynamic Rendering**: Supports SPA, React/Vue/Angular and other JavaScript-rendered websites
- 🔄 **Concurrent Processing**: Batch process URLs with default concurrency of 5 (adjustable 10-100)
- 📸 **Screenshot**: Supports screenshot and full-page screenshot
- 📊 **Multi-format Reports**: Auto-generate HTML reports and JSON exports
- 🎯 **Fingerprint Recognition**: Identify web apps and tech stacks based on 17,000+ fingerprint database

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
git clone https://github.com/OoO7ce/AssetProbe.git
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

# Quiet mode
assetprobe -u https://www.example.com -q

# Export JSON report
assetprobe -u https://www.example.com -j results.json
```

### Batch Processing

```bash
# Batch process URL list
assetprobe -b urls.txt

# Batch process with screenshot
assetprobe -b urls.txt -s -q

# Batch process with JSON export (auto-named)
assetprobe -b urls.txt -j

# Batch process with JSON export (specified path)
assetprobe -b urls.txt -j custom/results.json

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
# Single URL export
assetprobe -u https://example.com -j results.json

# Batch process with export (auto-named)
assetprobe -b urls.txt -j
```

JSON report contains complete data:
- URL and status code
- Website title
- Web app fingerprint (confidence)
- Screenshot path
- Statistics

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-u, --url <address>` | Website address to visit | - |
| `-p, --proxy <address>` | Proxy server (format: `IP:PORT` or `http://IP:PORT`) | - |
| `-b, --batch <file>` | URL list file for batch processing | - |
| `-c, --concurrency <number>` | Concurrent processing count | 5 |
| `-s, --screenshot [file]` | Save website screenshot | - |
| `-f, --full` | Capture full page | - |
| `-q, --quiet` | Quiet mode, hide network request details | - |
| `-j, --json [file]` | Export JSON report | - |
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
├── README.md                  # Documentation
├── LICENSE                    # License
├── .npmignore                 # npm ignore rules
├── webapp-fingerprints.json   # Web app fingerprint database (17,000+)
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

Ark

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

**Made with ❤️ by Ark**
