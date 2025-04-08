import { remap, round } from 'curvy/utils'
import { Effect } from 'effect'
import { generateGamut } from './gamut.ts'
import { CacheStorage } from './storage.ts'

export const program = Effect.gen(function* () {
	const points = yield* generateGamut({
		subdivisions: 5,
		huePasses: 1,
		lightnessPasses: 1,
	})

	const cache = yield* CacheStorage

	const transformed = points.map(
		(point) =>
			`(${round(remap(point.x, 0, 1, -1, 1), 3)}, ${round(remap(point.y, 0, 1, -1, 1), 3)}, ${round(remap(point.z, 0, 1, 0, 1), 3)})`,
	)

	const segments: Array<string> = []
	while (transformed.length > 0) {
		const segment = transformed.splice(0, 800)
		segments.push(segment.join(', '))
	}

	yield* cache.set('out', segments.join('\n\n'))
})
