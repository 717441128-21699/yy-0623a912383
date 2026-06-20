import { useState, useEffect } from 'react';
import type { Batch, DisposalItem } from '../types';
import BatchDetailModal from './BatchDetailModal';

interface Props {
  onDataChange?: () => void;
}

export default function DisposalPanel({ onDataChange }: Props) {
  const [abnormalBatches, setAbnormalBatches] = useState<Batch[]>([]);
  const [disposals, setDisposals] = useState<DisposalItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailBatchId, setDetailBatchId] = useState<number | null>(null);

  const [form, setForm] = useState({
    batch_id: 0,
    disposal_opinion: '',
    retest_plan: '',
    retest_sample_no: '',
    retest_testing_agency: '',
    retest_report_no: '',
    retest_conclusion: '',
    retest_date: '',
    final_result: '',
    disposal_date: new Date().toISOString().slice(0, 10),
    final_date: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = async () => {
    const [all, disp] = await Promise.all([
      window.api.batch.getAll(),
      window.api.disposal.getAll(),
    ]);
    const allAbnormal = all.filter(b => b.status === '待处置' || b.status === '禁止使用');
    const pendingAbnormal = allAbnormal.filter(b => !disp.some(d => d.batch_id === b.id && d.final_result));
    setAbnormalBatches(pendingAbnormal);
    setDisposals(disp);
    onDataChange?.();
  };

  useEffect(() => {
    loadData();
  }, []);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.batch_id) errors.batch_id = '请选择异常批次';
    if (!form.disposal_opinion.trim()) errors.disposal_opinion = '处置意见不能为空';
    if (!form.disposal_date) errors.disposal_date = '处置日期不能为空';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAdd = (batch?: Batch) => {
    setForm({
      batch_id: batch?.id || 0,
      disposal_opinion: '',
      retest_plan: '',
      retest_sample_no: '',
      retest_testing_agency: '',
      retest_report_no: '',
      retest_conclusion: '',
      retest_date: '',
      final_result: '',
      disposal_date: new Date().toISOString().slice(0, 10),
      final_date: '',
    });
    setFormErrors({});
    setEditingId(null);
    setShowAdd(true);
  };

  const openEdit = (disp: DisposalItem) => {
    setForm({
      batch_id: disp.batch_id,
      disposal_opinion: disp.disposal_opinion,
      retest_plan: disp.retest_plan || '',
      retest_sample_no: disp.retest_sample_no || '',
      retest_testing_agency: disp.retest_testing_agency || '',
      retest_report_no: disp.retest_report_no || '',
      retest_conclusion: disp.retest_conclusion || '',
      retest_date: disp.retest_date || '',
      final_result: disp.final_result || '',
      disposal_date: disp.disposal_date,
      final_date: disp.final_date || '',
    });
    setFormErrors({});
    setEditingId(disp.id);
    setShowAdd(true);
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      if (editingId) {
        await window.api.disposal.update(editingId, form);
      } else {
        await window.api.disposal.create(form);
      }
      setShowAdd(false);
      await loadData();
    } catch (e: any) {
      alert('保存失败：' + e.message);
    }
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">异常批次处置跟踪</div>
          <button className="btn btn-primary" onClick={() => openAdd()}>+ 新增处置记录</button>
        </div>
        <div className="panel-body">
          {abnormalBatches.length === 0 && disposals.length === 0 ? (
            <div className="empty-state">暂无异常批次</div>
          ) : (
            <>
              {abnormalBatches.length > 0 && (
                <div className="detail-section">
                  <div className="detail-section-title">待处置批次（{abnormalBatches.length}）</div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>材料类型</th>
                        <th>批次编号</th>
                        <th>进场日期</th>
                        <th>进场数量</th>
                        <th>状态</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {abnormalBatches.map(b => {
                        const hasDisp = disposals.some(d => d.batch_id === b.id);
                        const hasFinalResult = disposals.some(d => d.batch_id === b.id && d.final_result);
                        return (
                          <tr key={b.id}>
                            <td>{b.material_type}</td>
                            <td>{b.batch_no}</td>
                            <td>{b.entry_date}</td>
                            <td>{b.quantity}</td>
                            <td>
                              <span className={`status-tag ${b.status === '禁止使用' ? 'status-bad' : 'status-todo'}`}>
                                {b.status}
                              </span>
                              {hasFinalResult && <span className="sub-tag tag-ok">已闭环</span>}
                              {!hasFinalResult && !hasDisp && <span className="sub-tag tag-miss">未处置</span>}
                              {!hasFinalResult && hasDisp && <span className="sub-tag tag-warn">处置中</span>}
                            </td>
                            <td>
                              <div className="action-cell">
                                <button className="btn btn-sm btn-warning" onClick={() => openAdd(b)}>登记处置</button>
                                <button className="btn btn-sm btn-default" onClick={() => setDetailBatchId(b.id)}>批次详情</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {disposals.length > 0 && (
                <div className="detail-section">
                  <div className="detail-section-title">处置记录台账（{disposals.length}）</div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>材料类型</th>
                        <th>批次编号</th>
                        <th>处置意见</th>
                        <th>复检安排</th>
                        <th>复检报告</th>
                        <th>复检结论</th>
                        <th>最终处理结果</th>
                        <th>处置日期</th>
                        <th>闭环日期</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disposals.map(d => (
                        <tr key={d.id}>
                          <td>{d.material_type}</td>
                          <td>{d.batch_no}</td>
                          <td style={{ maxWidth: 200 }}>{d.disposal_opinion}</td>
                          <td style={{ maxWidth: 180 }}>{d.retest_plan || '-'}</td>
                          <td>{d.retest_report_no || '-'}</td>
                          <td>
                            {d.retest_conclusion ? (
                              <span className={`status-tag ${d.retest_conclusion === '合格' ? 'status-ok' : 'status-bad'}`}>{d.retest_conclusion}</span>
                            ) : '-'}
                          </td>
                          <td>
                            {d.final_result ? (
                              <span className="status-tag status-ok">{d.final_result}</span>
                            ) : (
                              <span className="sub-tag tag-warn">待闭环</span>
                            )}
                          </td>
                          <td>{d.disposal_date}</td>
                          <td>{d.final_date || '-'}</td>
                          <td>
                            <div className="action-cell">
                              <button className="btn btn-sm btn-default" onClick={() => openEdit(d)}>更新</button>
                              <button className="btn btn-sm btn-default" onClick={() => setDetailBatchId(d.batch_id)}>详情</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editingId ? '更新处置记录' : '新增异常处置'}</div>
              <div className="modal-close" onClick={() => setShowAdd(false)}>✕</div>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-item">
                  <label><span className="required">*</span>异常批次</label>
                  <select
                    value={form.batch_id}
                    onChange={e => setForm({ ...form, batch_id: Number(e.target.value) })}
                    disabled={!!editingId}
                  >
                    <option value={0}>请选择批次</option>
                    {abnormalBatches.map(b => (
                      <option key={b.id} value={b.id}>
                        [{b.material_type}] {b.batch_no} ({b.status})
                      </option>
                    ))}
                  </select>
                  <div className="form-error-text">{formErrors.batch_id}</div>
                </div>
                <div className="form-item">
                  <label><span className="required">*</span>处置日期</label>
                  <input
                    type="date"
                    value={form.disposal_date}
                    onChange={e => setForm({ ...form, disposal_date: e.target.value })}
                  />
                  <div className="form-error-text">{formErrors.disposal_date}</div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-item" style={{ minWidth: '100%' }}>
                  <label><span className="required">*</span>处置意见</label>
                  <textarea
                    rows={3}
                    placeholder="例如：退场处理 / 降级使用 / 双倍复检等"
                    value={form.disposal_opinion}
                    onChange={e => setForm({ ...form, disposal_opinion: e.target.value })}
                  />
                  <div className="form-error-text">{formErrors.disposal_opinion}</div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-item" style={{ minWidth: '100%' }}>
                  <label>复检安排（可选）</label>
                  <textarea
                    rows={2}
                    placeholder="例如：XX检测机构双倍复检，预计XX月XX日完成"
                    value={form.retest_plan}
                    onChange={e => setForm({ ...form, retest_plan: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-item" style={{ minWidth: '100%' }}>
                  <label>复检结果回填（安排复检后填写）</label>
                </div>
              </div>
              <div className="form-row">
                <div className="form-item">
                  <label>复检样品编号</label>
                  <input
                    type="text"
                    placeholder="复检送样编号"
                    value={form.retest_sample_no}
                    onChange={e => setForm({ ...form, retest_sample_no: e.target.value })}
                  />
                </div>
                <div className="form-item">
                  <label>复检机构</label>
                  <input
                    type="text"
                    placeholder="复检检测机构"
                    value={form.retest_testing_agency}
                    onChange={e => setForm({ ...form, retest_testing_agency: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-item">
                  <label>复检报告编号</label>
                  <input
                    type="text"
                    placeholder="复检报告编号"
                    value={form.retest_report_no}
                    onChange={e => setForm({ ...form, retest_report_no: e.target.value })}
                  />
                </div>
                <div className="form-item">
                  <label>复检结论</label>
                  <select
                    value={form.retest_conclusion}
                    onChange={e => setForm({ ...form, retest_conclusion: e.target.value })}
                  >
                    <option value="">请选择</option>
                    <option value="合格">合格</option>
                    <option value="不合格">不合格</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-item">
                  <label>复检日期</label>
                  <input
                    type="date"
                    value={form.retest_date}
                    onChange={e => setForm({ ...form, retest_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-item" style={{ minWidth: '100%' }}>
                  <label>最终处理结果（闭环时填写）</label>
                  <textarea
                    rows={2}
                    placeholder="例如：已完成退场 / 复检合格，允许使用 / 已降级用于非承重部位"
                    value={form.final_result}
                    onChange={e => setForm({ ...form, final_result: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-item">
                  <label>闭环日期</label>
                  <input
                    type="date"
                    value={form.final_date}
                    onChange={e => setForm({ ...form, final_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowAdd(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit}>保存</button>
            </div>
          </div>
        </div>
      )}

      {detailBatchId && (
        <BatchDetailModal batchId={detailBatchId} onClose={() => setDetailBatchId(null)} />
      )}
    </div>
  );
}
