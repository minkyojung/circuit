/**
 * Type definitions for fontfaceobserver
 */

declare module 'fontfaceobserver' {
  export default class FontFaceObserver {
    constructor(fontFamily: string, options?: {
      weight?: string | number;
      style?: string;
      stretch?: string;
    });

    load(testString?: string | null, timeout?: number): Promise<void>;
  }
}
