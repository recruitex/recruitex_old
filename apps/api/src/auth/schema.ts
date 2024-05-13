import { Schema } from '@effect/schema';

export const EdgedbAuthResponseSchema = Schema.Struct({
  auth_token: Schema.String,
  identity_id: Schema.String,
  provider_token: Schema.optional(Schema.String),
});

export const GithubUserSchema = Schema.Struct({
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  login: Schema.String,
});

export const GoogleUserSchema = Schema.Struct({
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
});

export enum OAuthProvider {
  Google = 'builtin::oauth_google',
  GitHub = 'builtin::oauth_github',
}

export const OAuthProviderSchema = Schema.Enums(OAuthProvider);
