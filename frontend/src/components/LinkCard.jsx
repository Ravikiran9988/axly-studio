import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Copy, Check, BarChart3, Trash2, ToggleLeft, ToggleRight,
  ExternalLink, QrCode, Calendar, Tag, Lock, ShieldCheck,
  Sliders, AlertTriangle, Megaphone,
} from 'lucide-react';
import QRModal from './QRModal';
import toast from 'react-hot-toast';

export default function LinkCard({
  url,
  isSelected = false,
  onToggleSelect,
  onTagClick,
  onDelete,
  onToggleStatus,
  showActions = false,
}) {
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

  const isExpired = url.expires_at && new Date(url.expires_at) < new Date();
  const isExpiringSoon = url.expires_at && !isExpired && (new Date(url.expires_at) - new Date() < 3 * 24 * 3600 * 1000);
  const statusBadgeClass = isExpired ? 'badge-expired' : url.status === 'active' ? 'badge-active' : 'badge-inactive';
  const statusLabel = isExpired ? 'Expired' : url.status === 'active' ? 'Active' : 'Disabled';

  const domain = (() => {
    try { return new URL(url.original_url).hostname; }
    catch { return url.original_url; }
  })();

  const tags = Array.isArray(url.tags) ? url.tags : [];

  return (
    <>
      <div
        className={`card link-card-container ${isSelected ? 'selected' : ''}`}
        style={{
          cursor: 'pointer',
          borderColor: isSelected ? 'var(--brand-primary)' : undefined,
          background: isSelected ? 'rgba(37, 99, 235, 0.02)' : undefined,
          transition: 'all 0.2s ease',
        }}
        onClick={() => navigate(`/app/links/${url.id}`)}
      >
        <div className="link-card-layout">
          {/* Main Info Block */}
          <div className="link-card-main-block">
            {/* Checkbox for Bulk Selection */}
            {onToggleSelect && (
              <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={onToggleSelect}
                  aria-label={`Select link ${url.short_code}`}
                  style={{
                    width: 18,
                    height: 18,
                    accentColor: 'var(--brand-primary)',
                    cursor: 'pointer',
                  }}
                />
              </div>
            )}

            {/* Favicon */}
            <div className="link-card-favicon" style={{
              width: 38, height: 38, borderRadius: 10, overflow: 'hidden',
              background: 'var(--bg-input)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-color)',
            }}>
              <img
                src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
                alt=""
                style={{ width: 20, height: 20 }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>

            {/* URL Info */}
            <div className="link-card-details" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <a
                  href={url.short_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="url-short"
                  onClick={e => e.stopPropagation()}
                  id={`short-url-${url.id}`}
                  style={{ fontSize: '0.98rem' }}
                >
                  {url.short_url?.replace(/^https?:\/\//, '')}
                </a>
                <span className={`badge ${statusBadgeClass}`}>{statusLabel}</span>

                {url.custom_alias && (
                  <span className="badge" style={{ background: 'rgba(37,99,235,0.08)', color: 'var(--brand-primary)' }}>
                    Custom
                  </span>
                )}

                {url.has_password && (
                  <span className="badge" style={{ background: 'rgba(234,88,12,0.1)', color: '#ea580c', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Lock size={10} /> Protected
                  </span>
                )}

                {url.is_preview_enabled && (
                  <span className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <ShieldCheck size={10} /> Preview
                  </span>
                )}

                {url.campaign_name && (
                  <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Megaphone size={11} /> {url.campaign_name}
                  </span>
                )}
              </div>

              <div className="url-original" style={{ maxWidth: '100%' }}>
                {url.title && <span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginRight: 8 }}>{url.title} ·</span>}
                {url.original_url}
              </div>

              {/* Tags and Warning Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="tag-badge clickable"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onTagClick) onTagClick(tag);
                    }}
                  >
                    <Tag size={10} /> {tag}
                  </span>
                ))}

                {url.expires_at && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: '0.74rem',
                    color: isExpired ? 'var(--danger)' : isExpiringSoon ? '#d97706' : 'var(--text-muted)',
                    fontWeight: isExpiringSoon ? 600 : 400,
                  }}>
                    {isExpiringSoon ? <AlertTriangle size={12} color="#d97706" /> : <Calendar size={11} />}
                    {isExpired ? 'Expired' : isExpiringSoon ? 'Expiring soon' : 'Expires'} {new Date(url.expires_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Aside Section: Clicks + Actions */}
          <div className="link-card-aside">
            {/* Clicks Counter */}
            <div className="link-card-clicks">
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                {parseInt(url.click_count || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {parseInt(url.unique_clicks || 0).toLocaleString()} unique
              </div>
            </div>

            {/* Action Buttons */}
            <div className="link-card-actions" onClick={e => e.stopPropagation()}>
              <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy short URL">
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
              <button className="copy-btn" onClick={() => navigate(`/app/links/${url.id}`)} title="Link settings & smart rules">
                <Sliders size={13} />
              </button>
              <button className="copy-btn" onClick={() => navigate(`/app/analytics/${url.id}`)} title="View link analytics">
                <BarChart3 size={13} />
              </button>
              <button className="copy-btn" onClick={() => setShowQr(true)} title="QR Code">
                <QrCode size={13} />
              </button>
              {showActions && onToggleStatus && (
                <button
                  className="copy-btn"
                  onClick={onToggleStatus}
                  title={url.status === 'active' ? 'Disable link' : 'Enable link'}
                  style={url.status === 'active' ? {} : { color: 'var(--warning)', borderColor: 'var(--warning)' }}
                >
                  {url.status === 'active' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                </button>
              )}
              {showActions && onDelete && (
                <button
                  className="copy-btn"
                  onClick={onDelete}
                  title="Delete link"
                  style={{ color: 'var(--danger)' }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showQr && <QRModal urlId={url.id} onClose={() => setShowQr(false)} />}
    </>
  );
}
