import { Console, Context, Effect, Layer, PubSub } from 'effect';
import { BunRuntime } from '@effect/platform-bun';

const pubSub = PubSub.unbounded<string>();

class SomePubSub extends Context.Tag('SomePubSub')<
  SomePubSub,
  PubSub.PubSub<string>
>() {}

const SomePubSubLive = Layer.effect(SomePubSub, pubSub);

const worker = Effect.gen(function* () {
  const pubsub = yield* SomePubSub;
  const dequeue = yield* pubsub.subscribe;

  yield* dequeue.take.pipe(Effect.andThen(Console.log), Effect.forever);
}).pipe(Effect.scoped);

const producer = Effect.gen(function* () {
  const pubsub = yield* SomePubSub;
  yield* pubsub.publish('user1');
  yield* pubsub.publish('user2');
  yield* pubsub.publish('user3');
  yield* pubsub.publish('user4');
});

try {
  Effect.runFork(
    Effect.gen(function* () {
      yield* Effect.forkDaemon(worker);
      yield* Effect.yieldNow();
      yield* producer;
    }).pipe(Effect.provide(SomePubSubLive)),
  );
  console.log('done');
} catch (e) {
  console.error(e);
}
