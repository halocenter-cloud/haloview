/**
 * Halo Infinite Ranking — UI alineada con HaloBackend
 * (jugador, puntaje_total, puesto, temporada).
 */

const RANK_COLORS = {
  1: '#FFD700',
  2: '#C7D3DC',
  3: '#CD7F32'
};
const RANK_COLOR_DEFAULT = '#4FD1FF';
const MOBILE_MQ = '(max-width: 768px)';
const REDUCED_MOTION_MQ = '(prefers-reduced-motion: reduce)';
const COARSE_POINTER_MQ = '(pointer: coarse)';
const NO_HOVER_MQ = '(hover: none)';
const HOLO_BOOT_MS = 800;
const HOLO_BOOT_MOBILE_MS = 500;
const HOLO_COLLAPSE_MS = 500;
const COMPARE_FIELD_MS = 340;
const RANK_REVEAL_MAX_STAGGER = 11;
const ZERO_REVEAL_MAX_STAGGER = 8;
const AVG_MIN_MATCHES = 5;
const RANKING_METRIC_KEY = 'haloview-ranking-metric';
const STALE_SYNC_MS = 12 * 60 * 60 * 1000;

/**
 * Normaliza legacy (season + players) o shape multi-temporada.
 * @param {object} raw
 */
function normalizeSquadData(raw) {
  const source = raw || {};
  let seasons;
  let players;
  let activeSeasonId;
  let seasonLabel;
  let lastUpdated = source.lastUpdated || null;

  if (Array.isArray(source.seasons) && source.seasons.length > 0) {
    seasons = source.seasons.map((s) => ({
      id: Number(s.id),
      label: s.label || `Temporada ${s.id}`,
      active: Boolean(s.active),
      fechaInicio: s.fechaInicio || null,
      fechaFin: s.fechaFin || null,
      players: Array.isArray(s.players) ? s.players : []
    }));
    const active = seasons.find((s) => s.active) || seasons[0];
    activeSeasonId = source.activeSeasonId != null
      ? Number(source.activeSeasonId)
      : active.id;
    seasonLabel = source.season || active.label;
    players = Array.isArray(source.players) ? source.players : active.players;
  } else {
    players = Array.isArray(source.players) ? source.players : [];
    seasonLabel = source.season || 'Temporada activa';
    activeSeasonId = 1;
    seasons = [
      {
        id: 1,
        label: seasonLabel,
        active: true,
        fechaInicio: null,
        fechaFin: null,
        players
      }
    ];
  }

  const profiles = Array.isArray(source.profiles) && source.profiles.length
    ? source.profiles.map(normalizeProfile)
    : deriveProfilesFromSeasons(seasons);

  return {
    lastUpdated,
    activeSeasonId,
    season: seasonLabel,
    players,
    seasons,
    profiles
  };
}

function normalizeProfile(profile) {
  return {
    name: profile.name || '',
    bestRank: profile.bestRank != null ? Number(profile.bestRank) : null,
    careerPoints: Number(profile.careerPoints) || 0,
    matchesPlayed: Number(profile.matchesPlayed) || 0,
    recentMatches: Array.isArray(profile.recentMatches)
      ? profile.recentMatches.map((m) => ({
          at: m.at || null,
          seasonId: Number(m.seasonId),
          points: Number(m.points) || 0,
          matchId: m.matchId ? String(m.matchId) : null,
          modo: m.modo || null,
          result: m.result === 'ganador' || m.result === 'perdedor' ? m.result : null
        }))
      : [],
    bySeason: Array.isArray(profile.bySeason)
      ? profile.bySeason.map((s) => ({
          seasonId: Number(s.seasonId),
          points: Number(s.points) || 0,
          rank: s.rank != null ? Number(s.rank) : null,
          matches: s.matches != null ? Number(s.matches) : null,
          bestGame: s.bestGame != null ? Number(s.bestGame) : null,
          avgPoints: s.avgPoints != null ? Number(s.avgPoints) : null,
          matchesPerWeek: s.matchesPerWeek != null ? Number(s.matchesPerWeek) : null,
          wins: s.wins != null ? Number(s.wins) : 0,
          teamMatches: s.teamMatches != null ? Number(s.teamMatches) : 0
        }))
      : []
  };
}

function deriveProfilesFromSeasons(seasons) {
  const byKey = new Map();
  for (const season of seasons || []) {
    for (const player of season.players || []) {
      const key = normalizePlayerName(player.name);
      if (!key) continue;
      if (!byKey.has(key)) {
        byKey.set(key, {
          name: player.name,
          bestRank: null,
          careerPoints: 0,
          matchesPlayed: 0,
          recentMatches: [],
          bySeason: []
        });
      }
      const profile = byKey.get(key);
      const points = Number(player.points) || 0;
      const rank = Number(player.rank) || null;
      profile.careerPoints += points;
      if (rank != null && (profile.bestRank == null || rank < profile.bestRank)) {
        profile.bestRank = rank;
      }
      profile.bySeason.push({
        seasonId: season.id,
        points,
        rank,
        matches: null
      });
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  );
}

const squadData = normalizeSquadData(typeof SQUAD_DATA !== 'undefined' ? SQUAD_DATA : {});

/** @type {number} */
let selectedSeasonId = squadData.activeSeasonId;

/** @type {'points' | 'avg'} */
let rankingMetric = readStoredRankingMetric();

function readStoredRankingMetric() {
  try {
    return sessionStorage.getItem(RANKING_METRIC_KEY) === 'avg' ? 'avg' : 'points';
  } catch (_) {
    return 'points';
  }
}

function persistRankingMetric(metric) {
  try {
    sessionStorage.setItem(RANKING_METRIC_KEY, metric);
  } catch (_) {
    /* ignore quota / private mode */
  }
}

function sortPlayers(list) {
  return [...(list || [])].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (b.points !== a.points) return b.points - a.points;
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });
}

function getSeasonById(id) {
  return squadData.seasons.find((s) => s.id === Number(id)) || null;
}

function getSelectedSeason() {
  return getSeasonById(selectedSeasonId)
    || getSeasonById(squadData.activeSeasonId)
    || squadData.seasons[0]
    || null;
}

function getCurrentPlayers() {
  const season = getSelectedSeason();
  return sortPlayers(season ? season.players : []);
}

function computeAvgFromRecent(profile, seasonId) {
  const recent = (profile?.recentMatches || []).filter(
    (m) => Number(m.seasonId) === Number(seasonId)
  );
  if (!recent.length) return { matches: 0, avgPoints: null };
  const total = recent.reduce((sum, m) => sum + (Number(m.points) || 0), 0);
  return {
    matches: recent.length,
    avgPoints: Number((total / recent.length).toFixed(1))
  };
}

function getPlayerSeasonAvg(player) {
  const profile = getProfileByName(player.name);
  const seasonStats = (profile?.bySeason || []).find(
    (s) => Number(s.seasonId) === Number(selectedSeasonId)
  ) || null;
  const fromRecent = computeAvgFromRecent(profile, selectedSeasonId);

  let matches = seasonStats && seasonStats.matches != null
    ? Number(seasonStats.matches)
    : fromRecent.matches;
  let avgPoints = seasonStats && seasonStats.avgPoints != null
    ? Number(seasonStats.avgPoints)
    : null;

  if (avgPoints == null && matches > 0) {
    const seasonPoints = seasonStats && seasonStats.points != null
      ? Number(seasonStats.points)
      : (player.points != null ? Number(player.points) : null);
    if (seasonPoints != null) {
      avgPoints = Number((seasonPoints / matches).toFixed(1));
    }
  }

  if (avgPoints == null) avgPoints = fromRecent.avgPoints;

  return {
    matches: matches || 0,
    avgPoints
  };
}

function decoratePlayersWithAvg(list) {
  return (list || []).map((player) => {
    const stats = getPlayerSeasonAvg(player);
    return {
      ...player,
      matches: stats.matches,
      avgPoints: stats.avgPoints
    };
  });
}

function sortPlayersByAvg(list) {
  return [...(list || [])].sort((a, b) => {
    if (b.avgPoints !== a.avgPoints) return b.avgPoints - a.avgPoints;
    if (b.matches !== a.matches) return b.matches - a.matches;
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });
}

function isAvgEligible(player) {
  return player.avgPoints != null && Number(player.matches) >= AVG_MIN_MATCHES;
}

function hasTiedAvgs(list) {
  const seen = new Set();
  for (const p of list || []) {
    if (p.avgPoints == null) continue;
    if (seen.has(p.avgPoints)) return true;
    seen.add(p.avgPoints);
  }
  return false;
}

function formatAvgPoints(value) {
  if (value == null) return '—';
  return Number(value).toLocaleString('es', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

function formatMatchesLabel(matches) {
  if (matches == null) return 'Sin partidas';
  const n = Number(matches);
  if (!Number.isFinite(n) || n <= 0) return 'Sin partidas';
  return n === 1 ? '1 partida' : `${n} partidas`;
}

function prefersReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_MQ).matches;
}

function isMobileViewport() {
  return window.matchMedia(MOBILE_MQ).matches;
}

function isCoarsePointer() {
  return window.matchMedia(COARSE_POINTER_MQ).matches
    || window.matchMedia(NO_HOVER_MQ).matches;
}

function holoBootDurationMs() {
  if (prefersReducedMotion()) return 0;
  return isCoarsePointer() || isMobileViewport() ? HOLO_BOOT_MOBILE_MS : HOLO_BOOT_MS;
}

function accentForRank(rank) {
  return RANK_COLORS[rank] || RANK_COLOR_DEFAULT;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rankLabel(n) {
  return String(n).padStart(2, '0');
}

function normalizePlayerName(name) {
  return String(name || '').trim().toLowerCase();
}

/**
 * Lee ?player= o #player= de la URL.
 * @returns {string|null}
 */
function getHighlightedPlayerName() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('player');
    if (fromQuery && fromQuery.trim()) {
      return decodeURIComponent(fromQuery.trim());
    }

    const hash = window.location.hash.replace(/^#/, '');
    if (hash.startsWith('player=')) {
      const value = hash.slice('player='.length);
      if (value.trim()) return decodeURIComponent(value.trim());
    }
  } catch (_) {
    /* ignore malformed URL */
  }
  return null;
}

/**
 * Lee ?compare=ALPHA,BRAVO de la URL.
 * @returns {{ a: string, b: string }|null}
 */
function getComparePairFromUrl() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('compare');
    if (!fromQuery || !fromQuery.trim()) return null;
    const parts = fromQuery.split(',').map((part) => {
      try {
        return decodeURIComponent(part.trim());
      } catch (_) {
        return part.trim();
      }
    }).filter(Boolean);
    if (parts.length < 2) return null;
    return { a: parts[0], b: parts[1] };
  } catch (_) {
    return null;
  }
}

/**
 * Lee ?season= o #season= de la URL.
 * @returns {number|null}
 */
