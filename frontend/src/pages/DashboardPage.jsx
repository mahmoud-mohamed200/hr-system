import { useState, useEffect } from 'react';
import Header from '../components/Header';
import client from '../api/client';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Camera, 
  RefreshCw,
  Video
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const DashboardPage = () => {
  const { user } = useAuth();
  const isCeo = user?.role === 'ceo';
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    cameraCount: 0
  });
  const [deptRates, setDeptRates] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const response = await client.get('/dashboard/stats');
      const { stats: fetchedStats, departmentRates, recentEvents: fetchedEvents } = response.data;
      
      setStats(fetchedStats);
      setDeptRates(departmentRates);
      setRecentEvents(fetchedEvents);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSelfCheck = async (type) => {
    const toastId = toast.loading(type === 'in' ? 'جاري تسجيل حضورك...' : 'جاري تسجيل انصرافك...');
    try {
      const endpoint = type === 'in' ? '/attendance/self-check-in' : '/attendance/self-check-out';
      const res = await client.post(endpoint);
      toast.success(res.data.message || 'تمت العملية بنجاح', { id: toastId });
      fetchDashboardData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'فشلت العملية اليدوية', { id: toastId });
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  // --- ADMIN DASHBOARD VIEW ---
  if (user?.role === 'admin') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', direction: 'rtl', textAlign: 'right' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <Header title="لوحة تحكم النظام والرواتب" />
          <button 
            onClick={handleRefresh} 
            disabled={refreshing}
            style={{
              background: 'var(--glass)',
              border: '1px solid var(--glass-border)',
              color: 'var(--primary)',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
          >
            <RefreshCw size={16} className={refreshing ? 'spin-animation' : ''} />
            <span>تحديث البيانات</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="dashboard-grid">
          <div className="card stats-card" style={{ gridColumn: 'span 3' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label">إجمالي الأصول والعهد</span>
              <Users size={20} color="var(--primary)" />
            </div>
            <span className="stat-value">{stats.totalAssets || 0}</span>
          </div>

          <div className="card stats-card" style={{ gridColumn: 'span 3' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label">العهد المعارة حالياً</span>
              <UserCheck size={20} color="var(--accent)" />
            </div>
            <span className="stat-value" style={{ color: 'var(--accent)' }}>{stats.assignedAssets || 0}</span>
          </div>

          <div className="card stats-card" style={{ gridColumn: 'span 3' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label">الموظفين النشطين بالشركة</span>
              <Users size={20} color="var(--primary)" />
            </div>
            <span className="stat-value">{stats.totalEmployees || 0}</span>
          </div>

          <div className="card stats-card" style={{ gridColumn: 'span 3' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label">مسير الرواتب للشهر الحالي</span>
              <Clock size={20} color={stats.payrollStatus === 'approved' ? 'var(--accent)' : '#eab308'} />
            </div>
            <span className="stat-value" style={{ color: stats.payrollStatus === 'approved' ? 'var(--accent)' : '#eab308', fontSize: '1.4rem', marginTop: '0.5rem' }}>
              {stats.payrollStatus === 'approved' ? 'معتمد ومغلق' : 'مسودة (انتظار الاعتماد)'}
            </span>
          </div>
        </div>

        {/* Quick Links Card */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>إجراءات النظام السريعة</h3>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <a href="/settings" style={{ textDecoration: 'none', background: 'rgba(79, 70, 229, 0.05)', border: '1px solid var(--glass-border)', padding: '1.5rem', borderRadius: '12px', flex: '1', minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'all 0.3s ease' }}>
              <h4 style={{ color: 'var(--primary)', fontWeight: 'bold' }}>إعدادات النظام العامة</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>تعديل مواقيت العمل، اسم الشركة، أيام العطل والورديات.</p>
            </a>
            <a href="/assets" style={{ textDecoration: 'none', background: 'rgba(34, 197, 94, 0.05)', border: '1px solid var(--glass-border)', padding: '1.5rem', borderRadius: '12px', flex: '1', minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'all 0.3s ease' }}>
              <h4 style={{ color: 'var(--accent)', fontWeight: 'bold' }}>جرد وإدارة العهد والأصول</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>إضافة عهد جديدة، تسليم العهد للموظفين، واسترجاعها للمخزن.</p>
            </a>
            <a href="/payroll" style={{ textDecoration: 'none', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--glass-border)', padding: '1.5rem', borderRadius: '12px', flex: '1', minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'all 0.3s ease' }}>
              <h4 style={{ color: '#ef4444', fontWeight: 'bold' }}>احتساب واعتماد الرواتب</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>مراجعة خصومات الغياب والتأخير والقروض، واعتماد Payslips الموظفين.</p>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // --- EMPLOYEE DASHBOARD VIEW ---
  if (user?.role === 'employee') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', direction: 'rtl', textAlign: 'right' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <Header title="لوحة التحكم الشخصية" />
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {!isCeo && (
              <>
                <button 
                  onClick={() => handleSelfCheck('in')}
                  style={{
                    background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.5rem 1.2rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                  }}
                >
                  <UserCheck size={16} />
                  <span>تسجيل حضور</span>
                </button>

                <button 
                  onClick={() => handleSelfCheck('out')}
                  style={{
                    background: 'rgba(0, 39, 73, 0.05)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-main)',
                    padding: '0.5rem 1.2rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <UserX size={16} color="var(--primary)" />
                  <span>تسجيل انصراف</span>
                </button>
              </>
            )}

            <button 
              onClick={handleRefresh} 
              disabled={refreshing}
              style={{
                background: 'var(--glass)',
                border: '1px solid var(--glass-border)',
                color: 'var(--primary)',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: '600',
                transition: 'all 0.3s ease'
              }}
            >
              <RefreshCw size={16} className={refreshing ? 'spin-animation' : ''} />
              <span>تحديث</span>
            </button>
          </div>
        </div>

        {/* Today's Status Banner */}
        <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', padding: '1.5rem', background: 'rgba(79, 70, 229, 0.02)', border: '1px solid var(--primary)' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>حالة حضورك اليوم:</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary)', marginTop: '0.3rem' }}>{stats.todayStatus}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>وقت تسجيل الدخول:</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '0.3rem' }}>{stats.todayCheckIn || 'لم يسجل'}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>وقت تسجيل الانصراف:</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '0.3rem' }}>{stats.todayCheckOut || 'لم يسجل'}</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="dashboard-grid">
          <div className="card stats-card" style={{ gridColumn: 'span 4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label">أيام الحضور هذا الشهر</span>
              <UserCheck size={20} color="var(--accent)" />
            </div>
            <span className="stat-value" style={{ color: 'var(--accent)' }}>{stats.presentDays || 0}</span>
          </div>

          <div className="card stats-card" style={{ gridColumn: 'span 4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label">مرات التأخير هذا الشهر</span>
              <Clock size={20} color="var(--danger)" />
            </div>
            <span className="stat-value" style={{ color: 'var(--danger)' }}>{stats.lateDays || 0}</span>
          </div>

          <div className="card stats-card" style={{ gridColumn: 'span 4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stat-label">أيام الغياب هذا الشهر</span>
              <UserX size={20} color="#94a3b8" />
            </div>
            <span className="stat-value" style={{ color: '#94a3b8' }}>{stats.absentDays || 0}</span>
          </div>
        </div>

        {/* Personal Logs Table */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>سجل حضورك الأخير</h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {recentEvents.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>لا توجد سجلات حضور مسجلة لك</p>
            ) : (
              <table className="data-table" style={{ direction: 'rtl' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'right' }}>التاريخ</th>
                    <th style={{ textAlign: 'right' }}>وقت الحضور</th>
                    <th style={{ textAlign: 'right' }}>وقت الانصراف</th>
                    <th style={{ textAlign: 'right' }}>الحالة</th>
                    <th style={{ textAlign: 'right' }}>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map(event => (
                    <tr key={event.id}>
                      <td style={{ fontSize: '0.85rem' }}>{event.date}</td>
                      <td style={{ fontSize: '0.85rem' }}>{event.check_in || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{event.check_out || '—'}</td>
                      <td>
                        <span style={{ 
                          color: event.status === 'منضبط' ? 'var(--accent)' : event.status === 'متأخر' ? 'var(--danger)' : '#94a3b8', 
                          fontSize: '0.8rem', 
                          fontWeight: '600' 
                        }}>
                          ● {event.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{event.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- HR/CEO DASHBOARD VIEW ---
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', direction: 'rtl', textAlign: 'right' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Header title="لوحة الحضور والمتابعة" />
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {!isCeo && (
            <>
              <button 
                onClick={() => handleSelfCheck('in')}
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.5rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                }}
              >
                <UserCheck size={16} />
                <span>تسجيل حضور يدوي</span>
              </button>

              <button 
                onClick={() => handleSelfCheck('out')}
                style={{
                  background: 'rgba(0, 39, 73, 0.05)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-main)',
                  padding: '0.5rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <UserX size={16} color="var(--primary)" />
                <span>تسجيل انصراف يدوي</span>
              </button>
            </>
          )}

          <button 
            onClick={handleRefresh} 
            disabled={refreshing}
            style={{
              background: 'var(--glass)',
              border: '1px solid var(--glass-border)',
              color: 'var(--primary)',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
          >
            <RefreshCw size={16} className={refreshing ? 'spin-animation' : ''} />
            <span>تحديث البيانات</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="dashboard-grid">
        <div className="card stats-card" style={{ gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">إجمالي الموظفين</span>
            <Users size={20} color="var(--primary)" />
          </div>
          <span className="stat-value">{stats.totalEmployees}</span>
        </div>

        <div className="card stats-card" style={{ gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">حاضرون اليوم</span>
            <UserCheck size={20} color="var(--accent)" />
          </div>
          <span className="stat-value" style={{ color: 'var(--accent)' }}>{stats.presentToday}</span>
        </div>

        <div className="card stats-card" style={{ gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">حالات التأخير</span>
            <Clock size={20} color="var(--danger)" />
          </div>
          <span className="stat-value" style={{ color: 'var(--danger)' }}>{stats.lateToday}</span>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Recent Attendance Logs */}
        <div className="card attendance-logs" style={{ gridColumn: 'span 12' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', textAlign: 'right' }}>أحدث عمليات تسجيل الحضور</h3>
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {recentEvents.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>لا توجد حركات حضور حتى الآن اليوم</p>
            ) : (
              <table className="data-table" style={{ direction: 'rtl' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'right' }}>الموظف</th>
                    <th style={{ textAlign: 'right' }}>الوقت</th>
                    <th style={{ textAlign: 'right' }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map(event => (
                    <tr key={event.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-start' }}>
                          <div className="user-avatar">{event.name[0]}</div>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{event.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{event.job_title}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{event.time}</td>
                      <td>
                        <span style={{ 
                          color: event.status === 'In' || event.status === 'حضور' ? 'var(--accent)' : '#60a5fa', 
                          fontSize: '0.75rem', 
                          fontWeight: '600' 
                        }}>
                          ● {event.status === 'In' ? 'دخول' : event.status === 'Out' ? 'خروج' : event.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', textAlign: 'right' }}>نسبة حضور الأقسام اليوم (%)</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={deptRates}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
              <XAxis dataKey="department" stroke="var(--text-dim)" fontSize={12} />
              <YAxis stroke="var(--text-dim)" domain={[0, 100]} fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--bg-card)', 
                  borderColor: 'var(--glass-border)',
                  color: 'var(--text-main)',
                  borderRadius: '8px',
                  textAlign: 'right'
                }}
              />
              <Bar dataKey="rate" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spin 1.2s linear infinite;
        }
        .spinner {
          width: 50px;
          height: 50px;
          border: 3px solid var(--glass-border);
          border-top-color: var(--primary);
          borderRadius: 50%;
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default DashboardPage;
