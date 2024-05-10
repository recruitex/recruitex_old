import { Config, Effect, Layer, LogLevel, Logger } from 'effect';

export const LogLevelLive = Config.logLevel('LOG_LEVEL').pipe(
  Config.withDefault(LogLevel.Info),
  Effect.andThen((level) => Logger.minimumLogLevel(level)),
  Layer.unwrapEffect,
);
