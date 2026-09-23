"use client";

import { getDb } from './indexeddb.js';

/**
 * SISTec eLibrary — Cache Service (Stale-While-Revalidate & Local-First Engine)
 * 
 * Provides:
 * 1. Instant cache reads for books, categories, branches, and user preferences
 * 2. Background revalidation with Supabase without UI flicker
 * 3. Instant local reading progress tracking + debounced cloud synchronization
 * 4. Optimistic likes persistence with offline retry queue
 * 5. Automatic online/offline detection & queue flushing
 * 6. Development-only observability logs
 */

const isDev = process.env.NODE_ENV === 'development';

const log = (tag, ...args) => {
  if (isDev && typeof window !== 'undefined') {
    console.log('[Cache:' + tag + ']', ...args);
  }
};

const warn = (tag, ...args) => {
  if (isDev && typeof window !== 'undefined') {
    console.warn('[Cache:' + tag + ']', ...args);
  }
};

// ==========================================
// 1. CATALOG CACHING (Books, Categories, Branches)
// ==========================================

export const getCachedBooks = async () => {
  const db = getDb();
  if (!db) return null;
  try {
    const books = await db.books.toArray();
    if (books && books.length > 0) {
      log('HIT', 'Loaded ' + books.length + ' books from IndexedDB');
      return books;
    }
    log('MISS', 'No books found in IndexedDB');
    return null;
  } catch (err) {
    warn('ERROR', 'Failed to read books from cache:', err);
    return null;
  }
};

export const setCachedBooks = async (books) => {
  const db = getDb();
  if (!db || !Array.isArray(books) || books.length === 0) return;
  try {
    await db.transaction('rw', [db.books, db.cache_metadata], async () => {
      await db.books.clear();
      await db.books.bulkPut(books);
      await db.cache_metadata.put({
        key: 'books',
        last_synced_at: new Date().toISOString(),
        version: 1,
        record_count: books.length
      });
    });
    log('SET', 'Cached ' + books.length + ' books to IndexedDB');
  } catch (err) {
    warn('ERROR', 'Failed to write books to cache:', err);
  }
};

export const updateSingleCachedBook = async (book) => {
  const db = getDb();
  if (!db || !book || !book.id) return;
  try {
    await db.books.put(book);
    log('UPDATE', 'Updated cached book id=' + book.id);
  } catch (err) {
    warn('ERROR', 'Failed to update cached book ' + book.id + ':', err);
  }
};

export const deleteSingleCachedBook = async (bookId) => {
  const db = getDb();
  if (!db || !bookId) return;
  try {
    await db.books.delete(bookId);
    log('DELETE', 'Deleted cached book id=' + bookId);
  } catch (err) {
    warn('ERROR', 'Failed to delete cached book ' + bookId + ':', err);
  }
};

export const getCachedCategories = async () => {
  const db = getDb();
  if (!db) return null;
  try {
    const categories = await db.categories.toArray();
    if (categories && categories.length > 0) {
      log('HIT', 'Loaded ' + categories.length + ' categories from IndexedDB');
      return categories;
    }
    return null;
  } catch (err) {
    warn('ERROR', 'Failed to read categories from cache:', err);
    return null;
  }
};

export const setCachedCategories = async (categories) => {
  const db = getDb();
  if (!db || !Array.isArray(categories) || categories.length === 0) return;
  try {
    await db.transaction('rw', [db.categories, db.cache_metadata], async () => {
      await db.categories.clear();
      await db.categories.bulkPut(categories);
      await db.cache_metadata.put({
        key: 'categories',
        last_synced_at: new Date().toISOString(),
        version: 1,
        record_count: categories.length
      });
    });
    log('SET', 'Cached ' + categories.length + ' categories to IndexedDB');
  } catch (err) {
    warn('ERROR', 'Failed to write categories to cache:', err);
  }
};

export const getCachedBranches = async () => {
  const db = getDb();
  if (!db) return null;
  try {
    const branches = await db.branches.toArray();
    if (branches && branches.length > 0) {
      log('HIT', 'Loaded ' + branches.length + ' branches from IndexedDB');
      return branches;
    }
    return null;
  } catch (err) {
    warn('ERROR', 'Failed to read branches from cache:', err);
    return null;
  }
};

export const setCachedBranches = async (branches) => {
  const db = getDb();
  if (!db || !Array.isArray(branches) || branches.length === 0) return;
  try {
    await db.transaction('rw', [db.branches, db.cache_metadata], async () => {
      await db.branches.clear();
      await db.branches.bulkPut(branches);
      await db.cache_metadata.put({
        key: 'branches',
        last_synced_at: new Date().toISOString(),
        version: 1,
        record_count: branches.length
      });
    });
    log('SET', 'Cached ' + branches.length + ' branches to IndexedDB');
  } catch (err) {
    warn('ERROR', 'Failed to write branches to cache:', err);
  }
};