function getSeasonIdFromUrl() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('season');
    if (fromQuery && fromQuery.trim()) {
      const n = Number(fromQuery.trim());
      if (Number.isFinite(n)) return n;
    }

    const hash = window.location.hash.replace(/^#/, '');
    if (hash.startsWith('season=')) {
      const n = Number(hash.slice('season='.length).trim());
      if (Number.isFinite(n)) return n;
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

function resolveInitialSeasonId() {
  const fromUrl = getSeasonIdFromUrl();
  if (fromUrl != null && getSeasonById(fromUrl)) return fromUrl;
  return squadData.activeSeasonId;
}

function hasTiedRanks(list) {
  const seen = new Set();
  for (const p of list) {
    if (seen.has(p.rank)) return true;
    seen.add(p.rank);
  }
  return false;
}

/**
 * @param {{ id: number, name: string, rank: number, points: number, avgPoints?: number|null, matches?: number }} p
 * @param {{
 *   variant?: 'hero' | 'row',
 *   gapOverNext?: number,
 *   nextRank?: number,
 *   index?: number,
 *   metric?: 'points' | 'avg',
 *   displayRank?: number|null,
 *   avgPoints?: number|null,
 *   matches?: number,
 *   ineligible?: boolean
 * }} [options]
 */
function renderSpartanRow(p, options = {}) {
  const variant = options.variant || 'row';
  const metric = options.metric || 'points';
  const isAvg = metric === 'avg';
  const displayRank = options.displayRank !== undefined ? options.displayRank : p.rank;
  const accent = accentForRank(displayRank);
  const name = escapeHtml(p.name);
  const isHero = variant === 'hero';
  const rowIndex = Number.isFinite(options.index) ? options.index : 0;
  const standby = isAvg ? Boolean(options.ineligible) : p.points <= 0;
  const classes = [
    'spartan-row',
    displayRank != null ? `rank-${displayRank}` : '',
    isHero ? 'spartan-row--hero' : '',
    standby ? 'spartan-row--standby' : '',
    'spartan-row--interactive'
  ].filter(Boolean).join(' ');

  const gap = options.gapOverNext;
  const nextRank = options.nextRank;
  const gapText = isAvg
    ? formatAvgPoints(gap)
    : (typeof gap === 'number' ? gap.toLocaleString('es') : '');
  const gapLine = isHero && typeof gap === 'number' && gap > 0 && nextRank != null
    ? `<p class="spartan-row__gap">Ventaja +${gapText} sobre el ${nextRank}º</p>`
    : '';

  const pointsUnit = isHero
    ? `<span class="spartan-row__points-unit">${isAvg ? 'media' : 'pts'}</span>`
    : '';

  const avgPoints = options.avgPoints !== undefined ? options.avgPoints : p.avgPoints;
  const matches = options.matches !== undefined ? options.matches : p.matches;
  const valueText = isAvg ? formatAvgPoints(avgPoints) : p.points.toLocaleString('es');
  const rankText = displayRank != null ? rankLabel(displayRank) : '—';
  const matchesLabel = formatMatchesLabel(matches);
  const matchesLine = `<p class="spartan-row__meta">${escapeHtml(matchesLabel)}</p>`;

  let ariaLabel;
  if (isAvg) {
    ariaLabel = options.ineligible
      ? `${name}, media ${valueText} en ${matchesLabel}. Abrir ficha.`
      : `${name}, media ${valueText} en ${matchesLabel}, puesto ${displayRank} de promedio. Abrir ficha.`;
  } else {
    ariaLabel = `${name}, puesto ${p.rank}, ${p.points} puntos, ${matchesLabel}. Abrir ficha.`;
  }

  return `
    <article
      class="${classes}"
      style="--row-accent: ${accent}; --row-i: ${rowIndex}"
      data-id="${p.id}"
      data-name="${name}"
      role="listitem"
      tabindex="0"
      aria-label="${ariaLabel}"
    >
      <div class="spartan-row__glow" aria-hidden="true"></div>
      <div class="spartan-row__scan" aria-hidden="true"></div>
      <div class="spartan-row__rank">${rankText}</div>
      <div class="spartan-row__identity">
        <p class="spartan-row__name">${name}</p>
        ${matchesLine}
        ${gapLine}
      </div>
      <div class="spartan-row__points">
        <span class="spartan-row__points-value">${valueText}</span>
        ${pointsUnit}
      </div>
    </article>
  `;
}

// --- Particles background ---
function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let rafId = 0;
  let running = false;
  const particles = [];
  const reduceMotion = prefersReducedMotion();

  function particleCount() {
    return isMobileViewport() ? 20 : 40;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.size = Math.random() * 1.5 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.speedY = (Math.random() - 0.5) * 0.3;
      this.opacity = Math.random() * 0.4 + 0.1;
      this.color = Math.random() < 0.3
        ? `rgba(255, 107, 53, ${this.opacity})`
        : `rgba(0, 212, 255, ${this.opacity})`;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
  }

  function syncParticleCount() {
    const target = particleCount();
    while (particles.length < target) particles.push(new Particle());
    while (particles.length > target) particles.pop();
  }

  function paintFrame(update) {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      if (update) p.update();
      p.draw();
    });
  }

  function animate() {
    if (!running) return;
    if (!document.body.classList.contains('is-ranking-revealing')) {
      paintFrame(true);
    }
    rafId = requestAnimationFrame(animate);
  }

  function start() {
    if (reduceMotion || running || document.hidden) return;
    running = true;
    paintFrame(false);
    rafId = requestAnimationFrame(animate);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  resize();
  syncParticleCount();
  paintFrame(false);

  if (reduceMotion) {
    window.addEventListener('resize', () => {
      resize();
      syncParticleCount();
      paintFrame(false);
    });
    return;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  window.addEventListener('resize', () => {
    resize();
    syncParticleCount();
    if (!running && !document.hidden) start();
    else if (!running) paintFrame(false);
  });

  start();
}

/** @type {ReturnType<typeof setTimeout> | null} */
let zeroRevealTimer = null;

function rankingRevealTiming() {
  const mobile = isMobileViewport();
  return {
    step: mobile ? 28 : 42,
    duration: mobile ? 360 : 460
  };
}

function applyRankingRevealVars(stack) {
  const { step, duration } = rankingRevealTiming();
  stack.style.setProperty('--reveal-step', `${step}ms`);
  stack.style.setProperty('--reveal-duration', `${duration}ms`);
}

/**
 * @param {boolean} open
 * @param {{ instant?: boolean }} [options]
 */
function setZeroGroupOpen(open, options = {}) {
  const group = document.querySelector('.zero-group');
  const toggle = document.getElementById('zero-group-toggle');
  const panel = document.getElementById('zero-group-list');
  if (!group || !toggle || !panel) return;

  const instant = Boolean(options.instant) || prefersReducedMotion();
  toggle.setAttribute('aria-expanded', String(open));
  group.classList.toggle('is-open', open);
  group.classList.toggle('is-instant', instant && open);
  panel.inert = !open;
  panel.setAttribute('aria-hidden', open ? 'false' : 'true');

  if (zeroRevealTimer) {
    clearTimeout(zeroRevealTimer);
    zeroRevealTimer = null;
  }

  if (!open) {
    panel.classList.remove('is-rows-in', 'is-rows-settled');
    group.classList.remove('is-instant');
    return;
  }

  if (instant) {
    panel.classList.remove('is-rows-in');
    panel.classList.add('is-rows-settled');
    return;
  }

  panel.classList.remove('is-rows-settled', 'is-rows-in');
  void panel.offsetWidth;
  panel.classList.add('is-rows-in');

  const count = panel.querySelectorAll('.spartan-row').length;
  const lastDelay = Math.min(Math.max(count - 1, 0), ZERO_REVEAL_MAX_STAGGER) * 28;
  zeroRevealTimer = setTimeout(() => {
    panel.classList.add('is-rows-settled');
    panel.classList.remove('is-rows-in');
    zeroRevealTimer = null;
  }, lastDelay + 360 + 32);
}

function expandZeroGroup() {
  setZeroGroupOpen(true, { instant: true });
}

function clearPlayerHighlights() {
  document.querySelectorAll('.spartan-row.is-highlighted').forEach((row) => {
    row.classList.remove('is-highlighted');
  });
}

/**
 * Resalta la fila del jugador de la query y hace scroll.
 * @param {string|null} queryName
 */
function highlightPlayer(queryName) {
  clearPlayerHighlights();
  if (!queryName) return;

  const players = getCurrentPlayers();
  const target = normalizePlayerName(queryName);
  const match = players.find(p => normalizePlayerName(p.name) === target);
  if (!match) return;

  if (rankingMetric === 'avg') {
    const stats = getPlayerSeasonAvg(match);
    if (!isAvgEligible(stats)) expandZeroGroup();
  } else if (match.points <= 0) {
    expandZeroGroup();
  }

  const row = document.querySelector(
    `.spartan-row[data-id="${match.id}"]`
  );
  if (!row) return;

  row.classList.add('is-highlighted');

  const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
  requestAnimationFrame(() => {
    row.scrollIntoView({ block: 'center', behavior });
  });
}

function renderCollapsedPlayerGroup(label, rowsHtml, rowOffset) {
  return `
    <div class="zero-group" role="listitem" style="--row-i: ${rowOffset}">
      <button
        type="button"
        class="zero-group__toggle"
        id="zero-group-toggle"
        aria-expanded="false"
        aria-controls="zero-group-list"
      >
        <span class="zero-group__label">${escapeHtml(label)}</span>
        <span class="zero-group__chevron" aria-hidden="true"></span>
      </button>
      <div
        class="zero-group__panel"
        id="zero-group-list"
        role="list"
        inert
        aria-hidden="true"
      >
        <div class="zero-group__panel-inner">
          ${rowsHtml}
        </div>
      </div>
    </div>
  `;
}

function renderPointsRanking(players) {
  const decorated = decoratePlayersWithAvg(players);
  const withPoints = decorated.filter((p) => p.points > 0);
  const zeroPoints = decorated.filter((p) => p.points <= 0);
  const HERO_SLOTS = 3;

  let html = '';

  withPoints.forEach((p, index) => {
    const isHero = index < HERO_SLOTS;
    const next = withPoints[index + 1] || null;
    const gapOverNext = next ? p.points - next.points : 0;
    html += renderSpartanRow(p, isHero
      ? {
          variant: 'hero',
          gapOverNext,
          nextRank: next ? next.rank : undefined,
          matches: p.matches,
          index
        }
      : { variant: 'row', matches: p.matches, index }
    );
  });

  if (zeroPoints.length) {
    const zeroRows = zeroPoints.map((p, index) => renderSpartanRow(p, {
      matches: p.matches,
      index
    })).join('');
    html += renderCollapsedPlayerGroup(
      `Sin puntos aún (${zeroPoints.length})`,
      zeroRows,
      withPoints.length
    );
  }

  if (hasTiedRanks(players)) {
    html += `
      <p class="ranking-tie-hint" role="status">
        Puestos iguales = mismos puntos.
      </p>
    `;
  }

  return html;
}

function renderAvgRanking(players) {
  const decorated = decoratePlayersWithAvg(players);
  const eligible = sortPlayersByAvg(decorated.filter(isAvgEligible));
  const ineligible = decorated.filter((p) => !isAvgEligible(p));
  const HERO_SLOTS = 3;

  let html = '';

  eligible.forEach((p, index) => {
    const displayRank = index + 1;
    const isHero = index < HERO_SLOTS;
    const next = eligible[index + 1] || null;
    const gapOverNext = next && p.avgPoints != null && next.avgPoints != null
      ? Number((p.avgPoints - next.avgPoints).toFixed(1))
      : 0;
    html += renderSpartanRow(p, {
      variant: isHero ? 'hero' : 'row',
      metric: 'avg',
      displayRank,
      avgPoints: p.avgPoints,
      matches: p.matches,
      gapOverNext: isHero ? gapOverNext : undefined,
      nextRank: isHero && next ? index + 2 : undefined,
      index
    });
  });

  if (ineligible.length) {
    const rows = ineligible.map((p, index) => renderSpartanRow(p, {
      metric: 'avg',
      displayRank: null,
      avgPoints: p.avgPoints,
      matches: p.matches,
      ineligible: true,
      index
    })).join('');
    html += renderCollapsedPlayerGroup(
      `Menos de 5 partidas (${ineligible.length})`,
      rows,
      eligible.length
    );
  }

  const hints = [`Solo cuentan ${AVG_MIN_MATCHES}+ partidas.`];
  if (hasTiedAvgs(eligible)) {
    hints.push('Mismo promedio: gana quien más partidas tenga.');
  }
  html += `
    <p class="ranking-tie-hint" role="status">
      ${hints.map((line) => escapeHtml(line)).join('<br>')}
    </p>
  `;

  return html;
}

function renderRanking() {
  const stack = document.getElementById('ranking-stack');
  if (!stack) return;

  const players = getCurrentPlayers();

  if (!players.length) {
    stack.innerHTML = `
      <div class="ranking-empty" role="status">
        Sin jugadores en el ranking de esta temporada.
      </div>
    `;
    return;
  }

  const html = rankingMetric === 'avg'
    ? renderAvgRanking(players)
    : renderPointsRanking(players);

  if (zeroRevealTimer) {
    clearTimeout(zeroRevealTimer);
    zeroRevealTimer = null;
  }

  applyRankingRevealVars(stack);
  stack.innerHTML = html;
  wireRankingRowInteractions();
  scheduleRankingSettle(stack);
}

/** @type {ReturnType<typeof setTimeout> | null} */
let rankingSettleTimer = null;

function scheduleRankingSettle(stack) {
  if (!stack) return;
  stack.classList.remove('is-settled');

  if (rankingSettleTimer) {
    clearTimeout(rankingSettleTimer);
    rankingSettleTimer = null;
  }

  if (prefersReducedMotion()) {
    stack.classList.add('is-settled');
    document.body.classList.remove('is-ranking-revealing');
    return;
  }

  document.body.classList.add('is-ranking-revealing');
  const { step, duration } = rankingRevealTiming();
  const visibleCount = stack.querySelectorAll(':scope > .spartan-row, :scope > .zero-group').length;
  const lastDelay = Math.min(Math.max(visibleCount - 1, 0), RANK_REVEAL_MAX_STAGGER) * step;
  const settleMs = lastDelay + duration + 48;

  rankingSettleTimer = setTimeout(() => {
    stack.classList.add('is-settled');
    document.body.classList.remove('is-ranking-revealing');
    rankingSettleTimer = null;
  }, settleMs);
}

function wireRankingRowInteractions() {
  const stack = document.getElementById('ranking-stack');
  if (!stack || stack.dataset.dossierWired === '1') return;
  stack.dataset.dossierWired = '1';

  stack.addEventListener('click', (event) => {
    const toggle = event.target.closest('.zero-group__toggle');
    if (toggle && stack.contains(toggle)) {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      setZeroGroupOpen(open);
      return;
    }
    const row = event.target.closest('.spartan-row');
    if (!row || !stack.contains(row)) return;
    if (typeof row.blur === 'function') row.blur();
    const name = row.getAttribute('data-name');
    if (name) openPlayerDossier(name);
  });

  stack.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = event.target.closest('.spartan-row');
    if (!row || !stack.contains(row)) return;
    event.preventDefault();
    const name = row.getAttribute('data-name');
    if (name) openPlayerDossier(name);
  });
}

