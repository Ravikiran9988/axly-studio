import { useState } from 'react';
import { AlertTriangle, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { api } from '../context/AuthContext';
import toast from 'react-hot-toast';

const REPORT_REASONS = [
  { value: 'phishing', label: '🎣 Phishing or Credential Theft' },
  { value: 'malware', label: '🦠 Malware, Virus or Dangerous Download' },
  { value: 'spam', label: '📢 Spam or Deceptive Scam' },
  { value: 'copyright', label: '⚖️ Copyright or Trademark Infringement' },
  { value: 'harassment', label: '🚫 Harassment, Hate Speech or Threat' },
  { value: 'other', label: '⚠️ Other Policy Violation' },
];

export default function ReportModal({ isOpen, onClose, shortCode = '', urlId = null, targetUrl = '' }) {
  const [reason, setReason] = useState('phishing');
  const [details, setDetails] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post('/reports', {
        shortCode: shortCode || undefined,
        urlId: urlId || undefined,
        reason,
        details,
        reporterEmail: reporterEmail || undefined,
      });

      setSubmitted(true);
      toast.success('Abuse report submitted successfully.');
      setTimeout(() => {
        setSubmitted(false);
        setDetails('');
        setReporterEmail('');
        onClose();
      }, 1800);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit abuse report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)',
    }}>
      <div 
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520, padding: 28,
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-card)',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: '#fef2f2', color: '#dc2626',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Report Suspicious Link</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                Report security threats, scams, or abuse to our operations team.
              </p>
            </div>
          </div>
          <button 
            className="btn btn-ghost" 
            onClick={onClose}
            style={{ padding: 6, borderRadius: 'var(--radius-full)' }}
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <CheckCircle2 size={48} style={{ color: '#16a34a', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>Report Received</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Thank you for keeping Axly safe. Our moderation team has queued this link for review.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {shortCode && (
              <div style={{
                padding: '10px 14px', background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)', marginBottom: 16,
                fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between',
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>Reported Link:</span>
                <span style={{ fontWeight: 600, color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                  /{shortCode}
                </span>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                Reason for Report *
              </label>
              <select 
                className="form-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ width: '100%', padding: '10px 12px' }}
                required
              >
                {REPORT_REASONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                Violation Details & Context
              </label>
              <textarea
                className="form-input"
                placeholder="Explain why this destination URL is harmful or misleading..."
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                Your Email (Optional, for resolution updates)
              </label>
              <input
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Abuse Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
