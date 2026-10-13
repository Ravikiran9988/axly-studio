import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, CircleHelp, ExternalLink,
  FileText, Globe, LifeBuoy, Mail, MessageCircle, Search, ShieldAlert,
  ShieldCheck, Trash2, Link2, QrCode, PanelsTopLeft, BarChart3, LockKeyhole,
  AlertTriangle, Send, Check, Scale, Menu,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import toast from 'react-hot-toast';

const LAST_UPDATED = 'October 13, 2026';

const PAGE_META = {
  help: {
    label: 'HELP CENTER',
    title: 'How can we help?',
    description: 'Straightforward answers and step-by-step guidance for using Axly Studio.',
    browserTitle: 'Help Center | Axly Studio',
  },
  contact: {
    label: 'CONTACT',
    title: 'Talk to our support team.',
    description: 'Tell us what you are trying to do or what went wrong. We will have the context needed to help you faster.',
    browserTitle: 'Contact Support | Axly Studio',
  },
  'report-abuse': {
    label: 'TRUST & SAFETY',
    title: 'Report a suspicious Axly link.',
    description: 'Use this form to report phishing, malware, scams, or other harmful activity involving an Axly short link.',
    browserTitle: 'Report Abuse | Axly Studio',
  },
  security: {
    label: 'TRUST & SAFETY',
    title: 'Security is part of the product.',
    description: 'Learn how to protect your account and how to contact us about a potential security issue.',
    browserTitle: 'Security Overview | Axly Studio',
  },
  terms: {
    label: 'LEGAL',
    title: 'Terms & Conditions',
    description: 'The rules that apply when you access or use Axly Studio.',
    browserTitle: 'Terms & Conditions | Axly Studio',
  },
  privacy: {
    label: 'LEGAL',
    title: 'Privacy Policy',
    description: 'What information Axly handles, why it is used, and the choices available to you.',
    browserTitle: 'Privacy Policy | Axly Studio',
  },
  'acceptable-use': {
    label: 'LEGAL & SAFETY',
    title: 'Acceptable Use Policy',
    description: 'Keep Axly useful and safe. These rules apply to short links, QR codes, public pages, and related features.',
    browserTitle: 'Acceptable Use Policy | Axly Studio',
  },
};

const HELP_GUIDES = [
  {
    title: 'Shorten a link',
    description: 'Paste a destination URL, select Shorten, then copy the resulting short link.',
    detail: 'Guest shortening is available without signing in. Sign in for account features such as custom aliases, expiry controls, saved link management, and analytics where supported.',
    icon: Link2,
    href: '/#shorten',
    action: 'Shorten a link',
    keywords: 'url shorten paste copy destination short link guest',
  },
  {
    title: 'Generate a QR code',
    description: 'Paste a website address into the QR Code Generator and create a scannable code.',
    detail: 'The public QR generator works in your browser without an account. You can preview the result and download PNG or SVG. Always test a QR code on a phone before printing it.',
    icon: QrCode,
    href: '/#qr-codes',
    action: 'Open QR Generator',
    keywords: 'qr code generator png svg scan no sign in download',
  },
  {
    title: 'Choose a custom alias',
    description: 'Make a short link easier to recognize with a memorable ending.',
    detail: 'Custom aliases require an Axly account. Use 3–30 letters, numbers, hyphens, or underscores. Some aliases are reserved, and each alias must be unique.',
    icon: Link2,
    href: '/app/links',
    action: 'Manage links',
    keywords: 'custom alias vanity slug ending reserved unique account',
  },
  {
    title: 'Create a public profile page',
    description: 'Build a shareable page for your portfolio, creator profile, business, or contact details.',
    detail: 'Choose a template, add the content you want to publish, preview it, and publish when ready. A published page is public to anyone who can reach its URL.',
    icon: PanelsTopLeft,
    href: '/app/pages',
    action: 'Open My Pages',
    keywords: 'profile page link in bio portfolio template public business creator publish',
  },
  {
    title: 'Connect a custom domain',
    description: 'Use a domain you own for an eligible public page or short-link setup.',
    detail: 'Follow the DNS values shown by Axly. Ownership verification, correct CNAME routing, hosting configuration, and HTTPS activation may be separate steps. A DNS check alone does not guarantee that HTTPS is ready.',
    icon: Globe,
    href: '/app/domains',
    action: 'Manage domains',
    keywords: 'custom domain dns cname verify ssl https hosting',
  },
  {
    title: 'Understand analytics',
    description: 'Review available click or page activity to understand how shared content performs.',
    detail: 'Metrics and available breakdowns depend on the feature and its implementation. Counts can differ from third-party analytics because of time windows, privacy protections, blockers, and measurement methods.',
    icon: BarChart3,
    href: '/app/analytics',
    action: 'View analytics',
    keywords: 'analytics clicks visitors referrer devices metrics stats',
  },
  {
    title: 'Export or delete account data',
    description: 'Find data controls under Settings & Privacy in your signed-in workspace.',
    detail: 'Settings provides an account data archive export and an account deletion flow. If you own a shared team workspace, you may need to transfer ownership before deleting your account.',
    icon: Trash2,
    href: '/app/settings',
    action: 'Open Settings',
    keywords: 'privacy export download delete account personal data archive retention',
  },
  {
    title: 'Get help with a problem',
    description: 'Send our support team the affected URL and a brief description of what happened.',
    detail: 'Never email your password, access token, API key, or other secret. Include your browser/device, the page you were using, the exact error, and a screenshot if it helps explain the issue.',
    icon: LifeBuoy,
    href: '/contact',
    action: 'Contact support',
    keywords: 'support help email issue error contact ticket broken',
  },
];

