import Color from 'colorjs.io'
import * as Interval from 'curvy/interval'
import * as Matrix4x4 from 'curvy/matrix4x4'
import * as CubicPolynomial from 'curvy/polynomial/cubic'
import * as Hermite2d from 'curvy/splines/hermite2d'
import { mod, normalize, round } from 'curvy/utils'
import * as Vector2 from 'curvy/vector2'
import * as Vector3 from 'curvy/vector3'
import * as Vector4 from 'curvy/vector4'
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

	return 2 * Math.abs(n * passes - Math.floor(n * passes + 0.5))
})

function findMaxChroma(L: number, H: number, epsilon = 1e-12): number {
	if (L < 0.125) {
		const near = findMaxChroma(0.125, H, epsilon)
		const far = findMaxChroma(0.15, H, epsilon)

		const v = Vector2.subtract(
			Vector2.make(0.125, near),
			Vector2.make(0.15, far),
		).pipe(Vector2.magnitude)

		return Hermite2d.characteristic.pipe(
			Matrix4x4.vectorProductLeft(Vector4.make(0, 0, near, v)),
			CubicPolynomial.fromVector,
			CubicPolynomial.solve(normalize(L, 0, 0.125)),
		)
	}

	let low = 0
	let high = 0.37
	let bestC = 0

	while (high - low > epsilon) {
		const mid = (low + high) / 2
		if (new Color('oklch', [L, mid, H * 360]).inGamut('p3')) {
			bestC = mid
			low = mid
		} else {
			high = mid
		}
	}

	return bestC
}

export interface GenerateGamutOptions {
	readonly subdivisions: number
	readonly huePasses: number
	readonly lightnessPasses: number
}

export const generateGamut = Effect.fn(function* (
	options: GenerateGamutOptions,
) {
	const cache = (yield* CacheStorage).forSchema(
		Schema.Array(
			Schema.transform(
				Schema.Tuple(Schema.Number, Schema.Number, Schema.Number),
				Schema.declare((input: unknown) => Vector3.isVector3(input)),
				{
					encode: (input: Vector3.Vector3) =>
						[input.x, input.y, input.z] as const,
					decode: (input: readonly [number, number, number]) =>
						Vector3.make(...input),
					strict: true,
				},
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

		const hueInitial = mod(phi, 2 * Math.PI) / (2 * Math.PI)
		const lightnessInitial = (1 - Math.cos(theta)) / 2

		const hue = yield* triangleWave(hueInitial, options.huePasses)
		const lightness = yield* triangleWave(
			lightnessInitial,
			options.lightnessPasses,
		)

		const chroma = findMaxChroma(lightness, hue)

		result.push(Vector3.setR(vertex, 1 - chroma))
		// result.push(Vector3.make(hueInitial, lightnessInitial, chroma))
	}

	yield* cache.set(cacheKey, result)

	return result
})
