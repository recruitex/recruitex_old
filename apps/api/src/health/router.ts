import { HttpServer } from '@effect/platform';
import { Config, Effect } from 'effect';

export const HealthRouter = HttpServer.router.empty.pipe(
  HttpServer.router.get(
    '/health',
    Effect.map(Config.string('xD'), (v) =>
      HttpServer.response.text(v, { status: 204 }),
    ),
  ),
);
