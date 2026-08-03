#!/usr/bin/env python3
"""
Procesa capturas de pantalla del scoreboard de Halo Infinite y actualiza matches.json y data.js.
"""

import json
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

try:
    import cv2
    import pytesseract
except ImportError:
    print("Error: faltan dependencias de Python. Ejecuta `pip install -r scripts/requirements.txt`.")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
CAPTURES_DIR = ROOT / "captures"
MATCHES_FILE = ROOT / "matches.json"
DATA_FILE = ROOT / "data.js"
DEFAULT_SEASON = "Temporada 6 — Operación Anvil"
DEFAULT_PALETTE = [
    "#00d4ff",
    "#ff6b35",
    "#c0c0c0",
    "#4ade80",
    "#a78bfa",
    "#fbbf24",
    "#f97316",
    "#38bdf8",
    "#f472b6",
    "#60a5fa",
]

NAME_PATTERN = re.compile(
    r"^(?P<name>[A-Za-z0-9_#\-\.\u00C0-\u017F ]{3,30})\s+(?P<points>\d{2,5})\s+(?P<kd>\d+\.\d{1,2})(?:\s+(?P<medals>\d+))?$")
MODE_PATTERN = re.compile(r"mode[:\s]+([A-Za-z0-9 ]+)", re.IGNORECASE)
PLAYERS_PATTERN = re.compile(r"(players|jugadores)[:\s]+(\d+)", re.IGNORECASE)
DATE_PATTERN = re.compile(r"(\d{4}[-/]\d{2}[-/]\d{2})")


