import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserPlus, ArrowLeft, Sun, Moon, CheckCircle2, Clock, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';

const FALLBACK_BRANCHES = [
  { id: 1, name: 'CSE (Computer Science & Engineering)' },
  { id: 2, name: 'CSE (Artificial Intelligence & Data Science)' },
  { id: 3, name: 'IT (Information Technology)' },
  { id: 4, name: 'ECE (Electronics & Communication Engineering)' },
  { id: 5, name: 'Cyber Security' },
  { id: 6, name: 'Civil Engineering' },
  { id: 7, name: 'Mechanical Engineering (ME)' },
  { id: 8, name: 'Electrical Engineering (EX/EE)' },
  { id: 9, name: 'B.Pharm' },
  { id: 10, name: 'M.Pharm (Pharmaceutical Chemistry)' },
  { id: 11, name: 'M.Pharm (Pharmaceutics)' },
  { id: 12, name: 'BBA' },
  { id: 13, name: 'MBA' },
  { id: 14, name: 'M.Tech CSE' },
  { id: 15, name: 'CTM (Construction Technology & Management)' },
  { id: 16, name: 'SE (Structural Engineering)' },
  { id: 17, name: 'Machine Design' },
  { id: 18, name: 'Thermal Engineering' },
  { id: 19, name: 'Digital Communication' },
  { id: 20, name: 'VLSI Design' }
];

