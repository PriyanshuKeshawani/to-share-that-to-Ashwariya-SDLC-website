import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth, normalizeBranch, isSameBranch } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../supabaseClient';
  import { 
    Users, BookOpen, Key, History, BarChart3, Plus, Edit, Trash2, Check, X, 
    Search, ShieldAlert, Award, FileText, Download, TrendingUp,
    UserCheck, UserX, AlertTriangle, User,
    Menu, Settings, UploadCloud, Activity, Image, FolderUp, CheckCircle2, Sparkles,
    ArrowLeft, Calendar, Filter, ExternalLink, ChevronRight, Info, Clock, RefreshCw, GitBranch,
    Sun, Moon, PanelLeftClose, PanelLeftOpen
  } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import SettingsView from '../components/SettingsView';
import StudentActivityModal from '../components/StudentActivityModal';
import BookActivityModal from '../components/BookActivityModal';
import { parseDirectoryFiles } from '../utils/directoryParser';
import { extractFirstPageAsCover } from '../utils/pdfCoverExtractor';
import { resolveBookCover } from '../utils/bookCoverResolver';
import NotificationBell from '../components/NotificationBell';

const AdminDashboard = () => {
  const { user, logout, apiCall } = useAuth();
  const { mode, toggleMode } = useTheme();
  const isDark = mode === 'dark';

  // Google AI Studio style Collapsible Sidebar State (PC / Desktop users)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('admin-sidebar-collapsed') === 'true';
  });

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('admin-sidebar-collapsed', String(next));
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
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const validTabs = ['overview', 'analytics', 'books', 'students', 'approvals', 'requests', 'branches', 'settings'];
    return validTabs.includes(tabParam) ? tabParam : 'overview';
  });

  const setActiveTab = useCallback((tab) => {
    setActiveTabState(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const validTabs = ['overview', 'analytics', 'books', 'students', 'approvals', 'requests', 'branches', 'settings'];
      if (validTabs.includes(tabParam)) {
        setActiveTabState(tabParam);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [selectedAdminBranch, setSelectedAdminBranch] = useState(() => {
    return user?.adminBranch || 'all';
  });
  const [dashboardData, setDashboardData] = useState(null);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [permissionTab, setPermissionTab] = useState('pending'); // 'pending', 'approved', 'rejected', 'all'
  const [permissionSearch, setPermissionSearch] = useState('');
  const [permissionActionLoading, setPermissionActionLoading] = useState({});
  const [books, setBooks] = useState([]);
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);

  // Registration Approval Policy & Bulk Action State
  const [registrationPolicy, setRegistrationPolicy] = useState('manual');
  const [policyLoading, setPolicyLoading] = useState(false);
  const [showBulkApproveUsersConfirm, setShowBulkApproveUsersConfirm] = useState(false);
  const [bulkApproveUsersLoading, setBulkApproveUsersLoading] = useState(false);
  const [userActionLoading, setUserActionLoading] = useState({});

  // Book Cover Automation State
  const [resolvingCoversLoading, setResolvingCoversLoading] = useState(false);
  const [autoFindingCover, setAutoFindingCover] = useState(false);

  // Students Management State
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState(''); // '', 'approved', 'pending', 'rejected'
  const [studentBranchFilter, setStudentBranchFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name } or null
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedStudentForActivity, setSelectedStudentForActivity] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentEditFormData, setStudentEditFormData] = useState({
    full_name: '',
    roll_number: '',
    bt_number: '',
    branch_name: '',
    year: '',
    semester: '',
    email: '',
    status: 'approved'
  });
  const [studentEditSaving, setStudentEditSaving] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState([]);
  const [showBulkDeleteBooksConfirm, setShowBulkDeleteBooksConfirm] = useState(false);
  const [bulkDeleteBooksLoading, setBulkDeleteBooksLoading] = useState(false);
  const [deleteBookConfirm, setDeleteBookConfirm] = useState(null); // { id, title }
  const [deleteBookLoading, setDeleteBookLoading] = useState(false);
  const [selectedBookForActivity, setSelectedBookForActivity] = useState(null);

  // Branch Management State
  const [newBranchName, setNewBranchName] = useState('');
  const [branchActionLoading, setBranchActionLoading] = useState(false);
  const [branchDeleteConfirm, setBranchDeleteConfirm] = useState(null); // { id, name }
  const [editingBranch, setEditingBranch] = useState(null); // { id, name }

  // Real-time Analytics & Drilldown State
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState('all'); // 'all', 'today', '7d', '30d'
  const [analyticsRefreshing, setAnalyticsRefreshing] = useState(false);
  const [activeAnalyticsDrilldown, setActiveAnalyticsDrilldown] = useState(null); // 'books' | 'students' | 'views' | 'downloads' | null
  const [drilldownSearch, setDrilldownSearch] = useState('');
  const [selectedBranchForDrilldown, setSelectedBranchForDrilldown] = useState(null); // branch object or null
  const [departmentActiveTab, setDepartmentActiveTab] = useState('overview'); // 'overview' | 'students' | 'books' | 'activity'
  const [departmentSearch, setDepartmentSearch] = useState('');

  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    setSelectedUserIds([]);
    setSelectedBookIds([]);
  }, []);

  // Book CRUD Modal State
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookSaving, setBookSaving] = useState(false);
  const [directoryImporting, setDirectoryImporting] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [bookFormData, setBookFormData] = useState({ title: '', author: '', category_id: '', branch_id: '', priority: 'main', description: '', cover_url: '' });
  const [pdfFile, setPdfFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [bookModalError, setBookModalError] = useState('');
  const pdfInputRef = useRef(null);
  const directoryInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ text: '', type: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // M-3 State: Audit logs pagination
  const [logs, setLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPagination, setLogsPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [logsLoading, setLogsLoading] = useState(false);
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [toastExiting, setToastExiting] = useState(false);

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
    setToastExiting(false);
    setFeedback({ text, type });
    setTimeout(() => {
      setToastExiting(true);
      setTimeout(() => setFeedback({ text: '', type: '' }), 300);
    }, 4000);
  }, []);

  const fetchAllAdminData = useCallback(async (tf = analyticsTimeframe) => {
    try {
      setLoading(true);
      const branchQueryParam = selectedAdminBranch && selectedAdminBranch !== 'all' ? `?branch=${encodeURIComponent(selectedAdminBranch)}` : '';
      const analyticsBranchParam = selectedAdminBranch && selectedAdminBranch !== 'all' ? `&branch=${encodeURIComponent(selectedAdminBranch)}` : '';
      const [dash, pUsers, pReqs, allReqs, bList, brList, catList, allStudents, regPolicy] = await Promise.all([
        apiCall(`/analytics/dashboard?timeframe=${tf}${analyticsBranchParam}`),
        apiCall(`/auth/pending-users${branchQueryParam}`),
        apiCall(`/permissions/pending-requests${branchQueryParam}`),
        apiCall(`/permissions/all-requests${branchQueryParam}`),
        apiCall('/books'),
        apiCall('/books/branches'),
        apiCall('/books/categories'),
        apiCall('/auth/users'),
        apiCall('/admin/registration-policy')
      ]);

      setDashboardData(dash);
      setPendingUsers(pUsers);
      setPendingRequests(pReqs);
      setAllRequests(allReqs || []);
      setBooks(bList);
      setBranches(brList);
      setCategories(catList);
      setStudents(allStudents.filter(u => u.role === 'student'));
      if (regPolicy?.policy) {
        setRegistrationPolicy(regPolicy.policy);
      }

      // Set initial values for book form dropdowns if not empty
      if (catList.length > 0 && brList.length > 0) {
        setBookFormData(prev => ({
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
  }, [apiCall, selectedAdminBranch, analyticsTimeframe, showFeedback]);

  // Dedicated analytics refresher for timeframe changes, realtime events & manual refresh
  const refreshAnalyticsOnly = useCallback(async (tf = analyticsTimeframe) => {
    try {
      setAnalyticsRefreshing(true);
      const branchParam = selectedAdminBranch && selectedAdminBranch !== 'all' ? `&branch=${encodeURIComponent(selectedAdminBranch)}` : '';
      const dash = await apiCall(`/analytics/dashboard?timeframe=${tf}${branchParam}`);
      setDashboardData(dash);
    } catch (err) {
      console.error('Failed to refresh analytics dashboard:', err);
    } finally {
      setAnalyticsRefreshing(false);
    }
  }, [apiCall, analyticsTimeframe, selectedAdminBranch]);

  const handleTimeframeChange = async (newTf) => {
    setAnalyticsTimeframe(newTf);
    await refreshAnalyticsOnly(newTf);
  };

  const silentRefreshAdminData = useCallback(async () => {
    try {
      const branchQueryParam = selectedAdminBranch && selectedAdminBranch !== 'all' ? `?branch=${encodeURIComponent(selectedAdminBranch)}` : '';
      const analyticsBranchParam = selectedAdminBranch && selectedAdminBranch !== 'all' ? `&branch=${encodeURIComponent(selectedAdminBranch)}` : '';
      const [dash, pUsers, pReqs, allReqs, bList, brList, catList, allStudents] = await Promise.all([
        apiCall(`/analytics/dashboard?timeframe=${analyticsTimeframe}${analyticsBranchParam}`),
        apiCall(`/auth/pending-users${branchQueryParam}`),
        apiCall(`/permissions/pending-requests${branchQueryParam}`),
        apiCall(`/permissions/all-requests${branchQueryParam}`),
        apiCall('/books'),
        apiCall('/books/branches'),
        apiCall('/books/categories'),
        apiCall('/auth/users')
      ]);

      if (dash) setDashboardData(dash);
      if (pUsers) setPendingUsers(pUsers);
      if (pReqs) setPendingRequests(pReqs);
      if (allReqs) setAllRequests(allReqs);
      if (bList) setBooks(bList);
      if (brList) setBranches(brList);
      if (catList) setCategories(catList);
      if (allStudents) setStudents(allStudents.filter(u => u.role === 'student'));
    } catch (err) {
      console.warn('Silent admin realtime refresh note:', err);
    }
  }, [apiCall, selectedAdminBranch, analyticsTimeframe]);

  // Realtime Supabase subscription for instant live updates across all admin modules
  useEffect(() => {
    let debounceTimer = null;
    const triggerDebouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        silentRefreshAdminData();
      }, 500);
    };

    let channel = null;
    try {
      channel = supabase
        .channel(`admin-realtime-all-sync-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, triggerDebouncedRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_book_progress' }, triggerDebouncedRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
          triggerDebouncedRefresh();
          if (payload.eventType === 'INSERT' && payload.new?.role === 'student' && payload.new?.status === 'pending') {
            showFeedback(`New registration pending approval: ${payload.new.full_name || payload.new.username}`, 'info');
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'permissions' }, (payload) => {
          triggerDebouncedRefresh();
          if (payload.eventType === 'INSERT' && payload.new?.status === 'pending') {
            showFeedback('New cross-department book access request received.', 'info');
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, triggerDebouncedRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, triggerDebouncedRefresh)
        .subscribe();
    } catch (e) {
      console.warn('Realtime admin channel subscribe note:', e.message);
    }

    const handleFocus = () => silentRefreshAdminData();
    window.addEventListener('focus', handleFocus);

    const interval = setInterval(silentRefreshAdminData, 10000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [silentRefreshAdminData, showFeedback]);

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

  // Registration Policy Update
  const handleRegistrationPolicyChange = async (newPolicy) => {
    try {
      setPolicyLoading(true);
      const res = await apiCall('/admin/registration-policy', {
        method: 'POST',
        body: JSON.stringify({ policy: newPolicy })
      });
      setRegistrationPolicy(newPolicy);
      showFeedback(res.message || `Registration policy set to ${newPolicy}`);
    } catch (err) {
      showFeedback(err.message || 'Failed to update registration policy', 'error');
    } finally {
      setPolicyLoading(false);
    }
  };

  // Bulk Approve All Pending Users Action
  const handleBulkApproveUsers = async () => {
    try {
      setBulkApproveUsersLoading(true);
      const res = await apiCall('/auth/bulk-approve-users', {
        method: 'POST',
        body: JSON.stringify({
          status: 'approved',
          branch_name: selectedAdminBranch
        })
      });
      showFeedback(res.message || 'All pending registrations approved successfully!', 'success');
      setShowBulkApproveUsersConfirm(false);

      // Refresh data
      const branchQueryParam = selectedAdminBranch && selectedAdminBranch !== 'all' ? `?branch=${encodeURIComponent(selectedAdminBranch)}` : '';
      const [pUsers, dash, allStudents] = await Promise.all([
        apiCall(`/auth/pending-users${branchQueryParam}`),
        apiCall('/analytics/dashboard'),
        apiCall('/auth/users')
      ]);
      setPendingUsers(pUsers);
      setDashboardData(dash);
      setStudents(allStudents.filter(u => u.role === 'student'));
    } catch (err) {
      showFeedback(err.message || 'Bulk approval action failed', 'error');
    } finally {
      setBulkApproveUsersLoading(false);
    }
  };

  // User Approval Action (with action loading & race condition prevention)
  const handleUserApproval = async (userId, status) => {
    if (userActionLoading[userId]) return;
    try {
      setUserActionLoading(prev => ({ ...prev, [userId]: true }));
      const data = await apiCall(`/auth/approve-user/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      showFeedback(data.message || `User registration marked ${status}`);
      // Refresh
      const branchQueryParam = selectedAdminBranch && selectedAdminBranch !== 'all' ? `?branch=${encodeURIComponent(selectedAdminBranch)}` : '';
      const [pUsers, dash] = await Promise.all([
        apiCall(`/auth/pending-users${branchQueryParam}`),
        apiCall('/analytics/dashboard')
      ]);
      setPendingUsers(pUsers);
      setStudents(prev => prev.map(s => s.id === userId ? { ...s, status } : s));
      setDashboardData(dash);
    } catch (err) {
      showFeedback(err.message || 'Action failed', 'error');
    } finally {
      setUserActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Bulk Resolve Missing Covers for Existing Books
  const handleResolveMissingCovers = async () => {
    try {
      setResolvingCoversLoading(true);
      showFeedback('Scanning catalog and resolving missing book covers...');
      const res = await apiCall('/books/resolve-missing-covers', { method: 'POST' });
      showFeedback(res.message || 'Finished cover resolution scan', 'success');
      const bList = await apiCall('/books');
      setBooks(bList);
    } catch (err) {
      showFeedback(err.message || 'Failed to resolve missing covers', 'error');
    } finally {
      setResolvingCoversLoading(false);
    }
  };

  // On-demand Cover Auto-Finder inside Book Modal
  const handleAutoFindCover = async () => {
    if (!bookFormData.title?.trim()) {
      setBookModalError('Please enter the book title before auto-resolving a cover image.');
      return;
    }
    try {
      setAutoFindingCover(true);
      setBookModalError('');
      const res = await resolveBookCover({
        title: bookFormData.title,
        author: bookFormData.author,
        pdfFile
      });
      if (res?.coverUrl) {
        setThumbnailPreview(res.coverUrl);
        setBookFormData(prev => ({ ...prev, cover_url: res.coverUrl }));
        showFeedback(`Cover resolved via ${res.source.replace(/_/g, ' ')}!`);
      } else {
        setBookModalError('Could not find cover online; an aesthetic institutional template will be used.');
      }
    } catch (err) {
      setBookModalError(err.message || 'Failed to auto-resolve book cover.');
    } finally {
      setAutoFindingCover(false);
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

  // Student Edit Handlers
  const openEditStudentModal = (student) => {
    setEditingStudent(student);
    setStudentEditFormData({
      full_name: student.full_name || '',
      roll_number: student.roll_number || '',
      bt_number: student.bt_number || '',
      branch_name: student.branch_name || '',
      year: student.year ? String(student.year) : '',
      semester: student.semester ? String(student.semester) : '',
      email: student.email || '',
      status: student.status || 'approved'
    });
  };

  const handleSaveStudentEdit = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;
    setStudentEditSaving(true);
    try {
      await apiCall(`/auth/users/${editingStudent.id}`, {
        method: 'PUT',
        body: JSON.stringify(studentEditFormData)
      });
      setStudents(prev => prev.map(s => s.id === editingStudent.id ? { ...s, ...studentEditFormData } : s));
      showFeedback(`Student details for ${studentEditFormData.full_name} updated successfully.`);
      setEditingStudent(null);
    } catch (err) {
      showFeedback(err.message || 'Failed to update student details.', 'error');
    } finally {
      setStudentEditSaving(false);
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
      setPermissionActionLoading(prev => ({ ...prev, [requestId]: true }));
      const data = await apiCall(`/permissions/approve/${requestId}`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      showFeedback(data.message || `Request ${status}`);
      // Refresh
      const branchQueryParam = selectedAdminBranch && selectedAdminBranch !== 'all' ? `?branch=${encodeURIComponent(selectedAdminBranch)}` : '';
      const [pReqs, allReqs, dash] = await Promise.all([
        apiCall(`/permissions/pending-requests${branchQueryParam}`),
        apiCall(`/permissions/all-requests${branchQueryParam}`),
        apiCall('/analytics/dashboard')
      ]);
      setPendingRequests(pReqs);
      setAllRequests(allReqs || []);
      setDashboardData(dash);
    } catch (err) {
      showFeedback(err.message || 'Action failed', 'error');
    } finally {
      setPermissionActionLoading(prev => ({ ...prev, [requestId]: false }));
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

  // Branch Management Handlers
  const handleCreateBranch = async (e) => {
    e?.preventDefault();
    if (!newBranchName.trim()) {
      showFeedback('Please enter a branch name', 'error');
      return;
    }
    try {
      setBranchActionLoading(true);
      await apiCall('/books/branches', {
        method: 'POST',
        body: JSON.stringify({ name: newBranchName.trim() })
      });
      setNewBranchName('');
      showFeedback('Branch created successfully', 'success');
      const updatedBranches = await apiCall('/books/branches');
      setBranches(updatedBranches);
    } catch (err) {
      showFeedback(err.message || 'Failed to create branch', 'error');
    } finally {
      setBranchActionLoading(false);
    }
  };

  const handleUpdateBranch = async (id, name) => {
    if (!name?.trim()) {
      showFeedback('Branch name cannot be empty', 'error');
      return;
    }
    try {
      setBranchActionLoading(true);
      await apiCall(`/books/branches/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim() })
      });
      setEditingBranch(null);
      showFeedback('Branch updated successfully', 'success');
      const updatedBranches = await apiCall('/books/branches');
      setBranches(updatedBranches);
    } catch (err) {
      showFeedback(err.message || 'Failed to update branch', 'error');
    } finally {
      setBranchActionLoading(false);
    }
  };

  const handleDeleteBranch = async (id) => {
    try {
      setBranchActionLoading(true);
      await apiCall(`/books/branches/${id}`, {
        method: 'DELETE'
      });
      setBranchDeleteConfirm(null);
      showFeedback('Branch deleted successfully', 'success');
      const updatedBranches = await apiCall('/books/branches');
      setBranches(updatedBranches);
    } catch (err) {
      showFeedback(err.message || 'Failed to delete branch', 'error');
    } finally {
      setBranchActionLoading(false);
    }
  };

  // Open Book Modal (Add / Edit)
  const openBookModal = (book = null) => {
    setPdfFile(null);
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setBookModalError('');
    if (book) {
      setEditingBook(book);
      setBookFormData({
        title: book.title,
        author: book.author,
        category_id: book.category_id.toString(),
        branch_id: book.branch_id.toString(),
        priority: book.priority,
        pdf_url: book.pdf_url || '',
        cover_url: book.cover_url || ''
      });
    } else {
      setEditingBook(null);
      setBookFormData({
        title: '',
        author: '',
        category_id: categories.length > 0 ? categories[0].id.toString() : '',
        branch_id: branches.length > 0 ? branches[0].id.toString() : '',
        priority: 'main',
        pdf_url: '',
        cover_url: ''
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
      formData.append('description', bookFormData.description || '');
      formData.append('cover_url', bookFormData.cover_url || '');
      if (pdfFile) {
        formData.append('pdf', pdfFile);
      }
      if (thumbnailFile) {
        formData.append('thumbnail', thumbnailFile);
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
      setThumbnailFile(null);
      setThumbnailPreview(null);
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

  const handleDirectorySelected = async (e) => {
    const files = e.target.files;
    if (!files || !files.length || directoryImporting) return;

    setDirectoryImporting(true);
    try {
      const parsed = parseDirectoryFiles(files, branches, categories);
      if (!parsed.length) {
        showFeedback('No PDF files found in the selected folder.', 'error');
        return;
      }

      const booksToImport = [];
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];

        if (!item.cover_url) {
          try {
            const cover = await extractFirstPageAsCover(item.file, {
              title: item.title,
              author: item.author
            });
            if (cover) item.cover_url = cover;
          } catch (coverErr) {
            console.warn('Cover extraction failed for', item.fileName, coverErr);
          }
        }

        const storagePath = `${Date.now()}_${i}_${item.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: uploadErr } = await supabase.storage
          .from('pdfs')
          .upload(storagePath, item.file, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'application/pdf'
          });
        if (uploadErr) {
          console.warn('PDF upload failed for', item.fileName, uploadErr.message);
          continue;
        }

        const { data: urlData } = supabase.storage.from('pdfs').getPublicUrl(storagePath);
        if (!urlData?.publicUrl) continue;

        booksToImport.push({
          title: item.title,
          author: item.author,
          category_id: item.category_id ?? null,
          branch_id: item.branch_id ?? null,
          priority: item.priority || 'main',
          cover_url: item.cover_url || null,
          pdf_url: urlData.publicUrl
        });
      }

      if (!booksToImport.length) {
        showFeedback('No books could be imported from the selected folder.', 'error');
        return;
      }

      const result = await apiCall('/books/batch-import', {
        method: 'POST',
        body: { books: booksToImport }
      });
      showFeedback(
        `Imported ${result?.count ?? booksToImport.length} book(s) into the catalog.`,
        'success'
      );

      const bList = await apiCall('/books');
      setBooks(bList);
      const dash = await apiCall('/analytics/dashboard');
      setDashboardData(dash);
    } catch (err) {
      console.error('Folder import failed', err);
      showFeedback(err.message || 'Failed to import book folder.', 'error');
    } finally {
      setDirectoryImporting(false);
      if (directoryInputRef.current) directoryInputRef.current.value = '';
    }
  };

  // Custom visual SVG scale logic for charts
  const filteredPermissions = useMemo(() => {
    let list = permissionTab === 'all'
      ? allRequests
      : allRequests.filter(r => (r.status || 'pending') === permissionTab);

    const q = permissionSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(r =>
      (r.full_name || '').toLowerCase().includes(q) ||
      (r.roll_number || '').toLowerCase().includes(q) ||
      (r.book_title || '').toLowerCase().includes(q) ||
      (r.student_branch || '').toLowerCase().includes(q) ||
      (r.requested_branch_name || '').toLowerCase().includes(q)
    );
  }, [allRequests, permissionTab, permissionSearch]);

  const pendingPermCount = useMemo(() => allRequests.filter(r => (r.status || 'pending') === 'pending').length, [allRequests]);
  const approvedPermCount = useMemo(() => allRequests.filter(r => r.status === 'approved').length, [allRequests]);
  const rejectedPermCount = useMemo(() => allRequests.filter(r => r.status === 'rejected').length, [allRequests]);

  const handleOpenStudentDossier = (r) => {
    const matchedStudent = students.find(s => s.id === r.user_id || s.roll_number === r.roll_number) || {
      id: r.user_id,
      full_name: r.full_name,
      roll_number: r.roll_number,
      branch_name: r.student_branch,
      status: 'approved'
    };
    setSelectedStudentForActivity(matchedStudent);
  };

  const handleBulkApproveFiltered = async () => {
    const pendingInFilter = filteredPermissions.filter(r => (r.status || 'pending') === 'pending');
    if (pendingInFilter.length === 0) return;
    try {
      showFeedback(`Approving ${pendingInFilter.length} access request(s)...`);
      for (const req of pendingInFilter) {
        await apiCall(`/permissions/approve/${req.id}`, {
          method: 'POST',
          body: JSON.stringify({ status: 'approved' })
        });
      }
      const branchQueryParam = selectedAdminBranch && selectedAdminBranch !== 'all' ? `?branch=${encodeURIComponent(selectedAdminBranch)}` : '';
      const [pReqs, allReqs, dash] = await Promise.all([
        apiCall(`/permissions/pending-requests${branchQueryParam}`),
        apiCall(`/permissions/all-requests${branchQueryParam}`),
        apiCall('/analytics/dashboard')
      ]);
      setPendingRequests(pReqs);
      setAllRequests(allReqs || []);
      setDashboardData(dash);
      showFeedback(`Successfully approved ${pendingInFilter.length} request(s)!`, 'success');
    } catch (err) {
      showFeedback(err.message || 'Bulk approval failed', 'error');
    }
  };

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.2)',
                flexShrink: 0
              }}>
                <img src="/logo.png" alt="SISTec" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.1 }}>
                  SISTEC
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Admin Portal
                </span>
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

          <div className="glass-panel" style={{ padding: '12px', marginBottom: '24px', fontSize: '0.85rem', textAlign: 'center' }}>
            <span className="badge badge-primary" style={{ display: 'inline-block', marginBottom: '4px' }}>
              {user?.isHeadquarters ? 'Headquarters Administrator' : `${user?.adminBranch || user?.branchName || 'Department'} Admin`}
            </span>
            <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginTop: '4px', fontSize: '0.8rem' }}>
              {user?.isHeadquarters ? 'Institutional Central Library' : `${user?.adminBranch || user?.branchName || 'Department'} Jurisdiction`}
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              onClick={() => switchTab('overview')}
              className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <BarChart3 size={16} /> Overview & Analytics
            </button>
            <button 
              onClick={() => switchTab('users')}
              className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <Users size={16} /> Approvals ({pendingUsers.length})
            </button>
            <button 
              onClick={() => switchTab('permissions')}
              className={`btn ${activeTab === 'permissions' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <Key size={16} /> Book Requests ({pendingRequests.length})
            </button>
            <button 
              onClick={() => switchTab('books')}
              className={`btn ${activeTab === 'books' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <BookOpen size={16} /> Book Inventory
            </button>
            <button 
              onClick={() => switchTab('students')}
              className={`btn ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <UserCheck size={16} /> All Students ({students.length})
            </button>
            <button 
              onClick={() => switchTab('branches')}
              className={`btn ${activeTab === 'branches' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <GitBranch size={16} /> Branches ({branches.length})
            </button>
            <button 
              onClick={() => switchTab('settings')}
              className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
            >
              <Settings size={16} /> Library Settings
            </button>
            <button 
              onClick={() => switchTab('logs')}
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
                <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.04em' }}>SISTEC ADMIN</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>• {
                  activeTab === 'overview' ? 'Overview & Analytics' :
                  activeTab === 'users' ? 'User Approvals' :
                  activeTab === 'permissions' ? 'Book Requests' :
                  activeTab === 'books' ? 'Book Inventory' :
                  activeTab === 'students' ? 'All Students' :
                  activeTab === 'branches' ? 'Branches' :
                  activeTab === 'settings' ? 'Settings' : 'System Logs'
                }</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

        {/* Floating Toast Notification */}
        {feedback.text && (
          <div className={`toast-notification ${toastExiting ? 'toast-exit' : ''}`} style={{
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
            {activeTab === 'overview' && (
              <div className="animate-section-enter">
                {/* Header with Title & Timeframe Filters */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '28px',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Library System Analytics</h2>
                      {analyticsRefreshing && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--primary)', background: 'rgba(37,99,235,0.1)', padding: '4px 8px', borderRadius: '12px' }}>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>Syncing Supabase...</span>
                        </div>
                      )}
                    </div>
                    <p style={{ marginTop: '4px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Authoritative real-time statistics, aggregate branch reading patterns, and verified student activity.
                    </p>
                  </div>

                  {/* Timeframe Filter Bar & Manual Live Refresh */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div className="glass-panel" style={{ padding: '4px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '10px' }}>
                      {[
                        { id: 'all', label: 'All Time' },
                        { id: 'today', label: 'Today' },
                        { id: '7d', label: 'Last 7 Days' },
                        { id: '30d', label: 'Last 30 Days' },
                      ].map(tf => (
                        <button
                          key={tf.id}
                          onClick={() => handleTimeframeChange(tf.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: analyticsTimeframe === tf.id ? 'var(--primary)' : 'transparent',
                            color: analyticsTimeframe === tf.id ? '#ffffff' : 'var(--text-secondary)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {tf.label}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => refreshAnalyticsOnly(analyticsTimeframe)}
                      className="btn btn-secondary"
                      style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                      title="Sync Authoritative Data from Supabase"
                      disabled={analyticsRefreshing}
                    >
                      <RefreshCw size={14} className={analyticsRefreshing ? 'animate-spin' : ''} />
                      <span>Sync</span>
                    </button>
                  </div>
                </div>

                {!dashboardData ? (
                  <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
                    <AlertTriangle size={36} color="var(--warning)" style={{ marginBottom: '12px' }} />
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Unable to load analytics data</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.9rem' }}>
                      Failed to establish an authoritative connection with Supabase.
                    </p>
                    <button onClick={() => fetchAllAdminData()} className="btn btn-primary">
                      Retry Connection
                    </button>
                  </div>
                ) : selectedBranchForDrilldown ? (() => {
                  /* ═══ DEPARTMENT EXPLORATION DASHBOARD (Drill-Down View) ═══ */
                  // Authoritative live sync with dashboardData
                  const activeBranch = (dashboardData?.branchPerformance || []).find(b => 
                    String(b.branch_id) === String(selectedBranchForDrilldown.branch_id) || 
                    isSameBranch(b.branch_name, selectedBranchForDrilldown.branch_name)
                  ) || selectedBranchForDrilldown;

                  const branchName = activeBranch?.branch_name || selectedBranchForDrilldown.branch_name;

                  // Department Books (matching by branch_id or branch_name)
                  const departmentBooks = (dashboardData?.drilldowns?.books || []).filter(b => 
                    (b.branch_id && String(b.branch_id) === String(activeBranch?.branch_id)) || 
                    isSameBranch(b.branch_name, branchName)
                  );
                  const deptBookIdSet = new Set(departmentBooks.map(b => String(b.id)));

                  // Department Students (matching by branch_name or branch_id if present)
                  const departmentStudents = (dashboardData?.drilldowns?.students || []).filter(s => 
                    (s.branch_id && String(s.branch_id) === String(activeBranch?.branch_id)) || 
                    isSameBranch(s.branch_name, branchName)
                  );
                  const deptStudentIdSet = new Set(departmentStudents.map(s => String(s.id)));

                  // Comprehensive Log matcher: Book belongs to branch OR Student belongs to branch OR branch name/id matches
                  const isDeptLog = (l) => {
                    if (!l) return false;
                    if (l.book_id && deptBookIdSet.has(String(l.book_id))) return true;
                    if (l.user_id && deptStudentIdSet.has(String(l.user_id))) return true;
                    if (l.book_branch_id && String(l.book_branch_id) === String(activeBranch?.branch_id)) return true;
                    if (l.book_branch_name && isSameBranch(l.book_branch_name, branchName)) return true;
                    if (l.user_branch_name && isSameBranch(l.user_branch_name, branchName)) return true;
                    if (l.branch_name && isSameBranch(l.branch_name, branchName)) return true;
                    return false;
                  };

                  const deptViews = (dashboardData?.drilldowns?.views || []).filter(isDeptLog);
                  const deptDownloads = (dashboardData?.drilldowns?.downloads || []).filter(isDeptLog);
                  const departmentAllLogs = [...deptViews, ...deptDownloads].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                  const deptTotalBooks = Math.max(activeBranch?.total_books || 0, departmentBooks.length);
                  const deptTotalStudents = Math.max(activeBranch?.total_students || 0, departmentStudents.length);
                  const deptTotalAccesses = Math.max(activeBranch?.total_accesses || 0, deptViews.length);
                  const deptTotalDownloads = Math.max(activeBranch?.total_downloads || 0, deptDownloads.length);
                  const deptTotalActivity = Math.max(activeBranch?.total_activity || 0, departmentAllLogs.length, deptTotalAccesses + deptTotalDownloads);

                  return (
                    <div className="animate-section-enter">
                      {/* Back Navigation Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                        <button
                          onClick={() => {
                            setSelectedBranchForDrilldown(null);
                            setDepartmentActiveTab('overview');
                            setDepartmentSearch('');
                          }}
                          className="btn btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
                        >
                          <ArrowLeft size={16} /> Back to System Analytics
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <span>Analytics</span>
                          <ChevronRight size={14} />
                          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{branchName}</span>
                        </div>
                      </div>

                      {/* Department Header Card */}
                      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', borderLeft: '4px solid var(--primary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                          <div>
                            <span className="badge badge-primary" style={{ marginBottom: '8px', fontSize: '0.7rem' }}>Department Deep Dive</span>
                            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '4px 0' }}>{branchName}</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                              Dedicated departmental breakdown of active students, associated books, and reading activities in Supabase.
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{deptTotalBooks}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Books</div>
                            </div>
                            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--secondary)' }}>{deptTotalStudents}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Students</div>
                            </div>
                            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{deptTotalAccesses}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Accesses</div>
                            </div>
                            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--warning)' }}>{deptTotalDownloads}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Downloads</div>
                            </div>
                          </div>
                        </div>

                        {/* Department Sub-Tabs */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '24px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
                          {[
                            { id: 'overview', label: 'Department Overview' },
                            { id: 'students', label: `Students (${deptTotalStudents})` },
                            { id: 'books', label: `Books (${deptTotalBooks})` },
                            { id: 'activity', label: `Activity (${deptTotalActivity})` }
                          ].map(t => (
                            <button
                              key={t.id}
                              onClick={() => setDepartmentActiveTab(t.id)}
                              className={`btn ${departmentActiveTab === t.id ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Sub-Tab 1: Overview */}
                      {departmentActiveTab === 'overview' && (() => {
                        const branchTopBook = dashboardData.mostReadPerBranch.find(m => String(m.branch_id) === String(activeBranch?.branch_id) || isSameBranch(m.branch_name, branchName));
                        const branchStudents = departmentStudents;
                        const branchTopStudent = [...branchStudents].sort((a, b) => b.total_activity - a.total_activity)[0];

                        return (
                          <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }} className="responsive-grid-1col">
                              {/* Branch Best Book */}
                              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '4px solid var(--secondary)' }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                                    <Award size={20} color="var(--secondary)" />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                      Most Read in {branchName}
                                    </span>
                                  </div>
                                  {branchTopBook && branchTopBook.has_activity ? (
                                    <div>
                                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                        {branchTopBook.book_title}
                                      </h3>
                                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                        By {branchTopBook.book_author || 'Unknown Author'}
                                      </p>
                                      <div style={{ display: 'flex', gap: '12px' }}>
                                        <span className="badge badge-primary">{branchTopBook.total_accesses} Accesses</span>
                                        <span className="badge badge-warning">{branchTopBook.total_downloads} Downloads</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px 0' }}>
                                      No reading activity logged yet for books in this branch.
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Branch Top Student */}
                              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '4px solid var(--primary)' }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                                    <UserCheck size={20} color="var(--primary)" />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                      Top Reader in {branchName}
                                    </span>
                                  </div>
                                  {branchTopStudent && branchTopStudent.total_activity > 0 ? (
                                    <div>
                                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                        {branchTopStudent.full_name}
                                      </h3>
                                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                        Roll: {branchTopStudent.roll_number || 'N/A'} {branchTopStudent.semester ? `· Sem ${branchTopStudent.semester}` : ''}
                                      </p>
                                      <div style={{ display: 'flex', gap: '12px' }}>
                                        <span className="badge badge-success">{branchTopStudent.total_activity} Engagements</span>
                                        <span className="badge badge-primary">{branchTopStudent.books_accessed_count} Books Read</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px 0' }}>
                                      {branchStudents.length > 0 
                                        ? `${branchStudents.length} student(s) enrolled, no reading activity recorded yet.`
                                        : 'No student activity recorded yet for this department.'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Quick Summary Grid */}
                            <div className="glass-panel" style={{ padding: '24px' }}>
                              <h4 style={{ fontSize: '0.95rem', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.04em' }}>
                                Department Metrics Summary
                              </h4>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>REGISTERED STUDENTS</span>
                                  <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '4px' }}>{deptTotalStudents}</div>
                                </div>
                                <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ALLOCATED BOOKS</span>
                                  <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '4px' }}>{deptTotalBooks}</div>
                                </div>
                                <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PAGE REVIEWS</span>
                                  <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '4px', color: 'var(--primary)' }}>{deptTotalAccesses}</div>
                                </div>
                                <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DOWNLOADS</span>
                                  <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '4px', color: 'var(--warning)' }}>{deptTotalDownloads}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Sub-Tab 2: Department Students */}
                      {departmentActiveTab === 'students' && (() => {
                        const branchStudents = departmentStudents
                          .filter(s => {
                            const q = departmentSearch.toLowerCase().trim();
                            return !q || s.full_name?.toLowerCase().includes(q) || s.roll_number?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
                          });

                        return (
                          <div className="glass-panel" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                              <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>
                                Students Enrolled in {branchName} ({branchStudents.length})
                              </h4>
                              <div className="search-input-wrapper" style={{ width: '260px' }}>
                                <span className="search-icon">
                                  <Search size={15} />
                                </span>
                                <input
                                  type="text"
                                  placeholder="Search by name, roll, email..."
                                  value={departmentSearch}
                                  onChange={(e) => setDepartmentSearch(e.target.value)}
                                  className="glass-input has-search-icon"
                                  style={{ height: '38px', fontSize: '0.82rem' }}
                                />
                                {departmentSearch && (
                                  <button
                                    type="button"
                                    className="search-clear-btn"
                                    onClick={() => setDepartmentSearch('')}
                                    title="Clear search"
                                  >
                                    <X size={13} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {branchStudents.length === 0 ? (
                              <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>
                                No students found matching this criteria.
                              </p>
                            ) : (
                              <div className="table-responsive-wrapper">
                                <table style={{ width: '100%', minWidth: '750px', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                      <th style={{ padding: '12px' }}>Student Name</th>
                                      <th style={{ padding: '12px' }}>Enrollment / Roll</th>
                                      <th style={{ padding: '12px' }}>Email</th>
                                      <th style={{ padding: '12px' }}>Status</th>
                                      <th style={{ padding: '12px', textAlign: 'center' }}>Total Reads</th>
                                      <th style={{ padding: '12px', textAlign: 'center' }}>Downloads</th>
                                      <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {branchStudents.map(st => (
                                      <tr key={st.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '12px', fontWeight: 600 }}>{st.full_name}</td>
                                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{st.roll_number || 'N/A'}</td>
                                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{st.email}</td>
                                        <td style={{ padding: '12px' }}>
                                          <StatusBadge status={st.status} />
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                          <span className="badge badge-primary">{st.total_accesses || 0}</span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                          <span className="badge badge-warning">{st.total_downloads || 0}</span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                          <button
                                            onClick={() => setSelectedStudentForActivity(st)}
                                            className="btn btn-secondary"
                                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                                          >
                                            Inspect Profile
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Sub-Tab 3: Department Books */}
                      {departmentActiveTab === 'books' && (() => {
                        const branchBooks = departmentBooks
                          .filter(b => {
                            const q = departmentSearch.toLowerCase().trim();
                            return !q || b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q);
                          });

                        return (
                          <div className="glass-panel" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                              <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>
                                Books Allocated to {branchName} ({branchBooks.length})
                              </h4>
                              <div className="search-input-wrapper" style={{ width: '260px' }}>
                                <span className="search-icon">
                                  <Search size={15} />
                                </span>
                                <input
                                  type="text"
                                  placeholder="Search by title or author..."
                                  value={departmentSearch}
                                  onChange={(e) => setDepartmentSearch(e.target.value)}
                                  className="glass-input has-search-icon"
                                  style={{ height: '38px', fontSize: '0.82rem' }}
                                />
                                {departmentSearch && (
                                  <button
                                    type="button"
                                    className="search-clear-btn"
                                    onClick={() => setDepartmentSearch('')}
                                    title="Clear search"
                                  >
                                    <X size={13} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {branchBooks.length === 0 ? (
                              <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>
                                No books allocated to this department.
                              </p>
                            ) : (
                              <div className="table-responsive-wrapper">
                                <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                      <th style={{ padding: '12px' }}>Cover</th>
                                      <th style={{ padding: '12px' }}>Book Title</th>
                                      <th style={{ padding: '12px' }}>Author</th>
                                      <th style={{ padding: '12px', textAlign: 'center' }}>Total Accesses</th>
                                      <th style={{ padding: '12px', textAlign: 'center' }}>Downloads</th>
                                      <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {branchBooks.map(bk => (
                                      <tr key={bk.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '12px', width: '60px' }}>
                                          <div style={{ width: '38px', height: '52px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {bk.cover_url ? (
                                              <img src={bk.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                              <BookOpen size={18} color="var(--text-muted)" />
                                            )}
                                          </div>
                                        </td>
                                        <td style={{ padding: '12px', fontWeight: 600 }}>{bk.title}</td>
                                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{bk.author}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                          <span className="badge badge-primary">{bk.total_accesses || 0}</span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                          <span className="badge badge-warning">{bk.total_downloads || 0}</span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                          <button
                                            onClick={() => setSelectedBookForActivity(bk)}
                                            className="btn btn-secondary"
                                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                                          >
                                            View Readers
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Sub-Tab 4: Department Activity */}
                      {departmentActiveTab === 'activity' && (() => {
                        const branchLogs = departmentAllLogs.filter(l => {
                          const q = departmentSearch.toLowerCase().trim();
                          return !q ||
                            l.user_name?.toLowerCase().includes(q) ||
                            l.roll_number?.toLowerCase().includes(q) ||
                            l.book_title?.toLowerCase().includes(q) ||
                            l.action_type?.toLowerCase().includes(q);
                        });

                        return (
                          <div className="glass-panel" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                              <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>
                                Activity Logs for {branchName} ({branchLogs.length})
                              </h4>
                              <div className="search-input-wrapper" style={{ width: '260px' }}>
                                <span className="search-icon">
                                  <Search size={15} />
                                </span>
                                <input
                                  type="text"
                                  placeholder="Search by student, book, roll..."
                                  value={departmentSearch}
                                  onChange={(e) => setDepartmentSearch(e.target.value)}
                                  className="glass-input has-search-icon"
                                  style={{ height: '38px', fontSize: '0.82rem' }}
                                />
                                {departmentSearch && (
                                  <button
                                    type="button"
                                    className="search-clear-btn"
                                    onClick={() => setDepartmentSearch('')}
                                    title="Clear search"
                                  >
                                    <X size={13} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {branchLogs.length === 0 ? (
                              <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>
                                {departmentSearch ? 'No activity logs matching your search.' : 'No activity recorded in Supabase for this branch.'}
                              </p>
                            ) : (
                              <div className="table-responsive-wrapper">
                                <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                      <th style={{ padding: '12px' }}>Time</th>
                                      <th style={{ padding: '12px' }}>Event</th>
                                      <th style={{ padding: '12px' }}>Student</th>
                                      <th style={{ padding: '12px' }}>Book Title</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {branchLogs.map(l => (
                                      <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                          {new Date(l.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                          <span className={`badge ${l.action_type === 'download' ? 'badge-warning' : 'badge-primary'}`}>
                                            {l.action_type === 'download' ? 'Download' : 'View / Access'}
                                          </span>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                          <button
                                            onClick={() => setSelectedStudentForActivity(students.find(s => s.id === l.user_id) || { id: l.user_id, full_name: l.user_name, roll_number: l.roll_number, branch_name: l.branch_name })}
                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textAlign: 'left', fontWeight: 600, padding: 0 }}
                                          >
                                            {l.user_name || 'Anonymous Student'}
                                          </button>
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Roll: {l.roll_number || 'N/A'}</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                          <button
                                            onClick={() => setSelectedBookForActivity(books.find(b => b.id === l.book_id) || { id: l.book_id, title: l.book_title, author: l.book_author, branch_name: l.branch_name })}
                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textAlign: 'left', fontWeight: 600, padding: 0 }}
                                          >
                                            "{l.book_title}"
                                          </button>
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>By {l.book_author}</div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })() : (
                  /* ═══ MAIN SYSTEM ANALYTICS VIEW ═══ */
                  <>
                    {/* Top Stat Cards (All Clickable with Underlying Supabase Records) */}
                    <div className="admin-stat-cards-grid">
                      {/* 1. Total Books */}
                      <div
                        onClick={() => {
                          setActiveAnalyticsDrilldown('books');
                          setDrilldownSearch('');
                        }}
                        className="glass-panel glass-panel-hover motion-stat-card animate-stagger-in stagger-1"
                        style={{ padding: 'clamp(14px, 3vw, 22px)', display: 'flex', alignItems: 'center', gap: 'clamp(10px, 2.5vw, 16px)', cursor: 'pointer', position: 'relative' }}
                        title="Click to view all verified books in Supabase"
                      >
                        <div className="motion-card-icon" style={{ padding: '14px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
                          <BookOpen size={26} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Books</span>
                          <h3 style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.65rem)', fontWeight: 700, marginTop: '2px' }}>{dashboardData.stats.books}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>
                            <span>View Records</span>
                            <ChevronRight size={12} />
                          </div>
                        </div>
                      </div>

                      {/* 2. Active Students */}
                      <div
                        onClick={() => {
                          setActiveAnalyticsDrilldown('students');
                          setDrilldownSearch('');
                        }}
                        className="glass-panel glass-panel-hover motion-stat-card animate-stagger-in stagger-2"
                        style={{ padding: 'clamp(14px, 3vw, 22px)', display: 'flex', alignItems: 'center', gap: 'clamp(10px, 2.5vw, 16px)', cursor: 'pointer', position: 'relative' }}
                        title="Click to view all approved students in Supabase"
                      >
                        <div className="motion-card-icon" style={{ padding: '14px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--secondary)' }}>
                          <Users size={26} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Students</span>
                          <h3 style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.65rem)', fontWeight: 700, marginTop: '2px' }}>{dashboardData.stats.students}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '0.72rem', color: 'var(--secondary)', fontWeight: 600 }}>
                            <span>View Records</span>
                            <ChevronRight size={12} />
                          </div>
                        </div>
                      </div>

                      {/* 3. Total Views */}
                      <div
                        onClick={() => {
                          setActiveAnalyticsDrilldown('views');
                          setDrilldownSearch('');
                        }}
                        className="glass-panel glass-panel-hover motion-stat-card animate-stagger-in stagger-3"
                        style={{ padding: 'clamp(14px, 3vw, 22px)', display: 'flex', alignItems: 'center', gap: 'clamp(10px, 2.5vw, 16px)', cursor: 'pointer', position: 'relative' }}
                        title="Click to view all book access activity logs"
                      >
                        <div className="motion-card-icon" style={{ padding: '14px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
                          <FileText size={26} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Views</span>
                          <h3 style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.65rem)', fontWeight: 700, marginTop: '2px' }}>{dashboardData.stats.views}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600 }}>
                            <span>View Activity</span>
                            <ChevronRight size={12} />
                          </div>
                        </div>
                      </div>

                      {/* 4. Downloads */}
                      <div
                        onClick={() => {
                          setActiveAnalyticsDrilldown('downloads');
                          setDrilldownSearch('');
                        }}
                        className="glass-panel glass-panel-hover motion-stat-card animate-stagger-in stagger-4"
                        style={{ padding: 'clamp(14px, 3vw, 22px)', display: 'flex', alignItems: 'center', gap: 'clamp(10px, 2.5vw, 16px)', cursor: 'pointer', position: 'relative' }}
                        title="Click to view all book download activity logs"
                      >
                        <div className="motion-card-icon" style={{ padding: '14px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
                          <Download size={26} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Downloads</span>
                          <h3 style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.65rem)', fontWeight: 700, marginTop: '2px' }}>{dashboardData.stats.downloads}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '0.72rem', color: 'var(--warning)', fontWeight: 600 }}>
                            <span>View Activity</span>
                            <ChevronRight size={12} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Champion Records (Best Book, Top Reader) */}
                    <div className="champion-cards-grid">
                      {/* Best Book Overall */}
                      <div
                        className="glass-panel glass-panel-hover animate-stagger-in stagger-3"
                        style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '4px solid var(--secondary)', cursor: dashboardData.bestBook ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (dashboardData.bestBook) {
                            setSelectedBookForActivity(books.find(b => b.id === dashboardData.bestBook.id) || dashboardData.bestBook);
                          }
                        }}
                        title={dashboardData.bestBook ? 'Click to inspect complete book details and readers' : ''}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <div className="animate-float-bob" style={{ display: 'flex', alignItems: 'center' }}>
                              <Award size={22} color="var(--secondary)" />
                            </div>
                            <h4 style={{ textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                              Best Performing Book Overall
                            </h4>
                          </div>

                          {dashboardData.bestBook ? (
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                              <div style={{ width: '56px', height: '74px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {dashboardData.bestBook.cover_url ? (
                                  <img src={dashboardData.bestBook.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <BookOpen size={24} color="var(--text-muted)" />
                                )}
                              </div>
                              <div style={{ flex: 1 }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>"{dashboardData.bestBook.title}"</h3>
                                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>By {dashboardData.bestBook.author}</p>
                                <span className="badge badge-secondary" style={{ marginTop: '8px', fontSize: '0.7rem' }}>
                                  {dashboardData.bestBook.branch_name}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No books read or downloaded yet.</p>
                          )}
                        </div>

                        {dashboardData.bestBook && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', marginTop: '20px', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', gap: '16px' }}>
                              <div><strong style={{ color: 'var(--secondary)' }}>{dashboardData.bestBook.total_accesses}</strong> accesses</div>
                              <div><strong style={{ color: 'var(--warning)' }}>{dashboardData.bestBook.total_downloads}</strong> downloads</div>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              Inspect Details <ExternalLink size={12} />
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Top Student Reader */}
                      <div
                        className="glass-panel glass-panel-hover animate-stagger-in stagger-4"
                        style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '4px solid var(--primary)', cursor: dashboardData.topUser ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (dashboardData.topUser) {
                            setSelectedStudentForActivity(students.find(s => s.id === dashboardData.topUser.id) || dashboardData.topUser);
                          }
                        }}
                        title={dashboardData.topUser ? 'Click to inspect complete student profile and reading history' : ''}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <div className="animate-float-bob" style={{ display: 'flex', alignItems: 'center' }}>
                              <TrendingUp size={22} color="var(--primary)" />
                            </div>
                            <h4 style={{ textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                              Top Student Reader
                            </h4>
                          </div>

                          {dashboardData.topUser ? (
                            <div>
                              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>{dashboardData.topUser.full_name}</h3>
                              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Enrollment / Roll: {dashboardData.topUser.roll_number}</p>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{dashboardData.topUser.branch_name}</span>
                                {dashboardData.topUser.semester && (
                                  <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>Semester {dashboardData.topUser.semester}</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No reader data compiled yet.</p>
                          )}
                        </div>

                        {dashboardData.topUser && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', marginTop: '20px', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', gap: '16px' }}>
                              <div><strong style={{ color: 'var(--primary)' }}>{dashboardData.topUser.total_accesses}</strong> reads</div>
                              <div><strong style={{ color: 'var(--secondary)' }}>{dashboardData.topUser.unique_books_accessed}</strong> books</div>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              Inspect Student <ExternalLink size={12} />
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Branch-wise Performance Chart (Interactive Drilldown Trigger) */}
                    <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <h4 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Branch-wise Performance (Accesses vs Downloads)
                          </h4>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Click any department below to open its comprehensive exploration dashboard.
                          </p>
                        </div>

                        {/* Legend */}
                        <div className="admin-chart-legend" style={{ display: 'flex', gap: '16px', fontSize: '0.8rem' }}>
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

                      {/* Department Interactive Chart Rows */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {dashboardData.branchPerformance.length === 0 ? (
                          <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                            No branches configured in Supabase.
                          </p>
                        ) : (
                          dashboardData.branchPerformance.map((bp, i) => {
                            const max = Math.max(...dashboardData.branchPerformance.map(b => Math.max(b.total_accesses, b.total_downloads, 1)));
                            const accPct = Math.min(100, (bp.total_accesses / max) * 100);
                            const dwnPct = Math.min(100, (bp.total_downloads / max) * 100);

                            return (
                              <div
                                key={bp.branch_id || i}
                                onClick={() => {
                                  setSelectedBranchForDrilldown(bp);
                                  setDepartmentActiveTab('overview');
                                  setDepartmentSearch('');
                                }}
                                className="glass-panel-hover admin-branch-chart-row"
                                style={{
                                  alignItems: 'center',
                                  borderRadius: '10px',
                                  cursor: 'pointer',
                                  background: 'rgba(255,255,255,0.015)',
                                  border: '1px solid transparent',
                                  transition: 'all 0.2s ease'
                                }}
                                title={`Click to explore ${bp.branch_name} department analytics`}
                              >
                                <div>
                                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {bp.branch_name}
                                  </span>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {bp.total_students} students · {bp.total_books} books
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {/* Accesses bar (Primary Indigo) */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ flex: 1, height: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', overflow: 'hidden' }}>
                                      <div style={{
                                        width: `${accPct}%`,
                                        height: '100%',
                                        background: 'linear-gradient(90deg, var(--primary), var(--border-glass-focus))',
                                        borderRadius: '6px',
                                        transition: 'width 0.5s ease-out'
                                      }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', width: '84px', color: 'var(--text-secondary)' }}>
                                      {bp.total_accesses} accesses
                                    </span>
                                  </div>

                                  {/* Downloads bar (Secondary Cyan) */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ flex: 1, height: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', overflow: 'hidden' }}>
                                      <div style={{
                                        width: `${dwnPct}%`,
                                        height: '100%',
                                        background: 'linear-gradient(90deg, var(--secondary), var(--secondary-glow))',
                                        borderRadius: '6px',
                                        transition: 'width 0.5s ease-out'
                                      }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', width: '84px', color: 'var(--text-secondary)' }}>
                                      {bp.total_downloads} dwns
                                    </span>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 600 }}>
                                  <span>Explore</span>
                                  <ChevronRight size={14} />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Most Read Book in Each Branch */}
                    <div className="glass-panel" style={{ padding: '24px' }}>
                      <h4 style={{ marginBottom: '16px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Most Read Book in Each Branch
                      </h4>
                      {dashboardData.mostReadPerBranch.length === 0 ? (
                        <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No branches or books found in database.</p>
                      ) : (
                        <>
                          {/* Desktop Table */}
                          <div className="desktop-table-view">
                            <div className="table-responsive-wrapper">
                              <table className="custom-table" style={{ minWidth: '800px' }}>
                                <thead>
                                  <tr>
                                    <th>Branch</th>
                                    <th>Book Title</th>
                                    <th>Author</th>
                                    <th style={{ textAlign: 'center' }}>Total Accesses</th>
                                    <th style={{ textAlign: 'center' }}>Downloads</th>
                                    <th className="sticky-action-col" style={{ textAlign: 'right', minWidth: '100px' }}>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dashboardData.mostReadPerBranch.map((record, index) => (
                                    <tr key={record.branch_id || index}>
                                      <td style={{ fontWeight: 600 }}>{record.branch_name}</td>
                                      {record.has_activity ? (
                                        <>
                                          <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                              <div style={{ width: '32px', height: '42px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {record.cover_url ? (
                                                  <img src={record.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                  <BookOpen size={16} color="var(--text-muted)" />
                                                )}
                                              </div>
                                              <span style={{ fontWeight: 500 }}>"{record.title}"</span>
                                            </div>
                                          </td>
                                          <td style={{ color: 'var(--text-secondary)' }}>{record.author}</td>
                                          <td style={{ textAlign: 'center' }}>
                                            <span className="badge badge-success">{record.total_accesses} times</span>
                                          </td>
                                          <td style={{ textAlign: 'center' }}>
                                            <span className="badge badge-warning">{record.total_downloads} dwns</span>
                                          </td>
                                          <td className="sticky-action-col" style={{ textAlign: 'right' }}>
                                            <button
                                              onClick={() => setSelectedBookForActivity(books.find(b => b.id === (record.id || record.book_id)) || { ...record, id: record.id || record.book_id })}
                                              className="btn btn-secondary"
                                              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                                            >
                                              Inspect
                                            </button>
                                          </td>
                                        </>
                                      ) : (
                                        <td colSpan={5} style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                          {record.message || 'No reading activity recorded for this department.'}
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Mobile Cards */}
                          <div className="mobile-cards-view">
                            {dashboardData.mostReadPerBranch.map((record, index) => (
                              <div key={record.branch_id || index} className="mobile-data-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span className="mobile-card-title">{record.branch_name}</span>
                                  <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>Leaderboard</span>
                                </div>

                                {record.has_activity ? (
                                  <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                      {record.cover_url ? (
                                        <img src={record.cover_url} alt="" style={{ width: '42px', height: '58px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-glass)', flexShrink: 0 }} />
                                      ) : (
                                        <div style={{ width: '42px', height: '58px', borderRadius: '6px', background: 'var(--surface-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          <BookOpen size={20} color="var(--text-muted)" />
                                        </div>
                                      )}
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>"{record.title}"</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>by {record.author}</div>
                                      </div>
                                    </div>

                                    <div className="mobile-card-chips">
                                      <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>{record.total_accesses} Reads</span>
                                      <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>{record.total_downloads} Downloads</span>
                                    </div>

                                    <div className="mobile-card-actions">
                                      <button
                                        onClick={() => setSelectedBookForActivity(books.find(b => b.id === (record.id || record.book_id)) || { ...record, id: record.id || record.book_id })}
                                        className="btn btn-secondary"
                                        style={{ width: '100%', minHeight: '42px', justifyContent: 'center', gap: '6px' }}
                                      >
                                        <Activity size={15} /> Inspect Reading Activity
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                    {record.message || 'No reading activity recorded for this department.'}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* User Registration Approvals Tab */}
            {activeTab === 'users' && (
              <div className="animate-section-enter">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h2>User Registration Approvals</h2>
                    <p style={{ marginTop: '4px' }}>Approve or reject newly registered student accounts. Approved accounts immediately gain full access to SISTECH-LIB.</p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    {/* Registration Policy Configuration */}
                    <div className="glass-panel" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Approval Mode:</span>
                      <select
                        className="glass-input glass-select"
                        style={{ padding: '4px 8px', fontSize: '0.8rem', minWidth: '170px' }}
                        value={registrationPolicy}
                        onChange={(e) => handleRegistrationPolicyChange(e.target.value)}
                        disabled={policyLoading}
                      >
                        <option value="manual">Manual Review (Default)</option>
                        <option value="auto_approve">Automatically Approve</option>
                        <option value="auto_reject">Automatically Reject</option>
                      </select>
                    </div>

                    {/* Branch Scope */}
                    {user?.isHeadquarters ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Jurisdiction:</span>
                        <select
                          className="glass-input glass-select"
                          style={{ padding: '6px 12px', fontSize: '0.82rem', minWidth: '170px' }}
                          value={selectedAdminBranch}
                          onChange={(e) => setSelectedAdminBranch(e.target.value)}
                        >
                          <option value="all">All Branches (Headquarters)</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.name}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="badge badge-primary" style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🏢 Department Scope:</span>
                        <strong>{user?.adminBranch || user?.branchName}</strong>
                      </div>
                    )}

                    {/* Approve All Button */}
                    {pendingUsers.length > 0 && (
                      <button
                        onClick={() => setShowBulkApproveUsersConfirm(true)}
                        className="btn btn-success"
                        style={{ padding: '8px 18px', fontSize: '0.85rem', gap: '6px', fontWeight: 700 }}
                      >
                        <Check size={16} /> Approve All ({pendingUsers.length})
                      </button>
                    )}
                  </div>
                </div>

                {pendingUsers.length === 0 ? (
                  <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
                    <Users size={40} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                    <h4>All registrations reviewed!</h4>
                    <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>There are no pending student registration requests awaiting verification.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {pendingUsers.map(u => {
                      const isActionLoading = !!userActionLoading[u.id];

                      return (
                        <div
                          key={u.id}
                          className="glass-panel"
                          style={{
                            padding: 'clamp(14px, 3vw, 20px)',
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '16px',
                            borderLeft: '4px solid #f59e0b',
                            boxSizing: 'border-box',
                            width: '100%'
                          }}
                        >
                          <div style={{ flex: '1 1 min(100%, 280px)', minWidth: 0, wordBreak: 'break-word' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                                {u.full_name}
                              </h3>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                ({u.roll_number || 'N/A'})
                              </span>
                              <StatusBadge status={u.status || 'pending'} />
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '10px' }}>
                              <div><strong>Username:</strong> {u.username}</div>
                              <div><strong>Enrollment:</strong> {u.roll_number}</div>
                              <div><strong>Department:</strong> {u.branch_name || 'General'}</div>
                              <div><strong>Academic Year:</strong> Year {u.year || '1'} • Sem {u.semester || '1'}</div>
                              <div><strong>BT Number:</strong> {u.bt_number || 'N/A'}</div>
                              <div><strong>Registration Time:</strong> {new Date(u.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Open Student Dossier / Activity History */}
                            <button
                              onClick={() => setSelectedStudentForActivity(u)}
                              className="btn btn-secondary"
                              style={{ padding: '8px 14px', fontSize: '0.82rem', gap: '6px' }}
                              title="Inspect full student profile & certified dossier"
                            >
                              <User size={14} /> Student Dossier
                            </button>

                            <button
                              onClick={() => handleUserApproval(u.id, 'approved')}
                              disabled={isActionLoading}
                              className="btn btn-success"
                              style={{ padding: '8px 18px', fontSize: '0.85rem', gap: '6px', fontWeight: 600 }}
                            >
                              <Check size={16} /> {isActionLoading ? 'Updating...' : 'Approve'}
                            </button>

                            <button
                              onClick={() => handleUserApproval(u.id, 'rejected')}
                              disabled={isActionLoading}
                              className="btn btn-danger"
                              style={{ padding: '8px 18px', fontSize: '0.85rem', gap: '6px' }}
                            >
                              <X size={16} /> Reject
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Book Access Requests Tab */}
            {activeTab === 'permissions' && (
              <div className="animate-section-enter">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
                  <div>
                    <h2>Book Access &amp; Department Clearance</h2>
                    <p style={{ marginTop: '4px' }}>Students require authorized clearance to read or download books outside their primary branch. Review, approve, or revoke access permissions.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {user?.isHeadquarters ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Branch Queue:</span>
                        <select
                          className="glass-input glass-select"
                          style={{ padding: '6px 12px', fontSize: '0.82rem', minWidth: '180px' }}
                          value={selectedAdminBranch}
                          onChange={(e) => setSelectedAdminBranch(e.target.value)}
                        >
                          <option value="all">All Branches (Headquarters)</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.name}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="badge badge-primary" style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🏢 Department Scope:</span>
                        <strong>{user?.adminBranch || user?.branchName}</strong>
                        <span style={{ opacity: 0.8, fontSize: '0.74rem' }}>(Isolated Admin Queue)</span>
                      </div>
                    )}
                    {permissionTab === 'pending' && pendingPermCount > 1 && (
                      <button
                        onClick={handleBulkApproveFiltered}
                        className="btn btn-primary"
                        style={{ padding: '8px 16px', fontSize: '0.84rem', gap: '6px' }}
                      >
                        <Check size={16} /> Approve All Pending ({pendingPermCount})
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Tabs & Search Bar */}
                <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    {/* Status Pills */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {[
                        { id: 'pending',  label: 'Pending Approval', count: pendingPermCount, color: 'var(--warning)' },
                        { id: 'approved', label: 'Approved Access',  count: approvedPermCount, color: 'var(--success)' },
                        { id: 'rejected', label: 'Denied / Revoked', count: rejectedPermCount, color: 'var(--danger)' },
                        { id: 'all',      label: 'All History',      count: allRequests.length, color: 'var(--primary)' }
                      ].map(tab => {
                        const isActive = permissionTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setPermissionTab(tab.id)}
                            style={{
                              padding: '6px 14px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '6px',
                              background: isActive ? 'var(--primary)' : 'var(--input-bg)',
                              color: isActive ? '#fff' : 'var(--text-secondary)',
                              border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                              transition: 'all 0.2s'
                            }}
                          >
                            <span>{tab.label}</span>
                            <span style={{
                              fontSize: '0.68rem', padding: '1px 6px', borderRadius: 8,
                              background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                              color: isActive ? '#fff' : tab.color, fontWeight: 700
                            }}>
                              {tab.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Showing <strong>{filteredPermissions.length}</strong> request(s)
                    </span>
                  </div>

                  {/* Search bar */}
                  <div className="search-input-wrapper">
                    <span className="search-icon"><Search size={16} /></span>
                    <input
                      type="text"
                      className="glass-input has-search-icon"
                      placeholder="Search requests by student name, roll number, book title, or department..."
                      value={permissionSearch}
                      onChange={(e) => setPermissionSearch(e.target.value)}
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                    {permissionSearch && (
                      <button
                        type="button"
                        className="search-clear-btn"
                        onClick={() => setPermissionSearch('')}
                        aria-label="Clear search"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {filteredPermissions.length === 0 ? (
                  <EmptyState
                    icon={Key}
                    title={permissionTab === 'pending' ? 'No pending access requests!' : 'No clearance requests found'}
                    description={
                      permissionSearch
                        ? `No requests match "${permissionSearch}". Try a different search.`
                        : permissionTab === 'pending'
                        ? 'All cross-department permission requests from students have been reviewed.'
                        : 'No records match the selected clearance filter.'
                    }
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {filteredPermissions.map(r => {
                      const isPending = (r.status || 'pending') === 'pending';
                      const isApproved = r.status === 'approved';
                      const isRejected = r.status === 'rejected';
                      const isActionLoading = !!permissionActionLoading[r.id];

                      return (
                        <div
                          key={r.id}
                          className="glass-panel"
                          style={{
                            padding: '18px 20px',
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '14px',
                            borderLeft: isPending ? '4px solid #f59e0b' : isApproved ? '4px solid #10b981' : '4px solid #ef4444'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: '260px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                                {r.full_name}
                              </h4>
                              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                ({r.roll_number || 'N/A'})
                              </span>
                              <StatusBadge status={r.status || 'pending'} />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--primary-light, #60a5fa)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <BookOpen size={16} /> {r.book_title || 'Book Access'}
                              </span>
                              {r.book_author && (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  by {r.book_author}
                                </span>
                              )}
                              <span className="badge badge-secondary" style={{ fontSize: '0.72rem', textTransform: 'none' }}>
                                Target: {r.requested_branch_name}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: 4 }}>
                              <span>Home Dept: <strong>{r.student_branch || 'Engineering'}</strong></span>
                              <span>•</span>
                              <span style={{ color: 'var(--text-muted)' }}>
                                Requested: {new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* View Student Activity Dossier */}
                            <button
                              onClick={() => handleOpenStudentDossier(r)}
                              className="btn btn-secondary"
                              style={{ padding: '7px 12px', fontSize: '0.8rem', gap: '5px' }}
                              title="Open Student Digital Dossier & Activity Transcript"
                            >
                              <User size={14} /> Student Dossier
                            </button>

                            {/* Pending State Actions */}
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleBranchApproval(r.id, 'approved')}
                                  disabled={isActionLoading}
                                  className="btn btn-success"
                                  style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                >
                                  <Check size={14} /> Grant Access
                                </button>
                                <button
                                  onClick={() => handleBranchApproval(r.id, 'rejected')}
                                  disabled={isActionLoading}
                                  className="btn btn-danger"
                                  style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                >
                                  <X size={14} /> Deny
                                </button>
                              </>
                            )}

                            {/* Approved State Actions */}
                            {isApproved && (
                              <button
                                onClick={() => handleBranchApproval(r.id, 'rejected')}
                                disabled={isActionLoading}
                                className="btn btn-secondary"
                                style={{
                                  padding: '7px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '5px',
                                  color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)'
                                }}
                              >
                                <X size={14} /> Revoke Clearance
                              </button>
                            )}

                            {/* Rejected State Actions */}
                            {isRejected && (
                              <button
                                onClick={() => handleBranchApproval(r.id, 'approved')}
                                disabled={isActionLoading}
                                className="btn btn-secondary"
                                style={{
                                  padding: '7px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '5px',
                                  color: 'var(--success)', borderColor: 'rgba(16,185,129,0.3)'
                                }}
                              >
                                <Check size={14} /> Re-Grant Access
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Book Inventory Tab */}
            {activeTab === 'books' && (
              <div className="animate-section-enter">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }} className="responsive-grid-1col">
                  <div>
                    <h2>Book Inventory Management</h2>
                    <p style={{ marginTop: '4px' }}>Add, update, or remove reference books and materials from the catalog.</p>
                  </div>
                  <div className="book-inventory-actions" style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => openBookModal(null)}
                      className="btn btn-primary"
                    >
                      <Plus size={16} /> Catalog New Book
                    </button>
                    <input
                      ref={directoryInputRef}
                      type="file"
                      style={{ display: 'none' }}
                      webkitdirectory=""
                      multiple
                      accept="application/pdf"
                      onChange={handleDirectorySelected}
                    />
                    <button
                      onClick={() => directoryInputRef.current?.click()}
                      className="btn btn-secondary"
                      disabled={directoryImporting}
                    >
                      {directoryImporting ? (
                        <>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 14,
                              height: 14,
                              border: '2px solid currentColor',
                              borderTopColor: 'transparent',
                              borderRadius: '50%',
                              animation: 'spin 0.8s linear infinite',
                              marginRight: '8px',
                              verticalAlign: 'middle'
                            }}
                          />
                          Importing Folder...
                        </>
                      ) : (
                        <>
                          <FolderUp size={16} /> Import PDF Folder
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleResolveMissingCovers}
                      className="btn btn-secondary"
                      disabled={resolvingCoversLoading}
                      title="Scan catalog and automatically retrieve covers via OpenLibrary, Google Books, or PDF extraction"
                    >
                      {resolvingCoversLoading ? (
                        <>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 14,
                              height: 14,
                              border: '2px solid currentColor',
                              borderTopColor: 'transparent',
                              borderRadius: '50%',
                              animation: 'spin 0.8s linear infinite',
                              marginRight: '8px',
                              verticalAlign: 'middle'
                            }}
                          />
                          Resolving Covers...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} color="var(--primary)" /> Resolve Missing Covers
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Filter and Search */}
                <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="search-input-wrapper" style={{ flex: 1 }}>
                    <span className="search-icon"><Search size={18} /></span>
                    <input
                      type="text"
                      className="glass-input has-search-icon"
                      placeholder="Search books by title, author, category, or branch..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="search-clear-btn"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                      >
                        <X size={16} />
                      </button>
                    )}
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
                {filteredBooks.length === 0 ? (
                  <div className="glass-panel" style={{ padding: '32px 16px', textAlign: 'center' }}>
                    <EmptyState
                      icon={BookOpen}
                      title="No Books Found"
                      subtitle={searchQuery ? `No catalog books match "${searchQuery}"` : "The library catalog is currently empty."}
                      actionLabel={!searchQuery ? "Catalog New Book" : undefined}
                      onAction={!searchQuery ? () => openBookModal(null) : undefined}
                    />
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="glass-panel desktop-table-view" style={{ overflow: 'hidden' }}>
                      <div className="table-responsive-wrapper">
                        <table className="custom-table" style={{ minWidth: '950px' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '40px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isAllFilteredBooksSelected}
                                  onChange={handleSelectAllBooks}
                                  style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                                />
                              </th>
                              <th style={{ width: '70px', textAlign: 'center' }}>Cover</th>
                              <th>Title</th>
                              <th>Author</th>
                              <th>Branch</th>
                              <th>Category</th>
                              <th>Priority</th>
                              <th className="sticky-action-col" style={{ textAlign: 'center', minWidth: '150px' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredBooks.map(b => (
                              <tr key={b.id}>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={selectedBookIds.includes(b.id)}
                                    onChange={e => handleSelectBook(b.id, e.target.checked)}
                                    style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                                  />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {b.cover_url ? (
                                    <img src={b.cover_url} alt={b.title} style={{ width: '40px', height: '56px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-glass)' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                  ) : (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>—</span>
                                  )}
                                </td>
                                <td style={{ fontWeight: 600 }}>{b.title}</td>
                                <td>{b.author}</td>
                                <td>
                                  <span className="badge badge-secondary" style={{ textTransform: 'none', fontSize: '0.65rem' }}>{b.branch_name}</span>
                                </td>
                                <td style={{ color: 'var(--text-secondary)' }}>{b.category_name}</td>
                                <td>
                                  {b.priority === 'main' ? (
                                    <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Main</span>
                                  ) : (
                                    <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>Sub</span>
                                  )}
                                </td>
                                <td className="sticky-action-col" style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    <button
                                      onClick={() => setSelectedBookForActivity(b)}
                                      className="btn btn-secondary"
                                      style={{ padding: '6px 10px', borderColor: 'rgba(59,130,246,0.3)', color: 'var(--primary)' }}
                                      title="View Reading Activity"
                                    >
                                      <Activity size={14} />
                                    </button>
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
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile Card View (< 768px) */}
                    <div className="mobile-cards-view">
                      {filteredBooks.map(b => (
                        <div key={b.id} className="mobile-data-card">
                          <div className="mobile-card-header">
                            <input
                              type="checkbox"
                              checked={selectedBookIds.includes(b.id)}
                              onChange={e => handleSelectBook(b.id, e.target.checked)}
                              style={{ cursor: 'pointer', transform: 'scale(1.2)', marginTop: '4px' }}
                            />
                            {b.cover_url ? (
                              <img src={b.cover_url} alt={b.title} style={{ width: '50px', height: '70px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-glass)', flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              <div style={{ width: '50px', height: '70px', borderRadius: '6px', background: 'var(--surface-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-glass)' }}>
                                <BookOpen size={22} color="var(--text-muted)" />
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="mobile-card-title">{b.title}</div>
                              <div className="mobile-card-subtitle">by {b.author || 'Unknown Author'}</div>
                            </div>
                          </div>

                          <div className="mobile-card-chips">
                            <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>Branch: {b.branch_name}</span>
                            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>Cat: {b.category_name}</span>
                            {b.priority === 'main' ? (
                              <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Priority: Main</span>
                            ) : (
                              <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>Priority: Sub</span>
                            )}
                          </div>

                          <div className="mobile-card-actions">
                            <button
                              onClick={() => setSelectedBookForActivity(b)}
                              className="btn btn-secondary"
                              style={{ borderColor: 'rgba(59,130,246,0.3)', color: 'var(--primary)' }}
                            >
                              <Activity size={15} /> Analytics
                            </button>
                            <button
                              onClick={() => openBookModal(b)}
                              className="btn btn-secondary"
                            >
                              <Edit size={15} /> Edit
                            </button>
                            <button
                              onClick={() => setDeleteBookConfirm({ id: b.id, title: b.title })}
                              className="btn btn-secondary"
                              style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--danger)' }}
                            >
                              <Trash2 size={15} /> Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Students Management Tab */}
            {activeTab === 'students' && (
              <div className="animate-section-enter">
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
                    <div className="search-input-wrapper" style={{ flex: 1, minWidth: '220px' }}>
                      <span className="search-icon"><Search size={16} /></span>
                      <input
                        type="text"
                        className="glass-input has-search-icon"
                        placeholder="Search by name, roll no., username, BT..."
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                      />
                      {studentSearch && (
                        <button
                          type="button"
                          className="search-clear-btn"
                          onClick={() => setStudentSearch('')}
                          aria-label="Clear search"
                        >
                          <X size={16} />
                        </button>
                      )}
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
                    <>
                      {/* Desktop Table View */}
                      <div className="glass-panel desktop-table-view" style={{ overflow: 'hidden' }}>
                        <div className="table-responsive-wrapper">
                          <table className="custom-table" style={{ minWidth: '1100px' }}>
                            <thead>
                              <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={isAllFilteredSelected}
                                    onChange={handleSelectAll}
                                    style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                                  />
                                </th>
                                <th style={{ width: '45px' }}>#</th>
                                <th>Student</th>
                                <th>Roll / BT</th>
                                <th>Branch</th>
                                <th>Year / Sem</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th className="sticky-action-col" style={{ textAlign: 'center', minWidth: '290px' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredStudents.map((s, idx) => (
                                <tr
                                  key={s.id}
                                  onClick={(e) => {
                                    if (!e.target.closest('button') && !e.target.closest('input')) {
                                      setSelectedStudentForActivity(s);
                                    }
                                  }}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <td style={{ textAlign: 'center' }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedUserIds.includes(s.id)}
                                      onChange={e => handleSelectUser(s.id, e.target.checked)}
                                      style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                                    />
                                  </td>
                                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                                  <td title="Click to view complete activity history">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <div style={{
                                        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                                        background: `linear-gradient(135deg, var(--primary), var(--secondary))`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.85rem', fontWeight: 700, color: '#fff',
                                        boxShadow: '0 2px 8px var(--primary-glow)'
                                      }}>
                                        {s.full_name?.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span>{s.full_name}</span>
                                          <span style={{ fontSize: '0.72rem', color: 'var(--primary)', opacity: 0.8 }}>↗</span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{s.username}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.roll_number}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BT: {s.bt_number || 'N/A'}</div>
                                  </td>
                                  <td>
                                    <span className="badge badge-secondary" style={{ fontSize: '0.65rem', textTransform: 'none' }}>
                                      {s.branch_name}
                                    </span>
                                  </td>
                                  <td style={{ color: 'var(--text-secondary)' }}>
                                    Year {s.year} &bull; Sem {s.semester}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                      {s.status === 'approved' && <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Approved</span>}
                                      {s.status === 'pending' && <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Pending</span>}
                                      {s.status === 'rejected' && <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>Rejected</span>}
                                      {s.is_blocked === 1 && (
                                        <span className="badge badge-danger" style={{ fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>Blocked</span>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                    {new Date(s.created_at).toLocaleDateString()}
                                  </td>
                                  <td className="sticky-action-col" style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', whiteSpace: 'nowrap' }}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedStudentForActivity(s);
                                        }}
                                        className="btn btn-secondary"
                                        style={{
                                          padding: '7px 12px',
                                          borderColor: 'rgba(37, 99, 235, 0.35)',
                                          color: 'var(--primary)',
                                          fontSize: '0.8rem', gap: '6px'
                                        }}
                                        title={`View complete activity & study history for ${s.full_name}`}
                                      >
                                        <Activity size={14} /> Activity
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEditStudentModal(s);
                                        }}
                                        className="btn btn-secondary"
                                        style={{
                                          padding: '7px 12px',
                                          borderColor: 'rgba(99, 102, 241, 0.35)',
                                          color: 'var(--primary)',
                                          fontSize: '0.8rem', gap: '6px'
                                        }}
                                        title={`Edit ${s.full_name}'s details`}
                                      >
                                        <Edit size={14} /> Edit
                                      </button>

                                      {s.is_blocked === 1 ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleBlock(s.id, false);
                                          }}
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
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleBlock(s.id, true);
                                          }}
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
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteConfirm({ id: s.id, name: s.full_name });
                                        }}
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

                      {/* Mobile Card View (< 768px) */}
                      <div className="mobile-cards-view">
                        {filteredStudents.map((s, idx) => (
                          <div
                            key={s.id}
                            className="mobile-data-card"
                            onClick={(e) => {
                              if (!e.target.closest('button') && !e.target.closest('input')) {
                                setSelectedStudentForActivity(s);
                              }
                            }}
                          >
                            <div className="mobile-card-header">
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(s.id)}
                                onChange={e => handleSelectUser(s.id, e.target.checked)}
                                style={{ cursor: 'pointer', transform: 'scale(1.2)', marginTop: '4px' }}
                              />
                              <div style={{
                                width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                                background: `linear-gradient(135deg, var(--primary), var(--secondary))`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.95rem', fontWeight: 800, color: '#fff'
                              }}>
                                {s.full_name?.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                  <span className="mobile-card-title">{s.full_name}</span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>#{idx + 1}</span>
                                </div>
                                <div className="mobile-card-subtitle">@{s.username}</div>
                              </div>
                            </div>

                            <div className="mobile-card-chips">
                              <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{s.branch_name}</span>
                              <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>Year {s.year} • Sem {s.semester}</span>
                              {s.status === 'approved' && <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Approved</span>}
                              {s.status === 'pending' && <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Pending</span>}
                              {s.status === 'rejected' && <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>Rejected</span>}
                              {s.is_blocked === 1 && (
                                <span className="badge badge-danger" style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>Blocked</span>
                              )}
                            </div>

                            <div className="mobile-card-meta-grid">
                              <div><strong>Roll:</strong> {s.roll_number}</div>
                              <div><strong>BT:</strong> {s.bt_number || 'N/A'}</div>
                              <div style={{ gridColumn: 'span 2' }}><strong>Joined:</strong> {new Date(s.created_at).toLocaleDateString()}</div>
                            </div>

                            <div className="mobile-card-actions">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStudentForActivity(s);
                                }}
                                className="btn btn-secondary"
                                style={{ borderColor: 'rgba(37, 99, 235, 0.35)', color: 'var(--primary)' }}
                              >
                                <Activity size={15} /> Activity
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditStudentModal(s);
                                }}
                                className="btn btn-secondary"
                                style={{ borderColor: 'rgba(99, 102, 241, 0.35)', color: 'var(--primary)' }}
                              >
                                <Edit size={15} /> Edit
                              </button>
                              {s.is_blocked === 1 ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleBlock(s.id, false);
                                  }}
                                  className="btn btn-secondary"
                                  style={{ borderColor: 'rgba(16, 185, 129, 0.3)', color: 'var(--success)' }}
                                >
                                  <UserCheck size={15} /> Unblock
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleBlock(s.id, true);
                                  }}
                                  className="btn btn-secondary"
                                  style={{ borderColor: 'rgba(245, 158, 11, 0.3)', color: 'var(--warning)' }}
                                >
                                  <UserX size={15} /> Block
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm({ id: s.id, name: s.full_name });
                                }}
                                className="btn btn-secondary"
                                style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--danger)' }}
                              >
                                <Trash2 size={15} /> Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
            )}

            {/* System Audit Logs Tab */}
            {activeTab === 'logs' && (
              <div className="animate-section-enter">
                <div style={{ marginBottom: '32px' }}>
                  <h2>System Audit Log Trail</h2>
                  <p style={{ marginTop: '4px' }}>Real-time history of events, login sessions, reading page progress updates, and administrative overrides.</p>
                </div>

                <div className="glass-panel" style={{ padding: '24px' }}>
                  {logsLoading ? (
                    <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ width: '36px', height: '36px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                      <p>Loading audit logs...</p>
                    </div>
                  ) : logs.length === 0 ? (
                    <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No logs found.
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="desktop-table-view">
                        <div className="table-responsive-wrapper" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                          <table className="custom-table" style={{ minWidth: '750px' }}>
                            <thead>
                              <tr>
                                <th>Timestamp</th>
                                <th>User / Member</th>
                                <th>Event Action</th>
                                <th>Entity Details</th>
                              </tr>
                            </thead>
                            <tbody>
                              {logs.map((log, index) => {
                                let actionBadgeClass = 'badge-secondary';
                                if (log.action_type === 'login') actionBadgeClass = 'badge-success';
                                else if (log.action_type === 'logout') actionBadgeClass = 'badge-primary';
                                else if (log.action_type === 'download') actionBadgeClass = 'badge-warning';
                                else if (log.action_type === 'admin_action') actionBadgeClass = 'badge-danger';
                                else if (log.action_type === 'view') actionBadgeClass = 'badge-secondary';

                                return (
                                  <tr key={log.id || index}>
                                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                      {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td>
                                      <div style={{ fontWeight: 600 }}>{log.full_name || 'System'}</div>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {log.role} {log.roll_number ? `(${log.roll_number})` : ''}
                                      </span>
                                    </td>
                                    <td>
                                      <span className={`badge ${actionBadgeClass}`} style={{ fontSize: '0.65rem' }}>
                                        {log.action_type.replace('_', ' ')}
                                      </span>
                                    </td>
                                    <td>
                                      <div>{log.details}</div>
                                      {log.book_title && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '2px', fontWeight: 600 }}>
                                          Book: "{log.book_title}"
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Mobile Cards */}
                      <div className="mobile-cards-view">
                        {logs.map((log, index) => {
                          let actionBadgeClass = 'badge-secondary';
                          if (log.action_type === 'login') actionBadgeClass = 'badge-success';
                          else if (log.action_type === 'logout') actionBadgeClass = 'badge-primary';
                          else if (log.action_type === 'download') actionBadgeClass = 'badge-warning';
                          else if (log.action_type === 'admin_action') actionBadgeClass = 'badge-danger';
                          else if (log.action_type === 'view') actionBadgeClass = 'badge-secondary';

                          return (
                            <div key={log.id || index} className="mobile-data-card">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{log.full_name || 'System'}</div>
                                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{log.role} {log.roll_number ? `(${log.roll_number})` : ''}</div>
                                </div>
                                <span className={`badge ${actionBadgeClass}`} style={{ fontSize: '0.7rem' }}>
                                  {log.action_type.replace('_', ' ')}
                                </span>
                              </div>

                              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'var(--surface-glow)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                                <div>{log.details}</div>
                                {log.book_title && (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--primary)', marginTop: '4px', fontWeight: 600 }}>
                                    Book: "{log.book_title}"
                                  </div>
                                )}
                              </div>

                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={13} /> {new Date(log.created_at).toLocaleString()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

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

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="animate-section-enter">
                <SettingsView isAdmin={true} />
              </div>
            )}

            {/* Branches Management Tab */}
            {activeTab === 'branches' && (
              <div className="animate-section-enter">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '14px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Academic Branches Management</h2>
                    <p style={{ marginTop: '4px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Configure institutional academic departments, manage course branches, and monitor departmental books and enrolled students.
                    </p>
                  </div>
                  <div className="badge badge-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                    <GitBranch size={16} /> {branches.length} Registered Branches
                  </div>
                </div>

                {/* Add New Branch Card */}
                <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={18} color="var(--primary)" /> Add New Academic Branch
                  </h3>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Branch names will appear during student signup, book categorization, and cross-department permissions.
                  </p>
                  <form onSubmit={handleCreateBranch} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="glass-input"
                      placeholder="e.g. Artificial Intelligence & Data Science (AIDS)"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      style={{ flex: 1, minWidth: '280px' }}
                      disabled={branchActionLoading}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={branchActionLoading || !newBranchName.trim()}
                      style={{ padding: '12px 24px', gap: '8px', minWidth: '160px' }}
                    >
                      {branchActionLoading ? (
                        <>
                          <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Plus size={16} /> Add Branch
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Branches List Table */}
                <div className="glass-panel" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Active Branches Directory</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{branches.length} Total</span>
                  </div>

                  {branches.length === 0 ? (
                    <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <GitBranch size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                      <p style={{ fontWeight: 600 }}>No academic branches found in the database.</p>
                      <p style={{ fontSize: '0.82rem' }}>Add your first branch using the form above.</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table View */}
                      <div className="desktop-table-view">
                        <div className="table-responsive-wrapper">
                          <table className="custom-table" style={{ minWidth: '700px' }}>
                            <thead>
                              <tr>
                                <th style={{ width: '60px' }}>ID</th>
                                <th>Branch Name</th>
                                <th>Catalog Books</th>
                                <th>Enrolled Students</th>
                                <th className="sticky-action-col" style={{ textAlign: 'right', minWidth: '110px' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {branches.map((br) => {
                                const branchBooksCount = books.filter(b => b.branch_id === br.id || isSameBranch(b.branch_name, br.name)).length;
                                const branchStudentsCount = students.filter(s => isSameBranch(s.branch_name, br.name)).length;
                                const isEditing = editingBranch && editingBranch.id === br.id;

                                return (
                                  <tr key={br.id}>
                                    <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>#{br.id}</td>
                                    <td>
                                      {isEditing ? (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                          <input
                                            type="text"
                                            className="glass-input"
                                            value={editingBranch.name}
                                            onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                                            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                            autoFocus
                                          />
                                          <button
                                            onClick={() => handleUpdateBranch(br.id, editingBranch.name)}
                                            className="btn btn-success"
                                            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                            disabled={branchActionLoading}
                                          >
                                            Save
                                          </button>
                                          <button
                                            onClick={() => setEditingBranch(null)}
                                            className="btn btn-secondary"
                                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                                          {br.name}
                                        </div>
                                      )}
                                    </td>
                                    <td>
                                      <span className="badge badge-primary" style={{ fontSize: '0.78rem' }}>
                                        {branchBooksCount} Books
                                      </span>
                                    </td>
                                    <td>
                                      <span className="badge badge-success" style={{ fontSize: '0.78rem' }}>
                                        {branchStudentsCount} Students
                                      </span>
                                    </td>
                                    <td className="sticky-action-col" style={{ textAlign: 'right' }}>
                                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button
                                          onClick={() => setEditingBranch({ id: br.id, name: br.name })}
                                          className="btn btn-secondary"
                                          style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                          title="Edit Branch Name"
                                        >
                                          <Edit size={14} />
                                        </button>
                                        <button
                                          onClick={() => setBranchDeleteConfirm(br)}
                                          className="btn btn-danger"
                                          style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                          title="Delete Branch"
                                        >
                                          <Trash2 size={14} />
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
                      <div className="mobile-cards-view" style={{ padding: '16px' }}>
                        {branches.map((br) => {
                          const branchBooksCount = books.filter(b => b.branch_id === br.id || isSameBranch(b.branch_name, br.name)).length;
                          const branchStudentsCount = students.filter(s => isSameBranch(s.branch_name, br.name)).length;
                          const isEditing = editingBranch && editingBranch.id === br.id;

                          return (
                            <div key={br.id} className="mobile-data-card">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="mobile-card-title">{br.name}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>#{br.id}</span>
                              </div>

                              {isEditing ? (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                                  <input
                                    type="text"
                                    className="glass-input"
                                    value={editingBranch.name}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                                    style={{ padding: '8px 12px', fontSize: '0.88rem', flex: 1 }}
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleUpdateBranch(br.id, editingBranch.name)}
                                    className="btn btn-success"
                                    style={{ minHeight: '40px', padding: '0 14px' }}
                                    disabled={branchActionLoading}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingBranch(null)}
                                    className="btn btn-secondary"
                                    style={{ minHeight: '40px', padding: '0 12px' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="mobile-card-chips">
                                  <span className="badge badge-primary" style={{ fontSize: '0.74rem' }}>{branchBooksCount} Books</span>
                                  <span className="badge badge-success" style={{ fontSize: '0.74rem' }}>{branchStudentsCount} Students</span>
                                </div>
                              )}

                              <div className="mobile-card-actions">
                                <button
                                  onClick={() => setEditingBranch({ id: br.id, name: br.name })}
                                  className="btn btn-secondary"
                                >
                                  <Edit size={15} /> Edit Name
                                </button>
                                <button
                                  onClick={() => setBranchDeleteConfirm(br)}
                                  className="btn btn-danger"
                                >
                                  <Trash2 size={15} /> Delete Branch
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
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

      {/* ── Branch Delete Confirmation Modal ──────────────────────────────── */}
      {branchDeleteConfirm && (
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

            <h3 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Delete Academic Branch?</h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              You are about to delete the following academic branch:
            </p>
            <div style={{
              padding: '12px 20px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              marginBottom: '20px'
            }}>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                {branchDeleteConfirm.name}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: 1.6 }}>
              Existing books linked to this branch will have their branch reference set to unassigned. Students registered with this branch name will remain intact.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setBranchDeleteConfirm(null)}
                className="btn btn-secondary"
                style={{ padding: '10px 24px', minWidth: '120px' }}
                disabled={branchActionLoading}
              >
                <X size={16} /> Cancel
              </button>
              <button
                onClick={() => handleDeleteBranch(branchDeleteConfirm.id)}
                className="btn btn-danger"
                style={{ padding: '10px 24px', minWidth: '140px' }}
                disabled={branchActionLoading}
              >
                <Trash2 size={16} />
                {branchActionLoading ? 'Deleting...' : 'Yes, Delete Branch'}
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

      {/* ── Bulk Approve All Pending Users Confirmation Modal ─────────────── */}
      {showBulkApproveUsersConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: '100%', maxWidth: '460px',
            padding: '36px', textAlign: 'center',
            border: '1px solid rgba(16,185,129,0.3)',
            boxShadow: '0 0 40px rgba(16,185,129,0.15), var(--shadow-glass)'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 20px',
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--success)'
            }}>
              <CheckCircle2 size={32} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '10px' }}>Approve All Pending Registrations?</h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
              You are about to authorize and activate accounts for:
            </p>
            <div style={{
              padding: '12px 20px', borderRadius: '10px',
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              marginBottom: '22px'
            }}>
              <span style={{ fontWeight: 700, fontSize: '1.3rem', color: 'var(--success)' }}>
                {pendingUsers.length} Pending Students
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowBulkApproveUsersConfirm(false)}
                className="btn btn-secondary"
                style={{ padding: '10px 24px', minWidth: '120px' }}
                disabled={bulkApproveUsersLoading}
              >
                <X size={16} /> Cancel
              </button>
              <button
                onClick={handleBulkApproveUsers}
                className="btn btn-success"
                style={{ padding: '10px 24px', minWidth: '160px', fontWeight: 700 }}
                disabled={bulkApproveUsersLoading}
              >
                <Check size={16} />
                {bulkApproveUsersLoading ? 'Authorizing...' : 'Yes, Approve All'}
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
                        marginTop: '10px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        fontSize: '0.74rem',
                        color: '#60a5fa',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        maxWidth: '100%',
                        overflow: 'hidden'
                      }}>
                        <FileText size={14} style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, flexShrink: 0 }}>Current Document:</span>
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--text-primary)',
                          maxWidth: '240px'
                        }}>
                          {editingBook.pdf_url.startsWith('data:')
                            ? `${editingBook.title || 'Digital Document'}.pdf (Embedded)`
                            : editingBook.pdf_url.split('/').pop()}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Book Cover / Thumbnail */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Book Cover / Thumbnail
                </label>

                {/* Hidden Real File Input */}
                <input
                  type="file"
                  ref={thumbnailInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setThumbnailFile(file);
                      const reader = new FileReader();
                      reader.onload = () => setThumbnailPreview(reader.result);
                      reader.readAsDataURL(file);
                      if (bookModalError) setBookModalError('');
                    }
                  }}
                />

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  {/* Thumbnail Preview */}
                  <div style={{
                    width: '80px',
                    height: '110px',
                    borderRadius: '8px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-glass)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    {thumbnailPreview ? (
                      <img src={thumbnailPreview} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : bookFormData.cover_url ? (
                      <img src={bookFormData.cover_url} alt="Current cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Image size={24} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>

                  {/* Upload / URL Controls */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => thumbnailInputRef.current?.click()}
                        className="btn btn-secondary"
                        style={{ flex: 1, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <UploadCloud size={14} />
                        {thumbnailFile ? 'Change File' : 'Upload File'}
                      </button>

                      <button
                        type="button"
                        onClick={handleAutoFindCover}
                        disabled={autoFindingCover || !bookFormData.title}
                        className="btn btn-secondary"
                        style={{ flex: 1, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        title="Automatically look up official book cover via OpenLibrary, Google Books, or PDF page 1"
                      >
                        <Sparkles size={14} color="var(--primary)" />
                        {autoFindingCover ? 'Searching...' : '⚡ Auto-Find Cover'}
                      </button>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      {thumbnailFile
                        ? '🟢 Custom manual upload selected (will not be overwritten)'
                        : bookFormData.cover_url
                        ? '🟢 Cover image attached'
                        : 'ℹ️ If left empty, system will automatically resolve thumbnail on save'}
                    </div>

                    <input
                      type="text"
                      className="glass-input"
                      placeholder="Paste image URL here..."
                      value={bookFormData.cover_url || ''}
                      onChange={(e) => {
                        setBookFormData({ ...bookFormData, cover_url: e.target.value });
                        setThumbnailPreview(null);
                        setThumbnailFile(null);
                      }}
                      style={{ fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                {(thumbnailFile || bookFormData.cover_url) && (
                  <button
                    type="button"
                    onClick={() => {
                      setThumbnailFile(null);
                      setThumbnailPreview(null);
                      setBookFormData({ ...bookFormData, cover_url: '' });
                      if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
                    }}
                    className="btn btn-secondary"
                    style={{ marginTop: '8px', padding: '6px 12px', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}
                  >
                    Remove Cover
                  </button>
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

      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '11px',
            background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.2)',
            flexShrink: 0
          }}>
            <img src="/logo.png" alt="SISTec Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <span style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-primary)', display: 'block', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
              SISTec Admin
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              System Console
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NotificationBell />
        </div>
      </header>

      {/* Mobile Bottom Navigation (5 core items) */}
      <nav className="mobile-bottom-nav">
        <button 
          onClick={() => switchTab('overview')}
          className={`bottom-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
        >
          <BarChart3 size={19} />
          <span>Stats</span>
        </button>
        <button 
          onClick={() => switchTab('users')}
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
          onClick={() => switchTab('students')}
          className={`bottom-nav-item ${activeTab === 'students' ? 'active' : ''}`}
        >
          <UserCheck size={19} />
          <span>Students</span>
        </button>
        <button 
          onClick={() => switchTab('books')}
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
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                  flexShrink: 0
                }}>
                  <img src="/logo.png" alt="SISTec Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
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
                onClick={() => { switchTab('overview'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <BarChart3 size={16} /> Overview & Analytics
              </button>
              <button 
                onClick={() => { switchTab('users'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <Users size={16} /> User Approvals ({pendingUsers.length})
              </button>
              <button 
                onClick={() => { switchTab('permissions'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'permissions' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <Key size={16} /> Access Requests ({pendingRequests.length})
              </button>
              <button 
                onClick={() => { switchTab('settings'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <Settings size={16} /> Settings
              </button>
              <button 
                onClick={() => { switchTab('books'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'books' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <BookOpen size={16} /> Book Inventory
              </button>
              <button 
                onClick={() => { switchTab('students'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <UserCheck size={16} /> All Students ({students.length})
              </button>
              <button 
                onClick={() => { switchTab('branches'); setShowMenuDrawer(false); }}
                className={`btn ${activeTab === 'branches' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', width: '100%', padding: '10px 16px' }}
              >
                <GitBranch size={16} /> Academic Branches ({branches.length})
              </button>
              <button 
                onClick={() => { switchTab('logs'); setShowMenuDrawer(false); }}
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

      {/* Edit Student Information Modal */}
      {editingStudent && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: '100%', maxWidth: '560px',
            padding: '32px',
            border: '1px solid rgba(99,102,241,0.25)',
            boxShadow: '0 0 40px rgba(99,102,241,0.12), var(--shadow-glass)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  padding: '10px', borderRadius: '12px',
                  background: 'rgba(99,102,241,0.15)', color: 'var(--primary)'
                }}>
                  <Edit size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Edit Student Record</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    @{editingStudent.username} &bull; Registered {new Date(editingStudent.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="btn btn-secondary"
                style={{ padding: '6px', borderRadius: '50%', minWidth: 'auto' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveStudentEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Full Name</label>
                  <input
                    type="text"
                    required
                    className="glass-input"
                    value={studentEditFormData.full_name}
                    onChange={e => setStudentEditFormData({ ...studentEditFormData, full_name: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Email</label>
                  <input
                    type="email"
                    required
                    className="glass-input"
                    value={studentEditFormData.email}
                    onChange={e => setStudentEditFormData({ ...studentEditFormData, email: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>University Roll No.</label>
                  <input
                    type="text"
                    required
                    className="glass-input"
                    value={studentEditFormData.roll_number}
                    onChange={e => setStudentEditFormData({ ...studentEditFormData, roll_number: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>BT Number / Enrollment</label>
                  <input
                    type="text"
                    className="glass-input"
                    value={studentEditFormData.bt_number}
                    onChange={e => setStudentEditFormData({ ...studentEditFormData, bt_number: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Branch / Department</label>
                <select
                  className="glass-input glass-select"
                  value={studentEditFormData.branch_name}
                  onChange={e => setStudentEditFormData({ ...studentEditFormData, branch_name: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="">Select Department</option>
                  {branches.map(b => (
                    <option key={b.id || b.name} value={b.name}>{b.name}</option>
                  ))}
                  {uniqueStudentBranches.filter(b => !branches.some(br => br.name === b)).map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Academic Year</label>
                  <select
                    className="glass-input glass-select"
                    value={studentEditFormData.year}
                    onChange={e => setStudentEditFormData({ ...studentEditFormData, year: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select Year</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                    <option value="1">1st Year (Num 1)</option>
                    <option value="2">2nd Year (Num 2)</option>
                    <option value="3">3rd Year (Num 3)</option>
                    <option value="4">4th Year (Num 4)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Semester</label>
                  <select
                    className="glass-input glass-select"
                    value={studentEditFormData.semester}
                    onChange={e => setStudentEditFormData({ ...studentEditFormData, semester: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select Semester</option>
                    <option value="1st Sem">1st Semester</option>
                    <option value="2nd Sem">2nd Semester</option>
                    <option value="3rd Sem">3rd Semester</option>
                    <option value="4th Sem">4th Semester</option>
                    <option value="5th Sem">5th Semester</option>
                    <option value="6th Sem">6th Semester</option>
                    <option value="7th Sem">7th Semester</option>
                    <option value="8th Sem">8th Semester</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                      <option key={num} value={String(num)}>Semester {num}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Account Approval Status</label>
                <select
                  className="glass-input glass-select"
                  value={studentEditFormData.status}
                  onChange={e => setStudentEditFormData({ ...studentEditFormData, status: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="btn btn-secondary"
                  disabled={studentEditSaving}
                  style={{ padding: '9px 20px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-shine"
                  disabled={studentEditSaving}
                  style={{ padding: '9px 24px', fontWeight: 600 }}
                >
                  {studentEditSaving ? 'Saving Changes...' : 'Save Student Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-Over Drilldown Drawer for Clickable Stat Cards */}
      {activeAnalyticsDrilldown && dashboardData && (
        <div
          className="admin-drilldown-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 7, 18, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => {
            setActiveAnalyticsDrilldown(null);
            setDrilldownSearch('');
          }}
        >
          <div
            className="admin-drilldown-drawer"
            style={{
              width: '100%',
              maxWidth: '680px',
              height: '100%',
              maxHeight: '100dvh',
              background: 'var(--modal-bg, var(--bg-card-solid))',
              borderLeft: '1px solid var(--border-glass)',
              boxShadow: 'var(--shadow-elevated)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 10000,
              overflow: 'hidden',
              boxSizing: 'border-box',
              animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              className="admin-drilldown-header"
              style={{
                padding: 'clamp(14px, 3vw, 22px)',
                paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
                borderBottom: '1px solid var(--border-glass)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
                background: 'var(--modal-card-bg, rgba(255,255,255,0.02))',
                flexShrink: 0
              }}
            >
              <div style={{ flex: 1, minWidth: 0, paddingRight: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span className="badge badge-primary" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'normal' }}>
                    Authoritative Supabase Dataset
                  </span>
                </div>
                <h3 style={{
                  fontSize: 'clamp(1.15rem, 3.5vw, 1.45rem)',
                  fontWeight: 700,
                  margin: 0,
                  lineHeight: 1.3,
                  wordBreak: 'break-word',
                  color: 'var(--text-primary)'
                }}>
                  {activeAnalyticsDrilldown === 'books' && `Total Books (${dashboardData.stats.books})`}
                  {activeAnalyticsDrilldown === 'students' && `Active Students (${dashboardData.stats.students})`}
                  {activeAnalyticsDrilldown === 'views' && `Total Views / Accesses (${dashboardData.stats.views})`}
                  {activeAnalyticsDrilldown === 'downloads' && `Total Downloads (${dashboardData.stats.downloads})`}
                </h3>
                <p style={{
                  fontSize: 'clamp(0.78rem, 2vw, 0.84rem)',
                  color: 'var(--text-secondary)',
                  marginTop: '6px',
                  marginBottom: 0,
                  lineHeight: 1.4,
                  wordBreak: 'break-word'
                }}>
                  Every record below is retrieved directly from Supabase tables and mathematically matches the dashboard card.
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveAnalyticsDrilldown(null);
                  setDrilldownSearch('');
                }}
                className="btn btn-secondary"
                style={{
                  width: '44px',
                  height: '44px',
                  minWidth: '44px',
                  minHeight: '44px',
                  padding: 0,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  cursor: 'pointer',
                  zIndex: 20
                }}
                title="Close Drawer"
                aria-label="Close Drawer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Search Filter */}
            <div
              className="admin-drilldown-search"
              style={{
                padding: 'clamp(10px, 2.5vw, 14px) clamp(14px, 3vw, 22px)',
                borderBottom: '1px solid var(--border-glass)',
                background: 'var(--modal-card-bg, rgba(255,255,255,0.015))',
                flexShrink: 0
              }}
            >
              <div className="search-input-wrapper" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', position: 'relative' }}>
                <span className="search-icon" style={{ left: '14px', pointerEvents: 'none' }}>
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  placeholder={
                    activeAnalyticsDrilldown === 'students'
                      ? 'Search active students by name, roll number...'
                      : activeAnalyticsDrilldown === 'books'
                      ? 'Search books by title, author, branch...'
                      : `Search ${activeAnalyticsDrilldown} logs by student, roll, or book...`
                  }
                  value={drilldownSearch}
                  onChange={(e) => setDrilldownSearch(e.target.value)}
                  className="glass-input has-search-icon"
                  style={{
                    width: '100%',
                    height: '44px',
                    fontSize: '0.86rem',
                    paddingLeft: '42px',
                    paddingRight: drilldownSearch ? '38px' : '14px',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                />
                {drilldownSearch && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setDrilldownSearch('')}
                    title="Clear search"
                    style={{
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)'
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Drawer Records Body */}
            <div
              className="admin-drilldown-body"
              style={{
                flex: 1,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                padding: 'clamp(12px, 2.5vw, 18px) clamp(14px, 3vw, 22px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxSizing: 'border-box'
              }}
            >
              {/* 1. Books Drilldown */}
              {activeAnalyticsDrilldown === 'books' && (() => {
                const list = (dashboardData.drilldowns?.books || []).filter(b => {
                  const q = drilldownSearch.toLowerCase().trim();
                  if (!q) return true;
                  const haystack = [
                    b.title || '',
                    b.author || '',
                    b.branch_name || '',
                    b.category_name || '',
                    b.priority || ''
                  ].join(' ').toLowerCase();
                  const words = q.split(/\s+/).filter(Boolean);
                  return words.every(w => haystack.includes(w));
                });

                if (list.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      <BookOpen size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                      <p style={{ fontStyle: 'italic' }}>No books matching "{drilldownSearch}"</p>
                    </div>
                  );
                }

                return list.map(bk => (
                  <div
                    key={bk.id}
                    onClick={() => setSelectedBookForActivity(books.find(b => b.id === bk.id) || bk)}
                    className="glass-panel glass-panel-hover drilldown-card-item"
                    style={{
                      padding: 'clamp(12px, 2.5vw, 16px)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'clamp(10px, 2.5vw, 16px)',
                      cursor: 'pointer',
                      borderRadius: '12px',
                      flexShrink: 0,
                      minHeight: 'fit-content',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                    title="Click to inspect reader history and activity"
                  >
                    <div style={{
                      width: '46px',
                      height: '64px',
                      borderRadius: '6px',
                      background: 'rgba(255,255,255,0.05)',
                      overflow: 'hidden',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}>
                      {bk.cover_url ? (
                        <img src={bk.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <BookOpen size={20} color="var(--text-muted)" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{
                        fontSize: 'clamp(0.88rem, 2.5vw, 0.96rem)',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: '4px',
                        lineHeight: 1.35,
                        wordBreak: 'break-word',
                        whiteSpace: 'normal'
                      }}>
                        "{bk.title}"
                      </h4>
                      <p style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '6px',
                        lineHeight: 1.3,
                        wordBreak: 'break-word'
                      }}>
                        By {bk.author || 'Unknown Author'}
                      </p>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="badge badge-secondary" style={{ fontSize: '0.68rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                          {bk.branch_name || 'General'}
                        </span>
                        <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>
                          {bk.total_accesses || 0} accesses
                        </span>
                        <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>
                          {bk.total_downloads || 0} downloads
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  </div>
                ));
              })()}

              {/* 2. Students Drilldown */}
              {activeAnalyticsDrilldown === 'students' && (() => {
                const list = (dashboardData.drilldowns?.students || [])
                  .filter(s => s.status === 'approved')
                  .filter(s => {
                    const q = drilldownSearch.toLowerCase().trim();
                    if (!q) return true;
                    const haystack = [
                      s.full_name || '',
                      s.roll_number || '',
                      s.email || '',
                      s.branch_name || '',
                      s.username || '',
                      s.bt_number || ''
                    ].join(' ').toLowerCase();
                    const words = q.split(/\s+/).filter(Boolean);
                    return words.every(w => haystack.includes(w));
                  });

                if (list.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                      <p style={{ fontStyle: 'italic' }}>No approved students matching "{drilldownSearch}"</p>
                    </div>
                  );
                }

                return list.map(st => (
                  <div
                    key={st.id}
                    onClick={() => setSelectedStudentForActivity(students.find(s => s.id === st.id) || st)}
                    className="glass-panel glass-panel-hover drilldown-card-item"
                    style={{
                      padding: 'clamp(12px, 2.5vw, 16px)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'clamp(10px, 2.5vw, 16px)',
                      cursor: 'pointer',
                      borderRadius: '12px',
                      flexShrink: 0,
                      minHeight: 'fit-content',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                    title="Click to inspect student profile and reading logs"
                  >
                    {st.avatar_url ? (
                      <img
                        src={st.avatar_url}
                        alt={st.full_name || st.username || 'Student'}
                        referrerPolicy="no-referrer"
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          objectFit: 'cover',
                          border: '1px solid var(--border-glass)',
                          flexShrink: 0
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
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: 'rgba(59, 130, 246, 0.12)',
                      color: 'var(--primary)',
                      display: st.avatar_url ? 'none' : 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1rem',
                      flexShrink: 0
                    }}>
                      {(st.full_name || st.username || 'S')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <h4 style={{
                          fontSize: 'clamp(0.88rem, 2.5vw, 0.96rem)',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          margin: 0,
                          lineHeight: 1.3,
                          wordBreak: 'break-word',
                          whiteSpace: 'normal'
                        }}>
                          {st.full_name || st.username}
                        </h4>
                        <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Approved</span>
                      </div>
                      <p style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        margin: '0 0 6px 0',
                        lineHeight: 1.35,
                        wordBreak: 'break-word'
                      }}>
                        Roll: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{st.roll_number || 'N/A'}</span> • {st.branch_name || 'Engineering'}
                      </p>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>
                          {st.total_reviews || 0} page reviews
                        </span>
                        <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>
                          {st.unique_books_read || 0} unique books
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  </div>
                ));
              })()}

              {/* 3. Views Drilldown */}
              {activeAnalyticsDrilldown === 'views' && (() => {
                const list = (dashboardData.drilldowns?.views || []).filter(v => {
                  const q = drilldownSearch.toLowerCase().trim();
                  if (!q) return true;
                  const haystack = [
                    v.user_name || '',
                    v.roll_number || '',
                    v.book_title || '',
                    v.branch_name || ''
                  ].join(' ').toLowerCase();
                  const words = q.split(/\s+/).filter(Boolean);
                  return words.every(w => haystack.includes(w));
                });

                if (list.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      <FileText size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                      <p style={{ fontStyle: 'italic' }}>No view logs matching "{drilldownSearch}"</p>
                    </div>
                  );
                }

                return list.map(v => (
                  <div
                    key={v.id}
                    className="glass-panel drilldown-card-item"
                    style={{
                      padding: 'clamp(12px, 2vw, 16px)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      borderRadius: '12px',
                      flexShrink: 0,
                      minHeight: 'fit-content',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={13} />
                        <span>{new Date(v.created_at).toLocaleString()}</span>
                      </div>
                      <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>View / Read</span>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '10px',
                      alignItems: 'start'
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '2px' }}>Reader:</div>
                        <button
                          onClick={() => setSelectedStudentForActivity(students.find(s => s.id === v.user_id) || { id: v.user_id, full_name: v.user_name, roll_number: v.roll_number, branch_name: v.branch_name })}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--secondary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.88rem',
                            padding: 0,
                            textAlign: 'left',
                            wordBreak: 'break-word',
                            lineHeight: 1.3
                          }}
                        >
                          {v.user_name} ({v.roll_number})
                        </button>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '2px' }}>Book Accessed:</div>
                        <button
                          onClick={() => setSelectedBookForActivity(books.find(b => b.id === v.book_id) || { id: v.book_id, title: v.book_title, author: v.book_author, cover_url: v.cover_url })}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.88rem',
                            padding: 0,
                            textAlign: 'left',
                            wordBreak: 'break-word',
                            lineHeight: 1.3
                          }}
                        >
                          "{v.book_title}"
                        </button>
                      </div>
                    </div>
                  </div>
                ));
              })()}

              {/* 4. Downloads Drilldown */}
              {activeAnalyticsDrilldown === 'downloads' && (() => {
                const list = (dashboardData.drilldowns?.downloads || []).filter(d => {
                  const q = drilldownSearch.toLowerCase().trim();
                  if (!q) return true;
                  const haystack = [
                    d.user_name || '',
                    d.roll_number || '',
                    d.book_title || '',
                    d.branch_name || ''
                  ].join(' ').toLowerCase();
                  const words = q.split(/\s+/).filter(Boolean);
                  return words.every(w => haystack.includes(w));
                });

                if (list.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      <Download size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                      <p style={{ fontStyle: 'italic' }}>No download logs matching "{drilldownSearch}"</p>
                    </div>
                  );
                }

                return list.map(d => (
                  <div
                    key={d.id}
                    className="glass-panel drilldown-card-item"
                    style={{
                      padding: 'clamp(12px, 2vw, 16px)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      borderRadius: '12px',
                      flexShrink: 0,
                      minHeight: 'fit-content',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={13} />
                        <span>{new Date(d.created_at).toLocaleString()}</span>
                      </div>
                      <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Download</span>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '10px',
                      alignItems: 'start'
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '2px' }}>Downloaded By:</div>
                        <button
                          onClick={() => setSelectedStudentForActivity(students.find(s => s.id === d.user_id) || { id: d.user_id, full_name: d.user_name, roll_number: d.roll_number, branch_name: d.branch_name })}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--secondary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.88rem',
                            padding: 0,
                            textAlign: 'left',
                            wordBreak: 'break-word',
                            lineHeight: 1.3
                          }}
                        >
                          {d.user_name} ({d.roll_number})
                        </button>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '2px' }}>Book Downloaded:</div>
                        <button
                          onClick={() => setSelectedBookForActivity(books.find(b => b.id === d.book_id) || { id: d.book_id, title: d.book_title, author: d.book_author, cover_url: d.cover_url })}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.88rem',
                            padding: 0,
                            textAlign: 'left',
                            wordBreak: 'break-word',
                            lineHeight: 1.3
                          }}
                        >
                          "{d.book_title}"
                        </button>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Drawer Footer */}
            <div
              className="admin-drilldown-footer"
              style={{
                padding: 'clamp(12px, 2.5vw, 16px) clamp(14px, 3vw, 22px)',
                paddingBottom: 'max(16px, calc(env(safe-area-inset-bottom, 16px) + 8px))',
                borderTop: '1px solid var(--border-glass)',
                background: 'var(--modal-card-bg, rgba(255,255,255,0.02))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                flexShrink: 0
              }}
            >
              <span style={{ fontSize: 'clamp(0.72rem, 2vw, 0.82rem)', wordBreak: 'break-word' }}>
                100% Authoritative Supabase Records
              </span>
              <button
                onClick={() => {
                  setActiveAnalyticsDrilldown(null);
                  setDrilldownSearch('');
                }}
                className="btn btn-secondary"
                style={{
                  padding: '8px 20px',
                  fontSize: '0.84rem',
                  minHeight: '40px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Activity History Modal */}
      {selectedStudentForActivity && (
        <StudentActivityModal
          student={selectedStudentForActivity}
          onClose={() => setSelectedStudentForActivity(null)}
          onToggleBlock={(id, blockStatus) => {
            handleToggleBlock(id, blockStatus);
            setSelectedStudentForActivity(prev => prev ? { ...prev, is_blocked: blockStatus ? 1 : 0 } : null);
          }}
          onSelectBook={(bk) => {
            setSelectedBookForActivity(bk);
          }}
        />
      )}

      {/* Book Activity Monitoring Modal */}
      {selectedBookForActivity && (
        <BookActivityModal
          book={selectedBookForActivity}
          onClose={() => setSelectedBookForActivity(null)}
          onSelectStudent={(st) => {
            setSelectedStudentForActivity(st);
          }}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
