import { Effect, Context, Layer } from 'effect';
import { type Client } from 'edgedb';
import { createClient } from '#db/edgeql-js';
import { getTokenFromRequest } from '#/utils/request';
import { createTaggedError } from '#/utils/error';

export const EdgedbResourceError = createTaggedError('EdgeDBResourceError');

export const EdgeDBCloseResourceError = createTaggedError(
  'EdgeDBCloseResourceError',
);

export class EdgeDBClient extends Context.Tag('EdgeDBClient')<
  EdgeDBClient,
  Client
>() {}

export class EdgeDBAuthClient extends Context.Tag('EdgeDBAuthClient')<
  EdgeDBAuthClient,
  Client
>() {}

export const acquire = Effect.try({
  try() {
    return createClient();
  },
  catch: (error) =>
    new EdgedbResourceError('Error creating EdgeDB client!', { cause: error }),
});

export const acquireAuth = (token: string) =>
  Effect.try({
    try() {
      return createClient().withGlobals({
        'ext::auth::client_token': token,
      });
    },
    catch: (error) =>
      new EdgedbResourceError('Error creating EdgeDB client!', {
        cause: error,
      }),
  });

export const release = (client: Client) =>
  Effect.tryPromise({
    try() {
      return client.close();
    },
    catch(error) {
      return new EdgeDBCloseResourceError('Error closing EdgeDB client!', {
        cause: error,
      });
    },
  }).pipe(Effect.logError);

export const EdgedbClientLive = Layer.effect(
  EdgeDBClient,
  Effect.acquireRelease(acquire, release),
);

export const EdgedbAuthClientLive = Layer.effect(
  EdgeDBAuthClient,
  Effect.gen(function* () {
    const token = yield* getTokenFromRequest;

    return yield* Effect.acquireRelease(acquireAuth(token), release);
  }),
);
