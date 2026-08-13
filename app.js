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
  const spartanCount = players.length;
  const withPoints = players.filter(p => p.points > 0);
  const leader = withPoints[0] || null;
  const second = withPoints[1] || null;
  const leaderPoints = leader ? leader.points : 0;
  const totalPoints = players.reduce((sum, p) => sum + p.points, 0);
  const gapToSecond = leader && second ? leader.points - second.points : 0;
  const avgPoints = withPoints.length
    ? Math.round(totalPoints / withPoints.length)
    : 0;

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><span class="stat-value">${spartanCount}</span><span class="stat-label">SPARTANS</span></div>
    <div class="stat-card"><span class="stat-value">${leaderPoints.toLocaleString('es')}</span><span class="stat-label">PUNTOS LÍDER</span></div>
    <div class="stat-card"><span class="stat-value">${totalPoints.toLocaleString('es')}</span><span class="stat-label">PUNTOS TOTALES</span></div>
    <div class="stat-card"><span class="stat-value">${gapToSecond.toLocaleString('es')}</span><span class="stat-label">VENTAJA SOBRE EL 2º</span></div>
    <div class="stat-card"><span class="stat-value">${avgPoints.toLocaleString('es')}</span><span class="stat-label">MEDIA DE PUNTOS</span></div>
  `;

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
/** @type {Element|null} */
let dossierLastFocus = null;
let dossierClosing = false;
/** @type {ReturnType<typeof setTimeout> | null} */
let holoBootTimer = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let holoCollapseTimer = null;

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

function syncUrlState({ player = openDossierName, seasonId = selectedSeasonId } = {}) {
  try {
    const url = new URL(window.location.href);
    if (seasonId != null) url.searchParams.set('season', String(seasonId));
    else url.searchParams.delete('season');

    if (player) url.searchParams.set('player', player);
    else url.searchParams.delete('player');

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

function buildSparklineSvg(matches) {
  const rows = (matches || []).map((m) => ({
    points: Number(m && m.points) || 0,
    at: m && m.at ? m.at : null
  }));
  if (rows.length < 2) {
    return '<p class="dossier-trend__empty">Sin historial reciente</p>';
  }

  const width = 320;
  const height = 92;
  const padL = 30;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const values = rows.map((r) => r.points);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const yMid = min + (max - min) / 2;

  const coords = rows.map((row, index) => {
    const x = padL + (index / (rows.length - 1)) * plotW;
    const y = padT + plotH - ((row.points - min) / span) * plotH;
    return { x, y, points: row.points, at: row.at };
  });

  const yTicks = min === max
    ? [{ value: max, y: padT + plotH / 2 }]
    : [
        { value: max, y: padT },
        { value: yMid, y: padT + plotH / 2 },
        { value: min, y: padT + plotH }
      ];

  const xTicks = pickAxisLabels(coords);

  const yLabels = yTicks.map((tick) => `
    <text class="dossier-trend__label dossier-trend__label--y" x="${padL - 4}" y="${tick.y + 3}" text-anchor="end">${tick.value.toLocaleString('es')}</text>
    <line class="dossier-trend__grid" x1="${padL}" y1="${tick.y}" x2="${width - padR}" y2="${tick.y}" />
  `).join('');

  const xLabels = xTicks.map((tick) => `
    <text class="dossier-trend__label dossier-trend__label--x" x="${tick.x.toFixed(1)}" y="${height - 6}" text-anchor="middle">${escapeHtml(formatMatchAxisLabel(tick.at))}</text>
  `).join('');

  const pointsAttr = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  return `
    <svg class="dossier-trend__svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Últimas partidas: eje Y puntos ${min} a ${max}, eje X tiempo">
      ${yLabels}
      <line class="dossier-trend__axis" x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" />
      <line class="dossier-trend__axis" x1="${padL}" y1="${padT + plotH}" x2="${width - padR}" y2="${padT + plotH}" />
      <polyline
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        pathLength="1"
        points="${pointsAttr}"
      />
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

