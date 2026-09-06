// ============================================================
// Sumo Battle - Supabase Authentication
// Client-side publishable key is intentionally public.
// Never place a Supabase secret/service_role key in this file.
// ============================================================

const SUMO_SUPABASE_URL = 'https://queueggajlvqlnmqjekmt.supabase.co';
const SUMO_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_CzSn1juUYVJD7lCKe485-g_RRyNye6e';

const sumoSupabase = (window.supabase && typeof window.supabase.createClient === 'function')
  ? window.supabase.createClient(SUMO_SUPABASE_URL, SUMO_SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

window.sumoSupabase = sumoSupabase;

function supabaseAuthErrorCode(error) {
  const code = String((error && (error.code || error.message)) || '').toLowerCase();
  if (code.includes('invalid_credentials') || code.includes('invalid login credentials')) return 'auth/invalid-credential';
  if (code.includes('user_already_exists') || code.includes('already registered')) return 'auth/email-already-in-use';
  if (code.includes('email_address_invalid') || code.includes('invalid email')) return 'auth/invalid-email';
  if (code.includes('weak_password') || code.includes('password should be')) return 'auth/weak-password';
  if (code.includes('rate_limit') || code.includes('too many')) return 'auth/too-many-requests';
  if (code.includes('email_not_confirmed')) return 'auth/email-not-confirmed';
  return 'auth/unavailable';
}

function getSupabaseDisplayName(user) {
  if (!user) return 'Player';
  const meta = user.user_metadata || {};
  return meta.display_name || meta.full_name || meta.name || (user.email ? user.email.split('@')[0] : 'Player');
}

function getSupabaseAvatar(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return meta.avatar_url || meta.picture || null;
}

function applySupabaseUser(user) {
  if (user) {
    const name = getSupabaseDisplayName(user);
    const email = user.email || null;
    const avatar = getSupabaseAvatar(user);

    if (!profile) profile = defaultProfile(name, email, null);
    profile.name = name || profile.name;
    profile.email = email;
    // Existing game UI uses googleUser as its generic signed-in flag.
    profile.googleUser = true;
    profile.authProvider = user.app_metadata && user.app_metadata.provider ? user.app_metadata.provider : 'email';
    profile.authUserId = user.id;
    if (avatar) profile.googlePhotoURL = avatar;
    saveProfile(profile);
  } else if (profile) {
    profile.googleUser = false;
    profile.email = null;
    profile.authProvider = null;
    profile.authUserId = null;
    saveProfile(profile);
  }

  const emailBtn = document.getElementById('pp-email-btn');
  if (emailBtn) emailBtn.style.display = user ? 'none' : '';

  if (typeof updateProfileBtn === 'function') updateProfileBtn();
  if (typeof renderProfilePanel === 'function') renderProfilePanel();
}

function setAuthPanelMessage(message, ok = false) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.style.color = ok ? '#80ffaa' : '#ff8080';
  el.textContent = message;
}

function openSupabaseEmailAuth() {
  const overlay = document.getElementById('auth-overlay');
  const panel = document.getElementById('auth-panel');
  if (!overlay || !panel) return;

  overlay.style.display = 'block';
  panel.style.display = 'block';
  const email = document.getElementById('auth-email');
  const password = document.getElementById('auth-password');
  const name = document.getElementById('auth-name');
  if (email) email.value = '';
  if (password) password.value = '';
  if (name) name.value = '';
  setAuthPanelMessage('');
  setTimeout(() => email && email.focus(), 50);
}

// Override the legacy Firebase handlers used by game.js.
loginWithEmail = async function(email, password, onSuccess, onError) {
  if (!sumoSupabase) {
    if (onError) onError('auth/unavailable');
    return;
  }
  const { data, error } = await sumoSupabase.auth.signInWithPassword({ email, password });
  if (error) {
    const mapped = supabaseAuthErrorCode(error);
    if (mapped === 'auth/email-not-confirmed') {
      setAuthPanelMessage('יש לאשר קודם את כתובת האימייל דרך ההודעה שנשלחה אליך.');
      return;
    }
    if (onError) onError(mapped);
    return;
  }
  applySupabaseUser(data.user);
  if (onSuccess) onSuccess();
};

registerWithEmail = async function(email, password, name, onSuccess, onError) {
  if (!sumoSupabase) {
    if (onError) onError('auth/unavailable');
    return;
  }

  const { data, error } = await sumoSupabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: name || email.split('@')[0] },
      emailRedirectTo: window.location.origin + window.location.pathname
    }
  });

  if (error) {
    if (onError) onError(supabaseAuthErrorCode(error));
    return;
  }

  // If email confirmation is enabled, Supabase returns a user but no active session.
  if (!data.session) {
    setAuthPanelMessage('✅ ההרשמה הצליחה. נשלח אליך מייל אימות — פתח אותו ואז התחבר.', true);
    return;
  }

  if (data.user) applySupabaseUser(data.user);
  if (onSuccess) onSuccess();
};

loginWithGoogle = async function() {
  if (!sumoSupabase) {
    alert('שירות ההתחברות אינו זמין כרגע.');
    return;
  }
  const { error } = await sumoSupabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  if (error) {
    console.error('Supabase Google sign-in error:', error);
    alert('התחברות Google עדיין לא הופעלה ב-Supabase. נוכל להפעיל אותה בשלב הבא.');
  }
};

logoutGoogle = async function() {
  if (!sumoSupabase) return;
  const { error } = await sumoSupabase.auth.signOut();
  if (error) {
    console.error('Supabase sign-out error:', error);
    return;
  }
  applySupabaseUser(null);
};

// Separate email/password entry point so Google can remain a real Google button.
const emailAuthBtn = document.getElementById('pp-email-btn');
if (emailAuthBtn) {
  emailAuthBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    openSupabaseEmailAuth();
  });
}

if (sumoSupabase) {
  // Restore an existing login after refresh/reopen.
  sumoSupabase.auth.getSession().then(({ data }) => {
    applySupabaseUser(data && data.session ? data.session.user : null);
  });

  // Keep the game UI synchronized with sign-in/sign-out/OAuth redirects.
  sumoSupabase.auth.onAuthStateChange((_event, session) => {
    applySupabaseUser(session ? session.user : null);
  });
}
