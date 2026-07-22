import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";

export default function PatientsPage() {
  const patients = [
    { id: "P-10021", name: "Alice Smith", phone: "+1 234 567 890", lastVisit: "2026-04-25" },
    { id: "P-10022", name: "Bob Johnson", phone: "+1 234 567 891", lastVisit: "2026-04-26" },
    { id: "P-10023", name: "Charlie Brown", phone: "+1 234 567 892", lastVisit: "2026-04-27" },
    { id: "P-10024", name: "John Doe", phone: "+1 234 567 893", lastVisit: "2026-04-28" },
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">
        <Header title="Patient Directory" />

        <div className="page-card">
          <div className="section-header" style={{ padding: '24px' }}>
             <h3 className="section-title">Registered Patients</h3>
             <button className="button-primary">+ Add Patient</button>
          </div>
          
          <table className="card-table">
            <thead>
              <tr style={{ textAlign: 'left', background: 'var(--app-bg)' }}>
                <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>PATIENT ID</th>
                <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>NAME</th>
                <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>CONTACT</th>
                <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>LAST VISIT</th>
                <th style={{ padding: '16px 24px', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p, i) => (
                <tr key={i}>
                  <td>{p.id}</td>
                  <td>{p.name}</td>
                  <td style={{ color: '#64748b' }}>{p.phone}</td>
                  <td>{p.lastVisit}</td>
                  <td>
                    <button className="button-link">View Case</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
