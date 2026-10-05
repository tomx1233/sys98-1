# system98

Kleine Tools (statische Seiten in `public/`) plus ein **Support-Desk mit Team-Accounts**.

- Besucher brauchen **kein Konto**: Sie öffnen unter `/support` ein Ticket und kommen über einen Link
  (oder Ticketnummer + E-Mail) wieder rein.
- **Konten gibt es nur fürs Team**, und nur über **Einladungs-Keys**, die ein Owner im Dashboard erzeugt.
- Jedes Teammitglied hat ein Profil (`/staff/<name>`), das im Dashboard bearbeitet wird.

## Einrichten

```bash
npm install                 # führt automatisch `prisma generate` aus
cp .env.example .env.local  # Werte ausfüllen (siehe unten)
npm run db:push             # legt die Tabellen in deiner Postgres-DB an
npm run dev
```

Nötig in `.env.local`: `DATABASE_URL`, `SESSION_SECRET` (32+ Zeichen), `SETUP_KEY`, `SITE_URL`.
SMTP ist optional (ohne läuft alles, es gehen nur keine E-Mails raus).

### Ersten Owner anlegen

1. `SETUP_KEY` in `.env.local` setzen (lang und zufällig).
2. `/join` öffnen, den `SETUP_KEY` als Key eingeben, Zugangsdaten wählen → dieses Konto ist der **Owner**.
3. Sobald ein Owner existiert, funktioniert der `SETUP_KEY` nicht mehr.

### Neue Teammitglieder

Dashboard → **Invite keys** → Key erzeugen (Label, Gültigkeit, Anzahl Verwendungen).
Der Key wird **nur einmal** angezeigt (in der DB liegt nur der Hash). Es gibt einen Button, der einen fertigen
Einladungs-Link (`/join?key=…`) kopiert. Keys lassen sich jederzeit deaktivieren.

## Was wo ist

| Route | Was |
| --- | --- |
| `/support` | Ticket öffnen, Ticket wiederfinden, FAQ, Team-Leiste |
| `/support/ticket/<token>` | Ticket-Verlauf für den Besucher (Token = Zugang, `noindex`) |
| `/staff`, `/staff/<name>` | Öffentliche Team-Seite und Profile |
| `/login`, `/join` | Team-Login, Registrierung per Key |
| `/dashboard` | Tickets (Filter, Suche), Antworten, Status |
| `/dashboard/profile` | eigenes Profil mit Live-Vorschau |
| `/dashboard/settings` | Benutzername, E-Mail, Passwort |
| `/dashboard/keys` · `/team` · `/audit` | **nur Owner**: Keys, Team verwalten, Aktivitätslog |

Rollen: `owner` (alles) und `staff` (Tickets + eigenes Profil). Ein Owner kann Leute deaktivieren, zum Owner
machen oder ein temporäres Passwort vergeben (es gibt bewusst kein „Passwort vergessen“ per E-Mail für Staff).
Der letzte aktive Owner kann sich nicht selbst aussperren.

## Aus Eywa.lol übernommen / angepasst

- Ticket-System (Status open/pending/resolved/closed, Verlauf, Antworten per E-Mail) → jetzt **ohne Besucher-Konto**.
- Account-System (bcrypt, iron-session, Rate-Limits, Audit-Log) → jetzt **nur per Key**, ohne Discord/Roblox/Stripe, dafür mit **2FA** (siehe unten).
- Key-System (hash-only, einmalige Anzeige, Ablauf, Max-Nutzungen) → aus den Premium-Keys gebaut, erzeugt jetzt Team-Zugänge.
- Profile → schlanke Team-Profile (Name, Rolle, Bio, Sprachen, Bild-Link, Akzentfarbe, Links, Aufrufe).
- Prisma 5 → **Prisma 7** (`@prisma/adapter-pg`), weil es ohne native Engine-Binaries auskommt.

## Bekannte Grenzen

- Rate-Limits liegen im Speicher der jeweiligen Server-Instanz (wie bei Eywa). Auf Vercel sind sie „best effort“.
- Neue Seiten sind vollständig auf **Englisch und Deutsch**. Die anderen 8 Sprachen fallen auf Englisch zurück
  (nur Navigation/Footer sind übersetzt). Neue Sprache: Objekt in `lib/i18n.ts` ergänzen.
