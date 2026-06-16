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
  try {
    const { data, error } = await supabaseClient
      .from('pledges')
      .select('amount, user_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user pledge:', error);
      state.userPledge = null;
      return null;
    }

    state.userPledge = data || null;
    applyPledgeUI();
    return state.userPledge;
  } catch (err) {
    console.error('Unexpected error fetching pledge:', err);
    state.userPledge = null;
    return null;
  }
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

async function loginWithEmail(email) {
  const { data, error } = await supabaseClient.auth.signInWithOtp({
    email,
  });

  if (error) console.error(error);
  return data;
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

    // Final check: ensure no existing pledge for this user before inserting
    try {
      const existing = await fetchUserPledge(user.id);
      if (existing) {
        alert('Hai già registrato una partecipazione.');
        btn.textContent = originalText;
        btn.disabled = false;
        return;
      }
    } catch (err) {
      console.error('Error during final pledge check:', err);
      // proceed cautiously if check fails
    }

    const { error } = await supabaseClient
      .from('pledges')
      .insert([
        {
          user_id: user.id,
          amount,
        },
      ]);

    if (error) {
      console.error('Errore nel salvataggio:', error);
      alert('Errore nel salvataggio della partecipazione. Riprova.');
      btn.textContent = originalText;
      btn.disabled = false;
      return;
    }

    // Refresh full stats from Supabase
    await loadStats();

    // After successful insert, refresh user pledge state and UI
    await fetchUserPledge(user.id);

    // Reset selection and disable button
    selectors.tierButtons.forEach((b) => b.classList.remove('selected'));
    state.selectedAmount = null;
    if (selectors.pledgeButton) selectors.pledgeButton.disabled = true;

    // Confirmation message
    alert('✅ Dichiarazione registrata');
    btn.textContent = originalText;
    btn.disabled = false;
  } catch (err) {
    console.error('Unexpected error:', err);
    alert('Errore inatteso. Riprova.');
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

async function logout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) console.error(error);
  state.loggedIn = false;
  state.user = null;
  saveAuthState();
  updateAuthDisplay(null);
  updateCtaText();
}

async function loadPledgeStats() {
  const { data: pledges, error, count } = await supabaseClient
    .from('pledges')
    .select('amount, user_id', { count: 'exact' });

  if (error) {
    console.error('Error loading public pledge stats:', error);
    return {
      users: 0,
      count: 0,
      total: 0,
    };
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
  loadCountryTotals().catch((e) => {
    console.error('Error loading country totals:', e);
  });
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
    const { data: pledges, error: pledgesErr } = await supabaseClient
      .from('pledges')
      .select('amount, user_id');

    if (pledgesErr) {
      console.error('Error loading pledges for country totals:', pledgesErr);
      fanSelectors.countryList.innerHTML = '<div style="color:#777; font-size:12px;">Errore caricamento dati paesi.</div>';
      return;
    }

    const { data: profiles, error: profilesErr } = await supabaseClient
      .from('profiles')
      .select('user_id, country');

    const profileMap = new Map();
    if (!profilesErr && Array.isArray(profiles)) {
      profiles.forEach((p) => {
        profileMap.set(p.user_id, p.country || 'Unknown');
      });
    }

    const countryTotals = {};
    (pledges || []).forEach((p) => {
      const country = profileMap.get(p.user_id) || 'Unknown';
      const amt = Number(p.amount) || 0;
      countryTotals[country] = (countryTotals[country] || 0) + amt;
    });

    // Convert to array and sort
    const rows = Object.keys(countryTotals).map((c) => ({ country: c, total: countryTotals[c] }));
    rows.sort((a, b) => b.total - a.total);

    if (rows.length === 0) {
      fanSelectors.countryList.innerHTML = '<div style="color:#777; font-size:12px;">Dati paesi disponibili tramite Supabase.</div>';
      return;
    }

    // Render top countries
    const html = rows.slice(0, 10).map((r) => `<div style="display:flex;justify-content:space-between;padding:6px 0;"><span>${r.country}</span><strong>${formatCurrency(r.total)}</strong></div>`).join('');
    fanSelectors.countryList.innerHTML = html;
  } catch (err) {
    console.error('Unexpected error loading country totals:', err);
    fanSelectors.countryList.innerHTML = '<div style="color:#777; font-size:12px;">Dati paesi non disponibili.</div>';
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
  if (document.querySelector('.verified-badge')) return;
  const badge = document.createElement('span');
  badge.className = 'verified-badge';
  badge.textContent = 'Verificato';
  badge.style.display = 'inline-flex';
  badge.style.alignItems = 'center';
  badge.style.justifyContent = 'center';
  badge.style.padding = '6px 10px';
  badge.style.fontSize = '11px';
  badge.style.borderRadius = '999px';
  badge.style.background = 'rgba(255,255,255,.08)';
  badge.style.color = '#fff';
  badge.style.marginTop = '10px';
  selectors.heroLive.insertAdjacentElement('afterend', badge);
}

function updateCtaText() {
  selectors.cta.textContent = state.loggedIn ? 'Sei partecipante' : 'PARTECIPA ORA';
}

function openOtpForm() {
  const form = document.createElement('form');
  form.className = 'otp-form';
  form.style.marginTop = '14px';
  form.innerHTML = `
    <label style="display:block;font-size:12px;color:#ccc;margin-bottom:8px;">Email</label>
    <input type="email" name="email" placeholder="you@example.com" required style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#fff;margin-bottom:10px;" />
    <button type="submit" class="btn google" style="width:100%;">Richiedi OTP</button>
  `;

  const existing = selectors.loginContainer.querySelector('.otp-form');
  if (existing) return;
  selectors.loginContainer.appendChild(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = form.querySelector('input[name="email"]').value.trim();
    if (!email) return;
    await loginWithEmail(email);
    form.outerHTML = `<p style="font-size:12px;color:#ccc;margin-top:10px;">OTP inviato a ${email}. Controlla la tua email per completare l'accesso.</p>`;
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
    <div class="info" style="margin-top:0;">Accesso completato come <strong>${userData.email || userData.provider}</strong>.</div>
  `;
  // Fetch any existing pledge for this user
  if (userData && userData.id) {
    fetchUserPledge(userData.id).catch((e) => console.error(e));
    upsertProfile(userData).catch((e) => console.error(e));
  }
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function setupEvents() {
  if (selectors.emailBtn) {
    selectors.emailBtn.addEventListener('click', (event) => {
      event.preventDefault();
      openOtpForm();
    });
  }

  if (selectors.logoutButton) {
    selectors.logoutButton.addEventListener('click', async (event) => {
      event.preventDefault();
      await logout();
    });
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
}

async function init() {
  loadState();
  await recoverSession();
  setupAuthListener();
  if (state.loggedIn && state.user) {
    createBadge();
    updateCtaText();
    // ensure user pledge is loaded
    fetchUserPledge(state.user.id).catch((e) => console.error(e));
    upsertProfile(state.user).catch((e) => console.error(e));
  }
  setupEvents();
  loadStats();
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
        renderStats(pledgeData);
      }
    )
    .subscribe();
}

window.loginWithGoogle = loginWithGoogle;
window.loginWithEmail = loginWithEmail;
window.savePledge = savePledge;
window.getUser = getUser;
window.loadStats = loadStats;
window.renderStats = renderStats;

init();
