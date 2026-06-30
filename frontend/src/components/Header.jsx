import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { Bell, Check, CheckSquare, MessageSquare, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const Header = ({ title }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await client.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000); // Poll every 20 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAllAsRead = async () => {
    try {
      await client.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('تم تحديد الكل كمقروء');
    } catch (err) {
      toast.error('فشل تحديد الكل كمقروء');
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await client.put(`/notifications/${notif.id}/read`);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      }
      setIsOpen(false);
      
      // Navigate to the appropriate review page
      if (notif.request_type === 'leave') {
        navigate('/leaves');
      } else if (notif.request_type === 'advance') {
        navigate('/advances');
      } else if (notif.request_type === 'loan') {
        navigate('/loans');
      }
    } catch (err) {
      console.error('Error handling notification click:', err);
    }
  };

  // Helper to format date relative or short format
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('ar-EG', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <header className="header" style={{ position: 'relative' }}>
      <div>
        <h2 className="page-title">{title}</h2>
        <p style={{ color: 'var(--text-dim)', marginTop: '0.25rem' }}>
          Welcome back, {user?.name || 'Administrator'} 
          {user?.job_title ? ` (${user.job_title})` : ''}
        </p>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Notification Bell */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            style={{
              background: isOpen ? 'rgba(79, 70, 229, 0.15)' : 'rgba(0, 39, 73, 0.03)',
              border: isOpen ? '1px solid rgba(79, 70, 229, 0.3)' : '1px solid var(--glass-border)',
              color: isOpen ? 'var(--primary)' : 'var(--text-main)',
              padding: '0.6rem',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              transition: 'all 0.3s ease',
              outline: 'none'
            }}
            className="notif-bell-btn"
          >
            <Bell size={20} className={unreadCount > 0 ? "bell-animation" : ""} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: 'var(--danger)',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                minWidth: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px',
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
                border: '2px solid var(--bg-card)'
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div style={{
              position: 'absolute',
              top: '120%',
              left: 0,
              width: '360px',
              background: 'var(--bg-card)',
              border: '1px solid var(--glass-border)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 1000,
              backdropFilter: 'blur(20px)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '450px',
              overflow: 'hidden',
              animation: 'slideIn 0.25s ease forwards',
              textAlign: 'right'
            }}>
              {/* Header */}
              <div style={{
                padding: '1rem',
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(0, 39, 73, 0.01)'
              }}>
                <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>الإشعارات ({unreadCount} غير مقروء)</span>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllAsRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.target.style.background = 'rgba(79, 70, 229, 0.05)'}
                    onMouseLeave={e => e.target.style.background = 'none'}
                  >
                    <CheckSquare size={12} />
                    <span>تحديد الكل كمقروء</span>
                  </button>
                )}
              </div>

              {/* List */}
              <div style={{ overflowY: 'auto', flexGrow: 1, padding: '0.5rem 0' }}>
                {notifications.length === 0 ? (
                  <div style={{
                    padding: '3rem 1.5rem',
                    textAlign: 'center',
                    color: 'var(--text-dim)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <MessageSquare size={32} opacity={0.3} />
                    <span style={{ fontSize: '0.9rem' }}>لا توجد إشعارات حالياً</span>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      style={{
                        padding: '1rem',
                        borderBottom: '1px solid rgba(0, 39, 73, 0.03)',
                        cursor: 'pointer',
                        background: notif.is_read ? 'transparent' : 'rgba(79, 70, 229, 0.03)',
                        transition: 'background 0.2s',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'flex-start'
                      }}
                      className="notif-item"
                    >
                      <div style={{
                        background: notif.is_read ? 'rgba(0, 39, 73, 0.04)' : 'rgba(79, 70, 229, 0.1)',
                        color: notif.is_read ? 'var(--text-dim)' : 'var(--primary)',
                        padding: '0.5rem',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: '2px'
                      }}>
                        <AlertCircle size={16} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexGrow: 1 }}>
                        <span style={{ 
                          fontWeight: notif.is_read ? '500' : '700', 
                          color: 'var(--text-main)',
                          fontSize: '0.85rem' 
                        }}>{notif.title}</span>
                        <p style={{ 
                          fontSize: '0.8rem', 
                          color: 'var(--text-dim)', 
                          margin: 0,
                          lineHeight: '1.4'
                        }}>{notif.message}</p>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          color: 'var(--text-dim)', 
                          marginTop: '4px',
                          display: 'block'
                        }}>{formatDate(notif.created_at)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live Mode Badge */}
        <div className="status-badge">
          <div className="status-dot"></div>
          <span>System Online • Live Mode</span>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bellRing {
          0% { transform: rotate(0); }
          15% { transform: rotate(15deg); }
          30% { transform: rotate(-15deg); }
          45% { transform: rotate(10deg); }
          60% { transform: rotate(-10deg); }
          75% { transform: rotate(4deg); }
          85% { transform: rotate(-4deg); }
          100% { transform: rotate(0); }
        }
        .bell-animation {
          animation: bellRing 1.5s ease infinite;
          transform-origin: top center;
        }
        .notif-bell-btn:hover {
          background: rgba(0, 39, 73, 0.05) !important;
        }
        .notif-item:hover {
          background: rgba(79, 70, 229, 0.06) !important;
        }
      `}</style>
    </header>
  );
};

export default Header;
