window.__APP_INIT__ = false;
import { saveUser } from './api.js';

const selectors = {
  heroLive: document.querySelector('.hero .live'),
  statUsers: document.getElementById('stat-users'),
  statCommitments: document.getElementById('stat-commitments'),
  statEuro: document.getElementById('stat-euro'),
  topProgressValue: document.getElementById('topProgressValue'),
  topCapitalValue: document.getElementById('topCapitalValue'),
  progressFill: document.getElementById('progressFill'),
  liveUsers: document.getElementById('liveUsers'),
  liveCommitments: document.getElementById('liveCommitments'),
  cta: document.querySelector('.cta'),
  loginContainer: document.querySelector('.login'),
  emailBtn: document.querySelector('.btn.alt'),
  authStatus: document.getElementById('authStatus'),
  logoutButton: document.getElementById('logoutButton'),
  participation: document.querySelector('.participation'),
  pledgeButton: document.getElementById('pledgeButton'),
  tierButtons: document.querySelectorAll('.tier-button'),
};

const STATE_KEY = 'milan_auth';
const OTP_KEY = 'milan_otp';

const SUPABASE_URL = 'https://tgaqsjnjwqqnozscdpds.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-9wJdCJPLLfL9dqAARXNqA_iPqD2ib8';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabaseClient = supabaseClient;

const fanSelectors = {
  totalUsers: document.getElementById('totalUsers'),
  totalCapital: document.getElementById('totalCapital'),
  countryList: document.getElementById('countryList'),
};

const state = {
  loggedIn: false,
  user: null,
  userPledge: null,
  selectedAmount: null,
  stats: {
    users: 0,
    count: 0,
    total: 0,
  },
};

// Fetch existing pledge for a given user and store in state
async function fetchUserPledge(userId) {
  if (!userId) return null;

  const { data, error } = await supabaseClient
    .from('pledges')
    .select('amount, user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('fetchUserPledge error:', error);
    state.userPledge = null;
    return { exists: false, error: true };
  }

  state.userPledge = data || null;
  applyPledgeUI();

  return {
    exists: !!data,
    data
  };
}

function applyPledgeUI() {
  const pledge = state.userPledge;
  // ensure participation container exists
  if (!selectors.participation) return;

  // remove any previous info
  let info = document.getElementById('pledgeInfo');
  if (info) info.remove();

  if (pledge && pledge.amount) {
    // Disable tier buttons
    if (selectors.tierButtons) {
      selectors.tierButtons.forEach((b) => {
        b.disabled = true;
        b.classList.remove('selected');
      });
    }

    // Disable confirm button and change text
    if (selectors.pledgeButton) {
      selectors.pledgeButton.disabled = true;
      selectors.pledgeButton.textContent = 'Partecipazione già registrata';
    }

    // Show message with amount
    info = document.createElement('div');
    info.id = 'pledgeInfo';
    info.style.marginTop = '10px';
    info.style.fontSize = '13px';
    info.style.color = '#bdebb0';
    info.textContent = `✅ Hai già registrato una partecipazione di ${formatCurrency(Number(pledge.amount))}`;
    selectors.participation.appendChild(info);
  } else {
    // No pledge: keep current behavior
    if (selectors.tierButtons) {
      selectors.tierButtons.forEach((b) => {
        b.disabled = false;
      });
    }
    if (selectors.pledgeButton) {
      selectors.pledgeButton.textContent = 'Conferma partecipazione';
      // keep disabled unless a tier is selected
      selectors.pledgeButton.disabled = !state.selectedAmount;
    }
  }
}

function loadState() {
  const stored = localStorage.getItem(STATE_KEY);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    state.loggedIn = Boolean(parsed.loggedIn);
    state.user = parsed.user || null;
  } catch (error) {
    console.warn('Could not load auth state', error);
  }
}

function saveAuthState() {
  localStorage.setItem(STATE_KEY, JSON.stringify({
    loggedIn: state.loggedIn,
    user: state.user,
  }));
}

