import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, BookOpen, Key, History, BarChart3, Plus, Edit, Trash2, Check, X, 
  Search, ShieldAlert, Award, FileText, Download, TrendingUp,
  Upload, Layers, CheckCircle2, SkipForward, XCircle, UserCheck, UserX, AlertTriangle,
  Menu, ArrowLeftRight, MapPin, Settings, Package, UploadCloud
} from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import SettingsView from '../components/SettingsView';
import RoomSeatingManager from '../components/RoomSeatingManager';

const AdminDashboard = () => {
  const { logout, apiCall } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'users', 'permissions', 'books', 'students', 'logs', 'loans', 'rooms', 'settings'
  const [dashboardData, setDashboardData] = useState(null);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [books, setBooks] = useState([]);
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);

  // Students Management State
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState(''); // '', 'approved', 'pending', 'rejected'
  const [studentBranchFilter, setStudentBranchFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name } or null
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState([]);
  const [showBulkDeleteBooksConfirm, setShowBulkDeleteBooksConfirm] = useState(false);
  const [bulkDeleteBooksLoading, setBulkDeleteBooksLoading] = useState(false);
  const [deleteBookConfirm, setDeleteBookConfirm] = useState(null); // { id, title }
  const [deleteBookLoading, setDeleteBookLoading] = useState(false);

  // Book CRUD Modal State
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookSaving, setBookSaving] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [bookFormData, setBookFormData] = useState({ title: '', author: '', category_id: '', branch_id: '', priority: 'main' });
  const [pdfFile, setPdfFile] = useState(null);
  const [bookModalError, setBookModalError] = useState('');
  const pdfInputRef = useRef(null);

  // Bulk Upload Modal State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkFormData, setBulkFormData] = useState({
    category_id: '',
    branch_id: '',
    priority: 'main',
    author: ''
  });
  const [bulkResults, setBulkResults] = useState(null); // null = not submitted yet
  const [bulkUploading, setBulkUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const bulkFileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ text: '', type: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // M-3 State: Audit logs pagination
  const [logs, setLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPagination, setLogsPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [logsLoading, setLogsLoading] = useState(false);
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);

  // Loan Management State
  const [loans, setLoans] = useState([]);
  const [loanSearch, setLoanSearch] = useState('');
  const [loanStatusFilter, setLoanStatusFilter] = useState('');

  // Book Issue/Return State
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueFormData, setIssueFormData] = useState({ copy_id: '', user_id: '', due_date: '' });
  const [issueLoading, setIssueLoading] = useState(false);
  const [returnModal, setReturnModal] = useState(null); // loan object

  // Room & Table Management State
  const [rooms, setRooms] = useState([]);
  const [allTables, setAllTables] = useState([]);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [tableFormData, setTableFormData] = useState({ room_id: '', table_number: '', qr_identifier: '' });

  // Library Settings State
  const [librarySettings, setLibrarySettings] = useState({ loan_duration_days: 14, fine_per_day: 5, max_fine: 200 });
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Book Copies State
  const [bookCopies, setBookCopies] = useState([]);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyFormData, setCopyFormData] = useState({ book_id: '', qr_code: '' });

  // Memoized selector values to optimize rendering performance
  const uniqueStudentBranches = useMemo(() => {
    return [...new Set(students.map(s => s.branch_name).filter(Boolean))];
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase();
    return students.filter(s => {
      const matchSearch = !q ||
        s.full_name?.toLowerCase().includes(q) ||
        s.roll_number?.toLowerCase().includes(q) ||
        s.username?.toLowerCase().includes(q) ||
        s.bt_number?.toLowerCase().includes(q);
      const matchStatus = !studentStatusFilter || s.status === studentStatusFilter;
      const matchBranch = !studentBranchFilter || s.branch_name === studentBranchFilter;
      return matchSearch && matchStatus && matchBranch;
    });
  }, [students, studentSearch, studentStatusFilter, studentBranchFilter]);

  // Filter books by search query in Book Inventory tab
  const filteredBooks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return books.filter(b => 
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.branch_name?.toLowerCase().includes(q) ||
      b.category_name?.toLowerCase().includes(q)
    );
  }, [books, searchQuery]);

  const studentStats = useMemo(() => {
    return {
      total: students.length,
      approved: students.filter(s => s.status === 'approved').length,
      pending: students.filter(s => s.status === 'pending').length,
      rejected: students.filter(s => s.status === 'rejected').length,
    };
  }, [students]);

  const showFeedback = useCallback((text, type = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback({ text: '', type: '' }), 5000);
  }, []);

  const fetchAllAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [dash, pUsers, pReqs, bList, brList, catList, allStudents, loansList, roomsList, tablesList, settings, copiesList] = await Promise.all([
        apiCall('/analytics/dashboard'),
        apiCall('/auth/pending-users'),
        apiCall('/permissions/pending-requests'),
        apiCall('/books'),
        apiCall('/books/branches'),
        apiCall('/books/categories'),
        apiCall('/auth/users'),
        apiCall('/book-loans'),
        apiCall('/rooms'),
        apiCall('/tables'),
        apiCall('/library-settings'),
        apiCall('/book-copies')
      ]);

      setDashboardData(dash);
      setPendingUsers(pUsers);
      setPendingRequests(pReqs);
      setBooks(bList);
      setBranches(brList);
      setCategories(catList);
      setStudents(allStudents.filter(u => u.role === 'student'));
      setLoans(loansList || []);
      setRooms(roomsList || []);
      setAllTables(tablesList || []);
      setLibrarySettings(settings || { loan_duration_days: 14, fine_per_day: 5, max_fine: 200 });
      setBookCopies(copiesList || []);

      // Set initial values for book form dropdowns if not empty
      if (catList.length > 0 && brList.length > 0) {
        setBookFormData(prev => ({
          ...prev,
          category_id: catList[0].id.toString(),
          branch_id: brList[0].id.toString()
        }));
        setBulkFormData(prev => ({
          ...prev,
          category_id: catList[0].id.toString(),
          branch_id: brList[0].id.toString()
        }));
      }
    } catch (err) {
      showFeedback(err.message || 'Error fetching administrator database', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiCall, showFeedback]);

  // Delete student account
  const handleDeleteStudent = async () => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    try {
      const data = await apiCall(`/auth/users/${deleteConfirm.id}`, { method: 'DELETE' });
      showFeedback(data.message || 'Student deleted successfully');
      
      // L-6 FIX: Update student list locally to avoid redundant API request
      setStudents(prev => prev.filter(u => u.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      
      const dash = await apiCall('/analytics/dashboard');
      setDashboardData(dash);
    } catch (err) {
      showFeedback(err.message || 'Failed to delete student', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Admin Dashboard - SISTEC Library';
    const timer = setTimeout(() => {
      fetchAllAdminData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchAllAdminData]);

  useEffect(() => {
    setSelectedUserIds([]);
    setSelectedBookIds([]);
  }, [activeTab]);

  const fetchLogs = useCallback(async (page = 1) => {
    try {
      setLogsLoading(true);
      const data = await apiCall(`/analytics/logs?page=${page}&limit=50`);
      setLogs(data.logs);
      setLogsPagination(data.pagination);
      setLogsPage(page);
    } catch (err) {
      showFeedback(err.message || 'Error fetching system logs', 'error');
    } finally {
      setLogsLoading(false);
    }
  }, [apiCall, showFeedback]);

  useEffect(() => {
    if (activeTab === 'logs') {
      const timer = setTimeout(() => {
        fetchLogs(logsPage);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, logsPage, fetchLogs]);

  // User Approval Action
  const handleUserApproval = async (userId, status) => {
    try {
      const data = await apiCall(`/auth/approve-user/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      showFeedback(data.message || `User registration ${status}`);
      // Refresh
      const pUsers = await apiCall('/auth/pending-users');
      setPendingUsers(pUsers);
      const dash = await apiCall('/analytics/dashboard');
      setDashboardData(dash);
    } catch (err) {
      showFeedback(err.message || 'Action failed', 'error');
    }
  };

  // Toggle Block / Unblock Action
  const handleToggleBlock = async (userId, isBlocked) => {
    try {
      const endpoint = `/auth/users/${userId}/${isBlocked ? 'block' : 'unblock'}`;
      const data = await apiCall(endpoint, {
        method: 'POST'
      });
      showFeedback(data.message || `User successfully ${isBlocked ? 'blocked' : 'unblocked'}`);
      
      // Update local state for immediate feedback
      setStudents(prev => prev.map(u => u.id === userId ? { ...u, is_blocked: isBlocked ? 1 : 0 } : u));
    } catch (err) {
      showFeedback(err.message || 'Action failed', 'error');
    }
  };

  // Selection Handlers
  const isAllFilteredSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.every(s => selectedUserIds.includes(s.id));
  }, [filteredStudents, selectedUserIds]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const filteredIds = filteredStudents.map(s => s.id);
      setSelectedUserIds(prev => {
        const union = new Set([...prev, ...filteredIds]);
        return Array.from(union);
      });
    } else {
      const filteredIdsSet = new Set(filteredStudents.map(s => s.id));
      setSelectedUserIds(prev => prev.filter(id => !filteredIdsSet.has(id)));
    }
  };

  const handleSelectUser = (userId, checked) => {
    if (checked) {
      setSelectedUserIds(prev => [...prev, userId]);
    } else {
      setSelectedUserIds(prev => prev.filter(id => id !== userId));
    }
  };

  // Bulk Delete Action
  const handleBulkDeleteStudents = async () => {
    if (selectedUserIds.length === 0) return;
    setBulkDeleteLoading(true);
    try {
      const data = await apiCall('/auth/users/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUserIds })
      });
      showFeedback(data.message || `${selectedUserIds.length} students deleted successfully`);
      
      // Update local state
      setStudents(prev => prev.filter(u => !selectedUserIds.includes(u.id)));
      setSelectedUserIds([]);
      setShowBulkDeleteConfirm(false);
      
      const dash = await apiCall('/analytics/dashboard');
      setDashboardData(dash);
    } catch (err) {
      showFeedback(err.message || 'Failed to delete selected students', 'error');
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  // Book Selection Handlers
  const isAllFilteredBooksSelected = useMemo(() => {
    if (filteredBooks.length === 0) return false;
    return filteredBooks.every(b => selectedBookIds.includes(b.id));
  }, [filteredBooks, selectedBookIds]);

  const handleSelectAllBooks = (e) => {
    if (e.target.checked) {
      const filteredIds = filteredBooks.map(b => b.id);
      setSelectedBookIds(prev => {
        const union = new Set([...prev, ...filteredIds]);
        return Array.from(union);
      });
    } else {
      const filteredIdsSet = new Set(filteredBooks.map(b => b.id));
      setSelectedBookIds(prev => prev.filter(id => !filteredIdsSet.has(id)));
    }
  };

  const handleSelectBook = (bookId, checked) => {
    if (checked) {
      setSelectedBookIds(prev => [...prev, bookId]);
    } else {
      setSelectedBookIds(prev => prev.filter(id => id !== bookId));
    }
  };

  const handleBulkDeleteBooks = async () => {
    if (selectedBookIds.length === 0) return;
    setBulkDeleteBooksLoading(true);
    try {
      const data = await apiCall('/books/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookIds: selectedBookIds })
      });
      showFeedback(data.message || `${selectedBookIds.length} books deleted successfully`);

      // Update local state
      setBooks(prev => prev.filter(b => !selectedBookIds.includes(b.id)));
      setSelectedBookIds([]);
      setShowBulkDeleteBooksConfirm(false);

      const dash = await apiCall('/analytics/dashboard');
      setDashboardData(dash);
    } catch (err) {
      showFeedback(err.message || 'Failed to delete selected books', 'error');
    } finally {
      setBulkDeleteBooksLoading(false);
    }
  };

  // Branch Access Request Approval
  const handleBranchApproval = async (requestId, status) => {
    try {
      const data = await apiCall(`/permissions/approve/${requestId}`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      showFeedback(data.message || `Request ${status}`);
      // Refresh
      const pReqs = await apiCall('/permissions/pending-requests');
      setPendingRequests(pReqs);
      const dash = await apiCall('/analytics/dashboard');
      setDashboardData(dash);
    } catch (err) {
      showFeedback(err.message || 'Action failed', 'error');
    }
  };

  // Book Delete Action
  const handleDeleteBook = async () => {
    if (!deleteBookConfirm) return;
    setDeleteBookLoading(true);
    try {
      const data = await apiCall(`/books/${deleteBookConfirm.id}`, {
        method: 'DELETE'
      });
      showFeedback(data.message || 'Book deleted successfully');
      // Refresh
      const bList = await apiCall('/books');
      setBooks(bList);
      const dash = await apiCall('/analytics/dashboard');
      setDashboardData(dash);
      setDeleteBookConfirm(null);
    } catch (err) {
      showFeedback(err.message || 'Failed to delete book', 'error');
    } finally {
      setDeleteBookLoading(false);
    }
  };

  // Open Book Modal (Add / Edit)
  const openBookModal = (book = null) => {
    setPdfFile(null);
    setBookModalError('');
    if (book) {
      setEditingBook(book);
      setBookFormData({
        title: book.title,
        author: book.author,
        category_id: book.category_id.toString(),
        branch_id: book.branch_id.toString(),
        priority: book.priority,
        pdf_url: book.pdf_url || ''
      });
    } else {
      setEditingBook(null);
      setBookFormData({
        title: '',
        author: '',
        category_id: categories.length > 0 ? categories[0].id.toString() : '',
        branch_id: branches.length > 0 ? branches[0].id.toString() : '',
        priority: 'main',
        pdf_url: ''
      });
    }
    setShowBookModal(true);
  };

  const handleSaveBook = async (e) => {
    e.preventDefault();
    if (bookSaving) return;
    setBookModalError('');
    const { title, author, category_id, branch_id, priority } = bookFormData;
    if (!title?.trim() || !author?.trim() || !category_id || !branch_id || !priority) {
      const msg = 'Please fill out Book Title, Author, Department, and Category.';
      setBookModalError(msg);
      showFeedback(msg, 'error');
      return;
    }

    if (!editingBook && !pdfFile) {
      const msg = 'Please choose or drag-and-drop a PDF book file.';
      setBookModalError(msg);
      showFeedback(msg, 'error');
      return;
    }

    setBookSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('author', author.trim());
      formData.append('category_id', category_id);
      formData.append('branch_id', branch_id);
      formData.append('priority', priority);
      if (pdfFile) {
        formData.append('pdf', pdfFile);
      }

      if (editingBook) {
        await apiCall(`/books/${editingBook.id}`, {
          method: 'PUT',
          body: formData
        });
        showFeedback('Book metadata and PDF updated successfully');
      } else {
        await apiCall('/books', {
          method: 'POST',
          body: formData
        });
        showFeedback('New book cataloged and PDF uploaded successfully');
      }

      setShowBookModal(false);
      setPdfFile(null);
      setBookModalError('');
      // Refresh
      const bList = await apiCall('/books');
      setBooks(bList);
      const dash = await apiCall('/analytics/dashboard');
      setDashboardData(dash);
    } catch (err) {
      setBookModalError(err.message || 'Failed to save book');
      showFeedback(err.message || 'Failed to save book', 'error');
    } finally {
      setBookSaving(false);
    }
  };

  // Open Bulk Upload Modal
  const openBulkModal = () => {
    setBulkFiles([]);
    setBulkResults(null);
    setBulkUploading(false);
    setBulkFormData({
      category_id: categories.length > 0 ? categories[0].id.toString() : '',
      branch_id: branches.length > 0 ? branches[0].id.toString() : '',
      priority: 'main',
      author: ''
    });
    setShowBulkModal(true);
  };

  // Handle drag-and-drop files
  const handleBulkDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    setBulkFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...dropped.filter(f => !existing.has(f.name))];
    });
  };

  const handleBulkFileSelect = (e) => {
    const selected = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
    setBulkFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...selected.filter(f => !existing.has(f.name))];
    });
  };

  const removeBulkFile = (name) => {
    setBulkFiles(prev => prev.filter(f => f.name !== name));
  };

  // Submit Bulk Upload
  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) {
      showFeedback('Please select at least one PDF file', 'error');
      return;
    }
    if (!bulkFormData.category_id || !bulkFormData.branch_id || !bulkFormData.priority) {
      showFeedback('Please fill in Branch, Category, and Priority', 'error');
      return;
    }

    setBulkUploading(true);
    setBulkResults(null);

    try {
      const formData = new FormData();
      formData.append('category_id', bulkFormData.category_id);
      formData.append('branch_id', bulkFormData.branch_id);
      formData.append('priority', bulkFormData.priority);
      formData.append('author', bulkFormData.author);
      bulkFiles.forEach(f => formData.append('pdfs', f));

      const data = await apiCall('/books/bulk', {
        method: 'POST',
        body: formData
      });

      setBulkResults(data);
      showFeedback(`Bulk import done: ${data.imported} added, ${data.skipped} skipped, ${data.errors} errors`);

      // Refresh books list
      const bList = await apiCall('/books');
      setBooks(bList);
      const dash = await apiCall('/analytics/dashboard');
      setDashboardData(dash);
    } catch (err) {
      showFeedback(err.message || 'Bulk upload failed', 'error');
    } finally {
      setBulkUploading(false);
    }
  };

  // Custom visual SVG scale logic for charts
  const getBranchChartMax = () => {
    if (!dashboardData || !dashboardData.branchPerformance) return 10;
    const maxVal = Math.max(
      ...dashboardData.branchPerformance.map(b => Math.max(b.total_accesses, b.total_downloads))
    );
    return maxVal > 0 ? Math.ceil(maxVal * 1.2) : 10;
  };



  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
            <img src="/logo.png" alt="SISTec" style={{ height: '38px', width: 'auto', objectFit: 'contain' }} />
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.1 }}>
                SISTEC
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Admin Portal
              </span>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '12px', marginBottom: '24px', fontSize: '0.85rem', textAlign: 'center' }}>
            <span className="badge badge-primary" style={{ display: 'inline-block', marginBottom: '4px' }}>System Administrator</span>
            <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginTop: '4px' }}>Root Account</div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              onClick={() => setActiveTab('overview')}
              className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <BarChart3 size={16} /> Overview & Analytics
            </button>
            <button 
              onClick={() => setActiveTab('users')}
              className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <Users size={16} /> Approvals ({pendingUsers.length})
            </button>
            <button 
              onClick={() => setActiveTab('permissions')}
              className={`btn ${activeTab === 'permissions' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <Key size={16} /> Branch Requests ({pendingRequests.length})
            </button>
            <button 
              onClick={() => setActiveTab('loans')}
              className={`btn ${activeTab === 'loans' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <ArrowLeftRight size={16} /> Book Circulation ({loans.filter(l => l.status === 'issued').length})
            </button>
            <button 
              onClick={() => setActiveTab('rooms')}
              className={`btn ${activeTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <MapPin size={16} /> Rooms & Tables
            </button>
            <button 
              onClick={() => setActiveTab('books')}
              className={`btn ${activeTab === 'books' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <BookOpen size={16} /> Book Inventory
            </button>
            <button 
              onClick={() => setActiveTab('copies')}
              className={`btn ${activeTab === 'copies' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <Package size={16} /> Book Copies
            </button>
            <button 
              onClick={() => setActiveTab('students')}
              className={`btn ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <UserCheck size={16} /> All Students ({students.length})
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <Settings size={16} /> Library Settings
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <History size={16} /> System Audit Logs
            </button>
          </nav>
        </div>

        <button 
          onClick={logout}
          className="btn btn-secondary"
          style={{ justifyContent: 'center', width: '100%', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
        >
          <X size={16} /> Log Out
        </button>
      </aside>

      {/* Main Area */}
      <main className="main-content">
        {/* Floating Toast Notification */}
        {feedback.text && (
          <div className="animate-fade-in toast-notification" style={{
            position: 'fixed',
            top: '72px',
            right: '20px',
            left: '20px',
            zIndex: 3000,
            padding: '14px 20px',
            borderRadius: '12px',
            background: feedback.type === 'error' ? '#7f1d1d' : '#064e3b',
            border: `1px solid ${feedback.type === 'error' ? '#ef4444' : '#10b981'}`,
            color: '#ffffff',
            boxShadow: 'var(--shadow-elevated)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            {feedback.type === 'error' ? <ShieldAlert size={18} /> : <Check size={18} />}
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{feedback.text}</span>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div style={{ width: '48px', height: '48px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
            <p>Loading administrative dashboard...</p>
          </div>
        ) : (
          <>
            {/* Overview / Analytics Tab */}
            {activeTab === 'overview' && dashboardData && (
              <div className="animate-fade-in">
                <div style={{ marginBottom: '32px' }}>
                  <h2>Library System Analytics</h2>
                  <p style={{ marginTop: '4px' }}>Real-time statistics, aggregate branch reading patterns, and user activity.</p>
                </div>

                {/* Counts Cards Row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '20px',
                  marginBottom: '32px'
                }}>
                  <div className="glass-panel motion-stat-card animate-stagger-in stagger-1" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="motion-card-icon" style={{ padding: '12px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
                      <BookOpen size={24} />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Books</span>
                      <h3 style={{ fontSize: '1.5rem', marginTop: '2px' }}>{dashboardData.stats.books}</h3>
                    </div>
                  </div>

                  <div className="glass-panel motion-stat-card animate-stagger-in stagger-2" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="motion-card-icon" style={{ padding: '12px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--secondary)' }}>
                      <Users size={24} />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Active Students</span>
                      <h3 style={{ fontSize: '1.5rem', marginTop: '2px' }}>{dashboardData.stats.students}</h3>
                    </div>
                  </div>

                  <div className="glass-panel motion-stat-card animate-stagger-in stagger-3" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="motion-card-icon" style={{ padding: '12px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
                      <FileText size={24} />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Views</span>
                      <h3 style={{ fontSize: '1.5rem', marginTop: '2px' }}>{dashboardData.stats.views}</h3>
                    </div>
                  </div>

                  <div className="glass-panel motion-stat-card animate-stagger-in stagger-4" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="motion-card-icon" style={{ padding: '12px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
                      <Download size={24} />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Downloads</span>
                      <h3 style={{ fontSize: '1.5rem', marginTop: '2px' }}>{dashboardData.stats.downloads}</h3>
                    </div>
                  </div>
                </div>

                {/* Champion Records (Best Book, Top Reader) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }} className="responsive-grid-1col">
                  {/* Best Book */}
                  <div className="glass-panel glass-panel-hover animate-stagger-in stagger-3" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '4px solid var(--secondary)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <div className="animate-float-bob" style={{ display: 'flex', alignItems: 'center' }}>
                          <Award size={22} color="var(--secondary)" />
                        </div>
                        <h4 style={{ textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Best Performing Book Overall</h4>
                      </div>
                      {dashboardData.bestBook ? (
                        <>
                          <h3 style={{ fontSize: '1.35rem', marginBottom: '6px' }}>"{dashboardData.bestBook.title}"</h3>
                          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>By {dashboardData.bestBook.author}</p>
                          <span className="badge badge-secondary" style={{ marginTop: '8px', fontSize: '0.65rem' }}>{dashboardData.bestBook.branch_name}</span>
                        </>
                      ) : (
                        <p style={{ fontStyle: 'italic' }}>No books read or downloaded yet.</p>
                      )}
                    </div>
                    {dashboardData.bestBook && (
                      <div style={{ display: 'flex', gap: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', marginTop: '20px', fontSize: '0.85rem' }}>
                        <div><strong>{dashboardData.bestBook.total_accesses}</strong> accesses</div>
                        <div><strong>{dashboardData.bestBook.total_downloads}</strong> downloads</div>
                      </div>
                    )}
                  </div>

                  {/* Top Student */}
                  <div className="glass-panel glass-panel-hover animate-stagger-in stagger-4" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '4px solid var(--primary)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <div className="animate-float-bob" style={{ display: 'flex', alignItems: 'center' }}>
                          <TrendingUp size={22} color="var(--primary)" />
                        </div>
                        <h4 style={{ textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Top Student Reader</h4>
                      </div>
                      {dashboardData.topUser ? (
                        <>
                          <h3 style={{ fontSize: '1.35rem', marginBottom: '6px' }}>{dashboardData.topUser.full_name}</h3>
                          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Roll: {dashboardData.topUser.roll_number}</p>
                          <span className="badge badge-primary" style={{ marginTop: '8px', fontSize: '0.65rem' }}>{dashboardData.topUser.branch_name}</span>
                        </>
                      ) : (
                        <p style={{ fontStyle: 'italic' }}>No reader data compiled yet.</p>
                      )}
                    </div>
                    {dashboardData.topUser && (
                      <div style={{ display: 'flex', gap: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', marginTop: '20px', fontSize: '0.85rem' }}>
                        <div><strong>{dashboardData.topUser.total_accesses}</strong> aggregate page reviews</div>
                        <div><strong>{dashboardData.topUser.unique_books_accessed}</strong> unique books accessed</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Graphical Custom SVG Chart Panel */}
                <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
                  <h4 style={{ marginBottom: '24px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Branch-wise Performance (Accesses vs Downloads)</h4>
                  
                  {/* SVG Chart */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {dashboardData.branchPerformance.map((bp, i) => {
                      const max = getBranchChartMax();
                      const accPct = Math.min(100, (bp.total_accesses / max) * 100);
                      const dwnPct = Math.min(100, (bp.total_downloads / max) * 100);

                      return (
                        <div key={i} className="admin-chart-row" style={{ display: 'grid', gridTemplateColumns: '180px 1fr', alignItems: 'center', gap: '16px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{bp.branch_name}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {/* Accesses bar (Indigo) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', overflow: 'hidden' }}>
                                <div style={{
                                  width: `${accPct}%`,
                                  height: '100%',
                                  background: 'linear-gradient(90deg, var(--primary), var(--border-glass-focus))',
                                  borderRadius: '6px',
                                  transition: 'width 0.5s ease-out'
                                }} />
                              </div>
                              <span style={{ fontSize: '0.75rem', width: '80px', color: 'var(--text-secondary)' }}>{bp.total_accesses} accesses</span>
                            </div>
                            {/* Downloads bar (Cyan) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', overflow: 'hidden' }}>
                                <div style={{
                                  width: `${dwnPct}%`,
                                  height: '100%',
                                  background: 'linear-gradient(90deg, var(--secondary), var(--secondary-glow))',
                                  borderRadius: '6px',
                                  transition: 'width 0.5s ease-out'
                                }} />
                              </div>
                              <span style={{ fontSize: '0.75rem', width: '80px', color: 'var(--text-secondary)' }}>{bp.total_downloads} dwns</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Legend */}
                  <div style={{ display: 'flex', gap: '20px', justifyContent: 'flex-end', marginTop: '20px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--primary)' }} />
                      <span>Total Book Accesses</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--secondary)' }} />
                      <span>Total Book Downloads</span>
                    </div>
                  </div>
                </div>

                {/* Branch Top Books Table */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h4 style={{ marginBottom: '16px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Most Read Book in Each Branch</h4>
                  {dashboardData.mostReadPerBranch.length === 0 ? (
                    <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No books have been read in any branch yet.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '12px' }}>Branch</th>
                            <th style={{ padding: '12px' }}>Book Title</th>
                            <th style={{ padding: '12px' }}>Author</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>Total Accesses</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.mostReadPerBranch.map((record, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '14px', fontWeight: 600 }}>{record.branch_name}</td>
                              <td style={{ padding: '14px' }}>"{record.title}"</td>
                              <td style={{ padding: '14px', color: 'var(--text-secondary)' }}>{record.author}</td>
                              <td style={{ padding: '14px', textAlign: 'center' }}>
                                <span className="badge badge-success">{record.total_accesses} times</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* User Registration Approvals Tab */}
            {activeTab === 'users' && (
              <div className="animate-fade-in">
                <div style={{ marginBottom: '32px' }}>
                  <h2>User Registration Approvals</h2>
                  <p style={{ marginTop: '4px' }}>Approve or reject first-time student registration requests. Approved accounts can immediately log in.</p>
                </div>

                {pendingUsers.length === 0 ? (
                  <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
                    <Users size={40} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                    <h4>All registrations reviewed!</h4>
                    <p style={{ marginTop: '8px' }}>There are no pending student registration requests.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {pendingUsers.map(u => (
                      <div key={u.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                        <div style={{ flex: '1 1 300px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{u.full_name}</h3>
                            <StatusBadge status={u.status} />
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '10px' }}>
                            <div><strong>Username:</strong> {u.username}</div>
                            <div><strong>Roll No:</strong> {u.roll_number}</div>
                            <div><strong>Branch:</strong> {u.branch_name}</div>
                            <div><strong>Year/Sem:</strong> Yr {u.year} • Sem {u.semester}</div>
                            <div><strong>BT No:</strong> {u.bt_number || 'N/A'}</div>
                            <div><strong>Registered:</strong> {new Date(u.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleUserApproval(u.id, 'approved')}
                            className="btn btn-success"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          >
                            <Check size={16} /> Approve
                          </button>
                          <button
                            onClick={() => handleUserApproval(u.id, 'rejected')}
                            className="btn btn-danger"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          >
                            <X size={16} /> Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Branch Access Requests Tab */}
            {activeTab === 'permissions' && (
              <div className="animate-fade-in">
                <div style={{ marginBottom: '32px' }}>
                  <h2>Cross-Branch Access Requests</h2>
                  <p style={{ marginTop: '4px' }}>Students are restricted to reading books in their own branch. Approve requests to allow access to additional branches.</p>
                </div>

                {pendingRequests.length === 0 ? (
                  <EmptyState
                    icon={Key}
                    title="All branch requests reviewed!"
                    description="There are no pending cross-branch access requests from students."
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {pendingRequests.map(r => (
                      <div key={r.id} className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{r.full_name}</h4>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>({r.roll_number})</span>
                          </div>
                          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                            Home Branch: <strong>{r.student_branch}</strong> → Requested Access to:{' '}
                            <span className="badge badge-secondary" style={{ fontSize: '0.74rem', textTransform: 'none' }}>
                              {r.requested_branch_name}
                            </span>
                          </p>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '5px' }}>
                            Requested: {new Date(r.created_at).toLocaleString()}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleBranchApproval(r.id, 'approved')}
                            className="btn btn-success"
                            style={{ padding: '8px 16px', fontSize: '0.84rem' }}
                          >
                            <Check size={15} /> Grant Access
                          </button>
                          <button
                            onClick={() => handleBranchApproval(r.id, 'rejected')}
                            className="btn btn-danger"
                            style={{ padding: '8px 16px', fontSize: '0.84rem' }}
                          >
                            <X size={15} /> Deny Access
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Book Inventory Tab */}
            {activeTab === 'books' && (
              <div className="animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }} className="responsive-grid-1col">
                  <div>
                    <h2>Book Inventory Management</h2>
                    <p style={{ marginTop: '4px' }}>Add, update, or remove reference books and materials from the catalog.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => openBulkModal()}
                      className="btn btn-secondary"
                      style={{ border: '1px solid rgba(6,182,212,0.3)', color: 'var(--secondary)' }}
                    >
                      <Layers size={16} /> Bulk Upload PDFs
                    </button>
                    <button
                      onClick={() => openBookModal(null)}
                      className="btn btn-primary"
                    >
                      <Plus size={16} /> Catalog New Book
                    </button>
                  </div>
                </div>

                {/* Filter and Search */}
                <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="glass-input"
                      placeholder="Search books by title, author, category, or branch..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ paddingLeft: '48px' }}
                    />
                  </div>
                  {selectedBookIds.length > 0 && (
                    <button
                      onClick={() => setShowBulkDeleteBooksConfirm(true)}
                      className="btn btn-danger animate-fade-in"
                      style={{
                        padding: '8px 16px',
                        fontSize: '0.85rem',
                        background: 'var(--danger)',
                        borderColor: '#ef4444',
                        color: '#fff',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Trash2 size={16} /> Delete Selected ({selectedBookIds.length})
                    </button>
                  )}
                </div>

                {/* Books Inventory Table */}
                <div className="glass-panel" style={{ overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.1)' }}>
                          <th style={{ padding: '16px', width: '40px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isAllFilteredBooksSelected}
                              onChange={handleSelectAllBooks}
                              style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                            />
                          </th>
                          <th style={{ padding: '16px' }}>Title</th>
                          <th style={{ padding: '16px' }}>Author</th>
                          <th style={{ padding: '16px' }}>Branch</th>
                          <th style={{ padding: '16px' }}>Category</th>
                          <th style={{ padding: '16px' }}>Priority</th>
                          <th style={{ padding: '16px', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBooks.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center' }}>
                              <EmptyState
                                icon={BookOpen}
                                title="No Books Found"
                                subtitle={searchQuery ? `No catalog books match "${searchQuery}"` : "The library catalog is currently empty."}
                                actionLabel={!searchQuery ? "Catalog New Book" : undefined}
                                onAction={!searchQuery ? () => openBookModal(null) : undefined}
                              />
                            </td>
                          </tr>
                        ) : (
                          filteredBooks.map(b => (
                          <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '16px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selectedBookIds.includes(b.id)}
                                onChange={e => handleSelectBook(b.id, e.target.checked)}
                                style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                              />
                            </td>
                            <td style={{ padding: '16px', fontWeight: 600 }}>{b.title}</td>
                            <td style={{ padding: '16px' }}>{b.author}</td>
                            <td style={{ padding: '16px' }}>
                              <span className="badge badge-secondary" style={{ textTransform: 'none', fontSize: '0.65rem' }}>{b.branch_name}</span>
                            </td>
                            <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{b.category_name}</td>
                            <td style={{ padding: '16px' }}>
                              {b.priority === 'main' ? (
                                <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Main</span>
                              ) : (
                                <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>Sub</span>
                              )}
                            </td>
                            <td style={{ padding: '16px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => openBookModal(b)}
                                  className="btn btn-secondary"
                                  style={{ padding: '6px 10px' }}
                                  title="Edit Book"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => setDeleteBookConfirm({ id: b.id, title: b.title })}
                                  className="btn btn-secondary"
                                  style={{ padding: '6px 10px', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }}
                                  title="Delete Book"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Students Management Tab */}
            {activeTab === 'students' && (
              <div className="animate-fade-in">
                {/* Header */}
                <div style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(99,102,241,0.15)', color: 'var(--primary)' }}>
                        <UserCheck size={22} />
                      </div>
                      <div>
                        <h2>Student Account Management</h2>
                        <p style={{ marginTop: '2px' }}>View, search, and permanently delete student accounts from the system.</p>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: '16px', marginTop: '20px', flexWrap: 'wrap' }}>
                      {[
                        { label: 'Total Students', value: studentStats.total, color: 'var(--primary)', bg: 'rgba(99,102,241,0.12)' },
                        { label: 'Approved', value: studentStats.approved, color: 'var(--success)', bg: 'rgba(16,185,129,0.12)' },
                        { label: 'Pending', value: studentStats.pending, color: 'var(--warning)', bg: 'rgba(245,158,11,0.12)' },
                        { label: 'Rejected', value: studentStats.rejected, color: 'var(--danger)', bg: 'rgba(239,68,68,0.12)' },
                      ].map(stat => (
                        <div key={stat.label} style={{
                          padding: '12px 20px', borderRadius: '12px',
                          background: stat.bg, border: `1px solid ${stat.color}33`,
                          display: 'flex', alignItems: 'center', gap: '10px'
                        }}>
                          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: stat.color }}>{stat.value}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{stat.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Search & Filter Bar */}
                  <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                      <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="glass-input"
                        placeholder="Search by name, roll no., username, BT..."
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        style={{ paddingLeft: '40px' }}
                      />
                    </div>
                    <select
                      className="glass-input glass-select"
                      value={studentStatusFilter}
                      onChange={e => setStudentStatusFilter(e.target.value)}
                      style={{ width: '160px' }}
                    >
                      <option value="">All Statuses</option>
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <select
                      className="glass-input glass-select"
                      value={studentBranchFilter}
                      onChange={e => setStudentBranchFilter(e.target.value)}
                      style={{ width: '180px' }}
                    >
                      <option value="">All Branches</option>
                      {uniqueStudentBranches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {filteredStudents.length} of {students.length} students
                    </span>
                    {selectedUserIds.length > 0 && (
                      <button
                        onClick={() => setShowBulkDeleteConfirm(true)}
                        className="btn btn-danger animate-fade-in"
                        style={{
                          padding: '8px 16px',
                          fontSize: '0.85rem',
                          background: 'var(--danger)',
                          borderColor: '#ef4444',
                          color: '#fff',
                          fontWeight: 600,
                          marginLeft: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Trash2 size={16} /> Delete Selected ({selectedUserIds.length})
                      </button>
                    )}
                  </div>

                  {/* Students Table */}
                  {filteredStudents.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
                      <UserX size={40} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                      <h4>No students found</h4>
                      <p style={{ marginTop: '8px' }}>Try adjusting your search or filter criteria.</p>
                    </div>
                  ) : (
                    <div className="glass-panel" style={{ overflow: 'hidden' }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.08)' }}>
                              <th style={{ padding: '14px 16px', width: '40px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isAllFilteredSelected}
                                  onChange={handleSelectAll}
                                  style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                                />
                              </th>
                              <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>#</th>
                              <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student</th>
                              <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Roll / BT</th>
                              <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Branch</th>
                              <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Year / Sem</th>
                              <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                              <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joined</th>
                              <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStudents.map((s, idx) => (
                              <tr key={s.id} style={{
                                borderBottom: '1px solid var(--border-glass)',
                                transition: 'background 0.15s ease'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={selectedUserIds.includes(s.id)}
                                    onChange={e => handleSelectUser(s.id, e.target.checked)}
                                    style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                                  />
                                </td>
                                <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                                <td style={{ padding: '14px 16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                      width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                                      background: `linear-gradient(135deg, var(--primary), var(--secondary))`,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: '0.85rem', fontWeight: 700, color: '#fff'
                                    }}>
                                      {s.full_name?.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.full_name}</div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{s.username}</div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.roll_number}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BT: {s.bt_number}</div>
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                  <span className="badge badge-secondary" style={{ fontSize: '0.65rem', textTransform: 'none' }}>
                                    {s.branch_name}
                                  </span>
                                </td>
                                <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                                  Year {s.year} &bull; Sem {s.semester}
                                </td>
                                 <td style={{ padding: '14px 16px' }}>
                                   <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                     {s.status === 'approved' && <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Approved</span>}
                                     {s.status === 'pending' && <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Pending</span>}
                                     {s.status === 'rejected' && <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>Rejected</span>}
                                     {s.is_blocked === 1 && (
                                       <span className="badge badge-danger" style={{ fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>Blocked</span>
                                     )}
                                   </div>
                                 </td>
                                 <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                   {new Date(s.created_at).toLocaleDateString()}
                                 </td>
                                 <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                   <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                     {s.is_blocked === 1 ? (
                                       <button
                                         onClick={() => handleToggleBlock(s.id, false)}
                                         className="btn btn-secondary"
                                         style={{
                                           padding: '7px 12px',
                                           borderColor: 'rgba(16, 185, 129, 0.3)',
                                           color: 'var(--success)',
                                           fontSize: '0.8rem', gap: '6px'
                                         }}
                                         title={`Unblock ${s.full_name}`}
                                       >
                                         <UserCheck size={14} /> Unblock
                                       </button>
                                     ) : (
                                       <button
                                         onClick={() => handleToggleBlock(s.id, true)}
                                         className="btn btn-secondary"
                                         style={{
                                           padding: '7px 12px',
                                           borderColor: 'rgba(245, 158, 11, 0.3)',
                                           color: 'var(--warning)',
                                           fontSize: '0.8rem', gap: '6px'
                                         }}
                                         title={`Block ${s.full_name}`}
                                       >
                                         <UserX size={14} /> Block
                                       </button>
                                     )}
                                     <button
                                       onClick={() => setDeleteConfirm({ id: s.id, name: s.full_name })}
                                       className="btn btn-secondary"
                                       style={{
                                         padding: '7px 12px',
                                         borderColor: 'rgba(239,68,68,0.3)',
                                         color: 'var(--danger)',
                                         fontSize: '0.8rem', gap: '6px'
                                       }}
                                       title={`Delete ${s.full_name}'s account`}
                                     >
                                       <Trash2 size={14} /> Delete
                                     </button>
                                   </div>
                                 </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
            )}

            {/* System Audit Logs Tab */}
            {activeTab === 'logs' && (
              <div className="animate-fade-in">
                <div style={{ marginBottom: '32px' }}>
                  <h2>System Audit Log Trail</h2>
                  <p style={{ marginTop: '4px' }}>Real-time history of events, login sessions, reading page progress updates, and administrative overrides.</p>
                </div>

                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '12px' }}>Timestamp</th>
                          <th style={{ padding: '12px' }}>User / Member</th>
                          <th style={{ padding: '12px' }}>Event Action</th>
                          <th style={{ padding: '12px' }}>Entity Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logsLoading ? (
                          <tr>
                            <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              Loading audit logs...
                            </td>
                          </tr>
                        ) : logs.length === 0 ? (
                          <tr>
                            <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              No logs found.
                            </td>
                          </tr>
                        ) : (
                          logs.map((log, index) => {
                            let actionBadgeClass = 'badge-secondary';
                            if (log.action_type === 'login') actionBadgeClass = 'badge-success';
                            else if (log.action_type === 'logout') actionBadgeClass = 'badge-primary';
                            else if (log.action_type === 'download') actionBadgeClass = 'badge-warning';
                            else if (log.action_type === 'admin_action') actionBadgeClass = 'badge-danger';
                            else if (log.action_type === 'view') actionBadgeClass = 'badge-secondary';

                            return (
                              <tr key={log.id || index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                                  {new Date(log.created_at).toLocaleString()}
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <div style={{ fontWeight: 600 }}>{log.full_name || 'System'}</div>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {log.role} {log.roll_number ? `(${log.roll_number})` : ''}
                                  </span>
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <span className={`badge ${actionBadgeClass}`} style={{ fontSize: '0.65rem' }}>
                                    {log.action_type.replace('_', ' ')}
                                  </span>
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <div>{log.details}</div>
                                  {log.book_title && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                      Book: "{log.book_title}"
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* M-3 Pagination Controls */}
                  {logsPagination.totalPages > 1 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '20px',
                      paddingTop: '16px',
                      borderTop: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Showing page {logsPage} of {logsPagination.totalPages} ({logsPagination.total} events)
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => setLogsPage(prev => Math.max(prev - 1, 1))}
                          disabled={logsPage === 1 || logsLoading}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setLogsPage(prev => Math.min(prev + 1, logsPagination.totalPages))}
                          disabled={logsPage === logsPagination.totalPages || logsLoading}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Book Circulation / Loans Tab */}
            {activeTab === 'loans' && (
              <div className="animate-fade-in">
                <div style={{ marginBottom: '32px' }}>
                  <h2>Book Circulation Management</h2>
                  <p style={{ marginTop: '4px' }}>Track issued books, process returns, and manage overdue fines.</p>
                </div>

                <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="glass-input"
                      placeholder="Search loans by book, student..."
                      value={loanSearch}
                      onChange={e => setLoanSearch(e.target.value)}
                      style={{ paddingLeft: '40px' }}
                    />
                  </div>
                  <select
                    className="glass-input glass-select"
                    value={loanStatusFilter}
                    onChange={e => setLoanStatusFilter(e.target.value)}
                    style={{ width: '160px' }}
                  >
                    <option value="">All Statuses</option>
                    <option value="issued">Issued</option>
                    <option value="returned">Returned</option>
                    <option value="overdue">Overdue</option>
                  </select>
                  <button
                    onClick={() => setShowIssueModal(true)}
                    className="btn btn-primary"
                    style={{ padding: '10px 18px' }}
                  >
                    <Plus size={16} /> Issue Book
                  </button>
                </div>

                {(() => {
                  const filtered = loans.filter(l => {
                    const q = loanSearch.toLowerCase();
                    const matchSearch = !q || l.book_title?.toLowerCase().includes(q) || l.borrower_name?.toLowerCase().includes(q);
                    let matchStatus = true;
                    if (loanStatusFilter === 'issued') matchStatus = l.status === 'issued';
                    else if (loanStatusFilter === 'returned') matchStatus = l.status === 'returned';
                    else if (loanStatusFilter === 'overdue') matchStatus = l.status === 'issued' && new Date(l.due_date) < new Date();
                    return matchSearch && matchStatus;
                  });

                  if (filtered.length === 0) {
                    return (
                      <EmptyState
                        icon={ArrowLeftRight}
                        title="No circulation records found"
                        description="No book loans match your current search query or status filter."
                      />
                    );
                  }

                  return (
                    <div className="glass-panel" style={{ overflow: 'hidden' }}>
                      <div className="table-responsive-wrapper">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>Book Details</th>
                              <th>Borrower (Student)</th>
                              <th>Issued Date</th>
                              <th>Due Date</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map(loan => (
                              <tr key={loan.id}>
                                <td>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{loan.book_title}</div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{loan.book_author}</div>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{loan.borrower_name}</div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{loan.borrower_roll}</div>
                                </td>
                                <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{new Date(loan.issued_at).toLocaleDateString()}</td>
                                <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{new Date(loan.due_date).toLocaleDateString()}</td>
                                <td>
                                  <StatusBadge status={loan.status} />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {loan.status === 'issued' && (
                                    <button
                                      onClick={() => setReturnModal(loan)}
                                      className="btn btn-success"
                                      style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                                    >
                                      Return
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Rooms & Interactive BookMyShow Seating Tab */}
            {activeTab === 'rooms' && (
              <RoomSeatingManager
                rooms={rooms}
                tables={allTables}
                apiCall={apiCall}
                showFeedback={showFeedback}
                onRefresh={fetchAllAdminData}
                onAddRoomModal={() => setShowRoomModal(true)}
                onAddTableModal={() => setShowTableModal(true)}
              />
            )}

            {/* Book Copies Tab */}
            {activeTab === 'copies' && (
              <div className="animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }} className="responsive-grid-1col">
                  <div>
                    <h2>Physical Book Copies</h2>
                    <p style={{ marginTop: '4px' }}>Manage physical copies with unique UUIDs and QR labels.</p>
                  </div>
                  <button onClick={() => setShowCopyModal(true)} className="btn btn-primary" style={{ padding: '10px 18px', marginTop: '12px' }}>
                    <Plus size={16} /> Add Copy
                  </button>
                </div>

                <div className="glass-panel" style={{ overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.1)' }}>
                          <th style={{ padding: '16px' }}>Book</th>
                          <th style={{ padding: '16px' }}>Copy UUID</th>
                          <th style={{ padding: '16px' }}>QR Code</th>
                          <th style={{ padding: '16px' }}>Status</th>
                          <th style={{ padding: '16px', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookCopies.map(copy => (
                          <tr key={copy.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '16px', fontWeight: 600 }}>{copy.book_title}</td>
                            <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{copy.copy_uuid}</td>
                            <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{copy.qr_code}</td>
                            <td style={{ padding: '16px' }}>
                              <span className={`badge ${copy.status === 'available' ? 'badge-success' : copy.status === 'issued' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                                {copy.status}
                              </span>
                            </td>
                            <td style={{ padding: '16px', textAlign: 'center' }}>
                              <button
                                onClick={async () => {
                                  const newStatus = copy.status === 'available' ? 'issued' : 'available';
                                  await apiCall(`/book-copies/${copy.id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
                                  setBookCopies(prev => prev.map(c => c.id === copy.id ? { ...c, status: newStatus } : c));
                                  showFeedback(`Copy marked as ${newStatus}`);
                                }}
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                              >
                                Toggle Status
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Settings & System Preferences Tab */}
            {activeTab === 'settings' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                {/* Visual Appearance & Themes */}
                <SettingsView isAdmin={true} />

                {/* Library Circulation Rules & Fine Structure */}
                <div className="glass-panel" style={{ padding: '24px', maxWidth: '860px', margin: '0 auto', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)' }}>
                      <Settings size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Circulation Rules & Fine Structure</h3>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Configure checkout duration and overdue penalty limits across the campus</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Default Loan Duration (Days)
                      </label>
                      <input
                        type="number"
                        className="glass-input"
                        value={librarySettings.loan_duration_days}
                        onChange={e => setLibrarySettings({ ...librarySettings, loan_duration_days: parseInt(e.target.value) || 0 })}
                        min="1"
                        max="90"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Fine Rate (₹ / Overdue Day)
                      </label>
                      <input
                        type="number"
                        className="glass-input"
                        value={librarySettings.fine_per_day}
                        onChange={e => setLibrarySettings({ ...librarySettings, fine_per_day: parseFloat(e.target.value) || 0 })}
                        min="0"
                        step="0.5"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Maximum Fine Cap (₹)
                      </label>
                      <input
                        type="number"
                        className="glass-input"
                        value={librarySettings.max_fine}
                        onChange={e => setLibrarySettings({ ...librarySettings, max_fine: parseFloat(e.target.value) || 0 })}
                        min="0"
                      />
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      setSettingsSaving(true);
                      try {
                        await apiCall('/library-settings', { method: 'PUT', body: JSON.stringify(librarySettings) });
                        showFeedback('Circulation rules updated successfully');
                      } catch (err) {
                        showFeedback(err.message || 'Failed to update settings', 'error');
                      } finally {
                        setSettingsSaving(false);
                      }
                    }}
                    className="btn btn-primary"
                    style={{ padding: '10px 20px', fontSize: '0.88rem' }}
                    disabled={settingsSaving}
                  >
                    {settingsSaving ? 'Saving Rules...' : 'Save Circulation Rules'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Delete Student Confirmation Modal ─────────────────────────────── */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: '100%', maxWidth: '440px',
            padding: '36px', textAlign: 'center',
            border: '1px solid rgba(239,68,68,0.25)',
            boxShadow: '0 0 40px rgba(239,68,68,0.12), var(--shadow-glass)'
          }}>
            {/* Icon */}
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 20px',
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--danger)'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h3 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Delete Student Account?</h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              You are about to permanently delete the account of:
            </p>
            <div style={{
              padding: '12px 20px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              marginBottom: '20px'
            }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                {deleteConfirm.name}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: 1.6 }}>
              This action is <strong style={{ color: 'var(--danger)' }}>irreversible</strong>. All their reading progress,
              branch permissions, and activity logs will also be deleted.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn btn-secondary"
                style={{ padding: '10px 24px', minWidth: '120px' }}
                disabled={deleteLoading}
              >
                <X size={16} /> Cancel
              </button>
              <button
                onClick={handleDeleteStudent}
                className="btn btn-danger"
                style={{ padding: '10px 24px', minWidth: '140px' }}
                disabled={deleteLoading}
              >
                <Trash2 size={16} />
                {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Student Confirmation Modal ─────────────────────────── */}
      {showBulkDeleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: '100%', maxWidth: '440px',
            padding: '36px', textAlign: 'center',
            border: '1px solid rgba(239,68,68,0.25)',
            boxShadow: '0 0 40px rgba(239,68,68,0.12), var(--shadow-glass)'
          }}>
            {/* Icon */}
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 20px',
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--danger)'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h3 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Bulk Delete Student Accounts?</h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              You are about to permanently delete the accounts of:
            </p>
            <div style={{
              padding: '12px 20px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              marginBottom: '20px'
            }}>
              <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--danger)' }}>
                {selectedUserIds.length} Selected Students
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: 1.6 }}>
              This action is <strong style={{ color: 'var(--danger)' }}>irreversible</strong>. All their reading progress,
              branch permissions, and activity logs will also be permanently deleted.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="btn btn-secondary"
                style={{ padding: '10px 24px', minWidth: '120px' }}
                disabled={bulkDeleteLoading}
              >
                <X size={16} /> Cancel
              </button>
              <button
                onClick={handleBulkDeleteStudents}
                className="btn btn-danger"
                style={{ padding: '10px 24px', minWidth: '140px' }}
                disabled={bulkDeleteLoading}
              >
                <Trash2 size={16} />
                {bulkDeleteLoading ? 'Deleting...' : 'Yes, Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Books Confirmation Modal ───────────────────────────── */}
      {showBulkDeleteBooksConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: '100%', maxWidth: '440px',
            padding: '36px', textAlign: 'center',
            border: '1px solid rgba(239,68,68,0.25)',
            boxShadow: '0 0 40px rgba(239,68,68,0.12), var(--shadow-glass)'
          }}>
            {/* Icon */}
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 20px',
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--danger)'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h3 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Bulk Delete Books?</h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              You are about to permanently delete the catalog entries and PDF files of:
            </p>
            <div style={{
              padding: '12px 20px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              marginBottom: '20px'
            }}>
              <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--danger)' }}>
                {selectedBookIds.length} Selected Books
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: 1.6 }}>
              This action is <strong style={{ color: 'var(--danger)' }}>irreversible</strong>. Physical PDF files will be unlinked from the server and users will lose all reading progress on these books.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowBulkDeleteBooksConfirm(false)}
                className="btn btn-secondary"
                style={{ padding: '10px 24px', minWidth: '120px' }}
                disabled={bulkDeleteBooksLoading}
              >
                <X size={16} /> Cancel
              </button>
              <button
                onClick={handleBulkDeleteBooks}
                className="btn btn-danger"
                style={{ padding: '10px 24px', minWidth: '140px' }}
                disabled={bulkDeleteBooksLoading}
              >
                <Trash2 size={16} />
                {bulkDeleteBooksLoading ? 'Deleting...' : 'Yes, Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Book Add / Edit Modal Popup (Modernized & Professional) ── */}
      {showBookModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 12, 0.82)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: '100%',
            maxWidth: '560px',
            padding: '28px 32px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.4), var(--shadow-glass)',
            border: '1px solid var(--border-glass)',
            borderRadius: '16px',
            maxHeight: '92vh',
            overflowY: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  padding: '10px',
                  borderRadius: '10px',
                  background: 'rgba(37, 99, 235, 0.12)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <BookOpen size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {editingBook ? 'Edit Book Metadata' : 'Catalog New Book Reference'}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    SISTec Departmental Syllabus & Digital Library Repository
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowBookModal(false)}
                className="btn btn-secondary"
                style={{ padding: '6px', borderRadius: '50%', minWidth: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close Modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Inline Error Notice */}
            {bookModalError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#ef4444',
                fontSize: '0.82rem'
              }}>
                <AlertTriangle size={16} />
                <span>{bookModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveBook} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Title & Author */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Book Title <span style={{ color: 'var(--primary)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Higher Engineering Mathematics"
                  value={bookFormData.title}
                  onChange={(e) => {
                    setBookFormData({ ...bookFormData, title: e.target.value });
                    if (bookModalError) setBookModalError('');
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Author / Publication <span style={{ color: 'var(--primary)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Dr. B.S. Grewal (Khanna Publishers)"
                  value={bookFormData.author}
                  onChange={(e) => {
                    setBookFormData({ ...bookFormData, author: e.target.value });
                    if (bookModalError) setBookModalError('');
                  }}
                  required
                />
              </div>

              {/* Branch & Category Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Department / Branch <span style={{ color: 'var(--primary)' }}>*</span>
                  </label>
                  <select
                    className="glass-input glass-select"
                    value={bookFormData.branch_id}
                    onChange={(e) => setBookFormData({ ...bookFormData, branch_id: e.target.value })}
                  >
                    {branches.map(br => (
                      <option key={br.id} value={br.id}>{br.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Curriculum Category <span style={{ color: 'var(--primary)' }}>*</span>
                  </label>
                  <select
                    className="glass-input glass-select"
                    value={bookFormData.category_id}
                    onChange={(e) => setBookFormData({ ...bookFormData, category_id: e.target.value })}
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Syllabus Classification
                </label>
                <select
                  className="glass-input glass-select"
                  value={bookFormData.priority}
                  onChange={(e) => setBookFormData({ ...bookFormData, priority: e.target.value })}
                >
                  <option value="main">Main Syllabus (RGPV Prescribed Core Book)</option>
                  <option value="sub">Reference Book (Supplementary Academic Resource)</option>
                </select>
              </div>

              {/* PDF Document Upload Zone (Modern Styled File Input) */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Digital Document PDF {!editingBook && <span style={{ color: 'var(--primary)' }}>*</span>}
                </label>

                {/* Hidden Real File Input */}
                <input
                  type="file"
                  ref={pdfInputRef}
                  style={{ display: 'none' }}
                  accept="application/pdf"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setPdfFile(file);
                      if (bookModalError) setBookModalError('');
                    }
                  }}
                />

                {/* Styled Dropzone / Selected File Card */}
                {pdfFile ? (
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: 'rgba(37, 99, 235, 0.08)',
                    border: '1px solid var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <FileText size={20} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {pdfFile.name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPdfFile(null);
                        if (pdfInputRef.current) pdfInputRef.current.value = '';
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '6px', borderRadius: '50%', minWidth: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Remove selected file"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => pdfInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--border-glass)',
                      borderRadius: '12px',
                      padding: '24px 20px',
                      textAlign: 'center',
                      background: 'var(--input-bg)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(37, 99, 235, 0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.background = 'var(--input-bg)'; }}
                  >
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'rgba(37, 99, 235, 0.1)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <UploadCloud size={22} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Click to browse or drop PDF document here
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Standard university syllabus PDF up to 50MB
                      </div>
                    </div>

                    {editingBook && editingBook.pdf_url && (
                      <div style={{
                        marginTop: '8px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        fontSize: '0.72rem',
                        color: 'var(--text-secondary)'
                      }}>
                        Current: {editingBook.pdf_url.split('/').pop()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '12px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  disabled={bookSaving}
                >
                  {bookSaving ? (
                    <>
                      <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Saving to Catalog...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Save Book Details
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '12px 20px' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bulk Upload Modal ────────────────────────────────────── */}
      {showBulkModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100, padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: '100%', maxWidth: '680px',
            padding: '32px',
            boxShadow: 'var(--shadow-glass)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(6,182,212,0.15)', color: 'var(--secondary)' }}>
                  <Layers size={20} />
                </div>
                <div>
                  <h3 style={{ marginBottom: '2px' }}>Bulk Upload Books</h3>
                  <p style={{ fontSize: '0.8rem', margin: 0 }}>Upload multiple PDFs at once — titles are auto-extracted from filenames</p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="btn btn-secondary"
                style={{ padding: '6px', borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Shared Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Branch</label>
                <select
                  className="glass-input glass-select"
                  value={bulkFormData.branch_id}
                  onChange={e => setBulkFormData({ ...bulkFormData, branch_id: e.target.value })}
                >
                  {branches.map(br => <option key={br.id} value={br.id}>{br.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Category</label>
                <select
                  className="glass-input glass-select"
                  value={bulkFormData.category_id}
                  onChange={e => setBulkFormData({ ...bulkFormData, category_id: e.target.value })}
                >
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Priority</label>
                <select
                  className="glass-input glass-select"
                  value={bulkFormData.priority}
                  onChange={e => setBulkFormData({ ...bulkFormData, priority: e.target.value })}
                >
                  <option value="main">Main Subject (1st Priority)</option>
                  <option value="sub">Sub Subject (2nd Priority)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Author (Optional — applies to all)</label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Various Authors"
                  value={bulkFormData.author}
                  onChange={e => setBulkFormData({ ...bulkFormData, author: e.target.value })}
                />
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleBulkDrop}
              onClick={() => bulkFileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--secondary)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: '12px',
                padding: '32px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(6,182,212,0.06)' : 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
                marginBottom: '16px'
              }}
            >
              <Upload size={32} style={{ color: 'var(--secondary)', marginBottom: '10px' }} />
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Drop PDF files here or click to browse</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>Supports multiple PDFs — up to 50 files at once</p>
              <input
                ref={bulkFileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                style={{ display: 'none' }}
                onChange={handleBulkFileSelect}
              />
            </div>

            {/* Selected Files List */}
            {bulkFiles.length > 0 && (
              <div style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.07)',
                maxHeight: '220px',
                overflowY: 'auto',
                marginBottom: '16px'
              }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {bulkFiles.length} file{bulkFiles.length !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={() => setBulkFiles([])}
                    style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Clear all
                  </button>
                </div>
                {bulkFiles.map((f, i) => {
                  // Find result for this file if upload was done
                  const res = bulkResults?.results?.find(r => r.file === f.name);
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 14px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      fontSize: '0.82rem'
                    }}>
                      <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {(f.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                      {/* Result badge */}
                      {res && res.status === 'success' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontSize: '0.72rem', flexShrink: 0 }}>
                          <CheckCircle2 size={13} /> Added
                        </span>
                      )}
                      {res && res.status === 'skipped' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--warning)', fontSize: '0.72rem', flexShrink: 0 }}>
                          <SkipForward size={13} /> Skipped
                        </span>
                      )}
                      {res && res.status === 'error' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--danger)', fontSize: '0.72rem', flexShrink: 0 }}>
                          <XCircle size={13} /> Error
                        </span>
                      )}
                      {/* Remove button (only if not yet uploaded) */}
                      {!bulkResults && (
                        <button
                          onClick={() => removeBulkFile(f.name)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}
                          title="Remove"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary after upload */}
            {bulkResults && (
              <div style={{
                display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap'
              }}>
                <div style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)' }}>{bulkResults.imported}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Added</div>
                </div>
                <div style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--warning)' }}>{bulkResults.skipped}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Skipped</div>
                </div>
                <div style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--danger)' }}>{bulkResults.errors}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Errors</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {!bulkResults ? (
                <button
                  onClick={handleBulkUpload}
                  disabled={bulkUploading || bulkFiles.length === 0}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '12px', opacity: (bulkUploading || bulkFiles.length === 0) ? 0.6 : 1 }}
                >
                  {bulkUploading ? (
                    <>
                      <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Uploading {bulkFiles.length} files...
                    </>
                  ) : (
                    <><Upload size={16} /> Upload {bulkFiles.length > 0 ? `${bulkFiles.length} PDF${bulkFiles.length !== 1 ? 's' : ''}` : 'PDFs'}</>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => { setBulkFiles([]); setBulkResults(null); }}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '12px', border: '1px solid rgba(6,182,212,0.3)', color: 'var(--secondary)' }}
                >
                  <Layers size={16} /> Upload More Files
                </button>
              )}
              <button
                onClick={() => setShowBulkModal(false)}
                className="btn btn-secondary"
                style={{ padding: '12px 20px' }}
              >
                {bulkResults ? 'Close' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="SISTec Logo" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
          <div>
            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', lineHeight: 1.15 }}>
              SISTec Admin
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              System Console
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NotificationBell />
          <button 
            onClick={() => setShowMenuDrawer(true)}
            className="btn btn-secondary"
            style={{ padding: '6px', borderRadius: '50%', width: '34px', height: '34px', minWidth: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Open Navigation Menu"
          >
            <Menu size={17} />
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation (5 core items) */}
      <nav className="mobile-bottom-nav">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`bottom-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
        >
          <BarChart3 size={19} />
          <span>Stats</span>
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`bottom-nav-item ${activeTab === 'users' ? 'active' : ''}`}
        >
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <Users size={19} />
            {pendingUsers.length > 0 && (
              <span style={{
                position: 'absolute', top: '-4px', right: '-8px',
                background: 'var(--primary)', color: '#fff',
                fontSize: '0.62rem', fontWeight: 700, width: '15px', height: '15px',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {pendingUsers.length}
              </span>
            )}
          </div>
          <span>Approvals</span>
        </button>
        <button 
          onClick={() => setActiveTab('loans')}
          className={`bottom-nav-item ${activeTab === 'loans' ? 'active' : ''}`}
        >
          <ArrowLeftRight size={19} />
          <span>Circulation</span>
        </button>
        <button 
          onClick={() => setActiveTab('books')}
          className={`bottom-nav-item ${activeTab === 'books' ? 'active' : ''}`}
        >
          <BookOpen size={19} />
          <span>Inventory</span>
        </button>
        <button 
          onClick={() => setShowMenuDrawer(true)}
          className="bottom-nav-item"
        >
          <Menu size={19} />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile Navigation Drawer */}
      {showMenuDrawer && (
        <div className="mobile-drawer-overlay" onClick={() => setShowMenuDrawer(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src="/logo.png" alt="SISTec Logo" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
                <div>
                  <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem' }}>SISTec Admin Console</h4>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Root Operations</span>
                </div>
              </div>
              <button 
                onClick={() => setShowMenuDrawer(false)}
                className="btn btn-secondary"
                style={{ padding: '4px', borderRadius: '50%', width: '28px', height: '28px', minWidth: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close Drawer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mobile-drawer-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 0' }}>
              <button 
                onClick={() => { setActiveTab('overview'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <BarChart3 size={16} /> Overview & Analytics
              </button>
              <button 
                onClick={() => { setActiveTab('users'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <Users size={16} /> User Approvals ({pendingUsers.length})
              </button>
              <button 
                onClick={() => { setActiveTab('permissions'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'permissions' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <Key size={16} /> Access Requests ({pendingRequests.length})
              </button>
              <button 
                onClick={() => { setActiveTab('loans'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'loans' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <ArrowLeftRight size={16} /> Circulation ({loans.filter(l => l.status === 'issued').length})
              </button>
              <button 
                onClick={() => { setActiveTab('rooms'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <MapPin size={16} /> Rooms & Tables
              </button>
              <button 
                onClick={() => { setActiveTab('copies'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'copies' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <Package size={16} /> Book Copies
              </button>
              <button 
                onClick={() => { setActiveTab('settings'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <Settings size={16} /> Settings
              </button>
              <button 
                onClick={() => { setActiveTab('books'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'books' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <BookOpen size={16} /> Book Inventory
              </button>
              <button 
                onClick={() => { setActiveTab('students'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <UserCheck size={16} /> All Students ({students.length})
              </button>
              <button 
                onClick={() => { setActiveTab('logs'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <History size={16} /> System Audit Logs
              </button>

              <div style={{ margin: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }} />

              <button 
                onClick={() => { logout(); setShowMenuDrawer(false); }}
                className="btn btn-secondary"
                style={{ justifyContent: 'center', width: '100%', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
              >
                <X size={16} /> Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Issue Book Modal ────────────────────────────────────── */}
      {showIssueModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Issue Book</h3>
              <button onClick={() => setShowIssueModal(false)} className="btn btn-secondary" style={{ padding: '6px', borderRadius: '50%' }}><X size={16} /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (issueLoading) return;
              setIssueLoading(true);
              try {
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + librarySettings.loan_duration_days);
                await apiCall('/book-loans', {
                  method: 'POST',
                  body: JSON.stringify({ copy_id: issueFormData.copy_id, user_id: issueFormData.user_id, due_date: dueDate.toISOString() })
                });
                showFeedback('Book issued successfully');
                setShowIssueModal(false);
                setIssueFormData({ copy_id: '', user_id: '', due_date: '' });
                const loansList = await apiCall('/book-loans');
                setLoans(loansList || []);
              } catch (err) {
                showFeedback(err.message || 'Failed to issue book', 'error');
              } finally {
                setIssueLoading(false);
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Book Copy</label>
                <select
                  className="glass-input glass-select"
                  value={issueFormData.copy_id}
                  onChange={e => setIssueFormData({ ...issueFormData, copy_id: e.target.value })}
                  required
                >
                  <option value="">Select copy</option>
                  {bookCopies.filter(c => c.status === 'available').map(copy => (
                    <option key={copy.id} value={copy.id}>{copy.book_title} ({copy.copy_uuid?.slice(0, 8)}...)</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Student</label>
                <select
                  className="glass-input glass-select"
                  value={issueFormData.user_id}
                  onChange={e => setIssueFormData({ ...issueFormData, user_id: e.target.value })}
                  required
                >
                  <option value="">Select student</option>
                  {students.filter(s => s.status === 'approved').map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.roll_number})</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '12px' }} disabled={issueLoading}>
                {issueLoading ? 'Issuing...' : 'Issue Book'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Return Book Modal ───────────────────────────────────── */}
      {returnModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '28px', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '12px' }}>Return Book</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              {returnModal.book_title} by {returnModal.book_author}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setReturnModal(null)} className="btn btn-secondary" style={{ padding: '10px 20px' }}>Cancel</button>
              <button
                onClick={async () => {
                  try {
                    const now = new Date().toISOString();
                    const dueDate = new Date(returnModal.due_date);
                    const daysOverdue = now > dueDate.toISOString() ? Math.floor((new Date(now) - dueDate) / (1000 * 60 * 60 * 24)) : 0;
                    const fineAmount = Math.min(daysOverdue * librarySettings.fine_per_day, librarySettings.max_fine);
                    await apiCall(`/book-loans/${returnModal.id}/return`, {
                      method: 'POST',
                      body: JSON.stringify({ fine_amount: fineAmount })
                    });
                    showFeedback(fineAmount > 0 ? `Returned with fine ₹${fineAmount}` : 'Returned successfully');
                    setReturnModal(null);
                    const loansList = await apiCall('/book-loans');
                    setLoans(loansList || []);
                  } catch (err) {
                    showFeedback(err.message || 'Failed to return book', 'error');
                  }
                }}
                className="btn btn-success"
                style={{ padding: '10px 20px' }}
              >
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Room Modal ─────────────────────────────────────── */}
      {showRoomModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Add Room</h3>
              <button onClick={() => setShowRoomModal(false)} className="btn btn-secondary" style={{ padding: '6px', borderRadius: '50%' }}><X size={16} /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const data = await apiCall('/rooms', { method: 'POST', body: JSON.stringify({ name: roomName, description: roomDesc }) });
                setRooms(prev => [...prev, data.data]);
                setShowRoomModal(false);
                setRoomName('');
                setRoomDesc('');
                showFeedback('Room added');
              } catch (err) {
                showFeedback(err.message || 'Failed to add room', 'error');
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Room Name</label>
                <input type="text" className="glass-input" value={roomName} onChange={e => setRoomName(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</label>
                <input type="text" className="glass-input" value={roomDesc} onChange={e => setRoomDesc(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '12px' }}>Save Room</button>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Table Modal ────────────────────────────────────── */}
      {showTableModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Add Table</h3>
              <button onClick={() => setShowTableModal(false)} className="btn btn-secondary" style={{ padding: '6px', borderRadius: '50%' }}><X size={16} /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const data = await apiCall('/tables', { method: 'POST', body: JSON.stringify(tableFormData) });
                setAllTables(prev => [...prev, data.data]);
                setShowTableModal(false);
                setTableFormData({ room_id: '', table_number: '', qr_identifier: '' });
                showFeedback('Table added');
              } catch (err) {
                showFeedback(err.message || 'Failed to add table', 'error');
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Room</label>
                <select
                  className="glass-input glass-select"
                  value={tableFormData.room_id}
                  onChange={e => setTableFormData({ ...tableFormData, room_id: e.target.value })}
                  required
                >
                  <option value="">Select room</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Table Number</label>
                <input type="text" className="glass-input" value={tableFormData.table_number} onChange={e => setTableFormData({ ...tableFormData, table_number: e.target.value })} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>QR Identifier</label>
                <input type="text" className="glass-input" value={tableFormData.qr_identifier} onChange={e => setTableFormData({ ...tableFormData, qr_identifier: e.target.value })} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '12px' }}>Save Table</button>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Copy Modal ─────────────────────────────────────── */}
      {showCopyModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Add Book Copy</h3>
              <button onClick={() => setShowCopyModal(false)} className="btn btn-secondary" style={{ padding: '6px', borderRadius: '50%' }}><X size={16} /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const qrCode = copyFormData.qr_code || `COPY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
                const data = await apiCall('/book-copies', { method: 'POST', body: JSON.stringify({ ...copyFormData, qr_code: qrCode }) });
                setBookCopies(prev => [...prev, data.data]);
                setShowCopyModal(false);
                setCopyFormData({ book_id: '', qr_code: '' });
                showFeedback('Copy added');
              } catch (err) {
                showFeedback(err.message || 'Failed to add copy', 'error');
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Book</label>
                <select
                  className="glass-input glass-select"
                  value={copyFormData.book_id}
                  onChange={e => setCopyFormData({ ...copyFormData, book_id: e.target.value })}
                  required
                >
                  <option value="">Select book</option>
                  {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>QR Code (optional)</label>
                <input type="text" className="glass-input" value={copyFormData.qr_code} onChange={e => setCopyFormData({ ...copyFormData, qr_code: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '12px' }}>Add Copy</button>
            </form>
          </div>
        </div>
      )}
      {deleteBookConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: '100%', maxWidth: '440px',
            padding: '36px', textAlign: 'center',
            border: '1px solid rgba(239,68,68,0.25)',
            boxShadow: '0 0 40px rgba(239,68,68,0.12), var(--shadow-glass)'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 20px',
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--danger)'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h3 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Delete Book?</h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              You are about to permanently delete the catalog entry and PDF file for:
            </p>
            <div style={{
              padding: '12px 20px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              marginBottom: '20px'
            }}>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                {deleteBookConfirm.title}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: 1.6 }}>
              This action is <strong style={{ color: 'var(--danger)' }}>irreversible</strong>. Users will lose all reading progress on this book.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteBookConfirm(null)}
                className="btn btn-secondary"
                style={{ padding: '10px 24px', minWidth: '120px' }}
                disabled={deleteBookLoading}
              >
                <X size={16} /> Cancel
              </button>
              <button
                onClick={handleDeleteBook}
                className="btn btn-danger"
                style={{ padding: '10px 24px', minWidth: '140px' }}
                disabled={deleteBookLoading}
              >
                <Trash2 size={16} />
                {deleteBookLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
