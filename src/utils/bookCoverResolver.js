import { extractFirstPageAsCover, generateFallbackCover } from './pdfCoverExtractor.js';

/**
 * Validates if an image URL points to a legitimate, loadable image.
 * Uses an Image object with timeout to avoid hanging network calls.
 * @param {string} url 
 * @param {number} timeoutMs 
 * @returns {Promise<boolean>}
 */
export async function validateImageUrl(url, timeoutMs = 4000) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;

  return new Promise((resolve) => {
    const img = new Image();
    let timer = setTimeout(() => {
      img.src = '';
      resolve(false);
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      // Ensure image is not a 1x1 tracking pixel or empty stub
      if (img.naturalWidth > 10 && img.naturalHeight > 10) {
        resolve(true);
      } else {
        resolve(false);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };

    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

/**
 * Attempts to retrieve book cover from Open Library via ISBN.
 * @param {string} isbn 
 * @returns {Promise<string|null>}
 */
export async function fetchCoverFromOpenLibrary(isbn) {
  if (!isbn) return null;
  const cleanIsbn = String(isbn).replace(/[^0-9X]/gi, '').trim();
  if (!cleanIsbn || cleanIsbn.length < 9) return null;

  try {
    const candidateUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`;
    const isValid = await validateImageUrl(candidateUrl, 3500);
    if (isValid) {
      return candidateUrl;
    }
  } catch (err) {
    console.warn(`OpenLibrary cover lookup failed for ISBN ${cleanIsbn}:`, err.message);
  }
  return null;
}

/**
 * Attempts to retrieve book cover from Google Books API using ISBN, or title + author.
 * Validates metadata to ensure no random unrelated books are used.
 * @param {Object} params { isbn?: string, title?: string, author?: string }
 * @returns {Promise<string|null>}
 */
export async function fetchCoverFromGoogleBooks({ isbn, title, author } = {}) {
  try {
    let query = '';
    const cleanIsbn = isbn ? String(isbn).replace(/[^0-9X]/gi, '').trim() : '';

    if (cleanIsbn && cleanIsbn.length >= 9) {
      query = `isbn:${cleanIsbn}`;
    } else if (title) {
      const cleanTitle = title.replace(/[^\w\s]/gi, ' ').trim();
      const cleanAuthor = author ? author.replace(/[^\w\s]/gi, ' ').trim() : '';
      if (cleanAuthor) {
        query = `intitle:${cleanTitle}+inauthor:${cleanAuthor}`;
      } else {
        query = `intitle:${cleanTitle}`;
      }
    } else {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const resp = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3&printType=books`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (!resp.ok) return null;
    const data = await resp.json();

    if (!data.items || data.items.length === 0) return null;

    // Validate that the match shares words with title if queried by title
    for (const item of data.items) {
      const volumeInfo = item.volumeInfo || {};
      const imageLinks = volumeInfo.imageLinks || {};
      let cover = imageLinks.thumbnail || imageLinks.smallThumbnail;

      if (!cover) continue;

      // Ensure HTTPS protocol
      cover = cover.replace(/^http:\/\//i, 'https://');

      // If matching by title, check title similarity
      if (title && !cleanIsbn) {
        const foundTitle = (volumeInfo.title || '').toLowerCase();
        const searchWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const matchCount = searchWords.filter(w => foundTitle.includes(w)).length;
        if (searchWords.length > 0 && matchCount === 0) {
          // Reject unrelated cover
          continue;
        }
      }

      const isValid = await validateImageUrl(cover, 3000);
      if (isValid) {
        return cover;
      }
    }
  } catch (err) {
    console.warn('Google Books cover lookup failed:', err.message);
  }
  return null;
}

/**
 * Master Book Cover Resolution Pipeline:
 * Priority:
 * 1. If PDF File provided -> Extract page 1 via pdfjs-dist
 * 2. If ISBN provided -> OpenLibrary -> Google Books
 * 3. If Title (+ Author) -> Google Books with title similarity check
 * 4. Resilient Fallback -> High-res aesthetic Canvas cover
 * 
 * @param {Object} options
 * @returns {Promise<{ coverUrl: string, source: 'pdf_page_1'|'open_library'|'google_books'|'generated_fallback' }>}
 */
export async function resolveBookCover({
  title = '',
  author = '',
  isbn = '',
  branchName = '',
  categoryName = '',
  pdfFile = null
} = {}) {
  // 1. Try PDF Page 1 extraction if PDF file is present
  if (pdfFile && (pdfFile instanceof File || pdfFile instanceof Blob || pdfFile instanceof ArrayBuffer)) {
    try {
      const pdfCover = await extractFirstPageAsCover(pdfFile, {
        title,
        author,
        maxWidth: 500,
        quality: 0.9
      });
      if (pdfCover && pdfCover.startsWith('data:image/')) {
        return {
          coverUrl: pdfCover,
          source: 'pdf_page_1'
        };
      }
    } catch (err) {
      console.warn('PDF Page 1 extraction error, continuing down pipeline:', err);
    }
  }

  // 2. Try ISBN matching via OpenLibrary
  if (isbn) {
    const olCover = await fetchCoverFromOpenLibrary(isbn);
    if (olCover) {
      return {
        coverUrl: olCover,
        source: 'open_library'
      };
    }

    // Google Books by ISBN
    const gbIsbnCover = await fetchCoverFromGoogleBooks({ isbn, title, author });
    if (gbIsbnCover) {
      return {
        coverUrl: gbIsbnCover,
        source: 'google_books'
      };
    }
  }

  // 3. Try Title + Author via Google Books
  if (title) {
    const gbCover = await fetchCoverFromGoogleBooks({ title, author });
    if (gbCover) {
      return {
        coverUrl: gbCover,
        source: 'google_books'
      };
    }
  }

  // 4. Guaranteed Aesthetic Canvas Fallback
  const fallbackCover = generateFallbackCover(title || 'Academic Resource', author || 'SISTec Library Portal');
  return {
    coverUrl: fallbackCover,
    source: 'generated_fallback'
  };
}
