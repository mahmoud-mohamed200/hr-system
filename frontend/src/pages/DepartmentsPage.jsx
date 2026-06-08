import { useState, useEffect } from 'react';
import Header from '../components/Header';
import client from '../api/client';
import { 
  Building2, 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  Users
} from 'lucide-react';

const DepartmentsPage = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    manager_name: ''
  });

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const res = await client.get('/departments');
      setDepartments(res.data.departments);
    } catch (err) {
      console.error('Error fetching departments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openAddModal = () => {
    setIsEdit(false);
    setFormData({ name: '', description: '', manager_name: '' });
    setModalOpen(true);
  };

  const openEditModal = (dept) => {
    setIsEdit(true);
    setEditingDeptId(dept.id);
    setFormData({
      name: dept.name,
      description: dept.description || '',
      manager_name: dept.manager_name || ''
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await client.put(`/departments/${editingDeptId}`, formData);
      } else {
        await client.post('/departments', formData);
      }
      setModalOpen(false);
      fetchDepartments();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error saving department');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this department?')) {
      try {
        await client.delete(`/departments/${id}`);
        fetchDepartments();
      } catch (err) {
        alert(err.response?.data?.detail || 'Error deleting department');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Header title="Departments Management" />
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
          <Plus size={16} />
          <span>Add Department</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}>Loading departments data...</div>
      ) : (
        <div className="dashboard-grid">
          {departments.map(dept => (
            <div key={dept.id} className="card" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(79, 70, 229, 0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', border: '1px solid rgba(79, 70, 229, 0.1)' }}>
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{dept.name}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Manager: {dept.manager_name || 'Unassigned'}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button 
                    onClick={() => openEditModal(dept)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0.25rem' }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => handleDelete(dept.id)}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.25rem' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', flexGrow: 1, minHeight: '40px' }}>
                {dept.description || 'No description provided.'}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0, 39, 73, 0.02)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '0.85rem' }}>
                <Users size={14} color="var(--primary)" />
                <span style={{ fontWeight: 600 }}>{dept.employee_count}</span>
                <span style={{ color: 'var(--text-dim)' }}>active employees</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100
        }}>
          <div className="card" style={{
            width: '420px',
            padding: '2rem',
            position: 'relative'
          }}>
            <button 
              onClick={() => setModalOpen(false)}
              style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
              {isEdit ? 'Edit Department' : 'Create New Department'}
            </h3>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">Department Name *</label>
                <input 
                  type="text" 
                  name="name"
                  required 
                  value={formData.name} 
                  onChange={handleInputChange}
                  className="modal-input" 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">Manager Name</label>
                <input 
                  type="text" 
                  name="manager_name"
                  value={formData.manager_name} 
                  onChange={handleInputChange}
                  placeholder="e.g. John Doe"
                  className="modal-input" 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="input-label">Description</label>
                <textarea 
                  name="description"
                  value={formData.description} 
                  onChange={handleInputChange}
                  placeholder="Describe department roles..."
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
                {isEdit ? 'Save Changes' : 'Create Department'}
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
      `}</style>
    </div>
  );
};

export default DepartmentsPage;
