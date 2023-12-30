declare type Class<T> = new () => T;
type ExtractInstance<T> = T extends new (...args: unknown[]) => infer R ? R : never;

type Config = { width: number, height: number };

type CanvasData = {
  canvas: HTMLCanvasElement,
  name: string,
  data: Uint8Array,
};
