import { useState, useEffect } from 'react';
import { X, Download, Printer, QrCode, UserCheck, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import { generateQRDataURL, downloadPrintableBadge } from '../utils/qrGenerator';

const TableQRBadgeModal = ({ table, room, onClose, onVacateTable, onDeleteTable }) => {
  const [qrUrl, setQrUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!table) return;
    generateQRDataURL(table.qr_identifier || `TABLE-${table.id}`, { width: 320 })
      .then(url => setQrUrl(url));
  }, [table]);

  if (!table) return null;

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await downloadPrintableBadge(table, room);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SISTec Library Desk Pass - Table ${table.table_number}</title>
          <style>
            @page { size: auto; margin: 15mm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; text-align: center; color: #0f172a; margin: 0; padding: 20px; }
            .badge-box { border: 4px solid #1e40af; border-radius: 16px; padding: 24px; max-width: 420px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header-banner { background: #0a1128; color: #fff; padding: 16px; border-radius: 10px; margin-bottom: 20px; }
            .header-banner h2 { margin: 0 0 4px; color: #f59e0b; font-size: 18px; }
            .header-banner p { margin: 0; font-size: 13px; color: #cbd5e1; }
            .room-name { font-size: 18px; font-weight: 700; color: #334155; margin-bottom: 6px; }
            .table-pill { display: inline-block; background: #1e40af; color: #fff; font-size: 26px; font-weight: 800; padding: 8px 30px; border-radius: 50px; margin-bottom: 20px; }
            .qr-img { width: 260px; height: 260px; display: block; margin: 0 auto 16px; }
            .instruction { font-size: 12px; color: #64748b; margin-top: 12px; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
          </style>
        </head>
        <body>
          <div class="badge-box">
            <div class="header-banner">
              <h2>SISTec CENTRAL DIGITAL LIBRARY</h2>
              <p>Official Study Desk Pass • Sagar Group</p>
            </div>
            <div class="room-name">${room?.name || 'Central Reading Hall'}</div>
            <div class="table-pill">TABLE ${table.table_number}</div>
            <img class="qr-img" src="${qrUrl}" alt="Table QR Code" />
            <div class="instruction">
              <strong>Scan using SISTec Student Portal to Register Seat</strong><br/>
              ID: ${table.qr_identifier || table.id}
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(table.qr_identifier || `TABLE-${table.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const isOccupied = table.status === 'occupied';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(2, 6, 18, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2500,
      padding: '20px'
    }}>
      <div className="glass-panel animate-fade-in-scale" style={{
        width: '100%',
        maxWidth: '520px',
        borderRadius: '24px',
        padding: '28px',
        boxShadow: 'var(--shadow-elevated)',
        border: '1.5px solid var(--border-glass-focus)',
        position: 'relative',
        maxHeight: '92vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <QrCode size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Desk {table.table_number}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {room?.name || 'Study Room'} • Specific Downloadable QR Badge
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '8px', borderRadius: '50%', width: '36px', height: '36px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Printable Badge Visual Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '18px',
          padding: '20px',
          textAlign: 'center',
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          marginBottom: '20px',
          border: '3px solid #1e40af',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            background: '#0a1128',
            color: '#ffffff',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '14px'
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.04em' }}>
              SISTec CENTRAL DIGITAL LIBRARY
            </div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
              Official Study Desk Pass
            </div>
          </div>

          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
            {room?.name || 'Main Reading Hall'}
          </div>

          <div style={{
            display: 'inline-block',
            background: '#1e40af',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '1.2rem',
            padding: '4px 20px',
            borderRadius: '999px',
            marginBottom: '12px'
          }}>
            TABLE {table.table_number}
          </div>

          {/* QR Image */}
          <div style={{
            background: '#ffffff',
            display: 'inline-block',
            padding: '8px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            marginBottom: '10px'
          }}>
            {qrUrl ? (
              <img
                src={qrUrl}
                alt={`QR for Table ${table.table_number}`}
                style={{ width: '180px', height: '180px', display: 'block' }}
              />
            ) : (
              <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                Generating QR...
              </div>
            )}
          </div>

          <div style={{
            fontSize: '0.72rem',
            color: '#64748b',
            borderTop: '1px dashed #cbd5e1',
            paddingTop: '8px'
          }}>
            Scan via SISTec Library Student Portal • <strong>{table.qr_identifier || table.id}</strong>
          </div>
        </div>

        {/* Live Occupancy Status Card */}
        <div className="glass-panel" style={{
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderLeft: isOccupied ? '4px solid #ef4444' : '4px solid #10b981'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="status-live-dot" style={{ backgroundColor: isOccupied ? '#ef4444' : '#10b981', boxShadow: isOccupied ? '0 0 8px #ef4444' : '0 0 8px #10b981' }}>
                <span className="status-live-ping" style={{ backgroundColor: isOccupied ? '#ef4444' : '#10b981' }} />
              </span>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: isOccupied ? '#ef4444' : '#10b981' }}>
                {isOccupied ? 'Currently Occupied' : 'Free / Available'}
              </span>
            </div>
            {isOccupied ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Occupant: <strong>{table.occupant_name || 'Student'}</strong> {table.occupant_roll && `(${table.occupant_roll})`}
              </div>
            ) : (
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Ready for student self-check-in
              </div>
            )}
          </div>

          {isOccupied && onVacateTable && (
            <button
              onClick={() => onVacateTable(table)}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
            >
              <UserCheck size={13} /> Free Seat
            </button>
          )}
        </div>

        {/* Download & Print Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="btn btn-primary btn-shine"
            style={{ padding: '11px', fontSize: '0.85rem' }}
          >
            <Download size={16} />
            <span>{downloading ? 'Downloading...' : 'Download Badge (PNG)'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="btn btn-secondary"
            style={{ padding: '11px', fontSize: '0.85rem' }}
          >
            <Printer size={16} />
            <span>Print Badge</span>
          </button>
        </div>

        {/* Secondary Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px' }}>
          <button
            onClick={handleCopyCode}
            style={{ background: 'none', border: 'none', color: 'var(--secondary)', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: 0 }}
          >
            {copied ? <CheckCircle2 size={13} color="#10b981" /> : <QrCode size={13} />}
            <span>{copied ? 'QR Code Identifier Copied!' : 'Copy QR Code String'}</span>
          </button>

          {onDeleteTable && (
            <button
              onClick={() => onDeleteTable(table)}
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
            >
              <Trash2 size={13} /> Delete Desk
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TableQRBadgeModal;
