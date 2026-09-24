import * as pdfjsLib from 'pdfjs-dist';

// Configure worker for pdfjs-dist in modern Vite / browser environments
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

/**
 * Extracts the first page of a PDF file as a high-quality JPEG image data URL.
 * @param {File|Blob|ArrayBuffer} fileOrBuffer - The PDF file or buffer.
 * @param {Object} options - { maxWidth?: number, quality?: number, title?: string, author?: string }
 * @returns {Promise<string>} Base64 data URL of the cover image.
 */
export async function extractFirstPageAsCover(fileOrBuffer, options = {}) {
  const { maxWidth = 450, quality = 0.85, title = '', author = '' } = options;

  try {
    let arrayBuffer;
    if (fileOrBuffer instanceof ArrayBuffer) {
      arrayBuffer = fileOrBuffer;
    } else if (fileOrBuffer && typeof fileOrBuffer.arrayBuffer === 'function') {
      arrayBuffer = await fileOrBuffer.arrayBuffer();
    } else {
      throw new Error('Invalid PDF data source provided for cover extraction');
    }

    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      stopAtErrors: false
    });

    const pdfDoc = await loadingTask.promise;
    if (pdfDoc.numPages < 1) {
      throw new Error('PDF document contains 0 pages');
    }

    const firstPage = await pdfDoc.getPage(1);
    const unscaledViewport = firstPage.getViewport({ scale: 1.0 });

    const scale = Math.min(2.0, maxWidth / unscaledViewport.width);
    const viewport = firstPage.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const context = canvas.getContext('2d', { alpha: false });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    await firstPage.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return dataUrl;
  } catch (err) {
    console.warn('PDF first-page extraction fallback engaged:', err.message);
    return generateFallbackCover(title || 'Academic Reference', author || 'SISTec Library');
  }
}

/**
 * Generates an aesthetic gradient cover image using canvas as a resilient fallback.
 */
export function generateFallbackCover(title = 'Library Resource', author = 'SISTec Portal') {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 560;
  const ctx = canvas.getContext('2d');

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, 400, 560);
  grad.addColorStop(0, '#1e293b');
  grad.addColorStop(0.5, '#0f172a');
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 400, 560);

  // Decorative border
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, 368, 528);

  // Header accent
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(30, 30, 40, 4);

  // Title
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  const words = String(title).slice(0, 80).split(' ');
  let line = '';
  let y = 140;
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > 320 && i > 0) {
      ctx.fillText(line, 40, y);
      line = words[i] + ' ';
      y += 32;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 40, y);

  // Author
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 15px system-ui, -apple-system, sans-serif';
  ctx.fillText(String(author).slice(0, 45), 40, y + 45);

  // Footer badge
  ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
  ctx.fillRect(40, 480, 140, 26);
  ctx.fillStyle = '#60a5fa';
  ctx.font = '600 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('SISTEC DIGITAL', 52, 497);

  return canvas.toDataURL('image/jpeg', 0.85);
}