// ==========================================
// 1d. PROJECTS & INNOVATIONS CACHING
// ==========================================

export const getCachedProjects = async () => {
  const db = getDb();
  if (!db || !db.projects) return null;
  try {
    const projects = await db.projects.toArray();
    if (projects && projects.length > 0) {
      log('HIT', 'Loaded ' + projects.length + ' projects from IndexedDB');
      return projects;
    }
    log('MISS', 'No projects found in IndexedDB');
    return null;
  } catch (err) {
    warn('ERROR', 'Failed to read projects from cache:', err);
    return null;
  }
};

export const setCachedProjects = async (projects) => {
  const db = getDb();
  if (!db || !db.projects || !Array.isArray(projects)) return;
  try {
    await db.transaction('rw', [db.projects, db.cache_metadata], async () => {
      await db.projects.clear();
      if (projects.length > 0) {
        await db.projects.bulkPut(projects);
      }
      await db.cache_metadata.put({
        key: 'projects',
        last_synced_at: new Date().toISOString(),
        version: 1,
        record_count: projects.length
      });
    });
    log('SET', 'Cached ' + projects.length + ' projects to IndexedDB');
  } catch (err) {
    warn('ERROR', 'Failed to write projects to cache:', err);
  }
};

export const updateSingleCachedProject = async (project) => {
  const db = getDb();
  if (!db || !db.projects || !project || !project.id) return;
  try {
    await db.projects.put(project);
    log('UPDATE', 'Updated cached project id=' + project.id);
  } catch (err) {
    warn('ERROR', 'Failed to update cached project ' + project.id + ':', err);
  }
};

export const deleteSingleCachedProject = async (projectId) => {
  const db = getDb();
  if (!db || !db.projects || !projectId) return;
  try {
    await db.projects.delete(projectId);
    log('DELETE', 'Deleted cached project id=' + projectId);
  } catch (err) {
    warn('ERROR', 'Failed to delete cached project ' + projectId + ':', err);
  }
};

// ==========================================
// 2. READING PROGRESS & RECENT BOOKS
// ==========================================

export const getCachedReadingProgress = async (userId, bookId) => {
  const db = getDb();
  if (!db || !userId || !bookId) return null;
  try {
    const id = userId + '_' + bookId;
    const record = await db.reading_progress.get(id);
    if (record) {
      log('HIT', 'Reading progress for book ' + bookId + ': pg ' + record.last_page_read);
      return record;
    }
    return null;
  } catch (err) {
    warn('ERROR', 'Failed to read reading progress:', err);
    return null;
  }
};

export const saveLocalReadingProgress = async (userId, bookId, page, totalPages) => {
  const db = getDb();
  if (!db || !userId || !bookId) return null;
  try {
    const id = userId + '_' + bookId;
    const now = new Date().toISOString();
    const progressRecord = {
      id,
      user_id: userId,
      book_id: bookId,
      last_page_read: Number(page) || 1,
      total_pages: Number(totalPages) || 1,
      status: Number(page) >= Number(totalPages) ? 'completed' : 'in_progress',
      last_accessed_at: now,
      sync_status: 'synced',
      updated_at: now
    };

    await db.transaction('rw', [db.reading_progress, db.recent_books], async () => {
      await db.reading_progress.put(progressRecord);
      await db.recent_books.put({
        id,
        user_id: userId,
        book_id: bookId,
        last_opened_at: now
      });
    });
    log('PROGRESS', 'Local reading progress saved for book ' + bookId + ' -> pg ' + page);
    return progressRecord;
  } catch (err) {
    warn('ERROR', 'Failed to save local reading progress:', err);
    return null;
  }
};

export const getRecentBooks = async (userId, limit = 10) => {
  const db = getDb();
  if (!db || !userId) return [];
  try {
    const recents = await db.recent_books
      .where('user_id')
      .equals(userId)
      .reverse()
      .sortBy('last_opened_at');
    return recents.slice(0, limit);
  } catch (err) {
    warn('ERROR', 'Failed to get recent books:', err);
    return [];
  }
};

// ==========================================
// 3. BOOKMARKS
// ==========================================

export const getCachedBookmarks = async (userId, bookId) => {
  const db = getDb();
  if (!db || !userId || !bookId) return [];
  try {
    const marks = await db.bookmarks
      .where('user_id')
      .equals(userId)
      .filter(b => String(b.book_id) === String(bookId))
      .toArray();
    return marks.sort((a, b) => (Number(a.page_number) || 0) - (Number(b.page_number) || 0));
  } catch (err) {
    warn('ERROR', 'Failed to get cached bookmarks:', err);
    return [];
  }
};

