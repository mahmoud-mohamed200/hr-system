import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../api/client';
import { 
  LayoutDashboard, 
  Users, 
  CalendarCheck, 
  Building2, 
  BarChart3, 
  Settings, 
  LogOut,
  Calendar,
  Coins,
  Wallet,
  Package
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();

  const menuItems = [
    { path: '/', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['admin', 'hr', 'employee'] },
    { path: '/employees', label: 'الموظفين', icon: Users, roles: ['admin', 'hr'] },
    { path: '/attendance', label: 'سجل الحضور', icon: CalendarCheck, roles: ['admin', 'hr', 'employee'] },
    { path: '/leaves', label: 'الإجازات والأذونات', icon: Calendar, roles: ['admin', 'hr', 'employee'] },
    { path: '/loans', label: 'السلف والقروض', icon: Coins, roles: ['admin', 'hr', 'employee'] },
    { path: '/payroll', label: 'الرواتب والـ Payslips', icon: Wallet, roles: ['admin', 'hr', 'employee'] },
    { path: '/assets', label: 'العهد والأصول', icon: Package, roles: ['admin', 'hr'] },
    { path: '/departments', label: 'الأقسام الإدارية', icon: Building2, roles: ['admin', 'hr'] },
    { path: '/reports', label: 'التقارير', icon: BarChart3, roles: ['admin', 'hr', 'employee'] },
    { path: '/settings', label: 'إعدادات النظام', icon: Settings, roles: ['admin', 'hr'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user?.role));

  return (
    <aside className="sidebar" style={{ direction: 'rtl' }}>
      <div className="logo-container" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', padding: '0 0.5rem' }}>
        <img 
          src={`${BACKEND_URL}/uploads/xq-logo.avif`} 
          alt="XQ Logo" 
          style={{ 
            width: '100%', 
            maxHeight: '60px', 
            objectFit: 'contain'
          }} 
        />
      </div>
      
      <nav className="nav-links" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filteredItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(0, 39, 73, 0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)', textAlign: 'right' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>تم الدخول بصلاحية</p>
          <p style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.name || user?.job_title || user?.role}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</p>
        </div>

        <button 
          onClick={logout} 
          className="nav-item logout-btn"
          style={{ 
            width: '100%', 
            background: 'rgba(239, 68, 68, 0.1)', 
            color: '#f87171', 
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease'
          }}
        >
          <LogOut size={18} />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
