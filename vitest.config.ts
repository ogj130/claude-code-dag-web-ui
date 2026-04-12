import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import 'fake-indexeddb/auto';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['fake-indexeddb/auto'],
    // 自动激活 fake timers，让 vi.advanceTimersByTime() 能控制 jsdom Window 的定时器
    fakeTimers: {
      enabled: true,
    },
  },
});
