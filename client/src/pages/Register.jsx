import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { BookOpen, UserPlus, ArrowLeft, Sun, Moon } from 'lucide-react';

const FALLBACK_BRANCHES = [
  { id: 1, name: 'Computer Science & Engineering' },
  { id: 2, name: 'Information Technology' },
  { id: 3, name: 'Mechanical Engineering' },
  { id: 4, name: 'Civil Engineering' },
  { id: 5, name: 'Electrical & Electronics Engineering' },
  { id: 6, name: 'Electronics & Communication' },
  { id: 7, name: 'Artificial Intelligence & Data Science' }
];

const Register = ({ onToggleView }) => {
  const { register, apiCall } = useAuth();
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

    if (!username || !password || !fullName || !rollNumber || !branchName || !year || !semester || !btNumber) {
      setError('Please fill in all registration fields');
      return;
    }

    // M-1 FIX: Validate password length on client
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      setError('');
      setSuccess('');
      setLoading(true);
      const res = await register(formData);
      setSuccess(res.message || 'Registration successful! Awaiting admin approval.');
      // Reset form
      setFormData({
        username: '',
        password: '',
        fullName: '',
        rollNumber: '',
        branchName: branches.length > 0 ? branches[0].name : '',
        year: '1st Year',
        semester: '1st Semester',
        btNumber: ''
      });
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
      {/* ── Top Bar Theme Toggle ── */}
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
            padding: '8px 14px',
            borderRadius: '999px',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
          }}
          title={isDark ? 'Switch to Daylight Campus Mode' : 'Switch to Dark Academic Mode'}
        >
          {isDark ? <Sun size={15} color="#f59e0b" /> : <Moon size={15} color="var(--primary)" />}
          <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '560px',
        padding: 'var(--card-padding, 40px)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img
            src="/logo.png"
            alt="SISTec Logo"
            style={{
              height: '76px',
              width: 'auto',
              objectFit: 'contain',
              marginBottom: '10px',
              filter: 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.35))'
            }}
          />
          <h2>Student Registration</h2>
          <p style={{ marginTop: '6px', fontSize: '0.85rem' }}>Create your library account for approval</p>
        </div>

        {error && (
          <div className="badge-danger" style={{
            padding: '12px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            width: '100%',
            marginBottom: '20px',
            textTransform: 'none',
            display: 'block',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div className="badge-success" style={{
            padding: '12px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            width: '100%',
            marginBottom: '20px',
            textTransform: 'none',
            display: 'block',
            textAlign: 'center'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="grid-responsive-2col">
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Username
              </label>
              <input
                type="text"
                name="username"
                className="glass-input"
                placeholder="e.g. rohan_sharma"
                value={formData.username}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Password
              </label>
              <input
                type="password"
                name="password"
                className="glass-input"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              className="glass-input"
              placeholder="Enter your full name"
              value={formData.fullName}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="grid-responsive-2col">
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Roll Number
              </label>
              <input
                type="text"
                name="rollNumber"
                className="glass-input"
                placeholder="e.g. 0101CS221045"
                value={formData.rollNumber}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                BT Number
              </label>
              <input
                type="text"
                name="btNumber"
                className="glass-input"
                placeholder="e.g. BT-CS-221045"
                value={formData.btNumber}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Branch
            </label>
            <select
              name="branchName"
              className="glass-input glass-select"
              value={formData.branchName}
              onChange={handleChange}
              disabled={loading || branchesLoading}
            >
              {branchesLoading ? (
                <option value="">Loading branches...</option>
              ) : (
                branches.map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))
              )}
            </select>
          </div>

          <div className="grid-responsive-2col">
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Year
              </label>
              <select
                name="year"
                className="glass-input glass-select"
                value={formData.year}
                onChange={handleChange}
                disabled={loading}
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Semester
              </label>
              <select
                name="semester"
                className="glass-input glass-select"
                value={formData.semester}
                onChange={handleChange}
                disabled={loading}
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
            style={{ width: '100%', padding: '14px', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? 'Registering...' : <><UserPlus size={18} /> Submit Registration</>}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            onClick={onToggleView}
            className="btn btn-secondary"
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ArrowLeft size={16} /> Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
