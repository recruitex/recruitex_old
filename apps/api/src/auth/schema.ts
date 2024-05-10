import { Schema } from '@effect/schema';

export const EdgedbAuthResponse = Schema.Struct({
  auth_token: Schema.String,
});
