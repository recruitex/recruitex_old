import { Config, Effect } from 'effect';
import { EdgedbAuthResponseSchema, OAuthProvider } from '#/auth/schema';
import { google } from 'googleapis';
import { Octokit } from 'octokit';
import { assertUnreachable } from '#/utils/assert';
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from '@effect/platform';
import { createTaggedError } from '#/utils/error';

export const OAuthError = createTaggedError('OAuthError');

export const getTokenResponse = ({
  code,
  verifier,
}: {
  code: string;
  verifier: string;
}) =>
  Effect.gen(function* () {
    const EDGEDB_AUTH_BASE_URL = yield* Config.string('EDGEDB_AUTH_BASE_URL');
    const codeExchangeUrl = new URL('token', EDGEDB_AUTH_BASE_URL);
    codeExchangeUrl.searchParams.set('code', code);
    codeExchangeUrl.searchParams.set('verifier', verifier);

    return yield* HttpClientRequest.get(codeExchangeUrl.href).pipe(
      HttpClient.fetch,
      Effect.andThen(
        HttpClientResponse.schemaBodyJson(EdgedbAuthResponseSchema),
      ),
      Effect.scoped,
    );
  });

export const getUserFromOauth = ({
  provider,
  providerToken,
}: {
  provider: OAuthProvider;
  providerToken: string;
}) =>
  Effect.gen(function* () {
    if (provider === OAuthProvider.GitHub) {
      return yield* Effect.tryPromise({
        async try() {
          const octokit = new Octokit({ auth: providerToken });

          const user = await octokit.rest.users.getAuthenticated({});

          return {
            email: user.data.email,
            name: user.data.name ?? user.data.login,
          };
        },
        catch(error) {
          return new OAuthError("Couldn't get user info from GitHub.", {
            cause: error,
          });
        },
      });
    } else if (provider === OAuthProvider.Google) {
      return yield* Effect.tryPromise({
        async try(signal) {
          const googleReponse = await google.oauth2('v2').userinfo.get(
            {
              oauth_token: providerToken,
            },
            { signal },
          );
          return {
            name: googleReponse.data.name,
            email: googleReponse.data.email,
          };
        },
        catch(error) {
          return new OAuthError("Couldn't get user info from Google.", {
            cause: error,
          });
        },
      });
    }

    return assertUnreachable(provider);
  });
