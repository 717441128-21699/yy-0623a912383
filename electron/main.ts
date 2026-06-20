import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, batchQueries, samplingQueries, reportQueries } from './database';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: '材料进场复检送样管理系统',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await initDatabase();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function registerIpcHandlers() {
  ipcMain.handle('batch:getAll', () => batchQueries.getAll());
  ipcMain.handle('batch:getByStatus', (_e, status: string) => batchQueries.getByStatus(status));
  ipcMain.handle('batch:create', (_e, data) => batchQueries.create(data));
  ipcMain.handle('batch:delete', (_e, id: number) => batchQueries.delete(id));

  ipcMain.handle('sampling:getAll', () => samplingQueries.getAll());
  ipcMain.handle('sampling:getByBatchId', (_e, batchId: number) => samplingQueries.getByBatchId(batchId));
  ipcMain.handle('sampling:getPendingSend', () => samplingQueries.getPendingSend());
  ipcMain.handle('sampling:getOverdue', () => samplingQueries.getOverdue());
  ipcMain.handle('sampling:create', (_e, data) => {
    const id = samplingQueries.create(data);
    batchQueries.updateStatus(data.batch_id, '已取样待送检');
    return id;
  });
  ipcMain.handle('sampling:markAsSent', (_e, id: number, sentDate: string) => {
    const sampling = samplingQueries.getById(id);
    samplingQueries.markAsSent(id, sentDate);
    if (sampling) {
      batchQueries.updateStatus(sampling.batch_id, '已送检待报告');
    }
  });

  ipcMain.handle('report:getAll', () => reportQueries.getAll());
  ipcMain.handle('report:getByBatchId', (_e, batchId: number) => reportQueries.getByBatchId(batchId));
  ipcMain.handle('report:create', (_e, data) => {
    const id = reportQueries.create(data);
    const batchStatus = data.conclusion === '合格' ? '可用' : (data.unqualified_items ? '禁止使用' : '待处置');
    batchQueries.updateStatus(data.batch_id, batchStatus);
    return id;
  });

  ipcMain.handle('photo:save', async (_e, dataUrl: string, fileName: string) => {
    const userDataPath = app.getPath('userData');
    const photosDir = path.join(userDataPath, 'photos');
    if (!fs.existsSync(photosDir)) {
      fs.mkdirSync(photosDir, { recursive: true });
    }
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const filePath = path.join(photosDir, fileName);
    fs.writeFileSync(filePath, base64Data, 'base64');
    return filePath;
  });

  ipcMain.handle('photo:read', async (_e, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath).slice(1) || 'png';
        return `data:image/${ext};base64,${data.toString('base64')}`;
      }
    } catch (e) {
      console.error('读取照片失败:', e);
    }
    return null;
  });

  ipcMain.handle('dialog:openPhoto', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] }],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const ext = path.extname(filePath).slice(1) || 'png';
      const data = fs.readFileSync(filePath);
      return `data:image/${ext};base64,${data.toString('base64')}`;
    }
    return null;
  });
}