function rankingStackLabel() {
  return rankingMetric === 'avg' ? 'Ranking por promedio' : 'Ranking del escuadrón';
}

function syncRankingMetricButtons() {
  document.querySelectorAll('.ranking-metric').forEach((btn) => {
    const active = btn.getAttribute('data-metric') === rankingMetric;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  const stack = document.getElementById('ranking-stack');
  if (stack) stack.setAttribute('aria-label', rankingStackLabel());
}

function setRankingMetric(metric) {
  const next = metric === 'avg' ? 'avg' : 'points';
  if (next === rankingMetric) return;
  rankingMetric = next;
  persistRankingMetric(rankingMetric);
  syncRankingMetricButtons();
  renderRanking();
}

function initRankingMetricToggle() {
  const toolbar = document.getElementById('ranking-toolbar');
  if (!toolbar) return;
  syncRankingMetricButtons();
  if (toolbar.dataset.wired === '1') return;
  toolbar.dataset.wired = '1';
  toolbar.addEventListener('click', (event) => {
    const btn = event.target.closest('.ranking-metric');
    if (!btn || !toolbar.contains(btn)) return;
    setRankingMetric(btn.getAttribute('data-metric'));
  });
}

function renderStats() {
  const players = getCurrentPlayers();
  const withPoints = players.filter(p => p.points > 0);
  const leaderPoints = withPoints[0] ? withPoints[0].points : 0;

  const podium = document.getElementById('podium');
  const top3 = withPoints.filter(p => p.rank <= 3).slice(0, 3);
  if (!top3.length) {
    podium.innerHTML = '';
    podium.hidden = true;
  } else {
    podium.hidden = false;
    podium.innerHTML = top3.map(p => `
      <div class="podium__slot podium__slot--${p.rank}" style="--row-accent: ${accentForRank(p.rank)}">
        <span class="podium__rank">${rankLabel(p.rank)}</span>
        <span class="podium__name">${escapeHtml(p.name)}</span>
        <span class="podium__points">${p.points.toLocaleString('es')} pts</span>
      </div>
    `).join('');
  }

  const chart = document.getElementById('points-chart');
  if (!withPoints.length) {
    chart.innerHTML = '<p class="chart-empty">Sin datos de puntos.</p>';
    return;
  }

  const maxPoints = Math.max(leaderPoints, 1);
  chart.innerHTML = withPoints.map(p => `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(p.name)}</span>
      <div class="bar-track">
        <div class="bar-fill" style="--bar-color: ${accentForRank(p.rank)}; width: ${(p.points / maxPoints) * 100}%"></div>
      </div>
      <span class="bar-value">${p.points.toLocaleString('es')}</span>
    </div>
  `).join('');
}

function setStatusLabel(sectionId) {
  const el = document.getElementById('status-text');
  if (!el) return;
  el.textContent = sectionId === 'stats' ? 'TEMPORADA' : 'RANKING';
}

function initNavigation() {
  const buttons = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.section');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.section;
      const targetSection = document.getElementById(targetId);
      if (!targetSection) return;

      buttons.forEach(b => {
        b.classList.remove('active', 'is-press-sweep');
        b.setAttribute('aria-pressed', 'false');
      });
      sections.forEach(section => {
        section.classList.remove('active');
        section.classList.remove('is-transitioning');
      });

      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      void btn.offsetWidth;
      btn.classList.add('is-press-sweep');
      btn.addEventListener('animationend', () => {
        btn.classList.remove('is-press-sweep');
      }, { once: true });
      setStatusLabel(targetId);
      targetSection.classList.add('is-transitioning');
      requestAnimationFrame(() => {
        targetSection.classList.add('active');
      });
    });
  });
}