const FAQS = [
  {
    question: 'Can I shorten a URL without creating an account?',
    answer: 'Yes. The public short-link form is available to guests. Account sign-in is needed for certain management features, such as custom aliases and saved account controls.',
    keywords: 'guest free account sign up',
  },
  {
    question: 'Can I generate a QR code without signing in?',
    answer: 'Yes. Use QR Codes in the landing-page navigation, enter an HTTP or HTTPS URL, and generate the code in your browser. Download options include PNG and SVG.',
    keywords: 'qr code guest png svg',
  },
  {
    question: 'Why is my custom alias unavailable?',
    answer: 'An alias may already be in use or reserved by the system. Try a different 3–30 character alias using letters, numbers, hyphens, or underscores.',
    keywords: 'alias taken reserved name slug',
  },
  {
    question: 'Does a public profile page stay private until I share it?',
    answer: 'Drafts are not the same as published pages. Once you publish a page, its contents are intended to be public and may be accessible to anyone with the URL. Do not publish information you want to keep private.',
    keywords: 'profile public draft publish privacy',
  },
  {
    question: 'Why is my custom domain not working yet?',
    answer: 'Check that the DNS record matches the exact target Axly displays, then wait for DNS propagation and complete any hosting or HTTPS steps shown in the dashboard. DNS verification and SSL readiness are separate states.',
    keywords: 'domain dns cname ssl https verification',
  },
  {
    question: 'How can I export or delete my account data?',
    answer: 'Sign in, open Settings & Privacy, and use the data export or delete-account controls. Account deletion is permanent and may require team-workspace ownership to be transferred first.',
    keywords: 'export delete account settings data',
  },
  {
    question: 'How do I report a phishing link or harmful destination?',
    answer: 'Open Report Abuse in the footer and submit the Axly short code with the reason and relevant details. You can also contact support@axly.in if you need to provide context.',
    keywords: 'phishing malware scam report harmful abuse',
  },
];

