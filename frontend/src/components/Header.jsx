import { useAuth } from '../context/AuthContext';

const Header = ({ title }) => {
  const { user } = useAuth();

  return (
    <header className="header">
      <div>
        <h2 className="page-title">{title}</h2>
        <p style={{ color: 'var(--text-dim)', marginTop: '0.25rem' }}>
          Welcome back, {user?.name || 'Administrator'} 
          {user?.job_title ? ` (${user.job_title})` : ''}
        </p>
      </div>
      <div className="status-badge">
        <div className="status-dot"></div>
        <span>System Online • Live Mode</span>
      </div>
    </header>
  );
};

export default Header;
