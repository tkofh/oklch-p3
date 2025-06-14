import { round } from 'curvy/utils'
import { Chunk, Effect, Stream } from 'effect'
import { type DataPoint, polynomial } from 'regression'
import { slice } from './gamut/slice'

export const program = Effect.fn('program')(function* () {
	const r2Vals: number[] = []
	yield* Stream.range(0, 359).pipe(
		Stream.runForEach(
			Effect.fn(function* (hue) {
				const hueSlice = yield* slice('hue', hue)

				const base = hueSlice.find((v) => v.lightness === 0.05)
				if (!base) {
					throw new Error('missing')
				}

				const peak = hueSlice.reduce((max, current) =>
					max.chroma > current.chroma ? max : current,
				)

				const { points: _, ...result } = polynomial(
					Chunk.toReadonlyArray(
						yield* Stream.fromIterable(hueSlice).pipe(
							Stream.filter(
								(v) =>
									v.lightness >= base.lightness &&
									v.lightness <= peak.lightness,
							),
							Stream.map((v) => [v.lightness, v.chroma] as DataPoint),
							Stream.runCollect,
						),
					),
					{ precision: 8, order: 4 },
				)

				r2Vals.push(result.r2)

				yield* Effect.log(`Hue: ${hue}, ${result.string} (r2: ${result.r2})`)
			}),
		),
	)

	yield* Effect.log(
		`Average r2: ${round(r2Vals.reduce((a, b) => a + b, 0) / r2Vals.length, 8)}`,
	)
})()

// order 1 = 0.99999746
// order 2 = 0.99999862
// order 3 = 0.99999931
// order 4 = 0.99999967
