import { useState, useEffect } from 'react';
import Header from '../components/Header';
import client from '../api/client';
import { Package, Plus, Check, X, UserMinus, UserPlus, Laptop, Car, Smartphone, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';

const AssetsPage = () => {
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');

  const [createForm, setCreateForm] = useState({
    name: '',
    serial_number: '',
    type: 'laptop'
  });

  const [assignForm, setAssignForm] = useState({
    employee_id: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assetsRes, employeesRes] = await Promise.all([
        client.get('/assets'),
        client.get('/employees?per_page=100')
      ]);
      setAssets(assetsRes.data);
      setEmployees(employeesRes.data.employees);
    } catch (err) {
      console.error('Error loading assets data:', err);
      toast.error('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await client.post('/assets', createForm);
      toast.success('تمت إضافة الأصل بنجاح');
      setCreateModalOpen(false);
      setCreateForm({ name: '', serial_number: '', type: 'laptop' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'فشلت إضافة الأصل');
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignForm.employee_id) return;
    try {
      await client.post(`/assets/${selectedAssetId}/assign`, assignForm);
      toast.success('تم تسليم العهدة بنجاح');
      setAssignModalOpen(false);
      setAssignForm({ employee_id: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'فشل تسليم العهدة');
    }
  };

  const handleReturnAsset = async (id) => {
    if (window.confirm('هل أنت متأكد من استلام العهدة وإرجاع الأصل للمخزن؟')) {
      try {
        await client.post(`/assets/${id}/return`);
        toast.success('تم استلام العهدة بنجاح وإعادتها للمخزون');
        fetchData();
      } catch (err) {
        toast.error('فشلت عملية إرجاع الأصل');
      }
    }
  };

  const handleDeleteAsset = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الأصل نهائياً من النظام؟')) {
      try {
        await client.delete(`/assets/${id}`);
        toast.success('تم حذف الأصل بنجاح');
        fetchData();
      } catch (err) {
        toast.error(err.response?.data?.detail || 'لا يمكن الحذف');
      }
    }
  };

  const translateStatus = (status) => {
    const map = {
      available: 'متوفر بالمخزن',
      assigned: 'عهدة موظف',
      maintenance: 'تحت الصيانة'
    };
    return map[status] || status;
  };

  const renderTypeIcon = (type) => {
    switch (type) {
      case 'laptop':
        return <Laptop size={18} color="var(--primary)" />;
      case 'car':
        return <Car size={18} color="#60a5fa" />;
      case 'phone':
        return <Smartphone size={18} color="var(--accent)" />;
      default:
        return <Package size={18} color="var(--text-dim)" />;
    }
  };

  const translateType = (type) => {
    const map = {
      laptop: 'لابتوب / حاسب محمول',
      car: 'سيارة عمل',
      phone: 'هاتف محمول',
      other: 'أخرى'
    };
    return map[type] || type;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Header title="إدارة العُهد والأصول الرقمية" />
        <button 
          onClick={() => setCreateModalOpen(true)}
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
          <span>إضافة أصل جديد</span>
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>جاري تحميل البيانات...</div>
        ) : assets.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <Inbox size={48} opacity={0.3} />
            <span>لا توجد أصول أو عُهد مسجلة في المخزن حالياً.</span>
          </div>
        ) : (
          <table className="data-table" style={{ marginTop: 0 }}>
            <thead>
              <tr style={{ background: 'rgba(0, 39, 73, 0.01)' }}>
                <th style={{ paddingRight: '1.5rem', textAlign: 'right' }}>نوع الأصل</th>
                <th style={{ textAlign: 'right' }}>اسم الأصل</th>
                <th style={{ textAlign: 'right' }}>الرقم التسلسلي (Serial)</th>
                <th style={{ textAlign: 'right' }}>حالة العهدة</th>
                <th style={{ textAlign: 'right' }}>العهدة مع الموظف</th>
                <th style={{ textAlign: 'right' }}>تاريخ التسليم</th>
                <th style={{ paddingLeft: '1.5rem', textAlign: 'left' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(asset => (
                <tr key={asset.id} className="table-row">
                  <td style={{ paddingRight: '1.5rem', textAlign: 'right' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-start' }}>
                      {renderTypeIcon(asset.type)}
                      <span>{translateType(asset.type)}</span>
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--text-main)' }}>{asset.name}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--primary)' }}>{asset.serial_number}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: asset.status === 'available' ? 'rgba(34, 197, 94, 0.1)' : asset.status === 'assigned' ? 'rgba(96, 165, 250, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: asset.status === 'available' ? 'var(--accent)' : asset.status === 'assigned' ? '#60a5fa' : 'var(--danger)'
                    }}>
                      {translateStatus(asset.status)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{asset.employee_name || '-'}</td>
                  <td style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-dim)' }}>{asset.assigned_date || '-'}</td>
                  <td style={{ paddingLeft: '1.5rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      {asset.status === 'available' ? (
                        <button 
                          onClick={() => { setSelectedAssetId(asset.id); setAssignModalOpen(true); }}
                          style={{
                            background: 'rgba(34, 197, 94, 0.1)',
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                            color: 'var(--accent)',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.8rem'
                          }}
                        >
                          <UserPlus size={12} />
                          <span>تسليم عهدة</span>
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleReturnAsset(asset.id)}
                          style={{
                            background: 'rgba(96, 165, 250, 0.1)',
                            border: '1px solid rgba(96, 165, 250, 0.2)',
                            color: '#60a5fa',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.8rem'
                          }}
                        >
                          <UserMinus size={12} />
                          <span>إرجاع للمخزن</span>
                        </button>
                      )}

                      <button 
                        onClick={() => handleDeleteAsset(asset.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          padding: '0.35rem',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE ASSET MODAL */}
      {createModalOpen && (
        <div className="modal-backdrop">
          <div className="card" style={{ width: '400px', padding: '2rem', position: 'relative', textAlign: 'right' }}>
            <button onClick={() => setCreateModalOpen(false)} style={{ position: 'absolute', left: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>إضافة أصل جديد للمخزن</h3>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">نوع الأصل *</label>
                <select 
                  value={createForm.type} 
                  onChange={(e) => setCreateForm(p => ({ ...p, type: e.target.value }))}
                  className="modal-input"
                  style={{ direction: 'rtl' }}
                >
                  <option value="laptop">لابتوب / كمبيوتر محمول</option>
                  <option value="car">سيارة عمل</option>
                  <option value="phone">هاتف محمول ذكي</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">اسم الأصل ومواصفاته *</label>
                <input 
                  type="text" 
                  required 
                  value={createForm.name} 
                  onChange={(e) => setCreateForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="مثال: MacBook Pro 16"
                  className="modal-input" 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">الرقم التسلسلي (Serial Number) *</label>
                <input 
                  type="text" 
                  required 
                  value={createForm.serial_number} 
                  onChange={(e) => setCreateForm(p => ({ ...p, serial_number: e.target.value }))}
                  placeholder="مثال: C02X1234H0D2"
                  className="modal-input" 
                />
              </div>
              <button type="submit" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.8rem', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)' }}>
                حفظ وإضافة الأصل
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN ASSET MODAL */}
      {assignModalOpen && (
        <div className="modal-backdrop">
          <div className="card" style={{ width: '400px', padding: '2rem', position: 'relative', textAlign: 'right' }}>
            <button onClick={() => setAssignModalOpen(false)} style={{ position: 'absolute', left: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>تسليم الأصل كعهدة موظف</h3>
            <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">اختر الموظف المستلم *</label>
                <select 
                  required 
                  value={assignForm.employee_id} 
                  onChange={(e) => setAssignForm({ employee_id: e.target.value })}
                  className="modal-input"
                  style={{ direction: 'rtl' }}
                >
                  <option value="">اختر الموظف...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.employee_id} style={{ background: 'var(--bg-card)' }}>
                      {emp.name} ({emp.employee_id})
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.8rem', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)' }}>
                تأكيد وتسليم العهدة
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

export default AssetsPage;
