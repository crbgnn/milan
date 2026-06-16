const STORAGE_KEYS = {
  stats: 'milan_stats',
  users: 'milan_users',
  pledges: 'milan_pledges',
};

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

export async function getStats() {
  const saved = safeParse(localStorage.getItem(STORAGE_KEYS.stats));
  if (saved && typeof saved === 'object') {
    return saved;
  }

  return {
    verifiedUsers: 85432,
    commitments: 12470,
    euroValue: 72400000,
  };
}

export async function saveStats(stats) {
  localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
  return stats;
}

export async function saveUser(user) {
  const existing = safeParse(localStorage.getItem(STORAGE_KEYS.users)) || [];
  const record = {
    id: crypto.randomUUID?.() || Date.now().toString(),
    email: user.email || null,
    provider: user.provider || 'mock',
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([...existing, record]));
  return record;
}

export async function savePledge(pledge) {
  const existing = safeParse(localStorage.getItem(STORAGE_KEYS.pledges)) || [];
  const record = {
    id: crypto.randomUUID?.() || Date.now().toString(),
    amount: pledge.amount || 0,
    userId: pledge.userId || null,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEYS.pledges, JSON.stringify([...existing, record]));
  return record;
}
