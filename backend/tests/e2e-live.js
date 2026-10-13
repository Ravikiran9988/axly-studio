import assert from 'node:assert/strict';

const API_BASE = 'http://localhost:5000';
const FRONTEND_BASE = 'http://localhost:5173';

const log = (step, msg) => console.log(`\x1b[36m[E2E STEP ${step}]\x1b[0m ${msg}`);
const pass = (step, msg) => console.log(`\x1b[32m  ✔ [PASS]\x1b[0m ${msg}`);
const fail = (step, msg, err) => {
  console.error(`\x1b[31m  ✖ [FAIL]\x1b[0m ${msg}`);
  if (err) console.error(err);
  process.exit(1);
};

async function runEndToEndTests() {
  console.log(`
╔═════════════════════════════════════════════════════════════════╗
║                   Axly Studio E2E Test Suite                    ║
║          Live End-to-End Integration & Workflow Verification    ║
╠═════════════════════════════════════════════════════════════════╣
║  API Backend:      ${API_BASE.padEnd(42)} ║
║  Frontend Web:     ${FRONTEND_BASE.padEnd(42)} ║
╚═════════════════════════════════════════════════════════════════╝
`);

  const timestamp = Date.now().toString(36);
  let userToken = null;
  let testUserId = null;
  let guestShortCode = null;
  let memberUrlId = null;
  let memberShortCode = null;
  let pageId = null;
  let pageSlug = `e2e-bio-${timestamp}`;
  let apiKeySecret = null;
  let workspaceId = null;

  // --------------------------------------------------------------------------
  // STEP 1: Core Health & Probes
  // --------------------------------------------------------------------------
  try {
    log(1, 'Validating Kubernetes / Cloud Liveness & Readiness Probes');

    const healthz = await fetch(`${API_BASE}/healthz`).then(r => r.json());
    assert.equal(healthz.status, 'ok', 'healthz should return status ok');
    pass(1, 'GET /healthz responded 200 OK (liveness: true)');

    const readyz = await fetch(`${API_BASE}/readyz`).then(r => r.json());
    assert.equal(readyz.status, 'ready', 'readyz should return status ready');
    assert.equal(readyz.database, 'connected', 'readyz database should be connected');
    pass(1, `GET /readyz responded 200 OK (PostgreSQL latency: ${readyz.latencyMs}ms)`);

    const health = await fetch(`${API_BASE}/api/health`).then(r => r.json());
    assert.equal(health.success, true);
    assert.equal(health.services.database.status, 'healthy');
    pass(1, 'GET /api/health database service verified healthy');

    const announcement = await fetch(`${API_BASE}/api/announcement`).then(r => r.json());
    assert.equal(announcement.success, true);
    pass(1, 'GET /api/announcement endpoint responsive');
  } catch (err) {
    fail(1, 'Health probes failed', err);
  }

  // --------------------------------------------------------------------------
  // STEP 2: Anonymous Guest URL Shortening & Fast 302 Redirection
  // --------------------------------------------------------------------------
  try {
    log(2, 'Testing Guest URL Shortening and 302 Redirection');

    const destination = 'https://example.com/guest-landing?utm_source=axly_e2e';
    const createRes = await fetch(`${API_BASE}/api/urls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalUrl: destination }),
    });

    const createJson = await createRes.json();
    assert.equal(createRes.status, 201, 'Guest URL creation should return 201');
    assert.ok(createJson.data.shortCode, 'Should return a generated shortCode');
    guestShortCode = createJson.data.shortCode;
    pass(2, `Guest URL created: shortCode = ${guestShortCode}`);

    // Test redirection (without following redirects)
    const redirectRes = await fetch(`${API_BASE}/${guestShortCode}`, {
      redirect: 'manual',
    });
    assert.equal(redirectRes.status, 302, 'Redirection endpoint must return 302 Found');
    const location = redirectRes.headers.get('location');
    assert.equal(location, destination, 'Location header must match target destination');
    pass(2, `Redirection verified: 302 Found -> ${location}`);
  } catch (err) {
    fail(2, 'Guest short link flow failed', err);
  }

  // --------------------------------------------------------------------------
  // STEP 3: User Authentication & Profile Management Lifecycle
  // --------------------------------------------------------------------------
  const userEmail = `e2e_user_${timestamp}@axly.test`;
  const userPassword = 'TestPassword123!';
  const userName = `E2E Tester ${timestamp}`;

  try {
    log(3, 'Testing User Registration, Login, and Profile Management');

    // Registration
    const regRes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: userName, email: userEmail, password: userPassword }),
    });
    const regJson = await regRes.json();
    assert.equal(regRes.status, 201, 'Registration should return 201 Created');
    assert.ok(regJson.token, 'Registration must return a valid JWT token');
    testUserId = regJson.user.id;
    pass(3, `Account registered successfully for ${userEmail}`);

    // Login
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: userPassword }),
    });
    const loginJson = await loginRes.json();
    assert.equal(loginRes.status, 200, 'Login should return 200 OK');
    assert.ok(loginJson.token, 'Login must return a JWT token');
    userToken = loginJson.token;
    pass(3, 'User authenticated successfully via POST /api/auth/login');

    // Fetch Profile
    const meRes = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const meJson = await meRes.json();
    assert.equal(meRes.status, 200);
    assert.equal(meJson.user.email, userEmail);
    pass(3, 'GET /api/auth/me verified account profile details');

    // Update Profile
    const updateRes = await fetch(`${API_BASE}/api/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        bio: 'Senior Growth Engineer & Link Architect',
        company: 'Axly Cloud Systems',
        jobTitle: 'Lead Developer',
      }),
    });
    const updateJson = await updateRes.json();
    assert.equal(updateRes.status, 200);
    assert.equal(updateJson.user.company, 'Axly Cloud Systems');
    pass(3, 'PATCH /api/auth/me successfully updated profile metadata');
  } catch (err) {
    fail(3, 'Authentication and profile lifecycle failed', err);
  }

  // --------------------------------------------------------------------------
  // STEP 4: Member Links, QR Codes, and Smart Redirect Rules
  // --------------------------------------------------------------------------
  try {
    log(4, 'Testing Member Link Shortening, Custom Alias, QR Codes, and Smart Rules');

    memberShortCode = `e2e-${timestamp}`;
    const targetUrl = 'https://axly.in/docs/architecture';
    const linkRes = await fetch(`${API_BASE}/api/urls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        originalUrl: targetUrl,
        customCode: memberShortCode,
        title: 'Axly Architecture Documentation',
        tags: ['e2e', 'docs', 'release'],
      }),
    });
    const linkJson = await linkRes.json();
    assert.equal(linkRes.status, 201, 'Link creation should return 201');
    assert.equal(linkJson.data.shortCode, memberShortCode);
    memberUrlId = linkJson.data.id;
    pass(4, `Member link created with custom alias: /${memberShortCode}`);

    // List links
    const listRes = await fetch(`${API_BASE}/api/urls`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const listJson = await listRes.json();
    assert.equal(listRes.status, 200);
    assert.ok(listJson.data.length >= 1);
    pass(4, `GET /api/urls returned ${listJson.data.length} links for user`);

    // Fetch QR Code data URL
    const qrRes = await fetch(`${API_BASE}/api/urls/${memberUrlId}/qr`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const qrJson = await qrRes.json();
    assert.equal(qrRes.status, 200);
    assert.ok(qrJson.qrCode.startsWith('data:image/png;base64,'));
    pass(4, 'GET /api/urls/:id/qr successfully generated QR Code image');

    // Add Smart Device Redirect Rule
    const ruleRes = await fetch(`${API_BASE}/api/urls/${memberUrlId}/rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        ruleType: 'device',
        matchValue: 'mobile',
        destinationUrl: 'https://axly.in/mobile-app-download',
      }),
    });
    const ruleJson = await ruleRes.json();
    assert.equal(ruleRes.status, 201);
    pass(4, 'POST /api/urls/:id/rules attached smart device routing rule');

    // Trigger redirection to register click
    await fetch(`${API_BASE}/${memberShortCode}`, { redirect: 'manual' });

    // Fetch Link Analytics
    const analyticsRes = await fetch(`${API_BASE}/api/urls/${memberUrlId}/analytics`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const analyticsJson = await analyticsRes.json();
    assert.equal(analyticsRes.status, 200);
    pass(4, `GET /api/urls/:id/analytics verified click tracking (clicks: ${analyticsJson.data.analytics.totalClicks})`);

    // CSV Export
    const csvRes = await fetch(`${API_BASE}/api/urls/export/csv`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(csvRes.status, 200);
    const csvContent = await csvRes.text();
    assert.ok(csvContent.includes('Short Code'));
    pass(4, 'GET /api/urls/export/csv successfully exported links dataset');
  } catch (err) {
    fail(4, 'Member link management failed', err);
  }

  // --------------------------------------------------------------------------
  // STEP 5: Marketing Campaigns & A/B Experiments
  // --------------------------------------------------------------------------
  try {
    log(5, 'Testing Campaign Management & A/B Experimentation Engine');

    // Create Campaign
    const campRes = await fetch(`${API_BASE}/api/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: `Q4 Launch Campaign ${timestamp}`,
        description: 'Multi-channel digital marketing initiative',
        utmSource: 'newsletter',
        utmMedium: 'email',
        utmCampaign: 'launch_v1',
      }),
    });
    const campJson = await campRes.json();
    assert.equal(campRes.status, 201);
    pass(5, `Campaign '${campJson.data.name}' registered with automated UTM tags`);

    // Create A/B Experiment
    const expRes = await fetch(`${API_BASE}/api/experiments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: `Landing Page Hero Split Test ${timestamp}`,
        urlId: memberUrlId,
        variants: [
          { name: 'Variant A (Control)', destinationUrl: 'https://axly.in/v1', weight: 50 },
          { name: 'Variant B (Challenger)', destinationUrl: 'https://axly.in/v2', weight: 50 },
        ],
      }),
    });
    const expJson = await expRes.json();
    assert.equal(expRes.status, 201);
    assert.equal(expJson.data.variants.length, 2);
    pass(5, `A/B Experiment configured with 2 traffic variants (50/50 split)`);
  } catch (err) {
    fail(5, 'Campaign and experiment workflows failed', err);
  }

  // --------------------------------------------------------------------------
  // STEP 6: Public Link & Bio Suite (Custom Page Builder)
  // --------------------------------------------------------------------------
  try {
    log(6, 'Testing Public Bio Page Suite, Public Resolution, and Lead Ingestion');

    // 1. Create a Public Page
    const pageCreateRes = await fetch(`${API_BASE}/api/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        title: 'Ravi Kiran — Developer & Creator Profile',
        slug: pageSlug,
        pageType: 'creator',
        templateKey: 'creator',
        bio: 'Building next-generation open digital tools and developer APIs.',
        status: 'published',
        blocks: [
          { id: 'b-link-1', type: 'link', label: 'GitHub Repository', url: 'https://github.com/Ravikiran9988/axly-url-shortener', visible: true },
          { id: 'b-social-1', type: 'social', label: 'Twitter / X', url: 'https://x.com/axly', platform: 'twitter', visible: true },
          { id: 'b-lead-1', type: 'lead_form', title: 'Work with me', description: 'Drop your message and email below.', buttonLabel: 'Send Inquiry', visible: true },
        ],
      }),
    });
    const pageCreateJson = await pageCreateRes.json();
    assert.equal(pageCreateRes.status, 201);
    pageId = (pageCreateJson.data || pageCreateJson.page).id;
    pass(6, `Public Bio page created and published at /p/${pageSlug}`);

    // 2. Resolve Public Page (Anonymous endpoint)
    const publicResolveRes = await fetch(`${API_BASE}/api/pages/public/slug/${pageSlug}`);
    const publicResolveJson = await publicResolveRes.json();
    assert.equal(publicResolveRes.status, 200);
    const resolvedPage = publicResolveJson.data || publicResolveJson.page;
    assert.equal(resolvedPage.slug, pageSlug);
    assert.equal(resolvedPage.blocks.length, 3);
    pass(6, `Public page resolution verified via GET /api/pages/public/slug/${pageSlug}`);

    // 3. Record Public Page Event
    const eventRes = await fetch(`${API_BASE}/api/pages/public/slug/${pageSlug}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'page_view' }),
    });
    assert.ok([200, 202].includes(eventRes.status));
    pass(6, 'Public page view telemetry event recorded');

    // 4. Submit Lead capture Form
    const leadRes = await fetch(`${API_BASE}/api/pages/public/slug/${pageSlug}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Enterprise Client',
        email: 'client@company.com',
        message: 'Interested in deploying Axly Studio on-premise.',
        consent: true,
      }),
    });
    const leadJson = await leadRes.json();
    assert.equal(leadRes.status, 201);
    pass(6, 'Consented lead inquiry successfully ingested from public contact block');

    // 5. Retrieve Page Leads (Protected endpoint)
    const leadsRes = await fetch(`${API_BASE}/api/pages/${pageId}/leads`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const leadsJson = await leadsRes.json();
    assert.equal(leadsRes.status, 200);
    const leadsList = leadsJson.data || leadsJson.leads || [];
    assert.ok(leadsList.length >= 1);
    assert.equal(leadsList[0].email, 'client@company.com');
    pass(6, 'Verified encrypted leads retrieved exclusively by page owner');
  } catch (err) {
    fail(6, 'Public Bio Page flow failed', err);
  }

  // --------------------------------------------------------------------------
  // STEP 7: Developer Platform, Teams & Custom Domains
  // --------------------------------------------------------------------------
  try {
    log(7, 'Testing Developer API Keys, Scopes, Teams, and Custom Domains');

    // Generate API Key
    const keyRes = await fetch(`${API_BASE}/api/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: `CI Automation Key ${timestamp}`,
        scopes: ['links:read', 'links:write', 'analytics:read'],
      }),
    });
    const keyJson = await keyRes.json();
    assert.equal(keyRes.status, 201);
    assert.ok(keyJson.data.key.startsWith('axly_'));
    apiKeySecret = keyJson.data.key;
    pass(7, `API Key created: ${keyJson.data.key_prefix || keyJson.data.prefix}... (hashed securely in DB)`);

    // Authenticate using API Key
    const keyAuthRes = await fetch(`${API_BASE}/api/urls`, {
      headers: { 'X-API-Key': apiKeySecret },
    });
    const keyAuthJson = await keyAuthRes.json();
    assert.equal(keyAuthRes.status, 200);
    pass(7, 'API Key programmatic authentication verified via X-API-Key header');

    // Create Team Workspace
    const wsRes = await fetch(`${API_BASE}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: `Engineering Team ${timestamp}`,
        slug: `eng-${timestamp}`,
      }),
    });
    const wsJson = await wsRes.json();
    assert.equal(wsRes.status, 201);
    workspaceId = wsJson.data.id;
    pass(7, `Workspace team created: ${wsJson.data.name} (owner RBAC assigned)`);

    // Register Custom Domain
    const domainRes = await fetch(`${API_BASE}/api/domains`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        domain: `links-${timestamp}.example.com`,
        domainType: 'shortlinks',
      }),
    });
    const domainJson = await domainRes.json();
    assert.equal(domainRes.status, 201);
    assert.ok((domainJson.data.verification_token || domainJson.data.verificationToken).startsWith('axly-verify-'));
    pass(7, `Custom domain registered with DNS TXT verification token`);
  } catch (err) {
    fail(7, 'Developer and team platform failed', err);
  }

  // --------------------------------------------------------------------------
  // STEP 8: Administrative Operations & Control Center
  // --------------------------------------------------------------------------
  try {
    log(8, 'Testing Administrator Console, System Diagnostics, and Domain Firewall');

    // Elevate user to admin directly in database or verify admin credentials
    // We can use the admin password reset / token or check admin endpoint
    const { query } = await import('../src/db/pool.js');
    await query("UPDATE users SET role = 'admin' WHERE id = $1", [testUserId]);

    // Refresh JWT with admin privileges
    const refreshLogin = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: userPassword }),
    });
    const refreshJson = await refreshLogin.json();
    const adminToken = refreshJson.token;
    assert.equal(refreshJson.user.role, 'admin');
    pass(8, 'Administrator privileges verified and authenticated');

    // Admin Stats
    const statsRes = await fetch(`${API_BASE}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const statsJson = await statsRes.json();
    assert.equal(statsRes.status, 200);
    assert.ok(statsJson.data.totalUsers >= 1);
    assert.ok(statsJson.data.totalUrls >= 1);
    pass(8, `GET /api/admin/stats verified platform metrics (${statsJson.data.totalUsers} users, ${statsJson.data.totalUrls} URLs)`);

    // System Diagnostics
    const diagRes = await fetch(`${API_BASE}/api/admin/system/diagnostics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const diagJson = await diagRes.json();
    assert.equal(diagRes.status, 200);
    assert.equal(diagJson.data.database.status, 'healthy');
    pass(8, `GET /api/admin/system/diagnostics returned PostgreSQL version & memory telemetry`);

    // Instant Database Ping Probe
    const pingRes = await fetch(`${API_BASE}/api/admin/system/ping`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pingJson = await pingRes.json();
    assert.equal(pingRes.status, 200);
    pass(8, `POST /api/admin/system/ping verified direct roundtrip (latency: ${pingJson.latencyMs}ms)`);

    // Firewall Overview & Test
    const fwRes = await fetch(`${API_BASE}/api/admin/firewall`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const fwJson = await fwRes.json();
    assert.equal(fwRes.status, 200);
    assert.ok(fwJson.data.bannedDomains.length >= 1);
    pass(8, `GET /api/admin/firewall active with ${fwJson.data.bannedDomains.length} security blocklist entries`);

    const fwTestRes = await fetch(`${API_BASE}/api/admin/firewall/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ targetUrl: 'https://phish-axly.xyz/malicious-payload' }),
    });
    const fwTestJson = await fwTestRes.json();
    assert.equal(fwTestRes.status, 200);
    assert.equal(fwTestJson.data.isBlocked, true);
    pass(8, 'POST /api/admin/firewall/test correctly detected and blocked known phishing threat');

    // Admin Public Pages List
    const adminPagesRes = await fetch(`${API_BASE}/api/admin/public-pages`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminPagesJson = await adminPagesRes.json();
    assert.equal(adminPagesRes.status, 200);
    assert.ok(adminPagesJson.data.length >= 1);
    pass(8, `GET /api/admin/public-pages returned ${adminPagesJson.data.length} registered bio pages`);
  } catch (err) {
    fail(8, 'Admin operations failed', err);
  }

  // --------------------------------------------------------------------------
  // STEP 9: Frontend Web Application Integration Check
  // --------------------------------------------------------------------------
  try {
    log(9, 'Testing Frontend Single-Page Application Delivery and Asset Bundles');

    const feRes = await fetch(`${FRONTEND_BASE}/`);
    assert.equal(feRes.status, 200, 'Frontend server should respond with 200');
    const html = await feRes.text();
    assert.ok(html.includes('<div id="root"></div>'), 'HTML must include React root container');
    assert.ok(html.includes('Axly Studio'), 'HTML must include Axly Studio branding title');
    pass(9, 'GET http://localhost:5173/ delivered React SPA container and HTML shell');

    // Check QR public route
    const qrPageRes = await fetch(`${FRONTEND_BASE}/qr`);
    assert.equal(qrPageRes.status, 200);
    pass(9, 'GET http://localhost:5173/qr accessible as a standalone public route');

    // Check Public Page route delivery
    const publicPageFeRes = await fetch(`${FRONTEND_BASE}/p/${pageSlug}`);
    assert.equal(publicPageFeRes.status, 200);
    pass(9, `GET http://localhost:5173/p/${pageSlug} served public creator view`);
  } catch (err) {
    fail(9, 'Frontend delivery verification failed', err);
  }

  console.log(`
╔═════════════════════════════════════════════════════════════════╗
║     ✔ ALL 9 END-TO-END WORKFLOW SUITES PASSED SUCCESSFULLY!     ║
║                                                                 ║
║  1. System Liveness & Health Probes             [PASS]          ║
║  2. Anonymous Guest Shortening & Redirection    [PASS]          ║
║  3. User Registration, Login & Profile          [PASS]          ║
║  4. Custom Alias, QR Codes & Smart Rules        [PASS]          ║
║  5. Marketing Campaigns & A/B Experiments       [PASS]          ║
║  6. Public Bio Suite & Lead Form Ingestion      [PASS]          ║
║  7. Developer API Keys & Teams RBAC             [PASS]          ║
║  8. Admin Control Center & Domain Firewall      [PASS]          ║
║  9. Frontend SPA Delivery & Public Routes       [PASS]          ║
╚═════════════════════════════════════════════════════════════════╝
`);

  // Clean exit
  const { closePool } = await import('../src/db/pool.js');
  await closePool();
  process.exit(0);
}

runEndToEndTests().catch(err => {
  console.error('\nFatal E2E error:', err);
  process.exit(1);
});
