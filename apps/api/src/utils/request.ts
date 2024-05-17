import { Config, Effect } from 'effect';
import { HttpServer } from '@effect/platform';
import { EDGEDB_AUTH_TOKEN_COOKIE } from '../auth/consts';
import e, { createClient } from '../../dbschema/edgeql-js';

export const requestFullUrl = Effect.gen(function* () {
  const req = yield* HttpServer.request.ServerRequest;
  const baseUrl = yield* Config.string('BASE_URL');
  const url = req.url;
  return new URL(url, baseUrl);
});

export const getUserFromRequest = Effect.gen(function* () {
  const req = yield* HttpServer.request.ServerRequest;

  const token = req.cookies[EDGEDB_AUTH_TOKEN_COOKIE];

  if (!token) {
    return 'unauthorized';
  }

  const client = createClient().withGlobals({
    'ext::auth::client_token': token,
  });

  const userQuery = e
    .select(e.User, (user) => ({
      id: true,
      name: true,
      email: true,
      filter: e.op(user.identity, '=', e.ext.auth.global.ClientTokenIdentity),
    }))
    .assert_single();

  const user = yield* Effect.tryPromise({
    async try() {
      return await userQuery.run(client);
    },
    catch() {
      return null;
    },
  });

  if (!user) {
    return 'unauthorized';
  }

  return user;
});
