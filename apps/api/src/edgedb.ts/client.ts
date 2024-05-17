import { Effect } from 'effect';
import { type Client } from 'edgedb';
import { createClient } from '../../dbschema/edgeql-js';

export class EdgedbResourceError extends Error {
  _tag = 'EdgedbResourceError';
}

export class EdgedbCloseResourceError extends Error {
  _tag = 'EdgedbCloseResourceError';
}

export const acquire = Effect.try({
  try() {
    return createClient();
  },
  catch: (error) =>
    new EdgedbResourceError('Error creating EdgeDB client!', { cause: error }),
});

export const release = (client: Client) =>
  Effect.tryPromise({
    try() {
      return client.close();
    },
    catch(error) {
      return new EdgedbCloseResourceError('Error closing EdgeDB client!', {
        cause: error,
      });
    },
  }).pipe(Effect.logError);

export const edgedbClient = Effect.acquireRelease(acquire, release);
