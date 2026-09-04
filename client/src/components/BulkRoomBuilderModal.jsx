import { useState } from 'react';
import { X, Layers, Check, ArrowRight, ArrowLeft, Plus, Trash2, LayoutGrid, CheckCircle } from 'lucide-react';

const LAYOUT_PRESETS = [
  { id: 'cinema', name: 'Cinema Grid (Center Aisle)', desc: 'Rows of desks with a central walkway aisle' },
  { id: 'classroom', name: 'Classroom (Parallel Rows)', desc: 'Uniform rows of individual study desks' },
  { id: 'pods', name: 'Study Pods (Groups of 4/6)', desc: 'Collaborative clusters of paired desks' },
  { id: 'custom', name: 'Standard Open Grid', desc: 'Even matrix distribution' }
];

const BulkRoomBuilderModal = ({ onClose, onBuildComplete, apiCall, showFeedback }) => {
  const [step, setStep] = useState(1); // 1 = Configure, 2 = Confirm & Rename, 3 = Generating
  const [roomCount, setRoomCount] = useState(10);
  const [roomPrefix, setRoomPrefix] = useState('Reading Room');
  const [startNumber, setStartNumber] = useState(101);
  const [seatsPerRoom, setSeatsPerRoom] = useState(60);
  const [selectedLayout, setSelectedLayout] = useState('cinema');
  const [roomList, setRoomList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Generate draft rooms for Step 2
  const handleProceedToConfirmation = (e) => {
    e.preventDefault();
    const count = Math.max(1, Math.min(parseInt(roomCount, 10) || 1, 30));
    const start = parseInt(startNumber, 10) || 101;
    const seats = Math.max(1, Math.min(parseInt(seatsPerRoom, 10) || 10, 200));

    const generated = [];
    for (let i = 0; i < count; i++) {
      generated.push({
        id: `draft-${i}`,
        name: `${roomPrefix.trim()} ${start + i}`,
        seatsCount: seats,
        layout: selectedLayout,
        description: `Capacity: ${seats} study desks • ${LAYOUT_PRESETS.find(p => p.id === selectedLayout)?.name || 'Grid'}`
      });
    }

    setRoomList(generated);
    setStep(2);
  };

  const handleUpdateRoomName = (index, newName) => {
    setRoomList(prev => {
      const next = [...prev];
      next[index].name = newName;
      return next;
    });
  };

  const handleUpdateRoomSeats = (index, newSeats) => {
    setRoomList(prev => {
      const next = [...prev];
      next[index].seatsCount = Math.max(1, parseInt(newSeats, 10) || 1);
      return next;
    });
  };

  const handleRemoveRoom = (index) => {
    setRoomList(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddCustomRoom = () => {
    const nextNum = roomList.length > 0 ? roomList.length + startNumber : 101;
    setRoomList(prev => [
      ...prev,
      {
        id: `draft-${Date.now()}`,
        name: `${roomPrefix.trim()} ${nextNum}`,
        seatsCount: seatsPerRoom || 50,
        layout: selectedLayout,
        description: `Capacity: ${seatsPerRoom || 50} study desks`
      }
    ]);
  };

  const handleFinalConfirmAndBuild = async () => {
    if (roomList.length === 0) return;
    try {
      setLoading(true);
      setStep(3);

      const payload = {
        rooms: roomList.map(r => ({
          name: r.name,
          description: r.description,
          seatsCount: r.seatsCount,
          layout: r.layout
        }))
      };

      const result = await apiCall('/rooms/bulk', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (showFeedback) {
        showFeedback(`Successfully built ${roomList.length} rooms with ${roomList.reduce((acc, r) => acc + r.seatsCount, 0)} total seats!`);
      }

      if (onBuildComplete) {
        onBuildComplete(result);
      }
      onClose();
    } catch (err) {
      console.error(err);
      if (showFeedback) {
        showFeedback(err.message || 'Failed to bulk create rooms', 'error');
      }
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const totalSeats = roomList.reduce((acc, r) => acc + (parseInt(r.seatsCount, 10) || 0), 0);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(2, 6, 18, 0.88)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2400,
      padding: '20px'
    }}>
      <div className="glass-panel animate-fade-in-scale" style={{
        width: '100%',
        maxWidth: step === 2 ? '780px' : '560px',
        borderRadius: '24px',
        padding: '28px',
        boxShadow: 'var(--shadow-elevated)',
        border: '1.5px solid var(--border-glass-focus)',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        transition: 'max-width 0.3s ease'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(6, 182, 212, 0.15))',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Bulk Room & Seat Builder
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {step === 1 && 'Step 1: Set batch parameters and layout preset'}
                {step === 2 && 'Step 2: Review and customize each room name before confirmation'}
                {step === 3 && 'Step 3: Generating rooms and table records...'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="btn btn-secondary"
            style={{ padding: '8px', borderRadius: '50%', width: '36px', height: '36px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* STEP 1: INITIAL CONFIGURATION */}
        {step === 1 && (
          <form onSubmit={handleProceedToConfirmation} style={{ display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto' }}>
            <div style={{
              background: 'rgba(37, 99, 235, 0.06)',
              border: '1px solid rgba(37, 99, 235, 0.18)',
              borderRadius: '14px',
              padding: '14px 16px',
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}>
              💡 <strong>Bulk Builder:</strong> Quickly generate multiple library rooms at once (e.g. 10 rooms with 60 seats each). In the next step, you will be able to confirm and rename each room individually before anything is saved.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Number of Rooms to Create
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={roomCount}
                  onChange={(e) => setRoomCount(e.target.value)}
                  className="glass-input"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Seats Per Room
                </label>
                <input
                  type="number"
                  min="4"
                  max="200"
                  value={seatsPerRoom}
                  onChange={(e) => setSeatsPerRoom(e.target.value)}
                  className="glass-input"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Room Naming Prefix
                </label>
                <input
                  type="text"
                  value={roomPrefix}
                  onChange={(e) => setRoomPrefix(e.target.value)}
                  placeholder="e.g. Reading Room, Study Hall, Lab"
                  className="glass-input"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Starting Number
                </label>
                <input
                  type="number"
                  value={startNumber}
                  onChange={(e) => setStartNumber(e.target.value)}
                  className="glass-input"
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)' }}>
                Default Seating Layout Style (BookMyShow)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {LAYOUT_PRESETS.map(preset => {
                  const isSelected = selectedLayout === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => setSelectedLayout(preset.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                        background: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'var(--input-bg)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                        {preset.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {preset.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                style={{ padding: '10px 20px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-shine"
                style={{ padding: '10px 24px' }}
              >
                <span>Continue to Confirm Names</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: REVIEW & CONFIRM NAMES */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                Review each room name below. You can edit names or seat counts directly:
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)' }}>
                {roomList.length} Rooms • {totalSeats} Total Seats
              </div>
            </div>

            {/* Editable Room List Table */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              borderRadius: '14px',
              border: '1px solid var(--border-glass)',
              background: 'var(--bg-card)',
              marginBottom: '18px',
              maxHeight: '400px'
            }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Room Name (Editable)</th>
                    <th style={{ width: '130px' }}>Seats Count</th>
                    <th style={{ width: '150px' }}>Layout Style</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {roomList.map((room, idx) => (
                    <tr key={room.id}>
                      <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                      <td>
                        <input
                          type="text"
                          value={room.name}
                          onChange={(e) => handleUpdateRoomName(idx, e.target.value)}
                          className="glass-input"
                          style={{ padding: '7px 10px', fontSize: '0.84rem' }}
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={room.seatsCount}
                          onChange={(e) => handleUpdateRoomSeats(idx, e.target.value)}
                          className="glass-input"
                          style={{ padding: '7px 10px', fontSize: '0.84rem' }}
                          required
                        />
                      </td>
                      <td>
                        <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                          {LAYOUT_PRESETS.find(p => p.id === room.layout)?.name || 'Cinema'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveRoom(idx)}
                          className="btn btn-secondary"
                          style={{ padding: '6px', borderColor: 'rgba(239,68,68,0.2)', color: 'var(--danger)', borderRadius: '6px' }}
                          title="Exclude this room"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Quick Add Extra Room */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={handleAddCustomRoom}
                className="btn btn-secondary"
                style={{ padding: '7px 14px', fontSize: '0.8rem', gap: '6px' }}
              >
                <Plus size={14} /> Add Another Room Row
              </button>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                * All rooms, tables, and layouts remain 100% editable after creation.
              </div>
            </div>

            {/* Confirmation Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn btn-secondary"
                style={{ padding: '10px 18px', gap: '6px' }}
              >
                <ArrowLeft size={15} /> Back
              </button>

              <button
                type="button"
                onClick={handleFinalConfirmAndBuild}
                disabled={roomList.length === 0 || loading}
                className="btn btn-primary btn-shine"
                style={{ padding: '11px 26px', gap: '8px' }}
              >
                <Check size={16} />
                <span>Confirm & Build {roomList.length} Rooms ({totalSeats} Seats)</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CREATING ANIMATION */}
        {step === 3 && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              border: '3px solid rgba(59, 130, 246, 0.2)',
              borderTopColor: 'var(--primary)',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px'
            }} />
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>
              Building {roomList.length} Rooms & {totalSeats} Desk QR Tokens...
            </h4>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Generating table matrix, seating coordinates, and individual desk identifiers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkRoomBuilderModal;
