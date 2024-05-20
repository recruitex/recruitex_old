import { BunHttpServer, BunRuntime } from '@effect/platform-bun';
import { HttpServer } from '@effect/platform';
import { Config, Console, Effect, Layer } from 'effect';
import { EDGEDB_AUTH_TOKEN_COOKIE } from '#/auth/consts';
import { AuthRouter } from '#/auth/router';
import { corsMiddleware } from '#/cors';
import { HealthRouter } from '#/health/router';
import { LogLevelLive } from '#/logging';
import { statusCodes } from '#/utils/response';
import { OrganizationsRouter } from '#/organizations/router';

const ServerLive = BunHttpServer.server.layerConfig({
  port: Config.number('PORT').pipe(Config.withDefault(3001)),
});

const MainRouter = HttpServer.router.empty.pipe(
  HttpServer.router.get(
    '/',
    Effect.map(HttpServer.request.ServerRequest, (r) =>
      HttpServer.response.text(
        `Hello World with EffectTS! ${r.cookies[EDGEDB_AUTH_TOKEN_COOKIE] ? 'Logged in' : 'Not logged in'}`,
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

const WholeRouter = HttpServer.router.empty.pipe(
  HttpServer.router.concat(MainRouter),
  HttpServer.router.concat(AuthRouter),
  HttpServer.router.concat(HealthRouter),
  HttpServer.router.concat(OrganizationsRouter),
);

const runnable = WholeRouter.pipe(
  corsMiddleware,
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      yield* Console.error('Error', error);
      return HttpServer.response.text('Error', {
        status: statusCodes.INTERNAL_SERVER_ERROR,
      });
    }),
  ),
  Effect.catchAllDefect((defect) =>
    Effect.gen(function* () {
      yield* Console.error('Defect', defect);
      return HttpServer.response.text('Defect', {
        status: statusCodes.INTERNAL_SERVER_ERROR,
      });
    }),
  ),
  HttpServer.server.serve(HttpServer.middleware.logger),
  HttpServer.server.withLogAddress,
  Layer.provide(ServerLive),
  Layer.launch,
  Effect.provide(LogLevelLive),
);

BunRuntime.runMain(runnable);
