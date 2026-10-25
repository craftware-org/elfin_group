# Elfin Group website

Marketing site for **Elfin Group** (Elfin Infra Builders Pvt. Ltd.), builders, developers and promoters in Hubballi since 2008.
It opens with a scroll-driven 3D story, followed by an editorial site in the brand's own black / gold / white palette.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static output in dist/
npm run preview   # serve dist/ on http://localhost:4173
```

Node 18+ is required. The build is fully static, so `dist/` can be hosted on Vercel (config in `vercel.json`), Hostinger or any CDN.

## Deploying

Hosted on **CraftWare's Vercel account** (team `craftware`), project `elfin-group`, using Vercel's GitHub integration with **Root Directory `site`** and the **Vite** preset.

- Live: **https://elfingroup.vercel.app** (also https://elfin-group.vercel.app)
- Every push to `main` deploys to production automatically. Pull requests get a preview URL, which Vercel posts on the PR.
- No tokens or GitHub secrets are needed. Manage domains, deployments and rollbacks at vercel.com/craftware/elfin-group.

## Configuration (`.env`)

| Variable | Used for |
|---|---|
| `VITE_SITE_URL` | canonical URL, Open Graph and JSON-LD links in `index.html` |
| `VITE_WHATSAPP` | number that the contact form and floating button open on WhatsApp (digits only, with 91) |

`public/robots.txt` and `public/sitemap.xml` also contain the domain, so update them if the domain changes.

## How the page is built

| Path | What it does |
|---|---|
| `index.html` | All content and copy (SEO-readable), JSON-LD business data, card illustrations as SVG symbols |
| `src/main.js` | Fonts, Lenis smooth scroll + GSAP ScrollTrigger, preloader, lazy-loads the 3D story |
| `src/ui.js` | Nav, kinetic headings, reveals, counters, project filters, locations map, sample plot plan, WhatsApp form |
| `src/data.js` | Project locations shown on the map (illustrative positions, plus a Google Maps search per project) |
| `src/story/index.js` | Renderer, quality tiers, scroll → camera progress, flash transition, 3D-anchored labels |
| `src/story/earth.js` | Chapter 1–2: globe with a day/night shader, clouds and atmosphere, and a gold pin on Hubballi |
| `src/story/ground.js` | Chapters 3–5: golden-hour world, camera path, Nebula towers, plotted layout, aerial view of all sites |
| `src/story/parts.js` | Procedural builders: sky, fields, towers with lit facades, plot layouts, villas |
| `src/styles/main.css` | Brand tokens (`--gold #C98C34` and `--black #0A0A0A`, sampled from the logo) and all layout |

### The 3D story chapters (scroll progress)

| From | Chapter | Scene |
|---|---|---|
| 0.00 | Elfin Group | Earth over Africa/Gulf, slowly turning |
| 0.12 | Hubballi, home ground | Globe turns east and dives to the Hubballi pin |
| 0.40 | Elfin Nebula | Flash cut to the golden-hour site. The two towers rise floor by floor |
| 0.63 | Plots, planned right | Camera glides to the plotted layout with the ELFIN arch and Plot 31 |
| 0.82 | Many places, one promise | Aerial view with labels for every Elfin site |

Phones and low-power devices get a lighter tier: no shadows, fewer trees and stars, and a lower pixel ratio.
Browsers without WebGL 2 get a static gold-on-black intro, and the chapter text still works.
`prefers-reduced-motion` disables smooth scroll and decorative animation.

## Brand assets

- `public/brand/logo.png|webp`: the **exact** official logo, with only its white background removed.
  On dark surfaces it always sits on a white disc, as on their Instagram profile.
- `public/brand/favicon-*`, `apple-touch-icon.png`, `og-image.jpg` (1200×630 share card).
- `public/images/*`: construction-progress photos from the client's own Instagram (@elfin_group).
- `public/textures/*`: Earth textures from the three.js examples.

## Content to confirm with the client before launch

- Domain: the site runs on the placeholder https://elfingroup.vercel.app. When the client's real domain is ready, change `VITE_SITE_URL` plus `robots.txt` and `sitemap.xml`.
- Project statuses. Casa, Sapphire and Castle are shown as delivered, based on homeowner testimonials on their old site.
- Elfin Springfield's location (it has no map pin until confirmed).
- RERA registration numbers, if any. None are shown on the site, because none could be verified.
- Stats: "1000+ families" is the client's own Instagram claim.
- Real renders or photography to replace the 360×640 Instagram stills if higher-resolution files exist.
