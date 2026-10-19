# Design decisions

## Goal
The client asked for "a 3D animated, crazy" website in the spirit of CraftWare. The reference was a friend's demo, which this site rebuilds from a screen recording:
Earth → Hubballi → Elfin Nebula towers → plotted layout → locations map, followed by an editorial site.
This build keeps that flow and pushes it further, with real content from Elfin's Instagram, archived website and MCA records.

## Decisions

| Decision | Why |
|---|---|
| **Vite + vanilla Three.js, GSAP ScrollTrigger, Lenis** | Heavy scroll-driven 3D without framework overhead. The output is static, so it hosts anywhere. Chosen by the client over a single HTML file or Next.js. |
| **Procedural 3D, with no downloaded models** | Towers, plots, trees and roads are generated in code from a seeded PRNG. The world is identical on every visit, needs no model licensing, and the story chunk stays at about 147 KB gzipped. |
| **Two scenes, one renderer, joined by a cloud dive** | Space scale and ground scale can't share a depth range well. The camera plunges into thickening clouds over Hubballi, a sunlit haze peaks at 40% progress (the swap), and the ground scene emerges from fog that clears as the camera descends. Both scenes are compiled behind the loader so the hand-off never hitches. |
| **Camera on one Catmull-Rom spline** | Per-segment easing made the camera stop at every keyframe. A single centripetal spline through all shots (`keys` in `ground.js`) keeps velocity continuous, and the story loop damps progress, so speed changes stay soft. |
| **Copy scrubbed by scroll, not toggled** | `src/chapters.js` drives every word and line from the same damped progress as the 3D, so text and scene move as one and reverse exactly. |
| **Adaptive resolution + lazy shadows** | Pixel ratio steps down when frames run slow (and ignores stalls). Shadows are redrawn only while the towers rise. |
| **Layouts by device** | Phones: shorter story, swipe galleries and chips, sticky Call · WhatsApp · Visit bar. Portrait tablets: a 2-column layout. Landscape tablets: the desktop layout with touch sizing. Landscape phones: compact story copy. |
| **Photos enhanced, not invented** | The client's own photos were cleaned of Instagram captions and upscaled with Real-ESRGAN (`tools/enhance_photos.py`). No AI-generated imagery stands in for the real site. |
| **`setViewOffset` for composition** | It moves the subject right of the headline on desktop and below it on phones without changing the camera path. |
| **DOM labels projected from 3D anchors** | The labels stay crisp, accessible and styled with the brand CSS. They show only in their own chapter. |
| **Exact logo, never recoloured** | The client required their exact logo and theme. The logo has only its white background removed. On dark surfaces it sits on a white disc, as on their Instagram. The palette is sampled from the logo: gold `#C98C34`, black `#0A0A0A`. |
| **Lead capture through WhatsApp** | The form opens `wa.me/918147284999` with a pre-filled message. There is no backend and no stored personal data, which matches how their Instagram already sells ("DM / call / WhatsApp"). |
| **Map is illustrative** | Exact plot coordinates aren't public. Pins show relative areas, and each project links to a Google Maps search of its real locality. Springfield has no pin until its location is confirmed. |
| **No unverifiable claims** | No RERA numbers, prices or possession dates appear, because none could be verified. Delivered statuses come from homeowner testimonials. |

## Quality tiers
- **Desktop:** shadows (PCF 2048), antialiasing, about 3,200 stars, all tree clusters, pixel ratio up to 1.75.
- **Phones and ≤4-core devices:** no shadows, half the clusters and stars, pixel ratio up to 1.5.
- **No WebGL 2:** a static gold-on-black backdrop. The chapter copy still advances with scroll.
- **Off-screen:** the render loop idles while the story isn't visible.

## Security
- No `innerHTML` with data. Dynamic map and panel markup is built with `textContent`.
- External links use `rel="noopener"`. `vercel.json` sets nosniff, frame, referrer and permissions headers.
- No secrets in the client bundle. The `.env` holds only public values (site URL, WhatsApp number).
