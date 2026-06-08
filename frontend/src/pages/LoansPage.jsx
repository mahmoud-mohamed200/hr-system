import { useState, useEffect } from 'react';
import Header from '../components/Header';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Coins, Check, X, FileText, Plus, Landmark, DollarSign, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const LoansPage = () => {
  const { user } = useAuth();
  const isAdminOrHr = ['admin', 'hr'].includes(user?.role);

  const [activeTab, setActiveTab] = useState('advances'); // 'advances' or 'loans'
  const [advances, setAdvances] = useState([]);
  const [loans, setLoans] = useState([]);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedLoanSchedule, setSelectedLoanSchedule] = useState(null);

  const [advanceForm, setAdvanceForm] = useState({
    amount: '',
    reason: ''
  });

  const [loanForm, setLoanForm] = useState({
    amount: '',
    installments_count: '12',
    reason: '',
    start_month: new Date().toISOString().split('T')[0].substring(0, 7) // YYYY-MM
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [advancesRes, loansRes] = await Promise.all([
        client.get('/advances'),
        client.get('/loans')
      ]);
      setAdvances(advancesRes.data);
      setLoans(loansRes.data);

      if (user?.employee_id) {
        const empRes = await client.get(`/employees/${user.employee_id}`);
        setEmployeeProfile(empRes.data);
      }
    } catch (err) {
      console.error('Error fetching loans/advances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdvanceSubmit = async (e) => {
    e.preventDefault();
    if (!employeeProfile) {
      toast.error('لم يتم تحميل ملف الموظف الشخصي بعد');
      return;
    }

    const salary = employeeProfile.salary || 0;
    const amountVal = parseFloat(advanceForm.amount);
    
    // Constraint check: Max 50% of basic salary
    if (amountVal > salary * 0.5) {
      toast.error(`عذراً! الحد الأقصى للسلفة المؤقتة هو 50% من راتبك الأساسي (الأقصى لك: ${salary * 0.5} ج.م)`);
      return;
    }

    try {
      await client.post('/advances', {
        amount: amountVal,
        reason: advanceForm.reason
      });
      toast.success('تم تقديم طلب السلفة المؤقتة بنجاح');
      setAdvanceModalOpen(false);
      setAdvanceForm({ amount: '', reason: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'فشل تقديم طلب السلفة');
    }
  };

  const handleLoanSubmit = async (e) => {
    e.preventDefault();
    try {
      await client.post('/loans', {
        amount: parseFloat(loanForm.amount),
        installments_count: parseInt(loanForm.installments_count),
        reason: loanForm.reason,
        start_month: loanForm.start_month
      });
      toast.success('تم تقديم طلب القرض طويل الأجل بنجاح');
      setLoanModalOpen(false);
      setLoanForm({
        amount: '',
        installments_count: '12',
        reason: '',
        start_month: new Date().toISOString().split('T')[0].substring(0, 7)
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'فشل تقديم طلب القرض');
    }
  };

  const handleUpdateAdvanceStatus = async (id, status) => {
    const actionText = status === 'approved' ? 'اعتماد' : 'رفض';
    if (window.confirm(`هل أنت متأكد من ${actionText} طلب السلفة؟`)) {
      try {
        await client.put(`/advances/${id}/status`, { status });
        toast.success(`تم ${status === 'approved' ? 'اعتماد' : 'رفض'} السلفة`);
        fetchData();
      } catch (err) {
        toast.error('فشلت العملية');
      }
    }
  };

  const handleUpdateLoanStatus = async (id, status) => {
    const actionText = status === 'approved' ? 'اعتماد وجدولة' : 'رفض';
    if (window.confirm(`هل أنت متأكد من ${actionText} طلب القرض؟`)) {
      try {
        await client.put(`/loans/${id}/status`, { status });
        toast.success(`تم ${status === 'approved' ? 'اعتماد وجدولة' : 'رفض'} القرض بنجاح`);
        fetchData();
      } catch (err) {
        toast.error('فشلت العملية');
      }
    }
  };

  const translateStatus = (status) => {
    const map = {
      pending: 'قيد الانتظار',
      approved: 'مقبول ومعتمد',
      rejected: 'مرفوض'
    };
    return map[status] || status;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Header title="إدارة السلف والقروض الموظفين" />
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={() => setAdvanceModalOpen(true)}
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
            <DollarSign size={16} />
            <span>طلب سلفة مؤقتة</span>
          </button>
          
          <button 
            onClick={() => setLoanModalOpen(true)}
            style={{
              background: 'rgba(0, 39, 73, 0.05)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-main)',
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: '600'
            }}
          >
            <Landmark size={16} color="var(--primary)" />
            <span>طلب قرض طويل الأجل</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', gap: '1rem' }}>
        <button 
          onClick={() => setActiveTab('advances')}
          style={{
            padding: '1rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'advances' ? '2px solid var(--primary)' : 'none',
            color: activeTab === 'advances' ? 'var(--primary)' : 'var(--text-dim)',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          السلف المؤقتة (تخصم من راتب نفس الشهر)
        </button>
        <button 
          onClick={() => setActiveTab('loans')}
          style={{
            padding: '1rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'loans' ? '2px solid var(--primary)' : 'none',
            color: activeTab === 'loans' ? 'var(--primary)' : 'var(--text-dim)',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          القروض طويلة الأجل (جدولة أقساط شهرية)
        </button>
      </div>

      {/* Content */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>جاري تحميل البيانات...</div>
        ) : activeTab === 'advances' ? (
          /* ADVANCES TABLE */
          advances.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>لا توجد طلبات سلف مسجلة.</div>
          ) : (
            <table className="data-table" style={{ marginTop: 0 }}>
              <thead>
                <tr>
                  <th style={{ paddingRight: '1.5rem', textAlign: 'right' }}>اسم الموظف</th>
                  <th style={{ textAlign: 'right' }}>القسم</th>
                  <th style={{ textAlign: 'right' }}>مبلغ السلفة</th>
                  <th style={{ textAlign: 'right' }}>السبب</th>
                  <th style={{ textAlign: 'right' }}>تاريخ الطلب</th>
                  <th style={{ textAlign: 'right' }}>الحالة</th>
                  {isAdminOrHr && <th style={{ textAlign: 'left', paddingLeft: '1.5rem' }}>إجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {advances.map(rec => (
                  <tr key={rec.id} className="table-row">
                    <td style={{ paddingRight: '1.5rem', fontWeight: 600, color: 'var(--text-main)', textAlign: 'right' }}>{rec.employee_name}</td>
                    <td style={{ textAlign: 'right' }}>{rec.department}</td>
                    <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 'bold' }}>{rec.amount} ج.م</td>
                    <td style={{ textAlign: 'right' }}>{rec.reason}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-dim)' }}>{rec.created_at.substring(0, 10)}</td>
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
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => handleUpdateAdvanceStatus(rec.id, 'approved')}
                              style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', color: 'var(--accent)', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              موافقة
                            </button>
                            <button 
                              onClick={() => handleUpdateAdvanceStatus(rec.id, 'rejected')}
                              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              رفض
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>معتمد من {rec.approved_by?.split('@')[0]}</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          /* LOANS TABLE */
          loans.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>لا توجد طلبات قروض مسجلة.</div>
          ) : (
            <table className="data-table" style={{ marginTop: 0 }}>
              <thead>
                <tr>
                  <th style={{ paddingRight: '1.5rem', textAlign: 'right' }}>اسم الموظف</th>
                  <th style={{ textAlign: 'right' }}>قيمة القرض</th>
                  <th style={{ textAlign: 'right' }}>الأقساط</th>
                  <th style={{ textAlign: 'right' }}>القسط الشهري</th>
                  <th style={{ textAlign: 'right' }}>يبدأ من</th>
                  <th style={{ textAlign: 'right' }}>المتبقي</th>
                  <th style={{ textAlign: 'right' }}>الحالة</th>
                  <th style={{ textAlign: 'center' }}>جدول السداد</th>
                  {isAdminOrHr && <th style={{ textAlign: 'left', paddingLeft: '1.5rem' }}>إجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {loans.map(rec => (
                  <tr key={rec.id} className="table-row">
                    <td style={{ paddingRight: '1.5rem', fontWeight: 600, color: 'var(--text-main)', textAlign: 'right' }}>{rec.employee_name}</td>
                    <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 'bold' }}>{rec.amount} ج.م</td>
                    <td style={{ textAlign: 'right' }}>{rec.installments_count} شهر</td>
                    <td style={{ textAlign: 'right', color: '#60a5fa' }}>{rec.monthly_payment} ج.م</td>
                    <td style={{ textAlign: 'right' }}>{rec.start_month}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-dim)' }}>{rec.remaining_amount} ج.م ({rec.remaining_installments} قسط)</td>
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
                    <td style={{ textAlign: 'center' }}>
                      {rec.status === 'approved' ? (
                        <button 
                          onClick={() => { setSelectedLoanSchedule(rec); setScheduleModalOpen(true); }}
                          style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          عرض الأقساط
                        </button>
                      ) : '-'}
                    </td>
                    {isAdminOrHr && (
                      <td style={{ textAlign: 'left', paddingLeft: '1.5rem' }}>
                        {rec.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => handleUpdateLoanStatus(rec.id, 'approved')}
                              style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', color: 'var(--accent)', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              موافقة
                            </button>
                            <button 
                              onClick={() => handleUpdateLoanStatus(rec.id, 'rejected')}
                              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              رفض
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>معتمد من {rec.approved_by?.split('@')[0]}</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* ADVANCE REQUEST MODAL */}
      {advanceModalOpen && (
        <div className="modal-backdrop">
          <div className="card" style={{ width: '400px', padding: '2rem', position: 'relative', textAlign: 'right' }}>
            <button onClick={() => setAdvanceModalOpen(false)} style={{ position: 'absolute', left: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>تقديم طلب سلفة مؤقتة</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
              * السلفة المؤقتة تُخصم بالكامل تلقائياً من راتب نفس الشهر. الحد الأقصى المسموح به هو 50% من راتبك الأساسي.
            </p>
            <form onSubmit={handleAdvanceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">مبلغ السلفة المطلوب (ج.م) *</label>
                <input 
                  type="number" 
                  required 
                  value={advanceForm.amount} 
                  onChange={(e) => setAdvanceForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="مثال: 3000"
                  className="modal-input" 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">السبب *</label>
                <textarea 
                  required 
                  value={advanceForm.reason} 
                  onChange={(e) => setAdvanceForm(p => ({ ...p, reason: e.target.value }))}
                  placeholder="اكتب تفاصيل أو سبب السلفة..."
                  className="modal-input" 
                  style={{ minHeight: '80px', resize: 'vertical' }}
                />
              </div>
              <button type="submit" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.8rem', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)' }}>
                تقديم طلب السلفة
              </button>
            </form>
          </div>
        </div>
      )}

      {/* LOAN REQUEST MODAL */}
      {loanModalOpen && (
        <div className="modal-backdrop">
          <div className="card" style={{ width: '420px', padding: '2rem', position: 'relative', textAlign: 'right' }}>
            <button onClick={() => setLoanModalOpen(false)} style={{ position: 'absolute', left: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>تقديم طلب قرض طويل الأجل</h3>
            <form onSubmit={handleLoanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">مبلغ القرض المطلوب (ج.م) *</label>
                <input 
                  type="number" 
                  required 
                  value={loanForm.amount} 
                  onChange={(e) => setLoanForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="مثال: 24000"
                  className="modal-input" 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">عدد الأقساط الشهرية *</label>
                <select 
                  value={loanForm.installments_count} 
                  onChange={(e) => setLoanForm(p => ({ ...p, installments_count: e.target.value }))}
                  className="modal-input"
                  style={{ direction: 'rtl' }}
                >
                  <option value="6">٦ أشهر</option>
                  <option value="12">١٢ شهر (سنة)</option>
                  <option value="18">١٨ شهر</option>
                  <option value="24">٢٤ شهر (سنتين)</option>
                  <option value="36">٣٦ شهر (٣ سنوات)</option>
                  <option value="48">٤٨ شهر (٤ سنوات)</option>
                  <option value="60">٦٠ شهر (٥ سنوات)</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">شهر بدء السداد *</label>
                <input 
                  type="month" 
                  required 
                  value={loanForm.start_month} 
                  onChange={(e) => setLoanForm(p => ({ ...p, start_month: e.target.value }))}
                  className="modal-input" 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">السبب أو الغرض *</label>
                <textarea 
                  required 
                  value={loanForm.reason} 
                  onChange={(e) => setLoanForm(p => ({ ...p, reason: e.target.value }))}
                  placeholder="مثال: زواج، شراء سيارة، ظرف طارئ..."
                  className="modal-input" 
                  style={{ minHeight: '80px', resize: 'vertical' }}
                />
              </div>
              <button type="submit" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.8rem', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)' }}>
                تقديم طلب القرض
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE MODAL */}
      {scheduleModalOpen && selectedLoanSchedule && (
        <div className="modal-backdrop">
          <div className="card" style={{ width: '450px', padding: '2rem', position: 'relative', textAlign: 'right' }}>
            <button onClick={() => setScheduleModalOpen(false)} style={{ position: 'absolute', left: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>
              جدول أقساط القرض للموظف: {selectedLoanSchedule.employee_name}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
              إجمالي القرض: {selectedLoanSchedule.amount} ج.م على {selectedLoanSchedule.installments_count} شهر.
            </p>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
              <table className="data-table" style={{ marginTop: 0 }}>
                <thead>
                  <tr style={{ background: 'rgba(0, 39, 73, 0.02)' }}>
                    <th style={{ textAlign: 'right', paddingRight: '1rem' }}>الشهر</th>
                    <th style={{ textAlign: 'right' }}>مبلغ القسط</th>
                    <th style={{ textAlign: 'left', paddingLeft: '1rem' }}>حالة السداد</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedLoanSchedule.payments.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ textAlign: 'right', paddingRight: '1rem', fontSize: '0.85rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-start' }}>
                          <Calendar size={12} color="var(--primary)" />
                          {p.month}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{p.amount} ج.م</td>
                      <td style={{ textAlign: 'left', paddingLeft: '1rem' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          background: p.status === 'paid' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.03)',
                          color: p.status === 'paid' ? 'var(--accent)' : 'var(--text-dim)'
                        }}>
                          {p.status === 'paid' ? 'تم الخصم' : 'مستحق'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

export default LoansPage;
