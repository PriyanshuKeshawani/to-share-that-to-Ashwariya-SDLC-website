import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth, BASE_URL, isSameBranch } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import * as pdfjsLib from 'pdfjs-dist';
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
  ExternalLink,
  X,
  FileDown,
  Lock,
  Clock,
  BookOpen,
  Book,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Layers,
  Sparkles,
  Sun,
  Moon
} from 'lucide-react';

// Configure PDF.js worker reliably for both dev and production build
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
}

const TAG_COLORS = {
  Concept: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' },
  'Exam Imp': { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' },
  Formula: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' },
  Summary: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' },
  General: { bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.3)' }
};

const BookReader = ({ book, onClose }) => {
  const { apiCall, user, extractDriveFileId } = useAuth();
  const { mode, toggleMode } = useTheme();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(book?.total_pages && book.total_pages > 0 ? book.total_pages : 100);
  const [scale, setScale] = useState(1.15);
  const [viewMode, setViewMode] = useState('single'); // 'single' (focused) or 'spread' (open 2-page book)
  const [useNativeViewer, setUseNativeViewer] = useState(false);
  const [isFlipping, setIsFlipping] = useState(null); // 'next' | 'prev' | null
  const [saving, setSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const readerContainerRef = useRef(null);

  // Mobile viewport reactive detection
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  // Fullscreen Handler
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (readerContainerRef.current?.requestFullscreen) {
          await readerContainerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen request notice:', err);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Auto-adapt to 1-Page and compute responsive state on mobile viewports (< 768px)
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setViewMode('single');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Touchscreen swipe support for mobile
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);

  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null || !e.changedTouches || e.changedTouches.length === 0) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      const step = viewMode === 'spread' ? 2 : 1;
      if (deltaX < 0) {
        if (currentPage < totalPages) {
          handlePageChange(currentPage + step, 'next');
        }
      } else {
        if (currentPage > 1) {
          handlePageChange(currentPage - step, 'prev');
        }
      }
    }
  };

  // PDF.js State
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState(null);

  // Canvases refs
  const canvasLeftRef = useRef(null);
  const canvasRightRef = useRef(null);
  const activeRenderTasks = useRef({});

  // Slide-over drawer state (showNotes closed by default for distraction-free reading!)
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState('notes'); // 'notes' | 'bookmarks'
  const [notes, setNotes] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [loadingBookmarks, setLoadingBookmarks] = useState(true);

  // Note form state
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteTag, setNewNoteTag] = useState('Concept');
  const [noteSearch, setNoteSearch] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('All');
  const [copiedNoteId, setCopiedNoteId] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Permission access enforcement
  const hasAccess = useMemo(() => {
    if (!book) return false;
    if (user?.role === 'admin') return true;

    const userBranch = (user?.branchName || user?.branch_name || '').trim();
    const bookBranch = (book.branch_name || book.branch?.name || '').trim();

    if (isSameBranch(userBranch, bookBranch) || book.isHomeBranch) return true;
    if (book.hasAccess !== undefined) return Boolean(book.hasAccess);
    return false;
  }, [book, user]);

  const [requestingAccess, setRequestingAccess] = useState(false);
  const [requestedDone, setRequestedDone] = useState(false);

  const handleDirectRequest = async () => {
    try {
      setRequestingAccess(true);
      await apiCall('/permissions/request', {
        method: 'POST',
        body: JSON.stringify({
          book_id: book.id,
          book_title: book.title,
          branch_id: book.branch_id,
          branch_name: book.branch_name || book.branch?.name || ''
        })
      });
      setRequestedDone(true);
    } catch (err) {
      alert(err.message || 'Failed to submit permission request');
    } finally {
      setRequestingAccess(false);
    }
  };

  // Determine external drive embed or direct PDF source
  const driveEmbed = useMemo(() => {
    if (book.drive_link) {
      const { embed } = extractDriveFileId(book.drive_link);
      return embed;
    }
    if (book.drive_file_id) {
      return `https://drive.google.com/file/d/${book.drive_file_id}/preview`;
    }
    return null;
  }, [book, extractDriveFileId]);

  const pdfSource = useMemo(() => {
    if (!book.pdf_url) return null;
    if (book.pdf_url.startsWith('/uploads/')) return `${BASE_URL}${book.pdf_url}`;
    if (book.pdf_url.startsWith('http') || book.pdf_url.startsWith('data:')) return book.pdf_url;
    return null;
  }, [book.pdf_url]);

  const openInNewTabUrl = book.drive_link || (book.drive_file_id ? `https://drive.google.com/file/d/${book.drive_file_id}/view` : null) || pdfSource;

  // Title tag
  useEffect(() => {
    if (book) {
      document.title = `Reading: ${book.title} - SISTec Digital Library`;
    }
  }, [book]);

  // Load Cloud DB Notes & Bookmarks on mount
  useEffect(() => {
    const loadCloudData = async () => {
      if (!book?.id) return;
      try {
        setLoadingNotes(true);
        const notesData = await apiCall(`/books/${book.id}/notes`);
        if (Array.isArray(notesData)) {
          setNotes(notesData);
        }
      } catch (err) {
        console.warn('Notice loading notes from cloud database:', err);
      } finally {
        setLoadingNotes(false);
      }

      try {
        setLoadingBookmarks(true);
        const bookmarksData = await apiCall(`/books/${book.id}/bookmarks`);
        if (Array.isArray(bookmarksData)) {
          setBookmarks(bookmarksData);
        }
      } catch (err) {
        console.warn('Notice loading bookmarks from cloud database:', err);
      } finally {
        setLoadingBookmarks(false);
      }
    };

    loadCloudData();
  }, [book?.id, apiCall]);

  // Restore saved reading position from analytics history on mount
  useEffect(() => {
    const initReader = async () => {
      let restoredPage = 1;
      try {
        const history = await apiCall('/analytics/my-history');
        const record = history?.find(h => Number(h.book_id) === Number(book.id) || h.book_title === book.title);
        if (record && record.last_page_read) {
          restoredPage = Math.max(1, Math.min(record.last_page_read, totalPages));
          setCurrentPage(restoredPage);
        }
      } catch (err) {
        console.error('Error restoring book reading position:', err);
      }

      try {
        await apiCall('/analytics/track', {
          method: 'POST',
          body: JSON.stringify({
            book_id: book.id,
            action_type: 'view',
            last_page_read: restoredPage,
            total_pages: totalPages,
            details: `Opened "${book.title}" — resumed at page ${restoredPage} of ${totalPages}`
          })
        });
      } catch (err) {
        console.error('Error tracking initial view:', err);
      }
    };

    initReader();
  }, [book.id, book.title, apiCall, totalPages]);

  // Debounced real-time progress updater
  const saveDebounceRef = useRef(null);
  const saveProgress = useCallback((page) => {
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    setSaving(true);
    saveDebounceRef.current = setTimeout(async () => {
      try {
        await apiCall('/analytics/track', {
          method: 'POST',
          body: JSON.stringify({
            book_id: book.id,
            action_type: 'view',
            last_page_read: page,
            total_pages: totalPages,
            details: `Reading "${book.title}" — page ${page} of ${totalPages}`
          })
        });
      } catch (err) {
        console.error('Error auto-saving page progress:', err);
      } finally {
        setSaving(false);
      }
    }, 350);
  }, [apiCall, book.id, book.title, totalPages]);

  // Load PDF document into memory via PDF.js
  useEffect(() => {
    if (!pdfSource || useNativeViewer) return;

    let isMounted = true;
    setPdfLoading(true);
    setPdfLoadError(null);

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: pdfSource,
          withCredentials: false
        });
        const doc = await loadingTask.promise;
        if (!isMounted) return;

        setPdfDoc(doc);
        if (doc.numPages && doc.numPages > 0) {
          setTotalPages(doc.numPages);
        }
      } catch (err) {
        console.warn('PDF.js loading notice (switching to graceful fallback if needed):', err);
        if (isMounted) {
          setPdfLoadError(err.message || 'Failed to render PDF in book engine');
        }
      } finally {
        if (isMounted) setPdfLoading(false);
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
    };
  }, [pdfSource, useNativeViewer]);

  // Function to render a page cleanly to a target canvas
  const renderPage = useCallback(async (pageNum, canvasKey, canvasElement) => {
    if (!pdfDoc || !canvasElement || pageNum < 1 || pageNum > pdfDoc.numPages) return;

    // Cancel existing render on this canvas if any
    if (activeRenderTasks.current[canvasKey]) {
      try {
        activeRenderTasks.current[canvasKey].cancel();
      } catch {}
      delete activeRenderTasks.current[canvasKey];
    }

    try {
      const page = await pdfDoc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      let effectiveScale = scale;
      const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;

      if (isMobileView) {
        // Fit cleanly within mobile viewport with comfortable padding (zero horizontal spill!)
        const availableW = Math.max(260, window.innerWidth - 20);
        const availableH = Math.max(360, (window.innerHeight || 640) - 125);
        const scaleX = availableW / unscaledViewport.width;
        const scaleY = availableH / unscaledViewport.height;
        effectiveScale = Math.min(scaleX, scaleY);
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: effectiveScale * dpr });

      canvasElement.width = viewport.width;
      canvasElement.height = viewport.height;
      const cssWidth = Math.round(viewport.width / dpr);
      const cssHeight = Math.round(viewport.height / dpr);
      canvasElement.style.width = isMobileView ? '100%' : `${cssWidth}px`;
      canvasElement.style.height = isMobileView ? 'auto' : `${cssHeight}px`;

      const ctx = canvasElement.getContext('2d');
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      const renderTask = page.render({
        canvasContext: ctx,
        viewport: viewport
      });

      activeRenderTasks.current[canvasKey] = renderTask;
      await renderTask.promise;
      delete activeRenderTasks.current[canvasKey];
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') {
        console.warn(`Render notice on page ${pageNum}:`, err);
      }
    }
  }, [pdfDoc, scale]);

  // Re-render canvases when currentPage, scale, viewMode, or mobile breakpoint changes
  useEffect(() => {
    if (!pdfDoc) return;

    if (canvasLeftRef.current) {
      renderPage(currentPage, 'left', canvasLeftRef.current);
    }

    if (viewMode === 'spread' && !isMobile && canvasRightRef.current && currentPage + 1 <= pdfDoc.numPages) {
      renderPage(currentPage + 1, 'right', canvasRightRef.current);
    }
  }, [pdfDoc, currentPage, scale, viewMode, isMobile, renderPage]);

  // Page Flip Navigation
  const handlePageChange = useCallback((targetPage, direction = null) => {
    const pageNum = Math.max(1, Math.min(targetPage, totalPages));
    if (pageNum === currentPage) return;

    const dir = direction || (pageNum > currentPage ? 'next' : 'prev');
    setIsFlipping(dir);

    setTimeout(() => {
      setCurrentPage(pageNum);
      saveProgress(pageNum);
    }, 180);

    setTimeout(() => {
      setIsFlipping(null);
    }, 450);
  }, [currentPage, totalPages, saveProgress, playPageFlipSound]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
      const step = viewMode === 'spread' ? 2 : 1;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        handlePageChange(currentPage + step, 'next');
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePageChange(currentPage - step, 'prev');
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, viewMode, handlePageChange, toggleFullscreen]);

  // Check if active page is bookmarked
  const isCurrentPageBookmarked = useMemo(() => {
    return bookmarks.some(b => Number(b.page) === currentPage);
  }, [bookmarks, currentPage]);

  // Toggle bookmark in Supabase Database
  const handleToggleBookmark = async (targetPage = currentPage) => {
    const pageNum = Number(targetPage);
    const exists = bookmarks.some(b => Number(b.page) === pageNum);
    let updated;
    if (exists) {
      updated = bookmarks.filter(b => Number(b.page) !== pageNum);
    } else {
      const newBm = {
        id: Date.now().toString(),
        page: pageNum,
        title: `Page ${pageNum}`,
        createdAt: new Date().toISOString()
      };
      updated = [...bookmarks, newBm].sort((a, b) => a.page - b.page);
    }
    setBookmarks(updated);

    try {
      const res = await apiCall(`/books/${book.id}/bookmarks`, {
        method: 'POST',
        body: JSON.stringify({ page: pageNum, title: `Page ${pageNum}`, book_title: book.title })
      });
      if (Array.isArray(res)) setBookmarks(res);
    } catch (err) {
      console.error('Error syncing bookmark to cloud DB:', err);
    }
  };

  // Add study note to Supabase Database
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const payload = {
      page: currentPage,
      text: newNoteText.trim(),
      tag: newNoteTag,
      book_title: book.title
    };

    const tempId = Date.now().toString();
    const newNote = { id: tempId, ...payload, createdAt: new Date().toISOString() };
    setNotes(prev => [newNote, ...prev]);
    setNewNoteText('');

    try {
      const res = await apiCall(`/books/${book.id}/notes`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (Array.isArray(res)) setNotes(res);
    } catch (err) {
      console.error('Error saving note to cloud DB:', err);
    }
  };

  // Delete study note from Supabase Database
  const handleDeleteNote = async (noteId) => {
    setNotes(prev => prev.filter(n => n.id !== noteId));
    try {
      await apiCall(`/books/${book.id}/notes/${noteId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error deleting note from DB:', err);
    }
  };

  const handleCopyNote = (note) => {
    navigator.clipboard.writeText(`[Page ${note.page} - ${note.tag}]\n${note.text}`);
    setCopiedNoteId(note.id);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  // Export all notes as Markdown study sheet
  const handleExportNotes = () => {
    if (notes.length === 0) return;
    const dateStr = new Date().toLocaleDateString('en-IN', { dateStyle: 'full' });
    let content = `# Study Notes: ${book.title}\n`;
    content += `**Author:** ${book.author}\n`;
    content += `**Exported On:** ${dateStr}\n`;
    content += `**Total Notes:** ${notes.length}\n`;
    content += `====================================================\n\n`;

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

  // Direct PDF Download
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
      } else if (book.pdf_url) {
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
      }
    } catch (e) {
      console.error('Download error:', e);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Filtered study notes
  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const matchTag = selectedTagFilter === 'All' || note.tag === selectedTagFilter;
      const matchSearch = !noteSearch ||
        note.text.toLowerCase().includes(noteSearch.toLowerCase()) ||
        String(note.page).includes(noteSearch);
      return matchTag && matchSearch;
    });
  }, [notes, selectedTagFilter, noteSearch]);

  return (
    <div
      ref={readerContainerRef}
      className={`book-reader-container animate-fade-in ${isFullscreen ? 'reader-fullscreen' : ''}`}
    >
      {/* Access Denied Guard for Non-Home Branch Books */}
      {!hasAccess ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '75vh',
          padding: '30px 20px',
          textAlign: 'center'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '480px',
            width: '100%',
            padding: '36px 28px',
            borderRadius: '20px',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            background: 'var(--bg-surface)'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '18px',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Lock size={30} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Reading Permission Required
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
              <strong>"{book.title}"</strong> is part of the <strong>{book.branch_name || 'different department'}</strong> catalog.
              Please request permission from the Central Library Administrator to access books outside your registered department.
            </p>

            {requestedDone ? (
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#fbbf24',
                fontSize: '0.84rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '14px'
              }}>
                <Clock size={16} /> Request Submitted! Waiting for Admin Approval.
              </div>
            ) : (
              <button
                onClick={handleDirectRequest}
                disabled={requestingAccess}
                className="btn btn-primary btn-shine"
                style={{ width: '100%', padding: '11px 18px', fontSize: '0.9rem', justifyContent: 'center', marginBottom: '10px' }}
              >
                <Lock size={16} /> {requestingAccess ? 'Submitting Request...' : 'Request Access from Admin'}
              </button>
            )}

            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '10px 18px', fontSize: '0.86rem', justifyContent: 'center' }}
            >
              <ArrowLeft size={16} /> Return to Catalog
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════
              RESPONSIVE CONTROLS: MOBILE COMPACT HEADER VS DESKTOP BAR
              ══════════════════════════════════════════════════════════ */}
          {isMobile ? (
            <div className="reader-mobile-header">
              <button
                onClick={onClose}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.78rem', gap: '4px' }}
                title="Close Reader"
              >
                <ArrowLeft size={14} /> Back
              </button>

              <div style={{
                flex: 1,
                textAlign: 'center',
                padding: '0 8px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                <div style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {book.title}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Page {currentPage} of {totalPages}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={toggleMode}
                  className="btn btn-secondary"
                  style={{ padding: '6px 8px', fontSize: '0.78rem' }}
                  title={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {mode === 'dark' ? <Sun size={14} color="#fbbf24" /> : <Moon size={14} color="var(--primary)" />}
                </button>

                <button
                  onClick={() => setShowDrawer(prev => !prev)}
                  className={`btn ${showDrawer ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 8px', fontSize: '0.78rem', position: 'relative' }}
                  title="Notes & Bookmarks"
                >
                  <StickyNote size={14} />
                  {(notes.length > 0 || bookmarks.length > 0) && (
                    <span style={{
                      position: 'absolute',
                      top: '-3px',
                      right: '-3px',
                      background: 'var(--primary)',
                      color: '#fff',
                      fontSize: '0.58rem',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {notes.length + bookmarks.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={toggleFullscreen}
                  className="btn btn-secondary"
                  style={{ padding: '6px 8px', fontSize: '0.78rem' }}
                  title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
                >
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </div>
            </div>
          ) : (
            <div className="reader-minimal-bar">
              {/* Left: Back & Branch */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={onClose}
                  className="btn btn-secondary"
                  style={{ padding: '7px 12px', fontSize: '0.82rem', gap: '6px' }}
                  title="Close Reader"
                >
                  <ArrowLeft size={15} /> Close
                </button>
                <span className="badge badge-primary hide-mobile" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                  {book.branch_name || 'Engineering'}
                </span>
              </div>

              {/* Center: Book Title & Active Page Navigator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 auto', justifyContent: 'center' }}>
                <div className="hide-mobile" style={{ textAlign: 'right', maxWidth: '300px' }}>
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {book.title}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    By {book.author}
                  </div>
                </div>

                {/* Central Dynamic Page Stepper */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'var(--input-bg)',
                  padding: '4px 8px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-glass)',
                  boxShadow: 'var(--shadow-glass)'
                }}>
                  <button
                    onClick={() => handlePageChange(currentPage - (viewMode === 'spread' ? 2 : 1), 'prev')}
                    disabled={currentPage <= 1}
                    className="btn btn-secondary"
                    style={{ padding: '4px 7px', fontSize: '0.75rem', minHeight: 'auto', opacity: currentPage <= 1 ? 0.35 : 1 }}
                    title="Previous Page (Left Arrow)"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Pg</span>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={currentPage}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1) {
                          handlePageChange(Math.min(val, totalPages));
                        }
                      }}
                      className="glass-input"
                      style={{ width: '48px', padding: '2px 4px', textAlign: 'center', fontSize: '0.84rem', fontWeight: 700 }}
                      title={`Jump to page (1 - ${totalPages})`}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>/ {totalPages}</span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'var(--primary)',
                      background: 'rgba(59, 130, 246, 0.15)',
                      padding: '2px 5px',
                      borderRadius: '5px'
                    }}>
                      {Math.min(100, Math.round((currentPage / totalPages) * 100))}%
                    </span>
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + (viewMode === 'spread' ? 2 : 1), 'next')}
                    disabled={currentPage >= totalPages}
                    className="btn btn-secondary"
                    style={{ padding: '4px 7px', fontSize: '0.75rem', minHeight: 'auto', opacity: currentPage >= totalPages ? 0.35 : 1 }}
                    title="Next Page (Right Arrow)"
                  >
                    <ChevronRight size={14} />
                  </button>

                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.7rem',
                    color: saving ? '#f59e0b' : '#10b981',
                    marginLeft: '4px',
                    fontWeight: 600
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: saving ? '#f59e0b' : '#10b981',
                      boxShadow: saving ? '0 0 6px #f59e0b' : '0 0 6px #10b981'
                    }} />
                    {saving ? 'Saving...' : 'Live'}
                  </span>
                </div>
              </div>

              {/* Right: Interactive Reading Tools */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Quick Bookmark Toggle with Ribbon State */}
                <button
                  onClick={() => handleToggleBookmark()}
                  className={`btn ${isCurrentPageBookmarked ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    padding: '7px 11px',
                    fontSize: '0.8rem',
                    gap: '5px',
                    background: isCurrentPageBookmarked ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : undefined,
                    borderColor: isCurrentPageBookmarked ? '#ef4444' : undefined,
                    color: isCurrentPageBookmarked ? '#fef08a' : undefined
                  }}
                  title={isCurrentPageBookmarked ? 'Remove Bookmark for this Page' : 'Bookmark this Page'}
                >
                  <Bookmark size={14} fill={isCurrentPageBookmarked ? 'currentColor' : 'none'} />
                  <span className="hide-mobile">{isCurrentPageBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
                </button>

                {/* View Mode Toggle: Single Page vs 2-Page Open Book */}
                <button
                  onClick={() => setViewMode(prev => prev === 'single' ? 'spread' : 'single')}
                  className="btn btn-secondary hide-mobile"
                  style={{ padding: '7px 10px', fontSize: '0.8rem', gap: '5px' }}
                  title={viewMode === 'single' ? 'Switch to 2-Page Open Book Spread' : 'Switch to Single Page Focused View'}
                >
                  {viewMode === 'single' ? <BookOpen size={14} /> : <Book size={14} />}
                  <span>{viewMode === 'single' ? '2-Page Book' : '1-Page'}</span>
                </button>

                {/* Zoom Controls */}
                <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--input-bg)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '2px' }}>
                  <button
                    onClick={() => setScale(s => Math.max(0.75, Number((s - 0.15).toFixed(2))))}
                    className="btn btn-ghost"
                    style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                    title="Zoom Out"
                  >
                    <ZoomOut size={13} />
                  </button>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, minWidth: '34px', textAlign: 'center', color: 'var(--text-primary)' }}>
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    onClick={() => setScale(s => Math.min(1.8, Number((s + 0.15).toFixed(2))))}
                    className="btn btn-ghost"
                    style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                    title="Zoom In"
                  >
                    <ZoomIn size={13} />
                  </button>
                </div>

                {/* Study Notes & Bookmarks Drawer Toggle */}
                <button
                  onClick={() => setShowDrawer(prev => !prev)}
                  className={`btn ${showDrawer ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '7px 12px', fontSize: '0.8rem', gap: '6px' }}
                  title="Open Study Notes & Bookmarks Drawer"
                >
                  <StickyNote size={14} />
                  <span>Notes</span>
                  {(notes.length > 0 || bookmarks.length > 0) && (
                    <span style={{
                      background: 'var(--primary)',
                      color: '#fff',
                      fontSize: '0.68rem',
                      padding: '1px 5px',
                      borderRadius: '10px',
                      fontWeight: 700
                    }}>
                      {notes.length + bookmarks.length}
                    </span>
                  )}
                </button>

                {/* Quick PDF Download */}
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="btn btn-secondary"
                  style={{ padding: '7px 10px', fontSize: '0.8rem', gap: '5px' }}
                  title="Download PDF Document"
                >
                  <Download size={14} />
                  <span className="hide-mobile">{downloadingPdf ? '...' : 'PDF'}</span>
                </button>

                {/* Day / Night Theme Toggle */}
                <button
                  onClick={toggleMode}
                  className="btn btn-secondary"
                  style={{ padding: '7px 10px', fontSize: '0.8rem', gap: '5px' }}
                  title={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {mode === 'dark' ? <Sun size={14} color="#fbbf24" /> : <Moon size={14} color="var(--primary)" />}
                  <span className="hide-mobile">{mode === 'dark' ? 'Light' : 'Dark'}</span>
                </button>

                {/* Fullscreen Reading Mode Toggle */}
                <button
                  onClick={toggleFullscreen}
                  className="btn btn-secondary"
                  style={{ padding: '7px 10px', fontSize: '0.8rem', gap: '5px' }}
                  title={isFullscreen ? 'Exit Full Screen' : 'Full Screen Reading Mode'}
                >
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  <span className="hide-mobile">{isFullscreen ? 'Exit' : 'Full'}</span>
                </button>

                {/* Fallback to Native Viewer if student desires browser PDF UI */}
                <button
                  onClick={() => setUseNativeViewer(prev => !prev)}
                  className="btn btn-secondary"
                  style={{ padding: '7px 9px', fontSize: '0.76rem' }}
                  title={useNativeViewer ? 'Switch to 3D Book Mode' : 'Switch to Native Browser Viewer'}
                >
                  <Layers size={13} />
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              MAIN READING STAGE: REALISTIC 3D BOOK ENGINE
              ══════════════════════════════════════════════════════════ */}
          <div
            className="book-stage-viewport"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {useNativeViewer || (!pdfSource && driveEmbed) ? (
              /* Native / External Drive Embed View */
              <div className="glass-panel" style={{
                width: '100%',
                height: isMobile ? 'calc(100dvh - 70px)' : '76vh',
                borderRadius: isMobile ? '8px' : '16px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                background: '#0b0f19',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
              }}>
                <div style={{
                  padding: '8px 16px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  borderBottom: '1px solid rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.8rem'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                    <Sparkles size={14} color="var(--primary)" />
                    {driveEmbed ? `Google Drive • ${book.title}` : `Browser Digital Viewer • ${book.title}`}
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
                <iframe
                  src={driveEmbed || `${pdfSource}#page=${currentPage}`}
                  width="100%"
                  height="100%"
                  style={{ border: 'none', flex: 1, background: '#1e293b' }}
                  title={book.title}
                />
              </div>
            ) : pdfLoading ? (
              /* Smooth Book Loading State */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '65vh',
                gap: '16px'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  border: '3px solid rgba(59, 130, 246, 0.2)',
                  borderTopColor: 'var(--primary, #3b82f6)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Preparing 3D Book Experience...
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Loading high-resolution pages for "{book.title}"
                  </p>
                </div>
              </div>
            ) : pdfLoadError ? (
              /* Graceful Error Fallback */
              <div className="glass-panel" style={{
                padding: '36px',
                borderRadius: '16px',
                textAlign: 'center',
                maxWidth: '500px'
              }}>
                <BookOpen size={40} color="#f59e0b" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>
                  Standard Book Engine Ready
                </h4>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  This book can be read seamlessly in the digital viewer or downloaded directly.
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button
                    onClick={() => setUseNativeViewer(true)}
                    className="btn btn-primary"
                    style={{ fontSize: '0.84rem' }}
                  >
                    Open in Digital Viewer
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.84rem' }}
                  >
                    <Download size={14} /> Download PDF
                  </button>
                </div>
              </div>
            ) : (
              /* ══════════════════════════════════════════════════════════
                 AUTHENTIC 3D PHYSICAL BOOK CASING & PAGES
                 ══════════════════════════════════════════════════════════ */
              <div className="book-hardcover-casing">
                {/* Left Stacked Paper Edges (Desktop only) */}
                {!isMobile && <div className="book-edge-stacked book-edge-left" />}

                {/* The Open Book Spread */}
                <div
                  className="book-open-spread"
                  style={{
                    flexDirection: viewMode === 'spread' && !isMobile ? 'row' : 'column',
                    minWidth: isMobile ? '100%' : (viewMode === 'spread' ? 'min(92vw, 1100px)' : 'min(90vw, 680px)'),
                    width: isMobile ? '100%' : undefined,
                    maxWidth: isMobile ? '100%' : undefined,
                    minHeight: isMobile ? 'auto' : '70vh'
                  }}
                >
                  {/* Center Spine Binding Groove (Two-Page Mode) */}
                  {viewMode === 'spread' && !isMobile && <div className="book-center-spine" />}

                  {/* Silk Ribbon Bookmark hanging from active page */}
                  {isCurrentPageBookmarked && (
                    <div
                      className="silk-ribbon-bookmark"
                      onClick={() => handleToggleBookmark()}
                      title="Page Bookmarked (Click to toggle)"
                    >
                      <Bookmark size={13} fill="currentColor" />
                    </div>
                  )}

                  {/* LEFT PAGE (or Sole Page in Single Mode) */}
                  <div
                    className={`book-page-leaf ${isFlipping ? `flipping-${isFlipping}` : ''}`}
                    style={{
                      flex: 1,
                      borderRight: viewMode === 'spread' && !isMobile ? '1px solid rgba(0,0,0,0.06)' : 'none',
                      minHeight: isMobile ? 'auto' : '70vh',
                      width: isMobile ? '100%' : undefined
                    }}
                  >
                    <div className="book-canvas-holder">
                      <canvas ref={canvasLeftRef} />
                    </div>

                    {/* Left Interactive Page Turn Zone */}
                    <div
                      className="page-turn-trigger page-turn-trigger-left"
                      onClick={() => handlePageChange(currentPage - (viewMode === 'spread' && !isMobile ? 2 : 1), 'prev')}
                      title="Click to Turn Back (or use Left Arrow key)"
                    >
                      <div className="page-turn-arrow-badge">
                        <ChevronLeft size={20} />
                      </div>
                    </div>
                  </div>

                  {/* RIGHT PAGE (in Two-Page Spread Mode) */}
                  {viewMode === 'spread' && !isMobile && (
                    <div
                      className="book-page-leaf"
                      style={{
                        flex: 1,
                        borderLeft: '1px solid rgba(0,0,0,0.06)',
                        minHeight: '70vh'
                      }}
                    >
                      <div className="book-canvas-holder">
                        {currentPage + 1 <= totalPages ? (
                          <canvas ref={canvasRightRef} />
                        ) : (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: '#94a3b8',
                            fontSize: '0.86rem'
                          }}>
                            <Book size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                            <span>End of Book</span>
                          </div>
                        )}
                      </div>

                      {/* Right Interactive Page Turn Zone */}
                      <div
                        className="page-turn-trigger page-turn-trigger-right"
                        onClick={() => handlePageChange(currentPage + 2, 'next')}
                        title="Click to Turn Forward (or use Right Arrow key)"
                      >
                        <div className="page-turn-arrow-badge">
                          <ChevronRight size={20} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3D Page Flip Animation Sheet */}
                  {isFlipping && (
                    <div
                      className={`page-turning-sheet ${
                        viewMode === 'single' || isMobile ? 'page-turning-sheet-single' : 'page-turning-sheet-spread'
                      } ${isFlipping === 'next' ? 'page-turning-sheet-next' : 'page-turning-sheet-prev'}`}
                    >
                      <div className="page-turning-sheet-inner" />
                    </div>
                  )}
                </div>

                {/* Right Stacked Paper Edges (Desktop only) */}
                {!isMobile && <div className="book-edge-stacked book-edge-right" />}
              </div>
            )}
          </div>

          {/* Mobile Bottom Thumb-friendly Navigation Floating Bar */}
          {isMobile && !useNativeViewer && !pdfLoading && !pdfLoadError && (
            <div className="reader-mobile-bottom-bar">
              <button
                onClick={() => handlePageChange(currentPage - 1, 'prev')}
                disabled={currentPage <= 1}
                className="btn btn-secondary"
                style={{
                  padding: '7px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  opacity: currentPage <= 1 ? 0.35 : 1,
                  gap: '4px'
                }}
                title="Previous Page"
              >
                <ChevronLeft size={15} /> Prev
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Pg</span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1) {
                      handlePageChange(Math.min(val, totalPages));
                    }
                  }}
                  className="glass-input"
                  style={{
                    width: '44px',
                    padding: '3px 4px',
                    textAlign: 'center',
                    fontSize: '0.82rem',
                    fontWeight: 700
                  }}
                  title={`Jump to page (1 - ${totalPages})`}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>/ {totalPages}</span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: 'var(--primary)',
                  background: 'rgba(59, 130, 246, 0.15)',
                  padding: '2px 5px',
                  borderRadius: '5px'
                }}>
                  {Math.min(100, Math.round((currentPage / totalPages) * 100))}%
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => handleToggleBookmark()}
                  className={`btn ${isCurrentPageBookmarked ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    padding: '7px 9px',
                    fontSize: '0.8rem',
                    background: isCurrentPageBookmarked ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : undefined,
                    borderColor: isCurrentPageBookmarked ? '#ef4444' : undefined,
                    color: isCurrentPageBookmarked ? '#fef08a' : undefined
                  }}
                  title={isCurrentPageBookmarked ? 'Bookmarked' : 'Bookmark Page'}
                >
                  <Bookmark size={14} fill={isCurrentPageBookmarked ? 'currentColor' : 'none'} />
                </button>

                <button
                  onClick={() => handlePageChange(currentPage + 1, 'next')}
                  disabled={currentPage >= totalPages}
                  className="btn btn-primary btn-shine"
                  style={{
                    padding: '7px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    opacity: currentPage >= totalPages ? 0.35 : 1,
                    gap: '4px'
                  }}
                  title="Next Page"
                >
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              DISTRACTION-FREE SLIDE-OVER STUDY NOTES & BOOKMARKS DRAWER
              ══════════════════════════════════════════════════════════ */}
          {showDrawer && (
            <>
              {/* Dimmed backdrop */}
              <div
                className="study-drawer-overlay"
                onClick={() => setShowDrawer(false)}
              />

              {/* Drawer Content */}
              <div className="study-drawer-content">
                {/* Drawer Header with Tabs */}
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-glass)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'transparent'
                }}>
                  {/* Tab Selector: Notes vs Bookmarks */}
                  <div style={{ display: 'flex', gap: '6px', background: 'var(--input-bg)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                    <button
                      type="button"
                      onClick={() => setDrawerTab('notes')}
                      style={{
                        padding: '5px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: '7px',
                        border: 'none',
                        background: drawerTab === 'notes' ? 'var(--primary)' : 'transparent',
                        color: drawerTab === 'notes' ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <StickyNote size={14} /> Notes ({notes.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawerTab('bookmarks')}
                      style={{
                        padding: '5px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: '7px',
                        border: 'none',
                        background: drawerTab === 'bookmarks' ? 'var(--primary)' : 'transparent',
                        color: drawerTab === 'bookmarks' ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Bookmark size={14} /> Bookmarks ({bookmarks.length})
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {drawerTab === 'notes' && notes.length > 0 && (
                      <button
                        onClick={handleExportNotes}
                        className="btn btn-secondary"
                        style={{ padding: '5px 8px', fontSize: '0.72rem', gap: '4px' }}
                        title="Export notes as Markdown"
                      >
                        <FileDown size={13} /> Export
                      </button>
                    )}
                    <button
                      onClick={() => setShowDrawer(false)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Close drawer"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* ================= TAB 1: STUDY NOTES ================= */}
                {drawerTab === 'notes' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    {/* Add Note Form */}
                    <form onSubmit={handleAddNote} style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid var(--border-glass)',
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
                                border: `1px solid ${active ? style.text : 'var(--border-glass)'}`,
                                background: active ? style.bg : 'var(--input-bg)',
                                color: active ? style.text : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontWeight: active ? 600 : 400
                              }}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>

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
                          lineHeight: '1.45'
                        }}
                      />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          📌 Tagged to <strong>Page {currentPage}</strong>
                        </span>
                        <button
                          type="submit"
                          disabled={!newNoteText.trim()}
                          className="btn btn-primary"
                          style={{
                            padding: '6px 14px',
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
                      padding: '10px 20px',
                      borderBottom: '1px solid var(--border-glass)',
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
                              border: '1px solid var(--border-glass)',
                              background: selectedTagFilter === t ? 'var(--primary)' : 'var(--input-bg)',
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
                      padding: '14px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      {filteredNotes.length === 0 ? (
                        <div style={{
                          padding: '40px 16px',
                          textAlign: 'center',
                          color: 'var(--text-muted)',
                          fontSize: '0.82rem'
                        }}>
                          <StickyNote size={30} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                          <p style={{ margin: '0 0 4px', fontWeight: 600 }}>No notes saved yet</p>
                          <span style={{ fontSize: '0.74rem', opacity: 0.7 }}>
                            Add formulas and key pointers to revise directly from database anytime!
                          </span>
                        </div>
                      ) : (
                        filteredNotes.map(note => {
                          const tagStyle = TAG_COLORS[note.tag] || TAG_COLORS.General;
                          return (
                            <div
                              key={note.id}
                              style={{
                                padding: '10px 14px',
                                borderRadius: '10px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-glass)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px'
                              }}
                            >
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

                              <span style={{
                                fontSize: '0.66rem',
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

                {/* ================= TAB 2: BOOKMARKS ================= */}
                {drawerTab === 'bookmarks' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid var(--border-glass)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        Current Reading Page: <strong>Pg {currentPage}</strong>
                      </span>
                      <button
                        onClick={() => handleToggleBookmark(currentPage)}
                        className={`btn ${isCurrentPageBookmarked ? 'btn-danger' : 'btn-primary'}`}
                        style={{ padding: '6px 12px', fontSize: '0.76rem', gap: '5px' }}
                      >
                        <Bookmark size={13} fill={isCurrentPageBookmarked ? 'currentColor' : 'none'} />
                        {isCurrentPageBookmarked ? 'Remove Current' : 'Bookmark Page'}
                      </button>
                    </div>

                    <div style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '14px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      {bookmarks.length === 0 ? (
                        <div style={{
                          padding: '40px 16px',
                          textAlign: 'center',
                          color: 'var(--text-muted)',
                          fontSize: '0.82rem'
                        }}>
                          <Bookmark size={30} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                          <p style={{ margin: '0 0 4px', fontWeight: 600 }}>No bookmarks saved yet</p>
                          <span style={{ fontSize: '0.74rem', opacity: 0.7 }}>
                            Bookmark any page to quickly jump back right here anytime!
                          </span>
                        </div>
                      ) : (
                        bookmarks.map(bm => (
                          <div
                            key={bm.id || bm.page}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '10px',
                              background: Number(bm.page) === currentPage ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                              border: Number(bm.page) === currentPage ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-glass)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div
                              onClick={() => {
                                handlePageChange(bm.page);
                                setShowDrawer(false);
                              }}
                              style={{ flex: 1, cursor: 'pointer' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                <span style={{
                                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                                  color: '#fef08a',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '5px'
                                }}>
                                  Page {bm.page}
                                </span>
                                {Number(bm.page) === currentPage && (
                                  <span style={{ fontSize: '0.68rem', color: '#60a5fa', fontWeight: 600 }}>
                                    Current Page
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Bookmarked {new Date(bm.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleBookmark(bm.page)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                              title="Delete bookmark"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default BookReader;
