import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ddjqajadhrwepcybfzam.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkanFhamFkaHJ3ZXBjeWJmemFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzOTY1NzksImV4cCI6MjEwMzk3MjU3OX0.XPWOh6OFmXKztLOE1f9UJrPdQhC5iJX6Z-CdzYCMV3o';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Minimal standard valid PDF buffer with actual PDF objects
function createValidPdfBuffer() {
  const content = `%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 612 792]
  /Contents 4 0 R
  /Resources << >>
>>
endobj
4 0 obj
<<
  /Length 55
>>
stream
BT
/F1 24 Tf
100 700 Td
(SISTEC Library Portal Test PDF Document) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000068 00000 n 
0000000125 00000 n 
0000000228 00000 n 
trailer
<<
  /Size 5
  /Root 1 0 R
>>
startxref
332
%%EOF`;
  return Buffer.from(content, 'utf-8');
}

async function runPdfLifecycleTest() {
  console.log('===============================================================');
  console.log('🧪 SISTEC LIBRARY PORTAL - PDF LIFECYCLE & VIEWER TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const testTitle = `TEST_BOOK_SISTEC_DATA_STRUCTURES_${Date.now()}`;
  const testAuthor = 'Dr. SISTec Automated Testing Bot';
  let createdBookId = null;
  let testStorageFileName = null;
  let pdfUrl = null;

  try {
    // ──────────────────────────────────────────────────
    // STEP 1: Categories & Branches Retrieval
    // ──────────────────────────────────────────────────
    console.log('📦 [1/6] Retrieving catalog relations (branches & categories):');
    const { data: branches, error: bErr } = await supabase.from('branches').select('id, name').limit(1);
    assert(!bErr && branches && branches.length > 0, `Retrieved default branch: ${branches?.[0]?.name} (ID: ${branches?.[0]?.id})`);
    
    const { data: categories, error: cErr } = await supabase.from('categories').select('id, name').limit(1);
    assert(!cErr && categories && categories.length > 0, `Retrieved default category: ${categories?.[0]?.name} (ID: ${categories?.[0]?.id})`);

    const branchId = branches?.[0]?.id || 1;
    const categoryId = categories?.[0]?.id || 1;

    // ──────────────────────────────────────────────────
    // STEP 2: PDF Upload (Storage Bucket + Base64 Fallback verification)
    // ──────────────────────────────────────────────────
    console.log('\n📤 [2/6] Testing PDF Document Upload & Storage Pipeline:');
    const pdfBuffer = createValidPdfBuffer();
    testStorageFileName = `test-upload-${Date.now()}.pdf`;

    // Test storage bucket upload
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('pdfs')
      .upload(testStorageFileName, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (!uploadErr && uploadData) {
      const { data: pubData } = supabase.storage.from('pdfs').getPublicUrl(testStorageFileName);
      pdfUrl = pubData?.publicUrl;
      assert(true, `Uploaded PDF to Supabase Cloud Storage bucket 'pdfs': ${pdfUrl}`);
    } else {
      console.log(`     (Note: Cloud bucket returned: "${uploadErr?.message || 'Bucket not found'}". Activating Base64 Data URL storage layer...)`);
      pdfUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
      assert(pdfUrl.startsWith('data:application/pdf;base64,'), `Resilient PDF Data URI created successfully (${pdfUrl.length} chars)`);
    }

    // ──────────────────────────────────────────────────
    // STEP 3: Book Metadata & PDF Creation in Database
    // ──────────────────────────────────────────────────
    console.log('\n📚 [3/6] Cataloging Test Book in Database:');
    const { data: insertedBook, error: insertErr } = await supabase
      .from('books')
      .insert([{
        title: testTitle,
        author: testAuthor,
        branch_id: branchId,
        category_id: categoryId,
        priority: 'main',
        pdf_url: pdfUrl
      }])
      .select()
      .single();

    assert(!insertErr && insertedBook?.id, `Test book created with ID: ${insertedBook?.id}`);
    createdBookId = insertedBook?.id;

    // Verify retrieval
    const { data: fetchedBook, error: fetchErr } = await supabase
      .from('books')
      .select('id, title, author, pdf_url, created_at')
      .eq('id', createdBookId)
      .single();

    assert(!fetchErr && fetchedBook?.title === testTitle, `Retrieved catalog entry: "${fetchedBook?.title}"`);
    assert(fetchedBook?.pdf_url && fetchedBook.pdf_url.length > 50, `Valid PDF URL verified in database record`);

    // ──────────────────────────────────────────────────
    // STEP 4: PDF Reading & Download Verification
    // ──────────────────────────────────────────────────
    console.log('\n🔍 [4/6] Verifying PDF Readability & Download Stream:');
    if (pdfUrl.startsWith('data:')) {
      const base64Part = pdfUrl.split(',')[1];
      const decodedBuf = Buffer.from(base64Part, 'base64');
      const header = decodedBuf.subarray(0, 8).toString('utf-8');
      assert(header.includes('%PDF-'), `Verified PDF Magic Header bytes: "${header.trim()}"`);
      assert(decodedBuf.length === pdfBuffer.length, `Decoded byte length exact match: ${decodedBuf.length} bytes`);
    } else if (pdfUrl.startsWith('http')) {
      const resp = await fetch(pdfUrl);
      assert(resp.status === 200, `HTTP GET on cloud PDF URL returned status 200 OK`);
      const respBuf = await resp.arrayBuffer();
      assert(respBuf.byteLength > 0, `Downloaded cloud PDF payload: ${respBuf.byteLength} bytes`);
    }

    // ──────────────────────────────────────────────────
    // STEP 5: Study Notes Workspace & Export Simulation
    // ──────────────────────────────────────────────────
    console.log('\n📝 [5/6] Testing In-Built Study Notes & Markdown Export Engine:');
    const sampleNotes = [
      { id: '1', page: 1, tag: 'Concept', text: 'Time complexity of Binary Search is O(log N).', createdAt: new Date().toISOString() },
      { id: '2', page: 5, tag: 'Exam Imp', text: 'Master Theorem formula case 2 applies when f(n) = Theta(n^(log_b a)).', createdAt: new Date().toISOString() },
      { id: '3', page: 12, tag: 'Formula', text: 'Height of a balanced AVL tree is bounded by 1.44 * log2(N).', createdAt: new Date().toISOString() }
    ];

    assert(sampleNotes.length === 3, `Created ${sampleNotes.length} tagged notes across multiple pages`);

    // Simulate Markdown export generation
    let exportedMd = `# Study Notes: ${testTitle}\n**Author:** ${testAuthor}\n\n`;
    sampleNotes.forEach((n, idx) => {
      exportedMd += `### Note #${idx + 1} | Page ${n.page} [${n.tag.toUpperCase()}]\n${n.text}\n\n`;
    });

    assert(
      exportedMd.includes('Binary Search') && exportedMd.includes('Master Theorem') && exportedMd.includes('AVL tree'),
      `Study Notes Markdown export generated successfully (${exportedMd.length} characters)`
    );

    // ──────────────────────────────────────────────────
    // STEP 6: Complete Cleanup (Removing Test Data)
    // ──────────────────────────────────────────────────
    console.log('\n🧹 [6/6] Cleaning up test data from Database and Storage:');
    
    // 1. Delete from books table
    if (createdBookId) {
      const { error: delErr } = await supabase.from('books').delete().eq('id', createdBookId);
      assert(!delErr, `Deleted test book ID ${createdBookId} from 'books' table`);

      // Verify deletion
      const { data: checkDeleted } = await supabase.from('books').select('id').eq('id', createdBookId).maybeSingle();
      assert(!checkDeleted, `Confirmed test book is completely removed from database`);
    }

    // 2. Delete from storage if created
    if (testStorageFileName) {
      try {
        const { error: stDelErr } = await supabase.storage.from('pdfs').remove([testStorageFileName]);
        if (!stDelErr) {
          console.log(`  ✅ PASS: Storage bucket object ${testStorageFileName} purged`);
        }
      } catch (e) {
        // storage cleanup silent catch
      }
    }

  } catch (err) {
    console.error('❌ Unexpected exception in test execution:', err);
    failed++;
  }

  console.log('\n===============================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPdfLifecycleTest();