function formatRelativeSync(date) {
  const diff = Date.now() - date.getTime();
  if (!Number.isFinite(diff) || diff < 30 * 1000) return 'hace un momento';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

function updateTimestamp() {
  const el = document.getElementById('last-updated');
  if (!el) return;
  const date = new Date(squadData.lastUpdated);
  if (Number.isNaN(date.getTime())) {
    el.textContent = '—';
    el.removeAttribute('datetime');
    el.removeAttribute('title');
    el.classList.remove('is-stale');
    return;
  }

  const absolute = date.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
  const relative = formatRelativeSync(date);
  const stale = Date.now() - date.getTime() > STALE_SYNC_MS;
  el.dateTime = date.toISOString();
  el.textContent = relative;
  el.title = stale ? `Datos de ${relative} (${absolute})` : absolute;
  el.classList.toggle('is-stale', stale);
}

function formatSeasonStart(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

function updateSeasonStart() {
  const el = document.getElementById('season-start');
  if (!el) return;
  const season = getSelectedSeason();
  const start = formatSeasonStart(season && season.fechaInicio);
  if (!start) {
    el.textContent = '—';
    el.removeAttribute('datetime');
    el.removeAttribute('title');
    return;
  }
  el.textContent = `desde ${start}`;
  el.dateTime = new Date(season.fechaInicio).toISOString();
  el.title = `Inicio de temporada: ${start}`;
}

function shortSeasonLabel(season) {
  if (!season) return 'Temporada';
  if (season.id != null && Number.isFinite(Number(season.id))) {
    return `Temporada ${season.id}`;
  }
  return season.label || 'Temporada';
}

function updateSeasonChrome() {
  const season = getSelectedSeason();
  const labelEl = document.getElementById('season-banner-label');
  const chipEl = document.getElementById('season-archive-chip');
  const descEl = document.getElementById('season-section-desc');
  const trigger = document.getElementById('season-trigger');
  const isArchive = Boolean(season && !season.active);

  if (labelEl) {
    labelEl.textContent = shortSeasonLabel(season);
  }
  if (chipEl) {
    chipEl.hidden = !isArchive;
  }
  document.body.classList.toggle('is-season-archive', isArchive);

  if (descEl) {
    descEl.textContent = isArchive
      ? 'Registro archivado — ranking acumulado de una temporada cerrada.'
      : 'Resumen del ranking acumulado de la temporada activa.';
  }
  if (trigger) {
    trigger.setAttribute(
      'aria-label',
      season
        ? `Temporada seleccionada: ${season.label}${isArchive ? ' (archivo)' : ''}`
        : 'Seleccionar temporada'
    );
  }

  const options = document.querySelectorAll('.season-option');
  options.forEach((opt) => {
    const selected = Number(opt.dataset.seasonId) === selectedSeasonId;
    opt.classList.toggle('is-selected', selected);
    opt.setAttribute('aria-selected', String(selected));
  });

  updateSeasonStart();
}

function playSeasonSwapMotion() {
  const targets = [
    document.getElementById('ranking-stack'),
    document.getElementById('stats')
  ].filter(Boolean);

  if (prefersReducedMotion()) return;

  targets.forEach((el) => {
    el.classList.remove('season-swap');
    // force reflow
    void el.offsetWidth;
    el.classList.add('season-swap');
  });
}

function selectSeason(seasonId, options = {}) {
  const next = getSeasonById(seasonId);
  if (!next) return;
  if (next.id === selectedSeasonId && !options.force) return;

  selectedSeasonId = next.id;
  closeSeasonPanel();
  updateSeasonChrome();
  playSeasonSwapMotion();
  renderRanking();
  renderStats();
  syncUrlState({ player: openDossierName });

  if (openDossierName) {
    renderPlayerDossier(openDossierName);
  }

  if (options.highlightName && !isDossierOpen()) {
    highlightPlayer(options.highlightName);
  }
}

function isSeasonPanelOpen() {
  const panel = document.getElementById('season-panel');
  return Boolean(panel && !panel.hidden);
}

function openSeasonPanel() {
  const panel = document.getElementById('season-panel');
  const trigger = document.getElementById('season-trigger');
  if (!panel || !trigger) return;
  panel.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  const selected = panel.querySelector('.season-option.is-selected')
    || panel.querySelector('.season-option');
  if (selected) {
    try {
      selected.focus();
    } catch (_) {
      /* ignore */
    }
  }
}

function closeSeasonPanel() {
  const panel = document.getElementById('season-panel');
  const trigger = document.getElementById('season-trigger');
  if (!panel || !trigger) return;
  panel.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
}

function toggleSeasonPanel() {
  if (isSeasonPanelOpen()) closeSeasonPanel();
  else openSeasonPanel();
}

function renderSeasonPanelList() {
  const list = document.getElementById('season-panel-list');
  if (!list) return;

  list.innerHTML = squadData.seasons.map((season) => {
    const selected = season.id === selectedSeasonId;
    const badge = season.active
      ? '<span class="season-option__badge season-option__badge--live">ACTIVA</span>'
      : '<span class="season-option__badge">ARCHIVO</span>';
    return `
      <button
        type="button"
        class="season-option${selected ? ' is-selected' : ''}${season.active ? ' is-active' : ''}"
        role="option"
        data-season-id="${season.id}"
        aria-selected="${selected}"
        id="season-option-${season.id}"
      >
        <span class="season-option__id">T${String(season.id).padStart(2, '0')}</span>
        <span class="season-option__meta">
          <span class="season-option__label">${escapeHtml(season.label)}</span>
          ${badge}
        </span>
      </button>
    `;
  }).join('');
}

function initSeasonSelector() {
  const trigger = document.getElementById('season-trigger');
  const panel = document.getElementById('season-panel');
  const list = document.getElementById('season-panel-list');
  if (!trigger || !panel || !list) return;

  // Una sola temporada: trigger informativo, sin panel.
  if (squadData.seasons.length <= 1) {
    trigger.disabled = true;
    trigger.classList.add('season-banner--static');
    updateSeasonChrome();
    return;
  }

  renderSeasonPanelList();
  updateSeasonChrome();

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleSeasonPanel();
  });

  list.addEventListener('click', (event) => {
    const option = event.target.closest('.season-option');
    if (!option) return;
    const id = Number(option.dataset.seasonId);
    selectSeason(id, { highlightName: getHighlightedPlayerName() });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (isDossierOpen() && isComparePickerOpen()) {
      event.preventDefault();
      closeComparePicker();
      const toggle = document.getElementById('dossier-compare-toggle');
      if (toggle) {
        try { toggle.focus(); } catch (_) { /* ignore */ }
      }
      return;
    }
    if (isDossierOpen()) {
      event.preventDefault();
      closePlayerDossier();
      return;
    }
    if (isSeasonPanelOpen()) {
      event.preventDefault();
      closeSeasonPanel();
      trigger.focus();
    }
  });

  document.addEventListener('click', (event) => {
    const root = document.getElementById('season-selector');
    if (!root || !isSeasonPanelOpen()) return;
    if (!root.contains(event.target)) closeSeasonPanel();
  });

  panel.addEventListener('keydown', (event) => {
    const options = [...panel.querySelectorAll('.season-option')];
    if (!options.length) return;
    const currentIndex = options.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = options[(currentIndex + 1 + options.length) % options.length];
      next.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = options[(currentIndex - 1 + options.length) % options.length];
      prev.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      options[0].focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      options[options.length - 1].focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (document.activeElement && document.activeElement.classList.contains('season-option')) {
        event.preventDefault();
        const id = Number(document.activeElement.dataset.seasonId);
        selectSeason(id, { highlightName: getHighlightedPlayerName() });
      }
    }
  });
}

/** @type {string|null} */
let openDossierName = null;
/** @type {string} */
let dossierMatchMode = 'all';

const MATCH_MODES = [
  { id: 'all', label: 'Todas' },
  { id: 'ffa', label: 'FFA' },
  { id: 'arcade', label: 'Arcade' },
  { id: 'equipos', label: 'Equipos' },
  { id: 'multiequipo', label: 'Multiequipo' }
];
/** @type {string|null} */
let compareRivalName = null;
/** @type {number} */
let compareListActiveIndex = -1;
/** @type {Element|null} */
let dossierLastFocus = null;
let dossierClosing = false;
/** @type {ReturnType<typeof setTimeout> | null} */
let holoBootTimer = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let holoCollapseTimer = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let compareRevealTimer = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let compareCloseTimer = null;

function getProfileByName(name) {
  const target = normalizePlayerName(name);
  return (squadData.profiles || []).find(
    (p) => normalizePlayerName(p.name) === target
  ) || null;
}

function findPlayerInSeason(name, seasonId) {
  const season = getSeasonById(seasonId) || getSelectedSeason();
  if (!season) return null;
  const target = normalizePlayerName(name);
  return (season.players || []).find(
    (p) => normalizePlayerName(p.name) === target
  ) || null;
}

function resolvePlayerRef(name) {
  return findPlayerInSeason(name, selectedSeasonId) || getProfileByName(name) || null;
}

