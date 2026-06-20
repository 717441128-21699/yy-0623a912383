import { useState, useEffect } from 'react';
import type { BatchDetail, BatchStatus } from '../types';

interface Props {
  batchId: number;
  onClose: () => void;
}

const STATUS_CLASS: Record<BatchStatus, string> = {
  '待取样': 'status-pending',
  '已取样待送检': 'status-sampled',
  '已送检待报告': 'status-sent',
  '可用': 'status-ok',
  '待处置': 'status-todo',
  '禁止使用': 'status-bad',
};

const TIMELINE_STEPS = [
  { key: 'entry', label: '进场登记', desc: '批次信息录入' },
  { key: 'sampling', label: '现场取样', desc: '试验员完成取样、封样' },
  { key: 'sent', label: '送检', desc: '样品送检测机构' },
  { key: 'report', label: '报告回填', desc: '检测报告返回' },
];

export default function BatchDetailModal({ batchId, onClose }: Props) {
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await window.api.batch.getDetail(batchId);
        setDetail(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [batchId]);

  if (loading) {
    return (
      <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-box">
          <div className="modal-body" style={{ textAlign: 'center', padding: '40px' }}>
            加载中...
          </div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-box">
          <div className="modal-body" style={{ textAlign: 'center', padding: '40px' }}>
            未找到该批次信息
          </div>
          <div className="modal-footer">
            <button className="btn btn-default" onClick={onClose}>关闭</button>
          </div>
        </div>
      </div>
    );
  }

  const { batch, samplings, reports } = detail;

  const getStepStatus = (key: string) => {
    if (key === 'entry') return 'done';
    if (key === 'sampling') return samplings.length > 0 ? 'done' : 'pending';
    if (key === 'sent') return samplings.some(s => s.is_sent === 1) ? 'done' : 'pending';
    if (key === 'report') return reports.length > 0 ? 'done' : 'pending';
    return 'pending';
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ width: '880px', maxWidth: '95vw' }}>
        <div className="modal-header">
          <div className="modal-title">
            批次详情 — {batch.batch_no}
            <span className={`status-tag ${STATUS_CLASS[batch.status]}`} style={{ marginLeft: '10px' }}>
              {batch.status}
            </span>
          </div>
          <span className="modal-close" onClick={onClose}>×</span>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '16px 0',
            marginBottom: '18px',
            borderBottom: '1px solid #ebeef5',
          }}>
            {TIMELINE_STEPS.map((step, i) => {
              const status = getStepStatus(step.key);
              return (
                <div key={step.key} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    margin: '0 auto 6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: '13px',
                    background: status === 'done' ? '#67c23a' : '#dcdfe6',
                    color: '#fff',
                  }}>
                    {status === 'done' ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: status === 'done' ? '#303133' : '#909399' }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#909399', marginTop: '2px' }}>
                    {step.desc}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="panel" style={{ marginBottom: '16px' }}>
            <div className="panel-header" style={{ padding: '10px 16px', background: '#f5f7fa' }}>
              <div className="panel-title" style={{ fontSize: '14px' }}>① 进场信息</div>
            </div>
            <div className="panel-body" style={{ padding: '14px 16px' }}>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <div className="form-item" style={{ minWidth: '140px' }}>
                  <label style={{ color: '#909399', fontSize: '12px' }}>材料类型</label>
                  <div style={{ fontWeight: 600 }}>{batch.material_type}</div>
                </div>
                <div className="form-item" style={{ minWidth: '140px' }}>
                  <label style={{ color: '#909399', fontSize: '12px' }}>批次编号</label>
                  <div style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>{batch.batch_no}</div>
                </div>
                <div className="form-item" style={{ minWidth: '100px' }}>
                  <label style={{ color: '#909399', fontSize: '12px' }}>进场数量</label>
                  <div>{batch.quantity}</div>
                </div>
                <div className="form-item" style={{ minWidth: '140px' }}>
                  <label style={{ color: '#909399', fontSize: '12px' }}>炉批号</label>
                  <div style={{ fontFamily: 'Consolas, monospace' }}>{batch.furnace_no || '-'}</div>
                </div>
                <div className="form-item" style={{ minWidth: '100px' }}>
                  <label style={{ color: '#909399', fontSize: '12px' }}>代表数量</label>
                  <div>{batch.represent_quantity}</div>
                </div>
                <div className="form-item" style={{ minWidth: '120px' }}>
                  <label style={{ color: '#909399', fontSize: '12px' }}>进场日期</label>
                  <div>{batch.entry_date}</div>
                </div>
                <div className="form-item" style={{ minWidth: '200px', flex: 2 }}>
                  <label style={{ color: '#909399', fontSize: '12px' }}>取样部位</label>
                  <div>{batch.sampling_location}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: '16px' }}>
            <div className="panel-header" style={{ padding: '10px 16px', background: '#f5f7fa' }}>
              <div className="panel-title" style={{ fontSize: '14px' }}>
                ② 取样记录 <span style={{ fontSize: '12px', fontWeight: 400, color: '#909399' }}>（共 {samplings.length} 次）</span>
              </div>
            </div>
            <div className="panel-body" style={{ padding: '14px 16px' }}>
              {samplings.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px' }}>尚未取样</div>
              ) : (
                samplings.map((s, idx) => (
                  <div key={s.id} style={{
                    padding: '12px',
                    border: '1px solid #ebeef5',
                    borderRadius: '3px',
                    marginBottom: idx < samplings.length - 1 ? '10px' : 0,
                    background: idx % 2 === 0 ? '#fafbfc' : '#fff',
                  }}>
                    <div className="form-row" style={{ marginBottom: '10px' }}>
                      <div className="form-item" style={{ minWidth: '140px' }}>
                        <label style={{ color: '#909399', fontSize: '12px' }}>样品编号</label>
                        <div style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>{s.sample_no}</div>
                      </div>
                      <div className="form-item" style={{ minWidth: '120px' }}>
                        <label style={{ color: '#909399', fontSize: '12px' }}>取样日期</label>
                        <div>{s.sampling_date}</div>
                      </div>
                      <div className="form-item" style={{ minWidth: '120px' }}>
                        <label style={{ color: '#909399', fontSize: '12px' }}>见证监理</label>
                        <div>{s.witness_supervisor}</div>
                      </div>
                      <div className="form-item" style={{ minWidth: '180px' }}>
                        <label style={{ color: '#909399', fontSize: '12px' }}>检测机构</label>
                        <div>{s.testing_agency}</div>
                      </div>
                      <div className="form-item" style={{ minWidth: '120px' }}>
                        <label style={{ color: '#909399', fontSize: '12px' }}>送检时限</label>
                        <div>{s.deadline_date}</div>
                      </div>
                      <div className="form-item" style={{ minWidth: '100px' }}>
                        <label style={{ color: '#909399', fontSize: '12px' }}>送检状态</label>
                        <div>
                          {s.is_sent === 1 ? (
                            <span className="status-tag status-sent">已送检 · {s.sent_date}</span>
                          ) : (
                            <span className="status-tag status-sampled">待送检</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {s.sealing_photo_data && (
                      <div>
                        <label style={{ color: '#909399', fontSize: '12px', display: 'block', marginBottom: '4px' }}>封样照片</label>
                        <img
                          src={s.sealing_photo_data}
                          alt="封样照片"
                          style={{
                            width: '100px',
                            height: '100px',
                            objectFit: 'cover',
                            border: '1px solid #dcdfe6',
                            borderRadius: '3px',
                            cursor: 'pointer',
                          }}
                          onClick={() => setPhotoPreview(s.sealing_photo_data!)}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header" style={{ padding: '10px 16px', background: '#f5f7fa' }}>
              <div className="panel-title" style={{ fontSize: '14px' }}>
                ③ 检测报告 <span style={{ fontSize: '12px', fontWeight: 400, color: '#909399' }}>（共 {reports.length} 份）</span>
              </div>
            </div>
            <div className="panel-body" style={{ padding: '14px 16px' }}>
              {reports.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px' }}>暂无报告</div>
              ) : (
                reports.map((r, idx) => (
                  <div key={r.id} style={{
                    padding: '12px',
                    border: '1px solid #ebeef5',
                    borderRadius: '3px',
                    marginBottom: idx < reports.length - 1 ? '10px' : 0,
                    background: idx % 2 === 0 ? '#fafbfc' : '#fff',
                  }}>
                    <div className="form-row" style={{ marginBottom: 0 }}>
                      <div className="form-item" style={{ minWidth: '180px' }}>
                        <label style={{ color: '#909399', fontSize: '12px' }}>报告编号</label>
                        <div style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>{r.report_no}</div>
                      </div>
                      <div className="form-item" style={{ minWidth: '120px' }}>
                        <label style={{ color: '#909399', fontSize: '12px' }}>报告日期</label>
                        <div>{r.report_date}</div>
                      </div>
                      <div className="form-item" style={{ minWidth: '100px' }}>
                        <label style={{ color: '#909399', fontSize: '12px' }}>检测结论</label>
                        <div>
                          <span className={`status-tag ${r.conclusion === '合格' ? 'status-ok' : 'status-bad'}`}>
                            {r.conclusion}
                          </span>
                        </div>
                      </div>
                      {r.unqualified_items && (
                        <div className="form-item" style={{ flex: 2, minWidth: '200px' }}>
                          <label style={{ color: '#909399', fontSize: '12px' }}>不合格项</label>
                          <div style={{ color: '#f56c6c' }}>{r.unqualified_items}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-default" onClick={onClose}>关闭</button>
        </div>
      </div>

      {photoPreview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            cursor: 'zoom-out',
          }}
          onClick={() => setPhotoPreview(null)}
        >
          <img src={photoPreview} alt="封样照片大图" style={{ maxWidth: '90%', maxHeight: '90%' }} />
        </div>
      )}
    </div>
  );
}
