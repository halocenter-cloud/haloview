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

const players = [...SQUAD_DATA.players].sort((a, b) => {
  if (a.rank !== b.rank) return a.rank - b.rank;
  if (b.points !== a.points) return b.points - a.points;
  return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
});

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

function renderSpartanRow(p) {
  const accent = accentForRank(p.rank);
  const name = escapeHtml(p.name);

  return `
    <article
      class="spartan-row rank-${p.rank}"
      style="--row-accent: ${accent}"
      data-id="${p.id}"
      role="listitem"
      aria-label="${name}, puesto ${p.rank}, ${p.points} puntos"
    >
      <div class="spartan-row__glow" aria-hidden="true"></div>
      <div class="spartan-row__scan" aria-hidden="true"></div>
      <div class="spartan-row__rank">${rankLabel(p.rank)}</div>
      <div class="spartan-row__identity">
        <p class="spartan-row__name">${name}</p>
      </div>
      <div class="spartan-row__points">
        <span class="spartan-row__points-value">${p.points.toLocaleString('es')}</span>
      </div>
    </article>
  `;
}

// --- Particles background ---
function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;

  if (prefersReducedMotion() || isMobileViewport()) {
    canvas.remove();
    return;
  }

  const ctx = canvas.getContext('2d');
  let w, h;
  let rafId = 0;
  let running = false;
  const particles = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
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
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 212, 255, ${this.opacity})`;
      ctx.fill();
    }
  }

  resize();
  for (let i = 0; i < 40; i++) particles.push(new Particle());

  function animate() {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => { p.update(); p.draw(); });
    rafId = requestAnimationFrame(animate);
  }

  function start() {
    if (running || document.hidden) return;
    running = true;
    rafId = requestAnimationFrame(animate);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  window.addEventListener('resize', () => {
    if (isMobileViewport()) {
      stop();
      canvas.remove();
      return;
    }
    resize();
  });

  start();
}

function renderRanking() {
  const stack = document.getElementById('ranking-stack');

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

  let html = withPoints.map(p => renderSpartanRow(p)).join('');

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

  stack.innerHTML = html;

  const toggle = document.getElementById('zero-group-toggle');
  const list = document.getElementById('zero-group-list');
  if (toggle && list) {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      list.hidden = expanded;
    });
  }
}

function renderStats() {
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
    <div class="stat-card"><span class="stat-value">${gapToSecond.toLocaleString('es')}</span><span class="stat-label">GAP AL 2º</span></div>
    <div class="stat-card"><span class="stat-value">${avgPoints.toLocaleString('es')}</span><span class="stat-label">MEDIA ACTIVOS</span></div>
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
  const date = new Date(SQUAD_DATA.lastUpdated);
  el.textContent = Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
  document.getElementById('season-banner').textContent = SQUAD_DATA.season;
}

function runBootSequence() {
  const screen = document.getElementById('boot-screen');
  if (!screen) return;

  if (prefersReducedMotion()) {
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
  runBootSequence();
  initParticles();
  renderRanking();
  renderStats();
  initNavigation();
  updateTimestamp();
});