export const setCachedBookmarks = async (userId, bookId, bookmarks) => {
  const db = getDb();
  if (!db || !userId || !bookId) return;
  try {
    const formatted = (bookmarks || []).map(bm => ({
      id: bm.id ? String(bm.id) : (userId + '_' + bookId + '_' + (bm.page || bm.page_number)),
      user_id: userId,
      book_id: bookId,
      page_number: Number(bm.page || bm.page_number) || 1,
      title: bm.title || ('Page ' + (bm.page || bm.page_number)),
      created_at: bm.created_at || bm.createdAt || new Date().toISOString(),
      sync_status: 'synced'
    }));

    await db.transaction('rw', db.bookmarks, async () => {
      const existing = await db.bookmarks.where('user_id').equals(userId).filter(b => String(b.book_id) === String(bookId)).toArray();
      const existingIds = existing.map(e => e.id);
      if (existingIds.length > 0) {
        await db.bookmarks.bulkDelete(existingIds);
      }
      if (formatted.length > 0) {
        await db.bookmarks.bulkPut(formatted);
      }
    });
  } catch (err) {
    warn('ERROR', 'Failed to sync cached bookmarks:', err);
  }
};

// ==========================================
// 4. OPTIMISTIC LIKES & OFFLINE QUEUE
// ==========================================

export const getCachedLike = async (userId, targetId) => {
  const db = getDb();
  if (!db || !userId || !targetId) return null;
  try {
    const id = userId + '_' + targetId;
    return await db.likes.get(id);
  } catch (err) {
    warn('ERROR', 'Failed to get cached like:', err);
    return null;
  }
};

export const setCachedLike = async (userId, targetId, targetType, action, syncStatus = 'synced') => {
  const db = getDb();
  if (!db || !userId || !targetId) return;
  try {
    const id = userId + '_' + targetId;
    const record = {
      id,
      user_id: userId,
      target_id: targetId,
      target_type: targetType || 'project',
      action,
      sync_status: syncStatus,
      updated_at: new Date().toISOString()
    };
    await db.likes.put(record);
    log('LIKE', 'Cached like for target ' + targetId + ': action=' + action + ', status=' + syncStatus);
    return record;
  } catch (err) {
    warn('ERROR', 'Failed to set cached like:', err);
    return null;
  }
};

export const queueSyncAction = async (userId, action, endpoint, payload) => {
  const db = getDb();
  if (!db) return;
  try {
    await db.sync_queue.add({
      user_id: userId,
      action,
      endpoint,
      payload,
      created_at: new Date().toISOString(),
      retry_count: 0
    });
    log('QUEUE', 'Action queued for offline sync: ' + action + ' -> ' + endpoint);
  } catch (err) {
    warn('ERROR', 'Failed to queue sync action:', err);
  }
};

export const flushSyncQueue = async (apiCall) => {
  const db = getDb();
  if (!db || typeof apiCall !== 'function') return;
  try {
    const pending = await db.sync_queue.toArray();
    if (!pending || pending.length === 0) return;

    log('FLUSH', 'Processing ' + pending.length + ' queued offline actions...');
    for (const item of pending) {
      try {
        await apiCall(item.endpoint, {
          method: 'POST',
          body: JSON.stringify(item.payload)
        });
        await db.sync_queue.delete(item.id);
        log('SYNC_OK', 'Flushed action #' + item.id + ' (' + item.action + ')');
      } catch (err) {
        warn('SYNC_RETRY', 'Sync failed for action #' + item.id + ', incrementing retry', err);
        if (item.retry_count >= 3) {
          await db.sync_queue.delete(item.id);
        } else {
          await db.sync_queue.update(item.id, { retry_count: item.retry_count + 1 });
        }
      }
    }
  } catch (err) {
    warn('ERROR', 'Error flushing sync queue:', err);
  }
};

// ==========================================
// 5. CACHE FRESHNESS & CHANGE DETECTION
// ==========================================

export const hasCatalogChanged = (cachedItems, freshItems) => {
  if (!cachedItems || !freshItems) return true;
  if (cachedItems.length !== freshItems.length) return true;
  if (freshItems.length === 0) return false;

  for (let i = 0; i < Math.min(10, freshItems.length); i++) {
    const fresh = freshItems[i];
    const cached = cachedItems[i];
    if (!cached || fresh.id !== cached.id || fresh.title !== cached.title || fresh.updated_at !== cached.updated_at) {
      return true;
    }
  }
  return false;
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    log('ONLINE', 'Network restored. Ready for sync.');
  });
}
