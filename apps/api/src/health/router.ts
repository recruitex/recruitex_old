import { HttpRouter, HttpServerResponse } from '@effect/platform';
import { HttpServerRequest } from '@effect/platform/HttpServerRequest';
import { Effect } from 'effect';

export const HealthRouter = HttpRouter.empty.pipe(
  HttpRouter.get(
    '/health',
    Effect.map(HttpServerRequest, () =>
      HttpServerResponse.empty({ status: 204 }),
    ),
  ),
);