- Kein Datei-Upload: Profilbild ist ein `https://`-Link, Tickets nehmen nur Text (Links zu Screenshots gehen).
- Ein Passwortwechsel beendet andere laufende Sessions nicht (Cookie-Session, 14 Tage).

## 2FA

Jeder kann sich unter `/dashboard/settings` eine Zwei-Faktor-Anmeldung einrichten (Authenticator-App per QR-Code,
dazu 10 Wiederherstellungscodes, die je einmal funktionieren). Beim Login kommt dann nach dem Passwort ein zweiter Schritt.

- Das TOTP-Secret liegt verschlüsselt (AES-256-GCM) in der DB. Schlüssel: `TWO_FACTOR_SECRET`, sonst `SESSION_SECRET`.
  Wird der Wert später geändert, lassen sich bestehende 2FA-Setups nicht mehr lesen (Owner setzt sie dann zurück).
- 5 falsche Codes hintereinander sperren die 2FA-Prüfung für 15 Minuten.
- Ausschalten und neue Wiederherstellungscodes brauchen Passwort **und** Code.
- Handy und Codes weg? Ein Owner nutzt im Team-Tab **Reset 2FA** (steht im Aktivitätslog).
- Nach dem Update einmal `npm run db:push` ausführen (neue Spalten an `Staff`).

## Tool: „Is it down?“ (`/checker`)

Website-Status-Checker mit Merkliste (liegt nur im Browser, `localStorage`). Der Server fragt die eingegebene Adresse
**einmal** per HEAD (bei Fehlern GET) ab und liest nie einen Body. Läuft über `POST /api/tools/status`.

Weil der Server damit fremde Adressen abruft (SSRF-Risiko), steckt die Logik in `lib/siteCheck.ts` mit harten Regeln:
nur http/https auf Port 80/443, keine `user:pass@`-URLs, DNS wird selbst aufgelöst und **jede** Adresse muss öffentlich sein
(kein localhost, keine privaten Netze, kein Cloud-Metadata `169.254.169.254`, kein IPv6-Trick), die Verbindung wird auf die
geprüfte IP festgenagelt (gegen DNS-Rebinding), Redirects werden einzeln neu geprüft (max. 5), dazu Timeouts und Rate-Limits
(20/Minute pro Besucher, 15/Minute pro Zielseite). Bitte diese Datei nicht „vereinfachen“.

Status: `up` (2xx/3xx), `reachable` (4xx, z. B. 403/429 bei Bot-Schutz), `down` (5xx, DNS-/Verbindungs-/TLS-Fehler, Timeout).

## Status-Seite (`/status`) und „N online“

- **`/status`** ist die öffentliche Status-Seite von system98. Sie prüft live (Ergebnis wird ~30 s zwischengespeichert):
  Datenbank/Support-Desk, Ticket-Mails (SMTP-Login), remove.bg (kostet keine Credits), den DNS-/Netz-Teil des „Is it down?“-Tools und
  den QR-Generator. Nicht eingerichtete Dinge (kein SMTP, kein remove.bg-Key) stehen als „not set up“ da und zählen nicht als Störung.
  Fällt die Datenbank aus, bleibt die Seite trotzdem erreichbar und zeigt das an.
- **Meldungen posten:** Dashboard → **Status posts**. Jedes Teammitglied kann Vorfälle anlegen und Updates posten
  (investigating → identified → monitoring → resolved), Löschen dürfen nur Owner. Der Balken „Last 30 days“ färbt sich nach diesen Meldungen.
- **`/api/status`** liefert dasselbe als JSON und antwortet mit **503**, wenn etwas ausgefallen ist. Perfekt für UptimeRobot / Better Stack
  (alle 5 Minuten anpingen, dann bekommst du eine Mail, wenn system98 down ist).
