# Personal website

Home movie night: a 1970s living room in 3D, and the whole site happens in it.
A folded program stands on the coffee table; pick it up to read the resume.
Start the projector and the room goes dark, the reels spin up, a countdown
plays, and the camera moves up to the screen, where the feature plays: three
reels of pixel scenes (`/about`, `/experience`, `/projects`) with the content
as items. The room stays around the screen the whole time. See
[project.md](project.md) for the concept and the plan.

## Run it

Needs Node 22.12 or newer (Astro's minimum). The site is built with Node 24, which `.node-version` pins for the host's build too.

```bash
npm install
npm run dev
```

Then open http://localhost:4321.

`npm run build` type-checks and builds the static site into `dist/`. `npm run preview` serves that build.

## Hosting

Cloudflare Workers serves `dist/` as static files; there's no server code. [wrangler.jsonc](wrangler.jsonc) is the whole setup. Its `name` has to match the project's name in the Cloudflare dashboard. Every push to `main` builds (`npm run build`) and deploys (`npx wrangler deploy`), and other branches get preview builds.

The site lives at [alexanderjhutchinson.com](https://alexanderjhutchinson.com), with `www.` serving it too. Both domains are listed in `wrangler.jsonc`, and every deploy makes the dashboard match that list, so add or remove domains there rather than in the dashboard. The same goes for the `workers.dev` address and the preview links, which the config keeps on.

Addresses have no trailing slash: `/about/` redirects to `/about`, which matches the addresses the room writes into the browser history.

To try the hosted setup locally, build first, then run `npx wrangler dev`.

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
| `src/components/Reel.astro` | What sits around the reel: the door buttons, sound and × in the margins, the item cards, and the reel's items as a list for screen readers. Without the room, the reel's picture shows here on its own. |
| `src/components/ProgramView.astro` | The program as a plain page: without the room, and from the "too narrow" note. |
| `src/components/Program.astro` | The program in HTML, printed on cream paper. |
| `src/layouts/Base.astro`, `public/og-image.jpg` | Every page's head, including the link preview: title, description, and the image of the room (1200×627) that LinkedIn, iMessage and Slack show when the site is shared. |
| `src/scene/theater.ts` | The 3D controller: renderer, camera framing, and the opening, skip, and ending sequences (GSAP timelines). |
| `src/scene/room.ts` | The room: walls, furniture, lamps, window, screen. |
| `src/scene/projector.ts` | The Super 8 projector and its reels. |
| `src/scene/program.ts` | The program on the coffee table: a folded sheet that opens and turns over. |
| `src/scene/programPages.ts` | Paints the program's four pages, and where the reels and links on them are. |
| `src/scene/beam.ts` | The projector beam and the dust in it and around the lamp. |
| `src/scene/film.ts` | What's on the screen: leader, countdown, a still of a reel, the film running out, film damage. |
| `src/scene/filmPass.ts` | Full-frame film look: grain, gate weave, flicker, vignette. |
| `src/scene/scenePass.ts` | Draws the room anti-aliased into a buffer of its own, so the effects after it work on a plain copy. |
| `src/scene/sound.ts` | Projector sounds, synthesized with Web Audio. |
| `src/scene/textures.ts` | Every surface texture, painted on canvases at load time. |
| `src/scene/layout.ts` | Room dimensions and where everything sits. |
| `src/scene/screen.ts` | The screen's size, and where its picture sits on the page while a reel plays (no three.js, so the page can lay out the controls before the room loads). |
| `src/scene/boot.ts` | Runs the page: buttons, keys, sound, first-visit tracking, the program, and taking the reels on and off the room's screen with the browser history to match. |
| `src/lobby/game.ts` | The reels' game loop: input, item use, switching reels, the frame roll. It draws one picture, which the room plays on its screen; the room starts and pauses it and passes it the pointer. |
| `src/lobby/overlay.ts` | The reel's interface, drawn into the picture: hotbar, item tooltips, the item panel, and the reel's title card. |
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
- **Escape** always backs out of whatever is on top, one layer at a time: an item card, then the plain program, then the film (back to the couch, like the ×). During the opening it stops the film; with the program in hand it puts it down.
- **Ending:** the × in the top-right corner. The reel holds a beat, the film runs out, the camera pulls back to the couch, and the lights come up. No page load, ever: it's all one page.
- **Wide screens only:** windows narrower than 6:5 (an upright phone, a narrow window) get a note to turn the phone sideways or widen the window, with "Read the program instead" for the plain program.
- **Reduced motion:** no camera move or flicker; the room cuts straight to the reel.
- **Performance:** the room draws 60 frames a second while anything moves and 30 while it sits still, whatever the screen's refresh rate, and nothing while the plain program or the "too narrow" note covers it. A machine that can't keep up steps down on its own: no anti-aliasing, then fewer pixels, then no bloom.
- **No WebGL:** `/` and `/program` show the program on its own, and a reel's address shows that reel on its own.
- **Addresses:** `/program` opens the room with the program already picked up; it's the link for someone who wants the resume. Old `/#resume` links go there. A reel's address (`/experience`) opens the room with that reel already on the screen; the room fades in around it. Back and forward move between the room and the reels.

On the reels:

- **Changing reels:** walk out the door at the edge of the scene, or press a door button at the bottom, which runs the character out that door. The film rolls to the next frame and the character walks in the other side. Pressing the button again cuts straight away.
- **Addresses:** each reel has its own address, and the back button moves between reels. `/projects#speakeasy` opens that item's card.
- **On the screen:** the game plays as the screen's own picture in 3D, so the plant stays in front of it and the beam and dust cross it. Its interface is part of the picture: the hotbar, tooltips, the item panel at the top right, and the reel's title card. Clicks go through the screen into the game.
- **Content:** click an item in the panel for its card, printed on the same cream paper as the program. Like the program on the table, each reel's panel pulses amber until one of its items has been opened (remembered per reel), and a "Click an item to read more" note sits under the panel until the visitor has opened an item on any reel. Name colors mean the type: burnt orange for school, amber for work, avocado for projects.
- **Around the screen:** the room's own controls, in its amber and cream: sound and the × in the top-right corner, and the door buttons in the bottom corners (next reel bottom right). No key guide; visitors work the controls out.
- **Tuning:** the feel can only be tuned in development: press `` ` `` with `npm run dev` running.
- **The film look:** the room's own grain and vignette fall on the screen with everything else.
- **Reduced motion:** reels cut without the roll or the walk.
