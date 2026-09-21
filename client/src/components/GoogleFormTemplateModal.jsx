"use client";

import { useState } from 'react';
import { 
  X, Copy, Check, ExternalLink, 
  FileSpreadsheet, ArrowRight 
} from 'lucide-react';

const AVAILABLE_FIELDS = [
  { id: 'title', label: 'Project Title', defaultChecked: true, required: true, type: 'Short answer' },
  { id: 'project_type', label: 'Project Type (Academic, Major, Minor, Internship, etc.)', defaultChecked: true, required: true, type: 'Multiple choice / Dropdown' },
  { id: 'branch_name', label: 'Department / Branch Name', defaultChecked: true, required: true, type: 'Short answer / Dropdown' },
  { id: 'short_description', label: 'Short Description / Summary', defaultChecked: true, required: false, type: 'Paragraph' },
  { id: 'description', label: 'Full Project Scope & Methodology', defaultChecked: true, required: false, type: 'Paragraph' },
  { id: 'required_skills', label: 'Required Skills / Tech Stack', defaultChecked: true, required: false, type: 'Short answer' },
  { id: 'eligibility', label: 'Eligibility Criteria', defaultChecked: true, required: false, type: 'Short answer' },
  { id: 'major', label: 'Recommended Major Specialization', defaultChecked: true, required: false, type: 'Short answer' },
  { id: 'minor', label: 'Recommended Minor Specialization', defaultChecked: true, required: false, type: 'Short answer' },
  { id: 'batch', label: 'Batch / Graduation Year', defaultChecked: true, required: false, type: 'Short answer' },
  { id: 'team_size', label: 'Expected Team Size (e.g. 2-4 Members)', defaultChecked: true, required: false, type: 'Short answer' },
  { id: 'mentor_name', label: 'Faculty Mentor / Project Lead', defaultChecked: true, required: false, type: 'Short answer' },
  { id: 'organization', label: 'Organization / Lab / Company', defaultChecked: true, required: false, type: 'Short answer' },
  { id: 'application_deadline', label: 'Application Deadline (YYYY-MM-DD)', defaultChecked: true, required: false, type: 'Date' },
  { id: 'resource_url', label: 'Drive / Document Reference URL', defaultChecked: false, required: false, type: 'Short answer' },
  { id: 'contact_name', label: 'Contact Person Name', defaultChecked: true, required: false, type: 'Short answer' },
  { id: 'contact_email', label: 'Contact Email Address', defaultChecked: true, required: false, type: 'Short answer' }
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
Google Form Creation & Import Template Guide

Steps to Collect Project Submissions:
1. Open Google Forms: https://forms.new
2. Form Title: SISTEC Student Project & Opportunities Submission Form
3. Add the following questions in order:
${questionsText}

4. In Google Forms, go to the "Responses" tab:
   - Click "Link to Sheets" to create a linked Google Spreadsheet.
5. In the Google Spreadsheet:
   - Click "Share" (top-right).
   - Change General access to: "Anyone with the link can view" (Viewer).
   - Copy the Google Sheet URL.
6. Return to SISTEC Library Portal:
   - Go to Admin -> Projects -> Click "Import Projects".
   - Select "Google Sheet URL", paste the link, and click "Preview & Import".
   - Review the automatic column mapping and import records directly into the library directory!`;

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
