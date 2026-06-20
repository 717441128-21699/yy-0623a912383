import { useState, useEffect } from 'react';
import type { MonthlySummaryItem, MaterialType, TransferDocItem } from '../types';

interface Props {
  onBack: () => void;
  onViewBatchDetail: (batchId: number) => void;
}

const MATERIAL_TYPES: MaterialType[] = ['钢筋原材', '混凝土试块', '防水材料'];

type SubView = 'summary' | 'transfer';

export default function MonthlyArchiveView({ onBack, onViewBatchDetail }: Props) {
  const [subView, setSubView] = useState<SubView>('summary');
  const [summary, setSummary] = useState<MonthlySummaryItem[]>([]);
  const [transferList, setTransferList] = useState<TransferDocItem[]>([]);
  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const loadSummary = async () => {
    try {
      const data = await window.api.batch.getMonthlySummary(selectedMonth);
      setSummary(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadTransfer = async () => {
    try {
      const data = await window.api.batch.getTransferList(selectedMonth);
      setTransferList(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (subView === 'summary') loadSummary();
    else loadTransfer();
  }, [selectedMonth, subView]);

  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const groupedByMonth: Record<string, MonthlySummaryItem[]> = {};
  summary.forEach(item => {
    if (!groupedByMonth[item.month]) groupedByMonth[item.month] = [];
    groupedByMonth[item.month].push(item);
  });

  const monthTotals = Object.entries(groupedByMonth).map(([month, items]) => {
    return {
      month,
      total: items.reduce((s, i) => s + i.total_count, 0),
      sampled: items.reduce((s, i) => s + i.sampled_count, 0),
      sent: items.reduce((s, i) => s + i.sent_count, 0),
      reported: items.reduce((s, i) => s + i.reported_count, 0),
      abnormal: items.reduce((s, i) => s + i.abnormal_count, 0),
      items,
    };
  });

  const grandTotal = {
    total: summary.reduce((s, i) => s + i.total_count, 0),
    sampled: summary.reduce((s, i) => s + i.sampled_count, 0),
    sent: summary.reduce((s, i) => s + i.sent_count, 0),
    reported: summary.reduce((s, i) => s + i.reported_count, 0),
    abnormal: summary.reduce((s, i) => s + i.abnormal_count, 0),
  };

  const handleExportSummary = async () => {
    const headers = ['月份', '材料类型', '进场批次数', '已取样', '已送检', '已回报告', '异常批次数'];
    const rows = summary.map(i => [
      i.month, i.material_type, i.total_count, i.sampled_count,
      i.sent_count, i.reported_count, i.abnormal_count
    ]);
    if (monthTotals.length > 0) {
      rows.push(['合计', '', grandTotal.total, grandTotal.sampled, grandTotal.sent, grandTotal.reported, grandTotal.abnormal]);
    }
    const csv = [headers, ...rows].map(row =>
      row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')
    ).join('\r\n');
    const content = '\ufeff' + csv;
    const defaultName = `月度归档汇总_${selectedMonth || '全部'}.csv`;
    const saved = await window.api.export.saveCsv(defaultName, content);
    if (saved) alert(`已导出到：${saved}`);
  };

  const handleExportTransfer = async () => {
    const content = await window.api.export.transferCsv(selectedMonth);
    const defaultName = `资料移交清单_${selectedMonth}.csv`;
    const saved = await window.api.export.saveCsv(defaultName, content);
    if (saved) alert(`已导出到：${saved}`);
  };

  const transferStats = {
    total: transferList.length,
    complete: transferList.filter(b => b.complete).length,
    incomplete: transferList.filter(b => !b.complete).length,
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button className="btn btn-default btn-sm" onClick={onBack}>← 返回批次列表</button>
            <div className="view-switch">
              <button
                className={`btn ${subView === 'summary' ? 'btn-primary' : 'btn-default'} btn-sm`}
                onClick={() => setSubView('summary')}
              >
                月度汇总
              </button>
              <button
                className={`btn ${subView === 'transfer' ? 'btn-primary' : 'btn-default'} btn-sm`}
                onClick={() => setSubView('transfer')}
              >
                资料移交清单
              </button>
            </div>
            <div className="filter-item" style={{ marginLeft: '16px' }}>
              <label style={{ color: '#606266' }}>月份：</label>
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                {months.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-default btn-sm" onClick={subView === 'summary' ? handleExportSummary : handleExportTransfer}>
            {subView === 'summary' ? '导出汇总表' : '导出移交清单'}
          </button>
        </div>
        <div className="panel-body">

          {subView === 'summary' && (
            <>
              {summary.length === 0 ? (
                <div className="empty-state">当前月份无数据</div>
              ) : (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '12px',
                    marginBottom: '18px',
                  }}>
                    <div className="stat-card c1">
                      <div className="stat-label">进场批次数</div>
                      <div className="stat-value">{grandTotal.total}</div>
                    </div>
                    <div className="stat-card c2">
                      <div className="stat-label">已取样</div>
                      <div className="stat-value">{grandTotal.sampled}</div>
                    </div>
                    <div className="stat-card c3">
                      <div className="stat-label">已送检</div>
                      <div className="stat-value">{grandTotal.sent}</div>
                    </div>
                    <div className="stat-card c4">
                      <div className="stat-label">已回报告</div>
                      <div className="stat-value">{grandTotal.reported}</div>
                    </div>
                    <div className="stat-card c6">
                      <div className="stat-label">异常批次</div>
                      <div className="stat-value">{grandTotal.abnormal}</div>
                    </div>
                  </div>

                  {monthTotals.map(mt => (
                    <div key={mt.month} style={{ marginBottom: '20px' }}>
                      <div style={{
                        padding: '10px 14px',
                        background: '#f5f7fa',
                        borderLeft: '4px solid #2c5282',
                        fontSize: '14px',
                        fontWeight: 600,
                        marginBottom: '10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span>{mt.month}</span>
                        <span style={{ fontSize: '12px', fontWeight: 400, color: '#909399' }}>
                          进场 {mt.total} 批 · 已取样 {mt.sampled} · 已送检 {mt.sent} · 已回报告 {mt.reported} · 异常 {mt.abnormal}
                        </span>
                      </div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>材料类型</th>
                            <th style={{ textAlign: 'right' }}>进场批次数</th>
                            <th style={{ textAlign: 'right' }}>已取样</th>
                            <th style={{ textAlign: 'right' }}>已送检</th>
                            <th style={{ textAlign: 'right' }}>已回报告</th>
                            <th style={{ textAlign: 'right' }}>异常批次数</th>
                            <th style={{ textAlign: 'right' }}>完成率</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MATERIAL_TYPES.map(type => {
                            const item = mt.items.find(i => i.material_type === type);
                            const total = item?.total_count || 0;
                            const reported = item?.reported_count || 0;
                            const rate = total > 0 ? Math.round((reported / total) * 100) : 0;
                            return (
                              <tr key={type}>
                                <td>{type}</td>
                                <td style={{ textAlign: 'right' }}>{item?.total_count || 0}</td>
                                <td style={{ textAlign: 'right' }}>
                                  {item?.sampled_count || 0}
                                  {item && item.sampled_count < item.total_count && (
                                    <span style={{ color: '#e6a23c', marginLeft: '4px', fontSize: '11px' }}>
                                      ▲{item.total_count - item.sampled_count}
                                    </span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>{item?.sent_count || 0}</td>
                                <td style={{ textAlign: 'right' }}>{item?.reported_count || 0}</td>
                                <td style={{ textAlign: 'right' }}>
                                  {(item?.abnormal_count || 0) > 0 ? (
                                    <span style={{ color: '#f56c6c', fontWeight: 600 }}>
                                      {item?.abnormal_count || 0}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#909399' }}>0</span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{
                                    display: 'inline-block',
                                    width: '100px',
                                    height: '8px',
                                    background: '#ebeef5',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    marginRight: '6px',
                                    verticalAlign: 'middle',
                                  }}>
                                    <div style={{
                                      height: '100%',
                                      background: rate >= 100 ? '#67c23a' : '#2c5282',
                                      width: `${rate}%`,
                                    }} />
                                  </div>
                                  <span style={{ fontSize: '12px', color: '#606266' }}>{rate}%</span>
                                </td>
                              </tr>
                            );
                          })}
                          <tr style={{ background: '#f5f7fa', fontWeight: 600 }}>
                            <td>本月合计</td>
                            <td style={{ textAlign: 'right' }}>{mt.total}</td>
                            <td style={{ textAlign: 'right' }}>{mt.sampled}</td>
                            <td style={{ textAlign: 'right' }}>{mt.sent}</td>
                            <td style={{ textAlign: 'right' }}>{mt.reported}</td>
                            <td style={{ textAlign: 'right' }}>
                              {mt.abnormal > 0 ? (
                                <span style={{ color: '#f56c6c' }}>{mt.abnormal}</span>
                              ) : (
                                '0'
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {mt.total > 0 ? Math.round((mt.reported / mt.total) * 100) : 0}%
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ))}

                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: '#fafbfc',
                    border: '1px dashed #dcdfe6',
                    borderRadius: '3px',
                    fontSize: '12px',
                    color: '#606266',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>月末归档核对说明：</div>
                    <div>1. 进场批次数 = 本月该类型材料所有进场批次</div>
                    <div>2. 已取样 = 已完成现场取样并登记</div>
                    <div>3. 已送检 = 样品已送检测机构</div>
                    <div>4. 已回报告 = 检测报告已返回并录入</div>
                    <div>5. 异常批次 = 结论不合格，需人工处置或禁止使用</div>
                  </div>
                </>
              )}
            </>
          )}

          {subView === 'transfer' && (
            <>
              {transferList.length === 0 ? (
                <div className="empty-state">当前月份无数据</div>
              ) : (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    marginBottom: '18px',
                  }}>
                    <div className="stat-card c3">
                      <div className="stat-label">本月批次总数</div>
                      <div className="stat-value">{transferStats.total}</div>
                    </div>
                    <div className="stat-card c4">
                      <div className="stat-label">资料齐全</div>
                      <div className="stat-value">{transferStats.complete}</div>
                    </div>
                    <div className="stat-card c6">
                      <div className="stat-label">资料缺项</div>
                      <div className="stat-value">{transferStats.incomplete}</div>
                    </div>
                  </div>

                  {transferList.map(b => {
                    const isExpanded = expandedBatchId === b.batch_id;
                    const maxRows = Math.max(b.samplings.length, b.reports.length, b.disposals.length, 1);
                    const showDisposal = b.status === '待处置' || b.status === '禁止使用';
                    return (
                      <div key={b.batch_id} style={{ marginBottom: '8px', border: '1px solid #ebeef5', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 14px',
                            background: isExpanded ? '#f5f7fa' : '#fff',
                            cursor: 'pointer',
                            gap: '12px',
                          }}
                          onClick={() => setExpandedBatchId(isExpanded ? null : b.batch_id)}
                        >
                          <span style={{ fontSize: '12px', color: '#909399', width: '16px', textAlign: 'center' }}>
                            {isExpanded ? '▼' : '▶'}
                          </span>
                          <span style={{ minWidth: '80px' }}>{b.material_type}</span>
                          <span style={{ minWidth: '120px', fontWeight: 500 }}>{b.batch_no}</span>
                          <span style={{ minWidth: '90px', color: '#909399', fontSize: '12px' }}>{b.entry_date}</span>
                          <span className={`status-tag ${
                            b.status === '可用' ? 'status-ok' :
                            b.status === '禁止使用' ? 'status-bad' :
                            b.status === '待处置' ? 'status-todo' :
                            b.status === '已送检待报告' ? 'status-sent' : 'status-sampled'
                          }`}>
                            {b.status}
                          </span>
                          {b.complete ? (
                            <span className="sub-tag tag-ok">齐全</span>
                          ) : (
                            <span className="sub-tag tag-miss">缺项</span>
                          )}
                        </div>
                        {isExpanded && (
                          <div style={{ padding: '12px 14px', borderTop: '1px solid #ebeef5' }}>
                            <div style={{ display: 'flex', gap: '24px', marginBottom: '12px', fontSize: '13px', color: '#606266', flexWrap: 'wrap' }}>
                              <span>进场数量：<b>{b.quantity}</b></span>
                              {b.furnace_no && <span>炉批号：<b>{b.furnace_no}</b></span>}
                              <span>代表数量：<b>{b.represent_quantity}</b></span>
                              <span>取样部位：<b>{b.sampling_location}</b></span>
                              <span>进场记录：{b.has_entry ? <span className="sub-tag tag-ok">有</span> : <span className="sub-tag tag-miss">缺</span>}</span>
                              <span>封样照片：{b.has_sealing_photo ? <span className="sub-tag tag-ok">有</span> : <span className="sub-tag tag-miss">缺</span>}</span>
                            </div>
                            <table className="data-table" style={{ fontSize: '12px' }}>
                              <thead>
                                <tr>
                                  <th rowSpan={2} style={{ width: '30px' }}>#</th>
                                  <th colSpan={5} style={{ textAlign: 'center', background: '#ecf5ff' }}>取样信息</th>
                                  <th colSpan={4} style={{ textAlign: 'center', background: '#f0f9eb' }}>报告信息</th>
                                  {showDisposal && <th colSpan={7} style={{ textAlign: 'center', background: '#fef0f0' }}>处置信息</th>}
                                </tr>
                                <tr>
                                  <th>样品编号</th>
                                  <th>取样日期</th>
                                  <th>封样照片</th>
                                  <th>送检日期</th>
                                  <th>检测机构</th>
                                  <th>报告编号</th>
                                  <th>报告日期</th>
                                  <th>检测结论</th>
                                  <th>不合格项</th>
                                  {showDisposal && (
                                    <>
                                      <th>处置意见</th>
                                      <th>复检安排</th>
                                      <th>复检样品</th>
                                      <th>复检报告</th>
                                      <th>复检结论</th>
                                      <th>最终结果</th>
                                      <th>闭环日期</th>
                                    </>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {Array.from({ length: maxRows }, (_, i) => {
                                  const s = b.samplings[i];
                                  const r = b.reports[i];
                                  const d = showDisposal ? b.disposals[i] : undefined;
                                  return (
                                    <tr key={i}>
                                      <td style={{ textAlign: 'center', color: '#909399' }}>{i + 1}</td>
                                      <td>{s?.sample_no ?? ''}</td>
                                      <td>{s?.sampling_date ?? ''}</td>
                                      <td>{s ? (s.has_photo ? <span className="sub-tag tag-ok">有</span> : <span className="sub-tag tag-miss">缺</span>) : ''}</td>
                                      <td>{s ? (s.is_sent ? (s.sent_date || '已送') : <span className="sub-tag tag-miss">未送</span>) : ''}</td>
                                      <td>{s?.testing_agency ?? ''}</td>
                                      <td>{r?.report_no ?? ''}</td>
                                      <td>{r?.report_date ?? ''}</td>
                                      <td>{r ? (r.conclusion === '合格' ? <span className="sub-tag tag-ok">合格</span> : <span className="sub-tag tag-miss">不合格</span>) : ''}</td>
                                      <td>{r?.unqualified_items ?? ''}</td>
                                      {showDisposal && (
                                        <>
                                          <td>{d?.disposal_opinion ?? ''}</td>
                                          <td>{d?.retest_plan ?? ''}</td>
                                          <td>{d?.retest_sample_no ?? ''}</td>
                                          <td>{d?.retest_report_no ?? ''}</td>
                                          <td>{d?.retest_conclusion ?? ''}</td>
                                          <td>{d?.final_result ?? ''}</td>
                                          <td>{d?.final_date ?? ''}</td>
                                        </>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div style={{
                    marginTop: '14px',
                    padding: '12px',
                    background: '#fafbfc',
                    border: '1px dashed #dcdfe6',
                    borderRadius: '3px',
                    fontSize: '12px',
                    color: '#606266',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>资料齐全判定规则：</div>
                    <div>· 正常批次：有进场记录 + 已取样 + 有封样照片 + 已送检 + 有检测报告</div>
                    <div>· 异常批次（待处置/禁止使用）：在上述基础上，还需有处置记录</div>
                  </div>
                </>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
