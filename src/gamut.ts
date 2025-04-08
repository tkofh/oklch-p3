import * as Interval from 'curvy/interval'
import { mod, normalize, round } from 'curvy/utils'
import * as Vector2 from 'curvy/vector2'
import * as Vector3 from 'curvy/vector3'
import { Data, Effect, Hash, Option, Schema } from 'effect'
import { generateSphere } from './icosahedron.ts'
import { CacheStorage } from './storage.ts'

const triangleWave = Effect.fn(function* (n: number, passes: number) {
	if (!Interval.contains(Interval.unit, n)) {
		yield* Effect.fail(new RangeError(`n must be in [0, 1] (got ${n})`))
	}

	if (!Number.isInteger(passes) || passes <= 0) {
		yield* Effect.fail(
			new RangeError(`passes must be a positive integer (got ${passes})`),
		)
	}

	return 2 * Math.abs((n * passes) / 2 - Math.floor((n * passes) / 2 + 0.5))
})

export interface GenerateGamutOptions {
	readonly subdivisions: number
	readonly huePasses: number
	readonly lightnessPasses: number
}

export const generateGamut = Effect.fn(function* (
	options: GenerateGamutOptions,
) {
	const cache = (yield* CacheStorage).forSchema(
		Schema.parseJson(
			Schema.Array(
				Schema.transform(
					Schema.Tuple(Schema.Number, Schema.Number),
					Schema.declare((input: unknown) => Vector2.isVector2(input)),
					{
						encode: (input: Vector2.Vector2) => [input.x, input.y] as const,
						decode: (input: readonly [number, number]) =>
							Vector2.make(...input),
						strict: true,
					},
				),
			),
		),
	)
	const cacheKey = `gamut-${Hash.hash(Data.struct(options))}`
	const cached = yield* cache.get(cacheKey)

	if (Option.isSome(cached)) {
		return cached.value
	}

	const vertices = yield* generateSphere(options.subdivisions)

	const result = []

	for (const vertex of vertices) {
		const theta = Vector3.getTheta(vertex)
		const phi = Vector3.getPhi(vertex)

		const hue = yield* triangleWave(
			mod(phi, 2 * Math.PI) / (2 * Math.PI),
			options.huePasses,
		)
		const lightness = yield* triangleWave(
			(1 - Math.cos(theta)) / 2,
			options.lightnessPasses,
		)

		result.push(Vector2.make(hue, lightness))
	}

	yield* cache.set(cacheKey, result)

	return result
})
