import { useState, useEffect } from 'react';
import Header from '../components/Header';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  User,
  Activity
} from 'lucide-react';

const ReportsPage = () => {
  const { user } = useAuth();
  const isManager = ['hr', 'admin', 'ceo'].includes(user?.role);
  const [employees, setEmployees] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [selectedEmpId, setSelectedEmpId] = useState('');
  
  // Report data states
  const [monthlyData, setMonthlyData] = useState([]);
  const [empReport, setEmpReport] = useState(null);
  const [loading, setLoading] = useState(true);

  // Month options (e.g. past 6 months)
  const [monthOptions, setMonthOptions] = useState([]);

  useEffect(() => {
    // Generate past 6 months options
    const options = [];
    const d = new Date();
    for (let i = 0; i < 6; i++) {
      const monthStr = d.toISOString().substring(0, 7);
      options.push(monthStr);
      d.setMonth(d.getMonth() - 1);
    }
    setMonthOptions(options);
  }, []);

  const fetchEmployees = async () => {
    if (!isManager) return;
    try {
      const res = await client.get('/employees?per_page=100');
      setEmployees(res.data.employees);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchMonthlyReport = async () => {
    try {
      setLoading(true);
      const res = await client.get(`/reports/monthly?month=${selectedMonth}`);
      setMonthlyData(res.data.chart_data);
    } catch (err) {
      console.error('Error fetching monthly report:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeReport = async () => {
    if (!selectedEmpId) {
      setEmpReport(null);
      return;
    }
    try {
      setLoading(true);
      const res = await client.get(`/reports/employee/${selectedEmpId}?month=${selectedMonth}`);
      setEmpReport(res.data);
    } catch (err) {
      console.error('Error fetching employee report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [isManager]);

  useEffect(() => {
    if (!isManager && user?.employee_id) {
      setSelectedEmpId(user.employee_id);
    }
  }, [user, isManager]);

  useEffect(() => {
    if (selectedEmpId) {
      fetchEmployeeReport();
    } else {
      fetchMonthlyReport();
    }
  }, [selectedMonth, selectedEmpId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', direction: 'rtl', textAlign: 'right' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Header title="تقارير ومؤشرات الأداء" />
      </div>

      {/* Selectors Bar */}
      <div className="card" style={{ display: 'flex', gap: '1rem', padding: '1rem', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={16} color="var(--text-dim)" />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>الشهر المستهدف:</span>
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            background: 'rgba(0, 39, 73, 0.02)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '0.6rem 1rem',
            color: 'var(--text-main)',
            outline: 'none',
            minWidth: '150px',
            direction: 'rtl'
          }}
        >
          {monthOptions.map(m => (
            <option key={m} value={m} style={{ background: 'var(--bg-card)' }}>{m}</option>
          ))}
        </select>

        {isManager && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '1rem' }}>
              <User size={16} color="var(--text-dim)" />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>تصفية الموظف:</span>
            </div>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              style={{
                background: 'rgba(0, 39, 73, 0.02)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '0.6rem 1rem',
                color: 'var(--text-main)',
                outline: 'none',
                minWidth: '220px',
                direction: 'rtl'
              }}
            >
              <option value="">ملخص أداء الشركة بالكامل</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.employee_id} style={{ background: 'var(--bg-card)' }}>{emp.name} ({emp.employee_id})</option>
              ))}
            </select>
          </>
        )}
      </div>

      {loading ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>جاري تحضير وتجميع التقارير الإحصائية...</div>
      ) : empReport ? (
        /* Individual Employee Report View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Employee Stats Grid */}
          <div className="dashboard-grid">
            <div className="card stats-card" style={{ gridColumn: 'span 3' }}>
              <span className="stat-label">أيام الحضور الفعلية</span>
              <span className="stat-value">{empReport.summary.present} يوم</span>
            </div>
            <div className="card stats-card" style={{ gridColumn: 'span 3' }}>
              <span className="stat-label">مرات التأخير عن العمل</span>
              <span className="stat-value" style={{ color: empReport.summary.late > 0 ? 'var(--danger)' : 'var(--accent)' }}>
                {empReport.summary.late} مرة
              </span>
            </div>
            <div className="card stats-card" style={{ gridColumn: 'span 3' }}>
              <span className="stat-label">إجمالي ساعات العمل</span>
              <span className="stat-value" style={{ color: '#60a5fa' }}>{empReport.summary.total_hours} ساعة</span>
            </div>
            <div className="card stats-card" style={{ gridColumn: 'span 3' }}>
              <span className="stat-label">متوسط الساعات اليومي</span>
              <span className="stat-value">{empReport.summary.average_hours} ساعة</span>
            </div>
          </div>

          {/* Employee Logs Calendar List */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>سجل العمل التفصيلي للموظف: {empReport.name}</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'right' }}>التاريخ</th>
                  <th style={{ textAlign: 'right' }}>تسجيل الحضور</th>
                  <th style={{ textAlign: 'right' }}>تسجيل الانصراف</th>
                  <th style={{ textAlign: 'right' }}>ساعات العمل</th>
                  <th style={{ textAlign: 'right' }}>الحالة</th>
                  <th style={{ textAlign: 'right' }}>ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {empReport.records.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                      لا توجد سجلات دوام مسجلة لهذا الموظف خلال هذا الشهر.
                    </td>
                  </tr>
                ) : (
                  empReport.records.map((rec, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{rec.date}</td>
                      <td>{rec.check_in || '-'}</td>
                      <td>{rec.check_out || '-'}</td>
                      <td>{rec.hours_worked !== null ? `${rec.hours_worked} ساعة` : '-'}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: rec.status === 'on_time' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: rec.status === 'on_time' ? 'var(--accent)' : 'var(--danger)'
                        }}>
                          {rec.status === 'on_time' ? 'منضبط' : 'متأخر'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{rec.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Company-wide Monthly Overview Chart View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>مخطط حضور وانصراف موظفي الشركة — لشهر {selectedMonth}</h3>
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={11} tickFormatter={(tick) => tick.split('-')[2]} />
                  <YAxis stroke="var(--text-dim)" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-card)', 
                      borderColor: 'var(--glass-border)',
                      color: 'var(--text-main)',
                  borderRadius: '8px',
                      textAlign: 'right'
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="var(--primary)" strokeWidth={2} name="حضور" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="late" stroke="var(--danger)" strokeWidth={2} name="تأخير" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
