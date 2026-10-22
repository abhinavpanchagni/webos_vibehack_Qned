# Cinematic TV OS redesign

Implemented in the existing HTML/CSS/JavaScript launcher on 21 October 2026. No framework or runtime dependency was added. Version 1.2.0 was installed and launched on the paired LG TV on 22 October 2026 following the user's deployment request.

[Open the screenshot gallery](redesign/index.html) · [Open the interactive launcher](../app/index.html) · [Browser test results](redesign/validation.json)

## Result

The launcher opens on a pure black character composition. All five supplied figures are large and visible immediately, with staggered heights, shared visual alignment, and controlled shoulder/body overlap. Faces retain their source proportions. Benjamin's and Hannah's companion figures remain part of their original artwork; their requested names, selection areas and branding identify the favourites.

Pointer movement and directional navigation share the focus state. A selected figure lifts and grows, gains independently controlled contour bloom and a restrained radial aura, and reveals its platform wordmark above and original title treatment below. Dimming uses brightness rather than opacity so overlapping dark clothing does not turn transparent. Selection has a short 260 ms emphasis before invoking the existing launch function. Characters open Netflix or Prime Video normally; no content ID or direct playback claim was added.

Down, the wheel, or the Your apps button reveals the dashboard in a reversible 650 ms opacity/vertical transition. There is no timed automatic transition. Wheel bursts and held directions are controlled, and hidden sections do not accept navigation. Character and app focus survive section changes and app return.

The dashboard uses black and deep crimson radial lighting, large floating glass surfaces, thin borders and local reflections derived from the real icons. It exposes all synchronized non-hidden apps through directional scrolling (34 in the deployed inventory). Focus lifts an icon with a 260 ms transition without moving neighbouring tiles. The existing saved order and held-OK rearrangement remain available. No backdrop blur is required, so the base glass treatment works without that feature.

## Changed files

| File | Change |
| --- | --- |
| `app/index.html` | Two related sections, scaled logical shell, section controls, accessible labels, input/status overlays and reusable SVG contour filter. |
| `app/style.css` | Replaces the old wallpaper layout with the cinematic composition, title reveals, dashboard surfaces and reduced-motion rules. |
| `app/characters.js` | Original asset paths, authentic logo paths, character names, accents and configurable composition/hit-region geometry. Deep links remain null. |
| `app/app.js` | Screen/focus navigation, fixed pointer regions, wheel handling, short selection transitions, scaled input menus, lifecycle restoration and truthful missing-data states. |
| `app/assets/wallpaper.jpg` | Removed from the application. A copy is retained only in the local pre-change checkpoint. |
| `app/assets/platforms/` | Netflix and Prime Video SVG wordmarks. |
| `app/assets/titles/` | Five authentic title logo assets. |
| `app/assets/ASSET-SOURCES.md` | Source links, display treatments and artwork limitations. |
| `scripts/verify-ui.cjs` | Repeatable local browser tests; webOS service calls are mocked only in the test browser. |
| `docs/redesign/` | Eight full-resolution screenshots, gallery and machine-readable test results. |

The initial working tree was clean at commit `3697700`. A complete copy of the prior `app/`, including locally synchronized apps/icons, was saved to `build/redesign-checkpoint/app/` before editing. Its commit is recorded in `build/redesign-checkpoint/commit.txt`. No Git reset, history change or commit was performed.

## Preserved

The `luna()` and `launch()` implementations are byte-for-byte unchanged from the checkpoint. The existing Netflix (`netflix`), Prime Video (`amazon`), YouTube (`youtube.leanback.v4`) and installed-app IDs are preserved. `app/config.js`, app permissions, `install.ps1`, `install.sh`, `sync-apps.py`, `lgtv.py`, and `home-watch.py` are unchanged. Deployment increments only the version in `app/appinfo.json` to 1.2.0 and refreshes generated `app/apps.js` and icons from the TV.

Saved preferences continue using `tvhome.order` and the existing `dockApps` signature. Inputs, Live TV, Wi-Fi status and Settings retain their original launch targets. The Home-button watcher and Windows installation architecture are untouched.

All five character WebP files were verified against the checkpoint by SHA-256 and are unchanged. Together they are approximately 933 KiB. No faces were regenerated or background removal applied to the already transparent originals.

## Branding

No requested platform or title logo is missing. Sources and exact treatments are documented in [ASSET-SOURCES.md](../app/assets/ASSET-SOURCES.md). Demon Slayer uses the authentic Japanese wordmark with its circle, displayed with light lettering for contrast. Prime Video uses a white rendering of its original wordmark. Neither is generic text or a fabricated logo. Assets are local and available offline.

