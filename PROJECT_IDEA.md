# Swipeify – Projectdocument

**Versie:** 1.0  
**Type:** Lokale webapplicatie  
**Technologie:** React + Vite  
**Visuele stijl:** Premium / Editorial

---

## 1. Het concept

Swipeify is een applicatie waarmee gebruikers hun bestaande Spotify-playlists snel kunnen opschonen en opnieuw samenstellen.

Het concept is geïnspireerd op Tinder. In plaats van handmatig door een lange playlist te scrollen, krijgt de gebruiker steeds één nummer te zien en te horen. Vervolgens kan de gebruiker naar links of rechts swipen om te bepalen of het nummer in de nieuwe playlist thuishoort.

Het doel is om het samenstellen van playlists eenvoudiger, sneller en leuker te maken.

**Het kernidee: Tinder voor Spotify-playlists.**

## 2. Gebruikersflow

De applicatie bestaat uit vier hoofdstappen:

### Stap 1 – Spotify verbinden
- De gebruiker logt in met zijn Spotify-account.
- Authenticatie verloopt via OAuth 2.0 Authorization Code met PKCE.
- De applicatie krijgt toegang tot de benodigde playlists en muziekinformatie.

### Stap 2 – Playlist selecteren
- De gebruiker krijgt een overzicht van zijn Spotify-playlists.
- Hij selecteert een playlist die als input dient.
- De applicatie haalt de nummers uit deze playlist op.

### Stap 3 – Nummers swipen
De applicatie toont steeds één nummer.

Informatie op de kaart:
- Albumcover.
- Naam van het nummer.
- Artiest.
- Audio-preview.
- Voortgangsbalk.
- Nummer in de huidige reeks (bijvoorbeeld 23 / 145).

Bediening:
- Naar links swipen: nummer verwijderen / niet meenemen.
- Naar rechts swipen: nummer toevoegen aan de nieuwe playlist.
- Knoppen als alternatief voor swipen.
- Mogelijkheid om het vorige besluit ongedaan te maken.
- Automatisch naar het volgende nummer gaan.

### Stap 4 – Nieuwe playlist maken
- Overzicht van alle geselecteerde nummers.
- Mogelijkheid om de selectie te controleren.
- Gebruiker kiest een naam voor de nieuwe playlist.
- Applicatie maakt automatisch een nieuwe playlist aan in Spotify.
- De geselecteerde nummers worden toegevoegd.

## 3. Visuele identiteit

De gekozen stijl is **Premium / Editorial**.

De applicatie moet aanvoelen als een hoogwaardige, zelfstandige muziekapp en niet als een kopie van Spotify.

### Designprincipes

- Donkere, bijna zwarte achtergrond.
- Crème- en champagnekleurige accenten.
- Grote albumcovers als centraal visueel element.
- Elegante, editoriale typografie.
- Minimalistische bediening.
- Ruimte en rust in de interface.
- Subtiele animaties bij het swipen.

### Belangrijkste scherm: Swipe Interface

Het swipe-scherm krijgt de meeste aandacht.

De albumcover staat centraal en neemt een groot deel van het scherm in beslag. Daaronder staan de titel en artiest.

Onder de muziekkaart staan twee duidelijke acties:
- Links: verwijderen (kruis).
- Rechts: toevoegen (hart).

Verder zijn zichtbaar:
- De voortgang van de playlist.
- De afspeelstatus en previewduur.
- Een optie om het nummer opnieuw af te spelen.
- Een undo-functie.

De interface moet zowel met muis als touchscreen prettig werken.

## 4. Functionele eisen

### MVP – Eerste versie

| Functionaliteit | Prioriteit |
|---|---|
| Spotify-login | Must-have |
| Spotify-playlists ophalen | Must-have |
| Playlist selecteren | Must-have |
| Nummers één voor één tonen | Must-have |
| Links/rechts swipen | Must-have |
| Nummers selecteren en afwijzen | Must-have |
| Voortgang bijhouden | Must-have |
| Undo laatste swipe | Nice-to-have |
| Nieuwe playlist aanmaken | Must-have |
| Geselecteerde nummers toevoegen | Must-have |

### Mogelijke uitbreidingen

