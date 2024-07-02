import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform';
import { Effect } from 'effect';
import { statusCodes } from '#/utils/response';
import { EdgedbAuthClientLive } from '#/edgedb/client';
import { createOrganizationSchema } from '#/organizations/schema';
import { createOrganization } from './db';

export const OrganizationsRouter = HttpRouter.empty.pipe(
  HttpRouter.post('/', createOrganizationHandler()),
  HttpRouter.prefixAll('/organizations'),
);

function createOrganizationHandler() {
  return Effect.gen(function* () {
    const body = yield* HttpServerRequest.schemaBodyJson(
      createOrganizationSchema,
    );

    const createdOrganization = yield* createOrganization(body);

    return yield* HttpServerResponse.json(createdOrganization, {
      status: statusCodes.CREATED,
    });
  }).pipe(Effect.provide(EdgedbAuthClientLive), Effect.scoped);
}