- **„N online“** im Footer aller Seiten: jede offene Seite schickt alle ~45 s eine zufällige, nur im Tab gespeicherte ID an `/api/presence`
  (kein Cookie, keine IP). Gezählt wird, was in den letzten 70 s gepingt hat; alte Einträge werden automatisch gelöscht.
  Jeder offene Tab zählt einzeln. Entfernen: `<script src="/presence.js">` aus den Seiten bzw. `app/layout.tsx` nehmen.
- Das Tool „Is it down?“ liegt jetzt unter **`/checker`** (vorher `/status`).
- **Nach dem Update `npm run db:push` ausführen** (neue Tabellen `Presence`, `Incident`, `IncidentUpdate`).

## Tool: Audio-Konverter (`/audio`)

MP4 → MP3, MP3 → OGG und mehr (MP3, OGG, OPUS, M4A, FLAC, WAV). Die Umwandlung läuft **komplett im Browser** mit
[ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm), die Dateien werden nicht hochgeladen, es gibt keine Serverkosten und kein Upload-Limit von Vercel.

- Beim ersten Klick auf „Convert“ lädt der Browser einmalig den Konverter (~31 MB) und behält ihn danach im Cache.
- Die Dateien dafür kommen aus `node_modules` und werden beim `npm install` per `scripts/copy-ffmpeg.mjs` nach `public/vendor/ffmpeg`
  kopiert. Der Ordner steht in der `.gitignore` (zu groß fürs Repo) und wird auf Vercel bei jedem Build neu erzeugt.
- Mehrere Dateien auf einmal, Qualitätsstufen (Small/Balanced/High), Tags wie Titel/Künstler bleiben erhalten, Abbrechen geht.
- Limit: 200 MB pro Datei (der Browser braucht das Mehrfache davon als Arbeitsspeicher). Am Handy lieber kleinere Dateien.
- Lizenz: der FFmpeg-Kern ist **GPL-2.0-or-later**. Auf der Seite stehen deshalb Hinweis und Link zur Quelle, bitte drinlassen.

## Tool: Bild-Konverter (`/image`)

