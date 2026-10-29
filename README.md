# Personal website

Home movie night: a 1970s living room in 3D. Start the projector and the room
goes dark, the reels spin up, a countdown plays, and the camera moves into the
screen, where the resume is. The feature itself is three reels of pixel scenes
(`/about`, `/experience`, `/projects`) with the content as items. See
[project.md](project.md) for the concept and the plan.

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
| `src/data/jobs/`, `src/data/projects/` | One file per job or project. Add a file and it shows up on its reel and in the program. |
| `src/data/profile.ts` | Name, education, skills, about, contact links. |
| `src/data/index.ts` | Loads the content, formats dates, lists the reels, and turns content into reel items. |
| `src/pages/index.astro` | The room: the 3D stage plus the program (the plain resume). |
| `src/pages/[reel].astro` | The reel pages: game canvas, door buttons, the reel's item panel, and item cards. |
| `src/components/Stage.astro` | Canvas and the buttons over the room (start, sound, skip). |
| `src/components/Resume.astro` | The program: the resume shown after the camera enters the screen. Also what shows without JavaScript or WebGL. |
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
| `src/lobby/game.ts` | The reels' game loop: input, item use, switching reels, the frame roll. |
| `src/lobby/scenes.ts` | The three scenes (home base, mine, workshop): layout, doors, light, backdrop, props. |
| `src/lobby/world.ts` | The tile grid, mining, the edge doorways, and the light map. |
| `src/lobby/player.ts` | Movement, jumping, wandering, and walking to a door. |
| `src/lobby/content.ts` | Pixel icons for content items, and the item card. |
| `src/lobby/decor.ts` | Props: signs, workbench, anvil, furnace, chest, mine cart. |

## How it behaves

- **First visit:** the full opening, about 4 seconds. **Later visits:** a short version, under 2 seconds.
- **Skip:** any click or key during the opening, or "Skip to the resume" before it starts.
- **Sound:** off until turned on. The choice is remembered.
- **Reduced motion:** no camera move or flicker; the room crossfades straight to the resume.
- **No WebGL or no JavaScript:** the resume shows on its own.
- **Direct link:** `/#resume` opens straight on the resume. "End the film" plays the ending and returns to the room.

On the reels:

- **Changing reels:** walk out the door at the edge of the scene, or press a door button at the bottom, which runs the character out that door. The film rolls to the next frame and the character walks in the other side. Pressing the button again cuts straight away.
- **Addresses:** each reel has its own page, and the back button moves between reels. `/projects#speakeasy` opens that item's card.
- **Content:** the panel at the top right (under the frame on narrow screens) lists the reel's items. Click one for its card. Name colors mean the type: blue for school, gold for work, green for projects.
- **Reduced motion:** reels cut without the roll or the walk.
