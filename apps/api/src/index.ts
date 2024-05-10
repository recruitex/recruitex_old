import { BunHttpServer, BunRuntime } from '@effect/platform-bun';
import { HttpServer } from '@effect/platform';
import { Config, Console, Effect, Layer } from 'effect';
import { EDGEDB_AUTH_TOKEN_COOKIE } from './auth/consts';
import { AuthRouter } from './auth/router';

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
  HttpServer.router.get('/health', HttpServer.response.empty({ status: 204 })),
);

const myMiddleware = HttpServer.middleware.make((app) => {
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

const WholeRouter = MainRouter.pipe(HttpServer.router.concat(AuthRouter));

const HttpLive = WholeRouter.pipe(
  myMiddleware,
  HttpServer.server.serve(HttpServer.middleware.logger),
  HttpServer.server.withLogAddress,
  Layer.provide(ServerLive),
);

const runnable = Layer.launch(HttpLive);

BunRuntime.runMain(runnable);
