import { Config, Effect } from 'effect';
import { HttpServer } from '@effect/platform';

export const requestFullUrl = Effect.gen(function* () {
  const req = yield* HttpServer.request.ServerRequest;
  const baseUrl = yield* Config.string('BASE_URL');
  const url = req.url;
  return new URL(url, baseUrl);
});
