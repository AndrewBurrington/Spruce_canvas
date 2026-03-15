/**
 * app.js — Sender App Logic
 *
 * Handles:
 *  - First-run setup wizard
 *  - Show grid rendering
 *  - Episode browsing (fetches from YouTube API)
 *  - Google Cast integration (send video to Chromecast)
 *  - PIN-protected parent settings panel
 */

(() => {

  // ── DOM refs ─────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const showGrid       = $('show-grid');
  const emptyState     = $('empty-state');
  const episodeView    = $('episode-view');
  const episodeTitle   = $('episode-title');
  const episodeGrid    = $('episode-grid');
  const episodeLoading = $('episode-loading');
  const episodeError   = $('episode-error');
  const backBtn        = $('back-btn');
  const parentLockBtn  = $('parent-lock-btn');
  const pinModal       = $('pin-modal');
  const pinModalTitle  = $('pin-modal-title');
  const pinDots        = [...$('pin-dots').querySelectorAll('.dot')];
  const pinError       = $('pin-error');
  const pinPad         = $('pin-pad');
  const pinClearBtn    = $('pin-clear-btn');
  const pinCancelBtn   = $('pin-cancel-btn');
  const pinResetBtn    = $('pin-reset-btn');
  const settingsPanel  = $('settings-panel');
  const settingsClose  = $('settings-close-btn');
  const apiKeyInput    = $('api-key-input');
  const apiKeySaveBtn  = $('api-key-save-btn');
  const apiKeyStatus   = $('api-key-status');
  const addShowInput   = $('add-show-input');
  const addShowName    = $('add-show-name');
  const addShowBtn     = $('add-show-btn');
  const addShowStatus  = $('add-show-status');
  const settingsShowList = $('settings-show-list');
  const settingsEmpty  = $('settings-empty');
  const newPinInput    = $('new-pin-input');
  const changePinBtn   = $('change-pin-btn');
  const pinChangeStatus = $('pin-change-status');
  const nowPlayingBar  = $('now-playing-bar');
  const npThumb        = $('np-thumb');
  const npTitle        = $('np-title');
  const npChannel      = $('np-channel');
  const npStopBtn      = $('np-stop-btn');
  const setupModal     = $('setup-modal');
  const setupPinInput  = $('setup-pin-input');
  const setupApiInput  = $('setup-api-key-input');
  const setupDoneBtn   = $('setup-done-btn');
  const toast          = $('toast');

  // ── State ────────────────────────────────────────────────────
  let pinBuffer = '';
  let pinCallback = null;   // called with true/false when PIN resolves
  let castSession = null;
  let currentShowId = null;

  // ── Toast ─────────────────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // ── Status helpers ───────────────────────────────────────────
  function setStatus(el, msg, isError = false) {
    el.textContent = msg;
    el.className = 'status-msg ' + (isError ? 'err' : 'ok');
    if (!isError && msg) setTimeout(() => { el.textContent = ''; el.className = 'status-msg'; }, 3000);
  }

  // ── First-run setup ───────────────────────────────────────────
  function checkSetup() {
    if (!Config.isSetupDone()) {
      setupModal.classList.remove('hidden');
    } else {
      renderShowGrid();
    }
  }

  setupDoneBtn.addEventListener('click', () => {
    const pin = setupPinInput.value.trim();
    if (!/^\d{4}$/.test(pin)) {
      showToast('Please enter a 4-digit PIN');
      setupPinInput.focus();
      return;
    }
    Config.setPin(pin);
    const apiKey = setupApiInput.value.trim();
    if (apiKey) Config.setApiKey(apiKey);
    Config.markSetupDone();
    setupModal.classList.add('hidden');
    renderShowGrid();
  });

  // ── Show Grid ─────────────────────────────────────────────────
  function renderShowGrid() {
    const shows = Config.getShows();
    showGrid.innerHTML = '';

    if (shows.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    shows.forEach(show => {
      const card = document.createElement('div');
      card.className = 'show-card';
      card.setAttribute('role', 'listitem');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', show.name);

      const thumbHtml = show.thumb
        ? `<img class="show-card-thumb" src="${escHtml(show.thumb)}" alt="${escHtml(show.name)}" loading="lazy" />`
        : `<div class="show-card-thumb placeholder">📺</div>`;

      card.innerHTML = `
        ${thumbHtml}
        <div class="show-card-info">
          <div class="show-card-name">${escHtml(show.name)}</div>
          <div class="show-card-type">${show.type === 'playlist' ? 'Playlist' : 'Channel'}</div>
        </div>`;

      card.addEventListener('click', () => openShow(show));
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openShow(show); });
      showGrid.appendChild(card);
    });
  }

  // ── Episode Browser ───────────────────────────────────────────
  async function openShow(show) {
    currentShowId = show.id;
    episodeTitle.textContent = show.name;
    episodeGrid.innerHTML = '';
    episodeError.classList.add('hidden');
    episodeLoading.classList.remove('hidden');
    episodeView.classList.remove('hidden');
    // Trigger slide-in on next frame
    requestAnimationFrame(() => episodeView.classList.add('visible'));

    try {
      const videos = show.type === 'playlist'
        ? await Config.fetchPlaylistVideos(show.id)
        : await Config.fetchChannelVideos(show.id);

      episodeLoading.classList.add('hidden');

      if (!videos.length) {
        episodeError.textContent = 'No videos found in this channel/playlist.';
        episodeError.classList.remove('hidden');
        return;
      }

      videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'ep-card';
        card.setAttribute('role', 'listitem');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', video.title);
        card.innerHTML = `
          <img class="ep-thumb" src="${escHtml(video.thumb)}" alt="${escHtml(video.title)}" loading="lazy" />
          <div class="ep-info">
            <div class="ep-title">${escHtml(video.title)}</div>
            ${video.channel ? `<div class="ep-channel">${escHtml(video.channel)}</div>` : ''}
          </div>`;
        card.addEventListener('click', () => playVideo(video));
        card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') playVideo(video); });
        episodeGrid.appendChild(card);
      });
    } catch (err) {
      episodeLoading.classList.add('hidden');
      episodeError.textContent = err.message || 'Failed to load videos.';
      episodeError.classList.remove('hidden');
    }
  }

  backBtn.addEventListener('click', () => {
    episodeView.classList.remove('visible');
    setTimeout(() => episodeView.classList.add('hidden'), 260);
  });

  // ── Video Playback / Cast ─────────────────────────────────────
  function playVideo(video) {
    if (castSession) {
      castToTV(video);
    } else {
      // Fallback: open in a new tab (no recommendations via embed params)
      const url = `https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0&modestbranding=1`;
      window.open(url, '_blank', 'noopener');
      showToast('Playing in browser (no Chromecast connected)');
    }
  }

  function castToTV(video) {
    if (!castSession) { showToast('No Chromecast connected'); return; }

    const mediaInfo = new chrome.cast.media.MediaInfo(
      `https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0&modestbranding=1&controls=1`,
      'text/html'
    );
    mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
    mediaInfo.metadata.title = video.title;
    if (video.thumb) mediaInfo.metadata.images = [{ url: video.thumb }];

    const req = new chrome.cast.media.LoadRequest(mediaInfo);
    castSession.loadMedia(req,
      () => updateNowPlaying(video),
      err => showToast(`Cast error: ${err.description || err.code}`)
    );
  }

  function updateNowPlaying(video) {
    npThumb.src = video.thumb || '';
    npTitle.textContent = video.title;
    npChannel.textContent = video.channel || '';
    nowPlayingBar.classList.remove('hidden');
  }

  npStopBtn.addEventListener('click', () => {
    if (castSession) {
      castSession.stop(
        () => { nowPlayingBar.classList.add('hidden'); showToast('Stopped casting'); },
        () => nowPlayingBar.classList.add('hidden')
      );
    } else {
      nowPlayingBar.classList.add('hidden');
    }
  });

  // ── Google Cast SDK ───────────────────────────────────────────
  window['__onGCastApiAvailable'] = function(isAvailable) {
    if (!isAvailable) return;

    cast.framework.CastContext.getInstance().setOptions({
      receiverApplicationId: Config.CAST_APP_ID,
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
    });

    const ctx = cast.framework.CastContext.getInstance();
    ctx.addEventListener(
      cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
      e => {
        const s = e.sessionState;
        if (s === cast.framework.SessionState.SESSION_STARTED ||
            s === cast.framework.SessionState.SESSION_RESUMED) {
          castSession = ctx.getCurrentSession();
          showToast('Connected to Chromecast');
        } else if (s === cast.framework.SessionState.SESSION_ENDED) {
          castSession = null;
          nowPlayingBar.classList.add('hidden');
          showToast('Disconnected from Chromecast');
        }
      }
    );
  };

  // ── PIN Modal ─────────────────────────────────────────────────
  function openPinModal(title, onSuccess) {
    pinBuffer = '';
    pinCallback = onSuccess;
    pinModalTitle.textContent = title || 'Parent Access';
    updatePinDots();
    pinError.classList.add('hidden');
    pinModal.classList.remove('hidden');
  }

  function closePinModal() {
    pinModal.classList.add('hidden');
    pinBuffer = '';
    pinCallback = null;
  }

  function updatePinDots() {
    pinDots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < pinBuffer.length);
    });
  }

  pinPad.addEventListener('click', e => {
    const btn = e.target.closest('.pin-key');
    if (!btn) return;

    if (btn === pinCancelBtn) { closePinModal(); return; }
    if (btn === pinClearBtn) {
      pinBuffer = pinBuffer.slice(0, -1);
      updatePinDots();
      pinError.classList.add('hidden');
      return;
    }

    const digit = btn.dataset.digit;
    if (digit !== undefined && pinBuffer.length < 4) {
      pinBuffer += digit;
      updatePinDots();

      if (pinBuffer.length === 4) {
        if (Config.checkPin(pinBuffer)) {
          const cb = pinCallback;
          closePinModal();
          showToast('PIN accepted — opening settings…');
          if (cb) cb(true);
        } else {
          pinError.classList.remove('hidden');
          showToast('Wrong PIN. Try again.');
          pinBuffer = '';
          updatePinDots();
        }
      }
    }
  });

  pinResetBtn.addEventListener('click', () => {
    if (confirm('This will erase your PIN, shows, and API key and restart setup. Continue?')) {
      localStorage.clear();
      location.reload();
    }
  });

  parentLockBtn.addEventListener('click', () => {
    openPinModal('Parent Settings', () => openSettings());
  });

  // ── Settings Panel ────────────────────────────────────────────
  function openSettings() {
    try {
      const key = Config.getApiKey();
      apiKeyInput.value = key ? '••••••••••••••••' : '';
      apiKeyInput.dataset.saved = key || '';
      renderSettingsShowList();
      settingsPanel.classList.remove('hidden');
      showToast('Settings open');
    } catch (err) {
      showToast('Error opening settings: ' + (err.message || err));
    }
  }

  settingsClose.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
  });

  // Close modals on backdrop click
  [settingsPanel, pinModal].forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        if (modal === settingsPanel) settingsPanel.classList.add('hidden');
        else closePinModal();
      }
    });
  });

  // API key save
  apiKeySaveBtn.addEventListener('click', () => {
    const val = apiKeyInput.value.trim();
    if (!val || val.startsWith('•')) {
      setStatus(apiKeyStatus, 'No change.', true);
      return;
    }
    Config.setApiKey(val);
    apiKeyInput.value = '••••••••••••••••';
    setStatus(apiKeyStatus, 'API key saved!');
  });

  // Add show
  addShowBtn.addEventListener('click', () => addShowFromInput());
  addShowInput.addEventListener('keydown', e => { if (e.key === 'Enter') addShowFromInput(); });

  async function addShowFromInput() {
    const raw = addShowInput.value.trim();
    if (!raw) return;

    const parsed = Config.parseYouTubeInput(raw);
    if (!parsed) {
      setStatus(addShowStatus, 'Could not parse URL. Try pasting the full YouTube URL.', true);
      return;
    }

    addShowBtn.disabled = true;
    setStatus(addShowStatus, 'Fetching info…');

    try {
      let id = parsed.id;
      let info;

      if (parsed.type === 'handle') {
        id = await Config.resolveHandle(parsed.handle);
        info = await Config.fetchChannelInfo(id);
      } else if (parsed.type === 'channel') {
        info = await Config.fetchChannelInfo(id);
      } else {
        info = await Config.fetchPlaylistInfo(id);
      }

      const name = addShowName.value.trim() || info.name;
      const type = parsed.type === 'playlist' ? 'playlist' : 'channel';

      const added = Config.addShow({ id, type, name, thumb: info.thumb });
      if (!added) {
        setStatus(addShowStatus, 'This show is already in the list.', true);
      } else {
        setStatus(addShowStatus, `"${name}" added!`);
        addShowInput.value = '';
        addShowName.value = '';
        renderSettingsShowList();
        renderShowGrid();
      }
    } catch (err) {
      setStatus(addShowStatus, err.message || 'Failed to add show.', true);
    } finally {
      addShowBtn.disabled = false;
    }
  }

  // Render manage list in settings
  function renderSettingsShowList() {
    const shows = Config.getShows();
    settingsShowList.innerHTML = '';

    if (!shows.length) {
      settingsEmpty.classList.remove('hidden');
      return;
    }
    settingsEmpty.classList.add('hidden');

    shows.forEach(show => {
      const li = document.createElement('li');
      li.className = 'show-manage-item';
      li.innerHTML = `
        ${show.thumb ? `<img class="show-manage-thumb" src="${escHtml(show.thumb)}" alt="" />` : '<div class="show-manage-thumb"></div>'}
        <div style="flex:1;min-width:0">
          <div class="show-manage-name">${escHtml(show.name)}</div>
          <div class="show-manage-type">${show.type}</div>
        </div>
        <button class="show-remove-btn" data-id="${escHtml(show.id)}" title="Remove ${escHtml(show.name)}" aria-label="Remove ${escHtml(show.name)}">✕</button>`;
      settingsShowList.appendChild(li);
    });

    settingsShowList.querySelectorAll('.show-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Config.removeShow(btn.dataset.id);
        renderSettingsShowList();
        renderShowGrid();
        showToast('Show removed');
      });
    });
  }

  // Change PIN
  changePinBtn.addEventListener('click', () => {
    const pin = newPinInput.value.trim();
    if (!/^\d{4}$/.test(pin)) {
      setStatus(pinChangeStatus, 'PIN must be exactly 4 digits.', true);
      return;
    }
    Config.setPin(pin);
    newPinInput.value = '';
    setStatus(pinChangeStatus, 'PIN updated!');
  });

  // ── XSS-safe escaping ─────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Init ──────────────────────────────────────────────────────
  checkSetup();

})();
