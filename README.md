# Spartan Ranking — Halo Infinite

Sitio web de ranking para el escuadrón, alineado con los datos de **HaloBackend** (gamertag + puntos de temporada + puesto).

## Inicio rápido

Abre `index.html` en el navegador, o sirve localmente:

```bash
npx serve .
```

## Actualizar datos

Edita `data.js` con el ranking de la temporada activa. Forma esperada (compatible con el bot):

```js
const SQUAD_DATA = {
  season: "Temporada 3 — desde 14 jul 2026",
  lastUpdated: "2026-08-03T21:00:00",
  players: [
    { id: 1, name: "jugador1", rank: 1, points: 42 },
    { id: 2, name: "jugador2", rank: 2, points: 38 }
  ]
};
```

| Campo | Origen backend |
|-------|----------------|
| `name` | `jugador` |
| `points` | `puntaje_total` |
| `rank` | puesto (empatados comparten número) |
| `season` | etiqueta derivada de la temporada activa |
| `lastUpdated` | momento de la exportación |

## Secciones

1. **Ranking** — filas HUD: puesto, gamertag, puntos (colores oro/plata/bronce en 1–3)
2. **Temporada** — Spartans, puntos del líder, puntos totales, temporada, última actualización, barra de puntos

## Notas

- El pipeline OCR de capturas **no escribe** `data.js` (el ranking viene del bot).
- El workflow de GitHub Actions está desactivado para no pisar el ranking.
