# Artwork and logo provenance

Collected 21 October 2026. All runtime artwork is bundled locally; the launcher makes no image requests to these sites.

| Asset | Source | Treatment |
| --- | --- | --- |
| `characters/*.webp` | The five existing user-supplied cutouts in this repository | Files unchanged. Each is 1030 × 1526 RGBA WebP. Faces, hair, clothing, proportions and source outlines preserved. |
| `platforms/netflix.svg` | [Netflix wordmark](https://commons.wikimedia.org/wiki/File:Netflix_2015_logo.svg), extracted from Netflix | Original vector, unchanged. |
| `platforms/primevideo.svg` | [Prime Video wordmark](https://commons.wikimedia.org/wiki/File:Amazon_Prime_Video_logo.svg) | Original vector, unchanged; displayed in white using CSS for contrast. |
| `titles/stranger-things.svg` | [Stranger Things logo](https://commons.wikimedia.org/wiki/File:Stranger_Things_logo.svg), credited to Netflix | Original two-line red wordmark. |
| `titles/demon-slayer.svg` | [Demon Slayer logo](https://commons.wikimedia.org/wiki/File:Demon_Slayer_logo.svg) | Authentic Japanese title/circle treatment. CSS inverts luminance and rotates hue so the black lettering reads white on black while retaining the red circle. Not a fabricated English logo. |
| `titles/you.png` | [Netflix's YOU title page](https://www.netflix.com/title/80211991) | Original transparent white title treatment downloaded from Netflix's image CDN. |
| `titles/how-to-lose-a-guy.png` | [Netflix's movie page](https://www.netflix.com/title/60026122) | Original transparent title treatment; CSS brightness adjustment for dark-screen contrast. |
| `titles/off-campus.webp` | [Off Campus logo](https://commons.wikimedia.org/wiki/File:Off_Campus_logo.webp), credited to Amazon Studios with an Amazon image source | Original transparent cyan script wordmark. |
| `../icons/*` | Existing output of `sync-apps.py` from the user's television | Unchanged real installed-app icons; no fictional apps or replacement icons. |

The corresponding logos and artwork belong to their respective owners; the repository's code license does not grant rights to their brands or artwork. Commons source pages contain their individual provenance and reuse notes.

No requested title or platform logo is missing. The title renderer retains a plain text error fallback if a file is subsequently removed; it records the missing asset in the browser console. No fallback is active in the captured preview.

The source characters include permanent colored outlines. The redesign dims them at rest and adds separately controlled contour bloom and a small radial aura on focus. The original outlines cannot be completely switched off without changing the supplied artwork. No new faces or replacement characters were generated.
