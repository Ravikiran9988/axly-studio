import { useState, useEffect } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import { api } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function QRModal({ urlId, onClose }) {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/urls/${urlId}/qr`);
        setQrData(res.data);
      } catch {
        toast.error('Failed to generate QR code');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [urlId]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = qrData.qrCode;
    link.download = `axly-qr-${urlId}.png`;
    link.click();
    toast.success('QR code downloaded!');
  };

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(qrData.shortUrl);
    setCopied(true);
    toast.success('URL copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <button className="modal-close" onClick={onClose}><X size={16} /></button>

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>QR Code</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Scan to open the short URL
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="spinner spinner-dark" style={{ width: 32, height: 32, margin: '0 auto' }} />
            <p style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Generating QR code...</p>
          </div>
        ) : (
          <div className="qr-container">
            <div className="qr-image">
              <img
                src={qrData.qrCode}
                alt="QR Code"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>

            <div style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--brand-primary)', fontWeight: 500, wordBreak: 'break-all' }}>
                {qrData.shortUrl?.replace('http://localhost:5000/', 's.axly.in/')}
              </span>
              <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopyUrl} style={{ flexShrink: 0 }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
                Close
              </button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleDownload}>
                <Download size={15} /> Download PNG
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
