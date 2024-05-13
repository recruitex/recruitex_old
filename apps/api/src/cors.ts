import { HttpServer } from '@effect/platform';
import { Effect } from 'effect';

export const corsMiddleware = HttpServer.middleware.make((app) => {
  return app.pipe(
    Effect.andThen(
      HttpServer.response.setHeaders({
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Origin': 'http://localhost:3000',
      }),
    ),
  );
});
