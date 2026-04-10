# 跨平台支持实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Claude Code Web UI 添加 macOS 和 Linux 平台支持，使用 GitHub Actions 矩阵构建策略自动化构建和发布。

**Architecture:** 使用 GitHub Actions 的 3-job 工作流：(1) 前端构建一次并上传为 artifact，(2) 三个平台并行下载 artifact 并构建各自的安装包，(3) 手动触发时收集所有安装包创建统一的 GitHub Release。

**Tech Stack:** Electron, electron-builder, GitHub Actions (matrix strategy, artifacts), Node.js 24

---

## 文件结构规划

### 需要修改的文件
- `electron/package.json` - 添加 macOS 和 Linux 构建配置
- `package.json` - 更新项目描述为跨平台
- `.github/workflows/release.yml` - 重命名为备份
- 创建 `.github/workflows/build-release.yml` - 新的跨平台工作流
- `README.md` - 添加跨平台安装说明

### 文件职责
- `electron/package.json`: 定义所有平台的构建目标、图标、架构
- `build-release.yml`: 编排 3-job 工作流，处理 artifact 传递和 Release 创建
- `README.md`: 提供用户友好的安装指引

---

## Task 1: 更新 Electron 配置支持 macOS

**Files:**
- Modify: `electron/package.json:30-64`

- [ ] **Step 1: 添加 macOS 构建配置**

在 `electron/package.json` 的 `"build"` 对象中，在 `"win"` 配置之后添加 macOS 配置：

```json
    "mac": {
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        }
      ],
      "icon": "build/icon.png",
      "category": "public.app-category.developer-tools"
    },
```

**位置：** 在 `"win": { ... }` 配置块之后，`"nsis": { ... }` 配置块之前

- [ ] **Step 2: 验证 JSON 语法**

运行：
```bash
cd electron
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))"
```

Expected: 无输出（表示 JSON 有效）

- [ ] **Step 3: 提交更改**

```bash
git add electron/package.json
git commit -m "feat: add macOS build configuration (DMG, x64+arm64)"
```

---

## Task 2: 更新 Electron 配置支持 Linux

**Files:**
- Modify: `electron/package.json:30-64`

- [ ] **Step 1: 添加 Linux 构建配置**

在 `electron/package.json` 的 `"build"` 对象中，在 `"mac"` 配置之后添加 Linux 配置：

```json
    "linux": {
      "target": [
        {
          "target": "AppImage",
          "arch": ["x64"]
        },
        {
          "target": "deb",
          "arch": ["x64"]
        },
        {
          "target": "rpm",
          "arch": ["x64"]
        }
      ],
      "icon": "build/icon.png",
      "category": "Utility"
    },
```

**位置：** 在 `"mac": { ... }` 配置块之后，`"nsis": { ... }` 配置块之前

- [ ] **Step 2: 验证 JSON 语法**

运行：
```bash
cd electron
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))"
```

Expected: 无输出（表示 JSON 有效）

- [ ] **Step 3: 提交更改**

```bash
git add electron/package.json
git commit -m "feat: add Linux build configuration (AppImage, deb, rpm)"
```

---

## Task 3: 更新项目描述为跨平台

**Files:**
- Modify: `package.json:2-5`
- Modify: `electron/package.json:2-5`

- [ ] **Step 1: 更新根目录 package.json 描述**

修改 `package.json` 的 `description` 字段：

```json
  "description": "Claude Code DAG Web UI - Cross-platform Desktop Application",
```

- [ ] **Step 2: 更新 electron/package.json 描述**

修改 `electron/package.json` 的 `description` 字段：

```json
  "description": "Claude Code DAG Web UI - Electron Package for Windows, macOS, and Linux",
```

- [ ] **Step 3: 验证 JSON 语法**

运行：
```bash
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))"
cd electron
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))"
```

Expected: 无输出（表示 JSON 有效）

- [ ] **Step 4: 提交更改**

```bash
git add package.json electron/package.json
git commit -m "docs: update project description to reflect cross-platform support"
```

---

## Task 4: 备份现有 Windows 工作流

**Files:**
- Rename: `.github/workflows/release.yml` → `.github/workflows/release-windows-backup.yml`

- [ ] **Step 1: 重命名现有工作流为备份**

运行：
```bash
git mv .github/workflows/release.yml .github/workflows/release-windows-backup.yml
```

Expected: 文件重命名成功

- [ ] **Step 2: 提交更改**

```bash
git commit -m "chore: backup existing Windows-only workflow"
```

---

## Task 5: 创建跨平台工作流 - Job 1 (前端构建)