const LEGAL_DOCUMENTS = {
  terms: {
    intro: 'These Terms & Conditions (“Terms”) govern access to and use of Axly Studio, including its public website, short links, QR code generator, public pages, analytics, and related tools (“Service”). By using the Service, you agree to these Terms. If you do not agree, do not use the Service.',
    sections: [
      {
        title: '1. Who may use the Service',
        paragraphs: [
          'You must be legally able to enter into a binding agreement where you live. If you use Axly on behalf of a business or another organization, you confirm that you are authorized to accept these Terms for that organization.',
          'You are responsible for keeping your account credentials secure and for activity performed through your account. Notify us promptly if you believe your account has been accessed without permission.',
        ],
      },
      {
        title: '2. The Service and account features',
        paragraphs: [
          'Axly provides tools for creating and managing short links, generating QR codes, publishing public pages, managing supported custom domains, and viewing available analytics. Features may differ between guest access and signed-in accounts.',
          'We may add, change, limit, or discontinue features to maintain or improve the Service. We will make reasonable efforts to avoid unnecessary disruption, but we do not promise that every feature will remain available indefinitely or without interruption.',
        ],
      },
      {
        title: '3. Your links and content',
        paragraphs: [
          'You remain responsible for the URLs, destinations, page text, images, embedded media, contact details, lead-form content, and other material you submit or publish. You must have the rights and permissions needed to use that material and to collect or share any personal information through it.',
          'Published links and pages are designed to be shared. Anyone who can access a public URL may be able to view or interact with its content. Do not put confidential or sensitive information on a public page.',
        ],
      },
      {
        title: '4. Prohibited activity',
        paragraphs: [
          'You must use Axly lawfully and in accordance with the Acceptable Use Policy. You may not use the Service to distribute malware, conduct phishing, impersonate others, run scams, infringe intellectual property, threaten or harass people, violate privacy, or facilitate illegal activity.',
          'You may not attempt to interfere with the Service, bypass access controls, abuse APIs, reverse engineer or overload infrastructure in a way that harms other users, or evade a suspension or safety control.',
        ],
        link: { label: 'Read the Acceptable Use Policy', to: '/acceptable-use' },
      },
      {
        title: '5. Third-party sites and destinations',
        paragraphs: [
          'Short links may redirect visitors to third-party websites or services. QR codes may encode URLs that lead to third-party destinations. Axly does not own or control those destinations and is not responsible for their content, availability, security, or privacy practices.',
          'Check a destination before sharing or scanning it. A short link or QR code does not mean that Axly endorses the destination.',
        ],
      },
      {
        title: '6. Custom domains and DNS',
        paragraphs: [
          'You are responsible for owning or being authorized to configure any domain you connect. You must provide accurate DNS records and complete the verification and hosting steps shown in the Service. DNS changes can take time to propagate, and domain verification does not by itself guarantee that HTTPS is active.',
          'Do not connect domains in a way that impersonates another person or organization or violates another party’s rights.',
        ],
      },
      {
        title: '7. Analytics, privacy, and data',
        paragraphs: [
          'The Service processes information needed to operate links, pages, accounts, security protections, and available analytics. Our Privacy Policy explains these practices and the controls available to you.',
          'You are responsible for providing appropriate notices and obtaining any consent required by law when you use Axly pages, links, lead forms, or analytics to collect information from others.',
        ],
        link: { label: 'Read the Privacy Policy', to: '/privacy' },
      },
      {
        title: '8. Intellectual property and feedback',
        paragraphs: [
          'Axly and its licensors retain rights in the Service, software, branding, and associated materials. These Terms do not transfer ownership of Axly intellectual property to you.',
          'You retain rights to content you provide, subject to the permissions necessary for Axly to host, process, display, and distribute that content to operate the features you choose to use. If you send feedback, you allow us to use it to improve the Service without an obligation to you.',
        ],
      },
      {
        title: '9. Suspension and termination',
        paragraphs: [
          'We may restrict, suspend, remove content, or terminate access when reasonably necessary to address suspected abuse, legal obligations, security risks, repeated violations, or material harm to the Service or its users.',
          'You can stop using the Service at any time. Signed-in users can use the available account deletion controls. Some records may be retained for legitimate security, legal, dispute-resolution, or backup purposes for a limited period.',
        ],
      },
      {
        title: '10. Disclaimers and liability',
        paragraphs: [
          'To the extent permitted by applicable law, the Service is provided on an “as available” basis without a guarantee that it will be uninterrupted, error-free, or suitable for every purpose. We do not guarantee that every click, visitor, or analytics event will be captured exactly as measured by another system.',
          'Nothing in these Terms excludes or limits a right or liability that cannot lawfully be excluded or limited. Subject to that restriction and applicable law, Axly is not responsible for indirect or consequential losses arising from third-party destinations, interruptions, or use of the Service.',
        ],
      },
      {
        title: '11. Changes to these Terms',
        paragraphs: [
          'We may update these Terms as the Service changes or to reflect legal and operational requirements. We will update the date at the top of this page when we publish a revision. Continued use after an update takes effect means you accept the updated Terms, to the extent permitted by law.',
        ],
      },
      {
        title: '12. Contact',
        paragraphs: [
          'Questions about these Terms can be sent to support@axly.in. Please include “Terms” in the email subject.',
        ],
      },
    ],
  },
  privacy: {
    intro: 'This Privacy Policy explains how Axly Studio (“Axly”, “we”, “us”) handles information when you visit our website or use our Service. The information processed depends on which features you use and whether you are a guest or signed-in account holder.',
    sections: [
      {
        title: '1. Information you provide',
        paragraphs: [
          'Account information may include your name, email address, authentication data, and account preferences. We store password hashes rather than readable passwords.',
          'Content you create may include original destination URLs, short-link aliases, titles, tags, notes, expiration settings, campaigns, experiments, domains, webhooks, public-page content, SEO fields, page revisions, and contact information that you choose to add.',
          'If someone submits a lead form on a public page, information collected may include the fields displayed by that form, such as name, email address, message, and consent selection. Page owners are responsible for how they use information they receive from their forms.',
        ],
      },
      {
        title: '2. Usage and technical information',
        paragraphs: [
          'To run redirects and the Service, we may process event timestamps, link and page identifiers, click counts, referrer host, device category, security logs, and other request information needed for reliability, troubleshooting, fraud prevention, and analytics.',
          'Some analytics use pseudonymous visitor hashes to estimate unique activity without presenting raw IP addresses as the visitor identifier. Hashes and event records may still be considered personal data under some laws, depending on context.',
        ],
      },
      {
        title: '3. QR code generation',
        paragraphs: [
          'The public landing-page QR generator creates the QR image in your browser. The URL you enter into that QR generator is used locally by that feature to render the QR image; that generation flow does not send the entered URL to Axly’s API. This does not change how your browser or the destination website handles normal network requests when you visit a URL.',
          'If you separately create a short link or use an account feature, that feature processes the information needed to provide it.',
        ],
      },
      {
        title: '4. How we use information',
        bullets: [
          'Provide and maintain short links, QR codes, public pages, domains, account access, and available analytics.',
          'Secure accounts and infrastructure, detect abuse, investigate reports, rate-limit suspicious activity, and enforce our Terms and Acceptable Use Policy.',
          'Respond to support requests, troubleshoot issues, and communicate essential service or account information.',
          'Meet applicable legal obligations and protect the rights, safety, and property of Axly, our users, and others.',
        ],
      },
      {
        title: '5. Public information and sharing',
        paragraphs: [
          'Short links redirect to the destination selected by their creator. Published public pages are intended to be accessible to visitors who reach their URL. Information shown publicly on a page may be copied, indexed, or shared by others.',
          'We use infrastructure and service providers to host the website, API, database, and supporting functions. Those providers process information as needed to deliver their services. We may disclose information when required by law or when reasonably necessary to investigate abuse, protect people, or secure the Service.',
          'We do not sell personal information as a business model. We do not make a promise that data can never be accessed, copied, or disclosed; no internet service can provide that absolute guarantee.',
        ],
      },
      {
        title: '6. Browser storage',
        paragraphs: [
          'The application uses browser storage for essential sign-in state and selected preferences. Blocking or clearing browser storage may sign you out or reset preferences. This policy does not claim that Axly uses no cookies in every hosting, security, or browser context.',
        ],
      },
      {
        title: '7. Retention',
        paragraphs: [
          'We retain account information and saved content while needed to operate the account and features you use. Clickstream records and link metadata may be retained during the active lifetime of an account as described in the application’s Settings & Privacy area.',
          'When an account is deleted, associated personal resources are deleted through the account-deletion flow, subject to records needed for security, legal obligations, dispute handling, and limited backup cycles. Backup copies may remain until they are rotated out.',
        ],
      },
      {
        title: '8. Your choices and controls',
        paragraphs: [
          'Signed-in users can download a personal data archive and request account deletion in Settings & Privacy. Deletion is permanent. Owners of shared workspaces may need to transfer ownership before deletion can complete.',
          'You can contact support@axly.in with privacy questions or requests. We may need to verify your identity and clarify the request before acting. Rights and deadlines depend on the laws that apply to your situation.',
        ],
      },
      {
        title: '9. Security',
        paragraphs: [
          'We use measures intended to protect information, including password hashing, access controls, input validation, and infrastructure protections. Security safeguards reduce risk but cannot guarantee that a system or transmission is completely secure.',
          'Please do not send passwords, access tokens, API keys, or other secrets through ordinary email. If you believe an account or link has been compromised, contact us promptly.',
        ],
        link: { label: 'Read the Security Overview', to: '/security' },
      },
      {
        title: '10. Children and third-party services',
        paragraphs: [
          'Axly is not intended for use by anyone who cannot legally agree to the Service’s terms. Do not submit another person’s personal information unless you have a lawful basis to do so.',
          'Third-party sites reached through short links or QR codes operate under their own privacy notices and practices. Review those notices before sharing information with them.',
        ],
      },
      {
        title: '11. Policy updates and contact',
        paragraphs: [
          'We may update this Policy as the Service changes. Revisions will be published on this page with an updated date. For privacy questions, contact support@axly.in with “Privacy” in the subject.',
        ],
      },
    ],
  },
  'acceptable-use': {
    intro: 'The Acceptable Use Policy applies to all Axly Studio features, including short links, QR codes, public pages, custom domains, lead forms, campaigns, and integrations. Use Axly responsibly and only for lawful purposes.',
    sections: [
      {
        title: 'Allowed use',
        bullets: [
          'Create and share legitimate links to websites and content you are authorized to distribute.',
          'Publish public pages and business or creator information you have permission to share.',
          'Generate QR codes for lawful destinations and provide accurate descriptions of where they lead.',
          'Use analytics and lead forms with appropriate notices, permissions, and consent where required.',
        ],
      },
      {
        title: 'Prohibited content and behavior',
        bullets: [
          'Phishing, credential theft, malware, harmful downloads, fake login pages, or attempts to compromise a system.',
          'Fraud, scams, deceptive impersonation, unlawful financial schemes, or misleading destinations designed to harm visitors.',
          'Harassment, threats, non-consensual intimate content, hateful abuse, or targeted intimidation.',
          'Copyright, trademark, privacy, publicity, or other rights violations, including content you are not authorized to publish.',
          'Unlawful collection, sale, or misuse of personal information, or lead capture that hides its purpose or lacks required disclosures.',
          'Spam, abusive bulk activity, malicious automation, attempts to evade limits, or activity that degrades the Service for others.',
          'Attempts to bypass access controls, interfere with security, probe systems without authorization, or misuse APIs and webhooks.',
        ],
      },
      {
        title: 'Enforcement',
        paragraphs: [
          'Axly may investigate credible reports and may disable a link, restrict a page or domain, suspend an account, preserve relevant records, or take other proportionate action where reasonably necessary to protect people, comply with law, or maintain the Service.',
          'Reports may be prioritized based on the type and severity of the alleged harm. We may request additional information and may not be able to share details of an investigation or another user’s account.',
        ],
      },
      {
        title: 'How to report a violation',
        paragraphs: [
          'Use the Report Abuse page to submit an Axly short code and describe the concern. Include only information relevant to the report. For copyright or other formal notices, identify the material and explain the rights or policy issue clearly.',
          'You can also email support@axly.in with “Abuse Report” in the subject. Do not include passwords, payment credentials, or unrelated sensitive information.',
        ],
        link: { label: 'Report an Axly link', to: '/report-abuse' },
      },
      {
        title: 'Changes to this policy',
        paragraphs: [
          'We may update this policy to address changes in the Service, emerging abuse patterns, or legal requirements. The updated date at the top of this page identifies the most recent published revision.',
        ],
      },
    ],
  },
};

