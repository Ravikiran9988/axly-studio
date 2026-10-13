import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../context/AuthContext';
import {
  ArrowUpRight, Download, ExternalLink, Mail, Phone, Globe, Link2,
  Github, Linkedin, Instagram, Youtube, Copy, Check, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const getEmbedUrl = (value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host === 'youtu.be') return 'https://www.youtube-nocookie.com/embed/' + url.pathname.replace('/', '');
    if (host === 'youtube.com' || host === 'www.youtube.com') {
      const videoId = url.searchParams.get('v');
      return videoId ? 'https://www.youtube-nocookie.com/embed/' + videoId : null;
    }
    if (host === 'vimeo.com' || host === 'www.vimeo.com') return 'https://player.vimeo.com/video/' + url.pathname.replace('/', '');
    if (host === 'player.vimeo.com') return url.toString();
    return null;
  } catch { return null; }
};

const cleanVCardText = (value) => String(value || '').replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replaceAll('\n', ' ');
const downloadVCard = (page) => {
  const fullName = page.title || 'Axly Contact';
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:' + cleanVCardText(fullName),
    'N:' + cleanVCardText(fullName) + ';;;;',
  ];
  if (page.contact_email) lines.push('EMAIL;TYPE=INTERNET:' + cleanVCardText(page.contact_email));
  if (page.contact_phone) lines.push('TEL;TYPE=CELL:' + cleanVCardText(page.contact_phone));
  if (page.contact_company) lines.push('ORG:' + cleanVCardText(page.contact_company));
  if (page.contact_job_title) lines.push('TITLE:' + cleanVCardText(page.contact_job_title));
  lines.push('URL:' + window.location.href, 'END:VCARD');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = (page.slug || 'axly-contact') + '.vcf';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
};

const socialIcon = (platform) => {
  const key = String(platform || '').toLowerCase();
  if (key === 'github') return <Github size={17} />;
  if (key === 'linkedin') return <Linkedin size={17} />;
  if (key === 'instagram') return <Instagram size={17} />;
  if (key === 'youtube') return <Youtube size={17} />;
  if (key === 'email') return <Mail size={17} />;
  return <Globe size={17} />;
};

