import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, BarChart3, Trash2, ToggleLeft, ToggleRight, ExternalLink, QrCode, Calendar } from 'lucide-react';
import { api } from '../context/AuthContext';
import QRModal from './QRModal';
import toast from 'react-hot-toast';

export default function LinkCard({ url, onUpdated, onDelete, onToggleStatus, showActions = false }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(url.short_url);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAnalytics = (e) => {
    e.stopPropagation();
    navigate(`/analytics/${url.id}`);
  };

  const isExpired = url.expires_at && new Date(url.expires_at) < new Date();
  const statusBadgeClass = isExpired ? 'badge-expired' : url.status === 'active' ? 'badge-active' : 'badge-inactive';
  const statusLabel = isExpired ? 'Expired' : url.status === 'active' ? 'Active' : 'Disabled';

  const domain = (() => {
    try { return new URL(url.original_url).hostname; }
    catch { return url.original_url; }
  })();

  return (
    <>
      <div
        className="card"
        style={{ padding: '16px 20px', cursor: 'pointer' }}
        onClick={() => navigate(`/analytics/${url.id}`)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* Favicon */}
          <div style={{
            width: 40, height: 40, borderRadius: 10, overflow: 'hidden',
            background: 'var(--bg-input)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-color)',
          }}>
            <img
              src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
              alt=""
              style={{ width: 24, height: 24 }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>

          {/* URL Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
              <a
                href={url.short_url}
                target="_blank"
                rel="noopener noreferrer"
                className="url-short"
                onClick={e => e.stopPropagation()}
                id={`short-url-${url.id}`}
              >
                {url.short_url.replace('http://localhost:5000/', 's.axly.in/')}
              </a>
              <span className={`badge ${statusBadgeClass}`}>{statusLabel}</span>
              {url.custom_alias && (
                <span className="badge" style={{ background: 'rgba(124,58,237,0.1)', color: 'var(--brand-primary)' }}>
                  Custom
                </span>
              )}
            </div>
            <div className="url-original" style={{ maxWidth: '100%' }}>
              {url.title && <span style={{ fontWeight: 500, color: 'var(--text-secondary)', marginRight: 8 }}>{url.title} ·</span>}
              {url.original_url}
            </div>
            {url.expires_at && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '0.75rem', color: isExpired ? 'var(--danger)' : 'var(--text-muted)' }}>
                <Calendar size={11} />
                {isExpired ? 'Expired' : 'Expires'} {new Date(url.expires_at).toLocaleDateString()}
              </div>
            )}
          </div>

          {/* Clicks */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              {parseInt(url.click_count || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>clicks</div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy short URL">
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
            <button className="copy-btn" onClick={handleAnalytics} title="View analytics">
              <BarChart3 size={13} />
            </button>
            <button className="copy-btn" onClick={(e) => { e.stopPropagation(); setShowQr(true); }} title="QR Code">
              <QrCode size={13} />
            </button>
            {showActions && onToggleStatus && (
              <button
                className="copy-btn"
                onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}
                title={url.status === 'active' ? 'Disable' : 'Enable'}
                style={url.status === 'active' ? {} : { color: 'var(--warning)', borderColor: 'var(--warning)' }}
              >
                {url.status === 'active' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
              </button>
            )}
            {showActions && onDelete && (
              <button
                className="copy-btn"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                title="Delete"
                style={{ color: 'var(--danger)' }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {showQr && <QRModal urlId={url.id} onClose={() => setShowQr(false)} />}
    </>
  );
}
