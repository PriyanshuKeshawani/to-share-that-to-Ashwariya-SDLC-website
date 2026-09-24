"use client";

import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, Upload, FileSpreadsheet, Link as LinkIcon, Check, 
  AlertCircle, ArrowRight, ArrowLeft, RefreshCw, 
  Download, Copy, FileText 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DB_TARGET_FIELDS = [
  { value: 'ignore', label: '— Ignore This Column —' },
  { value: 'title', label: 'Project Title (Required)' },
  { value: 'project_type', label: 'Project Category / Type' },
  { value: 'short_description', label: 'Short Description / Tagline' },
  { value: 'description', label: 'Full Scope / Description' },
  { value: 'branch_name', label: 'Department / Branch' },
  { value: 'batch', label: 'Batch / Graduation Year' },
  { value: 'team_members', label: 'Team Members (Smart Parsed)' },
  { value: 'image_url', label: 'Cover Image / Screenshot (Auto Drive CDN)' },
  { value: 'live_url', label: 'Live Demo URL' },
  { value: 'github_url', label: 'GitHub Repository URL' },
  { value: 'mentor_name', label: 'Faculty Mentor / Guide' },
  { value: 'is_published', label: 'Published Status (true/false)' }
];

// Automatically converts Google Drive share links to fast direct preview URLs
export function convertDriveImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  const m1 = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1 && m1[1]) return `https://lh3.googleusercontent.com/d/${m1[1]}`;
  const m2 = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2 && m2[1]) return `https://lh3.googleusercontent.com/d/${m2[1]}`;
  return trimmed;
}

// Intelligently parses free-text team members into structured JSON objects
export function parseTeamMembers(rawText, defaultBranch = '', defaultBatch = '') {
  if (!rawText) return [];
  if (Array.isArray(rawText)) return rawText;
  if (typeof rawText !== 'string') return [];

  const lines = rawText.split(/[\r\n;]+/).map(s => s.trim()).filter(Boolean);
  const results = [];

  lines.forEach(line => {
    const parts = line.split(/,(?![^()]*\))/).map(s => s.trim()).filter(Boolean);
    parts.forEach(part => {
      let linkedin = '';
      const linkedinMatch = part.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i);
      if (linkedinMatch) {
        linkedin = linkedinMatch[0];
        part = part.replace(linkedin, '').trim();
      }

      const parenMatch = part.match(/\((.*?)\)/);
      let name = part;
      let branch = defaultBranch;
      let passout_year = defaultBatch;

      if (parenMatch) {
        name = part.replace(parenMatch[0], '').replace(/[-–,]/g, ' ').trim();
        const inner = parenMatch[1];
        const yMatch = inner.match(/\b(20\d{2})\b/);
        if (yMatch) passout_year = yMatch[1];
        const branchClean = inner.replace(/\b20\d{2}\b/, '').replace(/[-–,]/g, ' ').trim();
        if (branchClean) branch = branchClean;
      } else if (part.includes('-') || part.includes('–')) {
        const chunks = part.split(/[-–]/).map(c => c.trim());
        name = chunks[0] || '';
        if (chunks[1]) {
          const yMatch = chunks[1].match(/\b(20\d{2})\b/);
          if (yMatch) passout_year = yMatch[1];
          else branch = chunks[1];
        }
        if (chunks[2]) {
          const yMatch = chunks[2].match(/\b(20\d{2})\b/);
          if (yMatch) passout_year = yMatch[1];
          else if (!branch) branch = chunks[2];
        }
      }

      name = name.replace(/^[\d.\s*-]+/, '').trim();
      if (name) {
        results.push({
          name,
          branch: branch || 'Engineering',
          passout_year: passout_year || '2025',
          linkedin_url: linkedin
        });
      }
    });
  });

  return results.length > 0 ? results : [{ name: rawText.slice(0, 50), branch: defaultBranch || 'Engineering', passout_year: defaultBatch || '2025' }];
}

