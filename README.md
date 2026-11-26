# studio-ui

Vizuální storyboard a herní design editor pro ekosystém **maxultima-game-studio**. Pracuje přímo nad Git-přátelskými soubory `game-*/design/`.

## Funkce MVP
- **Fáze 1 (Pitch):** Editace `design/pitch.md` a `design/game.yaml` (včetně i18n jazyků `cs`/`en`).
- **Fáze 2 (Svět & Entity):** Svět, akty, postavy, předměty, flagy, zamykání entit (`locked`), překlady.
- **Fáze 3A (Mapa lokací & logiky):** Interaktivní graf lokací, přechodů, hotspotů, puzzlů a asset slotů (`@xyflow/react`).
- **Fáze 3B (Uzlový editor dialogů):** Rozvětvené dialogové stromy (`npc_line`, `player_choice`, `effect`, `end`) s podmínkami, efekty a vícejazyčnými texty.
- **AI Asistence (Human-in-the-loop):** Návrhy jdou vždy přes náhled a selektivní schválení.
- **Validace:** Živá statická kontrola grafu, odkazů a překladů + volitelná AI revize příběhu.
- **Pipeline Bridge:** Připravené napojení na budoucí `pipeline-*` pro generování a náhled assetů.

## Spuštění
```bash
pnpm install
pnpm dev
```

Volitelné proměnné prostředí:
- `STUDIO_GAMES_ROOT` – cesta ke složce s `game-*` repozitáři (výchozí `..`)
- `GAME_DIR` – explicitní cesta ke konkrétnímu `game-*` repozitáři
- `GEMINI_API_KEY` – API klíč pro Gemini AI funkce (volitelné pro ruční editaci)
- `PORT` – port API serveru (výchozí `4310`)
