import { Config, Effect, Option } from 'effect';
import { HttpServer } from '@effect/platform';
import { createVerifierChallengePair } from './crypto';
import {
  EDGEDB_AUTH_TOKEN_COOKIE,
  EDGEDB_PKCE_VERIFIER_COOKIE,
  REDIRECT_TO_COOKIE,
} from './consts';
import { OAuthProviderSchema } from './schema';
import { Schema } from '@effect/schema';
import { addMinutes, constructNow } from 'date-fns';
import { requestFullUrl } from '../utils/request';
import { deleteCookie, deleteCookies, statusCodes } from '../utils/response';
import { createUser, getTokenResponse } from './edgedb';
import { getUserFromOauth } from './oauth';

export const AuthRouter = HttpServer.router.empty.pipe(
  HttpServer.router.get('/auth/ui/signin', handleAuthUi('signin')),
  HttpServer.router.get('/auth/ui/signup', handleAuthUi('signup')),
  HttpServer.router.get('/auth/signout', handleSignout()),
  HttpServer.router.get('/auth/callback', handleCallback()),
);

function handleAuthUi(method: 'signin' | 'signup') {
  return Effect.gen(function* () {
    const fullUrl = yield* requestFullUrl;
    const redirectUrl = fullUrl.searchParams.get('redirect_url');

    if (!redirectUrl) {
      return yield* HttpServer.response.text('Missing redirect_url', {
        status: statusCodes.BAD_REQUEST,
      });
    }

    const { verifier, challenge } = yield* createVerifierChallengePair;

    const EDGEDB_AUTH_BASE_URL = yield* Config.string('EDGEDB_AUTH_BASE_URL');
    const edgeDbRedirectUrl = new URL(`ui/${method}`, EDGEDB_AUTH_BASE_URL);
    edgeDbRedirectUrl.searchParams.set('challenge', challenge);

    return yield* HttpServer.response.empty().pipe(
      HttpServer.response.setStatus(statusCodes.TEMPORARY_REDIRECT),
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
}

function handleSignout() {
  return Effect.gen(function* () {
    const fullUrl = yield* requestFullUrl;
    const redirectUrl = fullUrl.searchParams.get('redirect_url');

    if (!redirectUrl) {
      return yield* HttpServer.response.text('Missing redirect_url', {
        status: 400,
      });
    }

    return yield* HttpServer.response.empty().pipe(
      HttpServer.response.setStatus(statusCodes.TEMPORARY_REDIRECT),
      HttpServer.response.setHeaders({
        Location: redirectUrl,
      }),
      deleteCookie(EDGEDB_AUTH_TOKEN_COOKIE, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
      }),
    );
  });
}

function handleCallback() {
  return Effect.gen(function* () {
    const req = yield* HttpServer.request.ServerRequest;
    const fullUrl = yield* requestFullUrl;
    const requestParams = fullUrl.searchParams;

    const code = requestParams.get('code');
    if (!code) {
      const error = requestParams.get('error');

      return HttpServer.response.text(
        `OAuth callback is missing 'code'. OAuth provider responded with error: ${error}`,
        { status: statusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    const cookies = req.cookies;
    const verifier = cookies[EDGEDB_PKCE_VERIFIER_COOKIE];
    const redirectTo = cookies[REDIRECT_TO_COOKIE];

    if (!verifier) {
      return HttpServer.response.text(
        `Could not find 'verifier' in the cookie store. Is this the same user agent/browser that started the authorization flow?`,
        { status: statusCodes.BAD_REQUEST },
      );
    }

    const rawProvider = requestParams.get('provider');
    const maybeProvider = Schema.decodeUnknownOption(OAuthProviderSchema)(
      rawProvider ?? '',
    );

    if (maybeProvider.pipe(Option.isNone)) {
      return HttpServer.response.text(
        `OAuth callback is missing 'provider' or it is incorrect.`,
        {
          status: statusCodes.INTERNAL_SERVER_ERROR,
        },
      );
    }

    const provider = yield* maybeProvider;
    const response = yield* getTokenResponse({ code, verifier });

    if (!response.provider_token) {
      return HttpServer.response.text(
        `OAuth provider did not return a provider token.`,
        { status: statusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    const signedUp = requestParams.get('signed_up') === 'true';

    if (signedUp) {
      const user = yield* getUserFromOauth({
        provider,
        providerToken: response.provider_token,
      });

      yield* createUser({ ...user, identity_id: response.identity_id });
    }

    const inOneMinute = addMinutes(constructNow(Date.now()), 1);
    const frontBaseUrl = yield* Config.string('FRONT_BASE_URL');

    return yield* HttpServer.response.empty().pipe(
      HttpServer.response.setStatus(statusCodes.MOVED_PERMANENTLY),
      HttpServer.response.setHeader('Location', redirectTo ?? frontBaseUrl),
      deleteCookies([
        [
          EDGEDB_PKCE_VERIFIER_COOKIE,
          {
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
          },
        ],
        [
          REDIRECT_TO_COOKIE,
          {
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
          },
        ],
      ]),
      Effect.andThen(
        HttpServer.response.setCookies([
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
      ),
    );
  });
}
