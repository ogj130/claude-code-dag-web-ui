import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export type ProxyStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface ProxyConfig {
  apiKey: string;
  port?: number;
}

export class ProxyManager {
  private process: ChildProcess | null = null;
  private _status: ProxyStatus = 'stopped';
  private port: number = 8082;
  private restartAttempts = 0;
  private maxRestartAttempts = 3;
  private currentConfig: ProxyConfig | null = null;

  get status(): ProxyStatus {
    return this._status;
  }

  get proxyUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  async start(config: ProxyConfig): Promise<void> {
    if (this._status === 'running') {
      return;
    }

    this._status = 'starting';
    this.port = config.port || 8082;
    this.currentConfig = config;

    return new Promise((resolve, reject) => {
      const proxyDir = path.dirname(__filename);
      const serverPy = path.join(proxyDir, 'server.py');

      if (!fs.existsSync(serverPy)) {
        console.error('[ProxyManager] server.py not found:', serverPy);
        this._status = 'error';
        reject(new Error('server.py not found'));
        return;
      }

      const env = {
        ...process.env,
        OPENAI_API_KEY: config.apiKey,
        PREFERRED_PROVIDER: 'openai',
      };

      console.log('[ProxyManager] Starting proxy at', this.proxyUrl);

      this.process = spawn('uv', [
        'run',
        'uvicorn',
        'server:app',
        '--host', '127.0.0.1',
        '--port', String(this.port),
      ], {
        cwd: proxyDir,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let startupTimeout: NodeJS.Timeout | null = null;

      const checkStartup = (data: Buffer) => {
        const output = data.toString();
        if (output.includes('Application startup complete') || output.includes('Uvicorn running')) {
          this._status = 'running';
          this.restartAttempts = 0;
          console.log('[ProxyManager] Proxy started successfully');
          if (startupTimeout) clearTimeout(startupTimeout);
          resolve();
        }
      };

      this.process.stdout?.on('data', checkStartup);
      this.process.stderr?.on('data', (data: Buffer) => {
        console.log('[ProxyManager] proxy stderr:', data.toString());
      });

      this.process.on('close', (code) => {
        console.log('[ProxyManager] Proxy process closed with code:', code);
        this._status = 'stopped';
        if (this.currentConfig && this._status !== 'stopped') {
          this.handleRestart();
        }
      });

      this.process.on('error', (err) => {
        console.error('[ProxyManager] Proxy error:', err);
        this._status = 'error';
        reject(err);
      });

      // 超时处理：10秒后假设启动成功
      startupTimeout = setTimeout(() => {
        if (this._status === 'starting') {
          this._status = 'running';
          console.log('[ProxyManager] Proxy startup timeout, assuming success');
          resolve();
        }
      }, 10000);
    });
  }

  private async handleRestart(): Promise<void> {
    if (this.restartAttempts < this.maxRestartAttempts && this.currentConfig) {
      this.restartAttempts++;
      console.log(`[ProxyManager] Restarting proxy (attempt ${this.restartAttempts})`);
      await new Promise(r => setTimeout(r, 2000));
      await this.start(this.currentConfig);
    } else {
      console.error('[ProxyManager] Proxy restart attempts exhausted');
      this._status = 'error';
    }
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this._status = 'stopped';
    this.currentConfig = null;
    console.log('[ProxyManager] Proxy stopped');
  }

  async restart(config: ProxyConfig): Promise<void> {
    await this.stop();
    await this.start(config);
  }
}

// 导出单例
export const proxyManager = new ProxyManager();