function syncUrlState({
  player = openDossierName,
  rival = compareRivalName,
  seasonId = selectedSeasonId
} = {}) {
  try {
    const url = new URL(window.location.href);
    if (seasonId != null) url.searchParams.set('season', String(seasonId));
    else url.searchParams.delete('season');

    if (player && rival) {
      url.searchParams.delete('player');
      url.searchParams.set('compare', `${player},${rival}`);
    } else if (player) {
      url.searchParams.delete('compare');
      url.searchParams.set('player', player);
    } else {
      url.searchParams.delete('player');
      url.searchParams.delete('compare');
    }

    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch (_) {
    /* ignore */
  }
}

function formatMatchAxisLabel(iso) {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function pickAxisLabels(items) {
  const minGap = 88;
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (sorted.length === 1 || Math.abs(last.x - first.x) < minGap) {
    return [{ ...first, anchor: 'middle' }];
  }

  const ticks = [{ ...first, anchor: 'start' }];
  for (const item of sorted.slice(1, -1)) {
    const prev = ticks[ticks.length - 1];
    if (item.x - prev.x >= minGap && last.x - item.x >= minGap) {
      ticks.push({ ...item, anchor: 'middle' });
    }
  }
  ticks.push({ ...last, anchor: 'end' });
  return ticks;
}

function matchRows(matches) {
  return (matches || []).map((m) => ({
    points: Number(m && m.points) || 0,
    at: m && m.at ? m.at : null,
    modo: m && m.modo ? m.modo : null
  }));
}

function sparklineCoords(rows, min, span, padL, padT, plotW, plotH) {
  return rows.map((row, index) => {
    const x = rows.length < 2
      ? padL + plotW / 2
      : padL + (index / (rows.length - 1)) * plotW;
    const y = padT + plotH - ((row.points - min) / span) * plotH;
    return { x, y, points: row.points, at: row.at, modo: row.modo };
  });
}

function polylineMarkup(coords, className, stroke) {
  if (!coords || coords.length < 2) return '';
  const pointsAttr = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  return `
    <polyline
      class="${className}"
      fill="none"
      stroke="${stroke}"
      stroke-width="2"
      pathLength="1"
      points="${pointsAttr}"
    />
  `;
}

function circlesMarkup(coords, className, fill, seriesName, series) {
  return (coords || []).map((c) => {
    const at = c.at ? escapeHtml(String(c.at)) : '';
    const name = seriesName ? escapeHtml(seriesName) : '';
    const pts = Number(c.points) || 0;
    const labelParts = [
      seriesName || '',
      formatMatchAxisLabel(c.at),
      `${pts.toLocaleString('es')} pts`,
      modeLabel(c.modo)
    ].filter(Boolean);
    return `
      <g class="dossier-trend__pt">
        <circle
          class="dossier-trend__hit"
          cx="${c.x.toFixed(1)}"
          cy="${c.y.toFixed(1)}"
          r="8"
          fill="transparent"
          tabindex="0"
          role="img"
          aria-label="${escapeHtml(labelParts.join(' · '))}"
          data-at="${at}"
          data-points="${pts}"
          data-name="${name}"
          data-series="${series || ''}"
          data-modo="${c.modo ? escapeHtml(String(c.modo)) : ''}"
        />
        <circle
          class="${className}"
          cx="${c.x.toFixed(1)}"
          cy="${c.y.toFixed(1)}"
          r="2.2"
          fill="${fill}"
          pointer-events="none"
        />
      </g>
    `;
  }).join('');
}

/**
 * @param {object[]} matches
 * @param {object[]|null} [secondMatches]
 * @param {{ a?: string, b?: string }} [names]
 * @param {number} [measuredWidth]
 * @param {number} [measuredHeight]
 */
function buildSparklineSvg(matches, secondMatches, names, measuredWidth, measuredHeight) {
  const rowsA = matchRows(matches);
  const rowsB = secondMatches == null ? null : matchRows(secondMatches);
  const dual = rowsB != null;
  const canDrawA = rowsA.length >= 2;
  const canDrawB = dual && rowsB.length >= 2;

  if (!canDrawA && !canDrawB) {
    return '<p class="dossier-trend__empty">Sin historial reciente</p>';
  }

  const padL = 30;
  const padR = 36;
  const padT = 18;
  const padB = 32;
  const measuredW = Math.max(0, Math.floor(Number(measuredWidth) || 0));
  const measuredH = Math.max(0, Math.floor(Number(measuredHeight) || 0));
  const height = Math.max(measuredH || 200, 168);
  const pointCount = Math.max(
    canDrawA ? rowsA.length : 0,
    canDrawB ? rowsB.length : 0
  );
  const minByPoints = padL + padR + Math.max(0, pointCount - 1) * 36;
  const width = Math.max(measuredW || (dual ? 480 : 320), minByPoints);
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const values = [
    ...(canDrawA ? rowsA : []),
    ...(canDrawB ? rowsB : [])
  ].map((r) => r.points);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const yMid = min + (max - min) / 2;

  const coordsA = canDrawA
    ? sparklineCoords(rowsA, min, span, padL, padT, plotW, plotH)
    : [];
  const coordsB = canDrawB
    ? sparklineCoords(rowsB, min, span, padL, padT, plotW, plotH)
    : [];

  const yTicks = min === max
    ? [{ value: max, y: padT + plotH / 2 }]
    : [
        { value: max, y: padT },
        { value: yMid, y: padT + plotH / 2 },
        { value: min, y: padT + plotH }
      ];

  const xSource = coordsA.length >= coordsB.length ? coordsA : coordsB;
  const xTicks = pickAxisLabels(xSource);

  const yLabels = yTicks.map((tick) => `
    <text class="dossier-trend__label dossier-trend__label--y" x="${padL - 4}" y="${tick.y + 3}" text-anchor="end">${tick.value.toLocaleString('es')}</text>
    <line class="dossier-trend__grid" x1="${padL}" y1="${tick.y}" x2="${width - padR}" y2="${tick.y}" />
  `).join('');

  const xLabels = xTicks.map((tick) => `
    <text class="dossier-trend__label dossier-trend__label--x" x="${tick.x.toFixed(1)}" y="${height - 6}" text-anchor="${tick.anchor || 'middle'}">${escapeHtml(formatMatchAxisLabel(tick.at))}</text>
  `).join('');

  const strokeA = dual ? 'var(--halo-cyan)' : 'currentColor';
  const strokeB = 'var(--halo-rival)';
  const nameA = dual ? (names && names.a) || '' : '';
  const nameB = dual ? (names && names.b) || '' : '';
  const lineA = polylineMarkup(
    coordsA,
    dual ? 'dossier-trend__line dossier-trend__line--alpha' : '',
    strokeA
  );
  const lineB = polylineMarkup(
    coordsB,
    'dossier-trend__line dossier-trend__line--bravo',
    strokeB
  );
  const dotsA = circlesMarkup(
    coordsA,
    dual ? 'dossier-trend__dot dossier-trend__dot--alpha' : 'dossier-trend__dot',
    strokeA,
    nameA,
    dual ? 'alpha' : ''
  );
  const dotsB = circlesMarkup(
    coordsB,
    'dossier-trend__dot dossier-trend__dot--bravo',
    strokeB,
    nameB,
    'bravo'
  );

  return `
    <div class="dossier-trend__chart">
      <div class="dossier-trend__plot" style="width:${width}px;height:${height}px" data-layout-width="${measuredW || width}" data-layout-height="${measuredH || height}">
        <svg class="dossier-trend__svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="group" aria-label="Partidas de la temporada: eje Y puntos ${min} a ${max}, eje X partidas">
          ${yLabels}
          <line class="dossier-trend__axis" x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" />
          <line class="dossier-trend__axis" x1="${padL}" y1="${padT + plotH}" x2="${width - padR}" y2="${padT + plotH}" />
          ${lineA}
          ${lineB}
          ${dotsA}
          ${dotsB}
          ${xLabels}
        </svg>
      </div>
    </div>
  `;
}

let sparklineTipsAbort = null;

function formatTrendTip(hit, svg) {
  const when = formatMatchAxisLabel(hit.getAttribute('data-at'));
  const pts = Number(hit.getAttribute('data-points')) || 0;
  const name = hit.getAttribute('data-name') || '';
  const modo = modeLabel(hit.getAttribute('data-modo'));
  const parts = [when, `${pts.toLocaleString('es')} pts`];
  if (modo) parts.push(modo);
  if (svg) {
    const at = hit.getAttribute('data-at');
    const other = [...svg.querySelectorAll('.dossier-trend__hit')].find((node) => (
      node !== hit
      && at
      && node.getAttribute('data-at') === at
      && node.getAttribute('data-series')
      && node.getAttribute('data-series') !== hit.getAttribute('data-series')
    ));
    if (other) {
      const otherName = other.getAttribute('data-name') || '';
      const otherPts = Number(other.getAttribute('data-points')) || 0;
      parts.push(`${otherName} ${otherPts.toLocaleString('es')} pts`);
    }
  }
  const body = parts.join(' · ');
  return name ? `${name} · ${body}` : body;
}

function positionTrendTip(svg, host, tip, hit) {
  const pt = svg.createSVGPoint();
  pt.x = Number(hit.getAttribute('cx'));
  pt.y = Number(hit.getAttribute('cy'));
  const ctm = svg.getScreenCTM();
  if (!ctm) return;
  const screen = pt.matrixTransform(ctm);
  const hostRect = host.getBoundingClientRect();
  const x = screen.x - hostRect.left;
  const y = screen.y - hostRect.top;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
  tip.style.transform = 'translate(-50%, calc(-100% - 10px))';

  const tipRect = tip.getBoundingClientRect();
  const pad = 6;
  let dx = 0;
  if (tipRect.left < hostRect.left + pad) dx = hostRect.left + pad - tipRect.left;
  if (tipRect.right > hostRect.right - pad) dx += hostRect.right - pad - (tipRect.right + dx);
  const flip = tipRect.top < hostRect.top + pad;
  tip.style.transform = flip
    ? `translate(calc(-50% + ${dx}px), 12px)`
    : `translate(calc(-50% + ${dx}px), calc(-100% - 10px))`;
}

function wireSparklineTips(trend) {
  sparklineTipsAbort?.abort();
  const chart = trend.querySelector('.dossier-trend__chart');
  const svg = trend.querySelector('.dossier-trend__svg');
  const tip = trend.querySelector('.dossier-trend__tip');
  if (!chart || !svg || !tip) return;

  sparklineTipsAbort = new AbortController();
  const { signal } = sparklineTipsAbort;
  const hits = [...svg.querySelectorAll('.dossier-trend__hit')];
  const coarse = window.matchMedia('(hover: none)').matches;
  let active = null;

  const hide = () => {
    active = null;
    tip.hidden = true;
    tip.classList.remove('is-bravo');
  };

  const show = (hit) => {
    active = hit;
    tip.textContent = formatTrendTip(hit, svg);
    tip.hidden = false;
    tip.classList.toggle('is-bravo', hit.getAttribute('data-series') === 'bravo');
    positionTrendTip(svg, trend, tip, hit);
  };

  hits.forEach((hit) => {
    hit.addEventListener('pointerenter', () => {
      if (!coarse) show(hit);
    }, { signal });
    hit.addEventListener('pointerleave', () => {
      if (!coarse) hide();
    }, { signal });
    hit.addEventListener('focus', () => show(hit), { signal });
    hit.addEventListener('blur', () => hide(), { signal });
    hit.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!coarse) return;
      if (active === hit) hide();
      else show(hit);
    }, { signal });
  });

  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.dossier-trend__hit')) hide();
  }, { signal });
}

let sparklineObserver = null;
let sparklineLayoutRaf = 0;

function disconnectSparklineLayout() {
  if (sparklineLayoutRaf) {
    cancelAnimationFrame(sparklineLayoutRaf);
    sparklineLayoutRaf = 0;
  }
  sparklineObserver?.disconnect();
  sparklineObserver = null;
}

function scheduleSparklineLayout(trend, buildChart) {
  disconnectSparklineLayout();
  if (!trend || typeof buildChart !== 'function') return;

  const run = () => {
    sparklineLayoutRaf = 0;
    const chart = trend.querySelector('.dossier-trend__chart');
    if (!chart) return;

    const availableW = Math.floor(chart.clientWidth);
    const styles = window.getComputedStyle(chart);
    const padY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
    const availableH = Math.max(0, Math.floor(chart.clientHeight - padY));
    if (availableW < 8 || availableH < 8) {
      observeSparklineChart(chart, run);
      return;
    }

    const plot = chart.querySelector('.dossier-trend__plot');
    const fittedW = plot ? Number(plot.getAttribute('data-layout-width')) || 0 : 0;
    const fittedH = plot ? Number(plot.getAttribute('data-layout-height')) || 0 : 0;
    if (plot && Math.abs(fittedW - availableW) < 4 && Math.abs(fittedH - availableH) < 4) {
      observeSparklineChart(chart, run);
      return;
    }

    sparklineObserver?.disconnect();
    sparklineObserver = null;
    chart.outerHTML = buildChart(availableW, availableH);
    wireSparklineTips(trend);
    const nextChart = trend.querySelector('.dossier-trend__chart');
    observeSparklineChart(nextChart, run);
  };

  sparklineLayoutRaf = requestAnimationFrame(run);
}

function observeSparklineChart(chart, run) {
  sparklineObserver?.disconnect();
  sparklineObserver = null;
  if (!chart || typeof ResizeObserver === 'undefined') return;
  sparklineObserver = new ResizeObserver(() => {
    if (sparklineLayoutRaf) return;
    sparklineLayoutRaf = requestAnimationFrame(run);
  });
  sparklineObserver.observe(chart);
}

function trendDeltaLabel(recentPoints) {
  const values = (recentPoints || []).map((n) => Number(n) || 0);
  if (values.length < 2) {
    return { tone: 'flat', label: '=', text: 'Sin datos' };
  }
  const avg = values.reduce((sum, n) => sum + n, 0) / values.length;
  const last = values[values.length - 1];
  const diff = last - avg;
  if (Math.abs(diff) < 0.25) {
    return { tone: 'flat', label: '=', text: 'Estable' };
  }
  if (diff > 0) {
    return { tone: 'up', label: '+ POSITIVA', text: `+${diff.toFixed(1)} vs media` };
  }
  return { tone: 'down', label: '− NEGATIVA', text: `${diff.toFixed(1)} vs media` };
}

function isDossierOpen() {
  const dossier = document.getElementById('player-dossier');
  return Boolean(dossier && !dossier.hidden);
}

function isComparePickerOpen() {
  const picker = document.getElementById('dossier-compare-picker');
  return Boolean(picker && !picker.hidden);
}

function canComparePlayers() {
  const profiles = squadData.profiles || [];
  if (profiles.length > 1) return true;
  return getCurrentPlayers().length > 1;
}

function modeLabel(modo) {
  const found = MATCH_MODES.find((mode) => mode.id === modo);
  return found && found.id !== 'all' ? found.label : '';
}

function filterRecentByMode(recent) {
  if (!dossierMatchMode || dossierMatchMode === 'all') return recent || [];
  return (recent || []).filter((m) => m.modo === dossierMatchMode);
}

function summarizeRecent(recent) {
  const list = recent || [];
  const pointsList = list.map((m) => Number(m.points) || 0);
  const bestGame = pointsList.length ? Math.max(...pointsList) : null;
  const avgPoints = pointsList.length
    ? Number((pointsList.reduce((sum, n) => sum + n, 0) / pointsList.length).toFixed(1))
    : null;
  const teamRows = list.filter((m) => (
    m.modo === 'equipos' && (m.result === 'ganador' || m.result === 'perdedor')
  ));
  const wins = teamRows.filter((m) => m.result === 'ganador').length;
  const teamMatches = teamRows.length;
  return {
    bestGame,
    avgPoints,
    wins,
    teamMatches,
    winRate: teamMatches > 0 ? wins / teamMatches : null
  };
}

function sharedMatchPairs(recentA, recentB) {
  const mapB = new Map();
  (recentB || []).forEach((m) => {
    if (m && m.matchId) mapB.set(m.matchId, m);
  });
  return (recentA || [])
    .filter((m) => m && m.matchId && mapB.has(m.matchId))
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))
    .map((a) => ({ a, b: mapB.get(a.matchId) }));
}

function modeFilterMarkup() {
  return `
    <div class="dossier-trend__modes" role="group" aria-label="Filtro de modo">
      ${MATCH_MODES.map((mode) => `
        <button
          type="button"
          class="dossier-trend__mode${dossierMatchMode === mode.id ? ' is-active' : ''}"
          data-match-mode="${mode.id}"
          aria-pressed="${dossierMatchMode === mode.id ? 'true' : 'false'}"
        >${escapeHtml(mode.label)}</button>
      `).join('')}
    </div>
  `;
}

