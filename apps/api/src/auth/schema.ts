import { Schema } from '@effect/schema';

export const EdgedbAuthResponseSchema = Schema.Struct({
  auth_token: Schema.String,
  identity_id: Schema.String,
  provider_token: Schema.optional(Schema.String),
});

export const GithubUserSchema = Schema.Struct({
  email: Schema.String,
});

export const GoogleUserSchema = Schema.Struct({
  email: Schema.String,
  name: Schema.String,
});

export enum OAuthProvider {
  google = 'builtin::oauth_google',
  github = 'builtin::oauth_github',
}

export const OAuthProviderSchema = Schema.Enums(OAuthProvider);
