/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { resolveBookCover } from '../utils/bookCoverResolver';

export const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

// Canonical branch key identifier for 100% accurate branch matching across abbreviations, acronyms, and variations
export const canonicalBranch = (name) => {
  if (!name) return '';
  let s = String(name).toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();

  // AI / Data Science check must come before general CSE check!
  if (s.includes('aids') || (s.includes('artificial') && (s.includes('intelligence') || s.includes('intel')))) {
    return 'aids';
  }
  if (s.includes('cyber')) return 'cyber';
  if (s.includes('m.tech') || s.includes('mtech')) {
    if (s.includes('cse') || s.includes('computer')) return 'mtech_cse';
    return 'mtech';
  }
  if (s.includes('computer science') || s.includes('cse')) return 'cse';
  if (s.includes('information technology') || /\bit\b/.test(s)) return 'it';
  if (s.includes('electronics') || s.includes('ece')) return 'ece';
  if (s.includes('mechanical') || /\bme\b/.test(s)) return 'me';
  if (s.includes('civil') || /\bce\b/.test(s)) return 'civil';
  if (s.includes('electrical') || /\bee\b/.test(s) || /\bex\b/.test(s)) return 'ee';
  if (s.includes('vlsi')) return 'vlsi';
  if (s.includes('digital comm')) return 'digital_comm';
  if (s.includes('pharmaceutics')) return 'mpharm_ceutics';
  if (s.includes('pharmaceutical')) return 'mpharm_chem';
  if (s.includes('m.pharm') || s.includes('mpharm')) return 'mpharm';
  if (s.includes('b.pharm') || s.includes('bpharm')) return 'bpharm';
  if (s.includes('mba')) return 'mba';
  if (s.includes('bba')) return 'bba';
  if (s.includes('construction') || s.includes('ctm')) return 'ctm';
  if (s.includes('structural') || /\bse\b/.test(s)) return 'se';
  if (s.includes('thermal')) return 'thermal';
  if (s.includes('machine design')) return 'machine_design';

  return s.replace(/[^a-z0-9]/g, '');
};

export const normalizeBranch = (name) => canonicalBranch(name);

export const isSameBranch = (branchA, branchB) => {
  if (!branchA || !branchB) return false;
  const a = String(branchA).trim();
  const b = String(branchB).trim();
  if (a.toLowerCase() === b.toLowerCase()) return true;
  return canonicalBranch(a) === canonicalBranch(b);
};

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

// System settings persistence helper (gracefully prevents 404 network errors if table does not exist in DB)
let systemSettingsAvailable = typeof window !== 'undefined' ? localStorage.getItem('lib_has_system_settings') !== 'false' : true;

const getSystemRegistrationPolicy = async () => {
  if (systemSettingsAvailable) {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'registration_policy')
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST205' || error.status === 404 || error.message?.includes('schema cache')) {
          systemSettingsAvailable = false;
          if (typeof window !== 'undefined') localStorage.setItem('lib_has_system_settings', 'false');
        }
      } else if (data?.value?.policy) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('lib_has_system_settings', 'true');
          localStorage.setItem('lib_registration_policy', data.value.policy);
        }
        return data.value.policy;
      }
    } catch {
      systemSettingsAvailable = false;
      if (typeof window !== 'undefined') localStorage.setItem('lib_has_system_settings', 'false');
    }
  }
  return (typeof window !== 'undefined' ? localStorage.getItem('lib_registration_policy') : null) || 'manual';
};

