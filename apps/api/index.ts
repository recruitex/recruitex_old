import { BunHttpServer, BunRuntime } from '@effect/platform-bun';
import * as Http from '@effect/platform/HttpServer';
import { Effect, Layer } from 'effect';

const ServerLive = BunHttpServer.server.layer({ port: 3001 });

const HttpLive = Http.router.empty.pipe(
  Http.router.get(
    '/',
    Effect.map(Http.request.ServerRequest, () =>
      Http.response.text('Hello World with EffectTS!'),
    ),
  ),
  Http.router.get(
    '/sleep',
    Effect.as(Effect.sleep('10 seconds'), Http.response.empty()),
  ),
  Http.server.serve(Http.middleware.logger),
  Http.server.withLogAddress,
  Layer.provide(ServerLive),
);

BunRuntime.runMain(Layer.launch(HttpLive));
