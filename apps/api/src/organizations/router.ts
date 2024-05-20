import { HttpServer } from '@effect/platform';
import { Effect } from 'effect';
import { statusCodes } from '#/utils/response';
import { EdgedbAuthClientLive } from '#/edgedb/client';
import { createOrganizationSchema } from '#/organizations/schema';
import { createOrganization } from './db';

export const OrganizationsRouter = HttpServer.router.empty.pipe(
  HttpServer.router.post('/', createOrganizationHandler()),
  HttpServer.router.prefixAll('/organizations'),
);

function createOrganizationHandler() {
  return Effect.gen(function* () {
    const body = yield* HttpServer.request.schemaBodyJson(
      createOrganizationSchema,
    );

    const createdOrganization = yield* createOrganization(body);

    return yield* HttpServer.response.json(createdOrganization, {
      status: statusCodes.CREATED,
    });
  }).pipe(Effect.provide(EdgedbAuthClientLive), Effect.scoped);
}