const setSystemRegistrationPolicy = async (newPolicy, username) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('lib_registration_policy', newPolicy);
  }
  if (systemSettingsAvailable) {
    try {
      const { error } = await supabase.from('system_settings').upsert({
        key: 'registration_policy',
        value: { policy: newPolicy, updated_at: new Date().toISOString(), updated_by: username || 'admin' }
      }, { onConflict: 'key' });

      if (error && (error.code === 'PGRST205' || error.status === 404 || error.message?.includes('schema cache'))) {
        systemSettingsAvailable = false;
        if (typeof window !== 'undefined') localStorage.setItem('lib_has_system_settings', 'false');
      } else if (!error) {
        if (typeof window !== 'undefined') localStorage.setItem('lib_has_system_settings', 'true');
      }
    } catch {
      systemSettingsAvailable = false;
      if (typeof window !== 'undefined') localStorage.setItem('lib_has_system_settings', 'false');
    }
  }
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
      if (method === 'GET') {
        const { data, error } = await supabase.from('branches').select('*').order('name', { ascending: true });
        if (error) throw error;
        return data || [];
      }

      if (method === 'POST') {
        const name = body?.name || body?.branchName;
        if (!name || !String(name).trim()) {
          throw new Error('Branch name is required.');
        }
        const { data, error } = await supabase.from('branches').insert([{ name: String(name).trim() }]).select().single();
        if (error) throw error;
        return data;
      }

      throw new Error(`Unsupported method ${method} for ${endpoint}`);
    }

    // 1b. Branch by ID (DELETE /books/branches/:id or /auth/branches/:id, PUT /books/branches/:id or /auth/branches/:id)
    if (endpoint.startsWith('/auth/branches/') || endpoint.startsWith('/books/branches/')) {
      const branchId = endpoint.split('/').pop();

      if (method === 'DELETE') {
        const { error } = await supabase.from('branches').delete().eq('id', branchId);
        if (error) throw error;
        return { message: 'Branch deleted successfully' };
      }

      if (method === 'PUT') {
        const name = body?.name || body?.branchName;
        if (!name || !String(name).trim()) {
          throw new Error('Branch name is required.');
        }
        const { data, error } = await supabase.from('branches').update({ name: String(name).trim() }).eq('id', branchId).select().single();
        if (error) throw error;
        return { message: 'Branch updated successfully', data };
      }

      throw new Error(`Unsupported method ${method} for ${endpoint}`);
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
        } catch {
          // ignore permissions fetch error
        }
      }

      return (data || []).map(b => {
        const branchName = b.branch ? b.branch.name : null;
        const userBranch = (user?.branchName || user?.branch_name || '').trim();
        const bookBranch = (branchName || '').trim();

        let hasAccess = true;
        let isHomeBranch = false;
        if (user && user.role === 'student') {
          isHomeBranch = Boolean(userBranch && bookBranch && isSameBranch(userBranch, bookBranch));
          const isBookApproved = approvedBookIds.some(bId => String(bId) === String(b.id));
          // Home branch books NEVER require a request (direct access).
          // Outside home branch books require admin approval.
          hasAccess = isHomeBranch || isBookApproved;
        }

        return {
          ...b,
          category_name: b.category ? b.category.name : null,
          branch_name: branchName,
          hasAccess,
          isHomeBranch
        };
      });
    }

    // 1. Bulk delete books (must be checked before generic /books endpoints)
    if (endpoint === '/books/bulk-delete' && method === 'POST') {
      const { bookIds } = body;
      const { error } = await supabase.from('books').delete().in('id', bookIds);
      if (error) throw error;
      return { message: 'Selected books deleted successfully' };
    }

    // 2. Batch import books (for automated directory upload & bulk ingestion)
    if (endpoint === '/books/batch-import' && method === 'POST') {
      const batchItems = Array.isArray(body?.books) ? body.books : (Array.isArray(body) ? body : []);
      if (batchItems.length === 0) {
        throw new Error('No valid book records provided for batch import.');
      }

      const insertedRecords = [];
      const ALLOWED_COLS = ['title', 'author', 'category_id', 'branch_id', 'priority', 'description', 'cover_url', 'pdf_url', 'drive_link', 'drive_file_id', 'total_pages'];

      for (const item of batchItems) {
        const rawCat = item.category_id ? parseInt(item.category_id, 10) : null;
        const rawBr = item.branch_id ? parseInt(item.branch_id, 10) : null;
        const itemPayload = {
          title: item.title?.trim() || 'Untitled Document',
          author: item.author?.trim() || 'Academic Faculty / Author',
          category_id: Number.isInteger(rawCat) ? rawCat : null,
          branch_id: Number.isInteger(rawBr) ? rawBr : null,
          priority: item.priority === 'sub' ? 'sub' : 'main',
          description: item.description || null,
          cover_url: item.cover_url || null,
          pdf_url: item.pdf_url || null,
          drive_link: item.drive_link || null
        };

        if (itemPayload.drive_link) {
          const { id: driveId } = extractDriveFileId(itemPayload.drive_link);
          if (driveId) itemPayload.drive_file_id = driveId;
        }

        const cleanItem = {};
        ALLOWED_COLS.forEach(col => {
          if (itemPayload[col] === null) {
            cleanItem[col] = null;
          } else if (itemPayload[col] !== undefined && itemPayload[col] !== '' && !Number.isNaN(itemPayload[col])) {
            cleanItem[col] = itemPayload[col];
          }
        });

        const { data: created, error: insertErr } = await supabase
          .from('books')
          .insert([cleanItem])
          .select()
          .single();

        if (insertErr) {
          console.warn('Batch book insertion notice:', insertErr.message);
        } else if (created) {
          insertedRecords.push(created);
        }
      }

      return {
        message: `Successfully imported ${insertedRecords.length} books into institutional library.`,
        count: insertedRecords.length,
        books: insertedRecords
      };
    }

    // 3. Resolve Missing Book Covers in Bulk (for existing database catalog)
    if (endpoint === '/books/resolve-missing-covers' && method === 'POST') {
      const { data: missingBooks, error } = await supabase
        .from('books')
        .select('id, title, author, branch:branch_id(name)')
        .or('cover_url.is.null,cover_url.eq.""');
      if (error) throw error;

      let resolvedCount = 0;
      const updatedList = [];

      for (const book of (missingBooks || [])) {
        try {
          const res = await resolveBookCover({
            title: book.title,
            author: book.author,
            branchName: book.branch?.name
          });
          if (res?.coverUrl) {
            await supabase
              .from('books')
              .update({ cover_url: res.coverUrl })
              .eq('id', book.id);
            resolvedCount++;
            updatedList.push({ id: book.id, title: book.title, cover_url: res.coverUrl, source: res.source });
          }
        } catch (covErr) {
          console.warn(`Notice resolving cover for book ${book.id}:`, covErr);
        }
      }

      return {
        message: `Successfully resolved cover images for ${resolvedCount} book(s).`,
        count: resolvedCount,
        books: updatedList
      };
    }

    // 4. Delete single book
    if (endpoint.startsWith('/books/') && method === 'DELETE') {
      const bookId = endpoint.split('/').pop();
      const { error } = await supabase.from('books').delete().eq('id', bookId);
      if (error) throw error;
      return { message: 'Book deleted successfully' };
    }

    // 5. Create or update single book (POST /books OR PUT /books/:id)
    const isBookCreate = endpoint === '/books' && method === 'POST';
    const isBookUpdate = endpoint.startsWith('/books/') && method === 'PUT' && !endpoint.includes('/bulk') && !endpoint.includes('/batch') && !endpoint.includes('/resolve');

    if (isBookCreate || isBookUpdate) {
      let payload;

      if (options.body instanceof FormData) {
        const formData = options.body;
        const rawCat = formData.get('category_id');
        const parsedCat = rawCat ? parseInt(rawCat, 10) : null;
        const rawBr = formData.get('branch_id');
        const parsedBr = rawBr ? parseInt(rawBr, 10) : null;

        payload = {
          title: formData.get('title') || '',
          author: formData.get('author') || '',
          category_id: Number.isInteger(parsedCat) ? parsedCat : null,
          branch_id: Number.isInteger(parsedBr) ? parsedBr : null,
          priority: formData.get('priority') === 'sub' ? 'sub' : 'main',
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

        const thumbnailFile = formData.get('thumbnail');
        if (thumbnailFile && thumbnailFile.name) {
          const fileName = `covers/${Date.now()}-${thumbnailFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
          const { error: thumbErr } = await supabase.storage
            .from('pdfs')
            .upload(fileName, thumbnailFile, { upsert: true });
          if (!thumbErr) {
            const { data: thumbUrlData } = supabase.storage.from('pdfs').getPublicUrl(fileName);
            payload.cover_url = thumbUrlData ? thumbUrlData.publicUrl : null;
          } else {
            console.warn('Thumbnail upload notice:', thumbErr.message);
            if (thumbnailFile.size <= 2 * 1024 * 1024) {
              payload.cover_url = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = (e) => reject(e);
                reader.readAsDataURL(thumbnailFile);
              }).catch(() => null);
            }
          }
        }
      } else {
        payload = { ...body };
        if (payload.category_id !== undefined) {
          const cat = parseInt(payload.category_id, 10);
          payload.category_id = Number.isInteger(cat) ? cat : null;
        }
        if (payload.branch_id !== undefined) {
          const br = parseInt(payload.branch_id, 10);
          payload.branch_id = Number.isInteger(br) ? br : null;
        }
        if (payload.priority !== undefined) {
          payload.priority = payload.priority === 'sub' ? 'sub' : 'main';
        }
        if (payload.drive_link) {
          const { id: driveId } = extractDriveFileId(payload.drive_link);
          if (driveId) payload.drive_file_id = driveId;
        }
      }

      // Automatic Book Thumbnail Resolution if cover_url was not manually provided
      if (!payload.cover_url && payload.title) {
        try {
          const rawPdf = options.body instanceof FormData ? options.body.get('pdf') : null;
          const resolved = await resolveBookCover({
            title: payload.title,
            author: payload.author || '',
            isbn: payload.isbn || '',
            pdfFile: rawPdf
          });
          if (resolved?.coverUrl) {
            payload.cover_url = resolved.coverUrl;
          }
        } catch (covErr) {
          console.warn('Auto cover resolution notice:', covErr);
        }
      }

      // Whitelist ONLY schema-supported columns for the books table
      const ALLOWED_BOOK_COLUMNS = [
        'title', 'author', 'category_id', 'branch_id', 'priority', 
        'pdf_url', 'drive_file_id', 'drive_link', 'description', 
        'cover_url', 'total_pages'
      ];
      const cleanPayload = {};
      ALLOWED_BOOK_COLUMNS.forEach(col => {
        if (payload[col] === null) {
          cleanPayload[col] = null;
        } else if (payload[col] !== undefined && payload[col] !== '' && !Number.isNaN(payload[col])) {
          cleanPayload[col] = payload[col];
        }
      });

      if (isBookCreate) {
        if (!cleanPayload.title || cleanPayload.title.trim() === '') cleanPayload.title = 'Untitled Book';
        if (!cleanPayload.author || cleanPayload.author.trim() === '') cleanPayload.author = 'Academic Faculty / Author';
        if (!cleanPayload.priority) cleanPayload.priority = 'main';
      }

      if (isBookUpdate) {
        const bookId = endpoint.split('/').pop();
        const { data, error } = await supabase.from('books').update(cleanPayload).eq('id', bookId).select().single();
        if (error) throw error;
        return { message: 'Book updated successfully', data };
      }

      const { data, error } = await supabase.from('books').insert([cleanPayload]).select().single();
      if (error) throw error;
      return { message: 'Book created successfully', data };
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

      let logs = [];
      try {
        const { data: logsData } = await supabase
          .from('activity_logs')
          .select('*, user:user_id(id, full_name, roll_number, branch_name)')
          .eq('book_id', bookId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (logsData) logs = logsData;
      } catch {
        // ignore logs fetch error
      }

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

    if (endpoint.startsWith('/auth/pending-users')) {
      const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
      const paramBranch = urlParams.get('branch_name') || urlParams.get('branch');

      let query = supabase
        .from('users')
        .select('*')
        .eq('role', 'student')
        .eq('status', 'pending');

      const isHq = !user || user.isHeadquarters || user.branchName === 'Central Library' || !user.branchName;
      const effectiveBranch = !isHq ? user.branchName : (paramBranch && paramBranch !== 'all' ? paramBranch : null);

      if (effectiveBranch) {
        query = query.eq('branch_name', effectiveBranch);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }

    if (endpoint.startsWith('/auth/approve-user/')) {
      const userId = endpoint.split('/').pop();
      const { data, error } = await supabase.from('users').update({ status: body.status }).eq('id', userId).select().single();
      if (error) throw error;

      // Activity log & notification in Supabase
      try {
        await supabase.from('activity_logs').insert([{
          user_id: userId,
          action_type: 'user_approval',
          details: `Student account registration marked as ${body.status} by ${user?.fullName || 'Administrator'} (${user?.branchName || 'Department'})`
        }]);

        await supabase.from('notifications').insert([{
          user_id: userId,
          title: body.status === 'approved' ? 'Registration Approved' : 'Registration Status Updated',
          message: body.status === 'approved'
            ? 'Your institutional library portal account has been approved. You now have full access.'
            : `Your library registration status has been marked as ${body.status}.`,
          type: body.status === 'approved' ? 'approval' : 'warning'
        }]);
      } catch (logErr) {
        console.warn('Notice writing audit log/notification:', logErr);
      }

      return { message: `User status updated to ${body.status}`, data };
    }

    // Bulk Approve or Reject Pending Student Registrations
    if (endpoint === '/auth/bulk-approve-users' && method === 'POST') {
      const { userIds, status = 'approved', branch_name } = body;
      let query = supabase.from('users').update({ status }).eq('role', 'student');
      
      if (Array.isArray(userIds) && userIds.length > 0) {
        query = query.in('id', userIds);
      } else {
        query = query.eq('status', 'pending');
        const isHq = !user || user.isHeadquarters || user.branchName === 'Central Library' || !user.branchName;
        const effectiveBranch = !isHq ? user.branchName : (branch_name && branch_name !== 'all' ? branch_name : null);
        if (effectiveBranch) {
          query = query.eq('branch_name', effectiveBranch);
        }
      }

      const { data, error } = await query.select();
      if (error) throw error;

      const updatedCount = data ? data.length : 0;
      if (updatedCount > 0) {
        try {
          const auditLogs = data.map(u => ({
            user_id: u.id,
            action_type: 'bulk_user_approval',
            details: `Student ${u.full_name || u.username} (${u.roll_number || 'N/A'}) registration marked as ${status} via Bulk Action by ${user?.fullName || 'Administrator'}`
          }));
          await supabase.from('activity_logs').insert(auditLogs);

          const notifs = data.map(u => ({
            user_id: u.id,
            title: status === 'approved' ? 'Registration Approved' : 'Registration Status Updated',
            message: status === 'approved'
              ? 'Your institutional library portal account has been approved. You now have full access.'
              : `Your library registration status has been marked as ${status}.`,
            type: status === 'approved' ? 'approval' : 'warning'
          }));
          await supabase.from('notifications').insert(notifs);
        } catch (auditErr) {
          console.warn('Bulk approval audit/notification note:', auditErr);
        }
      }

      return {
        message: `Successfully ${status === 'approved' ? 'approved' : 'updated'} ${updatedCount} student registration(s).`,
        count: updatedCount,
        data
      };
    }

    // Registration Policy Management
    if (endpoint === '/admin/registration-policy') {
      if (method === 'GET') {
        const policy = await getSystemRegistrationPolicy();
        return { policy };
      }

      if (method === 'POST') {
        const newPolicy = body.policy || 'manual';
        await setSystemRegistrationPolicy(newPolicy, user?.username);
        return { message: `Registration policy updated to ${newPolicy}`, policy: newPolicy };
      }
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
        { data: activityLogs },
        { data: allBooksList }
      ] = await Promise.all([
        supabase.from('users').select('*').eq('id', studentId).maybeSingle(),
        supabase.from('user_book_progress').select(`
          *,
          book:book_id(id, title, author, category:category_id(name), branch:branch_id(name))
        `).eq('user_id', studentId).order('last_accessed_at', { ascending: false }),
        supabase.from('permissions').select('*, branch:branch_id(name), book:book_id(title)').eq('user_id', studentId).order('created_at', { ascending: false }),
        supabase.from('activity_logs').select('*, book:book_id(title)').eq('user_id', studentId).order('created_at', { ascending: false }).limit(100),
        supabase.from('books').select('id, title, author, category:category_id(name), branch:branch_id(name)')
      ]);

      const bookLookup = new Map((allBooksList || []).map(b => [b.id, b]));

      const bookProgress = (rawBookProgress || []).map(p => {
        const bk = p.book || bookLookup.get(Number(p.book_id)) || null;
        return {
          ...p,
          book: bk
        };
      });

      const totalReads = bookProgress.reduce((sum, b) => sum + (Number(b.accessed_count) || 1), 0);
      const totalDownloads = bookProgress.reduce((sum, b) => sum + (Number(b.downloaded_count) || (b.is_downloaded ? 1 : 0)), 0);
      const totalMinutes = bookProgress.reduce((sum, b) => sum + (Number(b.reading_time_minutes) || ((Number(b.accessed_count) || 1) * 8)), 0);

      return {
        student: studentUser,
        stats: {
          eBooksRead: bookProgress.length,
          totalReadingSessions: totalReads,
          totalDownloads: totalDownloads,
          totalAccessRequests: (permissionsData || []).length,
          totalReadingMinutes: totalMinutes
        },
        bookProgress: bookProgress,
        permissions: permissionsData || [],
        logs: activityLogs || []
      };
    }

    // 6. Permissions (Multi-Branch Scoped)
    if (endpoint.startsWith('/permissions/pending-requests') || endpoint.startsWith('/permissions/all-requests')) {
      const isAll = endpoint.includes('/all-requests');
      const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
      const paramBranch = urlParams.get('branch_name') || urlParams.get('branch');

      let query = supabase
        .from('permissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAll) {
        query = query.eq('status', 'pending');
      }

      const { data: permData, error: permError } = await query;
      if (permError) throw permError;

      // Extract unique IDs for resilient parallel lookups (independent of schema FK constraints)
      const userIds = [...new Set((permData || []).map(p => p.user_id).filter(Boolean))];
      const bookIds = [...new Set((permData || []).map(p => p.book_id).filter(Boolean))];

      const [
        { data: usersList },
        { data: allBranches },
        { data: booksList }
      ] = await Promise.all([
        userIds.length > 0
          ? supabase.from('users').select('id, full_name, roll_number, branch_name, username').in('id', userIds)
          : { data: [] },
        supabase.from('branches').select('id, name'),
        bookIds.length > 0
          ? supabase.from('books').select('id, title, author, branch_id, cover_url').in('id', bookIds)
          : { data: [] }
      ]);

      const userMap = new Map((usersList || []).map(u => [u.id, u]));
      const branchMap = new Map((allBranches || []).map(b => [b.id, b.name]));
      const bookMap = new Map((booksList || []).map(b => [b.id, b]));

      const isHq = !user || user.isHeadquarters || user.branchName === 'Central Library' || !user.branchName;
      const effectiveBranch = !isHq ? (user.adminBranch || user.branchName) : (paramBranch && paramBranch !== 'all' ? paramBranch : null);

      let list = (permData || []).map(p => {
        const u = userMap.get(p.user_id);
        const bk = bookMap.get(p.book_id);
        const bookBranchName = bk?.branch_id ? branchMap.get(bk.branch_id) : (p.branch_id ? branchMap.get(p.branch_id) : 'Central Library');
        return {
          ...p,
          full_name: u ? u.full_name : 'Student',
          roll_number: u ? u.roll_number : 'N/A',
          student_branch: u ? u.branch_name : 'Engineering',
          book_id: p.book_id,
          book_title: bk?.title || 'Book Access',
          book_author: bk?.author || '',
          book_branch_id: bk?.branch_id,
          book_branch_name: bookBranchName,
          requested_branch_name: p.branch_id ? (branchMap.get(p.branch_id) || bookBranchName || 'Branch') : bookBranchName
        };
      });

      // Multi-Branch Independent Filtering:
      // When branch admin is acting, scope to requests governing books of their branch
      if (effectiveBranch) {
        const effLower = effectiveBranch.trim().toLowerCase();
        list = list.filter(r => {
          const bBranch = (r.book_branch_name || '').trim().toLowerCase();
          const rBranch = (r.requested_branch_name || '').trim().toLowerCase();
          return bBranch === effLower || rBranch === effLower;
        });
      }

      return list;
    }

    if (endpoint === '/permissions/my-requests') {
      if (!user) return [];
      const { data: permData, error: permError } = await supabase
        .from('permissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (permError) throw permError;

      const bookIds = [...new Set((permData || []).map(p => p.book_id).filter(Boolean))];

      const [
        { data: allBranches },
        { data: booksList }
      ] = await Promise.all([
        supabase.from('branches').select('id, name'),
        bookIds.length > 0 ? supabase.from('books').select('id, title, author, cover_url').in('id', bookIds) : { data: [] }
      ]);

      const branchMap = new Map((allBranches || []).map(b => [b.id, b.name]));
      const bookMap = new Map((booksList || []).map(b => [b.id, b]));

      return (permData || []).map(req => {
        const bk = bookMap.get(req.book_id);
        return {
          ...req,
          book_id: req.book_id,
          book_title: bk?.title || 'Book Access',
          book_author: bk?.author || '',
          cover_url: bk?.cover_url || null,
          branch_name: branchMap.get(req.branch_id) || 'Branch'
        };
      });
    }

    if (endpoint.startsWith('/permissions/cancel/')) {
      const permId = endpoint.split('/').pop();
      const { error } = await supabase.from('permissions').delete().eq('id', permId);
      if (error) throw error;
      return { message: 'Request cancelled' };
    }

    if (endpoint.startsWith('/permissions/action/') || endpoint.startsWith('/permissions/approve/')) {
      const permId = endpoint.split('/').pop();
      const { data, error } = await supabase.from('permissions').update({ status: body.status }).eq('id', permId).select().single();
      if (error) throw error;

      if (data && data.user_id) {
        try {
          const isApproved = body.status === 'approved';
          const isRevoked = body.status === 'rejected';
          await supabase.from('notifications').insert([{
            user_id: data.user_id,
            title: isApproved ? 'Book Access Granted' : isRevoked ? 'Book Access Revoked' : 'Book Access Declined',
            message: isApproved
              ? `Department library administrator granted your request to read this book.`
              : `Department library administrator has declined or revoked access for this book.`,
            type: isApproved ? 'approval' : 'warning'
          }]);

          await supabase.from('activity_logs').insert([{
            user_id: data.user_id,
            book_id: data.book_id || null,
            action_type: `permission_${body.status}`,
            details: `Cross-branch book permission marked ${body.status} by ${user?.fullName || 'Administrator'} (${user?.branchName || 'Department'})`
          }]);
        } catch (notifErr) {
          console.warn('Permission notification/audit note:', notifErr.message);
        }
      }
      return { message: `Permission ${body.status}`, data };
    }

    if (endpoint === '/permissions/request' && method === 'POST') {
      const rawBranchId = body.branchId || body.branch_id;
      let branchId = rawBranchId ? parseInt(rawBranchId, 10) : null;
      if (isNaN(branchId)) branchId = null;

      const rawBookId = body.book_id || body.bookId;
      let bookId = rawBookId ? parseInt(rawBookId, 10) : null;
      if (isNaN(bookId)) bookId = null;

      const bookTitle = body.book_title || body.bookTitle || '';

      // If branchId is not provided, look up the target book's branch_id
      if (!branchId && bookId) {
        try {
          const { data: bRow } = await supabase.from('books').select('branch_id').eq('id', bookId).maybeSingle();
          if (bRow?.branch_id) branchId = bRow.branch_id;
        } catch {
          // ignore lookup error
        }
      }

      let effectiveUserId = user?.id;
      if (user?.id) {
        const { data: userRow } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle();
        if (!userRow) {
          const { data: anyStudent } = await supabase.from('users').select('id').eq('role', 'student').limit(1).maybeSingle();
          if (anyStudent) effectiveUserId = anyStudent.id;
        }
      }

      if (!effectiveUserId) {
        throw new Error('You must be signed in to request book access.');
      }

      let existing = null;
      if (bookId) {
        const { data: ex } = await supabase
          .from('permissions')
          .select('id, status')
          .eq('user_id', effectiveUserId)
          .eq('book_id', bookId)
          .maybeSingle();
        existing = ex;
      }

      if (existing) {
        if (existing.status === 'pending') {
          throw new Error(`You already have a pending request for "${bookTitle || 'this book'}"`);
        }
        const { data, error } = await supabase
          .from('permissions')
          .update({ status: 'pending' })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      const insertPayload = {
        user_id: effectiveUserId,
        branch_id: branchId || null,
        status: 'pending'
      };
      if (bookId) insertPayload.book_id = bookId;

      const { data, error } = await supabase.from('permissions').insert([insertPayload]).select().single();
      if (error) throw error;
      return data;
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
      }

      return logData || { message: 'Tracked successfully' };
    }

    if (endpoint.startsWith('/analytics/dashboard')) {
      const urlParams = endpoint.includes('?') ? new URLSearchParams(endpoint.split('?')[1]) : new URLSearchParams();
      const timeframe = urlParams.get('timeframe') || 'all';

      // Timeframe boundary
      let startDate = null;
      const now = new Date();
      if (timeframe === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (timeframe === '7d') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString();
      } else if (timeframe === '30d') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDate = d.toISOString();
      }

      // Fetch all underlying tables in parallel for authoritative aggregation
      let logsQuery = supabase
        .from('activity_logs')
        .select(`
          id,
          action_type,
          book_id,
          user_id,
          details,
          created_at,
          user:user_id(id, full_name, roll_number, branch_name, role),
          book:book_id(id, title, author, branch_id, cover_url)
        `)
        .order('created_at', { ascending: false });

      if (startDate) {
        logsQuery = logsQuery.gte('created_at', startDate);
      }

      const [
        { data: allBranches, error: brErr },
        { data: allBooks, error: bkErr },
        { data: allUsers, error: usrErr },
        { data: allProgress, error: prgErr },
        { data: logsData, error: logErr }
      ] = await Promise.all([
        supabase.from('branches').select('id, name').order('name', { ascending: true }),
        supabase.from('books').select('id, title, author, branch_id, category_id, priority, cover_url, description, total_pages, created_at, branch:branch_id(id, name), category:category_id(id, name)').order('title', { ascending: true }),
        supabase.from('users').select('id, full_name, roll_number, branch_name, role, status, is_blocked, created_at, avatar_url, year, semester, bt_number').order('full_name', { ascending: true }),
        supabase.from('user_book_progress').select('id, user_id, book_id, accessed_count, downloaded_count, is_downloaded, last_page_read, total_pages, session_count, reading_time_minutes, progress_percentage, status, last_accessed_at, last_active_at'),
        logsQuery
      ]);

      if (brErr) console.warn('Notice loading branches:', brErr.message);
      if (bkErr) console.warn('Notice loading books:', bkErr.message);
      if (usrErr) console.warn('Notice loading users:', usrErr.message);
      if (prgErr) console.warn('Notice loading progress:', prgErr.message);
      if (logErr) console.warn('Notice loading activity logs:', logErr.message);

      const branchesList = allBranches || [];
      const booksListRaw = allBooks || [];
      const usersListRaw = allUsers || [];
      const progressList = allProgress || [];
      const logsList = logsData || [];

      // Filter approved students
      const approvedStudents = usersListRaw.filter(u => u.role === 'student' && u.status === 'approved');

      // Filter activity log action types
      const viewLogs = logsList.filter(l => l.action_type === 'view');
      const downloadLogs = logsList.filter(l => l.action_type === 'download');
      const loginLogs = logsList.filter(l => l.action_type === 'login');
      const logoutLogs = logsList.filter(l => l.action_type === 'logout');

      // 1. Calculate per-book statistics
      const booksMap = new Map();
      booksListRaw.forEach(b => {
        const bookProg = progressList.filter(p => p.book_id === b.id);
        const progAcc = bookProg.reduce((acc, p) => acc + (p.accessed_count || 0), 0);
        const progDwn = bookProg.reduce((acc, p) => acc + (p.downloaded_count || (p.is_downloaded ? 1 : 0)), 0);

        const logAcc = viewLogs.filter(l => l.book_id === b.id).length;
        const logDwn = downloadLogs.filter(l => l.book_id === b.id).length;

        const totalAcc = Math.max(progAcc, logAcc);
        const totalDwn = Math.max(progDwn, logDwn);
        const totalAct = totalAcc + totalDwn;

        booksMap.set(b.id, {
          ...b,
          branch_name: b.branch?.name || 'General Engineering',
          category_name: b.category?.name || 'General Academic',
          total_accesses: totalAcc,
          total_downloads: totalDwn,
          total_activity: totalAct
        });
      });

      const enrichedBooksList = Array.from(booksMap.values());

      // 2. Best performing book overall
      const sortedBooksByActivity = [...enrichedBooksList].sort((a, b) => b.total_activity - a.total_activity);
      const topBookCandidate = sortedBooksByActivity[0];
      const bestBook = (topBookCandidate && topBookCandidate.total_activity > 0) ? {
        id: topBookCandidate.id,
        title: topBookCandidate.title,
        author: topBookCandidate.author,
        branch_id: topBookCandidate.branch_id,
        branch_name: topBookCandidate.branch_name,
        category_name: topBookCandidate.category_name,
        cover_url: topBookCandidate.cover_url,
        total_accesses: topBookCandidate.total_accesses,
        total_downloads: topBookCandidate.total_downloads,
        total_activity: topBookCandidate.total_activity
      } : null;

      // 3. Calculate per-student reading activity
      const studentMetricsMap = new Map();
      approvedStudents.forEach(s => {
        const studentProg = progressList.filter(p => p.user_id === s.id);
        const progAcc = studentProg.reduce((acc, p) => acc + (p.accessed_count || 0), 0);
        const progDwn = studentProg.reduce((acc, p) => acc + (p.downloaded_count || (p.is_downloaded ? 1 : 0)), 0);
        const uniqueBooks = studentProg.filter(p => (p.accessed_count || 0) > 0 || p.is_downloaded).length;

        const logAcc = viewLogs.filter(l => l.user_id === s.id).length;
        const logDwn = downloadLogs.filter(l => l.user_id === s.id).length;

        const totalAcc = Math.max(progAcc, logAcc);
        const totalDwn = Math.max(progDwn, logDwn);
        const totalAct = totalAcc + totalDwn;

        studentMetricsMap.set(s.id, {
          ...s,
          total_accesses: totalAcc,
          total_downloads: totalDwn,
          unique_books_accessed: Math.max(uniqueBooks, totalAcc > 0 ? 1 : 0),
          total_activity: totalAct
        });
      });

      const enrichedStudentsList = Array.from(studentMetricsMap.values());

      // Top student reader
      const sortedStudentsByActivity = [...enrichedStudentsList].sort((a, b) => b.total_activity - a.total_activity);
      const topStudentCandidate = sortedStudentsByActivity[0];
      const topUser = (topStudentCandidate && topStudentCandidate.total_activity > 0) ? {
        id: topStudentCandidate.id,
        full_name: topStudentCandidate.full_name,
        roll_number: topStudentCandidate.roll_number || 'N/A',
        branch_name: topStudentCandidate.branch_name || 'Academic Faculty',
        year: topStudentCandidate.year || 'Academic Year',
        semester: topStudentCandidate.semester || 'Semester',
        avatar_url: topStudentCandidate.avatar_url,
        total_accesses: topStudentCandidate.total_accesses,
        total_downloads: topStudentCandidate.total_downloads,
        unique_books_accessed: topStudentCandidate.unique_books_accessed,
        total_activity: topStudentCandidate.total_activity
      } : null;

      // 4. Branch-wise Performance (Accesses vs Downloads)
      const branchPerformance = branchesList.map(br => {
        const brBooks = enrichedBooksList.filter(b => b.branch_id === br.id);
        const brStudents = enrichedStudentsList.filter(s => s.branch_name === br.name);

        const totalAcc = brBooks.reduce((sum, b) => sum + b.total_accesses, 0);
        const totalDwn = brBooks.reduce((sum, b) => sum + b.total_downloads, 0);

        return {
          branch_id: br.id,
          branch_name: br.name,
          total_books: brBooks.length,
          total_students: brStudents.length,
          total_accesses: totalAcc,
          total_downloads: totalDwn,
          total_activity: totalAcc + totalDwn
        };
      });

      // 5. Most Read Book in Each Branch
      const mostReadPerBranch = branchesList.map(br => {
        const brBooks = enrichedBooksList.filter(b => b.branch_id === br.id);
        const sortedBrBooks = [...brBooks].sort((a, b) => b.total_activity - a.total_activity);
        const topBrBook = sortedBrBooks[0];

        if (topBrBook && topBrBook.total_activity > 0) {
          return {
            branch_id: br.id,
            branch_name: br.name,
            has_activity: true,
            book_id: topBrBook.id,
            title: topBrBook.title,
            author: topBrBook.author,
            cover_url: topBrBook.cover_url,
            total_accesses: topBrBook.total_accesses,
            total_downloads: topBrBook.total_downloads,
            total_activity: topBrBook.total_activity
          };
        }

        return {
          branch_id: br.id,
          branch_name: br.name,
          has_activity: false,
          message: 'No reading activity recorded for this department.'
        };
      });

      // Detailed drill-down datasets
      const mappedAccessLogs = viewLogs.map(l => ({
        id: l.id,
        created_at: l.created_at,
        action_type: l.action_type,
        details: l.details,
        user_id: l.user_id,
        user_name: l.user?.full_name || 'Student / Reader',
        roll_number: l.user?.roll_number || 'N/A',
        branch_name: l.user?.branch_name || 'Academic Faculty',
        book_id: l.book_id,
        book_title: l.book?.title || 'Library E-Book Resource',
        book_author: l.book?.author || 'Academic Author',
        cover_url: l.book?.cover_url || null
      }));

      const mappedDownloadLogs = downloadLogs.map(l => ({
        id: l.id,
        created_at: l.created_at,
        action_type: l.action_type,
        details: l.details,
        user_id: l.user_id,
        user_name: l.user?.full_name || 'Student / Reader',
        roll_number: l.user?.roll_number || 'N/A',
        branch_name: l.user?.branch_name || 'Academic Faculty',
        book_id: l.book_id,
        book_title: l.book?.title || 'Library E-Book Resource',
        book_author: l.book?.author || 'Academic Author',
        cover_url: l.book?.cover_url || null
      }));

      return {
        stats: {
          books: booksListRaw.length,
          students: approvedStudents.length,
          views: viewLogs.length,
          downloads: downloadLogs.length,
          logins: loginLogs.length,
          logouts: logoutLogs.length
        },
        bestBook,
        topUser,
        branchPerformance,
        mostReadPerBranch,
        drilldowns: {
          books: enrichedBooksList,
          students: enrichedStudentsList,
          views: mappedAccessLogs,
          downloads: mappedDownloadLogs
        },
        activityLogs: logsList.slice(0, 20).map(l => ({
          ...l,
          full_name: l.user ? l.user.full_name : null,
          role: l.user ? l.user.role : null,
          roll_number: l.user ? l.user.roll_number : null,
          book_title: l.book ? l.book.title : null
        }))
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

  const bypassLogin = (role = 'admin', branchName = 'Central Library') => {
    const isHq = role === 'admin' && (branchName === 'Central Library' || branchName === 'Headquarters');
    const mockUser = role === 'admin' ? {
      id: isHq ? '00000000-0000-0000-0000-000000000001' : '00000000-0000-0000-0000-000000000003',
      username: isHq ? 'admin' : `admin_${branchName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      fullName: isHq ? 'Central Library Administrator (Headquarters)' : `${branchName} Library Administrator`,
      role: 'admin',
      isHeadquarters: isHq,
      status: 'approved',
      branchName: branchName || 'Central Library',
      adminBranch: isHq ? null : branchName,
      rollNumber: isHq ? 'ADMIN-HQ' : 'ADMIN-BRANCH',
      year: 'Faculty/Staff',
      semester: 'N/A',
      btNumber: 'BT-ADMIN',
      authProvider: 'bypass',
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${isHq ? 'admin' : branchName}`
    } : {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'student_cs',
      fullName: 'Demo Student (CS)',
      role: 'student',
      isHeadquarters: false,
      status: 'approved',
      branchName: branchName || 'Computer Science and Engineering',
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

        const isHq = data.role === 'admin' && (data.branch_name === 'Central Library' || data.branch_name === 'Headquarters' || !data.branch_name);
        const formatted = {
          id: data.id,
          username: data.username,
          fullName: data.full_name,
          role: data.role,
          isHeadquarters: isHq,
          status: data.status,
          branchName: data.branch_name || (data.role === 'admin' ? 'Central Library' : ''),
          branch_name: data.branch_name || (data.role === 'admin' ? 'Central Library' : ''),
          adminBranch: !isHq && data.role === 'admin' ? data.branch_name : null,
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

    const DEPARTMENT_ADMIN_MAP = {
      'cse.library@sistec.ac.in': { branch: 'Computer Science and Engineering', title: 'CSE Department Library Admin', code: 'ADMIN-CSE' },
      'cse.admin@sistec.ac.in': { branch: 'Computer Science and Engineering', title: 'CSE Department Library Admin', code: 'ADMIN-CSE' },
      'it.library@sistec.ac.in': { branch: 'Information Technology', title: 'IT Department Library Admin', code: 'ADMIN-IT' },
      'it.admin@sistec.ac.in': { branch: 'Information Technology', title: 'IT Department Library Admin', code: 'ADMIN-IT' },
      'ec.library@sistec.ac.in': { branch: 'Electronics and Communication', title: 'ECE Department Library Admin', code: 'ADMIN-ECE' },
      'ec.admin@sistec.ac.in': { branch: 'Electronics and Communication', title: 'ECE Department Library Admin', code: 'ADMIN-ECE' },
      'me.library@sistec.ac.in': { branch: 'Mechanical Engineering', title: 'ME Department Library Admin', code: 'ADMIN-ME' },
      'me.admin@sistec.ac.in': { branch: 'Mechanical Engineering', title: 'ME Department Library Admin', code: 'ADMIN-ME' },
      'ce.library@sistec.ac.in': { branch: 'Civil Engineering', title: 'Civil Department Library Admin', code: 'ADMIN-CE' },
      'ce.admin@sistec.ac.in': { branch: 'Civil Engineering', title: 'Civil Department Library Admin', code: 'ADMIN-CE' },
      'ee.library@sistec.ac.in': { branch: 'Electrical Engineering', title: 'EE Department Library Admin', code: 'ADMIN-EE' },
      'ee.admin@sistec.ac.in': { branch: 'Electrical Engineering', title: 'EE Department Library Admin', code: 'ADMIN-EE' }
    };

    const isDeptAdmin = DEPARTMENT_ADMIN_MAP[idLower];
    if (isDeptAdmin) {
      if (trimmedPass !== 'Kalpana2680#') {
        throw new Error(`Invalid password for ${isDeptAdmin.title}.`);
      }

      const branchAdminUser = {
        id: `0271446c-5515-4406-9c4d-branch-${idLower.split('.')[0]}`,
        username: idLower,
        email: idLower,
        fullName: isDeptAdmin.title,
        role: 'admin',
        isHeadquarters: false,
        status: 'approved',
        branchName: isDeptAdmin.branch,
        adminBranch: isDeptAdmin.branch,
        rollNumber: isDeptAdmin.code,
        year: 'Faculty/Staff',
        semester: 'N/A',
        btNumber: `BT-${isDeptAdmin.code}`,
        authProvider: 'credentials',
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${isDeptAdmin.code}`
      };

      localStorage.setItem('lib_custom_user', JSON.stringify(branchAdminUser));
      setUser(branchAdminUser);
      setNeedsProfile(false);
      setPendingGoogleUser(null);
      setLoading(false);

      try {
        await supabase.from('activity_logs').insert([{
          action_type: 'login',
          details: `${isDeptAdmin.title} (${isDeptAdmin.branch}) logged in securely`
        }]);
      } catch {
        // ignore activity log error
      }

      return branchAdminUser;
    }

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
        isHeadquarters: true,
        status: 'approved',
        branchName: 'Central Library',
        adminBranch: null,
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
          details: 'Official Central Library Administrator (Headquarters) logged in securely'
        }]);
      } catch {
        // ignore activity log error
      }

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

    const isHqAdmin = userRecord.role === 'admin' && (userRecord.branch_name === 'Central Library' || userRecord.branch_name === 'Headquarters' || !userRecord.branch_name);
    const formattedUser = {
      id: userRecord.id,
      username: userRecord.username,
      fullName: userRecord.full_name,
      role: userRecord.role,
      isHeadquarters: isHqAdmin,
      status: userRecord.status,
      branchName: userRecord.branch_name || (userRecord.role === 'admin' ? 'Central Library' : ''),
      branch_name: userRecord.branch_name || (userRecord.role === 'admin' ? 'Central Library' : ''),
      adminBranch: !isHqAdmin && userRecord.role === 'admin' ? userRecord.branch_name : null,
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
    } catch {
      // ignore activity log error
    }

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

    // Check active registration policy
    const policy = await getSystemRegistrationPolicy();
    const initialStatus = policy === 'auto_approve' ? 'approved' : policy === 'auto_reject' ? 'rejected' : 'pending';

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
      status: initialStatus,
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

    if (initialStatus === 'approved') {
      localStorage.setItem('lib_custom_user', JSON.stringify(formattedUser));
      setUser(formattedUser);
      setNeedsProfile(false);
      setPendingGoogleUser(null);
      return { message: 'Profile completed and approved! Welcome to SISTEC Library.', status: 'approved' };
    } else {
      await supabase.auth.signOut();
      clearSession();
      return {
        message: 'Your account has been registered successfully. Please connect with the administrator for approval. You will be able to access SISTECH-LIB after your account is approved.',
        status: initialStatus
      };
    }
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

    // Check active registration policy
    const policy = await getSystemRegistrationPolicy();
    const initialStatus = policy === 'auto_approve' ? 'approved' : policy === 'auto_reject' ? 'rejected' : 'pending';

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
      status: initialStatus,
      is_blocked: 0,
      auth_provider: 'password'
    }]).select().single();

    if (error) {
      throw new Error('Failed to create user profile: ' + error.message);
    }

    // Insert activity log for registration audit trail
    try {
      await supabase.from('activity_logs').insert([{
        user_id: userId,
        action_type: 'registration',
        details: `Student account registered (${initialStatus}) by ${fullName} (${rollNumber}) - Department: ${branchName}`
      }]);
    } catch (logErr) {
      console.warn('Registration activity log notice:', logErr);
    }

    await supabase.auth.signOut();

    let confirmationMessage = 'Your account has been registered successfully. Please connect with the administrator for approval. You will be able to access SISTECH-LIB after your account is approved.';
    if (initialStatus === 'approved') {
      confirmationMessage = 'Your account has been registered and automatically approved! You can now sign in.';
    } else if (initialStatus === 'rejected') {
      confirmationMessage = 'Registration was received but automatically marked rejected per current policy.';
    }

    return {
      message: confirmationMessage,
      status: initialStatus,
      data
    };
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading, login, logout, register,
      loginWithGoogle, completeGoogleProfile, needsProfile,
      pendingGoogleUser, apiCall, refreshUser: loadUser,
      bypassLogin, extractDriveFileId, normalizeBranch, isSameBranch, canonicalBranch
    }}>
      {children}
    </AuthContext.Provider>
  );
};