// Helper for automatic header matching
function autoDetectField(headerName) {
  if (!headerName) return 'ignore';
  const h = String(headerName).toLowerCase().replace(/[^a-z0-9]/g, '');

  if (h.includes('projecttitle') || h === 'title' || h === 'topic' || h.includes('projectname') || h.includes('nameofproject')) return 'title';
  if (h.includes('category') || h.includes('projecttype') || h === 'type' || h.includes('majorminor')) return 'project_type';
  if (h.includes('shortdesc') || h.includes('tagline') || h.includes('summary') || h.includes('brief') || h.includes('overview')) return 'short_description';
  if (h.includes('desc') || h.includes('scope') || h.includes('methodology') || h.includes('problem') || h.includes('details') || h.includes('techstack')) return 'description';
  if (h.includes('branch') || h.includes('dept') || h.includes('department') || h.includes('stream') || h.includes('discipline')) return 'branch_name';
  if (h.includes('batch') || h.includes('passingyear') || h.includes('gradyear') || h.includes('passout') || h === 'year') return 'batch';
  if (h.includes('team') || h.includes('member') || h.includes('student') || h.includes('authors') || h.includes('contributor')) return 'team_members';
  if (h.includes('image') || h.includes('cover') || h.includes('screenshot') || h.includes('poster') || h.includes('banner') || h.includes('photo') || h.includes('drive')) return 'image_url';
  if (h.includes('live') || h.includes('demo') || h.includes('website') || h.includes('deploy') || (h.includes('link') && !h.includes('git') && !h.includes('image'))) return 'live_url';
  if (h.includes('github') || h.includes('git') || h.includes('repo') || h.includes('repository') || h.includes('sourcecode')) return 'github_url';
  if (h.includes('mentor') || h.includes('guide') || h.includes('faculty') || h.includes('supervisor')) return 'mentor_name';
  if (h.includes('publish') || h.includes('status')) return 'is_published';

  return 'ignore';
}

