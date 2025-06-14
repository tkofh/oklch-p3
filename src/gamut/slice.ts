import { round } from 'curvy/utils'
import { Array as Arr, Console, Effect, Order, pipe } from 'effect'
import { Gamut } from '../gamut'

export const slice = Effect.fn(function* (
	dimension: 'hue' | 'lightness' | 'chroma',
	value: number,
) {
	const data = yield* Gamut

	return data.filter((entry) => entry[dimension] === value)
})

export const printSlice = Effect.fn(function* <
	D extends 'hue' | 'lightness' | 'chroma',
>(
	dimension: D,
	value: number,
	orderBy: Exclude<'hue' | 'lightness' | 'chroma', D>,
) {
	const sliced = yield* slice(dimension, value)

	const yAxis = ['hue', 'lightness', 'chroma'].filter(
		(d) => d !== orderBy && d !== dimension,
	)[0] as 'hue' | 'lightness' | 'chroma'

	const orderByScale = orderBy === 'hue' ? 360 : 1

	yield* Console.log(
		pipe(
			sliced,
			Arr.sort(
				Order.mapInput(Order.number, (lch: Gamut.Point) => lch[orderBy]),
			),
			Arr.map(
				(lch) =>
					`(${round(lch[orderBy] / orderByScale, 5)},${round(lch[yAxis], 5)})`,
			),
			Arr.chunksOf(400),
			Arr.map((chunk) => chunk.join(', ')),
			Arr.join('\n\n'),
		),
	)
})
