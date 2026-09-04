import QRCode from 'qrcode';

/**
 * Generates a clean QR code Data URL for display
 * @param {string} text - text to encode (e.g. TABLE-ROOM101-A12)
 * @param {object} options - QRCode styling options
 */
export async function generateQRDataURL(text, options = {}) {
  try {
    return await QRCode.toDataURL(text, {
      width: options.width || 320,
      margin: options.margin || 2,
      color: {
        dark: options.darkColor || '#0a1128',
        light: options.lightColor || '#ffffff',
      },
      errorCorrectionLevel: 'H'
    });
  } catch (err) {
    console.error('Failed to generate QR Data URL:', err);
    return null;
  }
}

/**
 * Generates a high-resolution printable desk badge card and downloads it
 * @param {object} table - table object { id, table_number, qr_identifier }
 * @param {object} room - room object { id, name }
 */
export async function downloadPrintableBadge(table, room) {
  try {
    const qrDataUrl = await generateQRDataURL(table.qr_identifier || `TABLE-${table.id}`, { width: 440 });
    if (!qrDataUrl) throw new Error('Could not generate QR image');

    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await new Promise((resolve, reject) => {
      qrImg.onload = resolve;
      qrImg.onerror = reject;
    });

    // Create printable badge canvas (1200 x 1600 px for ultra sharp 300 DPI print)
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext('2d');

    // 1. Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative outer border
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 14;
    ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

    // Inner subtle border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.strokeRect(60, 60, canvas.width - 120, canvas.height - 120);

    // Top Header Banner
    ctx.fillStyle = '#0a1128';
    ctx.fillRect(60, 60, canvas.width - 120, 240);

    // Header Text
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 36px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SISTec CENTRAL DIGITAL LIBRARY', canvas.width / 2, 140);

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 28px "Outfit", sans-serif';
    ctx.fillText('OFFICIAL STUDY DESK PASS', canvas.width / 2, 200);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 22px "Outfit", sans-serif';
    ctx.fillText('Sagar Institute of Science & Technology', canvas.width / 2, 250);

    // Room & Table Details Box
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(100, 340, canvas.width - 200, 260);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(100, 340, canvas.width - 200, 260);

    // Room Label
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 24px "Outfit", sans-serif';
    ctx.fillText('LOCATION / ROOM', canvas.width / 2, 390);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 44px "Outfit", sans-serif';
    ctx.fillText(room?.name || 'Central Reading Hall', canvas.width / 2, 450);

    // Table Pill
    ctx.fillStyle = '#1e40af';
    ctx.fillRect(canvas.width / 2 - 250, 480, 500, 90);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px "Outfit", sans-serif';
    ctx.fillText(`TABLE ${table?.table_number || '01'}`, canvas.width / 2, 545);

    // Draw QR Code
    const qrSize = 560;
    const qrX = (canvas.width - qrSize) / 2;
    const qrY = 640;
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    // Scan Instructions Box
    ctx.fillStyle = '#eff6ff';
    ctx.fillRect(140, 1240, canvas.width - 280, 160);
    ctx.strokeStyle = '#bfdbfe';
    ctx.lineWidth = 2;
    ctx.strokeRect(140, 1240, canvas.width - 280, 160);

    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 32px "Outfit", sans-serif';
    ctx.fillText('HOW TO CHECK IN', canvas.width / 2, 1290);

    ctx.fillStyle = '#334155';
    ctx.font = '500 24px "Outfit", sans-serif';
    ctx.fillText('1. Open SISTec Library Portal on Mobile', canvas.width / 2, 1335);
    ctx.fillText('2. Tap "Scan Study Desk QR" & Point Camera Here', canvas.width / 2, 1375);

    // Footer
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 20px "Outfit", sans-serif';
    ctx.fillText(`Identifier: ${table.qr_identifier || table.id} • Authorized by SISTec Library Administration`, canvas.width / 2, 1490);

    // Download PNG
    const link = document.createElement('a');
    const safeRoom = (room?.name || 'Room').replace(/[^a-zA-Z0-9]/g, '_');
    const safeTable = (table?.table_number || 'Table').replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `SISTec_Badge_${safeRoom}_${safeTable}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    return true;
  } catch (err) {
    console.error('Error downloading printable badge:', err);
    throw err;
  }
}
