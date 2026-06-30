import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Header from '../components/Header';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Wallet, Check, X, ShieldAlert, KeyRound, Eye, Lock, RefreshCw, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

const PayrollPage = () => {
  const { user } = useAuth();
  const isAdminOrCeo = ['admin', 'ceo', 'hr'].includes(user?.role);

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7)); // YYYY-MM
  const [payrollState, setPayrollState] = useState('draft'); // 'draft' or 'approved'
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [employeePayslips, setEmployeePayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminViewTab, setAdminViewTab] = useState('sheet'); // 'sheet' or 'payslips'

  // Decryption Modal state
  const [decryptModalOpen, setDecryptModalOpen] = useState(false);
  const [selectedPayslipId, setSelectedPayslipId] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [decryptedPayslip, setDecryptedPayslip] = useState(null);
  const [decryptLoading, setDecryptLoading] = useState(false);

  const fetchEmployeePayslips = async () => {
    try {
      const res = await client.get('/payroll/payslips');
      setEmployeePayslips(res.data);
    } catch (err) {
      console.error('Error fetching employee payslips:', err);
    }
  };

  const handleCalculatePayroll = async () => {
    setLoading(true);
    try {
      const res = await client.get(`/payroll/calculate?month=${selectedMonth}`);
      setPayrollState(res.data.status);
      setPayrollRecords(res.data.records);
      toast.success('تم احتساب الرواتب بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'فشل احتساب الرواتب');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePayroll = async () => {
    if (window.confirm(`هل أنت متأكد من اعتماد وإغلاق رواتب شهر ${selectedMonth}؟ لا يمكن تعديلها لاحقاً وسيجري خصم أقساط القروض والسلف تلقائياً.`)) {
      setLoading(true);
      try {
        await client.post(`/payroll/approve?month=${selectedMonth}`);
        toast.success(`تم اعتماد وإغلاق رواتب شهر ${selectedMonth} بنجاح`);
        handleCalculatePayroll();
      } catch (err) {
        toast.error(err.response?.data?.detail || 'فشل اعتماد الرواتب');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDecryptPayslipSubmit = async (e) => {
    e.preventDefault();
    setDecryptLoading(true);
    try {
      const res = await client.post(`/payroll/payslips/${selectedPayslipId}/decrypt`, {
        password: confirmPassword
      });
      setDecryptedPayslip(res.data);
      toast.success('تم فك تشفير مفردات المرتب بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'كلمة المرور غير صحيحة');
    } finally {
      setDecryptLoading(false);
    }
  };

  const fetchAllPayslips = async () => {
    try {
      setLoading(true);
      const res = await client.get(`/payroll/payslips?month=${selectedMonth}`);
      setEmployeePayslips(res.data);
    } catch (err) {
      console.error('Error fetching employee payslips:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdminOrCeo) {
      fetchEmployeePayslips();
    } else {
      if (adminViewTab === 'sheet') {
        handleCalculatePayroll();
      } else {
        fetchAllPayslips();
      }
    }
  }, [selectedMonth, adminViewTab]);

  useEffect(() => {
    if (decryptedPayslip) {
      document.body.classList.add('has-print-area');
    } else {
      document.body.classList.remove('has-print-area');
    }
    return () => {
      document.body.classList.remove('has-print-area');
    };
  }, [decryptedPayslip]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Header title="مسير الرواتب ومفردات المرتب (Payslips)" />
        
        {isAdminOrCeo && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                background: 'rgba(0, 39, 73, 0.02)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                color: 'var(--text-main)',
                outline: 'none',
                textAlign: 'right'
              }}
            />
            <button 
              onClick={handleCalculatePayroll}
              disabled={loading}
              style={{
                background: 'rgba(0, 39, 73, 0.05)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-main)',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>عرض الحسابات</span>
            </button>
            
            {payrollState === 'draft' && payrollRecords.length > 0 && user?.role !== 'hr' && (
              <button 
                onClick={handleApprovePayroll}
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.55rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                }}
              >
                اعتماد رواتب الشهر
              </button>
            )}
          </div>
        )}
      </div>

      {isAdminOrCeo && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', gap: '1rem', marginBottom: '1.5rem' }}>
          <button 
            onClick={() => setAdminViewTab('sheet')}
            style={{
              padding: '1rem 1.5rem',
              background: 'none',
              border: 'none',
              borderBottom: adminViewTab === 'sheet' ? '2px solid var(--primary)' : 'none',
              color: adminViewTab === 'sheet' ? 'var(--primary)' : 'var(--text-dim)',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            مسير الرواتب العام
          </button>
          <button 
            onClick={() => setAdminViewTab('payslips')}
            style={{
              padding: '1rem 1.5rem',
              background: 'none',
              border: 'none',
              borderBottom: adminViewTab === 'payslips' ? '2px solid var(--primary)' : 'none',
              color: adminViewTab === 'payslips' ? 'var(--primary)' : 'var(--text-dim)',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            إيصالات مفردات المرتب الفردية
          </button>
        </div>
      )}

      {isAdminOrCeo && adminViewTab === 'sheet' ? (
        /* ADMIN/CEO PAYROLL SHEET VIEW */
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>
              مسير الرواتب لشهر {selectedMonth} • الحالة: <span style={{ color: payrollState === 'approved' ? 'var(--accent)' : '#eab308', fontWeight: 'bold' }}>{payrollState === 'approved' ? 'معتمدة ومغلقة' : 'مسودة'}</span>
            </h3>
            {payrollState === 'approved' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>تم إصدار مفردات المرتب الرقمية المشفرة لجميع الموظفين.</span>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>جاري احتساب البيانات...</div>
          ) : payrollRecords.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>لا توجد رواتب مسجلة لهذا الشهر.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ marginTop: 0, minWidth: '1100px' }}>
                <thead>
                  <tr style={{ background: 'rgba(0, 39, 73, 0.01)' }}>
                    <th style={{ paddingRight: '1.5rem', textAlign: 'right' }}>اسم الموظف</th>
                    <th style={{ textAlign: 'right' }}>الأساسي</th>
                    <th style={{ textAlign: 'right' }}>الغياب</th>
                    <th style={{ textAlign: 'right' }}>التأخير</th>
                    <th style={{ textAlign: 'right' }}>قسط القرض</th>
                    <th style={{ textAlign: 'right' }}>السلف</th>
                    <th style={{ textAlign: 'right' }}>الجزاءات</th>
                    <th style={{ paddingLeft: '1.5rem', textAlign: 'left' }}>صافي المرتب</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRecords.map((rec, idx) => (
                    <tr key={idx} className="table-row">
                      <td style={{ paddingRight: '1.5rem', fontWeight: 600, color: 'var(--text-main)', textAlign: 'right' }}>{rec.employee_name}</td>
                      <td style={{ textAlign: 'right' }}>{rec.basic_salary} ج.م</td>
                      <td style={{ textAlign: 'right', color: '#f87171' }}>-{rec.deductions_unjustified_absence} ج.م</td>
                      <td style={{ textAlign: 'right', color: '#f87171' }}>-{rec.deductions_lateness} ج.م</td>
                      <td style={{ textAlign: 'right', color: '#f87171' }}>-{rec.deductions_loans} ج.م</td>
                      <td style={{ textAlign: 'right', color: '#f87171' }}>-{rec.deductions_advances} ج.م</td>
                      <td style={{ textAlign: 'right', color: '#f87171' }}>-{rec.deductions_penalties} ج.م</td>
                      <td style={{ paddingLeft: '1.5rem', fontWeight: 'bold', color: 'var(--primary)', textAlign: 'left', fontSize: '1rem' }}>{rec.net_salary} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* EMPLOYEE PAYSLIP LIST VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ background: 'rgba(79, 70, 229, 0.03)', border: '1px dashed rgba(79, 70, 229, 0.15)', padding: '1rem', borderRadius: '12px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            ℹ️ مفردات مرتبك الرقمية يتم حفظها بشكل مشفر وآمن بالكامل لحماية بياناتك المالية. لعرض التفاصيل الكاملة، سيطلب منك النظام تأكيد كلمة مرور حسابك الشخصي.
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>سجلات مفردات المرتب المتاحة</h3>
            </div>

            {employeePayslips.length === 0 ? (
              <div style={{ padding: '3rem', color: 'var(--text-dim)', textAlign: 'center' }}>لا توجد مفردات مرتب معتمدة متاحة للعرض حتى الآن.</div>
            ) : (
              <table className="data-table" style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th style={{ paddingRight: '1.5rem', textAlign: 'right' }}>الشهر</th>
                    {isAdminOrCeo && <th style={{ textAlign: 'right' }}>كود الموظف</th>}
                    {isAdminOrCeo && <th style={{ textAlign: 'right' }}>الموظف</th>}
                    <th style={{ textAlign: 'right' }}>المسمى الوظيفي</th>
                    <th style={{ textAlign: 'right' }}>القسم</th>
                    <th style={{ textAlign: 'right' }}>صافي المرتب المستلم</th>
                    <th style={{ paddingLeft: '1.5rem', textAlign: 'left' }}>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {employeePayslips.map(slip => (
                    <tr key={slip.id} className="table-row">
                      <td style={{ paddingRight: '1.5rem', fontWeight: 600, color: 'var(--primary)', textAlign: 'right' }}>{slip.month}</td>
                      {isAdminOrCeo && <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-dim)' }}>{slip.employee_id}</td>}
                      {isAdminOrCeo && <td style={{ textAlign: 'right', fontWeight: 600 }}>{slip.employee_name}</td>}
                      <td style={{ textAlign: 'right' }}>{slip.job_title}</td>
                      <td style={{ textAlign: 'right' }}>{slip.department}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent)' }}>{slip.net_salary} ج.م</td>
                      <td style={{ paddingLeft: '1.5rem', textAlign: 'left' }}>
                        <button 
                          onClick={() => { setSelectedPayslipId(slip.id); setDecryptedPayslip(null); setConfirmPassword(''); setDecryptModalOpen(true); }}
                          style={{
                            background: 'var(--glass)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--primary)',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.8rem'
                          }}
                        >
                          <Lock size={12} />
                          <span>فك التشفير وعرض التفاصيل</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* DECRYPT PAYSLIP MODAL */}
      {decryptModalOpen && (
        <div className="modal-backdrop">
          <div className="card" style={{ width: '500px', padding: '2rem', position: 'relative', textAlign: 'right' }}>
            <button 
              onClick={() => setDecryptModalOpen(false)} 
              style={{ position: 'absolute', left: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            {!decryptedPayslip ? (
              /* Verification step */
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ width: '50px', height: '50px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                    <ShieldAlert size={24} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>تأكيد الهوية لعرض مفردات المرتب</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
                    بياناتك المالية مشفرة وآمنة تماماً. يرجى إدخال كلمة مرور الحساب الشخصي لفك تشفير تفاصيل المرتب وعرضها.
                  </p>
                </div>

                <form onSubmit={handleDecryptPayslipSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label className="input-label">كلمة المرور الشخصية *</label>
                    <div style={{ position: 'relative' }}>
                      <KeyRound size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                      <input 
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{
                          width: '100%',
                          background: 'rgba(0, 39, 73, 0.03)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '8px',
                          padding: '0.6rem 2.5rem 0.6rem 1rem',
                          color: 'var(--text-main)',
                          outline: 'none',
                          textAlign: 'right'
                        }}
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={decryptLoading}
                    style={{
                      background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {decryptLoading ? 'جاري فك التشفير...' : 'تأكيد كلمة المرور وتدقيق البيانات'}
                  </button>
                </form>
              </div>
            ) : (
              /* Decrypted details step */
              <div id="print-area">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.3rem', color: 'var(--text-main)', fontWeight: 'bold' }}>إيصال مفردات راتب رقمي</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>إكس كيو فارما (ش.م.م)</p>
                  </div>
                  <span style={{ padding: '4px 10px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent)', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>معتمد ومغلق</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(0, 39, 73, 0.01)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  <div><strong>اسم الموظف:</strong> {decryptedPayslip.employee_name}</div>
                  <div><strong>كود الموظف:</strong> {decryptedPayslip.employee_id}</div>
                  <div><strong>القسم الإداري:</strong> {decryptedPayslip.department}</div>
                  <div><strong>عن شهر:</strong> {decryptedPayslip.month}</div>
                </div>

                {/* Grid Breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-dim)' }}>الراتب الأساسي</span>
                    <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>{decryptedPayslip.basic_salary} ج.م</span>
                  </div>

                  {decryptedPayslip.deductions_unjustified_absence > 0 && (
                    <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                        <span>خصم أيام الغياب غير المبررة ({decryptedPayslip.absent_days_count} يوم)</span>
                        <span>-{decryptedPayslip.deductions_unjustified_absence} ج.م</span>
                      </div>
                      {decryptedPayslip.absent_days_details && decryptedPayslip.absent_days_details.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem', textAlign: 'right' }}>
                          أيام الغياب: {decryptedPayslip.absent_days_details.join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  {decryptedPayslip.deductions_lateness > 0 && (
                    <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                        <span>خصم دقائق التأخير عن المواعيد ({decryptedPayslip.lateness_minutes} دقيقة)</span>
                        <span>-{decryptedPayslip.deductions_lateness} ج.م</span>
                      </div>
                      {decryptedPayslip.lateness_days_details && decryptedPayslip.lateness_days_details.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem', textAlign: 'right', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'flex-start', direction: 'rtl' }}>
                          <span>تفاصيل التأخير:</span>
                          {decryptedPayslip.lateness_days_details.map((d, idx) => (
                            <span key={idx} style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                              {d.date} ({d.minutes_late} د عند {d.check_in})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {decryptedPayslip.deductions_loans > 0 && (
                    <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                        <span>خصم قسط القرض الشهري المجدول</span>
                        <span>-{decryptedPayslip.deductions_loans} ج.م</span>
                      </div>
                      {decryptedPayslip.loans_details && decryptedPayslip.loans_details.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem', textAlign: 'right' }}>
                          {decryptedPayslip.loans_details.map((l, idx) => (
                            <div key={idx}>قسط القرض المستحق لشهر {l.installment_month} بمبلغ {l.amount} ج.م</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {decryptedPayslip.deductions_advances > 0 && (
                    <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                        <span>خصم السلفة المؤقتة المسحوبة</span>
                        <span>-{decryptedPayslip.deductions_advances} ج.م</span>
                      </div>
                      {decryptedPayslip.advances_details && decryptedPayslip.advances_details.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem', textAlign: 'right', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'flex-start', direction: 'rtl' }}>
                          <span>تفاصيل السلف:</span>
                          {decryptedPayslip.advances_details.map((a, idx) => (
                            <span key={idx} style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                              بتاريخ {a.date || 'غير محدد'} بمبلغ {a.amount} ج.م
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {decryptedPayslip.deductions_penalties > 0 && (
                    <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                        <span>خصم الجزاءات الإدارية الصادرة</span>
                        <span>-{decryptedPayslip.deductions_penalties} ج.م</span>
                      </div>
                      {decryptedPayslip.penalties_details && decryptedPayslip.penalties_details.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {decryptedPayslip.penalties_details.map((p, idx) => (
                            <div key={idx} style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                              تاريخ {p.date}: {p.reason} ({p.amount} ج.م)
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Net Pay */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--primary)', paddingTop: '1rem', marginTop: '1rem', fontSize: '1.15rem' }}>
                    <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>صافي المرتب المستلم</span>
                    <span style={{ color: 'var(--primary)', fontWeight: '800' }}>{decryptedPayslip.net_salary} ج.م</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                  <button 
                    onClick={handlePrint}
                    style={{
                      flex: 1,
                      background: 'rgba(0, 39, 73, 0.05)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--text-main)',
                      padding: '0.6rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <Printer size={14} />
                    <span>طباعة مفردات المرتب</span>
                  </button>
                  <button 
                    onClick={() => setDecryptModalOpen(false)}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.6rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '700'
                    }}
                  >
                    إغلاق العرض
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {decryptedPayslip && createPortal(
        <div id="print-area-portal">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #cbd5e1', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', color: '#000000', fontWeight: 'bold' }}>إيصال مفردات راتب رقمي</h2>
              <p style={{ fontSize: '0.85rem', color: '#0f172a' }}>إكس كيو فارما (ش.م.م)</p>
            </div>
            <span style={{ padding: '4px 10px', background: 'rgba(34, 197, 94, 0.1)', color: '#059669', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>معتمد ومغلق</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '0.85rem', marginBottom: '1.5rem', color: '#000000' }}>
            <div><strong>اسم الموظف:</strong> {decryptedPayslip.employee_name}</div>
            <div><strong>كود الموظف:</strong> {decryptedPayslip.employee_id}</div>
            <div><strong>القسم الإداري:</strong> {decryptedPayslip.department}</div>
            <div><strong>عن شهر:</strong> {decryptedPayslip.month}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem', color: '#000000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem' }}>
              <span>الراتب الأساسي</span>
              <span style={{ fontWeight: 'bold' }}>{decryptedPayslip.basic_salary} ج.م</span>
            </div>

            {decryptedPayslip.deductions_unjustified_absence > 0 && (
              <div style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                  <span>خصم أيام الغياب غير المبررة ({decryptedPayslip.absent_days_count} يوم)</span>
                  <span>-{decryptedPayslip.deductions_unjustified_absence} ج.م</span>
                </div>
                {decryptedPayslip.absent_days_details && decryptedPayslip.absent_days_details.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem', textAlign: 'right' }}>
                    أيام الغياب: {decryptedPayslip.absent_days_details.join(', ')}
                  </div>
                )}
              </div>
            )}

            {decryptedPayslip.deductions_lateness > 0 && (
              <div style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                  <span>خصم دقائق التأخير عن المواعيد ({decryptedPayslip.lateness_minutes} دقيقة)</span>
                  <span>-{decryptedPayslip.deductions_lateness} ج.م</span>
                </div>
                {decryptedPayslip.lateness_days_details && decryptedPayslip.lateness_days_details.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem', textAlign: 'right', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'flex-start', direction: 'rtl' }}>
                    <span>تفاصيل التأخير:</span>
                    {decryptedPayslip.lateness_days_details.map((d, idx) => (
                      <span key={idx} style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                        {d.date} ({d.minutes_late} د عند {d.check_in})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {decryptedPayslip.deductions_loans > 0 && (
              <div style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                  <span>خصم قسط القرض الشهري المجدول</span>
                  <span>-{decryptedPayslip.deductions_loans} ج.م</span>
                </div>
                {decryptedPayslip.loans_details && decryptedPayslip.loans_details.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem', textAlign: 'right' }}>
                    {decryptedPayslip.loans_details.map((l, idx) => (
                      <div key={idx}>قسط القرض المستحق لشهر {l.installment_month} بمبلغ {l.amount} ج.م</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {decryptedPayslip.deductions_advances > 0 && (
              <div style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                  <span>خصم السلفة المؤقتة المسحوبة</span>
                  <span>-{decryptedPayslip.deductions_advances} ج.م</span>
                </div>
                {decryptedPayslip.advances_details && decryptedPayslip.advances_details.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem', textAlign: 'right', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'flex-start', direction: 'rtl' }}>
                    <span>تفاصيل السلف:</span>
                    {decryptedPayslip.advances_details.map((a, idx) => (
                      <span key={idx} style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                        بتاريخ {a.date || 'غير محدد'} بمبلغ {a.amount} ج.م
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {decryptedPayslip.deductions_penalties > 0 && (
              <div style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                  <span>خصم الجزاءات الإدارية الصادرة</span>
                  <span>-{decryptedPayslip.deductions_penalties} ج.م</span>
                </div>
                {decryptedPayslip.penalties_details && decryptedPayslip.penalties_details.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {decryptedPayslip.penalties_details.map((p, idx) => (
                      <div key={idx} style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                        تاريخ {p.date}: {p.reason} ({p.amount} ج.م)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '1rem', marginTop: '1rem', fontSize: '1.15rem' }}>
              <span>صافي المرتب المستلم</span>
              <span style={{ fontWeight: '800', color: '#0f172a' }}>{decryptedPayslip.net_salary} ج.م</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        #print-area-portal {
          display: none;
        }
        .table-row:hover {
          background: rgba(0, 39, 73, 0.01);
        }
        @media print {
          :root {
            --text-main: #000000 !important;
            --text-dim: #374151 !important;
            --primary: #0f172a !important;
            --accent: #059669 !important;
            --danger: #dc2626 !important;
            --glass-border: #cbd5e1 !important;
            --bg-dark: #ffffff !important;
            --bg-card: #ffffff !important;
          }
          
          body {
            background: white !important;
            color: black !important;
          }
          
          .sidebar, .nav-links, .logout-btn, button, input, select, .mobile-topbar {
            display: none !important;
          }
          
          .app-container, .layout-content-wrapper, .main-content {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          
          .card {
            background: white !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          
          .data-table {
            color: black !important;
            border-collapse: collapse !important;
            width: 100% !important;
          }
          
          .data-table th, .data-table td {
            border-bottom: 1px solid #cbd5e1 !important;
            color: black !important;
            padding: 0.5rem !important;
          }

          body.has-print-area #root {
            display: none !important;
          }
          
          body.has-print-area #print-area-portal {
            display: block !important;
            background: white !important;
            color: black !important;
            width: 100% !important;
            height: auto !important;
            direction: rtl !important;
            text-align: right !important;
            padding: 2rem !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PayrollPage;
