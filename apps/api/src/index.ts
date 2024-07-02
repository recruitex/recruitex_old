import { BunHttpServer, BunRuntime } from '@effect/platform-bun';
import {
  HttpServer,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
  HttpMiddleware,
} from '@effect/platform';
import { Config, Console, Effect, Layer } from 'effect';
import { EDGEDB_AUTH_TOKEN_COOKIE } from '#/auth/consts';
import { AuthRouter } from '#/auth/router';
import { corsMiddleware } from '#/cors';
import { HealthRouter } from '#/health/router';
import { LogLevelLive } from '#/logging';
import { statusCodes } from '#/utils/response';
import { OrganizationsRouter } from '#/organizations/router';

const ServerLive = BunHttpServer.layerConfig({
  port: Config.number('PORT').pipe(Config.withDefault(3001)),
});

const MainRouter = HttpRouter.empty.pipe(
  HttpRouter.get(
    '/',
    Effect.map(HttpServerRequest.HttpServerRequest, (r) =>
      HttpServerResponse.text(
        `Hello World with EffectTS! ${r.cookies[EDGEDB_AUTH_TOKEN_COOKIE] ? 'Logged in' : 'Not logged in'}`,
      ),
    ),
  ),
  HttpRouter.get(
    '/sleep',
    Effect.as(
      Effect.sleep('1 second'),
      HttpServerResponse.text('Slept for 1 second'),
    ),
  ),
);

const WholeRouter = HttpRouter.empty.pipe(
  HttpRouter.concat(MainRouter),
  HttpRouter.concat(AuthRouter),
  HttpRouter.concat(HealthRouter),
  HttpRouter.concat(OrganizationsRouter),
);

const runnable = WholeRouter.pipe(
  corsMiddleware,
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      yield* Console.error('Error', error);
      return HttpServerResponse.text('Error', {
        status: statusCodes.INTERNAL_SERVER_ERROR,
      });
    }),
  ),
  Effect.catchAllDefect((defect) =>
    Effect.gen(function* () {
      yield* Console.error('Defect', defect);
      return HttpServerResponse.text('Defect', {
        status: statusCodes.INTERNAL_SERVER_ERROR,
      });
    }),
  ),
  HttpServer.serve(HttpMiddleware.logger),
  HttpServer.withLogAddress,
  Layer.provide(ServerLive),
  Layer.launch,
  Effect.provide(LogLevelLive),
);

BunRuntime.runMain(runnable);
