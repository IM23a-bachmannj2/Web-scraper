[![CI](https://github.com/IM23a-bachmannj2/Web-scraper/actions/workflows/ci.yml/badge.svg)](https://github.com/IM23a-bachmannj2/Web-scraper/actions/workflows/ci.yml)

# Web-scraper

Statische Website-Analyse mit TypeScript. Die komplette Analyse laeuft jetzt im Frontend, damit das Projekt direkt ueber GitHub Pages deployt werden kann.

## Funktionen

- Eingabe einer URL im Frontend
- Analyse von Seitentitel, Meta-Description, Sprache, Ueberschriften, Absaetzen, Links und Bildern
- Tiefenanalyse fuer interne Links genau eine Ebene tief
- Anzeige interner und externer Links inklusive Unterseiten-Zusammenfassung
- GitHub Pages Deployment ohne Express oder separaten Backend-Workflow

## Wichtige Einschraenkung

Die GitHub Pages Version laedt Webseiten direkt aus dem Browser. Viele Seiten erlauben das wegen CORS nicht. In diesen Faellen zeigt die App eine passende Fehlermeldung an, statt wie frueher ueber ein eigenes Backend zu gehen.

## Lokal starten

```bash
pnpm install
pnpm run build
pnpm start
```

Danach ist die statische Vorschau unter `http://localhost:3000` verfuegbar.

## Deployment

`ci.yml` prueft Format, Lint, Build und Tests. `deploy-pages.yml` baut die statische Version und deployed den Inhalt von `public/` nach GitHub Pages.
