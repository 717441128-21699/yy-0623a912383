import { useState, useEffect } from 'react';
import type { MonthlySummaryItem, MaterialType } from '../types';

interface Props {
  onBack: () => void;
  onViewBatchDetail: (batchId: number) => void;
}

const MATERIAL_TYPES: MaterialType[] = ['钢筋原材', '混凝土试块', '防水材料'];

export default function MonthlyArchiveView({ onBack, onViewBatchDetail }: Props) {
  const [summary, setSummary] = useState<MonthlySummaryItem[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const loadData = async () => {
    try {
      const data = await window.api.batch.getMonthlySummary(selectedMonth);
      setSummary(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

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

  const handleExport = async () => {
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

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button className="btn btn-default btn-sm" onClick={onBack}>← 返回批次列表</button>
            <div className="panel-title">月度归档视图</div>
            <div className="filter-item" style={{ marginLeft: '16px' }}>
              <label style={{ color: '#606266' }}>月份：</label>
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                <option value="">全部月份</option>
                {months.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-default btn-sm" onClick={handleExport}>导出汇总表</button>
        </div>
        <div className="panel-body">
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
                <div>2. 已取样 = 已完成现场取样并登记（状态：已取样待送检及后续）</div>
                <div>3. 已送检 = 样品已送检测机构（状态：已送检待报告及后续）</div>
                <div>4. 已回报告 = 检测报告已返回并录入（状态：可用、待处置、禁止使用）</div>
                <div>5. 异常批次 = 结论不合格，需人工处置或禁止使用</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
