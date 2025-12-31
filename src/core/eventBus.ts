type Handler<Payload> = (payload: Payload) => void;

type EventMap = Record<string, unknown>;

export type EventBus<Events extends EventMap> = {
  on: <Key extends keyof Events>(
    event: Key,
    handler: Handler<Events[Key]>
  ) => () => void;
  off: <Key extends keyof Events>(
    event: Key,
    handler: Handler<Events[Key]>
  ) => void;
  emit: <Key extends keyof Events>(event: Key, payload: Events[Key]) => void;
};

export const createEventBus = <Events extends EventMap>(): EventBus<Events> => {
  const handlers = new Map<keyof Events, Set<Handler<Events[keyof Events]>>>();

  const on: EventBus<Events>["on"] = (event, handler) => {
    const entry =
      handlers.get(event) ?? new Set<Handler<Events[keyof Events]>>();
    entry.add(handler as Handler<Events[keyof Events]>);
    handlers.set(event, entry);

    return () => off(event, handler);
  };

  const off: EventBus<Events>["off"] = (event, handler) => {
    const entry = handlers.get(event);
    if (!entry) {
      return;
    }
    entry.delete(handler as Handler<Events[keyof Events]>);
    if (entry.size === 0) {
      handlers.delete(event);
    }
  };

  const emit: EventBus<Events>["emit"] = (event, payload) => {
    const entry = handlers.get(event);
    if (!entry) {
      return;
    }
    entry.forEach((handler) => handler(payload));
  };

  return { on, off, emit };
};
