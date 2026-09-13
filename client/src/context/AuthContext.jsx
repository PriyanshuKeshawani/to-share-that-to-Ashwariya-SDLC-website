/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { resolveBookCover } from '../utils/bookCoverResolver';

export const BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

// Canonical branch key identifier for 100% accurate branch matching across abbreviations, acronyms, and variations
export const canonicalBranch = (name) => {
  if (!name) return '';
  let s = String(name).toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();

  // AI / Data Science check must come before general CSE check!
  if (s.includes('aids') || (s.includes('artif') && (s.includes('intel') || s.includes('data')))) {
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
  if (!a || !b) return false;
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const canA = canonicalBranch(a);
  const canB = canonicalBranch(b);
  return Boolean(canA && canB && canA === canB);
};

export const KNOWN_DEPARTMENT_ADMINS = {
  'cse.library@sistec.ac.in': 'Computer Science and Engineering',
  'cse.admin@sistec.ac.in': 'Computer Science and Engineering',
  'it.library@sistec.ac.in': 'Information Technology',
  'it.admin@sistec.ac.in': 'Information Technology',
  'ec.library@sistec.ac.in': 'Electronics and Communication',
  'ec.admin@sistec.ac.in': 'Electronics and Communication',
  'me.library@sistec.ac.in': 'Mechanical Engineering',
  'me.admin@sistec.ac.in': 'Mechanical Engineering',
  'ce.library@sistec.ac.in': 'Civil Engineering',
  'ce.admin@sistec.ac.in': 'Civil Engineering',
  'ee.library@sistec.ac.in': 'Electrical Engineering',
  'ee.admin@sistec.ac.in': 'Electrical Engineering'
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

// UUID Validation and Deterministic Sanitization
// Ensures external bridges (Flutter WebView / mock IDs) never inject non-UUID strings into PostgreSQL UUID columns
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidUuid = (id) => typeof id === 'string' && UUID_REGEX.test(id.trim());

export const toDeterministicUuid = (str) => {
  if (!str) return '00000000-0000-4000-8000-000000000000';
  const clean = String(str).trim();
  if (isValidUuid(clean)) return clean;
  let h1 = 0xdeadbeef, h2 = 0x41c64e6d, h3 = 0x9e3779b9, h4 = 0x27d4eb2f;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 3812015801);
    h4 = Math.imul(h4 ^ ch, 2246822519);
  }
  const toHex = (n) => (n >>> 0).toString(16).padStart(8, '0');
  const rawHex = (toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4)).toLowerCase();
  return `${rawHex.slice(0, 8)}-${rawHex.slice(8, 12)}-4${rawHex.slice(13, 16)}-a${rawHex.slice(17, 20)}-${rawHex.slice(20, 32)}`;
};

