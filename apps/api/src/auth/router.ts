import { Config, Effect, Option } from 'effect';
import {
  HttpRouter,
  HttpServerResponse,
  HttpServerRequest,
} from '@effect/platform';
import { createVerifierChallengePair } from '#/auth/crypto';
import {
  EDGEDB_AUTH_TOKEN_COOKIE,
  EDGEDB_PKCE_VERIFIER_COOKIE,
  REDIRECT_TO_COOKIE,
} from './consts';
import {
  InitEmailVerificationSchema,
  OAuthProviderSchema,
} from '#/auth/schema';
import { Schema } from '@effect/schema';
import { addMinutes, constructNow } from 'date-fns';
import { requestFullUrl } from '#/utils/request';
import { deleteCookie, deleteCookies, statusCodes } from '#/utils/response';
import { createUser, initVerifyEmail, verifyEmail } from '#/auth/db';
import { getTokenResponse, getUserFromOauth } from '#/auth/oauth';
import { EdgedbAuthClientLive, EdgedbClientLive } from '#/edgedb/client';
import { NodemailerClientTest } from '#/emails/nodemailer';

export const AuthRouter = HttpRouter.empty.pipe(
  HttpRouter.get('/ui/signin', handleAuthUi('signin')),
  HttpRouter.get('/ui/signup', handleAuthUi('signup')),
  HttpRouter.get('/signout', handleSignout()),
  HttpRouter.get(
    '/callback',
    handleCallback().pipe(
      Effect.catchTag('CreateUserError', (error) => {
        return Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const cookies = request.cookies;
          const redirectTo = cookies[REDIRECT_TO_COOKIE];
          const frontUrl = yield* Config.string('FRONT_BASE_URL');

          const response = yield* HttpServerResponse.empty().pipe(
            HttpServerResponse.setStatus(statusCodes.MOVED_PERMANENTLY),
            HttpServerResponse.setHeaders({
              Location: `${redirectTo ?? frontUrl}?error=${error.message}`,
            }),
          );

          return response;
        });
      }),
      Effect.provide(EdgedbClientLive),
      Effect.scoped,
    ),
  ),
  HttpRouter.post(
    '/profile/email',
    handleProfileEmailVerificationInit().pipe(
      Effect.provide(EdgedbAuthClientLive),
      Effect.provide(NodemailerClientTest),
      Effect.scoped,
    ),
  ),
  HttpRouter.get(
    '/profile/email',
    handleProfileEmailVerification().pipe(
      Effect.provide(EdgedbAuthClientLive),
      Effect.scoped,
    ),
  ),
  HttpRouter.prefixAll('/auth'),
);

function handleAuthUi(method: 'signin' | 'signup') {
  return Effect.gen(function* () {
    const fullUrl = yield* requestFullUrl;
    const redirectUrl = fullUrl.searchParams.get('redirect_url');

    if (!redirectUrl) {
      return yield* HttpServerResponse.text('Missing redirect_url', {
        status: statusCodes.BAD_REQUEST,
      });
    }

    const { verifier, challenge } = yield* createVerifierChallengePair;

    const EDGEDB_AUTH_BASE_URL = yield* Config.string('EDGEDB_AUTH_BASE_URL');
    const edgeDbRedirectUrl = new URL(`ui/${method}`, EDGEDB_AUTH_BASE_URL);
    edgeDbRedirectUrl.searchParams.set('challenge', challenge);

    return yield* HttpServerResponse.empty().pipe(
      HttpServerResponse.setStatus(statusCodes.TEMPORARY_REDIRECT),
      HttpServerResponse.setHeaders({
        Location: edgeDbRedirectUrl.href,
      }),
      HttpServerResponse.setCookies([
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
      return yield* HttpServerResponse.text('Missing redirect_url', {
        status: 400,
      });
    }

    return yield* HttpServerResponse.empty().pipe(
      HttpServerResponse.setStatus(statusCodes.TEMPORARY_REDIRECT),
      HttpServerResponse.setHeaders({
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
    const req = yield* HttpServerRequest.HttpServerRequest;
    const fullUrl = yield* requestFullUrl;
    const requestParams = fullUrl.searchParams;

    const code = requestParams.get('code');
    if (!code) {
      const error = requestParams.get('error');

      return HttpServerResponse.text(
        `OAuth callback is missing 'code'. OAuth provider responded with error: ${error}`,
        { status: statusCodes.INTERNAL_SERVER_ERROR },
      );
    }

    const cookies = req.cookies;
    const verifier = cookies[EDGEDB_PKCE_VERIFIER_COOKIE];
    const redirectTo = cookies[REDIRECT_TO_COOKIE];

    if (!verifier) {
      return HttpServerResponse.text(
        `Could not find 'verifier' in the cookie store. Is this the same user agent/browser that started the authorization flow?`,
        { status: statusCodes.BAD_REQUEST },
      );
    }

    const rawProvider = requestParams.get('provider');
    const maybeProvider = Schema.decodeUnknownOption(OAuthProviderSchema)(
      rawProvider ?? '',
    );

    if (maybeProvider.pipe(Option.isNone)) {
      return HttpServerResponse.text(
        `OAuth callback is missing 'provider' or it is incorrect.`,
        {
          status: statusCodes.INTERNAL_SERVER_ERROR,
        },
      );
    }

    const provider = yield* maybeProvider;
    const response = yield* getTokenResponse({ code, verifier });

    if (!response.provider_token) {
      return HttpServerResponse.text(
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

    const inTenMinutes = addMinutes(constructNow(Date.now()), 10);
    const frontBaseUrl = yield* Config.string('FRONT_BASE_URL');

    return yield* HttpServerResponse.empty().pipe(
      HttpServerResponse.setStatus(statusCodes.MOVED_PERMANENTLY),
      HttpServerResponse.setHeader('Location', redirectTo ?? frontBaseUrl),
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
        HttpServerResponse.setCookies([
          [
            EDGEDB_AUTH_TOKEN_COOKIE,
            response.auth_token,
            {
              httpOnly: true,
              path: '/',
              sameSite: 'lax',
              expires: inTenMinutes,
            },
          ],
        ]),
      ),
    );
  });
}

function handleProfileEmailVerificationInit() {
  return Effect.gen(function* () {
    const body = yield* HttpServerRequest.schemaBodyJson(
      InitEmailVerificationSchema,
    );

    const updatedId = yield* initVerifyEmail(body);

    if (!updatedId) {
      return yield* HttpServerResponse.json(
        { message: 'Could init email verification!' },
        {
          status: statusCodes.INTERNAL_SERVER_ERROR,
        },
      );
    }

    return yield* HttpServerResponse.json(updatedId, {
      status: statusCodes.OK,
    });
  });
}

function handleProfileEmailVerification() {
  return Effect.gen(function* () {
    const url = yield* requestFullUrl;
    const verifier = url.searchParams.get('verifier');

    if (!verifier) {
      return yield* HttpServerResponse.json(
        { message: 'Could not find verifier in the query params!' },
        {
          status: statusCodes.BAD_REQUEST,
        },
      );
    }

    const updated = yield* verifyEmail(verifier);

    if (!updated) {
      return yield* HttpServerResponse.json(
        { message: 'Could not verify email!' },
        {
          status: statusCodes.INTERNAL_SERVER_ERROR,
        },
      );
    }

    return yield* HttpServerResponse.json(updated, {
      status: statusCodes.OK,
    });
  });
}
