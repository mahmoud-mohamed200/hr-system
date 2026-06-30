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

const getEgyptianHolidays = (year) => {
  const fixed = {
    '01-07': 'عيد الميلاد المجيد',
    '01-25': 'عيد الشرطة وثورة ٢٥ يناير',
    '04-25': 'عيد تحرير سيناء',
    '05-01': 'عيد العمال',
    '06-30': 'ثورة ٣٠ يونيو',
    '07-23': 'ثورة ٢٣ يوليو',
    '10-06': 'عيد القوات المسلحة (نصر ٦ أكتوبر)'
  };

  const variable = {
    2025: {
      '03-30': 'عيد الفطر المبارك',
      '03-31': 'عيد الفطر المبارك',
      '04-01': 'عيد الفطر المبارك',
      '04-21': 'عيد شم النسيم',
      '06-05': 'وقفة عرفات',
      '06-06': 'عيد الأضحى المبارك',
      '06-07': 'عيد الأضحى المبارك',
      '06-08': 'عيد الأضحى المبارك',
      '06-09': 'عيد الأضحى المبارك',
      '06-26': 'رأس السنة الهجرية',
      '09-04': 'المولد النبوي الشريف'
    },
    2026: {
      '03-19': 'عيد الفطر المبارك',
      '03-20': 'عيد الفطر المبارك',
      '03-21': 'عيد الفطر المبارك',
      '04-13': 'عيد شم النسيم',
      '05-26': 'وقفة عرفات',
      '05-27': 'عيد الأضحى المبارك',
      '05-28': 'عيد الأضحى المبارك',
      '05-29': 'عيد الأضحى المبارك',
      '05-30': 'عيد الأضحى المبارك',
      '06-18': 'رأس السنة الهجرية',
      '08-26': 'المولد النبوي الشريف'
    },
    2027: {
      '03-09': 'عيد الفطر المبارك',
      '03-10': 'عيد الفطر المبارك',
      '03-11': 'عيد الفطر المبارك',
      '05-03': 'عيد شم النسيم',
      '05-15': 'وقفة عرفات',
      '05-16': 'عيد الأضحى المبارك',
      '05-17': 'عيد الأضحى المبارك',
      '05-18': 'عيد الأضحى المبارك',
      '05-19': 'عيد الأضحى المبارك',
      '06-06': 'رأس السنة الهجرية',
      '08-15': 'المولد النبوي الشريف'
    }
  };

  const holidays = {};
  for (const [md, name] of Object.entries(fixed)) {
    holidays[`${year}-${md}`] = name;
  }
  if (variable[year]) {
    for (const [md, name] of Object.entries(variable[year])) {
      holidays[`${year}-${md}`] = name;
    }
  }
  return holidays;
};

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

  // View Mode & Calendar State
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'calendar'
  const [selectedCalendarEmp, setSelectedCalendarEmp] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [calendarRecords, setCalendarRecords] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);
  
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
      if (isAdminOrHr || isCeo) {
        const [deptRes, empRes] = await Promise.all([
          client.get('/departments'),
          client.get('/employees?per_page=100')
        ]);
        setDepartments(deptRes.data.departments);
        const emps = empRes.data.employees;
        setEmployees(emps);
        if (currentUser?.employee_id) {
          setSelectedCalendarEmp(currentUser.employee_id);
        } else if (emps.length > 0) {
          setSelectedCalendarEmp(emps[0].employee_id);
        }
      } else {
        const deptRes = await client.get('/departments');
        setDepartments(deptRes.data.departments);
        if (currentUser?.employee_id) {
          setSelectedCalendarEmp(currentUser.employee_id);
        }
      }
    } catch (err) {
      console.error('Error fetching filters data:', err);
    }
  };

  const fetchCalendarAttendance = async () => {
    if (!selectedCalendarEmp) return;
    try {
      setCalendarLoading(true);
      const res = await client.get(`/attendance/employee/${selectedCalendarEmp}?month=${calendarMonth}`);
      setCalendarRecords(res.data.records);
    } catch (err) {
      console.error('Error fetching calendar records:', err);
      toast.error('فشل تحميل سجلات الحضور للتقويم');
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [date, selectedDept, selectedStatus]);

  useEffect(() => {
    fetchFilterData();
  }, []);

  useEffect(() => {
    if (viewMode === 'calendar') {
      fetchCalendarAttendance();
    }
  }, [selectedCalendarEmp, calendarMonth, viewMode]);

  useEffect(() => {
    setSelectedDayDetails(null);
  }, [calendarMonth, selectedCalendarEmp]);

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

  const isMobile = () => {
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const requestBiometricAuth = async () => {
    // Check if WebAuthn is available (fingerprint/FaceID on mobile)
    if (!window.PublicKeyCredential) {
      return true; // Fall back on unsupported browsers
    }

    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        return true; // No platform authenticator, allow anyway
      }

      // Use navigator.credentials to trigger biometric prompt
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: "XQ HR System" },
          user: {
            id: new Uint8Array(16),
            name: currentUser?.email || "user",
            displayName: currentUser?.name || "User"
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required"
          },
          timeout: 60000
        }
      });

      return !!credential;
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        // User cancelled the biometric prompt
        return false;
      }
      // Other errors — allow fallback
      console.warn('Biometric auth error:', err);
      return true;
    }
  };

  const handleSelfCheck = async (type) => {
    // On mobile, require biometric authentication first
    if (isMobile()) {
      const toastVerify = toast.loading('يرجى التحقق من هويتك عبر بصمة الإصبع أو بصمة الوجه...');
      const verified = await requestBiometricAuth();
      toast.dismiss(toastVerify);
      if (!verified) {
        toast.error('فشل التحقق من الهوية. يرجى استخدام بصمة الإصبع أو بصمة الوجه للمتابعة.');
        return;
      }
    }

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
      const errorMsg = err.response?.data?.detail || 'فشل مزامنة أجهزة البصمة';
      toast.error(errorMsg, { id: toastId });
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

  const handlePrevMonth = () => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    setCalendarMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    setCalendarMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const getDaysArray = (year, monthIndex) => {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDayIndex = new Date(year, monthIndex, 1).getDay();
    const startOffset = (firstDayIndex + 1) % 7;
    
    const arr = [];
    for (let i = 0; i < startOffset; i++) {
      arr.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push(d);
    }
    return arr;
  };

  const renderCalendarFilters = () => {
    const [calendarYearStr, calendarMonthStr] = calendarMonth.split('-');
    const calendarYear = parseInt(calendarYearStr);
    const calendarMonthIndex = parseInt(calendarMonthStr) - 1;
    const arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    return (
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={handlePrevMonth}
            style={{
              background: 'rgba(0, 39, 73, 0.05)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-main)',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem'
            }}
          >
            الشهر السابق
          </button>
          <span style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--text-main)', minWidth: '140px', textAlign: 'center' }}>
            {arabicMonths[calendarMonthIndex]} {calendarYear}
          </span>
          <button 
            onClick={handleNextMonth}
            style={{
              background: 'rgba(0, 39, 73, 0.05)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-main)',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem'
            }}
          >
            الشهر التالي
          </button>
        </div>

        {/* Employee selector for Admins/HR/CEO */}
        {(isAdminOrHr || isCeo) ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: '600' }}>عرض حضور الموظف:</span>
            <select
              value={selectedCalendarEmp}
              onChange={(e) => setSelectedCalendarEmp(e.target.value)}
              style={{
                background: 'rgba(0, 39, 73, 0.02)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '0.6rem 1rem',
                color: 'var(--text-main)',
                outline: 'none',
                direction: 'rtl',
                minWidth: '220px',
                fontWeight: '600'
              }}
            >
              {employees
                .filter(emp => emp.employee_id !== 'EMP-7777' && emp.job_title !== 'الرئيس التنفيذي')
                .map(emp => (
                  <option key={emp.id} value={emp.employee_id} style={{ background: 'var(--bg-card)' }}>
                    {emp.name} ({emp.employee_id})
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.95rem', color: 'var(--text-dim)' }}>الموظف:</span>
            <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '1.1rem' }}>{currentUser?.name}</span>
          </div>
        )}
      </div>
    );
  };

  const renderCalendarGrid = () => {
    const [calendarYearStr, calendarMonthStr] = calendarMonth.split('-');
    const calendarYear = parseInt(calendarYearStr);
    const calendarMonthIndex = parseInt(calendarMonthStr) - 1;
    const holidays = getEgyptianHolidays(calendarYear);
    const daysArray = getDaysArray(calendarYear, calendarMonthIndex);

    const arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    const weekdays = [
      { full: 'السبت', short: 'سبت' },
      { full: 'الأحد', short: 'أحد' },
      { full: 'الاثنين', short: 'إثن' },
      { full: 'الثلاثاء', short: 'ثلا' },
      { full: 'الأربعاء', short: 'أرب' },
      { full: 'الخميس', short: 'خميس' },
      { full: 'الجمعة', short: 'جمع' }
    ];
    
    return (
      <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
          {weekdays.map(day => (
            <div key={day.full} className="calendar-weekday-header" style={{ fontWeight: '700', color: 'var(--text-dim)', paddingBottom: '0.75rem', borderBottom: '2px solid var(--glass-border)' }}>
              <span className="desktop-weekday">{day.full}</span>
              <span className="mobile-weekday">{day.short}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', minHeight: '350px' }}>
          {calendarLoading ? (
            <div style={{ gridColumn: 'span 7', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-dim)' }}>
              جاري تحميل بيانات التقويم...
            </div>
          ) : (
            daysArray.map((d, index) => {
              if (d === null) {
                return (
                  <div 
                    key={`empty-${index}`} 
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.01)', 
                      borderRadius: '8px',
                      opacity: 0.3
                    }} 
                  />
                );
              }

              const dayStr = String(d).padStart(2, '0');
              const fullDateStr = `${calendarYear}-${calendarMonthStr}-${dayStr}`;
              const holidayName = holidays[fullDateStr];
              
              const dateObj = new Date(calendarYear, calendarMonthIndex, d);
              const dayOfWeek = dateObj.getDay();
              const isWeekendDay = dayOfWeek === 5 || dayOfWeek === 6;
              const systemTodayStr = new Date().toISOString().split('T')[0];
              const isFuture = fullDateStr > systemTodayStr;
              const isToday = fullDateStr === systemTodayStr;

              const record = calendarRecords.find(r => r.date === fullDateStr);

              let cellBg = 'rgba(255, 255, 255, 0.02)';
              let borderStyle = '1px solid var(--glass-border)';
              let badgeColor = '';
              let badgeBg = '';
              let badgeText = '';
              let badgeTime = '';

              if (isToday) {
                borderStyle = '2.5px solid var(--primary)';
              }
              if (selectedDayDetails?.date === fullDateStr) {
                borderStyle = '2.5px solid var(--accent)';
              }

              if (isFuture) {
                cellBg = 'rgba(255, 255, 255, 0.01)';
              } else if (holidayName) {
                cellBg = 'rgba(244, 63, 94, 0.08)';
                badgeText = holidayName;
                badgeColor = '#fda4af';
                badgeBg = 'rgba(244, 63, 94, 0.2)';
              } else if (record) {
                if (record.status === 'on_time') {
                  cellBg = 'rgba(34, 197, 94, 0.06)';
                  badgeText = 'حاضر';
                  badgeColor = 'var(--accent)';
                  badgeBg = 'rgba(34, 197, 94, 0.15)';
                  if (record.check_in) {
                    badgeTime = `${record.check_in.substring(0, 5)} - ${record.check_out ? record.check_out.substring(0, 5) : 'معلق'}`;
                  }
                } else if (record.status === 'late') {
                  cellBg = 'rgba(245, 158, 11, 0.06)';
                  badgeText = 'متأخر';
                  badgeColor = '#fbbf24';
                  badgeBg = 'rgba(245, 158, 11, 0.15)';
                  if (record.check_in) {
                    badgeTime = `${record.check_in.substring(0, 5)} - ${record.check_out ? record.check_out.substring(0, 5) : 'معلق'}`;
                  }
                } else if (record.status === 'absent') {
                  cellBg = 'rgba(239, 68, 68, 0.06)';
                  badgeText = 'غياب';
                  badgeColor = '#fca5a5';
                  badgeBg = 'rgba(239, 68, 68, 0.15)';
                } else if (record.status === 'leave') {
                  cellBg = 'rgba(59, 130, 246, 0.06)';
                  badgeText = 'إجازة معتمدة';
                  badgeColor = '#93c5fd';
                  badgeBg = 'rgba(59, 130, 246, 0.15)';
                  if (record.notes) {
                    badgeTime = record.notes;
                  }
                } else if (record.status === 'mission') {
                  cellBg = 'rgba(168, 85, 247, 0.06)';
                  badgeText = 'مأمورية عمل';
                  badgeColor = '#d8b4fe';
                  badgeBg = 'rgba(168, 85, 247, 0.15)';
                  if (record.notes) {
                    badgeTime = record.notes;
                  }
                } else {
                  cellBg = 'rgba(255, 255, 255, 0.03)';
                  badgeText = translateStatus(record.status);
                  badgeColor = 'var(--text-dim)';
                  badgeBg = 'rgba(255, 255, 255, 0.1)';
                }
              } else if (isWeekendDay) {
                cellBg = 'rgba(255, 255, 255, 0.04)';
                badgeText = 'عطلة أسبوعية';
                badgeColor = 'var(--text-dim)';
                badgeBg = 'rgba(255, 255, 255, 0.05)';
              } else {
                cellBg = 'rgba(239, 68, 68, 0.03)';
                badgeText = 'غياب';
                badgeColor = '#fca5a5';
                badgeBg = 'rgba(239, 68, 68, 0.1)';
              }

              return (
                <div
                  key={`day-${d}`}
                  onClick={() => {
                    let statusColor = 'var(--text-dim)';
                    let statusText = 'غياب';
                    if (holidayName) {
                      statusColor = '#fda4af';
                      statusText = `إجازة رسمية: ${holidayName}`;
                    } else if (record) {
                      if (record.status === 'on_time') {
                        statusColor = 'var(--accent)';
                        statusText = 'حاضر في الموعد';
                      } else if (record.status === 'late') {
                        statusColor = '#fbbf24';
                        statusText = 'متأخر';
                      } else if (record.status === 'absent') {
                        statusColor = '#fca5a5';
                        statusText = 'غياب';
                      } else if (record.status === 'leave') {
                        statusColor = '#93c5fd';
                        statusText = 'إجازة معتمدة';
                      } else if (record.status === 'mission') {
                        statusColor = '#d8b4fe';
                        statusText = 'مأمورية عمل';
                      } else {
                        statusColor = 'var(--text-dim)';
                        statusText = translateStatus(record.status);
                      }
                    } else if (isWeekendDay) {
                      statusColor = 'var(--text-dim)';
                      statusText = 'عطلة أسبوعية';
                    }

                    const arabicDate = `${d} ${arabicMonths[calendarMonthIndex]} ${calendarYear}`;

                    setSelectedDayDetails({
                      date: fullDateStr,
                      formattedDate: arabicDate,
                      statusText,
                      statusColor,
                      checkIn: record?.check_in,
                      checkOut: record?.check_out,
                      hours: record?.hours_worked,
                      notes: record?.notes || (holidayName ? 'إجازة رسمية وفقاً لقانون العمل المصري' : isWeekendDay ? 'عطلة أسبوعية للموظف' : '')
                    });
                  }}
                  style={{
                    background: cellBg,
                    border: borderStyle,
                    boxShadow: isToday ? '0 0 10px rgba(79, 70, 229, 0.3)' : 'none'
                  }}
                  className={`calendar-cell-wrapper calendar-cell-hover ${selectedDayDetails?.date === fullDateStr ? 'calendar-cell-selected' : ''}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span className="calendar-day-header" style={{ 
                      fontWeight: '700', 
                      fontSize: '0.95rem', 
                      color: isToday ? 'var(--primary)' : 'var(--text-main)',
                      background: isToday ? 'rgba(79, 70, 229, 0.15)' : 'transparent',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {d}
                    </span>
                    {isToday && (
                      <span className="calendar-cell-text" style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--primary)' }}>اليوم</span>
                    )}
                  </div>

                  {badgeText && (
                    <span 
                      className="calendar-cell-dot" 
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: badgeColor || 'var(--text-dim)',
                        marginTop: '4px'
                      }} 
                    />
                  )}
                  
                  {badgeText && (
                    <div className="calendar-cell-text" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '0.5rem', width: '100%' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        background: badgeBg,
                        color: badgeColor,
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'block'
                      }} title={badgeText}>
                        {badgeText}
                      </span>
                      {badgeTime && (
                        <span className="calendar-cell-time" style={{
                          fontSize: '0.65rem',
                          color: 'var(--text-dim)',
                          textAlign: 'center',
                          direction: 'ltr',
                          display: 'block',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }} title={badgeTime}>
                          {badgeTime}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Selected Day Details Panel */}
        {selectedDayDetails && (
          <div 
            style={{ 
              marginTop: '1rem', 
              padding: '1.25rem', 
              borderRadius: '12px',
              border: '1px solid var(--primary)', 
              background: 'rgba(14, 165, 233, 0.05)', 
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              animation: 'fadeIn 0.2s ease-in-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ color: 'var(--text-main)', fontWeight: '700', fontSize: '1rem' }}>
                تفاصيل الحضور ليوم: {selectedDayDetails.formattedDate}
              </h4>
              <button 
                onClick={() => setSelectedDayDetails(null)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-dim)', 
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}
              >
                إغلاق ✕
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', textAlign: 'right' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>الحالة:</span>
                <span style={{ 
                  fontWeight: '700', 
                  color: selectedDayDetails.statusColor || 'var(--text-main)',
                  fontSize: '0.95rem'
                }}>
                  {selectedDayDetails.statusText}
                </span>
              </div>
              {selectedDayDetails.checkIn && (
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>وقت الحضور:</span>
                  <span style={{ fontWeight: '700', color: 'var(--accent)', direction: 'ltr', display: 'inline-block' }}>
                    {selectedDayDetails.checkIn}
                  </span>
                </div>
              )}
              {selectedDayDetails.checkOut && (
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>وقت الانصراف:</span>
                  <span style={{ fontWeight: '700', color: '#60a5fa', direction: 'ltr', display: 'inline-block' }}>
                    {selectedDayDetails.checkOut}
                  </span>
                </div>
              )}
              {selectedDayDetails.hours !== null && selectedDayDetails.hours !== undefined && (
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>ساعات العمل:</span>
                  <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                    {selectedDayDetails.hours} ساعة
                  </span>
                </div>
              )}
              {selectedDayDetails.notes && (
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>ملاحظات:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                    {selectedDayDetails.notes}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: '600' }}>حاضر في الموعد</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: '600' }}>متأخر</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: '600' }}>غياب</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: '600' }}>إجازة معتمدة</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: '600' }}>مأمورية عمل</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: '600' }}>إجازة رسمية (القانون المصري)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: '600' }}>عطلة أسبوعية</span>
          </div>
        </div>
      </div>
    );
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <Header title="سجل حركات الحضور والانصراف" />
          {/* View Toggle */}
          <div style={{ display: 'flex', background: 'rgba(0, 39, 73, 0.05)', borderRadius: '8px', padding: '2px', border: '1px solid var(--glass-border)' }}>
            <button
              onClick={() => setViewMode('table')}
              style={{
                background: viewMode === 'table' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'table' ? 'var(--primary)' : 'var(--text-dim)',
                border: 'none',
                padding: '0.4rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
                transition: 'all 0.2s ease',
                boxShadow: viewMode === 'table' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              عرض الجدول
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              style={{
                background: viewMode === 'calendar' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'calendar' ? 'var(--primary)' : 'var(--text-dim)',
                border: 'none',
                padding: '0.4rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
                transition: 'all 0.2s ease',
                boxShadow: viewMode === 'calendar' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              عرض التقويم
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isAdminOrHr && (
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
          )}
        </div>
      </div>

      {viewMode === 'table' ? (
        <>
          {/* Filter Bar */}
          <div className="card filter-bar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1rem', padding: '1rem', alignItems: 'center' }}>
            {(isAdminOrHr || isCeo) ? (
              <>
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
              </>
            ) : (
              <div style={{ gridColumn: 'span 12', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarIcon size={16} color="var(--text-dim)" />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginLeft: '0.5rem' }}>تاريخ عرض الحركات:</span>
                <input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  style={{
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
            )}
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
        </>
      ) : (
        <>
          {renderCalendarFilters()}
          {renderCalendarGrid()}
        </>
      )}

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
        .calendar-cell-wrapper {
          min-height: 90px;
          padding: 0.6rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-radius: 8px;
          border: 1px solid var(--glass-border);
          transition: all 0.2s ease-in-out;
          cursor: pointer;
          position: relative;
        }
        .calendar-cell-selected {
          border-color: var(--accent) !important;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.25) !important;
        }
        .calendar-cell-hover {
          transition: all 0.2s ease-in-out;
        }
        .calendar-cell-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 39, 73, 0.08);
          border-color: var(--primary) !important;
          background: rgba(255, 255, 255, 0.04) !important;
        }

        /* Desktop vs Mobile Calendar Layout */
        @media (max-width: 768px) {
          .calendar-cell-text {
            display: none !important;
          }
          .calendar-cell-time {
            display: none !important;
          }
          .calendar-cell-dot {
            display: inline-block !important;
          }
          .calendar-cell-wrapper {
            min-height: 60px !important;
            padding: 0.3rem !important;
            justify-content: center !important;
            align-items: center !important;
          }
          .calendar-day-header {
            font-size: 0.8rem !important;
          }
          .calendar-weekday-header {
            font-size: 0.75rem !important;
            padding-bottom: 0.4rem !important;
          }
          .desktop-weekday {
            display: none !important;
          }
          .mobile-weekday {
            display: inline !important;
          }

          /* Filter Bar responsiveness */
          .filter-bar-grid {
            display: flex !important;
            flex-direction: column !important;
            gap: 0.75rem !important;
            align-items: stretch !important;
          }
          .filter-bar-grid > div,
          .filter-bar-grid > select {
            grid-column: span 12 !important;
            width: 100% !important;
          }
        }
        @media (min-width: 769px) {
          .calendar-cell-dot {
            display: none !important;
          }
          .desktop-weekday {
            display: inline !important;
          }
          .mobile-weekday {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AttendancePage;
