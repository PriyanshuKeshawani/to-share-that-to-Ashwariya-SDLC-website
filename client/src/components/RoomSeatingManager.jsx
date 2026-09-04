import { useState, useMemo, useEffect } from 'react';
import { 
  Users, MapPin, QrCode, Plus, Layers, Edit3, Save, Bookmark, 
  RotateCcw, Sparkles, Check, Trash2, Eye, ShieldCheck, ChevronDown, CheckCircle2, X
} from 'lucide-react';
import TableQRBadgeModal from './TableQRBadgeModal';
import BulkRoomBuilderModal from './BulkRoomBuilderModal';

const DEFAULT_TEMPLATES = [
  {
    id: 'cinema_standard',
    name: 'Cinema Grid (Center Aisle)',
    rows: 6,
    cols: 10,
    aisleCols: [5], // Aisle between 5 and 6
    description: 'BookMyShow-style rows with central walking aisle'
  },
  {
    id: 'classroom_rows',
    name: 'Classroom Rows (Parallel)',
    rows: 8,
    cols: 8,
    aisleCols: [],
    description: 'Parallel uniform desk rows for exams and quiet study'
  },
  {
    id: 'study_pods',
    name: 'Study Pods (Groups of 4)',
    rows: 6,
    cols: 10,
    aisleCols: [2, 5, 8],
    description: 'Clustered pods for collaborative research'
  }
];