export default function ProjectImportWizard({
  isOpen,
  onClose,
  existingProjects = [],
  onImportComplete
}) {
  const { apiCall } = useAuth();

  // Wizard Steps: 1: Source -> 2: Preview & Map -> 3: Validate & Duplicates -> 4: Executing / Result
  const [currentStep, setCurrentStep] = useState(1);
  const [sourceType, setSourceType] = useState('paste'); // 'paste' | 'excel' | 'csv' | 'google_sheet'
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // Parsing States
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsedHeaders, setParsedHeaders] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [columnMappings, setColumnMappings] = useState({}); // { [headerIndex]: targetField }

  // Duplicate Resolution
  const [duplicateResolution, setDuplicateResolution] = useState('skip'); // 'skip' | 'update' | 'insert'

  // Execution States
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Handle local Excel / CSV file selection
  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setParseError('');
    setParsing(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (!json || json.length === 0) {
        throw new Error('The selected spreadsheet is completely empty.');
      }

      const rawHeaders = json[0].map((h, i) => String(h || `Column_${i + 1}`).trim());
      const dataRows = json.slice(1).filter(row => row.some(cell => String(cell).trim() !== ''));

      if (dataRows.length === 0) {
        throw new Error('No data rows found in the sheet (only headers detected).');
      }

      // Initial auto-mapping
      const initialMappings = {};
      rawHeaders.forEach((h, idx) => {
        initialMappings[idx] = autoDetectField(h);
      });

      setParsedHeaders(rawHeaders);
      setParsedRows(dataRows);
      setColumnMappings(initialMappings);
      setCurrentStep(2);
    } catch (err) {
      console.error('File parsing error:', err);
      setParseError(err.message || 'Failed to read spreadsheet. Ensure the file is a valid .xlsx, .xls, or .csv.');
    } finally {
      setParsing(false);
    }
  };

  // Handle Google Sheet URL Fetch
  const handleFetchGoogleSheet = async () => {
    if (!googleSheetUrl.trim()) {
      setParseError('Please enter a Google Sheet URL.');
      return;
    }

    setParseError('');
    setParsing(true);

    try {
      const res = await fetch('/api/proxy-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: googleSheetUrl.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch Google Sheet.');
      }

      // Parse fetched CSV string using XLSX
      const workbook = XLSX.read(data.csv, { type: 'string' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (!json || json.length === 0) {
        throw new Error('The Google Sheet has no readable content.');
      }

      const rawHeaders = json[0].map((h, i) => String(h || `Column_${i + 1}`).trim());
      const dataRows = json.slice(1).filter(row => row.some(cell => String(cell).trim() !== ''));

      if (dataRows.length === 0) {
        throw new Error('No records found in the Google Sheet.');
      }

      const initialMappings = {};
      rawHeaders.forEach((h, idx) => {
        initialMappings[idx] = autoDetectField(h);
      });

      setParsedHeaders(rawHeaders);
      setParsedRows(dataRows);
      setColumnMappings(initialMappings);
      setCurrentStep(2);
    } catch (err) {
      console.error('Google Sheet error:', err);
      setParseError(err.message || 'Could not fetch Google Sheet.');
    } finally {
      setParsing(false);
    }
  };

  // Handle Direct Paste from Google Sheets or CSV
  const handlePasteData = () => {
    if (!pasteText || !pasteText.trim()) {
      setParseError('Please paste rows copied from your Google Sheet or spreadsheet.');
      return;
    }
    setParseError('');
    try {
      const lines = pasteText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        throw new Error('Please include at least a header row and 1 data row copied from Google Sheets.');
      }
      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const rawHeaders = lines[0].split(delimiter).map((h, i) => String(h || `Column_${i + 1}`).trim());
      const dataRows = lines.slice(1).map(l => l.split(delimiter).map(c => c.trim()));

      const initialMappings = {};
      rawHeaders.forEach((h, idx) => {
        initialMappings[idx] = autoDetectField(h);
      });

      setParsedHeaders(rawHeaders);
      setParsedRows(dataRows);
      setColumnMappings(initialMappings);
      setCurrentStep(2);
    } catch (err) {
      setParseError(err.message || 'Failed to parse pasted data.');
    }
  };

  // Convert parsed rows using current column mappings
  const mappedObjects = useMemo(() => {
    return parsedRows.map(row => {
      const obj = {};
      parsedHeaders.forEach((_header, idx) => {
        const targetField = columnMappings[idx];
        if (targetField && targetField !== 'ignore') {
          obj[targetField] = row[idx] !== undefined ? String(row[idx]).trim() : '';
        }
      });
      return obj;
    });
  }, [parsedRows, parsedHeaders, columnMappings]);

  // Validation & Duplicate analysis
  const validationSummary = useMemo(() => {
    let validCount = 0;
    let missingTitleCount = 0;
    let duplicateCount = 0;

    const existingMap = new Set();
    existingProjects.forEach(p => {
      const key = `${(p.title || '').toLowerCase()}|${(p.branch_name || '').toLowerCase()}|${(p.batch || '').toLowerCase()}`;
      existingMap.add(key);
    });

    mappedObjects.forEach(item => {
      const title = (item.title || '').trim();
      if (!title) {
        missingTitleCount++;
        return;
      }

      const branch = (item.branch_name || '').trim().toLowerCase();
      const batch = (item.batch || '').trim().toLowerCase();
      const key = `${title.toLowerCase()}|${branch}|${batch}`;

      if (existingMap.has(key)) {
        duplicateCount++;
      }
      validCount++;
    });

    return {
      total: mappedObjects.length,
      valid: validCount,
      missingTitle: missingTitleCount,
      duplicates: duplicateCount
    };
  }, [mappedObjects, existingProjects]);

  // Execute Import
  const handleExecuteImport = async () => {
    setImporting(true);
    setParseError('');

    try {
      const payloadItems = mappedObjects.filter(item => Boolean((item.title || '').trim())).map(item => {
        const branch = item.branch_name || 'Engineering';
        const batch = item.batch || '2025';
        return {
          title: item.title.trim(),
          project_type: item.project_type || 'Academic Project',
          short_description: item.short_description || (item.description ? item.description.slice(0, 160) : 'Student innovation project.'),
          description: item.description || item.short_description || 'Student project description and scope.',
          branch_name: branch,
          batch: batch,
          image_url: convertDriveImageUrl(item.image_url),
          live_url: item.live_url || '',
          github_url: item.github_url || '',
          team_members: parseTeamMembers(item.team_members, branch, batch),
          mentor_name: item.mentor_name || '',
          is_published: item.is_published !== undefined ? (String(item.is_published).toLowerCase() !== 'false') : true,
          source_type: sourceType,
          source_reference: sourceType === 'google_sheet' ? googleSheetUrl.trim() : (sourceType === 'paste' ? 'Google Sheet Tabular Paste' : (selectedFile ? selectedFile.name : null))
        };
      });

      const res = await apiCall('/projects/bulk-import', {
        method: 'POST',
        body: {
          items: payloadItems,
          duplicateResolution
        }
      });

      setImportResult(res);
      setCurrentStep(4);
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      console.error('Import execution error:', err);
      setParseError(err.message || 'Failed to complete import.');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadFailedCsv = () => {
    if (!importResult || !importResult.errors || importResult.errors.length === 0) return;
    const errorRows = importResult.errors.map(e => ({
      Row_Number: e.row,
      Error_Reason: e.error
    }));
    const ws = XLSX.utils.json_to_sheet(errorRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Failed_Rows');
    XLSX.writeFile(wb, 'import_failed_rows.csv');
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 7, 12, 0.88)',
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
              <Upload size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Import Projects Wizard
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Step {currentStep} of 4 • Import records from Excel, CSV, or live Google Sheets.
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

        {/* Step Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          background: 'rgba(255, 255, 255, 0.01)',
          borderBottom: '1px solid var(--border-glass)',
          fontSize: '0.78rem',
          fontWeight: 600,
          color: 'var(--text-muted)'
        }}>
          {[
            { step: 1, label: '1. Select Source' },
            { step: 2, label: '2. Map Columns' },
            { step: 3, label: '3. Verify & Duplicates' },
            { step: 4, label: '4. Results' }
          ].map(s => (
            <span 
              key={s.step} 
              style={{
                color: currentStep === s.step ? 'var(--primary)' : (currentStep > s.step ? '#10b981' : 'var(--text-muted)'),
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {currentStep > s.step ? <Check size={14} color="#10b981" /> : null}
              {s.label}
            </span>
          ))}
        </div>

        {/* Wizard Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          
          {parseError && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '18px'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{parseError}</span>
            </div>
          )}

          {/* STEP 1: SOURCE SELECTION */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                {/* Direct Paste Option */}
                <div
                  onClick={() => setSourceType('paste')}
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    border: sourceType === 'paste' ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                    background: sourceType === 'paste' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <Copy size={26} color="#818cf8" style={{ marginBottom: '8px' }} />
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Paste Responses</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>Copy-paste cells directly from Google Sheet</div>
                </div>

                {/* Excel Option */}
                <div
                  onClick={() => setSourceType('excel')}
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    border: sourceType === 'excel' ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                    background: sourceType === 'excel' ? 'rgba(37,99,235,0.08)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <FileSpreadsheet size={26} color="#10b981" style={{ marginBottom: '8px' }} />
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Excel File</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>Upload .xlsx or .xls spreadsheet</div>
                </div>

                {/* CSV Option */}
                <div
                  onClick={() => setSourceType('csv')}
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    border: sourceType === 'csv' ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                    background: sourceType === 'csv' ? 'rgba(37,99,235,0.08)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <FileSpreadsheet size={26} color="#0ea5e9" style={{ marginBottom: '8px' }} />
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>CSV File</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>Upload comma-separated values (.csv)</div>
                </div>

                {/* Google Sheet URL */}
                <div
                  onClick={() => setSourceType('google_sheet')}
                  style={{
                    padding: '16px',
                    borderRadius: '14px',
                    border: sourceType === 'google_sheet' ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                    background: sourceType === 'google_sheet' ? 'rgba(37,99,235,0.08)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <LinkIcon size={26} color="#f59e0b" style={{ marginBottom: '8px' }} />
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Google Sheet URL</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>Link via public sheet URL</div>
                </div>
              </div>

              {/* Source-specific Input Form */}
              {sourceType === 'paste' ? (
                <div style={{
                  padding: '20px',
                  borderRadius: '16px',
                  border: '1px solid var(--border-glass)',
                  background: 'rgba(255, 255, 255, 0.02)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Paste Google Sheet Rows:
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Tip: In Google Sheets, select rows including header and press Ctrl+C
                    </span>
                  </div>
                  <textarea
                    className="glass-input"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Timestamp&#9;Project Title&#9;Category&#9;Branch&#9;Batch&#9;Team Members&#9;Screenshot Drive Link&#9;Live Link&#9;GitHub...&#10;(Paste copied rows here - Ctrl+V)"
                    rows={7}
                    style={{
                      width: '100%',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      lineHeight: 1.4,
                      padding: '12px',
                      marginBottom: '14px',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      ⚡ Intelligent engine converts Google Drive image links and formats team members automatically.
                    </div>
                    <button
                      type="button"
                      onClick={handlePasteData}
                      className="btn btn-primary btn-shine"
                      style={{ padding: '9px 20px', borderRadius: '10px', gap: '8px', fontWeight: 700 }}
                    >
                      <ArrowRight size={14} /> Parse & Auto-Map Columns
                    </button>
                  </div>
                </div>
              ) : (sourceType === 'excel' || sourceType === 'csv') ? (
                <div style={{
                  padding: '36px 20px',
                  borderRadius: '16px',
                  border: '2px dashed var(--border-glass)',
                  background: 'rgba(255, 255, 255, 0.01)',
                  textAlign: 'center'
                }}>
                  <Upload size={36} color="var(--primary)" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Select {sourceType === 'excel' ? 'Excel Spreadsheet (.xlsx, .xls)' : 'CSV Document (.csv)'}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 16px' }}>
                    Data will be parsed locally in your browser. No files are uploaded to third-party servers.
                  </p>
                  <input
                    type="file"
                    id="project-import-file-input"
                    accept={sourceType === 'excel' ? '.xlsx,.xls' : '.csv'}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="project-import-file-input"
                    className="btn btn-primary btn-shine"
                    style={{ padding: '10px 24px', borderRadius: '10px', cursor: 'pointer', display: 'inline-flex' }}
                  >
                    {parsing ? 'Parsing...' : 'Browse Files on Device'}
                  </label>
                </div>
              ) : (
                <div style={{
                  padding: '24px',
                  borderRadius: '16px',
                  border: '1px solid var(--border-glass)',
                  background: 'rgba(255, 255, 255, 0.02)'
                }}>
                  <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Paste Google Sheet Shareable URL:
                  </label>
                  <input
                    type="url"
                    className="glass-input"
                    value={googleSheetUrl}
                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                    style={{ width: '100%', height: '44px', fontSize: '0.88rem', marginBottom: '10px' }}
                  />
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.4 }}>
                    Note: Ensure Google Sheet sharing is set to <strong>"Anyone with the link can view"</strong> so the public export endpoint can read the spreadsheet.
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchGoogleSheet}
                    className="btn btn-primary btn-shine"
                    style={{ padding: '10px 22px', borderRadius: '10px', gap: '8px' }}
                    disabled={parsing}
                  >
                    {parsing ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                    {parsing ? 'Connecting to Google Sheet...' : 'Load & Preview Sheet'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING & PREVIEW */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Map Spreadsheet Columns to Project Fields
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    We auto-matched common column names. Please review and adjust the mappings below.
                  </p>
                </div>
                <span className="badge badge-primary" style={{ padding: '6px 12px' }}>
                  {parsedRows.length} Rows Detected
                </span>
              </div>

              {/* Column Mapping Table */}
              <div style={{
                maxHeight: '260px',
                overflowY: 'auto',
                border: '1px solid var(--border-glass)',
                borderRadius: '12px',
                background: 'rgba(0, 0, 0, 0.2)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.04)', textAlign: 'left', borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '10px 14px' }}>Source Column (in Sheet)</th>
                      <th style={{ padding: '10px 14px' }}>Sample Value (Row 1)</th>
                      <th style={{ padding: '10px 14px' }}>Target Project Field</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedHeaders.map((header, idx) => {
                      const currentVal = columnMappings[idx] || 'ignore';
                      const sampleVal = parsedRows[0] && parsedRows[0][idx] !== undefined ? String(parsedRows[0][idx]).slice(0, 45) : '—';

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '8px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {header}
                          </td>
                          <td style={{ padding: '8px 14px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {sampleVal || '—'}
                          </td>
                          <td style={{ padding: '8px 14px' }}>
<select
                               className="glass-input glass-select"
                               value={currentVal}
                               onChange={(e) => setColumnMappings({ ...columnMappings, [idx]: e.target.value })}
                               style={{
                                 height: '36px',
                                 fontSize: '0.82rem',
                                 color: currentVal === 'ignore' ? 'var(--text-muted)' : 'var(--primary)',
                                 fontWeight: currentVal === 'ignore' ? 400 : 700
                               }}
                             >
                              {DB_TARGET_FIELDS.map(f => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Data Preview Table (First 5 rows) */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  First 5 Rows Preview:
                </label>
                <div style={{
                  overflowX: 'auto',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  background: 'rgba(0,0,0,0.2)'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-glass)' }}>
                        {parsedHeaders.map((h, i) => (
                          <th key={i} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 5).map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          {parsedHeaders.map((_, cIdx) => (
                            <td key={cIdx} style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>
                              {String(row[cIdx] || '—').slice(0, 30)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: VERIFY & DUPLICATES */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px'
              }}>
                <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{validationSummary.total}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Total Parsed Rows</div>
                </div>

                <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{validationSummary.valid}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Valid Rows Ready</div>
                </div>

                <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>{validationSummary.duplicates}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Duplicate Matches</div>
                </div>

                <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444' }}>{validationSummary.missingTitle}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Missing Title (Will Skip)</div>
                </div>
              </div>

              {/* Duplicate Handling Options */}
              <div style={{
                padding: '18px',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-glass)'
              }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Duplicate Identity Resolution:
                </label>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '14px', margin: 0 }}>
                  A project is considered a duplicate if it matches an existing project by <strong>same Title + same Branch + same Batch</strong>.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.84rem' }}>
                    <input
                      type="radio"
                      name="dup-res"
                      value="skip"
                      checked={duplicateResolution === 'skip'}
                      onChange={() => setDuplicateResolution('skip')}
                    />
                    <span><strong>Skip duplicates</strong> (Keep existing records intact, only import new records)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.84rem' }}>
                    <input
                      type="radio"
                      name="dup-res"
                      value="update"
                      checked={duplicateResolution === 'update'}
                      onChange={() => setDuplicateResolution('update')}
                    />
                    <span><strong>Update existing records</strong> (Overwrite fields with latest imported values)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.84rem' }}>
                    <input
                      type="radio"
                      name="dup-res"
                      value="insert"
                      checked={duplicateResolution === 'insert'}
                      onChange={() => setDuplicateResolution('insert')}
                    />
                    <span><strong>Import as new</strong> (Create duplicate entries alongside existing)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: RESULTS */}
          {currentStep === 4 && importResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px'
                }}>
                  <Check size={28} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Import Completed Successfully!
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Your spreadsheet records have been processed and stored in the database.
                </p>
              </div>

              {/* Stats Box */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '10px'
              }}>
                <div className="glass-panel" style={{ padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{importResult.total}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Rows</div>
                </div>
                <div className="glass-panel" style={{ padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10b981' }}>{importResult.imported}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Imported New</div>
                </div>
                <div className="glass-panel" style={{ padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#3b82f6' }}>{importResult.updated}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Updated</div>
                </div>
                <div className="glass-panel" style={{ padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b' }}>{importResult.skipped}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Skipped</div>
                </div>
                <div className="glass-panel" style={{ padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ef4444' }}>{importResult.failed}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Failed</div>
                </div>
              </div>

              {/* Errors List if any */}
              {importResult.errors && importResult.errors.length > 0 && (
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ef4444' }}>
                      {importResult.errors.length} Rows Could Not Be Imported:
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadFailedCsv}
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.74rem', gap: '4px' }}
                    >
                      <Download size={12} /> Download Error Log (.csv)
                    </button>
                  </div>
                  <div style={{ maxHeight: '120px', overflowY: 'auto', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    {importResult.errors.map((e, idx) => (
                      <div key={idx} style={{ padding: '3px 0' }}>
                        Row #{e.row}: {e.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          {currentStep === 1 && (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '9px 18px', borderRadius: '10px' }}
            >
              Cancel
            </button>
          )}

          {currentStep === 2 && (
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="btn btn-secondary"
              style={{ padding: '9px 16px', borderRadius: '10px', gap: '6px' }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}

          {currentStep === 3 && (
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="btn btn-secondary"
              style={{ padding: '9px 16px', borderRadius: '10px', gap: '6px' }}
              disabled={importing}
            >
              <ArrowLeft size={14} /> Back to Mapping
            </button>
          )}

          {currentStep === 4 && <div />}

          <div>
            {currentStep === 2 && (
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="btn btn-primary btn-shine"
                style={{ padding: '9px 22px', borderRadius: '10px', gap: '6px', fontWeight: 700 }}
              >
                Continue to Verification <ArrowRight size={14} />
              </button>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                onClick={handleExecuteImport}
                className="btn btn-primary btn-shine"
                style={{ padding: '9px 24px', borderRadius: '10px', gap: '6px', fontWeight: 700 }}
                disabled={importing || validationSummary.valid === 0}
              >
                {importing ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                {importing ? 'Importing Projects...' : `Import ${validationSummary.valid} Projects`}
              </button>
            )}

            {currentStep === 4 && (
              <button
                type="button"
                onClick={onClose}
                className="btn btn-primary btn-shine"
                style={{ padding: '9px 24px', borderRadius: '10px', fontWeight: 700 }}
              >
                Done & View Projects
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
