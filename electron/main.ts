import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, batchQueries, samplingQueries, reportQueries, getDb } from './database';
import { validateBatch, validateSampling, validateReport } from './validators';

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
  ipcMain.handle('batch:create', (_e, data) => {
    const validation = validateBatch(data);
    if (!validation.valid) {
      throw new Error(validation.errors.join('；'));
    }
    return batchQueries.create(data);
  });
  ipcMain.handle('batch:delete', (_e, id: number) => batchQueries.delete(id));
  ipcMain.handle('batch:getDetail', async (_e, batchId: number) => {
    const batch = batchQueries.getById(batchId);
    if (!batch) return null;
    const samplings = samplingQueries.getByBatchId(batchId);
    const reports = reportQueries.getByBatchId(batchId);
    for (const s of samplings) {
      if (s.sealing_photo) {
        s.sealing_photo_data = null;
        try {
          if (fs.existsSync(s.sealing_photo)) {
            const imgData = fs.readFileSync(s.sealing_photo);
            const ext = path.extname(s.sealing_photo).slice(1) || 'png';
            s.sealing_photo_data = `data:image/${ext};base64,${imgData.toString('base64')}`;
          }
        } catch (e) {}
      }
    }
    return { batch, samplings, reports };
  });
  ipcMain.handle('batch:getMonthlySummary', (_e, yearMonth?: string) => {
    let dateFilter = '';
    let params: any[] = [];
    if (yearMonth) {
      dateFilter = 'WHERE substr(entry_date, 1, 7) = ?';
      params = [yearMonth];
    }
    const sql = `
      SELECT
        substr(entry_date, 1, 7) as month,
        material_type,
        COUNT(*) as total_count,
        SUM(CASE WHEN status IN ('已取样待送检','已送检待报告','可用','待处置','禁止使用') THEN 1 ELSE 0 END) as sampled_count,
        SUM(CASE WHEN status IN ('已送检待报告','可用','待处置','禁止使用') THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status IN ('可用','待处置','禁止使用') THEN 1 ELSE 0 END) as reported_count,
        SUM(CASE WHEN status IN ('待处置','禁止使用') THEN 1 ELSE 0 END) as abnormal_count
      FROM material_batches
      ${dateFilter}
      GROUP BY month, material_type
      ORDER BY month DESC, material_type
    `;
    const db = getDb();
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as any);
    }
    stmt.free();
    return rows;
  });

  ipcMain.handle('sampling:getAll', (_e, keyword?: string) => {
    let all = samplingQueries.getAll();
    if (keyword && keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      all = all.filter((s: any) =>
        (s.batch_no && s.batch_no.toLowerCase().includes(kw)) ||
        (s.sample_no && s.sample_no.toLowerCase().includes(kw)) ||
        (s.testing_agency && s.testing_agency.toLowerCase().includes(kw)) ||
        (s.witness_supervisor && s.witness_supervisor.toLowerCase().includes(kw)) ||
        (s.sampling_location && s.sampling_location.toLowerCase().includes(kw))
      );
    }
    return all;
  });
  ipcMain.handle('sampling:getByBatchId', (_e, batchId: number) => samplingQueries.getByBatchId(batchId));
  ipcMain.handle('sampling:getPendingSend', () => samplingQueries.getPendingSend());
  ipcMain.handle('sampling:getOverdue', () => samplingQueries.getOverdue());
  ipcMain.handle('sampling:create', (_e, data) => {
    const validation = validateSampling(data);
    if (!validation.valid) {
      throw new Error(validation.errors.join('；'));
    }
    const id = samplingQueries.create(data);
    batchQueries.updateStatus(data.batch_id, '已取样待送检');
    return id;
  });
  ipcMain.handle('sampling:markAsSent', (_e, id: number, sentDate: string) => {
    if (!sentDate || !/^\d{4}-\d{2}-\d{2}$/.test(sentDate)) {
      throw new Error('送检日期格式无效，应为 YYYY-MM-DD');
    }
    const sampling = samplingQueries.getById(id);
    samplingQueries.markAsSent(id, sentDate);
    if (sampling) {
      batchQueries.updateStatus(sampling.batch_id, '已送检待报告');
    }
  });

  ipcMain.handle('report:getAll', (_e, keyword?: string) => {
    let all = reportQueries.getAll();
    if (keyword && keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      all = all.filter((r: any) =>
        (r.report_no && r.report_no.toLowerCase().includes(kw)) ||
        (r.batch_no && r.batch_no.toLowerCase().includes(kw)) ||
        (r.sample_no && r.sample_no.toLowerCase().includes(kw)) ||
        (r.conclusion && r.conclusion.toLowerCase().includes(kw)) ||
        (r.unqualified_items && r.unqualified_items.toLowerCase().includes(kw))
      );
    }
    return all;
  });
  ipcMain.handle('report:getByBatchId', (_e, batchId: number) => reportQueries.getByBatchId(batchId));
  ipcMain.handle('report:create', (_e, data) => {
    const validation = validateReport(data);
    if (!validation.valid) {
      throw new Error(validation.errors.join('；'));
    }
    const id = reportQueries.create(data);
    const batchStatus = data.conclusion === '合格' ? '可用' : (data.unqualified_items ? '禁止使用' : '待处置');
    batchQueries.updateStatus(data.batch_id, batchStatus);
    return id;
  });

  ipcMain.handle('export:samplingsCsv', async (_e, keyword?: string) => {
    const all = samplingQueries.getAll();
    const filtered = keyword && keyword.trim()
      ? all.filter((s: any) => {
          const kw = keyword.trim().toLowerCase();
          return (s.batch_no && s.batch_no.toLowerCase().includes(kw)) ||
            (s.sample_no && s.sample_no.toLowerCase().includes(kw)) ||
            (s.testing_agency && s.testing_agency.toLowerCase().includes(kw));
        })
      : all;
    const headers = ['样品编号', '材料类型', '批次编号', '取样部位', '见证监理', '检测机构', '取样日期', '送检时限', '状态', '送检日期'];
    const rows = filtered.map((s: any) => [
      s.sample_no, s.material_type, s.batch_no, s.sampling_location,
      s.witness_supervisor, s.testing_agency, s.sampling_date, s.deadline_date,
      s.is_sent === 1 ? '已送检' : '已取样待送检', s.sent_date || ''
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')).join('\r\n');
    return '\ufeff' + csv;
  });

  ipcMain.handle('export:reportsCsv', async (_e, keyword?: string) => {
    const all = reportQueries.getAll();
    const filtered = keyword && keyword.trim()
      ? all.filter((r: any) => {
          const kw = keyword.trim().toLowerCase();
          return (r.report_no && r.report_no.toLowerCase().includes(kw)) ||
            (r.batch_no && r.batch_no.toLowerCase().includes(kw)) ||
            (r.sample_no && r.sample_no.toLowerCase().includes(kw));
        })
      : all;
    const headers = ['报告编号', '材料类型', '批次编号', '样品编号', '报告日期', '检测结论', '不合格项', '批次状态'];
    const rows = filtered.map((r: any) => {
      const status = r.conclusion === '合格' ? '可用' : (r.unqualified_items ? '禁止使用' : '待处置');
      return [r.report_no, r.material_type, r.batch_no, r.sample_no, r.report_date, r.conclusion, r.unqualified_items || '', status];
    });
    const csv = [headers, ...rows].map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')).join('\r\n');
    return '\ufeff' + csv;
  });

  ipcMain.handle('dialog:saveCsv', async (_e, defaultName: string, content: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf8');
      return result.filePath;
    }
    return null;
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
