import { useState, useEffect } from "react";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import PharmacyDashboard from "./PharmacyDashboard";
import InventoryList from "./InventoryList";
import PrescriptionQueue from "./PrescriptionQueue";
import SuppliersList from "./SuppliersList";
import InwardRegister from "./InwardRegister";
import { LayoutDashboard, Package, Pill, Truck, BarChart3, FileText } from 'lucide-react';

export default function PharmacyManagementPage() {
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, inventory, queue, suppliers, reports

  useEffect(() => {
    const handleTabChange = (e: any) => {
      if (e.detail) setActiveTab(e.detail);
    };
    window.addEventListener('changePharmacyTab', handleTabChange);
    return () => window.removeEventListener('changePharmacyTab', handleTabChange);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <PharmacyDashboard embedded={true} />;
      case "inventory":
        return <InventoryList embedded={true} />;
      case "queue":
        return <PrescriptionQueue embedded={true} />;
      case "inward":
        return <InwardRegister embedded={true} />;
      case "suppliers":
        return <SuppliersList embedded={true} />;
      case "reports":
        return (
          <div style={{ padding: '40px', textAlign: 'center', background: 'white', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
            <BarChart3 size={48} style={{ color: '#94a3b8', marginBottom: '20px' }} />
            <h2 style={{ fontWeight: 900 }}>Advanced Pharmacy Analytics</h2>
            <p style={{ color: '#64748b' }}>Expiry surveillance, revenue intelligence, and ABC/VED analysis reports are being synthesized.</p>
          </div>
        );
      default:
        return <PharmacyDashboard embedded={true} />;
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'inventory', label: 'Inventory', icon: <Package size={18} /> },
    { id: 'queue', label: 'Prescription Queue', icon: <Pill size={18} /> },
    { id: 'inward', label: 'Inward Register', icon: <FileText size={18} /> },
    { id: 'suppliers', label: 'Suppliers', icon: <Truck size={18} /> },
    { id: 'reports', label: 'Reports & Analytics', icon: <BarChart3 size={18} /> },
  ];

  return (
    <div className="dashboard-layout" style={{ background: 'var(--app-bg)', minHeight: '100vh' }}>
      <Sidebar />
      <main className="main-content" style={{ padding: '32px' }}>
        <Header title="Integrated Pharmacy Management" />

        <div style={{ display: 'flex', gap: '32px', marginTop: '8px' }}>
          {/* Navigation Sidebar-like menu inside the content for local module navigation */}
          <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
             {menuItems.map((item) => (
               <button
                 key={item.id}
                 onClick={() => setActiveTab(item.id)}
                 style={{
                   display: 'flex',
                   alignItems: 'center',
                   gap: '12px',
                   padding: '16px 20px',
                   borderRadius: '16px',
                   border: 'none',
                   background: activeTab === item.id ? '#0f172a' : 'transparent',
                   color: activeTab === item.id ? 'white' : '#64748b',
                   fontWeight: activeTab === item.id ? 800 : 600,
                   fontSize: '14px',
                   cursor: 'pointer',
                   transition: 'all 0.2s ease',
                   textAlign: 'left'
                 }}
               >
                 {item.icon}
                 {item.label}
               </button>
             ))}
          </div>

          <div style={{ flex: 1 }}>
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}
