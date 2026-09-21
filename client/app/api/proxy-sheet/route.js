import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const rawUrl = String(body.url || '').trim();

    if (!rawUrl) {
      return NextResponse.json({ error: 'Google Sheet URL is required.' }, { status: 400 });
    }

    // Validate Google Sheet URL format
    const sheetIdMatch = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!sheetIdMatch || !sheetIdMatch[1]) {
      return NextResponse.json({
        error: 'Invalid Google Sheet URL. Please provide a standard URL like https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit'
      }, { status: 400 });
    }

    const spreadsheetId = sheetIdMatch[1];
    
    // Extract gid if available
    const gidMatch = rawUrl.match(/[#&?]gid=([0-9]+)/);
    const gid = gidMatch && gidMatch[1] ? gidMatch[1] : '0';

    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

    const res = await fetch(exportUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SISTec-Library-Portal/1.0',
        'Accept': 'text/csv,text/plain,*/*'
      },
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
    console.error('Error proxying Google Sheet:', err);
    return NextResponse.json({
      error: err.message || 'Internal server error while fetching Google Sheet.'
    }, { status: 500 });
  }
}
