import { HttpClient } from '@effect/platform';
import { Effect, Config } from 'effect';
import { EdgedbAuthResponseSchema } from './schema';
import e, { createClient } from '../../dbschema/edgeql-js';

export class CreateUserError extends Error {
  _tag = 'CreateUserError';
}

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

    return yield* HttpClient.request
      .get(codeExchangeUrl.href)
      .pipe(
        HttpClient.client.fetch,
        Effect.andThen(
          HttpClient.response.schemaBodyJson(EdgedbAuthResponseSchema),
        ),
        Effect.scoped,
      );
  });

export const createUser = (user: {
  name: string | null | undefined;
  email: string | null | undefined;
  identity_id: string;
}) =>
  Effect.tryPromise({
    async try() {
      const client = createClient();

      const identity = e
        .select(e.ext.auth.Identity, (identity) => ({
          filter: e.op(identity.id, '=', e.uuid(user.identity_id)),
        }))
        .assert_single();

      const insertQuery = e
        .insert(e.User, {
          name: user.name,
          email: user.email,
          identity,
        })
        .unlessConflict((user) => ({
          on: user.identity,
        }));

      return await insertQuery.run(client);
    },
    catch(error) {
      return new CreateUserError('Failed to create user.', { cause: error });
    },
  });
