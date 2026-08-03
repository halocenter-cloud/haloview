# Spartan Ranking — Halo Infinite

Sitio web inmersivo de ranking para tu escuadrón de Halo Infinite. Complementa tu automatización de grupo con filas horizontales estilo HUD.

## Inicio rápido

Abre `index.html` en el navegador, o sirve localmente:

```bash
npx serve .
```

## Actualizar datos

Edita `data.js` con los nombres, gamertags, puntos y estadísticas de tu grupo. La estructura coincide con la pirámide de ranking:

- `rank` — posición en el ranking (1 = primero)
- `points` — puntos de ranking
- `kd`, `wins`, `losses`, etc. — estadísticas opcionales

## Secciones

1. **Ranking** — filas horizontales a pantalla completa (15% de altura por jugador)
2. **Leaderboard** — tabla completa ordenada
3. **Estadísticas** — métricas del escuadrón y gráficos K/D y victorias

## Personalización

- Colores por jugador en el campo `color` (hex)
- Temporada y fecha en `SQUAD_DATA.season` y `lastUpdated`

## Automatización y capturas

Este proyecto ahora incluye un flujo de automatización para procesar capturas de pantalla de partidas.

### Estructura nueva

- `captures/` — carpeta donde se colocan las capturas de scoreboard.
- `matches.json` — historial de partidas procesadas.
- `scripts/process_capture.py` — script Python que extrae datos con OCR y genera `data.js`.
- `.github/workflows/process-captures.yml` — GitHub Actions para procesar capturas automáticamente.

### Cómo usarlo

1. Añade una captura válida a `captures/`.
2. Instala dependencias en tu máquina:

```bash
python -m pip install --upgrade pip
pip install -r scripts/requirements.txt
```

3. Ejecuta el script:

```bash
python scripts/process_capture.py
```

4. Si la captura tiene al menos 5 jugadores y OCR confiable, el script actualizará `matches.json` y generará `data.js`.

### Validaciones incluidas

- Formato de captura rígido recomendado.
- Comprobación básica de confianza OCR.
- Registro con `id`, `captureFile`, `date`, `confidence` y `status`.

### GitHub Actions

El workflow se ejecuta cuando se sube una nueva captura o cada dos meses. Si el resultado cambia, hará commit automático de `matches.json` y `data.js`.
