# Rules: studio-ui

- **Čistý editor nad `design/`:** `studio-ui` čte a zapisuje výhradně složku `design/` uvnitř vybraného `game-*` repozitáře. Nikdy neobsahuje hardcoded obsah konkrétní hry.
- **Žádná přímá závislost na enginu:** `studio-ui` nezná `engine-pnc-2d` ani konkrétní runtime formát `dist/`.
- **Hranice vůči `pipeline-*`:** `design/` drží jen vizuální briefy a deklarace asset slotů; `specs/` a `assets/` vlastní `pipeline-*`. `studio-ui` může stavy/náhledy číst a spouštět pipeline pouze přes rozhraní Pipeline Bridge.
- **Human-in-the-loop AI:** AI nikdy nepřepisuje soubory na disku bez explicitního náhledu a schválení uživatelem; zamčené entity (`locked: true`) jsou chráněny proti přepsání.
- **i18n od začátku:** UI aplikace i texty herního obsahu (včetně dialogů) podporují vícejazyčnost (`cs`, `en`).
