// The pull-down screen's size and where its picture sits on the page while a
// reel plays. Plain numbers, with no three.js, so the page can place a reel on
// the screen before the 3D room has loaded.

export const SCREEN_SIZE = {
  width: 2.5,
  height: 1.56,
  /** Black masking border, as a fraction of the screen width. */
  border: 0.035,
};

/** The projected picture: the screen minus its masking border. */
export const IMAGE = {
  width: SCREEN_SIZE.width - 2 * SCREEN_SIZE.border * SCREEN_SIZE.width,
  height: SCREEN_SIZE.height - 2 * SCREEN_SIZE.border * SCREEN_SIZE.width,
};

/**
 * While a reel plays, the projected picture takes this much of the view (by
 * height, or by width on narrow screens), so the screen's border and the room
 * stay around it. The camera looks straight at the picture from this distance.
 */
export const REEL_VIEW = { height: 0.76, width: 0.92, distance: 4.12 };

/** Where the projected picture sits in a viewport this size while a reel plays. It's centered. */
export function reelRect(viewWidth: number, viewHeight: number) {
  const aspect = IMAGE.width / IMAGE.height;
  const w = Math.min(viewHeight * REEL_VIEW.height * aspect, viewWidth * REEL_VIEW.width);
  const h = w / aspect;
  return { x: (viewWidth - w) / 2, y: (viewHeight - h) / 2, w, h };
}
