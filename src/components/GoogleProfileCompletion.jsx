"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

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

const GoogleProfileCompletion = () => {
  const { completeGoogleProfile, pendingGoogleUser, logout } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    rollNumber: '',
    branchName: FALLBACK_BRANCHES[0].name,
    year: '1st Year',
    semester: '1st Semester',
    btNumber: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState(FALLBACK_BRANCHES);

  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const semesters = [
    '1st Semester', '2nd Semester', '3rd Semester', '4th Semester',
    '5th Semester', '6th Semester', '7th Semester', '8th Semester'
  ];

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data, error } = await supabase.from('branches').select('*').order('name', { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) {
          const officialNames = new Set(FALLBACK_BRANCHES.map(b => b.name.toLowerCase()));
          const filtered = data.filter(b => officialNames.has(b.name.toLowerCase()));
          const finalBranches = filtered.length >= 15 ? filtered : data;
          setBranches(finalBranches);
          setFormData(prev => ({ ...prev, branchName: prev.branchName || finalBranches[0].name }));
        }
      } catch (err) {
        console.warn('Using fallback branches list:', err);
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
        padding: '36px 32px',
        boxShadow: 'var(--shadow-elevated)',
        borderRadius: '20px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src="/logo.png"
            alt="SISTec Logo"
            style={{
              height: '68px',
              width: 'auto',
              objectFit: 'contain',
              marginBottom: '14px',
              filter: 'drop-shadow(0 6px 16px rgba(0, 0, 0, 0.3))'
            }}
          />
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Complete Your Profile
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Enter your college academic details to access the library portal
          </p>

          {pendingGoogleUser?.email && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '14px',
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'rgba(59, 130, 246, 0.06)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)'
            }}>
              <CheckCircle2 size={14} color="var(--primary)" />
              <span>Signed in as <strong>{pendingGoogleUser.email}</strong></span>
            </div>
          )}
        </div>

        {error && (
          <div className="badge-danger" style={{
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '0.84rem',
            width: '100%',
            marginBottom: '18px',
            display: 'block',
            textAlign: 'center',
            lineHeight: 1.5
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="grid-responsive-2col">
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
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
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
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
                disabled={loading}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
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
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
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
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
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
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
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
            style={{ width: '100%', padding: '13px', marginTop: '8px', fontSize: '0.92rem', fontWeight: 700, borderRadius: '10px' }}
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
              <>Complete & Enter Portal <ArrowRight size={16} /></>
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              type="button"
              onClick={logout}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary, #94a3b8)',
                fontSize: '0.84rem',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Sign out / Use a different account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GoogleProfileCompletion;
