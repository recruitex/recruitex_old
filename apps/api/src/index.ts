import { HttpClient } from '@effect/platform';
import { BunHttpServer, BunRuntime } from '@effect/platform-bun';
import * as Http from '@effect/platform/HttpServer';
import { Schema } from '@effect/schema';
import { Config, Console, Effect, Layer } from 'effect';
import { createVerifierChallengePair } from './crypto';

const EDGEDB_PKCE_VERIFIER_COOKIE = 'edgedb-pkce-verifier';
const EDGEDB_AUTH_TOKEN_COOKIE = 'edgedb-auth-token';

const handleAuth = (method: 'signin' | 'signup') =>
  Effect.gen(function* () {
    const { verifier, challenge } = yield* createVerifierChallengePair;

    yield* Console.log({ verifier, challenge });

    const EDGEDB_AUTH_BASE_URL = yield* Config.string('EDGEDB_AUTH_BASE_URL');

    const redirectUrl = new URL(`ui/${method}`, EDGEDB_AUTH_BASE_URL);
    redirectUrl.searchParams.set('challenge', challenge);

    return yield* Http.response.empty().pipe(
      Http.response.setStatus(301),
      Http.response.setHeaders({
        Location: redirectUrl.href,
      }),
      Http.response.setCookie(EDGEDB_PKCE_VERIFIER_COOKIE, verifier, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
      }),
    );
  });

const EdgedbAuthResponse = Schema.Struct({
  auth_token: Schema.String,
});

const ServerLive = BunHttpServer.server.layerConfig({
  port: Config.number('PORT'),
});

const HttpLive = Http.router.empty.pipe(
  Http.router.get(
    '/',
    Effect.map(Http.request.ServerRequest, (r) =>
      Http.response.text(
        `Hello World with EffectTS! ${r.cookies[EDGEDB_AUTH_TOKEN_COOKIE]}`,
      ),
    ),
  ),
  Http.router.get(
    '/sleep',
    Effect.as(
      Effect.sleep('1 second'),
      Http.response.text('Slept for 1 second'),
    ),
  ),
  Http.router.get('/auth/ui/signin', handleAuth('signin')),
  Http.router.get('/auth/ui/signup', handleAuth('signup')),
  Http.router.get(
    '/auth/callback',
    Effect.gen(function* () {
      const req = yield* Http.request.ServerRequest;
      const BASE_URL = yield* Config.string('BASE_URL');
      const requestUrl = new URL(req.url, BASE_URL);

      const code = requestUrl.searchParams.get('code');
      if (!code) {
        const error = requestUrl.searchParams.get('error');

        return Http.response.text(
          `OAuth callback is missing 'code'. OAuth provider responded with error: ${error}`,
          { status: 400 },
        );
      }

      const cookies = req.cookies;
      const verifier = cookies[EDGEDB_PKCE_VERIFIER_COOKIE];

      if (!verifier) {
        return Http.response.text(
          `Could not find 'verifier' in the cookie store. Is this the same user agent/browser that started the authorization flow?`,
          { status: 400 },
        );
      }

      const EDGEDB_AUTH_BASE_URL = yield* Config.string('EDGEDB_AUTH_BASE_URL');

      const codeExchangeUrl = new URL('token', EDGEDB_AUTH_BASE_URL);
      codeExchangeUrl.searchParams.set('code', code);
      codeExchangeUrl.searchParams.set('verifier', verifier);

      yield* Console.log({ verifier, length: verifier.length });

      const request = HttpClient.request
        .get(codeExchangeUrl.href)
        .pipe(
          HttpClient.client.fetch,
          Effect.andThen(
            HttpClient.response.schemaBodyJson(EdgedbAuthResponse),
          ),
          Effect.scoped,
        );

      const response = yield* request;

      return yield* Http.response.empty().pipe(
        Http.response.setStatus(301),
        Http.response.setHeader('Location', 'http://localhost:3001'),
        Http.response.setCookie(EDGEDB_AUTH_TOKEN_COOKIE, response.auth_token, {
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
        }),
      );
    }),
  ),
  Http.server.serve(Http.middleware.logger),
  Http.server.withLogAddress,
  Layer.provide(ServerLive),
);

const runnable = Layer.launch(HttpLive);

BunRuntime.runMain(runnable);
