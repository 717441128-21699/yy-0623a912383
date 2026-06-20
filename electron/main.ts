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
  ipcMain.handle('batch:create', (_e, data, operator?: string) => {
    const validation = validateBatch(data);
    if (!validation.valid) {
      throw new Error(validation.errors.join('；'));
    }
    const id = batchQueries.create(data);
    logQueries.create({ batch_id: id, action: '新增进场登记', description: `${data.material_type} ${data.batch_no} 进场 ${data.quantity}`, operator: operator || undefined });
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

  ipcMain.handle('sampling:create', (_e, data, operator?: string) => {
    const validation = validateSampling(data);
    if (!validation.valid) {
      throw new Error(validation.errors.join('；'));
    }
    const id = samplingQueries.create(data);
    batchQueries.updateStatus(data.batch_id, '已取样待送检');
    logQueries.create({ batch_id: data.batch_id, action: '完成取样', description: `样品编号 ${data.sample_no}，见证监理 ${data.witness_supervisor}`, operator: operator || undefined });
    return id;
  });
  ipcMain.handle('sampling:markAsSent', (_e, id: number, sentDate: string, operator?: string) => {
    if (!sentDate || !/^\d{4}-\d{2}-\d{2}$/.test(sentDate)) {
      throw new Error('送检日期格式无效，应为 YYYY-MM-DD');
    }
    const sampling = samplingQueries.getById(id);
    samplingQueries.markAsSent(id, sentDate);
    if (sampling) {
      batchQueries.updateStatus(sampling.batch_id, '已送检待报告');
      logQueries.create({ batch_id: sampling.batch_id, action: '标记送检', description: `样品 ${sampling.sample_no}，送检日期 ${sentDate}`, operator: operator || undefined });
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
  ipcMain.handle('report:create', (_e, data, operator?: string) => {
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
      description: `报告 ${data.report_no}，结论：${data.conclusion}${data.unqualified_items ? '，不合格项：' + data.unqualified_items : ''}`,
      operator: operator || undefined
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
    const batches: any[] = queryAll(`
      SELECT m.* FROM material_batches m
      WHERE substr(m.entry_date, 1, 7) = ?
      ORDER BY m.entry_date ASC, m.material_type ASC
    `, [yearMonth]);

    const result: any[] = batches.map(b => {
      const samplings: any[] = queryAll(`
        SELECT s.id, s.sample_no, s.sampling_date, s.sealing_photo, s.is_sent, s.sent_date, s.testing_agency
        FROM sampling_records s WHERE s.batch_id = ?
        ORDER BY s.sampling_date ASC
      `, [b.id]);

      const reports: any[] = queryAll(`
        SELECT r.id, r.report_no, r.report_date, r.conclusion, r.unqualified_items, r.sampling_id
        FROM test_reports r WHERE r.batch_id = ?
        ORDER BY r.report_date ASC
      `, [b.id]);

      const disposals: any[] = queryAll(`
        SELECT d.id, d.disposal_opinion, d.retest_plan, d.retest_sample_no, d.retest_testing_agency,
          d.retest_report_no, d.retest_conclusion, d.retest_date, d.final_result, d.final_date
        FROM disposal_records d WHERE d.batch_id = ?
        ORDER BY d.created_at DESC
      `, [b.id]);

      const abnormal = b.status === '待处置' || b.status === '禁止使用';
      const hasDisposal = disposals.length > 0;
      const hasPhoto = samplings.length > 0 && samplings.every(s => s.sealing_photo && s.sealing_photo !== '');
      const allSent = samplings.length > 0 && samplings.every(s => s.is_sent === 1);
      const complete = (
        samplings.length > 0 &&
        hasPhoto &&
        allSent &&
        reports.length > 0 &&
        (!abnormal || hasDisposal)
      );

      return {
        batch_id: b.id,
        material_type: b.material_type,
        batch_no: b.batch_no,
        quantity: b.quantity,
        furnace_no: b.furnace_no,
        represent_quantity: b.represent_quantity,
        sampling_location: b.sampling_location,
        entry_date: b.entry_date,
        has_entry: true,
        has_sealing_photo: hasPhoto,
        status: b.status,
        complete,
        samplings: samplings.map(s => ({
          sample_no: s.sample_no,
          sampling_date: s.sampling_date,
          has_photo: !!(s.sealing_photo && s.sealing_photo !== ''),
          is_sent: s.is_sent === 1,
          sent_date: s.sent_date || '',
          testing_agency: s.testing_agency,
        })),
        reports: reports.map(r => ({
          report_no: r.report_no,
          report_date: r.report_date,
          conclusion: r.conclusion,
          unqualified_items: r.unqualified_items || '',
        })),
        disposals: disposals.map(d => ({
          disposal_opinion: d.disposal_opinion,
          retest_plan: d.retest_plan || '',
          retest_sample_no: d.retest_sample_no || '',
          retest_testing_agency: d.retest_testing_agency || '',
          retest_report_no: d.retest_report_no || '',
          retest_conclusion: d.retest_conclusion || '',
          retest_date: d.retest_date || '',
          final_result: d.final_result || '',
          final_date: d.final_date || '',
        })),
      };
    });
    return result;
  });

  ipcMain.handle('export:transferCsv', async (_e, yearMonth: string) => {
    const list: any[] = await new Promise((resolve) => {
      const db = getDb();
      const stmt = db.prepare(`SELECT m.* FROM material_batches m
        WHERE substr(m.entry_date, 1, 7) = ?
        ORDER BY m.entry_date ASC, m.material_type ASC`);
      stmt.bind([yearMonth]);
      const rows: any[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as any);
      stmt.free();

      const result = rows.map(b => {
        const samplings: any[] = queryAll(`
          SELECT s.sample_no, s.sampling_date, s.sealing_photo, s.is_sent, s.sent_date, s.testing_agency
          FROM sampling_records s WHERE s.batch_id = ? ORDER BY s.sampling_date ASC`, [b.id]);
        const reports: any[] = queryAll(`
          SELECT r.report_no, r.report_date, r.conclusion, r.unqualified_items
          FROM test_reports r WHERE r.batch_id = ? ORDER BY r.report_date ASC`, [b.id]);
        const disposals: any[] = queryAll(`
          SELECT d.disposal_opinion, d.retest_plan, d.retest_sample_no, d.retest_testing_agency,
            d.retest_report_no, d.retest_conclusion, d.retest_date, d.final_result, d.final_date
          FROM disposal_records d WHERE d.batch_id = ? ORDER BY d.created_at DESC`, [b.id]);
        return {
          material_type: b.material_type, batch_no: b.batch_no,
          quantity: b.quantity, furnace_no: b.furnace_no,
          sampling_location: b.sampling_location, entry_date: b.entry_date,
          status: b.status,
          samplings: samplings.map(s => ({
            sample_no: s.sample_no, sampling_date: s.sampling_date,
            has_photo: !!(s.sealing_photo && s.sealing_photo !== ''),
            is_sent: s.is_sent === 1, sent_date: s.sent_date || '',
            testing_agency: s.testing_agency,
          })),
          reports: reports.map(r => ({
            report_no: r.report_no, report_date: r.report_date,
            conclusion: r.conclusion, unqualified_items: r.unqualified_items || '',
          })),
          disposals,
        };
      });
      resolve(result);
    });

    const headers = ['材料类型', '批次编号', '进场日期', '进场数量', '炉批号', '取样部位',
      '样品编号', '取样日期', '封样照片', '送检日期', '检测机构',
      '报告编号', '报告日期', '检测结论', '不合格项',
      '异常处置', '复检安排', '复检样品', '复检机构', '复检报告', '复检结论', '复检日期', '最终结果', '闭环日期'];
    const rows: any[][] = [];
    for (const b of list) {
      const maxRows = Math.max(b.samplings.length, b.reports.length, b.disposals.length, 1);
      for (let i = 0; i < maxRows; i++) {
        const s = b.samplings[i] || {};
        const r = b.reports[i] || {};
        const d = b.disposals[i] || {};
        rows.push([
          i === 0 ? b.material_type : '',
          i === 0 ? b.batch_no : '',
          i === 0 ? b.entry_date : '',
          i === 0 ? b.quantity : '',
          i === 0 ? (b.furnace_no || '') : '',
          i === 0 ? b.sampling_location : '',
          s.sample_no || '', s.sampling_date || '',
          s.has_photo ? '有' : (s.sample_no ? '缺' : ''),
          s.is_sent ? (s.sent_date || '已送') : (s.sample_no ? '未送' : ''),
          s.testing_agency || '',
          r.report_no || '', r.report_date || '', r.conclusion || '', r.unqualified_items || '',
          i === 0 ? (d.disposal_opinion || '') : '',
          d.retest_plan || '', d.retest_sample_no || '', d.retest_testing_agency || '',
          d.retest_report_no || '', d.retest_conclusion || '', d.retest_date || '',
          d.final_result || '', d.final_date || '',
        ]);
      }
    }
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
