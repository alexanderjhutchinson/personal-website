# Personal website

Home movie night: a 1970s living room in 3D, and the whole site happens in it.
A folded program stands on the coffee table; pick it up to read the resume.
Start the projector and the room goes dark, the reels spin up, a countdown
plays, and the camera moves up to the screen, where the feature plays: three
reels of pixel scenes (`/about`, `/experience`, `/projects`) with the content
as items. The room stays around the screen the whole time. See
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
| `src/data/program.ts` | What's printed in the program, page by page. The 3D paper and the plain HTML version both use it. |
| `src/pages/index.astro`, `program.astro`, `[reel].astro` | Every address is the same room, opened in a different state: on the couch, with the program in hand, or with a reel playing on the screen. |
| `src/components/Room.astro` | The one page: the stage, the reels, and the program for when the room can't run. |
| `src/components/Stage.astro` | Canvas and everything over the room: sound, the pick-up prompt, the controls while holding the program. |
| `src/components/Reel.astro` | The reels: game canvas, door buttons, sound, the item panel and cards, and the ×. Laid over the room's screen, or a page of its own without the room. |
| `src/components/Program.astro` | The program in HTML, printed on cream paper. |
| `src/components/ProgramView.astro` | The program as the whole page, shown only without JavaScript or WebGL. |
| `src/scene/theater.ts` | The 3D controller: renderer, camera framing, and the opening, skip, and ending sequences (GSAP timelines). |
| `src/scene/room.ts` | The room: walls, furniture, lamps, window, screen. |
| `src/scene/projector.ts` | The Super 8 projector and its reels. |
| `src/scene/program.ts` | The program on the coffee table: a folded sheet that opens and turns over. |
| `src/scene/programPages.ts` | Paints the program's four pages, and where the reels and links on them are. |
| `src/scene/beam.ts` | The projector beam and the dust in it and around the lamp. |
| `src/scene/film.ts` | What's on the screen: leader, countdown, a still of a reel, the film running out, film damage. |
| `src/scene/filmPass.ts` | Full-frame film look: grain, gate weave, flicker, vignette. |
| `src/scene/sound.ts` | Projector sounds, synthesized with Web Audio. |
| `src/scene/textures.ts` | Every surface texture, painted on canvases at load time. |
| `src/scene/layout.ts` | Room dimensions and where everything sits. |
| `src/scene/screen.ts` | The screen's size, and where its picture sits on the page while a reel plays (no three.js, so a reel can be placed before the room loads). |
| `src/scene/boot.ts` | Runs the page: buttons, keys, sound, first-visit tracking, the program, and taking the reels on and off the room's screen with the browser history to match. |
| `src/lobby/game.ts` | The reels' game loop: input, item use, switching reels, the frame roll. The room starts, pauses, and places it. |
| `src/lobby/scenes.ts` | The three scenes (home base, mine, workshop): layout, doors, light, backdrop, props. |
| `src/lobby/world.ts` | The tile grid, mining, the edge doorways, and the light map. |
| `src/lobby/player.ts` | Movement, jumping, wandering, and walking to a door. |
| `src/lobby/content.ts` | Pixel icons for content items, and the item card. |
| `src/lobby/decor.ts` | Props: signs, workbench, anvil, furnace, chest, mine cart. |
| `src/lobby/draw.ts` | Draws a reel's scene: sky, walls, props, blocks, and light. |
| `src/lobby/still.ts` | A reel's opening frame as a picture, for the room's projector to show under the live reel and as the film ends. |

## How it behaves

- **The program:** stands on the coffee table. A game-style prompt ("E Pick up the program") sits over it until it's been picked up once, and it shimmers. Click it or press E to pick it up. Arrow keys (or clicking either half) turn it: cover, inside spread, back. On a tall screen like a phone, the inside comes one page at a time (inside left, inside right) so it's readable. Links printed on it work. Escape puts it down.
- **The film:** clicking the projector, Enter, or picking a reel in the program starts it. There's no start button on screen. After the countdown the screen goes back to bare projector light and the camera moves up to it; the reel fades in on the screen: Reel 1 (`/about`), or the one picked in the program. The camera stops short, so the screen's border and the room stay around the reel, with the lamps at a low glow.
- **First visit:** the full opening, about 4 seconds. **Later visits:** a short version, under 2 seconds. Any click or key skips it.
- **Sound:** off until turned on. The choice is remembered.
- **Ending:** the × in the top-right corner. The reel gives way to the same picture on the room's screen, the film runs out, the camera pulls back to the couch, and the lights come up. No page load, ever: it's all one page.
- **Reduced motion:** no camera move or flicker; the room cuts straight to the reel.
- **No WebGL:** `/` and `/program` show the program on its own, and a reel's address shows that reel on its own.
- **Addresses:** `/program` opens the room with the program already picked up; it's the link for someone who wants the resume. Old `/#resume` links go there. A reel's address (`/experience`) opens the room with that reel already on the screen; the room fades in around it. Back and forward move between the room and the reels.

On the reels:

- **Changing reels:** walk out the door at the edge of the scene, or press a door button at the bottom, which runs the character out that door. The film rolls to the next frame and the character walks in the other side. Pressing the button again cuts straight away.
- **Addresses:** each reel has its own address, and the back button moves between reels. `/projects#speakeasy` opens that item's card.
- **Content:** the panel at the top right (under the frame on narrow screens) lists the reel's items. Click one for its card, printed on the same cream paper as the program. Name colors mean the type: burnt orange for school, amber for work, avocado for projects.
- **One look:** pixel art only inside the film. Everything around it (the panel, the door and sound buttons, the ×, the reel titles) uses the room's amber and cream and its fonts.
- **A clean screen:** no key guide and no links to the program; visitors work the controls out. Sound is the speaker button in the frame's bottom-left corner, and the × in the page's top-right corner ends the film.
- **Tuning:** the feel can only be tuned in development: press `` ` `` with `npm run dev` running.
- **The film look:** grain, a soft vignette, and a faint flicker over the frame, like the room's projector.
- **Reduced motion:** reels cut without the roll or the walk.
