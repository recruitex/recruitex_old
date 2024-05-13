import { Config, Console, Effect, Option } from 'effect';
import { HttpServer, HttpClient } from '@effect/platform';
import { createVerifierChallengePair } from './crypto';
import {
  EDGEDB_AUTH_TOKEN_COOKIE,
  EDGEDB_PKCE_VERIFIER_COOKIE,
  REDIRECT_TO_COOKIE,
} from './consts';
import {
  EdgedbAuthResponseSchema,
  GithubUserSchema,
  GoogleUserSchema,
  OAuthProvider,
  OAuthProviderSchema,
} from './schema';
import { Schema } from '@effect/schema';
import { addMinutes, constructNow } from 'date-fns';
import e, { createClient } from '../../dbschema/edgeql-js';

const handleAuth = (method: 'signin' | 'signup') =>
  Effect.gen(function* () {
    const req = yield* HttpServer.request.ServerRequest;
    const baseUrl = yield* Config.string('BASE_URL');
    const url = req.url;
    const requestFullUrl = new URL(url, baseUrl);
    const redirectUrl = requestFullUrl.searchParams.get('redirect_url');

    if (!redirectUrl) {
      return yield* HttpServer.response.text('Missing redirect_url', {
        status: 400,
      });
    }

    const { verifier, challenge } = yield* createVerifierChallengePair;

    const EDGEDB_AUTH_BASE_URL = yield* Config.string('EDGEDB_AUTH_BASE_URL');

    const edgeDbRedirectUrl = new URL(`ui/${method}`, EDGEDB_AUTH_BASE_URL);
    edgeDbRedirectUrl.searchParams.set('challenge', challenge);

    return yield* HttpServer.response.empty().pipe(
      HttpServer.response.setStatus(307),
      HttpServer.response.setHeaders({
        Location: edgeDbRedirectUrl.href,
      }),
      HttpServer.response.setCookies([
        [
          REDIRECT_TO_COOKIE,
          redirectUrl,
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
    '/auth/signout',
    Effect.gen(function* () {
      const req = yield* HttpServer.request.ServerRequest;
      const baseUrl = yield* Config.string('BASE_URL');
      const url = req.url;
      const requestFullUrl = new URL(url, baseUrl);
      const redirectUrl = requestFullUrl.searchParams.get('redirect_url');

      if (!redirectUrl) {
        return yield* HttpServer.response.text('Missing redirect_url', {
          status: 400,
        });
      }

      const deletedTime = new Date(0);

      return yield* HttpServer.response.empty().pipe(
        HttpServer.response.setStatus(307),
        HttpServer.response.setHeaders({
          Location: redirectUrl,
        }),
        HttpServer.response.setCookie(EDGEDB_AUTH_TOKEN_COOKIE, 'DELETED', {
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          expires: deletedTime,
        }),
      );
    }),
  ),
  HttpServer.router.get(
    '/auth/callback',
    Effect.gen(function* () {
      const req = yield* HttpServer.request.ServerRequest;
      const BASE_URL = yield* Config.string('BASE_URL');
      const requestUrl = new URL(req.url, BASE_URL);
      const requestParams = requestUrl.searchParams;

      const code = requestParams.get('code');
      if (!code) {
        const error = requestParams.get('error');

        return HttpServer.response.text(
          `OAuth callback is missing 'code'. OAuth provider responded with error: ${error}`,
          { status: 400 },
        );
      }

      const cookies = req.cookies;
      const verifier = cookies[EDGEDB_PKCE_VERIFIER_COOKIE];
      const returnTo = cookies[REDIRECT_TO_COOKIE];

      if (!verifier) {
        return HttpServer.response.text(
          `Could not find 'verifier' in the cookie store. Is this the same user agent/browser that started the authorization flow?`,
          { status: 400 },
        );
      }

      const rawProvider = requestParams.get('provider');

      const maybeProvider = Schema.decodeUnknownOption(OAuthProviderSchema)(
        rawProvider ?? '',
      );

      if (maybeProvider.pipe(Option.isNone)) {
        return HttpServer.response.text(
          `OAuth callback is missing 'provider'.`,
          { status: 500 },
        );
      }

      const provider = yield* maybeProvider;

      const EDGEDB_AUTH_BASE_URL = yield* Config.string('EDGEDB_AUTH_BASE_URL');

      const codeExchangeUrl = new URL('token', EDGEDB_AUTH_BASE_URL);
      codeExchangeUrl.searchParams.set('code', code);
      codeExchangeUrl.searchParams.set('verifier', verifier);

      const request = HttpClient.request
        .get(codeExchangeUrl.href)
        .pipe(
          HttpClient.client.fetch,
          Effect.andThen(
            HttpClient.response.schemaBodyJson(EdgedbAuthResponseSchema),
          ),
          Effect.scoped,
        );

      const response = yield* request;

      if (!response.provider_token) {
        return HttpServer.response.text(
          `OAuth provider did not return a provider token.`,
          { status: 500 },
        );
      }

      const signedUp = requestParams.get('signed_up') === 'true';

      if (signedUp) {
        let user: { email: string; name: string } = {
          email: '',
          name: 'default',
        };
        if (provider === OAuthProvider.github) {
          const request = HttpClient.request
            .get(`https://api.github.com/user`)
            .pipe(
              HttpClient.request.setHeader(
                'Authorization',
                `token ${response.provider_token}`,
              ),
              HttpClient.client.fetch,
              Effect.andThen(
                HttpClient.response.schemaBodyJson(GithubUserSchema),
              ),
              Effect.scoped,
            );

          const { email } = yield* request;

          user.email = email;

          yield* Console.log('GITHUB PROVIDER', { email });
        } else if (provider === OAuthProvider.google) {
          const request = HttpClient.request
            .get(`https://www.googleapis.com/oauth2/v1/userinfo`)
            .pipe(
              HttpClient.request.setHeader(
                'Authorization',
                `Bearer ${response.provider_token}`,
              ),
              HttpClient.client.fetch,
              Effect.andThen(
                HttpClient.response.schemaBodyJson(GoogleUserSchema),
              ),
              Effect.scoped,
            );

          const { email, name } = yield* request;

          user.email = email;
          user.name = name;

          yield* Console.log('GOOGLE PROVIDER', { email, name });
        }
        yield* Effect.tryPromise({
          async try() {
            const client = createClient();

            return await client.query(
              `
              with identity := (select ext::auth::Identity filter .id = <uuid>$identity_id),
              insert User {
                identity := identity,
                name := <str>$name,
                email := <str>$email,
              } unless conflict on .identity`,
              {
                identity_id: response.identity_id,
                name: user.name,
                email: user.email,
              },
            );
          },
          catch(e) {
            console.log(e);
            return null;
          },
        });
      }

      const inOneMinute = addMinutes(constructNow(Date.now()), 1);
      const deletedTime = new Date(0);

      return yield* HttpServer.response.empty().pipe(
        HttpServer.response.setStatus(301),
        HttpServer.response.setHeader('Location', returnTo ?? BASE_URL),
        HttpServer.response.setCookies([
          [
            EDGEDB_PKCE_VERIFIER_COOKIE,
            'DELETED',
            {
              httpOnly: true,
              path: '/',
              sameSite: 'lax',
              expires: deletedTime,
            },
          ],
          [
            REDIRECT_TO_COOKIE,
            'DELETED',
            {
              httpOnly: true,
              path: '/',
              sameSite: 'lax',
              expires: deletedTime,
            },
          ],
          [
            EDGEDB_AUTH_TOKEN_COOKIE,
            response.auth_token,
            {
              httpOnly: true,
              path: '/',
              sameSite: 'lax',
              expires: inOneMinute,
            },
          ],
        ]),
      );
    }),
  ),
);