function renderPlayerDossier(name) {
  const profile = getProfileByName(name);
  const season = getSelectedSeason();
  const seasonPlayer = findPlayerInSeason(name, selectedSeasonId);
  if (!seasonPlayer && !profile) return false;

  const displayName = seasonPlayer?.name || profile?.name || name;
  const rank = seasonPlayer?.rank ?? null;
  const points = seasonPlayer?.points ?? 0;
  const bySeason = profile?.bySeason || [];
  const seasonStats = bySeason.find((s) => s.seasonId === selectedSeasonId) || null;
  const matchesSeason = seasonStats && seasonStats.matches != null ? seasonStats.matches : null;
  const bestRank = profile?.bestRank ?? rank;
  const recent = [...(profile?.recentMatches || [])]
    .slice()
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  const recentPoints = recent.map((m) => m.points);
  const delta = trendDeltaLabel(recentPoints);

  const rankEl = document.getElementById('dossier-rank');
  const nameEl = document.getElementById('dossier-name');
  const seasonEl = document.getElementById('dossier-season');
  const readouts = document.getElementById('dossier-readouts');
  const trend = document.getElementById('dossier-trend');
  const seasonsList = document.getElementById('dossier-seasons-list');
  if (!rankEl || !nameEl || !seasonEl || !readouts || !trend || !seasonsList) return false;

  const accent = accentForRank(rank || bestRank || 99);
  rankEl.textContent = rank != null ? rankLabel(rank) : '—';
  rankEl.style.color = accent;
  nameEl.textContent = displayName;
  seasonEl.textContent = season
    ? (season.active ? season.label : `${season.label} · Registro archivado`)
    : '—';

  const matchesLabel = matchesSeason != null
    ? String(matchesSeason)
    : '—';
  const careerMatches = profile ? String(profile.matchesPlayed) : '—';

  readouts.innerHTML = `
    <div class="dossier-readout">
      <span class="dossier-readout__label">Puntos</span>
      <span class="dossier-readout__value">${points.toLocaleString('es')}</span>
    </div>
    <div class="dossier-readout">
      <span class="dossier-readout__label">Partidas</span>
      <span class="dossier-readout__value">${matchesLabel}</span>
      <span class="dossier-readout__sub">Carrera ${careerMatches}</span>
    </div>
    <div class="dossier-readout">
      <span class="dossier-readout__label">Mejor puesto</span>
      <span class="dossier-readout__value">${bestRank != null ? rankLabel(bestRank) : '—'}</span>
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
    ${buildSparklineSvg(recent)}
  `;

  const seasonRows = (bySeason.length ? bySeason : [{
    seasonId: selectedSeasonId,
    points,
    rank,
    matches: matchesSeason
  }]).map((entry) => {
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

  seasonsList.innerHTML = seasonRows;
  return true;
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
  if (holoCollapseTimer) {
    clearTimeout(holoCollapseTimer);
    holoCollapseTimer = null;
  }

  if (dossier) {
    dossier.hidden = true;
    dossier.classList.remove('is-holo-boot', 'is-holo-live', 'is-holo-collapse');
  }
  document.body.classList.remove('is-dossier-open');
  openDossierName = null;
  dossierClosing = false;
  syncUrlState({ player: null });
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

function openPlayerDossier(name) {
  const dossier = document.getElementById('player-dossier');
  if (!dossier || dossierClosing) return;

  const exists = findPlayerInSeason(name, selectedSeasonId) || getProfileByName(name);
  if (!exists) return;

  const alreadyOpen = !dossier.hidden;
  if (!alreadyOpen) {
    dossierLastFocus = document.activeElement;
  }

  openDossierName = exists.name || name;
  const ok = renderPlayerDossier(openDossierName);
  if (!ok) {
    openDossierName = null;
    return;
  }

  dossier.hidden = false;
  document.body.classList.add('is-dossier-open');
  syncUrlState({ player: openDossierName });
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
  if (closeBtn) closeBtn.addEventListener('click', () => closePlayerDossier());
  if (backdrop) backdrop.addEventListener('click', () => closePlayerDossier());
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

  const highlightName = getHighlightedPlayerName();
  const highlightExists = Boolean(
    highlightName &&
    getCurrentPlayers().some(
      (p) => normalizePlayerName(p.name) === normalizePlayerName(highlightName)
    )
  );

  runBootSequence({ skip: highlightExists });
  initParticles();
  initSeasonSelector();
  initPlayerDossier();
  renderRanking();
  renderStats();
  initNavigation();
  updateTimestamp();
  updateSeasonChrome();
  if (highlightExists) {
    openPlayerDossier(highlightName);
  } else {
    highlightPlayer(highlightName);
  }
});
