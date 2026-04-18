import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockContextBridge = { exposeInMainWorld: vi.fn() };
const mockIpcRenderer = {
  invoke: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  removeListener: vi.fn(),
};
const mockShell = { openExternal: vi.fn() };

vi.mock('electron', () => ({
  contextBridge: mockContextBridge,
  ipcRenderer: mockIpcRenderer,
  shell: mockShell,
  process: {
    platform: 'darwin',
    env: { npm_package_version: '1.0.0' },
  },
}));

vi.mock('child_process', () => ({
  execSync: vi.fn().mockReturnValue('/usr/local/bin/claude'),
}));

// Import the actual preload module to test it
import '../preload';

describe('electron/preload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContextBridge.exposeInMainWorld.mockClear();
  });

  it('should call contextBridge.exposeInMainWorld', () => {
    expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalled();
  });

  it('should expose api with getVersion', () => {
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const electronApi = calls[calls.length - 1]?.[1];
    expect(electronApi).toBeDefined();
    expect(typeof electronApi.getVersion).toBe('function');
    expect(electronApi.getVersion()).toBe('1.0.0');
  });

  it('should expose vectorApi with indexQueryChunk', () => {
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const electronApi = calls[calls.length - 1]?.[1];
    expect(electronApi.vectorApi).toBeDefined();
    expect(typeof electronApi.vectorApi.indexQueryChunk).toBe('function');
  });

  it('should expose vectorApi with search', () => {
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const electronApi = calls[calls.length - 1]?.[1];
    expect(typeof electronApi.vectorApi.search).toBe('function');
  });

  it('should expose vectorApi with listTables', () => {
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const electronApi = calls[calls.length - 1]?.[1];
    expect(typeof electronApi.vectorApi.listTables).toBe('function');
  });

  it('should expose vectorApi with getTableStats', () => {
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const electronApi = calls[calls.length - 1]?.[1];
    expect(typeof electronApi.vectorApi.getTableStats).toBe('function');
  });

  it('should expose vectorApi with rebuildIndex and closeDb', () => {
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const electronApi = calls[calls.length - 1]?.[1];
    expect(typeof electronApi.vectorApi.rebuildIndex).toBe('function');
    expect(typeof electronApi.vectorApi.closeDb).toBe('function');
  });

  it('should expose embeddingApi', () => {
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const electronApi = calls[calls.length - 1]?.[1];
    expect(electronApi.embeddingApi).toBeDefined();
    expect(typeof electronApi.embeddingApi.call).toBe('function');
  });

  it('should expose captureWindow function', () => {
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const electronApi = calls[calls.length - 1]?.[1];
    expect(typeof electronApi.captureWindow).toBe('function');
  });

  it('should expose updateApi', () => {
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const electronApi = calls[calls.length - 1]?.[1];
    expect(electronApi.updateApi).toBeDefined();
    expect(typeof electronApi.updateApi.check).toBe('function');
    expect(typeof electronApi.updateApi.startDownload).toBe('function');
    expect(typeof electronApi.updateApi.install).toBe('function');
    expect(typeof electronApi.updateApi.onInit).toBe('function');
    expect(typeof electronApi.updateApi.onAvailable).toBe('function');
    expect(typeof electronApi.updateApi.onProgress).toBe('function');
    expect(typeof electronApi.updateApi.onDownloaded).toBe('function');
    expect(typeof electronApi.updateApi.onError).toBe('function');
  });

  it('should expose invoke for valid channels', async () => {
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const electronApi = calls[calls.length - 1]?.[1];

    await electronApi.invoke('model-config:get-all');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('model-config:get-all');
  });

  it('should throw for invalid channels', () => {
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const electronApi = calls[calls.length - 1]?.[1];
    expect(() => electronApi.invoke('invalid:channel')).toThrow('Invalid channel');
  });

  it('should have getClaudePath function', () => {
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const electronApi = calls[calls.length - 1]?.[1];
    expect(typeof electronApi.getClaudePath).toBe('function');
    expect(electronApi.getClaudePath()).toBeTruthy();
  });

  it('should call shell.openExternal via openExternal', () => {
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const electronApi = calls[calls.length - 1]?.[1];
    electronApi.openExternal('https://example.com');
    expect(mockShell.openExternal).toHaveBeenCalledWith('https://example.com');
  });
});
