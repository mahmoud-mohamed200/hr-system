import { useState, useEffect } from 'react';
import Header from '../components/Header';
import client from '../api/client';
import { Settings, Save, CheckCircle } from 'lucide-react';

const SettingsPage = () => {
  const [formData, setFormData] = useState({
    company_name: 'إكس كيو فارما',
    work_start: '11:00',
    work_end: '19:00',
    late_threshold_minutes: 15,
    weekend_days: ['friday']
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await client.get('/settings');
      setFormData(res.data);
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'late_threshold_minutes' ? parseInt(value) || 0 : value
    }));
  };

  const handleWeekendChange = (day) => {
    setFormData(prev => {
      const current = prev.weekend_days;
      const updated = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day];
      return { ...prev, weekend_days: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      await client.put('/settings', formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      alert(err.response?.data?.detail || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
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

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>جاري تحميل إعدادات النظام...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', direction: 'rtl', textAlign: 'right' }}>
      <Header title="إعدادات النظام العامة" />

      <div className="card" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', justifyContent: 'flex-start' }}>
          <Settings size={20} color="var(--primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>إعدادات الشركة ووردية العمل</h3>
        </div>

        {success && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            color: 'var(--accent)',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem'
          }}>
            <CheckCircle size={16} />
            <span>تم حفظ وتطبيق الإعدادات بنجاح.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label className="setting-label">اسم الشركة</label>
            <input 
              type="text" 
              name="company_name" 
              value={formData.company_name} 
              onChange={handleInputChange} 
              className="settings-input" 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label className="setting-label">توقيت بدء الوردية (HH:MM)</label>
              <input 
                type="text" 
                name="work_start" 
                placeholder="11:00"
                value={formData.work_start} 
                onChange={handleInputChange} 
                className="settings-input" 
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label className="setting-label">توقيت انتهاء الوردية (HH:MM)</label>
              <input 
                type="text" 
                name="work_end" 
                placeholder="19:00"
                value={formData.work_end} 
                onChange={handleInputChange} 
                className="settings-input" 
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label className="setting-label">فترة السماح للتأخير (بالدقائق)</label>
            <input 
              type="number" 
              name="late_threshold_minutes" 
              value={formData.late_threshold_minutes} 
              onChange={handleInputChange} 
              className="settings-input" 
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
              عمليات تسجيل الحضور بعد (وقت البدء + فترة السماح) ستعتبر تأخيراً تلقائياً في السجلات.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="setting-label">أيام العطلة الأسبوعية للشركة</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem', justifyContent: 'flex-start' }}>
              {daysOfWeek.map(day => {
                const isSelected = formData.weekend_days.includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => handleWeekendChange(day.key)}
                    style={{
                      background: isSelected ? 'rgba(214, 58, 47, 0.08)' : 'rgba(0, 39, 73, 0.02)',
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

          <button
            type="submit"
            disabled={saving}
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(214, 58, 47, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              marginTop: '1rem'
            }}
          >
            <Save size={16} />
            <span>{saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
          </button>
        </form>
      </div>

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
      `}</style>
    </div>
  );
};

export default SettingsPage;
