# 跨平台支持设计文档

**日期：** 2026-04-10
**作者：** 哈雷酱
**状态：** 待审核

## 概述

为 Claude Code Web UI 添加 macOS 和 Linux 平台支持，使用 GitHub Actions 矩阵构建策略，在三个平台上并行构建原生安装包。

## 目标

- 支持 Windows、macOS、Linux 三大平台
- 提供原生安装包格式：
  - Windows: NSIS 安装包（.exe）
  - macOS: DMG 磁盘镜像（.dmg）
  - Linux: AppImage（.AppImage）、deb（.deb）、rpm（.rpm）
- 自动化构建和发布流程
- 保持现有 Windows 构建不受影响

## 架构设计

### 整体构建流程

```
┌─────────────────────────────────────────────────────────┐
│                   GitHub Actions Workflow                │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Job 1: build-frontend (ubuntu-latest)                   │
│  ├─ 安装前端依赖                                          │
│  ├─ 构建前端 (npm run build)                             │
│  └─ 上传 dist/ 为 artifact                               │
│                                                           │
│  Job 2: build-platforms (matrix)                         │
│  ├─ Windows (windows-latest)                             │
│  │  ├─ 下载前端 artifact                                 │
│  │  ├─ 构建 Electron                                     │
│  │  └─ 打包 NSIS 安装包                                   │
│  │                                                        │
│  ├─ macOS (macos-latest)                                 │
│  │  ├─ 下载前端 artifact                                 │
│  │  ├─ 构建 Electron                                     │
│  │  └─ 打包 DMG 磁盘镜像                                  │
│  │                                                        │
│  └─ Linux (ubuntu-latest)                                │
│     ├─ 下载前端 artifact                                  │
│     ├─ 构建 Electron                                      │
│     └─ 打包 AppImage + deb + rpm                         │
│                                                           │
│  Job 3: create-release (ubuntu-latest)                   │
│  ├─ 条件：仅手动触发时执行                                │
│  ├─ 下载所有平台的安装包 artifact                         │
│  ├─ 创建 GitHub Release                                  │
│  └─ 上传所有安装包到 Release                             │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 优化策略

1. **前端构建复用**
   - 前端只构建一次，避免在 3 个平台重复构建
   - 使用 GitHub Actions artifact 在 job 之间传递文件

2. **并行构建**
   - 3 个平台同时构建，节省总时间
   - 预计总时间：8-12 分钟（取决于最慢的平台）

3. **条件发布**
   - push 触发：只构建，不发布（验证构建）
   - 手动触发：构建 + 发布 Release

## 平台配置

### electron/package.json 配置

#### macOS 配置

```json
"mac": {
  "target": [
    {
      "target": "dmg",
      "arch": ["x64", "arm64"]
    }
  ],
  "icon": "build/icon.icns",
  "category": "public.app-category.developer-tools"
}
```

**说明：**
- 目标格式：DMG（标准 macOS 安装方式）
- 架构：x64（Intel）+ arm64（Apple Silicon）
- 图标：需要 .icns 格式（从 PNG 转换）
- 分类：开发者工具

#### Linux 配置

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
}
```

**说明：**
- 目标格式：
  - AppImage：通用格式，无需安装，直接运行
  - deb：Debian/Ubuntu 包管理格式
  - rpm：Fedora/CentOS 包管理格式
- 架构：x64（主流 Linux 桌面）
- 图标：使用现有 512x512 PNG
- 分类：工具类应用

#### Windows 配置

保持现有配置不变：
- 目标格式：NSIS 安装包
- 架构：x64
- 图标：icon.png

### 图标处理

#### 需要的图标格式

| 平台    | 格式   | 来源                          |
|---------|--------|-------------------------------|
| Windows | .png   | 现有 icon.png（512x512）      |
| macOS   | .icns  | 从 icon.png 转换              |
| Linux   | .png   | 现有 icon.png（512x512）      |

#### macOS 图标生成

**方案 1：使用 png2icons（推荐）**
```bash
npm install --save-dev png2icons
npx png2icons build/icon.png build/
```

**方案 2：使用 electron-builder 自动转换**
- electron-builder 可以自动从 PNG 生成 .icns
- 配置中指定 PNG 路径，构建时自动转换

**选择：** 使用方案 2（electron-builder 自动转换），简化流程

