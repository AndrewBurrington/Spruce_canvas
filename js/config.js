/**
 * config.js — Storage helpers and app configuration
 *
 * All data lives in localStorage so no backend is needed.
 * Keys:
 *   spruce_pin      — hashed 4-digit parent PIN
 *   spruce_api_key  — YouTube Data API v3 key (stored as-is; user's own key)
 *   spruce_shows    — JSON array of approved show objects
 *   spruce_setup    — "1" once first-run wizard is done
 */

const Config = (() => {

  // ── Storage keys ────────────────────────────────────────────
  const KEY_PIN     = 'spruce_pin';
  const KEY_API     = 'spruce_api_key';
  const KEY_SHOWS   = 'spruce_shows';
  const KEY_SETUP   = 'spruce_setup';

  // ── Cast Application ID ──────────────────────────────────────
  // Replace with your own ID after registering at:
  // https://cast.google.com/publish/#/overview
  // Until then, use the default media receiver for testing.
  const CAST_APP_ID = '746C5307';

  // YouTube Data API base URL
  const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

  // Max videos to fetch per playlist/channel
  const MAX_RESULTS = 50;

  // ── Simple PIN hashing (not cryptographic — just keeps kids out) ──
  function hashPin(pin) {
    // djb2 hash, returns a hex string
    let h = 5381;
    for (let i = 0; i < pin.length; i++) {
      h = ((h << 5) + h) ^ pin.charCodeAt(i);
      h = h >>> 0; // keep unsigned 32-bit
    }
    return h.toString(16);
  }

  // ── PIN ─────────────────────────────────────────────────────
  function setPin(pin) {
    localStorage.setItem(KEY_PIN, hashPin(pin));
  }

  function checkPin(pin) {
    const stored = localStorage.getItem(KEY_PIN);
    return stored !== null && stored === hashPin(pin);
  }

  function hasPin() {
    return localStorage.getItem(KEY_PIN) !== null;
  }

  // ── API Key ──────────────────────────────────────────────────
  function setApiKey(key) {
    localStorage.setItem(KEY_API, key.trim());
  }

  function getApiKey() {
    return localStorage.getItem(KEY_API) || '';
  }

  // ── Setup flag ───────────────────────────────────────────────
  function isSetupDone() {
    return localStorage.getItem(KEY_SETUP) === '1';
  }

  function markSetupDone() {
    localStorage.setItem(KEY_SETUP, '1');
  }

  // ── Shows ────────────────────────────────────────────────────
  // A show object:
  // {
  //   id:        string  — YouTube channel ID or playlist ID
  //   type:      'channel' | 'playlist'
  //   name:      string  — display name
  //   thumb:     string  — thumbnail URL (optional, fetched lazily)
  // }

  function getShows() {
    try {
      return JSON.parse(localStorage.getItem(KEY_SHOWS) || '[]');
    } catch {
      return [];
    }
  }

  function saveShows(shows) {
    localStorage.setItem(KEY_SHOWS, JSON.stringify(shows));
  }

  function addShow(show) {
    const shows = getShows();
    // Avoid duplicates
    if (shows.find(s => s.id === show.id)) return false;
    shows.push(show);
    saveShows(shows);
    return true;
  }

  function removeShow(id) {
    const shows = getShows().filter(s => s.id !== id);
    saveShows(shows);
  }

  function updateShowThumb(id, thumb) {
    const shows = getShows();
    const s = shows.find(s => s.id === id);
    if (s) { s.thumb = thumb; saveShows(shows); }
  }

  // ── YouTube URL parsing ──────────────────────────────────────
  // Accepts:
  //   https://youtube.com/channel/UCxxxxxx
  //   https://youtube.com/c/ChannelName   (requires API lookup)
  //   https://youtube.com/@Handle         (requires API lookup)
  //   https://youtube.com/playlist?list=PLxxxxxx
  //   Raw IDs: UCxxxxxx or PLxxxxxx

  function parseYouTubeInput(input) {
    input = input.trim();

    // Playlist URL
    const plMatch = input.match(/[?&]list=(PL[A-Za-z0-9_-]+)/);
    if (plMatch) return { type: 'playlist', id: plMatch[1] };

    // Channel ID directly in URL
    const chMatch = input.match(/\/channel\/(UC[A-Za-z0-9_-]+)/);
    if (chMatch) return { type: 'channel', id: chMatch[1] };

    // Raw channel ID
    if (/^UC[A-Za-z0-9_-]{20,}$/.test(input)) return { type: 'channel', id: input };

    // Raw playlist ID
    if (/^PL[A-Za-z0-9_-]{10,}$/.test(input)) return { type: 'playlist', id: input };

    // Handle (@username) or /c/name — needs API to resolve
    const handleMatch = input.match(/\/@([A-Za-z0-9._-]+)/) || input.match(/\/c\/([A-Za-z0-9._-]+)/);
    if (handleMatch) return { type: 'handle', handle: handleMatch[1] };

    return null;
  }

  // ── YouTube API helpers ──────────────────────────────────────
  async function ytFetch(endpoint, params) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('No API key set. Add one in Parent Settings.');
    const url = new URL(`${YT_API_BASE}/${endpoint}`);
    url.searchParams.set('key', apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `YouTube API error ${res.status}`);
    }
    return res.json();
  }

  // Resolve a @handle or /c/name to a channel ID
  async function resolveHandle(handle) {
    const data = await ytFetch('search', {
      part: 'snippet',
      type: 'channel',
      q: handle,
      maxResults: 1,
    });
    if (!data.items?.length) throw new Error(`Channel not found: @${handle}`);
    return data.items[0].snippet.channelId;
  }

  // Fetch channel snippet (for name + thumbnail)
  async function fetchChannelInfo(channelId) {
    const data = await ytFetch('channels', {
      part: 'snippet',
      id: channelId,
      maxResults: 1,
    });
    if (!data.items?.length) throw new Error('Channel not found');
    const s = data.items[0].snippet;
    return {
      name: s.title,
      thumb: s.thumbnails?.medium?.url || s.thumbnails?.default?.url || '',
    };
  }

  // Fetch playlist snippet
  async function fetchPlaylistInfo(playlistId) {
    const data = await ytFetch('playlists', {
      part: 'snippet',
      id: playlistId,
      maxResults: 1,
    });
    if (!data.items?.length) throw new Error('Playlist not found');
    const s = data.items[0].snippet;
    return {
      name: s.title,
      thumb: s.thumbnails?.medium?.url || s.thumbnails?.default?.url || '',
    };
  }

  // Fetch videos from a playlist (returns array of video objects)
  async function fetchPlaylistVideos(playlistId) {
    const data = await ytFetch('playlistItems', {
      part: 'snippet',
      playlistId,
      maxResults: MAX_RESULTS,
    });
    return (data.items || []).map(item => ({
      videoId:   item.snippet.resourceId.videoId,
      title:     item.snippet.title,
      thumb:     item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
      channel:   item.snippet.videoOwnerChannelTitle || '',
    }));
  }

  // Fetch latest uploads from a channel
  // Strategy: get the channel's "uploads" playlist ID, then fetch that playlist
  async function fetchChannelVideos(channelId) {
    const data = await ytFetch('channels', {
      part: 'contentDetails',
      id: channelId,
    });
    if (!data.items?.length) throw new Error('Channel not found');
    const uploadsId = data.items[0].contentDetails.relatedPlaylists.uploads;
    return fetchPlaylistVideos(uploadsId);
  }

  return {
    CAST_APP_ID,
    setPin, checkPin, hasPin,
    setApiKey, getApiKey,
    isSetupDone, markSetupDone,
    getShows, addShow, removeShow, updateShowThumb,
    parseYouTubeInput,
    resolveHandle,
    fetchChannelInfo, fetchPlaylistInfo,
    fetchChannelVideos, fetchPlaylistVideos,
  };
})();
