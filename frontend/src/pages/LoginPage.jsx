import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../api/client';
import { KeyRound, Mail, AlertTriangle, ShieldCheck } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step2fa, setStep2fa] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, verify2fa } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(email, password);
      if (res && res.status === '2fa_required') {
        setStep2fa(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(
        err.response?.data?.detail || 
        'خطأ في تسجيل الدخول. يرجى التحقق من البريد الإلكتروني وكلمة المرور.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await verify2fa(email, otpCode);
      navigate('/');
    } catch (err) {
      setError(
        err.response?.data?.detail || 
        'رمز التحقق غير صحيح أو منتهي الصلاحية.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper" style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'transparent',
      overflow: 'hidden',
      position: 'relative',
      direction: 'rtl'
    }}>
      {/* Decorative background gradients */}
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(0, 176, 240, 0.1) 0%, rgba(0,0,0,0) 70%)',
        top: '-10%',
        right: '-5%',
        borderRadius: '50%',
        pointerEvents: 'none'
      }}></div>
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(0, 176, 240, 0.05) 0%, rgba(0,0,0,0) 70%)',
        bottom: '-10%',
        left: '-5%',
        borderRadius: '50%',
        pointerEvents: 'none'
      }}></div>

      <div className="login-card" style={{
        width: '420px',
        background: 'var(--bg-card)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '24px',
        padding: '2.5rem',
        boxShadow: '0 20px 40px rgba(0, 39, 73, 0.08)',
        zIndex: 1,
        animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <img 
            src={`${BACKEND_URL}/uploads/xq-logo.avif`} 
            alt="XQ Logo" 
            style={{ 
              width: '160px', 
              height: 'auto', 
              maxHeight: '80px', 
              objectFit: 'contain', 
              marginBottom: '1rem'
            }} 
          />
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', letterSpacing: '-0.5px', color: 'var(--text-main)' }}>بوابة الموظفين</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginTop: '0.25rem' }}>نظام داخلي لإدارة الموارد البشرية والحضور</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            textAlign: 'right'
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {!step2fa ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'right' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-dim)' }}>البريد الإلكتروني</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@xqpharma.com"
                  style={{
                    width: '100%',
                    background: 'rgba(0, 39, 73, 0.02)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    padding: '0.75rem 2.5rem 0.75rem 1rem',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    textAlign: 'right',
                    transition: 'all 0.3s ease'
                  }}
                  className="login-input"
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'right' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-dim)' }}>كلمة المرور</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    background: 'rgba(0, 39, 73, 0.02)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    padding: '0.75rem 2.5rem 0.75rem 1rem',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    textAlign: 'right',
                    transition: 'all 0.3s ease'
                  }}
                  className="login-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '0.85rem',
                fontWeight: '700',
                fontSize: '1rem',
                cursor: 'pointer',
                marginTop: '1rem',
                boxShadow: '0 8px 24px rgba(79, 70, 229, 0.25)',
                transition: 'all 0.3s ease',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {loading ? (
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid rgba(0,0,0,0.1)',
                  borderTopColor: 'black',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
              ) : (
                'تسجيل الدخول'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'right' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-dim)' }}>رمز التحقق الثنائي (OTP)</label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>تم إرسال رمز تحقق مؤقت لحسابك. يرجى إدخاله للمتابعة.</p>
              
              {/* The OTP code is securely logged to the backend terminal / sent via email simulation */}
              
              <div style={{ position: 'relative' }}>
                <ShieldCheck size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="------"
                  style={{
                    width: '100%',
                    background: 'rgba(0, 39, 73, 0.02)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    padding: '0.75rem 2.5rem 0.75rem 1rem',
                    color: 'var(--text-main)',
                    fontSize: '1.5rem',
                    letterSpacing: '4px',
                    outline: 'none',
                    textAlign: 'center',
                    transition: 'all 0.3s ease'
                  }}
                  className="login-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '0.85rem',
                fontWeight: '700',
                fontSize: '1rem',
                cursor: 'pointer',
                marginTop: '1rem',
                boxShadow: '0 8px 24px rgba(79, 70, 229, 0.25)',
                transition: 'all 0.3s ease',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {loading ? (
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid rgba(0,0,0,0.1)',
                  borderTopColor: 'black',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
              ) : (
                'التحقق والمتابعة'
              )}
            </button>
            
            <button
              type="button"
              onClick={() => setStep2fa(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                marginTop: '0.5rem'
              }}
            >
              الرجوع للخلف
            </button>
          </form>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .login-input:focus {
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px var(--primary-light);
          background: #ffffff !important;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
