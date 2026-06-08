import { useState, useEffect } from 'react';
import Header from '../components/Header';
import client, { BACKEND_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Settings, Save, CheckCircle, User, Key, Camera } from 'lucide-react';

const SettingsPage = () => {
  const { user, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'system'

  // Personal Profile state
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Photo state
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState(false);

  // Password state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // System Settings state (Admin/HR only)
  const [systemData, setSystemData] = useState({
    company_name: 'إكس كيو فارما',
    work_start: '11:00',
    work_end: '19:00',
    late_threshold_minutes: 15,
    weekend_days: ['friday']
  });
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemSaving, setSystemSaving] = useState(false);
  const [systemSuccess, setSystemSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  // Fetch system settings if admin/hr
  const fetchSystemSettings = async () => {
    if (user?.role !== 'admin' && user?.role !== 'ceo') return;
    setSystemLoading(true);
    try {
      const res = await client.get('/settings');
      setSystemData(res.data);
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setSystemLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemSettings();
  }, [user]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    setPasswordError('');
  };

  const handleSystemChange = (e) => {
    const { name, value } = e.target;
    setSystemData(prev => ({
      ...prev,
      [name]: name === 'late_threshold_minutes' ? parseInt(value) || 0 : value
    }));
  };

  const handleWeekendChange = (day) => {
    setSystemData(prev => {
      const current = prev.weekend_days;
      const updated = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day];
      return { ...prev, weekend_days: updated };
    });
  };

  // Submit Profile Info
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess(false);
    try {
      await client.put('/auth/profile', profileData);
      setProfileSuccess(true);
      
      // Update local context
      const updatedUser = { ...user, ...profileData };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      alert(err.response?.data?.detail || 'فشل تحديث الملف الشخصي');
    } finally {
      setProfileSaving(false);
    }
  };

  // Submit Password Change
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordError('كلمتا المرور الجديدتان غير متطابقتين');
      return;
    }
    setPasswordSaving(true);
    setPasswordSuccess(false);
    setPasswordError('');
    try {
      await client.post('/auth/change-password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      setPasswordSuccess(true);
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err.response?.data?.detail || 'فشل تغيير كلمة المرور');
    } finally {
      setPasswordSaving(false);
    }
  };

  // Upload Profile Picture
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    setPhotoUploading(true);
    setPhotoSuccess(false);
    try {
      const res = await client.post('/auth/profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPhotoSuccess(true);

      // Update local context
      const updatedUser = { ...user, photo_url: res.data.photo_url };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setTimeout(() => setPhotoSuccess(false), 3000);
    } catch (err) {
      alert(err.response?.data?.detail || 'فشل تحميل الصورة الشخصية');
    } finally {
      setPhotoUploading(false);
    }
  };

  // Submit System Settings
  const handleSystemSubmit = async (e) => {
    e.preventDefault();
    setSystemSaving(true);
    setSystemSuccess(false);
    try {
      await client.put('/settings', systemData);
      setSystemSuccess(true);
      setTimeout(() => setSystemSuccess(false), 3000);
    } catch (err) {
      alert(err.response?.data?.detail || 'فشل حفظ إعدادات النظام');
    } finally {
      setSystemSaving(false);
    }
  };

  const daysOfWeek = [
    { key: 'monday', label: 'الاثنين' },
    { key: 'tuesday', label: 'الثلاثاء' },
    { key: 'wednesday', label: 'الأربعاء' },
    { key: 'thursday', label: 'الخميس' },
    { key: 'friday', label: 'الجمعة' },
    { key: 'saturday', label: 'السبت' },
    { key: 'sunday', label: 'الأحد' }
  ];

  const hasSystemAccess = user?.role === 'admin' || user?.role === 'ceo';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', direction: 'rtl', textAlign: 'right' }}>
      <Header title="الإعدادات" />

      {/* Tabs */}
      {hasSystemAccess && (
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'profile' ? 'var(--primary)' : 'var(--text-dim)',
              fontSize: '1rem',
              fontWeight: '600',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'profile' ? '2px solid var(--primary)' : 'none',
              transition: 'all 0.3s ease'
            }}
          >
            الملف الشخصي
          </button>
          <button
            onClick={() => setActiveTab('system')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'system' ? 'var(--primary)' : 'var(--text-dim)',
              fontSize: '1rem',
              fontWeight: '600',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'system' ? '2px solid var(--primary)' : 'none',
              transition: 'all 0.3s ease'
            }}
          >
            إعدادات النظام العامة
          </button>
        </div>
      )}

      {/* Profile Settings Tab */}
      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '2rem', alignItems: 'start', maxWidth: '1000px' }}>
          
          {/* Avatar upload Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '2rem' }}>
            <div style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              {user?.photo_url ? (
                <img 
                  src={user.photo_url.startsWith('http') ? user.photo_url : `${BACKEND_URL}${user.photo_url}`} 
                  alt="Profile" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'rgba(0, 39, 73, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                  <User size={60} style={{ margin: 'auto' }} />
                </div>
              )}
              <label 
                htmlFor="avatar-upload" 
                style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  left: 0, 
                  right: 0, 
                  background: 'rgba(0,0,0,0.6)', 
                  color: '#ffffff', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  padding: '0.3rem 0', 
                  cursor: 'pointer',
                  transition: 'background 0.3s ease'
                }}
              >
                <Camera size={16} />
              </label>
              <input 
                id="avatar-upload" 
                type="file" 
                accept="image/*" 
                onChange={handlePhotoUpload} 
                style={{ display: 'none' }} 
              />
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ fontWeight: 600, fontSize: '1.1rem' }}>{user?.name || 'مستخدم النظام'}</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>{user?.job_title || user?.role}</p>
            </div>

            {photoUploading && <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>جاري رفع الصورة...</p>}
            {photoSuccess && (
              <p style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>تم تحديث الصورة الشخصية!</p>
            )}
          </div>

          {/* Profile details & password forms */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
            {/* Info Form */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                <User size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>تعديل الملف الشخصي</h3>
              </div>

              {profileSuccess && (
                <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', color: 'var(--accent)', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <CheckCircle size={14} />
                  <span>تم حفظ البيانات الشخصية بنجاح.</span>
                </div>
              )}

              <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label className="setting-label">الاسم الكامل</label>
                  <input type="text" name="name" value={profileData.name} onChange={handleProfileChange} className="settings-input" required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label className="setting-label">البريد الإلكتروني</label>
                    <input type="email" name="email" value={profileData.email} onChange={handleProfileChange} className="settings-input" required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label className="setting-label">رقم الهاتف</label>
                    <input type="text" name="phone" value={profileData.phone} onChange={handleProfileChange} className="settings-input" />
                  </div>
                </div>
                <button type="submit" disabled={profileSaving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.7rem 1.5rem', width: 'fit-content', marginTop: '0.5rem' }}>
                  <Save size={16} />
                  <span>{profileSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                </button>
              </form>
            </div>

            {/* Password Form */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                <Key size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>تغيير كلمة المرور</h3>
              </div>

              {passwordSuccess && (
                <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', color: 'var(--accent)', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <CheckCircle size={14} />
                  <span>تم تغيير كلمة المرور بنجاح.</span>
                </div>
              )}

              {passwordError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  {passwordError}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label className="setting-label">كلمة المرور الحالية</label>
                  <input type="password" name="current_password" value={passwordData.current_password} onChange={handlePasswordChange} className="settings-input" required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label className="setting-label">كلمة المرور الجديدة</label>
                    <input type="password" name="new_password" value={passwordData.new_password} onChange={handlePasswordChange} className="settings-input" required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label className="setting-label">تأكيد كلمة المرور الجديدة</label>
                    <input type="password" name="confirm_password" value={passwordData.confirm_password} onChange={handlePasswordChange} className="settings-input" required />
                  </div>
                </div>
                <button type="submit" disabled={passwordSaving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.7rem 1.5rem', width: 'fit-content', marginTop: '0.5rem' }}>
                  <Save size={16} />
                  <span>{passwordSaving ? 'جاري التعديل...' : 'تحديث كلمة المرور'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* System Settings Tab */}
      {activeTab === 'system' && hasSystemAccess && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', justifyContent: 'flex-start' }}>
            <Settings size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>إعدادات الشركة ووردية العمل</h3>
          </div>

          {systemSuccess && (
            <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', color: 'var(--accent)', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <CheckCircle size={16} />
              <span>تم حفظ وتطبيق الإعدادات بنجاح.</span>
            </div>
          )}

          {systemLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>جاري تحميل إعدادات النظام...</div>
          ) : (
            <form onSubmit={handleSystemSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="setting-label">اسم الشركة</label>
                <input type="text" name="company_name" value={systemData.company_name} onChange={handleSystemChange} className="settings-input" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label className="setting-label">توقيت بدء الوردية (HH:MM)</label>
                  <input type="text" name="work_start" placeholder="11:00" value={systemData.work_start} onChange={handleSystemChange} className="settings-input" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label className="setting-label">توقيت انتهاء الوردية (HH:MM)</label>
                  <input type="text" name="work_end" placeholder="19:00" value={systemData.work_end} onChange={handleSystemChange} className="settings-input" />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="setting-label">فترة السماح للتأخير (بالدقائق)</label>
                <input type="number" name="late_threshold_minutes" value={systemData.late_threshold_minutes} onChange={handleSystemChange} className="settings-input" />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                  عمليات تسجيل الحضور بعد (وقت البدء + فترة السماح) ستعتبر تأخيراً تلقائياً في السجلات.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="setting-label">أيام العطلة الأسبوعية للشركة</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem', justifyContent: 'flex-start' }}>
                  {daysOfWeek.map(day => {
                    const isSelected = systemData.weekend_days.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => handleWeekendChange(day.key)}
                        style={{
                          background: isSelected ? 'rgba(79, 70, 229, 0.08)' : 'rgba(0, 39, 73, 0.02)',
                          border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--glass-border)'}`,
                          color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button type="submit" disabled={systemSaving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.8rem', fontWeight: '700', marginTop: '1rem' }}>
                <Save size={16} />
                <span>{systemSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
              </button>
            </form>
          )}
        </div>
      )}

      <style>{`
        .settings-input {
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
        .settings-input:focus {
          border-color: var(--primary);
        }
        .setting-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-dim);
        }
        .btn-primary {
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: #ffffff;
          border: none;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
          transition: all 0.3s ease;
        }
        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3);
        }
        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
};

export default SettingsPage;
