declare module 'uiohook-napi' {
  export const EventType: {
    EVENT_KEY_PRESSED: number;
    EVENT_KEY_RELEASED: number;
    EVENT_MOUSE_CLICKED: number;
    EVENT_MOUSE_PRESSED: number;
    EVENT_MOUSE_RELEASED: number;
  };

  export interface UiohookKeyboardEvent {
    type: number;
    keycode: number;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  }

  export interface UiohookMouseEvent {
    type: number;
    button: number;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  }

  export const uIOhook: {
    start: () => void;
    stop: () => void;
    on: (event: string, callback: (event: any) => void) => void;
    off: (event: string, callback: (event: any) => void) => void;
    once: (event: string, callback: (event: any) => void) => void;
    removeAllListeners: (event?: string) => void;
  };
}
