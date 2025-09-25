# Zeus Video Library

A single-page Angular experience that showcases a curated video library in a crisp white and red theme. The layout features a folder selector on the right, a responsive grid of video thumbnails, and a YouTube-inspired modal player that highlights related content.

## Getting started

1. Install dependencies
   ```bash
   npm install
   ```
2. Launch the development server
   ```bash
   npm start
   ```
3. Open [http://localhost:4200](http://localhost:4200) in your browser.

## Available scripts

- `npm start` – Serves the application with live reload.
- `npm run build` – Produces a production build in `dist/`.
- `npm test` – Executes unit tests with Karma + Jasmine.

## Project structure

```
src/
├── app/
│   ├── app.component.html   # Layout for the library page
│   ├── app.component.scss   # White/red themed styling
│   └── app.component.ts     # Component logic and sample data
├── assets/                  # Static assets (placeholders)
├── favicon.ico              # Custom favicon
├── index.html               # Application shell
├── main.ts                  # Bootstraps the Angular app
└── styles.scss              # Global styles and design tokens
```

## Video sources & images

The demo content references freely accessible preview clips from [samplelib.com](https://samplelib.com) and royalty-free imagery hosted on Unsplash to provide an immediate sense of the intended UI. Replace these URLs with your own media for production use.
