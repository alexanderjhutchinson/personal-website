// The photos on the pin board: the top row left to right, then the bottom. Each has two web copies in
// public/photos, made from the originals by `npm run photos` (scripts/photos.mjs).

export interface Snapshot {
  /** Its web copies' name in public/photos: NAME-small.webp and NAME-large.webp. */
  photo: string;
  /** The picture's width over its height. */
  aspect: number;
  /** Its center on the board, in meters from the board's center, and its tilt in degrees. */
  at: [x: number, y: number, tilt: number];
  /** What it shows, for screen readers and the keyboard. */
  about: string;
  /** What's written on its back in pen, a line each, the first bigger. Empty for a blank back. */
  back: string[];
  /** Where it was taken, printed faint along the bottom of the back, if given. */
  coordinates?: string;
  /** The writing goes in the bottom right corner of the back, rather than toward the middle. */
  bottomRight?: boolean;
}

export const PHOTOS: Snapshot[] = [
  {
    photo: "001717310027",
    aspect: 3 / 2,
    at: [-0.35, 0.15, -4],
    about: "A rest in the mountains, on film",
    back: ["Dolomites"],
    bottomRight: true,
  },
  {
    photo: "img_1593",
    aspect: 3 / 4,
    at: [-0.13, 0.13, 3],
    about: "Dumplings round a big table",
    back: ["Shenzhen, China"],
  },
  {
    photo: "img_1982",
    aspect: 4 / 3,
    at: [0.095, 0.16, -2],
    about: "Graduation",
    back: ["Graduation!"],
    bottomRight: true,
  },
  // A night photo, so the lamp's bright spot suits it.
  {
    photo: "img_1595",
    aspect: 3 / 4,
    at: [0.345, 0.12, 5],
    about: "Out front of a restaurant in the holiday lights",
    back: ["Home"],
  },
  {
    photo: "dsc02006",
    aspect: 3 / 4,
    at: [-0.32, -0.15, 4],
    about: "A night out, on an old digital camera",
    back: [],
    bottomRight: true,
  },
  {
    photo: "img_1592",
    aspect: 4 / 3,
    at: [-0.07, -0.17, -3],
    about: "A shrine by a pond",
    back: ["Japan"],
  },
  {
    photo: "img_1594",
    aspect: 2 / 3,
    at: [0.19, -0.15, 2],
    about: "The road behind, in a mirror on a mountain road",
    back: ["Ha Giang, Vietnam"],
  },
];
