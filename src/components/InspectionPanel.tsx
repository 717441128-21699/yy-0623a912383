import { useState, useEffect, useRef } from 'react';
import type { Batch, Sampling } from '../types';
import { validateSamplingForm } from '../utils/validators';
import BatchDetailModal from './BatchDetailModal';

interface Props {
  onDataChange: () => void;
}

const DEADLINE_DAYS: Record<string, number> = {
  '钢筋原材': 3,
  '混凝土试块': 7,
  '防水材料': 5,
};

export default function InspectionPanel({ onDataChange }: Props) {
  const [pendingBatches, setPendingBatches] = useState<Batch[]>([]);
  const [samplings, setSamplings] = useState<Sampling[]>([]);
  const [overdue, setOverdue] = useState<Sampling[]>([]);
  const [pendingSend, setPendingSend] = useState<Sampling[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [photoData, setPhotoData] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'pending' | 'all'>('pending');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [detailBatchId, setDetailBatchId] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [form, setForm] = useState({
    batch_id: '',
    sample_no: '',
    witness_supervisor: '',
    testing_agency: '',
    sampling_date: new Date().toISOString().slice(0, 10),
  });

  const loadData = async (keyword?: string) => {
    const [batches, allS, overdueS, pendingS] = await Promise.all([
      window.api.batch.getByStatus('待取样'),
      window.api.sampling.getAll(keyword),
      window.api.sampling.getOverdue(),
      window.api.sampling.getPendingSend(),
    ]);
    setPendingBatches(batches);
    setSamplings(allS);
    setOverdue(overdueS);
    setPendingSend(pendingS);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (filterTab === 'all') {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        loadData(searchKeyword);
      }, 300);
    }
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchKeyword, filterTab]);

  const handlePhotoSelect = async () => {
    const data = await window.api.photo.openDialog();
    if (data) setPhotoData(data);
  };

  const calcDeadline = (samplingDate: string, materialType: string) => {
    const d = new Date(samplingDate);
    d.setDate(d.getDate() + (DEADLINE_DAYS[materialType] || 3));
    return d.toISOString().slice(0, 10);
  };

  const handleSubmit = async () => {
    const validation = validateSamplingForm(form);
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors([]);
    const batch = pendingBatches.find(b => b.id === Number(form.batch_id));
    if (!batch) {
      setFormErrors(['未找到该批次信息']);
      return;
    }

    try {
      let photoPath = '';
      if (photoData) {
        const fileName = `seal_${form.sample_no}_${Date.now()}.jpg`;
        photoPath = await window.api.photo.save(photoData, fileName);
      }

      const deadline = calcDeadline(form.sampling_date, batch.material_type);

      await window.api.sampling.create({
        batch_id: Number(form.batch_id),
        sample_no: form.sample_no,
        witness_supervisor: form.witness_supervisor,
        sealing_photo: photoPath || undefined,
        testing_agency: form.testing_agency,
        sampling_date: form.sampling_date,
        is_sent: 0,
        deadline_date: deadline,
      });

      setShowAdd(false);
      setPhotoData('');
      setFormErrors([]);
      setForm({
        batch_id: '',
        sample_no: '',
        witness_supervisor: '',
        testing_agency: '',
        sampling_date: new Date().toISOString().slice(0, 10),
      });
      loadData();
      onDataChange();
    } catch (e: any) {
      setFormErrors([e.message || '保存失败']);
    }
  };

  const handleMarkSent = async (id: number) => {
    if (!confirm('确认标记为已送检？')) return;
    try {
      await window.api.sampling.markAsSent(id, new Date().toISOString().slice(0, 10));
      loadData();
      onDataChange();
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

  const handleExport = async () => {
    try {
      const content = await window.api.export.samplingsCsv(searchKeyword);
      const defaultName = `送检记录_${new Date().toISOString().slice(0, 10)}.csv`;
      const saved = await window.api.export.saveCsv(defaultName, content);
      if (saved) alert(`已导出到：${saved}`);
    } catch (e: any) {
      alert('导出失败：' + e.message);
    }
  };

  const displayList = filterTab === 'pending' ? pendingSend : samplings;

  return (
    <div>
      {overdue.length > 0 && (
        <div className="alert-box alert-danger">
          ⚠ 有 {overdue.length} 个样品已超过送检时限，请尽快送检！
        </div>
      )}
      {pendingSend.length > 0 && overdue.length === 0 && (
        <div className="alert-box alert-warning">
          ℹ 当前有 {pendingSend.length} 个样品已取样待送检
        </div>
      )}
      {pendingSend.length === 0 && overdue.length === 0 && (
        <div className="alert-box alert-info">
          ✓ 当前无待送检样品
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className="panel-title">送检登记</div>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button
                className={`btn ${filterTab === 'pending' ? 'btn-primary' : 'btn-default'} btn-sm`}
                onClick={() => setFilterTab('pending')}
              >
                待送检 ({pendingSend.length})
              </button>
              <button
                className={`btn ${filterTab === 'all' ? 'btn-primary' : 'btn-default'} btn-sm`}
                onClick={() => setFilterTab('all')}
              >
                全部记录
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {filterTab === 'all' && (
              <input
                type="text"
                placeholder="搜索批次/样品/检测机构/见证..."
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                style={{ padding: '6px 10px', border: '1px solid #dcdfe6', borderRadius: '3px', fontSize: '13px', width: '240px' }}
              />
            )}
            <button className="btn btn-default btn-sm" onClick={handleExport}>导出表格</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (pendingBatches.length === 0) {
                  alert('当前没有待取样的批次，请先在"取样任务"中新增进场批次');
                  return;
                }
                setFormErrors([]);
                setShowAdd(true);
              }}
            >
              + 取样登记
            </button>
          </div>
        </div>
        <div className="panel-body">
          {displayList.length === 0 ? (
            <div className="empty-state">暂无{filterTab === 'pending' ? '待送检' : ''}记录</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>样品编号</th>
                  <th>材料类型</th>
                  <th>批次编号</th>
                  <th>取样部位</th>
                  <th>见证监理</th>
                  <th>检测机构</th>
                  <th>取样日期</th>
                  <th>送检时限</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {displayList.map(s => {
                  const today = new Date().toISOString().slice(0, 10);
                  const isOverdue = s.is_sent === 0 && s.deadline_date < today;
                  return (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'Consolas, monospace' }}>{s.sample_no}</td>
                      <td>{s.material_type}</td>
                      <td>{s.batch_no}</td>
                      <td>{s.sampling_location}</td>
                      <td>{s.witness_supervisor}</td>
                      <td>{s.testing_agency}</td>
                      <td>{s.sampling_date}</td>
                      <td>
                        {isOverdue ? (
                          <span className="status-tag status-overdue">{s.deadline_date} 已超期</span>
                        ) : (
                          s.deadline_date
                        )}
                      </td>
                      <td>
                        {s.is_sent === 1 ? (
                          <span className="status-tag status-sent">已送检</span>
                        ) : (
                          <span className={`status-tag ${isOverdue ? 'status-overdue' : 'status-sampled'}`}>
                            已取样待送检
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="action-cell">
                          <button className="btn btn-default btn-sm" onClick={() => setDetailBatchId(s.batch_id)}>
                            批次详情
                          </button>
                          {s.is_sent === 0 && (
                            <button className="btn btn-success btn-sm" onClick={() => handleMarkSent(s.id)}>
                              标记已送检
                            </button>
                          )}
                          {s.sealing_photo && (
                            <button
                              className="btn btn-default btn-sm"
                              onClick={async () => {
                                const data = await window.api.photo.read(s.sealing_photo!);
                                if (data) {
                                  const w = window.open('', '_blank');
                                  if (w) w.document.write(`<img src="${data}" style="max-width:100%" />`);
                                }
                              }}
                            >
                              查看照片
                            </button>
                          )}
                        </div>
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
              <div className="modal-title">取样登记（已现场完成取样）</div>
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
                  <label><span className="required">*</span>选择进场批次（待取样）</label>
                  <select value={form.batch_id} onChange={e => setForm({ ...form, batch_id: e.target.value })}>
                    <option value="">请选择</option>
                    {pendingBatches.map(b => (
                      <option key={b.id} value={b.id}>
                        [{b.material_type}] {b.batch_no} - {b.sampling_location}（进量:{b.quantity}）
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-item">
                  <label><span className="required">*</span>取样日期</label>
                  <input type="date" value={form.sampling_date} onChange={e => setForm({ ...form, sampling_date: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-item">
                  <label><span className="required">*</span>样品编号</label>
                  <input value={form.sample_no} onChange={e => setForm({ ...form, sample_no: e.target.value })} placeholder="如：YP-GJ-202606001" />
                </div>
                <div className="form-item">
                  <label><span className="required">*</span>见证监理</label>
                  <input value={form.witness_supervisor} onChange={e => setForm({ ...form, witness_supervisor: e.target.value })} placeholder="监理工程师姓名" />
                </div>
                <div className="form-item">
                  <label><span className="required">*</span>送检机构</label>
                  <input value={form.testing_agency} onChange={e => setForm({ ...form, testing_agency: e.target.value })} placeholder="检测单位名称" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-item">
                  <label>封样照片</label>
                  <div className="photo-upload">
                    <div className="photo-preview">
                      {photoData ? (
                        <img src={photoData} alt="封样照片" />
                      ) : (
                        <span className="placeholder">暂无照片</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <button className="btn btn-default btn-sm" onClick={handlePhotoSelect}>选择照片</button>
                      {photoData && (
                        <button className="btn btn-default btn-sm" onClick={() => setPhotoData('')}>清除</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#909399', marginTop: '6px' }}>
                注：送检时限自动计算（钢筋原材3天、混凝土试块7天、防水材料5天）。
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => { setShowAdd(false); setFormErrors([]); }}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit}>登记完成</button>
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
