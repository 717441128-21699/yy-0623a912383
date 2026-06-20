import { useState, useEffect, useRef } from 'react';
import type { Report, Sampling, ReportConclusion, BatchStatus } from '../types';
import { validateReportForm } from '../utils/validators';
import BatchDetailModal from './BatchDetailModal';

interface Props {
  onDataChange: () => void;
}

const STATUS_CLASS: Record<BatchStatus, string> = {
  '待取样': 'status-pending',
  '已取样待送检': 'status-sampled',
  '已送检待报告': 'status-sent',
  '可用': 'status-ok',
  '待处置': 'status-todo',
  '禁止使用': 'status-bad',
};

export default function ReportPanel({ onDataChange }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [sentSamplings, setSentSamplings] = useState<Sampling[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [filterConclusion, setFilterConclusion] = useState<string>('全部');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [detailBatchId, setDetailBatchId] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [form, setForm] = useState({
    sampling_id: '',
    report_no: '',
    conclusion: '合格' as ReportConclusion,
    unqualified_items: '',
    report_date: new Date().toISOString().slice(0, 10),
  });
  const [reportOperator, setReportOperator] = useState('');

  const loadData = async (keyword?: string) => {
    const [r, allS] = await Promise.all([
      window.api.report.getAll(keyword),
      window.api.sampling.getAll(),
    ]);
    setReports(r);
    setSentSamplings(allS.filter((s: Sampling) => s.is_sent === 1));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadData(searchKeyword);
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchKeyword]);

  const handleSubmit = async () => {
    const validation = validateReportForm(form);
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors([]);

    if (form.conclusion === '不合格' && !form.unqualified_items.trim()) {
      if (!confirm('未填写不合格项，系统将标记为"待处置"。确定继续吗？')) return;
    }

    const sampling = sentSamplings.find(s => s.id === Number(form.sampling_id));
    if (!sampling) {
      setFormErrors(['未找到该送检记录']);
      return;
    }

    try {
      await window.api.report.create({
        batch_id: sampling.batch_id,
        sampling_id: Number(form.sampling_id),
        report_no: form.report_no,
        conclusion: form.conclusion,
        unqualified_items: form.unqualified_items.trim() || undefined,
        report_date: form.report_date,
      }, reportOperator || undefined);

      setShowAdd(false);
      setFormErrors([]);
      setForm({
        sampling_id: '',
        report_no: '',
        conclusion: '合格',
        unqualified_items: '',
        report_date: new Date().toISOString().slice(0, 10),
      });
      loadData();
      onDataChange();
    } catch (e: any) {
      setFormErrors([e.message || '保存失败']);
    }
  };

  const handleExport = async () => {
    try {
      const content = await window.api.export.reportsCsv(searchKeyword);
      const defaultName = `检测报告_${new Date().toISOString().slice(0, 10)}.csv`;
      const saved = await window.api.export.saveCsv(defaultName, content);
      if (saved) alert(`已导出到：${saved}`);
    } catch (e: any) {
      alert('导出失败：' + e.message);
    }
  };

  const usedSamplingIds = new Set(reports.map(r => r.sampling_id));
  const availableSamplings = sentSamplings.filter(s => !usedSamplingIds.has(s.id));

  const filtered = reports.filter(r => {
    if (filterConclusion !== '全部' && r.conclusion !== filterConclusion) return false;
    return true;
  });

  const predictBatchStatus = (): BatchStatus => {
    if (form.conclusion === '合格') return '可用';
    if (form.unqualified_items.trim()) return '禁止使用';
    return '待处置';
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">检测报告回填</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="搜索报告/批次/样品/检测机构..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid #dcdfe6', borderRadius: '3px', fontSize: '13px', width: '260px' }}
            />
            <button className="btn btn-default btn-sm" onClick={handleExport}>导出表格</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (availableSamplings.length === 0) {
                  alert('没有可回填报告的送检记录。请先在"送检登记"中标记样品为已送检。');
                  return;
                }
                setFormErrors([]);
                setShowAdd(true);
              }}
            >
              + 录入报告
            </button>
          </div>
        </div>
        <div className="panel-body">
          <div className="filter-bar">
            <div className="filter-item">
              <label>结论：</label>
              <select value={filterConclusion} onChange={e => setFilterConclusion(e.target.value)}>
                <option value="全部">全部</option>
                <option value="合格">合格</option>
                <option value="不合格">不合格</option>
              </select>
            </div>
            <div style={{ marginLeft: 'auto', color: '#909399', fontSize: '12px' }}>
              共 {filtered.length} 份报告 · 待回填 {availableSamplings.length} 份
            </div>
          </div>

          {availableSamplings.length > 0 && (
            <div className="alert-box alert-warning">
              ℹ 有 {availableSamplings.length} 份送检样品等待报告回填
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="empty-state">暂无报告记录</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>报告编号</th>
                  <th>材料类型</th>
                  <th>批次编号</th>
                  <th>样品编号</th>
                  <th>检测机构</th>
                  <th>报告日期</th>
                  <th>检测结论</th>
                  <th>不合格项</th>
                  <th>批次状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const batchStatus: BatchStatus = r.conclusion === '合格'
                    ? '可用'
                    : (r.unqualified_items ? '禁止使用' : '待处置');
                  return (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'Consolas, monospace' }}>{r.report_no}</td>
                      <td>{r.material_type}</td>
                      <td>{r.batch_no}</td>
                      <td style={{ fontFamily: 'Consolas, monospace' }}>{r.sample_no}</td>
                      <td>{r.testing_agency || '-'}</td>
                      <td>{r.report_date}</td>
                      <td>
                        <span className={`status-tag ${r.conclusion === '合格' ? 'status-ok' : 'status-bad'}`}>
                          {r.conclusion}
                        </span>
                      </td>
                      <td style={{ color: r.unqualified_items ? '#f56c6c' : '#909399' }}>
                        {r.unqualified_items || '-'}
                      </td>
                      <td>
                        <span className={`status-tag ${STATUS_CLASS[batchStatus]}`}>
                          {batchStatus}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-default btn-sm" onClick={() => setDetailBatchId(r.batch_id)}>
                          批次详情
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-title">录入检测报告</div>
              <span className="modal-close" onClick={() => { setShowAdd(false); setFormErrors([]); }}>×</span>
            </div>
            <div className="modal-body">
              {formErrors.length > 0 && (
                <div className="alert-box alert-danger" style={{ marginBottom: '14px' }}>
                  {formErrors.map((err, i) => <div key={i}>⚠ {err}</div>)}
                </div>
              )}
              <div className="form-row">
                <div className="form-item" style={{ flex: 2 }}>
                  <label><span className="required">*</span>选择送检记录</label>
                  <select value={form.sampling_id} onChange={e => setForm({ ...form, sampling_id: e.target.value })}>
                    <option value="">请选择</option>
                    {availableSamplings.map(s => (
                      <option key={s.id} value={s.id}>
                        [{s.material_type}] 样品:{s.sample_no} / 批次:{s.batch_no} / {s.testing_agency}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-item">
                  <label><span className="required">*</span>报告日期</label>
                  <input type="date" value={form.report_date} onChange={e => setForm({ ...form, report_date: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-item" style={{ flex: 2 }}>
                  <label><span className="required">*</span>报告编号</label>
                  <input value={form.report_no} onChange={e => setForm({ ...form, report_no: e.target.value })} placeholder="检测机构出具的报告编号" />
                </div>
                <div className="form-item">
                  <label><span className="required">*</span>检测结论</label>
                  <select value={form.conclusion} onChange={e => setForm({ ...form, conclusion: e.target.value as ReportConclusion })}>
                    <option value="合格">合格</option>
                    <option value="不合格">不合格</option>
                  </select>
                </div>
                <div className="form-item">
                  <label>经办人</label>
                  <input value={reportOperator} onChange={e => setReportOperator(e.target.value)} placeholder="填写经办人姓名" />
                </div>
              </div>
              {form.conclusion === '不合格' && (
                <div className="form-row">
                  <div className="form-item">
                    <label>不合格项明细</label>
                    <textarea
                      value={form.unqualified_items}
                      onChange={e => setForm({ ...form, unqualified_items: e.target.value })}
                      placeholder="请填写具体不合格项目及数值，如：屈服强度偏低、抗拉强度不合格等"
                    />
                  </div>
                </div>
              )}
              <div style={{
                padding: '10px 14px',
                background: '#f5f7fa',
                borderRadius: '3px',
                fontSize: '13px',
                marginTop: '6px',
              }}>
                系统将自动标记该批次为：
                <span className={`status-tag ${STATUS_CLASS[predictBatchStatus()]}`} style={{ marginLeft: '8px' }}>
                  {predictBatchStatus()}
                </span>
                {form.conclusion === '不合格' && !form.unqualified_items.trim() && (
                  <span style={{ color: '#e6a23c', marginLeft: '8px', fontSize: '12px' }}>
                    （填写不合格项后将自动变更为"禁止使用"）
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#909399', marginTop: '10px' }}>
                规则：合格→可用；不合格+有明细→禁止使用；不合格+无明细→待处置（人工复核）。
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => { setShowAdd(false); setFormErrors([]); }}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit}>确认回填</button>
            </div>
          </div>
        </div>
      )}

      {detailBatchId !== null && (
        <BatchDetailModal batchId={detailBatchId} onClose={() => setDetailBatchId(null)} />
      )}
    </div>
  );
}
