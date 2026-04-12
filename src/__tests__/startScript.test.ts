import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('start.sh', () => {
  it('dev 启动不应强制设置 NODE_ENV=production', () => {
    const scriptPath = path.resolve(process.cwd(), 'start.sh');
    const script = readFileSync(scriptPath, 'utf-8');

    expect(script).toContain('npm run dev');
    expect(script).not.toContain('NODE_ENV=production npm run dev');
  });
});
