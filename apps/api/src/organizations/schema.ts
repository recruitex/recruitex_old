import { Schema } from '@effect/schema';

export const createOrganizationSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  logoUrl: Schema.optional(Schema.String),
  usersToInvite: Schema.Array(Schema.String),
});

export type CreateOrganization = typeof createOrganizationSchema.Type;
