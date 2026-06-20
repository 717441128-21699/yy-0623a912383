import { useState, useEffect } from 'react';
import type { Batch, MaterialType, BatchStatus } from '../types';
import { validateBatchForm } from '../utils/validators';
import BatchDetailModal from './BatchDetailModal';
import MonthlyArchiveView from './MonthlyArchiveView';

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
  '已放行': 'status-ok',
  '已降级使用': 'status-ok',
  '已退场': 'status-ok',
};

type ViewMode = 'list' | 'archive';

export default function SamplingTaskPanel({ onDataChange }: Props) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [detailBatchId, setDetailBatchId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>('全部');
  const [filterStatus, setFilterStatus] = useState<string>('待取样');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [form, setForm] = useState({
    material_type: '钢筋原材' as MaterialType,
    batch_no: '',
    quantity: '',
    furnace_no: '',
    represent_quantity: '',
    sampling_location: '',
    entry_date: new Date().toISOString().slice(0, 10),
  });
  const [operator, setOperator] = useState('');

  const loadData = async () => {
    const data = await window.api.batch.getAll();
    setBatches(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async () => {
    const validation = validateBatchForm(form);
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors([]);
    try {
      await window.api.batch.create({
        material_type: form.material_type,
        batch_no: form.batch_no,
        quantity: Number(form.quantity),
        furnace_no: form.furnace_no || undefined,
        represent_quantity: Number(form.represent_quantity),
        sampling_location: form.sampling_location,
        entry_date: form.entry_date,
      }, operator || undefined);
      setShowAdd(false);
      setForm({
        material_type: '钢筋原材',
        batch_no: '',
        quantity: '',
        furnace_no: '',
        represent_quantity: '',
        sampling_location: '',
        entry_date: new Date().toISOString().slice(0, 10),
      });
      setFormErrors([]);
      loadData();
      onDataChange();
    } catch (e: any) {
      setFormErrors([e.message || '保存失败']);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除该批次记录？相关取样和报告也将被删除。')) return;
    await window.api.batch.delete(id);
    loadData();
    onDataChange();
  };

  const filtered = batches.filter(b => {
    if (filterType !== '全部' && b.material_type !== filterType) return false;
    if (filterStatus !== '全部' && b.status !== filterStatus) return false;
    return true;
  });

  const vm = viewMode as string;

  if (vm === 'archive') {
    return (
      <MonthlyArchiveView
        onBack={() => setViewMode('list')}
        onViewBatchDetail={setDetailBatchId}
      />
    );
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button
                className={`btn ${vm === 'list' ? 'btn-primary' : 'btn-default'} btn-sm`}
                onClick={() => setViewMode('list')}
              >
                批次列表
              </button>
              <button
                className={`btn ${vm === 'archive' ? 'btn-primary' : 'btn-default'} btn-sm`}
                onClick={() => setViewMode('archive')}
              >
                月度归档视图
              </button>
            </div>
            <div className="panel-title" style={{ marginLeft: '10px' }}>进场批次与待取样清单</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ 新增进场批次</button>
        </div>
        <div className="panel-body">
          <div className="filter-bar">
            <div className="filter-item">
              <label>材料类型：</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="全部">全部</option>
                <option value="钢筋原材">钢筋原材</option>
                <option value="混凝土试块">混凝土试块</option>
                <option value="防水材料">防水材料</option>
              </select>
            </div>
            <div className="filter-item">
              <label>状态：</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="全部">全部</option>
                <option value="待取样">待取样</option>
                <option value="已取样待送检">已取样待送检</option>
                <option value="已送检待报告">已送检待报告</option>
                <option value="可用">可用</option>
                <option value="待处置">待处置</option>
                <option value="禁止使用">禁止使用</option>
              </select>
            </div>
            <div style={{ marginLeft: 'auto', color: '#909399', fontSize: '12px' }}>
              共 {filtered.length} 条记录
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">暂无数据，点击右上角新增进场批次</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>材料类型</th>
                  <th>批次编号</th>
                  <th>进场数量</th>
                  <th>炉批号</th>
                  <th>代表数量</th>
                  <th>取样部位</th>
                  <th>进场日期</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id}>
                    <td>{b.material_type}</td>
                    <td style={{ fontFamily: 'Consolas, monospace' }}>{b.batch_no}</td>
                    <td>{b.quantity}</td>
                    <td>{b.furnace_no || '-'}</td>
                    <td>{b.represent_quantity}</td>
                    <td>{b.sampling_location}</td>
                    <td>{b.entry_date}</td>
                    <td><span className={`status-tag ${STATUS_CLASS[b.status]}`}>{b.status}</span></td>
                    <td>
                      <div className="action-cell">
                        <button className="btn btn-default btn-sm" onClick={() => setDetailBatchId(b.id)}>详情</button>
                        <button className="btn btn-default btn-sm" onClick={() => handleDelete(b.id)}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-title">新增材料进场批次</div>
              <span className="modal-close" onClick={() => setShowAdd(false)}>×</span>
            </div>
            <div className="modal-body">
              {formErrors.length > 0 && (
                <div className="alert-box alert-danger" style={{ marginBottom: '14px' }}>
                  {formErrors.map((err, i) => <div key={i}>⚠ {err}</div>)}
                </div>
              )}
              <div className="form-row">
                <div className="form-item">
                  <label><span className="required">*</span>材料类型</label>
                  <select value={form.material_type} onChange={e => setForm({ ...form, material_type: e.target.value as MaterialType })}>
                    <option value="钢筋原材">钢筋原材</option>
                    <option value="混凝土试块">混凝土试块</option>
                    <option value="防水材料">防水材料</option>
                  </select>
                </div>
                <div className="form-item">
                  <label><span className="required">*</span>批次编号</label>
                  <input value={form.batch_no} onChange={e => setForm({ ...form, batch_no: e.target.value })} placeholder="如：GJ202606001" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-item">
                  <label><span className="required">*</span>进场数量</label>
                  <input type="number" min="0.01" step="any" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="数值，必须大于0" />
                </div>
                <div className="form-item">
                  <label><span className={form.material_type === '钢筋原材' ? 'required' : ''}>*</span>炉批号{form.material_type === '钢筋原材' ? '（必填）' : ''}</label>
                  <input value={form.furnace_no} onChange={e => setForm({ ...form, furnace_no: e.target.value })} placeholder="如：HRB400E-25-A01" />
                </div>
                <div className="form-item">
                  <label><span className="required">*</span>代表数量</label>
                  <input type="number" min="0.01" step="any" value={form.represent_quantity} onChange={e => setForm({ ...form, represent_quantity: e.target.value })} placeholder="必须大于0" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-item">
                  <label><span className="required">*</span>取样部位</label>
                  <input value={form.sampling_location} onChange={e => setForm({ ...form, sampling_location: e.target.value })} placeholder="如：3#楼二层柱" />
                </div>
                <div className="form-item">
                  <label><span className="required">*</span>进场日期</label>
                  <input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} />
                </div>
                <div className="form-item">
                  <label>经办人</label>
                  <input value={operator} onChange={e => setOperator(e.target.value)} placeholder="填写经办人姓名" />
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#909399', marginTop: '6px' }}>
                注：新增后状态为"待取样"，由试验员在"送检登记"中完成取样登记。
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => { setShowAdd(false); setFormErrors([]); }}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit}>生成待取样清单</button>
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
