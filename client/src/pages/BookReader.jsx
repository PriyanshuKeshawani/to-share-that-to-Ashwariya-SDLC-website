import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth, BASE_URL } from '../context/AuthContext';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Download,
  StickyNote,
  Plus,
  Trash2,
  Copy,
  Check,
  Search,
  Sparkles,
  ExternalLink,
  X,
  FileDown,
  Lock
} from 'lucide-react';

const TAG_COLORS = {
  Concept: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' },
  'Exam Imp': { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' },
  Formula: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' },
  Summary: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' },
  General: { bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.3)' }
};

const BookReader = ({ book, onClose }) => {
  const { apiCall, user, extractDriveFileId } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);

  // Determine source: Drive (preferred) > PDF URL > Mock
  const driveEmbed = (() => {
    if (book.drive_link) {
      const { embed } = extractDriveFileId(book.drive_link);
      return embed;
    }
    if (book.drive_file_id) {
      return `https://drive.google.com/file/d/${book.drive_file_id}/preview`;
    }
    return null;
  })();

  const pdfSource = (() => {
    if (!book.pdf_url) return null;
    if (book.pdf_url.startsWith('/uploads/')) return `${BASE_URL}${book.pdf_url}`;
    if (book.pdf_url.startsWith('http') || book.pdf_url.startsWith('data:')) return book.pdf_url;
    return null;
  })();

  const isUploaded = Boolean(driveEmbed || pdfSource);
  const [totalPages] = useState(isUploaded ? 9999 : 60);
  const [saving, setSaving] = useState(false);

  // Strictly enforce permission access for non-home branch books
  const hasAccess = useMemo(() => {
    if (!book) return false;
    if (user?.role === 'admin') return true;
    if (book.hasAccess !== undefined) return Boolean(book.hasAccess);

    const userBranch = (user?.branchName || user?.branch_name || '').trim().toLowerCase();
    const bookBranch = (book.branch_name || book.branch?.name || '').trim().toLowerCase();
    if (userBranch && bookBranch && userBranch === bookBranch) return true;
    return false;
  }, [book, user]);

  // Notes state
  const storageKey = `sistec_reader_notes_${book.id}`;
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showNotes, setShowNotes] = useState(true);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteTag, setNewNoteTag] = useState('Concept');
  const [noteSearch, setNoteSearch] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('All');
  const [copiedNoteId, setCopiedNoteId] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (book) {
      document.title = `Reading: ${book.title} - SISTEC Library`;
    }
  }, [book]);

  // Persist notes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notes));
    } catch (e) {
      console.warn('Failed to persist notes to localStorage:', e);
    }
  }, [notes, storageKey]);

  // Restore saved reading position from analytics history
  useEffect(() => {
    const initReader = async () => {
      let restoredPage = 1;
      try {
        const history = await apiCall('/analytics/my-history');
        const record = history?.find(h => h.book_title === book.title);
        if (record && record.last_page_read) {
          restoredPage = record.last_page_read;
          setCurrentPage(restoredPage);
        }
      } catch (err) {
        console.error('Error fetching book progress:', err);
      }

      try {
        await apiCall('/analytics/track', {
          method: 'POST',
          body: JSON.stringify({
            book_id: book.id,
            action_type: 'view',
            last_page_read: restoredPage,
            details: `Opened "${book.title}" — resumed from page ${restoredPage}`
          })
        });
      } catch (err) {
        console.error('Error tracking initial view:', err);
      }
    };

    initReader();
  }, [book.id, book.title, apiCall]);

  // Debounce timer ref — prevents flooding API on rapid page changes
  const saveDebounceRef = useRef(null);

  // Update backend reading progress (debounced: waits 1.5s after last change)
  const saveProgress = useCallback((page) => {
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        await apiCall('/analytics/track', {
          method: 'POST',
          body: JSON.stringify({
            book_id: book.id,
            action_type: 'view',
            last_page_read: page,
            details: `Reading "${book.title}" — page ${page}`
          })
        });
      } catch (err) {
        console.error('Error auto-saving page progress:', err);
      } finally {
        setSaving(false);
      }
    }, 1500);
  }, [apiCall, book.id, book.title]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      saveProgress(newPage);
    }
  };

  // Notes actions
  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const newNote = {
      id: Date.now().toString(),
      page: currentPage,
      text: newNoteText.trim(),
      tag: newNoteTag,
      createdAt: new Date().toISOString()
    };

    setNotes(prev => [newNote, ...prev]);
    setNewNoteText('');
  };

  const handleDeleteNote = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const handleCopyNote = (note) => {
    navigator.clipboard.writeText(`[Page ${note.page} - ${note.tag}]\n${note.text}`);
    setCopiedNoteId(note.id);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  const handleExportNotes = () => {
    if (notes.length === 0) return;
    const dateStr = new Date().toLocaleDateString('en-IN', { dateStyle: 'full' });
    let content = `# Study Notes: ${book.title}\n`;
    content += `**Author:** ${book.author}\n`;
    content += `**Exported On:** ${dateStr}\n`;
    content += `**Total Notes:** ${notes.length}\n`;
    content += `====================================================\n\n`;

    // Group notes by page ascending
    const sorted = [...notes].sort((a, b) => a.page - b.page);
    sorted.forEach((n, idx) => {
      const tagStr = n.tag.toUpperCase();
      content += `### Note #${idx + 1} | Page ${n.page} [${tagStr}]\n`;
      content += `_${new Date(n.createdAt).toLocaleString()}_\n\n`;
      content += `${n.text}\n\n`;
      content += `----------------------------------------------------\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = (book.title || 'book').toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.download = `Notes_${safeTitle}_SISTec.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Robust Direct PDF Download
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const safeTitle = (book.title || 'document').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const filename = `${safeTitle}.pdf`;

      if (book.pdf_url && book.pdf_url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = book.pdf_url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (book.pdf_url && (book.pdf_url.startsWith('http') || book.pdf_url.startsWith('/uploads/'))) {
        const fullUrl = book.pdf_url.startsWith('http') ? book.pdf_url : `${BASE_URL}${book.pdf_url}`;
        try {
          const resp = await fetch(fullUrl);
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch {
          window.open(fullUrl, '_blank');
        }
      } else {
        const blob = new Blob([`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF`], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (e) {
      console.error('Download error:', e);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Filtered notes
  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const matchTag = selectedTagFilter === 'All' || note.tag === selectedTagFilter;
      const matchSearch = !noteSearch ||
        note.text.toLowerCase().includes(noteSearch.toLowerCase()) ||
        String(note.page).includes(noteSearch);
      return matchTag && matchSearch;
    });
  }, [notes, selectedTagFilter, noteSearch]);

  // Mock content generation based on page number
  const getPageContent = (page) => {
    const chapters = [
      { title: 'Chapter 1: Foundational Engineering Concepts', text: 'This section details the primary elements of the subject. In early stages, researchers discovered that simple systems combined with robust structures yield high performance. Understanding these elements is critical for advanced application design. We examine foundational schemas, verify core invariants, and review peer-reviewed frameworks in this discipline.' },
      { title: 'Chapter 2: Computational Logic & Methodologies', text: 'Methodological approaches define how we execute research and solve complex engineering equations. In this chapter, we establish the standard algorithm structure, analyze resource allocation tables, and diagram workflows. We cover validation techniques and detail sample parameters used to execute test suites under simulated stress.' },
      { title: 'Chapter 3: Deep System Architecture & Scalability', text: 'Architectural blueprints serve as the backbone of high-capacity institutional systems. Here, we outline multi-tier pipelines, highlight fail-safe protocols, and explore load distribution logic. Reviewing these layouts helps students design solutions that scale across both local servers and distributed cloud platforms.' },
      { title: 'Chapter 4: Implementation, Testing & Verification', text: 'Transitioning from theoretical designs to concrete code requires robust verification. We implement components, run unit checkers, and analyze the resulting dataset. Automated benchmarks confirm that prioritizing core structures improves responsiveness and decreases memory footprint.' }
    ];

    const chapterIndex = Math.floor((page - 1) / 15) % chapters.length;
    const currentChapter = chapters[chapterIndex];

    return (
      <div style={{ padding: '20px 0' }}>
        <h4 style={{ color: 'var(--secondary, #38bdf8)', marginBottom: '16px', fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {currentChapter.title}
        </h4>
        <p style={{ fontSize: '1.05rem', lineHeight: '1.8', color: 'var(--text-primary)', textAlign: 'justify', marginBottom: '20px' }}>
          <strong>[Page {page}]</strong> {currentChapter.text}
        </p>
        <p style={{ fontSize: '1.05rem', lineHeight: '1.8', color: 'var(--text-secondary)', textAlign: 'justify' }}>
          Continuing our analysis of these schemas, we observe that the relative efficiency is dependent on standard deviations of node clusters. Students should always account for network latency, memory limits, and data synchronization constraints before committing to a final production framework.
        </p>
      </div>
    );
  };

  const fileUrl = driveEmbed || pdfSource;
  const openInNewTabUrl = book.drive_link || (book.drive_file_id ? `https://drive.google.com/file/d/${book.drive_file_id}/view` : null) || pdfSource;

  return (
    <div className="animate-fade-in" style={{
      maxWidth: '1440px',
      margin: '0 auto',
      minHeight: '92vh',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      padding: '0 8px'
    }}>
      {/* Access Denied Guard for Non-Home Branch Books */}
      {!hasAccess ? (
        <div className="animate-fade-in" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '75vh',
          padding: '30px 20px',
          textAlign: 'center'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '500px',
            width: '100%',
            padding: '36px 28px',
            borderRadius: '20px',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            background: 'var(--bg-surface)',
            boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)'
            }}>
              <Lock size={32} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Reading Permission Required
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
              <strong>"{book.title}"</strong> is part of the <strong>{book.branch_name || 'different department'}</strong> catalog.
              As per institutional library policy, you must request permission from the Central Library Administrator to access books outside your registered branch.
            </p>
            <button
              onClick={onClose}
              className="btn btn-primary btn-shine"
              style={{ width: '100%', padding: '10px 18px', fontSize: '0.9rem', justifyContent: 'center' }}
            >
              <ArrowLeft size={16} /> Return to Catalog & Request Access
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Top Controls Header Bar */}
      <div className="glass-panel reader-header" style={{
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        {/* Left: Back button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem', gap: '6px' }}
          >
            <ArrowLeft size={16} /> Close
          </button>
          <span className="badge badge-primary" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
            {book.branch_name || 'Engineering'}
          </span>
        </div>

        {/* Center: Title and Author */}
        <div style={{ textAlign: 'center', minWidth: '220px', flex: '1 1 auto' }}>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 2px', color: 'var(--text-primary)' }}>
            {book.title}
          </h4>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            By {book.author} {book.priority && `• ${book.priority.toUpperCase()} Book`}
          </span>
        </div>

        {/* Right: Actions (Bookmark, Download PDF, Toggle Notes) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Bookmark page input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Bookmark size={15} color="var(--primary, #3b82f6)" />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Page:</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) {
                  setCurrentPage(val);
                  saveProgress(val);
                }
              }}
              className="glass-input"
              style={{ width: '56px', padding: '4px 6px', textAlign: 'center', fontSize: '0.85rem' }}
              title="Current reading page"
            />
          </div>

          {/* Quick Download PDF button */}
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.82rem', gap: '6px' }}
            title="Download PDF Document"
          >
            <Download size={15} />
            <span className="hide-mobile">{downloadingPdf ? 'Saving...' : 'PDF'}</span>
          </button>

          {/* Toggle Study Notes Panel */}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`btn ${showNotes ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 14px', fontSize: '0.82rem', gap: '6px' }}
            title="Toggle In-Built Study Notes"
          >
            <StickyNote size={15} />
            <span>Study Notes</span>
            {notes.length > 0 && (
              <span style={{
                background: showNotes ? 'rgba(255,255,255,0.25)' : 'var(--primary)',
                color: '#fff',
                fontSize: '0.7rem',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 700
              }}>
                {notes.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace Body: PDF Viewer on Left + Notes Drawer on Right */}
      <div className="reader-layout" style={{
        display: 'flex',
        gap: '16px',
        flex: 1,
        minHeight: '75vh',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* ===================== LEFT: PDF VIEWER / READER ===================== */}
        <div
          className="reader-pdf-container"
          style={{
            flex: showNotes ? '1 1 68%' : '1 1 100%',
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            minWidth: 0
          }}
        >
          {isUploaded ? (
            <div className="glass-panel" style={{
              flex: 1,
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: '#0b0f19',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)'
            }}>
              {/* Mobile Fallback & Open In Tab Banner */}
              <div style={{
                padding: '10px 16px',
                background: 'rgba(59, 130, 246, 0.08)',
                borderBottom: '1px solid rgba(59, 130, 246, 0.15)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color="var(--primary)" />
                  {driveEmbed ? `Google Drive • ${book.title}` : `In-Built Digital PDF Viewer • ${book.title}`}
                </span>
                <a
                  href={openInNewTabUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--primary, #3b82f6)',
                    textDecoration: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 500
                  }}
                >
                  <ExternalLink size={13} /> Open in New Tab
                </a>
              </div>

              {/* PDF Embed / Iframe */}
              <iframe
                src={fileUrl}
                width="100%"
                height="100%"
                style={{
                  border: 'none',
                  flex: 1,
                  minHeight: '68vh',
                  background: '#1e293b'
                }}
                title={book.title}
              />
            </div>
          ) : (
            /* Mock Document Book Reader */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
              <div className="glass-panel" style={{
                padding: '36px 40px',
                flex: 1,
                borderRadius: '16px',
                background: 'rgba(11, 15, 25, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                {getPageContent(currentPage)}
              </div>

              {/* Navigation Footer for Mock Reader */}
              <div className="glass-panel" style={{
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: '14px',
                gap: '14px'
              }}>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || saving}
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '0.82rem', opacity: currentPage === 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={16} /> Prev Page
                </button>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{
                    height: '5px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${(currentPage / totalPages) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--primary, #3b82f6), var(--secondary, #38bdf8))',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span>Progress: {Math.round((currentPage / totalPages) * 100)}%</span>
                    <span>Page {currentPage} of {totalPages}</span>
                  </div>
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || saving}
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '0.82rem', opacity: currentPage === totalPages ? 0.4 : 1 }}
                >
                  Next Page <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ===================== RIGHT: IN-BUILT STUDY NOTES WORKSPACE ===================== */}
        {showNotes && (
          <div
            className="glass-panel animate-fade-in reader-notes-container"
            style={{
              flex: '0 0 340px',
              width: '340px',
              borderRadius: '16px',
              border: '1px solid var(--border-glass)',
              background: 'var(--bg-surface)',
              boxShadow: 'var(--shadow-glass)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Notes Panel Header */}
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StickyNote size={17} color="var(--primary, #3b82f6)" />
                <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Study Notes
                </h5>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  fontWeight: 600
                }}>
                  {notes.length}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {notes.length > 0 && (
                  <button
                    onClick={handleExportNotes}
                    className="btn btn-secondary"
                    style={{ padding: '5px 8px', fontSize: '0.72rem', gap: '4px' }}
                    title="Export notes as Markdown study sheet"
                  >
                    <FileDown size={13} /> Export
                  </button>
                )}
                <button
                  onClick={() => setShowNotes(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title="Close notes panel"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Note Creation Form */}
            <form onSubmit={handleAddNote} style={{
              padding: '14px 18px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {/* Tag selector pills */}
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {Object.keys(TAG_COLORS).map(tag => {
                  const style = TAG_COLORS[tag];
                  const active = newNoteTag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setNewNoteTag(tag)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.7rem',
                        borderRadius: '6px',
                        border: `1px solid ${active ? style.text : 'rgba(255,255,255,0.08)'}`,
                        background: active ? style.bg : 'transparent',
                        color: active ? style.text : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontWeight: active ? 600 : 400,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              {/* Note Textarea */}
              <div style={{ position: 'relative' }}>
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder={`Write note for Page ${currentPage}... (key formula, summary, exam pointer)`}
                  rows={3}
                  className="glass-input"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '0.82rem',
                    resize: 'none',
                    lineHeight: '1.4'
                  }}
                />
              </div>

              {/* Submit Note Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  📌 Tagged to <strong>Page {currentPage}</strong>
                </span>
                <button
                  type="submit"
                  disabled={!newNoteText.trim()}
                  className="btn btn-primary"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    gap: '5px',
                    opacity: newNoteText.trim() ? 1 : 0.5
                  }}
                >
                  <Plus size={14} /> Add Note
                </button>
              </div>
            </form>

            {/* Filter & Search Bar */}
            <div style={{
              padding: '10px 18px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search notes or page..."
                  value={noteSearch}
                  onChange={(e) => setNoteSearch(e.target.value)}
                  className="glass-input"
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    fontSize: '0.76rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
                {['All', ...Object.keys(TAG_COLORS)].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTagFilter(t)}
                    style={{
                      padding: '2px 7px',
                      fontSize: '0.68rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: selectedTagFilter === t ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                      color: selectedTagFilter === t ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes List Scroll Area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {filteredNotes.length === 0 ? (
                <div style={{
                  padding: '30px 16px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem'
                }}>
                  <StickyNote size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                  <p style={{ margin: '0 0 4px' }}>No notes found</p>
                  <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>
                    Add key concepts and formulas to revise anytime!
                  </span>
                </div>
              ) : (
                filteredNotes.map(note => {
                  const tagStyle = TAG_COLORS[note.tag] || TAG_COLORS.General;
                  return (
                    <div
                      key={note.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Note Header: Page, Tag, and Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handlePageChange(note.page)}
                            title={`Jump to Page ${note.page}`}
                            style={{
                              background: 'rgba(59, 130, 246, 0.12)',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              color: '#60a5fa',
                              fontSize: '0.68rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            Pg {note.page}
                          </button>
                          <span style={{
                            fontSize: '0.66rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: tagStyle.bg,
                            color: tagStyle.text,
                            border: `1px solid ${tagStyle.border}`,
                            fontWeight: 600
                          }}>
                            {note.tag}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleCopyNote(note)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedNoteId === note.id ? '#34d399' : 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '3px'
                            }}
                            title="Copy note"
                          >
                            {copiedNoteId === note.id ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '3px'
                            }}
                            title="Delete note"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Note Text */}
                      <p style={{
                        margin: 0,
                        fontSize: '0.82rem',
                        color: 'var(--text-primary)',
                        lineHeight: '1.45',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {note.text}
                      </p>

                      {/* Note Footer: Time */}
                      <span style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-muted)',
                        alignSelf: 'flex-end'
                      }}>
                        {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

export default BookReader;
