import { Path } from '@effect/platform'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import { Effect } from 'effect'

const program = Effect.gen(function* () {
	// Access the Path service
	const path = yield* Path.Path

	// Join parts of a path to create a complete file path
	const mypath = path.join('tmp', 'file.txt')

	yield* Effect.log(mypath)
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
