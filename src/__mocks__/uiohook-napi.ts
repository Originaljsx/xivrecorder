export const EventType = {
  EVENT_KEY_PRESSED: 4,
  EVENT_KEY_RELEASED: 5,
  EVENT_MOUSE_CLICKED: 6,
  EVENT_MOUSE_PRESSED: 7,
  EVENT_MOUSE_RELEASED: 8,
};

export const uIOhook = {
  start: jest.fn(),
  stop: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeAllListeners: jest.fn(),
};

export type UiohookKeyboardEvent = {
  type: number;
  keycode: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

export type UiohookMouseEvent = {
  type: number;
  button: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};
