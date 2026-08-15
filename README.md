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
3. **Ficha / duelo** — historial de partidas (filtro de modo), resumen de temporada y enfrentamientos compartidos

### Perfiles (`profiles[]`)

El bot exporta, además del ranking, un perfil por Spartan:

| Campo | Significado |
|-------|-------------|
| `recentMatches[].matchId` | Hash SHA-256 recortado del `message_id` de WhatsApp (no se publica el ID crudo) |
| `recentMatches[].modo` | `ffa`, `arcade`, `equipos`, `multiequipo` o `null` (historial previo) |
| `recentMatches[].result` | `ganador` / `perdedor` en equipos 2 bandos; si no, `null` |
| `bySeason[].bestGame` | Máximo de puntos en una partida de esa temporada |
| `bySeason[].avgPoints` | Media de puntos |
| `bySeason[].matchesPerWeek` | Partidas / semanas de la temporada |
| `bySeason[].wins` / `teamMatches` | Victorias y partidas de equipos 2 bandos (winrate) |

## Notas

- El pipeline OCR de capturas **no escribe** `data.js` (el ranking viene del bot).
- El workflow de GitHub Actions está desactivado para no pisar el ranking.
