import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, batchQueries, samplingQueries, reportQueries, getDb, logQueries, disposalQueries } from './database';
import { validateBatch, validateSampling, validateReport } from './validators';

function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as any);
  stmt.free();
  return rows;
}

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
    const id = batchQueries.create(data);
    logQueries.create({ batch_id: id, action: '新增进场登记', description: `${data.material_type} ${data.batch_no} 进场 ${data.quantity}` });
    return id;
  });
  ipcMain.handle('batch:delete', (_e, id: number) => batchQueries.delete(id));
  ipcMain.handle('batch:getDetail', async (_e, batchId: number) => {
    const batch = batchQueries.getById(batchId);
    if (!batch) return null;
    const samplings = samplingQueries.getByBatchId(batchId);
    const reports = reportQueries.getByBatchId(batchId);
    const logs = logQueries.getByBatchId(batchId);
    const disposals = disposalQueries.getByBatchId(batchId);
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
    return { batch, samplings, reports, logs, disposals };
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
  ipcMain.handle('sampling:getOverdue', () => samplingQueries.getOverdue());
  ipcMain.handle('sampling:getPendingSend', (_e, keyword?: string) => {
    let all = samplingQueries.getPendingSend();
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

  ipcMain.handle('sampling:create', (_e, data) => {
    const validation = validateSampling(data);
    if (!validation.valid) {
      throw new Error(validation.errors.join('；'));
    }
    const id = samplingQueries.create(data);
    batchQueries.updateStatus(data.batch_id, '已取样待送检');
    logQueries.create({ batch_id: data.batch_id, action: '完成取样', description: `样品编号 ${data.sample_no}，见证监理 ${data.witness_supervisor}` });
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
      logQueries.create({ batch_id: sampling.batch_id, action: '标记送检', description: `样品 ${sampling.sample_no}，送检日期 ${sentDate}` });
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
        (r.unqualified_items && r.unqualified_items.toLowerCase().includes(kw)) ||
        (r.testing_agency && r.testing_agency.toLowerCase().includes(kw))
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
    logQueries.create({
      batch_id: data.batch_id,
      action: '录入检测报告',
      description: `报告 ${data.report_no}，结论：${data.conclusion}${data.unqualified_items ? '，不合格项：' + data.unqualified_items : ''}`
    });
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
            (r.sample_no && r.sample_no.toLowerCase().includes(kw)) ||
            (r.testing_agency && r.testing_agency.toLowerCase().includes(kw));
        })
      : all;
    const headers = ['报告编号', '材料类型', '批次编号', '样品编号', '检测机构', '报告日期', '检测结论', '不合格项', '批次状态'];
    const rows = filtered.map((r: any) => {
      const status = r.conclusion === '合格' ? '可用' : (r.unqualified_items ? '禁止使用' : '待处置');
      return [r.report_no, r.material_type, r.batch_no, r.sample_no, r.testing_agency || '', r.report_date, r.conclusion, r.unqualified_items || '', status];
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

  ipcMain.handle('disposal:getAll', () => disposalQueries.getAll());
  ipcMain.handle('disposal:getByBatchId', (_e, batchId: number) => disposalQueries.getByBatchId(batchId));
  ipcMain.handle('disposal:create', (_e, data) => {
    if (!data.disposal_opinion || !data.disposal_opinion.trim()) {
      throw new Error('处置意见不能为空');
    }
    if (!data.disposal_date || !/^\d{4}-\d{2}-\d{2}$/.test(data.disposal_date)) {
      throw new Error('处置日期格式无效，应为 YYYY-MM-DD');
    }
    const id = disposalQueries.create(data);
    logQueries.create({
      batch_id: data.batch_id,
      action: '异常处置登记',
      description: `处置意见：${data.disposal_opinion}${data.retest_plan ? '，复检安排：' + data.retest_plan : ''}`
    });
    return id;
  });
  ipcMain.handle('disposal:update', (_e, id: number, data) => {
    disposalQueries.update(id, data);
    const disp = disposalQueries.getById(id);
    if (disp) {
      logQueries.create({
        batch_id: disp.batch_id,
        action: '异常处置更新',
        description: data.final_result ? `最终处理结果：${data.final_result}` : '处置信息已更新'
      });
    }
  });

  ipcMain.handle('log:getByBatchId', (_e, batchId: number) => logQueries.getByBatchId(batchId));
  ipcMain.handle('log:create', (_e, batchId: number, action: string, description?: string, operator?: string) =>
    logQueries.create({ batch_id: batchId, action, description, operator })
  );

  ipcMain.handle('batch:getTransferList', (_e, yearMonth: string) => {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM sampling_records s WHERE s.batch_id = m.id) as sampling_count,
        (SELECT COUNT(*) FROM sampling_records s WHERE s.batch_id = m.id AND s.sealing_photo IS NOT NULL AND s.sealing_photo != '') as photo_count,
        (SELECT COUNT(*) FROM sampling_records s WHERE s.batch_id = m.id AND s.is_sent = 1) as sent_count,
        (SELECT COUNT(*) FROM test_reports r WHERE r.batch_id = m.id) as report_count,
        (SELECT COUNT(*) FROM disposal_records d WHERE d.batch_id = m.id) as disposal_count
      FROM material_batches m
      WHERE substr(m.entry_date, 1, 7) = ?
      ORDER BY m.entry_date ASC, m.material_type ASC
    `);
    stmt.bind([yearMonth]);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as any);
    }
    stmt.free();

    const result: any[] = rows.map(b => {
      const reports: any[] = queryAll('SELECT report_no FROM test_reports WHERE batch_id = ?', [b.id]);
      const reportNos = reports.map(r => r.report_no);
      const abnormal = b.status === '待处置' || b.status === '禁止使用';
      const hasDisposal = b.disposal_count > 0;
      const complete = (
        b.sampling_count > 0 &&
        b.photo_count >= b.sampling_count &&
        b.sent_count >= b.sampling_count &&
        b.report_count > 0 &&
        (!abnormal || hasDisposal)
      );
      return {
        batch_id: b.id,
        material_type: b.material_type,
        batch_no: b.batch_no,
        entry_date: b.entry_date,
        has_entry: true,
        sampling_count: b.sampling_count,
        has_sealing_photo: b.photo_count >= b.sampling_count,
        sent_count: b.sent_count,
        report_count: b.report_count,
        report_nos: reportNos,
        has_disposal: hasDisposal,
        status: b.status,
        complete: complete ? 1 : 0,
      };
    });
    return result;
  });

  ipcMain.handle('export:transferCsv', async (_e, yearMonth: string) => {
    const list: any[] = await new Promise((resolve) => {
      const db = getDb();
      const stmt = db.prepare(`
        SELECT m.*,
          (SELECT COUNT(*) FROM sampling_records s WHERE s.batch_id = m.id) as sampling_count,
          (SELECT COUNT(*) FROM sampling_records s WHERE s.batch_id = m.id AND s.sealing_photo IS NOT NULL AND s.sealing_photo != '') as photo_count,
          (SELECT COUNT(*) FROM sampling_records s WHERE s.batch_id = m.id AND s.is_sent = 1) as sent_count,
          (SELECT COUNT(*) FROM test_reports r WHERE r.batch_id = m.id) as report_count,
          (SELECT COUNT(*) FROM disposal_records d WHERE d.batch_id = m.id) as disposal_count
        FROM material_batches m
        WHERE substr(m.entry_date, 1, 7) = ?
        ORDER BY m.entry_date ASC, m.material_type ASC
      `);
      stmt.bind([yearMonth]);
      const rows: any[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as any);
      stmt.free();

      const result = rows.map(b => {
        const reports: any[] = queryAll('SELECT report_no FROM test_reports WHERE batch_id = ?', [b.id]);
        const abnormal = b.status === '待处置' || b.status === '禁止使用';
        const hasDisposal = b.disposal_count > 0;
        const complete = (
          b.sampling_count > 0 &&
          b.photo_count >= b.sampling_count &&
          b.sent_count >= b.sampling_count &&
          b.report_count > 0 &&
          (!abnormal || hasDisposal)
        );
        return {
          material_type: b.material_type, batch_no: b.batch_no, entry_date: b.entry_date,
          has_entry: true, sampling_count: b.sampling_count,
          has_sealing_photo: b.photo_count >= b.sampling_count,
          sent_count: b.sent_count, report_count: b.report_count,
          report_nos: reports.map((r: any) => r.report_no),
          has_disposal: hasDisposal, status: b.status, complete
        };
      });
      resolve(result);
    });

    const headers = ['材料类型', '批次编号', '进场日期', '进场记录', '取样数', '封样照片', '已送检', '报告数', '报告编号', '异常处置', '批次状态', '资料齐全'];
    const rows = list.map((b: any) => [
      b.material_type, b.batch_no, b.entry_date, b.has_entry ? '✓' : '',
      b.sampling_count, b.has_sealing_photo ? '✓' : '缺',
      `${b.sent_count}/${b.sampling_count}`, b.report_count,
      (b.report_nos || []).join('、'),
      (b.status === '待处置' || b.status === '禁止使用') ? (b.has_disposal ? '已登记' : '待处置') : '',
      b.status, b.complete ? '齐全' : '缺项'
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')).join('\r\n');
    return '\ufeff' + csv;
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
