/**
 * SISTEC DIGITAL LIBRARY - PROTECTED PDF URL RESOLVER
 * 
 * Routes book PDF requests through the Cloudflare CDN Bridge:
 * 1. Primary: Hugging Face 100% Private Vault (Token injected at Cloudflare Edge)
 * 2. Fallback: Google Drive Direct Download (Automated on 404 / error)
 * 3. 0ms Edge Caching & Byte-Range Seek support for fast PDF.js streaming.
 */

export const CLOUDFLARE_PDF_CDN = process.env.NEXT_PUBLIC_CLOUDFLARE_PDF_CDN || 'https://sistec-pdf-vault.library-965.workers.dev';

export function getProtectedBookPdfUrl(book) {
  if (!book) return null;

  // If already a Cloudflare CDN URL or data/blob URI, return directly
  if (book.pdf_url && (book.pdf_url.includes('workers.dev') || book.pdf_url.startsWith('data:') || book.pdf_url.startsWith('blob:'))) {
    return book.pdf_url;
  }

  // 1. Identify vault file name
  let vaultFileName = book.vault_file_name || null;
  if (!vaultFileName && book.pdf_url && book.pdf_url.includes('/resolve/main/')) {
    try {
      vaultFileName = decodeURIComponent(book.pdf_url.split('/resolve/main/')[1]);
    } catch {
      vaultFileName = book.pdf_url.split('/resolve/main/')[1];
    }
  }

  // 2. Identify Google Drive file ID
  let driveId = book.drive_file_id || null;
  if (!driveId && book.drive_link) {
    const match = String(book.drive_link).match(/[-\w]{25,}/);
    if (match) driveId = match[0];
  }

  // 3. Construct protected Cloudflare CDN Bridge URL
  if (vaultFileName || driveId) {
    const params = new URLSearchParams();
    if (vaultFileName) params.set('file', vaultFileName);
    if (driveId) params.set('id', driveId);
    return `${CLOUDFLARE_PDF_CDN}?${params.toString()}`;
  }

  // 4. Default fallback to plain URL if available
  if (book.pdf_url && book.pdf_url.startsWith('http')) {
    return book.pdf_url;
  }

  return null;
}
