# Electron Package - Claude Code Web UI

## 前置要求

安装 [Claude Code CLI](https://docs.anthropic.com/zh-CN/claude-code/getting-started/install)：

```bash
npm install -g @anthropic/claude-code
```

## 本地开发

```bash
cd electron
npm install
npm run dist
```

构建完成后，安装包在 `release/` 目录。

## 构建产物

```
electron/release/
└── win-unpacked/
    └── Claude Code Web UI.exe   ← 便携版（无需安装）
```

## 自动发布

每次 push 到 `main` 分支，GitHub Actions 会自动：
1. 构建前端 (`npm run build`)
2. 打包 Windows 安装包
3. 发布到 GitHub Releases

版本号由 workflow 触发时的 `version_tag` 参数决定。

## Windows 用户安装步骤

1. 下载 `.exe` 安装包
2. 双击运行，一路下一步
3. 启动后自动打开浏览器界面

> 无需安装 Node.js，无需配置环境变量。
