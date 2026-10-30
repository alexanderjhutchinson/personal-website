import { HEIGHT, WIDTH } from "./config";

/** Film grain over the reel, one speck per game pixel, like the projector's light in the room. */
export function startGrain(canvas: HTMLCanvasElement, still: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const img = ctx.createImageData(WIDTH, HEIGHT);
  const draw = () => {
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };
  draw();
  if (!still) window.setInterval(draw, 1000 / 12);
}
