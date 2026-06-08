import { useState, useEffect } from 'react';
import Header from '../components/Header';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, 
  Clock, 
  Check, 
  X, 
  FileText,
  AlertCircle,
  Plus
} from 'lucide-react';

const LeavesPage = () => {
  const { user } = useAuth();
  const isAdminOrHr = ['admin', 'hr'].includes(user?.role);
  const isCeo = user?.role === 'ceo';

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Request leave form modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    leave_type: 'casual',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reason: '',
    duration_hours: ''
  });

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await client.get('/leaves');
      setLeaves(res.data);
    } catch (err) {
      console.error('Error fetching leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'duration_hours' ? (value ? parseFloat(value) : '') : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      if (payload.leave_type !== 'permission') {
        payload.duration_hours = null;
      }
      await client.post('/leaves', payload);
      setModalOpen(false);
      setFormData({
        leave_type: 'casual',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        reason: '',
        duration_hours: ''
      });
      fetchLeaves();
    } catch (err) {
      alert(err.response?.data?.detail || 'حدث خطأ أثناء تقديم الطلب');
    }
  };

  const handleUpdateStatus = async (id, status) => {
    const actionText = status === 'approved' ? 'اعتماد' : 'رفض';
    if (window.confirm(`هل أنت متأكد من ${actionText} هذا الطلب؟`)) {
      try {
        await client.put(`/leaves/${id}/status`, { status });
        fetchLeaves();
      } catch (err) {
        alert('فشلت العملية');
      }
    }
  };

  const translateType = (type) => {
    const map = {
      casual: 'عارضة',
      sick: 'مرضية',
      annual: 'سنوية',
      permission: 'إذن غياب قصير',
      mission: 'مأمورية عمل خارجية'
    };
    return map[type] || type;
  };

  const translateStatus = (status) => {
    const map = {
      pending: 'قيد الانتظار',
      approved: 'مقبول',
      rejected: 'مرفوض'
    };
    return map[status] || status;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Header title="الإجازات والأذونات والمأموريات" />
        {!isCeo && (
          <button 
            onClick={() => setModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
              color: '#ffffff',
              border: 'none',
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: '700',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
            }}
          >
            <Plus size={16} />
            <span>تقديم طلب جديد</span>
          </button>
        )}
      </div>

      {/* Info Alert about permission limits */}
      <div style={{ 
        background: 'rgba(79, 70, 229, 0.04)', 
        border: '1px solid var(--glass-border)', 
        padding: '1rem', 
        borderRadius: '12px', 
        color: 'var(--primary)',
        fontSize: '0.85rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        textAlign: 'right'
      }}>
        <AlertCircle size={18} style={{ flexShrink: 0 }} />
        <div>
          <strong>تعليمات الأذونات:</strong> الحد الأقصى لأذونات الغياب القصيرة (الصباحية أو المسائية) هو <strong>٤ ساعات شهرياً</strong>. عند اعتماد الأذن أو المأمورية، يقوم النظام تلقائياً بتعديل سجل الحضور لإلغاء أي غياب أو تأخير ناتج عنها.
        </div>
      </div>

      {/* Leaves Logs Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>جاري تحميل السجلات...</div>
        ) : leaves.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            لا توجد طلبات إجازة أو مأموريات مسجلة.
          </div>
        ) : (
          <table className="data-table" style={{ marginTop: 0 }}>
            <thead>
              <tr style={{ background: 'rgba(0, 39, 73, 0.01)' }}>
                <th style={{ paddingRight: '1.5rem', textAlign: 'right' }}>كود الموظف</th>
                <th style={{ textAlign: 'right' }}>الموظف</th>
                <th style={{ textAlign: 'right' }}>نوع الطلب</th>
                <th style={{ textAlign: 'right' }}>تاريخ البدء</th>
                <th style={{ textAlign: 'right' }}>تاريخ الانتهاء</th>
                <th style={{ textAlign: 'right' }}>المدة بالساعات</th>
                <th style={{ textAlign: 'right' }}>السبب</th>
                <th style={{ textAlign: 'right' }}>حالة الطلب</th>
                {isAdminOrHr && <th style={{ textAlign: 'left', paddingLeft: '1.5rem' }}>إجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {leaves.map(rec => (
                <tr key={rec.id} className="table-row">
                  <td style={{ paddingRight: '1.5rem', fontWeight: 600, color: 'var(--primary)', textAlign: 'right' }}>{rec.employee_id}</td>
                  <td style={{ textAlign: 'right' }}>{rec.employee_name}</td>
                  <td style={{ textAlign: 'right' }}>{translateType(rec.leave_type)}</td>
                  <td style={{ textAlign: 'right' }}>{rec.start_date}</td>
                  <td style={{ textAlign: 'right' }}>{rec.end_date}</td>
                  <td style={{ textAlign: 'right' }}>{rec.duration_hours ? `${rec.duration_hours} ساعة` : '-'}</td>
                  <td style={{ textAlign: 'right' }}>{rec.reason}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: rec.status === 'approved' ? 'rgba(34, 197, 94, 0.1)' : rec.status === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                      color: rec.status === 'approved' ? 'var(--accent)' : rec.status === 'rejected' ? 'var(--danger)' : '#eab308'
                    }}>
                      {translateStatus(rec.status)}
                    </span>
                  </td>
                  {isAdminOrHr && (
                    <td style={{ textAlign: 'left', paddingLeft: '1.5rem' }}>
                      {rec.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-start' }}>
                          <button 
                            onClick={() => handleUpdateStatus(rec.id, 'approved')}
                            title="اعتماد"
                            style={{
                              background: 'rgba(34, 197, 94, 0.1)',
                              border: '1px solid rgba(34, 197, 94, 0.2)',
                              color: 'var(--accent)',
                              padding: '0.4rem',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <Check size={14} />
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus(rec.id, 'rejected')}
                            title="رفض"
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              color: '#f87171',
                              padding: '0.4rem',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                          بواسطة {rec.approved_by?.split('@')[0]}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Request Modal */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="card" style={{ width: '450px', padding: '2rem', position: 'relative', textAlign: 'right' }}>
            <button 
              onClick={() => setModalOpen(false)}
              style={{ position: 'absolute', left: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>تقديم طلب إجازة / إذن / مأمورية</h3>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">نوع الطلب *</label>
                <select 
                  name="leave_type" 
                  value={formData.leave_type} 
                  onChange={handleInputChange} 
                  className="modal-input"
                  style={{ direction: 'rtl' }}
                >
                  <option value="casual" style={{ background: 'var(--bg-card)' }}>إجازة عارضة</option>
                  <option value="annual" style={{ background: 'var(--bg-card)' }}>إجازة سنوية</option>
                  <option value="sick" style={{ background: 'var(--bg-card)' }}>إجازة مرضية</option>
                  <option value="permission" style={{ background: 'var(--bg-card)' }}>إذن غياب قصير (ساعاتي)</option>
                  <option value="mission" style={{ background: 'var(--bg-card)' }}>مأمورية عمل خارجية</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label className="input-label">تاريخ البدء *</label>
                  <input 
                    type="date" 
                    name="start_date" 
                    required 
                    value={formData.start_date} 
                    onChange={handleInputChange} 
                    className="modal-input" 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label className="input-label">تاريخ الانتهاء *</label>
                  <input 
                    type="date" 
                    name="end_date" 
                    required 
                    value={formData.end_date} 
                    onChange={handleInputChange} 
                    className="modal-input" 
                  />
                </div>
              </div>

              {formData.leave_type === 'permission' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label className="input-label">المدة بالساعات (بحد أقصى ٤ ساعات شهرياً) *</label>
                  <input 
                    type="number" 
                    step="0.5"
                    name="duration_hours" 
                    required 
                    placeholder="مثال: 2"
                    value={formData.duration_hours} 
                    onChange={handleInputChange} 
                    className="modal-input" 
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">السبب أو الوصف *</label>
                <textarea 
                  name="reason" 
                  required 
                  placeholder="يرجى كتابة سبب تقديم الطلب..."
                  value={formData.reason} 
                  onChange={handleInputChange} 
                  className="modal-input" 
                  style={{ minHeight: '80px', resize: 'vertical' }}
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
                تقديم الطلب
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

export default LeavesPage;
