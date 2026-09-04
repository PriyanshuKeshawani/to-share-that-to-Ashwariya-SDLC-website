/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export const BASE_URL = typeof window !== 'undefined' ? (window.location.port ? `${window.location.protocol}//${window.location.hostname}:5000` : window.location.origin) : '';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);

  // Clear local session state
  const clearSession = () => {
    localStorage.removeItem('lib_custom_user');
    setUser(null);
    setSession(null);
    setNeedsProfile(false);
    setPendingGoogleUser(null);
  };

  // Comprehensive Supabase Router for frontend actions
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

    // 3. Books & PDF Storage
    if (endpoint === '/books' || endpoint.startsWith('/books/')) {
      if (endpoint === '/books' && method === 'GET') {
        const { data, error } = await supabase.from('books').select(`
          *,
          category:category_id(name),
          branch:branch_id(name),
          copies:physical_book_copies(id, status)
        `).order('created_at', { ascending: false });
        if (error) throw error;
        
        let approvedBranches = [];
        if (user && user.role === 'student') {
          try {
            const { data: perms } = await supabase
              .from('permissions')
              .select('branch_id')
              .eq('user_id', user.id)
              .eq('status', 'approved');
            approvedBranches = (perms || []).map(p => p.branch_id);
          } catch {}

          const localPerms = JSON.parse(localStorage.getItem('sistec_demo_permissions') || '[]');
          const demoApproved = localPerms
            .filter(p => (p.user_id === user.id || p.user_id === 'demo-student') && p.status === 'approved')
            .map(p => p.branch_id);
          approvedBranches = [...new Set([...approvedBranches, ...demoApproved])];
        }

        return (data || []).map(b => {
          let hasAccess = true;
          if (user && user.role === 'student') {
            hasAccess = (b.branch_name === user.branchName) || approvedBranches.includes(b.branch_id);
          }
          const availableCopies = (b.copies || []).filter(c => c.status === 'available').length;
          const totalCopies = (b.copies || []).length;
          return {
            ...b,
            category_name: b.category ? b.category.name : null,
            branch_name: b.branch ? b.branch.name : null,
            hasAccess,
            availableCopies,
            totalCopies
          };
        });
      }

      // Bulk Upload Books (multiple PDFs)
      if (endpoint === '/books/bulk' && method === 'POST' && options.body instanceof FormData) {
        const formData = options.body;
        const category_id = parseInt(formData.get('category_id'));
        const branch_id = parseInt(formData.get('branch_id'));
        const priority = formData.get('priority');
        const sharedAuthor = (formData.get('author') || '').trim() || 'Unknown';
        const pdfFiles = formData.getAll('pdfs');

        let imported = 0, skipped = 0, errors = 0;
        const results = [];

        for (const pdfFile of pdfFiles) {
          const rawName = pdfFile.name.replace(/\.pdf$/i, '');
          const title = rawName.replace(/[_\-]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

          try {
            const { data: existing } = await supabase
              .from('books')
              .select('id')
              .eq('title', title)
              .eq('branch_id', branch_id)
              .maybeSingle();

            if (existing) {
              skipped++;
              results.push({ file: pdfFile.name, title, status: 'skipped', reason: 'Already exists' });
              continue;
            }

            const fileName = `${Date.now()}-${pdfFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
            let pdf_url = null;
            const { error: uploadErr } = await supabase.storage
              .from('pdfs')
              .upload(fileName, pdfFile, { upsert: true });

            if (!uploadErr) {
              const { data: publicUrlData } = supabase.storage.from('pdfs').getPublicUrl(fileName);
              pdf_url = publicUrlData ? publicUrlData.publicUrl : null;
            } else {
              console.warn('Storage upload note for', pdfFile.name, ':', uploadErr.message);
              if (pdfFile.size <= 8 * 1024 * 1024) {
                pdf_url = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result);
                  reader.onerror = () => resolve(null);
                  reader.readAsDataURL(pdfFile);
                }).catch(() => null);
              }
            }

            const bookPayload = { title, author: sharedAuthor, category_id, branch_id, priority };
            if (pdf_url) bookPayload.pdf_url = pdf_url;

            const { data: inserted, error: insertErr } = await supabase
              .from('books')
              .insert([bookPayload])
              .select()
              .single();

            if (insertErr) throw insertErr;

            imported++;
            results.push({ file: pdfFile.name, title, status: 'success', bookId: inserted.id });
          } catch (err) {
            errors++;
            results.push({ file: pdfFile.name, title, status: 'error', reason: err.message });
          }
        }

        return {
          message: `Bulk import complete: ${imported} added, ${skipped} skipped, ${errors} errors`,
          imported,
          skipped,
          errors,
          results
        };
      }

      // Add or Edit Book with PDF file
      if (options.body instanceof FormData) {
        const formData = options.body;
        const title = formData.get('title');
        const author = formData.get('author');
        const category_id = parseInt(formData.get('category_id'));
        const branch_id = parseInt(formData.get('branch_id'));
        const priority = formData.get('priority');
        const pdfFile = formData.get('pdf');

        let pdf_url = null;
        if (pdfFile && pdfFile.name) {
          const fileName = `${Date.now()}-${pdfFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
          const { error: uploadErr } = await supabase.storage
            .from('pdfs')
            .upload(fileName, pdfFile, { upsert: true });

          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage.from('pdfs').getPublicUrl(fileName);
            pdf_url = publicUrlData ? publicUrlData.publicUrl : null;
          } else {
            console.warn('Supabase storage upload notice:', uploadErr.message);
            // Resilient fallback: Convert to Base64 Data URL so PDF upload succeeds even before storage bucket is created
            if (pdfFile.size <= 8 * 1024 * 1024) {
              pdf_url = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = (e) => reject(e);
                reader.readAsDataURL(pdfFile);
              }).catch(() => null);
            }
            if (!pdf_url) {
              throw new Error(`PDF upload failed: ${uploadErr.message}. Ensure 'pdfs' bucket exists in Supabase storage.`);
            }
          }
        }

        const bookPayload = { title, author, category_id, branch_id, priority };
        if (pdf_url) bookPayload.pdf_url = pdf_url;

        if (endpoint.startsWith('/books/') && method === 'PUT') {
          const bookId = endpoint.split('/').pop();
          const { data, error } = await supabase.from('books').update(bookPayload).eq('id', bookId).select().single();
          if (error) throw error;
          return { message: 'Book updated successfully', data };
        } else {
          const { data, error } = await supabase.from('books').insert([bookPayload]).select().single();
          if (error) throw error;
          return { message: 'Book created successfully', data };
        }
      }

      // Delete Single Book
      if (endpoint.startsWith('/books/') && method === 'DELETE') {
        const bookId = endpoint.split('/').pop();
        const { error } = await supabase.from('books').delete().eq('id', bookId);
        if (error) throw error;
        return { message: 'Book deleted successfully' };
      }

      // Bulk Delete Books
      if (endpoint === '/books/bulk-delete' && method === 'POST') {
        const { bookIds } = body;
        const { error } = await supabase.from('books').delete().in('id', bookIds);
        if (error) throw error;
        return { message: 'Selected books deleted successfully' };
      }

      if (method === 'POST') {
        const { data, error } = await supabase.from('books').insert([body]).select().single();
        if (error) throw error;
        return data;
      }
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

    // Approve / Reject User
    if (endpoint.startsWith('/auth/approve-user/')) {
      const userId = endpoint.split('/').pop();
      const { data, error } = await supabase.from('users').update({ status: body.status }).eq('id', userId).select().single();
      if (error) throw error;
      return { message: `User status updated to ${body.status}`, data };
    }

    // Block User
    if (endpoint.endsWith('/block')) {
      const parts = endpoint.split('/');
      const userId = parts[parts.length - 2];
      const { data, error } = await supabase.from('users').update({ is_blocked: 1 }).eq('id', userId).select().single();
      if (error) throw error;
      return { message: 'User blocked', data };
    }

    // Unblock User
    if (endpoint.endsWith('/unblock')) {
      const parts = endpoint.split('/');
      const userId = parts[parts.length - 2];
      const { data, error } = await supabase.from('users').update({ is_blocked: 0 }).eq('id', userId).select().single();
      if (error) throw error;
      return { message: 'User unblocked', data };
    }

    // Delete single user
    if (endpoint.startsWith('/auth/users/') && method === 'DELETE') {
      const userId = endpoint.split('/').pop();
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
      return { message: 'User deleted' };
    }

    // Bulk delete users
    if (endpoint === '/auth/users/bulk-delete') {
      const { userIds } = body;
      const { error } = await supabase.from('users').delete().in('id', userIds);
      if (error) throw error;
      return { message: 'Users deleted successfully' };
    }

    // Complete Student Activity History Endpoint
    if (endpoint.startsWith('/students/') && endpoint.endsWith('/activity') && method === 'GET') {
      const studentId = endpoint.split('/')[2];
      
      const [
        { data: studentUser },
        { data: loansData },
        { data: sessionsData },
        { data: activeTable },
        { data: bookProgress },
        { data: permissionsData },
        { data: activityLogs }
      ] = await Promise.all([
        supabase.from('users').select('*').eq('id', studentId).maybeSingle(),
        supabase.from('book_loans').select(`
          *,
          copy:copy_id(copy_uuid, qr_code, book:book_id(title, author, category_id, branch_id))
        `).eq('user_id', studentId).order('created_at', { ascending: false }),
        supabase.from('library_sessions').select(`
          *,
          table:table_id(table_number, room:room_id(name))
        `).eq('user_id', studentId).order('created_at', { ascending: false }),
        supabase.from('tables').select('*, room:room_id(name)').eq('current_occupant_id', studentId).maybeSingle(),
        supabase.from('user_book_progress').select(`
          *,
          book:book_id(title, author, category:category_id(name), branch:branch_id(name))
        `).eq('user_id', studentId).order('last_accessed_at', { ascending: false }),
        supabase.from('permissions').select('*, branch:branch_id(name)').eq('user_id', studentId).order('created_at', { ascending: false }),
        supabase.from('activity_logs').select('*, book:book_id(title)').eq('user_id', studentId).order('created_at', { ascending: false }).limit(50)
      ]);

      const formattedLoans = (loansData || []).map(l => ({
        ...l,
        book_title: l.copy?.book?.title || 'Unknown Title',
        book_author: l.copy?.book?.author || 'Unknown Author',
        copy_uuid: l.copy?.copy_uuid || null,
        qr_code: l.copy?.qr_code || null
      }));

      const formattedSessions = (sessionsData || []).map(s => ({
        ...s,
        table_number: s.table?.table_number || 'N/A',
        room_name: s.table?.room?.name || 'Reading Hall'
      }));

      const totalLoansCount = formattedLoans.length;
      const activeLoans = formattedLoans.filter(l => l.status === 'issued');
      const returnedLoans = formattedLoans.filter(l => l.status === 'returned');
      const overdueLoans = formattedLoans.filter(l => l.status === 'overdue');
      const totalFine = formattedLoans.reduce((sum, l) => sum + (parseFloat(l.fine_amount) || 0), 0);
      const totalStudyMinutes = formattedSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

      return {
        student: studentUser,
        stats: {
          totalLoans: totalLoansCount,
          activeLoansCount: activeLoans.length,
          returnedLoansCount: returnedLoans.length,
          overdueLoansCount: overdueLoans.length,
          totalFine,
          totalSessions: formattedSessions.length,
          totalStudyMinutes,
          eBooksRead: (bookProgress || []).length
        },
        currentDesk: activeTable ? {
          table_id: activeTable.id,
          table_number: activeTable.table_number,
          room_name: activeTable.room?.name || 'Library',
          session_started_at: activeTable.session_started_at
        } : null,
        loans: formattedLoans,
        sessions: formattedSessions,
        bookProgress: bookProgress || [],
        permissions: permissionsData || [],
        logs: activityLogs || []
      };
    }

    // 5. Permissions / Requests
    if (endpoint === '/permissions/pending-requests') {
      let serverRequests = [];
      try {
        const { data, error } = await supabase.from('permissions').select('*, user:user_id(full_name, roll_number, branch_name), branch:branch_id(name)').eq('status', 'pending').order('created_at', { ascending: false });
        if (!error && data) serverRequests = data;
      } catch (e) {
        console.warn('Notice loading server permissions:', e);
      }

      // Merge local demo permissions
      const localPerms = JSON.parse(localStorage.getItem('sistec_demo_permissions') || '[]').filter(p => p.status === 'pending');
      const { data: allBranches } = await supabase.from('branches').select('id, name');
      const branchMap = new Map((allBranches || []).map(b => [b.id, b.name]));

      const enrichedLocal = localPerms.map(p => ({
        ...p,
        full_name: 'Demo Student (CS)',
        roll_number: '0187CS211001',
        student_branch: 'Computer Science and Engineering',
        requested_branch_name: branchMap.get(p.branch_id) || 'Requested Branch'
      }));

      const combined = [...serverRequests, ...enrichedLocal];
      return combined.map(p => ({
        ...p,
        full_name: p.user ? p.user.full_name : (p.full_name || 'Student'),
        roll_number: p.user ? p.user.roll_number : (p.roll_number || 'N/A'),
        student_branch: p.user ? p.user.branch_name : (p.student_branch || 'Engineering'),
        requested_branch_name: p.branch ? p.branch.name : (p.requested_branch_name || 'Branch')
      }));
    }

    if (endpoint === '/permissions/my-requests') {
      if (!user) return [];
      let serverRequests = [];
      try {
        const { data, error } = await supabase.from('permissions').select('*, branch:branch_id(name)').eq('user_id', user.id);
        if (!error && data) serverRequests = data;
      } catch (e) {
        console.warn('Notice loading my permissions:', e);
      }

      // Merge local demo permissions
      const localPerms = JSON.parse(localStorage.getItem('sistec_demo_permissions') || '[]');
      const userLocal = localPerms.filter(p => p.user_id === user.id);

      const { data: allBranches } = await supabase.from('branches').select('id, name');
      const branchMap = new Map((allBranches || []).map(b => [b.id, b.name]));

      const combined = [...serverRequests, ...userLocal];
      const unique = [];
      const seen = new Set();
      for (const req of combined) {
        if (!seen.has(req.branch_id)) {
          seen.add(req.branch_id);
          unique.push({
            ...req,
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
      return { message: `Permission ${body.status}`, data };
    }

    if (endpoint === '/permissions/request' && method === 'POST') {
      const branchId = parseInt(body.branchId || body.branch_id, 10);

      // 1. Resolve valid user_id for Supabase foreign key
      let effectiveUserId = user?.id;
      if (user?.id) {
        const { data: userRow } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle();
        if (!userRow) {
          // If demo user or unlinked UUID, map to an existing student in users table
          const { data: anyStudent } = await supabase.from('users').select('id').eq('role', 'student').limit(1).maybeSingle();
          if (anyStudent) {
            effectiveUserId = anyStudent.id;
          }
        }
      }

      // 2. Check for existing request
      let existing = null;
      if (effectiveUserId) {
        try {
          const { data: ex } = await supabase
            .from('permissions')
            .select('id, status')
            .eq('user_id', effectiveUserId)
            .eq('branch_id', branchId)
            .maybeSingle();
          existing = ex;
        } catch {}
      }

      const localPerms = JSON.parse(localStorage.getItem('sistec_demo_permissions') || '[]');
      const localExisting = localPerms.find(p => p.branch_id === branchId && (p.user_id === user?.id || p.user_id === effectiveUserId));

      if (existing || localExisting) {
        const currentStatus = existing?.status || localExisting?.status;
        if (currentStatus === 'pending') {
          throw new Error('You already have a pending request for this branch');
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

      // 3. Attempt database insert
      let insertErr = null;
      if (effectiveUserId) {
        try {
          const { data, error } = await supabase.from('permissions').insert([{
            user_id: effectiveUserId,
            branch_id: branchId,
            status: 'pending'
          }]).select().single();
          if (!error && data) return data;
          insertErr = error;
        } catch (e) {
          insertErr = e;
        }
      }

      // 4. Fallback for demo/bypass accounts to prevent foreign key errors
      console.warn('Saved permission in demo storage fallback:', insertErr?.message);
      const demoPerm = {
        id: `demo-perm-${Date.now()}`,
        user_id: user?.id || 'demo-student',
        branch_id: branchId,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      localPerms.push(demoPerm);
      localStorage.setItem('sistec_demo_permissions', JSON.stringify(localPerms));
      return demoPerm;
    }

    // 6. Physical Book Copies
    if (endpoint === '/book-copies' && method === 'GET') {
      const { data, error } = await supabase.from('physical_book_copies').select('*, book:book_id(title, author)').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(c => ({
        ...c,
        book_title: c.book ? c.book.title : null,
        book_author: c.book ? c.book.author : null
      }));
    }

    if (endpoint === '/book-copies' && method === 'POST') {
      const { data, error } = await supabase.from('physical_book_copies').insert([body]).select().single();
      if (error) throw error;
      return { message: 'Book copy added successfully', data };
    }

    if (endpoint.startsWith('/book-copies/') && method === 'PUT') {
      const copyId = endpoint.split('/').pop();
      const { data, error } = await supabase.from('physical_book_copies').update(body).eq('id', copyId).select().single();
      if (error) throw error;
      return { message: 'Book copy updated', data };
    }

    if (endpoint.startsWith('/book-copies/') && method === 'DELETE') {
      const copyId = endpoint.split('/').pop();
      const { error } = await supabase.from('physical_book_copies').delete().eq('id', copyId);
      if (error) throw error;
      return { message: 'Book copy deleted' };
    }

    if (endpoint.startsWith('/book-copies/by-uuid/')) {
      const uuid = endpoint.split('/').pop();
      const { data, error } = await supabase.from('physical_book_copies').select('*, book:book_id(*)').eq('copy_uuid', uuid).single();
      if (error) throw error;
      return data;
    }

    // 7. Book Loans (Issue / Return)
    if (endpoint === '/book-loans' && method === 'GET') {
      const { data, error } = await supabase.from('book_loans').select(`
        *,
        copy:copy_id(copy_uuid, qr_code, book:book_id(title, author)),
        user:user_id(full_name, roll_number, branch_name)
      `).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(l => ({
        ...l,
        book_title: l.copy?.book?.title || null,
        book_author: l.copy?.book?.author || null,
        copy_uuid: l.copy?.copy_uuid || null,
        borrower_name: l.user ? l.user.full_name : null,
        borrower_roll: l.user ? l.user.roll_number : null,
        borrower_branch: l.user ? l.user.branch_name : null
      }));
    }

    if (endpoint === '/book-loans/my' && method === 'GET') {
      if (!user) return [];
      const { data, error } = await supabase.from('book_loans').select(`
        *,
        copy:copy_id(copy_uuid, qr_code, book:book_id(title, author))
      `).eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(l => ({
        ...l,
        book_title: l.copy?.book?.title || null,
        book_author: l.copy?.book?.author || null,
        copy_uuid: l.copy?.copy_uuid || null,
        qr_code: l.copy?.qr_code || null
      }));
    }

    if (endpoint === '/book-loans' && method === 'POST') {
      // Issue a book
      const { copy_id, user_id, due_date } = body;
      
      // Check if copy is already issued
      const { data: existingLoan } = await supabase
        .from('book_loans')
        .select('id')
        .eq('copy_id', copy_id)
        .eq('status', 'issued')
        .maybeSingle();
      
      if (existingLoan) {
        throw new Error('This book copy is already issued to another student');
      }

      const { data, error } = await supabase.from('book_loans').insert([{
        copy_id,
        user_id: user_id || user.id,
        due_date,
        status: 'issued'
      }]).select().single();
      if (error) throw error;

      // Update copy status
      await supabase.from('physical_book_copies').update({ status: 'issued' }).eq('id', copy_id);

      // Create notification
      if (user_id || user.id) {
        await supabase.from('notifications').insert([{
          user_id: user_id || user.id,
          title: 'Book Issued',
          message: `A book has been issued to you. Due date: ${new Date(due_date).toLocaleDateString()}`,
          type: 'loan'
        }]);
      }

      return { message: 'Book issued successfully', data };
    }

    if (endpoint.startsWith('/book-loans/') && endpoint.endsWith('/return') && method === 'POST') {
      const loanId = endpoint.split('/')[2];
      const now = new Date().toISOString();
      
      const { data: loan, error: loanErr } = await supabase
        .from('book_loans')
        .select('*, copy:copy_id(id)')
        .eq('id', loanId)
        .single();
      
      if (loanErr || !loan) throw new Error('Loan not found');

      const fineAmount = body.fine_amount || 0;

      const { data, error } = await supabase.from('book_loans').update({
        returned_at: now,
        status: 'returned',
        fine_amount: fineAmount
      }).eq('id', loanId).select().single();
      if (error) throw error;

      // Update copy status back to available
      if (loan.copy) {
        await supabase.from('physical_book_copies').update({ status: 'available' }).eq('id', loan.copy.id);
      }

      // Create notification
      await supabase.from('notifications').insert([{
        user_id: loan.user_id,
        title: 'Book Returned',
        message: fineAmount > 0 
          ? `Your book has been returned. Fine of ₹${fineAmount} has been applied.`
          : 'Your book has been returned successfully. No fine applied.',
        type: 'return'
      }]);

      return { message: 'Book returned successfully', data };
    }

    if (endpoint.startsWith('/book-loans/') && endpoint.endsWith('/approve') && method === 'POST') {
      const loanId = endpoint.split('/')[2];
      const { data, error } = await supabase.from('book_loans').update({ status: body.status }).eq('id', loanId).select().single();
      if (error) throw error;
      return { message: `Loan ${body.status}`, data };
    }

    if (endpoint.startsWith('/book-loans/') && endpoint.endsWith('/fine') && method === 'POST') {
      const loanId = endpoint.split('/')[2];
      const { data, error } = await supabase.from('book_loans').update({ fine_amount: body.fine_amount }).eq('id', loanId).select().single();
      if (error) throw error;

      // Audit log for fine override
      if (user) {
        await supabase.from('activity_logs').insert([{
          user_id: user.id,
          action_type: 'admin_action',
          details: `Fine overridden to ₹${body.fine_amount} for loan ${loanId}`
        }]);
      }

      return { message: 'Fine updated', data };
    }

    // 8. Notifications
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

    // 9. Rooms & Tables
    if (endpoint === '/rooms' && method === 'GET') {
      const { data, error } = await supabase.from('rooms').select('*, tables(*)').order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    }

    // Bulk Rooms & Tables Creation
    if (endpoint === '/rooms/bulk' && method === 'POST') {
      const { rooms: bulkRooms } = body;
      if (!Array.isArray(bulkRooms) || bulkRooms.length === 0) {
        throw new Error('No rooms specified for bulk creation');
      }

      const createdRooms = [];
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

      for (let i = 0; i < bulkRooms.length; i++) {
        const r = bulkRooms[i];
        const roomPayload = {
          name: r.name,
          description: r.description || `Capacity: ${r.seatsCount || 60} study desks`
        };

        const { data: newRoom, error: roomErr } = await supabase.from('rooms').insert([roomPayload]).select().single();
        if (roomErr) throw roomErr;
        createdRooms.push(newRoom);

        // Generate tables for this room
        const seats = Math.max(1, parseInt(r.seatsCount, 10) || 60);
        const cols = 10;
        const tablesPayload = [];

        for (let s = 0; s < seats; s++) {
          const rowIdx = Math.floor(s / cols);
          const colIdx = (s % cols) + 1;
          const rowLetter = alphabet[rowIdx] || `R${rowIdx + 1}`;
          const seatCode = `${rowLetter}-${colIdx}`;
          const qrId = `TABLE-R${newRoom.id}-${seatCode}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

          tablesPayload.push({
            room_id: newRoom.id,
            table_number: seatCode,
            qr_identifier: qrId,
            status: 'free'
          });
        }

        if (tablesPayload.length > 0) {
          const { error: tablesErr } = await supabase.from('tables').insert(tablesPayload);
          if (tablesErr) console.warn(`Error inserting tables for room ${newRoom.id}:`, tablesErr.message);
        }
      }

      return { message: `Successfully created ${createdRooms.length} rooms`, data: createdRooms };
    }

    if (endpoint === '/rooms' && method === 'POST') {
      const { data, error } = await supabase.from('rooms').insert([body]).select().single();
      if (error) throw error;
      return { message: 'Room created', data };
    }

    if (endpoint.startsWith('/rooms/') && method === 'PUT') {
      const roomId = endpoint.split('/').pop();
      const { data, error } = await supabase.from('rooms').update(body).eq('id', roomId).select().single();
      if (error) throw error;
      return { message: 'Room updated', data };
    }

    if (endpoint.startsWith('/rooms/') && method === 'DELETE') {
      const roomId = endpoint.split('/').pop();
      const { error } = await supabase.from('rooms').delete().eq('id', roomId);
      if (error) throw error;
      return { message: 'Room deleted' };
    }

    if (endpoint === '/tables' && method === 'GET') {
      const { data, error } = await supabase.from('tables').select('*, room:room_id(name), current_occupant:current_occupant_id(full_name, roll_number)').order('table_number', { ascending: true });
      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        room_name: t.room ? t.room.name : null,
        occupant_name: t.current_occupant ? t.current_occupant.full_name : null,
        occupant_roll: t.current_occupant ? t.current_occupant.roll_number : null
      }));
    }

    if (endpoint === '/tables' && method === 'POST') {
      const qrId = body.qr_identifier || `TABLE-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const payload = { ...body, qr_identifier: qrId };
      const { data, error } = await supabase.from('tables').insert([payload]).select().single();
      if (error) throw error;
      return { message: 'Table added', data };
    }

    if (endpoint.startsWith('/tables/') && method === 'PUT') {
      const tableId = endpoint.split('/').pop();
      const { data, error } = await supabase.from('tables').update(body).eq('id', tableId).select().single();
      if (error) throw error;
      return { message: 'Table updated', data };
    }

    if (endpoint.startsWith('/tables/') && method === 'DELETE') {
      const tableId = endpoint.split('/').pop();
      const { error } = await supabase.from('tables').delete().eq('id', tableId);
      if (error) throw error;
      return { message: 'Table deleted' };
    }

    if (endpoint.startsWith('/tables/by-qr/')) {
      const qrId = endpoint.split('/').pop();
      const { data, error } = await supabase.from('tables').select('*, room:room_id(name)').eq('qr_identifier', qrId).single();
      if (error) throw error;
      return data;
    }

    if (endpoint === '/tables/check-in' && method === 'POST') {
      const { table_id, user_id: checkinUserId } = body;
      const uid = checkinUserId || user?.id;
      if (!uid) throw new Error('User not authenticated');

      // Check if table is already occupied
      const { data: table } = await supabase.from('tables').select('*').eq('id', table_id).single();
      if (table && table.current_occupant_id && table.current_occupant_id !== uid) {
        throw new Error('This table is already occupied by another student');
      }

      // End previous session if any
      await supabase.from('library_sessions')
        .update({ exited_at: new Date().toISOString(), duration_minutes: Math.floor((Date.now() - new Date(table?.session_started_at || Date.now()).getTime()) / 60000) })
        .eq('user_id', uid)
        .is('exited_at', null);

      // Update table
      await supabase.from('tables').update({
        current_occupant_id: uid,
        session_started_at: new Date().toISOString(),
        status: 'occupied'
      }).eq('id', table_id);

      // Create session
      const { data: sessionData, error: sessionErr } = await supabase.from('library_sessions').insert([{
        user_id: uid,
        table_id: table_id
      }]).select().single();
      if (sessionErr) throw sessionErr;

      return { message: 'Checked in successfully', data: sessionData };
    }

    if (endpoint === '/tables/check-out' && method === 'POST') {
      const { user_id: checkoutUserId } = body;
      const uid = checkoutUserId || user?.id;
      if (!uid) throw new Error('User not authenticated');

      // Find active session
      const { data: activeSession } = await supabase.from('library_sessions')
        .select('*')
        .eq('user_id', uid)
        .is('exited_at', null)
        .maybeSingle();

      if (activeSession) {
        const duration = Math.floor((Date.now() - new Date(activeSession.entered_at).getTime()) / 60000);
        await supabase.from('library_sessions').update({
          exited_at: new Date().toISOString(),
          duration_minutes: duration
        }).eq('id', activeSession.id);

        // Free the table
        await supabase.from('tables').update({
          current_occupant_id: null,
          session_started_at: null,
          status: 'free'
        }).eq('id', activeSession.table_id);
      }

      return { message: 'Checked out successfully' };
    }

    // 10. Library Sessions
    if (endpoint === '/library-sessions' && method === 'GET') {
      const { data, error } = await supabase.from('library_sessions').select(`
        *, 
        user:user_id(full_name, roll_number),
        table:table_id(table_number, room:room_id(name))
      `).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data || []).map(s => ({
        ...s,
        user_name: s.user ? s.user.full_name : null,
        user_roll: s.user ? s.user.roll_number : null,
        table_number: s.table ? s.table.table_number : null,
        room_name: s.table?.room ? s.table.room.name : null
      }));
    }

    if (endpoint === '/library-sessions/my-current' && method === 'GET') {
      if (!user) return null;
      const { data, error } = await supabase.from('library_sessions').select(`
        *, 
        table:table_id(table_number, room:room_id(name))
      `).eq('user_id', user.id).is('exited_at', null).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        table_number: data.table ? data.table.table_number : null,
        room_name: data.table?.room ? data.table.room.name : null
      };
    }

    // 11. Library Settings
    if (endpoint === '/library-settings' && method === 'GET') {
      const { data, error } = await supabase.from('library_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data || { loan_duration_days: 14, fine_per_day: 5, max_fine: 200 };
    }

    if (endpoint === '/library-settings' && method === 'PUT') {
      const { data: existing } = await supabase.from('library_settings').select('id').limit(1).maybeSingle();
      if (existing) {
        const { data, error } = await supabase.from('library_settings').update(body).eq('id', existing.id).select().single();
        if (error) throw error;
        return { message: 'Settings updated', data };
      } else {
        const { data, error } = await supabase.from('library_settings').insert([body]).select().single();
        if (error) throw error;
        return { message: 'Settings created', data };
      }
    }

    // 11b. Seating Layout Templates (Database-backed directly in Supabase)
    if (endpoint === '/seating-templates' && method === 'GET') {
      try {
        const { data, error } = await supabase
          .from('activity_logs')
          .select('id, details, created_at')
          .eq('action_type', 'seating_template')
          .order('created_at', { ascending: true });
        
        if (error) {
          console.warn('Could not fetch templates from DB:', error.message);
          return [];
        }

        const templates = (data || []).map(row => {
          try {
            const parsed = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
            return { ...parsed, db_id: row.id };
          } catch {
            return null;
          }
        }).filter(Boolean);

        return templates;
      } catch (err) {
        console.warn('Error reading seating templates:', err);
        return [];
      }
    }

    if (endpoint === '/seating-templates' && method === 'POST') {
      const templateData = body;
      let uid = user?.id;
      if (uid && uid.startsWith('00000000-')) uid = null;

      const { data, error } = await supabase.from('activity_logs').insert([{
        user_id: uid,
        action_type: 'seating_template',
        details: JSON.stringify(templateData)
      }]).select().single();
      
      if (error) throw error;
      return { message: 'Template saved directly to database', data };
    }

    if (endpoint.startsWith('/seating-templates/') && method === 'DELETE') {
      const targetId = endpoint.split('/').pop();
      const { data: records } = await supabase
        .from('activity_logs')
        .select('id, details')
        .eq('action_type', 'seating_template');
      
      const found = (records || []).find(r => {
        try {
          const parsed = JSON.parse(r.details);
          return parsed.id === targetId || String(r.id) === String(targetId);
        } catch {
          return false;
        }
      });

      if (found) {
        const { error } = await supabase.from('activity_logs').delete().eq('id', found.id);
        if (error) throw error;
      }
      return { message: 'Template deleted from database' };
    }

    // 12. Analytics & Logs
    if (endpoint === '/analytics/track' && method === 'POST') {
      if (!user) return null;
      const { data, error } = await supabase.from('activity_logs').insert([{
        user_id: user.id,
        book_id: body.bookId || null,
        action_type: body.actionType || 'view',
        details: body.details || 'Viewed book'
      }]).select().single();
      if (error) throw error;
      return data;
    }

    if (endpoint === '/analytics/dashboard') {
      const [{ count: totalStudents }, { count: totalBooks }, { count: totalDownloads }, { count: totalViews }, { count: totalLogins }, { count: totalLogouts }, { count: totalLoans }, { count: totalActiveLoans }, { count: totalFines }] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('books').select('*', { count: 'exact', head: true }),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('action_type', 'download'),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('action_type', 'view'),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('action_type', 'login'),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('action_type', 'logout'),
        supabase.from('book_loans').select('*', { count: 'exact', head: true }),
        supabase.from('book_loans').select('*', { count: 'exact', head: true }).eq('status', 'issued'),
        supabase.from('book_loans').select('*', { count: 'exact', head: true }).gt('fine_amount', 0)
      ]);

      const { data: logsData } = await supabase.from('activity_logs').select('*, user:user_id(full_name, role, roll_number), book:book_id(title)').order('created_at', { ascending: false }).limit(10);

      return {
        stats: {
          logins: totalLogins || 0,
          logouts: totalLogouts || 0,
          downloads: totalDownloads || 0,
          views: totalViews || 0,
          books: totalBooks || 0,
          students: totalStudents || 0,
          totalLoans: totalLoans || 0,
          activeLoans: totalActiveLoans || 0,
          finesCount: totalFines || 0
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

  // 1-Click Bypass login for demo/testing
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

  // Restore User Session
  const loadUser = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Check if user is logged in via credentials/admin session or bypass
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

      // 2. Check Supabase session
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !currentSession) {
        if (!savedUserStr) clearSession();
        return;
      }

      setSession(currentSession);
      const authUserId = currentSession.user.id;

      // Detect Google OAuth user robustly across all Supabase metadata structures
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
        // Google user authenticated in Supabase but no profile in users table yet
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
    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === 'SIGNED_OUT') {
        clearSession();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadUser();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [loadUser]);

  // Login with institutional credentials or student username
  const login = async (identifier, password) => {
    const trimmedId = (identifier || '').trim();
    const trimmedPass = (password || '').trim();
    const idLower = trimmedId.toLowerCase();

    // 1. Official Institutional Central Library Admin Authentication
    const isAdminCandidate = 
      idLower === 'sistec.library@sistec.ac.in' ||
      idLower === 'admin' ||
      idLower === 'sistec.library';

    if (isAdminCandidate) {
      if (trimmedPass !== 'Kalpana2680#') {
        throw new Error('Invalid password for Institutional Central Library Administrator.');
      }

      // Check if official admin user row exists in Supabase users table
      let adminId = '0271446c-5515-4406-9c4d-19fe5d4e9c9a';
      try {
        const { data: dbAdmin } = await supabase
          .from('users')
          .select('id, full_name, avatar_url')
          .eq('role', 'admin')
          .limit(1)
          .maybeSingle();
        if (dbAdmin) {
          adminId = dbAdmin.id;
        }
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

    // 2. If user attempted admin login with wrong password
    if (idLower === 'sistec.library@sistec.ac.in' || idLower === 'admin' || idLower === 'sistec.library') {
      throw new Error('Invalid password for Institutional Administrator.');
    }

    // 3. Regular Student / Faculty Authentication via Supabase Auth
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

  // Login with Google OAuth
  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  };

  // Complete Google profile for first-time users
  const completeGoogleProfile = async (profileData) => {
    if (!pendingGoogleUser) throw new Error('No pending Google user');

    const { username, fullName, rollNumber, branchName, year, semester, btNumber } = profileData;

    // Check username uniqueness
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

    // Auto-approve student profiles registered via Google sign-in
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

  // Logout
  const logout = async () => {
    if (user) {
      try {
        // Auto check-out from any table
        await apiCall('/tables/check-out', { method: 'POST', body: JSON.stringify({}) });

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

  // Register
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
      bypassLogin
    }}>
      {children}
    </AuthContext.Provider>
  );
};
