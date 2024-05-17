import { HttpServer } from '@effect/platform';
import { Effect } from 'effect';
import { statusCodes } from '../utils/response';

import { Schema } from '@effect/schema';
import e from '../../dbschema/edgeql-js';
import { getUserFromRequest } from '../utils/request';
import { edgedbClient } from '../edgedb.ts/client';

const createOrganizationSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  logoUrl: Schema.optional(Schema.String),
  usersToInvite: Schema.Array(Schema.String),
});

class CreateOrganizationError extends Error {
  _tag = 'CreateOrganizationError';
}

export const OrganizationsRouter = HttpServer.router.empty.pipe(
  HttpServer.router.post(
    '/',
    Effect.gen(function* () {
      const user = yield* getUserFromRequest;

      if (user === 'unauthorized') {
        return yield* HttpServer.response.text('Unauthorized', {
          status: statusCodes.UNAUTHORIZED,
        });
      }

      const client = yield* edgedbClient;

      const body = yield* HttpServer.request.schemaBodyJson(
        createOrganizationSchema,
      );

      const createOrganization = yield* Effect.tryPromise({
        async try() {
          const createdOrganization = await client.transaction(async (tx) => {
            const userOrganizations = e
              .select(e.User, (localUser) => ({
                filter: e.op(localUser.id, '=', e.uuid(user.id)),
                organizations: (org) => ({
                  filter: e.op(org.role, '=', e.OrganizationRole.admin),
                }),
                org_leng: e.count(localUser.organizations),
              }))
              .assert_single();
            const result = await userOrganizations.run(tx);

            if (!result) {
              throw new CreateOrganizationError('User not found');
            }

            if (result.org_leng !== 0) {
              throw new CreateOrganizationError(
                'User already has an organization',
              );
            }

            const createOrganization = e.insert(e.Organization, {
              name: body.name,
              description: body.description,
              logoUrl: body.logoUrl,
            });
            const createdOrganization = await createOrganization.run(tx);

            const organization = e
              .select(e.Organization, (org) => ({
                id: true,
                name: true,
                description: true,
                filter: e.op(org.id, '=', e.uuid(createdOrganization.id)),
              }))
              .assert_single();

            const adminInsertQuery = e.insert(e.UserInOrganization, {
              organization,
              user: e
                .select(e.User, (userLocal) => ({
                  filter: e.op(userLocal.id, '=', e.uuid(user.id)),
                }))
                .assert_single(),
              role: e.OrganizationRole.admin,
            });

            await adminInsertQuery.run(tx);
            const fullCreatedOrganization = await organization.run(tx);

            const query = e.params(
              { usersEmails: e.array(e.str) },
              (params) => {
                return e.for(
                  e.array_unpack(params.usersEmails),
                  (userEmail) => {
                    return e.insert(e.Invitation, {
                      organization,
                      email: userEmail,
                      expiresAt: e.op(
                        e.datetime_current(),
                        '+',
                        e.duration('1 minute'),
                      ),
                    });
                  },
                );
              },
            );
            await query.run(tx, { usersEmails: body.usersToInvite });

            return fullCreatedOrganization;
          });

          return createdOrganization;
        },
        catch(error) {
          return new CreateOrganizationError("Couldn't create organization", {
            cause: error,
          });
        },
      });

      return yield* HttpServer.response.json(createOrganization, {
        status: statusCodes.CREATED,
      });
    }).pipe(Effect.scoped),
  ),
  HttpServer.router.prefixAll('/organizations'),
);