def load_json(path: Path):
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def save_json(path: Path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def preprocess_image(path: Path):
    image = cv2.imread(str(path))
    if image is None:
        raise ValueError(f"No se pudo leer la imagen: {path}")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh


def extract_text(path: Path) -> str:
    image = preprocess_image(path)
    return pytesseract.image_to_string(image, lang="spa+eng", config="--psm 6")


def parse_scoreboard_text(text: str) -> dict:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    players = []
    mode = None
    total_players = None
    match_date = None

    for line in lines:
        if mode is None:
            mode_match = MODE_PATTERN.search(line)
            if mode_match:
                mode = mode_match.group(1).strip()

        if total_players is None:
            players_match = PLAYERS_PATTERN.search(line)
            if players_match:
                total_players = int(players_match.group(2))

        if match_date is None:
            date_match = DATE_PATTERN.search(line)
            if date_match:
                match_date = date_match.group(1)

        row_match = NAME_PATTERN.match(line)
        if row_match:
            players.append({
                "name": row_match.group("name").strip(),
                "points": int(row_match.group("points")),
                "kd": float(row_match.group("kd")),
                "medals": int(row_match.group("medals")) if row_match.group("medals") else 0,
            })

    if total_players is None:
        total_players = len(players)

    return {
        "players": players,
        "mode": mode or "Personalizada",
        "date": match_date,
        "totalPlayers": total_players,
        "rawLines": lines,
    }


def compute_confidence(parsed: dict) -> float:
    score = 0.0
    players = parsed["players"]
    if players:
        score += 0.5
        score += min(0.4, len(players) * 0.05)
    if parsed["mode"]:
        score += 0.1
    if parsed["totalPlayers"] and parsed["totalPlayers"] >= 5:
        score += 0.1
    return min(1.0, score)


def build_match_id(path: Path, parsed: dict) -> str:
    base = path.stem
    if parsed["date"]:
        return f"{parsed['date']}-{base}"
    return f"auto-{base}"


def normalize_player_name(name: str) -> str:
    return re.sub(r"\s+", " ", name).strip()


def process_capture(path: Path, existing_ids: set) -> dict:
    print(f"Procesando captura: {path.name}")
    text = extract_text(path)
    parsed = parse_scoreboard_text(text)
    parsed["players"] = [
        {
            "name": normalize_player_name(player["name"]),
            "points": player["points"],
            "kd": player["kd"],
            "medals": player["medals"],
        }
        for player in parsed["players"]
    ]
    confidence = compute_confidence(parsed)
    match_id = build_match_id(path, parsed)
    if match_id in existing_ids:
        print(f"  - ya existe registro con id {match_id}, se actualizará si fue modificado.")

    status = "accepted" if len(parsed["players"]) >= 5 else "needs-review"
    if len(parsed["players"]) < 1:
        status = "rejected"

    return {
        "id": match_id,
        "captureFile": str(path.relative_to(ROOT)).replace("\\", "/"),
        "date": parsed["date"] or datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mode": parsed["mode"],
        "totalPlayers": parsed["totalPlayers"],
        "players": parsed["players"],
        "confidence": round(confidence, 2),
        "status": status,
        "processedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "rawText": text,
    }


def aggregate_players(matches: list) -> list:
    aggregator = defaultdict(lambda: {
        "name": "",
        "points": 0,
        "kdValues": [],
        "medals": 0,
        "matches": 0,
    })

    for match in matches:
        if match["status"] != "accepted":
            continue
        for player in match["players"]:
            key = player["name"]
            aggregator[key]["name"] = player["name"]
            aggregator[key]["points"] += player["points"]
            aggregator[key]["kdValues"].append(player["kd"])
            aggregator[key]["medals"] += player.get("medals", 0)
            aggregator[key]["matches"] += 1

    results = []
    for player_data in aggregator.values():
        avg_kd = sum(player_data["kdValues"]) / len(player_data["kdValues"]) if player_data["kdValues"] else 0
        results.append({
            "name": player_data["name"],
            "gamertag": player_data["name"],
            "points": player_data["points"],
            "kd": round(avg_kd, 2),
            "wins": player_data["matches"],
            "losses": 0,
            "headshots": 0,
            "medals": player_data["medals"],
            "playtime": "-",
            "favoriteWeapon": "Personalizada",
            "badges": [],
        })

    results.sort(key=lambda item: item["points"], reverse=True)
    return results


def build_data_js(players: list, season: str) -> str:
    lines = [
        "const SQUAD_DATA = {",
        f"  season: \"{season}\",",
        f"  lastUpdated: \"{datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')}\",",
        "  players: [",
    ]

    for index, player in enumerate(players, start=1):
        color = DEFAULT_PALETTE[(index - 1) % len(DEFAULT_PALETTE)]
        lines.append("    { ")
        lines.append(f"      id: {index},")
        lines.append(f"      name: \"{player['name']}\",")
        lines.append(f"      gamertag: \"{player['gamertag']}\",")
        lines.append(f"      rank: {index},")
        lines.append(f"      points: {player['points']},")
        lines.append(f"      kd: {player['kd']:.2f},")
        lines.append(f"      wins: {player['wins']},")
        lines.append(f"      losses: {player['losses']},")
        lines.append(f"      headshots: {player['headshots']},")
        lines.append(f"      medals: {player['medals']},")
        lines.append(f"      playtime: \"{player['playtime']}\",")
        lines.append(f"      favoriteWeapon: \"{player['favoriteWeapon']}\",")
        lines.append(f"      badges: {json.dumps(player['badges'], ensure_ascii=False)},")
        lines.append(f"      color: \"{color}\"")
        lines.append("    },")
    lines.append("  ]")
    lines.append("};")
    return "\n".join(lines) + "\n"


def load_season_from_data_js() -> str:
    if not DATA_FILE.exists():
        return DEFAULT_SEASON
    content = DATA_FILE.read_text(encoding="utf-8")
    match = re.search(r'season:\s*"([^\"]+)"', content)
    return match.group(1) if match else DEFAULT_SEASON


def main():
    CAPTURES_DIR.mkdir(exist_ok=True)
    matches = load_json(MATCHES_FILE)
    existing_ids = {match["id"] for match in matches if "id" in match}

    new_matches = []
    for capture_path in sorted(CAPTURES_DIR.glob("*.png")) + sorted(CAPTURES_DIR.glob("*.jpg")) + sorted(CAPTURES_DIR.glob("*.jpeg")):
        match = process_capture(capture_path, existing_ids)
        new_matches.append(match)
        existing_ids.add(match["id"])

    for old_match in matches:
        if old_match["id"] not in existing_ids:
            new_matches.append(old_match)

    if new_matches != matches:
        save_json(MATCHES_FILE, new_matches)
        print(f"Guardado {len(new_matches)} entradas en {MATCHES_FILE}")
    else:
        print("No hay cambios en matches.json")

    accepted_matches = [m for m in new_matches if m["status"] == "accepted"]
    players = aggregate_players(accepted_matches)
    if players:
        season = load_season_from_data_js()
        data_js = build_data_js(players, season)
        DATA_FILE.write_text(data_js, encoding="utf-8")
        print(f"Actualizado {DATA_FILE} con {len(players)} jugadores.")
    else:
        print("No hay partidas aceptadas. data.js no se actualizó.")


if __name__ == "__main__":
    main()
