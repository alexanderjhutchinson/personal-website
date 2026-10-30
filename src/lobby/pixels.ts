/** Small helpers for drawing pixel art in code. */

export function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas is unavailable");
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

/**
 * Turn rows of characters into a sprite. Each character is a palette key;
 * "." is transparent.
 */
export function sprite(rows: string[], colors: Record<string, string>) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const { c, ctx } = makeCanvas(w, h);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = colors[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return c;
}

/** Stable per-position hash in [0, 1), for picking tile variants. */
export function hash2(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// 3x5 digits for damage numbers, drawn pixel by pixel so they stay crisp.
const DIGITS: Record<string, string[]> = {
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###", "..#", "###", "#..", "###"],
  "3": ["###", "..#", ".##", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "###", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "###"],
};

/** Draw a number with a 1px dark outline. Returns its width. */
export function drawNumber(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  const width = text.length * 4 - 1;
  for (const [fill, offsets] of [
    ["#140c08", [[-1, 0], [1, 0], [0, -1], [0, 1]]],
    [color, [[0, 0]]],
  ] as const) {
    ctx.fillStyle = fill;
    for (const [ox, oy] of offsets) {
      [...text].forEach((ch, i) => {
        const glyph = DIGITS[ch];
        if (!glyph) return;
        glyph.forEach((row, gy) => {
          [...row].forEach((px, gx) => {
            if (px === "#") ctx.fillRect(Math.round(x + i * 4 + gx + ox), Math.round(y + gy + oy), 1, 1);
          });
        });
      });
    }
  }
  return width;
}
