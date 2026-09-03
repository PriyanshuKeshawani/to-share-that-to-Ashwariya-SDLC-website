import { useState, useRef, useEffect } from 'react';
import { Camera, X, ScanLine, QrCode } from 'lucide-react';

const QRScanner = ({ onScan, onClose, type = 'table', title }) => {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [showManual, setShowManual] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);

      if ('BarcodeDetector' in window) {
        const detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39'] });
        const detectLoop = async () => {
          if (!streamRef.current || !videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              handleDetected(barcodes[0].rawValue);
              return;
            }
          } catch (e) {
            // Continue scanning
          }
          if (streamRef.current) {
            requestAnimationFrame(detectLoop);
          }
        };
        detectLoop();
      }
    } catch (err) {
      console.warn('Camera error:', err);
      setError('Camera access denied or not available. Use manual entry below.');
      setShowManual(true);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsActive(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const handleDetected = (value) => {
    stopCamera();
    if (onScan) onScan(value);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualInput.trim()) {
      if (onScan) onScan(manualInput.trim());
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(4, 6, 14, 0.92)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '28px',
        borderRadius: '20px',
        boxShadow: 'var(--shadow-elevated)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '22px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(6, 182, 212, 0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <QrCode size={18} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              {title || (type === 'table' ? 'Scan Table QR Code' : 'Scan Book Code')}
            </h3>
          </div>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="btn btn-secondary"
            style={{ padding: '6px', borderRadius: '8px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Camera Preview */}
        <div style={{
          width: '100%',
          aspectRatio: '4/3',
          background: '#000',
          borderRadius: '14px',
          overflow: 'hidden',
          position: 'relative',
          marginBottom: '18px',
          border: '1px solid var(--border-glass)'
        }}>
          <video
            ref={videoRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: isActive ? 'block' : 'none'
            }}
            playsInline
            muted
          />
          
          {!isActive && !showManual && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px'
            }}>
              <div className="animate-float" style={{
                width: '64px', height: '64px', borderRadius: '16px',
                background: 'rgba(59, 130, 246, 0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(59, 130, 246, 0.2)'
              }}>
                <Camera size={32} style={{ color: 'var(--primary)' }} />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', fontWeight: 500 }}>
                Tap below to start scanning
              </p>
            </div>
          )}

          {isActive && (
            <>
              {/* Scanner Reticle Frame */}
              <div style={{
                position: 'absolute',
                inset: '16%',
                border: '1.5px dashed rgba(6, 182, 212, 0.35)',
                borderRadius: '16px',
                pointerEvents: 'none'
              }}>
                <div style={{ position: 'absolute', top: -2, left: -2, width: '18px', height: '18px', borderTop: '3px solid var(--secondary)', borderLeft: '3px solid var(--secondary)', borderTopLeftRadius: '6px' }} />
                <div style={{ position: 'absolute', top: -2, right: -2, width: '18px', height: '18px', borderTop: '3px solid var(--secondary)', borderRight: '3px solid var(--secondary)', borderTopRightRadius: '6px' }} />
                <div style={{ position: 'absolute', bottom: -2, left: -2, width: '18px', height: '18px', borderBottom: '3px solid var(--secondary)', borderLeft: '3px solid var(--secondary)', borderBottomLeftRadius: '6px' }} />
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: '18px', height: '18px', borderBottom: '3px solid var(--secondary)', borderRight: '3px solid var(--secondary)', borderBottomRightRadius: '6px' }} />
              </div>

              {/* Glowing Laser Scan Motion Graphic */}
              <div style={{
                position: 'absolute',
                left: '12%',
                right: '12%',
                height: '3px',
                background: 'linear-gradient(90deg, transparent, #22d3ee, #38bdf8, transparent)',
                boxShadow: '0 0 16px #06b6d4, 0 0 30px #06b6d4',
                animation: 'scanLine 2.2s ease-in-out infinite alternate',
                pointerEvents: 'none'
              }} />
            </>
          )}

          {error && (
            <div style={{
              position: 'absolute',
              bottom: '10px', left: '10px', right: '10px',
              padding: '10px',
              background: 'rgba(239, 68, 68, 0.9)',
              borderRadius: '10px',
              fontSize: '0.8rem',
              color: '#fff',
              textAlign: 'center',
              backdropFilter: 'blur(8px)'
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          {!isActive ? (
            <button
              onClick={startCamera}
              className="btn btn-primary"
              style={{ flex: 1, padding: '12px', borderRadius: '10px' }}
            >
              <Camera size={16} /> Start Camera
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '12px', borderRadius: '10px' }}
            >
              Stop Camera
            </button>
          )}
          <button
            onClick={() => setShowManual(!showManual)}
            className="btn btn-secondary"
            style={{ padding: '12px', borderRadius: '10px' }}
          >
            {showManual ? 'Hide' : 'Manual'}
          </button>
        </div>

        {/* Manual Input */}
        {showManual && (
          <form onSubmit={handleManualSubmit} style={{
            display: 'flex',
            gap: '10px',
            animation: 'fadeIn 0.3s ease forwards'
          }}>
            <input
              type="text"
              className="glass-input"
              placeholder={type === 'table' ? 'Enter table QR code...' : 'Enter book UUID...'}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!manualInput.trim()}
              style={{ borderRadius: '10px' }}
            >
              Submit
            </button>
          </form>
        )}

        <style>{`
          @keyframes scanLine {
            0%, 100% { top: 20%; }
            50% { top: 80%; }
          }
        `}</style>
      </div>
    </div>
  );
};

export default QRScanner;