async function recoverSession() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error('Session recovery error:', error);
      return null;
    }

    if (data && data.session && data.session.user) {
      state.loggedIn = true;
      state.user = data.session.user;
      saveAuthState();
      updateAuthDisplay(data.session.user);
      // Load any existing pledge for this user
      fetchUserPledge(data.session.user.id).catch((e) => console.error(e));
      // Upsert profile with country info
      upsertProfile(data.session.user).catch((e) => console.error(e));
      return data.session.user;
    }
  } catch (err) {
    console.error('Unexpected error during session recovery:', err);
  }

  return null;
}

function setupAuthListener() {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
      state.loggedIn = true;
      state.user = session.user;
      saveAuthState();
      updateAuthDisplay(session.user);
      loadStats();
      // Load any existing pledge for this user
      fetchUserPledge(session.user.id).catch((e) => console.error(e));
      // Upsert profile with country info
      upsertProfile(session.user).catch((e) => console.error(e));
    } else {
      state.loggedIn = false;
      state.user = null;
      state.userPledge = null;
      saveAuthState();
      updateAuthDisplay(null);
      applyPledgeUI();
      loadStats();
    }
  });
}

async function loginWithGoogle() {
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://crbgnn.github.io/milan/'
    }
  });

  if (error) console.error(error);
  return data;
}

let otpLock = false;

async function loginWithEmail(email) {
  try {
    if (!email || !email.includes("@")) {
      alert("Inserisci una email valida");
      return;
    }

    const { data, error } =
      await supabaseClient.auth.signInWithOtp({
        email
      });

    if (error) {
      console.error("OTP error:", error);
      alert("Errore invio OTP");
      return;
    }

    console.log("OTP inviato:", data);
    alert("Controlla la tua email 📩");

    return data;

  } catch (err) {
    console.error("loginWithEmail crash:", err);
    alert("Errore inatteso");
  }
}

async function getUser() {
  if (state.user) {
    return state.user;
  }

  const { data, error } = await supabaseClient.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return data.user || null;
}

async function savePledge() {
  const amount = state.selectedAmount;
  if (!amount) {
    alert('Seleziona una fascia prima di confermare');
    return;
  }

  const btn = selectors.pledgeButton;
  if (!btn) return;

  const originalText = btn.textContent;
  btn.textContent = 'Elaborazione...';
  btn.disabled = true;

  try {
    const user = await getUser();
    if (!user) {
      alert('Devi fare login prima di partecipare');
      btn.textContent = originalText;
      btn.disabled = false;
      return;
    }

    // 🔥 CHECK ESISTENTE (SAFE)
    const existing = await fetchUserPledge(user.id);
    if (existing.exists) {
      alert('Hai già registrato una partecipazione.');
      btn.textContent = originalText;
      btn.disabled = true;
      return;
    }

    // 🔥 UPSERT (ANTI RACE CONDITION)
    const { error } = await supabaseClient
      .from('pledges')
      .upsert(
        {
          user_id: user.id,
          amount
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error(error);
      alert('Errore nel salvataggio');
      btn.textContent = originalText;
      btn.disabled = false;
      return;
    }

    await loadStats();
    await fetchUserPledge(user.id);

    selectors.tierButtons.forEach(b => b.classList.remove('selected'));
    state.selectedAmount = null;

    btn.textContent = 'Partecipazione registrata';
    btn.disabled = true;

    const toast = document.createElement('div');
    toast.textContent = '✅ Dichiarazione registrata';
    toast.style.cssText =
      'position:fixed;bottom:24px;right:20px;background:#C41C23;color:#fff;padding:12px 18px;border-radius:12px;font-size:13px;font-weight:700;z-index:9999;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);

    openShare(amount, state.stats);

  } catch (err) {
    console.error(err);
    alert('Errore inatteso');
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function updateAuthDisplay(user) {
  if (!selectors.authStatus || !selectors.logoutButton) return;

  if (user) {
    selectors.authStatus.style.display = 'block';
    selectors.authStatus.innerHTML = `Logged in as <strong>${user.email}</strong>`;
    selectors.logoutButton.style.display = 'block';
    
    // Show participation section when logged in
    if (selectors.participation) {
      selectors.participation.style.display = 'block';
    }
  } else {
    selectors.authStatus.style.display = 'none';
    selectors.authStatus.innerHTML = '';
    selectors.logoutButton.style.display = 'none';
    
    // Hide participation section when logged out
    if (selectors.participation) {
      selectors.participation.style.display = 'none';
    }
    // Clear any selected tier and disable pledge button on logout
    if (selectors.tierButtons) {
      selectors.tierButtons.forEach((b) => b.classList.remove('selected'));
    }
    state.selectedAmount = null;
    if (selectors.pledgeButton) selectors.pledgeButton.disabled = true;
  }
}


async function loadPledgeStats() {
  const { data: pledges, error, count } = await supabaseClient
    .from('pledges')
    .select('amount, user_id', { count: 'exact' });

 if (error) {
  console.error("FULL ERROR:", error);
  alert(error.message);
  return;
}

  const rows = pledges || [];
  const total = rows.reduce((sum, p) => sum + Number(p.amount), 0);
  const users = new Set(rows.map((p) => p.user_id)).size;
  const countValue = typeof count === 'number' ? count : rows.length;

  return {
    users,
    count: countValue,
    total,
  };
}
function setupEvents() {
  if (!selectors.tierButtons) return;

  selectors.tierButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();

      selectors.tierButtons.forEach((btn) =>
        btn.classList.remove('selected')
      );

      button.classList.add('selected');

      state.selectedAmount = Number(button.dataset.amount);

      if (selectors.pledgeButton)
        selectors.pledgeButton.disabled = false;
    });
  });
}

