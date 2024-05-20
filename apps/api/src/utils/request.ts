import { Config, Effect } from 'effect';
import { HttpServer } from '@effect/platform';
import { EDGEDB_AUTH_TOKEN_COOKIE } from '#/auth/consts';
import e from '#db/edgeql-js';
import { EdgeDBAuthClient } from '#/edgedb/client';
import { createTaggedError } from '#/utils/error';

export const requestFullUrl = Effect.gen(function* () {
  const req = yield* HttpServer.request.ServerRequest;
  const baseUrl = yield* Config.string('BASE_URL');
  const url = req.url;
  return new URL(url, baseUrl);
});

export const Unauthorized = createTaggedError('UnauthorizedError');

export const getTokenFromRequest = Effect.gen(function* () {
  const req = yield* HttpServer.request.ServerRequest;

  const token = req.cookies[EDGEDB_AUTH_TOKEN_COOKIE];

  if (!token) {
    return yield* Effect.fail(new Unauthorized('No token found in request!'));
  }

  return token;
});

export const getUserFromRequest = Effect.gen(function* () {
  const client = yield* EdgeDBAuthClient;

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
    catch(error) {
      return new Unauthorized('No user found for given token!', {
        cause: error,
      });
    },
  });

  if (!user) {
    return yield* Effect.fail(new Unauthorized('User not found!'));
  }

  return user;
});
