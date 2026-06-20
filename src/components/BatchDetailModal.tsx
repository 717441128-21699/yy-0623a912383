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
  '已放行': 'status-ok',
  '已降级使用': 'status-ok',
  '已退场': 'status-ok',
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

  const { batch, samplings, reports, logs, disposals } = detail;

  const getStepStatus = (key: string) => {
    if (key === 'entry') return 'done';
    if (key === 'sampling') return samplings.length > 0 ? 'done' : 'pending';
    if (key === 'sent') return samplings.some(s => s.is_sent === 1) ? 'done' : 'pending';
    if (key === 'report') return reports.length > 0 ? 'done' : 'pending';
    return 'pending';
  };

  const abnormal = batch.status === '待处置' || batch.status === '禁止使用';

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ width: '920px', maxWidth: '95vw' }}>
        <div className="modal-header">
          <div className="modal-title">
            批次详情 — {batch.batch_no}
            <span className={`status-tag ${STATUS_CLASS[batch.status]}`} style={{ marginLeft: '10px' }}>
              {batch.status}
            </span>
          </div>
          <span className="modal-close" onClick={onClose}>×</span>
        </div>
        <div className="modal-body" style={{ maxHeight: '75vh' }}>

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

          <div className="detail-section">
            <div className="detail-section-title">① 进场信息</div>
            <div className="info-grid">
              <div><span className="label">材料类型：</span><span className="value">{batch.material_type}</span></div>
              <div><span className="label">批次编号：</span><span className="value">{batch.batch_no}</span></div>
              <div><span className="label">进场数量：</span><span className="value">{batch.quantity}</span></div>
              <div><span className="label">炉批号：</span><span className="value">{batch.furnace_no || '-'}</span></div>
              <div><span className="label">代表数量：</span><span className="value">{batch.represent_quantity}</span></div>
              <div><span className="label">进场日期：</span><span className="value">{batch.entry_date}</span></div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span className="label">取样部位：</span><span className="value">{batch.sampling_location}</span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-section-title">
              ② 取样记录 <span style={{ fontSize: '12px', fontWeight: 400, color: '#909399' }}>（共 {samplings.length} 次）</span>
            </div>
            {samplings.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px' }}>尚未取样</div>
            ) : (
              samplings.map((s, idx) => (
                <div key={s.id} className="detail-card">
                  <div className="detail-card-head">
                    <div className="detail-card-title">第 {idx + 1} 次取样 · 样品 {s.sample_no}</div>
                    {s.is_sent === 1 ? (
                      <span className="status-tag status-sent">已送检 · {s.sent_date}</span>
                    ) : (
                      <span className="status-tag status-sampled">待送检</span>
                    )}
                  </div>
                  <div className="info-grid">
                    <div><span className="label">取样日期：</span><span className="value">{s.sampling_date}</span></div>
                    <div><span className="label">见证监理：</span><span className="value">{s.witness_supervisor}</span></div>
                    <div><span className="label">检测机构：</span><span className="value">{s.testing_agency}</span></div>
                    <div><span className="label">送检时限：</span><span className="value">{s.deadline_date}</span></div>
                  </div>
                  {s.sealing_photo_data && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#909399', marginBottom: '4px' }}>封样照片（点击放大）</div>
                      <div className="sealing-photo-grid">
                        <div
                          className="sealing-photo-thumb"
                          onClick={() => setPhotoPreview(s.sealing_photo_data!)}
                        >
                          <img src={s.sealing_photo_data} alt="封样照片" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="detail-section">
            <div className="detail-section-title">
              ③ 检测报告 <span style={{ fontSize: '12px', fontWeight: 400, color: '#909399' }}>（共 {reports.length} 份）</span>
            </div>
            {reports.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px' }}>暂无报告</div>
            ) : (
              reports.map(r => (
                <div key={r.id} className="detail-card">
                  <div className="detail-card-head">
                    <div className="detail-card-title">{r.report_no}</div>
                    <span className={`status-tag ${r.conclusion === '合格' ? 'status-ok' : 'status-bad'}`}>
                      {r.conclusion}
                    </span>
                  </div>
                  <div className="info-grid">
                    <div><span className="label">报告日期：</span><span className="value">{r.report_date}</span></div>
                    {r.unqualified_items && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span className="label">不合格项：</span>
                        <span className="value" style={{ color: '#f56c6c' }}>{r.unqualified_items}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {abnormal && (
            <div className="detail-section">
              <div className="detail-section-title">
                ④ 异常处置闭环
              </div>
              {disposals.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px' }}>尚未登记处置意见，请前往「异常处置」页处理</div>
              ) : (
                disposals.map(d => (
                  <div key={d.id} className="detail-card">
                    <div className="detail-card-head">
                      <div className="detail-card-title">
                        处置登记 · {d.disposal_date}
                        {d.final_result ? (
                          <span className="sub-tag tag-ok" style={{ marginLeft: '8px' }}>已闭环</span>
                        ) : (
                          <span className="sub-tag tag-warn" style={{ marginLeft: '8px' }}>处置中</span>
                        )}
                      </div>
                    </div>
                    <div className="info-grid">
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span className="label">处置意见：</span><span className="value">{d.disposal_opinion}</span>
                      </div>
                      {d.retest_plan && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span className="label">复检安排：</span><span className="value">{d.retest_plan}</span>
                        </div>
                      )}
                      {(d.retest_sample_no || d.retest_report_no) && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span className="label">复检结果：</span>
                          <span className="value">
                            {d.retest_sample_no && `样品 ${d.retest_sample_no}`}
                            {d.retest_testing_agency && ` / ${d.retest_testing_agency}`}
                            {d.retest_report_no && ` / 报告 ${d.retest_report_no}`}
                            {d.retest_conclusion && ` / 结论：${d.retest_conclusion}`}
                            {d.retest_date && ` / ${d.retest_date}`}
                          </span>
                        </div>
                      )}
                      {d.final_result && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span className="label">最终处理结果：</span><span className="value">{d.final_result}</span>
                        </div>
                      )}
                      {d.final_date && (
                        <div><span className="label">闭环日期：</span><span className="value">{d.final_date}</span></div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="detail-section">
            <div className="detail-section-title">
              {abnormal ? '⑤' : '④'} 操作时间线
            </div>
            {logs.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px' }}>暂无操作记录</div>
            ) : (
              <div className="timeline">
                {logs.map(log => {
                  const isAbnormal = log.action.includes('异常') || log.action.includes('不合格');
                  const isWarn = log.action.includes('送检') || log.action.includes('处置');
                  const cls = isAbnormal ? 'bad' : (isWarn ? 'warn' : 'done');
                  return (
                    <div key={log.id} className={`timeline-item ${cls}`}>
                      <div className="timeline-time">{log.created_at}</div>
                      <div className="timeline-action">{log.action}</div>
                      {log.operator && <div className="timeline-desc">经办人：{log.operator}</div>}
                      {log.description && <div className="timeline-desc">{log.description}</div>}
                    </div>
                  );
                })}
              </div>
            )}
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