function renderStats(data) {
  const statsData = data || {
    users: state.stats.users,
    count: state.stats.count,
    total: state.stats.total,
  };

  state.stats = {
    users: statsData.users || 0,
    count: statsData.count || 0,
    total: statsData.total || 0,
  };

  if (selectors.topCapitalValue) {
    selectors.topCapitalValue.textContent = formatCurrency(state.stats.total);
  }

  if (selectors.progressFill) {
    const ratio = Math.min(state.stats.total / 1000000000, 1);
    selectors.progressFill.style.width = `${ratio * 100}%`;
  }

  if (selectors.topProgressValue) {
    selectors.topProgressValue.textContent = `${Math.round(Math.min(state.stats.total / 1000000000, 1) * 100)}%`;
  }

  if (selectors.liveUsers) {
    selectors.liveUsers.textContent = formatNumber(state.stats.users);
  }

  if (selectors.liveCommitments) {
    selectors.liveCommitments.textContent = formatNumber(state.stats.count);
  }

  if (selectors.statUsers) {
    selectors.statUsers.textContent = formatNumber(state.stats.users);
  }

  if (selectors.statCommitments) {
    selectors.statCommitments.textContent = formatNumber(state.stats.count);
  }

  if (selectors.statEuro) {
    selectors.statEuro.textContent = formatCurrency(state.stats.total);
  }

  if (fanSelectors.totalUsers) {
    fanSelectors.totalUsers.textContent = formatNumber(state.stats.users);
  }

  if (fanSelectors.totalCapital) {
    fanSelectors.totalCapital.textContent = formatCurrency(state.stats.total);
  }

  // Update top countries aggregation (non-blocking)
}

function getCountryFromLocale() {
  try {
    const locale = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toString();
    if (!locale) return 'Unknown';
    const parts = locale.split(/[-_]/);
    const region = parts[1] || parts[0];
    if (!region) return 'Unknown';
    const code = region.toUpperCase();
    try {
      const dn = new Intl.DisplayNames(['en'], { type: 'region' });
      const name = dn.of(code);
      return name || code;
    } catch (err) {
      return code;
    }
  } catch (err) {
    return 'Unknown';
  }
}

