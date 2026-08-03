/**
 * Halo Infinite Ranking — Interactive UI
 */

const players = [...SQUAD_DATA.players].sort((a, b) => a.rank - b.rank);

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

  stack.innerHTML = players.map(p => `
    <article
      class="spartan-row rank-${p.rank}"
      style="--row-accent: ${p.color}"
      data-id="${p.id}"
      role="listitem"
      tabindex="0"
      aria-label="${p.name}, posición ${p.rank}, ${p.points} puntos"
    >
      <div class="spartan-row__glow" aria-hidden="true"></div>
      <div class="spartan-row__scan" aria-hidden="true"></div>
      <div class="spartan-row__rank">
        ${rankLabel(p.rank)}
        <span class="spartan-row__rank-label">RANK</span>
      </div>
      <div class="spartan-row__identity">
        <h2 class="spartan-row__name">${p.name}</h2>
        <p class="spartan-row__tag">${p.gamertag}</p>
      </div>
      <div class="spartan-row__stats">
        <div class="spartan-row__stat">
          <span class="spartan-row__stat-value">${p.kd.toFixed(2)}</span>
          <span class="spartan-row__stat-label">K/D</span>
        </div>
        <div class="spartan-row__stat">
          <span class="spartan-row__stat-value">${p.wins}</span>
          <span class="spartan-row__stat-label">WINS</span>
        </div>
        <div class="spartan-row__stat">
          <span class="spartan-row__stat-value">${p.medals}</span>
          <span class="spartan-row__stat-label">MEDALS</span>
        </div>
      </div>
      <div class="spartan-row__points">
        <span class="spartan-row__points-value">${p.points.toLocaleString()}</span>
        <span class="spartan-row__points-label">PTS</span>
      </div>
      <span class="spartan-row__cta">VER DOSSIER ›</span>
    </article>
  `).join('');

  stack.querySelectorAll('.spartan-row').forEach(row => {
    const open = () => openPlayerModal(+row.dataset.id);
    row.addEventListener('click', open);
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
}

function renderStats() {
  const totalWins = players.reduce((s, p) => s + p.wins, 0);
  const totalGames = players.reduce((s, p) => s + p.wins + p.losses, 0);
  const avgKd = players.reduce((s, p) => s + p.kd, 0) / players.length;
  const totalMedals = players.reduce((s, p) => s + p.medals, 0);

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><span class="stat-value">${players.length}</span><span class="stat-label">SPARTANS</span></div>
    <div class="stat-card"><span class="stat-value">${totalWins}</span><span class="stat-label">VICTORIAS</span></div>
    <div class="stat-card"><span class="stat-value">${totalGames}</span><span class="stat-label">PARTIDAS</span></div>
    <div class="stat-card"><span class="stat-value">${avgKd.toFixed(2)}</span><span class="stat-label">K/D PROMEDIO</span></div>
    <div class="stat-card"><span class="stat-value">${totalMedals}</span><span class="stat-label">MEDALLAS</span></div>
  `;

  const maxKd = Math.max(...players.map(p => p.kd));
  const maxWins = Math.max(...players.map(p => p.wins));

  document.getElementById('kd-chart').innerHTML = players.map(p => `
    <div class="bar-row">
      <span class="bar-label">${p.name}</span>
      <div class="bar-track"><div class="bar-fill" style="--bar-color: ${p.color}; width: ${(p.kd / maxKd) * 100}%"></div></div>
      <span class="bar-value">${p.kd.toFixed(2)}</span>
    </div>
  `).join('');

  document.getElementById('wins-chart').innerHTML = players.map(p => `
    <div class="bar-row">
      <span class="bar-label">${p.name}</span>
      <div class="bar-track"><div class="bar-fill" style="--bar-color: ${p.color}; width: ${(p.wins / maxWins) * 100}%"></div></div>
      <span class="bar-value">${p.wins}</span>
    </div>
  `).join('');
}

function openPlayerModal(id) {
  const p = players.find(x => x.id === id);
  if (!p) return;

  const modal = document.getElementById('player-modal');
  document.getElementById('modal-rank').textContent = `#${p.rank}`;
  document.getElementById('modal-rank').style.color = p.color;
  document.getElementById('modal-name').textContent = p.name;
  document.getElementById('modal-gamertag').textContent = p.gamertag;

  document.getElementById('modal-stats').innerHTML = [
    ['Puntos', p.points.toLocaleString()],
    ['K/D', p.kd.toFixed(2)],
    ['Victorias', p.wins],
    ['Derrotas', p.losses],
    ['Headshots', p.headshots],
    ['Medallas', p.medals],
    ['Tiempo', p.playtime],
    ['Arma favorita', p.favoriteWeapon]
  ].map(([label, value]) => `
    <div class="modal-stat"><div class="label">${label}</div><div class="value">${value}</div></div>
  `).join('');

  document.getElementById('modal-badges').innerHTML = p.badges
    .map(b => `<span class="badge">${b}</span>`).join('');

  modal.showModal();
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

function initModal() {
  const modal = document.getElementById('player-modal');
  modal.querySelector('.modal-close').addEventListener('click', () => modal.close());
  modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
}

function updateTimestamp() {
  const el = document.getElementById('last-updated');
  const date = new Date(SQUAD_DATA.lastUpdated);
  el.textContent = date.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
  document.getElementById('season-banner').textContent = SQUAD_DATA.season;
}

// --- Boot sequence ---
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

// --- Boot ---
document.addEventListener('DOMContentLoaded', () => {
  runBootSequence();
  initParticles();
  renderRanking();
  renderStats();
  initNavigation();
  initModal();
  updateTimestamp();
});
