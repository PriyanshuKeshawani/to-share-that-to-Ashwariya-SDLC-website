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
  Sparkles,
  Sun,
  Moon,
  Share2,
  RefreshCw
} from 'lucide-react';
import ShareBookModal from '../components/ShareBookModal';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Polyfills for modern TC39 proposals required by modern pdfjs-dist workers and range chunkers
if (typeof Map !== 'undefined') {
  if (!Map.prototype.getOrInsertComputed) {
    Map.prototype.getOrInsertComputed = function (key, callbackFn) {
      if (this.has(key)) return this.get(key);
      const val = callbackFn(key);
      this.set(key, val);
      return val;
    };
  }
  if (!Map.prototype.getOrInsert) {
    Map.prototype.getOrInsert = function (key, defaultValue) {
      if (this.has(key)) return this.get(key);
      this.set(key, defaultValue);
      return defaultValue;
    };
  }
}
if (typeof Uint8Array !== 'undefined' && !Uint8Array.prototype.toHex) {
  Uint8Array.prototype.toHex = function () {
    return Array.from(this, b => b.toString(16).padStart(2, '0')).join('');
  };
}

// Configure PDF.js worker reliably for Vite dev server and production bundle
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
}

const TAG_COLORS = {
  Concept: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' },
  'Exam Imp': { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' },
  Formula: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' },
  Summary: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' },
};

/**
 * Smart Dark Reading Mode Canvas Transformer
 * Dynamically transforms rendered PDF pages into a comfortable dark reading mode:
 * - Converts harsh white paper to comfortable dark charcoal (#11141c)
 * - Converts dark ink/text to an eye-friendly off-white (#e2e8f0) with high contrast
 * - Preserves smooth font anti-aliasing without jaggedness or white halos
 * - Preserves colored visual content (diagrams, charts, illustrations, logos, highlights)
 * - Gently enhances contrast for very dark colored elements so they remain legible
 * - Leaves layout, zoom, and canvas dimensions completely untouched
 */
const applySmartDarkModeToCanvas = (ctx, width, height) => {
  if (!ctx || width <= 0 || height <= 0) return;
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    const len = d.length;

    // Target dark charcoal background (#11141c) and soft off-white text (#e2e8f0)
    const BG_R = 17;
    const BG_G = 20;
    const BG_B = 28;
    const TEXT_R = 226;
    const TEXT_G = 232;
    const TEXT_B = 240;

    for (let i = 0; i < len; i += 4) {
      // Skip transparent pixels
      if (d[i + 3] < 10) continue;

      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];

      const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const sat = max - min;

      // Perceived luminance (standard Rec. 601 coefficients)
      const lum = (r * 299 + g * 587 + b * 114) * 0.001;
      const factor = lum * 0.00392157; // lum / 255

      // Smooth interpolation between dark background and comfortable light text
      const darkR = BG_R * factor + TEXT_R * (1 - factor);
      const darkG = BG_G * factor + TEXT_G * (1 - factor);
      const darkB = BG_B * factor + TEXT_B * (1 - factor);

      if (sat <= 18) {
        // Pure neutral text, paper, or font anti-aliasing gradient
        d[i] = darkR;
        d[i + 1] = darkG;
        d[i + 2] = darkB;
      } else {
        // Colored visual content (diagrams, graphs, charts, photos, illustrations)
        const colorWeight = sat >= 40 ? 1 : (sat - 18) * 0.04545; // (sat - 18) / 22
        let colR = r;
        let colG = g;
        let colB = b;

        // Enhance legibility of very dark colored elements against dark charcoal
        if (lum < 60) {
          const boost = 1 + (60 - lum) * 0.01;
          colR = colR * boost;
          colG = colG * boost;
          colB = colB * boost;
        }

        d[i] = darkR * (1 - colorWeight) + colR * colorWeight;
        d[i + 1] = darkG * (1 - colorWeight) + colG * colorWeight;
        d[i + 2] = darkB * (1 - colorWeight) + colB * colorWeight;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.warn('Notice applying smart dark reading mode:', err);
  }
};

const MOBILE_ZOOM_STEPS = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0, 2.5];
const DESKTOP_ZOOM_STEPS = [0.75, 0.85, 1.0, 1.15, 1.30, 1.50, 1.75, 2.0, 2.25, 2.50];

