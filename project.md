# Personal website

A from-scratch rebuild of my personal site. It replaces the old React/Vite site in `ahutchin/ahutchin.github.io`.

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

### Status: first version built (branch `phase-1-landing`)

Decided: a 3D room drawn entirely in code, set in the 1970s, ending on a stopgap resume page. Run it with `npm run dev` (see README).

What's in it:

- The room: wood paneling, wallpaper, shag rug, teak sideboard, table lamp, tension pole lamp, window with moonlight, pull-down screen, placeholder posters, a radio, a snake plant, popcorn, and film cans labeled Experience, Projects and Photos.
- A Super 8 projector on the coffee table. Click it or the "Start the film" button.
- The full opening (about 4.2 seconds): lamps dim, reels spin up, the beam appears through dust, the screen flickers, a 3-2-1 countdown with the 2-pop, a title card, then the camera moves into the screen and crossfades to the resume.
- A short opening for return visits (about 1.8 seconds).
- Skipping with any click or key.
- The ending: "The End" card, film runout, the camera pulls back, and the lights come up on the room.
- Film look: grain, gate weave and flicker, heavy during transitions and faint on the resume.
- Synthesized projector sound, off by default.
- Phone framing, reduced-motion handling, and a fallback when WebGL is missing.

Needs your review:

- [ ] **Listen to the sound.** I confirmed it runs without errors but couldn't hear it.
- [ ] **Content refresh.**
  - RedIron's end date is missing.
  - The About copy is from 2023.
  - The Red Door role is left out, as on the 2024 site (it's in the appendix if you want it back).
- [ ] **Placeholder posters.** "The Late Show" and "Double Feature" are original placeholders. Swap in your own picks.
- [ ] **Reloading after the film opens the resume directly** (the URL becomes `/#resume`). Good for sharing a link, but returning visitors only see the room again via "End the film".
- [ ] **Not yet tested:**
  - real phones, Safari and Firefox (only Chromium was tested)
  - the reduced-motion path, which I checked by reading the code but couldn't switch on in the test browser
- [ ] **Page weight.** The 3D scene is about 300 KB gzipped. It loads after the page, so the resume text is never blocked, but the room takes a moment on slow connections.
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
6. **Title card.** My name, then the view moves forward into the screen and the film becomes the page.

Target length is 3 to 4 seconds. The full version plays on a first visit only, and a click skips it at any point.

### Ending sequence (first draft)

"The End" card, the film tail flapping off the reel, the screen goes white then dark, and the lights come back up on the room. (A "Thanks for watching" card with contact links was tried and dropped; contact info lives on the resume.)

### The look

- Film treatment instead of scanlines: grain, slight frame wobble (gate weave), flicker, dust specks, darker edges, warm color.
- Heavy during transitions, faint grain only once people are reading.
- Text stays crisp. The film effects never blur anything meant to be read.
- Idea to explore: silent-film title cards (ornate border, display type) as the style for section headings.

### Controls

- Landing: click the projector, or press Enter/Space. A small hint shows how.
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
- [x] What's on the screen at the end of phase 1, before phase 2 exists? **A stopgap resume page**, styled as projected light with silent-film title cards.

---

## Phase 2: the world and how info is communicated

> 📌 **Pinned. Needs more ideation before any decisions.** Everything below is raw ideas captured so far, not a plan.

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

Open. One idea: the projected film is the window into the pixel world, the same way the TV was going to be.

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

Still open:

- Hosting: Cloudflare (my pick) or Vercel, for the live-data server endpoints later. GitHub Pages works for phase 1 alone.
- A custom domain.
- A canvas game framework (Phaser or Kaplay) if phase 2 happens.

## Ruled out

- Terminal interface. Common in developer portfolios, and painful on phones.
- CRT TV with channels. Replaced by the movie night concept, but its ideas (power-on flash, channels as cameras, remote as navigation) can be borrowed.

## To do

- [ ] Archive the old repo (`ahutchin/ahutchin.github.io`) instead of deleting it, or tag its last state (`v2-2024`) before wiping. Keeps the history.
- [ ] Decide whether the new site keeps the `ahutchin.github.io` address or moves to a custom domain.

---

## Appendix: content carried over from the old site

Copied from the old repo so it survives the archive. Needs a refresh before use.

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
