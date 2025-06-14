import { round } from 'curvy/utils'
import { Array as Arr, Effect, HashMap, Option, Order } from 'effect'
import { Gamut } from '../gamut.ts'

export const peak = Effect.fn(function* (hue: number) {
	const gamut = yield* Gamut
	const slice = gamut.filter((entry) => entry.hue === hue)
})

export const printPeaks = Effect.fn(function* () {
	const data = yield* Gamut

	const peaks = HashMap.empty<
		number,
		{ readonly lightness: number; readonly chroma: number }
	>().pipe(HashMap.beginMutation)

	for (const entry of data) {
		peaks.pipe(
			HashMap.modifyAt(
				entry.hue,
				Option.match({
					onNone: () =>
						Option.some({ lightness: entry.lightness, chroma: entry.chroma }),
					onSome: (existing) =>
						Option.some(
							entry.chroma > existing.chroma
								? { lightness: entry.lightness, chroma: entry.chroma }
								: existing,
						),
				}),
			),
		)
	}

	console.log(
		peaks.pipe(
			HashMap.toEntries,
			Arr.sort(
				Order.mapInput(
					Order.number,
					([hue]: [number, { lightness: number; chroma: number }]) => hue,
				),
			),
			Arr.map(
				([hue, { lightness, chroma }]) =>
					`(${round(hue / 360)},${lightness},${chroma})`,
			),
			Arr.chunksOf(800),
			Arr.map((chunk) => chunk.join(', ')),
			Arr.join('\n\n'),
		),
	)
})