const BookReader = ({ book, onClose }) => {
  const { apiCall, user, extractDriveFileId } = useAuth();
  const { mode, toggleMode } = useTheme();
  const isDark = mode === 'dark';
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(book?.total_pages && book.total_pages > 0 ? book.total_pages : 100);
  const [scale, setScale] = useState(1.15);
  const [mobileZoom, setMobileZoom] = useState(1.0); // Mobile zoom multiplier (1.0 = Fit to Screen, up to 2.5x)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const lastPanTouchRef = useRef(null);
  const isPanningRef = useRef(false);
  const holderLeftRef = useRef(null);
  const holderRightRef = useRef(null);
  const [viewMode, setViewMode] = useState('single'); // 'single' (focused) or 'spread' (open 2-page book)
  const [useNativeViewer, setUseNativeViewer] = useState(false);
  const [isFlipping, setIsFlipping] = useState(null); // 'next' | 'prev' | null
  const [dragCurl, setDragCurl] = useState({
    active: false,
    direction: null, // 'next' | 'prev'
    progress: 0,
    startX: 0,
    startY: 0
  });
  const [saving, setSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
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

  // Touchscreen swipe, 4-direction pan, & pinch-to-zoom support for mobile
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);
  const pinchStartDistRef = useRef(null);
  const initialPinchZoomRef = useRef(1.0);

  // Desktop Zoom control steps helper functions (up to 250%)
  const handleDesktopZoomIn = useCallback(() => {
    const current = Number(scale.toFixed(2));
    const next = DESKTOP_ZOOM_STEPS.find(s => s > current + 0.01) || 2.5;
    setScale(next);
  }, [scale]);

  const handleDesktopZoomOut = useCallback(() => {
    const current = Number(scale.toFixed(2));
    const prev = [...DESKTOP_ZOOM_STEPS].reverse().find(s => s < current - 0.01) || 0.75;
    setScale(prev);
  }, [scale]);

  // Zoom control steps helper functions (10% clean steps: 100% -> 110% -> 120% -> ...)
  const handleMobileZoomIn = useCallback(() => {
    const current = Number(mobileZoom.toFixed(2));
    const next = MOBILE_ZOOM_STEPS.find(s => s > current + 0.01) || 2.5;
    setMobileZoom(next);
  }, [mobileZoom]);

  const handleMobileZoomOut = useCallback(() => {
    const current = Number(mobileZoom.toFixed(2));
    const prev = [...MOBILE_ZOOM_STEPS].reverse().find(s => s < current - 0.01) || 0.8;
    setMobileZoom(prev);
    if (prev <= 1.05) {
      setPanOffset({ x: 0, y: 0 });
      panOffsetRef.current = { x: 0, y: 0 };
      if (holderLeftRef.current) holderLeftRef.current.style.transform = 'translate3d(0px, 0px, 0)';
      if (holderRightRef.current) holderRightRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
  }, [mobileZoom]);

  const handleMobileZoomReset = useCallback(() => {
    setMobileZoom(1.0);
    setPanOffset({ x: 0, y: 0 });
    panOffsetRef.current = { x: 0, y: 0 };
    if (holderLeftRef.current) holderLeftRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    if (holderRightRef.current) holderRightRef.current.style.transform = 'translate3d(0px, 0px, 0)';
  }, []);

  const handleTouchStart = (e) => {
    if (!e.touches) return;

    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      pinchStartDistRef.current = null;

      // When zoomed in on mobile, initiate 4-direction pan dragging
      if (mobileZoom > 1.05) {
        isPanningRef.current = true;
        lastPanTouchRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
      } else {
        isPanningRef.current = false;
        lastPanTouchRef.current = null;
      }
    } else if (e.touches.length === 2) {
      // Two-finger pinch gesture start
      isPanningRef.current = false;
      lastPanTouchRef.current = null;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.hypot(dx, dy);
      initialPinchZoomRef.current = mobileZoom;
      touchStartXRef.current = null;
      touchStartYRef.current = null;
    }
  };

  const handleTouchMove = (e) => {
    if (!e.touches) return;

    // 1. Two-finger pinch gesture
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDist = Math.hypot(dx, dy);
      const ratio = currentDist / pinchStartDistRef.current;
      const targetZoom = Math.min(2.5, Math.max(0.8, Number((initialPinchZoomRef.current * ratio).toFixed(2))));
      setMobileZoom(targetZoom);
      if (targetZoom <= 1.05) {
        setPanOffset({ x: 0, y: 0 });
        panOffsetRef.current = { x: 0, y: 0 };
        if (holderLeftRef.current) holderLeftRef.current.style.transform = 'translate3d(0px, 0px, 0)';
        if (holderRightRef.current) holderRightRef.current.style.transform = 'translate3d(0px, 0px, 0)';
      }
      return;
    }

    // 2. Single-finger 4-direction panning when zoomed in
    if (e.touches.length === 1 && isPanningRef.current && mobileZoom > 1.05 && lastPanTouchRef.current) {
      const curX = e.touches[0].clientX;
      const curY = e.touches[0].clientY;
      const deltaX = curX - lastPanTouchRef.current.x;
      const deltaY = curY - lastPanTouchRef.current.y;
      lastPanTouchRef.current = { x: curX, y: curY };

      // Dynamic bounds based on rendered canvas size vs screen viewport
      const canvasEl = canvasLeftRef.current;
      const canvasW = canvasEl?.offsetWidth || (window.innerWidth * mobileZoom);
      const canvasH = canvasEl?.offsetHeight || ((window.innerHeight || 640) * mobileZoom);
      const viewW = window.innerWidth;
      const viewH = Math.max(300, (window.innerHeight || 640) - 110);

      const maxPanX = Math.max(50, (canvasW - viewW) / 2 + 70);
      const maxPanY = Math.max(50, (canvasH - viewH) / 2 + 90);

      const nextX = Math.min(maxPanX, Math.max(-maxPanX, panOffsetRef.current.x + deltaX));
      const nextY = Math.min(maxPanY, Math.max(-maxPanY, panOffsetRef.current.y + deltaY));

      panOffsetRef.current = { x: nextX, y: nextY };

      // 60fps hardware-accelerated movement
      if (holderLeftRef.current) {
        holderLeftRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
      }
      if (holderRightRef.current) {
        holderRightRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      lastPanTouchRef.current = null;
      // Sync final pan position to React state
      setPanOffset({ ...panOffsetRef.current });
    }

    if (e.touches && e.touches.length < 2) {
      pinchStartDistRef.current = null;
    }

    if (touchStartXRef.current === null || !e.changedTouches || e.changedTouches.length === 0) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Only allow swipe page flip when NOT zoomed in (prevents accidental flips while panning)
    if (mobileZoom <= 1.05 && Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
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
  const [pdfLoading, setPdfLoading] = useState(() => Boolean(book?.pdf_url));
  const [pdfLoadError, setPdfLoadError] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Canvases refs & deterministic rendering state
  const canvasLeftRef = useRef(null);
  const canvasRightRef = useRef(null);
  const activeRenderTasks = useRef({});
  const renderSeqRef = useRef({ left: 0, right: 0 });
  const pageCacheRef = useRef(new Map());
  const failedPagesRef = useRef(new Set());
  const loadingModeRef = useRef('stream'); // 'stream' (Tier 1 fast path) | 'buffer' (Tier 2 in-memory fallback)
  const fallbackLoadingRef = useRef(false);
  const bufferDocRef = useRef(null);
  const bufferDocPromiseRef = useRef(null);

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

  // Resilient In-Memory Buffer Provider: caches ArrayBuffer and Document instance
  const getOrFetchBufferDoc = useCallback(async () => {
    if (bufferDocRef.current) return bufferDocRef.current;
    if (bufferDocPromiseRef.current) return bufferDocPromiseRef.current;

    bufferDocPromiseRef.current = (async () => {
      try {
        console.info('[3D Book Engine] Ingesting in-memory book buffer in background...');
        const response = await fetch(pdfSource);
        if (!response.ok) {
          throw new Error(`Failed to download book buffer: HTTP ${response.status}`);
        }

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let buffer;

        if (response.body && total > 0) {
          const reader = response.body.getReader();
          let receivedLength = 0;
          const chunks = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
            const pct = Math.min(99, Math.round((receivedLength / total) * 100));
            setDownloadProgress(pct);
          }
          const fullArray = new Uint8Array(receivedLength);
          let position = 0;
          for (const chunk of chunks) {
            fullArray.set(chunk, position);
            position += chunk.length;
          }
          buffer = fullArray.buffer;
        } else {
          buffer = await response.arrayBuffer();
        }

        setDownloadProgress(100);

        const cMapUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`;
        const standardFontDataUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`;
        const wasmUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/wasm/`;
        const bufferTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
          cMapUrl,
          cMapPacked: true,
          standardFontDataUrl,
          wasmUrl
        });

        const doc = await bufferTask.promise;
        bufferDocRef.current = doc;
        console.info(`[3D Book Engine] In-memory buffer ready with ${doc.numPages} pages.`);
        return doc;
      } catch (err) {
        console.warn('[3D Book Engine] Background buffer ingestion error:', err);
        bufferDocPromiseRef.current = null;
        throw err;
      }
    })();

    return bufferDocPromiseRef.current;
  }, [pdfSource]);

  // Two-Tier PDF Document Loading: Fast Progressive Streaming (Tier 1) & In-Memory Buffer Fallback (Tier 2)
  const loadFullDocumentFallback = useCallback(async (reason) => {
    if (fallbackLoadingRef.current || !pdfSource) return;
    fallbackLoadingRef.current = true;
    loadingModeRef.current = 'buffer';
    console.info(`[3D Book Engine] Activating Full-Document In-Memory Buffer: ${reason}`);

    try {
      setDownloadProgress(20);
      const fullDoc = await getOrFetchBufferDoc();
      setDownloadProgress(100);
      pageCacheRef.current.clear();
      failedPagesRef.current.clear();
      setPdfDoc(fullDoc);
      if (fullDoc.numPages && fullDoc.numPages > 0) {
        setTotalPages(fullDoc.numPages);
      }
      setPdfLoadError(null);
      console.info(`[3D Book Engine] Successfully loaded in-memory book buffer (${fullDoc.numPages} pages). All pages ready for 3D view.`);
    } catch (err) {
      console.error('[3D Book Engine] Full-document buffer fallback failed:', err);
      setPdfLoadError(err.message || 'Unable to load book document');
    } finally {
      fallbackLoadingRef.current = false;
      setPdfLoading(false);
    }
  }, [pdfSource, getOrFetchBufferDoc]);

  // Load PDF document: Tier 1 Fast Path with automatic watchdog and completeness probe
  useEffect(() => {
    if (!pdfSource || useNativeViewer) return;

    let isMounted = true;
    let loadingTask = null;
    let activityTimer = null;
    let lastActivityTime = Date.now();
    setPdfLoading(true);
    setPdfLoadError(null);
    setDownloadProgress(0);
    loadingModeRef.current = 'stream';

    // Proactively start background buffer pre-buffering so subsequent pages never stall
    getOrFetchBufferDoc().catch(() => {});

    const loadPdf = async () => {
      try {
        const cMapUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`;
        const standardFontDataUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`;
        const wasmUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/wasm/`;
        // Progressive streaming with auto-fetch enabled so background prebuffering prevents range starvation
        loadingTask = pdfjsLib.getDocument({
          url: pdfSource,
          withCredentials: false,
          disableAutoFetch: false,
          disableStream: false,
          cMapUrl,
          cMapPacked: true,
          standardFontDataUrl,
          wasmUrl
        });

        // Real-time streaming progress monitor
        loadingTask.onProgress = ({ loaded, total }) => {
          lastActivityTime = Date.now();
          if (total > 0 && isMounted) {
            const pct = Math.min(99, Math.round((loaded / total) * 100));
            setDownloadProgress(pct);
          }
        };

        // Resilient activity-based watchdog
        const watchdogPromise = new Promise((_, reject) => {
          activityTimer = setInterval(() => {
            const now = Date.now();
            if (now - lastActivityTime > 45000) {
              clearInterval(activityTimer);
              reject(new Error('Network connection stalled while streaming book data'));
            }
          }, 3000);
        });

        const doc = await Promise.race([loadingTask.promise, watchdogPromise]);
        if (activityTimer) clearInterval(activityTimer);
        if (!isMounted) return;

        setPdfDoc(doc);
        setDownloadProgress(100);
        if (doc.numPages && doc.numPages > 0) {
          setTotalPages(doc.numPages);
        }

        // Diagnostic Completeness Probe: Non-blocking test of middle and last page access
        if (doc.numPages > 1) {
          const probePages = [
            Math.ceil(doc.numPages / 2),
            doc.numPages
          ];
          (async () => {
            for (const p of probePages) {
              try {
                await doc.getPage(p);
              } catch (probeErr) {
                console.warn(`[3D Book Engine Diagnostic] Stream probe notice on page ${p}:`, probeErr?.message);
                if (isMounted && loadingModeRef.current === 'stream') {
                  loadFullDocumentFallback(`Stream probe failed on page ${p}`);
                }
                break;
              }
            }
          })();
        }
      } catch (err) {
        if (activityTimer) clearInterval(activityTimer);
        if (loadingTask && loadingTask.destroy) {
          try { loadingTask.destroy(); } catch {}
        }
        console.warn('PDF.js stream notice; attempting full-document fallback:', err);
        if (isMounted) {
          // Gracefully upgrade to Tier 2 in-memory buffer rather than failing to a flat viewer
          loadFullDocumentFallback(`Stream initialization error: ${err?.message}`);
        }
      } finally {
        if (isMounted && loadingModeRef.current !== 'buffer') setPdfLoading(false);
      }
    };

    loadPdf();

    // Auto-retry when mobile device reconnects to internet
    const handleOnline = () => {
      if (!isMounted) return;
      setReloadTrigger(prev => prev + 1);
    };
    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      if (activityTimer) clearInterval(activityTimer);
      if (loadingTask && loadingTask.destroy) {
        try { loadingTask.destroy(); } catch {}
      }
      window.removeEventListener('online', handleOnline);
    };
  }, [pdfSource, useNativeViewer, reloadTrigger, loadFullDocumentFallback, getOrFetchBufferDoc]);

  // Render an informative, non-blank error notification directly on the canvas
  const renderErrorOnCanvas = useCallback((canvas, pageNum, message) => {
    if (!canvas) return;
    const w = canvas.width || 400;
    const h = canvas.height || 600;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = mode === 'dark' ? '#11141c' : '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mode === 'dark' ? '#f59e0b' : '#d97706';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Page ${pageNum} Render Notice`, w / 2, h / 2 - 15);

    ctx.fillStyle = mode === 'dark' ? '#94a3b8' : '#64748b';
    ctx.font = '12px sans-serif';
    ctx.fillText('Tap page or flip back to reload', w / 2, h / 2 + 15);
  }, [mode]);

  // Deterministic Page Rendering Pipeline with Staging Canvas, Sequence Tickets & LRU Cache
  const MAX_CACHE_SIZE = 25;
  const getCacheKey = useCallback((pageNum, currentMode, currentScale, currentMobileZoom) => {
    return `${pageNum}_${currentMode}_${Math.round(currentScale * 100)}_${Math.round(currentMobileZoom * 100)}`;
  }, []);

  const renderPage = useCallback(async (pageNum, canvasKey, canvasElement) => {
    if (!pdfDoc || !canvasElement || pageNum < 1 || pageNum > pdfDoc.numPages) return;

    // 1. Issue unique sequence ticket for this canvas side to eliminate race conditions
    const ticket = ++renderSeqRef.current[canvasKey];

    // 2. Cancel any pending PDF.js render task on this canvas side
    if (activeRenderTasks.current[canvasKey]) {
      try {
        activeRenderTasks.current[canvasKey].cancel();
      } catch {}
      delete activeRenderTasks.current[canvasKey];
    }

    const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
    const cacheKey = getCacheKey(pageNum, mode, scale, isMobileView ? mobileZoom : 1.0);

    // 3. Fast In-Memory LRU Cache Hit: instant 0ms flip with zero flicker
    if (pageCacheRef.current.has(cacheKey)) {
      const cachedCanvas = pageCacheRef.current.get(cacheKey);
      pageCacheRef.current.delete(cacheKey);
      pageCacheRef.current.set(cacheKey, cachedCanvas);

      if (renderSeqRef.current[canvasKey] === ticket) {
        canvasElement.width = cachedCanvas.width;
        canvasElement.height = cachedCanvas.height;
        canvasElement.style.width = cachedCanvas.style.width;
        canvasElement.style.height = cachedCanvas.style.height;
        const ctx = canvasElement.getContext('2d');
        ctx.drawImage(cachedCanvas, 0, 0);
        failedPagesRef.current.delete(pageNum);
        return;
      }
    }

    // 4. Fetch Page Object from PDF.js (Fast streaming with instant in-memory buffer recovery)
    let page;
    let effectiveDoc = pdfDoc;
    try {
      page = await effectiveDoc.getPage(pageNum);
    } catch (pageErr) {
      console.warn(`[3D Book Engine] Stream getPage(${pageNum}) failed; recovering via in-memory buffer:`, pageErr?.message || pageErr);
      try {
        const bufferDoc = await getOrFetchBufferDoc();
        if (bufferDoc) {
          effectiveDoc = bufferDoc;
          if (pdfDoc !== bufferDoc) {
            setPdfDoc(bufferDoc);
            if (bufferDoc.numPages && bufferDoc.numPages > 0) {
              setTotalPages(bufferDoc.numPages);
            }
          }
          page = await bufferDoc.getPage(pageNum);
        }
      } catch (bufErr) {
        console.error(`[3D Book Engine] Failed to obtain page ${pageNum} from buffer:`, bufErr);
      }

      if (!page) {
        if (renderSeqRef.current[canvasKey] === ticket) {
          renderErrorOnCanvas(canvasElement, pageNum, pageErr?.message || 'Page data missing');
          failedPagesRef.current.add(pageNum);
        }
        return;
      }
    }

    // If another page turn superseded this ticket during getPage, exit cleanly
    if (renderSeqRef.current[canvasKey] !== ticket) return;

    try {
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      if (unscaledViewport.width <= 0 || unscaledViewport.height <= 0) {
        throw new Error('Invalid zero-size page viewport');
      }

      let effectiveScale = scale;
      if (isMobileView) {
        const availableW = Math.max(260, window.innerWidth - 20);
        const availableH = Math.max(360, (window.innerHeight || 640) - 125);
        const scaleX = availableW / unscaledViewport.width;
        const scaleY = availableH / unscaledViewport.height;
        const baseFitScale = Math.min(scaleX, scaleY);
        effectiveScale = baseFitScale * mobileZoom;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: effectiveScale * dpr });

      // 5. Offscreen Staging Canvas: prevents canvas reuse collisions and white-flash artifacts
      const offscreen = document.createElement('canvas');
      offscreen.width = viewport.width;
      offscreen.height = viewport.height;
      const offscreenCtx = offscreen.getContext('2d', { alpha: false });
      // Ensure canvas background is filled with opaque white before page rendering
      // Canvas with alpha:false initializes to black (#000000), which renders transparent/scanned pages completely black!
      offscreenCtx.fillStyle = '#ffffff';
      offscreenCtx.fillRect(0, 0, viewport.width, viewport.height);

      const renderTask = page.render({
        canvasContext: offscreenCtx,
        viewport: viewport
      });

      activeRenderTasks.current[canvasKey] = renderTask;
      await renderTask.promise;
      delete activeRenderTasks.current[canvasKey];

      // Verify sequence ticket is still current before updating DOM
      if (renderSeqRef.current[canvasKey] !== ticket) return;

      // Smart Dark Reading Mode: transform offscreen canvas before display
      if (mode === 'dark') {
        applySmartDarkModeToCanvas(offscreenCtx, offscreen.width, offscreen.height);
      }

      const cssWidth = Math.round(viewport.width / dpr);
      const cssHeight = Math.round(viewport.height / dpr);
      offscreen.style.width = isMobileView && mobileZoom === 1.0 ? '100%' : `${cssWidth}px`;
      offscreen.style.height = isMobileView && mobileZoom === 1.0 ? 'auto' : `${cssHeight}px`;

      // Store in LRU Page Cache
      if (pageCacheRef.current.size >= MAX_CACHE_SIZE) {
        const oldestKey = pageCacheRef.current.keys().next().value;
        pageCacheRef.current.delete(oldestKey);
      }
      pageCacheRef.current.set(cacheKey, offscreen);

      // 6. Atomic blit to visible DOM canvas
      canvasElement.width = offscreen.width;
      canvasElement.height = offscreen.height;
      canvasElement.style.width = offscreen.style.width;
      canvasElement.style.height = offscreen.style.height;

      const ctx = canvasElement.getContext('2d');
      ctx.drawImage(offscreen, 0, 0);
      failedPagesRef.current.delete(pageNum);
    } catch (renderErr) {
      delete activeRenderTasks.current[canvasKey];
      if (renderErr?.name !== 'RenderingCancelledException') {
        console.warn(`[3D Book Engine] Render failure on page ${pageNum}:`, renderErr);
        if (renderSeqRef.current[canvasKey] === ticket) {
          renderErrorOnCanvas(canvasElement, pageNum, renderErr?.message || 'Rendering error');
          failedPagesRef.current.add(pageNum);
        }
      }
    }
  }, [pdfDoc, scale, mobileZoom, mode, loadFullDocumentFallback, getOrFetchBufferDoc, getCacheKey, renderErrorOnCanvas]);

  // Idle preloader for adjacent pages (currentPage + 1, currentPage + 2, currentPage - 1)
  useEffect(() => {
    if (!pdfDoc) return;
    const preloadTimer = setTimeout(async () => {
      const pagesToPreload = [
        currentPage + 1,
        currentPage + 2,
        currentPage - 1
      ].filter(p => p >= 1 && p <= pdfDoc.numPages);

      const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;

      for (const p of pagesToPreload) {
        const key = getCacheKey(p, mode, scale, isMobileView ? mobileZoom : 1.0);
        if (pageCacheRef.current.has(key)) continue;

        try {
          let page;
          try {
            page = await pdfDoc.getPage(p);
          } catch {
            if (bufferDocRef.current) {
              page = await bufferDocRef.current.getPage(p);
            }
          }
          if (!page) continue;
          const unscaledViewport = page.getViewport({ scale: 1.0 });
          let effectiveScale = scale;
          if (isMobileView) {
            const availableW = Math.max(260, window.innerWidth - 20);
            const availableH = Math.max(360, (window.innerHeight || 640) - 125);
            effectiveScale = Math.min(availableW / unscaledViewport.width, availableH / unscaledViewport.height) * mobileZoom;
          }
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale: effectiveScale * dpr });
          const offscreen = document.createElement('canvas');
          offscreen.width = viewport.width;
          offscreen.height = viewport.height;
          const offCtx = offscreen.getContext('2d', { alpha: false });
          offCtx.fillStyle = '#ffffff';
          offCtx.fillRect(0, 0, viewport.width, viewport.height);
          await page.render({ canvasContext: offCtx, viewport }).promise;

          if (mode === 'dark') {
            applySmartDarkModeToCanvas(offCtx, offscreen.width, offscreen.height);
          }

          const cssWidth = Math.round(viewport.width / dpr);
          const cssHeight = Math.round(viewport.height / dpr);
          offscreen.style.width = isMobileView && mobileZoom === 1.0 ? '100%' : `${cssWidth}px`;
          offscreen.style.height = isMobileView && mobileZoom === 1.0 ? 'auto' : `${cssHeight}px`;

          if (pageCacheRef.current.size >= MAX_CACHE_SIZE) {
            const oldestKey = pageCacheRef.current.keys().next().value;
            pageCacheRef.current.delete(oldestKey);
          }
          pageCacheRef.current.set(key, offscreen);
        } catch {
          // Non-critical background preload failure
        }
      }
    }, 400);

    return () => clearTimeout(preloadTimer);
  }, [pdfDoc, currentPage, mode, scale, mobileZoom, getCacheKey]);

  // Re-render canvases when currentPage, scale, mobileZoom, viewMode, mobile breakpoint, or dark/light theme mode changes
  useEffect(() => {
    if (!pdfDoc) return;

    if (canvasLeftRef.current) {
      renderPage(currentPage, 'left', canvasLeftRef.current);
    }

    if (viewMode === 'spread' && !isMobile && canvasRightRef.current && currentPage + 1 <= pdfDoc.numPages) {
      renderPage(currentPage + 1, 'right', canvasRightRef.current);
    }
  }, [pdfDoc, currentPage, scale, mobileZoom, viewMode, isMobile, mode, renderPage]);

  // Page Flip Navigation
  const handlePageChange = useCallback((targetPage, direction = null) => {
    const pageNum = Math.max(1, Math.min(targetPage, totalPages));
    if (pageNum === currentPage) return;

    // Reset pan position on page change so new page is neatly centered
    setPanOffset({ x: 0, y: 0 });
    panOffsetRef.current = { x: 0, y: 0 };
    if (holderLeftRef.current) holderLeftRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    if (holderRightRef.current) holderRightRef.current.style.transform = 'translate3d(0px, 0px, 0)';

    const dir = direction || (pageNum > currentPage ? 'next' : 'prev');
    setIsFlipping(dir);

    setTimeout(() => {
      setCurrentPage(pageNum);
      saveProgress(pageNum);
    }, 180);

    setTimeout(() => {
      setIsFlipping(null);
    }, 450);
  }, [currentPage, totalPages, saveProgress]);

  // Interactive Corner Drag-to-Curl Gesture Handlers (XBPageCurl)
  const handleCornerPointerDown = useCallback((e, direction) => {
    if (isMobile && mobileZoom > 1.05) return;
    if (isFlipping) return;
    if (direction === 'next' && currentPage >= totalPages) return;
    if (direction === 'prev' && currentPage <= 1) return;

    e.preventDefault();
    e.stopPropagation();

    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : null);
    const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    if (clientX == null) return;

    setDragCurl({
      active: true,
      direction,
      progress: 0.05,
      startX: clientX,
      startY: clientY
    });
  }, [isMobile, mobileZoom, isFlipping, currentPage, totalPages]);

  useEffect(() => {
    if (!dragCurl.active) return;

    const onPointerMove = (e) => {
      const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : null);
      if (clientX == null) return;

      const spreadEl = document.querySelector('.book-open-spread');
      const spreadWidth = spreadEl ? spreadEl.getBoundingClientRect().width : window.innerWidth;
      const leafWidth = viewMode === 'spread' && !isMobile ? spreadWidth * 0.5 : spreadWidth;

      const deltaX = dragCurl.direction === 'next'
        ? dragCurl.startX - clientX
        : clientX - dragCurl.startX;

      const progress = Math.max(0, Math.min(1, deltaX / Math.max(140, leafWidth * 0.75)));
      setDragCurl(prev => ({ ...prev, progress }));
    };

    const onPointerUp = () => {
      const { direction, progress } = dragCurl;
      setDragCurl({ active: false, direction: null, progress: 0, startX: 0, startY: 0 });

      if (progress >= 0.20) {
        const step = viewMode === 'spread' && !isMobile ? 2 : 1;
        if (direction === 'next') {
          handlePageChange(currentPage + step, 'next');
        } else {
          handlePageChange(currentPage - step, 'prev');
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };
  }, [dragCurl, viewMode, isMobile, currentPage, handlePageChange]);

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
                  onClick={() => setShowShareModal(true)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 8px', fontSize: '0.78rem' }}
                  title="Share Book Link"
                >
                  <Share2 size={14} />
                </button>

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
            <div className="reader-minimal-bar" role="toolbar" aria-label="PDF Reader Controls">
              {/* Left: Close & Branch */}
              <div className="reader-bar-left">
                <button
                  onClick={onClose}
                  className="btn btn-secondary reader-btn-compact"
                  title="Close Reader (Back to Catalog)"
                  aria-label="Close Reader"
                >
                  <ArrowLeft size={15} />
                  <span className="reader-btn-text">Close</span>
                </button>
                <span
                  className="badge badge-primary reader-branch-badge"
                  title={book.branch_name || 'Engineering'}
                >
                  {book.branch_name || 'Engineering'}
                </span>
              </div>

              {/* Center: Book Title & Active Page Navigator */}
              <div className="reader-bar-center">
                <div
                  className="reader-title-block"
                  title={`${book.title} — By ${book.author || 'Academic Faculty'}`}
                >
                  <div className="reader-book-title">
                    {book.title}
                  </div>
                  <div className="reader-book-author">
                    By {book.author || 'Academic Faculty'}
                  </div>
                </div>

                {/* Central Dynamic Page Stepper */}
                <div className="reader-page-stepper">
                  <button
                    onClick={() => handlePageChange(currentPage - (viewMode === 'spread' ? 2 : 1), 'prev')}
                    disabled={currentPage <= 1}
                    className="btn btn-secondary reader-stepper-btn"
                    style={{ opacity: currentPage <= 1 ? 0.35 : 1 }}
                    title="Previous Page (Left Arrow)"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <div className="reader-stepper-counter">
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
                      className="glass-input reader-page-input"
                      title={`Jump to page (1 - ${totalPages})`}
                      aria-label="Current Page Number"
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>/ {totalPages}</span>
                    <span className="reader-percentage-badge">
                      {Math.min(100, Math.round((currentPage / totalPages) * 100))}%
                    </span>
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + (viewMode === 'spread' ? 2 : 1), 'next')}
                    disabled={currentPage >= totalPages}
                    className="btn btn-secondary reader-stepper-btn"
                    style={{ opacity: currentPage >= totalPages ? 0.35 : 1 }}
                    title="Next Page (Right Arrow)"
                    aria-label="Next Page"
                  >
                    <ChevronRight size={14} />
                  </button>

                  <span
                    className="reader-status-indicator"
                    style={{ color: saving ? '#f59e0b' : '#10b981' }}
                    title={saving ? 'Auto-saving page progress...' : 'Reading progress synced live'}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: saving ? '#f59e0b' : '#10b981',
                        boxShadow: saving ? '0 0 6px #f59e0b' : '0 0 6px #10b981',
                        flexShrink: 0
                      }}
                    />
                    <span>{saving ? 'Saving...' : 'Live'}</span>
                  </span>
                </div>
              </div>

              {/* Right: Interactive Reading Tools (Rigid Single Row) */}
              <div className="reader-bar-right">
                {/* Quick Bookmark Toggle with Ribbon State */}
                <button
                  onClick={() => handleToggleBookmark()}
                  className={`btn ${isCurrentPageBookmarked ? 'btn-primary' : 'btn-secondary'} reader-tool-btn`}
                  style={{
                    background: isCurrentPageBookmarked ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : undefined,
                    borderColor: isCurrentPageBookmarked ? '#ef4444' : undefined,
                    color: isCurrentPageBookmarked ? '#fef08a' : undefined
                  }}
                  title={isCurrentPageBookmarked ? 'Remove Bookmark for this Page' : 'Bookmark this Page'}
                  aria-label="Toggle Bookmark"
                >
                  <Bookmark size={14} fill={isCurrentPageBookmarked ? 'currentColor' : 'none'} />
                  <span className="reader-tool-label primary-label">{isCurrentPageBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
                </button>

                {/* View Mode Toggle: Single Page vs 2-Page Open Book */}
                <button
                  onClick={() => setViewMode(prev => prev === 'single' ? 'spread' : 'single')}
                  className="btn btn-secondary reader-tool-btn"
                  title={viewMode === 'single' ? 'Switch to 2-Page Open Book Spread' : 'Switch to Single Page Focused View'}
                  aria-label="Toggle 2-Page View"
                >
                  {viewMode === 'single' ? <BookOpen size={14} /> : <Book size={14} />}
                  <span className="reader-tool-label primary-label">{viewMode === 'single' ? '2-Page Book' : '1-Page'}</span>
                </button>

                {/* Desktop Zoom Controls (up to 250%) */}
                <div className="reader-zoom-group">
                  <button
                    onClick={handleDesktopZoomOut}
                    className="btn btn-ghost reader-zoom-btn"
                    title="Zoom Out"
                    aria-label="Zoom Out"
                  >
                    <ZoomOut size={13} />
                  </button>
                  <span
                    onClick={() => setScale(1.15)}
                    className="reader-zoom-pct"
                    title="Click to reset to Default (115%)"
                  >
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    onClick={handleDesktopZoomIn}
                    className="btn btn-ghost reader-zoom-btn"
                    title="Zoom In (up to 250%)"
                    aria-label="Zoom In"
                  >
                    <ZoomIn size={13} />
                  </button>
                  {scale !== 1.15 && (
                    <button
                      onClick={() => setScale(1.15)}
                      className="btn btn-ghost reader-zoom-reset"
                      title="Reset to 115% Default"
                      aria-label="Reset Zoom"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Study Notes & Bookmarks Drawer Toggle */}
                <button
                  onClick={() => setShowDrawer(prev => !prev)}
                  className={`btn ${showDrawer ? 'btn-primary' : 'btn-secondary'} reader-tool-btn`}
                  title="Open Study Notes & Bookmarks Drawer"
                  aria-label="Study Notes and Bookmarks"
                >
                  <StickyNote size={14} />
                  <span className="reader-tool-label primary-label">Notes</span>
                  {(notes.length > 0 || bookmarks.length > 0) && (
                    <span className="reader-notes-badge">
                      {notes.length + bookmarks.length}
                    </span>
                  )}
                </button>

                {/* Share Book Link */}
                <button
                  onClick={() => setShowShareModal(true)}
                  className="btn btn-secondary reader-tool-btn"
                  title="Share Book Link"
                  aria-label="Share Book Link"
                >
                  <Share2 size={14} />
                  <span className="reader-tool-label secondary-label">Share</span>
                </button>

                {/* Quick PDF Download */}
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="btn btn-secondary reader-tool-btn"
                  title="Download PDF Document"
                  aria-label="Download PDF Document"
                >
                  <Download size={14} />
                  <span className="reader-tool-label secondary-label">{downloadingPdf ? '...' : 'PDF'}</span>
                </button>

                {/* Day / Night Theme Toggle */}
                <button
                  onClick={toggleMode}
                  className="btn btn-secondary reader-tool-btn"
                  title={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  aria-label="Toggle Light Dark Theme"
                >
                  {mode === 'dark' ? <Sun size={14} color="#fbbf24" /> : <Moon size={14} color="var(--primary)" />}
                  <span className="reader-tool-label secondary-label">{mode === 'dark' ? 'Light' : 'Dark'}</span>
                </button>

                {/* Fullscreen Reading Mode Toggle */}
                <button
                  onClick={toggleFullscreen}
                  className="btn btn-secondary reader-tool-btn"
                  title={isFullscreen ? 'Exit Full Screen' : 'Full Screen Reading Mode'}
                  aria-label="Toggle Fullscreen"
                >
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  <span className="reader-tool-label secondary-label">{isFullscreen ? 'Exit' : 'Full'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              MAIN READING STAGE: REALISTIC 3D BOOK ENGINE
              ══════════════════════════════════════════════════════════ */}
          <div
            className={`book-stage-viewport ${isMobile && mobileZoom > 1.05 ? 'is-zoomed' : ''}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
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
                background: '#ffffff',
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
                  src={
                    driveEmbed ||
                    (pdfSource && isMobile
                      ? `https://docs.google.com/viewer?url=${encodeURIComponent(pdfSource)}&embedded=true`
                      : `${pdfSource}#page=${currentPage}`)
                  }
                  width="100%"
                  height="100%"
                  style={{ border: 'none', flex: 1, background: '#ffffff' }}
                  title={book.title}
                />
              </div>
            ) : pdfLoading ? (
              /* Smooth Book Loading State with Real-Time Progressive Streaming Indicator */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '65vh',
                gap: '16px',
                padding: '20px'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  border: '3px solid rgba(59, 130, 246, 0.2)',
                  borderTopColor: 'var(--primary, #3b82f6)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <div style={{ textAlign: 'center', maxWidth: '380px' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Preparing 3D Book Experience...
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Streaming pages for "{book.title}"
                  </p>
                  {downloadProgress > 0 && (
                    <div style={{ width: '100%', maxWidth: '240px', margin: '0 auto' }}>
                      <div style={{
                        width: '100%',
                        height: '6px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '999px',
                        overflow: 'hidden',
                        marginBottom: '6px'
                      }}>
                        <div style={{
                          width: `${downloadProgress}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                          borderRadius: '999px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {downloadProgress}% streamed
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : pdfLoadError ? (
              /* Resilient Fallback with 3D Book Retry */
              <div className="glass-panel" style={{
                padding: '36px',
                borderRadius: '16px',
                textAlign: 'center',
                maxWidth: '500px'
              }}>
                <BookOpen size={40} color="#f59e0b" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>
                  3D Book Engine Paused
                </h4>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
                  {pdfLoadError && (pdfLoadError.includes('Network') || pdfLoadError.includes('stalled'))
                    ? 'Connection was too slow or interrupted while streaming high-resolution pages.'
                    : 'The book engine encountered a loading pause. You can retry the 3D book or switch to the digital viewer.'}
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setPdfLoadError(null);
                      setReloadTrigger(prev => prev + 1);
                    }}
                    className="btn btn-primary"
                    style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RefreshCw size={14} /> Retry 3D Book
                  </button>
                  <button
                    onClick={() => setUseNativeViewer(true)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.84rem' }}
                  >
                    Digital Viewer
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
                    <div
                      ref={holderLeftRef}
                      className={`book-canvas-holder ${isMobile && mobileZoom > 1.05 ? 'is-zoomed' : ''} ${!isMobile && scale > 1.2 ? 'desktop-zoomed' : ''}`}
                      style={isMobile && mobileZoom > 1.05 ? {
                        transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0)`,
                        willChange: 'transform'
                      } : undefined}
                    >
                      <canvas
                        ref={canvasLeftRef}
                        onClick={() => {
                          if (failedPagesRef.current.has(currentPage) && canvasLeftRef.current) {
                            renderPage(currentPage, 'left', canvasLeftRef.current);
                          }
                        }}
                        style={{ cursor: failedPagesRef.current.has(currentPage) ? 'pointer' : 'default' }}
                      />
                    </div>

                    {/* Left Interactive Page Turn Zone (hidden while zoomed to prevent accidental flips) */}
                    {(!isMobile || mobileZoom <= 1.05) && (
                      <div
                        className="page-turn-trigger page-turn-trigger-left"
                        onClick={() => handlePageChange(currentPage - (viewMode === 'spread' && !isMobile ? 2 : 1), 'prev')}
                        title="Click to Turn Back (or use Left Arrow key)"
                      >
                        <div className="page-turn-arrow-badge">
                          <ChevronLeft size={20} />
                        </div>
                      </div>
                    )}

                    {/* Interactive Corner Drag-to-Curl Dog-Ear Handles */}
                    {(!isMobile || mobileZoom <= 1.05) && currentPage > 1 && (
                      <div
                        className="curl-corner-handle curl-corner-handle-left"
                        onPointerDown={(e) => handleCornerPointerDown(e, 'prev')}
                        title="Drag or click to curl page back"
                        aria-label="Previous Page Corner Curl"
                      />
                    )}
                    {(!isMobile || mobileZoom <= 1.05) && (viewMode === 'single' || isMobile) && currentPage < totalPages && (
                      <div
                        className="curl-corner-handle curl-corner-handle-right"
                        onPointerDown={(e) => handleCornerPointerDown(e, 'next')}
                        title="Drag or click to curl page forward"
                        aria-label="Next Page Corner Curl"
                      />
                    )}
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
                      <div
                        ref={holderRightRef}
                        className={`book-canvas-holder ${isMobile && mobileZoom > 1.05 ? 'is-zoomed' : ''} ${!isMobile && scale > 1.2 ? 'desktop-zoomed' : ''}`}
                        style={isMobile && mobileZoom > 1.05 ? {
                          transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0)`,
                          willChange: 'transform'
                        } : undefined}
                      >
                        {currentPage + 1 <= totalPages ? (
                          <canvas
                            ref={canvasRightRef}
                            onClick={() => {
                              if (failedPagesRef.current.has(currentPage + 1) && canvasRightRef.current) {
                                renderPage(currentPage + 1, 'right', canvasRightRef.current);
                              }
                            }}
                            style={{ cursor: failedPagesRef.current.has(currentPage + 1) ? 'pointer' : 'default' }}
                          />
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

                      {/* Right Interactive Page Turn Zone (hidden while zoomed) */}
                      {(!isMobile || mobileZoom <= 1.05) && (
                        <div
                          className="page-turn-trigger page-turn-trigger-right"
                          onClick={() => handlePageChange(currentPage + 2, 'next')}
                          title="Click to Turn Forward (or use Right Arrow key)"
                        >
                          <div className="page-turn-arrow-badge">
                            <ChevronRight size={20} />
                          </div>
                        </div>
                      )}

                      {/* Interactive Corner Drag-to-Curl Handle on Right Page */}
                      {(!isMobile || mobileZoom <= 1.05) && currentPage + 1 < totalPages && (
                        <div
                          className="curl-corner-handle curl-corner-handle-right"
                          onPointerDown={(e) => handleCornerPointerDown(e, 'next')}
                          title="Drag or click to curl page forward"
                          aria-label="Next Page Corner Curl"
                        />
                      )}
                    </div>
                  )}

                  {/* XBPageCurl Realistic 3D Cylindrical Page Curl & Turn Effect */}
                  {(isFlipping || dragCurl.active) && (
                    <div
                      className={`xb-page-curl-wrapper ${isDark ? 'dark-mode' : 'light-mode'} ${
                        viewMode === 'single' || isMobile ? 'curl-single' : 'curl-spread'
                      } ${(isFlipping === 'next' || dragCurl.direction === 'next') ? 'curl-next' : 'curl-prev'} ${
                        dragCurl.active ? 'is-dragging' : ''
                      }`}
                    >
                      {/* Dynamic cast shadow on the revealing page underneath */}
                      <div
                        className="xb-curl-cast-shadow"
                        style={dragCurl.active ? {
                          opacity: Math.sin(dragCurl.progress * Math.PI) * 0.95
                        } : undefined}
                      />

                      {/* Cylindrical rolling 3D sheet */}
                      <div
                        className="xb-curl-cylinder"
                        style={dragCurl.active ? {
                          transform: `perspective(2200px) rotateY(${
                            (dragCurl.direction === 'next' ? -1 : 1) * dragCurl.progress * 180
                          }deg) rotateZ(${
                            (dragCurl.direction === 'next' ? -1 : 1) * Math.sin(dragCurl.progress * Math.PI) * 5
                          }deg) skewY(${
                            (dragCurl.direction === 'next' ? -1 : 1) * Math.sin(dragCurl.progress * Math.PI) * 3.5
                          }deg)`
                        } : undefined}
                      >
                        {/* Front face of curling sheet */}
                        <div className="xb-curl-face xb-curl-front" />
                        {/* Reverse back of sheet */}
                        <div className="xb-curl-face xb-curl-back" />
                        {/* Specular apex light band running down cylinder ridge */}
                        <div
                          className="xb-curl-ridge-highlight"
                          style={dragCurl.active ? {
                            opacity: Math.sin(dragCurl.progress * Math.PI)
                          } : undefined}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Stacked Paper Edges (Desktop only) */}
                {!isMobile && <div className="book-edge-stacked book-edge-right" />}
              </div>
            )}
          </div>

          {/* Floating Mobile Zoom Controls Widget */}
          {isMobile && !useNativeViewer && !pdfLoading && !pdfLoadError && (
            <div className="mobile-zoom-pill">
              <button
                type="button"
                onClick={handleMobileZoomOut}
                className="btn btn-ghost"
                style={{ padding: '4px 6px', fontSize: '0.75rem', borderRadius: '6px' }}
                title="Zoom Out (10% step)"
              >
                <ZoomOut size={13} />
              </button>
              <span
                onClick={handleMobileZoomReset}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  minWidth: '38px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  color: mobileZoom !== 1.0 ? 'var(--primary)' : 'var(--text-primary)'
                }}
                title="Tap to reset to 100% Fit"
              >
                {Math.round(mobileZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={handleMobileZoomIn}
                className="btn btn-ghost"
                style={{ padding: '4px 6px', fontSize: '0.75rem', borderRadius: '6px' }}
                title="Zoom In (10% step)"
              >
                <ZoomIn size={13} />
              </button>
              {mobileZoom !== 1.0 && (
                <button
                  type="button"
                  onClick={handleMobileZoomReset}
                  className="btn btn-primary"
                  style={{
                    padding: '2px 7px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    marginLeft: '2px',
                    lineHeight: '1.2'
                  }}
                  title="Reset to Fit Screen"
                >
                  Fit
                </button>
              )}
            </div>
          )}

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

      {/* Share Book Link Modal */}
      {showShareModal && (
        <ShareBookModal
          book={book}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};

export default BookReader;
