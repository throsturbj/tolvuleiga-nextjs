declare module 'pdfkit/js/pdfkit.standalone' {
  export default class PDFDocument {
    constructor(options?: unknown);
    on(event: string, listener: (chunk: unknown) => void): this;
    end(): void;
    registerFont(name: string, src: Buffer | Uint8Array | ArrayBuffer | string): this;
    font(name: string | Buffer): this;
    fontSize(size: number): this;
    text(text: string, options?: unknown): this;
    moveDown(lines?: number): this;
    fillColor(color: string): this;
  }
}


