import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ReactECharts from 'echarts-for-react';
import Sidebar from "../../../components/Sidebar";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { 
  Users, Calendar, FileText, Pill, Activity, TrendingUp, 
  AlertCircle, ChevronRight, HeartPulse, BarChart3, Clock, FlaskConical, Zap, LogOut, ChevronDown, Bed, FileCheck, Stethoscope
} from 'lucide-react';

import DoctorDashboardPage from "./DoctorDashboardPage";
import { formatCurrency } from "../../../utils/currency";

export default function DashboardPage() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");
  
  if (role === "doctor") {
    return <DoctorDashboardPage />;
  }

  const plan = (localStorage.getItem("tenantPlan") || "basic").toLowerCase();
  const tenantName = localStorage.getItem("tenantName") || "Palmtree Wellness Hospital";
  const [userName] = useState(localStorage.getItem("userName") || "Dr. Mrutyunjaya");
  const [stats, setStats] = useState<any>({
    metrics: { 
      patientInflow: 0, 
      activeAdmissions: 0, 
      pendingBills: 0, 
      dailyRevenue: 0, 
      lastPatient: 'N/A', 
      todayInvoices: 0, 
      dailyCollection: 0, 
      pendingInsurance: 0, 
      outstandingDues: 0,
      appointmentsToday: 0,
      checkedInToday: 0,
      prescriptionsToday: 0,
      admissionsToday: 0,
      dischargesToday: 0,
      bedOccupancy: 0,
      avgWaitingTime: 0,
      completedEncountersToday: 0,
      newPatientsToday: 0,
      returningPatientsToday: 0
    },
    ipOpRatio: { op_count: 0, ip_count: 0 },
    stockAlerts: [],
    bedStats: [],
    labStats: [],
    dischargeTrend: [],
    weeklyFlow: [],
    predictive: { complexityMix: [], predictedAvgTime: 0, utilization: 0, workloadForecast: [] },
    totalBeds: 0,
    todayAppointments: [],
    revenueBreakdown: [],
    patientGenderStats: [],
    topComplaints: [],
    wardStats: []
  });


  const [queue, setQueue] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [upgradeModal, setUpgradeModal] = useState<{ isOpen: boolean; tier: string }>({ isOpen: false, tier: "" });
  const [activeApptTab, setActiveApptTab] = useState<'upcoming' | 'inprogress' | 'completed' | 'cancelled'>('upcoming');

  // Animated count-up hook
  const useAnimatedCount = (target: number, duration: number = 1200) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
      if (target === 0) { setCount(0); return; }
      const startTime = performance.now();
      let animationFrameId: number;
      const step = (timestamp: number) => {
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
        setCount(Math.round(eased * target));
        if (progress < 1) {
          animationFrameId = requestAnimationFrame(step);
        }
      };
      animationFrameId = requestAnimationFrame(step);
      return () => cancelAnimationFrame(animationFrameId);
    }, [target, duration]);
    return count;
  };

  const renderKpiSkeletons = (count: number) => {
    return Array.from({ length: count }).map((_, idx) => (
      <div 
        key={idx} 
        className="skeleton-shimmer" 
        style={{ 
          padding: '16px', 
          backgroundColor: '#fff', 
          border: '1px solid #e2e8f0', 
          borderRadius: '16px', 
          height: '115px', 
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)' 
        }} 
      />
    ));
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("token");
        const tenant = localStorage.getItem("tenant");
        const res = await axios.get(`${API_BASE}/api/hospital/metrics/stats`, {
          headers: { Authorization: `Bearer ${token}`, "x-tenant-id": tenant }
        });
        if (res.data) {
          setStats((prev: any) => ({
            ...prev,
            metrics: {
              ...prev.metrics,
              patientInflow: res.data.metrics?.patientInflow || prev.metrics.patientInflow,
              activeAdmissions: res.data.metrics?.activeAdmissions || prev.metrics.activeAdmissions,
              pendingBills: res.data.metrics?.pendingBills || prev.metrics.pendingBills,
              dailyRevenue: res.data.metrics?.dailyRevenue || prev.metrics.dailyRevenue,
              lastPatient: res.data.metrics?.lastPatient || prev.metrics.lastPatient,
              todayInvoices: res.data.metrics?.todayInvoices || prev.metrics.todayInvoices,
              dailyCollection: res.data.metrics?.dailyCollection || prev.metrics.dailyCollection,
              pendingInsurance: res.data.metrics?.pendingInsurance || prev.metrics.pendingInsurance,
              outstandingDues: res.data.metrics?.outstandingDues || prev.metrics.outstandingDues,
              appointmentsToday: res.data.metrics?.appointmentsToday || prev.metrics.appointmentsToday,
              checkedInToday: res.data.metrics?.checkedInToday || prev.metrics.checkedInToday,
              prescriptionsToday: res.data.metrics?.prescriptionsToday || prev.metrics.prescriptionsToday,
              admissionsToday: res.data.metrics?.admissionsToday || prev.metrics.admissionsToday,
              dischargesToday: res.data.metrics?.dischargesToday || prev.metrics.dischargesToday,
              bedOccupancy: res.data.metrics?.bedOccupancy || prev.metrics.bedOccupancy,
              avgWaitingTime: res.data.metrics?.avgWaitingTime || prev.metrics.avgWaitingTime,
              completedEncountersToday: res.data.metrics?.completedEncountersToday || prev.metrics.completedEncountersToday,
              newPatientsToday: res.data.metrics?.newPatientsToday || prev.metrics.newPatientsToday,
              returningPatientsToday: res.data.metrics?.returningPatientsToday || prev.metrics.returningPatientsToday
            },
            stockAlerts: res.data.stockAlerts?.length ? res.data.stockAlerts : prev.stockAlerts,
            bedStats: res.data.bedStats?.length ? res.data.bedStats : prev.bedStats,
            labStats: res.data.labStats?.length ? res.data.labStats : prev.labStats,
            dischargeTrend: res.data.dischargeTrend?.length ? res.data.dischargeTrend : prev.dischargeTrend,
            weeklyFlow: res.data.weeklyFlow?.length ? res.data.weeklyFlow : prev.weeklyFlow,
            predictive: {
              ...prev.predictive,
              complexityMix: res.data.predictive?.complexityMix?.length ? res.data.predictive.complexityMix : prev.predictive.complexityMix,
              predictedAvgTime: res.data.predictive?.predictedAvgTime || prev.predictive.predictedAvgTime,
              utilization: res.data.predictive?.utilization || prev.predictive.utilization,
              workloadForecast: res.data.predictive?.workloadForecast?.length ? res.data.predictive.workloadForecast : prev.predictive.workloadForecast
            },
            totalBeds: res.data.totalBeds || prev.totalBeds,
            todayAppointments: res.data.todayAppointments || prev.todayAppointments,
            revenueBreakdown: res.data.revenueBreakdown || prev.revenueBreakdown,
            patientGenderStats: res.data.patientGenderStats || prev.patientGenderStats,
            topComplaints: res.data.topComplaints || prev.topComplaints,
            wardStats: res.data.wardStats || prev.wardStats
          }));
        }
      } catch (err: any) {
        console.error("Stats Fetch Error:", err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const fetchQueue = async () => {
      const token = localStorage.getItem("token");
      const tenant = localStorage.getItem("tenant");
      try {
        const res = await axios.get(`${API_BASE}/api/hospital/encounters?status=Active&todayOnly=true`, {
          headers: { Authorization: `Bearer ${token}`, "x-tenant-id": tenant }
        });
        // API returns { total, page, pageSize, data: [...] } OR plain array (for compatibility)
        const encounterList = Array.isArray(res.data) 
          ? res.data 
          : (Array.isArray(res.data?.data) ? res.data.data : []);
        setQueue(encounterList);
      } catch (err: any) {
        console.error("Queue Fetch Error:", err);
      } finally {
        setQueueLoading(false);
      }
    };

    fetchQueue();
    const interval = setInterval(fetchQueue, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  // --- CHART OPTIONS ---
  const getRevenueColor = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('consult')) return '#3b82f6';
    if (t.includes('pharm')) return '#10b981';
    if (t.includes('lab') || t.includes('diag')) return '#f59e0b';
    return '#7c3aed';
  };

  const liveRevenueList = (stats.revenueBreakdown || []).map((r: any) => {
    let color = '#7c3aed';
    if (r.type.toLowerCase().includes('consult')) color = '#3b82f6';
    else if (r.type.toLowerCase().includes('pharm')) color = '#10b981';
    else if (r.type.toLowerCase().includes('lab') || r.type.toLowerCase().includes('diag')) color = '#f59e0b';
    return {
      name: r.type,
      amount: r.amount || 0,
      color
    };
  });

  const totalBreakdownRevenue = liveRevenueList.reduce((acc: number, curr: any) => acc + curr.amount, 0);
  const liveRevenueItems = liveRevenueList.map((item: any) => {
    const pctVal = totalBreakdownRevenue > 0 ? Math.round((item.amount * 100) / totalBreakdownRevenue) : 0;
    return {
      name: item.name,
      val: formatCurrency(item.amount),
      pct: `${pctVal}%`,
      color: item.color
    };
  });

  const displayRevenueItems = liveRevenueItems.length ? liveRevenueItems : [
    { name: 'Consultation', val: '₹0', pct: '0%', color: '#3b82f6' },
    { name: 'Pharmacy', val: '₹0', pct: '0%', color: '#10b981' },
    { name: 'Lab & Diagnostics', val: '₹0', pct: '0%', color: '#f59e0b' },
    { name: 'Others', val: '₹0', pct: '0%', color: '#7c3aed' }
  ];

  const displayTotalRevenue = liveRevenueItems.length ? totalBreakdownRevenue : 0;

  const isZeroRevenue = displayTotalRevenue === 0;
  const hasRevenueBreakdown = stats.revenueBreakdown && stats.revenueBreakdown.length > 0;

  const revenueData = isZeroRevenue 
    ? [{ value: 1, name: 'No Transactions' }]
    : (hasRevenueBreakdown 
        ? stats.revenueBreakdown.map((r: any) => ({ value: r.amount || 0, name: r.type }))
        : [
            { value: 4200, name: 'Consultation' },
            { value: 2850, name: 'Pharmacy' },
            { value: 1100, name: 'Lab & Diagnostics' },
            { value: 300, name: 'Others' }
          ]
      );

  const revenueColors = isZeroRevenue 
    ? ['#e2e8f0']
    : (hasRevenueBreakdown 
        ? stats.revenueBreakdown.map((r: any) => getRevenueColor(r.type))
        : ['#3b82f6', '#10b981', '#f59e0b', '#7c3aed']
      );

  const revenueSnapshotOption = {
    tooltip: isZeroRevenue ? { show: false } : { trigger: 'item', formatter: '{b}: ₹{c} ({d}%)' },
    animationDuration: 1500,
    animationEasing: 'cubicOut',
    series: [{
      type: 'pie',
      radius: ['60%', '80%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: isZeroRevenue ? { scale: false } : {
        scale: true,
        scaleSize: 6,
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.15)' }
      },
      data: revenueData,
      color: revenueColors
    }]
  };

  const hasGenderStats = stats.patientGenderStats && stats.patientGenderStats.length > 0;
  const totalGenderPatients = hasGenderStats ? stats.patientGenderStats.reduce((sum: number, g: any) => sum + (g.count || 0), 0) : 0;
  const genderData = hasGenderStats
    ? stats.patientGenderStats.map((g: any) => ({
        value: g.count || 0,
        name: g.gender ? g.gender.charAt(0).toUpperCase() + g.gender.slice(1).toLowerCase() : 'Unknown'
      }))
    : [
        { value: 1, name: 'No Patients' }
      ];

  const getGenderColor = (gender: string) => {
    const g = (gender || '').toLowerCase();
    if (g.startsWith('m')) return '#3b82f6';
    if (g.startsWith('f')) return '#ec4899';
    return '#94a3b8';
  };

  const genderColors = hasGenderStats
    ? stats.patientGenderStats.map((g: any) => getGenderColor(g.gender))
    : ['#e2e8f0'];

  const genderOption = {
    tooltip: hasGenderStats ? { trigger: 'item', formatter: '{b}: {c} ({d}%)' } : { show: false },
    series: [{
      type: 'pie',
      radius: ['60%', '85%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 1.5 },
      label: { show: false },
      emphasis: hasGenderStats ? {
        scale: true,
        scaleSize: 4
      } : { scale: false },
      data: genderData,
      color: genderColors
    }]
  };

  const labRevenueOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: '0%', right: '0%', top: '10%', bottom: '0%' },
    xAxis: { type: 'category', data: stats.labStats.length ? stats.labStats.map((item: any) => item.status) : ['No data'], show: false },
    yAxis: { type: 'value', show: false },
    series: [{
      data: stats.labStats.length ? stats.labStats.map((item: any) => item.count) : [0],
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: '#10b981' },
      areaStyle: { color: 'rgba(16, 185, 129, 0.1)' }
    }]
  };

  const bedDoughnutOption = {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['60%', '80%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: stats.bedStats.length ? stats.bedStats.map((item: any) => ({ value: item.count, name: item.status })) : [
        { value: 1, name: 'No data' }
      ],
      color: ['#3b82f6', '#10b981', '#f59e0b', '#7c3aed']
    }]
  };

  const professionalRevenueOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: '0%', right: '0%', top: '10%', bottom: '0%' },
    xAxis: { type: 'category', data: stats.weeklyFlow.length ? stats.weeklyFlow.map((item: any) => new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) : ['No data'], show: false },
    yAxis: { type: 'value', show: false },
    series: [{
      data: stats.weeklyFlow.length ? stats.weeklyFlow.map((item: any) => item.count) : [0],
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 3, color: '#10b981' },
      areaStyle: { color: 'rgba(16, 185, 129, 0.1)' }
    }]
  };

  // Glassmorphic Premium Teaser Card
  const renderTeaser = (title: string, targetTier: 'standard' | 'professional', icon: any) => {
    const Icon = icon;
    return (
      <div className="stat-card font-sans" style={{
        position: 'relative',
        padding: '20px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '20px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '220px',
        width: '100%'
      }}>
        <div style={{ filter: 'blur(3px)', opacity: 0.15, userSelect: 'none', flex: 1, pointerEvents: 'none' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h4>
          <div style={{ height: '60px', background: 'linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)', borderRadius: '12px', marginBottom: '12px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ height: '10px', width: '80%', background: '#94a3b8', borderRadius: '4px' }} />
            <div style={{ height: '10px', width: '50%', background: '#cbd5e1', borderRadius: '4px' }} />
          </div>
        </div>

        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          textAlign: 'center',
          zIndex: 10
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #ff8a00 0%, #e52e71 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px',
            boxShadow: '0 6px 12px -3px rgba(229, 46, 113, 0.3)'
          }}>
            <Icon size={16} />
          </div>
          <h4 style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 900, color: '#0f172a' }}>{title}</h4>
          <p style={{ margin: '0 0 12px', fontSize: '11px', color: '#475569', fontWeight: 700, maxWidth: '180px' }}>
            Available in **{targetTier.toUpperCase()}**
          </p>
          <button
            onClick={() => setUpgradeModal({ isOpen: true, tier: targetTier })}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              border: 'none',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 8px rgba(59, 130, 246, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Zap size={10} /> UNLOCK
          </button>
        </div>
      </div>
    );
  };

  const getApptTabKey = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('sched') || s.includes('upcom') || s === 'scheduled') return 'upcoming';
    if (s.includes('progress') || s.includes('active') || s === 'in_progress') return 'inprogress';
    if (s.includes('complete') || s === 'completed' || s === 'finished') return 'completed';
    if (s.includes('cancel') || s === 'cancelled') return 'cancelled';
    return 'upcoming';
  };

  const liveAppointments = (stats.todayAppointments || []).map((appt: any) => {
    const timeStr = appt.appointment_time ? new Date(appt.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const mappedTab = getApptTabKey(appt.status);
    let badgeColor = '#10b981';
    let badgeBg = '#ecfdf5';
    if (mappedTab === 'inprogress') {
      badgeColor = '#3b82f6';
      badgeBg = '#eff6ff';
    } else if (mappedTab === 'completed') {
      badgeColor = '#7c3aed';
      badgeBg = '#f5f3ff';
    } else if (mappedTab === 'cancelled') {
      badgeColor = '#dc2626';
      badgeBg = '#fef2f2';
    }
    return {
      time: timeStr,
      name: appt.patient_name || 'Unknown Patient',
      type: appt.doctor_name ? `Dr. ${appt.doctor_name}` : 'General Consultation',
      status: appt.status || 'Scheduled',
      tab: mappedTab,
      badgeColor,
      badgeBg
    };
  });

  const displayAppointments = liveAppointments;


  const animatedRevenue = useAnimatedCount(displayTotalRevenue);
  const [isFilled, setIsFilled] = useState(false);

  useEffect(() => {
    if (!statsLoading) {
      const timer = setTimeout(() => setIsFilled(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsFilled(false);
    }
  }, [statsLoading]);

  const displayGenderStats = hasGenderStats ? stats.patientGenderStats.map((g: any) => {
    const total = stats.patientGenderStats.reduce((acc: number, val: any) => acc + (val.count || 0), 0) || 1;
    const pct = Math.round((g.count * 100) / total);
    return {
      name: g.gender ? g.gender.charAt(0).toUpperCase() + g.gender.slice(1).toLowerCase() : 'Unknown',
      pct: `${pct}%`,
      count: g.count,
      color: getGenderColor(g.gender)
    };
  }) : [
    { name: 'Male', pct: '0%', count: 0, color: '#3b82f6' },
    { name: 'Female', pct: '0%', count: 0, color: '#ec4899' }
  ];
  
  const displayTotalPatientsCount = hasGenderStats ? totalGenderPatients : 0;

  const recentPatientsData = stats.todayAppointments && stats.todayAppointments.length > 0
    ? stats.todayAppointments.slice(0, 5).map((appt: any, idx: number) => {
        const name = appt.patient_name || 'Patient';
        const initial = name.charAt(0).toUpperCase();
        const timeStr = appt.appointment_time ? new Date(appt.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
        const colors = [
          { bg: '#eff6ff', color: '#3b82f6' },
          { bg: '#f5f3ff', color: '#7c3aed' },
          { bg: '#fffbeb', color: '#d97706' },
          { bg: '#f0fdf4', color: '#16a34a' },
          { bg: '#fef2f2', color: '#dc2626' }
        ];
        const color = colors[idx % colors.length];
        return {
          name,
          initial,
          token: `APT-${appt.id.substring(0, 3).toUpperCase()}`,
          time: timeStr,
          avatarBg: color.bg,
          avatarColor: color.color,
          status: appt.status || 'Scheduled'
        };
      })
    : [];

  const getLabCount = (status: string) => {
    if (!stats.labStats) return 0;
    const found = stats.labStats.find((item: any) => item.status?.toLowerCase() === status.toLowerCase());
    return found ? found.count : 0;
  };

  const displayComplaints = stats.topComplaints && stats.topComplaints.length > 0 ? stats.topComplaints : [];

  return (
    <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', width: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Dynamic ambient mesh glow layers */}
      <div style={{
        position: 'fixed',
        top: '-10%',
        left: '-10%',
        width: '50vw',
        height: '50vw',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'fixed',
        bottom: '10%',
        right: '-10%',
        width: '45vw',
        height: '45vw',
        background: 'radial-gradient(circle, rgba(6, 182, 212, 0.1) 0%, transparent 70%)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'fixed',
        top: '40%',
        left: '50%',
        width: '35vw',
        height: '35vw',
        background: 'radial-gradient(circle, rgba(236, 72, 153, 0.05) 0%, transparent 70%)',
        filter: 'blur(90px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <style>{`
        body, div, span, p, a, button, input, select, textarea, label, td, th, strong, em, li, ul, ol {
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        }
        h1, h2, h3, h4, h5, h6, .outfit-font {
          font-family: 'Outfit', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        }
        code, pre, .font-mono, [style*="monospace"] {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
        }
        @keyframes shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }
        .skeleton-shimmer {
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200px 100%;
          animation: shimmer 1.5s ease-in-out infinite;
          border-radius: 8px;
        }
        @keyframes revenuePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.15); transform: scale(1); }
          50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); transform: scale(1.03); }
        }
        .revenue-total-badge {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #ffffff;
          width: 90px;
          height: 90px;
          transition: all 0.3s ease;
          animation: revenuePulse 3s ease-in-out infinite;
        }
      `}</style>
      <Sidebar />
      <main className="main-content" style={{ padding: isMobile ? '16px' : '32px 40px', flex: 1, overflowX: 'hidden', zIndex: 1 }}>
        
        {/* TOP BRANDING HEADER BAR */}
        <div className="dashboard-header" style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 32px',
          width: '100%',
          marginBottom: '32px',
          gap: isMobile ? '20px' : '0'
        }}>
          {/* Left Welcome Text */}
          <div style={{ zIndex: 2 }}>
            <h1 style={{ 
              fontSize: '28px', 
              fontWeight: 900, 
              color: '#ffffff', 
              margin: 0,
              letterSpacing: '-0.02em',
              textShadow: '0 2px 10px rgba(0,0,0,0.15)'
            }}>Welcome, {userName}</h1>
            <p style={{ margin: '4px 0 12px', color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px', fontWeight: 500 }}>
              Let's make today a productive day for HIMS. Here is your clinic status overview.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 700 }}>Session: {userName}</span>
              <div style={{ width: '1px', height: '12px', background: 'rgba(255, 255, 255, 0.2)' }} />
              <span style={{ 
                fontSize: '10px', 
                fontWeight: 800, 
                color: '#ffffff', 
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '2px 8px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#34d399' }} />
                {tenantName}
              </span>
            </div>
          </div>

          {/* Right Action Blocks */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', zIndex: 2 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              backgroundColor: 'rgba(255, 255, 255, 0.15)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.25)', 
              borderRadius: '12px', 
              padding: '8px 16px', 
              fontSize: '13px', 
              fontWeight: 700, 
              color: '#ffffff', 
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              <Calendar size={16} />
              <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              <ChevronDown size={14} />
            </div>

            <button 
              onClick={handleLogout}
              className="button-secondary"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                padding: '10px 18px',
                fontSize: '11px',
                fontWeight: 800,
                borderRadius: '12px',
                cursor: 'pointer',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease'
              }}
            >
              <LogOut size={12} />
              LOGOUT
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BASIC TIER VIEW */}
        {/* ========================================================================= */}
        {plan === 'basic' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(6, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {statsLoading ? renderKpiSkeletons(6) : [
                { label: "Today's Appointments", val: stats.metrics.appointmentsToday || 0, trend: "vs yesterday", isUp: true, icon: Calendar, color: "#3b82f6", bg: "#eff6ff" },
                { label: "Patients Checked-In", val: stats.metrics.checkedInToday || queue.length || 0, trend: "vs yesterday", isUp: true, icon: Users, color: "#f59e0b", bg: "#fffbeb" },
                { label: "Pending Bills", val: stats.metrics.pendingBills || 0, trend: "vs yesterday", isUp: true, icon: FileText, color: "#ef4444", bg: "#fef2f2" },
                { label: "Revenue Today", val: `₹${stats.metrics.dailyRevenue?.toLocaleString?.() || 0}`, trend: "vs yesterday", isUp: true, icon: TrendingUp, color: "#10b981", bg: "#f0fdf4" },
                { label: "Invoices Today", val: stats.metrics.todayInvoices || 0, trend: "vs yesterday", isUp: true, icon: Stethoscope, color: "#7c3aed", bg: "#f5f3ff" },
                { label: "Avg. Waiting Time", val: queueLoading ? '...' : (queue.filter((enc) => !enc.is_in_consultation && !enc.is_finished).length === 0 ? '0m' : `${stats.predictive.predictedAvgTime || 0}m`), trend: "vs yesterday", isUp: true, icon: Clock, color: "#0d9488", bg: "#f0fdf4" }
              ].map((card, idx) => (
                <div key={idx} className="stat-card" style={{ padding: '16px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                    <card.icon size={18} />
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>{card.val}</div>
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                    {card.label.includes("Time") || card.label.includes("Bills") ? "↓" : "↑"} {card.trend}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
              <div className="page-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <Activity size={18} style={{ color: '#3b82f6' }} />
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Live OPD Queue</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Current Token</div>
                      <div style={{ fontSize: '24px', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
                        {queue.length ? (queue.find((enc) => enc.is_in_consultation)?.token || queue[0]?.token || 'N/A') : (queueLoading ? 'Loading...' : 'N/A')}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Patients Waiting</div>
                      <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                        {queue.length ? queue.filter((enc) => !enc.is_in_consultation && !enc.is_finished).length : (queueLoading ? '...' : 0)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Avg. Wait Time</div>
                      <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                        {queueLoading ? '...' : (queue.filter((enc) => !enc.is_in_consultation && !enc.is_finished).length === 0 ? '0m' : `${Math.round(queue.filter((enc) => !enc.is_in_consultation && !enc.is_finished).reduce((total, enc) => {
                          const start = new Date(enc.created_at).getTime();
                          const diff = Math.floor((Date.now() - start) / 60000);
                          return total + diff;
                        }, 0) / queue.filter((enc) => !enc.is_in_consultation && !enc.is_finished).length)}m`)}
                      </div>
                    </div>
                  </div>

                  <div style={{ position: 'relative', padding: '10px 0' }}>
                    <div style={{ position: 'absolute', top: '16px', left: '10px', right: '10px', height: '3px', backgroundColor: '#e2e8f0', zIndex: 1 }}></div>
                    <div style={{ position: 'absolute', top: '16px', left: '10px', width: '66%', height: '3px', backgroundColor: '#3b82f6', zIndex: 1 }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                      {[
                        { name: 'Registered', val: queue.length || 0, active: true },
                        { name: 'In Queue', val: queue.filter((enc) => !enc.is_in_consultation && !enc.is_finished).length || 0, active: true },
                        { name: 'In Consult', val: queue.filter((enc) => enc.is_in_consultation).length || 0, active: true },
                        { name: 'Completed', val: stats.metrics.completedEncountersToday || 0, active: (stats.metrics.completedEncountersToday || 0) > 0 }
                      ].map((step, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            borderRadius: '50%', 
                            backgroundColor: step.active ? '#3b82f6' : '#cbd5e1',
                            border: '2px solid #ffffff',
                            boxShadow: '0 0 0 2px ' + (step.active ? '#3b82f6' : '#cbd5e1'),
                            marginBottom: '6px'
                          }} />
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>{step.name}</span>
                          <span style={{ fontSize: '11px', fontWeight: 900, color: step.active ? '#3b82f6' : '#64748b', marginTop: '2px' }}>{step.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ecfdf5', padding: '10px 14px', borderRadius: '10px', border: '1px solid #d1fae5', color: '#065f46', fontSize: '12px', fontWeight: 700 }}>
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                    Next Token: <strong style={{ fontWeight: 900 }}>{queue.length ? (queue.find((enc) => !enc.is_in_consultation && !enc.is_finished && enc.token !== (queue.find((e) => e.is_in_consultation)?.token || queue[0]?.token))?.token || queue[1]?.token || 'N/A') : (queueLoading ? 'Loading...' : 'N/A')}</strong>
                  </div>
                </div>
              </div>

              <div className="page-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Today's Appointments</h3>
                  <button onClick={() => navigate('/tenant/appointments/doctor-calendar?tab=Operational+Calendar')} style={{ fontSize: '12px', fontWeight: 800, color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer' }}>
                    View Calendar
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px', overflowX: 'auto' }}>
                  {[
                    { key: 'upcoming', label: 'Upcoming', count: displayAppointments.filter((a: any) => a.tab === 'upcoming').length, color: '#059669', bg: '#ecfdf5' },
                    { key: 'inprogress', label: 'In Progress', count: displayAppointments.filter((a: any) => a.tab === 'inprogress').length, color: '#2563eb', bg: '#eff6ff' },
                    { key: 'completed', label: 'Completed', count: displayAppointments.filter((a: any) => a.tab === 'completed').length, color: '#7c3aed', bg: '#f5f3ff' },
                    { key: 'cancelled', label: 'Cancelled', count: displayAppointments.filter((a: any) => a.tab === 'cancelled').length, color: '#dc2626', bg: '#fef2f2' }
                  ].map((tab: any) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveApptTab(tab.key as any)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        color: activeApptTab === tab.key ? tab.color : '#64748b',
                        backgroundColor: activeApptTab === tab.key ? tab.bg : '#f8fafc',
                        border: activeApptTab === tab.key ? `1px solid ${tab.color}30` : '1px solid #e2e8f0',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {tab.label} <span style={{ fontSize: '9px', backgroundColor: activeApptTab === tab.key ? '#ffffff' : '#e2e8f0', color: activeApptTab === tab.key ? tab.color : '#64748b', padding: '1px 6px', borderRadius: '10px' }}>{tab.count}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  {displayAppointments.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '140px', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
                      No appointments scheduled for today
                    </div>
                  ) : (
                    <>
                      {displayAppointments
                        .filter((appt: any) => appt.tab === activeApptTab)
                        .map((appt: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'var(--app-bg)', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', width: '60px' }}>{appt.time}</span>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{appt.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{appt.type}</span>
                              <span style={{ fontSize: '10px', fontWeight: 800, color: appt.badgeColor, backgroundColor: appt.badgeBg, padding: '2px 8px', borderRadius: '6px' }}>{appt.status}</span>
                            </div>
                          </div>
                        ))}
                      {displayAppointments.filter((appt: any) => appt.tab === activeApptTab).length === 0 && (
                        <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No appointments in this tab today</div>
                      )}
                    </>
                  )}
                </div>
                <button onClick={() => navigate('/tenant/appointments')} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 800, color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer', marginTop: '16px', padding: 0 }}>
                  View all appointments →
                </button>
              </div>

              {statsLoading ? (
                <div className="page-card skeleton-shimmer" style={{ height: '220px', borderRadius: '24px' }} />
              ) : (
                <div className="page-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Revenue Snapshot</h3>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '6px' }}>Today</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                    <div style={{ width: '110px', height: '110px', position: 'relative' }}>
                      <ReactECharts option={revenueSnapshotOption} style={{ height: '110px', width: '110px' }} />
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="revenue-total-badge" style={{ border: 'none', background: 'transparent' }}>
                          <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Total</span>
                          <span style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>{formatCurrency(animatedRevenue)}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                      {displayRevenueItems.map((item: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.color }} />
                              <span style={{ color: '#64748b', fontWeight: 700 }}>{item.name}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', fontWeight: 800, color: '#0f172a' }}>
                              <span>{item.val}</span>
                              <span style={{ color: '#94a3b8' }}>{item.pct}</span>
                            </div>
                          </div>
                          <div style={{ height: '3px', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ 
                              height: '100%', 
                              backgroundColor: item.color, 
                              borderRadius: '2px',
                              width: isFilled ? item.pct : '0%',
                              transition: 'width 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                              transitionDelay: `${idx * 150}ms`
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => navigate('/tenant/reports')} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 800, color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer', marginTop: '16px', padding: 0 }}>
                    View full report →
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
              <div className="page-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Patient Insights</h3>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '6px' }}>Today</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>New Patients</div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>{stats.metrics.newPatientsToday || 0}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Returning</div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>{stats.metrics.returningPatientsToday || 0}</div>
                    </div>
                  </div>

                  <div style={{ width: '90px', height: '90px', position: 'relative', margin: '0 auto' }}>
                    <ReactECharts option={genderOption} style={{ height: '90px', width: '90px' }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>{displayTotalPatientsCount}</span>
                      <span style={{ fontSize: '8px', color: '#94a3b8', fontWeight: 800 }}>TOTAL</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {displayGenderStats.map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: '#64748b' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.color }} />
                        <span>{item.name}: {item.pct} ({item.count})</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Top Visited For</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {displayComplaints.map((tag: any, idx: number) => (
                      <span key={idx} style={{ fontSize: '11px', fontWeight: 800, color: '#475569', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '6px' }}>
                        {tag.name} <span style={{ color: '#94a3b8', marginLeft: '2px' }}>{tag.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="page-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Recent Patients</h3>
                  <button onClick={() => navigate('/tenant/clinical/patient-register')} style={{ fontSize: '12px', fontWeight: 800, color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer' }}>
                    View all
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recentPatientsData.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '140px', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
                      No recent patients today
                    </div>
                  ) : (
                    recentPatientsData.map((pat: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: 'var(--app-bg)', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: pat.avatarBg, color: pat.avatarColor, display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 800 }}>
                            {pat.initial}
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{pat.name}</div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>{pat.token}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>{pat.time}</span>
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#10b981', backgroundColor: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' }}>{pat.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="page-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 20px' }}>Quick Actions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  {[
                    { label: 'Add Appt', icon: Calendar, color: '#10b981', bg: '#ecfdf5', path: '/tenant/appointments/doctor-calendar?tab=Operational+Calendar' },
                    { label: 'Register', icon: Users, color: '#3b82f6', bg: '#eff6ff', path: '/tenant/clinical/patient-register' },
                    { label: 'Create Bill', icon: FileText, color: '#7c3aed', bg: '#f5f3ff', path: '/billing' },
                    { label: 'Prescription', icon: Stethoscope, color: '#f59e0b', bg: '#fffbeb', path: '/tenant/opd/consultation' },
                    { label: 'Add Pay', icon: FileCheck, color: '#0d9488', bg: '#f0fdf4', path: '/billing' },
                    { label: 'Reports', icon: BarChart3, color: '#3b82f6', bg: '#eff6ff', path: '/tenant/reports' }
                  ].map((act, idx) => (
                    <button 
                      key={idx}
                      onClick={() => navigate(act.path)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '12px 6px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: act.bg, color: act.color, display: 'grid', placeItems: 'center' }}>
                        <act.icon size={16} />
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: 800, color: '#475569', textAlign: 'center', lineHeight: '1.2' }}>{act.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '32px', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 950, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Unlock Standard & Professional Capabilities</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '24px' }}>
                {renderTeaser('Pharmacy Inventory & Expiries', 'standard', Pill)}
                {renderTeaser('Laboratory Information Management', 'standard', FlaskConical)}
                {renderTeaser('Live Ward Beds Mapping (IPD)', 'professional', Bed)}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STANDARD TIER VIEW */}
        {/* ========================================================================= */}
        {plan === 'standard' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(6, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {statsLoading ? renderKpiSkeletons(6) : [
                { label: "Today's Appointments", val: stats.metrics.appointmentsToday || 0, trend: "12% vs yesterday", isUp: true, icon: Calendar, color: "#3b82f6", bg: "#eff6ff" },
                { label: "Patients Checked-In", val: stats.metrics.checkedInToday || queue.length || 0, trend: "10% vs yesterday", isUp: true, icon: Users, color: "#f59e0b", bg: "#fffbeb" },
                { label: "Pending Bills", val: stats.metrics.pendingBills || 0, trend: "25% vs yesterday", isUp: true, icon: FileText, color: "#ef4444", bg: "#fef2f2" },
                { label: "Revenue Today", val: `₹${stats.metrics.dailyRevenue?.toLocaleString?.() || 0}`, trend: "18% vs yesterday", isUp: true, icon: TrendingUp, color: "#10b981", bg: "#f0fdf4" },
                { label: "Prescriptions Issued", val: stats.metrics.prescriptionsToday || 0, trend: "9% vs yesterday", isUp: true, icon: Stethoscope, color: "#7c3aed", bg: "#f5f3ff" },
                { label: "Avg. Waiting Time", val: queueLoading ? '...' : (queue.filter((enc) => !enc.is_in_consultation && !enc.is_finished).length === 0 ? '0m' : `${queue.length ? Math.round(queue.reduce((sum, enc) => {
                  const start = new Date(enc.created_at).getTime();
                  const diff = Math.floor((Date.now() - start) / 60000);
                  return sum + diff;
                }, 0) / queue.length) : stats.predictive.predictedAvgTime || 0}m`), trend: "5m vs yesterday", isUp: true, icon: Clock, color: "#0d9488", bg: "#f0fdf4" }
              ].map((card, idx) => (
                <div key={idx} className="stat-card" style={{ padding: '16px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                    <card.icon size={18} />
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>{card.val}</div>
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                    {card.label.includes("Time") || card.label.includes("Bills") ? "↓" : "↑"} {card.trend}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
              <div className="page-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <Activity size={18} style={{ color: '#3b82f6' }} />
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Live OPD Queue</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Current Token</div>
                      <div style={{ fontSize: '24px', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
                        {queue.length ? (queue.find((enc) => enc.is_in_consultation)?.token || queue[0]?.token || 'N/A') : (queueLoading ? 'Loading...' : 'N/A')}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Patients Waiting</div>
                      <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                        {queue.length ? queue.filter((enc) => !enc.is_in_consultation && !enc.is_finished).length : (queueLoading ? '...' : 0)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Avg. Wait Time</div>
                      <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                        {queueLoading ? '...' : (queue.filter((enc) => !enc.is_in_consultation && !enc.is_finished).length === 0 ? '0m' : `${Math.round(queue.filter((enc) => !enc.is_in_consultation && !enc.is_finished).reduce((total, enc) => {
                          const start = new Date(enc.created_at).getTime();
                          const diff = Math.floor((Date.now() - start) / 60000);
                          return total + diff;
                        }, 0) / queue.filter((enc) => !enc.is_in_consultation && !enc.is_finished).length)}m`)}
                      </div>
                    </div>
                  </div>

                  <div style={{ position: 'relative', padding: '10px 0' }}>
                    <div style={{ position: 'absolute', top: '16px', left: '10px', right: '10px', height: '3px', backgroundColor: '#e2e8f0', zIndex: 1 }}></div>
                    <div style={{ position: 'absolute', top: '16px', left: '10px', width: '66%', height: '3px', backgroundColor: '#3b82f6', zIndex: 1 }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                      {[
                        { name: 'Registered', val: queue.length || 0, active: true },
                        { name: 'In Queue', val: queue.filter((enc) => !enc.is_in_consultation && !enc.is_finished).length || 0, active: true },
                        { name: 'In Consult', val: queue.filter((enc) => enc.is_in_consultation).length || 0, active: true },
                        { name: 'Completed', val: stats.metrics.completedEncountersToday || 0, active: (stats.metrics.completedEncountersToday || 0) > 0 }
                      ].map((step, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            borderRadius: '50%', 
                            backgroundColor: step.active ? '#3b82f6' : '#cbd5e1',
                            border: '2px solid #ffffff',
                            boxShadow: '0 0 0 2px ' + (step.active ? '#3b82f6' : '#cbd5e1'),
                            marginBottom: '6px'
                          }} />
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>{step.name}</span>
                          <span style={{ fontSize: '11px', fontWeight: 900, color: step.active ? '#3b82f6' : '#64748b', marginTop: '2px' }}>{step.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ecfdf5', padding: '10px 14px', borderRadius: '10px', border: '1px solid #d1fae5', color: '#065f46', fontSize: '12px', fontWeight: 700 }}>
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                    Next Token: <strong style={{ fontWeight: 900 }}>{queue.length ? (queue.find((enc) => !enc.is_in_consultation && !enc.is_finished && enc.token !== (queue.find((e) => e.is_in_consultation)?.token || queue[0]?.token))?.token || queue[1]?.token || 'N/A') : (queueLoading ? 'Loading...' : 'N/A')}</strong>
                  </div>
                </div>
              </div>

              <div className="page-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Today's Appointments</h3>
                  <button onClick={() => navigate('/tenant/appointments/doctor-calendar?tab=Operational+Calendar')} style={{ fontSize: '12px', fontWeight: 800, color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer' }}>
                    View Calendar
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px', overflowX: 'auto' }}>
                  {[
                    { key: 'upcoming', label: 'Upcoming', count: displayAppointments.filter((a: any) => a.tab === 'upcoming').length, color: '#059669', bg: '#ecfdf5' },
                    { key: 'inprogress', label: 'In Progress', count: displayAppointments.filter((a: any) => a.tab === 'inprogress').length, color: '#2563eb', bg: '#eff6ff' },
                    { key: 'completed', label: 'Completed', count: displayAppointments.filter((a: any) => a.tab === 'completed').length, color: '#7c3aed', bg: '#f5f3ff' },
                    { key: 'cancelled', label: 'Cancelled', count: displayAppointments.filter((a: any) => a.tab === 'cancelled').length, color: '#dc2626', bg: '#fef2f2' }
                  ].map((tab: any) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveApptTab(tab.key as any)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        color: activeApptTab === tab.key ? tab.color : '#64748b',
                        backgroundColor: activeApptTab === tab.key ? tab.bg : '#f8fafc',
                        border: activeApptTab === tab.key ? `1px solid ${tab.color}30` : '1px solid #e2e8f0',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {tab.label} <span style={{ fontSize: '9px', backgroundColor: activeApptTab === tab.key ? '#ffffff' : '#e2e8f0', color: activeApptTab === tab.key ? tab.color : '#64748b', padding: '1px 6px', borderRadius: '10px' }}>{tab.count}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  {displayAppointments.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '140px', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
                      No appointments scheduled for today
                    </div>
                  ) : (
                    <>
                      {displayAppointments
                        .filter((appt: any) => appt.tab === activeApptTab)
                        .map((appt: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'var(--app-bg)', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', width: '60px' }}>{appt.time}</span>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{appt.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{appt.type}</span>
                              <span style={{ fontSize: '10px', fontWeight: 800, color: appt.badgeColor, backgroundColor: appt.badgeBg, padding: '2px 8px', borderRadius: '6px' }}>{appt.status}</span>
                            </div>
                          </div>
                        ))}
                      {displayAppointments.filter((appt: any) => appt.tab === activeApptTab).length === 0 && (
                        <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No appointments in this tab today</div>
                      )}
                    </>
                  )}
                </div>
                <button onClick={() => navigate('/tenant/appointments')} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 800, color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer', marginTop: '16px', padding: 0 }}>
                  View all appointments →
                </button>
              </div>

              {statsLoading ? (
                <div className="page-card skeleton-shimmer" style={{ height: '220px', borderRadius: '24px' }} />
              ) : (
                <div className="page-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Revenue Snapshot</h3>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '6px' }}>Today</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                    <div style={{ width: '110px', height: '110px', position: 'relative' }}>
                      <ReactECharts option={revenueSnapshotOption} style={{ height: '110px', width: '110px' }} />
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="revenue-total-badge" style={{ border: 'none', background: 'transparent' }}>
                          <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Total</span>
                          <span style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>{formatCurrency(animatedRevenue)}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                      {displayRevenueItems.map((item: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.color }} />
                              <span style={{ color: '#64748b', fontWeight: 700 }}>{item.name}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', fontWeight: 800, color: '#0f172a' }}>
                              <span>{item.val}</span>
                              <span style={{ color: '#94a3b8' }}>{item.pct}</span>
                            </div>
                          </div>
                          <div style={{ height: '3px', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ 
                              height: '100%', 
                              backgroundColor: item.color, 
                              borderRadius: '2px',
                              width: isFilled ? item.pct : '0%',
                              transition: 'width 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                              transitionDelay: `${idx * 150}ms`
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => navigate('/tenant/reports')} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 800, color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer', marginTop: '16px', padding: 0 }}>
                    View full report →
                  </button>
                </div>
              )}
            </div>

            {/* Row 3: Lab Operations Overview (Full Width) */}
            <div className="page-card" style={{ padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 850, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lab Operations Overview</h3>
                <button onClick={() => navigate('/tenant/lab')} style={{ fontSize: '12px', fontWeight: 800, color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer' }}>Go to Lab Hub</button>
              </div>

              {/* Stepper */}
              <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: 'var(--app-bg)', padding: '16px 24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px', overflowX: 'auto', gap: '16px' }}>
                {[
                  { step: 'Samples Collected', count: String(getLabCount('Sample Collected') || getLabCount('Collected') || 0), color: '#3b82f6', active: true },
                  { step: 'In Progress', count: String(getLabCount('In Progress') || 0), color: '#f59e0b', active: true },
                  { step: 'Pending Validation', count: String(getLabCount('Pending Validation') || 0), color: '#ef4444', active: true },
                  { step: 'Reports Pending', count: String(getLabCount('Pending') || 0), color: '#7c3aed', active: true },
                  { step: 'Reports Delivered', count: String(getLabCount('Completed') || getLabCount('Delivered') || 0), color: '#10b981', active: false },
                  { step: 'Avg TAT', count: '30m', color: '#0d9488', active: false }
                ].map((s, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '120px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: s.color }} />
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>{s.step}</div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{s.count}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sub-panels Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '20px' }}>
                <div style={{ padding: '16px', backgroundColor: 'var(--app-bg)', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>Test Status Tracker</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {stats.labStats?.map((lab: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                        <span>{lab.status}</span>
                        <span style={{ fontWeight: 800, color: '#0f172a' }}>{lab.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '16px', backgroundColor: 'var(--app-bg)', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>Most Ordered Tests</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { name: 'CBC (Haematology)', count: 15 },
                      { name: 'Thyroid Profile', count: 12 },
                      { name: 'LFT (Biochemistry)', count: 10 },
                      { name: 'Urine R/M', count: 8 }
                    ].map((t, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                        <span>{t.name}</span>
                        <span style={{ fontWeight: 800, color: '#0f172a' }}>{t.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '16px', backgroundColor: 'var(--app-bg)', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Lab Revenue Trend</span>
                  <div style={{ height: '60px', width: '100%', flex: 1 }}>
                    <ReactECharts option={labRevenueOption} style={{ height: '60px', width: '100%' }} />
                  </div>
                </div>

                <div style={{ padding: '16px', backgroundColor: 'var(--app-bg)', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>Operational Efficiency</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { label: 'Equipment Uptime', val: '99.2%' },
                      { label: 'Critical Alert TAT', val: '14 mins' },
                      { label: 'Reagent Stock', val: 'Optimal' },
                      { label: 'Outsourced Tests', val: '3' }
                    ].map((t, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                        <span>{t.label}</span>
                        <span style={{ fontWeight: 800, color: '#0f172a' }}>{t.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 4: Patient Journey (Full Width) */}
            <div className="page-card" style={{ padding: '24px', marginBottom: '24px' }}>
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '16px' }}>Patient Operational Journey (Today)</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                {[
                  { label: 'Appointments Booked', val: '18', active: true },
                  { label: 'Doctor Consultations', val: '12', active: true },
                  { label: 'Diagnostic Tests Ordered', val: '8', active: true },
                  { label: 'Samples Collected', val: '6', active: true },
                  { label: 'Reports Delivered', val: '4', active: true },
                  { label: 'Prescriptions Dispensed', val: '12', active: false }
                ].map((item, idx, arr) => (
                  <div key={idx} style={{ flex: 1, minWidth: '130px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '20px', fontWeight: 900, color: item.active ? '#3b82f6' : '#94a3b8' }}>{item.val}</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginTop: '2px', lineHeight: '1.2' }}>{item.label}</div>
                    </div>
                    {idx < arr.length - 1 && (
                      <ChevronRight size={18} style={{ color: '#cbd5e1' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Row 5: 2 Columns */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px' }}>
              <div className="page-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Alerts & Notifications</h3>
                  <span style={{ fontSize: '9px', fontWeight: 900, color: '#ef4444', backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: '6px' }}>6 PENDING</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  {[
                    { type: 'warning', text: 'Low stock alert: HbA1c Kit (2 kits remaining)', time: '10m ago' },
                    { type: 'critical', text: 'Critical Lab Alert: Hemoglobin 7.2 for Patient Priya Sharma', time: '15m ago' },
                    { type: 'info', text: 'Equipment maintenance: Biochemistry Analyzer scheduled at 4 PM', time: '1h ago' }
                  ].map((alert, idx) => (
                    <div key={idx} style={{ 
                      padding: '12px 14px', 
                      backgroundColor: alert.type === 'critical' ? '#fef2f2' : alert.type === 'warning' ? '#fffbeb' : '#f8fafc',
                      border: '1px solid ' + (alert.type === 'critical' ? '#fca5a5' : alert.type === 'warning' ? '#fde047' : '#e2e8f0'),
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px'
                    }}>
                      <AlertCircle size={16} style={{ color: alert.type === 'critical' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : '#3b82f6', marginTop: '2px', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#334155', lineHeight: '1.4' }}>{alert.text}</p>
                        <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block', marginTop: '4px', fontWeight: 600 }}>{alert.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="page-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 20px' }}>Quick Actions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px', flex: 1 }}>
                  {[
                    { label: 'Add Appointment', icon: Calendar, color: '#10b981', bg: '#ecfdf5', path: '/tenant/appointments/doctor-calendar?tab=Operational+Calendar' },
                    { label: 'Register Patient', icon: Users, color: '#3b82f6', bg: '#eff6ff', path: '/tenant/clinical/patient-register' },
                    { label: 'Create Bill', icon: FileText, color: '#7c3aed', bg: '#f5f3ff', path: '/billing' },
                    { label: 'Order Test', icon: FlaskConical, color: '#0d9488', bg: '#f0fdf4', path: '/tenant/lab' },
                    { label: 'Dispense Medicine', icon: Pill, color: '#f59e0b', bg: '#fffbeb', path: '/tenant/pharmacy' },
                    { label: 'View Reports', icon: BarChart3, color: '#3b82f6', bg: '#eff6ff', path: '/tenant/reports' }
                  ].map((act, idx) => (
                    <button 
                      key={idx}
                      onClick={() => navigate(act.path)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px 6px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.01)'
                      }}
                    >
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: act.bg, color: act.color, display: 'grid', placeItems: 'center' }}>
                        <act.icon size={18} />
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#475569', textAlign: 'center', lineHeight: '1.2' }}>{act.label}</span>
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                  {renderTeaser('Live Ward Beds Mapping (IPD)', 'professional', Bed)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PROFESSIONAL TIER VIEW */}
        {/* ========================================================================= */}
        {(plan === 'professional' || plan === 'enterprise') && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(7, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {statsLoading ? renderKpiSkeletons(7) : [
                { label: "Today's Appointments", val: stats.metrics.appointmentsToday || 0, trend: "12% vs yesterday", isUp: true, icon: Calendar, color: "#3b82f6", bg: "#eff6ff" },
                { label: "Patients Checked-In", val: stats.metrics.checkedInToday || queue.length || 0, trend: "10% vs yesterday", isUp: true, icon: Users, color: "#f59e0b", bg: "#fffbeb" },
                { label: "Admissions Today", val: stats.metrics.admissionsToday || 0, trend: "33% vs yesterday", isUp: true, icon: Bed, color: "#10b981", bg: "#f0fdf4" },
                { label: "Discharges Today", val: stats.metrics.dischargesToday || 0, trend: "25% vs yesterday", isUp: true, icon: Bed, color: "#0d9488", bg: "#f0fdf4" },
                { label: "Bed Occupancy", val: `${stats.metrics.bedOccupancy || 0}%`, trend: "4% vs yesterday", isUp: true, icon: FileCheck, color: "#7c3aed", bg: "#f5f3ff" },
                { label: "Today's Revenue", val: formatCurrency(stats.metrics.dailyRevenue), trend: "18% vs yesterday", isUp: true, icon: TrendingUp, color: "#10b981", bg: "#f0fdf4" },
                { label: "Pending Bills", val: stats.metrics.pendingBills || 0, trend: "12% vs yesterday", isUp: true, icon: FileText, color: "#ef4444", bg: "#fef2f2" }
              ].map((card, idx) => (
                <div key={idx} className="stat-card" style={{ padding: '16px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                    <card.icon size={18} />
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>{card.val}</div>
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                    {card.label.includes("Time") || card.label.includes("Bills") ? "↓" : "↑"} {card.trend}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
              <div className="page-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hospital Operations Overview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {[
                    { label: 'Avg. Length of Stay', val: '3.6 Days', trend: '↓ 0.3', isGood: true },
                    { label: 'Active Patients', val: stats.metrics.activeAdmissions || 0, trend: '↑ 5', isGood: true },
                    { label: 'ICU Occupancy', val: '75%', trend: '↑ 6%', isGood: false },
                    { label: 'Emergency Admissions', val: '2', trend: 'Today', isGood: true },
                    { label: 'Readmissions', val: '1', trend: 'Today', isGood: false },
                    { label: 'OT Utilization', val: '62%', trend: 'Today', isGood: true }
                  ].map((item, idx) => (
                    <div key={idx} style={{ padding: '12px', backgroundColor: 'var(--app-bg)', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>{item.label}</span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>{item.val}</span>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#10b981' }}>
                          {item.trend}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="page-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bed Management Overview</h3>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ width: '110px', height: '110px', position: 'relative' }}>
                    <ReactECharts option={bedDoughnutOption} style={{ height: '110px', width: '110px' }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 800 }}>Total Beds</span>
                      <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>{stats.totalBeds || 50}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    {[
                      { name: 'Occupied', count: stats.bedStats?.find((b: any) => b.status === 'Occupied')?.count || 0, color: '#3b82f6' },
                      { name: 'Available', count: stats.bedStats?.find((b: any) => b.status === 'Available')?.count || 0, color: '#10b981' },
                      { name: 'Cleaning', count: stats.bedStats?.find((b: any) => b.status === 'Cleaning')?.count || 0, color: '#f59e0b' },
                      { name: 'Maintenance', count: stats.bedStats?.find((b: any) => b.status === 'Maintenance')?.count || 0, color: '#7c3aed' }
                    ].map((item, idx) => {
                      const total = stats.totalBeds || 1;
                      const pct = Math.round((item.count * 100) / total);
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.color }} />
                            <span style={{ color: '#64748b', fontWeight: 700 }}>{item.name}</span>
                          </div>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>{item.count} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'General Ward', val: `${stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('general'))?.occupied || 0}/${stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('general'))?.total || 0}`, pct: stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('general'))?.total ? Math.round((stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('general'))?.occupied * 100) / stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('general'))?.total) : 0, color: '#3b82f6' },
                    { label: 'Private Rooms', val: `${stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('private'))?.occupied || 0}/${stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('private'))?.total || 0}`, pct: stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('private'))?.total ? Math.round((stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('private'))?.occupied * 100) / stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('private'))?.total) : 0, color: '#10b981' },
                    { label: 'ICU Beds', val: `${stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('icu'))?.occupied || 0}/${stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('icu'))?.total || 0}`, pct: stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('icu'))?.total ? Math.round((stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('icu'))?.occupied * 100) / stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('icu'))?.total) : 0, color: '#7c3aed' }
                  ].map((ward, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                        <span>{ward.label}</span>
                        <span>{ward.val} ({ward.pct}%)</span>
                      </div>
                      <div style={{ height: '5px', backgroundColor: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', backgroundColor: ward.color, width: `${ward.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="page-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IPD Summary (Today)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
                  {[
                    { label: 'Admissions', val: stats.metrics.admissionsToday || 0, desc: 'Patients admitted today' },
                    { label: 'Discharges', val: stats.metrics.dischargesToday || 0, desc: 'Patients discharged today' },
                    { label: 'Active Patients', val: stats.metrics.activeAdmissions || 0, desc: 'Currently in ward' },
                    { label: 'Avg. Length of Stay', val: '3.6 Days', desc: 'Average hospital stay' }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{item.label}</span>
                        <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>{item.desc}</span>
                      </div>
                      <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
              <div className="page-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Today's Appointments</h3>
                  <button onClick={() => navigate('/tenant/appointments/doctor-calendar?tab=Operational+Calendar')} style={{ fontSize: '12px', fontWeight: 800, color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer' }}>
                    View Calendar
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px', overflowX: 'auto' }}>
                  {[
                    { key: 'upcoming', label: 'Upcoming', count: displayAppointments.filter((a: any) => a.tab === 'upcoming').length, color: '#059669', bg: '#ecfdf5' },
                    { key: 'inprogress', label: 'In Progress', count: displayAppointments.filter((a: any) => a.tab === 'inprogress').length, color: '#2563eb', bg: '#eff6ff' },
                    { key: 'completed', label: 'Completed', count: displayAppointments.filter((a: any) => a.tab === 'completed').length, color: '#7c3aed', bg: '#f5f3ff' },
                    { key: 'cancelled', label: 'Cancelled', count: displayAppointments.filter((a: any) => a.tab === 'cancelled').length, color: '#dc2626', bg: '#fef2f2' }
                  ].map((tab: any) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveApptTab(tab.key as any)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        color: activeApptTab === tab.key ? tab.color : '#64748b',
                        backgroundColor: activeApptTab === tab.key ? tab.bg : '#f8fafc',
                        border: activeApptTab === tab.key ? `1px solid ${tab.color}30` : '1px solid #e2e8f0',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {tab.label} <span style={{ fontSize: '9px', backgroundColor: activeApptTab === tab.key ? '#ffffff' : '#e2e8f0', color: activeApptTab === tab.key ? tab.color : '#64748b', padding: '1px 6px', borderRadius: '10px' }}>{tab.count}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  {displayAppointments.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '140px', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
                      No appointments scheduled for today
                    </div>
                  ) : (
                    <>
                      {displayAppointments
                        .filter((appt: any) => appt.tab === activeApptTab)
                        .map((appt: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'var(--app-bg)', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', width: '60px' }}>{appt.time}</span>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{appt.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{appt.type}</span>
                              <span style={{ fontSize: '10px', fontWeight: 800, color: appt.badgeColor, backgroundColor: appt.badgeBg, padding: '2px 8px', borderRadius: '6px' }}>{appt.status}</span>
                            </div>
                          </div>
                        ))}
                      {displayAppointments.filter((appt: any) => appt.tab === activeApptTab).length === 0 && (
                        <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No appointments in this tab today</div>
                      )}
                    </>
                  )}
                </div>
                <button onClick={() => navigate('/tenant/appointments')} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 800, color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer', marginTop: '16px', padding: 0 }}>
                  View all appointments →
                </button>
              </div>

              <div className="page-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IPD Overview</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { label: 'Admissions', val: stats.metrics.admissionsToday || 0, desc: 'Today' },
                    { label: 'Discharges', val: stats.metrics.dischargesToday || 0, desc: 'Today' },
                    { label: 'Active Patients', val: stats.metrics.activeAdmissions || 0, desc: 'Today' },
                    { label: 'Avg. Length of Stay', val: '3.6 Days', desc: 'Today' }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>{item.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{item.val} <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>{item.desc}</span></span>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '16px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>Patient Distribution</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { label: 'General Ward', val: stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('general'))?.occupied || 0, total: stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('general'))?.total || 1, color: '#3b82f6' },
                      { label: 'Private Rooms', val: stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('private'))?.occupied || 0, total: stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('private'))?.total || 1, color: '#10b981' },
                      { label: 'ICU Beds', val: stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('icu'))?.occupied || 0, total: stats.wardStats?.find((w: any) => w.label.toLowerCase().includes('icu'))?.total || 1, color: '#7c3aed' }
                    ].map((dist, idx) => {
                      const pct = dist.total ? Math.round((dist.val * 100) / dist.total) : 0;
                      return (
                        <div key={idx}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                            <span>{dist.label}</span>
                            <span>{dist.val}/{dist.total} Beds</span>
                          </div>
                          <div style={{ height: '4px', backgroundColor: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', backgroundColor: dist.color, width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {statsLoading ? (
                <div className="page-card skeleton-shimmer" style={{ height: '320px', borderRadius: '24px' }} />
              ) : (
                <div className="page-card font-sans" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Revenue Overview (Today)</h3>
                    <button onClick={() => navigate('/tenant/reports')} style={{ border: 'none', background: 'none', color: '#3b82f6', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>View report</button>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>{formatCurrency(animatedRevenue)}</div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>↑ 18% vs yesterday</div>
                  </div>

                  <div style={{ height: '80px', width: '100%', marginBottom: '16px' }}>
                    <ReactECharts option={professionalRevenueOption} style={{ height: '80px', width: '100%' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                    {displayRevenueItems.map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.color }} />
                            <span style={{ color: '#64748b', fontWeight: 700 }}>{item.name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', fontWeight: 800, color: '#0f172a' }}>
                            <span>{item.val}</span>
                            <span style={{ color: '#94a3b8' }}>{item.pct}</span>
                          </div>
                        </div>
                        <div style={{ height: '3px', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ 
                            height: '100%', 
                            backgroundColor: item.color, 
                            borderRadius: '2px',
                            width: isFilled ? item.pct : '0%',
                            transition: 'width 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                            transitionDelay: `${idx * 150}ms`
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="page-card" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: '0 0 24px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reports & Insights</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '24px' }}>
                {[
                  { title: 'Clinical Reports', desc: 'OPD, IPD, diagnosis and treatment analytics', path: '/tenant/reports', color: '#3b82f6', bg: '#eff6ff', icon: HeartPulse },
                  { title: 'Financial Reports', desc: 'Revenue, payments, outstanding and collections', path: '/billing', color: '#10b981', bg: '#ecfdf5', icon: TrendingUp },
                  { title: 'Operational Reports', desc: 'Bed occupancy, patient flow, capacity and utilization', path: '/tenant/reports', color: '#f59e0b', bg: '#fffbeb', icon: Activity },
                  { title: 'Pharmacy Reports', desc: 'Inventory, sales, expiry and purchase analytics', path: '/tenant/pharmacy', color: '#7c3aed', bg: '#f5f3ff', icon: Pill },
                  { title: 'Diagnostics Reports', desc: 'Test statistics, TAT, productivity and inventory', path: '/tenant/lab', color: '#0d9488', bg: '#f0fdf4', icon: FlaskConical },
                  { title: 'Nursing Reports', desc: 'Nursing activities, tasks and patient care summary', path: '/tenant/reports', color: '#ec4899', bg: '#fdf2f8', icon: FileText }
                ].map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        padding: '20px', 
                        backgroundColor: '#ffffff', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '20px',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: card.bg, color: card.color, display: 'grid', placeItems: 'center', marginBottom: '16px' }}>
                          <Icon size={20} />
                        </div>
                        <h4 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{card.title}</h4>
                        <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748b', fontWeight: 500, lineHeight: '1.4' }}>{card.desc}</p>
                      </div>
                      <button 
                        onClick={() => navigate(card.path)}
                        style={{ 
                          alignSelf: 'flex-start',
                          border: 'none', 
                          background: 'none', 
                          color: card.color, 
                          fontSize: '12px', 
                          fontWeight: 800, 
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        View report <ChevronRight size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* PREMIUM UPGRADE CHECKOUT DIALOG MODAL */}
      {upgradeModal.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '28px',
            padding: '32px',
            width: '460px',
            maxWidth: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            textAlign: 'center',
            position: 'relative'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 10px 20px -6px rgba(124, 58, 237, 0.4)'
            }}>
              <Zap size={26} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', marginBottom: '8px' }}>
              Upgrade to {upgradeModal.tier.toUpperCase()} Tier
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px', lineHeight: '1.5' }}>
              Unlock advanced operations, clinical insights, and integrated surveillance systems.
            </p>
            
            <div style={{
              backgroundColor: 'var(--app-bg)',
              borderRadius: '20px',
              padding: '20px',
              marginBottom: '28px',
              textAlign: 'left',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
                Included Capabilities:
              </div>
              {upgradeModal.tier === 'standard' ? (
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.4' }}>
                  <li>💊 **Pharmacy Dashboard & Inventory**: Real-time stock counts, alerts, prescription queue.</li>
                  <li>🧪 **Integrated Diagnostics & Laboratory**: Dynamic order entry and result tracking.</li>
                  <li>⚙️ **Hospital Settings Masters**: Custom configs for department, room, bed types.</li>
                </ul>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.4' }}>
                  <li>🛏️ **Inpatient (IPD) Bed Map**: Fully visual ward, room, and bed layout manager.</li>
                  <li>📈 **AI Predictive Analytics**: Consultation throughput prediction, clinical workload complexity mix.</li>
                  <li>👥 **Dynamic RBAC & Staff Management**: HIPAA-compliant detailed role permissions.</li>
                  <li>💳 **Insurance Management**: Claim submissions, tracking, and settlement desk.</li>
                </ul>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => {
                  setUpgradeModal({ isOpen: false, tier: "" });
                }}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                }}
              >
                Request Upgrade
              </button>
              <button 
                onClick={() => setUpgradeModal({ isOpen: false, tier: "" })}
                style={{
                  padding: '14px 20px',
                  borderRadius: '12px',
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
