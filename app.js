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
const HOLO_UNPRINT_MS = 700;
const HOLO_UNPRINT_MOBILE_MS = 460;
const COMPARE_FIELD_MS = 340;
const RANK_REVEAL_MAX_STAGGER = 11;
const ZERO_REVEAL_MAX_STAGGER = 8;

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
          points: Number(m.points) || 0
        }))
      : [],
    bySeason: Array.isArray(profile.bySeason)
      ? profile.bySeason.map((s) => ({
          seasonId: Number(s.seasonId),
          points: Number(s.points) || 0,
          rank: s.rank != null ? Number(s.rank) : null,
          matches: s.matches != null ? Number(s.matches) : null
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

function holoUnprintDurationMs() {
  if (prefersReducedMotion()) return 0;
  return isCoarsePointer() || isMobileViewport() ? HOLO_UNPRINT_MOBILE_MS : HOLO_UNPRINT_MS;
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
 * @param {{ id: number, name: string, rank: number, points: number }} p
 * @param {{ variant?: 'hero' | 'row', gapOverNext?: number, nextRank?: number, index?: number }} [options]
 */
function renderSpartanRow(p, options = {}) {
  const variant = options.variant || 'row';
  const accent = accentForRank(p.rank);
  const name = escapeHtml(p.name);
  const isHero = variant === 'hero';
  const rowIndex = Number.isFinite(options.index) ? options.index : 0;
  const classes = [
    'spartan-row',
    `rank-${p.rank}`,
    isHero ? 'spartan-row--hero' : '',
    p.points <= 0 ? 'spartan-row--standby' : '',
    'spartan-row--interactive'
  ].filter(Boolean).join(' ');

  const gap = options.gapOverNext;
  const nextRank = options.nextRank;
  const gapLine = isHero && typeof gap === 'number' && gap > 0 && nextRank != null
    ? `<p class="spartan-row__gap">Ventaja +${gap.toLocaleString('es')} sobre el ${nextRank}º</p>`
    : '';

  const pointsUnit = isHero
    ? `<span class="spartan-row__points-unit">pts</span>`
    : '';

  return `
    <article
      class="${classes}"
      style="--row-accent: ${accent}; --row-i: ${rowIndex}"
      data-id="${p.id}"
      data-name="${name}"
      role="listitem"
      tabindex="0"
      aria-label="${name}, puesto ${p.rank}, ${p.points} puntos. Abrir ficha."
    >
      <div class="spartan-row__glow" aria-hidden="true"></div>
      <div class="spartan-row__scan" aria-hidden="true"></div>
      <div class="spartan-row__rank">${rankLabel(p.rank)}</div>
      <div class="spartan-row__identity">
        <p class="spartan-row__name">${name}</p>
        ${gapLine}
      </div>
      <div class="spartan-row__points">
        <span class="spartan-row__points-value">${p.points.toLocaleString('es')}</span>
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

  if (match.points <= 0) {
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

function renderRanking() {
  const stack = document.getElementById('ranking-stack');
  const players = getCurrentPlayers();

  if (!players.length) {
    stack.innerHTML = `
      <div class="ranking-empty" role="status">
        Sin jugadores en el ranking de esta temporada.
      </div>
    `;
    return;
  }

  const withPoints = players.filter(p => p.points > 0);
  const zeroPoints = players.filter(p => p.points <= 0);
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
          index
        }
      : { variant: 'row', index }
    );
  });

  if (zeroPoints.length) {
    const zeroRows = zeroPoints.map((p, index) => renderSpartanRow(p, { index })).join('');
    html += `
      <div class="zero-group" role="listitem" style="--row-i: ${withPoints.length}">
        <button
          type="button"
          class="zero-group__toggle"
          id="zero-group-toggle"
          aria-expanded="false"
          aria-controls="zero-group-list"
        >
          <span class="zero-group__label">Sin puntos aún (${zeroPoints.length})</span>
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
            ${zeroRows}
          </div>
        </div>
      </div>
    `;
  }

  if (hasTiedRanks(players)) {
    html += `
      <p class="ranking-tie-hint" role="status">
        Puestos iguales = mismos puntos.
      </p>
    `;
  }

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

function updateTimestamp() {
  const el = document.getElementById('last-updated');
  if (!el) return;
  const date = new Date(squadData.lastUpdated);
  el.textContent = Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
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
let holoUnprintTimer = null;
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
  if (!items.length) return [];
  if (items.length === 1) return [items[0]];
  if (items.length === 2) return [items[0], items[items.length - 1]];
  const mid = items[Math.floor((items.length - 1) / 2)];
  return [items[0], mid, items[items.length - 1]];
}

function matchRows(matches) {
  return (matches || []).map((m) => ({
    points: Number(m && m.points) || 0,
    at: m && m.at ? m.at : null,
    time: (() => {
      if (!m || !m.at) return null;
      const t = new Date(m.at).getTime();
      return Number.isNaN(t) ? null : t;
    })()
  }));
}

function sparklineCoords(rows, min, span, minT, spanT, padL, padT, plotW, plotH) {
  const useTime = minT != null && spanT > 0;
  return rows.map((row, index) => {
    let x;
    if (useTime && row.time != null) {
      x = padL + ((row.time - minT) / spanT) * plotW;
    } else if (rows.length < 2) {
      x = padL + plotW / 2;
    } else {
      x = padL + (index / (rows.length - 1)) * plotW;
    }
    const y = padT + plotH - ((row.points - min) / span) * plotH;
    return { x, y, points: row.points, at: row.at };
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

/**
 * @param {object[]} matches
 * @param {object[]|null} [secondMatches]
 */
function buildSparklineSvg(matches, secondMatches) {
  const rowsA = matchRows(matches);
  const rowsB = secondMatches == null ? null : matchRows(secondMatches);
  const dual = rowsB != null;
  const canDrawA = rowsA.length >= 2;
  const canDrawB = dual && rowsB.length >= 2;

  if (!canDrawA && !canDrawB) {
    return '<p class="dossier-trend__empty">Sin historial reciente</p>';
  }

  const width = dual ? 480 : 320;
  const height = 92;
  const padL = 30;
  const padR = 10;
  const padT = 10;
  const padB = 22;
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

  const times = [
    ...(canDrawA ? rowsA : []),
    ...(canDrawB ? rowsB : [])
  ].map((r) => r.time).filter((t) => t != null);
  const minT = times.length ? Math.min(...times) : null;
  const maxT = times.length ? Math.max(...times) : null;
  const spanT = minT != null && maxT != null ? Math.max(maxT - minT, 1) : 0;

  const coordsA = canDrawA
    ? sparklineCoords(rowsA, min, span, minT, spanT, padL, padT, plotW, plotH)
    : [];
  const coordsB = canDrawB
    ? sparklineCoords(rowsB, min, span, minT, spanT, padL, padT, plotW, plotH)
    : [];

  const yTicks = min === max
    ? [{ value: max, y: padT + plotH / 2 }]
    : [
        { value: max, y: padT },
        { value: yMid, y: padT + plotH / 2 },
        { value: min, y: padT + plotH }
      ];

  const xSource = [...coordsA, ...coordsB].sort((a, b) => a.x - b.x);
  const xTicks = pickAxisLabels(xSource);

  const yLabels = yTicks.map((tick) => `
    <text class="dossier-trend__label dossier-trend__label--y" x="${padL - 4}" y="${tick.y + 3}" text-anchor="end">${tick.value.toLocaleString('es')}</text>
    <line class="dossier-trend__grid" x1="${padL}" y1="${tick.y}" x2="${width - padR}" y2="${tick.y}" />
  `).join('');

  const xLabels = xTicks.map((tick) => `
    <text class="dossier-trend__label dossier-trend__label--x" x="${tick.x.toFixed(1)}" y="${height - 6}" text-anchor="middle">${escapeHtml(formatMatchAxisLabel(tick.at))}</text>
  `).join('');

  const lineA = polylineMarkup(
    coordsA,
    dual ? 'dossier-trend__line dossier-trend__line--alpha' : '',
    dual ? 'var(--halo-cyan)' : 'currentColor'
  );
  const lineB = polylineMarkup(
    coordsB,
    'dossier-trend__line dossier-trend__line--bravo',
    'var(--halo-rival)'
  );

  return `
    <svg class="dossier-trend__svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Últimas partidas: eje Y puntos ${min} a ${max}, eje X tiempo">
      ${yLabels}
      <line class="dossier-trend__axis" x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" />
      <line class="dossier-trend__axis" x1="${padL}" y1="${padT + plotH}" x2="${width - padR}" y2="${padT + plotH}" />
      ${lineA}
      ${lineB}
      ${xLabels}
    </svg>
  `;
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
  return (squadData.profiles || []).length > 1;
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
    .slice()
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));

  return {
    name: seasonPlayer?.name || profile?.name || name,
    rank,
    points,
    matches: seasonStats && seasonStats.matches != null ? seasonStats.matches : null,
    bestRank: profile?.bestRank ?? rank,
    careerPoints: profile ? Number(profile.careerPoints) || 0 : 0,
    matchesPlayed: profile ? Number(profile.matchesPlayed) || 0 : 0,
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
  const slotAlpha = document.getElementById('dossier-slot-alpha');
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
  if (slotAlpha) slotAlpha.hidden = !isCompare;
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

  const slotEl = document.getElementById(suffix === 'b' ? 'dossier-slot-bravo' : 'dossier-slot-alpha');
  if (slotEl) slotEl.textContent = side.name;
}

function renderDossierSingle(side) {
  paintDossierSide(side, '');
  applyDossierCompareChrome(false);

  const readouts = document.getElementById('dossier-readouts');
  const trend = document.getElementById('dossier-trend');
  const seasonsList = document.getElementById('dossier-seasons-list');
  if (!readouts || !trend || !seasonsList) return false;

  const recentPoints = side.recent.map((m) => m.points);
  const delta = trendDeltaLabel(recentPoints);
  const matchesLabel = side.matches != null ? String(side.matches) : '—';
  const careerMatches = String(side.matchesPlayed);

  readouts.innerHTML = `
    <div class="dossier-readout">
      <span class="dossier-readout__label">Puntos</span>
      <span class="dossier-readout__value">${side.points.toLocaleString('es')}</span>
    </div>
    <div class="dossier-readout">
      <span class="dossier-readout__label">Partidas</span>
      <span class="dossier-readout__value">${matchesLabel}</span>
      <span class="dossier-readout__sub">Carrera ${careerMatches}</span>
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
  `;

  trend.innerHTML = `
    <p class="dossier-trend__title">Últimas partidas</p>
    <p class="dossier-trend__axes">Y puntos · X tiempo</p>
    ${buildSparklineSvg(side.recent)}
  `;

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

  readouts.innerHTML = COMPARE_METRICS.map((metric) => {
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

  const chart = buildSparklineSvg(alpha.recent, bravo.recent);
  const drewAny = alpha.recent.length >= 2 || bravo.recent.length >= 2;
  const emptyA = drewAny && alpha.recent.length < 2
    ? `<p class="dossier-trend__empty">${escapeHtml(alpha.name)}: sin historial reciente</p>`
    : '';
  const emptyB = drewAny && bravo.recent.length < 2
    ? `<p class="dossier-trend__empty">${escapeHtml(bravo.name)}: sin historial reciente</p>`
    : '';

  trend.innerHTML = `
    <p class="dossier-trend__title">Últimas partidas</p>
    <p class="dossier-trend__axes">Y puntos · X tiempo</p>
    <p class="dossier-trend__legend">
      <span class="dossier-trend__legend-item dossier-trend__legend-item--alpha">${escapeHtml(alpha.name)}</span>
      <span class="dossier-trend__legend-item dossier-trend__legend-item--bravo">${escapeHtml(bravo.name)}</span>
    </p>
    ${chart}
    ${emptyA}${emptyB}
  `;

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
  dossier.classList.remove('is-holo-collapse', 'is-holo-live', 'is-holo-boot', 'is-holo-unprint');
  if (frame) void frame.offsetWidth;

  if (holoBootTimer) {
    clearTimeout(holoBootTimer);
    holoBootTimer = null;
  }
  if (holoUnprintTimer) {
    clearTimeout(holoUnprintTimer);
    holoUnprintTimer = null;
  }
  if (holoCollapseTimer) {
    clearTimeout(holoCollapseTimer);
    holoCollapseTimer = null;
  }
  if (bootMs <= 0) {
    dossier.classList.add('is-holo-live');
    return;
  }

  dossier.classList.add('is-holo-boot');
  holoBootTimer = setTimeout(() => {
    // Keep is-holo-boot so holoBootFrame is not cancelled. Replacing that
    // scaleY animation with holoFlicker flashes the from-keyframe (collapsed).
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
  if (holoUnprintTimer) {
    clearTimeout(holoUnprintTimer);
    holoUnprintTimer = null;
  }
  if (holoCollapseTimer) {
    clearTimeout(holoCollapseTimer);
    holoCollapseTimer = null;
  }

  if (dossier) {
    dossier.hidden = true;
    dossier.classList.remove('is-holo-boot', 'is-holo-live', 'is-holo-collapse', 'is-holo-unprint');
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
  if (!dossier || dossierClosing) return;

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

  finishCloseComparePicker();

  if (prefersReducedMotion()) {
    teardownPlayerDossier();
    return;
  }

  dossierClosing = true;
  if (holoBootTimer) {
    clearTimeout(holoBootTimer);
    holoBootTimer = null;
  }
  if (holoUnprintTimer) {
    clearTimeout(holoUnprintTimer);
    holoUnprintTimer = null;
  }
  if (holoCollapseTimer) {
    clearTimeout(holoCollapseTimer);
    holoCollapseTimer = null;
  }

  const frame = dossier.querySelector('.player-dossier__frame');
  dossier.classList.remove('is-holo-boot', 'is-holo-live', 'is-holo-collapse');
  if (frame) void frame.offsetWidth;
  dossier.classList.add('is-holo-unprint');

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

  const startFrameCollapse = () => {
    holoUnprintTimer = null;
    dossier.classList.add('is-holo-collapse');
    if (frame) frame.addEventListener('animationend', onCollapseEnd);
    holoCollapseTimer = setTimeout(finish, HOLO_COLLAPSE_MS);
  };

  holoUnprintTimer = setTimeout(startFrameCollapse, holoUnprintDurationMs());
}

function initPlayerDossier() {
  const closeBtn = document.getElementById('dossier-close');
  const backdrop = document.getElementById('dossier-backdrop');
  const toggle = document.getElementById('dossier-compare-toggle');
  const clearBtn = document.getElementById('dossier-clear-rival');
  const input = document.getElementById('dossier-compare-input');
  const list = document.getElementById('compare-listbox');

  if (closeBtn) closeBtn.addEventListener('click', () => closePlayerDossier());
  if (backdrop) backdrop.addEventListener('click', () => closePlayerDossier());
  if (clearBtn) clearBtn.addEventListener('click', () => clearCompareRival());

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