async function upsertProfile(user) {
  if (!user || !user.id) return null;
  const country = getCountryFromLocale() || 'Unknown';
  const profile = {
    user_id: user.id,
    email: user.email || null,
    full_name: (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || null,
    country,
  };

  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .upsert([profile], { onConflict: 'user_id' });

    if (error) {
      console.error('Error upserting profile:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Unexpected error upserting profile:', err);
    return null;
  }
}

async function loadCountryTotals() {
  if (!fanSelectors.countryList) return;
  try {
    const { data, error } = await supabaseClient.rpc('get_country_totals');
    if (error) {
      console.error('Error calling get_country_totals RPC:', error);
      fanSelectors.countryList.innerHTML = '<div style="color:#777; font-size:12px;">Errore caricamento dati paesi.</div>';
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    if (!rows || rows.length === 0) {
      fanSelectors.countryList.innerHTML = '<div style="color:#777; font-size:12px;">No data available</div>';
      return;
    }

    // Ensure numeric sort by total_amount desc
    rows.sort((a, b) => Number(b.total_amount || 0) - Number(a.total_amount || 0));

    const html = rows.slice(0, 10).map((r) => {
      const country = r.country || 'Unknown';
      const total = Number(r.total_amount || 0);
      const users = r.users_count || 0;
      return `<div style="display:flex;justify-content:space-between;padding:6px 0;align-items:center;"><div style="font-size:13px;">${country}<div style=\"font-size:11px;color:#bbb;margin-top:2px;\">${users} utenti</div></div><strong>${formatCurrency(total)}</strong></div>`;
    }).join('');

    fanSelectors.countryList.innerHTML = html;
  } catch (err) {
    console.error('Unexpected error calling get_country_totals RPC:', err);
    fanSelectors.countryList.innerHTML = '<div style="color:#777; font-size:12px;">No data available</div>';
  }
}

async function loadStats() {
  const pledgeData = await loadPledgeStats();
  renderStats(pledgeData);
}

function formatNumber(value) {
  return value.toLocaleString('it-IT');
}

function formatCurrency(value) {
  return '€' + value.toLocaleString('it-IT');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

async function loadFanCapitalTrend() {
  if (window.fanChart) {
  window.fanChart.destroy();
  window.fanChart = null;
}
  // Insert the chart below the Milan Fan Capital Index card
  if (!fanSelectors.countryList) return;

  // Ensure Chart.js is loaded
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/chart.js');
  } catch (err) {
    console.error('Could not load Chart.js:', err);
    return;
  }

  // Fetch pledges
  let pledges = [];
  try {
    const { data, error } = await supabaseClient
      .from('pledges')
      .select('amount, created_at')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error loading pledges for trend chart:', error);
      return;
    }
    pledges = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Unexpected error fetching pledges for trend:', err);
    return;
  }

  if (!pledges || pledges.length === 0) {
    // don't render chart if no data
    return;
  }

  // Aggregate running total
  const labels = [];
  const dataPoints = [];
  let running = 0;
  pledges.forEach((p) => {
    const amt = Number(p.amount) || 0;
    running += amt;
    const d = new Date(p.created_at);
    const label = d.toLocaleDateString('it-IT');
    labels.push(label);
    dataPoints.push(running);
  });

  // Create container below the index card
  const container = document.getElementById('fanCapitalChart');
if (!container) return;

// hard safety: evita duplicati DOM
const existing = document.getElementById('fanTrendChartWrap');
if (existing) existing.remove();

const wrap = document.createElement('div');
wrap.id = 'fanTrendChartWrap';
wrap.style.marginTop = '12px';
wrap.style.background = 'rgba(255,255,255,0.02)';
wrap.style.border = '1px solid rgba(255,255,255,.06)';
wrap.style.borderRadius = '12px';
wrap.style.padding = '10px';

const title = document.createElement('div');
title.textContent = 'Fan Capital Trend';
title.style.color = '#fff';
title.style.fontSize = '13px';
title.style.fontWeight = '700';
title.style.marginBottom = '8px';

wrap.appendChild(title);

const canvasWrap = document.createElement('div');
canvasWrap.style.position = 'relative';
canvasWrap.style.height = '200px';
canvasWrap.style.width = '100%';

const canvas = document.createElement('canvas');
canvasWrap.appendChild(canvas);
wrap.appendChild(canvasWrap);
container.appendChild(wrap);

  // Render Chart.js line chart
  try {
    const ctx = canvas.getContext('2d');
    /* global Chart */

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(196,28,35,0.35)');
    gradient.addColorStop(1, 'rgba(196,28,35,0)');

    window.fanChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            data: dataPoints,
            borderColor: '#ff2a2a',
            backgroundColor: gradient,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#ff2a2a',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            borderWidth: 2.5,
            tension: 0.4,
          },
        ],
      },
      options: {
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart',
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          title: { display: false },
          tooltip: {
            backgroundColor: 'rgba(10,10,10,0.85)',
            borderColor: 'rgba(196,28,35,0.4)',
            borderWidth: 1,
            titleColor: '#aaa',
            titleFont: { size: 11 },
            bodyColor: '#fff',
            bodyFont: { size: 13, weight: '700' },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ' €' + ctx.parsed.y.toLocaleString('it-IT'),
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#666',
              maxRotation: 0,
              maxTicksLimit: 5,
              font: { size: 10 },
            },
            grid: { color: 'rgba(255,255,255,0.04)' },
            border: { color: 'rgba(255,255,255,0.06)' },
          },
          y: {
            ticks: {
              color: '#666',
              font: { size: 10 },
              callback: (v) => '€' + v.toLocaleString('it-IT'),
            },
            grid: { color: 'rgba(255,255,255,0.04)' },
            border: { color: 'rgba(255,255,255,0.06)' },
          },
        },
        maintainAspectRatio: false,
      },
    });
  } catch (err) {
    console.error('Error rendering trend chart:', err);
  }
}

