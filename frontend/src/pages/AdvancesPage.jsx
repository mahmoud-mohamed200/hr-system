import { useState, useEffect } from 'react';
import Header from '../components/Header';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  Coins,
  Check, 
  X, 
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdvancesPage = () => {
  const { user } = useAuth();
  const isAdminOrHr = ['admin', 'hr'].includes(user?.role);

  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Request advance modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    reason: ''
  });

  const fetchAdvances = async () => {
    try {
      setLoading(true);
      const res = await client.get('/advances');
      setAdvances(res.data);
    } catch (err) {
      console.error('Error fetching advances:', err);
      toast.error('حدث خطأ أثناء تحميل طلبات السلف');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvances();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? (value ? parseFloat(value) : '') : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await client.post('/advances', formData);
      setModalOpen(false);
      setFormData({ amount: '', reason: '' });
      fetchAdvances();
      toast.success('تم تقديم طلب السلفة بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'فشل تقديم طلب السلفة');
    }
  };

  const handleUpdateStatus = async (id, status) => {
    const actionText = status === 'approved' ? 'اعتماد' : 'رفض';
    if (window.confirm(`هل أنت متأكد من رغبتك في ${actionText} طلب السلفة هذا؟`)) {
      try {
        await client.put(`/advances/${id}/status`, { status });
        fetchAdvances();
        toast.success(`تم ${actionText} طلب السلفة بنجاح`);
      } catch (err) {
        toast.error(err.response?.data?.detail || 'فشلت العملية');
      }
    }
  };

  const translateStatus = (status) => {
    const map = {
      pending: 'معلق',
      approved: 'معتمد',
      rejected: 'مرفوض'
    };
    return map[status] || status;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Header title="طلب السلف المؤقتة" />
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
          <span>طلب سلفة مؤقتة جديدة</span>
        </button>
      </div>

      {/* Advances Logs Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>جاري تحميل طلبات السلف...</div>
        ) : advances.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            لا توجد طلبات سلف مؤقتة مسجلة حالياً.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ marginTop: 0, width: '100%' }}>
              <thead>
                <tr style={{ background: 'rgba(0, 39, 73, 0.01)' }}>
                  <th style={{ paddingRight: '1.5rem', textAlign: 'right' }}>كود الموظف</th>
                  <th style={{ textAlign: 'right' }}>اسم الموظف</th>
                  <th style={{ textAlign: 'right' }}>مبلغ السلفة</th>
                  <th style={{ textAlign: 'right' }}>السبب / الغرض</th>
                  <th style={{ textAlign: 'right' }}>تاريخ الطلب</th>
                  <th style={{ textAlign: 'right' }}>الحالة</th>
                  {isAdminOrHr && <th style={{ textAlign: 'left', paddingLeft: '1.5rem' }}>الإجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {advances.map(rec => (
                  <tr key={rec.id} className="table-row">
                    <td style={{ paddingRight: '1.5rem', fontWeight: 600, color: 'var(--primary)', textAlign: 'right' }}>{rec.employee_id}</td>
                    <td style={{ textAlign: 'right' }}>{rec.employee_name}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent)', textAlign: 'right' }}>{rec.amount} ج.م</td>
                    <td style={{ textAlign: 'right' }}>{rec.reason}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-dim)' }}>{rec.created_at?.substring(0, 10)}</td>
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
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
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
          </div>
        )}
      </div>

      {/* Request Modal */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="card" style={{ width: '400px', padding: '2rem', position: 'relative', textAlign: 'right' }}>
            <button 
              onClick={() => setModalOpen(false)}
              style={{ position: 'absolute', left: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>تقديم طلب سلفة مؤقتة جديدة</h3>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">مبلغ السلفة المطلوب (ج.م) *</label>
                <div style={{ position: 'relative' }}>
                  <Coins size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  <input 
                    type="number" 
                    name="amount" 
                    required 
                    min="1"
                    placeholder="مثال: 5000"
                    value={formData.amount} 
                    onChange={handleInputChange} 
                    className="modal-input" 
                    style={{ paddingRight: '2.5rem', textAlign: 'right' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">السبب أو التبرير *</label>
                <textarea 
                  name="reason" 
                  required 
                  placeholder="يرجى كتابة سبب طلب السلفة بالتفصيل..."
                  value={formData.reason} 
                  onChange={handleInputChange} 
                  className="modal-input" 
                  style={{ minHeight: '80px', resize: 'vertical', textAlign: 'right' }}
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

export default AdvancesPage;
