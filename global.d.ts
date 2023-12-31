type Class<T> = new () => T;
type ExtractInstance<T> = T extends new (...args: unknown[]) => infer R ? R : never;
type MouseTouchEvent = MouseEvent | TouchEvent;
type Vec2 = { x: number, y: number };

type CursorPosition = {
  screen: Vec2,
  browser: Vec2,
  element: Vec2,
};

type Config = {
  width: number,
  height: number,
  zoom: number,
};

type ConfigKey = keyof Config;

type CanvasData = {
  canvas: HTMLCanvasElement,
  name: string,
  data: Uint8Array,
  ctx: CanvasRenderingContext2D,
};
