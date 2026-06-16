import { getStats, saveStats, saveUser } from './api.js';

const selectors = {
  heroLive: document.querySelector('.hero .live'),
  statUsers: document.getElementById('stat-users'),
  statCommitments: document.getElementById('stat-commitments'),
  statEuro: document.getElementById('stat-euro'),
  cta: document.querySelector('.cta'),
  loginContainer: document.querySelector('.login'),
  emailBtn: document.querySelector('.btn.alt'),
  authStatus: document.getElementById('authStatus'),
  logoutButton: document.getElementById('logoutButton'),
};

const STATE_KEY = 'milan_auth';
const OTP_KEY = 'milan_otp';

const SUPABASE_URL = 'https://tgaqsjnjwqqnozscdpds.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-9wJdCJPLLfL9dqAARXNqA_iPqD2ib8';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const fanData = [
  { country: 'Italia', users: 25000, avg: 650 },
  { country: 'Brasile', users: 18000, avg: 780 },
  { country: 'USA', users: 12000, avg: 900 },
  { country: 'UK', users: 8000, avg: 750 },
  { country: 'Francia', users: 6000, avg: 700 },
];

let commitmentBoost = 0;

const fanSelectors = {
  totalUsers: document.getElementById('totalUsers'),
  totalCapital: document.getElementById('totalCapital'),
  countryList: document.getElementById('countryList'),
};

const state = {
  loggedIn: false,
  user: null,
  stats: {
    verifiedUsers: 88004,
    commitments: 79208,
    euroValue: 94109549,
  },
};

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
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) {
    console.error(error);
    return null;
  }
  return data.user;
}

async function savePledge(amount) {
  const user = await getUser();
  if (!user) {
    alert('Devi fare login prima');
    return;
  }

  const { error } = await supabaseClient.from('pledges').insert([
    {
      user_id: user.id,
      amount: Number(amount),
    },
  ]);

  if (error) {
    console.error(error);
  } else {
    alert('Partecipazione registrata');
    loadPledgeStats();
  }
}

function updateAuthDisplay(user) {
  if (!selectors.authStatus || !selectors.logoutButton) return;

  if (user) {
    selectors.authStatus.style.display = 'block';
    selectors.authStatus.innerHTML = `Logged in as <strong>${user.email}</strong>`;
    selectors.logoutButton.style.display = 'block';
  } else {
    selectors.authStatus.style.display = 'none';
    selectors.authStatus.innerHTML = '';
    selectors.logoutButton.style.display = 'none';
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
  const { data: pledges, error } = await supabaseClient
    .from('pledges')
    .select('amount, user_id');

  if (error) {
    console.error(error);
    return;
  }

  if (!pledges) return;

  const totalCapital = pledges.reduce((sum, p) => sum + Number(p.amount), 0);
  const uniqueUsers = new Set(pledges.map(p => p.user_id)).size;

  if (fanSelectors.totalUsers) {
    fanSelectors.totalUsers.innerText = formatNumber(uniqueUsers);
  }

  if (fanSelectors.totalCapital) {
    fanSelectors.totalCapital.innerText = formatCurrency(totalCapital);
  }
}

async function loadStats() {
  calculateFanCapital();
  await loadPledgeStats();

  getStats().then((stats) => {
    state.stats = stats;
    animateStats();
    scheduleStatUpdates();
  });
}

function formatNumber(value) {
  return value.toLocaleString('it-IT');
}

function formatCurrency(value) {
  return '€' + value.toLocaleString('it-IT');
}

function calculateFanCapital() {
  if (!fanSelectors.totalUsers || !fanSelectors.totalCapital || !fanSelectors.countryList) return;

  let totalUsers = 0;
  let totalCapital = 0;
  fanSelectors.countryList.innerHTML = '';

  fanData.forEach(c => {
    const countryTotal = c.users * c.avg;

    totalUsers += c.users;
    totalCapital += countryTotal;

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.flexWrap = 'wrap';
    row.style.gap = '8px';
    row.innerHTML = `
      <span>${c.country}</span>
      <span style="color:#fff;">${formatCurrency(countryTotal)}</span>
    `;

    fanSelectors.countryList.appendChild(row);
  });

  fanSelectors.totalUsers.textContent = formatNumber(totalUsers);
  fanSelectors.totalCapital.textContent = formatCurrency(totalCapital);
  commitmentBoost = Math.max(3, Math.round(totalUsers / 800));
}

function getBoostedCommitments() {
  return state.stats.commitments + commitmentBoost;
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
  const verified = formatNumber(state.stats.verifiedUsers);
  const commitments = formatNumber(getBoostedCommitments());
  selectors.heroLive.innerHTML = `🔥 ${verified} tifosi già verificati<br>📊 ${commitments} dichiarazioni in tempo reale`;
}

function animateStats() {
  updateHeroText();
  animateCount(selectors.statUsers, 0, state.stats.verifiedUsers);
  animateCount(selectors.statCommitments, 0, getBoostedCommitments());
  animateCount(selectors.statEuro, 0, state.stats.euroValue, 1000, '€');
}

function scheduleStatUpdates() {
  setInterval(async () => {
    fanData.forEach(c => {
      c.users += Math.floor(Math.random() * 5);
    });

    calculateFanCapital();
    await loadPledgeStats();

    const increments = {
      verifiedUsers: Math.floor(Math.random() * 15) + 5,
      commitments: Math.floor(Math.random() * 6) + 1,
      euroValue: Math.floor(Math.random() * 150000) + 25000,
    };

    const nextStats = {
      verifiedUsers: state.stats.verifiedUsers + increments.verifiedUsers,
      commitments: state.stats.commitments + increments.commitments,
      euroValue: state.stats.euroValue + increments.euroValue,
    };

    const currentDisplayedCommitments = parseInt(selectors.statCommitments.textContent.replace(/\D/g, ''), 10) || state.stats.commitments;
    const nextDisplayedCommitments = nextStats.commitments + commitmentBoost;

    animateCount(selectors.statUsers, state.stats.verifiedUsers, nextStats.verifiedUsers);
    animateCount(selectors.statCommitments, currentDisplayedCommitments, nextDisplayedCommitments);
    animateCount(selectors.statEuro, state.stats.euroValue, nextStats.euroValue, 1200, '€');

    state.stats = nextStats;
    saveStats(state.stats);
    updateHeroText();
  }, 5000);
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
}

function init() {
  loadState();
  if (state.loggedIn) {
    createBadge();
    updateCtaText();
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
      () => {
        loadPledgeStats();
      }
    )
    .subscribe();
}

window.loginWithGoogle = loginWithGoogle;
window.loginWithEmail = loginWithEmail;
window.savePledge = savePledge;
window.getUser = getUser;

init();
