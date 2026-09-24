"use client";

import { useState } from 'react';
import { 
  X, Copy, Check, ExternalLink, 
  FileSpreadsheet, ArrowRight 
} from 'lucide-react';

const AVAILABLE_FIELDS = [
  { id: 'title', label: 'Project Title', defaultChecked: true, required: true, type: 'Short answer' },
  { id: 'project_type', label: 'Project Category / Type (Major, Minor, Academic, Hackathon, Research, Open Source)', defaultChecked: true, required: true, type: 'Dropdown / Multiple choice' },
  { id: 'branch_name', label: 'Department / Branch (e.g. CSE, AIML, IT, ME, EC, Civil, MBA)', defaultChecked: true, required: true, type: 'Dropdown / Short answer' },
  { id: 'batch', label: 'Batch / Graduation Year (e.g. 2025, 2026)', defaultChecked: true, required: true, type: 'Short answer' },
  { id: 'short_description', label: 'Short Description / Tagline (1-2 sentences)', defaultChecked: true, required: true, type: 'Paragraph' },
  { id: 'description', label: 'Full Project Scope, Problem Statement & Tech Stack', defaultChecked: true, required: false, type: 'Paragraph' },
  { id: 'team_members', label: 'Team Members (Format: Name, Branch, Year, LinkedIn URL)', defaultChecked: true, required: true, type: 'Paragraph' },
  { id: 'image_url', label: 'Project Screenshot / Cover Poster (Google Drive link or image URL)', defaultChecked: true, required: false, type: 'Short answer' },
  { id: 'live_url', label: 'Live Deployment Link (Vercel, Netlify, Render, Demo URL)', defaultChecked: true, required: false, type: 'Short answer' },
  { id: 'github_url', label: 'GitHub Repository Link', defaultChecked: true, required: false, type: 'Short answer' },
  { id: 'mentor_name', label: 'Faculty Mentor / Project Guide Name', defaultChecked: true, required: false, type: 'Short answer' }
];

export default function GoogleFormTemplateModal({
  isOpen,
  onClose
}) {
  const [selectedFields, setSelectedFields] = useState(() => 
    AVAILABLE_FIELDS.filter(f => f.defaultChecked).map(f => f.id)
  );
  const [copiedQuestions, setCopiedQuestions] = useState(false);
  const [copiedGuide, setCopiedGuide] = useState(false);

  if (!isOpen) return null;

  const toggleField = (id) => {
    const field = AVAILABLE_FIELDS.find(f => f.id === id);
    if (field && field.required) return; // cannot uncheck required
    setSelectedFields(prev => 
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  const activeQuestionsList = AVAILABLE_FIELDS.filter(f => selectedFields.includes(f.id));

  const questionsText = activeQuestionsList
    .map((f, idx) => `${idx + 1}. ${f.label} [Question Type: ${f.type}]${f.required ? ' (Required)' : ''}`)
    .join('\n');

  const fullInstructions = `SISTEC Central Digital Library Portal
Google Form Creation & Project Submissions Guide

Step 1: Open Google Forms
- Click "Open Google Forms" or visit: https://forms.new

Step 2: Set Form Title & Description
- Title: SISTEC Student Project & Innovation Showcase Submission
- Description: Submit your academic, major, minor, or hackathon project to be published in the SISTEC Digital Library Portal.

Step 3: Add the Questions:
${questionsText}

Step 4: Link to Google Sheets
- In Google Forms, switch to the "Responses" tab.
- Click "Link to Sheets" to automatically send submissions to a Google Spreadsheet.

Step 5: Import into Digital Library in 1 Click:
- In Google Sheets, copy response rows (Ctrl+C) OR download as CSV/Excel.
- In SISTEC Library Admin -> Click "Import from Google Form".
- Paste or upload the file — intelligent auto-detection maps all fields & Drive screenshots automatically!`;

  const handleCopyQuestions = async () => {
    try {
      await navigator.clipboard.writeText(questionsText);
      setCopiedQuestions(true);
      setTimeout(() => setCopiedQuestions(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyGuide = async () => {
    try {
      await navigator.clipboard.writeText(fullInstructions);
      setCopiedGuide(true);
      setTimeout(() => setCopiedGuide(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleOpenGoogleForms = () => {
    window.open('https://forms.new', '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 7, 12, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '16px'
    }}>
      <div 
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '740px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '18px',
          border: '1px solid var(--border-glass)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px var(--primary-glow)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(37,99,235,0.2), rgba(14,165,233,0.15))',
              border: '1px solid rgba(37,99,235,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Google Form Creation Template
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Generate an import-ready Google Form to collect academic and innovation project proposals.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '8px', borderRadius: '10px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Workflow Banner */}
        <div style={{
          padding: '14px 24px',
          background: 'linear-gradient(90deg, rgba(37,99,235,0.08), rgba(14,165,233,0.05))',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span className="badge badge-primary">Step 1: Create Form</span>
            <ArrowRight size={12} />
            <span className="badge badge-secondary">Step 2: Collect in Sheet</span>
            <ArrowRight size={12} />
            <span className="badge badge-success">Step 3: One-Click Import</span>
          </div>

          <button
            onClick={handleOpenGoogleForms}
            className="btn btn-primary btn-shine"
            style={{ padding: '6px 14px', fontSize: '0.8rem', gap: '6px', borderRadius: '8px' }}
          >
            <ExternalLink size={13} /> Open Google Forms (forms.new)
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
              Select Fields to Include in Google Form:
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '8px',
              maxHeight: '200px',
              overflowY: 'auto',
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-glass)'
            }}>
              {AVAILABLE_FIELDS.map(f => {
                const checked = selectedFields.includes(f.id);
                return (
                  <label 
                    key={f.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.8rem',
                      color: checked ? 'var(--text-primary)' : 'var(--text-muted)',
                      cursor: f.required ? 'default' : 'pointer',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      background: checked ? 'rgba(37,99,235,0.06)' : 'transparent'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={f.required}
                      onChange={() => toggleField(f.id)}
                    />
                    <span>{f.label}</span>
                    {f.required && <span style={{ color: 'var(--danger)', fontSize: '0.7rem' }}>*</span>}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Form Questions Preview */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Generated Questions ({activeQuestionsList.length} items):
              </label>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCopyQuestions}
                  className="btn btn-secondary"
                  style={{ padding: '5px 12px', fontSize: '0.76rem', gap: '6px' }}
                >
                  {copiedQuestions ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedQuestions ? 'Copied Questions!' : 'Copy Questions'}
                </button>

                <button
                  type="button"
                  onClick={handleCopyGuide}
                  className="btn btn-secondary"
                  style={{ padding: '5px 12px', fontSize: '0.76rem', gap: '6px' }}
                >
                  {copiedGuide ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedGuide ? 'Copied Guide!' : 'Copy Full Guide'}
                </button>
              </div>
            </div>

            <pre style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-glass)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              fontFamily: 'monospace',
              lineHeight: 1.6,
              maxHeight: '220px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              margin: 0
            }}>
              {questionsText}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '9px 20px', borderRadius: '10px' }}
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleOpenGoogleForms}
            className="btn btn-primary btn-shine"
            style={{ padding: '9px 22px', borderRadius: '10px', gap: '8px', fontWeight: 700 }}
          >
            <ExternalLink size={15} /> Open Google Forms & Build Form
          </button>
        </div>
      </div>
    </div>
  );
}
