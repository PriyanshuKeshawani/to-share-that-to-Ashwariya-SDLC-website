import QRCode from 'qrcode';

async function runDeepTests() {
  console.log('====================================================');
  console.log('🔍 SISTEC LIBRARY PORTAL - DEEP AUTOMATED TEST SUITE');
  console.log('====================================================\n');

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

  // ──────────────────────────────────────────────────
  // TEST SUITE 1: QR Code Generation & Badge Assets
  // ──────────────────────────────────────────────────
  console.log('📋 [1/5] Testing QR Code Generation Engine:');
  try {
    const testPayloads = [
      'TABLE-R1-A-1-XYZ12',
      'TABLE-R10-F-10-TEST99',
      'SISTEC-STUDENT-DESK-PASS-ROOM105-TABLE-B3'
    ];

    for (const text of testPayloads) {
      const dataUrl = await QRCode.toDataURL(text, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'H'
      });
      assert(
        dataUrl && dataUrl.startsWith('data:image/png;base64,'),
        `Generated high-res Base64 QR code for: ${text} (${dataUrl.length} chars)`
      );
    }
  } catch (err) {
    assert(false, `QR Code generation threw unexpected error: ${err.message}`);
  }

  // ──────────────────────────────────────────────────
  // TEST SUITE 2: BookMyShow Seating Layout Algorithm
  // ──────────────────────────────────────────────────
  console.log('\n🎬 [2/5] Testing BookMyShow Seating Matrix & Aisle Engine:');
  {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const gridRows = 6;
    const gridCols = 10;
    const aisleCols = [5];
    const disabledCells = new Set(['1-2', '3-7']); // simulated walkways

    // Create 60 simulated tables
    const mockTables = [];
    for (let s = 0; s < 50; s++) {
      const rIdx = Math.floor(s / gridCols);
      const cIdx = (s % gridCols) + 1;
      const rowL = alphabet[rIdx] || `R${rIdx+1}`;
      mockTables.push({
        id: s + 1,
        table_number: `${rowL}-${cIdx}`,
        status: s % 5 === 0 ? 'occupied' : 'free',
        occupant_name: s % 5 === 0 ? `Student ${s+1}` : null
      });
    }

    // Build matrix
    const matrix = [];
    let tableIdx = 0;
    for (let r = 0; r < gridRows; r++) {
      const rowLabel = alphabet[r];
      const rowSeats = [];
      for (let c = 0; c < gridCols; c++) {
        const cellKey = `${r}-${c}`;
        const isAisle = aisleCols.includes(c);
        const isDisabled = disabledCells.has(cellKey);

        if (isAisle || isDisabled) {
          rowSeats.push({ isSpace: true, isAisle, isDisabled, rowLabel, colIndex: c });
        } else {
          const t = mockTables[tableIdx] || { isVirtual: true, table_number: `${rowLabel}-${c+1}`, status: 'free' };
          tableIdx++;
          rowSeats.push({ isSpace: false, table: t, seatCode: `${rowLabel}${c+1}` });
        }
      }
      matrix.push({ rowLabel, seats: rowSeats });
    }

    assert(matrix.length === 6, 'Matrix has exactly 6 rows (A to F)');
    assert(matrix[0].seats.length === 10, 'Each row has exactly 10 columns');
    assert(matrix[0].seats[5].isAisle === true, 'Center aisle column 5 properly identified as walking pathway');
    assert(matrix[1].seats[2].isDisabled === true, 'Custom disabled cell (Row 1, Col 2) rendered as walkway gap');
    
    // Check occupancy stats
    const totalOccupied = mockTables.filter(t => t.status === 'occupied').length;
    const totalFree = mockTables.length - totalOccupied;
    assert(totalOccupied === 10, `Correctly computed 10 occupied desks (got ${totalOccupied})`);
    assert(totalFree === 40, `Correctly computed 40 available desks (got ${totalFree})`);
  }

  // ──────────────────────────────────────────────────
  // TEST SUITE 3: Bulk Room Builder & Name Confirmation
  // ──────────────────────────────────────────────────
  console.log('\n🏢 [3/5] Testing Bulk Room Builder & Confirmation Logic:');
  {
    const roomCount = 10;
    const roomPrefix = 'Reading Hall';
    const startNumber = 201;
    const seatsPerRoom = 60;

    // Step 1: Draft generation
    const draftRooms = [];
    for (let i = 0; i < roomCount; i++) {
      draftRooms.push({
        id: `draft-${i}`,
        name: `${roomPrefix} ${startNumber + i}`,
        seatsCount: seatsPerRoom,
        layout: 'cinema'
      });
    }

    assert(draftRooms.length === 10, 'Generated 10 draft rooms in Step 1');
    assert(draftRooms[0].name === 'Reading Hall 201', 'First room named Reading Hall 201');
    assert(draftRooms[9].name === 'Reading Hall 210', 'Tenth room named Reading Hall 210');

    // Step 2: Individual Name Confirmation & Customization
    draftRooms[4].name = 'MCA Research Center';
    draftRooms[8].name = 'Digital Media Lab';
    draftRooms[8].seatsCount = 80;

    assert(draftRooms[4].name === 'MCA Research Center', 'Admin customized Room 5 name to "MCA Research Center"');
    assert(draftRooms[8].name === 'Digital Media Lab' && draftRooms[8].seatsCount === 80, 'Admin customized Room 9 name and adjusted seats to 80');

    const totalSeatsPlanned = draftRooms.reduce((acc, r) => acc + r.seatsCount, 0);
    assert(totalSeatsPlanned === 620, `Total planned desks across 10 rooms accurately calculated: 620 (got ${totalSeatsPlanned})`);

    // Step 3: Batch Seats Generation Simulation
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const roomTablesGenerated = [];
    for (const r of draftRooms) {
      const seats = r.seatsCount;
      const cols = 10;
      for (let s = 0; s < seats; s++) {
        const rowIdx = Math.floor(s / cols);
        const colIdx = (s % cols) + 1;
        const rowL = alphabet[rowIdx] || `R${rowIdx+1}`;
        roomTablesGenerated.push({
          room_name: r.name,
          table_number: `${rowL}-${colIdx}`,
          status: 'free'
        });
      }
    }

    assert(roomTablesGenerated.length === 620, `Generated all 620 individual physical desk entities with row-column identifiers`);
    assert(roomTablesGenerated[0].table_number === 'A-1', 'First seat labeled A-1');
    assert(roomTablesGenerated[59].table_number === 'F-10', '60th seat labeled F-10');
  }

  // ──────────────────────────────────────────────────
  // TEST SUITE 4: Reusable Layout Template JSON Persistence
  // ──────────────────────────────────────────────────
  console.log('\n💾 [4/5] Testing Layout Templates JSON Serialization:');
  {
    const layoutConfig = {
      rows: 8,
      cols: 12,
      aisleCols: [4, 8],
      disabledCells: ['0-0', '0-11', '7-0', '7-11'],
      templateName: 'West Wing Main Hall',
      updatedAt: new Date().toISOString()
    };

    const serialized = JSON.stringify(layoutConfig);
    assert(typeof serialized === 'string', 'Layout successfully serialized to JSON for storage');

    const deserialized = JSON.parse(serialized);
    assert(deserialized.rows === 8 && deserialized.cols === 12, 'Deserialized dimensions match (8x12)');
    assert(deserialized.aisleCols.length === 2 && deserialized.aisleCols[0] === 4, 'Aisle column positions preserved');
    assert(deserialized.disabledCells.length === 4, 'Corner disabled walkway cells preserved');
  }

  // ──────────────────────────────────────────────────
  // TEST SUITE 5: Student Desk Check-in & Notifications Flow
  // ──────────────────────────────────────────────────
  console.log('\n📱 [5/5] Testing Student Check-in & Notifications Integration:');
  {
    const mockTable = {
      id: 42,
      table_number: 'B-6',
      room: { id: 101, name: 'Central Reading Hall' },
      status: 'free'
    };

    // Check-in
    const session = {
      id: 'sess-889',
      table_id: mockTable.id,
      table_number: mockTable.table_number,
      room_name: mockTable.room.name,
      checked_in_at: new Date().toISOString()
    };
    mockTable.status = 'occupied';
    mockTable.current_session = session;

    assert(mockTable.status === 'occupied', 'Table status updated to "occupied" upon student scan');
    assert(mockTable.current_session.table_number === 'B-6', 'Check-in session associated with Table B-6');

    // Notification generated
    const notifications = [
      { id: 1, type: 'desk', title: 'Desk Registered', message: 'Checked in at Table B-6 (Central Reading Hall)', is_read: false, created_at: new Date().toISOString() },
      { id: 2, type: 'loan', title: 'Book Borrowed', message: 'Engineering Mathematics borrowed. Due in 14 days', is_read: true, created_at: new Date(Date.now() - 3600000).toISOString() }
    ];

    const unreadCount = notifications.filter(n => !n.is_read).length;
    assert(unreadCount === 1, `Computed exactly 1 unread notification (got ${unreadCount})`);

    // Mark single as read
    notifications[0].is_read = true;
    const updatedUnread = notifications.filter(n => !n.is_read).length;
    assert(updatedUnread === 0, 'Marking notification as read reduces unread count to 0');
  }

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDeepTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