function formatWinRate(n) {
  if (n == null) return '—';
  return `${Math.round(Number(n) * 100)}%`;
}

function applyViewStats(side, recentView) {
  const fromRecent = summarizeRecent(recentView);
  const filtered = dossierMatchMode !== 'all';
  side.bestGame = filtered ? fromRecent.bestGame : (side.bestGame ?? fromRecent.bestGame);
  side.avgPoints = filtered ? fromRecent.avgPoints : (side.avgPoints ?? fromRecent.avgPoints);
  side.wins = filtered ? fromRecent.wins : (side.wins ?? fromRecent.wins);
  side.teamMatches = filtered ? fromRecent.teamMatches : (side.teamMatches ?? fromRecent.teamMatches);
  side.winRate = fromRecent.winRate != null
    ? fromRecent.winRate
    : (side.teamMatches > 0 ? side.wins / side.teamMatches : null);
  side.recentView = recentView;
}

function getCompareSide(name) {
  const profile = getProfileByName(name);
  const seasonPlayer = findPlayerInSeason(name, selectedSeasonId);
  if (!profile && !seasonPlayer) return null;

  const bySeason = profile?.bySeason || [];
  const seasonStats = bySeason.find((s) => s.seasonId === selectedSeasonId) || null;
  const rank = seasonPlayer?.rank ?? null;
  const points = seasonPlayer?.points ?? 0;
  const recent = [...(profile?.recentMatches || [])]
    .filter((m) => Number(m.seasonId) === Number(selectedSeasonId))
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));

  return {
    name: seasonPlayer?.name || profile?.name || name,
    rank,
    points,
    matches: seasonStats && seasonStats.matches != null ? seasonStats.matches : null,
    bestRank: profile?.bestRank ?? rank,
    careerPoints: profile ? Number(profile.careerPoints) || 0 : 0,
    matchesPlayed: profile ? Number(profile.matchesPlayed) || 0 : 0,
    bestGame: seasonStats && seasonStats.bestGame != null ? Number(seasonStats.bestGame) : null,
    avgPoints: seasonStats && seasonStats.avgPoints != null ? Number(seasonStats.avgPoints) : null,
    matchesPerWeek: seasonStats && seasonStats.matchesPerWeek != null ? Number(seasonStats.matchesPerWeek) : null,
    wins: seasonStats && seasonStats.wins != null ? Number(seasonStats.wins) : 0,
    teamMatches: seasonStats && seasonStats.teamMatches != null ? Number(seasonStats.teamMatches) : 0,
    recent,
    bySeason
  };
}

function metricWinner(aVal, bVal, better) {
  if (aVal == null || bVal == null) return 'tie';
  if (aVal === bVal) return 'tie';
  if (better === 'lower') return aVal < bVal ? 'a' : 'b';
  return aVal > bVal ? 'a' : 'b';
}

function formatMetricDelta(aVal, bVal, better) {
  if (aVal == null || bVal == null) return '—';
  const diff = aVal - bVal;
  if (diff === 0) return '=';
  const abs = Math.abs(diff);
  const formatted = Number.isInteger(abs) ? abs.toLocaleString('es') : abs.toFixed(1);
  if (better === 'lower') {
    return diff < 0 ? `−${formatted}` : `+${formatted}`;
  }
  return diff > 0 ? `+${formatted}` : `−${formatted}`;
}

const COMPARE_METRICS = [
  {
    key: 'points',
    label: 'Puntos',
    better: 'higher',
    format: (n) => (n == null ? '—' : Number(n).toLocaleString('es'))
  },
  {
    key: 'rank',
    label: 'Puesto',
    better: 'lower',
    format: (n) => (n != null ? rankLabel(n) : '—')
  },
  {
    key: 'matches',
    label: 'Partidas',
    better: 'higher',
    format: (n) => (n == null ? '—' : String(n))
  },
  {
    key: 'careerPoints',
    label: 'Pts carrera',
    better: 'higher',
    format: (n) => (n == null ? '—' : Number(n).toLocaleString('es'))
  },
  {
    key: 'bestRank',
    label: 'Mejor puesto',
    better: 'lower',
    format: (n) => (n != null ? rankLabel(n) : '—')
  },
  {
    key: 'matchesPlayed',
    label: 'Part. carrera',
    better: 'higher',
    format: (n) => (n == null ? '—' : Number(n).toLocaleString('es'))
  },
  {
    key: 'bestGame',
    label: 'Mejor partida',
    better: 'higher',
    format: (n) => (n == null ? '—' : Number(n).toLocaleString('es'))
  },
  {
    key: 'avgPoints',
    label: 'Media',
    better: 'higher',
    format: (n) => (n == null ? '—' : Number(n).toFixed(1))
  },
  {
    key: 'matchesPerWeek',
    label: 'Part./semana',
    better: 'higher',
    format: (n) => (n == null ? '—' : Number(n).toFixed(1))
  },
  {
    key: 'winRate',
    label: 'Winrate eq.',
    better: 'higher',
    format: formatWinRate
  },
  {
    key: 'h2hCount',
    label: 'Enfrentamientos',
    better: 'higher',
    format: (n) => (n == null ? '—' : String(n))
  },
  {
    key: 'h2hPoints',
    label: 'Pts en duelo',
    better: 'higher',
    format: (n) => (n == null ? '—' : Number(n).toLocaleString('es'))
  }
];

function seasonLabelText(season) {
  if (!season) return '—';
  return season.active ? season.label : `${season.label} · Registro archivado`;
}

function getCompareCandidates(excludeName) {
  const skip = normalizePlayerName(excludeName);
  return (squadData.profiles || [])
    .filter((p) => normalizePlayerName(p.name) !== skip)
    .map((p) => p.name);
}

function setCompareListActive(index) {
  const list = document.getElementById('compare-listbox');
  const input = document.getElementById('dossier-compare-input');
  if (!list) return;

  const options = [...list.querySelectorAll('[role="option"]')];
  const max = options.length - 1;
  if (!options.length) {
    compareListActiveIndex = -1;
    if (input) input.removeAttribute('aria-activedescendant');
    return;
  }

  compareListActiveIndex = Math.max(0, Math.min(index, max));
  options.forEach((opt, i) => {
    const active = i === compareListActiveIndex;
    opt.classList.toggle('is-active', active);
    opt.setAttribute('aria-selected', String(active));
  });

  const activeEl = options[compareListActiveIndex];
  if (input && activeEl && activeEl.id) {
    input.setAttribute('aria-activedescendant', activeEl.id);
  }
  if (activeEl && typeof activeEl.scrollIntoView === 'function') {
    activeEl.scrollIntoView({ block: 'nearest' });
  }
}

function renderCompareList(filterText) {
  const list = document.getElementById('compare-listbox');
  const empty = document.getElementById('compare-list-empty');
  const input = document.getElementById('dossier-compare-input');
  if (!list) return [];

  const query = normalizePlayerName(filterText);
  const names = getCompareCandidates(openDossierName).filter((name) => {
    if (!query) return true;
    return normalizePlayerName(name).includes(query);
  });

  list.innerHTML = names.map((name, index) => `
    <li>
      <button
        type="button"
        class="compare-list__option"
        role="option"
        id="compare-opt-${index}"
        data-name="${escapeHtml(name)}"
        aria-selected="false"
      >${escapeHtml(name)}</button>
    </li>
  `).join('');

  if (empty) empty.hidden = names.length > 0;

  if (!names.length) {
    compareListActiveIndex = -1;
    if (input) input.removeAttribute('aria-activedescendant');
  } else if (names.length === 1) {
    setCompareListActive(0);
  } else {
    compareListActiveIndex = -1;
    if (input) input.removeAttribute('aria-activedescendant');
  }

  return names;
}

