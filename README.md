# Personal website

Home movie night: a 1970s living room in 3D. Start the projector and the room
goes dark, the reels spin up, a countdown plays, and the camera moves into the
screen, where the resume is. See [project.md](project.md) for the concept and
the plan.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:4321.

`npm run build` type-checks and builds the static site into `dist/`. `npm run preview` serves that build.

## Where things live

| Path | What it is |
|---|---|
| `src/data/resume.ts` | All resume content: roles, about, links. Edit this to change the text. |
| `src/pages/index.astro` | The one page: the 3D stage plus the resume. |
| `src/components/Stage.astro` | Canvas and the buttons over the room (start, sound, skip). |
| `src/components/Resume.astro` | The resume shown after the camera enters the screen. Also what shows without JavaScript or WebGL. |
| `src/scene/theater.ts` | The 3D controller: renderer, camera framing, and the opening, skip, and ending sequences (GSAP timelines). |
| `src/scene/room.ts` | The room: walls, furniture, lamps, window, screen. |
| `src/scene/projector.ts` | The Super 8 projector and its reels. |
| `src/scene/beam.ts` | The projector beam and the dust in it and around the lamp. |
| `src/scene/film.ts` | What's on the screen: leader, countdown, title card, "The End", film damage. |
| `src/scene/filmPass.ts` | Full-frame film look: grain, gate weave, flicker, vignette. |
| `src/scene/sound.ts` | Projector sounds, synthesized with Web Audio. |
| `src/scene/textures.ts` | Every surface texture, painted on canvases at load time. |
| `src/scene/layout.ts` | Room dimensions and where everything sits. |
| `src/scene/boot.ts` | Connects the scene to the page: buttons, keys, sound preference, first-visit tracking. |

## How it behaves

- **First visit:** the full opening, about 4 seconds. **Later visits:** a short version, under 2 seconds.
- **Skip:** any click or key during the opening, or "Skip to the resume" before it starts.
- **Sound:** off until turned on. The choice is remembered.
- **Reduced motion:** no camera move or flicker; the room crossfades straight to the resume.
- **No WebGL or no JavaScript:** the resume shows on its own.
- **Direct link:** `/#resume` opens straight on the resume. "End the film" plays the ending and returns to the room.
