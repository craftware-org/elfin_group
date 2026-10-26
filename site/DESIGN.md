# Design decisions

## Goal
The client asked for "a 3D animated, crazy" website in the spirit of CraftWare. The reference was a friend's demo, which this site rebuilds from a screen recording:
Earth → Hubballi → Elfin Nebula towers → plotted layout → locations map, followed by an editorial site.
This build keeps that flow in four scenes, and fills the editorial site with the real content of the client's Elfin Nebula brochure.

## Decisions

| Decision | Why |
|---|---|
| **Vite + vanilla Three.js, GSAP ScrollTrigger, Lenis** | Heavy scroll-driven 3D without framework overhead. The output is static, so it hosts anywhere. Chosen by the client over a single HTML file or Next.js. |
| **Towers modelled on the render, lit at dusk** | Tower Orchid (stepped long block) and Tower Emerald (street block with the jaali strip and the name parapet) are real geometry: recessed balconies between solid piers, glass railings, sills and sunshades, a shop podium with a canopy. The ground world is lit at dusk like the client's render, with the last sun from the side so street faces sit in twilight and the homes glow. |
| **The cut-away shows the real floor** | Instead of towers rising floor by floor, the chapter opens the building: Tower Emerald's top four floors lift off and its 5th floor is revealed as it is in the brochure, with its walls standing (extracted from the coloured plan by `tools/build_floor3d.py`) and the furnished plan on the floor; the camera then comes in close and glides along it. It closes again as the camera leaves. Tower Orchid stays whole. |
| **Shops on the ground floor** | The brochure's 11 shops: three on each tower's street end, three/two on the outer side by the road. Each has a lit interior behind framed glass, a shutter box, a backlit sign board (illustrative names, no real brands), stone piers and a canopy with downlights; the rest of the ground floor is stilt parking between columns. Planters and parked cars line the plaza in front. |
| **Surroundings** | Street lights along every plotted layout's roads and the main road, kerbs, a footpath and a zebra crossing at the gate, palms and flowering hedges along the plaza as in the render, softer organic tree crowns. |
| **Procedural 3D, with no downloaded models** | Towers, plots, trees and roads are generated in code from a seeded PRNG. The world is identical on every visit, needs no model licensing, and the story chunk stays at about 147 KB gzipped. |
| **Two scenes, one renderer, joined by a cloud dive** | Space scale and ground scale can't share a depth range well. The camera plunges into thickening clouds over Hubballi, a sunlit haze peaks at 40% progress (the swap), and the ground scene emerges from fog that clears as the camera descends. Both scenes are compiled behind the loader so the hand-off never hitches. |
| **Camera on one Catmull-Rom spline** | Per-segment easing made the camera stop at every keyframe. A single centripetal spline through all shots (`keys` in `ground.js`) keeps velocity continuous, and the story loop damps progress, so speed changes stay soft. |
| **Copy scrubbed by scroll, not toggled** | `src/chapters.js` drives every word and line from the same damped progress as the 3D, so text and scene move as one and reverse exactly. |
| **Sharp on phones** | The 3D story renders near the phone's real pixel density (up to 2.5x) with antialiasing; adaptive resolution steps down only if frames run slow. The intro and logo use no CSS filters (they re-rasterise blurry on phones); the logo's white outline is baked into `logo-outline` at full resolution around the untouched logo. Renders are served full size on phones. |
| **Phone header** | A frosted bar over the 3D story with the logo, a compact Book a site visit button and the menu; it stays in view while scrolling on phones and tablets. |
| **Projects: More** | All projects first shows Elfin Nebula, Castle, Oakwood, Sapphire and Casa; a More projects button reveals the six layouts. Other filters and menu links show their cards directly. |
| **Adaptive resolution + lazy shadows** | Pixel ratio steps down when frames run slow (and ignores stalls). Shadows are redrawn only while the towers rise. |
| **Layouts by device** | Phones: shorter story, swipe galleries and chips, sticky Call · WhatsApp · Visit bar. Portrait tablets: a 2-column layout. Landscape tablets: the desktop layout with touch sizing. Landscape phones: compact story copy. |
| **Photos enhanced, not invented** | The client's own photos were cleaned of Instagram captions and upscaled with Real-ESRGAN (`tools/enhance_photos.py`). No AI-generated imagery stands in for the real site. |
| **`setViewOffset` for composition** | It moves the subject right of the headline on desktop and below it on phones without changing the camera path. |
| **DOM labels projected from 3D anchors** | The labels stay crisp, accessible and styled with the brand CSS. They show only in their own chapter. |
| **Exact logo, no badge** | The client required their exact logo and theme. The logo is never recoloured or redrawn. It never sits on a badge or border. On dark surfaces a thin white outline is traced around its own shapes in CSS so the black logo stays legible; the image itself is untouched. The palette is sampled from the logo: gold `#C98C34`, black `#0A0A0A`. |
| **Intro** | A warm dark field with a slow gold glow, the spaced ELFIN (cream) GROUP (gold) wordmark and a drawn gold hairline. It holds until the 3D story has loaded, then opens out and dissolves into the globe. |
| **Lead capture through WhatsApp** | The form opens `wa.me/918147284999` with a pre-filled message. There is no backend and no stored personal data, which matches how their Instagram already sells ("DM / call / WhatsApp"). |
| **Flash between chapters** | The client asked for three scrolls. The globe dive takes the first chapter, and the short sunlit flash between space and ground plays while that chapter's copy fades out, so the Elfin Nebula copy never builds over a blank screen. |
| **No shimmer on the ground** | Overlay planes sit clear of the fields (near plane 3, overlays 0.12–0.4 above ground), fine furrow lines were replaced by broad tonal strokes, and camera sway was reduced, so the fields no longer flicker as the camera moves. |
| **Brochure data only** | Flat numbers, BHK types and super built-up areas are read from the brochure's floor plans by a script, with asserts on the counts (112 homes = 8 × 1 BHK, 88 × 2 BHK, 16 × 3 BHK; 11 shops). Room sizes are not shown, because they could not be matched to rooms reliably. |
| **Renders play on their own** | The client's day, dusk and night renders crossfade automatically every 3.5 seconds with a slow push-in, in a single-screen section, so readers never have to scroll through them. The views pause off screen and on hover/focus, the dots pick a view, and with reduced motion they only change on request. |
| **Map is illustrative** | Pins show relative areas. Elfin Nebula links to the client's own Google Maps pin, and the location section embeds the live map plus the brochure map. |
| **No unverifiable claims** | No RERA numbers, prices or possession dates appear, because none were supplied. Statuses and credentials (CREDAI member, architects Simons and Associates) are as printed in the brochure. |

## Quality tiers
- **Desktop:** shadows (PCF 2048), antialiasing, about 3,200 stars, all tree clusters, pixel ratio up to 1.75.
- **Phones and ≤4-core devices:** no shadows, half the clusters and stars, pixel ratio up to 1.5.
- **No WebGL 2:** a static gold-on-black backdrop. The chapter copy still advances with scroll.
- **Off-screen:** the render loop idles while the story isn't visible.

## Security
- No `innerHTML` with data. Dynamic map and panel markup is built with `textContent`.
- External links use `rel="noopener"`. `vercel.json` sets nosniff, frame, referrer and permissions headers.
- No secrets in the client bundle. The `.env` holds only public values (site URL, WhatsApp number).
