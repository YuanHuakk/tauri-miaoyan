/// <reference types="vite/client" />

declare module "lightense-images" {
  interface LightenseOptions {
    time?: number;
    padding?: number;
    offset?: number;
    keyboard?: boolean;
    cubicBezier?: string;
    background?: string;
    zIndex?: number;
  }
  function Lightense(
    elements: NodeListOf<Element> | string,
    options?: LightenseOptions
  ): void;
  export default Lightense;
}
