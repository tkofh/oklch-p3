import { BunContext, BunRuntime } from '@effect/platform-bun'
import { Effect } from 'effect'
import { program } from './program'
import { CacheStorage } from './storage.ts'

BunRuntime.runMain(
	program.pipe(
		Effect.provide(CacheStorage.Default),
		Effect.provide(BunContext.layer),
	),
)
