import { Effect } from 'effect';
import e from '#db/edgeql-js';
import { EdgeDBAuthClient, EdgeDBClient } from '#/edgedb/client';
import { createTaggedError } from '#/utils/error';
import type { InitEmailVerification } from '#/auth/schema';
import {
  base64UrlToBytes,
  bytesToBase64Url,
  createVerifierChallengePair,
  sha256,
} from '#/auth/crypto';
import { NodemailerClient } from '#/emails/nodemailer';
import { timingSafeEqual } from 'node:crypto';

export const CreateUserError = createTaggedError('CreateUserError');
export const UpdateProfileError = createTaggedError('UpdateProfileError');

export const createUser = (user: {
  name: string | null | undefined;
  email: string | null | undefined;
  identity_id: string;
}) =>
  Effect.gen(function* () {
    const client = yield* EdgeDBClient;

    return yield* Effect.tryPromise({
      async try() {
        const identity = e
          .select(e.ext.auth.Identity, (identity) => ({
            filter: e.op(identity.id, '=', e.uuid(user.identity_id)),
          }))
          .assert_single();

        const insertQuery = e
          .insert(e.User, {
            name: user.name,
            email: user.email,
            emailVerified: Boolean(user.email),
            identity,
          })
          .unlessConflict();

        const inserted = await insertQuery.run(client);

        if (!inserted) {
          throw new CreateUserError('User already exists.');
        }

        return inserted;
      },
      catch(error) {
        return new CreateUserError('Failed to create user.', { cause: error });
      },
    });
  });

export const initVerifyEmail = (body: InitEmailVerification) =>
  Effect.gen(function* () {
    const client = yield* EdgeDBAuthClient;
    const mailer = yield* NodemailerClient;
    const { verifier, challenge } = yield* createVerifierChallengePair;

    const currentUser = e
      .select(e.User, (user) => ({
        email: true,
        emailVerified: true,
        emailVerificationChallengeDuplicate: true,
        filter: e.op(user.id, '=', e.global.current_user.id),
      }))
      .assert_single();

    const update = e
      .update(e.User, (user) => ({
        set: {
          email: e.str(body.email),
          emailVerificationChallengeDuplicate: e.str(challenge),
          emailVerification: e.insert(e.EmailVerification, {
            challenge: e.str(challenge),
            email: e.str(body.email),
            expiresAt: e.op(
              e.datetime_current(),
              '+',
              e.duration('86400 seconds'),
            ),
          }),
        },
        filter: e.op(user.id, '=', e.global.current_user.id),
      }))
      .assert_single();

    return yield* Effect.tryPromise({
      async try() {
        return client.transaction(async (tx) => {
          const user = await currentUser.run(tx);

          if (!user) {
            throw new UpdateProfileError('User not found.');
          }

          if (user.emailVerified) {
            throw new UpdateProfileError('Email is already set and verified.');
          }

          if (!user.emailVerified && user.emailVerificationChallengeDuplicate) {
            throw new UpdateProfileError(
              'Email verification is already in progress.',
            );
          }

          await mailer.sendMail({
            to: body.email,
            subject: 'Verify your email',
            text: `http://localhost:3001/auth/profile/email?verifier=${verifier}`,
            html: `<a href="http://localhost:3001/auth/profile/email?verifier=${verifier}">Verify your email</a>`,
          });

          return await update.run(tx);
        });
      },
      catch(error) {
        return new UpdateProfileError('Failed to update profile.', {
          cause: error,
        });
      },
    });
  });

export const verifyEmail = (verifier: string) =>
  Effect.gen(function* () {
    const authClient = yield* EdgeDBAuthClient;

    const currentUser = e
      .select(e.User, (user) => ({
        email: true,
        emailVerified: true,
        emailVerificationChallengeDuplicate: true,
        emailVerification: {
          challenge: true,
          expiresAt: true,
          email: true,
        },
        filter: e.op(user.id, '=', e.global.current_user.id),
      }))
      .assert_single();

    const isVerified = yield* Effect.tryPromise({
      async try() {
        const user = await currentUser.run(authClient);

        if (!user) {
          throw new UpdateProfileError('User not found.');
        }

        const verification = user.emailVerification;

        if (!verification) {
          throw new UpdateProfileError(
            'Email verification is not in progress.',
          );
        }

        const challenge = verification.challenge;
        const challenge2 = user.emailVerificationChallengeDuplicate;

        if (!challenge2 || challenge !== challenge2) {
          throw new UpdateProfileError(
            'Email verification challenge mismatch.',
          );
        }

        const calculatedChallenge = await sha256(verifier);

        return timingSafeEqual(
          base64UrlToBytes(challenge),
          calculatedChallenge,
        );
      },
      catch(error) {
        return new UpdateProfileError('Failed to update profile.', {
          cause: error,
        });
      },
    });

    if (!isVerified) {
      return yield* Effect.fail(new UpdateProfileError('Challenge mismatch.'));
    }

    const update = e
      .update(e.User, (user) => ({
        set: {
          emailVerification: e.set(),
          emailVerified: true,
          emailVerificationChallengeDuplicate: e.set(),
        },
        filter: e.op(user.id, '=', e.global.current_user.id),
      }))
      .assert_single();

    return yield* Effect.tryPromise({
      async try() {
        return update.run(authClient);
      },
      catch(error) {
        return new UpdateProfileError('Failed to update profile.', {
          cause: error,
        });
      },
    });
  });
