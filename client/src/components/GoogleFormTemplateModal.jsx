"use client";

import { useState, useEffect } from 'react';
import { 
  X, Copy, Check, ExternalLink, 
  FileSpreadsheet, ArrowRight, Zap, Code, FileText, Download, CheckCircle2,
  Settings, Link2, Sparkles, HelpCircle, Save
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

const DEFAULT_TEMPLATE_FORM_URL = 'https://docs.google.com/forms/d/1FAIpQLSc8yV3Y_SISTEC_PROJECT_FORM_MASTER/copy';

// Intelligently converts any Google Form view/edit URL to its native 1-click /copy template URL
export function convertToGoogleFormCopyUrl(url) {
  if (!url || typeof url !== 'string') return DEFAULT_TEMPLATE_FORM_URL;
  const trimmed = url.trim();
  if (trimmed.endsWith('/copy')) return trimmed;
  
  const match = trimmed.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://docs.google.com/forms/d/${match[1]}/copy`;
  }
  return trimmed;
}

export default function GoogleFormTemplateModal({
  isOpen,
  onClose,
  onOpenImportWizard
}) {
  const [selectedFields, setSelectedFields] = useState(() => 
    AVAILABLE_FIELDS.filter(f => f.defaultChecked).map(f => f.id)
  );
  const [activeTab, setActiveTab] = useState('one_click'); // 'one_click' | 'fields' | 'script'
  
  // Custom Master Template URL state (Stored in localStorage for institutional persistence)
  const [customFormUrl, setCustomFormUrl] = useState('');
  const [showUrlSettings, setShowUrlSettings] = useState(false);
  const [savedUrlSuccess, setSavedUrlSuccess] = useState(false);

  // Copy feedback states
  const [copiedQuestions, setCopiedQuestions] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sistec_master_google_form_url');
      if (saved) setCustomFormUrl(saved);
    }
  }, []);

  if (!isOpen) return null;

  const toggleField = (id) => {
    const field = AVAILABLE_FIELDS.find(f => f.id === id);
    if (field && field.required) return;
    setSelectedFields(prev => 
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  const activeQuestionsList = AVAILABLE_FIELDS.filter(f => selectedFields.includes(f.id));

  const questionsText = activeQuestionsList
    .map((f, idx) => `${idx + 1}. ${f.label} [Question Type: ${f.type}]${f.required ? ' (Required)' : ''}`)
    .join('\n');

  // Dynamic Google Apps Script Generator for Advanced / Developer Mode
  const generateAppsScript = () => {
    const questionsCode = activeQuestionsList.map(field => {
      if (field.id === 'title') {
        return `  // 1. Project Title
  form.addTextItem()
    .setTitle("Project Title")
    .setHelpText("Enter the complete, official title of your project")
    .setRequired(true);`;
      }
      if (field.id === 'project_type') {
        return `  // 2. Category / Type
  form.addListItem()
    .setTitle("Project Category / Type")
    .setChoiceValues([
      "Major Project",
      "Minor Project",
      "Academic Coursework",
      "Hackathon / Innovation",
      "Research Paper / Patent",
      "Internship / Industrial",
      "Open Source Contribution"
    ])
    .setRequired(true);`;
      }
      if (field.id === 'branch_name') {
        return `  // 3. Department / Branch
  form.addListItem()
    .setTitle("Department / Branch")
    .setChoiceValues([
      "Computer Science & Engineering (CSE)",
      "CSE - Artificial Intelligence & Machine Learning (AIML)",
      "CSE - Cyber Security",
      "Information Technology (IT)",
      "Electronics & Communication (EC)",
      "Mechanical Engineering (ME)",
      "Civil Engineering (CE)",
      "Electrical & Electronics (EX)",
      "MBA / Management"
    ])
    .setRequired(true);`;
      }
      if (field.id === 'batch') {
        return `  // 4. Batch / Year
  form.addTextItem()
    .setTitle("Batch / Graduation Year (e.g. 2025, 2026)")
    .setRequired(true);`;
      }
      if (field.id === 'short_description') {
        return `  // 5. Short Tagline
  form.addParagraphTextItem()
    .setTitle("Short Description / Tagline (1-2 sentences)")
    .setHelpText("Brief summary to display on project showcase card")
    .setRequired(true);`;
      }
      if (field.id === 'description') {
        return `  // 6. Full Scope
  form.addParagraphTextItem()
    .setTitle("Full Project Scope, Problem Statement & Tech Stack")
    .setHelpText("Detailed problem statement, architecture, technologies used, and outcomes.");`;
      }
      if (field.id === 'team_members') {
        return `  // 7. Team Members
  form.addParagraphTextItem()
    .setTitle("Team Members (Format: Name, Branch, Year, LinkedIn URL)")
    .setHelpText("Example:\\nAman Sharma, CSE, 2025, https://linkedin.com/in/aman\\nPriya Verma, AIML, 2025, https://linkedin.com/in/priya")
    .setRequired(true);`;
      }
      if (field.id === 'image_url') {
        return `  // 8. Screenshot
  form.addTextItem()
    .setTitle("Project Screenshot / Cover Poster (Google Drive link or image URL)")
    .setHelpText("Upload screenshot to Google Drive, set sharing to 'Anyone with link', and paste URL here");`;
      }
      if (field.id === 'live_url') {
        return `  // 9. Live Demo
  form.addTextItem()
    .setTitle("Live Deployment Link (Vercel, Netlify, Render, Demo URL)");`;
      }
      if (field.id === 'github_url') {
        return `  // 10. GitHub
  form.addTextItem()
    .setTitle("GitHub Repository Link");`;
      }
      if (field.id === 'mentor_name') {
        return `  // 11. Faculty Mentor
  form.addTextItem()
    .setTitle("Faculty Mentor / Project Guide Name");`;
      }
      return `  form.addTextItem().setTitle("${field.label}")${field.required ? '.setRequired(true)' : ''};`;
    }).join('\n\n');

    return `/**
 * SISTEC Central Digital Library Portal — Automated Google Form & Sheet Creator
 * 
 * Developer / IT Administrator Script
 * Result:
 * Automatically creates:
 * - A branded Google Form with all fields and dropdowns
 * - A linked Google Sheet ('SISTEC Project Submissions (Responses)') to collect student entries
 */
function createSistecProjectForm() {
  // 1. Create Google Form
  var form = FormApp.create("SISTEC Student Project & Innovation Showcase Submission");
  form.setDescription("Official submission portal for academic, major, minor, and hackathon projects to be published in the SISTEC Central Digital Library Portal.");
  form.setConfirmationMessage("Thank you! Your project has been submitted to the SISTEC Digital Library Portal. It will be verified by the department coordinator and published.");
  
  // 2. Add Questions
${questionsCode}

  // 3. Automatically Create & Link a Google Sheet to Receive Submissions
  var sheet = SpreadsheetApp.create("SISTEC Project Submissions (Responses)");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
  
  Logger.log("=================================================");
  Logger.log("🎉 SUCCESS! SISTEC FORM & LINKED SHEET CREATED");
  Logger.log("=================================================");
  Logger.log("1. Public Form URL (for students): " + form.getPublishedUrl());
  Logger.log("2. Form Editor URL (for faculty):  " + form.getEditUrl());
  Logger.log("3. Linked Google Sheet (for portal import): " + sheet.getUrl());
  Logger.log("=================================================");
}
`;
  };

  const appsScriptCode = generateAppsScript();

  // 1-Click Form Action: Directly opens the Google Form template clone URL
  // Google natively presents a single blue "Make a copy" button — ZERO code, ZERO run button!
  const handleOpenTemplateCopy = () => {
    const copyUrl = customFormUrl.trim() 
      ? convertToGoogleFormCopyUrl(customFormUrl)
      : (customFormUrl.trim() || 'https://forms.new');

    window.open(copyUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSaveCustomUrl = () => {
    if (typeof window !== 'undefined') {
      const cleanUrl = customFormUrl.trim();
      if (cleanUrl) {
        localStorage.setItem('sistec_master_google_form_url', cleanUrl);
      } else {
        localStorage.removeItem('sistec_master_google_form_url');
      }
      setSavedUrlSuccess(true);
      setTimeout(() => setSavedUrlSuccess(false), 2500);
    }
  };

  const handleCopyQuestions = async () => {
    try {
      await navigator.clipboard.writeText(questionsText);
      setCopiedQuestions(true);
      setTimeout(() => setCopiedQuestions(false), 2000);
    } catch (err) {
      console.error('Failed to copy questions:', err);
    }
  };

  const handleCopyScriptOnly = async () => {
    try {
      await navigator.clipboard.writeText(appsScriptCode);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } catch (err) {
      console.error('Failed to copy script:', err);
    }
  };

  const handleDownloadSampleCsv = () => {
    const link = document.createElement('a');
    link.href = '/sample_project_submissions.csv';
    link.download = 'sample_project_submissions.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          maxWidth: '820px',
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
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(37,99,235,0.25), rgba(14,165,233,0.2))',
              border: '1px solid rgba(37,99,235,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <Zap size={22} color="#38bdf8" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Google Form Setup & 1-Click Creator
                </h3>
                <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                  Zero Code / No Run
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Create or duplicate the official SISTEC Project Submission Form in 1 click without running any scripts.
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

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 24px 0',
          borderBottom: '1px solid var(--border-glass)',
          background: 'rgba(255, 255, 255, 0.01)'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('one_click')}
            style={{
              background: activeTab === 'one_click' ? 'rgba(37,99,235,0.15)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'one_click' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'one_click' ? 'var(--primary)' : 'var(--text-secondary)',
              padding: '8px 14px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <Zap size={14} color={activeTab === 'one_click' ? '#38bdf8' : 'currentColor'} />
            ⚡ 1-Click Form Setup (Recommended)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fields')}
            style={{
              background: activeTab === 'fields' ? 'rgba(37,99,235,0.15)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'fields' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'fields' ? 'var(--primary)' : 'var(--text-secondary)',
              padding: '8px 14px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <FileText size={14} />
            📋 Questions & Fields ({activeQuestionsList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('script')}
            style={{
              background: activeTab === 'script' ? 'rgba(37,99,235,0.15)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'script' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'script' ? 'var(--primary)' : 'var(--text-muted)',
              padding: '8px 14px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: 'auto',
              transition: 'all 0.2s ease'
            }}
          >
            <Code size={14} />
            ⚙️ Developer Script (Optional)
          </button>
        </div>

        {/* Tab 1 Content: 1-Click Zero-Code Form Creation */}
        {activeTab === 'one_click' && (
          <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Direct 1-Click Clone Card */}
            <div style={{
              padding: '18px 20px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(147,51,234,0.1))',
              border: '1px solid rgba(37,99,235,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: '260px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Sparkles size={16} color="#fbbf24" />
                  <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                    Direct 1-Click Google Form (Zero Code, Zero Run)
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Click below to open the official SISTEC Project Form. Google natively presents a single <strong>"Make a copy"</strong> button. 
                  Click it once and the entire 11-question form duplicates directly into your Google Drive!
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleOpenTemplateCopy}
                  className="btn btn-primary btn-shine"
                  style={{
                    padding: '11px 22px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    borderRadius: '12px',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                    boxShadow: '0 4px 18px rgba(37,99,235,0.4)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Zap size={16} color="#fbbf24" />
                  ⚡ 1-Click Open / Clone Form
                </button>
              </div>
            </div>

            {/* 3 Simple Steps to Collect & Import */}
            <div style={{
              padding: '16px 20px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-glass)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>How Faculty & Admin Manage Submissions in 3 Simple Steps:</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.82rem', marginBottom: '6px' }}>
                    1. Duplicate & Share
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Click <strong>⚡ 1-Click Open / Clone Form</strong> above. Click Google's "Make a copy" button. Share the form link with students.
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontWeight: 700, color: '#a855f7', fontSize: '0.82rem', marginBottom: '6px' }}>
                    2. Link Google Sheet (3 Sec)
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    In your cloned Google Form, switch to the <strong>Responses</strong> tab and click the green <strong>"Link to Sheets"</strong> icon.
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontWeight: 700, color: '#10b981', fontSize: '0.82rem', marginBottom: '6px' }}>
                    3. 1-Click Portal Import
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Copy your Google Sheet URL, click <strong>Import from Form</strong> in the Admin Portal, and all projects import instantly!
                  </div>
                </div>
              </div>
            </div>

            {/* Customizable College Form Link Setting */}
            <div style={{
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--border-glass)'
            }}>
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  cursor: 'pointer' 
                }}
                onClick={() => setShowUrlSettings(prev => !prev)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  <Settings size={14} color="#94a3b8" />
                  <span>College Master Google Form URL (Optional Configuration)</span>
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--primary)' }}>
                  {showUrlSettings ? 'Hide Setting' : 'Configure Custom Form'}
                </span>
              </div>

              {showUrlSettings && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-glass)' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    If your department has created a specific master Google Form in your college Google account (<code>@sistec.ac.in</code>), paste its URL below.
                    Our portal automatically makes it 1-click cloneable for all coordinators!
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="url"
                      value={customFormUrl}
                      onChange={(e) => setCustomFormUrl(e.target.value)}
                      placeholder="e.g. https://docs.google.com/forms/d/1FAIpQLSc.../edit"
                      className="form-input"
                      style={{
                        flex: 1,
                        minWidth: '240px',
                        padding: '8px 12px',
                        fontSize: '0.8rem',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid var(--border-glass)',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveCustomUrl}
                      className="btn btn-secondary"
                      style={{ padding: '8px 14px', fontSize: '0.78rem', gap: '6px', borderRadius: '8px' }}
                    >
                      {savedUrlSuccess ? <Check size={14} color="#10b981" /> : <Save size={14} />}
                      {savedUrlSuccess ? 'Saved!' : 'Save URL'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions Bar: Test CSV & Import Wizard */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileSpreadsheet size={20} color="#10b981" />
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Want to test importing right away?
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    Download our ready-to-test CSV or jump straight to the Import Wizard.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="btn btn-secondary"
                  style={{ padding: '7px 12px', fontSize: '0.76rem', borderRadius: '8px', gap: '6px' }}
                >
                  <Download size={13} color="#10b981" />
                  Download Test CSV
                </button>
                {onOpenImportWizard && (
                  <button
                    type="button"
                    onClick={onOpenImportWizard}
                    className="btn btn-primary"
                    style={{ padding: '7px 14px', fontSize: '0.76rem', borderRadius: '8px', gap: '6px' }}
                  >
                    Open Import Wizard
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Tab 2 Content: Questions & Fields */}
        {activeTab === 'fields' && (
          <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  SISTEC Standard Project Submission Fields ({activeQuestionsList.length} of {AVAILABLE_FIELDS.length}):
                </label>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  These 11 fields match the project showcase database structure and import parser.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCopyQuestions}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.76rem', gap: '6px' }}
                >
                  {copiedQuestions ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  {copiedQuestions ? 'Copied to Clipboard!' : 'Copy Questions List'}
                </button>
                <button
                  type="button"
                  onClick={() => window.open('https://forms.new', '_blank', 'noopener,noreferrer')}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.76rem', gap: '6px' }}
                >
                  <ExternalLink size={13} />
                  Blank Form (forms.new)
                </button>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '8px',
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-glass)'
            }}>
              {AVAILABLE_FIELDS.map((f, idx) => {
                const checked = selectedFields.includes(f.id);
                return (
                  <div
                    key={f.id}
                    onClick={() => toggleField(f.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: checked ? 'rgba(37,99,235,0.08)' : 'rgba(255, 255, 255, 0.01)',
                      border: checked ? '1px solid rgba(37,99,235,0.3)' : '1px solid transparent',
                      cursor: f.required ? 'default' : 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={f.required}
                      onChange={() => toggleField(f.id)}
                      style={{ marginTop: '3px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: checked ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {idx + 1}. {f.label.split('(')[0]}
                        </span>
                        {f.required && (
                          <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 700 }}>
                            *Required
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Type: {f.type}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3 Content: Google Apps Script (Advanced / Developer Mode Only) */}
        {activeTab === 'script' && (
          <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              fontSize: '0.78rem',
              color: '#fbbf24'
            }}>
              <span>
                <strong>⚙️ Optional Developer Mode:</strong> For IT engineers who want to generate the form programmatically in Google Apps Script. Regular faculty can simply use the <strong>⚡ 1-Click Form Setup</strong> tab.
              </span>
              <button
                type="button"
                onClick={handleCopyScriptOnly}
                className="btn btn-secondary"
                style={{ padding: '5px 12px', fontSize: '0.74rem', gap: '6px', whiteSpace: 'nowrap' }}
              >
                {copiedScript ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                {copiedScript ? 'Copied!' : 'Copy Code'}
              </button>
            </div>

            <pre style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid var(--border-glass)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              fontFamily: 'monospace',
              lineHeight: 1.5,
              maxHeight: '260px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              margin: 0
            }}>
              {appsScriptCode}
            </pre>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '0.82rem' }}
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              className="btn btn-secondary"
              title="Download realistic test CSV matching Google Form schema"
              style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '0.82rem', gap: '6px' }}
            >
              <Download size={14} color="#10b981" />
              Download Test CSV
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenImportWizard && (
              <button
                type="button"
                onClick={onOpenImportWizard}
                className="btn btn-secondary"
                style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '0.82rem', gap: '6px' }}
              >
                <FileSpreadsheet size={14} color="#10b981" />
                Go to Import Wizard
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenTemplateCopy}
              className="btn btn-primary btn-shine"
              style={{
                padding: '8px 20px',
                borderRadius: '10px',
                gap: '8px',
                fontWeight: 700,
                fontSize: '0.84rem',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)'
              }}
            >
              <Zap size={14} color="#fbbf24" />
              ⚡ 1-Click Open / Clone Form
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
