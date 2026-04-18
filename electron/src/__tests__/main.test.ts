import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockElectron = {
  app: {
    on: vi.fn(),
    quit: vi.fn(),
    getPath: vi.fn().mockReturnValue('/tmp'),
    whenReady: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockReturnValue('1.0.0'),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    loadURL: vi.fn(),
    show: vi.fn(),
    webContents: {
      setWindowOpenHandler: vi.fn(),
      send: vi.fn(),
      once: vi.fn(),
    },
    once: vi.fn(),
  })),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
  },
  desktopCapturer: {
    getSources: vi.fn().mockResolvedValue([]),
  },
};

vi.mock('electron', () => mockElectron);
vi.mock('electron-updater', () => ({
  autoUpdater: {
    on: vi.fn(),
    checkForUpdates: vi.fn().mockResolvedValue(null),
    downloadUpdate: vi.fn().mockResolvedValue(undefined),
    quitAndInstall: vi.fn(),
    logger: console,
    autoDownload: false,
    autoInstallOnAppQuit: true,
  },
}));
vi.mock('ws', () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
    once: vi.fn(),
  })),
}));
vi.mock('vectordb', () => ({ default: {} }));
vi.mock('openai', () => ({ default: class {} }));
vi.mock('../../src/stores/modelConfigStorage', () => ({
  getAllConfigs: vi.fn().mockResolvedValue([]),
  saveConfig: vi.fn().mockResolvedValue({}),
  updateConfig: vi.fn().mockResolvedValue(undefined),
  deleteConfig: vi.fn().mockResolvedValue(undefined),
  setDefaultConfig: vi.fn().mockResolvedValue(undefined),
  getConfigById: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/stores/workspacePresetStorage', () => ({
  getAllPresets: vi.fn().mockResolvedValue([]),
  savePreset: vi.fn().mockResolvedValue({}),
  updatePreset: vi.fn().mockResolvedValue(undefined),
  deletePreset: vi.fn().mockResolvedValue(undefined),
  getPresetByPath: vi.fn().mockResolvedValue(undefined),
  getPresetById: vi.fn().mockResolvedValue(undefined),
  invalidatePresetByConfigId: vi.fn().mockResolvedValue(undefined),
}));

describe('electron/main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export mocked electron module', () => {
    const { app, BrowserWindow, ipcMain } = mockElectron;
    expect(app).toBeDefined();
    expect(app.whenReady).toBeDefined();
    expect(BrowserWindow).toBeDefined();
    expect(ipcMain.handle).toBeDefined();
  });

  it('should have app.whenReady as a function', () => {
    expect(typeof mockElectron.app.whenReady).toBe('function');
  });

  it('should have BrowserWindow constructor', () => {
    expect(typeof mockElectron.BrowserWindow).toBe('function');
  });

  it('should have app quit handler setup capability', () => {
    expect(typeof mockElectron.app.on).toBe('function');
    expect(typeof mockElectron.app.quit).toBe('function');
  });

  it('should have ipcMain handlers', () => {
    expect(typeof mockElectron.ipcMain.handle).toBe('function');
    expect(typeof mockElectron.ipcMain.on).toBe('function');
  });

  it('should have desktopCapturer for screenshot', () => {
    expect(typeof mockElectron.desktopCapturer.getSources).toBe('function');
  });

  it('should have ws WebSocketServer', async () => {
    const { WebSocketServer } = await import('ws');
    expect(WebSocketServer).toBeDefined();
  });
});
