import { HttpMiddleware, HttpServerResponse } from '@effect/platform';
import { Effect } from 'effect';

export const corsMiddleware = HttpMiddleware.make((app) => {
  return app.pipe(
    Effect.andThen(
      HttpServerResponse.setHeaders({
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Origin': 'http://localhost:3000',
      }),
    ),
  );
});
