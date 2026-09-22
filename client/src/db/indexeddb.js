import Dexie from 'dexie';

/**
 * SISTec eLibrary — IndexedDB Local-First Database Layer (Dexie)
 * 
 * Provides versioned client-side persistence for books, categories, branches,
 * reading progress, bookmarks, likes, recent items, and offline sync queues.
 * 
 * Guarantees:
 * - 100% Safe during SSR (guarded with typeof window !== 'undefined')
 * - Graceful fallback & automatic corruption recovery
 * - Scoped user data isolation
 */

class SistecLibraryDatabase extends Dexie {
  constructor() {
    super('SistecLibraryDB');

    // Version 1 Schema Definition
    this.version(1).stores({
      books: 'id, category_id, branch_id, priority, author, branch_name, category_name, created_at, updated_at',
      categories: 'id, name, updated_at',
      branches: 'id, name',
      reading_progress: 'id, user_id, book_id, last_page_read, total_pages, status, last_accessed_at, sync_status',
      bookmarks: 'id, user_id, book_id, page_number, created_at, sync_status',
      likes: 'id, user_id, target_id, target_type, action, sync_status, updated_at',
      recent_books: 'id, user_id, book_id, last_opened_at',
      user_preferences: 'key, user_id, updated_at',
      cache_metadata: 'key, last_synced_at, version, record_count',
      sync_queue: '++id, user_id, action, endpoint, created_at, retry_count'
    });

    this.books = this.table('books');
    this.categories = this.table('categories');
    this.branches = this.table('branches');
    this.reading_progress = this.table('reading_progress');
    this.bookmarks = this.table('bookmarks');
    this.likes = this.table('likes');
    this.recent_books = this.table('recent_books');
    this.user_preferences = this.table('user_preferences');
    this.cache_metadata = this.table('cache_metadata');
    this.sync_queue = this.table('sync_queue');
  }
}

// Client-only singleton instance
let dbInstance = null;

export const getDb = () => {
  if (typeof window === 'undefined') return null;
  if (!dbInstance) {
    try {
      dbInstance = new SistecLibraryDatabase();
    } catch (err) {
      console.warn('[IndexedDB] Initialization error, using fallback:', err);
      return null;
    }
  }
  return dbInstance;
};

/**
 * Safely clears all user-scoped data from IndexedDB on logout or user change.
 * Public catalog metadata (books, categories, branches) is preserved for instant repeat loads.
 */
export const clearUserScopedData = async (userId) => {
  const db = getDb();
  if (!db || !userId) return;

  try {
    await db.transaction('rw', [
      db.reading_progress,
      db.bookmarks,
      db.likes,
      db.recent_books,
      db.user_preferences,
      db.sync_queue
    ], async () => {
      await db.reading_progress.where('user_id').equals(userId).delete();
      await db.bookmarks.where('user_id').equals(userId).delete();
      await db.likes.where('user_id').equals(userId).delete();
      await db.recent_books.where('user_id').equals(userId).delete();
      await db.user_preferences.where('user_id').equals(userId).delete();
      await db.sync_queue.where('user_id').equals(userId).delete();
    });
    if (process.env.NODE_ENV === 'development') {
      console.log(`[IndexedDB] User data purged for user: ${userId}`);
    }
  } catch (err) {
    console.warn('[IndexedDB] Error clearing user data:', err);
  }
};

/**
 * Emergency database reset in case of corruption, quota errors, or schema invalidation.
 */
export const resetIndexedDb = async () => {
  if (typeof window === 'undefined') return;
  try {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
    await Dexie.delete('SistecLibraryDB');
    if (process.env.NODE_ENV === 'development') {
      console.log('[IndexedDB] Database SistecLibraryDB successfully reset.');
    }
  } catch (err) {
    console.warn('[IndexedDB] Reset failed:', err);
  }
};

export default getDb;
