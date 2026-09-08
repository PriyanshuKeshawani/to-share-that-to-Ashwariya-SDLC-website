/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Extract Google Drive file ID from a wide variety of Drive URL formats
const extractDriveFileId = (input) => {
  if (!input) return { id: null, embed: null };
  const raw = String(input).trim();
  if (!raw) return { id: null, embed: null };
  if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) {
    return { id: raw, embed: `https://drive.google.com/file/d/${raw}/preview` };
  }
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m && m[1]) {
      return { id: m[1], embed: `https://drive.google.com/file/d/${m[1]}/preview` };
    }
  }
  return { id: null, embed: raw };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('lib_custom_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem('lib_custom_user');
    } catch {
      return true;
    }
  });
  const [needsProfile, setNeedsProfile] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);

  const clearSession = () => {
    localStorage.removeItem('lib_custom_user');
    setUser(null);
    setSession(null);
    setNeedsProfile(false);
    setPendingGoogleUser(null);
  };

  const apiCall = useCallback(async (endpoint, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};

    // 1. Branches
    if (endpoint === '/auth/branches' || endpoint === '/books/branches') {
      const { data, error } = await supabase.from('branches').select('*').order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    }

    // 2. Categories
    if (endpoint === '/books/categories') {
      const { data, error } = await supabase.from('categories').select('*, parent:parent_category_id(name)');
      if (error) throw error;
      return (data || []).map(c => ({ ...c, parent_name: c.parent ? c.parent.name : null }));
    }

    // 3. Books
    if (endpoint === '/books' && method === 'GET') {
      const { data, error } = await supabase.from('books').select(`
        *,
        category:category_id(name),
        branch:branch_id(name)
      `).order('created_at', { ascending: false });
      if (error) throw error;

      let approvedBookIds = [];
      if (user && user.role === 'student') {
        try {
          const { data: perms } = await supabase
            .from('permissions')
            .select('book_id')
            .eq('user_id', user.id)
            .eq('status', 'approved');
          approvedBookIds = (perms || []).map(p => p.book_id).filter(Boolean);
        } catch {}

        const localPerms = JSON.parse(localStorage.getItem('sistec_demo_permissions') || '[]');
        const userLocalApproved = localPerms
          .filter(p => p.user_id === user.id && p.status === 'approved' && p.book_id != null)
          .map(p => p.book_id);
        approvedBookIds = [...new Set([...approvedBookIds, ...userLocalApproved])];
      }

      return (data || []).map(b => {
        const branchName = b.branch ? b.branch.name : null;
        const userBranch = (user?.branchName || user?.branch_name || '').trim().toLowerCase();
        const bookBranch = (branchName || '').trim().toLowerCase();

        let hasAccess = true;
        if (user && user.role === 'student') {
          const isHomeBranch = Boolean(userBranch && bookBranch && userBranch === bookBranch);
          const isBookApproved = approvedBookIds.some(bId => String(bId) === String(b.id));
          hasAccess = isHomeBranch || isBookApproved;
        }

        return {
          ...b,
          category_name: b.category ? b.category.name : null,
          branch_name: branchName,
          hasAccess
        };
      });
    }

    // Create or update book (FormData OR plain JSON)
    if (endpoint === '/books' || (endpoint.startsWith('/books/') && (method === 'POST' || method === 'PUT'))) {
      let payload;

      if (options.body instanceof FormData) {
        const formData = options.body;
        payload = {
          title: formData.get('title') || '',
          author: formData.get('author') || '',
          category_id: formData.get('category_id') ? parseInt(formData.get('category_id'), 10) : null,
          branch_id: formData.get('branch_id') ? parseInt(formData.get('branch_id'), 10) : null,
          priority: formData.get('priority') || 'main',
          description: formData.get('description') || null,
          cover_url: formData.get('cover_url') || null,
          drive_link: formData.get('drive_link') || null
        };
        const { id: driveId } = extractDriveFileId(payload.drive_link);
        if (driveId) payload.drive_file_id = driveId;

        const pdfFile = formData.get('pdf');
        if (pdfFile && pdfFile.name) {
          const fileName = `${Date.now()}-${pdfFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
          const { error: uploadErr } = await supabase.storage
            .from('pdfs')
            .upload(fileName, pdfFile, { upsert: true });
          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage.from('pdfs').getPublicUrl(fileName);
            payload.pdf_url = publicUrlData ? publicUrlData.publicUrl : null;
          } else {
            console.warn('Storage upload notice:', uploadErr.message);
            if (pdfFile.size <= 8 * 1024 * 1024) {
              payload.pdf_url = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = (e) => reject(e);
                reader.readAsDataURL(pdfFile);
              }).catch(() => null);
            }
          }
        }
      } else {
        payload = { ...body };
        if (payload.drive_link) {
          const { id: driveId } = extractDriveFileId(payload.drive_link);
          if (driveId) payload.drive_file_id = driveId;
        }
      }

      // Strip empties for cleaner DB
      Object.keys(payload).forEach(k => {
        if (payload[k] === '' || payload[k] === undefined) delete payload[k];
      });

      if (endpoint.startsWith('/books/') && method === 'PUT') {
        const bookId = endpoint.split('/').pop();
        const { data, error } = await supabase.from('books').update(payload).eq('id', bookId).select().single();
        if (error) throw error;
        return { message: 'Book updated successfully', data };
      }
      const { data, error } = await supabase.from('books').insert([payload]).select().single();
      if (error) throw error;
      return { message: 'Book created successfully', data };
    }

    // Delete single book
    if (endpoint.startsWith('/books/') && method === 'DELETE') {
      const bookId = endpoint.split('/').pop();
      const { error } = await supabase.from('books').delete().eq('id', bookId);
      if (error) throw error;
      return { message: 'Book deleted successfully' };
    }

    // Bulk delete books
    if (endpoint === '/books/bulk-delete' && method === 'POST') {
      const { bookIds } = body;
      const { error } = await supabase.from('books').delete().in('id', bookIds);
      if (error) throw error;
      return { message: 'Selected books deleted successfully' };
    }

    // Book readers & activity monitoring (overall and per-student)
    if (endpoint.startsWith('/books/') && endpoint.endsWith('/activity') && method === 'GET') {
      const bookId = Number(endpoint.split('/')[2]);

      let bookData = null;
      try {
        const { data: bData } = await supabase
          .from('books')
          .select('*, category:category_id(name), branch:branch_id(name)')
          .eq('id', bookId)
          .maybeSingle();
        bookData = bData;
      } catch (e) {
        console.warn('Notice fetching book info:', e);
      }

      if (!bookData) {
        try {
          const localBooks = JSON.parse(localStorage.getItem('sistec_demo_books') || '[]');
          bookData = localBooks.find(b => b.id === bookId);
        } catch (e) {}
      }

      let readers = [];
      try {
        const { data: progData } = await supabase
          .from('user_book_progress')
          .select(`
            id,
            user_id,
            book_id,
            last_page_read,
            accessed_count,
            downloaded_count,
            is_downloaded,
            last_accessed_at,
            user:user_id(id, full_name, username, roll_number, branch_name, year, semester, avatar_url)
          `)
          .eq('book_id', bookId)
          .order('last_accessed_at', { ascending: false });

        if (progData) readers = progData;
      } catch (e) {
        console.warn('Notice fetching progress for book:', e);
      }

      // Merge local demo progress if available
      try {
        const localKey = 'sistec_demo_book_progress';
        const stored = JSON.parse(localStorage.getItem(localKey) || '[]');
        const matchingLocal = stored.filter(p => Number(p.book_id) === bookId);
        for (const loc of matchingLocal) {
          const existingIdx = readers.findIndex(r => r.user_id === loc.user_id);
          if (existingIdx >= 0) {
            readers[existingIdx].last_page_read = Math.max(readers[existingIdx].last_page_read || 1, loc.last_page_read || 1);
            readers[existingIdx].accessed_count = Math.max(readers[existingIdx].accessed_count || 1, loc.accessed_count || 1);
            if (loc.is_downloaded) readers[existingIdx].is_downloaded = 1;
            readers[existingIdx].last_accessed_at = loc.last_accessed_at || readers[existingIdx].last_accessed_at;
          } else {
            readers.push(loc);
          }
        }
      } catch (e) {}

      let logs = [];
      try {
        const { data: logsData } = await supabase
          .from('activity_logs')
          .select('*, user:user_id(id, full_name, roll_number, branch_name)')
          .eq('book_id', bookId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (logsData) logs = logsData;
      } catch (e) {}

      const totalUniqueReaders = readers.length;
      const totalReadSessions = readers.reduce((acc, r) => acc + (Number(r.accessed_count) || 1), 0);
      const totalDownloads = readers.reduce((acc, r) => acc + (Number(r.downloaded_count) || (r.is_downloaded ? 1 : 0)), 0);
      const maxPageRead = readers.reduce((max, r) => Math.max(max, Number(r.last_page_read) || 1), 1);
      const avgPageRead = totalUniqueReaders > 0
        ? Math.round(readers.reduce((acc, r) => acc + (Number(r.last_page_read) || 1), 0) / totalUniqueReaders)
        : 0;

      return {
        book: bookData,
        stats: {
          totalUniqueReaders,
          totalReadSessions,
          totalDownloads,
          maxPageRead,
          avgPageRead
        },
        readers,
        logs: logs.map(l => ({
          ...l,
          student_name: l.user?.full_name || 'Student',
          roll_number: l.user?.roll_number || 'N/A',
          branch_name: l.user?.branch_name || 'N/A'
        }))
      };
    }

    // 4. Users / Students
    if (endpoint === '/auth/users') {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }

    if (endpoint === '/auth/pending-users') {
      const { data, error } = await supabase.from('users').select('*').eq('role', 'student').eq('status', 'pending').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }

    if (endpoint.startsWith('/auth/approve-user/')) {
      const userId = endpoint.split('/').pop();
      const { data, error } = await supabase.from('users').update({ status: body.status }).eq('id', userId).select().single();
      if (error) throw error;
      return { message: `User status updated to ${body.status}`, data };
    }

    if (endpoint.endsWith('/block')) {
      const parts = endpoint.split('/');
      const userId = parts[parts.length - 2];
      const { data, error } = await supabase.from('users').update({ is_blocked: 1 }).eq('id', userId).select().single();
      if (error) throw error;
      return { message: 'User blocked', data };
    }

    if (endpoint.endsWith('/unblock')) {
      const parts = endpoint.split('/');
      const userId = parts[parts.length - 2];
      const { data, error } = await supabase.from('users').update({ is_blocked: 0 }).eq('id', userId).select().single();
      if (error) throw error;
      return { message: 'User unblocked', data };
    }

    if (endpoint.startsWith('/auth/users/') && method === 'DELETE') {
      const userId = endpoint.split('/').pop();
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
      return { message: 'User deleted' };
    }

    if (endpoint === '/auth/users/bulk-delete') {
      const { userIds } = body;
      const { error } = await supabase.from('users').delete().in('id', userIds);
      if (error) throw error;
      return { message: 'Users deleted successfully' };
    }

    // 5. Student activity (comprehensive ebook monitoring)
    if (endpoint.startsWith('/students/') && endpoint.endsWith('/activity') && method === 'GET') {
      const studentId = endpoint.split('/')[2];
      const [
        { data: studentUser },
        { data: rawBookProgress },
        { data: permissionsData },
        { data: activityLogs }
      ] = await Promise.all([
        supabase.from('users').select('*').eq('id', studentId).maybeSingle(),
        supabase.from('user_book_progress').select(`
          *,
          book:book_id(id, title, author, category:category_id(name), branch:branch_id(name))
        `).eq('user_id', studentId).order('last_accessed_at', { ascending: false }),
        supabase.from('permissions').select('*, branch:branch_id(name), book:book_id(title)').eq('user_id', studentId).order('created_at', { ascending: false }),
        supabase.from('activity_logs').select('*, book:book_id(title)').eq('user_id', studentId).order('created_at', { ascending: false }).limit(50)
      ]);

      let bookProgress = rawBookProgress ? [...rawBookProgress] : [];

      // Merge local progress for demo or offline activity
      try {
        const localKey = 'sistec_demo_book_progress';
        const stored = JSON.parse(localStorage.getItem(localKey) || '[]');
        const matchingLocal = stored.filter(p => p.user_id === studentId);
        for (const loc of matchingLocal) {
          const existingIdx = bookProgress.findIndex(r => Number(r.book_id) === Number(loc.book_id));
          if (existingIdx >= 0) {
            bookProgress[existingIdx].last_page_read = Math.max(bookProgress[existingIdx].last_page_read || 1, loc.last_page_read || 1);
            bookProgress[existingIdx].accessed_count = Math.max(bookProgress[existingIdx].accessed_count || 1, loc.accessed_count || 1);
            if (loc.is_downloaded) bookProgress[existingIdx].is_downloaded = 1;
          } else {
            bookProgress.push(loc);
          }
        }
      } catch (e) {}

      const totalReads = bookProgress.reduce((sum, b) => sum + (Number(b.accessed_count) || 1), 0);
      const totalDownloads = bookProgress.reduce((sum, b) => sum + (Number(b.downloaded_count) || (b.is_downloaded ? 1 : 0)), 0);

      return {
        student: studentUser,
        stats: {
          eBooksRead: bookProgress.length,
          totalReadingSessions: totalReads,
          totalDownloads: totalDownloads,
          totalAccessRequests: (permissionsData || []).length
        },
        bookProgress: bookProgress,
        permissions: permissionsData || [],
        logs: activityLogs || []
      };
    }

    // 6. Permissions
    if (endpoint === '/permissions/pending-requests') {
      let serverRequests = [];
      try {
        const { data, error } = await supabase
          .from('permissions')
          .select('*, user:user_id(full_name, roll_number, branch_name), branch:branch_id(name), book:book_id(title)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (!error && data) serverRequests = data;
      } catch (e) {
        console.warn('Notice loading server permissions:', e);
      }

      const { data: allBranches } = await supabase.from('branches').select('id, name');
      const branchMap = new Map((allBranches || []).map(b => [b.id, b.name]));

      const { data: allBooks } = await supabase.from('books').select('id, title, branch_id');
      const bookMap = new Map((allBooks || []).map(b => [b.id, b.title]));

      const localPerms = JSON.parse(localStorage.getItem('sistec_demo_permissions') || '[]').filter(p => p.status === 'pending');

      const enrichedLocal = localPerms.map(p => ({
        ...p,
        full_name: p.full_name || 'Student',
        roll_number: p.roll_number || 'N/A',
        student_branch: p.student_branch || 'Engineering',
        book_title: p.book_title || (p.book_id ? bookMap.get(p.book_id) : null) || 'Requested Book',
        requested_branch_name: p.requested_branch_name || branchMap.get(p.branch_id) || 'Requested Branch'
      }));

      const combined = [...serverRequests, ...enrichedLocal];
      return combined.map(p => ({
        ...p,
        full_name: p.user ? p.user.full_name : (p.full_name || 'Student'),
        roll_number: p.user ? p.user.roll_number : (p.roll_number || 'N/A'),
        student_branch: p.user ? p.user.branch_name : (p.student_branch || 'Engineering'),
        book_id: p.book_id,
        book_title: p.book_title || (p.book_id ? bookMap.get(p.book_id) : null) || 'Book Access',
        requested_branch_name: p.branch ? p.branch.name : (p.requested_branch_name || branchMap.get(p.branch_id) || 'Branch')
      }));
    }

    if (endpoint === '/permissions/my-requests') {
      if (!user) return [];
      let serverRequests = [];
      try {
        const { data, error } = await supabase.from('permissions').select('*, branch:branch_id(name), book:book_id(title)').eq('user_id', user.id);
        if (!error && data) serverRequests = data;
      } catch (e) {
        console.warn('Notice loading my permissions:', e);
      }

      const localPerms = JSON.parse(localStorage.getItem('sistec_demo_permissions') || '[]');
      const userLocal = localPerms.filter(p => p.user_id === user.id);

      const { data: allBranches } = await supabase.from('branches').select('id, name');
      const branchMap = new Map((allBranches || []).map(b => [b.id, b.name]));

      const { data: allBooks } = await supabase.from('books').select('id, title');
      const bookMap = new Map((allBooks || []).map(b => [b.id, b.title]));

      const combined = [...serverRequests, ...userLocal];
      const unique = [];
      const seen = new Set();
      for (const req of combined) {
        const key = req.book_id ? `book-${req.book_id}` : `branch-${req.branch_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push({
            ...req,
            book_id: req.book_id,
            book_title: req.book_title || (req.book_id ? bookMap.get(req.book_id) : null) || 'Book',
            branch_name: req.branch ? req.branch.name : (branchMap.get(req.branch_id) || 'Branch')
          });
        }
      }
      return unique;
    }

    if (endpoint.startsWith('/permissions/action/') || endpoint.startsWith('/permissions/approve/')) {
      const permId = endpoint.split('/').pop();
      if (permId.startsWith('demo-perm-')) {
        const localPerms = JSON.parse(localStorage.getItem('sistec_demo_permissions') || '[]');
        const updated = localPerms.map(p => p.id === permId ? { ...p, status: body.status } : p);
        localStorage.setItem('sistec_demo_permissions', JSON.stringify(updated));
        return { message: `Permission ${body.status}`, data: { id: permId, status: body.status } };
      }
      const { data, error } = await supabase.from('permissions').update({ status: body.status }).eq('id', permId).select().single();
      if (error) throw error;

      if (data && data.user_id) {
        try {
          const isApproved = body.status === 'approved';
          await supabase.from('notifications').insert([{
            user_id: data.user_id,
            title: isApproved ? 'Book Access Granted' : 'Book Access Denied',
            message: isApproved
              ? 'Administrator granted your request to read this book.'
              : 'Administrator declined your request to read this book.',
            type: isApproved ? 'approval' : 'warning'
          }]);
        } catch (notifErr) {
          console.warn('Permission notification note:', notifErr.message);
        }
      }
      return { message: `Permission ${body.status}`, data };
    }

    if (endpoint === '/permissions/request' && method === 'POST') {
      const branchId = parseInt(body.branchId || body.branch_id, 10);
      const bookId = body.book_id || body.bookId ? parseInt(body.book_id || body.bookId, 10) : null;
      const bookTitle = body.book_title || body.bookTitle || '';
      const branchName = body.branch_name || body.branchName || '';

      let effectiveUserId = user?.id;
      if (user?.id) {
        const { data: userRow } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle();
        if (!userRow) {
          const { data: anyStudent } = await supabase.from('users').select('id').eq('role', 'student').limit(1).maybeSingle();
          if (anyStudent) effectiveUserId = anyStudent.id;
        }
      }

      let existing = null;
      if (effectiveUserId && bookId) {
        try {
          const { data: ex } = await supabase
            .from('permissions')
            .select('id, status')
            .eq('user_id', effectiveUserId)
            .eq('book_id', bookId)
            .maybeSingle();
          existing = ex;
        } catch {}
      }

      const localPerms = JSON.parse(localStorage.getItem('sistec_demo_permissions') || '[]');
      const localExisting = localPerms.find(p =>
        (bookId != null && p.book_id === bookId && (p.user_id === user?.id || p.user_id === effectiveUserId))
      );

      if (existing || localExisting) {
        const currentStatus = existing?.status || localExisting?.status;
        if (currentStatus === 'pending') {
          throw new Error(`You already have a pending request for "${bookTitle || 'this book'}"`);
        }
        if (existing) {
          const { data, error } = await supabase
            .from('permissions')
            .update({ status: 'pending' })
            .eq('id', existing.id)
            .select()
            .single();
          if (!error && data) return data;
        }
      }

      let insertErr = null;
      if (effectiveUserId) {
        try {
          const insertPayload = {
            user_id: effectiveUserId,
            branch_id: branchId,
            status: 'pending'
          };
          if (bookId) insertPayload.book_id = bookId;

          const { data, error } = await supabase.from('permissions').insert([insertPayload]).select().single();
          if (!error && data) return data;
          insertErr = error;
        } catch (e) {
          insertErr = e;
        }
      }

      console.warn('Saved book permission in local storage fallback:', insertErr?.message);
      const demoPerm = {
        id: `demo-perm-${Date.now()}`,
        user_id: user?.id || 'demo-student',
        full_name: user?.fullName || 'Student',
        roll_number: user?.rollNumber || 'N/A',
        student_branch: user?.branchName || 'Engineering',
        branch_id: branchId,
        book_id: bookId,
        book_title: bookTitle,
        requested_branch_name: branchName,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      localPerms.push(demoPerm);
      localStorage.setItem('sistec_demo_permissions', JSON.stringify(localPerms));
      return demoPerm;
    }

    // 7. Notifications
    if (endpoint === '/notifications' && method === 'GET') {
      if (!user) return [];
      const { data, error } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    }

    if (endpoint === '/notifications/unread-count' && method === 'GET') {
      if (!user) return { count: 0 };
      const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
      if (error) throw error;
      return { count: count || 0 };
    }

    if (endpoint === '/notifications/mark-read' && method === 'POST') {
      if (!user) return null;
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      if (error) throw error;
      return { message: 'Notifications marked as read' };
    }

    // 8. Analytics & Logs (real-time progress + audit logs)
    if (endpoint === '/analytics/track' && method === 'POST') {
      if (!user) return null;
      const targetBookId = Number(body.bookId || body.book_id) || null;
      const actionType = body.actionType || body.action_type || 'view';
      const pageRead = Math.max(1, parseInt(body.last_page_read || body.lastPageRead || 1, 10));
      const details = body.details || (actionType === 'download' ? 'Downloaded eBook' : `Read up to page ${pageRead}`);

      let logData = null;
      try {
        const { data, error } = await supabase.from('activity_logs').insert([{
          user_id: user.id,
          book_id: targetBookId,
          action_type: actionType,
          details: details
        }]).select().single();
        if (!error) logData = data;
      } catch (err) {
        console.warn('Notice writing activity_logs:', err);
      }

      // Upsert user_book_progress
      if (targetBookId) {
        const nowIso = new Date().toISOString();
        try {
          const { data: existing } = await supabase
            .from('user_book_progress')
            .select('*')
            .eq('user_id', user.id)
            .eq('book_id', targetBookId)
            .maybeSingle();

          if (existing) {
            const updatedPage = Math.max(existing.last_page_read || 1, pageRead);
            const isDl = actionType === 'download' ? 1 : (existing.is_downloaded || 0);
            const dlCount = actionType === 'download' ? ((existing.downloaded_count || 0) + 1) : (existing.downloaded_count || 0);

            await supabase
              .from('user_book_progress')
              .update({
                last_page_read: updatedPage,
                accessed_count: (existing.accessed_count || 0) + (actionType === 'view' ? 1 : 0),
                is_downloaded: isDl,
                downloaded_count: dlCount,
                last_accessed_at: nowIso
              })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('user_book_progress')
              .insert([{
                user_id: user.id,
                book_id: targetBookId,
                last_page_read: pageRead,
                accessed_count: 1,
                is_downloaded: actionType === 'download' ? 1 : 0,
                downloaded_count: actionType === 'download' ? 1 : 0,
                last_accessed_at: nowIso
              }]);
          }
        } catch (progErr) {
          console.warn('Notice updating user_book_progress in Supabase:', progErr);
        }

        // Also persist to localStorage for bypass/demo mode
        try {
          const localKey = 'sistec_demo_book_progress';
          const stored = JSON.parse(localStorage.getItem(localKey) || '[]');
          const idx = stored.findIndex(p => p.user_id === user.id && Number(p.book_id) === targetBookId);
          if (idx >= 0) {
            stored[idx].last_page_read = Math.max(stored[idx].last_page_read || 1, pageRead);
            stored[idx].accessed_count = (stored[idx].accessed_count || 0) + (actionType === 'view' ? 1 : 0);
            if (actionType === 'download') {
              stored[idx].is_downloaded = 1;
              stored[idx].downloaded_count = (stored[idx].downloaded_count || 0) + 1;
            }
            stored[idx].last_accessed_at = nowIso;
          } else {
            stored.push({
              id: Date.now(),
              user_id: user.id,
              book_id: targetBookId,
              last_page_read: pageRead,
              accessed_count: 1,
              is_downloaded: actionType === 'download' ? 1 : 0,
              downloaded_count: actionType === 'download' ? 1 : 0,
              last_accessed_at: nowIso,
              user: {
                id: user.id,
                full_name: user.fullName || user.full_name || 'Student',
                username: user.username || 'student',
                roll_number: user.rollNumber || user.roll_number || 'N/A',
                branch_name: user.branchName || user.branch_name || 'CSE',
                year: user.year || '3rd Year',
                semester: user.semester || '6th Sem',
                avatar_url: user.avatarUrl || null
              }
            });
          }
          localStorage.setItem(localKey, JSON.stringify(stored));
        } catch (lsErr) {
          console.warn('Failed local progress sync:', lsErr);
        }
      }

      return logData || { message: 'Tracked successfully' };
    }

    if (endpoint === '/analytics/dashboard') {
      const [{ count: totalStudents }, { count: totalBooks }, { count: totalDownloads }, { count: totalViews }, { count: totalLogins }, { count: totalLogouts }] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('books').select('*', { count: 'exact', head: true }),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('action_type', 'download'),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('action_type', 'view'),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('action_type', 'login'),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('action_type', 'logout')
      ]);

      const { data: logsData } = await supabase.from('activity_logs').select('*, user:user_id(full_name, role, roll_number), book:book_id(title)').order('created_at', { ascending: false }).limit(10);

      return {
        stats: {
          logins: totalLogins || 0,
          logouts: totalLogouts || 0,
          downloads: totalDownloads || 0,
          views: totalViews || 0,
          books: totalBooks || 0,
          students: totalStudents || 0
        },
        mostReadPerBranch: [],
        bestBook: null,
        topUser: null,
        activityLogs: (logsData || []).map(l => ({
          ...l,
          full_name: l.user ? l.user.full_name : null,
          role: l.user ? l.user.role : null,
          roll_number: l.user ? l.user.roll_number : null,
          book_title: l.book ? l.book.title : null
        })),
        branchPerformance: []
      };
    }

    if (endpoint === '/analytics/my-history') {
      if (!user) return [];
      const { data, error } = await supabase.from('activity_logs').select('*, book:book_id(title, author)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return (data || []).map(l => ({
        ...l,
        book_title: l.book ? l.book.title : null,
        book_author: l.book ? l.book.author : null
      }));
    }

    if (endpoint.startsWith('/analytics/logs')) {
      const { data, error, count } = await supabase.from('activity_logs').select('*, user:user_id(full_name, role), book:book_id(title)', { count: 'exact' }).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return {
        logs: (data || []).map(l => ({
          ...l,
          user_name: l.user ? l.user.full_name : null,
          user_role: l.user ? l.user.role : null,
          book_title: l.book ? l.book.title : null
        })),
        pagination: { page: 1, limit: 50, total: count || 0, totalPages: 1 }
      };
    }

    return [];
  }, [user]);

  const bypassLogin = (role = 'admin') => {
    const mockUser = role === 'admin' ? {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'admin',
      fullName: 'System Administrator',
      role: 'admin',
      status: 'approved',
      branchName: 'Central Library',
      rollNumber: 'ADMIN-01',
      year: 'Faculty/Staff',
      semester: 'N/A',
      btNumber: 'BT-ADMIN',
      authProvider: 'bypass',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'
    } : {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'student_cs',
      fullName: 'Demo Student (CS)',
      role: 'student',
      status: 'approved',
      branchName: 'Computer Science and Engineering',
      rollNumber: '0187CS211001',
      year: '3rd Year',
      semester: '6th Semester',
      btNumber: 'BT-1029',
      authProvider: 'bypass',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priyanshu'
    };

    localStorage.setItem('lib_custom_user', JSON.stringify(mockUser));
    setUser(mockUser);
    setNeedsProfile(false);
    setPendingGoogleUser(null);
    setLoading(false);
    return mockUser;
  };

  const loadUser = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent && !localStorage.getItem('lib_custom_user')) {
        setLoading(true);
      }

      const savedUserStr = localStorage.getItem('lib_custom_user');
      if (savedUserStr) {
        try {
          const savedUser = JSON.parse(savedUserStr);
          if (savedUser && (savedUser.authProvider === 'credentials' || savedUser.role === 'admin' || savedUser.authProvider === 'bypass')) {
            setUser(savedUser);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Failed parsing cached user', e);
        }
      }

      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !currentSession) {
        if (!savedUserStr) clearSession();
        setLoading(false);
        return;
      }

      setSession(currentSession);
      const authUserId = currentSession.user.id;

      const isGoogleUser =
        currentSession.user.app_metadata?.provider === 'google' ||
        (Array.isArray(currentSession.user.app_metadata?.providers) && currentSession.user.app_metadata.providers.includes('google')) ||
        (Array.isArray(currentSession.user.identities) && currentSession.user.identities.some(i => i.provider === 'google')) ||
        currentSession.user.email?.endsWith('@gmail.com');

      const { data, error } = await supabase
        .from('users')
        .select('id, username, full_name, roll_number, branch_name, year, semester, bt_number, role, status, is_blocked, auth_provider, avatar_url')
        .eq('id', authUserId)
        .maybeSingle();

      if (!error && data) {
        if (data.is_blocked === 1) {
          await supabase.auth.signOut();
          clearSession();
          return;
        }

        const formatted = {
          id: data.id,
          username: data.username,
          fullName: data.full_name,
          role: data.role,
          status: data.status,
          branchName: data.branch_name,
          rollNumber: data.roll_number,
          year: data.year,
          semester: data.semester,
          btNumber: data.bt_number,
          authProvider: data.auth_provider,
          avatarUrl: data.avatar_url || (isGoogleUser ? (currentSession.user.user_metadata?.avatar_url || currentSession.user.user_metadata?.picture) : null)
        };
        setUser(formatted);
        localStorage.setItem('lib_custom_user', JSON.stringify(formatted));
        setNeedsProfile(false);
      } else if (isGoogleUser) {
        setPendingGoogleUser(currentSession.user);
        setNeedsProfile(true);
      } else {
        await supabase.auth.signOut();
        clearSession();
      }
    } catch (err) {
      console.warn('Error restoring session:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser(true);

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === 'SIGNED_OUT') {
        clearSession();
      } else if (event === 'SIGNED_IN') {
        loadUser(true);
      } else if (event === 'TOKEN_REFRESHED') {
        if (currentSession) setSession(currentSession);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [loadUser]);

  const login = async (identifier, password) => {
    const trimmedId = (identifier || '').trim();
    const trimmedPass = (password || '').trim();
    const idLower = trimmedId.toLowerCase();

    const isAdminCandidate =
      idLower === 'sistec.library@sistec.ac.in' ||
      idLower === 'admin' ||
      idLower === 'sistec.library';

    if (isAdminCandidate) {
      if (trimmedPass !== 'Kalpana2680#') {
        throw new Error('Invalid password for Institutional Central Library Administrator.');
      }

      let adminId = '0271446c-5515-4406-9c4d-19fe5d4e9c9a';
      try {
        const { data: dbAdmin } = await supabase
          .from('users')
          .select('id, full_name, avatar_url')
          .eq('role', 'admin')
          .limit(1)
          .maybeSingle();
        if (dbAdmin) adminId = dbAdmin.id;
      } catch (e) {
        console.warn('DB admin check note:', e);
      }

      const adminUser = {
        id: adminId,
        username: 'sistec.library@sistec.ac.in',
        email: 'Sistec.library@sistec.ac.in',
        fullName: 'Central Library Administrator',
        role: 'admin',
        status: 'approved',
        branchName: 'Central Library',
        rollNumber: 'ADMIN-SISTEC',
        year: 'Faculty/Staff',
        semester: 'N/A',
        btNumber: 'BT-ADMIN-01',
        authProvider: 'credentials',
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=SISTecAdmin'
      };

      localStorage.setItem('lib_custom_user', JSON.stringify(adminUser));
      setUser(adminUser);
      setNeedsProfile(false);
      setPendingGoogleUser(null);
      setLoading(false);

      try {
        await supabase.from('activity_logs').insert([{
          action_type: 'login',
          details: 'Official Central Library Administrator logged in securely'
        }]);
      } catch {}

      return adminUser;
    }

    if (idLower === 'sistec.library@sistec.ac.in' || idLower === 'admin' || idLower === 'sistec.library') {
      throw new Error('Invalid password for Institutional Administrator.');
    }

    const authEmail = trimmedId.includes('@') ? idLower : `${idLower}@sistec.local`;

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: trimmedPass
    });

    if (authError || !authData.user) {
      throw new Error('Invalid email/username or password. Please verify your credentials.');
    }

    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (userError || !userRecord) {
      await supabase.auth.signOut();
      throw new Error('User profile not found in institutional database.');
    }

    if (userRecord.is_blocked === 1) {
      await supabase.auth.signOut();
      throw new Error('Your library access has been restricted by the administrator.');
    }

    if (userRecord.role === 'student' && userRecord.status === 'rejected') {
      await supabase.auth.signOut();
      throw new Error('Your registration was rejected by the library administrator.');
    }

    const formattedUser = {
      id: userRecord.id,
      username: userRecord.username,
      fullName: userRecord.full_name,
      role: userRecord.role,
      status: userRecord.status,
      branchName: userRecord.branch_name,
      rollNumber: userRecord.roll_number,
      year: userRecord.year,
      semester: userRecord.semester,
      btNumber: userRecord.bt_number,
      authProvider: userRecord.auth_provider,
      avatarUrl: userRecord.avatar_url
    };

    try {
      await supabase.from('activity_logs').insert([{
        user_id: userRecord.id,
        action_type: 'login',
        details: `User ${userRecord.username} logged in securely`
      }]);
    } catch {}

    localStorage.setItem('lib_custom_user', JSON.stringify(formattedUser));
    setUser(formattedUser);

    return formattedUser;
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  };

  const completeGoogleProfile = async (profileData) => {
    if (!pendingGoogleUser) throw new Error('No pending Google user');

    const { username, fullName, rollNumber, branchName, year, semester, btNumber } = profileData;

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing && existing.id !== pendingGoogleUser.id) {
      throw new Error('Username is already taken');
    }

    const userId = pendingGoogleUser.id;
    const avatarUrl = pendingGoogleUser.user_metadata?.avatar_url || pendingGoogleUser.user_metadata?.picture || null;

    const { data, error } = await supabase.from('users').upsert([{
      id: userId,
      username,
      full_name: fullName,
      roll_number: rollNumber,
      branch_name: branchName,
      year,
      semester,
      bt_number: btNumber,
      role: 'student',
      status: 'approved',
      is_blocked: 0,
      auth_provider: 'google',
      google_id: pendingGoogleUser.id,
      avatar_url: avatarUrl
    }], { onConflict: 'id' }).select().single();

    if (error) throw new Error('Failed to create profile: ' + error.message);

    const formattedUser = {
      id: data.id,
      username: data.username,
      fullName: data.full_name,
      role: data.role,
      status: data.status,
      branchName: data.branch_name,
      rollNumber: data.roll_number,
      year: data.year,
      semester: data.semester,
      btNumber: data.bt_number,
      authProvider: data.auth_provider,
      avatarUrl: data.avatar_url
    };

    localStorage.setItem('lib_custom_user', JSON.stringify(formattedUser));
    setUser(formattedUser);
    setNeedsProfile(false);
    setPendingGoogleUser(null);

    return { message: 'Profile completed successfully! Welcome to SISTEC Library.' };
  };

  const logout = async () => {
    if (user) {
      try {
        await supabase.from('activity_logs').insert([{
          user_id: user.id,
          action_type: 'logout',
          details: 'User logged out'
        }]);
      } catch (e) {
        console.error('Logout log error:', e);
      }
    }
    await supabase.auth.signOut();
    clearSession();
  };

  const register = async (userData) => {
    const {
      username,
      password,
      fullName,
      rollNumber,
      branchName,
      year,
      semester,
      btNumber
    } = userData;

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      throw new Error('Username is already taken');
    }

    const fakeEmail = `${username.toLowerCase()}@sistec.local`;
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: fakeEmail,
      password: password,
    });

    if (authError) {
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error('Registration failed, please try again.');
    }

    const userId = authData.user.id;

    const { data, error } = await supabase.from('users').insert([{
      id: userId,
      username,
      full_name: fullName,
      roll_number: rollNumber,
      branch_name: branchName,
      year,
      semester,
      bt_number: btNumber,
      role: 'student',
      status: 'pending',
      is_blocked: 0,
      auth_provider: 'password'
    }]).select().single();

    if (error) {
      throw new Error('Failed to create user profile: ' + error.message);
    }

    await supabase.auth.signOut();

    return { message: 'Registration successful! Awaiting admin approval.', data };
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading, login, logout, register,
      loginWithGoogle, completeGoogleProfile, needsProfile,
      pendingGoogleUser, apiCall, refreshUser: loadUser,
      bypassLogin, extractDriveFileId
    }}>
      {children}
    </AuthContext.Provider>
  );
};
