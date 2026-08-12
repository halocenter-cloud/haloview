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

/**
 * Normaliza legacy (season + players) o shape multi-temporada.
 * @param {object} raw
 */
function normalizeSquadData(raw) {
  const source = raw || {};
  if (Array.isArray(source.seasons) && source.seasons.length > 0) {
    const seasons = source.seasons.map((s) => ({
      id: Number(s.id),
      label: s.label || `Temporada ${s.id}`,
      active: Boolean(s.active),
      fechaInicio: s.fechaInicio || null,
      fechaFin: s.fechaFin || null,
      players: Array.isArray(s.players) ? s.players : []
    }));
    const active = seasons.find((s) => s.active) || seasons[0];
    return {
      lastUpdated: source.lastUpdated || null,
      activeSeasonId: source.activeSeasonId != null
        ? Number(source.activeSeasonId)
        : active.id,
      season: source.season || active.label,
      players: Array.isArray(source.players) ? source.players : active.players,
      seasons
    };
  }

  const players = Array.isArray(source.players) ? source.players : [];
  const label = source.season || 'Temporada activa';
  return {
    lastUpdated: source.lastUpdated || null,
    activeSeasonId: 1,
    season: label,
    players,
    seasons: [
      {
        id: 1,
        label,
        active: true,
        fechaInicio: null,
        fechaFin: null,
        players
      }
    ]
  };
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
 * @param {{ variant?: 'hero' | 'row', gapOverNext?: number, nextRank?: number }} [options]
 */
function renderSpartanRow(p, options = {}) {
  const variant = options.variant || 'row';
  const accent = accentForRank(p.rank);
  const name = escapeHtml(p.name);
  const isHero = variant === 'hero';
  const classes = [
    'spartan-row',
    `rank-${p.rank}`,
    isHero ? 'spartan-row--hero' : ''
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
      style="--row-accent: ${accent}"
      data-id="${p.id}"
      data-name="${name}"
      role="listitem"
      aria-label="${name}, puesto ${p.rank}, ${p.points} puntos"
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
    paintFrame(true);
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

function wireZeroGroupToggle() {
  const toggle = document.getElementById('zero-group-toggle');
  const list = document.getElementById('zero-group-list');
  if (!toggle || !list) return;

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    list.hidden = expanded;
  });
}

function expandZeroGroup() {
  const toggle = document.getElementById('zero-group-toggle');
  const list = document.getElementById('zero-group-list');
  if (!toggle || !list) return;
  toggle.setAttribute('aria-expanded', 'true');
  list.hidden = false;
}

/**
 * Resalta la fila del jugador de la query y hace scroll.
 * @param {string|null} queryName
 */
function highlightPlayer(queryName) {
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
  row.setAttribute('tabindex', '0');

  const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
  requestAnimationFrame(() => {
    row.scrollIntoView({ block: 'center', behavior });
    try {
      row.focus({ preventScroll: true });
    } catch (_) {
      /* older browsers */
    }
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
          nextRank: next ? next.rank : undefined
        }
      : { variant: 'row' }
    );
  });

  if (zeroPoints.length) {
    const zeroRows = zeroPoints.map(p => renderSpartanRow(p)).join('');
    html += `
      <div class="zero-group" role="listitem">
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
        <div class="zero-group__list" id="zero-group-list" role="list" hidden>
          ${zeroRows}
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

  stack.innerHTML = html;
  wireZeroGroupToggle();
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
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      sections.forEach(section => {
        section.classList.remove('active');
        section.classList.remove('is-transitioning');
      });

      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
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

function updateSeasonChrome() {
  const season = getSelectedSeason();
  const labelEl = document.getElementById('season-banner-label');
  const chipEl = document.getElementById('season-archive-chip');
  const descEl = document.getElementById('season-section-desc');
  const trigger = document.getElementById('season-trigger');
  const isArchive = Boolean(season && !season.active);

  if (labelEl) {
    labelEl.textContent = season ? season.label : (squadData.season || 'Temporada');
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

  if (options.highlightName) {
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
    if (event.key === 'Escape' && isSeasonPanelOpen()) {
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
  renderRanking();
  renderStats();
  initNavigation();
  updateTimestamp();
  updateSeasonChrome();
  highlightPlayer(highlightName);
});