const sanitizeCustomUser = (u) => {
  if (!u || typeof u !== 'object') return u;
  let targetId = u.id;
  if (u.role === 'admin') {
    if (!targetId || !isValidUuid(targetId) || String(targetId).includes('branch-')) {
      targetId = '0271446c-5515-4406-9c4d-19fe5d4e9c9a';
    }
  } else if (targetId && !isValidUuid(targetId)) {
    targetId = toDeterministicUuid(targetId);
  }
  const updated = { ...u, id: targetId };
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lib_custom_user', JSON.stringify(updated));
    }
  } catch {
    // ignore storage error
  }
  return updated;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('lib_custom_user');
      return saved ? sanitizeCustomUser(JSON.parse(saved)) : null;
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
          const effectiveId = user.id && isValidUuid(user.id) ? user.id : (user.id ? toDeterministicUuid(user.id) : null);
          if (effectiveId) {
            const { data: perms } = await supabase
              .from('permissions')
              .select('book_id')
              .eq('user_id', effectiveId)
              .eq('status', 'approved');
            approvedBookIds = (perms || []).map(p => p.book_id).filter(Boolean);
          }
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

    // Single Book fetch (GET /books/:id) - Enables cross-branch shared book preview on demand
    const isSingleBookGet = (() => {
      if (method !== 'GET') return false;
      const parts = endpoint.split('/');
      // Expected format: /books/:id (parts: ['', 'books', ':id'])
      return parts.length === 3 && parts[1] === 'books' && parts[2] &&
        !['categories', 'branches', 'bulk-delete', 'batch-import', 'resolve-missing-covers', 'activity', 'notes', 'bookmarks'].includes(parts[2]);
    })();

    if (isSingleBookGet) {
      const bookId = endpoint.split('/')[2];
      const { data: b, error } = await supabase.from('books').select(`
        *,
        category:category_id(name),
        branch:branch_id(name)
      `).eq('id', bookId).maybeSingle();
      if (error) throw error;
      if (!b) return null;

      let hasAccess = true;
      let isHomeBranch = false;
      const branchName = b.branch ? b.branch.name : null;
      const userBranch = (user?.branchName || user?.branch_name || '').trim();
      const bookBranch = (branchName || '').trim();

      if (user && user.role === 'student') {
        isHomeBranch = Boolean(userBranch && bookBranch && isSameBranch(userBranch, bookBranch));
        let isBookApproved = false;
        try {
          const { data: perm } = await supabase
            .from('permissions')
            .select('status')
            .eq('user_id', user.id)
            .eq('book_id', b.id)
            .eq('status', 'approved')
            .maybeSingle();
          isBookApproved = Boolean(perm);
        } catch {}
        hasAccess = isHomeBranch || isBookApproved;
      }

      return {
        ...b,
        category_name: b.category ? b.category.name : null,
        branch_name: branchName,
        hasAccess,
        isHomeBranch
      };
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

      // Realtime notification for active students
      try {
        const { data: students } = await supabase
          .from('users')
          .select('id, branch_name')
          .eq('role', 'student')
          .eq('status', 'approved')
          .limit(80);

        if (students && students.length > 0) {
          const bookNotifs = students.map(s => ({
            user_id: s.id,
            title: `New Book: ${cleanPayload.title}`,
            message: `"${cleanPayload.title}" by ${cleanPayload.author || 'Academic Faculty'} has been added to the library portal.`,
            type: 'book',
            is_read: false
          }));
          await supabase.from('notifications').insert(bookNotifs);
        }
      } catch (notifErr) {
        console.warn('New book student notification note:', notifErr);
      }

      return { message: 'Book created successfully', data };
    }

    // Book readers & activity monitoring (overall and per-student)
    if (endpoint.startsWith('/books/') && endpoint.endsWith('/activity') && method === 'GET') {
      const rawBookId = endpoint.split('/')[2];
      const bookId = Number(rawBookId) || rawBookId;

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
            total_pages,
            progress_percentage,
            accessed_count,
            downloaded_count,
            is_downloaded,
            last_accessed_at,
            user:user_id(id, full_name, username, roll_number, branch_name, year, semester, avatar_url)
          `)
          .eq('book_id', bookId)
          .order('last_accessed_at', { ascending: false });

        if (progData) readers = [...progData];
      } catch (e) {
        console.warn('Notice fetching progress for book:', e);
      }

      let logs = [];
      let totalViewLogs = 0;
      let totalDownloadLogs = 0;
      try {
        const [
          { data: logsData },
          { count: viewCount },
          { count: dwnCount }
        ] = await Promise.all([
          supabase
            .from('activity_logs')
            .select('*, user:user_id(id, full_name, roll_number, branch_name)')
            .eq('book_id', bookId)
            .order('created_at', { ascending: false })
            .limit(100),
          supabase
            .from('activity_logs')
            .select('*', { count: 'exact', head: true })
            .eq('book_id', bookId)
            .eq('action_type', 'view'),
          supabase
            .from('activity_logs')
            .select('*', { count: 'exact', head: true })
            .eq('book_id', bookId)
            .eq('action_type', 'download')
        ]);
        if (logsData) logs = logsData;
        totalViewLogs = viewCount || 0;
        totalDownloadLogs = dwnCount || 0;
      } catch (logErr) {
        console.warn('Notice fetching logs for book:', logErr);
      }

      // Ensure any missing user data from progress or logs is hydrated
      const missingUserIds = [
        ...readers.filter(r => !r.user && r.user_id).map(r => r.user_id),
        ...logs.filter(l => !l.user && l.user_id).map(l => l.user_id)
      ];
      if (missingUserIds.length > 0) {
        try {
          const { data: missingUsers } = await supabase
            .from('users')
            .select('id, full_name, username, roll_number, branch_name, year, semester, avatar_url')
            .in('id', [...new Set(missingUserIds)]);
          if (missingUsers) {
            const userMap = new Map(missingUsers.map(u => [u.id, u]));
            readers.forEach(r => {
              if (!r.user && userMap.has(r.user_id)) r.user = userMap.get(r.user_id);
            });
            logs.forEach(l => {
              if (!l.user && userMap.has(l.user_id)) l.user = userMap.get(l.user_id);
            });
          }
        } catch (uErr) {
          console.warn('Notice hydrating missing users for book activity:', uErr);
        }
      }

      // Merge any users from logs who might not have a progress row yet
      const existingUserIds = new Set(readers.map(r => r.user_id));
      logs.forEach(l => {
        if (l.user_id && !existingUserIds.has(l.user_id)) {
          existingUserIds.add(l.user_id);
          readers.push({
            id: `log-${l.id}`,
            user_id: l.user_id,
            book_id: bookId,
            last_page_read: 1,
            total_pages: bookData?.total_pages || 100,
            progress_percentage: 1,
            accessed_count: 1,
            downloaded_count: l.action_type === 'download' ? 1 : 0,
            is_downloaded: l.action_type === 'download' ? 1 : 0,
            last_accessed_at: l.created_at,
            user: l.user
          });
        }
      });

      const totalUniqueReaders = readers.length;
      const progSessions = readers.reduce((acc, r) => acc + (Number(r.accessed_count) || 1), 0);
      const viewLogCount = logs.filter(l => l.action_type === 'view').length;
      const totalReadSessions = Math.max(progSessions, totalViewLogs, viewLogCount, logs.length > 0 ? 1 : 0);
      const progDownloads = readers.reduce((acc, r) => acc + (Number(r.downloaded_count) || (r.is_downloaded ? 1 : 0)), 0);
      const dwnLogCount = logs.filter(l => l.action_type === 'download').length;
      const totalDownloads = Math.max(progDownloads, totalDownloadLogs, dwnLogCount);
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

    // 3b. Student Study Notes (Cloud DB Persisted)
    if (endpoint.startsWith('/books/') && endpoint.includes('/notes')) {
      if (!user) return [];
      const parts = endpoint.split('/');
      const bookId = parts[2];
      const key = `notes_${user.id}_${bookId}`;

      if (method === 'GET') {
        const { data } = await supabase.from('system_settings').select('value').eq('key', key).maybeSingle();
        return Array.isArray(data?.value?.list) ? data.value.list : [];
      }

      if (method === 'POST') {
        const { page = 1, text = '', tag = 'Concept', book_title = '' } = body || {};
        if (!text.trim()) return [];

        const { data: existing } = await supabase.from('system_settings').select('value').eq('key', key).maybeSingle();
        const currentList = Array.isArray(existing?.value?.list) ? existing.value.list : [];

        const newNote = {
          id: Date.now().toString(),
          page: Number(page) || 1,
          text: text.trim(),
          tag: tag || 'Concept',
          createdAt: new Date().toISOString()
        };

        const updatedList = [newNote, ...currentList];
        await supabase.from('system_settings').upsert({
          key,
          value: { list: updatedList },
          updated_at: new Date().toISOString()
        });

        // Audit log in Supabase
        try {
          await supabase.from('activity_logs').insert([{
            user_id: user.id,
            book_id: Number(bookId) || null,
            action_type: 'add_note',
            details: `Saved ${tag} note for page ${newNote.page} of "${book_title || 'Book'}"`
          }]);
        } catch {}

        return updatedList;
      }

      if (method === 'DELETE') {
        const noteId = parts[4];
        const { data: existing } = await supabase.from('system_settings').select('value').eq('key', key).maybeSingle();
        const currentList = Array.isArray(existing?.value?.list) ? existing.value.list : [];
        const updatedList = currentList.filter(n => String(n.id) !== String(noteId));

        await supabase.from('system_settings').upsert({
          key,
          value: { list: updatedList },
          updated_at: new Date().toISOString()
        });

        return updatedList;
      }
    }

    // 3c. Student Bookmarks (Cloud DB Persisted)
    if (endpoint.startsWith('/books/') && endpoint.includes('/bookmarks')) {
      if (!user) return [];
      const parts = endpoint.split('/');
      const bookId = parts[2];
      const key = `bookmarks_${user.id}_${bookId}`;

      if (method === 'GET') {
        const { data } = await supabase.from('system_settings').select('value').eq('key', key).maybeSingle();
        return Array.isArray(data?.value?.list) ? data.value.list : [];
      }

      if (method === 'POST') {
        const { page = 1, title = '', book_title = '' } = body || {};
        const pageNum = Number(page) || 1;

        const { data: existing } = await supabase.from('system_settings').select('value').eq('key', key).maybeSingle();
        const currentList = Array.isArray(existing?.value?.list) ? existing.value.list : [];

        const exists = currentList.some(b => Number(b.page) === pageNum);
        let updatedList;
        if (exists) {
          updatedList = currentList.filter(b => Number(b.page) !== pageNum);
        } else {
          const newBm = {
            id: Date.now().toString(),
            page: pageNum,
            title: title || `Page ${pageNum}`,
            createdAt: new Date().toISOString()
          };
          updatedList = [...currentList, newBm].sort((a, b) => a.page - b.page);

          try {
            await supabase.from('activity_logs').insert([{
              user_id: user.id,
              book_id: Number(bookId) || null,
              action_type: 'bookmark',
              details: `Bookmarked page ${pageNum} of "${book_title || 'Book'}"`
            }]);
          } catch {}
        }

        await supabase.from('system_settings').upsert({
          key,
          value: { list: updatedList },
          updated_at: new Date().toISOString()
        });

        return updatedList;
      }

      if (method === 'DELETE') {
        const targetPage = Number(parts[4]);
        const { data: existing } = await supabase.from('system_settings').select('value').eq('key', key).maybeSingle();
        const currentList = Array.isArray(existing?.value?.list) ? existing.value.list : [];
        const updatedList = currentList.filter(b => Number(b.page) !== targetPage && String(b.id) !== String(parts[4]));

        await supabase.from('system_settings').upsert({
          key,
          value: { list: updatedList },
          updated_at: new Date().toISOString()
        });

        return updatedList;
      }
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

    if (endpoint.startsWith('/auth/users/') && (method === 'PUT' || method === 'PATCH')) {
      const userId = endpoint.split('/').pop();
      const updates = {};
      if (body.full_name !== undefined) updates.full_name = String(body.full_name).trim();
      if (body.fullName !== undefined) updates.full_name = String(body.fullName).trim();
      if (body.roll_number !== undefined) updates.roll_number = String(body.roll_number).trim();
      if (body.rollNumber !== undefined) updates.roll_number = String(body.rollNumber).trim();
      if (body.branch_name !== undefined) updates.branch_name = String(body.branch_name).trim();
      if (body.branchName !== undefined) updates.branch_name = String(body.branchName).trim();
      if (body.year !== undefined) updates.year = String(body.year).trim();
      if (body.semester !== undefined) updates.semester = String(body.semester).trim();
      if (body.bt_number !== undefined) updates.bt_number = String(body.bt_number).trim();
      if (body.btNumber !== undefined) updates.bt_number = String(body.btNumber).trim();
      if (body.email !== undefined) updates.email = String(body.email).trim().toLowerCase();
      if (body.status !== undefined) updates.status = String(body.status).trim().toLowerCase();
      if (body.is_blocked !== undefined) updates.is_blocked = Number(body.is_blocked);

      const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select().single();
      if (error) throw error;

      try {
        await supabase.from('activity_logs').insert([{
          user_id: userId,
          action_type: 'admin_edit',
          details: `Admin updated student academic profile for ${updates.full_name || 'Student'} (${updates.roll_number || 'N/A'}) - Branch: ${updates.branch_name || 'N/A'}, Year: ${updates.year || 'N/A'}, Sem: ${updates.semester || 'N/A'}`
        }]);

        if (updates.status) {
          const isApproved = updates.status === 'approved';
          await supabase.from('notifications').insert([{
            user_id: userId,
            title: isApproved ? 'Registration Approved' : 'Registration Status Updated',
            message: isApproved
              ? 'Your institutional library portal account has been approved. You now have full access to the digital library.'
              : `Your library registration status has been updated to ${updates.status}.`,
            type: isApproved ? 'approval' : 'warning',
            is_read: false
          }]);
        }
      } catch (logErr) {
        console.warn('Notice writing activity log or notification for student edit:', logErr);
      }

      return { message: 'Student profile updated successfully', data };
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
          book:book_id(id, title, author, total_pages, category:category_id(name), branch:branch_id(name))
        `).eq('user_id', studentId).order('last_accessed_at', { ascending: false }),
        supabase.from('permissions').select('*, branch:branch_id(name), book:book_id(title)').eq('user_id', studentId).order('created_at', { ascending: false }),
        supabase.from('activity_logs').select('*, book:book_id(title)').eq('user_id', studentId).order('created_at', { ascending: false }).limit(100),
        supabase.from('books').select('id, title, author, total_pages, category:category_id(name), branch:branch_id(name)')
      ]);

      const bookLookup = new Map((allBooksList || []).map(b => [b.id, b]));

      const bookProgress = (rawBookProgress || []).map(p => {
        const bk = p.book || bookLookup.get(Number(p.book_id)) || null;
        const totalPages = p.total_pages && p.total_pages > 0
          ? p.total_pages
          : (bk?.total_pages && bk.total_pages > 0 ? bk.total_pages : 100);
        const lastPage = Math.max(1, parseInt(p.last_page_read || 1, 10));
        const progressPercentage = p.progress_percentage && p.progress_percentage > 0
          ? p.progress_percentage
          : Math.min(100, Math.max(1, Math.round((lastPage / totalPages) * 100)));

        return {
          ...p,
          last_page_read: lastPage,
          total_pages: totalPages,
          progress_percentage: progressPercentage,
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
      const effectiveId = user?.id && isValidUuid(user.id) ? user.id : (user?.id ? toDeterministicUuid(user.id) : null);
      if (!effectiveId) return [];
      try {
        const { data: permData, error: permError } = await supabase
          .from('permissions')
          .select('*')
          .eq('user_id', effectiveId)
          .order('created_at', { ascending: false });
        if (permError) {
          console.warn('Notice loading my-requests:', permError.message);
          return [];
        }

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
      } catch (err) {
        console.warn('Error fetching permissions requests:', err.message);
        return [];
      }
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

      let effectiveUserId = user?.id && isValidUuid(user.id) ? user.id : (user?.id ? toDeterministicUuid(user.id) : null);
      if (effectiveUserId) {
        const { data: userRow } = await supabase.from('users').select('id').eq('id', effectiveUserId).maybeSingle();
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

      // Realtime notification for department & central administrators
      try {
        const { data: adminUsers } = await supabase
          .from('users')
          .select('id, branch_name')
          .eq('role', 'admin');

        if (adminUsers && adminUsers.length > 0) {
          const reqNotifs = adminUsers.map(adm => ({
            user_id: adm.id,
            title: 'Book Access Request',
            message: `${user?.fullName || 'Student'} (${user?.rollNumber || user?.branchName || 'Student'}) requested access to "${bookTitle || 'an eBook'}".`,
            type: 'approval',
            is_read: false
          }));
          await supabase.from('notifications').insert(reqNotifs);
        }
      } catch (notifErr) {
        console.warn('Book request admin notification note:', notifErr);
      }

      return data;
    }

    // 7. Notifications
    if (endpoint === '/notifications' && method === 'GET') {
      if (!user) return [];
      const effectiveUserId = user?.id && isValidUuid(user.id) ? user.id : (user?.id ? toDeterministicUuid(user.id) : null);
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(40);
      if (error) throw error;
      return data || [];
    }

    if (endpoint === '/notifications/unread-count' && method === 'GET') {
      if (!user) return { count: 0 };
      const effectiveUserId = user?.id && isValidUuid(user.id) ? user.id : (user?.id ? toDeterministicUuid(user.id) : null);
      if (!effectiveUserId) return { count: 0 };
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId)
        .eq('is_read', false);
      if (error) throw error;
      return { count: count || 0 };
    }

    if (endpoint === '/notifications/mark-read' && method === 'POST') {
      if (!user) return null;
      const effectiveUserId = user?.id && isValidUuid(user.id) ? user.id : (user?.id ? toDeterministicUuid(user.id) : null);
      if (!effectiveUserId) return null;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', effectiveUserId)
        .eq('is_read', false);
      if (error) throw error;
      return { message: 'All notifications marked as read' };
    }

    if (endpoint.startsWith('/notifications/') && endpoint.endsWith('/read') && method === 'POST') {
      if (!user) return null;
      const notifId = endpoint.split('/')[2];
      const effectiveUserId = user?.id && isValidUuid(user.id) ? user.id : (user?.id ? toDeterministicUuid(user.id) : null);
      if (notifId && effectiveUserId) {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notifId)
          .eq('user_id', effectiveUserId);
        if (error) throw error;
        return { message: 'Notification marked as read' };
      }
    }

    if (endpoint === '/notifications/test' && method === 'POST') {
      if (!user) throw new Error('Please sign in to test notifications.');
      const effectiveUserId = user?.id && isValidUuid(user.id) ? user.id : (user?.id ? toDeterministicUuid(user.id) : null);
      if (!effectiveUserId) throw new Error('Invalid user identity.');

      const { data, error } = await supabase.from('notifications').insert([{
        user_id: effectiveUserId,
        title: 'System Self-Test: Notifications Online',
        message: 'Realtime WebSocket push, bell unread counters, and audio chimes are functioning properly.',
        type: 'info',
        is_read: false
      }]).select().single();

      if (error) throw error;
      return { success: true, message: 'Test notification created successfully', data };
    }

    // 8. Analytics & Logs (real-time progress + audit logs)
    if (endpoint === '/analytics/track' && method === 'POST') {
      const effectiveId = user?.id && isValidUuid(user.id) ? user.id : (user?.id ? toDeterministicUuid(user.id) : null);
      if (!effectiveId) return null;
      const targetBookId = Number(body.bookId || body.book_id) || null;
      const actionType = body.actionType || body.action_type || 'view';
      const pageRead = Math.max(1, parseInt(body.last_page_read || body.lastPageRead || 1, 10));
      const details = body.details || (actionType === 'download' ? 'Downloaded eBook' : `Read up to page ${pageRead}`);

      let logData = null;
      try {
        const { data, error } = await supabase.from('activity_logs').insert([{
          user_id: effectiveId,
          book_id: targetBookId,
          action_type: actionType,
          details: details
        }]).select().single();
        if (!error) logData = data;
      } catch (err) {
        console.warn('Notice writing activity_logs:', err);
      }

      // Upsert user_book_progress with accurate real-time page count and progress
      if (targetBookId) {
        const nowIso = new Date().toISOString();
        try {
          const [{ data: existing }, { data: targetBookRow }] = await Promise.all([
            supabase
              .from('user_book_progress')
              .select('*')
              .eq('user_id', effectiveId)
              .eq('book_id', targetBookId)
              .maybeSingle(),
            supabase
              .from('books')
              .select('id, total_pages')
              .eq('id', targetBookId)
              .maybeSingle()
          ]);

          const bookTotalPages = parseInt(body.total_pages || body.totalPages || 0, 10)
            || targetBookRow?.total_pages
            || existing?.total_pages
            || 100;

          const finalPage = pageRead;
          const progressPercentage = Math.min(100, Math.max(1, Math.round((finalPage / bookTotalPages) * 100)));
          const completionStatus = progressPercentage >= 95 ? 'completed' : 'in_progress';

          if (existing) {
            const isDl = actionType === 'download' ? 1 : (existing.is_downloaded || 0);
            const dlCount = actionType === 'download' ? ((existing.downloaded_count || 0) + 1) : (existing.downloaded_count || 0);

            await supabase
              .from('user_book_progress')
              .update({
                last_page_read: finalPage,
                total_pages: bookTotalPages,
                progress_percentage: progressPercentage,
                status: completionStatus,
                accessed_count: (existing.accessed_count || 0) + (actionType === 'open' ? 1 : 0),
                is_downloaded: isDl,
                downloaded_count: dlCount,
                last_accessed_at: nowIso,
                last_active_at: nowIso
              })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('user_book_progress')
              .insert([{
                user_id: effectiveId,
                book_id: targetBookId,
                last_page_read: finalPage,
                total_pages: bookTotalPages,
                progress_percentage: progressPercentage,
                status: completionStatus,
                accessed_count: 1,
                is_downloaded: actionType === 'download' ? 1 : 0,
                downloaded_count: actionType === 'download' ? 1 : 0,
                last_accessed_at: nowIso,
                last_active_at: nowIso
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
        const brBooks = enrichedBooksList.filter(b => b.branch_id === br.id || isSameBranch(b.branch_name, br.name));
        const brStudents = enrichedStudentsList.filter(s => isSameBranch(s.branch_name, br.name));

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
        const brBooks = enrichedBooksList.filter(b => b.branch_id === br.id || isSameBranch(b.branch_name, br.name));
        const sortedBrBooks = [...brBooks].sort((a, b) => b.total_activity - a.total_activity);
        const topBrBook = sortedBrBooks[0];

        if (topBrBook && topBrBook.total_activity > 0) {
          return {
            id: topBrBook.id,
            book_id: topBrBook.id,
            branch_id: br.id,
            branch_name: br.name,
            has_activity: true,
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
      const mappedAccessLogs = viewLogs.map(l => {
        const rawBk = l.book || booksListRaw.find(b => b.id === l.book_id);
        const rawUsr = l.user || usersListRaw.find(u => u.id === l.user_id);
        const bookBranchId = rawBk?.branch_id || null;
        const bookBranchObj = branchesList.find(br => br.id === bookBranchId);
        const bookBranchName = bookBranchObj ? bookBranchObj.name : (rawBk?.branch?.name || null);
        const userBranchName = rawUsr?.branch_name || null;

        return {
          id: l.id,
          created_at: l.created_at,
          action_type: l.action_type,
          details: l.details,
          user_id: l.user_id,
          user_name: rawUsr?.full_name || 'Student / Reader',
          roll_number: rawUsr?.roll_number || 'N/A',
          branch_name: bookBranchName || userBranchName || 'Academic Faculty',
          user_branch_name: userBranchName,
          book_branch_id: bookBranchId,
          book_branch_name: bookBranchName,
          book_id: l.book_id,
          book_title: rawBk?.title || 'Library E-Book Resource',
          book_author: rawBk?.author || 'Academic Author',
          cover_url: rawBk?.cover_url || null
        };
      });

      const mappedDownloadLogs = downloadLogs.map(l => {
        const rawBk = l.book || booksListRaw.find(b => b.id === l.book_id);
        const rawUsr = l.user || usersListRaw.find(u => u.id === l.user_id);
        const bookBranchId = rawBk?.branch_id || null;
        const bookBranchObj = branchesList.find(br => br.id === bookBranchId);
        const bookBranchName = bookBranchObj ? bookBranchObj.name : (rawBk?.branch?.name || null);
        const userBranchName = rawUsr?.branch_name || null;

        return {
          id: l.id,
          created_at: l.created_at,
          action_type: l.action_type,
          details: l.details,
          user_id: l.user_id,
          user_name: rawUsr?.full_name || 'Student / Reader',
          roll_number: rawUsr?.roll_number || 'N/A',
          branch_name: bookBranchName || userBranchName || 'Academic Faculty',
          user_branch_name: userBranchName,
          book_branch_id: bookBranchId,
          book_branch_name: bookBranchName,
          book_id: l.book_id,
          book_title: rawBk?.title || 'Library E-Book Resource',
          book_author: rawBk?.author || 'Academic Author',
          cover_url: rawBk?.cover_url || null
        };
      });

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
      const effectiveId = user?.id && isValidUuid(user.id) ? user.id : (user?.id ? toDeterministicUuid(user.id) : null);
      if (!effectiveId) return [];
      try {
        const [{ data: logsData, error: logError }, { data: progressData }] = await Promise.all([
          supabase.from('activity_logs').select('*, book:book_id(title, author)').eq('user_id', effectiveId).order('created_at', { ascending: false }).limit(20),
          supabase.from('user_book_progress').select('*, book:book_id(title, author, total_pages)').eq('user_id', effectiveId)
        ]);
        if (logError) {
          console.warn('Notice loading my-history activity logs:', logError.message);
          return [];
        }

        const progressMap = new Map((progressData || []).map(p => [p.book_id, p]));
        const progressByTitle = new Map((progressData || []).map(p => [p.book?.title, p]));

        return (logsData || []).map(l => {
          const prog = progressMap.get(l.book_id) || (l.book?.title ? progressByTitle.get(l.book.title) : null);
          const parsedPage = l.details?.match(/page (\d+)/i)?.[1] ? parseInt(l.details.match(/page (\d+)/i)[1], 10) : 1;
          return {
            ...l,
            book_title: l.book ? l.book.title : null,
            book_author: l.book ? l.book.author : null,
            last_page_read: prog ? (prog.last_page_read || 1) : parsedPage,
            total_pages: prog?.total_pages || prog?.book?.total_pages || 100,
            progress_percentage: prog?.progress_percentage || 0
          };
        });
      } catch (err) {
        console.warn('Error loading my-history:', err.message);
        return [];
      }
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

  const loadUser = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) {
        setLoading(true);
      }

      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !currentSession) {
        clearSession();
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

      // Enforce email confirmation for standard email/password accounts
      if (!isGoogleUser && !currentSession.user.email_confirmed_at) {
        console.warn('[Auth] Unverified email session detected. Signing out.');
        await supabase.auth.signOut();
        clearSession();
        setLoading(false);
        return;
      }

      let { data, error } = await supabase
        .from('users')
        .select('id, username, full_name, roll_number, branch_name, year, semester, bt_number, role, status, is_blocked, auth_provider, avatar_url')
        .eq('id', authUserId)
        .maybeSingle();

      // For Google users: if no record by authUserId exists yet, check if profile exists by email to prevent duplicate accounts
      if (!data && isGoogleUser && currentSession.user.email) {
        const userEmail = currentSession.user.email.toLowerCase();
        const { data: matchedUser } = await supabase
          .from('users')
          .select('id, username, full_name, roll_number, branch_name, year, semester, bt_number, role, status, is_blocked, auth_provider, avatar_url')
          .or(`username.ilike.${userEmail},roll_number.ilike.${userEmail}`)
          .maybeSingle();

        if (matchedUser) {
          data = matchedUser;
          // Associate the existing record with authUserId
          if (matchedUser.id !== authUserId) {
            try {
              await supabase.from('users').update({
                id: authUserId,
                auth_provider: 'google',
                avatar_url: matchedUser.avatar_url || currentSession.user.user_metadata?.avatar_url || currentSession.user.user_metadata?.picture || null
              }).eq('id', matchedUser.id);
              data.id = authUserId;
            } catch (linkErr) {
              console.warn('[Auth] Account linking note:', linkErr?.message);
            }
          }
        }
      }

      if (!error && data) {
        if (data.is_blocked === 1) {
          await supabase.auth.signOut();
          clearSession();
          return;
        }

        const googleAvatar = isGoogleUser
          ? (currentSession.user.user_metadata?.avatar_url || currentSession.user.user_metadata?.picture || currentSession.user.identities?.[0]?.identity_data?.avatar_url || currentSession.user.identities?.[0]?.identity_data?.picture || null)
          : null;

        if (googleAvatar && !data.avatar_url) {
          try {
            await supabase.from('users').update({ avatar_url: googleAvatar }).eq('id', data.id);
            data.avatar_url = googleAvatar;
          } catch (avErr) {
            console.warn('[Auth] Avatar sync notice:', avErr);
          }
        }

        const resolvedAvatar = data.avatar_url || googleAvatar || null;

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
          avatarUrl: resolvedAvatar,
          avatar_url: resolvedAvatar
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

  // Realtime user status watcher (for pending students to enter portal automatically upon admin approval without refresh)
  useEffect(() => {
    if (!user || user.status !== 'pending') return;

    let userChannel = null;
    try {
      userChannel = supabase
        .channel(`realtime-user-approval-${user.id}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${user.id}`
          },
          (payload) => {
            if (payload.new && payload.new.status && payload.new.status !== 'pending') {
              console.log('Realtime user approval received:', payload.new.status);
              loadUser(true);
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime user channel subscribe note:', e.message);
    }

    const pollTimer = setInterval(() => {
      loadUser(true);
    }, 3000);

    return () => {
      if (userChannel) supabase.removeChannel(userChannel);
      clearInterval(pollTimer);
    };
  }, [user?.id, user?.status, loadUser]);

  const login = async (identifier, password) => {
    const trimmedId = (identifier || '').trim();
    const trimmedPass = (password || '').trim();
    const idLower = trimmedId.toLowerCase();

    // 1. Central Library Administrator shorthand
    let primaryAuthEmail = null;
    if (idLower === 'admin' || idLower === 'sistec.library' || idLower === 'sistec.library@sistec.ac.in') {
      primaryAuthEmail = 'sistec.library@sistec.ac.in';
    }

    // 2. Search database by username, roll_number, or bt_number
    let userRecord = null;
    let matchedUsers = [];
    try {
      const cleanSearch = trimmedId.replace(/[,()]/g, '').trim();
      const prefixSearch = cleanSearch.includes('@') ? cleanSearch.split('@')[0] : cleanSearch;
      
      const filterConditions = [
        `username.ilike.${cleanSearch}`,
        `roll_number.ilike.${cleanSearch}`,
        `bt_number.ilike.${cleanSearch}`
      ];
      if (cleanSearch !== prefixSearch) {
        filterConditions.push(`username.ilike.${prefixSearch}`);
        filterConditions.push(`roll_number.ilike.${prefixSearch}`);
      }

      const { data: foundUsers, error: matchErr } = await supabase
        .from('users')
        .select('*')
        .or(filterConditions.join(','))
        .order('created_at', { ascending: false });

      if (!matchErr && foundUsers && foundUsers.length > 0) {
        matchedUsers = foundUsers;
        // Prioritize exact match if available
        const exactMatch = foundUsers.find(u => 
          (u.username && u.username.toLowerCase() === cleanSearch.toLowerCase()) ||
          (u.roll_number && u.roll_number.toLowerCase() === cleanSearch.toLowerCase()) ||
          (u.bt_number && u.bt_number.toLowerCase() === cleanSearch.toLowerCase()) ||
          (u.username && u.username.toLowerCase() === prefixSearch.toLowerCase())
        );
        userRecord = exactMatch || foundUsers[0];
      }
    } catch (lookupErr) {
      console.warn('[Auth] Identifier lookup notice:', lookupErr?.message);
    }

    // 3. Build candidate authentication emails to attempt against Supabase Auth
    const candidates = [];
    if (primaryAuthEmail) {
      candidates.push(primaryAuthEmail);
    }

    if (matchedUsers.length > 0) {
      for (const u of matchedUsers) {
        if (u.username) {
          const usr = u.username.trim();
          if (usr.includes('@')) {
            const emailLower = usr.toLowerCase();
            if (!candidates.includes(emailLower)) candidates.push(emailLower);
          } else {
            const cleanSlug = usr.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
            const slugEmail = `${cleanSlug}@sistec.local`;
            if (!candidates.includes(slugEmail)) candidates.push(slugEmail);
          }
        }
        if (u.roll_number) {
          const cleanRoll = u.roll_number.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
          const rollEmail = `${cleanRoll}@sistec.local`;
          if (!candidates.includes(rollEmail)) candidates.push(rollEmail);
        }
      }
    }

    if (trimmedId.includes('@') && !candidates.includes(idLower)) {
      candidates.push(idLower);
    }

    const directSlug = `${idLower.replace(/[^a-z0-9_.-]/g, '')}@sistec.local`;
    if (!candidates.includes(directSlug)) {
      candidates.push(directSlug);
    }

    // 4. Authenticate securely via Supabase Auth
    let authData = null;
    let authError = null;
    let successfulEmail = null;

    for (const candEmail of candidates) {
      const { data: resData, error: resError } = await supabase.auth.signInWithPassword({
        email: candEmail,
        password: trimmedPass
      });

      if (resData?.user) {
        authData = resData;
        successfulEmail = candEmail;
        authError = null;
        break;
      } else {
        authError = resError;
      }
    }

    // 5. CRITICAL CHECK: If this student's account is PENDING approval in institutional database:
    // Never show 'Invalid credentials' error! Immediately transition to the Approval Pending screen.
    if (userRecord && userRecord.role === 'student' && userRecord.status === 'pending') {
      const formattedPendingUser = {
        id: userRecord.id,
        username: userRecord.username,
        fullName: userRecord.full_name,
        role: 'student',
        status: 'pending',
        branchName: userRecord.branch_name || '',
        branch_name: userRecord.branch_name || '',
        rollNumber: userRecord.roll_number,
        year: userRecord.year,
        semester: userRecord.semester,
        btNumber: userRecord.bt_number,
        authProvider: userRecord.auth_provider || 'password',
        avatarUrl: userRecord.avatar_url
      };

      localStorage.setItem('lib_custom_user', JSON.stringify(formattedPendingUser));
      setUser(formattedPendingUser);
      if (authData?.session) {
        setSession(authData.session);
      }
      return formattedPendingUser;
    }

    // 6. If user's registration was rejected by administrator:
    if (userRecord && userRecord.role === 'student' && userRecord.status === 'rejected') {
      await supabase.auth.signOut();
      throw new Error('Your registration was rejected by the library administrator. Please connect with your department library in-charge.');
    }

    if (authError || !authData?.user) {
      const errMsg = (authError?.message || '').toLowerCase();
      if (errMsg.includes('email not confirmed') || errMsg.includes('not confirmed') || authError?.code === 'email_not_confirmed') {
        const targetEmail = successfulEmail || candidates[0];
        if (!targetEmail.endsWith('@sistec.local')) {
          const isOfficialAdmin = targetEmail === 'sistec.library@sistec.ac.in' || KNOWN_DEPARTMENT_ADMINS[targetEmail];
          if (isOfficialAdmin) {
            throw new Error(`Admin account email (${targetEmail}) is not yet confirmed in Supabase. Please open Supabase Dashboard > Authentication > Users, find ${targetEmail}, and click "Confirm Email".`);
          }
          const unverifiedErr = new Error('Please verify your email before continuing.');
          unverifiedErr.isUnverified = true;
          unverifiedErr.email = targetEmail;
          throw unverifiedErr;
        }
      }
      throw new Error('Invalid email/username or password. Please verify your credentials.');
    }

    const authEmail = successfulEmail;

    // Require email confirmation only for real external emails
    if (!authData.user.email_confirmed_at && !authEmail.endsWith('@sistec.local')) {
      await supabase.auth.signOut();
      clearSession();
      const unverifiedErr = new Error('Please verify your email before continuing.');
      unverifiedErr.isUnverified = true;
      unverifiedErr.email = authEmail;
      throw unverifiedErr;
    }

    // Query or refresh user profile from database by authenticated user id
    const { data: recordsById } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .limit(1);

    if (recordsById && recordsById.length > 0) {
      userRecord = recordsById[0];
    } else if (matchedUsers.length > 0) {
      userRecord = matchedUsers.find(u => u.id === authData.user.id) || matchedUsers[0];
    }

    // If still not found, match by username or email for admin account linking:
    if (!userRecord && authEmail) {
      const { data: matchedRecords } = await supabase
        .from('users')
        .select('*')
        .or(`username.ilike.${authEmail},username.ilike.sistec.library,roll_number.ilike.${trimmedId}`)
        .limit(1);

      if (matchedRecords && matchedRecords.length > 0) {
        userRecord = matchedRecords[0];
        try {
          await supabase.from('users').update({
            id: authData.user.id,
            username: userRecord.username || authEmail
          }).eq('id', userRecord.id);
          userRecord.id = authData.user.id;
        } catch (linkErr) {
          console.warn('Account link notice:', linkErr);
        }
      }
    }

    // Auto-provision department or central admin profile in users table if needed
    const isDeptBranch = KNOWN_DEPARTMENT_ADMINS[authEmail];
    const isCentral = authEmail === 'sistec.library@sistec.ac.in';
    if (!userRecord && (isDeptBranch || isCentral)) {
      const newAdminData = {
        id: authData.user.id,
        username: authEmail,
        full_name: isCentral ? 'Central Library Administrator' : `${isDeptBranch} Library Admin`,
        role: 'admin',
        status: 'approved',
        branch_name: isCentral ? 'Central Library' : isDeptBranch,
        auth_provider: 'credentials',
        is_blocked: 0
      };
      try {
        const { data: createdAdmin } = await supabase.from('users').upsert([newAdminData]).select().single();
        if (createdAdmin) userRecord = createdAdmin;
        else userRecord = newAdminData;
      } catch {
        userRecord = newAdminData;
      }
    }

    // Auto-heal student profile if missing from database
    if (!userRecord && authData?.user) {
      const meta = authData.user.user_metadata || {};
      const fallbackStudent = {
        id: authData.user.id,
        username: meta.username || authEmail.split('@')[0],
        full_name: meta.full_name || 'Student',
        roll_number: meta.roll_number || trimmedId,
        branch_name: meta.branch_name || 'CSE (Computer Science & Engineering)',
        year: meta.year || '1st Year',
        semester: meta.semester || '1st Semester',
        bt_number: meta.bt_number || 'N/A',
        role: 'student',
        status: 'approved',
        is_blocked: 0,
        auth_provider: 'password'
      };
      try {
        const { data: createdStudent } = await supabase.from('users').upsert([fallbackStudent]).select().single();
        userRecord = createdStudent || fallbackStudent;
      } catch {
        userRecord = fallbackStudent;
      }
    }

    if (!userRecord) {
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
    setSession(authData.session);

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

    localStorage.setItem('lib_custom_user', JSON.stringify(formattedUser));
    setUser(formattedUser);
    setNeedsProfile(false);
    setPendingGoogleUser(null);

    // Clean up query param if view=complete-profile exists
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'complete-profile') {
        params.delete('view');
        const newSearch = params.toString() ? `?${params.toString()}` : window.location.pathname;
        window.history.replaceState(null, '', newSearch);
      }
    }

    if (initialStatus === 'approved') {
      return { message: 'Profile completed and approved! Welcome to SISTEC Library.', status: 'approved' };
    } else {
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

  const resendVerificationEmail = async (email) => {
    const trimmedEmail = (email || '').trim().toLowerCase();
    if (!trimmedEmail) {
      throw new Error('Email address is required to resend verification.');
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: trimmedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    });

    if (error) {
      throw new Error(error.message || 'Failed to resend verification email. Please try again.');
    }

    return {
      success: true,
      message: 'Verification link resent successfully! Please check your inbox and spam folder.'
    };
  };

  const register = async (userData) => {
    const {
      username,
      email,
      password,
      confirmPassword,
      fullName,
      rollNumber,
      branchName,
      year,
      semester,
      btNumber
    } = userData;

    const trimmedUsername = (username || email || '').trim();
    const cleanUserSlug = trimmedUsername.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    const trimmedFullName = (fullName || '').trim();
    const trimmedRoll = (rollNumber || '').trim();
    const trimmedBt = (btNumber || '').trim();

    if (!trimmedUsername) {
      throw new Error('Username is required.');
    }

    if (trimmedUsername.length < 3) {
      throw new Error('Username must be at least 3 characters.');
    }

    if (!trimmedFullName || !trimmedRoll || !trimmedBt || !branchName || !year || !semester) {
      throw new Error('Please fill in all student registration fields.');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      throw new Error('Passwords do not match. Please re-enter your password.');
    }

    const authEmail = trimmedUsername.includes('@')
      ? trimmedUsername.toLowerCase()
      : `${cleanUserSlug}@sistec.local`;

    // Check if user already exists in public.users by username or roll_number
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id, username, roll_number')
      .or(`username.ilike.${trimmedUsername},roll_number.ilike.${trimmedRoll}`)
      .limit(1);

    const existingUser = existingUsers && existingUsers.length > 0 ? existingUsers[0] : null;

    if (existingUser) {
      if (existingUser.username && existingUser.username.toLowerCase() === trimmedUsername.toLowerCase()) {
        throw new Error('This username is already taken. Please choose another username.');
      }
      if (existingUser.roll_number && existingUser.roll_number.toLowerCase() === trimmedRoll.toLowerCase()) {
        throw new Error('An account with this enrollment / roll number is already registered.');
      }
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: authEmail,
      password: password,
      options: {
        data: {
          username: trimmedUsername,
          full_name: trimmedFullName,
          roll_number: trimmedRoll,
          branch_name: branchName,
          year,
          semester,
          bt_number: trimmedBt
        }
      }
    });

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
        throw new Error('An account with this username already exists. Please proceed to sign in.');
      }
      throw new Error(authError.message);
    }

    if (!authData?.user) {
      throw new Error('Registration failed. Please try again.');
    }

    // Check active registration policy
    const policy = await getSystemRegistrationPolicy();
    const initialStatus = policy === 'auto_approve' ? 'approved' : policy === 'auto_reject' ? 'rejected' : 'pending';

    const userId = authData.user.id;

    const { data, error } = await supabase.from('users').upsert([{
      id: userId,
      username: trimmedUsername,
      full_name: trimmedFullName,
      roll_number: trimmedRoll,
      branch_name: branchName,
      year,
      semester,
      bt_number: trimmedBt,
      role: 'student',
      status: initialStatus,
      is_blocked: 0,
      auth_provider: 'password'
    }], { onConflict: 'id' }).select().single();

    if (error) {
      console.warn('Profile creation notice:', error);
    }

    // Insert activity log for registration audit trail
    try {
      await supabase.from('activity_logs').insert([{
        user_id: userId,
        action_type: 'registration',
        details: `Student account registered (${initialStatus}) by ${trimmedFullName} (${trimmedRoll}) - Username: ${trimmedUsername}`
      }]);
    } catch (logErr) {
      console.warn('Registration activity log notice:', logErr);
    }

    // Realtime notification for administrators about new student registration
    try {
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id, branch_name')
        .eq('role', 'admin');

      if (adminUsers && adminUsers.length > 0) {
        const regNotifs = adminUsers.map(adm => ({
          user_id: adm.id,
          title: 'New Student Registration',
          message: `${trimmedFullName} (${trimmedRoll || 'N/A'}) has registered for ${branchName}. Status: ${initialStatus}.`,
          type: 'student',
          is_read: false
        }));
        await supabase.from('notifications').insert(regNotifs);
      }
    } catch (notifErr) {
      console.warn('Admin registration notification note:', notifErr);
    }

    await supabase.auth.signOut();

    let confirmationMessage = 'Your account has been registered successfully! Please wait for the library administrator to approve your account. Once approved, you can sign in with your Username/Roll Number and Password.';
    if (initialStatus === 'approved') {
      confirmationMessage = 'Your account has been registered and automatically approved! You can now sign in.';
    } else if (initialStatus === 'rejected') {
      confirmationMessage = 'Registration was received but automatically marked rejected per current policy.';
    }

    return {
      message: confirmationMessage,
      status: initialStatus,
      needsVerification: false,
      data: {
        username: trimmedUsername,
        fullName: trimmedFullName,
        rollNumber: trimmedRoll,
        btNumber: trimmedBt,
        branchName,
        year,
        semester
      }
    };
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading, login, logout, register,
      resendVerificationEmail,
      loginWithGoogle, completeGoogleProfile, needsProfile,
      pendingGoogleUser, apiCall, refreshUser: loadUser,
      extractDriveFileId, normalizeBranch, isSameBranch, canonicalBranch
    }}>
      {children}
    </AuthContext.Provider>
  );
};
