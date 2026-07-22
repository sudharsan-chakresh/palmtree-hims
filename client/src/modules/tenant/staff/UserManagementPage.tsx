import { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { API_BASE_URL as API_BASE } from "../../../config/api";
import { Users, Shield, Activity, Key, Lock, Unlock } from 'lucide-react';

export default function UserManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'permissions' | 'audit'>('users');
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-tenant-id": localStorage.getItem("tenant") || ""
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes, permsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/hospital/users`, { headers }),
        axios.get(`${API_BASE}/api/hospital/rbac/roles`, { headers }),
        axios.get(`${API_BASE}/api/hospital/rbac/permissions`, { headers })
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      setPermissions(permsRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleUserStatusToggle = async (userId: string, currentStatus: boolean) => {
    try {
      const newStatus = currentStatus ? 'deactivate' : 'activate';
      await axios.put(`${API_BASE}/api/hospital/users/${userId}/status`, 
        { status: newStatus }, 
        { headers }
      );
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handlePasswordReset = async (userId: string) => {
    try {
      await axios.post(`${API_BASE}/api/hospital/users/${userId}/reset-password`, {}, { headers });
    } catch (err) { console.error(err); }
  };

  /*
  const handleRoleAssignment = async (userId: string, roleId: string) => {
    try {
      await axios.post(`${API_BASE}/api/hospital/users/${userId}/roles`, 
        { roleId }, 
        { headers }
      );
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleCreateRole = async (roleData: any) => {
    try {
      await axios.post(`${API_BASE}/api/hospital/rbac/roles`, roleData, { headers });
      fetchData();
      setShowRoleModal(false);
    } catch (err) { console.error(err); }
  };

  const handlePermissionAssignment = async (roleId: string, permissionIds: string[]) => {
    try {
      await axios.post(`${API_BASE}/api/hospital/rbac/roles/${roleId}/permissions`, 
        { permissionIds }, 
        { headers }
      );
      fetchData();
    } catch (err) { console.error(err); }
  };
  */

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--app-bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px' }}>
        <Header title="User Management & RBAC" />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', marginBottom: '40px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: '#ecfdf5', display: 'grid', placeItems: 'center', color: '#059669', boxShadow: '0 10px 15px -3px rgba(5, 150, 105, 0.1)' }}>
            <Shield size={24} />
          </div>
          <div>
            <p style={{ margin: '0 0 4px', color: '#475569', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Access Control Plane</p>
            <p style={{ margin: 0, color: '#64748b', fontSize: '15px', fontWeight: 500, maxWidth: '600px' }}>Comprehensive lifecycle and role-based access management for clinical staff.</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '4px', gap: '4px', marginBottom: '24px' }}>
          <button
            onClick={() => setActiveTab('users')}
            style={{
              flex: 1,
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              background: activeTab === 'users' ? 'white' : 'transparent',
              boxShadow: activeTab === 'users' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <Users size={18} />
            Users ({users.length})
          </button>
          
          <button
            onClick={() => setActiveTab('roles')}
            style={{
              flex: 1,
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              background: activeTab === 'roles' ? 'white' : 'transparent',
              boxShadow: activeTab === 'roles' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <Shield size={18} />
            Roles ({roles.length})
          </button>
          
          <button
            onClick={() => setActiveTab('permissions')}
            style={{
              flex: 1,
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              background: activeTab === 'permissions' ? 'white' : 'transparent',
              boxShadow: activeTab === 'permissions' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <Key size={18} />
            Permissions ({permissions.length})
          </button>
          
          <button
            onClick={() => setActiveTab('audit')}
            style={{
              flex: 1,
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              background: activeTab === 'audit' ? 'white' : 'transparent',
              boxShadow: activeTab === 'audit' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <Activity size={18} />
            Audit Log
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          
          {activeTab === 'users' && (
            <div style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>User Directory</h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="text"
                    placeholder="🔍 Search users..."
                    style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '300px' }}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <button
                    onClick={() => setShowUserModal(true)}
                    style={{ padding: '12px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Add User
                  </button>
                </div>
              </div>

              <div style={{ background: 'var(--app-bg)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                <input
                  type="text"
                  placeholder="Search users..."
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                {loading ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}>Loading users...</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', color: '#64748b', fontWeight: 800 }}>User</th>
                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', color: '#64748b', fontWeight: 800 }}>Email</th>
                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', color: '#64748b', fontWeight: 800 }}>Role</th>
                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', color: '#64748b', fontWeight: 800 }}>Status</th>
                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', color: '#64748b', fontWeight: 800 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '16px', fontSize: '14px', fontWeight: 600 }}>{user.name}</td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>{user.email}</td>
                          <td style={{ padding: '16px' }}>
                            <span style={{ 
                              padding: '4px 12px', 
                              borderRadius: '12px', 
                              fontSize: '12px', 
                              fontWeight: 600,
                              background: user.is_active ? '#10b981' : '#ef4444',
                              color: 'white'
                            }}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => setSelectedUser(user)}
                                style={{ padding: '6px 12px', borderRadius: '8px', background: '#f1f5f9', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Manage Roles
                              </button>
                              <button
                                onClick={() => handleUserStatusToggle(user.id, user.is_active)}
                                style={{ 
                                  padding: '6px 12px', 
                                  borderRadius: '8px', 
                                  background: user.is_active ? '#fee2e2' : '#10b981', 
                                  border: 'none', 
                                  color: 'white', 
                                  fontSize: '12px', 
                                  fontWeight: 600, 
                                  cursor: 'pointer' 
                                }}
                              >
                                {user.is_active ? <Unlock size={14} /> : <Lock size={14} />}
                                {user.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handlePasswordReset(user.id)}
                                style={{ padding: '6px 12px', borderRadius: '8px', background: '#3b82f6', border: 'none', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Reset Password
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>Role Management</h3>
                <button
                  onClick={() => alert('Role creation form will be implemented here...')}
                  style={{ padding: '12px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  + Create Role
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {roles.map((role) => (
                  <div key={role.id} style={{ 
                    background: 'white', 
                    borderRadius: '16px', 
                    border: '1px solid #e2e8f0', 
                    padding: '20px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>{role.name}</h4>
                        <p style={{ margin: '4px 0', color: '#64748b', fontSize: '13px' }}>{role.description}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => alert('Role management form will be implemented here...')}
                          style={{ padding: '6px 12px', borderRadius: '8px', background: '#f1f5f9', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {/* TODO: Delete role */}}
                          style={{ padding: '6px 12px', borderRadius: '8px', background: '#fee2e2', color: 'white', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div style={{ padding: '32px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1e293b', marginBottom: '24px' }}>Permission Management</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {permissions.map((permission) => (
                  <div key={permission.id} style={{ 
                    background: 'white', 
                    borderRadius: '16px', 
                    border: '1px solid #e2e8f0', 
                    padding: '20px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>{permission.key}</h4>
                        <p style={{ margin: '4px 0', color: '#64748b', fontSize: '12px' }}>{permission.description}</p>
                      </div>
                      <div style={{ 
                        padding: '4px 12px', 
                        borderRadius: '8px', 
                        background: '#10b981', 
                        color: 'white', 
                        fontSize: '11px', 
                        fontWeight: 600
                      }}>
                        System Permission
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>Audit Trail</h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <select
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                    defaultValue="all"
                  >
                    <option value="all">All Activities</option>
                    <option value="login">Logins Only</option>
                    <option value="role">Role Changes</option>
                    <option value="permission">Permission Changes</option>
                    <option value="failed">Failed Attempts</option>
                  </select>
                  <button
                    style={{ padding: '8px 16px', borderRadius: '8px', background: '#3b82f6', color: 'white', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Export Logs
                  </button>
                </div>
              </div>
              
              <div style={{ background: 'var(--app-bg)', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6' }}>
                  <Activity size={48} style={{ color: '#3b82f6', marginBottom: '16px' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                    <div style={{ 
                      background: 'white', 
                      borderRadius: '12px', 
                      border: '1px solid #e2e8f0', 
                      padding: '16px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>Recent Activity</h4>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Today</strong>
                          <ul style={{ marginLeft: '16px', listStyle: 'none', padding: 0 }}>
                            <li style={{ marginBottom: '6px', padding: '8px', background: '#f1f5f9', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Admin user logged in</span>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>2:30 PM</span>
                              </div>
                            </li>
                            <li style={{ marginBottom: '6px', padding: '8px', background: '#f1f5f9', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Role assigned: Doctor → Pharmacist</span>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>3:15 PM</span>
                              </div>
                            </li>
                            <li style={{ marginBottom: '6px', padding: '8px', background: '#fee2e2', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Permission revoked: PHARMACY_MANAGE</span>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>1:45 PM</span>
                              </div>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ 
                      background: 'white', 
                      borderRadius: '12px', 
                      border: '1px solid #e2e8f0', 
                      padding: '16px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>Statistics</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                        <div style={{ textAlign: 'center', padding: '16px', background: 'var(--app-bg)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: '#3b82f6', marginBottom: '8px' }}>247</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>Total Users</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '16px', background: 'var(--app-bg)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginBottom: '8px' }}>12</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>Active Today</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '16px', background: 'var(--app-bg)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', marginBottom: '8px' }}>8</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>Failed Logins</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Management Modal */}
        {showUserModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
                  {selectedUser ? 'Edit User' : 'Add New User'}
                </h2>
                <button onClick={() => setShowUserModal(false)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', color: '#64748b', fontSize: '18px' }}>✕</button>
              </div>
              
              {/* User form would go here */}
              <div style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', padding: '40px' }}>
                User management form will be implemented here...
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