function calculateFanCapital() {
  if (!fanSelectors.countryList) return;
  fanSelectors.countryList.innerHTML = '<div style="color:#777; font-size:12px; line-height:1.6;">Dati paesi disponibili tramite Supabase.</div>';
}

function getBoostedCommitments() {
  return state.stats.count;
}

function animateCount(element, from, to, duration = 900, prefix = '') {
  const start = performance.now();
  const range = to - from;

  function step(timestamp) {
    const progress = Math.min((timestamp - start) / duration, 1);
    const current = Math.round(from + range * progress);
    element.textContent = `${prefix}${formatNumber(current)}`;
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function updateHeroText() {
  const verified = formatNumber(state.stats.users);
  const commitments = formatNumber(getBoostedCommitments());
  if (selectors.heroLive) {
    selectors.heroLive.innerHTML = `🔥 ${verified} tifosi già verificati<br>📊 ${commitments} dichiarazioni in tempo reale`;
  }
}

function animateStats() {
  updateHeroText();
  if (selectors.statUsers) {
    animateCount(selectors.statUsers, 0, state.stats.users);
  }
  if (selectors.statCommitments) {
    animateCount(selectors.statCommitments, 0, state.stats.count);
  }
  if (selectors.statEuro) {
    animateCount(selectors.statEuro, 0, state.stats.total, 1000, '€');
  }
}

function scheduleStatUpdates() {
  // No fake auto-increment updates. Stats refresh from Supabase in realtime only.
}

function createBadge() {
  if (document.getElementById('verifiedBadge')) return;

  if (!selectors.heroLive) return;

  const badge = document.createElement('span');
  badge.id = 'verifiedBadge';
  badge.className = 'verified-badge';
  badge.textContent = 'Verificato';

  selectors.heroLive.insertAdjacentElement('afterend', badge);
}

function updateCtaText() {
  selectors.cta.textContent = state.loggedIn ? 'Sei partecipante' : 'PARTECIPA ORA';
}

function openOtpForm() {
  if (document.querySelector('.otp-form')) return;

  const form = document.createElement('form');
  form.className = 'otp-form';
  form.style.marginTop = '14px';

  form.innerHTML = `
    <label style="display:block;font-size:12px;color:#ccc;margin-bottom:8px;">Email</label>
    <input type="email" name="email" required
      style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#fff;margin-bottom:10px;" />
    <button type="submit">Richiedi OTP</button>
  `;

  selectors.loginContainer.appendChild(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = form.querySelector('input').value.trim();
    if (!email) return;

    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Invio...';

    await loginWithEmail(email);

    form.outerHTML =
      `<p style="font-size:12px;color:#ccc;margin-top:10px;">
        OTP inviato a ${email}
      </p>`;
  });
}

async function completeLogin(userData) {
  state.loggedIn = true;
  state.user = userData;

  saveAuthState();

  await saveUser(userData);

  createBadge();
  updateCtaText();

  selectors.loginContainer.innerHTML = `
    <h3>Verifica identità</h3>
    <div class="info" style="margin-top:0;">
      Accesso completato come <strong>${userData.email || userData.provider}</strong>.
    </div>
  `;

  if (userData && userData.id) {
    fetchUserPledge(userData.id).catch((e) => console.error(e));
    upsertProfile(userData).catch((e) => console.error(e));
  }
}

  selectors.tierButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      selectors.tierButtons.forEach((btn) => btn.classList.remove('selected'));
      button.classList.add('selected');
      state.selectedAmount = Number(button.dataset.amount);
      if (selectors.pledgeButton) selectors.pledgeButton.disabled = false;
    });
  });
  async function logout() {
  try {
    await supabaseClient.auth.signOut();

    state.loggedIn = false;
    state.user = null;

    updateCtaText();

    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) logoutBtn.style.display = 'none';

    selectors.loginContainer.innerHTML = `
      <h3>Verifica identità</h3>
      <a href="#" onclick="event.preventDefault(); loginWithGoogle()">Continua con Google</a>
      <a href="#" onclick="event.preventDefault(); openOtpForm()">Email + OTP</a>
    `;

    document.getElementById('verifiedBadge')?.remove();

    console.log("logout OK");
  } catch (err) {
    console.error("logout error:", err);
  }
}
window.logout = logout;

