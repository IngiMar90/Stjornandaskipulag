(() => {
  const cfg = window.APP_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return;
  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  window.authSupabase = client;

  async function applySession() {
    const { data } = await client.auth.getSession();
    const dialog = document.querySelector('#loginDialog');
    const logout = document.querySelector('#logoutBtn');
    if (data.session) {
      logout?.classList.remove('hidden');
      if (dialog?.open) dialog.close();
    } else {
      logout?.classList.add('hidden');
      if (dialog && !dialog.open) dialog.showModal();
    }
  }

  document.querySelector('#loginForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const errorEl = document.querySelector('#loginError');
    errorEl.textContent = '';
    const { error } = await client.auth.signInWithPassword({
      email: document.querySelector('#loginEmail').value.trim(),
      password: document.querySelector('#loginPassword').value
    });
    if (error) { errorEl.textContent = 'Innskráning tókst ekki. Athugaðu netfang og lykilorð.'; return; }
    location.reload();
  });

  document.querySelector('#logoutBtn')?.addEventListener('click', async () => {
    await client.auth.signOut();
    location.reload();
  });

  applySession();
})();
