import { FolderOpen } from 'lucide-react';

const EmptyState = ({ message = "لا توجد بيانات متاحة حالياً" }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem',
      color: 'var(--text-dim)',
      background: 'var(--bg-card)',
      border: '1px dashed var(--glass-border)',
      borderRadius: '12px',
      margin: '2rem 0'
    }}>
      <FolderOpen size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
      <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>{message}</p>
    </div>
  );
};

export default EmptyState;
