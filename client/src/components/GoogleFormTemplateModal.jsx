"use client";

import { useState } from 'react';
import { 
  X, Copy, Check, ExternalLink, 
  FileSpreadsheet, ArrowRight, Zap, Code, FileText, Download, CheckCircle2
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
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedGuide, setCopiedGuide] = useState(false);
  const [oneClickActive, setOneClickActive] = useState(false);
  const [activeTab, setActiveTab] = useState('one_click'); // 'one_click' | 'script' | 'manual'

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

  // Dynamic Google Apps Script Generator for 1-Click Form & Linked Sheet Creation
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
 * Instructions:
 * 1. Open this in Google Apps Script (script.new)
 * 2. Click the 'Run' button (▶) at the top toolbar
 * 3. Authorize Google permissions once
 * 
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

  // 1-Click Automated Trigger: Copies code & opens script.new in 1 action
  const handleOneClickCreate = async () => {
    try {
      await navigator.clipboard.writeText(appsScriptCode);
      setCopiedScript(true);
      setOneClickActive(true);
      window.open('https://script.new', '_blank', 'noopener,noreferrer');
      setTimeout(() => setCopiedScript(false), 3000);
    } catch (err) {
      console.error('Failed to copy script:', err);
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

  const handleCopyQuestions = async () => {
    try {
      await navigator.clipboard.writeText(questionsText);
      setCopiedQuestions(true);
      setTimeout(() => setCopiedQuestions(false), 2000);
    } catch (err) {
      console.error('Failed to copy questions:', err);
    }
  };

  const handleCopyGuide = async () => {
    try {
      const fullGuide = `SISTEC Central Digital Library Portal\nGoogle Form Creation Guide\n\nQuestions:\n${questionsText}`;
      await navigator.clipboard.writeText(fullGuide);
      setCopiedGuide(true);
      setTimeout(() => setCopiedGuide(false), 2000);
    } catch (err) {
      console.error('Failed to copy guide:', err);
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
                  1-Click Google Form & Sheet Creator
                </h3>
                <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                  Auto-Build
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Instantly build a Google Form with questions, dropdowns & an auto-linked responses Spreadsheet.
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

        {/* 1-Click Action Hero Card */}
        <div style={{
          padding: '16px 24px',
          background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(147,51,234,0.08))',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={16} color="#fbbf24" />
              One-Click Automated Google Form Creation
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Click below: It generates the script, copies it to clipboard, and opens Google Apps Script. Just paste & run!
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleOneClickCreate}
              className="btn btn-primary btn-shine"
              style={{
                padding: '9px 18px',
                fontSize: '0.84rem',
                fontWeight: 700,
                borderRadius: '10px',
                gap: '8px',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                boxShadow: '0 4px 15px rgba(37,99,235,0.4)'
              }}
            >
              <Zap size={15} color="#fbbf24" />
              ⚡ 1-Click Auto-Create Form
            </button>
          </div>
        </div>

        {/* If 1-Click triggered: Show step-by-step guidance banner */}
        {oneClickActive && (
          <div style={{
            margin: '14px 24px 0',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <CheckCircle2 size={18} color="#10b981" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
              <strong>Script Copied to Clipboard & Google Tab Opened!</strong>
              <div style={{ marginTop: '4px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                1. In the new tab, select all text and press <strong>Ctrl + V</strong> to paste the automation script.<br />
                2. Click the <strong>▶ Run</strong> button in the top toolbar.<br />
                3. Allow Google permissions when prompted. Your Form & linked Sheet will be created in your Drive within 3 seconds!
              </div>
            </div>
          </div>
        )}

        {/* Main Body */}
        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Field Selection Area */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Fields Included in Google Form ({activeQuestionsList.length} of {AVAILABLE_FIELDS.length}):
              </label>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Checked fields will be auto-generated in the Form
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '6px',
              maxHeight: '160px',
              overflowY: 'auto',
              padding: '10px 12px',
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
                      fontSize: '0.78rem',
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

          {/* Mode Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: '1px solid var(--border-glass)',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('one_click')}
              style={{
                background: activeTab === 'one_click' ? 'rgba(37,99,235,0.2)' : 'transparent',
                border: activeTab === 'one_click' ? '1px solid var(--primary)' : '1px solid transparent',
                color: activeTab === 'one_click' ? 'var(--primary)' : 'var(--text-muted)',
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Zap size={13} /> 1-Click Instructions
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('script')}
              style={{
                background: activeTab === 'script' ? 'rgba(37,99,235,0.2)' : 'transparent',
                border: activeTab === 'script' ? '1px solid var(--primary)' : '1px solid transparent',
                color: activeTab === 'script' ? 'var(--primary)' : 'var(--text-muted)',
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Code size={13} /> View Apps Script Code
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              style={{
                background: activeTab === 'manual' ? 'rgba(37,99,235,0.2)' : 'transparent',
                border: activeTab === 'manual' ? '1px solid var(--primary)' : '1px solid transparent',
                color: activeTab === 'manual' ? 'var(--primary)' : 'var(--text-muted)',
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FileText size={13} /> Manual Questions (forms.new)
            </button>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
              {activeTab === 'script' && (
                <button
                  type="button"
                  onClick={handleCopyScriptOnly}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.74rem', gap: '4px' }}
                >
                  {copiedScript ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedScript ? 'Copied!' : 'Copy Script'}
                </button>
              )}
              {activeTab === 'manual' && (
                <button
                  type="button"
                  onClick={handleCopyQuestions}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.74rem', gap: '4px' }}
                >
                  {copiedQuestions ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedQuestions ? 'Copied!' : 'Copy Questions'}
                </button>
              )}
            </div>
          </div>

          {/* Tab Content 1: One-Click Instructions */}
          {activeTab === 'one_click' && (
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-glass)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <span>How 1-Click Form Creation Works:</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.8rem', marginBottom: '4px' }}>Step 1: One-Click Launch</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Click <strong>⚡ 1-Click Auto-Create</strong>. The system copies the generated Google script and opens <code>script.new</code>.</div>
                </div>
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontWeight: 700, color: '#a855f7', fontSize: '0.8rem', marginBottom: '4px' }}>Step 2: Paste & Run</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Press <strong>Ctrl + V</strong> to paste the code, then click the <strong>▶ Run</strong> button at the top.</div>
                </div>
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontWeight: 700, color: '#10b981', fontSize: '0.8rem', marginBottom: '4px' }}>Step 3: Done Instantly</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Google creates both the form and the responses spreadsheet in your Google Drive automatically.</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 2: Script Preview */}
          {activeTab === 'script' && (
            <pre style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--border-glass)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              fontFamily: 'monospace',
              lineHeight: 1.5,
              maxHeight: '220px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              margin: 0
            }}>
              {appsScriptCode}
            </pre>
          )}

          {/* Tab Content 3: Manual Questions */}
          {activeTab === 'manual' && (
            <pre style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--border-glass)',
              fontSize: '0.76rem',
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
          )}
        </div>

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
            <button
              type="button"
              onClick={() => window.open('https://forms.new', '_blank', 'noopener,noreferrer')}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '0.82rem', gap: '6px' }}
            >
              <ExternalLink size={13} />
              Manual Builder (forms.new)
            </button>

            <button
              type="button"
              onClick={handleOneClickCreate}
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
              ⚡ 1-Click Auto-Create Form
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
