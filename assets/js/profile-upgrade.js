// ============================================================
// Sumo Battle - upgraded account/profile editor
// ============================================================
(function(){
  const EMOJIS = [
    '🥋','🥊','💪','🔥','⚡','👑','🏆','💥',
    '😎','🤩','😈','🤖','👾','🦁','🐯','🐼',
    '🐲','🦊','🐸','🐵','🦄','🐺','🦅','🐙',
    '🍣','🍙','🎮','🎯','🚀','🌟','💎','👤'
  ];

  let editorChoice = { type:'emoji', value:'🥋' };
  let editorOpen = false;

  const byId = id => document.getElementById(id);

  function isSignedIn(){
    return !!(typeof profile !== 'undefined' && profile && profile.googleUser && profile.email);
  }

  function currentEmoji(){
    return (typeof profile !== 'undefined' && profile && profile.emoji) ? profile.emoji : null;
  }

  function renderEmojiGrid(){
    const grid = byId('pp-emoji-grid');
    if(!grid) return;
    grid.innerHTML = EMOJIS.map(emoji =>
      `<button type="button" class="pp-emoji-option" data-emoji="${emoji}" aria-label="בחר ${emoji}">${emoji}</button>`
    ).join('');
  }

  function updateEditorPreview(){
    const preview = byId('pp-edit-avatar-preview');
    if(!preview) return;

    if(editorChoice.type === 'image' || editorChoice.type === 'google'){
      preview.innerHTML = `<img alt="תצוגת אווטאר" src="${editorChoice.value}">`;
    } else {
      preview.textContent = editorChoice.value || '👤';
    }

    document.querySelectorAll('.pp-emoji-option').forEach(btn => {
      btn.classList.toggle('is-selected', editorChoice.type === 'emoji' && btn.dataset.emoji === editorChoice.value);
    });
  }

  function loadEditorFromProfile(){
    const nameInput = byId('pp-name-input');
    if(nameInput) nameInput.value = (typeof profile !== 'undefined' && profile && profile.name) ? profile.name : '';

    if(typeof profile !== 'undefined' && profile){
      if(profile.avatar) editorChoice = {type:'image', value:profile.avatar};
      else if(profile.emoji) editorChoice = {type:'emoji', value:profile.emoji};
      else if(profile.googlePhotoURL) editorChoice = {type:'google', value:profile.googlePhotoURL};
      else editorChoice = {type:'emoji', value:'🥋'};
    } else {
      editorChoice = {type:'emoji', value:'🥋'};
    }

    updateEditorPreview();
  }

  function openAccountEditor(){
    const stats = byId('pp-stats-view');
    const edit = byId('pp-edit-view');
    if(!stats || !edit) return;
    loadEditorFromProfile();
    stats.style.display = 'none';
    edit.style.display = 'block';
    editorOpen = true;
    setTimeout(()=>byId('pp-name-input') && byId('pp-name-input').focus(), 50);
  }

  function closeAccountEditor(){
    const stats = byId('pp-stats-view');
    const edit = byId('pp-edit-view');
    if(stats) stats.style.display = 'block';
    if(edit) edit.style.display = 'none';
    editorOpen = false;
  }

  function applyAvatarToPanel(){
    if(typeof profile === 'undefined') return;
    const img = byId('pp-avatar-img');
    const ph = byId('pp-avatar-placeholder');
    if(!img || !ph) return;

    if(profile && profile.emoji){
      img.style.display = 'none';
      ph.textContent = profile.emoji;
      ph.style.display = 'block';
      return;
    }

    if(profile && profile.avatar){
      img.src = profile.avatar;
      img.style.display = 'block';
      ph.style.display = 'none';
      return;
    }

    if(profile && profile.googlePhotoURL){
      img.src = profile.googlePhotoURL;
      img.style.display = 'block';
      ph.style.display = 'none';
      return;
    }

    img.style.display = 'none';
    ph.textContent = '👤';
    ph.style.display = 'block';
  }

  function refreshAccountBadge(){
    const badge = byId('pp-account-badge');
    if(!badge) return;
    if(isSignedIn()){
      badge.textContent = '✅ חשבון מחובר';
      badge.title = profile.email || '';
    } else {
      badge.textContent = '🎮 פרופיל מקומי';
      badge.title = 'הפרופיל נשמר כרגע במכשיר הזה';
    }
  }

  function refreshProfileButton(){
    const btn = byId('profile-btn');
    if(!btn) return;
    const icon = (typeof profile !== 'undefined' && profile && profile.emoji) ? profile.emoji : '👤';
    const name = (typeof profile !== 'undefined' && profile && profile.name)
      ? profile.name
      : (typeof currentLang !== 'undefined' && currentLang === 'en' ? 'Profile' : 'פרופיל');
    const next = `${icon} ${name}`;
    if(btn.textContent !== next) btn.textContent = next;
  }

  function refreshSignedInButtons(){
    const googleBtn = byId('pp-google-btn');
    if(!googleBtn) return;
    if(isSignedIn()){
      googleBtn.textContent = '🔓 התנתק מהחשבון';
      googleBtn.className = 'btn btn-red';
    }
  }

  function refreshProfileUI(){
    applyAvatarToPanel();
    refreshAccountBadge();
    refreshProfileButton();
    refreshSignedInButtons();
  }

  async function syncProfileMetadata(){
    if(!window.sumoSupabase || !isSignedIn() || typeof profile === 'undefined' || !profile) return;
    try{
      const { data } = await window.sumoSupabase.auth.getUser();
      if(!data || !data.user) return;
      await window.sumoSupabase.auth.updateUser({
        data: {
          display_name: profile.name || 'Player',
          avatar_emoji: profile.emoji || null
        }
      });
    }catch(err){
      console.warn('Could not sync profile metadata:', err);
    }
  }

  async function hydrateEmojiFromSupabase(){
    if(!window.sumoSupabase || typeof profile === 'undefined') return;
    try{
      const { data } = await window.sumoSupabase.auth.getUser();
      const user = data && data.user;
      if(!user) return;
      const emoji = user.user_metadata && user.user_metadata.avatar_emoji;
      if(emoji){
        if(!profile) profile = defaultProfile(user.user_metadata.display_name || user.email?.split('@')[0] || 'Player');
        // A deliberately chosen local image stays local; otherwise cloud emoji wins.
        if(!profile.avatar) profile.emoji = emoji;
        saveProfile(profile);
        refreshProfileUI();
      }
    }catch(err){}
  }

  function commitEditor(){
    const name = (byId('pp-name-input')?.value || '').trim() || 'Player';
    if(typeof profile === 'undefined') return;
    if(!profile) profile = defaultProfile(name);
    profile.name = name;

    if(editorChoice.type === 'emoji'){
      profile.emoji = editorChoice.value || '👤';
      profile.avatar = null;
    } else if(editorChoice.type === 'image'){
      profile.avatar = editorChoice.value;
      profile.emoji = null;
    } else if(editorChoice.type === 'google'){
      profile.avatar = null;
      profile.emoji = null;
    }

    saveProfile(profile);
    if(typeof updateProfileBtn === 'function') updateProfileBtn();
    refreshProfileUI();
    closeAccountEditor();
    syncProfileMetadata();
  }

  function processAvatarFile(file){
    if(!file || !file.type || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      const img = new Image();
      img.onload = function(){
        const size = 192;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w)/2, (size - h)/2, w, h);
        editorChoice = {type:'image', value:canvas.toDataURL('image/jpeg', .84)};
        updateEditorPreview();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function installCaptureHandlers(){
    document.addEventListener('click', function(e){
      const avatar = e.target.closest && e.target.closest('#pp-avatar-wrap');
      if(avatar){
        e.preventDefault();
        e.stopPropagation();
        openAccountEditor();
        return;
      }

      const save = e.target.closest && e.target.closest('#pp-save-btn');
      if(save){
        e.preventDefault();
        e.stopPropagation();
        commitEditor();
        return;
      }

      const upload = e.target.closest && e.target.closest('#pp-upload-avatar-btn');
      if(upload){
        e.preventDefault();
        e.stopPropagation();
        byId('avatar-input')?.click();
        return;
      }

      const googlePhoto = e.target.closest && e.target.closest('#pp-use-google-photo-btn');
      if(googlePhoto){
        e.preventDefault();
        e.stopPropagation();
        if(typeof profile !== 'undefined' && profile && profile.googlePhotoURL){
          editorChoice = {type:'google', value:profile.googlePhotoURL};
          updateEditorPreview();
        }
        return;
      }

      const emojiBtn = e.target.closest && e.target.closest('.pp-emoji-option');
      if(emojiBtn){
        e.preventDefault();
        e.stopPropagation();
        editorChoice = {type:'emoji', value:emojiBtn.dataset.emoji || '👤'};
        updateEditorPreview();
        return;
      }
    }, true);

    // Take over the hidden file input before the legacy handler gets it.
    document.addEventListener('change', function(e){
      if(e.target && e.target.id === 'avatar-input'){
        e.stopPropagation();
        const file = e.target.files && e.target.files[0];
        if(file) processAvatarFile(file);
        e.target.value = '';
      }
    }, true);
  }

  function installRegularHandlers(){
    byId('pp-edit-btn')?.addEventListener('click', ()=>setTimeout(()=>{
      editorOpen = true;
      loadEditorFromProfile();
    },0));

    byId('pp-cancel-btn')?.addEventListener('click', ()=>{
      editorOpen = false;
      loadEditorFromProfile();
    });

    byId('profile-btn')?.addEventListener('click', ()=>setTimeout(refreshProfileUI,0));
  }

  function init(){
    renderEmojiGrid();
    installCaptureHandlers();
    installRegularHandlers();
    refreshProfileUI();
    loadEditorFromProfile();

    const profileBtn = byId('profile-btn');
    if(profileBtn){
      new MutationObserver(()=>refreshProfileButton()).observe(profileBtn,{childList:true,subtree:true,characterData:true});
    }

    const panel = byId('profile-panel');
    if(panel){
      new MutationObserver(()=>{
        if(panel.style.display !== 'none') setTimeout(refreshProfileUI,0);
      }).observe(panel,{attributes:true,attributeFilter:['style']});
    }

    setTimeout(hydrateEmojiFromSupabase, 500);
    if(window.sumoSupabase){
      window.sumoSupabase.auth.onAuthStateChange(()=>setTimeout(()=>{
        hydrateEmojiFromSupabase();
        refreshProfileUI();
      },100));
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
