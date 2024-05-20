import { EdgeDBAuthClient } from '#/edgedb/client';
import e from '#db/edgeql-js';
import { Effect } from 'effect';
import type { CreateOrganization } from '#/organizations/schema';
import { CreateOrganizationError } from '#/organizations/errors';

export const createOrganization = (body: CreateOrganization) =>
  Effect.gen(function* () {
    const client = yield* EdgeDBAuthClient;

    return yield* Effect.tryPromise({
      async try() {
        const createdOrganization = await client.transaction(async (tx) => {
          const userOrganizationsQuery = e
            .select(e.User, (localUser) => ({
              filter: e.op(localUser.id, '=', e.global.current_user.id),
              organizations: (org) => ({
                filter: e.op(org.role, '=', e.OrganizationRole.admin),
              }),
              org_leng: e.count(localUser.organizations),
            }))
            .assert_single();
          const result = await userOrganizationsQuery.run(tx);

          if (!result) {
            throw new CreateOrganizationError('User not found!');
          }

          if (result.org_leng !== 0) {
            throw new CreateOrganizationError(
              'User already has created an organization',
            );
          }

          const createOrganizationQuery = e.insert(e.Organization, {
            name: body.name,
            description: body.description,
            logoUrl: body.logoUrl,
          });
          const createdOrganization = await createOrganizationQuery.run(tx);

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
                filter: e.op(userLocal.id, '=', e.global.current_user.id),
              }))
              .assert_single(),
            role: e.OrganizationRole.admin,
          });

          await adminInsertQuery.run(tx);

          const fullCreatedOrganization = await organization.run(tx);

          const insertInvitationsQuery = e.for(
            e.set(...body.usersToInvite),
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
          await insertInvitationsQuery.run(tx);

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
  });
