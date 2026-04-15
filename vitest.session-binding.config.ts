import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'src/__tests__/workspaceStorage.test.ts',
      'src/__tests__/sessionWorkspaceBinding.test.ts',
      'src/__tests__/sessionService.test.ts',
      'src/__tests__/sessionPolicyResolver.test.ts',
      'src/__tests__/globalTerminalRuntime.test.ts',
      'src/__tests__/globalDispatchService.test.ts',
      'src/components/GlobalTerminal/__tests__/GlobalTerminal.test.tsx',
    ],
  },
});
