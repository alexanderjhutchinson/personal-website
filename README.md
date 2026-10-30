# Personal website

Home movie night: a 1970s living room in 3D. A folded program stands on the
coffee table; pick it up to read the resume. Start the projector and the room
goes dark, the reels spin up, a countdown plays, and the camera moves into the
screen and on into the feature: three reels of pixel scenes (`/about`,
`/experience`, `/projects`) with the content as items. See
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
| `src/data/program.ts` | What's printed in the program, page by page. The 3D paper and its high-def view both use it. |
| `src/pages/index.astro` | The room: the 3D stage plus the program's high-def view. |
| `src/pages/program.astro` | The same room, opened with the program picked up and in its high-def view. |
| `src/pages/[reel].astro` | The reel pages: game canvas, door buttons, the reel's item panel, and item cards. |
| `src/components/Stage.astro` | Canvas and everything over the room: sound, the pick-up prompt, the controls while holding the program. |
| `src/components/Program.astro` | The program in HTML, printed on cream paper: the high-def view. |
| `src/components/ProgramView.astro` | The high-def view over the room. Without JavaScript or WebGL, it's the whole page. |
| `src/scene/theater.ts` | The 3D controller: renderer, camera framing, and the opening, skip, and ending sequences (GSAP timelines). |
| `src/scene/room.ts` | The room: walls, furniture, lamps, window, screen. |
| `src/scene/projector.ts` | The Super 8 projector and its reels. |
| `src/scene/program.ts` | The program on the coffee table: a folded sheet that opens and turns over. |
| `src/scene/programPages.ts` | Paints the program's four pages, and where the reels and links on them are. |
| `src/scene/beam.ts` | The projector beam and the dust in it and around the lamp. |
| `src/scene/film.ts` | What's on the screen: leader, countdown, the "Feature Presentation" card, "The End", film damage. |
| `src/scene/filmPass.ts` | Full-frame film look: grain, gate weave, flicker, vignette. |
| `src/scene/sound.ts` | Projector sounds, synthesized with Web Audio. |
| `src/scene/textures.ts` | Every surface texture, painted on canvases at load time. |
| `src/scene/layout.ts` | Room dimensions and where everything sits. |
| `src/scene/boot.ts` | Connects the scene to the page: buttons, keys, sound preference, first-visit tracking, the program, and the hand-off to the first reel. |
| `src/lobby/game.ts` | The reels' game loop: input, item use, switching reels, the frame roll. |
| `src/lobby/scenes.ts` | The three scenes (home base, mine, workshop): layout, doors, light, backdrop, props. |
| `src/lobby/world.ts` | The tile grid, mining, the edge doorways, and the light map. |
| `src/lobby/player.ts` | Movement, jumping, wandering, and walking to a door. |
| `src/lobby/content.ts` | Pixel icons for content items, and the item card. |
| `src/lobby/decor.ts` | Props: signs, workbench, anvil, furnace, chest, mine cart. |

## How it behaves

- **The program:** stands on the coffee table. A game-style prompt ("E Pick up the program") sits over it until it's been picked up once, and it shimmers. Click it or press E to pick it up. Arrow keys (or clicking either half) turn it: cover, inside spread, back. R switches to the high-def view; Escape puts it down. On a phone it goes straight to the high-def view.
- **The film:** clicking the projector, Enter, or picking a reel in the program starts it. There's no start button on screen. The opening ends on Reel 1 (`/about`). A reel picked in the program is the one it opens on.
- **First visit:** the full opening, about 4 seconds. **Later visits:** a short version, under 2 seconds. Any click or key skips it.
- **Sound:** off until turned on. The choice is remembered.
- **Reduced motion:** no camera move or flicker; the room cuts straight to the reel.
- **No WebGL or no JavaScript:** the program shows on its own.
- **Addresses:** `/program` opens the room with the program picked up and in its high-def view; it's the link for someone who wants the resume. Old `/#resume` links go there. The × in a reel's top-right corner ends the film: the room opens inside the screen (`/?end`) and plays the ending.

On the reels:

- **Changing reels:** walk out the door at the edge of the scene, or press a door button at the bottom, which runs the character out that door. The film rolls to the next frame and the character walks in the other side. Pressing the button again cuts straight away.
- **Addresses:** each reel has its own page, and the back button moves between reels. `/projects#speakeasy` opens that item's card.
- **Content:** the panel at the top right (under the frame on narrow screens) lists the reel's items. Click one for its card. Name colors mean the type: blue for school, gold for work, green for projects.
- **A clean screen:** no key guide and no links to the program; visitors work the controls out. Sound is the speaker button in the frame's bottom-left corner, and the × in the page's top-right corner ends the film.
- **Tuning:** the feel can only be tuned in development: press `` ` `` with `npm run dev` running.
- **The film look:** grain, a soft vignette, and a faint flicker over the frame, like the room's projector.
- **Reduced motion:** reels cut without the roll or the walk.
