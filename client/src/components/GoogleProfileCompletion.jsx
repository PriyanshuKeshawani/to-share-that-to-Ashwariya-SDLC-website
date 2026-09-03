import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { UserCheck, ArrowRight } from 'lucide-react';

const GoogleProfileCompletion = () => {
  const { completeGoogleProfile, pendingGoogleUser } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    rollNumber: '',
    branchName: '',
    year: '1st Year',
    semester: '1st Semester',
    btNumber: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(true);

  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const semesters = [
    '1st Semester', '2nd Semester', '3rd Semester', '4th Semester',
    '5th Semester', '6th Semester', '7th Semester', '8th Semester'
  ];

  useEffect(() => {
    // Pre-fill name from Google
    if (pendingGoogleUser?.user_metadata?.full_name) {
      setFormData(prev => ({
        ...prev,
        fullName: pendingGoogleUser.user_metadata.full_name
      }));
    } else if (pendingGoogleUser?.user_metadata?.name) {
      setFormData(prev => ({
        ...prev,
        fullName: pendingGoogleUser.user_metadata.name
      }));
    }
  }, [pendingGoogleUser]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data, error } = await supabase.from('branches').select('*').order('name', { ascending: true });
        if (error) throw error;
        setBranches(data || []);
        if (data && data.length > 0) {
          setFormData(prev => ({ ...prev, branchName: data[0].name }));
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
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

    if (!username || !fullName || !rollNumber || !branchName || !year || !semester || !btNumber) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await completeGoogleProfile(formData);
    } catch (err) {
      setError(err.message || 'Failed to complete profile');
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
      padding: '40px 20px'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '560px',
        padding: 'var(--card-padding, 40px)'
      }}>
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
          <h2>Complete Your Profile</h2>
          <p style={{ marginTop: '6px', fontSize: '0.85rem' }}>
            Welcome! Please provide your college details to finish registration.
          </p>
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                className="glass-input"
                placeholder="Your full name"
                value={formData.fullName}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
            {loading ? 'Submitting...' : <><ArrowRight size={18} /> Complete Registration</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default GoogleProfileCompletion;
