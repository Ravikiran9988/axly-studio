import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowRight, ExternalLink, Copy, Check, QrCode, 
  BarChart2, Zap, ShieldCheck, CheckCircle2, MessageSquare, Sparkles 
} from 'lucide-react';
import TelegramIcon from './TelegramIcon';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function TelegramShowcase() {
  const { user } = useAuth();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [showQrPreview, setShowQrPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('link'); // 'link' | 'qr' | 'stats'

  const demoShortUrl = 'https://s.axly.in/telegram-demo';
  const botUrl = 'https://t.me/AxlyStudioBot';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(demoShortUrl);
      setCopiedLink(true);
      toast.success('Demo short link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      toast.error('Could not copy link.');
    }
  };

  const handleCopyHandle = async () => {
    try {
      await navigator.clipboard.writeText('@AxlyStudioBot');
      setCopiedHandle(true);
      toast.success('Bot handle @AxlyStudioBot copied!');
      setTimeout(() => setCopiedHandle(false), 2200);
    } catch {
      toast.error('Could not copy handle.');
    }
  };

  return (
    <section className="telegram-showcase-section" id="telegram" aria-label="Telegram Bot Integration">
      {/* Decorative ambient background glows */}
      <div className="telegram-ambient-glow telegram-ambient-left" aria-hidden="true" />
      <div className="telegram-ambient-glow telegram-ambient-right" aria-hidden="true" />

      <div className="telegram-showcase-container">
        {/* Left Column: Value proposition and actions */}
        <div className="telegram-showcase-copy">
          <div className="telegram-showcase-eyebrow">
            <TelegramIcon size={16} variant="circle" />
            <span className="tg-eyebrow-text-desktop">ALSO AVAILABLE ON TELEGRAM</span>
            <span className="tg-eyebrow-text-mobile">TELEGRAM BOT</span>
          </div>

          <h2>
            Shorten links &amp; create QR codes directly in{' '}
            <span className="tg-gradient-text">Telegram</span>.
          </h2>

          <p>
            Never switch contexts again. Forward links or chat directly with{' '}
            <strong>@AxlyStudioBot</strong> to instantly shorten URLs, generate high-res QR codes, and review click analytics without leaving your conversation.
          </p>

          <div className="telegram-feature-list">
            <div className="telegram-feature-item">
              <div className="telegram-feature-icon">
                <Zap size={18} />
              </div>
              <div className="telegram-feature-text">
                <strong>Instant 1-Tap Shortening</strong>
                <p>Send or forward any HTTP/HTTPS link to receive a clean, lightweight <code>s.axly.in</code> short URL in seconds.</p>
              </div>
            </div>

            <div className="telegram-feature-item">
              <div className="telegram-feature-icon">
                <QrCode size={18} />
              </div>
              <div className="telegram-feature-text">
                <strong>On-Demand QR Codes</strong>
                <p>Use <code>/qr &lt;url&gt;</code> or tap the inline button to generate and download scannable QR images directly in your chat.</p>
              </div>
            </div>

            <div className="telegram-feature-item">
              <div className="telegram-feature-icon">
                <BarChart2 size={18} />
              </div>
              <div className="telegram-feature-text">
                <strong>Account Sync &amp; Click Analytics</strong>
                <p>Link your Axly account with a secure code to view visitor counts, manage saved links with <code>/mylinks</code>, and set custom aliases.</p>
              </div>
            </div>

            <div className="telegram-feature-item">
              <div className="telegram-feature-icon">
                <ShieldCheck size={18} />
              </div>
              <div className="telegram-feature-text">
                <strong>Safe &amp; Ad-Free Experience</strong>
                <p>Built with enterprise protocol validation, automated spam protection, and privacy-preserving visitor logging.</p>
              </div>
            </div>
          </div>

          <div className="telegram-showcase-actions">
            <a
              href={botUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-telegram-primary"
              id="try-telegram-btn"
            >
              <TelegramIcon size={19} color="#ffffff" />
              <span>Try on Telegram</span>
              <ArrowRight size={16} className="btn-arrow-icon" />
            </a>

            <button
              type="button"
              className="telegram-handle-pill"
              onClick={handleCopyHandle}
              title="Click to copy bot username"
              aria-label="Copy Telegram bot handle @AxlyStudioBot"
            >
              {copiedHandle ? (
                <>
                  <Check size={15} style={{ color: 'var(--success)' }} />
                  <span>Copied @AxlyStudioBot</span>
                </>
              ) : (
                <>
                  <Copy size={15} />
                  <span>@AxlyStudioBot</span>
                </>
              )}
            </button>

            {user ? (
              <Link to="/app/settings" className="telegram-account-link-btn" title="Open Settings to link bot">
                Link in Settings <ArrowRight size={13} />
              </Link>
            ) : (
              <a 
                href={botUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="telegram-web-open-link"
              >
                <span>Open in Web Telegram</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Telegram Chat Mockup */}
        <div className="telegram-showcase-preview-wrapper">
          <div className="telegram-chat-mockup" aria-label="Interactive Telegram Bot Preview">
            {/* Telegram App Header Bar */}
            <div className="telegram-mockup-header">
              <div className="telegram-mockup-header-left">
                <div className="telegram-bot-avatar">
                  <TelegramIcon size={22} color="#ffffff" />
                </div>
                <div className="telegram-bot-info">
                  <div className="telegram-bot-name-row">
                    <span className="telegram-bot-name">Axly Studio Bot</span>
                    <span className="telegram-bot-badge" title="Official Bot">✓</span>
                  </div>
                  <span className="telegram-bot-status">bot · always ready</span>
                </div>
              </div>
              <a
                href={botUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="telegram-mockup-header-action"
                title="Open in Telegram app"
                aria-label="Open in Telegram"
              >
                <ExternalLink size={16} />
              </a>
            </div>

            {/* Telegram Messages Canvas */}
            <div className="telegram-mockup-body">
              {/* Date separator */}
              <div className="telegram-date-badge">
                <span>TODAY</span>
              </div>

              {/* User Sent Message */}
              <div className="telegram-msg telegram-msg-user">
                <p className="telegram-msg-text">
                  https://axly.in/launch
                </p>
                <div className="telegram-msg-meta">
                  <span className="telegram-msg-time">10:42 AM</span>
                  <span className="telegram-msg-ticks" aria-label="Read">✓✓</span>
                </div>
              </div>

              {/* Bot Response Message */}
              <div className="telegram-msg telegram-msg-bot">
                <div className="telegram-bot-reply-header">
                  <Sparkles size={14} className="telegram-sparkle-icon" />
                  <span>Axly Studio URL Shortener</span>
                </div>

                {activeTab === 'link' && (
                  <div className="telegram-bot-content-view">
                    <p className="telegram-bot-lead">⚡ <strong>Link shortened successfully!</strong></p>
                    
                    <div className="telegram-bot-link-box">
                      <span className="telegram-bot-link-label">Short link:</span>
                      <a 
                        href={demoShortUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="telegram-bot-url"
                        onClick={(e) => { e.preventDefault(); handleCopyLink(); }}
                      >
                        {demoShortUrl}
                      </a>
                    </div>

                    <p className="telegram-bot-dest">
                      <strong>Destination:</strong> axly.in/launch
                    </p>
                  </div>
                )}

                {activeTab === 'qr' && (
                  <div className="telegram-bot-content-view telegram-bot-qr-view">
                    <div className="telegram-bot-qr-canvas">
                      <QRCodeSVG
                        value={demoShortUrl}
                        size={120}
                        level="M"
                        includeMargin
                        bgColor="#ffffff"
                        fgColor="#0f172a"
                      />
                    </div>
                    <p className="telegram-bot-qr-caption">Scannable QR for <code>{demoShortUrl}</code></p>
                  </div>
                )}

                {activeTab === 'stats' && (
                  <div className="telegram-bot-content-view telegram-bot-stats-view">
                    <div className="telegram-stats-grid">
                      <div className="telegram-stat-pill">
                        <span className="telegram-stat-value">1,428</span>
                        <span className="telegram-stat-label">Total Clicks</span>
                      </div>
                      <div className="telegram-stat-pill">
                        <span className="telegram-stat-value">942</span>
                        <span className="telegram-stat-label">Unique Visitors</span>
                      </div>
                    </div>
                    <p className="telegram-stats-top-ref">Top source: <strong>Telegram Mobile (68%)</strong></p>
                  </div>
                )}

                {/* Inline Telegram Keyboard Buttons */}
                <div className="telegram-inline-keyboard">
                  <button
                    type="button"
                    className={`telegram-inline-btn ${activeTab === 'link' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('link'); handleCopyLink(); }}
                    title="Copy short link"
                  >
                    {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                  </button>

                  <button
                    type="button"
                    className={`telegram-inline-btn ${activeTab === 'qr' ? 'active' : ''}`}
                    onClick={() => setActiveTab(activeTab === 'qr' ? 'link' : 'qr')}
                    title="Toggle QR Code preview"
                  >
                    <QrCode size={13} />
                    <span>{activeTab === 'qr' ? 'Hide QR' : 'Show QR'}</span>
                  </button>

                  <button
                    type="button"
                    className={`telegram-inline-btn telegram-inline-btn-wide ${activeTab === 'stats' ? 'active' : ''}`}
                    onClick={() => setActiveTab(activeTab === 'stats' ? 'link' : 'stats')}
                    title="View Click Analytics"
                  >
                    <BarChart2 size={13} />
                    <span>{activeTab === 'stats' ? 'Hide Stats' : 'View Analytics'}</span>
                  </button>
                </div>

                <div className="telegram-msg-meta telegram-bot-meta">
                  <span className="telegram-msg-time">10:42 AM</span>
                </div>
              </div>
            </div>

            {/* Bottom Command Quick-Bar */}
            <div className="telegram-command-bar">
              <span className="telegram-command-label">Commands:</span>
              <a href={botUrl} target="_blank" rel="noopener noreferrer" className="telegram-command-chip">
                /shorten
              </a>
              <a href={botUrl} target="_blank" rel="noopener noreferrer" className="telegram-command-chip">
                /qr
              </a>
              <a href={botUrl} target="_blank" rel="noopener noreferrer" className="telegram-command-chip">
                /stats
              </a>
              <a href={botUrl} target="_blank" rel="noopener noreferrer" className="telegram-command-chip">
                /mylinks
              </a>
              <a href={botUrl} target="_blank" rel="noopener noreferrer" className="telegram-command-chip">
                /help
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
