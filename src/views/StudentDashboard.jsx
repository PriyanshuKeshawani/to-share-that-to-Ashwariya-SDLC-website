"use client";

import { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from 'react';
import { useAuth, normalizeBranch, isSameBranch } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../supabaseClient';
import {
  BookOpen, LogOut, CheckCircle, ShieldAlert, Download,
  Search, Lock, Unlock,
  Clock, BookMarked, Home, Library, Compass,
  Activity, X, Settings, RefreshCw, Printer, FileText,
  Share2, Info, Sun, Moon, PanelLeftClose, PanelLeftOpen, Sparkles,
  GraduationCap, Rocket, Trash2
} from 'lucide-react';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import BottomNav from '../components/BottomNav';
import SettingsView from '../components/SettingsView';
import { SkeletonCard } from '../components/SkeletonLoader';
import { printStudentTranscript } from '../components/StudentActivityModal';
import ShareBookModal from '../components/ShareBookModal';
import BookOverviewModal from '../components/BookOverviewModal';
import NotificationBell from '../components/NotificationBell';
import SeniorMajorsMinorsStudentView from '../components/SeniorMajorsMinorsStudentView';
import ProjectStudentView from '../components/ProjectStudentView';
import { getCachedBooks, getCachedCategories, getCachedBranches } from '../db/cacheService';
import useNativeBack from '../hooks/useNativeBack';
import { getProtectedBookPdfUrl } from '../utils/pdfUrlResolver';


// Ultra-fast in-memory token precomputation for instantaneous search (0ms allocations)
const indexBooks = (rawBooks) => {
  if (!Array.isArray(rawBooks)) return [];
  return rawBooks.map(b => {
    if (b._searchHaystack) return b;
    const tokens = [
      b.title,
      b.author,
      b.description,
      b.branch_name,
      b.branch?.name,
      b.category_name,
      b.category?.name,
      b.priority,
      b.main_subject,
      b.sub_subject,
      b.publisher_name,
      b.publishing_year,
      b.keywords,
      b.accession_no,
      b.isbn,
      b.classification_no,
      b.co_author
    ].filter(Boolean).join(' ').toLowerCase();
    return { ...b, _searchHaystack: tokens };
  });
};

const StudentDashboard = ({ onSelectBook }) => {
  const { user, logout, apiCall } = useAuth();
  const { mode, toggleMode } = useTheme();
  const isDark = mode === 'dark';
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [publishedProjectsCount, setPublishedProjectsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [feedbackMsg, setFeedbackMsg] = useState({ text: '', type: '' });
  const [printingTranscript, setPrintingTranscript] = useState(false);

  // Sharing and Overview Modals State
  const [sharingBook, setSharingBook] = useState(null);
  const [overviewBook, setOverviewBook] = useState(null);

  // Google AI Studio style Collapsible Sidebar State (PC / Desktop users)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('student-sidebar-collapsed') === 'true') {
        setIsSidebarCollapsed(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('student-sidebar-collapsed', String(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  }, []);

  // Ctrl+B shortcut to toggle sidebar like Google AI Studio / IDEs
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const [activeTab, setActiveTabState] = useState(() => {
    if (typeof window === 'undefined') return 'all';
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'majors-minors') return 'projects';
    const validTabs = ['all', 'home', 'other', 'out_of_syllabus', 'projects', 'my-books', 'requests', 'history', 'settings'];
    return validTabs.includes(tabParam) ? tabParam : 'all';
  });

  const setActiveTab = useCallback((tab) => {
    const targetTab = tab === 'majors-minors' ? 'projects' : tab;
    setActiveTabState(targetTab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', targetTab);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'majors-minors') {
        setActiveTabState('projects');
        return;
      }
      const validTabs = ['all', 'home', 'other', 'out_of_syllabus', 'projects', 'my-books', 'requests', 'history', 'settings'];
      if (validTabs.includes(tabParam)) {
        setActiveTabState(tabParam);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Trap Android hardware back button for modals and sub-tabs in mobile view & APK
  useNativeBack(
    () => {
      setOverviewBook(null);
      if (typeof window !== 'undefined') {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('book');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : ''));
        } catch {}
      }
    },
    Boolean(overviewBook),
    { id: 'student-overview-modal', priority: 20, label: 'student-overview' }
  );

  useNativeBack(
    () => {
      setSharingBook(null);
    },
    Boolean(sharingBook),
    { id: 'student-share-modal', priority: 20, label: 'student-share' }
  );

  useNativeBack(
    () => {
      setActiveTab('all');
    },
    activeTab !== 'all',
    { id: 'student-subtab-navigation', priority: 5, label: 'student-subtab' }
  );

  const [requestFilter, setRequestFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [requestSearch, setRequestSearch] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const scrollSentinelRef = useRef(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [toastExiting, setToastExiting] = useState(false);
  const [visibleCount, setVisibleCount] = useState(36);

  useEffect(() => {
    setVisibleCount(36);
  }, [deferredSearch, selectedCategory, selectedBranch, activeTab]);


  const showFeedback = useCallback((text, type = 'success') => {
    setToastExiting(false);
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setToastExiting(true);
      setTimeout(() => setFeedbackMsg({ text: '', type: '' }), 300);
    }, 3500);
  }, []);

  const handlePrintTranscript = async () => {
    try {
      setPrintingTranscript(true);
      showFeedback('Fetching verified activity and compiling certified transcript...', 'success');
      const actData = await apiCall(`/students/${user?.id}/activity`);
      printStudentTranscript({ student: user, activityData: actData });
    } catch (err) {
      showFeedback(err.message || 'Failed to compile transcript dossier', 'error');
    } finally {
      setPrintingTranscript(false);
    }
  };

  const fetchData = async () => {
    try {
      // 1. Instant Cache Render: load from IndexedDB immediately in <10ms
      try {
        const [cachedB, cachedC, cachedBr] = await Promise.all([
          getCachedBooks(),
          getCachedCategories(),
          getCachedBranches()
        ]);
        if (cachedB && cachedB.length > 0) {
          setBooks(indexBooks(cachedB));
          if (cachedC && cachedC.length > 0) setCategories(cachedC);
          if (cachedBr && cachedBr.length > 0) setBranches(cachedBr);
          setLoading(false); // Instant render without skeleton blocker!
        } else {
          setLoading(true);
        }
      } catch (cacheErr) {
        console.warn('[StudentDashboard] Local cache read note:', cacheErr);
        setLoading(true);
      }

      // 2. Parallel Background Sync / Stale-While-Revalidate
      const [booksData, catsData, branchesData, reqsData, histData, projCount] = await Promise.all([
        apiCall('/books').catch(() => []),
        apiCall('/books/categories').catch(() => []),
        apiCall('/books/branches').catch(() => []),
        apiCall('/permissions/my-requests').catch(() => []),
        apiCall('/analytics/my-history').catch(() => []),
        apiCall('/projects/count-published').catch(() => ({ count: 0 }))
      ]);

      if (booksData && booksData.length > 0) setBooks(indexBooks(booksData));
      if (catsData && catsData.length > 0) setCategories(catsData);
      if (branchesData && branchesData.length > 0) setBranches(branchesData);
      setRequests(reqsData || []);
      setHistory(histData || []);
      setPublishedProjectsCount(projCount?.count || 0);
    } catch (err) {
      showFeedback(err.message || 'Failed to retrieve library data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const silentRefresh = useCallback(async () => {
    try {
      const [booksData, reqsData, histData, branchesData, projCount] = await Promise.all([
        apiCall('/books').catch(() => null),
        apiCall('/permissions/my-requests').catch(() => null),
        apiCall('/analytics/my-history').catch(() => null),
        apiCall('/books/branches').catch(() => null),
        apiCall('/projects/count-published').catch(() => null)
      ]);
      if (booksData) setBooks(indexBooks(booksData));
      if (reqsData) setRequests(reqsData);
      if (histData) setHistory(histData);
      if (branchesData && Array.isArray(branchesData)) {
        setBranches(prev => (prev.length === branchesData.length ? prev : branchesData));
      }
      if (projCount && typeof projCount.count === 'number') {
        setPublishedProjectsCount(prev => (prev === projCount.count ? prev : projCount.count));
      }
    } catch (e) {
      console.warn('Silent student realtime refresh note:', e);
    }
  }, [apiCall]);

  useEffect(() => {
    document.title = 'Student Portal - SISTec Digital Library';
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await fetchData();
      } catch (err) {
        if (!cancelled) showFeedback(err.message || 'Failed to retrieve library data', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const silentRefreshRef = useRef(silentRefresh);
  const showFeedbackRef = useRef(showFeedback);
  useEffect(() => {
    silentRefreshRef.current = silentRefresh;
    showFeedbackRef.current = showFeedback;
  }, [silentRefresh, showFeedback]);

  // Full Realtime WebSocket subscription: books, permissions, and progress update automatically
  useEffect(() => {
    if (!user || !user.id) return;

    let channel = null;
    try {
      channel = supabase
        .channel(`student-live-portal-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, () => {
          silentRefreshRef.current?.();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, () => {
          silentRefreshRef.current?.();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'senior_academic_profiles' }, () => {
          silentRefreshRef.current?.();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'projects' }, () => {
          silentRefreshRef.current?.();
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'projects' }, () => {
          silentRefreshRef.current?.();
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'permissions', filter: `user_id=eq.${user.id}` },
          (payload) => {
            silentRefreshRef.current?.();
            if (payload.new?.status === 'approved') {
              showFeedbackRef.current?.('Your cross-department book access request was approved by the librarian!', 'success');
            } else if (payload.new?.status === 'rejected') {
              showFeedbackRef.current?.('An access request was declined by the administrator.', 'error');
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_book_progress', filter: `user_id=eq.${user.id}` },
          () => {
            silentRefreshRef.current?.();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime student channel subscribe note:', e.message);
    }

    const handleFocus = () => silentRefreshRef.current?.();
    window.addEventListener('focus', handleFocus);

    return () => {
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id]);

  // Auto-open Book Overview Modal when URL contains shared book parameter (?book=<id> or #...book=<id>)
  useEffect(() => {
    let active = true;
    const checkSharedBookParam = async () => {
      try {
        let bookParam = null;
        if (typeof window !== 'undefined') {
          const searchParams = new URLSearchParams(window.location.search);
          bookParam = searchParams.get('book');

          if (!bookParam && window.location.hash) {
            const hash = window.location.hash;
            const qIdx = hash.indexOf('?');
            if (qIdx !== -1) {
              const hashParams = new URLSearchParams(hash.slice(qIdx));
              bookParam = hashParams.get('book');
            }
          }
        }

        if (!bookParam) return;

        // 1. Check in currently loaded catalog
        let targetBook = books.find(b => String(b.id) === String(bookParam));

        // 2. If not found in current catalog (e.g. cross-branch book), fetch directly on the fly!
        if (!targetBook) {
          try {
            const fetched = await apiCall(`/books/${bookParam}`);
            if (fetched && fetched.id) {
              targetBook = fetched;
            }
          } catch (fetchErr) {
            console.warn('Notice resolving cross-branch shared book directly:', fetchErr);
          }
        }

        if (active && targetBook) {
          setOverviewBook(targetBook);
        }
      } catch (err) {
        console.warn('Notice resolving shared book URL parameter:', err);
      }
    };

    checkSharedBookParam();
    return () => { active = false; };
  }, [books, apiCall]);

  const handleRequestAccess = async (book) => {
    if (!book) return;
    const targetBookId = book.id || book.book_id;
    if (!targetBookId) return;
    const actionKey = `book-${targetBookId}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      const data = await apiCall('/permissions/request', {
        method: 'POST',
        body: JSON.stringify({
          book_id: targetBookId,
          book_title: book.title || book.book_title || 'Book',
          branch_id: book.branch_id || null,
          branch_name: book.branch_name || book.branch?.name || ''
        })
      });
      showFeedback(data.message || `Requested reading permission for "${book.title || 'selected book'}"`);
      const reqsData = await apiCall('/permissions/my-requests');
      setRequests(reqsData || []);
    } catch (err) {
      showFeedback(err.message || 'Failed to request book permission', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleCancelRequest = async (requestId, bookTitle) => {
    if (!window.confirm(`Are you sure you want to cancel your permission request for "${bookTitle || 'this book'}"?`)) return;
    const actionKey = `cancel-${requestId}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      await apiCall(`/permissions/cancel/${requestId}`, { method: 'POST' });
      showFeedback(`Cancelled access request for "${bookTitle || 'selected book'}"`, 'success');
      const reqsData = await apiCall('/permissions/my-requests');
      setRequests(reqsData || []);
    } catch (err) {
      showFeedback(err.message || 'Failed to cancel permission request', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleDownload = async (book) => {
    const access = getBookAccess(book);
    if (!access.hasAccess) {
      showFeedback(`Permission required: You must request permission from Admin to download books outside your department.`, 'error');
      return;
    }

    try {
      showFeedback(`Preparing "${book.title}"...`, 'success');
      await apiCall('/analytics/track', {
        method: 'POST',
        body: JSON.stringify({ book_id: book.id, action_type: 'download' })
      });

      const safeTitle = (book.title || 'document').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const filename = `${safeTitle}.pdf`;

      // Drive download with virus scan confirmation bypass
      const protectedCdnUrl = getProtectedBookPdfUrl(book);
      if (protectedCdnUrl) {
        window.open(protectedCdnUrl, '_blank', 'noopener');
        showFeedback(`Starting high-speed CDN download for "${book.title}"...`, 'success');
        return;
      }

      if (book.drive_link || book.drive_file_id) {
        let driveFileId = book.drive_file_id;
        if (!driveFileId && book.drive_link) {
          const m = book.drive_link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || book.drive_link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (m) driveFileId = m[1];
        }
        const downloadUrl = driveFileId
          ? `https://drive.usercontent.google.com/download?id=${driveFileId}&confirm=t`
          : (book.drive_link || `https://drive.google.com/file/d/${book.drive_file_id}/view?usp=sharing`);
        window.open(downloadUrl, '_blank', 'noopener');
        showFeedback(`Starting high-speed download for "${book.title}"...`, 'success');
        return;
      }

      if (book.pdf_url && book.pdf_url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = book.pdf_url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (book.pdf_url && book.pdf_url.startsWith('http')) {
        const fullUrl = book.pdf_url;
        try {
          const resp = await fetch(fullUrl);
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch {
          window.open(fullUrl, '_blank');
        }
      } else {
        showFeedback('No downloadable file is linked to this book yet.', 'error');
        return;
      }

      showFeedback(`"${book.title}" downloaded successfully!`, 'success');
      const [histData, booksData] = await Promise.all([
        apiCall('/analytics/my-history'),
        apiCall('/books')
      ]);
      setHistory(histData || []);
      setBooks(booksData || []);
    } catch (err) {
      showFeedback(err.message || 'Download failed', 'error');
    }
  };

  const handleRemoveHistoryItem = async (e, item) => {
    e.stopPropagation();
    const targetKey = item.book_id || item.id;
    setHistory(prev => prev.filter(h => (h.book_id || h.id) !== targetKey && h.id !== item.id));
    try {
      await apiCall(`/analytics/history/${targetKey}`, { method: 'DELETE' });
      showFeedback('Removed from reading history', 'success');
    } catch (err) {
      console.warn('Could not remove history item:', err);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear your reading history?')) return;
    setHistory([]);
    try {
      await apiCall('/analytics/clear-history', { method: 'POST' });
      showFeedback('Reading history cleared', 'success');
    } catch (err) {
      console.warn('Could not clear history:', err);
    }
  };

  const getBookAccess = useCallback((book) => {
    if (!book) return { hasAccess: false, isHomeBranch: false, status: 'none' };
    if (user?.role === 'admin') return { hasAccess: true, isHomeBranch: true, status: 'approved' };

    const userBranch = (user?.branchName || user?.branch_name || '').trim();
    const bookBranch = (book.branch_name || book.branch?.name || '').trim();

    // 1. HOME BRANCH: Instant, direct access (NO admin request needed)
    const isHome = isSameBranch(userBranch, bookBranch) || Boolean(book.isHomeBranch);
    if (isHome) {
      return { hasAccess: true, isHomeBranch: true, status: 'approved' };
    }

    // 2. OUTSIDE HOME BRANCH: Requires admin permission
    const req = requests.find(r =>
      book.id != null && r.book_id != null && String(r.book_id) === String(book.id)
    );

    if (req && req.status === 'approved') {
      return { hasAccess: true, isHomeBranch: false, status: 'approved' };
    }
    if (req && req.status === 'pending') {
      return { hasAccess: false, isHomeBranch: false, status: 'pending' };
    }
    if (req && req.status === 'rejected') {
      return { hasAccess: false, isHomeBranch: false, status: 'rejected' };
    }

    return { hasAccess: false, isHomeBranch: false, status: 'none' };
  }, [user, requests]);

  const handleOpenBook = (book) => {
    const access = getBookAccess(book);
    if (!access.hasAccess) {
      showFeedback(`Permission required: "${book.title}" is from ${book.branch_name || 'another department'}. Please request access below.`, 'error');
      return;
    }
    onSelectBook(book);
  };

  const isOutOfSyllabusBook = useCallback((b) => {
    const branchName = (b.branch_name || b.branch?.name || '').toLowerCase();
    return branchName.includes('syllabus') || b.branch_id === 34;
  }, []);

  const homeBooksCount = useMemo(() => {
    const userBranch = (user?.branchName || user?.branch_name || '').trim();
    if (!userBranch) return 0;
    return books.filter(b => (isSameBranch(userBranch, b.branch_name || b.branch?.name) || b.isHomeBranch) && !isOutOfSyllabusBook(b)).length;
  }, [books, user, isOutOfSyllabusBook]);

  const outOfSyllabusBooksCount = useMemo(() => {
    return books.filter(b => isOutOfSyllabusBook(b)).length;
  }, [books, isOutOfSyllabusBook]);

  const otherBooksCount = useMemo(() => {
    return Math.max(0, books.length - homeBooksCount - outOfSyllabusBooksCount);
  }, [books, homeBooksCount, outOfSyllabusBooksCount]);

  const filteredBooks = useMemo(() => {
    const userBranch = (user?.branchName || user?.branch_name || '').trim();

    return books.filter(book => {
      const bookBranch = (book.branch_name || book.branch?.name || '').trim();
      const isHome = (isSameBranch(userBranch, bookBranch) || Boolean(book.isHomeBranch)) && !isOutOfSyllabusBook(book);

      if (selectedBranch) {
        const selectedBranchObj = branches.find(b => String(b.id) === String(selectedBranch));
        const matchBranchId = book.branch_id != null && String(book.branch_id) === String(selectedBranch);
        const matchBranchName = selectedBranchObj && isSameBranch(bookBranch, selectedBranchObj.name);
        if (!matchBranchId && !matchBranchName) return false;
      } else {
        if (activeTab === 'home' && !isHome) return false;
        if (activeTab === 'other' && (isHome || isOutOfSyllabusBook(book))) return false;
        if (activeTab === 'out_of_syllabus' && !isOutOfSyllabusBook(book)) return false;
      }

      if (selectedCategory) {
        const selectedCatObj = categories.find(c => String(c.id) === String(selectedCategory));
        const bookCatName = (book.category_name || book.category?.name || '').trim();
        const matchCatId = book.category_id != null && String(book.category_id) === String(selectedCategory);
        const matchCatName = selectedCatObj && isSameBranch(bookCatName, selectedCatObj.name);
        if (!matchCatId && !matchCatName) return false;
      }

      if (deferredSearch) {
        const q = deferredSearch.toLowerCase().trim();
        const queryWords = q.split(/\s+/).filter(Boolean);
        const haystack = book._searchHaystack || [
          (book.title || ''),
          (book.author || ''),
          (book.description || ''),
          (book.branch_name || book.branch?.name || ''),
          (book.category_name || book.category?.name || ''),
          (book.priority || '')
        ].join(' ').toLowerCase();

        const matches = queryWords.every(word => haystack.includes(word));
        if (!matches) {
          return false;
        }
      }

      return true;
    });
  }, [books, activeTab, selectedCategory, selectedBranch, deferredSearch, user?.branchName, user?.branch_name, branches, categories]);

  // Native IntersectionObserver for fluid 60-120fps infinite streaming
  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => Math.min(prev + 36, filteredBooks.length));
      }
    }, {
      rootMargin: '450px 0px',
      threshold: 0
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredBooks.length]);

  const pendingRequestsCount = useMemo(() => requests.filter(r => r.status === 'pending').length, [requests]);
  const approvedRequestsCount = useMemo(() => requests.filter(r => r.status === 'approved').length, [requests]);
  const rejectedRequestsCount = useMemo(() => requests.filter(r => r.status === 'rejected').length, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (requestFilter === 'pending' && req.status !== 'pending') return false;
      if (requestFilter === 'approved' && req.status !== 'approved') return false;
      if (requestFilter === 'rejected' && req.status !== 'rejected') return false;
      if (requestSearch) {
        const q = requestSearch.toLowerCase();
        const b = req.book || req.books || books.find(item => String(item.id) === String(req.book_id)) || {};
        const title = (b.title || req.book_title || '').toLowerCase();
        const author = (b.author || '').toLowerCase();
        const branch = (req.branch_name || b.branch_name || '').toLowerCase();
        if (!title.includes(q) && !author.includes(q) && !branch.includes(q)) return false;
      }
      return true;
    });
  }, [requests, requestFilter, requestSearch, books]);

  const navItems = [
    { key: 'all', label: 'All Catalog', icon: Home },
    { key: 'home', label: 'Home Branch', icon: Library },
    { key: 'other', label: 'Other Branches', icon: Compass },
    { key: 'projects', label: 'Projects Showcase', icon: Rocket },
    { key: 'requests', label: 'My Requests', icon: BookMarked, badge: pendingRequestsCount },
    { key: 'history', label: 'Reading History', icon: Activity },
    { key: 'settings', label: 'Settings & Logout', icon: Settings }
  ];

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '11px',
            background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '3px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.2)',
            flexShrink: 0
          }}>
            <img src="/logo.png" alt="SISTec Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: '0.94rem', fontWeight: 800, lineHeight: 1.15, color: 'var(--text-primary)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              SISTec Library
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.department || user?.branchName || 'Student'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <NotificationBell />
        </div>
      </header>

      <aside className="sidebar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '4px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.2)',
                flexShrink: 0
              }}>
                <img src="/logo.png" alt="SISTec Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
                  SISTec
                </h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
                  Digital Library Portal
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={toggleMode}
                className="btn btn-secondary"
                style={{
                  padding: '7px',
                  borderRadius: '10px',
                  minWidth: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                aria-label="Toggle theme mode"
              >
                {isDark ? <Sun size={17} color="#fbbf24" /> : <Moon size={17} color="var(--primary)" />}
              </button>
              <button
                onClick={toggleSidebar}
                className="sidebar-collapse-btn"
                title="Collapse sidebar (Ctrl+B)"
                aria-label="Collapse navigation panel"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '14px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              {user?.avatarUrl || user?.avatar_url ? (
                <img
                  src={user.avatarUrl || user.avatar_url}
                  alt={user?.fullName || user?.username || 'Profile'}
                  referrerPolicy="no-referrer"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    objectFit: 'cover',
                    border: '1px solid var(--border-glass)'
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'rgba(37, 99, 235, 0.15)', color: 'var(--primary)',
                display: user?.avatarUrl || user?.avatar_url ? 'none' : 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.9rem'
              }}>
                {(user?.fullName || user?.username || 'S')[0].toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user?.fullName || user?.username}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {user?.rollNumber || user?.roll_number || user?.rollNo || 'Enrolled Student'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-glass)', paddingTop: '8px' }}>
              <span>{user?.branchName || 'Engineering'}</span>
              <span>{user?.year || '1st Year'} • {user?.semester || '1st Sem'}</span>
            </div>
            <button
              onClick={handlePrintTranscript}
              disabled={printingTranscript}
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '10px', padding: '7px 10px', fontSize: '0.75rem', gap: '6px', justifyContent: 'center' }}
              title="Print certified official academic library transcript and clearance dossier"
            >
              <Printer size={13} />
              {printingTranscript ? 'Generating Transcript...' : 'Official Transcript'}
            </button>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {navItems.map(({ key, label, icon: Icon, badge }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => { setActiveTab(key); setSelectedBranch(''); }}
                  className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ justifyContent: 'space-between', width: '100%', padding: '9px 14px', fontSize: '0.84rem' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon size={16} />
                    <span>{label}</span>
                  </div>
                  {badge > 0 && (
                    <span style={{
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: '#ffffff',
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      minWidth: '18px',
                      height: '18px',
                      borderRadius: '9px',
                      padding: '0 5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
                    }}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '10px' }}>
          <NotificationBell variant="sidebar" />
        </div>
      </aside>

      <main className="main-content">
        {/* Google AI Studio Style Top Bar when Sidebar is Collapsed (PC) */}
        {isSidebarCollapsed && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '24px',
            padding: '10px 16px',
            borderRadius: '12px',
            background: 'var(--modal-card-bg, var(--bg-card))',
            border: '1px solid var(--border-glass)',
            boxShadow: 'var(--shadow-sm)'
          }} className="desktop-table-view">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={toggleSidebar}
                className="sidebar-expand-btn"
                title="Expand navigation sidebar (Ctrl+B)"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen size={18} />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="/logo.png" alt="SISTec" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.04em' }}>SISTEC LIBRARY</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>• {
                  activeTab === 'all' ? 'All Catalog' :
                  activeTab === 'home' ? 'Home Branch' :
                  activeTab === 'other' ? 'Other Branches' :
                  activeTab === 'out_of_syllabus' ? 'Out of Syllabus' :
                  (activeTab === 'projects' || activeTab === 'majors-minors') ? 'Projects Showcase' :
                  activeTab === 'requests' ? 'My Requests' :
                  activeTab === 'history' ? 'Reading History' : 'Settings & Theme'
                }</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <NotificationBell />
              <button
                onClick={toggleMode}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '0.78rem', gap: '6px' }}
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? <Sun size={15} color="#fbbf24" /> : <Moon size={15} color="var(--primary)" />}
                {isDark ? 'Light' : 'Dark'}
              </button>
            </div>
          </div>
        )}
        {feedbackMsg.text && (
          <div className={`toast-notification ${toastExiting ? 'toast-exit' : ''}`} style={{
            position: 'fixed', top: '72px', right: '20px', left: '20px', zIndex: 3000,
            padding: '12px 18px', borderRadius: '12px',
            background: feedbackMsg.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            backdropFilter: 'blur(10px)', color: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 500,
            pointerEvents: 'auto'
          }}>
            {feedbackMsg.type === 'error' ? <ShieldAlert size={18} /> : <CheckCircle size={18} />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {activeTab === 'all' && (
          <div className="motion-ambient-banner animate-fade-in" style={{ marginBottom: '18px', padding: '16px 20px' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{
                fontSize: '1.42rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                WebkitTextFillColor: 'initial',
                marginBottom: '4px',
                letterSpacing: '-0.02em',
                lineHeight: 1.25
              }}>
                Welcome back, <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{user?.fullName || user?.username}</span>!
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>
                SISTec Digital Library • {user?.branchName || 'All Departments'}
              </p>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px', marginTop: '14px', position: 'relative', zIndex: 1
            }}>
              <div
                onClick={() => { setActiveTab('all'); setSelectedBranch(''); }}
                className="glass-panel motion-stat-card animate-stagger-in stagger-1"
                style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                title="View all catalog books"
              >
                <div className="motion-card-icon" style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(37, 99, 235, 0.14)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '1.18rem', fontWeight: 700, color: 'var(--text-primary)' }}>{books.length}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Library Catalog</div>
                </div>
              </div>

              <div
                onClick={() => { setActiveTab('requests'); setRequestFilter('approved'); }}
                className="glass-panel motion-stat-card animate-stagger-in stagger-2"
                style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                title="View approved book clearances"
              >
                <div className="motion-card-icon" style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(16, 185, 129, 0.14)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '1.18rem', fontWeight: 700, color: 'var(--text-primary)' }}>{approvedRequestsCount}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Approved Access</div>
                </div>
              </div>

              <div
                onClick={() => { setActiveTab('requests'); setRequestFilter('pending'); }}
                className="glass-panel motion-stat-card animate-stagger-in stagger-3"
                style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                title="View pending book requests"
              >
                <div className="motion-card-icon" style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(245, 158, 11, 0.14)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '1.18rem', fontWeight: 700, color: 'var(--text-primary)' }}>{pendingRequestsCount}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pending Requests</div>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('history')}
                className="glass-panel motion-stat-card animate-stagger-in stagger-4"
                style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                title={`View your reading history & in-progress books (${history.length} books tracked)`}
              >
                <div className="motion-card-icon" style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(99, 102, 241, 0.14)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '1.18rem', fontWeight: 700, color: 'var(--text-primary)' }}>{history.length}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Reading Activity</div>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('projects')}
                className="glass-panel motion-stat-card animate-stagger-in stagger-5"
                style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                title="Explore student projects, major/minor innovations"
              >
                <div className="motion-card-icon" style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(99, 102, 241, 0.14)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Rocket size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '1.18rem', fontWeight: 700, color: 'var(--text-primary)' }}>{publishedProjectsCount}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Projects &amp; Guidance</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : activeTab === 'settings' ? (
          <div className="animate-section-enter"><SettingsView /></div>
        ) : (activeTab === 'projects' || activeTab === 'majors-minors') ? (
          <div className="animate-section-enter">
            <ProjectStudentView branches={branches} />
          </div>
        ) : activeTab === 'history' ? (
          <div className="animate-section-enter">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.18rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                  Reading History & Activity
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Complete audit log of all online reading sessions and reference downloads.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {history.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '8px 12px', gap: '6px', color: '#ef4444' }}
                    title="Clear your reading history"
                  >
                    <Trash2 size={14} /> Clear History
                  </button>
                )}
                <button
                  onClick={handlePrintTranscript}
                  disabled={printingTranscript}
                  className="btn btn-primary btn-shine"
                  style={{ fontSize: '0.82rem', padding: '8px 16px', gap: '8px' }}
                  title="Print or export certified student library transcript with reading history and clearances"
                >
                  <Printer size={15} />
                  {printingTranscript ? 'Preparing Transcript...' : 'Print Official Transcript'}
                </button>
              </div>
            </div>
            {history.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No reading history recorded"
                description="Start reading books online to build your reading tracker."
              />
            ) : (
              <div className="glass-panel" style={{ padding: '16px', overflow: 'hidden' }}>
                {/* Desktop View (>= 768px) */}
                <div className="desktop-table-view">
                  <div className="table-responsive-wrapper">
                    <table className="custom-table" style={{ minWidth: '650px' }}>
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>Book Title</th>
                          <th>Activity</th>
                          <th>Status / Details</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map(h => {
                          const matchingBook = books.find(b => String(b.id) === String(h.book_id) || b.title === h.book_title || b.title === h.title);
                          const isCompleted = h.status === 'completed' || h.progress_percentage >= 95;
                          const isDownload = h.action_type === 'download';
                          return (
                            <tr key={h.id}>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                {new Date(h.created_at || h.last_accessed_at).toLocaleDateString()} {new Date(h.created_at || h.last_accessed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td style={{ fontWeight: 600 }}>{h.book_title || h.title || 'Reference Reading'}</td>
                              <td>
                                <StatusBadge
                                  status={isDownload ? 'borrowed' : (isCompleted ? 'approved' : 'available')}
                                  customLabel={isDownload ? 'DOWNLOAD' : (isCompleted ? 'COMPLETED' : 'READING')}
                                />
                              </td>
                              <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                {h.details || `Page ${h.last_page_read || 1} of ${h.total_pages || 100} • ${h.progress_percentage || 1}% completed`}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  {matchingBook && (
                                    <button
                                      onClick={() => onSelectBook(matchingBook)}
                                      className="btn btn-secondary"
                                      style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                                    >
                                      <BookOpen size={13} /> Open
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => handleRemoveHistoryItem(e, h)}
                                    className="btn btn-secondary"
                                    style={{ padding: '5px 8px', fontSize: '0.78rem', color: '#ef4444' }}
                                    title="Remove from history"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Cards View (< 768px) */}
                <div className="mobile-cards-view">
                  {history.map(h => {
                    const matchingBook = books.find(b => String(b.id) === String(h.book_id) || b.title === h.book_title || b.title === h.title);
                    const isCompleted = h.status === 'completed' || h.progress_percentage >= 95;
                    const isDownload = h.action_type === 'download';
                    return (
                      <div key={h.id} className="mobile-data-card">
                        <div className="mobile-card-header">
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '10px',
                              background: isDownload ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                              color: isDownload ? '#f59e0b' : 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {isDownload ? <Download size={20} /> : <BookOpen size={20} />}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                {h.book_title || h.title || 'Reference Reading'}
                              </h4>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                <Clock size={12} />
                                <span>
                                  {new Date(h.created_at || h.last_accessed_at).toLocaleDateString()} at {new Date(h.created_at || h.last_accessed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <StatusBadge
                            status={isDownload ? 'borrowed' : (isCompleted ? 'approved' : 'available')}
                            customLabel={isDownload ? 'DOWNLOAD' : (isCompleted ? 'COMPLETED' : 'READING')}
                          />
                        </div>

                        {h.details && (
                          <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-glass-input, rgba(255,255,255,0.03))', border: '1px solid var(--border-glass)', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                            {h.details}
                          </div>
                        )}

                        <div className="mobile-card-actions" style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                          {matchingBook && (
                            <button
                              onClick={() => onSelectBook(matchingBook)}
                              className="btn btn-primary"
                              style={{ flex: 1, height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}
                            >
                              <BookOpen size={16} /> Open Book
                            </button>
                          )}
                          <button
                            onClick={(e) => handleRemoveHistoryItem(e, h)}
                            className="btn btn-secondary"
                            style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}
                            title="Remove from history"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'requests' ? (
          <div className="animate-section-enter">
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <BookMarked size={22} color="var(--primary)" />
                  My Book Access Requests
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Track cross-department permissions, cancel pending submissions, and instantly open approved books.
                </p>
              </div>

              <button
                onClick={() => { setActiveTab('other'); setSelectedBranch(''); }}
                className="btn btn-primary btn-shine"
                style={{ fontSize: '0.82rem', padding: '8px 14px' }}
              >
                <Compass size={14} /> Request More Books
              </button>
            </div>

            {/* Filter Pills and Search */}
            <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => setRequestFilter('all')}
                    style={{
                      padding: '6px 14px', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                      background: requestFilter === 'all' ? 'var(--primary)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'),
                      color: requestFilter === 'all' ? '#ffffff' : 'var(--text-secondary)',
                      border: requestFilter === 'all' ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                      transition: 'all 0.2s'
                    }}
                  >
                    All Requests ({requests.length})
                  </button>
                  <button
                    onClick={() => setRequestFilter('pending')}
                    style={{
                      padding: '6px 14px', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                      background: requestFilter === 'pending' ? (isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.12)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'),
                      color: requestFilter === 'pending' ? (isDark ? '#fbbf24' : '#b45309') : 'var(--text-secondary)',
                      border: requestFilter === 'pending' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-glass)',
                      transition: 'all 0.2s'
                    }}
                  >
                    Pending Review ({pendingRequestsCount})
                  </button>
                  <button
                    onClick={() => setRequestFilter('approved')}
                    style={{
                      padding: '6px 14px', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                      background: requestFilter === 'approved' ? (isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'),
                      color: requestFilter === 'approved' ? (isDark ? '#34d399' : '#059669') : 'var(--text-secondary)',
                      border: requestFilter === 'approved' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-glass)',
                      transition: 'all 0.2s'
                    }}
                  >
                    Approved Clearance ({approvedRequestsCount})
                  </button>
                  <button
                    onClick={() => setRequestFilter('rejected')}
                    style={{
                      padding: '6px 14px', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                      background: requestFilter === 'rejected' ? (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'),
                      color: requestFilter === 'rejected' ? (isDark ? '#f87171' : '#dc2626') : 'var(--text-secondary)',
                      border: requestFilter === 'rejected' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-glass)',
                      transition: 'all 0.2s'
                    }}
                  >
                    Declined ({rejectedRequestsCount})
                  </button>
                </div>

                <div style={{ minWidth: '220px', flex: '1 1 200px' }}>
                  <div className="search-input-wrapper">
                    <span className="search-icon">
                      <Search size={14} />
                    </span>
                    <input
                      type="text"
                      className="glass-input has-search-icon"
                      placeholder="Search requested books..."
                      value={requestSearch}
                      onChange={(e) => setRequestSearch(e.target.value)}
                      style={{ fontSize: '0.8rem', width: '100%', height: '36px' }}
                    />
                    {requestSearch && (
                      <button
                        className="search-clear-btn"
                        onClick={() => setRequestSearch('')}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {filteredRequests.length === 0 ? (
              <EmptyState
                icon={BookMarked}
                title={requests.length === 0 ? "No book permission requests yet" : "No matching requests found"}
                description={requests.length === 0
                  ? "When you need to read textbooks or reference papers from other academic departments, request permission and track clearance here."
                  : "Try switching to 'All Requests' or clearing your search term."}
                actionLabel={requests.length === 0 ? "Explore Other Branches" : "Clear Filter"}
                onAction={() => {
                  if (requests.length === 0) {
                    setActiveTab('other');
                  } else {
                    setRequestFilter('all');
                    setRequestSearch('');
                  }
                }}
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
                {filteredRequests.map((req, idx) => {
                  const b = req.book || req.books || books.find(item => String(item.id) === String(req.book_id)) || {};
                  const bookTitle = b.title || req.book_title || 'Requested Book';
                  const bookAuthor = b.author || 'Author not specified';
                  const branchName = req.branch_name || b.branch_name || 'Cross-Department';
                  const isPending = req.status === 'pending';
                  const isApproved = req.status === 'approved';
                  const reqDate = req.created_at ? new Date(req.created_at) : null;
                  const formattedDate = reqDate
                    ? `${reqDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at ${reqDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Recently requested';

                  return (
                    <div
                      key={req.id || idx}
                      className="glass-panel glass-panel-hover animate-stagger-in"
                      style={{
                        padding: '18px', display: 'flex', flexDirection: 'column',
                        justifyContent: 'space-between',
                        borderLeft: isPending ? '4px solid #f59e0b' : isApproved ? '4px solid #10b981' : '4px solid #ef4444',
                        animationDelay: `${Math.min(idx * 0.04, 0.4)}s`
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                          <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                            {branchName}
                          </span>
                          {isApproved ? (
                            <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle size={11} /> Access Granted
                            </span>
                          ) : isPending ? (
                            <span className="badge badge-gold" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={11} /> Pending Approval
                            </span>
                          ) : (
                            <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <ShieldAlert size={11} /> Declined
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
                          {b.cover_url ? (
                            <div style={{ width: '64px', height: '88px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border-glass)' }}>
                              <img src={b.cover_url} alt={bookTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            </div>
                          ) : (
                            <div style={{ width: '64px', height: '88px', borderRadius: '6px', background: 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0, border: '1px solid var(--border-glass)' }}>
                              <BookOpen size={24} />
                            </div>
                          )}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0', lineHeight: 1.3 }}>
                              {bookTitle}
                            </h4>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
                              by {bookAuthor}
                            </p>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={11} /> Requested: {formattedDate}
                            </div>
                          </div>
                        </div>

                        <div style={{
                          padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.76rem',
                          background: isApproved ? 'rgba(16, 185, 129, 0.08)' : isPending ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                          border: isApproved ? '1px solid rgba(16, 185, 129, 0.2)' : isPending ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                          color: isApproved ? '#34d399' : isPending ? '#fbbf24' : '#f87171',
                          lineHeight: 1.4
                        }}>
                          {isApproved
                            ? "✓ You have full reading clearance. You can read online anytime or view associated materials."
                            : isPending
                            ? "⏳ Your request is under review by library administration. You will be notified as soon as it's processed."
                            : "✕ Access was declined by administration for this period. You may submit a fresh request if needed."}
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px', display: 'flex', gap: '8px' }}>
                        {isApproved ? (
                          <>
                            <button
                              onClick={() => handleOpenBook(b)}
                              className="btn btn-primary btn-shine"
                              style={{ flex: 1, padding: '8px 14px', fontSize: '0.82rem', gap: '6px' }}
                            >
                              <BookOpen size={14} /> Read Now
                            </button>
                            {(b.drive_link || b.drive_file_id || b.pdf_url) && (
                              <button
                                onClick={() => handleDownload(b)}
                                className="btn btn-secondary"
                                style={{ padding: '8px 12px' }}
                                title="Download / Open in Drive"
                              >
                                <Download size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => setSharingBook(b)}
                              className="btn btn-secondary"
                              style={{ padding: '8px 12px' }}
                              title="Share Book Link"
                            >
                              <Share2 size={14} />
                            </button>
                          </>
                        ) : isPending ? (
                          <button
                            onClick={() => handleCancelRequest(req.id, bookTitle)}
                            className="btn btn-secondary"
                            style={{ width: '100%', fontSize: '0.82rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', gap: '6px' }}
                            disabled={actionLoading[`cancel-${req.id}`]}
                          >
                            <X size={14} /> {actionLoading[`cancel-${req.id}`] ? 'Cancelling...' : 'Cancel Request'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRequestAccess((b && b.id) ? b : { id: req.book_id, title: bookTitle, branch_id: req.branch_id, branch_name: branchName })}
                            className="btn btn-primary btn-shine"
                            style={{ width: '100%', fontSize: '0.82rem', gap: '6px' }}
                            disabled={actionLoading[`book-${b?.id || req.book_id}`]}
                          >
                            <RefreshCw size={13} /> {actionLoading[`book-${b?.id || req.book_id}`] ? 'Submitting...' : 'Request Again'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="animate-section-enter">
            <div className="glass-panel catalog-search-panel" style={{ padding: '16px 18px', marginBottom: '22px' }}>
              <div className="catalog-search-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <div style={{ flex: '1 1 240px', position: 'relative' }}>
                  <div className="search-input-wrapper">
                    <span className="search-icon">
                      <Search size={16} />
                    </span>
                    <input
                      type="text"
                      className="glass-input has-search-icon"
                      placeholder="Search books by title, author, topic, branch..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ width: '100%' }}
                    />
                    {search && (
                      <button
                        className="search-clear-btn"
                        onClick={() => setSearch('')}
                        title="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ flex: '1 1 180px' }}>
                  <select
                    className="glass-input glass-select"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={String(cat.id)}>
                        {cat.name} {cat.parent_name ? `(${cat.parent_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: '1 1 180px' }}>
                  <select
                    className="glass-input glass-select"
                    value={selectedBranch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedBranch(val);
                      if (val) setActiveTab('all');
                    }}
                    style={{ width: '100%' }}
                  >
                    <option value="">All Branches</option>
                    {branches
                      .filter(br => !br.name.toLowerCase().includes('syllabus'))
                      .map(br => (
                        <option key={br.id} value={String(br.id)}>{br.name}</option>
                    ))}
                  </select>
                </div>

                {(search || selectedCategory || selectedBranch || activeTab !== 'all') && (
                  <button
                    onClick={() => { setSearch(''); setSelectedCategory(''); setSelectedBranch(''); setActiveTab('all'); }}
                    className="btn btn-secondary"
                    style={{ padding: '9px 14px', fontSize: '0.8rem', whiteSpace: 'nowrap', gap: '6px' }}
                    title="Reset all search and department filters"
                  >
                    <X size={13} /> Reset Filters
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--border-glass)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Quick Filter:
                </span>
                <div className="quick-filter-scroll" style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: 'max-content' }}>
                    <button
                      onClick={() => { setActiveTab('all'); setSelectedBranch(''); }}
                      style={{
                        padding: '5px 12px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: activeTab === 'all' && !selectedBranch ? 'var(--primary-glow)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'),
                        color: activeTab === 'all' && !selectedBranch ? 'var(--primary)' : 'var(--text-secondary)',
                        border: activeTab === 'all' && !selectedBranch ? '1px solid var(--primary)' : '1px solid var(--border-glass)'
                      }}
                    >
                      All Catalog ({books.length})
                    </button>
                    <button
                      onClick={() => { setSelectedBranch(''); setActiveTab('home'); }}
                      style={{
                        padding: '5px 12px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: activeTab === 'home' && !selectedBranch ? 'var(--primary-glow)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'),
                        color: activeTab === 'home' && !selectedBranch ? 'var(--primary)' : 'var(--text-secondary)',
                        border: activeTab === 'home' && !selectedBranch ? '1px solid var(--primary)' : '1px solid var(--border-glass)'
                      }}
                    >
                      Home Branch ({homeBooksCount})
                    </button>
                    <button
                      onClick={() => { setSelectedBranch(''); setActiveTab('other'); }}
                      style={{
                        padding: '5px 12px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: activeTab === 'other' && !selectedBranch ? 'var(--primary-glow)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'),
                        color: activeTab === 'other' && !selectedBranch ? 'var(--primary)' : 'var(--text-secondary)',
                        border: activeTab === 'other' && !selectedBranch ? '1px solid var(--primary)' : '1px solid var(--border-glass)'
                      }}
                    >
                      Other Branches ({otherBooksCount})
                    </button>
                    <button
                      onClick={() => { setSelectedBranch(''); setActiveTab('out_of_syllabus'); }}
                      style={{
                        padding: '5px 12px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: activeTab === 'out_of_syllabus' && !selectedBranch ? (isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.12)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'),
                        color: activeTab === 'out_of_syllabus' && !selectedBranch ? (isDark ? '#fbbf24' : '#b45309') : 'var(--text-secondary)',
                        border: activeTab === 'out_of_syllabus' && !selectedBranch ? '1px solid #f59e0b' : '1px solid var(--border-glass)',
                        display: 'flex', alignItems: 'center', gap: '5px'
                      }}
                    >
                      <Sparkles size={12} />
                      Out of Syllabus ({outOfSyllabusBooksCount})
                    </button>
                    <button
                      onClick={() => { setActiveTab('requests'); }}
                      style={{
                        padding: '5px 12px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: activeTab === 'requests' ? 'var(--primary-glow)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'),
                        color: activeTab === 'requests' ? 'var(--primary)' : 'var(--text-secondary)',
                        border: activeTab === 'requests' ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                        display: 'flex', alignItems: 'center', gap: '5px'
                      }}
                    >
                      <BookMarked size={12} />
                      My Requests ({requests.length})
                    </button>
                    <button
                      onClick={() => { setActiveTab('projects'); }}
                      style={{
                        padding: '5px 12px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: (activeTab === 'projects' || activeTab === 'majors-minors') ? 'var(--primary-glow)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'),
                        color: (activeTab === 'projects' || activeTab === 'majors-minors') ? 'var(--primary)' : 'var(--text-secondary)',
                        border: (activeTab === 'projects' || activeTab === 'majors-minors') ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                        display: 'flex', alignItems: 'center', gap: '5px'
                      }}
                    >
                      <Rocket size={12} />
                      Projects Showcase
                    </button>
                  </div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Showing <strong style={{ color: 'var(--text-primary)' }}>{filteredBooks.length}</strong> of {books.length} books
                </span>
              </div>
            </div>

            {/* Department Access Context Banner */}
            {activeTab === 'home' && (
              <div className="dept-context-banner" style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                color: '#4ade80',
                fontSize: '0.82rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <CheckCircle size={16} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Home Department Catalog:</strong> All books in your department (<strong>{user?.branchName || 'Your Branch'}</strong>) are unlocked for immediate reading and download. No permission required!
                </span>
              </div>
            )}

            {activeTab === 'other' && (
              <div className="dept-context-banner" style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                color: '#60a5fa',
                fontSize: '0.82rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Cross-Department Books:</strong> As per college policy, accessing books outside your registered department requires permission from the Central Library Administrator. Click <strong>"Request Access"</strong> on any book to get approved.
                </span>
              </div>
            )}

            {activeTab === 'out_of_syllabus' && (
              <div className="dept-context-banner" style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#fbbf24',
                fontSize: '0.82rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Sparkles size={16} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Out of Syllabus Collection:</strong> Curated extra-curricular, competitive exams, personality development, and general reading literature outside regular departmental syllabus.
                </span>
              </div>
            )}

            {filteredBooks.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title={activeTab === 'home' ? `No books available in ${user?.branchName || 'your branch'} yet` : "No books match your criteria"}
                description={activeTab === 'home'
                  ? "Your department catalog is currently empty. Browse the full library catalog to find available books."
                  : "Try clearing your search query or switching to another department category."}
                actionLabel={activeTab === 'home' ? `Browse All Catalog (${books.length})` : "Reset Search Filters"}
                onAction={activeTab === 'home'
                  ? () => { setActiveTab('all'); setSelectedBranch(''); }
                  : () => { setSearch(''); setSelectedCategory(''); setSelectedBranch(''); setActiveTab('all'); }}
              />
            ) : (
              <>
                <div className="book-pinterest-grid">
                {filteredBooks.slice(0, visibleCount).map((book, idx) => {
                  const access = getBookAccess(book);
                  const hasDrive = !!(book.drive_link || book.drive_file_id);
                  const hasPdf = !!book.pdf_url;
                  return (
                    <div
                      key={book.id}
                      className="book-pinterest-card animate-stagger-in"
                      style={{
                        animationDelay: `${Math.min(idx * 0.03, 0.35)}s`
                      }}
                    >
                      {/* Realistic 3D Physical Book Container */}
                      <div
                        className="realistic-book-wrapper"
                        onClick={() => access.hasAccess ? handleOpenBook(book) : handleRequestAccess(book)}
                        title={access.hasAccess ? `Click to read "${book.title}"` : `Click to request access for "${book.title}"`}
                      >
                        <div className="realistic-book-cover">
                          {/* Book Spine Crease & Hinge Shadow */}
                          <div className="book-spine-crease" />
                          {/* Paper Page Edge */}
                          <div className="book-page-edge" />

                          {/* Fluid Book Cover Image */}
                          {book.cover_url ? (
                            <img
                              src={book.cover_url}
                              alt={book.title}
                              className="realistic-book-img"
                              loading={idx < 4 ? "eager" : "lazy"}
                              decoding="async"
                              fetchPriority={idx < 4 ? "high" : "low"}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fb = e.currentTarget.parentElement?.querySelector('.realistic-book-fallback');
                                if (fb) fb.style.display = 'flex';
                              }}
                            />
                          ) : null}

                          {/* Fallback Physical Hardcover (when cover_url is absent or fails) */}
                          <div
                            className="realistic-book-fallback"
                            style={{ display: book.cover_url ? 'none' : 'flex' }}
                          >
                            <div>
                              <div className="fallback-sistec-seal">
                                <Library size={13} /> SISTec Library
                              </div>
                              <div className="fallback-emboss-title" style={{ marginTop: '14px' }}>
                                {book.title}
                              </div>
                              <div className="fallback-emboss-author">
                                {book.author || 'Department Resource'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)' }}>
                              <span>{book.branch_name || 'Central Edition'}</span>
                              <BookOpen size={15} style={{ opacity: 0.6 }} />
                            </div>
                          </div>

                          {/* Interactive Hover Pill */}
                          <div className="book-cover-hover-overlay">
                            <div className="book-hover-pill">
                              {access.hasAccess ? (
                                <>
                                  <BookOpen size={13} /> Read Book
                                </>
                              ) : (
                                <>
                                  <Lock size={13} /> Request Access
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Book Metadata & Badges */}
                      <div className="book-card-body">
                        <div className="book-card-badges" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '6px' }}>
                          <div className="book-card-badges-left" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {book.priority === 'main' ? (
                              <span className="badge badge-gold">Main Syllabus</span>
                            ) : (
                              <span className="badge badge-secondary">Reference</span>
                            )}
                            <span className="badge" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', color: 'var(--text-secondary)' }}>
                              {book.branch_name || 'All Branches'}
                            </span>
                            {hasDrive && (
                              <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontSize: '0.62rem' }}>
                                Drive
                              </span>
                            )}
                          </div>

                          {access.hasAccess ? (
                            <span className="badge badge-success" title={access.isHomeBranch ? "Unlocked for your department" : "Permission granted by Admin"}>
                              <Unlock size={11} /> {access.isHomeBranch ? "Unlocked" : "Granted"}
                            </span>
                          ) : (
                            <span className="badge badge-danger" title="Access requires admin permission">
                              <Lock size={11} /> Locked
                            </span>
                          )}
                        </div>

                        <h4
                          className="book-card-title"
                          style={{
                            fontSize: '0.86rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            lineHeight: 1.25,
                            minHeight: '2.5em',
                            marginBottom: '4px',
                            cursor: 'pointer',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                          onClick={() => access.hasAccess ? handleOpenBook(book) : handleRequestAccess(book)}
                          title={book.title}
                        >
                          {book.title}
                        </h4>
                        <p
                          className="book-card-author"
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-secondary)',
                            marginBottom: '4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={book.author || 'Author not specified'}
                        >
                          by {book.author || 'Author not specified'}
                        </p>
                        {!hasDrive && !hasPdf && (
                          <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginBottom: '6px', fontStyle: 'italic' }}>
                            Preview only — no file linked yet
                          </div>
                        )}
                      </div>

                      {/* Card Action Controls */}
                      <div className="book-card-footer" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '8px', marginTop: '6px' }}>
                        <div className="book-card-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.category_name || 'General Engineering'}</span>
                        </div>

                        <div className="book-card-actions" style={{ display: 'flex', gap: '5px' }}>
                          {access.hasAccess ? (
                            <>
                              <button
                                onClick={() => handleOpenBook(book)}
                                className="btn btn-primary btn-shine btn-read-primary"
                                style={{ flex: 1, padding: '6px 8px', fontSize: '0.78rem', gap: '4px' }}
                              >
                                <BookOpen size={13} /> Read
                              </button>
                              {(hasDrive || hasPdf) && (
                                <button
                                  onClick={() => handleDownload(book)}
                                  className="btn btn-secondary btn-icon-action"
                                  style={{ padding: '6px 8px' }}
                                  title="Download / Open in Drive"
                                >
                                  <Download size={13} />
                                </button>
                              )}
                              <button
                                onClick={() => setSharingBook(book)}
                                className="btn btn-secondary btn-icon-action"
                                style={{ padding: '6px 8px' }}
                                title="Share Book Link"
                              >
                                <Share2 size={13} />
                              </button>
                              <button
                                onClick={() => setOverviewBook(book)}
                                className="btn btn-ghost btn-icon-action"
                                style={{ padding: '6px 6px' }}
                                title="View Details & Overview"
                              >
                                <Info size={13} />
                              </button>
                            </>
                          ) : access.status === 'pending' ? (
                            <div className="book-card-actions" style={{ display: 'flex', gap: '5px', width: '100%' }}>
                              <button
                                className="btn btn-secondary btn-read-primary"
                                style={{ flex: 1, cursor: 'not-allowed', fontSize: '0.76rem', opacity: 0.9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                                disabled
                              >
                                <Clock size={13} /> Pending
                              </button>
                              {(() => {
                                const matchReq = requests.find(r => book.id != null && r.book_id != null && String(r.book_id) === String(book.id) && r.status === 'pending');
                                return matchReq ? (
                                  <button
                                    onClick={() => handleCancelRequest(matchReq.id, book.title)}
                                    className="btn btn-secondary btn-icon-action"
                                    style={{ padding: '8px 10px', fontSize: '0.78rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                    title="Cancel Request"
                                    disabled={actionLoading[`cancel-${matchReq.id}`]}
                                  >
                                    <X size={14} />
                                  </button>
                                ) : null;
                              })()}
                              <button
                                onClick={() => setSharingBook(book)}
                                className="btn btn-secondary btn-icon-action"
                                style={{ padding: '8px 10px' }}
                                title="Share Book Link"
                              >
                                <Share2 size={14} />
                              </button>
                              <button
                                onClick={() => setOverviewBook(book)}
                                className="btn btn-ghost btn-icon-action"
                                style={{ padding: '8px 8px' }}
                                title="View Details & Overview"
                              >
                                <Info size={14} />
                              </button>
                            </div>
                          ) : access.status === 'rejected' ? (
                            <div className="book-card-actions" style={{ display: 'flex', gap: '6px', width: '100%' }}>
                              <button
                                onClick={() => handleRequestAccess(book)}
                                className="btn btn-danger btn-read-primary"
                                style={{ flex: 1, fontSize: '0.76rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                disabled={actionLoading[`book-${book.id}`]}
                              >
                                <ShieldAlert size={13} /> {actionLoading[`book-${book.id}`] ? 'Submitting...' : 'Request Again'}
                              </button>
                              <button
                                onClick={() => setSharingBook(book)}
                                className="btn btn-secondary btn-icon-action"
                                style={{ padding: '8px 10px' }}
                                title="Share Book Link"
                              >
                                <Share2 size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="book-card-actions" style={{ display: 'flex', gap: '6px', width: '100%' }}>
                              <button
                                onClick={() => handleRequestAccess(book)}
                                className="btn btn-primary btn-shine btn-read-primary"
                                style={{ flex: 1, fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                disabled={actionLoading[`book-${book.id}`]}
                              >
                                <Lock size={13} /> {actionLoading[`book-${book.id}`] ? 'Requesting...' : 'Request Access'}
                              </button>
                              <button
                                onClick={() => setSharingBook(book)}
                                className="btn btn-secondary btn-icon-action"
                                style={{ padding: '8px 10px' }}
                                title="Share Book Link"
                              >
                                <Share2 size={14} />
                              </button>
                              <button
                                onClick={() => setOverviewBook(book)}
                                className="btn btn-ghost btn-icon-action"
                                style={{ padding: '8px 8px' }}
                                title="View Details & Overview"
                              >
                                <Info size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {visibleCount < filteredBooks.length && (
                <div style={{ textAlign: 'center', marginTop: '36px', marginBottom: '36px' }}>
                  <button
                    onClick={() => setVisibleCount(prev => Math.min(prev + 36, filteredBooks.length))}
                    className="btn btn-secondary"
                    style={{
                      padding: '12px 28px',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      borderRadius: '9999px',
                      background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(15, 23, 42, 0.12)',
                      backdropFilter: 'blur(10px)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    <BookOpen size={16} /> Load More Books ({filteredBooks.length - visibleCount} more)
                  </button>
                </div>
              )}
              {/* Auto-Streaming Infinite Scroll Sentinel */}
              <div ref={scrollSentinelRef} style={{ height: '24px', margin: '8px 0', pointerEvents: 'none' }} />
              <div className="catalog-mobile-spacer" />
              </>
            )}
          </div>
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tabKey) => {
          setActiveTab(tabKey);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenMenu={() => {}}
        badges={{ requests: pendingRequestsCount }}
      />

      {/* Share Book Link Modal */}
      {sharingBook && (
        <ShareBookModal
          book={sharingBook}
          onClose={() => setSharingBook(null)}
          onShowFeedback={showFeedback}
        />
      )}

      {/* Dynamic Book Overview & Permission Dossier Modal */}
      {overviewBook && (
        <BookOverviewModal
          book={overviewBook}
          user={user}
          accessInfo={getBookAccess(overviewBook)}
          onRequestAccess={async (b) => {
            await handleRequestAccess(b);
            // Refresh requests so the modal immediately transitions to pending status
            try {
              const reqs = await apiCall('/permissions/my-requests');
              setRequests(reqs || []);
            } catch {}
          }}
          onRead={(b) => {
            setOverviewBook(null);
            handleOpenBook(b);
          }}
          onShare={(b) => setSharingBook(b)}
          onClose={() => {
            setOverviewBook(null);
            if (typeof window !== 'undefined') {
              try {
                const url = new URL(window.location.href);
                url.searchParams.delete('book');
                if (url.hash && url.hash.includes('book=')) {
                  const [hashPath] = url.hash.split('?');
                  url.hash = hashPath === '#' ? '' : hashPath;
                }
                window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : ''));
              } catch {}
            }
          }}
          requestLoading={Boolean(actionLoading[`book-${overviewBook.id}`])}
        />
      )}
    </div>
  );
};

export default StudentDashboard;