function setComparePickerError(message) {
  const el = document.getElementById('dossier-compare-error');
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function clearComparePickerTimers() {
  if (compareRevealTimer) {
    clearTimeout(compareRevealTimer);
    compareRevealTimer = null;
  }
  if (compareCloseTimer) {
    clearTimeout(compareCloseTimer);
    compareCloseTimer = null;
  }
}

function finishCloseComparePicker() {
  const picker = document.getElementById('dossier-compare-picker');
  const toggle = document.getElementById('dossier-compare-toggle');
  const input = document.getElementById('dossier-compare-input');
  const list = document.getElementById('compare-listbox');
  const empty = document.getElementById('compare-list-empty');
  clearComparePickerTimers();
  if (picker) {
    picker.hidden = true;
    picker.classList.remove('is-revealing', 'is-list-open');
  }
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  if (input) {
    input.value = '';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  if (list) list.innerHTML = '';
  if (empty) empty.hidden = true;
  compareListActiveIndex = -1;
  setComparePickerError('');
}

function openComparePicker() {
  const picker = document.getElementById('dossier-compare-picker');
  const toggle = document.getElementById('dossier-compare-toggle');
  const input = document.getElementById('dossier-compare-input');
  if (!picker || !input) return;

  clearComparePickerTimers();
  input.value = '';
  setComparePickerError('');
  renderCompareList('');
  picker.hidden = false;
  picker.classList.remove('is-revealing', 'is-list-open');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-expanded', 'true');
  void picker.offsetWidth;

  const fieldMs = prefersReducedMotion() ? 0 : COMPARE_FIELD_MS;
  if (fieldMs <= 0) {
    picker.classList.add('is-revealing', 'is-list-open');
    try {
      input.focus();
    } catch (_) {
      /* ignore */
    }
    return;
  }

  requestAnimationFrame(() => {
    picker.classList.add('is-revealing');
  });

  compareRevealTimer = setTimeout(() => {
    picker.classList.add('is-list-open');
    compareRevealTimer = null;
    try {
      input.focus();
    } catch (_) {
      /* ignore */
    }
  }, fieldMs);
}

function closeComparePicker() {
  const picker = document.getElementById('dossier-compare-picker');
  if (!picker || picker.hidden) {
    finishCloseComparePicker();
    return;
  }

  if (prefersReducedMotion()) {
    finishCloseComparePicker();
    return;
  }

  clearComparePickerTimers();
  picker.classList.remove('is-list-open', 'is-revealing');
  compareCloseTimer = setTimeout(() => {
    finishCloseComparePicker();
  }, COMPARE_FIELD_MS);
}

function confirmCompareFromKeyboard(inputValue) {
  const list = document.getElementById('compare-listbox');
  const options = list ? [...list.querySelectorAll('[role="option"]')] : [];
  if (compareListActiveIndex >= 0 && options[compareListActiveIndex]) {
    return tryConfirmRival(options[compareListActiveIndex].getAttribute('data-name'));
  }
  if (options.length === 1) {
    return tryConfirmRival(options[0].getAttribute('data-name'));
  }
  return tryConfirmRival(inputValue);
}

function applyDossierCompareChrome(isCompare) {
  const dossier = document.getElementById('player-dossier');
  const vs = document.getElementById('dossier-vs');
  const bravo = document.getElementById('dossier-bravo');
  const compareWrap = document.getElementById('dossier-compare');
  const clearBtn = document.getElementById('dossier-clear-rival');
  const eyebrow = document.getElementById('dossier-eyebrow');
  const readouts = document.getElementById('dossier-readouts');
  const trend = document.getElementById('dossier-trend');

  if (dossier) {
    dossier.classList.toggle('player-dossier--compare', isCompare);
    dossier.setAttribute(
      'aria-labelledby',
      isCompare ? 'dossier-name dossier-name-b' : 'dossier-name'
    );
  }
  if (vs) vs.hidden = !isCompare;
  if (bravo) bravo.hidden = !isCompare;
  if (compareWrap) {
    const showPicker = !isCompare && canComparePlayers();
    compareWrap.hidden = !showPicker;
    if (!showPicker) finishCloseComparePicker();
  }
  if (clearBtn) clearBtn.hidden = !isCompare;
  if (eyebrow) {
    eyebrow.textContent = isCompare ? 'UNSC PERSONNEL FILE · COMPARE' : 'UNSC PERSONNEL FILE';
  }
  if (readouts) readouts.classList.toggle('player-dossier__readouts--compare', isCompare);
  if (trend) trend.classList.toggle('player-dossier__trend--compare', isCompare);
}

function paintDossierSide(side, suffix) {
  const rankEl = document.getElementById(suffix ? `dossier-rank-${suffix}` : 'dossier-rank');
  const nameEl = document.getElementById(suffix ? `dossier-name-${suffix}` : 'dossier-name');
  const seasonEl = document.getElementById(suffix ? `dossier-season-${suffix}` : 'dossier-season');
  if (!rankEl || !nameEl || !seasonEl || !side) return;

  const season = getSelectedSeason();
  const accent = suffix === 'b'
    ? 'var(--halo-rival)'
    : accentForRank(side.rank || side.bestRank || 99);
  rankEl.textContent = side.rank != null ? rankLabel(side.rank) : '—';
  rankEl.style.color = accent;
  nameEl.textContent = side.name;
  seasonEl.textContent = seasonLabelText(season);
}

function renderDossierSingle(side) {
  paintDossierSide(side, '');
  applyDossierCompareChrome(false);

  const readouts = document.getElementById('dossier-readouts');
  const trend = document.getElementById('dossier-trend');
  const seasonsList = document.getElementById('dossier-seasons-list');
  if (!readouts || !trend || !seasonsList) return false;

  const recentView = filterRecentByMode(side.recent);
  applyViewStats(side, recentView);
  const recentPoints = recentView.map((m) => m.points);
  const delta = trendDeltaLabel(recentPoints);
  const matchesLabel = side.matches != null ? String(side.matches) : '—';
  const careerMatches = String(side.matchesPlayed);
  const modeSub = dossierMatchMode !== 'all'
    ? `${recentView.length} en ${modeLabel(dossierMatchMode)}`
    : `Carrera ${careerMatches}`;

  readouts.innerHTML = `
    <div class="dossier-readout">
      <span class="dossier-readout__label">Puntos</span>
      <span class="dossier-readout__value">${side.points.toLocaleString('es')}</span>
    </div>
    <div class="dossier-readout">
      <span class="dossier-readout__label">Partidas</span>
      <span class="dossier-readout__value">${matchesLabel}</span>
      <span class="dossier-readout__sub">${escapeHtml(modeSub)}</span>
    </div>
    <div class="dossier-readout">
      <span class="dossier-readout__label">Mejor puesto</span>
      <span class="dossier-readout__value">${side.bestRank != null ? rankLabel(side.bestRank) : '—'}</span>
    </div>
    <div class="dossier-readout">
      <span class="dossier-readout__label">Tendencia</span>
      <span class="dossier-readout__value dossier-readout__value--trend dossier-readout__value--trend-${delta.tone}">${escapeHtml(delta.label)}</span>
      <span class="dossier-readout__sub">${escapeHtml(delta.text)}</span>
    </div>
    <div class="dossier-readout">
      <span class="dossier-readout__label">Mejor partida</span>
      <span class="dossier-readout__value">${side.bestGame != null ? side.bestGame.toLocaleString('es') : '—'}</span>
    </div>
    <div class="dossier-readout">
      <span class="dossier-readout__label">Media</span>
      <span class="dossier-readout__value">${side.avgPoints != null ? side.avgPoints.toFixed(1) : '—'}</span>
    </div>
    <div class="dossier-readout">
      <span class="dossier-readout__label">Part./semana</span>
      <span class="dossier-readout__value">${side.matchesPerWeek != null ? Number(side.matchesPerWeek).toFixed(1) : '—'}</span>
    </div>
    <div class="dossier-readout">
      <span class="dossier-readout__label">Winrate eq.</span>
      <span class="dossier-readout__value">${escapeHtml(formatWinRate(side.winRate))}</span>
      <span class="dossier-readout__sub">${side.teamMatches || 0} part. equipos</span>
    </div>
  `;

  trend.innerHTML = `
    <p class="dossier-trend__title">Partidas de la temporada</p>
    <p class="dossier-trend__axes">Y puntos · X partidas</p>
    ${modeFilterMarkup()}
    ${buildSparklineSvg(recentView)}
    <div class="dossier-trend__tip" hidden></div>
  `;
  wireSparklineTips(trend);
  scheduleSparklineLayout(trend, (width, height) => buildSparklineSvg(recentView, null, null, width, height));

  const bySeason = side.bySeason.length ? side.bySeason : [{
    seasonId: selectedSeasonId,
    points: side.points,
    rank: side.rank,
    matches: side.matches
  }];

  seasonsList.innerHTML = bySeason.map((entry) => {
    const seasonMeta = getSeasonById(entry.seasonId);
    const label = seasonMeta ? shortSeasonLabel(seasonMeta) : `Temporada ${entry.seasonId}`;
    const matchesText = entry.matches != null ? entry.matches : '—';
    const rankText = entry.rank != null ? rankLabel(entry.rank) : '—';
    return `
      <div class="dossier-season-row${entry.seasonId === selectedSeasonId ? ' is-current' : ''}">
        <span class="dossier-season-row__id">T${String(entry.seasonId).padStart(2, '0')}</span>
        <span class="dossier-season-row__label">${escapeHtml(label)}</span>
        <span class="dossier-season-row__stat">${Number(entry.points || 0).toLocaleString('es')} pts</span>
        <span class="dossier-season-row__stat">${rankText}</span>
        <span class="dossier-season-row__stat">${matchesText} part.</span>
      </div>
    `;
  }).join('');

  return true;
}

function renderDossierCompare(alpha, bravo) {
  paintDossierSide(alpha, '');
  paintDossierSide(bravo, 'b');
  applyDossierCompareChrome(true);

  const readouts = document.getElementById('dossier-readouts');
  const trend = document.getElementById('dossier-trend');
  const seasonsList = document.getElementById('dossier-seasons-list');
  if (!readouts || !trend || !seasonsList) return false;

  const recentA = filterRecentByMode(alpha.recent);
  const recentB = filterRecentByMode(bravo.recent);
  applyViewStats(alpha, recentA);
  applyViewStats(bravo, recentB);

  const pairs = sharedMatchPairs(recentA, recentB);
  const canH2h = recentA.some((m) => m.matchId) && recentB.some((m) => m.matchId);
  const useShared = pairs.length >= 2;
  if (canH2h) {
    alpha.h2hCount = pairs.length;
    bravo.h2hCount = pairs.length;
    alpha.h2hPoints = pairs.reduce((sum, p) => sum + (Number(p.a.points) || 0), 0);
    bravo.h2hPoints = pairs.reduce((sum, p) => sum + (Number(p.b.points) || 0), 0);
  }

  const chartA = useShared ? pairs.map((p) => p.a) : recentA;
  const chartB = useShared ? pairs.map((p) => p.b) : recentB;
  const names = { a: alpha.name, b: bravo.name };

  const metrics = COMPARE_METRICS.filter((metric) => {
    if (metric.key === 'winRate') {
      return alpha.teamMatches > 0 || bravo.teamMatches > 0 || dossierMatchMode === 'equipos';
    }
    if (metric.key === 'h2hCount' || metric.key === 'h2hPoints') return canH2h;
    return true;
  });

  readouts.innerHTML = metrics.map((metric) => {
    const aVal = alpha[metric.key];
    const bVal = bravo[metric.key];
    const winner = metricWinner(aVal, bVal, metric.better);
    const delta = formatMetricDelta(aVal, bVal, metric.better);
    return `
      <div class="compare-metric is-win-${winner}">
        <span class="compare-metric__label">${escapeHtml(metric.label)}</span>
        <span class="compare-metric__value compare-metric__value--a">${escapeHtml(metric.format(aVal))}</span>
        <span class="compare-metric__delta">${escapeHtml(delta)}</span>
        <span class="compare-metric__value compare-metric__value--b">${escapeHtml(metric.format(bVal))}</span>
      </div>
    `;
  }).join('');

  const chart = buildSparklineSvg(chartA, chartB, names);
  const drewAny = chartA.length >= 2 || chartB.length >= 2;
  const emptyA = drewAny && chartA.length < 2
    ? `<p class="dossier-trend__empty">${escapeHtml(alpha.name)}: sin historial reciente</p>`
    : '';
  const emptyB = drewAny && chartB.length < 2
    ? `<p class="dossier-trend__empty">${escapeHtml(bravo.name)}: sin historial reciente</p>`
    : '';
  const h2hNote = canH2h && pairs.length < 2
    ? '<p class="dossier-trend__empty">Sin partidas en común</p>'
    : '';
  const title = useShared ? 'Enfrentamientos compartidos' : 'Partidas de la temporada';

  trend.innerHTML = `
    <p class="dossier-trend__title">${title}</p>
    <p class="dossier-trend__axes">Y puntos · X partidas</p>
    ${modeFilterMarkup()}
    <p class="dossier-trend__legend">
      <span class="dossier-trend__legend-item dossier-trend__legend-item--alpha">${escapeHtml(alpha.name)}</span>
      <span class="dossier-trend__legend-item dossier-trend__legend-item--bravo">${escapeHtml(bravo.name)}</span>
    </p>
    ${chart}
    <div class="dossier-trend__tip" hidden></div>
    ${h2hNote}${emptyA}${emptyB}
  `;
  wireSparklineTips(trend);
  scheduleSparklineLayout(trend, (width, height) => buildSparklineSvg(chartA, chartB, names, width, height));

  const seasonIds = new Set();
  [...alpha.bySeason, ...bravo.bySeason].forEach((entry) => {
    if (entry && entry.seasonId != null) seasonIds.add(Number(entry.seasonId));
  });
  if (!seasonIds.size) seasonIds.add(selectedSeasonId);

  const orderedIds = [...seasonIds].sort((a, b) => a - b);
  seasonsList.innerHTML = orderedIds.map((seasonId) => {
    const seasonMeta = getSeasonById(seasonId);
    const label = seasonMeta ? shortSeasonLabel(seasonMeta) : `Temporada ${seasonId}`;
    const aEntry = alpha.bySeason.find((s) => s.seasonId === seasonId);
    const bEntry = bravo.bySeason.find((s) => s.seasonId === seasonId);
    const aPts = Number(aEntry?.points || 0).toLocaleString('es');
    const bPts = Number(bEntry?.points || 0).toLocaleString('es');
    const aRank = aEntry?.rank != null ? rankLabel(aEntry.rank) : '—';
    const bRank = bEntry?.rank != null ? rankLabel(bEntry.rank) : '—';
    const aMatches = aEntry?.matches != null ? aEntry.matches : '—';
    const bMatches = bEntry?.matches != null ? bEntry.matches : '—';
    return `
      <div class="dossier-season-row dossier-season-row--compare${seasonId === selectedSeasonId ? ' is-current' : ''}">
        <span class="dossier-season-row__id">T${String(seasonId).padStart(2, '0')}</span>
        <span class="dossier-season-row__label">${escapeHtml(label)}</span>
        <span class="dossier-season-row__pair dossier-season-row__pair--a">${aPts} pts · ${aRank} · ${aMatches} part.</span>
        <span class="dossier-season-row__pair dossier-season-row__pair--b">${bPts} pts · ${bRank} · ${bMatches} part.</span>
      </div>
    `;
  }).join('');

  return true;
}

function renderPlayerDossier(name) {
  const alpha = getCompareSide(name);
  if (!alpha) return false;

  let rival = null;
  if (compareRivalName) {
    rival = getCompareSide(compareRivalName);
    if (!rival || normalizePlayerName(rival.name) === normalizePlayerName(alpha.name)) {
      compareRivalName = null;
      rival = null;
    } else {
      compareRivalName = rival.name;
    }
  }

  return rival ? renderDossierCompare(alpha, rival) : renderDossierSingle(alpha);
}

function tryConfirmRival(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    setComparePickerError('Elige un gamertag del registro.');
    return false;
  }
  const resolved = resolvePlayerRef(value);
  if (!resolved) {
    setComparePickerError('Ese gamertag no está en el registro.');
    return false;
  }
  if (normalizePlayerName(resolved.name) === normalizePlayerName(openDossierName)) {
    setComparePickerError('Elige un Spartan distinto.');
    return false;
  }

  compareRivalName = resolved.name;
  finishCloseComparePicker();
  const ok = renderPlayerDossier(openDossierName);
  if (!ok) {
    compareRivalName = null;
    return false;
  }
  syncUrlState();
  return true;
}

function clearCompareRival() {
  compareRivalName = null;
  closeComparePicker();
  if (!openDossierName) return;
  renderPlayerDossier(openDossierName);
  syncUrlState();
  const toggle = document.getElementById('dossier-compare-toggle');
  requestAnimationFrame(() => {
    try {
      if (toggle) toggle.focus();
    } catch (_) {
      /* ignore */
    }
  });
}

function restartHoloBoot(dossier) {
  const frame = dossier.querySelector('.player-dossier__frame');
  dossier.classList.remove('is-holo-collapse', 'is-holo-live', 'is-holo-boot');
  if (frame) void frame.offsetWidth;

  if (holoBootTimer) {
    clearTimeout(holoBootTimer);
    holoBootTimer = null;
  }

  const bootMs = holoBootDurationMs();
  if (bootMs <= 0) {
    dossier.classList.add('is-holo-live');
    return;
  }

  dossier.classList.add('is-holo-boot');
  holoBootTimer = setTimeout(() => {
    dossier.classList.add('is-holo-live');
    holoBootTimer = null;
  }, bootMs);
}

function teardownPlayerDossier() {
  const dossier = document.getElementById('player-dossier');
  if (holoBootTimer) {
    clearTimeout(holoBootTimer);
    holoBootTimer = null;
  }
  if (holoCollapseTimer) {
    clearTimeout(holoCollapseTimer);
    holoCollapseTimer = null;
  }

  sparklineTipsAbort?.abort();
  sparklineTipsAbort = null;
  disconnectSparklineLayout();
  dossierMatchMode = 'all';

  if (dossier) {
    dossier.hidden = true;
    dossier.classList.remove('is-holo-boot', 'is-holo-live', 'is-holo-collapse');
  }
  document.body.classList.remove('is-dossier-open');
  compareRivalName = null;
  openDossierName = null;
  dossierClosing = false;
  finishCloseComparePicker();
  applyDossierCompareChrome(false);
  syncUrlState({ player: null, rival: null });
  clearPlayerHighlights();

  const last = dossierLastFocus;
  dossierLastFocus = null;

  if (last && last.classList && last.classList.contains('spartan-row')) {
    if (typeof last.blur === 'function') {
      last.blur();
    }
    const stack = document.getElementById('ranking-stack');
    if (stack) {
      try {
        stack.focus({ preventScroll: true });
      } catch (_) {
        /* ignore */
      }
    }
    return;
  }

  if (last && typeof last.focus === 'function') {
    try {
      last.focus();
    } catch (_) {
      /* ignore */
    }
  }
}

function openPlayerDossier(name, options = {}) {
  const dossier = document.getElementById('player-dossier');
  if (!dossier) return;

  if (dossierClosing) {
    teardownPlayerDossier();
  }

  const exists = resolvePlayerRef(name);
  if (!exists) return;

  const alreadyOpen = !dossier.hidden;
  if (!alreadyOpen) {
    dossierLastFocus = document.activeElement;
  }

  const nextName = exists.name || name;
  if (Object.prototype.hasOwnProperty.call(options, 'rival')) {
    const rival = options.rival ? resolvePlayerRef(options.rival) : null;
    compareRivalName = rival && normalizePlayerName(rival.name) !== normalizePlayerName(nextName)
      ? rival.name
      : null;
  } else if (!alreadyOpen) {
    compareRivalName = null;
  }

  openDossierName = nextName;
  if (!alreadyOpen) dossierMatchMode = 'all';
  const ok = renderPlayerDossier(openDossierName);
  if (!ok) {
    openDossierName = null;
    compareRivalName = null;
    return;
  }

  dossier.hidden = false;
  document.body.classList.add('is-dossier-open');
  syncUrlState();
  clearPlayerHighlights();
  restartHoloBoot(dossier);

  const closeBtn = document.getElementById('dossier-close');
  requestAnimationFrame(() => {
    try {
      (closeBtn || dossier).focus();
    } catch (_) {
      /* ignore */
    }
  });
}

function closePlayerDossier() {
  const dossier = document.getElementById('player-dossier');
  if (!dossier || dossier.hidden || dossierClosing) return;

  if (prefersReducedMotion()) {
    teardownPlayerDossier();
    return;
  }

  dossierClosing = true;
  if (holoBootTimer) {
    clearTimeout(holoBootTimer);
    holoBootTimer = null;
  }

  const frame = dossier.querySelector('.player-dossier__frame');
  dossier.classList.remove('is-holo-boot', 'is-holo-live');
  if (frame) void frame.offsetWidth;
  dossier.classList.add('is-holo-collapse');

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (frame) frame.removeEventListener('animationend', onCollapseEnd);
    teardownPlayerDossier();
  };

  const onCollapseEnd = (event) => {
    if (event.target !== frame) return;
    if (event.animationName !== 'holoCollapseFrame') return;
    finish();
  };

  if (frame) frame.addEventListener('animationend', onCollapseEnd);
  holoCollapseTimer = setTimeout(finish, HOLO_COLLAPSE_MS);
}