export default function PublicPageView({ customDomainHost = null }) {
  const { slug: routeSlug } = useParams();
  const slug = routeSlug || null;
  const queryParams = new URLSearchParams(window.location.search);
  const previewPageId = queryParams.get('preview') === '1' ? queryParams.get('pageId') : null;
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const trackedPageView = useRef('');
  const [leadForms, setLeadForms] = useState({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMessage('');
    const request = previewPageId
      ? api.get('/pages/' + encodeURIComponent(previewPageId))
      : slug
        ? api.get('/pages/public/slug/' + encodeURIComponent(slug))
        : api.get('/pages/public/resolve', { params: { host: customDomainHost || window.location.hostname } });
    request.then(({ data }) => {
      if (!active) return;
      setPage(data.data);
    }).catch((error) => {
      if (!active) return;
      setPage(null);
      setErrorMessage(error.response?.data?.message || 'This page could not be found.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, customDomainHost, previewPageId]);

  useEffect(() => {
    if (previewPageId || !page?.slug || trackedPageView.current === page.slug) return;
    trackedPageView.current = page.slug;
    api.post('/pages/public/slug/' + encodeURIComponent(page.slug) + '/events', { eventType: 'page_view' }).catch(() => {});
  }, [page?.slug, previewPageId]);

  useEffect(() => {
    if (!page) return;
    document.title = page.seo_title || page.title || 'Axly page';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = page.seo_description || page.bio || '';
    const ensureMeta = (property, content) => {
      if (!content) return;
      let tag = document.querySelector('meta[property="' + property + '"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.content = content;
    };
    ensureMeta('og:title', page.seo_title || page.title);
    ensureMeta('og:description', page.seo_description || page.bio);
    ensureMeta('og:image', page.og_image_url || page.profile_image_url);
  }, [page]);

  const trackClick = (blockId) => {
    if (previewPageId || !page?.slug) return;
    api.post('/pages/public/slug/' + encodeURIComponent(page.slug) + '/events', {
      eventType: 'link_click', blockId,
    }).catch(() => {});
  };

  const copyCurrentPage = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success('Page link copied.');
      setTimeout(() => setCopied(false), 1800);
    } catch { toast.error('Could not copy the page URL.'); }
  };

  const sendLead = async (blockId, event) => {
    event.preventDefault();
    if (previewPageId) return toast('Lead capture is disabled in preview.');
    const form = leadForms[blockId] || {};
    try {
      const response = await api.post('/pages/public/slug/' + encodeURIComponent(page.slug) + '/leads', form);
      toast.success(response.data.message || 'Message sent.');
      setLeadForms(prev => ({ ...prev, [blockId]: { name: '', email: '', message: '', consent: false, sent: true } }));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not send your message.');
    }
  };

  if (loading) {
    return <main className="public-page-state"><div className="public-page-loader" /><p>Loading page…</p></main>;
  }
  if (!page) {
    return <main className="public-page-state"><div className="public-page-state-icon"><AlertCircle size={26} /></div><h1>Page unavailable</h1><p>{errorMessage || 'This page may be unpublished or the address may be incorrect.'}</p><a href="https://url.axly.in" className="public-page-powered">Create your own page with Axly Studio <ArrowUpRight size={14}/></a></main>;
  }

  const theme = page.theme || {};
  const dark = theme.mode === 'dark';
  const foreground = dark ? '#f8fafc' : '#0f172a';
  const muted = dark ? '#cbd5e1' : '#64748b';
  const accent = /^#[0-9a-f]{6}$/i.test(theme.accent || '') ? theme.accent : '#2563eb';
  const bg = /^#[0-9a-f]{6}$/i.test(theme.background || '') ? theme.background : (dark ? '#111827' : '#f8fafc');
  const radius = theme.buttonStyle === 'pill' ? '999px' : theme.buttonStyle === 'square' ? '8px' : '16px';
  const visibleBlocks = (Array.isArray(page.blocks) ? page.blocks : []).filter(block => block.visible !== false);

  return (
    <main className={'public-page-view ' + (dark ? 'public-page-dark' : 'public-page-light')}>
      <div className="public-page-orb public-page-orb-one" style={{ background: accent }} />
      <div className="public-page-orb public-page-orb-two" style={{ background: accent }} />
      <article className="public-page-shell" style={{ background: bg, color: foreground, fontFamily: theme.font === 'space-grotesk' ? '"Space Grotesk", sans-serif' : 'Inter, system-ui, sans-serif' }}>
        <div className={'public-page-content ' + (theme.layout === 'left' ? 'public-page-content-left' : '')}>
          <div className="public-page-toolbar">
            <span className="public-page-brand"><span className="public-page-brand-icon"><Link2 size={13}/></span> AXLY PAGE</span>
            <button type="button" className="public-page-copy" onClick={copyCurrentPage} aria-label="Copy page URL">{copied ? <Check size={15}/> : <Copy size={15}/>} <span>{copied ? 'Copied' : 'Share page'}</span></button>
          </div>

          <header className="public-page-profile">
            {page.profile_image_url ? <img className="public-page-avatar" src={page.profile_image_url} alt={page.title + ' profile'} loading="eager" /> : <div className="public-page-avatar public-page-avatar-fallback" style={{ background: accent }}>{(page.title || 'A').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}</div>}
            <h1>{page.title}</h1>
            {page.bio && <p className="public-page-bio" style={{ color: muted }}>{page.bio}</p>}
            {(page.page_type === 'business-card' || page.template_key === 'business-card') && (
              <button type="button" className="public-page-vcard" style={{ background: accent, borderRadius: radius }} onClick={() => downloadVCard(page)}><Download size={16}/> Save contact</button>
            )}
            {(page.contact_email || page.contact_phone) && <div className="public-page-contact-row">
              {page.contact_email && <a href={'mailto:' + page.contact_email} style={{ color: accent }}><Mail size={14}/> Email</a>}
              {page.contact_phone && <a href={'tel:' + page.contact_phone.replace(/[^0-9+]/g,'')} style={{ color: accent }}><Phone size={14}/> Call</a>}
            </div>}
          </header>

          <div className="public-page-blocks">
            {visibleBlocks.map((block) => {
              if (block.type === 'heading') return <h2 className="public-page-heading-block" key={block.id}>{block.text}</h2>;
              if (block.type === 'text') return <p className="public-page-text-block" key={block.id} style={{ color: muted }}>{block.text}</p>;
              if (block.type === 'divider') return <div className="public-page-divider" key={block.id} />;
              if (block.type === 'image') return <figure className="public-page-image-block" key={block.id}><img src={block.url} alt={block.alt || ''} loading="lazy"/>{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
              if (block.type === 'video') {
                const embed = getEmbedUrl(block.url);
                return embed ? <div className="public-page-video" key={block.id}><iframe src={embed} title={block.title || 'Embedded video'} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : null;
              }
              if (block.type === 'lead_form') {
                const form = leadForms[block.id] || { name: '', email: '', message: '', consent: false };
                return <section className="public-page-lead-card" key={block.id}><h2>{block.title || 'Get in touch'}</h2>{block.description && <p>{block.description}</p>}
                  {form.sent ? <div className="public-page-thanks">Thanks! Your message has been sent.</div> :
                    <form onSubmit={(event) => sendLead(block.id,event)} className="public-page-lead-form">
                      <input aria-label="Your name" placeholder="Your name" value={form.name || ''} onChange={e=>setLeadForms(prev=>({...prev,[block.id]:{...form,name:e.target.value}}))} required minLength={2} maxLength={120}/>
                      <input aria-label="Email address" type="email" placeholder="Email address" value={form.email || ''} onChange={e=>setLeadForms(prev=>({...prev,[block.id]:{...form,email:e.target.value}}))} required maxLength={320}/>
                      <textarea aria-label="Message" placeholder="Optional message" rows={3} value={form.message || ''} onChange={e=>setLeadForms(prev=>({...prev,[block.id]:{...form,message:e.target.value}}))} maxLength={2000}/>
                      <label><input type="checkbox" checked={Boolean(form.consent)} onChange={e=>setLeadForms(prev=>({...prev,[block.id]:{...form,consent:e.target.checked}}))} required/> I agree that the page owner may use these details to respond to my message.</label>
                      <button type="submit" style={{ background: accent, borderRadius: radius }}>{block.buttonLabel || 'Send message'} <ArrowUpRight size={15}/></button>
                    </form>}
                </section>;
              }
              if (['link','social','file'].includes(block.type) && block.url) {
                const featured = block.featured === true;
                return <a className={'public-page-link-block ' + (featured ? 'public-page-link-featured' : '')} key={block.id} href={block.url} target="_blank" rel="noopener noreferrer" style={{ borderRadius: radius, borderColor: featured ? accent : (dark ? '#334155' : '#e2e8f0'), background: featured ? accent : (dark ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.78)'), color: featured ? '#fff' : foreground }} onClick={() => trackClick(block.id)}>
                  <span className="public-page-link-icon">{block.type === 'social' ? socialIcon(block.platform) : block.type === 'file' ? <Download size={17}/> : <Link2 size={17}/>}</span>
                  <span className="public-page-link-copy"><strong>{block.label}</strong>{block.description && <small style={{ color: featured ? 'rgba(255,255,255,.82)' : muted }}>{block.description}</small>}</span>
                  <ArrowUpRight size={17} className="public-page-link-arrow"/>
                </a>;
              }
              return null;
            })}
          </div>

          <footer className="public-page-footer">
            <span>Made with <strong style={{ color: accent }}>Axly Studio</strong></span>
            <a href="https://url.axly.in" target="_blank" rel="noreferrer" style={{ color: muted }}>Create your own page <ExternalLink size={12}/></a>
          </footer>
        </div>
      </article>
    </main>
  );
}