The supplied artwork contains permanently baked-in colored outlines. The UI softens those at rest and adds controllable focus lighting, but cannot completely remove the source outlines without altering the artwork. Any desire for outline-free resting characters requires cleaner source images. The existing couple artwork was preserved to avoid cutting into faces, hair or clothing.

## Controls

| Context | Control | Result |
| --- | --- | --- |
| Showcase | Left / Right | Focus previous / next character. |
| Showcase | OK / Enter / click | Open the mapped OTT application. |
| Showcase | Down / wheel down / Your apps | Open dashboard. |
| Dashboard | Arrows | Navigate every app; grid scrolls to keep focused tile visible. |
| Dashboard first row | Up | Return to showcase. |
| Dashboard | Wheel up / Back / Escape / Back to cinema | Return to showcase and restore character focus. |
| Dashboard at start of a row | Left | Focus Inputs / Wi-Fi / Settings. Down returns to apps. |
| App tile | Hold OK for 600 ms | Rearrange; arrows move, OK saves, Back cancels. |
| Inputs menu | Up / Down / OK | Choose an input. Back closes the menu first. |
| Launcher root | Back | Remain home, preserving the launcher's root behaviour. |
| Desktop | Tab / Shift+Tab | Traverse visible-section controls and focus apps. |

## Validation

The recorded browser suite passed in Chrome 155 at 1920 × 1080. It checks five character assets and logos, initial isolation of the showcase, every character's launch mapping, held-OK repeat suppression, pointer targets, focus restoration, interpolated section animation, Prime Video and YouTube launch requests, all 35 apps' directional reachability, rearrangement rollback and persistence, Inputs/Settings requests, wheel bursts, pointer transition controls, launch errors/cancellation, reduced motion, 3840 × 2160 and 1280 × 720 scaling, input-menu coordinates, empty inventories and absence of uncaught errors.

The suite caught and led to a fix for stationary-pointer hover stealing focus when the grid scrolled beneath it. Focus now follows actual pointer movement. The final pointer-focus guard and refreshed release inventory passed the complete browser suite on 22 October 2026; the earlier approval-service block is resolved. The current validation JSON records 34 visible apps. All eight requested visual states were captured and inspected before deployment. Characters remain recognizable, logos stay below faces or above heads, and the wallpaper is absent.

Additional checks passed: JavaScript syntax checks, `git diff --check`, unchanged launch-helper comparison, character hash comparison, and `install.ps1 -DryRun`. The installer dry run verified Python, websockets, Pillow, Node, npx and required files without contacting the TV.

To repeat browser checks from the repository root:

```powershell
npm install --prefix build/qa --no-audit --no-fund playwright-core
node scripts/verify-ui.cjs
```

The testing package lives under ignored `build/qa`; it is not included in the TV application. `CHROME_PATH` may override the locally installed Chrome executable. The test's temporary HTTP server closes when testing finishes. Open `app/index.html` directly for desktop interaction, or serve `app/` locally for same-origin icon colour sampling.

## Remaining hardware checks and deployment

The implementation targets the existing 1920 × 1080 logical canvas and the webOS 25 engine. LG lists webOS TV 25 as Chromium 120 in its [official engine table](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine). Desktop Chrome testing is not a substitute for testing that engine on the television.

Real TV app switching, return behaviour, Magic Remote pointer/wheel event delivery, perceived glow intensity, overscan and animation frame pacing remain unverified on the LG 65QNED83SRA. No 60 fps claim is made. The browser suite validates the launch requests through a simulated bridge; it does not launch actual television apps. No content-specific deep link has been enabled.

Deployment used the installer's sync, package, close, install and launch steps directly so that its build-directory cleanup would not remove the previous package or redesign checkpoint. LG's CLI confirmed installation, launch, and installed version 1.2.0 on device `lgtv` at `192.168.1.6`. No TV settings, firmware, system files, root access or Home redirection were changed.

Release package: `build/releases/1.2.0/com.gathin.tvhome_1.2.0_all.ipk`. SHA-256: `C4A46BC705CD0296BA1715982E4B1ED1E17FE7C0449B409A2AA7E970A35ED8C7`.

The deployment sync produced 40 apps and five inputs, of which 34 apps are visible under the existing configuration. The unchanged sync script omitted WION after an icon-download timeout and the TV browser after an icon URL returned HTTP 404. These omissions affect the launcher's inventory; they did not uninstall either app from the TV. The previous 1.1.0 package and `build/redesign-checkpoint/` remain available locally.
