import { useState, useEffect } from 'react';
import Header from '../components/Header';
import client, { BACKEND_URL } from '../api/client';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Camera, 
  X, 
  UserPlus, 
  Check, 
  AlertCircle,
  FileText,
  Briefcase,
  AlertTriangle,
  History,
  ShieldCheck,
  Download,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../context/AuthContext';

const EmployeesPage = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [contractAlerts, setContractAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState('');
  const [modalTab, setModalTab] = useState('basic'); // 'basic', 'documents', 'career', 'penalties', 'assets'

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    job_title: '',
    national_id: '',
    salary: '',
    address: '',
    emergency_contact: '',
    contract_end_date: '',
    two_factor_enabled: false
  });
  
  // Nested sub-form states (Personnel digital archive)
  const [docForm, setDocForm] = useState({ name: '', type: 'national_id', file: null });
  const [careerForm, setCareerForm] = useState({ title: '', department: '', start_date: '', notes: '' });
  const [penaltyForm, setPenaltyForm] = useState({ type: 'lateness', amount: '', date: '', notes: '' });
  const [assignedAssets, setAssignedAssets] = useState([]);

  // Camera database upload
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadingEmp, setUploadingEmp] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      let url = '/employees?per_page=100';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (selectedDept) url += `&department=${encodeURIComponent(selectedDept)}`;
      
      const res = await client.get(url);
      setEmployees(res.data.employees);
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await client.get('/departments');
      setDepartments(res.data.departments);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchContractAlerts = async () => {
    try {
      const res = await client.get('/employees/alerts');
      setContractAlerts(res.data);
    } catch (err) {
      console.error('Error loading contract alerts:', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [search, selectedDept]);

  useEffect(() => {
    fetchDepartments();
    fetchContractAlerts();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'salary' ? (value ? parseFloat(value) : '') : value)
    }));
  };

  const openAddModal = () => {
    setIsEdit(false);
    setModalTab('basic');
    setFormData({
      name: '',
      email: '',
      phone: '',
      department: departments[0]?.name || 'IT',
      job_title: '',
      national_id: '',
      salary: '',
      address: '',
      emergency_contact: '',
      contract_end_date: '',
      two_factor_enabled: false
    });
    setModalOpen(true);
  };

  const openEditModal = async (emp) => {
    setIsEdit(true);
    setModalTab('basic');
    setEditingEmpId(emp.employee_id);
    setFormData({
      name: emp.name,
      email: emp.email,
      phone: emp.phone || '',
      department: emp.department || '',
      job_title: emp.job_title || '',
      national_id: emp.national_id || '',
      salary: emp.salary || '',
      address: emp.address || '',
      emergency_contact: emp.emergency_contact || '',
      contract_end_date: emp.contract_end_date || '',
      two_factor_enabled: emp.two_factor_enabled || false
    });
    
    // Fetch assigned assets for exit clearance visibility
    try {
      const assetsRes = await client.get('/assets');
      const filtered = assetsRes.data.filter(a => a.employee_id === emp.employee_id);
      setAssignedAssets(filtered);
    } catch (err) {
      console.error(err);
    }

    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await client.put(`/employees/${editingEmpId}`, formData);
        toast.success('تم تحديث بيانات الموظف بنجاح');
      } else {
        await client.post('/employees', formData);
        toast.success('تم إنشاء ملف الموظف والرمز الافتراضي لحسابه هو changeme123');
      }
      setModalOpen(false);
      fetchEmployees();
      fetchDepartments();
      fetchContractAlerts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'حدث خطأ أثناء الحفظ');
    }
  };

  const handleDelete = async (employeeId) => {
    if (window.confirm(`هل أنت متأكد من حذف الموظف ${employeeId} نهائياً؟ سيتم إزالة كافة السجلات والـ login وسجل الحضور.`)) {
      try {
        await client.delete(`/employees/${employeeId}`);
        toast.success('تم حذف ملف الموظف بنجاح');
        fetchEmployees();
        fetchDepartments();
        fetchContractAlerts();
      } catch (err) {
        toast.error(err.response?.data?.detail || 'فشل الحذف. تحقق من عدم وجود عهد نشطة لديه.');
      }
    }
  };

  // Nest actions (Hiring papers documents, promotions career-path, administrative penalties)
  const handleDocUpload = async (e) => {
    e.preventDefault();
    if (!docForm.file || !docForm.name) {
      toast.error('يرجى اختيار ملف وكتابة اسم المستند');
      return;
    }
    
    const form = new FormData();
    form.append('name', docForm.name);
    form.append('doc_type', docForm.type);
    form.append('file', docForm.file);

    try {
      const res = await client.post(`/employees/${editingEmpId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('تم رفع المستند وأرشفته بنجاح');
      setFormData(prev => ({ ...prev, documents: res.data.documents }));
      setDocForm({ name: '', type: 'national_id', file: null });
    } catch (err) {
      toast.error('فشل رفع وأرشفة المستند');
    }
  };

  const handleCareerAdd = async (e) => {
    e.preventDefault();
    try {
      const res = await client.post(`/employees/${editingEmpId}/career-path`, careerForm);
      toast.success('تم تدوين الترقية/التعديل الوظيفي بنجاح');
      setFormData(prev => ({ ...prev, career_path: res.data.career_path }));
      setCareerForm({ title: '', department: '', start_date: '', notes: '' });
    } catch (err) {
      toast.error('فشل تسجيل التدرج الوظيفي');
    }
  };

  const handlePenaltyAdd = async (e) => {
    e.preventDefault();
    try {
      const res = await client.post(`/employees/${editingEmpId}/penalties`, penaltyForm);
      toast.success('تم تسجيل الجزاء الإداري وسيتم تفعيله تلقائياً في شيت الرواتب');
      setFormData(prev => ({ ...prev, penalties: res.data.penalties }));
      setPenaltyForm({ type: 'lateness', amount: '', date: '', notes: '' });
    } catch (err) {
      toast.error('فشل تسجيل الجزاء');
    }
  };

  // Face photos headshot upload
  const handleFileChange = (e) => {
    setSelectedFiles(Array.from(e.target.files));
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadSuccess(false);
    const form = new FormData();
    selectedFiles.forEach(file => {
      form.append('photos', file);
    });

    try {
      await client.post(`/employees/${uploadingEmp.employee_id}/face-photos`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadSuccess(true);
      setSelectedFiles([]);
      setTimeout(() => {
        setUploadModalOpen(false);
        setUploadSuccess(false);
      }, 1500);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'فشل رفع الصور');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Header title="ملفات شؤون الموظفين والأرشيف الرقمي" />
        <button 
          onClick={openAddModal}
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
          <UserPlus size={16} />
          <span>إضافة موظف جديد</span>
        </button>
      </div>

      {/* Contract End Alerts Warning Banner (30 days limit) */}
      {contractAlerts.length > 0 && (
        <div style={{ 
          background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', 
          border: '1px solid rgba(239, 68, 68, 0.2)', 
          borderRadius: '16px', 
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          textAlign: 'right'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontWeight: 'bold' }}>
            <AlertTriangle size={18} />
            <span>تنبيهات انتهاء عقود الموظفين (خلال ٣٠ يوماً):</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {contractAlerts.map(alert => (
              <div key={alert.employee_id} style={{ background: 'rgba(255, 255, 255, 0.6)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.8rem', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                • الموظف: <strong>{alert.name}</strong> ({alert.employee_id})<br />
                ينتهي العقد بتاريخ <strong>{alert.contract_end_date}</strong> (متبقي: <strong>{alert.days_left} يوم</strong>)
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem' }}>
        <div style={{ position: 'relative', flexGrow: 1 }}>
          <Search size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            type="text"
            placeholder="البحث باسم الموظف، البريد، أو كود التوظيف..."
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

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          style={{
            background: 'rgba(0, 39, 73, 0.02)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '0.6rem 1.5rem 0.6rem 1rem',
            color: 'var(--text-main)',
            outline: 'none',
            minWidth: '180px',
            direction: 'rtl'
          }}
        >
          <option value="">جميع الأقسام</option>
          {departments.map(d => (
            <option key={d.id} value={d.name} style={{ background: 'var(--bg-card)' }}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Employees Grid Table */}
      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>جاري تحميل ملفات الموظفين...</div>
        ) : employees.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            لا يوجد موظفين مسجلين حالياً. اضغط على إضافة موظف للبدء.
          </div>
        ) : (
          <table className="data-table" style={{ marginTop: 0 }}>
            <thead>
              <tr style={{ background: 'rgba(0, 39, 73, 0.01)' }}>
                <th style={{ paddingRight: '1.5rem', textAlign: 'right' }}>كود الموظف</th>
                <th style={{ textAlign: 'right' }}>الموظف التفاصيل</th>
                <th style={{ textAlign: 'right' }}>القسم الإداري</th>
                <th style={{ textAlign: 'right' }}>المسمى الوظيفي</th>
                <th style={{ textAlign: 'right' }}>الحالة</th>
                <th style={{ paddingLeft: '1.5rem', textAlign: 'left' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} className="table-row">
                  <td style={{ paddingRight: '1.5rem', fontWeight: 600, color: 'var(--primary)', textAlign: 'right' }}>{emp.employee_id}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start' }}>
                      <div className="user-avatar" style={{ width: '40px', height: '40px', fontSize: '1.1rem' }}>
                        {emp.name[0]}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600 }}>{emp.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>{emp.department}</td>
                  <td style={{ textAlign: 'right' }}>{emp.job_title}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: emp.is_active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: emp.is_active ? 'var(--accent)' : 'var(--danger)'
                    }}>
                      {emp.is_active ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td style={{ paddingLeft: '1.5rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => { setUploadingEmp(emp); setUploadModalOpen(true); }}
                        title="تحميل صور بصمة الوجه"
                        style={{
                          background: 'rgba(96, 165, 250, 0.1)',
                          border: '1px solid rgba(96, 165, 250, 0.2)',
                          color: '#60a5fa',
                          padding: '0.4rem',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        <Camera size={14} />
                      </button>
                      {/* Hide edit if it's CEO and current user is not CEO */}
                      {!( (emp.employee_id === 'EMP-7777' || emp.job_title === 'الرئيس التنفيذي') && user?.role !== 'ceo' ) && (
                        <button 
                          onClick={() => openEditModal(emp)}
                          title="الملف الرقمي والتعديل"
                          style={{
                            background: 'rgba(0, 39, 73, 0.03)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-main)',
                            padding: '0.4rem',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      {/* Never allow deletion of the CEO */}
                      {!(emp.employee_id === 'EMP-7777' || emp.job_title === 'الرئيس التنفيذي') && (
                        <button 
                          onClick={() => handleDelete(emp.employee_id)}
                          title="حذف الملف"
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            padding: '0.4rem',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Profile Detail / Add / Edit Modal with Digital Personnel Archive Tabs */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="card" style={{
            width: '680px',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '2rem',
            position: 'relative',
            textAlign: 'right',
            animation: 'modalScale 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <button 
              onClick={() => setModalOpen(false)}
              style={{ position: 'absolute', left: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>
              {isEdit ? `الملف الرقمي الشامل: ${formData.name} (${editingEmpId})` : 'إضافة ملف موظف جديد'}
            </h3>

            {/* Modal Tabs if in edit mode */}
            {isEdit && (
              <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '2px' }}>
                <button type="button" onClick={() => setModalTab('basic')} style={{ padding: '0.6rem 1rem', background: modalTab === 'basic' ? 'var(--glass)' : 'none', border: 'none', color: modalTab === 'basic' ? 'var(--primary)' : 'var(--text-dim)', cursor: 'pointer', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.85rem' }}>البيانات الأساسية</button>
                <button type="button" onClick={() => setModalTab('documents')} style={{ padding: '0.6rem 1rem', background: modalTab === 'documents' ? 'var(--glass)' : 'none', border: 'none', color: modalTab === 'documents' ? 'var(--primary)' : 'var(--text-dim)', cursor: 'pointer', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.85rem' }}>مسوغات التعيين</button>
                <button type="button" onClick={() => setModalTab('career')} style={{ padding: '0.6rem 1rem', background: modalTab === 'career' ? 'var(--glass)' : 'none', border: 'none', color: modalTab === 'career' ? 'var(--primary)' : 'var(--text-dim)', cursor: 'pointer', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.85rem' }}>التدرج الوظيفي</button>
                <button type="button" onClick={() => setModalTab('penalties')} style={{ padding: '0.6rem 1rem', background: modalTab === 'penalties' ? 'var(--glass)' : 'none', border: 'none', color: modalTab === 'penalties' ? 'var(--primary)' : 'var(--text-dim)', cursor: 'pointer', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.85rem' }}>الجزاءات الإدارية</button>
                <button type="button" onClick={() => setModalTab('assets')} style={{ padding: '0.6rem 1rem', background: modalTab === 'assets' ? 'var(--glass)' : 'none', border: 'none', color: modalTab === 'assets' ? 'var(--primary)' : 'var(--text-dim)', cursor: 'pointer', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.85rem' }}>العهدة والأصول</button>
              </div>
            )}

            {/* TAB 1: BASIC INFORMATION */}
            {modalTab === 'basic' && (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label className="input-label">الاسم بالكامل *</label>
                    <input type="text" name="name" required value={formData.name} onChange={handleInputChange} className="modal-input" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label className="input-label">البريد الإلكتروني للعمل *</label>
                    <input type="email" name="email" required disabled={isEdit} value={formData.email} onChange={handleInputChange} className="modal-input" style={{ textAlign: 'left' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label className="input-label">رقم الهاتف</label>
                    <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} className="modal-input" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label className="input-label">القسم الإداري *</label>
                    <select name="department" required value={formData.department} onChange={handleInputChange} className="modal-input" style={{ direction: 'rtl' }}>
                      {departments.map(d => (
                        <option key={d.id} value={d.name} style={{ background: 'var(--bg-card)' }}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label className="input-label">المسمى الوظيفي *</label>
                    <input type="text" name="job_title" required value={formData.job_title} onChange={handleInputChange} className="modal-input" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label className="input-label">الرقم القومي (١٤ رقم) *</label>
                    <input type="text" name="national_id" required value={formData.national_id} onChange={handleInputChange} className="modal-input" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label className="input-label">الراتب الأساسي شهرياً (ج.م) *</label>
                    <input type="number" name="salary" required value={formData.salary} onChange={handleInputChange} className="modal-input" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label className="input-label">تاريخ انتهاء العقد *</label>
                    <input type="date" name="contract_end_date" required value={formData.contract_end_date} onChange={handleInputChange} className="modal-input" />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label className="input-label">العنوان السكني بالتفصيل</label>
                  <input type="text" name="address" value={formData.address} onChange={handleInputChange} className="modal-input" />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label className="input-label">بيانات الاتصال بالطوارئ</label>
                  <input type="text" name="emergency_contact" value={formData.emergency_contact} onChange={handleInputChange} className="modal-input" placeholder="مثال: الزوجة: الاسم (رقم الهاتف)" />
                </div>

                {isEdit && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                    <input 
                      type="checkbox" 
                      id="two_factor_enabled"
                      name="two_factor_enabled"
                      checked={formData.two_factor_enabled}
                      onChange={handleInputChange}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="two_factor_enabled" style={{ fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>تفعيل التحقق الثنائي (2FA) عند تسجيل الدخول للموظف</label>
                  </div>
                )}

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
                    marginTop: '1rem',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                  }}
                >
                  {isEdit ? 'حفظ التعديلات الحالية' : 'إنشاء ملف الموظف'}
                </button>
              </form>
            )}

            {/* TAB 2: DIGITAL ARCHIVE DOCUMENTS */}
            {modalTab === 'documents' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <form onSubmit={handleDocUpload} style={{ background: 'rgba(0, 39, 73, 0.01)', border: '1px solid var(--glass-border)', padding: '1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h4 style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>أرشفة مسوغ تعيين جديد</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label className="input-label">اسم المستند</label>
                      <input type="text" value={docForm.name} onChange={(e) => setDocForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: شهادة التخرج" className="modal-input" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label className="input-label">نوع المستند</label>
                      <select value={docForm.type} onChange={(e) => setDocForm(p => ({ ...p, type: e.target.value }))} className="modal-input" style={{ direction: 'rtl' }}>
                        <option value="national_id">صورة الرقم القومي</option>
                        <option value="graduation">شهادة التخرج</option>
                        <option value="criminal_record">فيش وتشبيه حديث</option>
                        <option value="military">شهادة التجنيد</option>
                        <option value="contract">عقد العمل الموقع</option>
                        <option value="other">أخرى</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label className="input-label">الملف (Scanner PDF / صورة)</label>
                    <input type="file" required onChange={(e) => setDocForm(p => ({ ...p, file: e.target.files[0] }))} className="modal-input" style={{ background: 'none', border: 'none', padding: 0 }} />
                  </div>
                  <button type="submit" style={{ background: 'var(--primary)', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem', fontWeight: 'bold', cursor: 'pointer' }}>رفع وحفظ بالأرشيف</button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>أرشيف المستندات المرفوعة:</h4>
                  {(!formData.documents || formData.documents.length === 0) ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>لا توجد مستندات مؤرشفة في الملف الرقمي حالياً.</p>
                  ) : (
                    <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
                      <table className="data-table" style={{ marginTop: 0 }}>
                        <thead>
                          <tr style={{ background: 'rgba(0, 39, 73, 0.02)' }}>
                            <th style={{ textAlign: 'right', paddingRight: '1rem' }}>اسم الملف</th>
                            <th style={{ textAlign: 'right' }}>النوع</th>
                            <th style={{ textAlign: 'right' }}>تاريخ الأرشفة</th>
                            <th style={{ textAlign: 'left', paddingLeft: '1rem' }}>تحميل</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.documents.map(doc => (
                            <tr key={doc.doc_id}>
                              <td style={{ textAlign: 'right', paddingRight: '1rem', color: 'var(--text-main)' }}>{doc.name}</td>
                              <td style={{ textAlign: 'right' }}>{doc.type}</td>
                              <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{doc.upload_date}</td>
                              <td style={{ textAlign: 'left', paddingLeft: '1rem' }}>
                                <a href={`${BACKEND_URL}${doc.file_url}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <Download size={14} />
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: CAREER PROGRESSION TIMELINE */}
            {modalTab === 'career' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <form onSubmit={handleCareerAdd} style={{ background: 'rgba(0, 39, 73, 0.01)', border: '1px solid var(--glass-border)', padding: '1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h4 style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>تسجيل ترقية أو تغيير في التدرج الوظيفي</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label className="input-label">المسمى الوظيفي الجديد</label>
                      <input type="text" required value={careerForm.title} onChange={(e) => setCareerForm(p => ({ ...p, title: e.target.value }))} placeholder="مثال: Senior Developer" className="modal-input" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label className="input-label">القسم الإداري الجديد</label>
                      <select value={careerForm.department} required onChange={(e) => setCareerForm(p => ({ ...p, department: e.target.value }))} className="modal-input" style={{ direction: 'rtl' }}>
                        <option value="">اختر القسم...</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label className="input-label">تاريخ سريان التعديل</label>
                      <input type="date" required value={careerForm.start_date} onChange={(e) => setCareerForm(p => ({ ...p, start_date: e.target.value }))} className="modal-input" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label className="input-label">ملاحظات أو قرارات مرافقة</label>
                    <input type="text" value={careerForm.notes} onChange={(e) => setCareerForm(p => ({ ...p, notes: e.target.value }))} placeholder="مثال: بموجب قرار مجلس الإدارة رقم ١٢" className="modal-input" />
                  </div>
                  <button type="submit" style={{ background: 'var(--primary)', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem', fontWeight: 'bold', cursor: 'pointer' }}>حفظ التعديل الوظيفي</button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h4 style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>جدول التدرج الوظيفي (تاريخ الترقيات):</h4>
                  {(!formData.career_path || formData.career_path.length === 0) ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>لم يتم تسجيل أي ترقيات للموظف بعد.</p>
                  ) : (
                    <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1rem', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {formData.career_path.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '1rem', position: 'relative', borderRight: '2px solid var(--primary)', paddingRight: '1rem' }}>
                          <div style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%', position: 'absolute', right: '-5px', top: '6px' }}></div>
                          <div>
                            <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{item.title} • قسم {item.department}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>تاريخ البدء: {item.start_date}</div>
                            {item.notes && <div style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--primary)' }}>• {item.notes}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: ADMINISTRATIVE PENALTIES */}
            {modalTab === 'penalties' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <form onSubmit={handlePenaltyAdd} style={{ background: 'rgba(0, 39, 73, 0.01)', border: '1px solid var(--glass-border)', padding: '1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h4 style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>تسجيل جزاء إداري أو مالي جديد</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label className="input-label">مبلغ الخصم أو الجزاء (ج.م) *</label>
                      <input type="number" required value={penaltyForm.amount} onChange={(e) => setPenaltyForm(p => ({ ...p, amount: e.target.value }))} placeholder="مثال: 500" className="modal-input" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label className="input-label">تاريخ المخالفة / الجزاء</label>
                      <input type="date" required value={penaltyForm.date} onChange={(e) => setPenaltyForm(p => ({ ...p, date: e.target.value }))} className="modal-input" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label className="input-label">نوع أو سبب الجزاء</label>
                    <input type="text" required value={penaltyForm.notes} onChange={(e) => setPenaltyForm(p => ({ ...p, notes: e.target.value }))} placeholder="مثال: إتلاف عهدة، التغيب بدون إخطار..." className="modal-input" />
                  </div>
                  <button type="submit" style={{ background: 'var(--danger)', color: 'var(--text-main)', border: 'none', borderRadius: '6px', padding: '0.5rem', fontWeight: 'bold', cursor: 'pointer' }}>توقيع الجزاء</button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>سجل الجزاءات الإدارية الموقعة:</h4>
                  {(!formData.penalties || formData.penalties.length === 0) ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>السجل خالٍ من أي جزاءات مسبقة.</p>
                  ) : (
                    <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
                      <table className="data-table" style={{ marginTop: 0 }}>
                        <thead>
                          <tr style={{ background: 'rgba(0, 39, 73, 0.02)' }}>
                            <th style={{ textAlign: 'right', paddingRight: '1rem' }}>السبب</th>
                            <th style={{ textAlign: 'right' }}>التاريخ</th>
                            <th style={{ textAlign: 'left', paddingLeft: '1rem' }}>قيمة الجزاء</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.penalties.map(p => (
                            <tr key={p.penalty_id}>
                              <td style={{ textAlign: 'right', paddingRight: '1rem', color: 'var(--text-main)' }}>{p.notes}</td>
                              <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{p.date}</td>
                              <td style={{ textAlign: 'left', paddingLeft: '1rem', color: 'var(--danger)', fontWeight: 'bold' }}>-{p.amount} ج.م</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: ASSIGNED ASSETS */}
            {modalTab === 'assets' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>العهد والأصول المسلمة للموظف:</h4>
                
                {assignedAssets.length === 0 ? (
                  <div style={{ padding: '2rem', background: 'rgba(0,255,213,0.02)', border: '1px dashed var(--glass-border)', borderRadius: '12px', color: 'var(--primary)', textAlign: 'center', fontSize: '0.85rem' }}>
                    ✓ الموظف ليس لديه أي عهد معلقة حالياً. يمكن عمل "مخالصة" وإيقاف الخدمة في أي وقت.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertCircle size={16} />
                      <span>تنبيه: لا يمكن إنهاء الخدمة أو حذف الموظف إلا بعد إرجاع هذه العهد أولاً.</span>
                    </div>
                    
                    <div style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
                      <table className="data-table" style={{ marginTop: 0 }}>
                        <thead>
                          <tr style={{ background: 'rgba(0, 39, 73, 0.02)' }}>
                            <th style={{ textAlign: 'right', paddingRight: '1rem' }}>العهدة</th>
                            <th style={{ textAlign: 'right' }}>الرقم التسلسلي</th>
                            <th style={{ textAlign: 'left', paddingLeft: '1rem' }}>تاريخ الاستلام</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignedAssets.map(asset => (
                            <tr key={asset.id}>
                              <td style={{ textAlign: 'right', paddingRight: '1rem', color: 'var(--text-main)', fontWeight: 'bold' }}>{asset.name} ({asset.type})</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--primary)' }}>{asset.serial_number}</td>
                              <td style={{ textAlign: 'left', paddingLeft: '1rem', fontSize: '0.8rem' }}>{asset.assigned_date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Face Photos Modal */}
      {uploadModalOpen && (
        <div className="modal-backdrop">
          <div className="card" style={{ width: '450px', padding: '2rem', position: 'relative', textAlign: 'right' }}>
            <button onClick={() => setUploadModalOpen(false)} style={{ position: 'absolute', left: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>تحميل صور بصمة الوجه</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              يرجى اختيار من ٣ إلى ٥ صور واضحة وذات جودة عالية للموظف <strong>{uploadingEmp?.name}</strong> لمعايرة ذكاء التعرف على الوجه.
            </p>

            {uploadSuccess ? (
              <div style={{
                textAlign: 'center',
                padding: '2rem 1rem',
                color: 'var(--accent)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'var(--accent)', margin: '0 auto' }}>
                  <Check size={28} style={{ margin: 'auto' }} />
                </div>
                <strong>تم رفع الصور بنجاح! جاري معالجة وتدريب النموذج...</strong>
              </div>
            ) : (
              <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{
                  border: '2px dashed var(--glass-border)',
                  borderRadius: '12px',
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  background: 'rgba(0, 39, 73, 0.01)',
                  position: 'relative',
                  cursor: 'pointer'
                }}>
                  <input
                    type="file"
                    multiple
                    required
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer'
                    }}
                  />
                  <Camera size={36} color="var(--primary)" style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
                  <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>اضغط هنا أو اسحب الصور للتحميل</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>يدعم صيغ PNG, JPG, JPEG</p>
                </div>

                {selectedFiles.length > 0 && (
                  <div style={{ background: 'rgba(0, 39, 73, 0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.25rem' }}>الملفات المختارة ({selectedFiles.length}):</p>
                    <ul style={{ fontSize: '0.75rem', color: 'var(--text-dim)', paddingRight: '1.25rem', maxHeight: '100px', overflowY: 'auto' }}>
                      {selectedFiles.map((f, i) => (
                        <li key={i}>{f.name} ({(f.size / 1024).toFixed(0)} KB)</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#60a5fa',
                  background: 'rgba(96,165,250,0.08)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px'
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>سيقوم النظام بتدوير وتحسين جودة الصور تلقائياً لزيادة دقة التعرف على الوجه.</span>
                </div>

                <button
                  type="submit"
                  disabled={uploading || selectedFiles.length === 0}
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
                  {uploading ? 'جاري الرفع والمعالجة...' : 'بدأ عملية التحميل والتدريب'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
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
        .modal-input:focus {
          border-color: var(--primary);
          background: rgba(0, 39, 73, 0.04);
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

export default EmployeesPage;
