import { Effect } from 'effect';
import { OAuthProvider } from './schema';
import { google } from 'googleapis';
import { Octokit } from 'octokit';
import { assertUnreachable } from '../utils/assert';

export class OAuthError extends Error {
  _tag = 'OAuthError';
}

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