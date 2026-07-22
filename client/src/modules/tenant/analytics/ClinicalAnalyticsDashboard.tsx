import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  AlertTriangle,
  Activity,
  Calendar,
  ChevronRight,
  Target
} from 'lucide-react';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';
import { API_BASE_URL as API_BASE } from "../../../config/api";

export default function ClinicalAnalyticsDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { 
          Authorization: `Bearer ${localStorage.getItem("token")}`, 
          "x-tenant-id": localStorage.getItem("tenant") || "" 
        };
        const res = await axios.get(`${API_BASE}/api/hospital/metrics/clinical-command-overview`, { headers });
        setData(res.data);
      } catch (err) {
        console.error("Failed to fetch live analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: 'var(--app-bg)', fontSize: '18px', fontWeight: 800, color: '#4f46e5' }}>Synchronizing Live Clinical Intelligence...</div>;
  
  const metrics = data?.metrics || { consultations: 0, waitTime: 0, emergencies: 0, revenue: 0 };

  // 1. Patient Volume Trend (Line Chart)
  const patientVolumeOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data?.inflowTrend?.map((i: any) => i.time) || [],
      axisLine: { lineStyle: { color: '#94a3b8' } }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } }
    },
    series: [{
      name: 'Patients',
      type: 'line',
      smooth: true,
      data: data?.inflowTrend?.map((i: any) => i.count) || [],
      lineStyle: { width: 4, color: '#4f46e5' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(79, 70, 229, 0.2)' }, { offset: 1, color: 'rgba(79, 70, 229, 0)' }]
        }
      },
      itemStyle: { color: '#4f46e5' }
    }]
  };

  // 2. Physician Delay Analysis (Bar Chart)
  const delayAnalysisOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'value',
      splitLine: { show: false }
    },
    yAxis: {
      type: 'category',
      data: data?.delayIndex?.map((d: any) => d.name) || [],
      axisLine: { show: false }
    },
    series: [{
      name: 'Avg Delay (mins)',
      type: 'bar',
      data: data?.delayIndex?.map((d: any) => d.value) || [],
      itemStyle: {
        color: (params: any) => {
          const colors = ['#0ea5e9', '#ef4444', '#10b981', '#f59e0b', '#6366f1'];
          return colors[params.dataIndex % colors.length];
        },
        borderRadius: [0, 8, 8, 0]
      },
      barWidth: '40%'
    }]
  };

  // 3. Resource Utilization (Gauge)
  const utilizationPercent = Math.round(((data?.capacity?.occupied || 0) / (data?.capacity?.total || 1)) * 100);
  const utilizationOption = {
    series: [{
      type: 'gauge',
      startAngle: 180,
      endAngle: 0,
      center: ['50%', '75%'],
      radius: '90%',
      min: 0,
      max: 100,
      splitNumber: 8,
      axisLine: {
        lineStyle: {
          width: 6,
          color: [[0.25, '#FF6E76'], [0.5, '#FDDD60'], [0.75, '#58D9F9'], [1, '#7CFFB2']]
        }
      },
      pointer: { icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z', length: '12%', width: 20, offsetCenter: [0, '-60%'], itemStyle: { color: 'auto' } },
      axisTick: { length: 12, lineStyle: { color: 'auto', width: 2 } },
      splitLine: { length: 20, lineStyle: { color: 'auto', width: 5 } },
      axisLabel: { color: '#464646', fontSize: 12, distance: -60, formatter: (value: number) => value === 0 ? 'Low' : value === 100 ? 'Peak' : '' },
      title: { offsetCenter: [0, '-20%'], fontSize: 20 },
      detail: { fontSize: 30, offsetCenter: [0, '0%'], valueAnimation: true, formatter: '{value}%', color: 'inherit' },
      data: [{ value: utilizationPercent, name: 'Bed Utilization' }]
    }]
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <Header title="Clinical Command Analytics" />

        <div style={{ margin: '24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: 900, margin: 0, color: '#1e293b' }}>Performance Insights</h2>
            <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>Real-time operational monitoring powered by PostHog Clinical Intelligence.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
             <button style={filterBtnStyle}><Calendar size={14} /> Last 24 Hours</button>
             <button style={{ ...filterBtnStyle, background: '#4f46e5', color: 'white' }}>Generate Report</button>
          </div>
        </div>

        {/* METRIC CARDS */}
          <div className="stats-grid">
            <MetricCard icon={<Users size={24} />} label="Total Consultations" value={metrics.consultations} trend="+12%" color="#4f46e5" />
            <MetricCard icon={<Clock size={24} />} label="Avg Wait Time" value={`${metrics.waitTime}m`} trend="-4m" color="#0ea5e9" />
            <MetricCard icon={<AlertTriangle size={24} />} label="Emergency Triggers" value={metrics.emergencies} trend="+2" color="#ef4444" />
            <MetricCard icon={<Target size={24} />} label="Revenue Realization" value={`₹${(metrics.revenue / 1000).toFixed(1)}k`} trend="+18%" color="#10b981" />
          </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
           {/* PATIENT VOLUME */}
            <div className="form-card">
              <div style={chartHeaderStyle}>
                <h3 style={chartTitleStyle}>Patient Inflow Trend</h3>
                <Activity size={18} color="#94a3b8" />
              </div>
              <ReactECharts option={patientVolumeOption} style={{ height: '350px' }} />
            </div>

           {/* CAPACITY GAUGE */}
            <div className="form-card">
              <div style={chartHeaderStyle}>
                <h3 style={chartTitleStyle}>Clinic Utilization</h3>
                <Target size={18} color="#94a3b8" />
              </div>
              <ReactECharts option={utilizationOption} style={{ height: '350px' }} />
              <div style={{ textAlign: 'center', marginTop: '-40px' }}>
                <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Currently operating at near peak capacity in Cardiology and OPD.</p>
              </div>
            </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
           {/* DELAY ANALYSIS */}
            <div className="form-card">
              <div style={chartHeaderStyle}>
                 <h3 style={chartTitleStyle}>Departmental Delay Index</h3>
                 <TrendingUp size={18} color="#94a3b8" />
              </div>
              <ReactECharts option={delayAnalysisOption} style={{ height: '300px' }} />
           </div>

           {/* RECENT ALERTS */}
            <div className="form-card">
              <div style={chartHeaderStyle}>
                 <h3 style={chartTitleStyle}>Operational Intelligence Feed</h3>
                 <ChevronRight size={18} color="#94a3b8" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 {(data?.feed && data.feed.length > 0) ? data.feed.map((item: any, idx: number) => (
                    <AlertItem 
                      key={idx}
                      type={item.type} 
                      title={item.title} 
                      desc={item.desc} 
                      time={new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                    />
                 )) : (
                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '20px' }}>No critical alerts in the last 24 hours. Clinic is operating within normal parameters.</p>
                 )}
              </div>
           </div>
        </div>
      </main>
    </div>
  );
}

// --- SUBCOMPONENTS ---

const MetricCard = ({ icon, label, value, trend, color }: any) => (
  <div className="stat-card" style={{ borderLeft: `6px solid ${color}` }}>
    <div className="stat-header">
      <div className="stat-icon" style={{ background: 'var(--app-bg)' }}>{icon}</div>
      <span style={{ fontSize: '11px', fontWeight: 900, color: trend.startsWith('+') ? '#10b981' : '#ef4444', background: trend.startsWith('+') ? '#f0fdf4' : '#fef2f2', padding: '4px 8px', borderRadius: '6px' }}>{trend}</span>
    </div>
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  </div>
);

const AlertItem = ({ type, title, desc, time }: any) => {
   const colors: any = { emergency: '#ef4444', delay: '#f59e0b', utilization: '#0ea5e9' };
   return (
      <div style={{ display: 'flex', gap: '16px', padding: '16px', borderRadius: '16px', background: 'var(--app-bg)' }}>
         <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'white', display: 'grid', placeItems: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', color: colors[type] }}>
            {type === 'emergency' ? <AlertTriangle size={20} /> : type === 'delay' ? <Clock size={20} /> : <Target size={20} />}
         </div>
         <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>{title}</h4>
               <span style={{ fontSize: '11px', color: '#94a3b8' }}>{time}</span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>{desc}</p>
         </div>
      </div>
   );
}

// --- STYLES ---

const chartHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' };
const chartTitleStyle = { margin: 0, fontSize: '16px', fontWeight: 900, color: '#1e293b' };
const filterBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#64748b' };
