import { useState, useEffect } from 'react';
import SamplingTaskPanel from './components/SamplingTaskPanel';
import InspectionPanel from './components/InspectionPanel';
import ReportPanel from './components/ReportPanel';
import type { Batch, Sampling, Report } from './types';

type TabKey = 'task' | 'inspection' | 'report';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('task');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [pendingSamplings, setPendingSamplings] = useState<Sampling[]>([]);
  const [overdueSamplings, setOverdueSamplings] = useState<Sampling[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

  const refreshData = async () => {
    try {
      const [b, ps, os, r] = await Promise.all([
        window.api.batch.getAll(),
        window.api.sampling.getPendingSend(),
        window.api.sampling.getOverdue(),
        window.api.report.getAll(),
      ]);
      setBatches(b);
      setPendingSamplings(ps);
      setOverdueSamplings(os);
      setReports(r);
    } catch (e) {
      console.error('刷新数据失败:', e);
    }
  };

  useEffect(() => {
    refreshData();
    const timer = setInterval(refreshData, 30000);
    return () => clearInterval(timer);
  }, []);

  const stats = [
    { label: '待取样', value: batches.filter(b => b.status === '待取样').length, cls: 'c1' },
    { label: '已取未送', value: pendingSamplings.length, cls: 'c2' },
    { label: '已送检待报告', value: batches.filter(b => b.status === '已送检待报告').length, cls: 'c3' },
    { label: '合格可用', value: batches.filter(b => b.status === '可用').length, cls: 'c4' },
    { label: '待处置', value: batches.filter(b => b.status === '待处置').length, cls: 'c5' },
    { label: '禁止使用', value: batches.filter(b => b.status === '禁止使用').length, cls: 'c6' },
  ];

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1>材料进场复检送样管理系统</h1>
          <div className="subtitle">见证取样资料管理 · 试验员 / 资料员工作台</div>
        </div>
        <div style={{ fontSize: '12px', opacity: 0.8 }}>
          今日：{new Date().toLocaleDateString('zh-CN')}
        </div>
      </header>

      <nav className="tab-nav">
        <div
          className={`tab-item ${activeTab === 'task' ? 'active' : ''}`}
          onClick={() => setActiveTab('task')}
        >
          取样任务
          {batches.filter(b => b.status === '待取样').length > 0 && (
            <span className="badge">{batches.filter(b => b.status === '待取样').length}</span>
          )}
        </div>
        <div
          className={`tab-item ${activeTab === 'inspection' ? 'active' : ''}`}
          onClick={() => setActiveTab('inspection')}
        >
          送检登记
          {overdueSamplings.length > 0 && (
            <span className="badge">{overdueSamplings.length}</span>
          )}
        </div>
        <div
          className={`tab-item ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          报告回填
        </div>
      </nav>

      <div className="tab-content">
        <div className="stat-cards">
          {stats.map((s, i) => (
            <div key={i} className={`stat-card ${s.cls}`}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          ))}
        </div>

        {activeTab === 'task' && <SamplingTaskPanel onDataChange={refreshData} />}
        {activeTab === 'inspection' && <InspectionPanel onDataChange={refreshData} />}
        {activeTab === 'report' && <ReportPanel onDataChange={refreshData} />}
      </div>
    </div>
  );
}
