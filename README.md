# PES Veterans League

Funkční komunitní web: Dream Team sezóny, rychlé ligy reálných klubů, vyřazovací turnaje a 1v1 / 2v2. Retro vzhled je původní CSS, bez převzatých herních obrázků.

## Provoz
- Cílová adresa hostingu (publikace se dokončuje samostatně): https://pes-veterans-league.sprypike512.chatgpt.site
- Hosting: Sites / Cloudflare Workers. Trvalá databáze Cloudflare D1, vazba `DB`.
- Přihlášení: ChatGPT, poskytované hostingem. Správce je určen runtime hodnotou `ADMIN_EMAIL` uloženou mimo repozitář.
- Veřejné čtení závisí na nastavení přístupu hostingu. Zápisy vždy vyžadují přihlášení; založení soutěže, schválení hráčů a potvrzení výsledku vyžaduje správce.
- GitHub Pages samotné tento server a databázi nespustí. Nepublikujte zdrojový index.html jako náhradu aplikace.

## Použití
1. Přihlášení → Přihláška → herní přezdívka.
2. Správce otevře Správu a schválí hráče.
3. Správce založí soutěž. Dream Team je hlavní dlouhodobá liga; rychlé ligy používají názvy skutečných klubů.
4. Schválení hráči se přihlásí s týmem, případně vyberou spoluhráče. Jeden hráč smí v jedné soutěži nastoupit jen jednou, i jako člen dvojice.
5. Správce zahájí soutěž. Liga vytvoří rozpis každý s každým (jeden zápas), pohár vyžaduje 2, 4, 8, 16 nebo 32 účastníků.
6. V detailu soutěže správce zadá a potvrdí skutečný výsledek. V poháru musí být konečné skóre po prodloužení/penaltách bez remízy. Vítězové postupují automaticky.
7. Tabulky i kariéry vycházejí pouze z potvrzených výsledků. U 2v2 se oběma hráčům připíše týmové skóre a výsledek. U ligových tabulek rozhodují body, rozdíl skóre, góly a název týmu.

Výsledky se zadávají ručně po odehrání ve hře. Web není PES herní server a nepředstírá automatické propojení s hrou. Potvrzené výsledky jsou uzamčené; oprava zatím vyžaduje spravovanou databázovou úpravu. Rádio vede k oficiálnímu přehrávači Radio X 90s; žádné skladby ani neověřené streamy nejsou hostované. Stanice může mít územní omezení.

## Vývoj a ověření
Node 24+, pnpm 11.25.0.

```
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build
```

Lokální D1 po prvním sestavení:
```
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --persist-to .wrangler/state --config dist/server/wrangler.json --file drizzle/0000_elite_groot.sql
pnpm start
```

`pnpm dev` nabízí pouze lokální testovací přihlášení `seedy@sites.test` na localhostu; nesmí být nasazeno jako veřejný server. Na Windows může vývojový režim kvůli chybě ve zpracování file URL selhat; `pnpm build` a `pnpm start` ověřují produkční Worker bez této chyby. Produkční hosting ověřuje a poskytuje identitu před požadavkem do Workeru. Mimo Sites je nutné nejprve implementovat důvěryhodnou autentizační bránu; samotné klientem zaslané hlavičky nesmějí být důvěryhodné.

`.openai/hosting.json` obsahuje identitu existujícího nasazení, nikoliv tajné údaje. Nové nasazení musí znovu použít toto ID. SQL migrace v `drizzle/` aplikuje hosting při publikaci. Již aplikované migrace neupravujte. Lokální data jsou oddělená od produkce.

Testy používají SQLite a skutečné API handlery: ověřují oprávnění, ochranu původu, duplicitní přihlášky, rozpisy, skóre, 2v2, kariéry i postup turnajem. Žádná demonstrační data se nevkládají do produkce.

Kód je v tomto repozitáři; nasazená verze se publikuje přes Sites ze stejného sestavení. Samotný GitHub push zatím nespouští publikaci na Sites.


