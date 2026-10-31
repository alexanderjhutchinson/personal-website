# Personal website

A from-scratch rebuild of my personal site. It replaces the old React/Vite site in `ahutchin/ahutchin.github.io`.

## Where things stand

- **Phase 1 (the living room) is built** and merged into `main` (#1).
- **Phase 2 has its frame:** three reels at `/about`, `/experience` and `/projects`, with doors, the frame roll, and the June 2026 content as items. Merged into `main` (#2).
- **The room, the program and the feature are tied together** (merged in #3): the resume is a folded program on the coffee table, and the opening runs straight into Reel 1.
- **One room** on branch `one-room` (see "One room" below): the reels play on the room's screen instead of on pages of their own.
- **Everything else is on `main`** in `alexanderjhutchinson/personal-website`. New work goes on a branch off `main`, with its own pull request.
- **Nothing is deployed yet.**
- **Next:** see "Phase 2: next up".

## Why it matters

- A well-made personal site strengthens an application.
- It can show design sense, technical skill, and personality all at once.
- It gives the projects I've worked on a place to be seen.

## What goes on it

- Projects
- Work experience
- Hobbies
- Photos I like

## The concept: home movie night

The visitor sits on a couch in a living room from a few decades back. On the coffee table is an old home film projector, with a pull-down screen across the room and a box of labeled film reels. Starting the projector plays the "film", and the view moves forward into the screen, where the content lives.

Why this concept:

- It's personal. I like movies, and the room can hold my own things (film posters, favorite movies, objects tied to hobbies).
- Cinema gives a lot to design with: lights dimming, the projector beam, the countdown, title cards, "The End", the lights coming back up.
- The controls (projector, reels) sit in front of you, the way a TV remote would.
- A movie screen is wide, which fits desktop browsers.

How it got here: a terminal interface became a CRT TV that powers on, then a movie theater (home theater vs an old single-screen repertory house like the Brattle), and finally this blend of the two.

---

## Phase 1: the landing page

**Goal:** the room, the projector start sequence, and the move into the screen. This is the first impression, and it's what makes the site memorable.

### Status: first version built (merged in #1)

Decided: a 3D room drawn entirely in code, set in the 1970s, ending on a stopgap resume page. Run it with `npm run dev` (see README).

What's in it:

- The room: wood paneling, wallpaper, shag rug, teak sideboard, table lamp, tension pole lamp, window with moonlight, pull-down screen, placeholder posters, a radio, a snake plant, popcorn, and film cans labeled Experience, Projects and Photos.
- A Super 8 projector on the coffee table. Click it (or press Enter) to start the film. The on-screen "Start the film" button was dropped.
- The full opening (about 4.2 seconds): lamps dim, reels spin up, the beam appears through dust, the screen flickers, a 3-2-1 countdown with the 2-pop, then the screen goes back to bare projector light and the camera moves into it. No text cards and no preview: the reel is a surprise until it loads.
- A short opening for return visits (about 1.8 seconds).
- Skipping with any click or key.
- The ending: the screen shows the reel that was playing, the film runs out to flickering light, the camera pulls back, and the lights come up on the room. No "The End" card.
- Film look: grain, gate weave and flicker, heavy during transitions and faint on the resume.
- Synthesized projector sound, off by default.
- Phone framing, reduced-motion handling, and a fallback when WebGL is missing.

Needs your review:

- [ ] **Listen to the sound.** I confirmed it runs without errors but couldn't hear it.
- [x] **Swapped in the June 2026 resume content** (see the appendix). The resume page is now "the program" and shows experience, projects, education and skills, with no bullets.
- [x] **The 2023 About copy is off the site.** It's dropped from the program; the old text is in the appendix if a rewrite is wanted.
- [ ] **Placeholder posters.** "The Late Show" and "Double Feature" are original placeholders. Swap in your own picks.
- [x] **The opening no longer ends on the resume.** It runs into Reel 1, and the resume is the program on the coffee table (see "The program").
- [ ] **Not yet tested:**
  - real phones, Safari and Firefox (only Chromium was tested)
  - the reduced-motion path, which I checked by reading the code but couldn't switch on in the test browser
- [ ] **Page weight.** The 3D scene is about 300 KB gzipped. It loads after the page, so the program's text is never blocked, but the room takes a moment on slow connections.
- [ ] **Not deployed.** Hosting needs your accounts.
- [ ] **`npm audit` flags two advisories** in build tooling (`undici`, `fast-uri`). Neither ships to the browser. I pinned installs to versions at least two weeks old, and `npm audit fix` would pull newer ones.

### The scene

- POV from the couch, looking at the screen across the room.
- Foreground: coffee table with the projector, the reel box, maybe a slide projector beside it.
- Walls: posters and personal objects. Placeholders are fine at first; real picks come later.
- Before the film starts, the room is dim but readable, with a lamp on. The projector is the obvious thing to click.

### Start sequence (first draft)

1. **Lights dim.** The lamp fades and the room darkens over about half a second.
2. **Motor whirs up.** It starts slow and speeds up, with the clatter of film moving through the projector. Sound does a lot of the work here.
3. **Beam appears.** Light cuts from the projector to the screen through floating dust.
4. **Screen flickers white.** Slight frame jitter and scratches.
5. **Countdown.** A short 3, 2, 1 with the sweeping circle, about 2 seconds.
6. **Into the light.** The screen goes back to bare projector light and the view moves forward into it, then the reel loads. Title cards (my name, then "Feature Presentation") were dropped as big text that said nothing, and showing the reel on the screen was dropped because it spoils the surprise.

Target length is 3 to 4 seconds. The full version plays on a first visit only, and a click skips it at any point.

### Ending sequence (first draft)

The screen picks up the reel that was playing, then the film runs out: flickering white, the tail flapping off the reel, the screen goes dark, and the lights come back up on the room. (A "The End" card and a "Thanks for watching" card were tried and dropped.)

### The look

- Film treatment instead of scanlines: grain, slight frame wobble (gate weave), flicker, dust specks, darker edges, warm color.
- Heavy during transitions, faint grain only once people are reading.
- Text stays crisp. The film effects never blur anything meant to be read.
- Idea to explore: silent-film title cards (ornate border, display type) as the style for section headings.

### Controls

- Landing: click the projector, press Enter/Space, or pick a reel in the program. No on-screen start button; the program's prompt is the only hint.
- Skip: any click during the sequence.
- Sound: off until the visitor turns it on (browsers block autoplay anyway). The motor sound is the best part, so the "sound on" control should be easy to find.

### Must-haves

- Works on phones. Portrait screens need their own framing of the room.
- Respects the system "reduce motion" setting: skip straight to the end state.
- Fast first load. The room shouldn't take seconds to appear.

### Open questions

- [x] How is the room drawn? **3D scene**, built in code with three.js. Models made in Blender can replace pieces later.
- [x] Which decade is the room? **The 1970s.**
- [ ] How long can the opening run before it feels in the way? Currently about 4.2 seconds the first time and 1.8 after. Watch it a few times and decide.
- [x] What's on the screen at the end of phase 1? **The feature's first reel.** (At first it was a stopgap resume page; that became the program on the coffee table.)

---

## The program: tying the room, the resume and the feature together

The site had three parts that didn't feel like one thing: the room, the resume, and the reels. The fix: the resume is a printed program sitting in the room, and the room's film is the feature.

### Status: built (merged in #3)

- **A folded program stands on the coffee table,** half open like a greeting card, between the film cans and the projector. Same design as before (cream paper, title-card type, diamond ornaments), painted in code.
- **A game-style prompt points at it:** "[E] Pick up the program" (or "Tap to pick up the program") just above it, and the paper shimmers, until it's been picked up once. After that the prompt shows on hover only.
- **Picking it up** (click, tap, or E) lifts it off the table and holds it up to the camera while the room dims. It's readable right in the render, like a note in a horror game.
- **Four pages to turn through** with the arrow keys, the on-screen buttons, or a click on either half: the cover (name and tonight's running order of reels), the inside spread (Experience and Education; Projects and Skills), and the back (Contact).
- **No separate reading view.** A high-def HTML view (R) was tried and dropped: the paper in hand is the way to read it. The contact links printed on the back work when clicked.
- **Phones:** a tall screen is too narrow for the inside spread, so the inside comes one page at a time (cover, inside left, inside right, back), each filling the width. The paper draws back a little while it opens or turns over, so the cover never swings into the camera.
- **Escape puts it down.** It stands back up on the table.
- **The running order on the cover is clickable:** pick a reel and the film starts and opens on that reel.
- **The opening runs straight into Reel 1** (`/about`) instead of a resume page, and crossfades into it where the browser supports page transitions.
- **Addresses:** picking up the program makes the address `/program`, and opening `/program` brings the room up with the program already in hand. It's the link for someone who only wants the resume. Old `/#resume` links go there.
- **On the reels:** the × in the top-right corner ends the film: the room opens inside the screen and plays the ending. (A link to the program from the reels was tried and dropped: the program belongs in the room.) The reels also get the room's film look: grain, a soft vignette, a faint flicker.
- **Without WebGL or JavaScript,** the page is just the program.
- Paper rustle sounds when it's picked up, turned and put down (with sound on).

Checked in the browser at 16:9, square and phone sizes: the prompt, pick up, all three views, putting it down, picking Reel 2 from the cover (the film plays and lands on `/experience`), the program on a reel page, "End the film", the browser back button from a reel, `/program`, and the page without WebGL (simulated). Not tested: Safari and Firefox, real phones, and the page with WebGL actually missing.

---

## One room: the reels on the room's screen

The critique after #3: the landing page and the feature still didn't feel like one thing. The room was a realistic 3D living room; the reels were a pixel game on a dark page of their own, with purple game menus. You left the room to see the feature.

### Status: built (branch `one-room`)

- **The site never leaves the room.** The reels play on the pull-down screen. After the opening the camera stops square-on to the screen with the picture filling about three quarters of the view, so the screen's black border, the paneling, the plant and the radio stay around it. The lamps come back up to a low glow once the reel is on, like house lights at half.
- **The game plays as the screen's own picture, in 3D.** The game draws one picture (the scene, with its interface drawn on top at three times the game's resolution so text stays sharp), and the room shows it on the screen every frame. So the plant stands in front of it, the projector beam and the dust cross it, the room's grain falls on it, and it's exactly the screen's shape. (A first try laid the game over the page on top of the 3D room; it cut through the plant, the beam and the dust and never quite lined up, so it was dropped.)
- **The interface is part of the picture:** the hotbar, item tooltips, the item panel (top right, in the room's style: dark card, double rule, Fraunces heading), and each reel's title card. The item panel is as large as fits beside the hotbar and glows amber for a few seconds whenever a reel starts, so a new reel's content isn't missed (a tester got absorbed in the game and didn't notice Reel 2 had different content). Like the program's pick-up prompt, each reel's panel also keeps pulsing until one of its items has been opened (hovering doesn't count, since the pointer passes over it all the time), remembered per reel across visits. A "Click an item to read more" note sits under the panel only until the first item is opened on any reel: it teaches the click once, and the pulse points out each new reel after that. Pointer input is traced through the screen into the game, so mining, the hotbar and the panel work by clicking the screen.
- **The room's own controls sit in the margins**, never on the screen: sound and the × top right, and the door buttons in the window's bottom corners (next reel bottom right), in the room's amber and cream.
- **Item cards** pop up over everything on the program's cream paper. The reel's items also exist as a hidden list for screen readers and keyboards.
- **One page.** `/`, `/program` and each reel's address are the same page in different states. Going into the film adds the reel's address to the history; the × and the back button play the ending (the reel holds a beat, the film runs out, the camera pulls back) with no page load. A reel's address opens with that reel already on the screen.
- **Wide screens only.** Anything narrower than 6:5 (an upright phone, a narrow window) gets a note in the room's style: "Turn your phone sideways" or "Widen your window", with "Read the program instead" opening the plain program.
- Item name colors are warmed to the room's palette: burnt orange for school, amber for work, avocado for projects. The in-game hotbar slots are warm brown.
- **Escape** always backs out of the top layer, one at a time: an item card, the plain program, the tuning panel, then the film (back to the couch). During the opening it stops the film and brings the lights back up; with the program in hand it puts it down.
- Sound is shared between the room and the reels. Without WebGL, `/` and `/program` show the program on its own and a reel's address shows the reel's picture on its own.

Checked in Chromium at 16:9, an upright phone, and a phone held sideways: from the couch into Reel 1, a reel's address directly, clicking an item on the screen (opens its card), choosing a hotbar slot and mining a block through the screen, the ×, the "too narrow" note and the plain program. The page's script is 22 KB gzipped; three.js still loads after it. Not tested: Safari, Firefox, real phones, and a browser without WebGL.

Open:

- **Phones held sideways:** it works, but the picture is small (about 480 pixels wide), so the item panel's and hotbar's text is too small to read. Options: draw the interface bigger on small screens, or move the item list into the room's side margins there.
- A pass on the pixel palette toward the room's 70s colors (mustard, burnt orange, avocado, teak).
- The room renders at full speed while a reel plays (the screen's picture changes every frame); worth checking on a slower laptop.

## Phase 2: the world and how info is communicated

### Decided

- **Reels with a pixel world behind them.** The feature film is a few reels. Each reel is a single-screen pixel scene with the character in it, and the content is items in a hotbar and inventory.
- **The feature has three reels:** Home/About, Experience, and Projects.
- **Moving between reels:** walk through a door at the edge of the scene, or press the next/previous button, which makes the character walk to the door. The cut is a frame roll.
- **Film cans are home movies:** the personal, nonessential stuff (photos, hobbies). Each can can use its own film format, like a slide projector for photos.
- **The lobby feel:** the scenes work like a game lobby. Moving, mining blocks, swinging a sword at a dummy, and placing torches and blocks are all optional, and never lock content away.
- **Everything is original,** art and code. No Terraria assets or code.
- **Content is data.** Adding a job or project should be one file, and layouts should handle any number of them.
- **Projects go in the feature,** as Reel 3, not on a film can.
- **Content source for now:** the June 2026 resume (appendix), without bullets.
- **How Phase 1 leads into Phase 2:** the opening ends on Reel 1 instead of the resume (done). The film cans on the coffee table become clickable and play their home movie. The resume becomes the program, a paper on the coffee table (done, see "The program").
- **Still open:** what item name color means (type, recency, or impact; the reels use type for now: school, work, project), and what the Hobbies and Photos home movies show.

### Status: three reels built (merged in #2)

Run `npm run dev` and open `/about`. The Terraria-style feel was left alone this round, as asked; the work went into the content and moving between reels.

The reels:

| Reel | Address | Scene | Items |
|---|---|---|---|
| 1 · About | `/about` | The home base at sunset (the first lobby frame) | Degree, skills, contact |
| 2 · Experience | `/experience` | A torch-lit mine with timber supports, a rail and a cart | One per job |
| 3 · Projects | `/projects` | A workshop at night with a workbench, anvil and furnace | One per project, with the tech stack as "Materials" |

Moving between reels:

- Each scene has a doorway at the edge with a signpost. Walking out of it changes the reel.
- Door buttons at the bottom corners ("Reel 2 · Experience →") run the character to that door. A second press cuts right away, and the film cuts anyway if the character is blocked or takes over 2.4 seconds.
- The cut is a frame roll: the old frame slides off, the black frame line passes, the new frame settles, with a ratchet of clicks if sound is on. The reel name then shows like an intertitle, and the character walks in through the opposite door.
- Each reel has its own address, and the browser back and forward buttons move between reels. `/lobby` redirects to `/about`. (Since "One room", the addresses open the room with that reel on its screen.)
- Each reel keeps its world for the visit, so mined blocks stay mined. The hotbar carries over.
- Reduced motion: no roll and no walk, just the cut.

Content:

- One file per job (`src/data/jobs/`) and per project (`src/data/projects/`). Profile, education and skills are in `src/data/profile.ts`. The reels and the program both read from these.
- Each reel has a panel of its items. It sits over the frame's top right on wide screens and under the frame on narrow ones. Names use the pixel font, and details use the mono font, because the pixel font's digits are hard to read small.
- Clicking an item opens its card (Escape, the Close button, or a click outside closes it). The card's address is shareable, like `/projects#speakeasy`.
- Name colors follow the type (the leaning from "Still open"): burnt orange for school, amber for work, avocado for projects (warmed from blue, gold and green in "One room").
- Each item has its own pixel icon (turbine, briefcase, leaf, server, speech bubble, gamepad, diploma, toolbox, envelope).
- The reels keep the screen clean: no key guide, no program link, and no tuning button. Visitors work out the controls themselves. Sound is a speaker button in the frame's bottom-left corner, beside the left door.

Checked: reel switching both ways, door walk-outs (including from inside the house over the hills), back and forward, cards, the build, and layouts at desktop and phone width. The roll was checked frame by frame rather than watched at full speed, because the test browser pauses animation when its pane is hidden. Watch it once in a real browser.

Not done yet:

- The cards hold only what the resume has. They're the place for write-ups, links and screenshots later.
- The tuning panel's values haven't been tuned. The panel is development-only now: press `` ` `` with `npm run dev` running.

### Phase 2: next up

In rough order:

1. **Phone controls:** tap a spot to walk there and tap a door to change reels. The door buttons already work by touch.
2. **Write-ups on the cards:** a line in your own voice per item, links (GitHub, demos), and later screenshots.
3. **Clickable film cans:** home movies for Photos (a slide projector) and Hobbies.
4. **Tune the feel** in the tuning panel, then copy the values into `DEFAULT_TUNING`.
5. **Scene polish:** more props, and a reason to use the tools on each reel (ore in the mine, crafting at the workbench).
6. **Later:** the live data (time of day, weather, the radio) and extra lobby fun (critters, a boss).

### Earlier ideas

> Raw ideas captured before the decisions above. Kept for reference.

### Terraria-inspired world

- Single-screen rooms: the whole room fits the screen, the edges are walls, and the camera never scrolls.
- A character lives in the room, bound to the screen.
  - It wanders, idles and digs on its own like a pet, so the scene is alive even when nobody plays.
  - WASD takes control. After a few idle seconds it goes back to wandering.
- Room ideas: home base, underground mine, workshop, dungeon, the underworld.
- Room layouts could be based on bases I've built in Terraria.
- Later: using items, summoning a boss.
- Movement should feel like Terraria. Approach: play it, note what I like (acceleration, jump height, floaty fall), and tune the numbers to match.

### Items as content

- An item tooltip already has the shape of a resume entry: name, description, stats.
  - Name shown in a color that means something real (recency, impact, or job vs personal vs school).
  - Stat lines carry real numbers ("Saved 2+ developer hours a week").
  - One-line flavor text in my own voice.
  - Click for the full write-up.
- Item types could carry meaning:
  - Jobs are gear, and "equipped" means the current role.
  - Projects are crafted items, and the crafting recipe is the tech stack ("Materials: React ×1, Firebase ×1").
  - Photos are paintings to hang.
- A hotbar for highlights, plus a full inventory that shows everything at once.
- Selecting an item puts it in the character's hand. Using it could do something (for example, a Spotify project item starts the radio).

### Navigation ideas

- Film reels as sections: load the "Experience" reel to play that section.
- A slide projector for "Photos I like".
- Rooms connected by doors. Each reel or section could be a room, and walking through a door switches the reel.
- A plain-text index of everything (formerly the "TV Guide" idea), the fast path for recruiters. Needs a movie-night equivalent: a program, a playbill, or the reel box label.
- Every section gets its own URL.

### How phase 1 and 2 connect

Decided (see "Decided" above): the opening ends on Reel 1 (built), the resume is the program on the coffee table (built), and the film cans play home movies (not yet).

---

## Later: live data

Each of these has a natural home in the scene. They need a small server piece to hide API keys and cache results.

- **Time of day:** computed in the browser from Waterloo time, no API needed. Drives lighting (window light, lamps on at night). Shows my time, not the visitor's.
- **Weather:** Open-Meteo (free, no key). Rain or snow on the window, storm flashes.
- **Radio / now playing:** Spotify or Last.fm. Can show the song and link to it, but can't play my music to visitors. Any site music has to be original or licensed.
- **Ticker or marquee:** one strip showing all of it, for example "Now playing: … · −4°C, light snow in Waterloo · 11:42 pm".
- **Others:** GitHub activity, osu! stats, current Steam game.
- **Location:** city-level and set by me, never GPS. Switch it during a co-op term elsewhere.

---

## Tech stack

Decided for phase 1:

- **Astro + TypeScript.** The site is static by default; the 3D scene loads only on the page that uses it.
- **three.js** for the room, written directly (no React layer). Effects use three's post-processing: bloom, plus a custom film shader.
- **GSAP** timelines for the opening, skip, and ending sequences.
- **Web Audio** for sound, synthesized in code. No audio files.
- **Self-hosted fonts** via Fontsource: Fraunces (display), Instrument Sans (body), IBM Plex Mono (labels).
- **No image files.** Every texture is painted on a canvas at load time.

Decided for phase 2:

- **Our own small engine** in TypeScript and Canvas 2D, with no game framework. It covers the tile grid, lighting, physics, items, entities and the reels, and comes to about 18 KB gzipped with the content. The code lives in `src/lobby/`.
- **One Astro page per reel** (`src/pages/[reel].astro`), so the panels and cards are plain HTML. The game switches reels in place with the History API.
- **Pixel art drawn in code** for now (tiles, character, items). It can be swapped for hand-drawn sprites later.
- **Pixelify Sans** for the lobby's interface text.

Still open:

- Hosting: Cloudflare (my pick) or Vercel, for the live-data server endpoints later. GitHub Pages works for phase 1 alone.
- A custom domain.

## Ruled out

- Terminal interface. Common in developer portfolios, and painful on phones.
- CRT TV with channels. Replaced by the movie night concept, but its ideas (power-on flash, channels as cameras, remote as navigation) can be borrowed.

## To do

- [x] Merge into `main` (#1 for Phase 1, #2 for Phase 2).
- [ ] Pick hosting and deploy.
- [ ] Archive the old repo (`ahutchin/ahutchin.github.io`) instead of deleting it, or tag its last state (`v2-2024`) before wiping. Keeps the history.
- [ ] Decide whether the new site keeps the `ahutchin.github.io` address or moves to a custom domain.

---

## Appendix: current content (June 2026 resume)

What the site should show for now. Titles, companies, locations and dates only; bullets are dropped on purpose.

### Education

University of Waterloo, BASc Systems Design Engineering, Dean's Honours, GPA 3.9, 2026

### Experience

- **Software Engineer Intern**, GE Vernova, Boston, USA, Jun 2025 – Aug 2025
- **Software Developer Intern**, RedIron Technologies, London, Canada, Sep 2024 – Dec 2024
- **Full Stack Developer Intern**, Tree of Life Canada, Mississauga, Canada, Jan 2024 – Apr 2024

### Projects

The tech stack becomes each project's crafting recipe.

- **Self-Hosted Homelab**, Aug 2025 – present. Ubuntu, Docker Compose, nginx, restic, Tailscale, Prometheus, Grafana.
- **SpeakEasy**, Sep 2025 – Apr 2026. Flutter, FastAPI, Celery, Redis, XGBoost, AssemblyAI.
- **Game Automation**, Aug 2026 – Oct 2026. OCR, SQLite, Appium.

### Skills

- **Languages:** Java, Bash, Python, TypeScript, JavaScript, C#, C++, SQL, Dart, HTML and CSS
- **Frameworks and libraries:** Angular, NgRx, ASP.NET Core, Blazor, Flutter
- **Tools:** Git, Postman, ORDS, Oracle SQL Developer, MySQL, Redis, Jira, Confluence

### Contact

- LinkedIn: https://www.linkedin.com/in/alexanderjhutchinson/
- GitHub: https://github.com/alexanderjhutchinson
- Email: ahutchin2003@gmail.com
- The phone number stays off the public site.

---

## Appendix: older content from the 2023 and 2024 sites

Copied from the old repo so it survives the archive. Superseded by the June 2026 content above, but kept in case any of it comes back.

### Experience

**Software Developer Co-op**, RedIron Technologies, Sep 2024 – ? _(old site said "Present"; update the end date)_

- Developed Count Sheet functionalities using C# and .NET, integrating front-end web development with component-based architecture to establish a proof of concept (POC)
- Programmed responsive Appearance settings using HTML, CSS, and C# Blazor components, enabling users to control the application's color scheme, font size, and component border radius

**Software Developer Co-op**, Tree of Life, Jan 2024 – Apr 2024

- Developed 10+ components on point-of-sales (POS) file management page with Angular & Redux, automating file upload, viewing, & validation, saving 2+ developer hours per week
- Wrote API endpoints utilizing C# and .NET framework to seamlessly fetch user information and upload files, serving as the backbone for the POS page

**Software Developer**, Red Door Design and Staging, Sep 2023 – ? _(only on the 2023 site, dropped from the 2024 version)_

- Developing an end to end web and mobile application with JavaScript, React, and Firebase to create a user friendly inventory management application for 10 active users
- Applying Firebase operations to create, read, update, and delete data from realtime database

**Data Engineer Co-op**, National Grid, May 2023 – Aug 2023

- Developed the Inactive Service Program Database with Microsoft Access to improve fieldwork efficiency by identifying high priority clients
- Streamlined the ISP Database integration by processing 30,000 records and creating 10 fields on account information using Excel

**Data Analyst Co-op**, Fiix by Rockwell Automation, Sep 2022 – Jan 2023

- Reported on 12M sales opportunities in Power BI by creating data driven insights and interactive visualizations with Power Query and DAX
- Identified actionable insights into sales efficiency by transforming 5 data tables that depict Sales team performance

**Data Engineer Co-op**, Employment and Social Development Canada, Jan 2022 – Apr 2022

- Analyzed 100 fields, and 30 business metrics with SQL Dev, creating a comprehensive document identifying relevant EI pipeline data for presentational use
- Inspected 300 views from Oracle DataLake sources with ADF, identifying essential agent dimensions for refining business insights

### About (2023 copy, needs a rewrite)

- I am a Systems Design Engineering student at the University of Waterloo trying to discover my passions by following what drives me.
- I am interested in Software Development with a background in Data Engineering and Analytics. My experience with data allows me to tackle problems with deeper understanding of the product and business space.
- I want to contribute towards developing a meaningful product while tackling challenging problems. At the core, being able to work with something I am genuinely interested in is what creates fulfillment in what I do.

### Contact

- LinkedIn: https://www.linkedin.com/in/ahutchin/
- GitHub: https://github.com/ahutchin
- Email: ahutchin2003@gmail.com

### Assets worth keeping

In the old repo's `src/assets/`: company logos (`ESDC.jpg`, `Fiix.png`, `NationalGrid.png`, `RedDoor.png`) and `pfp.jpg` (615 KB, compress before use).
