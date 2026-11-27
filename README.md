# studio-ui

Vizuální storyboard a herní design editor pro ekosystém **maxultima-game-studio**. Pracuje přímo nad Git-přátelskými YAML/Markdown soubory `game-*/design/`.

---

## Uživatelský manuál

### Instalace a spuštění
```bash
pnpm install
pnpm dev
```
- Webové rozhraní běží na portu `5173`, lokální API server na portu `4310`.
- Volitelné proměnné prostředí:
  - `STUDIO_GAMES_ROOT` – složka obsahující repozitáře `game-*` (výchozí `..` nad `studio-ui`).
  - `GAME_DIR` nebo CLI argument `--game <cesta>` – explicitní cesta ke konkrétnímu repozitáři hry.
  - `GEMINI_API_KEY` – výchozí API klíč pro Google Gemini (volitelné pro čistě ruční editaci).
  - `GEMINI_MODEL` – výchozí Gemini model (výchozí `gemini-3.8-flash`).
  - `PORT` – port lokálního API serveru (výchozí `4310`).

### Pracovní postup (4 kroky)
1. **1. Pitch (`design/pitch.md`, `design/story-plan.md`, `design/game.yaml`)**
   - Ladění nosné myšlenky (ručně nebo přes AI: *Vygenerovat nový* / *Upravit stávající*).
   - Nastavení parametrů projektu (`target_resolution`, `target_engine`, `target_pipeline`, jazyky `locales`).
   - **Zadání pro rozpracování do aktů:** pomocí AI lze z hrubé představy vyladit přesné zadání/prompt (rozsah, počet aktů, tón, tempo a mantinely), který se pak předá tlačítku **Rozpracovat do příběhu & aktů** pro vygenerování samotného obsahu Kroku 2.
   - Tlačítko **Rozpracovat do příběhu & aktů** (s potvrzovacím dialogem) vygeneruje Krok 2.
2. **2. Příběh & Akty (`design/world.yaml`)**
   - Strukturovaný přehled celého příběhu akt po aktu od začátku do konce: každý akt má vlastní cíl, specifický vizuální směr, story beaty, koncepty puzzlů a přechod/zvrat (bez globální hlavičky světa).
   - Každý akt lze zamykat (`locked`), ručně upravovat i samostatně dolaďovat pomocí AI v kontextu celého příběhu.
3. **3. Detaily aktů (`design/characters/`, `items/`, `puzzles/`, `flags.yaml`)**
   - Přepínání po jednotlivých aktech, AI generování entit pro vybraný akt a individuální AI úprava/redefinice každé postavy, předmětu i puzzlu.
4. **4A. Mapa lokací & 4B. Dialogy (`design/scenes/`, `dialogues/`)**
   - Dvě provázaná uzlová plátna (`@xyflow/react`): mapa lokací s přechody, hotspoty, nastavením startovní lokace a Pipeline Bridge sloty + uzlový editor rozvětvených vícejazyčných dialogů.

### AI zdroje, UI a dolní lišta
- **Multi-provider AI:** v horní liště lze volit model i spravovat zdroje (**Google Gemini**, **OpenCode Go**, **OpenCode Zen**, **OpenRouter**, **Custom OpenAI-Compatible**). Klíče se ukládají lokálně mimo Git do `~/.config/studio-ui/ai-providers.json`.
- **Persistence UI:** vybraný model, jazyky (`CS`/`EN`), světlý/tmavý režim, aktivní záložka i rozložení plovoucích oken se ukládají do `localStorage` a `~/.config/studio-ui/ui-prefs.json`.
- **Dolní lišta:** historie notifikací/chyb a živý chat log AI komunikace (obě okna lze připnout, přesouvat a měnit jejich velikost).

### Kontroly a testy
```bash
pnpm typecheck
pnpm build
pnpm test
```

---

## Přehled architektury

```text
studio-ui/
├── packages/
│   ├── shared/   # Zod schémata pro design/* (schemas.ts) a deterministický validátor (validator.ts)
│   ├── server/   # Express API, atomický YAML/MD store (design-store.ts), multi-provider AI + asynchronní joby (ai-providers.ts, gemini.ts), Pipeline Bridge (pipeline-bridge.ts), UI prefs (ui-prefs.ts)
│   └── web/      # React 19 + Vite + Tailwind CSS v4 (Antigravity light/dark) + @xyflow/react + i18n (cs/en)
└── .github/workflows/ci.yml
```
