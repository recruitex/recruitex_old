import { Config, Console, Effect } from 'effect';
import { HttpServer, HttpClient } from '@effect/platform';
import { createVerifierChallengePair } from './crypto';
import {
  EDGEDB_AUTH_TOKEN_COOKIE,
  EDGEDB_PKCE_VERIFIER_COOKIE,
  RETURN_TO_COOKIE,
} from './consts';
import { EdgedbAuthResponse } from './schema';

const handleAuth = (method: 'signin' | 'signup') =>
  Effect.gen(function* () {
    const req = yield* HttpServer.request.ServerRequest;
    const headers = req.headers;
    const referer = headers['referer'];
    yield* Console.log(referer);

    const { verifier, challenge } = yield* createVerifierChallengePair;

    const EDGEDB_AUTH_BASE_URL = yield* Config.string('EDGEDB_AUTH_BASE_URL');

    const redirectUrl = new URL(`ui/${method}`, EDGEDB_AUTH_BASE_URL);
    redirectUrl.searchParams.set('challenge', challenge);

    return yield* HttpServer.response.empty().pipe(
      HttpServer.response.setStatus(307),
      HttpServer.response.setHeaders({
        Location: redirectUrl.href,
      }),
      HttpServer.response.setCookies([
        [
          RETURN_TO_COOKIE,
          referer ?? 'TEST_BACKUP',
          { httpOnly: true, path: '/', sameSite: 'lax' },
        ],
        [
          EDGEDB_PKCE_VERIFIER_COOKIE,
          verifier,
          { httpOnly: true, path: '/', sameSite: 'lax' },
        ],
      ]),
    );
  });

export const AuthRouter = HttpServer.router.empty.pipe(
  HttpServer.router.get('/auth/ui/signin', handleAuth('signin')),
  HttpServer.router.get('/auth/ui/signup', handleAuth('signup')),
  HttpServer.router.get(
    '/auth/callback',
    Effect.gen(function* () {
      const req = yield* HttpServer.request.ServerRequest;
      const BASE_URL = yield* Config.string('BASE_URL');
      const requestUrl = new URL(req.url, BASE_URL);

      const code = requestUrl.searchParams.get('code');
      if (!code) {
        const error = requestUrl.searchParams.get('error');

        return HttpServer.response.text(
          `OAuth callback is missing 'code'. OAuth provider responded with error: ${error}`,
          { status: 400 },
        );
      }

      const cookies = req.cookies;
      const verifier = cookies[EDGEDB_PKCE_VERIFIER_COOKIE];
      const returnTo = cookies[RETURN_TO_COOKIE];

      if (!verifier) {
        return HttpServer.response.text(
          `Could not find 'verifier' in the cookie store. Is this the same user agent/browser that started the authorization flow?`,
          { status: 400 },
        );
      }

      const EDGEDB_AUTH_BASE_URL = yield* Config.string('EDGEDB_AUTH_BASE_URL');

      const codeExchangeUrl = new URL('token', EDGEDB_AUTH_BASE_URL);
      codeExchangeUrl.searchParams.set('code', code);
      codeExchangeUrl.searchParams.set('verifier', verifier);

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

      return yield* HttpServer.response.empty().pipe(
        HttpServer.response.setStatus(301),
        HttpServer.response.setHeader('Location', returnTo ?? BASE_URL),
        HttpServer.response.setCookie(
          EDGEDB_AUTH_TOKEN_COOKIE,
          response.auth_token,
          {
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
          },
        ),
      );
    }),
  ),
);
