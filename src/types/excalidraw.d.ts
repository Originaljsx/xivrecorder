declare module '@excalidraw/excalidraw' {
  export const Excalidraw: React.FC<any>;
}

declare module '@excalidraw/excalidraw/index.css' {}

declare module '@excalidraw/excalidraw/dist/types/excalidraw/element/types' {
  export interface ExcalidrawElement {
    [key: string]: any;
  }
}
