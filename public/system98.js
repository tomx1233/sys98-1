(function(){
  var translations = {
    de: {
      nav_tools: "Tools", nav_about: "Über", nav_tip: "Unterstützen", nav_cta_home: "Los geht's",
      tool10_h3: "Roblox-Account-Suche", tool10_p: "Roblox-Account ansehen: Namen, Erstellungsdatum, Freunde, Follower, Gruppen und Badges.", tool10_tag: "username · id · profil",
      tool11_h3: "Roblox-Gruppen-Suche", tool11_p: "Gruppe per Name, ID oder Link finden: Besitzer, Mitgliederzahl, Beschreibung und Badge.", tool11_tag: "name · id · link",
      tool12_h3: "Roblox-Spielesuche", tool12_p: "Spiele per Name suchen oder Universe-ID einfügen für Spieler- und Besuchszahlen.", tool12_tag: "name · universe-id",
      tool13_h3: "Roblox-Avatar & Outfit", tool13_p: "Avatar, Bust oder Headshot eines Users holen — und sehen, was er gerade trägt.", tool13_tag: "avatar · bust · headshot",
      tool14_h3: "Roblox-Freunde", tool14_p: "Freundesliste eines Users ansehen oder prüfen, ob zwei Accounts befreundet sind.", tool14_tag: "liste · befreundet?",
      tool15_h3: "Roblox-Account-Alter", tool15_p: "Wie alt ist ein Account? Erstellungsdatum und genaues Alter in Tagen.", tool15_tag: "erstellt · tage",
      tool16_h3: "Roblox-Username-Check", tool16_p: "Ist der Username noch frei? Form-Check plus Live-Prüfung, ob ihn jemand besitzt.", tool16_tag: "frei · vergeben",
      tool17_h3: "Roblox-Katalog-Suche", tool17_p: "Assets, Gamepässe und Bundles per ID oder Link: Name, Ersteller, Preis und mehr.", tool17_tag: "asset · gamepass · bundle",
      tool18_h3: "DevEx-Rechner", tool18_p: "Robux zum Roblox-DevEx-Kurs in USD umrechnen. Läuft im Browser.", tool18_tag: "$0,0035 pro Robux",
      tool19_h3: "Text-Tools", tool19_p: "NATO-Buchstabierung, Text umkehren und Zalgo-Text. Alles im Browser, sofort.", tool19_tag: "nato · reverse · zalgo",
      tool20_h3: "Krypto-Preis", tool20_p: "XRP zuerst wie beim Bot — plus Bitcoin, Ethereum und Solana von CoinGecko.", tool20_tag: "xrp · btc · eth · sol",
      tool21_h3: "Roblox-Nutzergruppen", tool21_p: "Alle Gruppen, in denen ein Roblox-User ist, mit Rolle und Mitgliederzahlen.", tool21_tag: "gruppen · rollen",
      tool22_h3: "Roblox-Asset-Icon", tool22_p: "Asset-ID oder Link einfügen und das Icon-Bild bekommen, zum Öffnen oder Kopieren.", tool22_tag: "id · link → icon",
      tool23_h3: "Songerkennung", tool23_p: "Audioclip ablegen und den Song bekommen: Titel, Artist, Album und Streaming-Links.", tool23_tag: "welcher song ist das?",
      tool24_h3: "cr — Tonhöhe/Tempo ändern", tool24_p: "Tonhöhe und Tempo einer Audiodatei verschieben oder per Auto-Fit einen Shift finden, den die Erkennung nicht identifizieren kann. MP3 + Spektrogramm als Ergebnis.", tool24_tag: "presets · auto-fit",
      tool9_h3: "Roblox-Audio-Info", tool9_p: "Audio-ID nachschlagen: Ersteller, Artist, Favoriten und Länge. Datei ablegen für Lautheit, Peak und Waveform.", tool9_tag: "id · ersteller · lautheit",
      tool8_h3: "Bild-Konverter", tool8_p: "PNG zu GIF, WebP zu GIF und zurück. Animationen bleiben animiert. Läuft im Browser.", tool8_tag: "png · jpg · webp · gif",
      tool7_h3: "Audio-Konverter", tool7_p: "MP4 zu MP3, MP3 zu OGG und mehr. Läuft im Browser, deine Dateien verlassen dein Gerät nicht.", tool7_tag: "mp3 · ogg · opus · m4a · flac · wav",
      tool6_h3: "Ist die Seite down?", tool6_p: "Gib eine Website ein und sieh, ob sie erreichbar ist und wie schnell sie antwortet.", tool6_tag: "mit Merkliste",
      nav_support: "Support", footer_staff: "Team-Login", about_support: "Support kontaktieren",
      hero_kicker_home: "kostenlos · kein Konto nötig",
      hero_h1_home: "Kleine Aufgaben, ohne Umwege gelöst.",
      hero_lead_home: "Kleine Werkzeuge für Sachen, die man zweimal im Monat braucht und nie im Kopf behält: Seiten prüfen, Audio und Bilder umwandeln, Codes bauen, Bilder freistellen. Öffnen, machen, fertig.",
      stat_free: "für immer kostenlos", stat_nosignup: "keine Anmeldung",
      btn_tools: "Tools ansehen", btn_about: "Wer steckt dahinter",
      tools_head_h2: "Alle Tools, ein Ort",
      tools_head_p: "Jedes läuft als eigene kleine Seite. Keine Anmeldung, keine Wartezeit, kein Abo.",
      tool1_h3: "YouTube Downloader", tool1_p: "Link einfügen, Format wählen, Video oder nur die Tonspur sichern.", tool1_tag: "unterstützt mp4 & mp3",
      tool2_h3: "SoundCloud Downloader", tool2_p: "Tracks direkt aus dem Link als MP3 ziehen, ohne Umweg über andere Seiten.", tool2_tag: "einzelne Tracks",
      tool3_h3: "Spotify Downloader", tool3_p: "Einzelne Songs oder ganze Playlists als Audiodatei speichern.", tool3_tag: "auch ganze Playlists",
      tool4_h3: "Link → QR-Code", tool4_p: "Jeden Link in einen QR-Code umwandeln und als Bild sichern.", tool4_tag: "als PNG oder SVG",
      tool5_h3: "Hintergrund entfernen", tool5_p: "Bild hochladen, Hintergrund automatisch freistellen, als PNG mit Transparenz sichern.", tool5_tag: "in Sekunden freigestellt",
      tool_open: "Tool öffnen",
      soon_h3: "Nächstes Tool", soon_p: "Steht schon auf der Liste, kommt aber erst wenn's wirklich fertig ist.", soon_tag: "noch nicht gemerged",
      about_kicker: "worum's geht", about_h2: "Gebaut von einer Person, nicht von einem Team.",
      stats_tools: "aktive Tools", stats_ads: "eingeblendete Werbung", stats_cost: "kostet es dich", stats_dev: "Person baut daran", about_note: "keine Investoren, keine Roadmap-Meetings — nur ich und ein Texteditor",
      about_p1: "system98 ist an ein paar Abenden entstanden, weil ich die immer gleichen kleinen Aufgaben leid war: irgendwo einen Link einfügen, auf eine Downloadseite warten, die dritte Werbung wegklicken. Hier bleibt das aus.",
      about_p2: "Kein Tracking, kein Login, keine Daten, die irgendwo landen. Wenn ein Tool Ärger macht oder fehlt, meld dich einfach.",
      footer_terms: "Nutzungsbedingungen", footer_privacy: "Datenschutz",
      signoff_hand: "das war's, das ist das ganze Team", footer_shell_home: 'echo "kleine Tools müssen nicht kompliziert sein"', signoff_status: "meistens online, antworte meist innerhalb eines Tages", footer_shipped: "zuletzt vor ein paar Tagen was released", footer_fine: "© 2026 system98"
    },
    en: {
      nav_tools: "Tools", nav_about: "About", nav_tip: "Support", nav_cta_home: "Get started",
      tool10_h3: "Roblox User Lookup", tool10_p: "Look at a Roblox account: names, created date, friends, followers, groups and badges.", tool10_tag: "username · id · profile",
      tool11_h3: "Roblox Group Lookup", tool11_p: "Find a group by name, ID or link: owner, member count, description and badge.", tool11_tag: "name · id · link",
      tool12_h3: "Roblox Game Search", tool12_p: "Search games by name or paste a universe ID for playing and visit stats.", tool12_tag: "name · universe id",
      tool13_h3: "Roblox Avatar & Outfit", tool13_p: "Fetch a user's avatar, bust or headshot — and see what they're wearing.", tool13_tag: "avatar · bust · headshot",
      tool14_h3: "Roblox Friends", tool14_p: "Browse a user's friend list, or check if two accounts are friends.", tool14_tag: "friend list · are friends",
      tool15_h3: "Roblox Account Age", tool15_p: "How old is an account? Creation date and exact age in days.", tool15_tag: "created date · days",
      tool16_h3: "Roblox Username Check", tool16_p: "Is that username still free? Valid-shape check plus a live ownership check.", tool16_tag: "available · taken",
      tool17_h3: "Roblox Catalog Lookup", tool17_p: "Assets, gamepasses and bundles by ID or link: name, creator, price and more.", tool17_tag: "asset · gamepass · bundle",
      tool18_h3: "DevEx Calculator", tool18_p: "Convert Robux to USD at Roblox's Developer Exchange rate. Runs in your browser.", tool18_tag: "$0.0035 per Robux",
      tool19_h3: "Text Tools", tool19_p: "NATO phonetics, reverse text and Zalgo text. All in your browser, instant.", tool19_tag: "nato · reverse · zalgo",
      tool20_h3: "Crypto Price", tool20_p: "XRP first, like the bot — plus Bitcoin, Ethereum and Solana from CoinGecko.", tool20_tag: "xrp · btc · eth · sol",
      tool21_h3: "Roblox User Groups", tool21_p: "Every group a Roblox user is in, with their role and member counts.", tool21_tag: "groups · roles",
      tool22_h3: "Roblox Asset Icon", tool22_p: "Paste an asset ID or link and get its icon image, ready to open or copy.", tool22_tag: "id · link → icon",
      tool23_h3: "Song Recognition", tool23_p: "Drop an audio clip and get the song: title, artist, album and streaming links.", tool23_tag: "what's that song?",
      tool24_h3: "cr — Key/Speed Shift", tool24_p: "Shift an audio file's key and speed, or Auto-Fit a shift the recogniser can't identify. MP3 + spectrogram out.", tool24_tag: "presets · auto-fit",
      tool9_h3: "Roblox Audio Info", tool9_p: "Look up an audio ID: creator, artist, favorites and length. Drop a file for loudness, peak and waveform.", tool9_tag: "id · creator · loudness",
      tool8_h3: "Image Converter", tool8_p: "PNG to GIF, WebP to GIF and back. Animations stay animated. Runs in your browser.", tool8_tag: "png · jpg · webp · gif",
      tool7_h3: "Audio Converter", tool7_p: "MP4 to MP3, MP3 to OGG and more. Runs in your browser, files never leave your device.", tool7_tag: "mp3 · ogg · opus · m4a · flac · wav",
      tool6_h3: "Is it down?", tool6_p: "Type a website and see if it is up, how fast it answers and where it redirects.", tool6_tag: "with a watchlist",
      nav_support: "Support", footer_staff: "Staff login", about_support: "Contact support",
      hero_kicker_home: "free · no account needed",
      hero_h1_home: "Small tasks, solved without the detour.",
      hero_lead_home: "Small tools for the stuff you need twice a month and never remember: check a site, convert audio and images, build codes, cut out backgrounds. Open it, do it, done.",
      stat_free: "free forever", stat_nosignup: "no sign-up",
      btn_tools: "See the tools", btn_about: "Who's behind this",
      tools_head_h2: "All the tools, one place",
      tools_head_p: "Each one runs as its own small page. No sign-up, no waiting, no subscription.",
      tool1_h3: "YouTube Downloader", tool1_p: "Paste the link, pick a format, save the video or just the audio.", tool1_tag: "supports mp4 & mp3",
      tool2_h3: "SoundCloud Downloader", tool2_p: "Pull tracks straight from the link as MP3, no detour through other sites.", tool2_tag: "single tracks",
      tool3_h3: "Spotify Downloader", tool3_p: "Save single songs or entire playlists as audio files.", tool3_tag: "whole playlists too",
      tool4_h3: "Link → QR code", tool4_p: "Turn any link into a QR code and save it as an image.", tool4_tag: "as PNG or SVG",
      tool5_h3: "Background Remover", tool5_p: "Upload an image, remove the background automatically, save it as a transparent PNG.", tool5_tag: "done in seconds",
      tool_open: "Open tool",
      soon_h3: "Next tool", soon_p: "Already on the list, but it'll land once it's actually done.", soon_tag: "not merged yet",
      about_kicker: "what this is", about_h2: "Built by one person, not a team.",
      stats_tools: "tools live", stats_ads: "ads shown", stats_cost: "it ever costs", stats_dev: "person building it", about_note: "no investors, no roadmap meetings — just me and a text editor",
      about_p1: "system98 came together over a few evenings because I was tired of the same small tasks: paste a link somewhere, wait for a download page, click away the third ad. Not here.",
      about_p2: "No tracking, no login, no data going anywhere. If a tool breaks or something's missing, just reach out.",
      footer_terms: "Terms", footer_privacy: "Privacy",
      signoff_hand: "that's it, that's the team", footer_shell_home: "echo \"small tools don't have to be complicated\"", signoff_status: "usually online, replies within a day", footer_shipped: "last shipped a few days ago", footer_fine: "© 2026 system98"
    },
    fr: {
      nav_tools: "Outils", nav_about: "À propos", nav_tip: "Soutenir", nav_cta_home: "C'est parti",
      nav_support: "Aide", footer_staff: "Espace équipe", about_support: "Contacter l'aide",
      hero_kicker_home: "gratuit · sans compte",
      hero_h1_home: "De petites tâches, réglées sans détour.",
      hero_lead_home: "De petits outils pour ces trucs dont on a besoin deux fois par mois et qu'on n'a jamais en tête : vérifier un site, convertir audio et images, créer des codes, détourer des images. Ouvrir, faire, terminé.",
      stat_free: "gratuit pour toujours", stat_nosignup: "sans inscription",
      btn_tools: "Voir les outils", btn_about: "Qui est derrière",
      tools_head_h2: "Tous les outils, un seul endroit",
      tools_head_p: "Chacun fonctionne comme sa propre petite page. Pas d'inscription, pas d'attente, pas d'abonnement.",
      tool1_h3: "Téléchargeur YouTube", tool1_p: "Collez le lien, choisissez un format, enregistrez la vidéo ou juste le son.", tool1_tag: "prend en charge mp4 et mp3",
      tool2_h3: "Téléchargeur SoundCloud", tool2_p: "Récupérez des titres directement depuis le lien en MP3, sans détour par d'autres sites.", tool2_tag: "titres individuels",
      tool3_h3: "Téléchargeur Spotify", tool3_p: "Enregistrez des titres seuls ou des playlists entières en fichiers audio.", tool3_tag: "playlists entières aussi",
      tool4_h3: "Lien → code QR", tool4_p: "Transformez n'importe quel lien en code QR et enregistrez-le comme image.", tool4_tag: "en PNG ou SVG",
      tool5_h3: "Suppression d'arrière-plan", tool5_p: "Importez une image, retirez l'arrière-plan automatiquement, enregistrez-la en PNG transparent.", tool5_tag: "en quelques secondes",
      tool_open: "Ouvrir l'outil",
      soon_h3: "Prochain outil", soon_p: "Déjà sur la liste, mais il arrivera seulement une fois vraiment prêt.", soon_tag: "pas encore fusionné",
      about_kicker: "le principe", about_h2: "Créé par une seule personne, pas une équipe.",
      stats_tools: "outils en ligne", stats_ads: "pubs affichées", stats_cost: "ça coûte", stats_dev: "personne derrière tout ça", about_note: "pas d'investisseurs, pas de réunions de roadmap — juste moi et un éditeur de texte",
      about_p1: "system98 est né en quelques soirées parce que j'en avais assez des mêmes petites tâches : coller un lien quelque part, attendre une page de téléchargement, fermer la troisième pub. Ici, ça n'arrive pas.",
      about_p2: "Pas de suivi, pas de connexion, aucune donnée qui traîne quelque part. Si un outil pose problème ou en manque un, dites-le moi simplement.",
      footer_terms: "Conditions", footer_privacy: "Confidentialité",
      signoff_hand: "voilà, c'est toute l'équipe", footer_shell_home: "echo \"les petits outils n'ont pas besoin d'être compliqués\"", signoff_status: "généralement en ligne, réponse sous 24h", footer_shipped: "dernière mise à jour il y a quelques jours", footer_fine: "© 2026 system98"
    },
    es: {
      nav_tools: "Herramientas", nav_about: "Acerca de", nav_tip: "Apoyar", nav_cta_home: "Empezar",
      nav_support: "Ayuda", footer_staff: "Acceso equipo", about_support: "Contactar con ayuda",
      hero_kicker_home: "gratis · sin cuenta",
      hero_h1_home: "Tareas pequeñas, resueltas sin rodeos.",
      hero_lead_home: "Pequeñas herramientas para esas cosas que necesitas dos veces al mes y nunca recuerdas: comprobar un sitio, convertir audio e imágenes, crear códigos, quitar fondos. Abrir, hacer, listo.",
      stat_free: "gratis para siempre", stat_nosignup: "sin registro",
      btn_tools: "Ver herramientas", btn_about: "Quién está detrás",
      tools_head_h2: "Todas las herramientas, un solo lugar",
      tools_head_p: "Cada una funciona como su propia página pequeña. Sin registro, sin espera, sin suscripción.",
      tool1_h3: "Descargador de YouTube", tool1_p: "Pega el enlace, elige un formato, guarda el vídeo o solo el audio.", tool1_tag: "admite mp4 y mp3",
      tool2_h3: "Descargador de SoundCloud", tool2_p: "Saca pistas directamente del enlace en MP3, sin pasar por otras webs.", tool2_tag: "pistas individuales",
      tool3_h3: "Descargador de Spotify", tool3_p: "Guarda canciones sueltas o listas completas como archivos de audio.", tool3_tag: "listas completas también",
      tool4_h3: "Enlace → código QR", tool4_p: "Convierte cualquier enlace en un código QR y guárdalo como imagen.", tool4_tag: "en PNG o SVG",
      tool5_h3: "Quitar fondo", tool5_p: "Sube una imagen, elimina el fondo automáticamente y guárdala como PNG transparente.", tool5_tag: "en segundos",
      tool_open: "Abrir herramienta",
      soon_h3: "Próxima herramienta", soon_p: "Ya está en la lista, pero llegará solo cuando esté realmente lista.", soon_tag: "aún no fusionada",
      about_kicker: "de qué va esto", about_h2: "Hecho por una sola persona, no por un equipo.",
      stats_tools: "herramientas activas", stats_ads: "anuncios mostrados", stats_cost: "cuesta esto", stats_dev: "persona construyéndolo", about_note: "sin inversores, sin reuniones de roadmap — solo yo y un editor de texto",
      about_p1: "system98 nació en unas pocas noches porque estaba harto de las mismas tareas pequeñas: pegar un enlace en algún sitio, esperar una página de descarga, cerrar el tercer anuncio. Aquí eso no pasa.",
      about_p2: "Sin rastreo, sin inicio de sesión, sin datos que acaben en ningún lado. Si una herramienta falla o falta alguna, solo escríbeme.",
      footer_terms: "Términos", footer_privacy: "Privacidad",
      signoff_hand: "eso es todo, ese es el equipo", footer_shell_home: 'echo "las herramientas pequeñas no tienen por qué ser complicadas"', signoff_status: "normalmente en línea, respondo en menos de un día", footer_shipped: "última actualización hace unos días", footer_fine: "© 2026 system98"
    },
    it: {
      nav_tools: "Strumenti", nav_about: "Chi sono", nav_tip: "Sostieni", nav_cta_home: "Inizia",
      nav_support: "Assistenza", footer_staff: "Accesso team", about_support: "Contatta l'assistenza",
      hero_kicker_home: "gratis · nessun account",
      hero_h1_home: "Piccoli compiti, risolti senza giri.",
      hero_lead_home: "Piccoli strumenti per quelle cose che ti servono due volte al mese e non ricordi mai: controllare un sito, convertire audio e immagini, creare codici, rimuovere sfondi. Aprire, fare, fatto.",
      stat_free: "gratis per sempre", stat_nosignup: "senza registrazione",
      btn_tools: "Guarda gli strumenti", btn_about: "Chi c'è dietro",
      tools_head_h2: "Tutti gli strumenti, un solo posto",
      tools_head_p: "Ognuno funziona come una piccola pagina a sé. Nessuna registrazione, nessuna attesa, nessun abbonamento.",
      tool1_h3: "Downloader YouTube", tool1_p: "Incolla il link, scegli un formato, salva il video o solo l'audio.", tool1_tag: "supporta mp4 e mp3",
      tool2_h3: "Downloader SoundCloud", tool2_p: "Scarica le tracce direttamente dal link in MP3, senza passare da altri siti.", tool2_tag: "tracce singole",
      tool3_h3: "Downloader Spotify", tool3_p: "Salva singoli brani o intere playlist come file audio.", tool3_tag: "anche playlist intere",
      tool4_h3: "Link → codice QR", tool4_p: "Trasforma qualsiasi link in un codice QR e salvalo come immagine.", tool4_tag: "in PNG o SVG",
      tool5_h3: "Rimozione sfondo", tool5_p: "Carica un'immagine, rimuovi lo sfondo automaticamente, salvala come PNG trasparente.", tool5_tag: "in pochi secondi",
      tool_open: "Apri strumento",
      soon_h3: "Prossimo strumento", soon_p: "È già in lista, ma arriverà solo quando sarà davvero pronto.", soon_tag: "non ancora unito",
      about_kicker: "di cosa si tratta", about_h2: "Creato da una sola persona, non da un team.",
      stats_tools: "strumenti attivi", stats_ads: "pubblicità mostrate", stats_cost: "costa tutto ciò", stats_dev: "persona che lo costruisce", about_note: "niente investitori, niente riunioni di roadmap — solo io e un editor di testo",
      about_p1: "system98 è nato in poche serate perché ero stanco delle solite piccole faccende: incollare un link da qualche parte, aspettare una pagina di download, chiudere la terza pubblicità. Qui questo non succede.",
      about_p2: "Nessun tracciamento, nessun login, nessun dato che finisce da qualche parte. Se uno strumento dà problemi o ne manca uno, scrivimi pure.",
      footer_terms: "Termini", footer_privacy: "Privacy",
      signoff_hand: "tutto qui, questo è il team", footer_shell_home: 'echo "gli strumenti piccoli non devono essere complicati"', signoff_status: "di solito online, rispondo entro un giorno", footer_shipped: "ultimo aggiornamento qualche giorno fa", footer_fine: "© 2026 system98"
    },
    pt: {
      nav_tools: "Ferramentas", nav_about: "Sobre", nav_tip: "Apoiar", nav_cta_home: "Começar",
      nav_support: "Ajuda", footer_staff: "Acesso equipa", about_support: "Contactar o suporte",
      hero_kicker_home: "grátis · sem conta",
      hero_h1_home: "Pequenas tarefas, resolvidas sem rodeios.",
      hero_lead_home: "Pequenas ferramentas para aquelas coisas que você precisa duas vezes por mês e nunca lembra: verificar um site, converter áudio e imagens, criar códigos, remover fundos. Abrir, fazer, pronto.",
      stat_free: "grátis para sempre", stat_nosignup: "sem cadastro",
      btn_tools: "Ver ferramentas", btn_about: "Quem está por trás",
      tools_head_h2: "Todas as ferramentas, um só lugar",
      tools_head_p: "Cada uma funciona como sua própria página pequena. Sem cadastro, sem espera, sem assinatura.",
      tool1_h3: "Downloader do YouTube", tool1_p: "Cole o link, escolha um formato, salve o vídeo ou só o áudio.", tool1_tag: "suporta mp4 e mp3",
      tool2_h3: "Downloader do SoundCloud", tool2_p: "Baixe faixas direto do link em MP3, sem passar por outros sites.", tool2_tag: "faixas individuais",
      tool3_h3: "Downloader do Spotify", tool3_p: "Salve músicas avulsas ou playlists inteiras como arquivos de áudio.", tool3_tag: "playlists inteiras também",
      tool4_h3: "Link → código QR", tool4_p: "Transforme qualquer link em um código QR e salve como imagem.", tool4_tag: "em PNG ou SVG",
      tool5_h3: "Remover fundo", tool5_p: "Envie uma imagem, remova o fundo automaticamente e salve como PNG transparente.", tool5_tag: "em segundos",
      tool_open: "Abrir ferramenta",
      soon_h3: "Próxima ferramenta", soon_p: "Já está na lista, mas só chega quando estiver realmente pronta.", soon_tag: "ainda não integrada",
      about_kicker: "do que se trata", about_h2: "Feito por uma pessoa só, não por uma equipe.",
      stats_tools: "ferramentas no ar", stats_ads: "anúncios exibidos", stats_cost: "isso custa", stats_dev: "pessoa construindo isso", about_note: "sem investidores, sem reuniões de roadmap — só eu e um editor de texto",
      about_p1: "O system98 nasceu em algumas noites porque eu estava cansado das mesmas pequenas tarefas: colar um link em algum lugar, esperar uma página de download, fechar o terceiro anúncio. Aqui isso não acontece.",
      about_p2: "Sem rastreamento, sem login, nenhum dado indo parar em lugar nenhum. Se uma ferramenta der problema ou faltar, é só me avisar.",
      footer_terms: "Termos", footer_privacy: "Privacidade",
      signoff_hand: "é isso, essa é a equipe toda", footer_shell_home: 'echo "ferramentas pequenas não precisam ser complicadas"', signoff_status: "normalmente online, respondo em até um dia", footer_shipped: "última atualização há alguns dias", footer_fine: "© 2026 system98"
    },
    nl: {
      nav_tools: "Tools", nav_about: "Over", nav_tip: "Steunen", nav_cta_home: "Aan de slag",
      nav_support: "Support", footer_staff: "Team-login", about_support: "Contact met support",
      hero_kicker_home: "gratis · geen account nodig",
      hero_h1_home: "Kleine klusjes, zonder omwegen opgelost.",
      hero_lead_home: "Kleine tools voor dingen die je twee keer per maand nodig hebt en nooit onthoudt: een site controleren, audio en afbeeldingen omzetten, codes maken, achtergronden verwijderen. Openen, doen, klaar.",
      stat_free: "voor altijd gratis", stat_nosignup: "geen account nodig",
      btn_tools: "Bekijk de tools", btn_about: "Wie hierachter zit",
      tools_head_h2: "Alle tools, één plek",
      tools_head_p: "Elke tool draait als eigen kleine pagina. Geen registratie, geen wachttijd, geen abonnement.",
      tool1_h3: "YouTube Downloader", tool1_p: "Link plakken, formaat kiezen, video of alleen het geluid opslaan.", tool1_tag: "ondersteunt mp4 & mp3",
      tool2_h3: "SoundCloud Downloader", tool2_p: "Tracks direct via de link als MP3 binnenhalen, zonder omweg via andere sites.", tool2_tag: "losse tracks",
      tool3_h3: "Spotify Downloader", tool3_p: "Losse nummers of hele playlists als audiobestand opslaan.", tool3_tag: "ook hele playlists",
      tool4_h3: "Link → QR-code", tool4_p: "Elke link omzetten naar een QR-code en als afbeelding opslaan.", tool4_tag: "als PNG of SVG",
      tool5_h3: "Achtergrond verwijderen", tool5_p: "Upload een afbeelding, verwijder automatisch de achtergrond, sla op als transparante PNG.", tool5_tag: "binnen seconden",
      tool_open: "Tool openen",
      soon_h3: "Volgende tool", soon_p: "Staat al op de lijst, maar komt pas als hij echt af is.", soon_tag: "nog niet samengevoegd",
      about_kicker: "waar het over gaat", about_h2: "Gebouwd door één persoon, niet door een team.",
      stats_tools: "actieve tools", stats_ads: "getoonde advertenties", stats_cost: "kost het je", stats_dev: "persoon die het bouwt", about_note: "geen investeerders, geen roadmap-meetings — gewoon ik en een teksteditor",
      about_p1: "system98 is in een paar avonden ontstaan omdat ik de steeds terugkerende klusjes zat was: ergens een link plakken, wachten op een downloadpagina, de derde advertentie wegklikken. Dat blijft hier achterwege.",
      about_p2: "Geen tracking, geen login, geen data die ergens belandt. Als een tool problemen geeft of ontbreekt, laat het me gewoon weten.",
      footer_terms: "Voorwaarden", footer_privacy: "Privacy",
      signoff_hand: "dat is 'm, dat is het hele team", footer_shell_home: 'echo "kleine tools hoeven niet ingewikkeld te zijn"', signoff_status: "meestal online, reageer meestal binnen een dag", footer_shipped: "laatst geüpdatet een paar dagen geleden", footer_fine: "© 2026 system98"
    },
    pl: {
      nav_tools: "Narzędzia", nav_about: "O mnie", nav_tip: "Wesprzyj", nav_cta_home: "Zaczynajmy",
      nav_support: "Pomoc", footer_staff: "Logowanie zespołu", about_support: "Skontaktuj się z pomocą",
      hero_kicker_home: "za darmo · bez konta",
      hero_h1_home: "Drobne zadania, załatwione bez zachodu.",
      hero_lead_home: "Małe narzędzia do rzeczy, których potrzebujesz dwa razy w miesiącu i nigdy nie pamiętasz: sprawdzanie strony, konwersja audio i obrazów, tworzenie kodów, usuwanie tła. Otwórz, zrób, gotowe.",
      stat_free: "zawsze za darmo", stat_nosignup: "bez rejestracji",
      btn_tools: "Zobacz narzędzia", btn_about: "Kto za tym stoi",
      tools_head_h2: "Wszystkie narzędzia, jedno miejsce",
      tools_head_p: "Każde działa jako osobna, mała strona. Bez rejestracji, bez czekania, bez subskrypcji.",
      tool1_h3: "Downloader YouTube", tool1_p: "Wklej link, wybierz format, zapisz wideo albo samo audio.", tool1_tag: "obsługuje mp4 i mp3",
      tool2_h3: "Downloader SoundCloud", tool2_p: "Pobieraj utwory bezpośrednio z linku jako MP3, bez pośrednictwa innych stron.", tool2_tag: "pojedyncze utwory",
      tool3_h3: "Downloader Spotify", tool3_p: "Zapisuj pojedyncze utwory lub całe playlisty jako pliki audio.", tool3_tag: "także całe playlisty",
      tool4_h3: "Link → kod QR", tool4_p: "Zamień dowolny link w kod QR i zapisz go jako obraz.", tool4_tag: "jako PNG lub SVG",
      tool5_h3: "Usuwanie tła", tool5_p: "Wgraj zdjęcie, usuń tło automatycznie, zapisz jako przezroczyste PNG.", tool5_tag: "w kilka sekund",
      tool_open: "Otwórz narzędzie",
      soon_h3: "Kolejne narzędzie", soon_p: "Jest już na liście, ale pojawi się dopiero, gdy będzie naprawdę gotowe.", soon_tag: "jeszcze nie scalone",
      about_kicker: "o co chodzi", about_h2: "Zrobione przez jedną osobę, nie przez zespół.",
      stats_tools: "działających narzędzi", stats_ads: "wyświetlonych reklam", stats_cost: "to kosztuje", stats_dev: "osoba to buduje", about_note: "żadnych inwestorów, żadnych spotkań o roadmapie — tylko ja i edytor tekstu",
      about_p1: "system98 powstał w kilka wieczorów, bo miałem dość tych samych drobnych zadań: wklejanie linku gdzieś, czekanie na stronę z pobieraniem, zamykanie trzeciej reklamy. Tutaj tego nie ma.",
      about_p2: "Bez śledzenia, bez logowania, żadne dane nigdzie nie trafiają. Jeśli narzędzie sprawia problemy albo czegoś brakuje, po prostu daj znać.",
      footer_terms: "Warunki", footer_privacy: "Prywatność",
      signoff_hand: "to wszystko, to cały zespół", footer_shell_home: 'echo "małe narzędzia nie muszą być skomplikowane"', signoff_status: "zwykle online, odpowiadam w ciągu doby", footer_shipped: "ostatnia aktualizacja kilka dni temu", footer_fine: "© 2026 system98"
    },
    tr: {
      nav_tools: "Araçlar", nav_about: "Hakkında", nav_tip: "Destekle", nav_cta_home: "Başlayalım",
      nav_support: "Yardım", footer_staff: "Ekip girişi", about_support: "Yardımla iletişime geç",
      hero_kicker_home: "ücretsiz · hesap gerekmez",
      hero_h1_home: "Küçük işler, dolambaçsız halloldu.",
      hero_lead_home: "Ayda iki kez ihtiyaç duyduğun ve asla aklında tutamadığın şeyler için küçük araçlar: bir siteyi kontrol etme, ses ve görsel dönüştürme, kod oluşturma, arka plan silme. Aç, yap, bitti.",
      stat_free: "sonsuza kadar ücretsiz", stat_nosignup: "kayıt gerektirmez",
      btn_tools: "Araçlara bak", btn_about: "Arkasında kim var",
      tools_head_h2: "Tüm araçlar, tek yer",
      tools_head_p: "Her biri kendi küçük sayfası olarak çalışır. Kayıt yok, bekleme yok, abonelik yok.",
      tool1_h3: "YouTube İndirici", tool1_p: "Linki yapıştır, formatı seç, videoyu ya da sadece sesi kaydet.", tool1_tag: "mp4 ve mp3 destekler",
      tool2_h3: "SoundCloud İndirici", tool2_p: "Parçaları başka sitelere uğramadan doğrudan linkten MP3 olarak çek.", tool2_tag: "tekli parçalar",
      tool3_h3: "Spotify İndirici", tool3_p: "Tek şarkıları ya da tüm çalma listelerini ses dosyası olarak kaydet.", tool3_tag: "tüm çalma listeleri de",
      tool4_h3: "Link → QR kod", tool4_p: "Herhangi bir linki QR koduna çevir ve görsel olarak kaydet.", tool4_tag: "PNG veya SVG olarak",
      tool5_h3: "Arka Plan Silici", tool5_p: "Görseli yükle, arka planı otomatik olarak kaldır, şeffaf PNG olarak kaydet.", tool5_tag: "saniyeler içinde",
      tool_open: "Aracı aç",
      soon_h3: "Sıradaki araç", soon_p: "Listede zaten var, ama gerçekten hazır olunca gelecek.", soon_tag: "henüz birleştirilmedi",
      about_kicker: "konu ne", about_h2: "Bir ekip değil, tek bir kişi tarafından yapıldı.",
      stats_tools: "aktif araç", stats_ads: "gösterilen reklam", stats_cost: "maliyeti bu kadar", stats_dev: "kişi bunu geliştiriyor", about_note: "yatırımcı yok, yol haritası toplantısı yok — sadece ben ve bir metin editörü",
      about_p1: "system98, hep aynı küçük işlerden bıktığım için birkaç akşamda ortaya çıktı: bir yere link yapıştırmak, bir indirme sayfasını beklemek, üçüncü reklamı kapatmak. Burada bunlar yok.",
      about_p2: "Takip yok, giriş yok, hiçbir yere gitmeyen veri yok. Bir araç sorun çıkarırsa ya da eksikse, bana haber ver yeter.",
      footer_terms: "Koşullar", footer_privacy: "Gizlilik",
      signoff_hand: "hepsi bu, ekip bu kadar", footer_shell_home: 'echo "küçük araçların karmaşık olması gerekmez"', signoff_status: "genelde çevrimiçi, bir gün içinde dönüş yaparım", footer_shipped: "son güncelleme birkaç gün önce", footer_fine: "© 2026 system98"
    },
    ru: {
      nav_tools: "Инструменты", nav_about: "О проекте", nav_tip: "Поддержать", nav_cta_home: "Начать",
      nav_support: "Помощь", footer_staff: "Вход для команды", about_support: "Написать в поддержку",
      hero_kicker_home: "бесплатно · без регистрации",
      hero_h1_home: "Мелкие задачи, решённые без лишних шагов.",
      hero_lead_home: "Небольшие инструменты для тех вещей, что нужны раз в пару недель и никогда не держатся в голове: проверка сайта, конвертация аудио и изображений, создание кодов, удаление фона. Открыл, сделал, готово.",
      stat_free: "бесплатно навсегда", stat_nosignup: "без регистрации",
      btn_tools: "Посмотреть инструменты", btn_about: "Кто за этим стоит",
      tools_head_h2: "Все инструменты, одно место",
      tools_head_p: "Каждый работает как отдельная небольшая страница. Без регистрации, без ожидания, без подписки.",
      tool1_h3: "Загрузчик YouTube", tool1_p: "Вставь ссылку, выбери формат, сохрани видео или только звук.", tool1_tag: "поддерживает mp4 и mp3",
      tool2_h3: "Загрузчик SoundCloud", tool2_p: "Скачивай треки прямо по ссылке в MP3, без сторонних сайтов.", tool2_tag: "отдельные треки",
      tool3_h3: "Загрузчик Spotify", tool3_p: "Сохраняй отдельные песни или целые плейлисты как аудиофайлы.", tool3_tag: "и целые плейлисты тоже",
      tool4_h3: "Ссылка → QR-код", tool4_p: "Преврати любую ссылку в QR-код и сохрани как изображение.", tool4_tag: "в PNG или SVG",
      tool5_h3: "Удаление фона", tool5_p: "Загрузи изображение, фон удалится автоматически, сохрани как прозрачный PNG.", tool5_tag: "за секунды",
      tool_open: "Открыть инструмент",
      soon_h3: "Следующий инструмент", soon_p: "Уже в списке, но появится только когда будет по-настоящему готов.", soon_tag: "ещё не готово",
      about_kicker: "суть проекта", about_h2: "Сделано одним человеком, а не командой.",
      stats_tools: "инструментов работает", stats_ads: "показанной рекламы", stats_cost: "это стоит", stats_dev: "человек это делает", about_note: "без инвесторов, без встреч по роадмапу — только я и текстовый редактор",
      about_p1: "system98 появился за несколько вечеров, потому что мне надоели одни и те же мелкие задачи: вставить ссылку куда-то, ждать страницу загрузки, закрывать третью рекламу. Здесь этого нет.",
      about_p2: "Без слежки, без входа, без данных, которые куда-то утекают. Если инструмент барахлит или чего-то не хватает — просто напиши.",
      footer_terms: "Условия", footer_privacy: "Конфиденциальность",
      signoff_hand: "вот и всё, это вся команда", footer_shell_home: 'echo "маленькие инструменты не обязаны быть сложными"', signoff_status: "обычно на связи, отвечаю в течение дня", footer_shipped: "последнее обновление — пару дней назад", footer_fine: "© 2026 system98"
    }
  };

  var root = document.documentElement;
  var STORE_THEME = 's98-theme';
  var STORE_LANG = 's98-lang';

  function read(key){ try { return localStorage.getItem(key); } catch(e){ return null; } }
  function save(key, val){ try { localStorage.setItem(key, val); } catch(e){} }

  /* ---- theme ---- */
  var storedTheme = read(STORE_THEME);
  if (storedTheme === 'dark' || storedTheme === 'light') root.setAttribute('data-theme', storedTheme);

  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function(){
      var isDark = root.getAttribute('data-theme')
        ? root.getAttribute('data-theme') === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      var next = isDark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      save(STORE_THEME, next);
    });
  }

  /* ---- language ---- */
  var langWrap = document.getElementById('langWrap');
  var langBtn = document.getElementById('langBtn');
  var langBtnLabel = document.getElementById('langBtnLabel');
  var langOptions = Array.prototype.slice.call(document.querySelectorAll('.lang-option'));

  function startLang(){
    var saved = read(STORE_LANG);
    return (saved && translations[saved]) ? saved : 'en';
  }

  function applyLang(lang, persist){
    var dict = translations[lang] || translations.en;
    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var key = el.getAttribute('data-i18n');
      if (dict[key] !== undefined) el.textContent = dict[key];
    });
    root.setAttribute('lang', lang);
    if (langBtnLabel) langBtnLabel.textContent = lang.toUpperCase();
    langOptions.forEach(function(opt){
      var isActive = opt.getAttribute('data-lang') === lang;
      opt.classList.toggle('active', isActive);
      opt.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    if (persist) save(STORE_LANG, lang);
  }

  function closeLang(){
    if (!langWrap) return;
    langWrap.classList.remove('open');
    if (langBtn) langBtn.setAttribute('aria-expanded', 'false');
  }

  if (langBtn && langWrap) {
    langBtn.addEventListener('click', function(e){
      e.stopPropagation();
      var open = langWrap.classList.toggle('open');
      langBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    langOptions.forEach(function(opt){
      opt.addEventListener('click', function(){
        applyLang(opt.getAttribute('data-lang'), true);
        closeLang();
      });
    });
    document.addEventListener('click', function(e){
      if (!langWrap.contains(e.target)) closeLang();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeLang();
    });
  }

  applyLang(startLang(), false);

  /* ---- title bars actually do something ---- */
  document.querySelectorAll('.win').forEach(function(win){
    var btn = win.querySelector('.collapse');
    var bar = win.querySelector('.titlebar');
    if (!btn) return;
    function toggle(){
      var collapsed = win.classList.toggle('collapsed');
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.setAttribute('title', collapsed ? 'expand' : 'collapse');
    }
    btn.addEventListener('click', toggle);
    if (bar) bar.addEventListener('dblclick', function(e){
      if (!e.target.closest('.collapse')) toggle();
    });
  });

  /* ---- clock ---- */
  var clock = document.getElementById('clock');
  if (clock) {
    var tick = function(){
      var d = new Date();
      clock.textContent = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    };
    tick();
    setInterval(tick, 20000);
  }

  /* ---- one opening moment ---- */
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){ document.body.classList.add('booted'); });
  });
})();
