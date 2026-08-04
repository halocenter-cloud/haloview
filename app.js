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

const players = [...SQUAD_DATA.players].sort((a, b) => {
  if (a.rank !== b.rank) return a.rank - b.rank;
  if (b.points !== a.points) return b.points - a.points;
  return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
});

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

// --- Particles background ---
function initParticles() {
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let w, h;
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
  for (let i = 0; i < 80; i++) particles.push(new Particle());

  function animate() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
  }
  animate();
  window.addEventListener('resize', resize);
}

function renderRanking() {
  const stack = document.getElementById('ranking-stack');
  const rankLabel = (n) => String(n).padStart(2, '0');

  if (!players.length) {
    stack.innerHTML = `
      <div class="ranking-empty" role="status">
        Sin jugadores en el ranking de esta temporada.
      </div>
    `;
    return;
  }

  stack.innerHTML = players.map(p => {
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
      <div class="spartan-row__rank">
        ${rankLabel(p.rank)}
        <span class="spartan-row__rank-label">PUESTO</span>
      </div>
      <div class="spartan-row__identity">
        <h2 class="spartan-row__name">${name}</h2>
      </div>
      <div class="spartan-row__points">
        <span class="spartan-row__points-value">${p.points.toLocaleString('es')}</span>
        <span class="spartan-row__points-label">PTS</span>
      </div>
    </article>
  `;
  }).join('');
}

function renderStats() {
  const spartanCount = players.length;
  const leaderPoints = spartanCount ? Math.max(...players.map(p => p.points)) : 0;
  const totalPoints = players.reduce((sum, p) => sum + p.points, 0);
  const updated = new Date(SQUAD_DATA.lastUpdated);
  const updatedLabel = Number.isNaN(updated.getTime())
    ? '—'
    : updated.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><span class="stat-value">${spartanCount}</span><span class="stat-label">SPARTANS</span></div>
    <div class="stat-card"><span class="stat-value">${leaderPoints.toLocaleString('es')}</span><span class="stat-label">PUNTOS LÍDER</span></div>
    <div class="stat-card"><span class="stat-value">${totalPoints.toLocaleString('es')}</span><span class="stat-label">PUNTOS TOTALES</span></div>
    <div class="stat-card"><span class="stat-value stat-value--text">${escapeHtml(SQUAD_DATA.season)}</span><span class="stat-label">TEMPORADA</span></div>
    <div class="stat-card"><span class="stat-value stat-value--text">${escapeHtml(updatedLabel)}</span><span class="stat-label">ACTUALIZADO</span></div>
  `;

  const chart = document.getElementById('points-chart');
  if (!spartanCount) {
    chart.innerHTML = '<p class="chart-empty">Sin datos de puntos.</p>';
    return;
  }

  const maxPoints = Math.max(leaderPoints, 1);
  chart.innerHTML = players.map(p => `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(p.name)}</span>
      <div class="bar-track">
        <div class="bar-fill" style="--bar-color: ${accentForRank(p.rank)}; width: ${(p.points / maxPoints) * 100}%"></div>
      </div>
      <span class="bar-value">${p.points.toLocaleString('es')}</span>
    </div>
  `).join('');
}

function initNavigation() {
  const buttons = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.section');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.section;
      const targetSection = document.getElementById(targetId);
      if (!targetSection) return;

      buttons.forEach(b => b.classList.remove('active'));
      sections.forEach(section => {
        section.classList.remove('active');
        section.classList.remove('is-transitioning');
      });

      btn.classList.add('active');
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
  const status = document.getElementById('boot-status');
  const messages = [
    'Inicializando sistemas...',
    'Conectando a la red UNSC...',
    'Cargando datos del escuadrón...',
    'Sincronizando ranking...',
    'Listo.'
  ];
  let i = 0;
  const interval = setInterval(() => {
    if (i < messages.length) {
      status.textContent = messages[i++];
    }
  }, 450);

  setTimeout(() => {
    clearInterval(interval);
    screen.classList.add('hidden');
  }, 2400);
}

document.addEventListener('DOMContentLoaded', () => {
  runBootSequence();
  initParticles();
  renderRanking();
  renderStats();
  initNavigation();
  updateTimestamp();
});