PNG ⇄ JPG ⇄ WebP ⇄ GIF, komplett im Browser (nichts wird hochgeladen). Läuft ohne ffmpeg: eigener GIF-Decoder, WebP-Parser/-Muxer und
[gifenc](https://github.com/mattdesl/gifenc) (MIT) zum GIF-Schreiben, alles in `public/image.html`.

- Animierte GIFs und WebPs bleiben animiert (GIF → animiertes WebP, animiertes WebP → GIF). Nach PNG/JPG wird nur das erste Bild genommen.
- PNG-Transparenz bleibt in GIF/WebP erhalten, bei JPG wird sie weiß. Optional: max. Breite und Qualität/Farbanzahl.
- Limits: 50 MB pro Datei, alle Frames zusammen max. ~450 MB Arbeitsspeicher. Safari kann WebP nicht per Canvas schreiben, dort kommt eine Meldung.
- `gifenc` wird wie ffmpeg per `postinstall` nach `public/vendor` kopiert (steht in der `.gitignore`).

## Audio-Vorschau und Tool-Zähler

- Im Audio-Konverter hat jedes fertige Ergebnis einen kleinen Player zum Anhören. Er läuft weiter, auch wenn danach andere Dateien fertig werden.
- Die Zahl „N tools live“ auf der Startseite wird automatisch gezählt: alle Kacheln, deren Link nicht `#` ist. Neues Tool = Kachel einfügen, fertig.
  Die Überschrift und der Einleitungstext nennen bewusst keine Zahl mehr.

## Tool: Roblox-Audio-Info (`/roblox-audio`)

Zwei Teile in einer Seite:

1. **ID-Nachschlagen**: Audio-ID, `rbxassetid://…` oder Roblox-Link einfügen → Name, Beschreibung, Ersteller (mit Profil-Link), Artist, Favoriten,
   Länge, Genre/Album, Upload-Datum, Thumbnail. Der Server (`app/api/tools/roblox-audio`, Logik in `lib/robloxAudio.ts`) fragt dafür die
   öffentlichen Roblox-Web-APIs ab (`economy`, `toolbox-service`, `catalog`, `thumbnails`), ohne Login/Cookie, mit Timeout, Rate-Limit (20/min)
   und 10-Minuten-Cache. Nur feste Roblox-Hosts, die ID muss aus Ziffern bestehen. **Die Audio-Datei selbst wird nicht geladen.**
   Fällt eine Nebenquelle aus (z. B. Favoriten), erscheint der Rest trotzdem.
2. **Datei analysieren** (komplett im Browser): Format + Samplerate (aus dem Header gelesen), Kanäle, Dauer, Größe, Bitrate, Lautheit
   (integrierte LUFS nach ITU-R BS.1770 mit Gating), Peak in dBFS, Waveform (L/R mit Zeitachse) und Player. Getestet gegen ffmpeg (`ebur128`):
   Lautheit und Peak stimmen bei WAV/FLAC/OGG/MP3 auf 0,1 genau.

- Beim Abspielen einer abgelegten Datei wandert eine Marke über die Waveform, ein Klick auf die Waveform springt an die Stelle.
- Von Roblox entfernte Audios (Name/Beschreibung sagt „Removed for violations…“) bekommen einen roten Hinweis „removed by Roblox“.

Falls Roblox die API-Antworten ändert und ein Feld leer bleibt: die Parser stehen in `lib/robloxAudio.ts`.

## Tool: Roblox-Account-Suche (`/roblox-user`)

Username, User-ID oder Profil-Link → öffentliche Profilinfos wie auf roblox.com: Anzeigename/Username, Verified-Badge, gesperrt ja/nein, Erstelldatum,
Freunde/Follower/Following, Inventar öffentlich oder privat, Gruppenanzahl, Roblox-Badges, Bio und Avatar. Logik in `lib/robloxUser.ts`
(getrennt von der Website, damit sie später auch in einem Discord-Bot wiederverwendet werden kann), API in `app/api/tools/roblox-user`
(15 Anfragen/Minute pro Besucher, 5 Minuten Cache, nur feste Roblox-Hosts).

**Bewusst nicht dabei:** Online-Status, „zuletzt online“ und aktuelles Spiel. Das würde die Seite zu einem Tool machen, mit dem man Spieler
(oft Kinder) verfolgen kann, und Roblox gibt das ohnehin nur mit Login heraus. RAP/Value käme von Drittanbietern (z. B. Rolimons) und ist nicht eingebaut.

## Discord-Bot (`/audio`, `/user`, `/help`)

## Discord-Bot: Roblox-Lookups & `/qr`

Zusätzlich zu `/audio`, `/user`, `/analyze` und `/shazam` kann der Bot jetzt (alles öffentliche Roblox-Infos, ohne Login):

`/avatar` `/bust` `/headshot` (Thumbnails eines Users), `/accountage`, `/friends`, `/arefriends`, `/usergroups`,
`/group` (Gruppeninfo aus Name oder ID), `/assetid` und `/asseticon` (Asset-Infos/-Icon), `/game` (Spielsuche),
`/gamepass`, `/bundle`, `/devex` (Robux → USD, reine Rechnung) und `/qr` (QR-Code aus Text/Link).

Die Roblox-Abfragen liegen in `lib/robloxExtra.ts` (getrennt von der Website, damit sie im Bot wiederverwendbar sind).
`/devex` antwortet sofort, der Rest zeigt „denkt nach …“ und liefert dann ein Embed (mit Buttons zu Roblox, wo sinnvoll).

**Bewusst weggelassen** aus der langen Avis-Befehlsliste: `/dwc` (markiert Leute über ungeprüfte Drittanbieter-Listen als
Betrüger — kann Unschuldige treffen), `/australian` / `/british` (raten Nationalität — Unfug und potenziell diskriminierend),
Krypto-Transaktions-Tracking (Überwachungswerkzeug). Auf Wunsch bau ich weitere harmlose aus der Liste nach
(z. B. `/games`, `/groupicon`, `/groupnames`, `/gamepass`-Varianten, `/discord avatar|banner` — letztere brauchen einen Bot-Token).

Der Bot antwortet über Discords **HTTP-Interactions**: kein dauerlaufender Bot-Prozess, keine Gateway-Verbindung, er läuft als normale Vercel-Route
(`app/api/discord/interactions`). Die Logik steckt in `lib/discordBot.ts`, die Roblox-Abfragen sind dieselben wie auf der Website
(`lib/robloxAudio.ts`, `lib/robloxUser.ts`). Er läuft als Server- **und** als User-App (überall nutzbar, auch in DMs).

Antworten sind Embeds im Stil deiner Screenshots (Titel, Thumbnail, Felder, Link-Buttons „Open on Roblox“ / „Analyze on system98“).
Roblox-Texte werden entschärft (Markdown escaped, `@everyone` ohne Ping). Pro Discord-User max. 10 Abfragen pro Minute.

### Einrichten (einmalig)

1. Im [Discord Developer Portal](https://discord.com/developers/applications) **New Application**.
2. **General Information**: *Application ID* und *Public Key* kopieren.
3. **Bot**: *Reset Token* → Token kopieren (wird nur für Schritt 6 gebraucht). Privileged Intents brauchst du **keine**.
4. **Installation**: sowohl *User Install* als auch *Guild Install* aktivieren.
   - Bei *Guild Install* als Scopes `applications.commands` und `bot` setzen.
   - Bei *Install Link* auf **Custom URL** stellen und `https://system98.org/discord/invite` eintragen.
   Diese eine Seite bietet dann beide Wege an: **„Add to my account"** (User Install, der Bot landet auf dem eigenen Discord-Account und funktioniert überall inkl. DMs) und **„Add to a server"** (Guild Install). Direktlinks gehen auch: `…/discord/invite?type=user` bzw. `?type=guild`.
   Damit die Seite funktioniert, muss `DISCORD_APP_ID` in Vercel gesetzt sein (siehe Schritt 6).
5. In Vercel die Env-Variable **`DISCORD_PUBLIC_KEY`** setzen (und `SITE_URL`), neu deployen.
6. Lokal in `.env.local`: `DISCORD_APP_ID` und `DISCORD_BOT_TOKEN` (optional `DISCORD_GUILD_ID` für einen Test-Server), dann `npm run discord:register` (registriert `/analyze`, `/shazam`, `/audio`, `/user`, `/help`).
7. Optional für `/shazam`: in Vercel `AUDD_API_TOKEN` setzen (kostenloser Token von https://dashboard.audd.io) und neu deployen. Ohne den Token laufen die anderen Befehle normal weiter.
8. Im Portal unter **General Information → Interactions Endpoint URL** eintragen: `https://DEINE-DOMAIN/api/discord/interactions` und speichern.
   Discord schickt dabei einen signierten Test-Request; das klappt nur, wenn Schritt 5 schon deployed ist.
9. Bot über `https://system98.org/discord/invite` hinzufügen (Account oder Server wählen), dann z. B. `/user`, `/avatar`, `/audio` oder `/shazam` ausprobieren.

Ändert sich `lib/discordCommands.json`, einfach noch mal `npm run discord:register`.

## Discord-Bot: `/analyze` (Audio-Analyse ohne Datei-Upload auf der Website)

Ergänzt `/audio` und `/user`. Du hängst dem Command eine Audiodatei an (MP3, OGG/Vorbis, OGG/Opus, WAV oder FLAC, max. 20 MB),
der Bot lädt sie einmalig von Discords eigenem CDN, liest sie **komplett serverseitig** (dieselbe Mathematik wie im
Browser-Tool auf `/roblox-audio`, geprüft gegen ffmpegs `ebur128` — Lautheit und Peak stimmen auf 0,1 überein) und
schickt Format, Kanäle, Dauer, Größe, Bitrate, Lautheit (LUFS) und Peak (dBFS) als Embed zurück, mit angehängtem
Waveform-PNG. Nur Discords eigener CDN-Host wird abgerufen, die Datei bleibt nirgends gespeichert.

Technisch nutzt das `mpg123-decoder` (MP3) sowie die `@wasm-audio-decoders`-Pakete (Vorbis/Opus/FLAC) — WebAssembly-Decoder,
die serverseitig in der Vercel-Function laufen. In `next.config.ts` stehen sie unter `serverExternalPackages`: sie haben eine
optionale Web-Worker-Variante mit einem rein dynamischen `import(...)`, das Turbopack beim Bundlen nicht auflösen kann;
extern lässt Node sie zur Laufzeit ganz normal laden.

## Vom alten Bot übernommen bzw. bewusst nicht übernommen

Du hattest testweise einen älteren, lokal laufenden Python/discord.py-Bot geschickt. Übernommen wurde die Analyse-Idee
(`/analyze`, oben) — neu geschrieben in TypeScript, damit sie ohne eigenen PC/Server als Vercel-Function läuft.

Bewusst **nicht** übernommen, mit Begründung:

- **`/cr` (Pitch/Speed-Shift-Presets, „Auto-Fit“):** verändert eine Datei minimal, gerade so weit, dass automatische
  Erkennung (z. B. Content-ID, Shazam) sie nicht mehr erkennt. Das ist im Kern eine Umgehung von Urheberrechts-Erkennung,
  unabhängig vom Preset-Namen. Baue ich nicht.
- **`/download` (yt-dlp):** lädt Videos/Audio von YouTube & Co. herunter — derselbe Grund wie bei den Downloader-Wünschen
  weiter oben in diesem Chat.
- **Status-Feld statt `/monitor`:** Der nützliche Teil von `/monitor` (ist ein Audio verfügbar, in Moderation oder entfernt?)
  läuft jetzt **ohne Login und ohne Cookie**. `/roblox-audio` und der Discord-Befehl `/audio` zeigen ein Feld **Status**
  (Available / In moderation / Unavailable), abgeleitet aus dem, was Roblox öffentlich hergibt. Kein automatisches Dauer-Polling,
  aber ein `/audio` erneut ausführen zeigt den aktuellen Stand.
- **`/monitor` als Dauer-Poller, `/grant_audio`, der ganze Roblox-Cookie-Teil:** brauchen ein `.ROBLOSECURITY`-Cookie, also den vollen
  Zugriff auf einen Roblox-Account, dauerhaft in einer `.env`-Datei gespeichert. Das ist selbst für den Bot-Besitzer ein
  großes Risiko: das `.ROBLOSECURITY`-Cookie ist der volle Zugang zum Account (auch ohne Passwort/2FA) und müsste dauerhaft als
  Umgebungsvariable liegen, wo es über Logs, Projektzugriff oder eine Abhängigkeits-Lücke abgreifbar ist. Ein Leak = übernommener Account.
  So ein Geheimnis gehört nicht in eine öffentlich laufende Vercel-Function — auch nicht das eigene.
- **`/shazam` (Songerkennung):** jetzt drin, aber über die **offizielle AudD-API** (audd.io) statt über das inoffizielle SongRec
  des alten Bots. Du hängst eine Audiodatei an, der Bot schickt sie an AudD und gibt Titel, Künstler, Album, Release, Label und
  Streaming-Links (Spotify/Apple/Deezer) als Embed mit Cover zurück. Braucht `AUDD_API_TOKEN` (kostenloser Test-Token unter
  https://dashboard.audd.io); ohne Token antwortet der Befehl mit einem klaren Hinweis. Logik in `lib/songRecognition.ts`.
- **`/ping` (Host-CPU/RAM/GPU):** ergibt in der Vercel-Function keinen Sinn, es gibt keinen festen „Host“, den man abfragen
  könnte. Für den Zustand von system98 gibt es stattdessen die Live-Status-Seite `/status` (und `/api/status`).
- **`/verifygroup`, `/whitelist`, Rollen-Rechte:** sehr auf den Workflow des alten Bots zugeschnitten (Gruppen-Audio für ein
  bestimmtes Roblox-Spiel freigeben). Passt nicht zu system98 als allgemeinem Werkzeugkasten. Bei Bedarf später separat.

## `/user` mit RAP / Value (Rolimons)

`/user` zeigt jetzt zusätzlich **RAP** und **Value** aus Rolimons. Rolimons hat keine offizielle API — die Werte
kommen von deren öffentlichem Endpunkt und können sich ohne Vorwarnung ändern oder ausfallen. Fällt Rolimons aus,
erscheint der Rest des Embeds trotzdem, die beiden Felder werden dann einfach weggelassen. Logik in `lib/robloxExtra.ts`
(`getRolimons`). Kein API-Key nötig.

## `/user` mit Dropdown & Blättern (Runde 2)

`/user` zeigt jetzt ein **Auswahlmenü** unter dem Embed (User Profile, Avatar, Groups, Games, Currently Wearing,
Previous Usernames, Friends, Followers) — wie beim Avis-Bot. Bei langen Listen (z. B. Groups) gibt es **◀ Prev / Next ▶**
mit Seitenanzeige.

Technisch: Klicks kommen als Discord-Component-Interactions (Typ 3) rein. Die neue Route in `app/api/discord/interactions`
beantwortet sie mit „deferred update" (Typ 6) und editiert dieselbe Nachricht. Es wird **kein State gespeichert** — die
custom_id trägt alles (`v2|<view>|<robloxUserId>|<page>`), also funktioniert es auch nach einem Neustart der Funktion.
Logik in `lib/discordBot.ts` (`handleComponent`, `renderUserView`, `userComponents`), Daten in `lib/robloxExtra.ts`
(`getFollowers`, `getUserGames`, `getPreviousUsernames` neu dazu).

Kein neues `npm run discord:register` nötig (die Views sind keine eigenen Slash-Commands, nur Komponenten von `/user`).

## /user: Games-Seite, Layout, Online-Status, Rate-Limit (aktuellste Runde)

- **Rate-Limit bei Friends/Followers/Groups behoben (richtig diesmal):** In der vorigen Datei war der Cache-Fix nicht
  drin. Jetzt: pro User werden die geladenen Listen ein paar Minuten gecacht (`viewCache` in der Interactions-Route,
  nur Erfolge), weniger gleichzeitige Roblox-Requests und mehr Backoff (`lib/robloxHttp.ts`). Einmal geladen, wird beim
  Klicken/Blättern die zwischengespeicherte Liste benutzt statt Roblox neu zu hämmern.
- **Games-Seite im Avis-Stil:** ein Spiel pro Seite mit „<name>'s Created Games (N)", Game Information +
  Player Information nebeneinander (Universe/Place ID, Created/Updated, Playable, Active, Favorites, Visits,
  Likes/Dislikes, Server Size), Beschreibung, Thumbnail und „Page x/N" mit ◀/▶.
- **Erste /user-Seite im Avis-Layout:** ID / Verified / Inventory, RAP / Value / Groups, Created / Last Cached Online /
  Badges, darunter Beschreibung und (opt-in) Online-Status. Fehlende Werte = `N/A`.
- **Online-Status:** aus Roblox' eigener Presence-API, wird nur gezeigt, wenn Roblox ihn liefert (also nur bei Leuten,
  die ihre Sichtbarkeit auf Roblox erlaubt haben). Kein Tracking.
- **Icons:** die Dropdown-Symbole bleiben eigene SVGs (`public/discord-emojis/*.svg`). Das Rolimons- bzw. Roblox-Logo
  baue ich bewusst **nicht** nach (geschützte Marken); für die Wert-Ansicht wird ein neutrales Symbol benutzt.

## /user Feinschliff: Description, gecachte Detail-Fetches

- **Description** ist auf der ersten /user-Seite wieder als eigenes Feld dabei (wie bei Avis).
- **Rate-Limit weiter entschärft:** Auch die Pro-Seite-Fetches werden jetzt gecacht — die Gruppen-Detailabfrage
  pro Gruppe (`groupdetail:<id>:<role>`) und die Listen (friends/followers/groups/games). Beim Blättern wird die
  gespeicherte Antwort benutzt, statt Roblox pro Klick neu abzufragen. Zusammen mit weniger gleichzeitigen Requests
  und mehr Backoff verschwindet das „rate limited" bei normaler Nutzung.

Hinweis zum echten „nur 10 laden, Rest beim Weiterblättern": Groups und Games zeigen ohnehin **ein** Element pro Seite,
und die zugehörige Detailabfrage wird erst beim Aufrufen dieser Seite gemacht und dann gecacht — also genau lazy.
Bei Friends/Followers holt Roblox die Namensliste in einer Abfrage; die wird einmal geholt und gecacht, danach ist
Blättern rein aus dem Cache.
