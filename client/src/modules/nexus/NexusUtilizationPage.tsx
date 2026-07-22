import { useState, useEffect } from "react";
import axios from "axios";
import NexusSidebar from "../../components/NexusSidebar";
import { API_BASE_URL } from "../../config/api";
import NexusHeader from "../../components/NexusHeader";
import ReactECharts from "echarts-for-react";

interface UtilizationData {
  id: string;
  name: string;
  dbName: string;
  plan: string;
  storageUsedMb: string;
  storageLimitMb: number;
  usagePercentage: string;
  activeUsers: number;
  totalRecords: number;
  status: 'CRITICAL' | 'WARNING' | 'HEALTHY';
}

export default function NexusUtilizationPage() {
  const [data, setData] = useState<UtilizationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  useEffect(() => {
    fetchUtilization();
  }, []);

  const fetchUtilization = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/nexus/utilization`);
      setData(res.data);
    } catch (err) {
      console.error("Failed to fetch utilization", err);
    } finally {
      setLoading(false);
    }
  };

  const takeSnapshot = async () => {
    try {
      setSnapshotLoading(true);
      await axios.post(`${API_BASE_URL}/api/nexus/utilization/snapshot`);
      alert("Utilization snapshot captured successfully!");
    } catch (err) {
      alert("Failed to capture snapshot");
    } finally {
      setSnapshotLoading(false);
    }
  };

  const getChartOptions = () => {
    const sortedData = [...data].sort((a, b) => parseFloat(b.storageUsedMb) - parseFloat(a.storageUsedMb)).slice(0, 10);
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: 'MB',
        axisLabel: { color: '#64748b' }
      },
      yAxis: {
        type: 'category',
        data: sortedData.map(d => d.name),
        axisLabel: { color: '#64748b', fontSize: 10 }
      },
      series: [
        {
          name: 'Storage Used (MB)',
          type: 'bar',
          data: sortedData.map(d => parseFloat(d.storageUsedMb)),
          itemStyle: {
            color: (params: any) => {
              const val = sortedData[params.dataIndex];
              if (val.status === 'CRITICAL') return '#ef4444';
              if (val.status === 'WARNING') return '#f59e0b';
              return '#3b82f6';
            },
            borderRadius: [0, 4, 4, 0]
          }
        }
      ]
    };
  };

  return (
    <div className="dashboard-layout">
      <NexusSidebar />
      <main className="main-content">
        <NexusHeader />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Resource Utilization</h1>
              <span style={{ padding: '4px 12px', background: '#ecfdf5', color: '#059669', fontSize: '11px', fontWeight: 800, borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }}></span>
                PROMETHEUS LIVE
              </span>
            </div>
            <p style={{ color: '#64748b', marginTop: '4px' }}>Actuals synchronized from infrastructure telemetry and shard growth trackers</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => window.open(`${API_BASE_URL}/metrics`, '_blank')}
              className="button-secondary"
              style={{ fontSize: '13px' }}
            >
              Raw Metrics
            </button>
            <button 
              onClick={takeSnapshot}
              disabled={snapshotLoading}
              className="button-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {snapshotLoading ? 'Capturing...' : 'Force Sync Snapshot'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '100px', textAlign: 'center', color: '#64748b' }}>Calculating resource metrics...</div>
        ) : (
          <>
            <div className="stats-grid" style={{ marginBottom: '32px' }}>
              <div className="stat-card">
                <div className="stat-label">Total Cloud Storage</div>
                <div className="stat-value">
                  {(data.reduce((acc, d) => acc + parseFloat(d.storageUsedMb), 0) / 1024).toFixed(2)} GB
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Critical Shards</div>
                <div className="stat-value" style={{ color: data.filter(d => d.status === 'CRITICAL').length > 0 ? '#ef4444' : 'inherit' }}>
                  {data.filter(d => d.status === 'CRITICAL').length}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Avg. Utilization</div>
                <div className="stat-value">
                  {(data.reduce((acc, d) => acc + parseFloat(d.usagePercentage), 0) / data.length).toFixed(1)}%
                </div>
              </div>
            </div>

            <div style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>Storage Consumption Top 10</h3>
              <ReactECharts option={getChartOptions()} style={{ height: '400px' }} />
            </div>

            <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--app-bg)', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '13px', color: '#64748b' }}>SHARD / TENANT</th>
                    <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '13px', color: '#64748b' }}>PLAN</th>
                    <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '13px', color: '#64748b' }}>STORAGE USED</th>
                    <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '13px', color: '#64748b' }}>UTILIZATION</th>
                    <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '13px', color: '#64748b' }}>RECORDS</th>
                    <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '13px', color: '#64748b' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((tenant) => (
                    <tr key={tenant.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{tenant.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{tenant.dbName}</div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '20px', 
                          fontSize: '11px', 
                          fontWeight: 700, 
                          textTransform: 'uppercase',
                          background: tenant.plan?.toLowerCase() === 'professional' ? '#f0f9ff' : 'var(--app-bg)',
                          color: tenant.plan?.toLowerCase() === 'professional' ? '#0369a1' : '#64748b'
                        }}>
                          {tenant.plan}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 600 }}>{tenant.storageUsedMb} MB</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>of {tenant.storageLimitMb} MB limit</div>
                      </td>
                      <td style={{ padding: '16px 24px', width: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${tenant.usagePercentage}%`, 
                              height: '100%', 
                              background: tenant.status === 'CRITICAL' ? '#ef4444' : tenant.status === 'WARNING' ? '#f59e0b' : '#10b981'
                            }}></div>
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>{tenant.usagePercentage}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 600 }}>{tenant.totalRecords.toLocaleString()}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{tenant.activeUsers} Active Users</div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ 
                          padding: '6px 12px', 
                          borderRadius: '12px', 
                          fontSize: '11px', 
                          fontWeight: 800,
                          background: tenant.status === 'CRITICAL' ? '#fef2f2' : tenant.status === 'WARNING' ? '#fffbeb' : '#f0fdf4',
                          color: tenant.status === 'CRITICAL' ? '#b91c1c' : tenant.status === 'WARNING' ? '#b45309' : '#15803d'
                        }}>
                          {tenant.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
