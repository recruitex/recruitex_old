import { Config, Context, Effect, Layer } from 'effect';
import { createTransport, type Transporter } from 'nodemailer';

export class NodemailerClient extends Context.Tag('NodemailerClient')<
  NodemailerClient,
  Transporter
>() {}

const localNodemailer = Effect.gen(function* () {
  const port = yield* Config.number('SMTP_PORT');
  const host = yield* Config.string('SMTP_HOST');

  const transporter = createTransport({
    port,
    host,
    secure: false,
    tls: {
      rejectUnauthorized: false,
    },
  });

  return transporter;
});

export const NodemailerClientTest = Layer.effect(
  NodemailerClient,
  localNodemailer,
);
