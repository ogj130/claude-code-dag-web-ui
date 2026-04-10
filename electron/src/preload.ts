import { contextBridge } from 'electron';

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取 app 版本
  getVersion: () => process.env.npm_package_version ?? '1.1.0',

  // 获取 Claude Code 可执行文件路径
  getClaudePath: () => {
    const { execSync } = require('child_process');
    // 跨平台：Windows 用 where，其他平台用 which
    const command = process.platform === 'win32' ? 'where claude' : 'which claude';
    try {
      const result = execSync(command, { encoding: 'utf-8', shell: true });
      return result.trim().split('\n')[0];
    } catch {
      return null;
    }
  },

  // 打开外部链接
  openExternal: (url: string) => {
    const { shell } = require('electron');
    shell.openExternal(url);
  },
});
