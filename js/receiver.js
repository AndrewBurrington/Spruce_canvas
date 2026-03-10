/**
 * receiver.js — Chromecast CAF Receiver Logic
 *
 * Runs on the Chromecast device inside receiver.html.
 *
 * The sender app sends a media load request whose contentId is
 * a youtube-nocookie.com embed URL. This receiver:
 *   1. Intercepts the LOAD request
 *   2. Extracts the YouTube video ID
 *   3. Loads the video in the YouTube IFrame Player (no recommendations,
 *      no YouTube UI chrome, no related videos at the end)
 *   4. Manages the CAF playback state so the sender sees play/pause/stop
 */

(() => {
  const overlay       = document.getElementById('overlay');
  const overlaySub    = document.getElementById('overlay-sub');
  const overlaySpinner = document.getElementById('overlay-spinner');
  const errorMsg      = document.getElementById('error-msg');
  const ytIframe      = document.getElementById('yt-player');
  const npBar         = document.getElementById('np-bar');
  const npThumb       = document.getElementById('np-thumb');
  const npTitle       = document.getElementById('np-title');
  const npChannel     = document.getElementById('np-channel');

  // ── YouTube IFrame API ────────────────────────────────────────
  // The IFrame API is loaded dynamically
  let ytPlayer = null;
  let ytReady  = false;
  let pendingVideoId = null;

  window.onYouTubeIframeAPIReady = function() {
    ytReady = true;
    if (pendingVideoId) {
      loadYouTubeVideo(pendingVideoId);
      pendingVideoId = null;
    }
  };

  // Inject YouTube IFrame API script
  const ytScript = document.createElement('script');
  ytScript.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(ytScript);

  function loadYouTubeVideo(videoId) {
    if (!ytReady) {
      pendingVideoId = videoId;
      return;
    }

    // YouTube embed parameters that remove all recommendations and chrome:
    //   rel=0      — no related videos at the end
    //   modestbranding=1 — minimal YouTube branding
    //   controls=1 — keep basic controls so the child can pause/rewind
    //   iv_load_policy=3 — no video annotations
    //   disablekb=0 — allow keyboard controls
    //   fs=1       — allow fullscreen
    const params = new URLSearchParams({
      autoplay: 1,
      rel: 0,
      modestbranding: 1,
      controls: 1,
      iv_load_policy: 3,
      fs: 1,
      enablejsapi: 1,
      origin: window.location.origin,
    });

    const src = `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;

    if (!ytPlayer) {
      ytPlayer = new YT.Player('yt-player', {
        videoId,
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          controls: 1,
          iv_load_policy: 3,
          fs: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          host: 'https://www.youtube-nocookie.com',
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError,
        },
      });
    } else {
      ytPlayer.loadVideoById(videoId);
    }
  }

  function onPlayerReady(event) {
    event.target.playVideo();
  }

  function onPlayerStateChange(event) {
    // YT.PlayerState: UNSTARTED=-1, ENDED=0, PLAYING=1, PAUSED=2, BUFFERING=3, CUED=5
    if (event.data === YT.PlayerState.PLAYING) {
      hideOverlay();
      showNpBar();
      updateCafState('PLAYING');
    } else if (event.data === YT.PlayerState.PAUSED) {
      updateCafState('PAUSED');
    } else if (event.data === YT.PlayerState.ENDED) {
      // Return to idle screen — the sender can queue the next video
      showOverlay('Ready for the next show 🌟');
      hideNpBar();
      updateCafState('IDLE');
    } else if (event.data === YT.PlayerState.BUFFERING) {
      updateCafState('BUFFERING');
    }
  }

  function onPlayerError(event) {
    // Error codes: 2=invalid videoId, 5=HTML5 error, 100=not found/private,
    //              101/150=embedding disabled
    const codes = { 2: 'Invalid video ID', 100: 'Video not available', 5: 'Playback error', 101: 'Embedding not allowed', 150: 'Embedding not allowed' };
    const msg = codes[event.data] || `Playback error (${event.data})`;
    showError(msg);
    updateCafState('IDLE');
  }

  // ── CAF (Cast Application Framework) ─────────────────────────
  const context = cast.framework.CastReceiverContext.getInstance();
  const playerManager = context.getPlayerManager();

  // Intercept LOAD messages
  playerManager.setMessageInterceptor(
    cast.framework.messages.MessageType.LOAD,
    loadRequest => {
      const media = loadRequest.media;
      const contentId = media.contentId || '';

      // Extract video ID from the embed URL the sender provides
      // e.g. https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?…
      let videoId = extractVideoId(contentId);

      if (!videoId) {
        showError('Could not load video. Please try again.');
        return null; // reject the request
      }

      // Show loading state
      showOverlay('Loading…', true);

      // Update now-playing UI from metadata
      if (media.metadata) {
        npTitle.textContent = media.metadata.title || '';
        npChannel.textContent = '';
        if (media.metadata.images?.length) {
          npThumb.src = media.metadata.images[0].url;
        }
      }

      // Load the YouTube video
      loadYouTubeVideo(videoId);

      // Tell CAF the load is handled
      return loadRequest;
    }
  );

  // Handle PAUSE
  playerManager.setMessageInterceptor(
    cast.framework.messages.MessageType.PAUSE,
    () => {
      ytPlayer?.pauseVideo();
      return null;
    }
  );

  // Handle PLAY (resume)
  playerManager.setMessageInterceptor(
    cast.framework.messages.MessageType.PLAY,
    () => {
      ytPlayer?.playVideo();
      return null;
    }
  );

  // Handle STOP
  playerManager.setMessageInterceptor(
    cast.framework.messages.MessageType.STOP,
    () => {
      ytPlayer?.stopVideo();
      showOverlay('Ready to cast…');
      hideNpBar();
      return null;
    }
  );

  // Start the CAF receiver
  context.start({
    touchScreenOptimizedApp: false,
  });

  // ── Helpers ───────────────────────────────────────────────────
  function extractVideoId(url) {
    // From embed URL: /embed/VIDEO_ID
    const embedMatch = url.match(/\/embed\/([A-Za-z0-9_-]{10,12})/);
    if (embedMatch) return embedMatch[1];

    // From watch URL: ?v=VIDEO_ID
    const watchMatch = url.match(/[?&]v=([A-Za-z0-9_-]{10,12})/);
    if (watchMatch) return watchMatch[1];

    // Bare video ID
    if (/^[A-Za-z0-9_-]{10,12}$/.test(url)) return url;

    return null;
  }

  function updateCafState(state) {
    // Sync CAF's understanding of playback state so the sender shows
    // the right icon (play/pause/stop)
    try {
      const mgr = cast.framework.CastReceiverContext.getInstance().getPlayerManager();
      if (state === 'PLAYING') mgr.broadcastStatus();
    } catch (e) {
      // Non-critical
    }
  }

  function showOverlay(message, loading = false) {
    overlaySub.textContent = message;
    overlaySpinner.style.display = loading ? 'block' : 'none';
    errorMsg.style.display = 'none';
    overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function showError(message) {
    overlaySub.textContent = '';
    overlaySpinner.style.display = 'none';
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
    overlay.classList.remove('hidden');
  }

  function showNpBar() {
    npBar.classList.add('visible');
    // Auto-hide after 4 seconds (like a real TV overlay)
    clearTimeout(npBar._hideTimer);
    npBar._hideTimer = setTimeout(hideNpBar, 4000);
  }

  function hideNpBar() {
    npBar.classList.remove('visible');
  }

})();
