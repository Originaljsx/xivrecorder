export const app = {
  getVersion: jest.fn().mockReturnValue('0.1.0'),
  getPath: jest.fn().mockReturnValue('/tmp'),
  getName: jest.fn().mockReturnValue('XIVRecorder'),
  on: jest.fn(),
  once: jest.fn(),
  quit: jest.fn(),
  isPackaged: false,
  whenReady: jest.fn().mockResolvedValue(undefined),
};

export const BrowserWindow = jest.fn().mockImplementation(() => ({
  loadURL: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  close: jest.fn(),
  webContents: {
    send: jest.fn(),
    on: jest.fn(),
    openDevTools: jest.fn(),
  },
}));

export const ipcMain = {
  on: jest.fn(),
  handle: jest.fn(),
  removeHandler: jest.fn(),
};

export const dialog = {
  showOpenDialog: jest.fn(),
  showMessageBox: jest.fn(),
};

export const shell = {
  openExternal: jest.fn(),
  openPath: jest.fn(),
};

export const Tray = jest.fn().mockImplementation(() => ({
  setToolTip: jest.fn(),
  setContextMenu: jest.fn(),
  on: jest.fn(),
  setImage: jest.fn(),
}));

export const Menu = {
  buildFromTemplate: jest.fn().mockReturnValue({}),
  setApplicationMenu: jest.fn(),
};

export const clipboard = {
  writeText: jest.fn(),
  readText: jest.fn().mockReturnValue(''),
};

export const protocol = {
  registerFileProtocol: jest.fn(),
  handle: jest.fn(),
};

export const screen = {
  getAllDisplays: jest.fn().mockReturnValue([]),
  getPrimaryDisplay: jest.fn().mockReturnValue({
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    scaleFactor: 1,
    id: 1,
  }),
};

export const nativeImage = {
  createFromPath: jest.fn().mockReturnValue({}),
};

export default {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Tray,
  Menu,
  clipboard,
  protocol,
  screen,
  nativeImage,
};