- Statistieken over de gemaakte keuzes.
- Meerdere playlists combineren.
- Een sessie tussentijds opslaan en hervatten.
- Meerdere nieuwe playlists maken vanuit één bronplaylist.
- Filters op genre, artiest of album.
- Een overzicht van afgewezen nummers.
- Keyboard shortcuts.
- Een shuffle-modus.

## 5. Technische architectuur

De eerste versie wordt gebouwd als lokale webapplicatie.

### Technologiekeuzes

| Onderdeel | Technologie |
|---|---|
| Frontend | React |
| Build tooling | Vite |
| Programmeertaal | TypeScript |
| Styling | Tailwind CSS |
| Animaties | Framer Motion |
| Iconen | Lucide |
| Muziekintegratie | Spotify Web API |
| Authenticatie | OAuth 2.0 + PKCE |
| Lokale opslag | LocalStorage |

### Voorgestelde projectstructuur

```text
swipeify/
├── src/
│   ├── components/
│   │   ├── SwipeCard.tsx
│   │   ├── MusicPlayer.tsx
│   │   ├── SwipeButtons.tsx
│   │   └── ProgressBar.tsx
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Playlists.tsx
│   │   ├── Swipe.tsx
│   │   └── Results.tsx
│   ├── services/
│   │   └── spotify.ts
│   ├── hooks/
│   │   └── useSwipe.ts
│   ├── types/
│   └── App.tsx
├── public/
└── package.json
```

## 6. Spotify-integratie en aandachtspunten

De Spotify Web API wordt gebruikt voor:
- Authenticatie.
- Ophalen van playlists.
- Ophalen van trackinformatie en albumcovers.
- Aanmaken van nieuwe playlists.
- Toevoegen van geselecteerde nummers.

**Audio-preview**

Een belangrijk aandachtspunt is dat Spotify niet voor ieder nummer een preview beschikbaar stelt. De voormalige `preview_url` is niet betrouwbaar beschikbaar voor alle tracks.

Daarom moet de applicatie rekening houden met verschillende mogelijkheden:
- Een beschikbare preview afspelen.
- Spotify Playback SDK gebruiken voor volledige playback, met de bijbehorende Premium- en accountvereisten.
- Een duidelijke alternatieve weergave wanneer geen preview beschikbaar is.

De applicatie moet dus ook zonder preview prettig bruikbaar blijven.

## 7. Ontwikkelstrategie

We bouwen Swipeify gefaseerd.

### Fase 1 – Frontend prototype
- React + Vite project opzetten.
- Premium / Editorial design implementeren.
- Homepagina bouwen.
- Playlistselectie met demo-data.
- Swipe-interface volledig functioneel maken.
- Resultatenscherm bouwen.
- Demo-muziekdata gebruiken.

### Fase 2 – Spotify-integratie
- Spotify Developer-app configureren.
- OAuth-login implementeren.
- Playlists ophalen.
- Trackinformatie en albumcovers ophalen.
- Previewmogelijkheden onderzoeken en implementeren.

### Fase 3 – Playlistgeneratie
- Selectie van nummers verwerken.
- Nieuwe Spotify-playlist aanmaken.
- Geselecteerde nummers toevoegen.
- Succesmelding en link naar de playlist tonen.

### Fase 4 – Verbeteringen
- Animaties perfectioneren.
- Undo en voortgang opslaan.
- Edge cases oplossen.
- Responsive design verbeteren.
- Gebruikservaring optimaliseren.

## 8. Toekomstvisie

De eerste versie wordt een lokale React-webapplicatie die via localhost te gebruiken is.

De architectuur moet wel rekening houden met een mogelijke toekomstige uitbreiding naar React Native.

Zo kan Swipeify later ook als echte mobiele applicatie op iOS en Android beschikbaar worden gemaakt.

---

## 9. Eindvisie

Swipeify moet een eenvoudige, elegante en snelle manier bieden om Spotify-playlists opnieuw samen te stellen.

De belangrijkste ontwerpfilosofie:

**Minder scrollen, meer luisteren, sneller beslissen.**

De gebruiker moet zonder ingewikkelde instellingen binnen enkele minuten een bestaande playlist kunnen omzetten naar een nieuwe, persoonlijke selectie.
