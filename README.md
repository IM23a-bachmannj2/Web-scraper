[![Build Frontend](https://github.com/<USERNAME>/<REPO>/actions/workflows/frontend_job.yml/badge.svg)](https://github.com/IM23a-bachmannj2/Web-scraper/actions/workflows/frontend_job.yml)

# Web-scraper

Kleines Web-Scraper-Projekt mit Express.js + TypeScript.

## Funktionen

- Eingabe einer URL im Frontend
- Backend-Endpunkt `POST /api/analyze` für Basisdaten-Analyse
- Ausgabe von:
  - HTTP-Status
  - Finaler URL (nach Redirects)
  - Seitentitel
  - Meta-Description
  - Sprache (`<html lang>`)
  - Anzahl von Überschriften, Absätzen, Links und Bildern
  - Erkannte Haupt-Überschriften (h1-h3)
  - kurzer Textauszug

## Starten

```bash
npm install
npm run build
npm start
```

Dann öffnen: `http://localhost:3000`.
