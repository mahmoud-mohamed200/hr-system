import { useState, useEffect } from 'react';
import Header from '../components/Header';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Calendar as CalendarIcon, 
  UserCheck, 
  UserX, 
  X,
  MapPin,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

const AttendancePage = () => {
  const { user: currentUser } = useAuth();
  const isAdminOrHr = ['admin', 'hr'].includes(currentUser?.role);
  const isCeo = currentUser?.role === 'ceo';

  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingGps, setCheckingGps] = useState(false);
  const [syncingBiometric, setSyncingBiometric] = useState(false);
  
  // Filters
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [search, setSearch] = useState('');

  // Manual Check-In/Out state
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualType, setManualType] = useState('in'); // 'in' or 'out'
  const [manualData, setManualData] = useState({
    employee_id: '',
    notes: ''
  });

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      let url = `/attendance?date=${date}&per_page=100`;
      if (selectedDept) url += `&department=${encodeURIComponent(selectedDept)}`;
      if (selectedStatus) url += `&status_filter=${selectedStatus}`;
      
      const res = await client.get(url);
      setRecords(res.data.records);
    } catch (err) {
      console.error('Error fetching attendance logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterData = async () => {
    try {
      const [deptRes, empRes] = await Promise.all([
        client.get('/departments'),
        client.get('/employees?per_page=100')
      ]);
      setDepartments(deptRes.data.departments);
      setEmployees(empRes.data.employees);
    } catch (err) {
      console.error('Error fetching filters data:', err);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [date, selectedDept, selectedStatus]);

  useEffect(() => {
    fetchFilterData();
  }, []);

  const handleManualAction = async (e) => {
    e.preventDefault();
    if (!manualData.employee_id) return;

    try {
      if (manualType === 'in') {
        await client.post('/attendance/check-in', manualData);
        toast.success('تم تسجيل الحضور اليدوي بنجاح');
      } else {
        await client.post('/attendance/check-out', manualData);
        toast.success('تم تسجيل الانصراف اليدوي بنجاح');
      }
      setManualModalOpen(false);
      setManualData({ employee_id: '', notes: '' });
      fetchAttendance();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'فشلت العملية اليدوية');
    }
  };

  const handleSelfCheck = async (type) => {
    setLoading(true);
    const toastId = toast.loading(type === 'in' ? 'جاري تسجيل حضورك...' : 'جاري تسجيل انصرافك...');
    try {
      const endpoint = type === 'in' ? '/attendance/self-check-in' : '/attendance/self-check-out';
      const res = await client.post(endpoint);
      toast.success(res.data.message || 'تمت العملية بنجاح', { id: toastId });
      fetchAttendance();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'فشلت العملية اليدوية', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleGpsCheck = (type) => {
    if (!navigator.geolocation) {
      toast.error('متصفحك لا يدعم تحديد الموقع الجغرافي GPS');
      return;
    }

    setCheckingGps(true);
    const toastId = toast.loading('جاري جلب إحداثيات موقعك الجغرافي...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const endpoint = type === 'in' ? '/attendance/gps-check-in' : '/attendance/gps-check-out';
          const res = await client.post(endpoint, {
            latitude,
            longitude,
            notes: 'حضور ذكي عبر الموبايل'
          });
          toast.success(res.data.message || 'تمت العملية بالـ GPS بنجاح', { id: toastId });
          fetchAttendance();
        } catch (err) {
          toast.error(err.response?.data?.detail || 'خارج النطاق الجغرافي المسموح به للشركة', { id: toastId });
        } finally {
          setCheckingGps(false);
        }
      },
      (error) => {
        toast.error('فشل جلب إحداثيات موقعك. يرجى تفعيل الـ GPS في متصفحك.', { id: toastId });
        setCheckingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSyncBiometric = async () => {
    setSyncingBiometric(true);
    const toastId = toast.loading('جاري سحب الحركات من أجهزة البصمة...');
    try {
      const res = await client.post('/attendance/sync-biometric');
      toast.success(res.data.message || 'تمت المزامنة بنجاح', { id: toastId });
      fetchAttendance();
    } catch (err) {
      toast.error('فشل مزامنة أجهزة البصمة', { id: toastId });
    } finally {
      setSyncingBiometric(false);
    }
  };

  // Filter local search
  const filteredRecords = records.filter(rec => 
    rec.employee_name.toLowerCase().includes(search.toLowerCase()) ||
    rec.employee_id.toLowerCase().includes(search.toLowerCase())
  );

  const translateStatus = (status) => {
    const map = {
      on_time: 'حاضر في الموعد',
      late: 'متأخر',
      absent: 'غياب',
      weekend: 'عطلة أسبوعية',
      leave: 'إجازة معتمدة',
      mission: 'مأمورية عمل'
    };
    return map[status] || status;
  };

  const translateSource = (source) => {
    const map = {
      gps: 'موبايل GPS',
      biometric: 'جهاز البصمة',
      manual: 'إدخال يدوي',
      camera: 'بصمة وجه'
    };
    return map[source] || source;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Header title="سجل حركات الحضور والانصراف" />
        
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Direct self manual check-in/out buttons */}
          {!isCeo && (
            <>
              <button 
                onClick={() => handleSelfCheck('in')}
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                }}
              >
                <UserCheck size={16} />
                <span>تسجيل حضور يدوي</span>
              </button>

              <button 
                onClick={() => handleSelfCheck('out')}
                disabled={loading}
                style={{
                  background: 'rgba(0, 39, 73, 0.05)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-main)',
                  padding: '0.6rem 1.2rem',
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

              {/* Employee GPS action buttons */}
              <button 
                onClick={() => handleGpsCheck('in')}
                disabled={checkingGps}
                style={{
                  background: 'rgba(0, 39, 73, 0.02)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-main)',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <MapPin size={16} color="var(--primary)" />
                <span>حضور بالـ GPS</span>
              </button>

              <button 
                onClick={() => handleGpsCheck('out')}
                disabled={checkingGps}
                style={{
                  background: 'rgba(0, 39, 73, 0.02)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-main)',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <MapPin size={16} color="var(--text-dim)" />
                <span>انصراف بالـ GPS</span>
              </button>
            </>
          )} 

          {isAdminOrHr && (
            <>
              <button 
                onClick={handleSyncBiometric}
                disabled={syncingBiometric}
                style={{
                  background: 'rgba(168, 85, 247, 0.1)',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  color: '#c084fc',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <RefreshCw size={16} className={syncingBiometric ? 'spin' : ''} />
                <span>سحب البصمة Biometric</span>
              </button>

              <button 
                onClick={() => { setManualType('in'); setManualModalOpen(true); }}
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  color: 'var(--accent)',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                تحضير يدوي
              </button>
              <button 
                onClick={() => { setManualType('out'); setManualModalOpen(true); }}
                style={{
                  background: 'rgba(96, 165, 250, 0.1)',
                  border: '1px solid rgba(96, 165, 250, 0.2)',
                  color: '#60a5fa',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                انصراف يدوي
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1rem', padding: '1rem', alignItems: 'center' }}>
        <div style={{ gridColumn: 'span 4', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            type="text"
            placeholder="بحث باسم الموظف أو الكود..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(0, 39, 73, 0.02)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '0.6rem 2.5rem 0.6rem 1rem',
              color: 'var(--text-main)',
              outline: 'none',
              textAlign: 'right'
            }}
          />
        </div>

        <div style={{ gridColumn: 'span 3', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <CalendarIcon size={16} color="var(--text-dim)" />
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(0, 39, 73, 0.02)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '0.6rem 1rem',
              color: 'var(--text-main)',
              outline: 'none',
              textAlign: 'right'
            }}
          />
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          style={{
            gridColumn: 'span 3',
            background: 'rgba(0, 39, 73, 0.02)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '0.6rem 1rem',
            color: 'var(--text-main)',
            outline: 'none',
            direction: 'rtl'
          }}
        >
          <option value="">جميع الأقسام</option>
          {departments.map(d => (
            <option key={d.id} value={d.name} style={{ background: 'var(--bg-card)' }}>{d.name}</option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{
            gridColumn: 'span 2',
            background: 'rgba(0, 39, 73, 0.02)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '0.6rem 1rem',
            color: 'var(--text-main)',
            outline: 'none',
            direction: 'rtl'
          }}
        >
          <option value="">جميع الحالات</option>
          <option value="on_time">حاضر في الموعد</option>
          <option value="late">متأخر</option>
          <option value="absent">غياب</option>
          <option value="leave">إجازة</option>
          <option value="mission">مأمورية</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>جاري تحميل حركات الحضور...</div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            لا توجد حركات حضور مطابقة لخيارات البحث.
          </div>
        ) : (
          <table className="data-table" style={{ marginTop: 0 }}>
            <thead>
              <tr style={{ background: 'rgba(0, 39, 73, 0.01)' }}>
                <th style={{ paddingRight: '1.5rem', textAlign: 'right' }}>كود الموظف</th>
                <th style={{ textAlign: 'right' }}>الموظف</th>
                <th style={{ textAlign: 'right' }}>القسم</th>
                <th style={{ textAlign: 'right' }}>توقيت الحضور</th>
                <th style={{ textAlign: 'right' }}>توقيت الانصراف</th>
                <th style={{ textAlign: 'right' }}>حالة الحضور</th>
                <th style={{ textAlign: 'right' }}>ساعات العمل</th>
                <th style={{ paddingLeft: '1.5rem', textAlign: 'left' }}>المصدر</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(rec => (
                <tr key={rec.id} className="table-row">
                  <td style={{ paddingRight: '1.5rem', fontWeight: 600, color: 'var(--primary)', textAlign: 'right' }}>{rec.employee_id}</td>
                  <td style={{ textAlign: 'right' }}>{rec.employee_name}</td>
                  <td style={{ textAlign: 'right' }}>{rec.department}</td>
                  <td style={{ textAlign: 'right' }}>
                    {rec.check_in ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-start' }}>
                        <UserCheck size={14} color="var(--accent)" />
                        {rec.check_in}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {rec.check_out ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-start' }}>
                        <UserX size={14} color="#60a5fa" />
                        {rec.check_out}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: rec.status === 'on_time' ? 'rgba(34, 197, 94, 0.1)' : rec.status === 'late' ? 'rgba(239, 68, 68, 0.1)' : rec.status === 'absent' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255,255,255,0.05)',
                      color: rec.status === 'on_time' ? 'var(--accent)' : rec.status === 'late' ? 'var(--danger)' : rec.status === 'absent' ? '#f87171' : 'var(--text-dim)'
                    }}>
                      {translateStatus(rec.status)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{rec.hours_worked !== null && rec.hours_worked !== undefined ? `${rec.hours_worked} ساعة` : '-'}</td>
                  <td style={{ paddingLeft: '1.5rem', color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'left' }}>
                    {translateSource(rec.source)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Manual Action Modal */}
      {manualModalOpen && (
        <div className="modal-backdrop">
          <div className="card" style={{ width: '420px', padding: '2rem', position: 'relative', textAlign: 'right' }}>
            <button 
              onClick={() => setManualModalOpen(false)}
              style={{ position: 'absolute', left: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>
              تسجيل {manualType === 'in' ? 'حضور' : 'انصراف'} يدوي لموظف
            </h3>

            <form onSubmit={handleManualAction} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">اختر الموظف *</label>
                <select 
                  required 
                  value={manualData.employee_id} 
                  onChange={(e) => setManualData(prev => ({ ...prev, employee_id: e.target.value }))}
                  className="modal-input"
                  style={{ direction: 'rtl' }}
                >
                  <option value="">اختر الموظف...</option>
                  {employees
                    .filter(emp => emp.employee_id !== 'EMP-7777' && emp.job_title !== 'الرئيس التنفيذي')
                    .map(emp => (
                      <option key={emp.id} value={emp.employee_id} style={{ background: 'var(--bg-card)' }}>
                        {emp.name} ({emp.employee_id})
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">ملاحظات / أسباب التحضير اليدوي</label>
                <input 
                  type="text" 
                  value={manualData.notes} 
                  onChange={(e) => setManualData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="مثال: نسى تسجيل البصمة، مأمورية سريعة..."
                  className="modal-input" 
                />
              </div>

              <button
                type="submit"
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  marginTop: '0.5rem',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                }}
              >
                تأكيد تسجيل ال{manualType === 'in' ? 'حضور' : 'انصراف'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .modal-input {
          width: 100%;
          background: rgba(0, 39, 73, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 0.6rem 0.75rem;
          color: var(--text-main);
          font-size: 0.9rem;
          outline: none;
          transition: all 0.3s ease;
        }
        .input-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-dim);
        }
        .table-row:hover {
          background: rgba(0, 39, 73, 0.01);
        }
      `}</style>
    </div>
  );
};

export default AttendancePage;
