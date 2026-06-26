import { randomUUID } from 'node:crypto';
import type { EventId, EventStore, StreamId } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

type EventRecord = { eventId: EventId; message: JSONRPCMessage; streamId: StreamId };

export const createEventStore = (): EventStore => {
  const events: EventRecord[] = [];
  return {
    getStreamIdForEventId: async (eventId) =>
      events.find((entry) => entry.eventId === eventId)?.streamId,
    replayEventsAfter: async (lastEventId, { send }) => {
      const index = events.findIndex((entry) => entry.eventId === lastEventId);
      const streamId = index >= 0 ? events[index].streamId : randomUUID();
      for (const entry of events.slice(index + 1).filter((event) => event.streamId === streamId)) {
        await send(entry.eventId, entry.message);
      }
      return streamId;
    },
    storeEvent: async (streamId, message) => {
      const eventId = randomUUID();
      events.push({ eventId, message, streamId });
      if (events.length > 500) events.splice(0, events.length - 500);
      return eventId;
    },
  };
};