function InfoHeader() {
  return (
    <header className="info-header">
      <Link to="/" className="info-brand" aria-label="Axly Studio home">
        <span className="info-brand-icon"><BrandMark size={23} /></span>
        <span>Axly Studio</span>
      </Link>
      <nav className="info-header-actions" aria-label="Information page navigation">
        <Link to="/help">Help Center</Link>
        <Link to="/contact">Contact</Link>
        <Link to="/" className="info-back-link"><ArrowLeft size={14} /> Back to Axly</Link>
      </nav>
    </header>
  );
}

function InfoFooter() {
  return (
    <footer className="info-footer">
      <div className="info-footer-inner">
        <span>© {new Date().getFullYear()} Axly Studio</span>
        <nav aria-label="Legal and support links">
          <Link to="/help">Help</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
        <a href="mailto:support@axly.in">support@axly.in</a>
      </div>
    </footer>
  );
}

function HelpContent({ search, setSearch }) {
  const query = search.trim().toLowerCase();
  const visibleGuides = HELP_GUIDES.filter((guide) =>
    !query || [guide.title, guide.description, guide.detail, guide.keywords].join(' ').toLowerCase().includes(query)
  );
  const visibleFaqs = FAQS.filter((faq) =>
    !query || [faq.question, faq.answer, faq.keywords].join(' ').toLowerCase().includes(query)
  );

  return (
    <>
      <div className="info-search-wrap">
        <Search size={18} />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search help topics, e.g. custom alias or QR code"
          aria-label="Search help topics"
        />
        {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear help search">Clear</button>}
      </div>

      <section className="info-section">
        <div className="info-section-heading">
          <div>
            <p className="info-section-eyebrow">QUICK GUIDES</p>
            <h2>Start with the task you need.</h2>
          </div>
          <span className="info-result-count">{visibleGuides.length} guides</span>
        </div>
        {visibleGuides.length ? (
          <div className="info-guide-grid">
            {visibleGuides.map((guide) => {
              const Icon = guide.icon;
              return (
                <article className="info-guide-card" key={guide.title}>
                  <div className="info-guide-icon"><Icon size={21} /></div>
                  <h3>{guide.title}</h3>
                  <p>{guide.description}</p>
                  <p className="info-guide-detail">{guide.detail}</p>
                  <Link to={guide.href} className="info-text-link">{guide.action} <ArrowRight size={14} /></Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="info-empty">
            <CircleHelp size={25} />
            <strong>No matching guides</strong>
            <p>Try a shorter search, or email <a href="mailto:support@axly.in">support@axly.in</a>.</p>
          </div>
        )}
      </section>

      <section className="info-section info-faq-section">
        <div className="info-section-heading">
          <div>
            <p className="info-section-eyebrow">COMMON QUESTIONS</p>
            <h2>Answers at a glance.</h2>
          </div>
          <span className="info-result-count">{visibleFaqs.length} answers</span>
        </div>
        {visibleFaqs.length ? visibleFaqs.map((faq) => (
          <details className="info-faq-item" key={faq.question}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        )) : <p className="info-muted">No matching questions.</p>}
      </section>

      <section className="info-support-banner">
        <div className="info-support-banner-icon"><Mail size={22} /></div>
        <div>
          <h2>Still need a hand?</h2>
          <p>Send a message to our support team. Include the page or link you were using and the exact problem—never include passwords or API keys.</p>
        </div>
        <Link to="/contact" className="btn btn-primary">Contact support <ArrowRight size={15} /></Link>
      </section>
    </>
  );
}

function ContactContent() {
  return (
    <div className="info-contact-grid">
      <article className="info-contact-card info-contact-primary">
        <div className="info-guide-icon"><Mail size={23} /></div>
        <p className="info-section-eyebrow">GENERAL SUPPORT</p>
        <h2>Email the Axly team</h2>
        <p>For product questions, login trouble, broken links, billing or account questions, and feedback, email our support address.</p>
        <a className="info-email-address" href="mailto:support@axly.in">support@axly.in</a>
        <a className="btn btn-primary" href="mailto:support@axly.in?subject=Axly%20Studio%20Support">Email support <ArrowRight size={15} /></a>
      </article>
      <article className="info-contact-card">
        <div className="info-guide-icon"><ShieldAlert size={23} /></div>
        <p className="info-section-eyebrow">TRUST & SAFETY</p>
        <h2>Report a suspicious link</h2>
        <p>If an Axly short link appears to lead to phishing, malware, impersonation, or a scam, submit the short code and the relevant details.</p>
        <Link className="info-text-link" to="/report-abuse">Open Report Abuse <ArrowRight size={14} /></Link>
      </article>
      <article className="info-contact-card">
        <div className="info-guide-icon"><ShieldCheck size={23} /></div>
        <p className="info-section-eyebrow">SECURITY</p>
        <h2>Report a security concern</h2>
        <p>Describe the affected feature, the steps to reproduce the issue, and its potential impact. Do not include secrets or exploit other users’ data.</p>
        <a className="info-text-link" href="mailto:support@axly.in?subject=Axly%20Security%20Concern">Email security concern <ArrowRight size={14} /></a>
      </article>
      <div className="info-contact-note">
        <AlertTriangle size={18} />
        <p>For your safety, never send passwords, one-time codes, API keys, access tokens, or full payment details by email. Please include enough detail to identify the issue without sharing secrets.</p>
      </div>
    </div>
  );
}

function ReportAbuseContent() {
  const [reportedLink, setReportedLink] = useState('');
  const [reason, setReason] = useState('phishing');
  const [details, setDetails] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const raw = reportedLink.trim();
    let code = raw;

    if (/^https?:\/\//i.test(raw) || raw.includes('/')) {
      try {
        const candidate = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
        const host = candidate.hostname.toLowerCase();
        if (!(host === 'axly.in' || host.endsWith('.axly.in'))) {
          toast.error('Use an Axly short URL or enter just its short code. For a custom domain, email support@axly.in.');
          return;
        }
        code = candidate.pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop() || '';
      } catch {
        toast.error('Enter an Axly short URL or a valid short code.');
        return;
      }
    }

    if (!/^[A-Za-z0-9_-]{3,30}$/.test(code || '')) {
      toast.error('Enter an Axly short code or a short URL such as s.axly.in/abc123.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/reports', {
        shortCode: code,
        reason,
        details: details.trim() || undefined,
        reporterEmail: reporterEmail.trim() || undefined,
      });
      setSubmitted(true);
      toast.success('Abuse report submitted.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not submit the report. Please try again or email support@axly.in.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="info-report-success">
        <div className="info-success-icon"><CheckCircle2 size={30} /></div>
        <h2>Report submitted</h2>
        <p>Thank you for helping keep Axly safe. Your report has been recorded for review. If you need to add context, email <a href="mailto:support@axly.in">support@axly.in</a> and include the short link.</p>
        <Link to="/" className="btn btn-primary">Back to Axly</Link>
      </section>
    );
  }

  return (
    <div className="info-report-layout">
      <div className="info-report-explainer">
        <div className="info-guide-icon"><ShieldAlert size={23} /></div>
        <h2>What should be reported?</h2>
        <p>Report an Axly short link that appears to contain or lead to phishing, malware, fraud, deceptive impersonation, harassment, copyright abuse, or another serious policy violation.</p>
        <p>Reports are subject to rate limits and may be reviewed based on the available details. Do not use this form for general product support; use the <Link to="/contact">Contact Support</Link> page instead.</p>
        <p className="info-muted">If the link is not an Axly short link, contact the website or provider that hosts it.</p>
      </div>
      <form className="info-report-form" onSubmit={handleSubmit}>
        <div className="info-form-group">
          <label htmlFor="reported-link">Axly short URL or short code *</label>
          <input id="reported-link" value={reportedLink} onChange={(event) => setReportedLink(event.target.value)} placeholder="s.axly.in/abc123 or abc123" required />
          <p>Use the short code at the end of the Axly link. Do not paste an unrelated destination URL.</p>
        </div>
        <div className="info-form-group">
          <label htmlFor="report-reason">Reason for report *</label>
          <select id="report-reason" value={reason} onChange={(event) => setReason(event.target.value)} required>
            <option value="phishing">Phishing or credential theft</option>
            <option value="malware">Malware or dangerous download</option>
            <option value="spam">Spam or deceptive scam</option>
            <option value="copyright">Copyright or trademark infringement</option>
            <option value="harassment">Harassment, hate speech, or threat</option>
            <option value="other">Other policy violation</option>
          </select>
        </div>
        <div className="info-form-group">
          <label htmlFor="report-details">What happened? (optional)</label>
          <textarea id="report-details" value={details} onChange={(event) => setDetails(event.target.value)} rows={5} maxLength={1000} placeholder="Describe why you believe this short link is harmful. Include relevant context, not passwords or personal secrets." />
          <span className="info-character-count">{details.length}/1000</span>
        </div>
        <div className="info-form-group">
          <label htmlFor="report-email">Your email (optional)</label>
          <input id="report-email" type="email" value={reporterEmail} onChange={(event) => setReporterEmail(event.target.value)} maxLength={255} placeholder="you@example.com" />
          <p>Provide an email only if you would like us to be able to ask for more information.</p>
        </div>
        <button type="submit" className="btn btn-primary info-submit-btn" disabled={submitting}>
          {submitting ? 'Submitting report…' : 'Submit abuse report'} <Send size={15} />
        </button>
        <p className="info-form-privacy">Submitting sends the short code, report reason, details, and optional email to Axly for safety review.</p>
      </form>
    </div>
  );
}

function SecurityContent() {
  return (
    <div className="info-security-grid">
      <article className="info-security-card">
        <div className="info-guide-icon"><LockKeyhole size={22} /></div>
        <h2>Account protection</h2>
        <p>Account passwords are stored as hashes rather than plaintext. Keep your password private and use a unique password for Axly.</p>
      </article>
      <article className="info-security-card">
        <div className="info-guide-icon"><ShieldCheck size={22} /></div>
        <h2>Access and input controls</h2>
        <p>The application uses authentication and authorization for protected workspace features and validates supported inputs before processing them.</p>
      </article>
      <article className="info-security-card">
        <div className="info-guide-icon"><AlertTriangle size={22} /></div>
        <h2>Found a vulnerability?</h2>
        <p>Email support@axly.in with the subject “Security Concern”. Include an impact summary and safe reproduction steps. Do not access another user’s data, disrupt the Service, or publicly disclose an unresolved issue before contacting us.</p>
        <a className="info-text-link" href="mailto:support@axly.in?subject=Axly%20Security%20Concern">Email security concern <ArrowRight size={14} /></a>
      </article>
      <div className="info-contact-note">
        <ShieldCheck size={18} />
        <p>We do not claim a security certification through this page. Security controls and infrastructure can evolve; no online service can guarantee absolute security.</p>
      </div>
    </div>
  );
}

function LegalContent({ doc }) {
  return (
    <article className="info-legal-document">
      <div className="info-legal-notice">
        <FileText size={17} />
        <span>Last updated {LAST_UPDATED}</span>
      </div>
      <p className="info-legal-intro">{doc.intro}</p>
      <nav className="info-contents" aria-label="On this page">
        <span>On this page</span>
        {doc.sections.map((section, index) => (
          <a key={section.title} href={'#legal-section-' + index}>{section.title}</a>
        ))}
      </nav>
      {doc.sections.map((section, index) => (
        <section className="info-legal-section" id={'legal-section-' + index} key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.bullets && (
            <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
          )}
          {section.link && <Link className="info-text-link" to={section.link.to}>{section.link.label} <ArrowRight size={14} /></Link>}
        </section>
      ))}
      <div className="info-legal-contact">
        <Mail size={18} />
        <p>Questions about this document? Email <a href="mailto:support@axly.in">support@axly.in</a>.</p>
      </div>
    </article>
  );
}

export default function InfoPage({ page = 'help' }) {
  const config = PAGE_META[page] || PAGE_META.help;
  const [search, setSearch] = useState('');

  useEffect(() => {
    const previousTitle = document.title;
    const descriptionNode = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionNode?.getAttribute('content');
    document.title = config.browserTitle;
    descriptionNode?.setAttribute('content', config.description);

    return () => {
      document.title = previousTitle;
      if (previousDescription !== null && previousDescription !== undefined) {
        descriptionNode?.setAttribute('content', previousDescription);
      }
    };
  }, [config.browserTitle, config.description]);

  const legalDocument = LEGAL_DOCUMENTS[page];

  return (
    <div className="info-page">
      <InfoHeader />
      <main>
        <section className={'info-page-hero info-page-hero-' + page}>
          <div className="info-page-hero-inner">
            <span className="info-hero-label"><span className="info-hero-dot" />{config.label}</span>
            <h1>{config.title}</h1>
            <p>{config.description}</p>
            {legalDocument && <span className="info-updated-date">Last updated {LAST_UPDATED}</span>}
          </div>
        </section>

        <div className="info-page-content">
          {page === 'help' && <HelpContent search={search} setSearch={setSearch} />}
          {page === 'contact' && <ContactContent />}
          {page === 'report-abuse' && <ReportAbuseContent />}
          {page === 'security' && <SecurityContent />}
          {legalDocument && <LegalContent doc={legalDocument} />}
        </div>
      </main>
      <InfoFooter />
    </div>
  );
}