async function init() {
  if (window.__APP_INIT__) return;
  window.__APP_INIT__ = true;

  loadState();

  await recoverSession();

  setupAuthListener();

  if (state.loggedIn && state.user) {
    createBadge();
    updateCtaText();

    fetchUserPledge(state.user.id).catch((e) => console.error(e));
    upsertProfile(state.user).catch((e) => console.error(e));
  }

 setupEvents();

const btn = document.getElementById('logoutButton');

if (btn) {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    await logout();
  });
}

  // ✅ LOAD DATI UNA SOLA VOLTA
  loadStats();
  loadCountryTotals().catch((e) => console.error('Country load error', e));

  // chart separato
  loadFanCapitalTrend().catch((e) => console.error('Trend load error', e));

  setupRealtime();
}

function setupRealtime() {
  if (!supabaseClient) return;

  supabaseClient
    .channel('pledges')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'pledges',
      },
      async () => {
  const pledgeData = await loadPledgeStats();

  if (!pledgeData) return;

  // IMPORTANT: evita re-render duplicati aggressivi
  requestAnimationFrame(() => {
    renderStats(pledgeData);
  });
}
    )
    .subscribe();
}

function openShare(amount, stats) {
  const text =
`🔴 Sono uno dei ${stats.users} tifosi verificati del Milan
💰 Ho dichiarato: €${amount.toLocaleString('it-IT')}
📊 Fan Index globale in crescita

👉 https://milanaitifosi.it`;

  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}
window.loginWithGoogle = loginWithGoogle;
window.loginWithEmail = loginWithEmail;
window.savePledge = savePledge;
window.getUser = getUser;
window.loadStats = loadStats;
window.renderStats = renderStats;
window.openOtpForm = openOtpForm;
window.logout = logout;

init();