function initPlayerDossier() {
  const closeBtn = document.getElementById('dossier-close');
  const backdrop = document.getElementById('dossier-backdrop');
  const toggle = document.getElementById('dossier-compare-toggle');
  const clearBtn = document.getElementById('dossier-clear-rival');
  const input = document.getElementById('dossier-compare-input');
  const list = document.getElementById('compare-listbox');
  const trend = document.getElementById('dossier-trend');

  if (closeBtn) closeBtn.addEventListener('click', () => closePlayerDossier());
  if (backdrop) backdrop.addEventListener('click', () => closePlayerDossier());
  if (clearBtn) clearBtn.addEventListener('click', () => clearCompareRival());

  if (trend) {
    trend.addEventListener('click', (event) => {
      const button = event.target.closest('[data-match-mode]');
      if (!button || !trend.contains(button)) return;
      const next = button.getAttribute('data-match-mode');
      if (!next || next === dossierMatchMode) return;
      dossierMatchMode = next;
      if (openDossierName) renderPlayerDossier(openDossierName);
    });
  }

  if (toggle) {
    toggle.addEventListener('click', () => {
      if (isComparePickerOpen()) closeComparePicker();
      else openComparePicker();
    });
  }

  if (list) {
    list.addEventListener('click', (event) => {
      const option = event.target.closest('[role="option"]');
      if (!option || !list.contains(option)) return;
      event.preventDefault();
      tryConfirmRival(option.getAttribute('data-name'));
    });
  }

  if (input) {
    input.addEventListener('input', () => {
      if (!isComparePickerOpen()) return;
      setComparePickerError('');
      renderCompareList(input.value);
    });
    input.addEventListener('keydown', (event) => {
      if (!isComparePickerOpen()) return;
      const options = list ? list.querySelectorAll('[role="option"]') : [];
      const count = options.length;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!count) return;
        const next = compareListActiveIndex < 0 ? 0 : compareListActiveIndex + 1;
        setCompareListActive(next >= count ? 0 : next);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!count) return;
        const prev = compareListActiveIndex < 0 ? count - 1 : compareListActiveIndex - 1;
        setCompareListActive(prev < 0 ? count - 1 : prev);
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        if (count) setCompareListActive(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        if (count) setCompareListActive(count - 1);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        confirmCompareFromKeyboard(input.value);
      }
    });
  }
}

/**
 * @param {{ skip?: boolean }} [options]
 */
function runBootSequence(options = {}) {
  const screen = document.getElementById('boot-screen');
  if (!screen) return;

  if (options.skip || prefersReducedMotion()) {
    screen.classList.add('hidden');
    return;
  }

  const status = document.getElementById('boot-status');
  const messages = ['Sincronizando ranking...', 'Listo.'];
  let i = 0;
  status.textContent = messages[0];

  const interval = setInterval(() => {
    i += 1;
    if (i < messages.length) status.textContent = messages[i];
  }, 180);

  setTimeout(() => {
    clearInterval(interval);
    screen.classList.add('hidden');
  }, 400);
}

document.addEventListener('DOMContentLoaded', () => {
  selectedSeasonId = resolveInitialSeasonId();

  const comparePair = getComparePairFromUrl();
  const compareAlpha = comparePair ? resolvePlayerRef(comparePair.a) : null;
  const compareBravo = comparePair ? resolvePlayerRef(comparePair.b) : null;
  const compareReady = Boolean(
    compareAlpha &&
    compareBravo &&
    normalizePlayerName(compareAlpha.name) !== normalizePlayerName(compareBravo.name)
  );

  const highlightName = getHighlightedPlayerName();
  const highlightExists = Boolean(
    highlightName &&
    getCurrentPlayers().some(
      (p) => normalizePlayerName(p.name) === normalizePlayerName(highlightName)
    )
  );

  runBootSequence({ skip: compareReady || highlightExists });
  initParticles();
  initSeasonSelector();
  initPlayerDossier();
  initRankingMetricToggle();
  renderRanking();
  renderStats();
  initNavigation();
  updateTimestamp();
  updateSeasonChrome();
  if (compareReady) {
    openPlayerDossier(compareAlpha.name, { rival: compareBravo.name });
  } else if (highlightExists) {
    openPlayerDossier(highlightName);
  } else {
    highlightPlayer(highlightName);
  }
});
