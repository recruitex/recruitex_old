import { HttpServer } from '@effect/platform';
import { Effect } from 'effect';

export const HealthRouter = HttpServer.router.empty.pipe(
  HttpServer.router.get(
    '/health',
    Effect.map(HttpServer.request.ServerRequest, () =>
      HttpServer.response.empty({ status: 204 }),
    ),
  ),
);
