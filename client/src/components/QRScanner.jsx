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

      // Try native barcode detection if available
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
      background: 'rgba(5, 7, 12, 0.92)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '24px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <QrCode size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1rem' }}>
              {title || (type === 'table' ? 'Scan Table QR Code' : 'Scan Book Code')}
            </h3>
          </div>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="btn btn-secondary"
            style={{ padding: '6px', borderRadius: '50%' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Camera Preview */}
        <div style={{
          width: '100%',
          aspectRatio: '4/3',
          background: '#000',
          borderRadius: '12px',
          overflow: 'hidden',
          position: 'relative',
          marginBottom: '16px'
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
              gap: '12px'
            }}>
              <Camera size={40} style={{ color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Tap below to start scanning
              </p>
            </div>
          )}

          {isActive && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '10%',
              right: '10%',
              height: '2px',
              background: 'var(--primary)',
              boxShadow: '0 0 12px var(--primary)',
              animation: 'scanLine 2s ease-in-out infinite'
            }} />
          )}

          {error && (
            <div style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              right: '10px',
              padding: '8px',
              background: 'rgba(239, 68, 68, 0.9)',
              borderRadius: '8px',
              fontSize: '0.78rem',
              color: '#fff',
              textAlign: 'center'
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
              style={{ flex: 1, padding: '12px' }}
            >
              <Camera size={16} /> Start Camera
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '12px' }}
            >
              Stop Camera
            </button>
          )}
          <button
            onClick={() => setShowManual(!showManual)}
            className="btn btn-secondary"
            style={{ padding: '12px' }}
          >
            {showManual ? 'Hide' : 'Manual Entry'}
          </button>
        </div>

        {/* Manual Input */}
        {showManual && (
          <form onSubmit={handleManualSubmit} style={{
            display: 'flex',
            gap: '8px'
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