## GitHub Actions 工作流

### 文件结构

```
.github/workflows/
├── release.yml          # 主构建工作流（重命名为 build-release.yml）
└── build-release.yml    # 新的跨平台构建工作流
```

### 工作流配置

#### 触发条件

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      version_tag:
        description: 'Git tag for this release (e.g., v1.2.0)'
        required: true
        default: 'v1.2.0'
```

#### Job 1: build-frontend

```yaml
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

    - name: Install dependencies
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

#### Job 2: build-platforms

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

#### Job 3: create-release

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

## 错误处理

### 构建失败处理

1. **单平台失败**
   - 默认行为：某个平台失败，整个工作流失败
   - 不创建 Release，避免发布不完整版本
   - 开发者查看日志，修复问题后重新触发

2. **依赖问题**
   - 使用 `npm ci` 确保依赖版本一致
   - 锁定 Node.js 版本为 24
   - 使用 `cache: 'npm'` 加速依赖安装

3. **权限问题**
   - 已配置 `permissions: contents: write`
   - 确保 GITHUB_TOKEN 有创建 Release 权限

### 常见问题

**macOS 代码签名：**
- 当前跳过代码签名（需要 Apple 开发者账号）
- 用户首次运行需要在"安全性与隐私"中允许
- 未来可添加签名支持

**Linux 依赖：**
- AppImage 包含所有依赖，无需额外安装
- deb/rpm 可能需要系统依赖（electron-builder 自动处理）

## 测试策略

### 本地测试

**macOS 测试：**
```bash
# 在 macOS 上
npm ci
npm run build
cd electron
npm ci
npm run build
npm run dist

# 验证生成的 DMG
open release/*.dmg
```

**Linux 测试：**
```bash
# 在 Linux 上
npm ci
npm run build
cd electron
npm ci
npm run build
npm run dist

# 验证 AppImage
chmod +x release/*.AppImage
./release/*.AppImage
```

**Windows 测试：**
- 保持现有测试流程不变

### CI 测试

1. **自动构建验证**
   - 每次 push 到 main 自动构建所有平台
   - 验证构建产物存在
   - 不创建 Release

2. **手动发布测试**
   - 手动触发 workflow
   - 输入测试版本号（如 `v1.2.0-beta.1`）
   - 验证 Release 创建成功
   - 下载各平台安装包测试

## 实施计划

### 阶段 1：配置更新
1. 更新 `electron/package.json` 添加 macOS 和 Linux 配置
2. 更新 `package.json` 描述为跨平台

### 阶段 2：工作流重构
1. 重命名现有 `release.yml` 为 `release-windows.yml`（备份）
2. 创建新的 `build-release.yml` 跨平台工作流
3. 配置矩阵构建和 artifact 传递

### 阶段 3：测试验证
1. Push 触发自动构建，验证所有平台构建成功
2. 手动触发测试版本发布
3. 在各平台下载安装包测试

### 阶段 4：文档更新
1. 更新 README.md 添加跨平台安装说明
2. 更新 Release 说明模板

## 风险和限制

### 风险

1. **macOS 签名问题**
   - 风险：未签名应用首次运行需要用户手动允许
   - 缓解：在 Release 说明中提供详细指引

2. **Linux 发行版兼容性**
   - 风险：不同发行版可能有依赖问题
   - 缓解：提供 AppImage 作为通用方案

3. **CI 时间增加**
   - 风险：3 个平台并行构建消耗更多 CI 时间
   - 缓解：前端构建复用，并行执行

### 限制

1. **架构支持**
   - macOS: x64 + arm64
   - Linux: 仅 x64（arm64 需求较少）
   - Windows: 仅 x64

2. **代码签名**
   - 当前不支持代码签名
   - 需要 Apple 开发者账号（$99/年）
   - 需要 Windows 代码签名证书

## 成功标准

1. ✅ 所有平台构建成功
2. ✅ 生成正确格式的安装包
3. ✅ 安装包可以在对应平台正常安装和运行
4. ✅ Release 包含所有平台的安装包
5. ✅ 文档清晰说明各平台安装方式

## 参考资料

- [electron-builder 文档](https://www.electron.build/)
- [GitHub Actions 矩阵构建](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs)
- [Electron 跨平台打包指南](https://www.electronjs.org/docs/latest/tutorial/application-distribution)