const Register = ({ onToggleView }) => {
  const { register } = useAuth();
  const { mode, toggleMode } = useTheme();
  const isDark = mode === 'dark';
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    rollNumber: '',
    branchName: FALLBACK_BRANCHES[0].name,
    year: '1st Year',
    semester: '1st Semester',
    btNumber: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState(FALLBACK_BRANCHES);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [submittedData, setSubmittedData] = useState(null);
  const [registrationResult, setRegistrationResult] = useState(null);

  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const semesters = [
    '1st Semester', '2nd Semester', '3rd Semester', '4th Semester',
    '5th Semester', '6th Semester', '7th Semester', '8th Semester'
  ];

  useEffect(() => {
    document.title = 'Register - SISTEC Library';

    const fetchBranches = async () => {
      try {
        const { data, error } = await supabase.from('branches').select('*').order('name', { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) {
          setBranches(data);
          setFormData(prev => ({ ...prev, branchName: data[0].name }));
        }
      } catch (err) {
        console.warn('Using fallback branches:', err);
      } finally {
        setBranchesLoading(false);
      }
    };

    fetchBranches();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { username, password, fullName, rollNumber, branchName, year, semester, btNumber } = formData;

    const trimmedUsername = (username || '').trim();
    const trimmedFullName = (fullName || '').trim();
    const trimmedRoll = (rollNumber || '').trim();
    const trimmedBt = (btNumber || '').trim();

    if (!trimmedUsername || !password || !trimmedFullName || !trimmedRoll || !branchName || !year || !semester || !trimmedBt) {
      setError('Please fill in all required registration fields with valid institutional information.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long for account security.');
      return;
    }

    try {
      setError('');
      setSuccess('');
      setLoading(true);
      const cleanPayload = {
        ...formData,
        username: trimmedUsername,
        fullName: trimmedFullName,
        rollNumber: trimmedRoll,
        btNumber: trimmedBt
      };
      const res = await register(cleanPayload);
      setSubmittedData(cleanPayload);
      setRegistrationResult(res);
      setSuccess(res.message);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '40px 20px',
      position: 'relative'
    }}>
      {/* Theme Toggle */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '24px',
        zIndex: 20
      }}>
        <button
          onClick={toggleMode}
          className="btn btn-secondary"
          style={{
            padding: '8px 16px',
            borderRadius: '999px',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun size={15} color="#fbbf24" /> : <Moon size={15} color="var(--primary)" />}
          <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      <div className="glass-panel animate-fade-in register-card" style={{
        width: '100%',
        maxWidth: '580px',
        padding: '40px 36px',
        position: 'relative',
        borderRadius: '20px',
        boxShadow: 'var(--shadow-elevated)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.25)',
            margin: '0 auto 16px'
          }}>
            <img
              src="/logo.png"
              alt="SISTec Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '6px' }}>Student Registration</h2>
          <p style={{ marginTop: '4px', fontSize: '0.88rem' }}>Create your library account for approval</p>
        </div>

        {error && (
          <div className="badge-danger" style={{
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            width: '100%',
            marginBottom: '20px',
            textTransform: 'none',
            display: 'block',
            textAlign: 'center',
            lineHeight: 1.5,
            animation: 'fadeIn 0.3s ease forwards'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div className="badge-success" style={{
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            width: '100%',
            marginBottom: '20px',
            textTransform: 'none',
            display: 'block',
            textAlign: 'center',
            lineHeight: 1.5,
            animation: 'fadeIn 0.3s ease forwards'
          }}>
            {success}
          </div>
        )}

        {submittedData && registrationResult ? (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: registrationResult.status === 'approved'
                ? 'rgba(16, 185, 129, 0.15)'
                : registrationResult.status === 'rejected'
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(245, 158, 11, 0.15)',
              border: `2px solid ${
                registrationResult.status === 'approved'
                  ? 'var(--success)'
                  : registrationResult.status === 'rejected'
                  ? 'var(--danger)'
                  : 'var(--warning)'
              }`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: registrationResult.status === 'approved'
                ? 'var(--success)'
                : registrationResult.status === 'rejected'
                ? 'var(--danger)'
                : 'var(--warning)'
            }}>
              {registrationResult.status === 'approved' ? (
                <CheckCircle2 size={36} />
              ) : registrationResult.status === 'rejected' ? (
                <ShieldCheck size={36} />
              ) : (
                <Clock size={36} />
              )}
            </div>

            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '10px' }}>
              {registrationResult.status === 'approved'
                ? 'Registration Approved!'
                : registrationResult.status === 'rejected'
                ? 'Registration Logged'
                : 'Registration Submitted'}
            </h2>

            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '0.94rem',
              lineHeight: 1.6,
              marginBottom: '24px',
              padding: '0 8px'
            }}>
              {registrationResult.status === 'approved'
                ? 'Your institutional library account has been approved! You can now sign in to access SISTECH-LIB ebooks and resources.'
                : registrationResult.status === 'rejected'
                ? 'Your registration has been received but could not be automatically approved per current policy. Please contact the library administrator.'
                : 'Your account has been registered successfully. Please connect with the administrator for approval. You will be able to access SISTECH-LIB after your account is approved.'}
            </p>

            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-glass)',
              borderRadius: '14px',
              padding: '18px 20px',
              marginBottom: '26px',
              textAlign: 'left',
              fontSize: '0.86rem'
            }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                Candidate Registration Receipt
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px 16px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Full Name:</span>
                  <div style={{ fontWeight: 600 }}>{submittedData.fullName}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Roll Number:</span>
                  <div style={{ fontWeight: 600 }}>{submittedData.rollNumber}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Username:</span>
                  <div style={{ fontWeight: 600 }}>{submittedData.username}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Department / Branch:</span>
                  <div style={{ fontWeight: 600 }}>{submittedData.branchName}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Year &amp; Semester:</span>
                  <div style={{ fontWeight: 600 }}>{submittedData.year} • {submittedData.semester}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>BT Code:</span>
                  <div style={{ fontWeight: 600 }}>{submittedData.btNumber || 'N/A'}</div>
                </div>
              </div>
              <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Account Status:</span>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  textTransform: 'uppercase',
                  background: registrationResult.status === 'approved'
                    ? 'rgba(16, 185, 129, 0.2)'
                    : registrationResult.status === 'rejected'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(245, 158, 11, 0.2)',
                  color: registrationResult.status === 'approved'
                    ? '#34d399'
                    : registrationResult.status === 'rejected'
                    ? '#f87171'
                    : '#fbbf24'
                }}>
                  {registrationResult.status === 'approved' ? 'Approved' : registrationResult.status === 'rejected' ? 'Rejected' : 'Pending Approval'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={onToggleView}
                className="btn btn-primary"
                style={{ flex: 1, padding: '12px', fontSize: '0.9rem', fontWeight: 700, borderRadius: '10px', gap: '8px' }}
              >
                Proceed to Sign In <ArrowRight size={16} />
              </button>
              <button
                onClick={() => {
                  setSubmittedData(null);
                  setRegistrationResult(null);
                }}
                className="btn btn-secondary"
                style={{ padding: '12px 18px', fontSize: '0.85rem', borderRadius: '10px' }}
              >
                Register Another
              </button>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              <div className="grid-responsive-2col">
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    className="glass-input"
                    placeholder="e.g. rohan_sharma"
                    value={formData.username}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    className="glass-input"
                    placeholder="Min. 6 characters"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  name="fullName"
                  className="glass-input"
                  placeholder="e.g. Rohan Sharma"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="grid-responsive-2col">
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Enrollment / Roll Number
                  </label>
                  <input
                    type="text"
                    name="rollNumber"
                    className="glass-input"
                    placeholder="e.g. 0187CS211045"
                    value={formData.rollNumber}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    BT Number
                  </label>
                  <input
                    type="text"
                    name="btNumber"
                    className="glass-input"
                    placeholder="e.g. BT-4029"
                    value={formData.btNumber}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Branch / Department
                </label>
                <select
                  name="branchName"
                  className="glass-input glass-select"
                  value={formData.branchName}
                  onChange={handleChange}
                  disabled={branchesLoading}
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid-responsive-2col">
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Year
                  </label>
                  <select
                    name="year"
                    className="glass-input glass-select"
                    value={formData.year}
                    onChange={handleChange}
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Semester
                  </label>
                  <select
                    name="semester"
                    className="glass-input glass-select"
                    value={formData.semester}
                    onChange={handleChange}
                  >
                    {semesters.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '13px', marginTop: '10px', fontSize: '0.92rem', fontWeight: 700, borderRadius: '10px' }}
                disabled={loading}
              >
                {loading ? (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                ) : (
                  <><UserPlus size={18} /> Submit Registration</>
                )}
              </button>
            </form>

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <button
                onClick={onToggleView}
                className="btn btn-secondary"
                style={{
                  padding: '10px 18px',
                  fontSize: '0.86rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '10px'
                }}
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Register;
