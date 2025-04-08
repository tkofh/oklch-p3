import { round } from 'curvy/utils'
import { Effect } from 'effect'
import { generateGamut } from './gamut.ts'
import { CacheStorage } from './storage.ts'

export const program = Effect.gen(function* () {
	const points = yield* generateGamut({
		subdivisions: 7,
		huePasses: 4,
		lightnessPasses: 2,
	})

	const cache = yield* CacheStorage

	const filtered = points.filter((point) => point.x <= 0.05)

	yield* Effect.log(filtered.length)

	yield* cache.set(
		'out',
		filtered
			.map((point) => `(${round(point.x, 4)}, ${round(point.y, 4)})`)
			.join(', '),
	)
})
