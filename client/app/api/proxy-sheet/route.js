import { NextResponse } from 'next/server';

// In-memory sliding window rate limiter (per-IP, max 10 requests per minute)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const MAX_CSV_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB maximum

function checkRateLimit(ip) {
  const now = Date.now();
  const clientData = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > clientData.resetAt) {
    clientData.count = 1;
    clientData.resetAt = now + RATE_LIMIT_WINDOW_MS;
  } else {
    clientData.count += 1;
  }

  rateLimitMap.set(ip, clientData);

  // Periodic cleanup of stale rate limit entries
  if (rateLimitMap.size > 2000) {
    for (const [key, data] of rateLimitMap.entries()) {
      if (now > data.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }

  return clientData.count <= MAX_REQUESTS_PER_WINDOW;
}

export async function POST(request) {
  try {
    // 1. Rate Limiting Check
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'anonymous-client';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Too many Google Sheet sync requests. Please wait a minute before retrying.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawUrl = String(body.url || '').trim();

    // 2. Strict Input Validation
    if (!rawUrl) {
      return NextResponse.json({ error: 'Google Sheet URL is required.' }, { status: 400 });
    }

    if (rawUrl.length > 500) {
      return NextResponse.json({ error: 'Invalid URL: Exceeds maximum length of 500 characters.' }, { status: 400 });
    }

    // SSRF Defense: Verify domain is strictly Google Docs
    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format.' }, { status: 400 });
    }

    if (parsedUrl.hostname !== 'docs.google.com') {
      return NextResponse.json({ 
        error: 'Security validation failed: Only official Google Sheets URLs (docs.google.com) are permitted.' 
      }, { status: 400 });
    }

    // Extract & strictly validate spreadsheet ID
    const sheetIdMatch = parsedUrl.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{15,100})/);
    if (!sheetIdMatch || !sheetIdMatch[1]) {
      return NextResponse.json({
        error: 'Invalid Google Sheet URL format. Example: https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit'
      }, { status: 400 });
    }

    const spreadsheetId = sheetIdMatch[1];
    
    // Extract & validate gid (strictly numeric)
    const gidMatch = (parsedUrl.hash + parsedUrl.search).match(/[#&?]gid=([0-9]{1,20})/);
    const gid = gidMatch && gidMatch[1] ? gidMatch[1] : '0';

    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

    // 3. Fetch with 8-second Timeout & Size Guard
    const res = await fetch(exportUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SISTec-Library-Portal/1.0',
        'Accept': 'text/csv,text/plain,*/*'
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow'
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({
          error: 'This Google Sheet is not publicly accessible. Please click "Share" in Google Sheets and set General Access to "Anyone with the link" (Viewer), or export as CSV/Excel and upload the file directly.'
        }, { status: 403 });
      }
      return NextResponse.json({
        error: `Failed to fetch Google Sheet data (Status ${res.status}). Ensure the sheet exists and is shared.`
      }, { status: 400 });
    }

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    // Check payload size
    if (text.length > MAX_CSV_SIZE_BYTES) {
      return NextResponse.json({
        error: 'The Google Sheet exceeds the 10 MB size limit.'
      }, { status: 413 });
    }

    // Check if Google returned an HTML login or error page instead of CSV
    if (contentType.includes('text/html') || text.includes('<!DOCTYPE html>') || text.includes('<html')) {
      return NextResponse.json({
        error: 'The Google Sheet returned an HTML sign-in page instead of CSV data. Please set Google Sheet sharing to "Anyone with the link can view".'
      }, { status: 403 });
    }

    return NextResponse.json({
      csv: text,
      spreadsheetId,
      gid
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return NextResponse.json({
        error: 'Connection timed out while fetching Google Sheet. Please check the URL or try again.'
      }, { status: 504 });
    }
    console.error('Error proxying Google Sheet:', err);
    return NextResponse.json({
      error: 'An internal server error occurred while processing the Google Sheet.'
    }, { status: 500 });
  }
}
