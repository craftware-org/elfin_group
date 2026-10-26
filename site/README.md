# Elfin Group website

Marketing site for **Elfin Group** (Elfin Infra Builders Pvt. Ltd.), builders, developers and promoters in Hubballi with 13+ years of experience.
It opens with a scroll-driven 3D story of four scenes, followed by an editorial site in the brand's own black / gold / white palette.
The content below the story (Elfin Nebula, floor plans, amenities, specifications, location, projects) comes from the client's Elfin Nebula brochure.

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
| `index.html` | All content and copy (SEO-readable), JSON-LD business + apartment data, card illustrations as SVG symbols |
| `src/main.js` | Fonts, Lenis smooth scroll + GSAP ScrollTrigger, preloader, lazy-loads the 3D story |
| `src/ui.js` | Nav, kinetic headings, reveals, count-ups, Nebula render slideshow, home chooser, interactive floor plans, location map tabs, project filters, locations map, sample plot plan, WhatsApp form |
| `src/data.js` | Project locations shown on the map (illustrative positions, plus a Google Maps link per project) and the 1/2/3 BHK copy |
| `src/plans.data.js` | **Generated.** Every flat (number, tower, BHK, super built-up area, position on the plan) and every shop, read from the brochure |
| `src/story/index.js` | Renderer, quality tiers, scroll → camera progress, flash transition, 3D-anchored labels |
| `src/story/earth.js` | Chapter 1: globe with a day/night shader, clouds and atmosphere, and a gold pin on the Elfin Nebula site |
| `src/story/ground.js` | Chapters 2–4: golden-hour world, camera path, Nebula towers, plotted layout, aerial view of Elfin sites |
| `src/story/nebula.js` | Tower Orchid and Tower Emerald at the plan's real size (~19 x 47 m bars), styled after the client's render: recessed lit balconies, piers, jaali strip, shop podium, name parapet. Each is built as a lower part and a liftable top (floors 5–8) over the real 5th-floor layout |
| `src/story/floor3d.data.js` | **Generated.** Wall boxes of each tower's typical floor, extracted from the brochure plan |
| `../tools/build_floor3d.py` | Rebuilds `floor3d.data.js` and `public/images/nebula/floor-*.webp` from the brochure's coloured floor plan |
| `src/story/parts.js` | Procedural builders: dusk sky, fields, plot layouts, villas, sign textures |
| `../tools/build_brochure_assets.py` | Rebuilds the brand files, brochure images and `plans.data.js` from `../assets/client/` |
| `src/styles/main.css` | Brand tokens (`--gold #C98C34` and `--black #0A0A0A`, sampled from the logo) and all layout |

### The 3D story chapters (scroll progress)

Scrolling is free and smooth (Lenis); the camera follows scroll progress. The opening globe is one step (`src/storyIntro.js`): shortly after the intro it glides down to Elfin Nebula by itself (or at once on the first scroll); one scroll up from there glides back. About 2.6 screens of scroll on desktop (`.story` is 360vh).

| From | Chapter | Scene |
|---|---|---|
| 0.00 | Elfin Group | Earth over Africa/Gulf, then the dive to the Nebula pin through a short sunlit flash |
| 0.30 | Elfin Nebula | The site at dusk. Tower Emerald's top floors lift away and the camera comes in close over its real floor layout |
| 0.60 | Plots, planned right | Camera glides to the plotted layout |
| 0.88 | Across the city | Aerial view with labels for Elfin sites |

The two worlds were authored on a five-chapter timeline. `toWorld()` in `story/index.js` remaps scroll progress onto it piecewise, so changing chapter lengths never means re-keying the camera.

Phones and low-power devices get a lighter tier: no shadows, fewer trees and stars, and a lower pixel ratio.
Browsers without WebGL 2 get a static gold-on-black intro, and the chapter text still works.
`prefers-reduced-motion` disables smooth scroll and decorative animation.

## Brand assets

- `public/brand/logo.png|webp`: the **exact** official logo, with only its white background removed. Used on light surfaces.
- The logo is never recoloured and has no badge or border behind it. On dark surfaces (intro, nav over the 3D story, mobile menu, footer) a thin white outline is traced around its shapes in CSS (`--logo-outline`); the image itself is untouched.
- `public/brand/favicon-*`, `apple-touch-icon.png`, `og-image.jpg` (1200×630 share card).
- `public/images/*`: construction-progress photos from the client's own Instagram (@elfin_group).
- `public/images/nebula/*`, `life/*`, `projects/*` and `brand/credai.*`: extracted from `../assets/client/elfin-nebula-brochure.pdf` by `tools/build_brochure_assets.py` (renders, floor plans, 3D flat plans, location map, lifestyle photos, completed projects).
- `public/textures/*`: Earth textures from the three.js examples.

## Content to confirm with the client before launch

- Domain: the site runs on the placeholder https://elfingroup.vercel.app. When the client's real domain is ready, change `VITE_SITE_URL` plus `robots.txt` and `sitemap.xml`.
- Locations of Elfin Halyal Park and Elfin Park (no map pin until confirmed). The other pins are illustrative.
- Flat 106 is printed in the brochure as a 3 BHK of 829.64 sft, the same area as 2 BHK flat 205. The site shows it as printed.
- RERA registration numbers, prices and possession dates. None are shown, because none have been supplied.
- Real renders or photography to replace the 360×640 Instagram stills if higher-resolution files exist.