**Files:**
- Create: `.github/workflows/build-release.yml`

- [ ] **Step 1: 创建工作流文件头部和触发条件**

创建 `.github/workflows/build-release.yml` 文件，内容如下：

```yaml
name: Build Cross-Platform Release

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      version_tag:
        description: 'Git tag for this release (e.g., v1.2.0)'
        required: true
        default: 'v1.2.0'

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

permissions:
  contents: write

jobs:
  build-frontend:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install frontend dependencies
        run: npm ci

      - name: Build frontend
        run: npm run build

      - name: Upload frontend artifact
        uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: dist/
          retention-days: 1
```

- [ ] **Step 2: 验证 YAML 语法**

运行：
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-release.yml'))"
```

Expected: 无输出（表示 YAML 有效）

- [ ] **Step 3: 提交更改**

```bash
git add .github/workflows/build-release.yml
git commit -m "feat: add cross-platform workflow - frontend build job"
```

---

## Task 6: 添加跨平台工作流 - Job 2 (平台构建)

**Files:**
- Modify: `.github/workflows/build-release.yml:28-end`

- [ ] **Step 1: 添加平台构建 job**

在 `.github/workflows/build-release.yml` 文件末尾添加：

```yaml

  build-platforms:
    needs: build-frontend
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
          cache-dependency-path: electron/package-lock.json

      - name: Download frontend artifact
        uses: actions/download-artifact@v4
        with:
          name: frontend-dist
          path: dist/

      - name: Install Electron dependencies
        working-directory: electron
        run: npm ci

      - name: Build Electron
        working-directory: electron
        run: npm run build

      - name: Build installer
        working-directory: electron
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm run dist

      - name: List release files (Windows)
        if: runner.os == 'Windows'
        run: dir electron\release\

      - name: List release files (Unix)
        if: runner.os != 'Windows'
        run: ls -la electron/release/

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: installer-${{ matrix.os }}
          path: |
            electron/release/*.exe
            electron/release/*.dmg
            electron/release/*.AppImage
            electron/release/*.deb
            electron/release/*.rpm
          retention-days: 7
```

- [ ] **Step 2: 验证 YAML 语法**

运行：
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-release.yml'))"
```

Expected: 无输出（表示 YAML 有效）

- [ ] **Step 3: 提交更改**

```bash
git add .github/workflows/build-release.yml
git commit -m "feat: add cross-platform workflow - platform build job with matrix"
```

---

## Task 7: 添加跨平台工作流 - Job 3 (创建 Release)

**Files:**
- Modify: `.github/workflows/build-release.yml:end`

- [ ] **Step 1: 添加 Release 创建 job**

在 `.github/workflows/build-release.yml` 文件末尾添加：

```yaml

  create-release:
    needs: build-platforms
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts/

      - name: Display artifact structure
        run: ls -R artifacts/

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.event.inputs.version_tag }}
          name: "Claude Code Web UI ${{ github.event.inputs.version_tag }}"
          body: |
            ## Claude Code Web UI

            跨平台桌面应用，支持 Windows、macOS、Linux。

            ### 前置要求
            请先安装 [Claude Code CLI](https://docs.anthropic.com/zh-CN/claude-code/getting-started/install)：

            ```bash
            npm install -g @anthropic/claude-code
            ```

            ### 安装步骤

            **Windows:**
            1. 下载 `.exe` 安装包
            2. 双击运行，按提示安装
            3. 启动后自动打开浏览器界面

            **macOS:**
            1. 下载 `.dmg` 磁盘镜像
            2. 打开 DMG，拖拽应用到 Applications 文件夹
            3. 首次运行需要在"系统偏好设置 > 安全性与隐私"中允许

            **Linux:**
            - **AppImage（推荐）:** 下载后添加执行权限 `chmod +x *.AppImage`，直接运行
            - **deb（Debian/Ubuntu）:** `sudo dpkg -i *.deb`
            - **rpm（Fedora/CentOS）:** `sudo rpm -i *.rpm`

            ### 版本
            **${{ github.event.inputs.version_tag }}**

            ### 功能
            - 🔥 DAG 执行图可视化
            - 💻 终端 + 工具卡片合并视图
            - 📝 流式总结逐字补完动画
            - 🌙 暗黑/明亮模式
            - ⚡ WebSocket 实时通信
            - 🌍 跨平台支持（Windows、macOS、Linux）

          files: |
            artifacts/installer-windows-latest/*.exe
            artifacts/installer-macos-latest/*.dmg
            artifacts/installer-ubuntu-latest/*.AppImage
            artifacts/installer-ubuntu-latest/*.deb
            artifacts/installer-ubuntu-latest/*.rpm
          draft: false
          prerelease: false
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: 验证 YAML 语法**

运行：
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-release.yml'))"
```

Expected: 无输出（表示 YAML 有效）

- [ ] **Step 3: 提交更改**

```bash
git add .github/workflows/build-release.yml
git commit -m "feat: add cross-platform workflow - release creation job"
```

---

## Task 8: 推送并验证自动构建

**Files:**
- None (testing only)

- [ ] **Step 1: 推送所有更改到 GitHub**

运行：
```bash
git push origin main
```

Expected: 推送成功，触发 GitHub Actions 工作流

- [ ] **Step 2: 检查 GitHub Actions 状态**

访问：`https://github.com/ogj130/claude-code-dag-web-ui/actions`

Expected: 看到新的 "Build Cross-Platform Release" 工作流正在运行

- [ ] **Step 3: 等待构建完成（约 8-12 分钟）**

监控工作流进度，确保：
- `build-frontend` job 成功
- `build-platforms` job 的 3 个平台都成功
- `create-release` job 被跳过（因为是 push 触发，不是手动触发）

Expected: 所有构建 job 成功完成

- [ ] **Step 4: 验证构建产物**

在 Actions 页面点击工作流运行，查看 Artifacts 部分

Expected: 看到 4 个 artifacts:
- `frontend-dist`
- `installer-windows-latest`
- `installer-macos-latest`
- `installer-ubuntu-latest`

---

## Task 9: 手动触发测试版本发布

**Files:**
- None (testing only)

- [ ] **Step 1: 手动触发工作流**

1. 访问：`https://github.com/ogj130/claude-code-dag-web-ui/actions/workflows/build-release.yml`
2. 点击右上角 "Run workflow" 按钮
3. 输入版本号：`v1.2.0-beta.1`
4. 点击绿色 "Run workflow" 按钮

Expected: 工作流开始运行

- [ ] **Step 2: 等待构建和发布完成**

监控工作流进度，确保：
- `build-frontend` job 成功
- `build-platforms` job 的 3 个平台都成功
- `create-release` job 成功创建 Release

Expected: 所有 job 成功完成

- [ ] **Step 3: 验证 GitHub Release**

访问：`https://github.com/ogj130/claude-code-dag-web-ui/releases`

Expected: 看到新的 `v1.2.0-beta.1` Release，包含：
- Windows `.exe` 安装包
- macOS `.dmg` 磁盘镜像
- Linux `.AppImage` 文件
- Linux `.deb` 包
- Linux `.rpm` 包

- [ ] **Step 4: 下载并测试安装包（可选）**

根据你的平台下载对应的安装包并测试安装和运行

Expected: 应用能正常安装和启动

---

## Task 10: 更新 README 添加跨平台安装说明

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 读取当前 README**

运行：
```bash
head -20 README.md
```

Expected: 看到当前的 README 内容

- [ ] **Step 2: 在 README 中添加安装说明部分**

在 README.md 的适当位置（通常在项目描述之后）添加：

```markdown
## 安装

### Windows

1. 从 [Releases](https://github.com/ogj130/claude-code-dag-web-ui/releases) 下载最新的 `.exe` 安装包
2. 双击运行安装程序
3. 按照安装向导完成安装
4. 启动应用后会自动打开浏览器界面

### macOS

1. 从 [Releases](https://github.com/ogj130/claude-code-dag-web-ui/releases) 下载最新的 `.dmg` 磁盘镜像
2. 打开 DMG 文件
3. 将应用拖拽到 Applications 文件夹
4. 首次运行时，需要在"系统偏好设置 > 安全性与隐私"中允许运行

**注意：** 应用未经 Apple 签名，首次运行需要手动允许。

### Linux

#### AppImage（推荐）

1. 从 [Releases](https://github.com/ogj130/claude-code-dag-web-ui/releases) 下载最新的 `.AppImage` 文件
2. 添加执行权限：
   ```bash
   chmod +x Claude-Code-Web-UI-*.AppImage
   ```
3. 直接运行：
   ```bash
   ./Claude-Code-Web-UI-*.AppImage
   ```

#### Debian/Ubuntu (deb)

```bash
sudo dpkg -i claude-code-web-ui_*.deb
```

#### Fedora/CentOS (rpm)

```bash
sudo rpm -i claude-code-web-ui-*.rpm
```

### 前置要求

所有平台都需要先安装 [Claude Code CLI](https://docs.anthropic.com/zh-CN/claude-code/getting-started/install)：

```bash
npm install -g @anthropic/claude-code
```
```

- [ ] **Step 3: 提交更改**

```bash
git add README.md
git commit -m "docs: add cross-platform installation instructions to README"
```

- [ ] **Step 4: 推送更改**

```bash
git push origin main
```

Expected: 推送成功

---

## Task 11: 清理和最终验证

**Files:**
- None (cleanup and verification)

- [ ] **Step 1: 验证所有平台配置正确**

运行：
```bash
cd electron
node -e "const pkg = require('./package.json'); console.log('Windows:', !!pkg.build.win); console.log('macOS:', !!pkg.build.mac); console.log('Linux:', !!pkg.build.linux);"
```

Expected: 输出
```
Windows: true
macOS: true
Linux: true
```

- [ ] **Step 2: 验证工作流文件存在**

运行：
```bash
ls -la .github/workflows/
```

Expected: 看到
- `build-release.yml`（新的跨平台工作流）
- `release-windows-backup.yml`（备份的 Windows 工作流）

- [ ] **Step 3: 检查最新的 GitHub Actions 运行**

访问：`https://github.com/ogj130/claude-code-dag-web-ui/actions`

Expected: 最新的工作流运行成功，所有平台都构建成功

- [ ] **Step 4: 检查 Releases 页面**

访问：`https://github.com/ogj130/claude-code-dag-web-ui/releases`

Expected: 看到测试版本 Release，包含所有平台的安装包

- [ ] **Step 5: 创建最终提交（如果有遗漏的更改）**

运行：
```bash
git status
```

如果有未提交的更改：
```bash
git add .
git commit -m "chore: final cleanup for cross-platform support"
git push origin main
```

Expected: 所有更改已提交并推送

---

## 成功标准验证

完成所有任务后，验证以下成功标准：

- [ ] ✅ `electron/package.json` 包含 Windows、macOS、Linux 配置
- [ ] ✅ GitHub Actions 工作流使用矩阵策略构建 3 个平台
- [ ] ✅ 自动 push 触发构建但不创建 Release
- [ ] ✅ 手动触发创建包含所有平台安装包的 Release
- [ ] ✅ Windows `.exe` 安装包生成成功
- [ ] ✅ macOS `.dmg` 磁盘镜像生成成功
- [ ] ✅ Linux `.AppImage`、`.deb`、`.rpm` 包生成成功
- [ ] ✅ README 包含所有平台的安装说明
- [ ] ✅ Release 说明清晰描述各平台安装方式

---

## 故障排查

### 问题 1: macOS 构建失败 - 图标转换错误

**症状：** electron-builder 报错找不到 `.icns` 文件

**解决方案：**
1. 确认 `electron/build/icon.png` 存在且为 512x512
2. 修改 `electron/package.json` 中 macOS 配置，使用 PNG 而非 ICNS：
   ```json
   "icon": "build/icon.png"
   ```
3. electron-builder 会自动从 PNG 生成 ICNS

### 问题 2: Linux 构建失败 - 依赖问题

**症状：** electron-builder 报错缺少系统依赖

**解决方案：**
1. 在 GitHub Actions 的 Linux job 中添加依赖安装步骤：
   ```yaml
   - name: Install Linux dependencies
     if: runner.os == 'Linux'
     run: sudo apt-get update && sudo apt-get install -y libarchive-tools
   ```

### 问题 3: Release 创建失败 - 找不到文件

**症状：** `softprops/action-gh-release` 报错找不到安装包文件

**解决方案：**
1. 检查 artifact 下载路径是否正确
2. 在 `create-release` job 中添加调试步骤：
   ```yaml
   - name: List all files
     run: find artifacts/ -type f
   ```
3. 根据实际路径调整 `files:` 配置

### 问题 4: 矩阵构建某个平台失败

**症状：** 某个平台构建失败，但其他平台成功

**解决方案：**
1. 查看失败平台的详细日志
2. 如果是临时网络问题，重新触发工作流
3. 如果是平台特定问题，在该平台的步骤中添加条件判断或特殊处理

---

## 后续优化建议

完成基本跨平台支持后，可以考虑以下优化：

1. **代码签名**
   - macOS: 申请 Apple 开发者账号，添加代码签名
   - Windows: 获取代码签名证书

2. **自动更新**
   - 集成 electron-updater
   - 配置自动更新服务器

3. **性能优化**
   - 使用 GitHub Actions 缓存加速构建
   - 优化 artifact 大小

4. **测试自动化**
   - 添加 E2E 测试
   - 在各平台上自动化测试安装包