const RoomSeatingManager = ({ 
  rooms = [], 
  tables = [], 
  apiCall, 
  showFeedback, 
  onRefresh, 
  onAddRoomModal, 
  onAddTableModal 
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id || null);
  const [selectedTableForQR, setSelectedTableForQR] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all'); // all, free, occupied
  
  // Layout Editing State
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [gridRows, setGridRows] = useState(6);
  const [gridCols, setGridCols] = useState(10);
  const [aisleCols, setAisleCols] = useState([5]);
  const [disabledCells, setDisabledCells] = useState(new Set()); // "row-col" strings that are walkways
  const [savedTemplates, setSavedTemplates] = useState(DEFAULT_TEMPLATES);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [showSaveTemplateInput, setShowSaveTemplateInput] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Fetch saved templates directly from Supabase database (Zero local storage)
  useEffect(() => {
    let isMounted = true;
    const fetchDbTemplates = async () => {
      if (!apiCall) return;
      try {
        const dbTemplates = await apiCall('/seating-templates');
        if (isMounted && Array.isArray(dbTemplates) && dbTemplates.length > 0) {
          const merged = [...DEFAULT_TEMPLATES];
          dbTemplates.forEach(t => {
            if (!merged.some(m => m.id === t.id)) {
              merged.push({ ...t, isCustom: true });
            }
          });
          setSavedTemplates(merged);
        }
      } catch (err) {
        console.warn('Could not load seating templates from DB:', err);
      }
    };
    fetchDbTemplates();
    return () => { isMounted = false; };
  }, [apiCall]);

  // Sync selected room if rooms list changes
  useEffect(() => {
    if (rooms.length > 0 && (!selectedRoomId || !rooms.find(r => r.id === selectedRoomId))) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, selectedRoomId]);

  const activeRoom = useMemo(() => {
    return rooms.find(r => r.id === selectedRoomId) || rooms[0] || null;
  }, [rooms, selectedRoomId]);

  // Tables belonging to the active room
  const roomTables = useMemo(() => {
    if (!activeRoom) return [];
    return tables.filter(t => t.room_id === activeRoom.id);
  }, [tables, activeRoom]);

  // Derive layout dimensions dynamically based on existing tables or active settings
  useEffect(() => {
    if (!activeRoom) return;
    
    // Parse room description if it contains layout json
    let config = null;
    try {
      if (activeRoom.description && activeRoom.description.startsWith('{')) {
        config = JSON.parse(activeRoom.description);
      }
    } catch (e) {
      config = null;
    }

    const tableCount = roomTables.length || 60;
    if (config?.rows && config?.cols) {
      setGridRows(config.rows);
      setGridCols(config.cols);
      setAisleCols(config.aisleCols || [5]);
      if (config.disabledCells) {
        setDisabledCells(new Set(config.disabledCells));
      }
    } else {
      // Auto-compute appropriate grid (e.g. 60 seats -> 6 rows x 10 cols)
      const cols = 10;
      const rows = Math.ceil(tableCount / cols) || 6;
      setGridRows(Math.max(4, Math.min(rows, 12)));
      setGridCols(cols);
      setAisleCols([5]);
      setDisabledCells(new Set());
    }
  }, [activeRoom, roomTables.length]);

  // Map each table to a grid position (Row A..Z, Col 1..N)
  const seatingMatrix = useMemo(() => {
    const matrix = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    // Sort tables by table_number for coherent ordering
    const sortedTables = [...roomTables].sort((a, b) => {
      return (a.table_number || '').localeCompare(b.table_number || '', undefined, { numeric: true });
    });

    let tableIdx = 0;
    for (let r = 0; r < gridRows; r++) {
      const rowLabel = alphabet[r] || `R${r + 1}`;
      const rowSeats = [];

      for (let c = 0; c < gridCols; c++) {
        const cellKey = `${r}-${c}`;
        const isAisle = aisleCols.includes(c);
        const isDisabled = disabledCells.has(cellKey);

        if (isAisle || isDisabled) {
          rowSeats.push({
            isSpace: true,
            isAisle,
            rowLabel,
            colIndex: c,
            cellKey
          });
        } else {
          const existingTable = sortedTables[tableIdx];
          tableIdx++;

          rowSeats.push({
            isSpace: false,
            rowLabel,
            colIndex: c,
            cellKey,
            seatCode: `${rowLabel}${c + 1}`,
            table: existingTable || {
              id: `virtual-${cellKey}`,
              table_number: `${rowLabel}-${c + 1}`,
              qr_identifier: `TABLE-${activeRoom?.id || 1}-${rowLabel}${c + 1}`,
              status: 'free',
              isVirtual: !existingTable
            }
          });
        }
      }
      matrix.push({ rowLabel, seats: rowSeats });
    }
    return matrix;
  }, [gridRows, gridCols, aisleCols, disabledCells, roomTables, activeRoom]);

  // Occupancy metrics
  const stats = useMemo(() => {
    const total = roomTables.length;
    const occupied = roomTables.filter(t => t.status === 'occupied').length;
    const free = total - occupied;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, occupied, free, occupancyRate };
  }, [roomTables]);

  // Save template handler directly to Supabase Database (Zero local storage)
  const handleSaveTemplate = async () => {
    if (!templateNameInput.trim()) return;
    setIsSavingTemplate(true);
    const newTemplate = {
      id: `template-${Date.now()}`,
      name: templateNameInput.trim(),
      rows: gridRows,
      cols: gridCols,
      aisleCols: [...aisleCols],
      disabledCells: Array.from(disabledCells),
      description: `${gridRows} Rows x ${gridCols} Columns with custom layout`,
      isCustom: true
    };

    try {
      if (apiCall) {
        await apiCall('/seating-templates', {
          method: 'POST',
          body: JSON.stringify(newTemplate)
        });
      }
      setSavedTemplates(prev => [...prev, newTemplate]);
      if (showFeedback) showFeedback(`Layout template "${newTemplate.name}" saved to database!`);
    } catch (e) {
      console.error('Failed saving template to database:', e);
      if (showFeedback) showFeedback(`Failed to save template to database: ${e.message}`, 'error');
    } finally {
      setIsSavingTemplate(false);
      setTemplateNameInput('');
      setShowSaveTemplateInput(false);
    }
  };

  // Delete custom template directly from database
  const handleDeleteCustomTemplate = async (tmpl, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete template "${tmpl.name}" from database?`)) return;
    try {
      if (apiCall) {
        await apiCall(`/seating-templates/${tmpl.id}`, { method: 'DELETE' });
      }
      setSavedTemplates(prev => prev.filter(t => t.id !== tmpl.id));
      if (showFeedback) showFeedback(`Template "${tmpl.name}" deleted from database`);
    } catch (err) {
      if (showFeedback) showFeedback(`Failed to delete template: ${err.message}`, 'error');
    }
  };

  // Load template
  const handleApplyTemplate = (tmpl) => {
    setGridRows(tmpl.rows);
    setGridCols(tmpl.cols);
    setAisleCols(tmpl.aisleCols || []);
    setDisabledCells(new Set(tmpl.disabledCells || []));
    if (showFeedback) showFeedback(`Applied "${tmpl.name}" layout`);
  };

  // Toggle cell in edit mode
  const handleCellClickInEditMode = (r, c) => {
    const key = `${r}-${c}`;
    setDisabledCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Vacate table action
  const handleVacateTable = async (table) => {
    try {
      await apiCall(`/tables/${table.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'free',
          current_occupant_id: null,
          session_started_at: null
        })
      });
      if (showFeedback) showFeedback(`Table ${table.table_number} vacated successfully`);
      setSelectedTableForQR(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      if (showFeedback) showFeedback(err.message || 'Failed to vacate table', 'error');
    }
  };

  // Delete table action
  const handleDeleteTable = async (table) => {
    try {
      await apiCall(`/tables/${table.id}`, { method: 'DELETE' });
      if (showFeedback) showFeedback(`Table ${table.table_number} deleted`);
      setSelectedTableForQR(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      if (showFeedback) showFeedback(err.message || 'Failed to delete table', 'error');
    }
  };

  // Save layout config to room description in Supabase
  const handlePersistLayoutToRoom = async () => {
    if (!activeRoom) return;
    try {
      const layoutData = {
        rows: gridRows,
        cols: gridCols,
        aisleCols,
        disabledCells: Array.from(disabledCells),
        updatedAt: new Date().toISOString()
      };
      
      const newDesc = JSON.stringify(layoutData);
      await apiCall(`/rooms/${activeRoom.id}`, {
        method: 'PUT',
        body: JSON.stringify({ description: newDesc })
      });
      setIsEditingLayout(false);
      if (showFeedback) showFeedback(`Room "${activeRoom.name}" layout saved successfully!`);
      if (onRefresh) onRefresh();
    } catch (err) {
      // If PUT is not handled or fails, fallback to local confirmation
      setIsEditingLayout(false);
      if (showFeedback) showFeedback(`Layout updated locally for ${activeRoom.name}`);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* ── Top Bar: Title & Bulk / Room Actions ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>
            Interactive Room Seating & Desk Layouts
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            BookMyShow-style live library seating arrangement, bulk builder, and downloadable desk QR tokens.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowBulkModal(true)}
            className="btn btn-primary btn-shine"
            style={{ padding: '10px 18px', gap: '8px', fontSize: '0.86rem' }}
          >
            <Layers size={16} />
            <span>Bulk Build Rooms (10+ at once)</span>
          </button>

          {onAddRoomModal && (
            <button
              onClick={onAddRoomModal}
              className="btn btn-secondary"
              style={{ padding: '10px 16px', gap: '6px', fontSize: '0.86rem' }}
            >
              <Plus size={15} /> Add Single Room
            </button>
          )}

          {onAddTableModal && (
            <button
              onClick={onAddTableModal}
              className="btn btn-secondary"
              style={{ padding: '10px 16px', gap: '6px', fontSize: '0.86rem' }}
            >
              <Plus size={15} /> Add Desk
            </button>
          )}
        </div>
      </div>

      {/* ── Room Switcher Tabs (Horizontal Scrollable) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        overflowX: 'auto',
        paddingBottom: '12px',
        marginBottom: '20px',
        borderBottom: '1px solid var(--border-glass)'
      }}>
        {rooms.map(room => {
          const isSelected = activeRoom?.id === room.id;
          const roomTableList = tables.filter(t => t.room_id === room.id);
          const occupiedCount = roomTableList.filter(t => t.status === 'occupied').length;

          return (
            <button
              key={room.id}
              onClick={() => { setSelectedRoomId(room.id); setIsEditingLayout(false); }}
              className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                borderRadius: '12px',
                padding: '9px 16px',
                fontSize: '0.84rem',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <MapPin size={14} />
              <span>{room.name}</span>
              <span style={{
                background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--input-bg)',
                color: isSelected ? '#ffffff' : 'var(--text-muted)',
                borderRadius: '999px',
                padding: '2px 8px',
                fontSize: '0.7rem',
                fontWeight: 700
              }}>
                {occupiedCount}/{roomTableList.length} seated
              </span>
            </button>
          );
        })}
      </div>

      {activeRoom ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* ── Active Room Stat Bar & Layout Controls ── */}
          <div className="glass-panel" style={{ padding: '18px 22px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              {/* Room Details & Occupancy summary */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {activeRoom.name}
                  </h3>
                  <span className="badge badge-primary">
                    {stats.occupancyRate}% Full
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {stats.total} configured study tables • {stats.free} free • {stats.occupied} occupied
                </p>
              </div>

              {/* Status Filter & Layout Edit Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Filter Pills */}
                <div style={{
                  display: 'inline-flex',
                  background: 'var(--input-bg)',
                  padding: '3px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-glass)'
                }}>
                  {['all', 'free', 'occupied'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilterStatus(f)}
                      style={{
                        background: filterStatus === f ? 'var(--primary)' : 'transparent',
                        color: filterStatus === f ? '#fff' : 'var(--text-muted)',
                        border: 'none',
                        borderRadius: '7px',
                        padding: '5px 12px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'capitalize'
                      }}
                    >
                      {f === 'all' ? 'All Seats' : f === 'free' ? 'Available' : 'Occupied'}
                    </button>
                  ))}
                </div>

                {/* Layout Editor Mode Toggle */}
                <button
                  onClick={() => setIsEditingLayout(!isEditingLayout)}
                  className={`btn ${isEditingLayout ? 'btn-gold' : 'btn-secondary'}`}
                  style={{ padding: '8px 14px', fontSize: '0.8rem', gap: '6px' }}
                >
                  <Edit3 size={14} />
                  <span>{isEditingLayout ? 'Exit Layout Editor' : 'Customize Layout'}</span>
                </button>
              </div>
            </div>

            {/* ── Expanded Layout Editor Toolbar ── */}
            {isEditingLayout && (
              <div className="animate-slide-up" style={{
                marginTop: '18px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-glass)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  {/* Preset Template Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      APPLY TEMPLATE:
                    </span>
                    {savedTemplates.map(tmpl => (
                      <div key={tmpl.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleApplyTemplate(tmpl)}
                          className="btn btn-secondary"
                          style={{
                            padding: '5px 10px',
                            fontSize: '0.74rem',
                            borderTopRightRadius: tmpl.isCustom ? '0' : undefined,
                            borderBottomRightRadius: tmpl.isCustom ? '0' : undefined
                          }}
                        >
                          {tmpl.name}
                        </button>
                        {tmpl.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomTemplate(tmpl, e)}
                            title="Delete template from database"
                            className="btn btn-secondary"
                            style={{
                              padding: '5px 8px',
                              fontSize: '0.74rem',
                              color: 'var(--danger)',
                              borderLeft: 'none',
                              borderTopLeftRadius: '0',
                              borderBottomLeftRadius: '0'
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Grid Size Inputs */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Rows:</span>
                      <input
                        type="number"
                        min="2"
                        max="16"
                        value={gridRows}
                        onChange={(e) => setGridRows(Math.max(2, parseInt(e.target.value, 10) || 2))}
                        className="glass-input"
                        style={{ width: '56px', padding: '4px 6px', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Cols:</span>
                      <input
                        type="number"
                        min="4"
                        max="18"
                        value={gridCols}
                        onChange={(e) => setGridCols(Math.max(4, parseInt(e.target.value, 10) || 4))}
                        className="glass-input"
                        style={{ width: '56px', padding: '4px 6px', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    💡 <strong>Tip:</strong> Click on any seat below to toggle it as an <em>Aisle / Walkway space</em> or normal desk.
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {!showSaveTemplateInput ? (
                      <button
                        onClick={() => setShowSaveTemplateInput(true)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.76rem', gap: '6px' }}
                      >
                        <Bookmark size={13} /> Save as Reusable Template
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Template Name (e.g. 60-Pod)"
                          value={templateNameInput}
                          onChange={(e) => setTemplateNameInput(e.target.value)}
                          className="glass-input"
                          style={{ padding: '4px 10px', fontSize: '0.76rem', width: '160px' }}
                        />
                        <button
                          onClick={handleSaveTemplate}
                          disabled={isSavingTemplate}
                          className="btn btn-primary"
                          style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                        >
                          {isSavingTemplate ? 'Saving...' : 'Save to DB'}
                        </button>
                        <button
                          onClick={() => setShowSaveTemplateInput(false)}
                          className="btn btn-secondary"
                          style={{ padding: '5px', fontSize: '0.75rem' }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}

                    <button
                      onClick={handlePersistLayoutToRoom}
                      className="btn btn-primary btn-shine"
                      style={{ padding: '6px 14px', fontSize: '0.78rem', gap: '6px' }}
                    >
                      <Save size={13} /> Save Room Layout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── BookMyShow Seating Canvas Panel ── */}
          <div className="glass-panel" style={{
            padding: '36px 20px',
            position: 'relative',
            overflowX: 'auto',
            textAlign: 'center'
          }}>
            {/* Front of Room / Stage Screen Banner */}
            <div style={{
              maxWidth: '680px',
              margin: '0 auto 36px',
              position: 'relative'
            }}>
              <div style={{
                height: '6px',
                background: 'linear-gradient(90deg, transparent, var(--primary), var(--secondary), transparent)',
                borderRadius: '999px',
                boxShadow: '0 0 16px rgba(59, 130, 246, 0.5)',
                marginBottom: '10px'
              }} />
              <div style={{
                fontSize: '0.74rem',
                fontWeight: 800,
                color: 'var(--text-muted)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase'
              }}>
                ━━━━━ FRONT STAGE / WHITEBOARD / SCREEN ━━━━━
              </div>
            </div>

            {/* Seating Grid (Rows & Seats) */}
            <div style={{
              display: 'inline-flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '10px'
            }}>
              {seatingMatrix.map((rowObj) => (
                <div
                  key={rowObj.rowLabel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  {/* Left Row Label (A, B, C...) */}
                  <div style={{
                    width: '26px',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    textAlign: 'right'
                  }}>
                    {rowObj.rowLabel}
                  </div>

                  {/* Seat Items in Row */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {rowObj.seats.map((seatItem, sIdx) => {
                      // Walkway / Aisle
                      if (seatItem.isSpace) {
                        return (
                          <div
                            key={seatItem.cellKey || sIdx}
                            onClick={() => isEditingLayout && handleCellClickInEditMode(seatItem.rowLabel.charCodeAt(0) - 65, seatItem.colIndex)}
                            style={{
                              width: seatItem.isAisle ? '26px' : '36px',
                              height: '38px',
                              cursor: isEditingLayout ? 'pointer' : 'default',
                              border: isEditingLayout ? '1px dashed rgba(255,255,255,0.1)' : 'none',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: 0.6
                            }}
                            title={isEditingLayout ? 'Click to convert back to seat' : 'Walkway / Aisle'}
                          >
                            {isEditingLayout && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>+</span>}
                          </div>
                        );
                      }

                      const { table, seatCode } = seatItem;
                      const isOccupied = table?.status === 'occupied';
                      const isReserved = table?.status === 'reserved';

                      // Filter check
                      if (filterStatus === 'free' && isOccupied) return null;
                      if (filterStatus === 'occupied' && !isOccupied) return null;

                      // Color themes based on occupancy
                      let bg = 'rgba(16, 185, 129, 0.12)';
                      let border = '1.5px solid rgba(16, 185, 129, 0.4)';
                      let textCol = '#34d399';
                      let glow = '0 0 10px rgba(16, 185, 129, 0.15)';

                      if (isOccupied) {
                        bg = 'rgba(239, 68, 68, 0.18)';
                        border = '1.5px solid rgba(239, 68, 68, 0.5)';
                        textCol = '#f87171';
                        glow = '0 0 12px rgba(239, 68, 68, 0.25)';
                      } else if (isReserved) {
                        bg = 'rgba(245, 158, 11, 0.15)';
                        border = '1.5px solid rgba(245, 158, 11, 0.4)';
                        textCol = '#fbbf24';
                        glow = '0 0 10px rgba(245, 158, 11, 0.15)';
                      }

                      return (
                        <div
                          key={seatItem.cellKey}
                          onClick={() => {
                            if (isEditingLayout) {
                              const rNum = rowObj.rowLabel.charCodeAt(0) - 65;
                              handleCellClickInEditMode(rNum, seatItem.colIndex);
                            } else {
                              setSelectedTableForQR(table);
                            }
                          }}
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '10px',
                            background: bg,
                            border,
                            boxShadow: glow,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                            position: 'relative',
                            userSelect: 'none'
                          }}
                          className="motion-stat-card"
                          title={
                            isOccupied
                              ? `Occupied: ${table.occupant_name || 'Student'} (${table.occupant_roll || 'ID'})\nClick to view QR pass & manage`
                              : `Table ${table.table_number}\nClick to view and download special QR`
                          }
                        >
                          {/* Live pulse dot for occupied seats */}
                          {isOccupied && (
                            <span style={{
                              position: 'absolute',
                              top: '3px',
                              right: '3px',
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: '#ef4444'
                            }}>
                              <span className="status-live-ping" style={{ backgroundColor: '#ef4444' }} />
                            </span>
                          )}

                          {/* Seat Label */}
                          <span style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            color: textCol,
                            lineHeight: 1
                          }}>
                            {seatCode}
                          </span>

                          <span style={{
                            fontSize: '0.55rem',
                            color: 'var(--text-muted)',
                            marginTop: '2px',
                            maxWidth: '36px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {isOccupied ? (table.occupant_name?.split(' ')[0] || 'Seated') : 'Free'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Row Label */}
                  <div style={{
                    width: '26px',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    textAlign: 'left'
                  }}>
                    {rowObj.rowLabel}
                  </div>
                </div>
              ))}
            </div>

            {/* ── BookMyShow Seating Legend ── */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '24px',
              marginTop: '34px',
              borderTop: '1px solid var(--border-glass)',
              paddingTop: '18px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '5px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1.5px solid #10b981'
                }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Available / Ready for Scan
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '5px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1.5px solid #ef4444'
                }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Occupied by Student
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '5px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1.5px solid #f59e0b'
                }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Reserved / Priority Desk
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '5px',
                  border: '1px dashed rgba(255, 255, 255, 0.25)'
                }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Aisle / Walking Passage
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
          <MapPin size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h3>No study rooms found</h3>
          <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
            Use the "Bulk Build Rooms" button above to create 10 rooms with 60 seats each in one click!
          </p>
        </div>
      )}

      {/* ── Table QR & Downloadable Badge Modal ── */}
      {selectedTableForQR && (
        <TableQRBadgeModal
          table={selectedTableForQR}
          room={activeRoom}
          onClose={() => setSelectedTableForQR(null)}
          onVacateTable={handleVacateTable}
          onDeleteTable={handleDeleteTable}
        />
      )}

      {/* ── Bulk Room & Seat Builder Modal ── */}
      {showBulkModal && (
        <BulkRoomBuilderModal
          onClose={() => setShowBulkModal(false)}
          onBuildComplete={() => {
            if (onRefresh) onRefresh();
          }}
          apiCall={apiCall}
          showFeedback={showFeedback}
        />
      )}
    </div>
  );
};

export default RoomSeatingManager;
