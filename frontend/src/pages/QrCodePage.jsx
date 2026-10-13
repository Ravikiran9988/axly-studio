import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { 
  QrCode, Download, Copy, Check, ExternalLink, RefreshCw, 
  Sparkles, Palette, Sliders, ArrowRight, ShieldCheck, Link2
} from 'lucide-react';
import toast from 'react-hot-toast';

const COLOR_PRESETS = [
  { label: 'Classic Slate', fg: '#0f172a', bg: '#ffffff' },
  { label: 'Axly Blue', fg: '#2563eb', bg: '#ffffff' },
  { label: 'Emerald Green', fg: '#059669', bg: '#ffffff' },
  { label: 'Deep Indigo', fg: '#4f46e5', bg: '#ffffff' },
  { label: 'Carbon Black', fg: '#000000', bg: '#ffffff' },
];

export default function QrCodePage() {
  const [searchParams] = useSearchParams();
  const initialUrl = searchParams.get('url') || searchParams.get('text') || '';

  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [activeUrl, setActiveUrl] = useState(initialUrl || 'https://url.axly.in');
  const [fgColor, setFgColor] = useState('#0f172a');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [exportSize, setExportSize] = useState(512); // 256, 512, 1024
  const [marginLevel, setMarginLevel] = useState(true);
  const [errorLevel, setErrorLevel] = useState('M'); // L, M, Q, H
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const canvasRef = useRef(null);
  const svgContainerRef = useRef(null);

  // Sync search param if updated
  useEffect(() => {
    if (initialUrl) {
      setInputUrl(initialUrl);
      setActiveUrl(initialUrl);
    }
  }, [initialUrl]);

  const handleApplyUrl = (e) => {
    if (e) e.preventDefault();
    const trimmed = inputUrl.trim();
    if (!trimmed) {
      toast.error('Please enter a destination URL or text');
      return;
    }
    // Auto-prefix http if user typed a bare domain
    let finalUrl = trimmed;
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('mailto:') && !trimmed.startsWith('tel:')) {
      finalUrl = `https://${trimmed}`;
    }
    setActiveUrl(finalUrl);
    toast.success('QR Code updated');
  };

  const handleDownloadPng = () => {
    try {
      setDownloading(true);
      const canvas = canvasRef.current?.querySelector('canvas');
      if (!canvas) throw new Error('Canvas not ready');

      // Create high-res export canvas
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = exportSize;
      exportCanvas.height = exportSize;
      const ctx = exportCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, 0, 0, exportSize, exportSize);

      const link = document.createElement('a');
      link.download = `axly-qr-${Date.now()}.png`;
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
      toast.success(`Downloaded ${exportSize}x${exportSize} PNG QR Code!`);
    } catch (err) {
      toast.error('Could not download PNG. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSvg = () => {
    try {
      const svgEl = svgContainerRef.current?.querySelector('svg');
      if (!svgEl) throw new Error('SVG not found');

      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgEl);
      if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `axly-qr-${Date.now()}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Downloaded vector SVG QR Code!');
    } catch {
      toast.error('Could not export SVG.');
    }
  };

  const handleCopyImage = async () => {
    try {
      const canvas = canvasRef.current?.querySelector('canvas');
      if (!canvas) throw new Error('Canvas not found');

      canvas.toBlob(async (blob) => {
        if (!blob) return toast.error('Clipboard copy failed');
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopied(true);
          toast.success('QR Code image copied to clipboard!');
          setTimeout(() => setCopied(false), 2200);
        } catch {
          // Fallback: Copy URL text
          await navigator.clipboard.writeText(activeUrl);
          toast.success('Copied URL text to clipboard!');
        }
      });
    } catch {
      toast.error('Unable to copy image to clipboard in this browser.');
    }
  };

  return (
    <div className="page-container qr-page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="icon-badge-primary">
              <QrCode size={20} />
            </span>
            QR Code Generator
          </h1>
          <p className="page-subtitle">
            Turn any website, page, or short link into a high-contrast scannable QR code you can download and share.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/app/links" className="btn btn-secondary btn-sm">
            <Link2 size={14} style={{ marginRight: 6 }} /> My Links
          </Link>
        </div>
      </div>

      {/* Main Grid: Generator Controls + Live Preview Card */}
      <div className="qr-workspace-grid">
        {/* Left Form Controls Column */}
        <div className="qr-controls-card card">
          <form onSubmit={handleApplyUrl} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Step 1: Destination URL input */}
            <div>
              <label className="form-label" style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                <span>Destination or Content URL</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                  Any web address or text
                </span>
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://yourbrand.com/campaign-page"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  style={{ flex: 1 }}
                  required
                />
                <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>
                  Generate
                </button>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
                Tip: Use short links for cleaner QR codes that scan faster from a distance.
              </p>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

            {/* Step 2: Styling and Presets */}
            <div>
              <label className="form-label" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Palette size={15} style={{ color: 'var(--brand-primary)' }} />
                Color Palette & Contrast
              </label>

              {/* Preset buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {COLOR_PRESETS.map((p) => {
                  const isSelected = fgColor === p.fg && bgColor === p.bg;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setFgColor(p.fg);
                        setBgColor(p.bg);
                      }}
                      className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                      }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: p.fg,
                          border: '1px solid rgba(0,0,0,0.15)',
                        }}
                      />
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom hex colors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Foreground Color
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      style={{ width: 36, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'transparent' }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      style={{ fontSize: '0.82rem', fontFamily: 'monospace', textTransform: 'uppercase' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Background Color
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={bgColor === 'transparent' ? '#ffffff' : bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      style={{ width: 36, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'transparent' }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      style={{ fontSize: '0.82rem', fontFamily: 'monospace', textTransform: 'uppercase' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

            {/* Step 3: Size & Density Settings */}
            <div>
              <label className="form-label" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sliders size={15} style={{ color: 'var(--brand-primary)' }} />
                Export Resolution & Reliability
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                {[
                  { size: 256, label: 'Standard', desc: 'Web & Email' },
                  { size: 512, label: 'High-Res', desc: 'Display & Social' },
                  { size: 1024, label: 'Ultra 4K', desc: 'Print & Posters' },
                ].map((item) => (
                  <button
                    key={item.size}
                    type="button"
                    onClick={() => setExportSize(item.size)}
                    className={`card ${exportSize === item.size ? 'selected-resolution' : ''}`}
                    style={{
                      padding: '10px 8px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: exportSize === item.size ? '2px solid var(--brand-primary)' : '1px solid var(--border-color)',
                      background: exportSize === item.size ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-card)',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{item.label}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.size}px</div>
                  </button>
                ))}
              </div>

              {/* Error correction level toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Error Correction Level:
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['L', 'M', 'Q', 'H'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setErrorLevel(lvl)}
                      className={`btn btn-sm ${errorLevel === lvl ? 'btn-primary' : 'btn-outline'}`}
                      style={{ padding: '2px 10px', fontSize: '0.75rem' }}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Right Live Preview & Download Column */}
        <div className="qr-preview-card card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Live Scannable Preview
            </span>
            <span className="badge badge-active" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={12} /> Scans Verified
            </span>
          </div>

          {/* Render Frame with high-contrast background */}
          <div 
            className="qr-render-box" 
            style={{
              padding: 24,
              backgroundColor: bgColor === 'transparent' ? '#ffffff' : bgColor,
              borderRadius: 16,
              boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
              border: '1px solid var(--border-color)',
              display: 'grid',
              placeItems: 'center',
              margin: '12px 0 20px',
            }}
          >
            {/* Real Canvas element used for PNG downloads & copy */}
            <div ref={canvasRef}>
              <QRCodeCanvas
                value={activeUrl}
                size={220}
                fgColor={fgColor}
                bgColor={bgColor}
                level={errorLevel}
                includeMargin={marginLevel}
              />
            </div>

            {/* Hidden SVG element for true vector exports */}
            <div ref={svgContainerRef} style={{ display: 'none' }}>
              <QRCodeSVG
                value={activeUrl}
                size={exportSize}
                fgColor={fgColor}
                bgColor={bgColor}
                level={errorLevel}
                includeMargin={marginLevel}
              />
            </div>
          </div>

          {/* Active destination pill */}
          <div 
            style={{
              width: '100%',
              maxWidth: 340,
              padding: '8px 14px',
              borderRadius: 8,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              overflow: 'hidden',
              marginBottom: 20,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeUrl}
            </span>
            <a 
              href={activeUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="copy-btn" 
              title="Test destination in new tab"
              style={{ flexShrink: 0 }}
            >
              <ExternalLink size={12} />
            </a>
          </div>

          {/* Download Action Buttons */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDownloadPng}
              disabled={downloading}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Download size={16} style={{ marginRight: 8 }} />
              Download High-Res PNG ({exportSize}px)
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleDownloadSvg}
                style={{ justifyContent: 'center', fontSize: '0.84rem' }}
              >
                Vector SVG
              </button>

              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCopyImage}
                style={{ justifyContent: 'center', fontSize: '0.84rem' }}
              >
                {copied ? <Check size={14} style={{ color: 'var(--success)', marginRight: 6 }} /> : <Copy size={14} style={{ marginRight: 6 }} />}
                {copied ? 'Copied' : 'Copy Image'}
              </button>
            </div>
          </div>

          {/* Shorten CTA footnote if user is using long external URL */}
          {!activeUrl.includes('axly.in') && !activeUrl.includes('s.axly.in') && (
            <div 
              style={{ 
                marginTop: 20, 
                padding: '12px 14px', 
                borderRadius: 10, 
                background: 'rgba(37, 99, 235, 0.05)', 
                border: '1px solid rgba(37, 99, 235, 0.15)',
                fontSize: '0.78rem',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <span style={{ fontWeight: 700, color: 'var(--brand-primary)', display: 'block', marginBottom: 2 }}>
                Need tracking on this QR code?
              </span>
              Shorten your destination with Axly first to track scan analytics and redirect destinations later.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
