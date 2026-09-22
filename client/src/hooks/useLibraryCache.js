use client;

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getCachedBooks,
  setCachedBooks,
  getCachedCategories,
  setCachedCategories,
  getCachedBranches,
  setCachedBranches,
  hasCatalogChanged,
  flushSyncQueue
} from '../db/cacheService';

/**
 * SISTec eLibrary — useLibraryCache Hook
 * 
 * Implements Stale-While-Revalidate (SWR) for the library catalog:
 * - Reads from IndexedDB immediately (instant rendering in WebView & mobile)
 * - Fetches from Supabase in background
 * - Updates IndexedDB and state only if records changed
 * - Provides offline resilience
 */
export const useLibraryCache = () => {
  const { apiCall } = useAuth();
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const revalidatingRef = useRef(false);

  // 1. Initial Load: Stale-While-Revalidate
  const loadCatalog = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Check offline status
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }

    // Step A: Load from IndexedDB immediately
    try {
      const [cachedB, cachedC, cachedBr] = await Promise.all([
        getCachedBooks(),
        getCachedCategories(),
        getCachedBranches()
      ]);

      if (cachedB && cachedB.length > 0) {
        setBooks(cachedB);
        setIsFromCache(true);
      }
      if (cachedC && cachedC.length > 0) {
        setCategories(cachedC);
      }
      if (cachedBr && cachedBr.length > 0) {
        setBranches(cachedBr);
      }
    } catch (err) {
      console.warn('[useLibraryCache] Cache pre-load error:', err);
    }

    // Step B: Revalidate with Supabase in background (if online)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return; // Stay on cached data if offline
    }

    if (revalidatingRef.current) return;
    revalidatingRef.current = true;
    setIsRevalidating(true);

    try {
      const [freshB, freshC, freshBr] = await Promise.all([
        apiCall('/books').catch(() => null),
        apiCall('/books/categories').catch(() => null),
        apiCall('/books/branches').catch(() => null)
      ]);

      if (freshB && Array.isArray(freshB)) {
        setBooks(prev => {
          if (hasCatalogChanged(prev, freshB)) {
            setCachedBooks(freshB);
            return freshB;
          }
          return prev;
        });
      }

      if (freshC && Array.isArray(freshC)) {
        setCategories(prev => {
          if (hasCatalogChanged(prev, freshC)) {
            setCachedCategories(freshC);
            return freshC;
          }
          return prev;
        });
      }

      if (freshBr && Array.isArray(freshBr)) {
        setBranches(prev => {
          if (hasCatalogChanged(prev, freshBr)) {
            setCachedBranches(freshBr);
            return freshBr;
          }
          return prev;
        });
      }

      // Flush any queued offline actions now that we have connectivity
      flushSyncQueue(apiCall);
    } catch (err) {
      console.warn('[useLibraryCache] Background revalidation note:', err);
    } finally {
      setIsRevalidating(false);
      revalidatingRef.current = false;
    }
  }, [apiCall]);

  useEffect(() => {
    loadCatalog();

    const handleOnline = () => {
      setIsOffline(false);
      loadCatalog();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadCatalog]);

  return {
    books,
    setBooks,
    categories,
    setCategories,
    branches,
    setBranches,
    isFromCache,
    isRevalidating,
    isOffline,
    refreshCatalog: loadCatalog
  };
};

export default useLibraryCache;
