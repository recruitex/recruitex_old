import { BunHttpServer, BunRuntime } from '@effect/platform-bun';
import { HttpServer } from '@effect/platform';
import { Config, Console, Effect, Layer } from 'effect';
import { EDGEDB_AUTH_TOKEN_COOKIE } from './auth/consts';
import { AuthRouter } from './auth/router';
import { corsMiddleware } from './cors';
import { HealthRouter } from './health/router';
import { LogLevelLive } from './logging';

const ServerLive = BunHttpServer.server.layerConfig({
  port: Config.number('PORT').pipe(Config.withDefault(3001)),
});

const MainRouter = HttpServer.router.empty.pipe(
  HttpServer.router.get(
    '/',
    Effect.map(HttpServer.request.ServerRequest, (r) =>
      HttpServer.response.text(
        `Hello World with EffectTS! ${r.cookies[EDGEDB_AUTH_TOKEN_COOKIE]}`,
      ),
    ),
  ),
  HttpServer.router.get(
    '/sleep',
    Effect.as(
      Effect.sleep('1 second'),
      HttpServer.response.text('Slept for 1 second'),
    ),
  ),
);

const routers = [MainRouter, AuthRouter, HealthRouter];

const WholeRouter = routers.reduce((acc, router) =>
  acc.pipe(HttpServer.router.concat(router)),
);

const runnable = WholeRouter.pipe(
  corsMiddleware,
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      yield* Console.error('Error', error);
      return HttpServer.response.text('Error', { status: 500 });
    }),
  ),
  Effect.catchAllDefect((defect) =>
    Effect.gen(function* () {
      yield* Console.error('Defect', defect);
      return HttpServer.response.text('Defect', { status: 500 });
    }),
  ),
  HttpServer.server.serve(HttpServer.middleware.logger),
  HttpServer.server.withLogAddress,
  Layer.provide(ServerLive),
  Layer.launch,
  Effect.provide(LogLevelLive),
);

BunRuntime.runMain(runnable);
