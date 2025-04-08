import { FileSystem } from '@effect/platform/FileSystem'
import { KeyValueStore, layerFileSystem } from '@effect/platform/KeyValueStore'
import { Path } from '@effect/platform/Path'
import { Effect, Layer } from 'effect'

const findUp = Effect.fn(function* (search: string) {
	const path = yield* Path
	const fs = yield* FileSystem

	let location = path.resolve()
	while (true) {
		const exists = yield* fs.exists(path.join(location, search))

		if (exists) {
			break
		}

		const parent = path.dirname(location)

		if (parent === location) {
			throw new Error(`Could not find ${search} in any parent directory`)
		}

		location = parent
	}

	return path.join(location, search)
})

const cacheDir = Effect.fn(function* (partition: string) {
	const path = yield* Path

	const base = yield* findUp('node_modules')

	return path.join(base, '.cache', partition)
})

export class CacheStorage extends Effect.Service<CacheStorage>()(
	'CacheStorage',
	{
		effect: Effect.gen(function* () {
			return yield* KeyValueStore
		}).pipe(
			Effect.provide(
				cacheDir('computation').pipe(
					Effect.map(layerFileSystem),
					Layer.unwrapEffect,
				),
			),
		),
	},
) {}
