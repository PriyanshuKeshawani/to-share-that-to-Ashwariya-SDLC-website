import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { UserCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

const FALLBACK_BRANCHES = [
  { id: 1, name: 'Computer Science & Engineering' },
  { id: 2, name: 'Information Technology' },
  { id: 3, name: 'Mechanical Engineering' },
  { id: 4, name: 'Civil Engineering' },
  { id: 5, name: 'Electrical & Electronics Engineering' },
  { id: 6, name: 'Electronics & Communication' },
  { id: 7, name: 'Artificial Intelligence & Data Science' }
];

const GoogleProfileCompletion = () => {
  const { completeGoogleProfile, pendingGoogleUser } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    rollNumber: '',
    branchName: 'Computer Science & Engineering',
    year: '1st Year',
    semester: '1st Semester',
    btNumber: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState(FALLBACK_BRANCHES);
  const [branchesLoading, setBranchesLoading] = useState(true);

  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const semesters = [
    '1st Semester', '2nd Semester', '3rd Semester', '4th Semester',
    '5th Semester', '6th Semester', '7th Semester', '8th Semester'
  ];

  useEffect(() => {
    // Pre-fill name and suggested username from Google
    const name = pendingGoogleUser?.user_metadata?.full_name || pendingGoogleUser?.user_metadata?.name || '';
    const email = pendingGoogleUser?.email || '';
    const suggestedUsername = email ? email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') : '';

    setFormData(prev => ({
      ...prev,
      fullName: name || prev.fullName,
      username: suggestedUsername || prev.username
    }));
  }, [pendingGoogleUser]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data, error } = await supabase.from('branches').select('*').order('name', { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) {
          setBranches(data);
          setFormData(prev => ({ ...prev, branchName: data[0].name }));
        }
      } catch (err) {
        console.warn('Using fallback branches list:', err);
      } finally {
        setBranchesLoading(false);
      }
    };
    fetchBranches();
  }, []);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { username, fullName, rollNumber, branchName, year, semester, btNumber } = formData;

    if (!username.trim() || !fullName.trim() || !rollNumber.trim() || !branchName || !year || !semester || !btNumber.trim()) {
      setError('Please fill in all college profile fields.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await completeGoogleProfile({
        ...formData,
        username: username.trim(),
        fullName: fullName.trim(),
        rollNumber: rollNumber.trim().toUpperCase(),
        btNumber: btNumber.trim().toUpperCase()
      });
    } catch (err) {
      setError(err.message || 'Failed to complete profile registration.');
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
      padding: '24px 16px',
      backgroundColor: 'var(--bg-main)'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '560px',
        padding: '32px 28px',
        boxShadow: 'var(--shadow-glass)'
      }}>
        {/* Header with Logo */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <img
            src="/logo.png"
            alt="SISTec Logo"
            style={{
              height: '64px',
              width: 'auto',
              objectFit: 'contain',
              marginBottom: '10px'
            }}
          />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Complete Student Profile
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            Enter your college academic credentials to access the library portal
          </p>

          {/* Verified Google Account Pill */}
          {pendingGoogleUser?.email && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '12px',
              padding: '4px 12px',
              borderRadius: '999px',
              background: 'rgba(37, 99, 235, 0.08)',
              border: '1px solid rgba(37, 99, 235, 0.2)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)'
            }}>
              <CheckCircle2 size={13} color="var(--primary)" />
              <span>Signed in as <strong>{pendingGoogleUser.email}</strong></span>
            </div>
          )}
        </div>

        {error && (
          <div className="badge-danger" style={{
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            width: '100%',
            marginBottom: '16px',
            display: 'block',
            textAlign: 'center',
            lineHeight: 1.4
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="grid-responsive-2col">
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Portal Username
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
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                className="glass-input"
                placeholder="Your official name"
                value={formData.fullName}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid-responsive-2col">
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Enrollment / Roll Number
              </label>
              <input
                type="text"
                name="rollNumber"
                className="glass-input"
                placeholder="e.g. 0187CS211045"
                value={formData.rollNumber}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                BT / Library Card No
              </label>
              <input
                type="text"
                name="btNumber"
                className="glass-input"
                placeholder="e.g. BT-CS-211045"
                value={formData.btNumber}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Branch / Department
            </label>
            <select
              name="branchName"
              className="glass-input glass-select"
              value={formData.branchName}
              onChange={handleChange}
              disabled={loading}
            >
              {branches.map(b => (
                <option key={b.id || b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="grid-responsive-2col">
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Academic Year
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
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Current Semester
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
            style={{ width: '100%', padding: '12px', marginTop: '6px', fontSize: '0.9rem' }}
            disabled={loading}
          >
            {loading ? (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : (
              <>Complete & Enter Portal <ArrowRight size={16} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default GoogleProfileCompletion;
