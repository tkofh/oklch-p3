import { FileSystem } from '@effect/platform'
import Color from 'colorjs.io'
import * as Matrix4x4 from 'curvy/matrix4x4'
import * as CubicPolynomial from 'curvy/polynomial/cubic'
import * as Hermite2d from 'curvy/splines/hermite2d'
import { normalize, round } from 'curvy/utils'
import * as Vector2 from 'curvy/vector2'
import * as Vector4 from 'curvy/vector4'
import { Chunk, Effect, Schema, Stream } from 'effect'

const lightness = Schema.Number.pipe(Schema.between(0, 1))
const chroma = Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))
const hue = Schema.Number.pipe(Schema.between(0, 360))

class LightnessHue extends Schema.TaggedClass<LightnessHue>()('LightnessHue', {
	lightness,
	hue,
}) {
	static #epsilon = 1e-12

	static of(lightness: number, hue: number): LightnessHue {
		return new LightnessHue({ lightness, hue })
	}

	static maxChroma(lh: LightnessHue): number {
		if (lh.lightness < 0.125) {
			const near = LightnessHue.maxChroma(LightnessHue.of(0.125, lh.hue))

			return Hermite2d.characteristic.pipe(
				Matrix4x4.vectorProductLeft(
					Vector4.make(
						0,
						0,
						near,
						Vector2.subtract(
							Vector2.make(0.125, near),
							Vector2.make(
								0.15,
								LightnessHue.maxChroma(LightnessHue.of(0.15, lh.hue)),
							),
						).pipe(Vector2.magnitude),
					),
				),
				CubicPolynomial.fromVector,
				CubicPolynomial.solve(normalize(lh.lightness, 0, 0.125)),
			)
		}

		let low = 0
		let high = 0.37
		let bestC = 0

		while (high - low > LightnessHue.#epsilon) {
			const mid = (low + high) / 2
			if (new Color('oklch', [lh.lightness, mid, lh.hue]).inGamut('p3')) {
				bestC = mid
				low = mid
			} else {
				high = mid
			}
		}

		return round(bestC)
	}
}

class LightnessChromaHue extends Schema.TaggedClass<LightnessChromaHue>()(
	'LightnessChromaHue',
	{ hue, lightness, chroma },
) {
	toJson() {
		return {
			hue: this.hue,
			lightness: this.lightness,
			chroma: this.chroma,
		}
	}
}

export const writeGamut = Effect.fn(function* (
	scaleHue = 4,
	scaleLightness = 4,
) {
	const chunk = yield* Stream.range(0, 360 * scaleHue - 1).pipe(
		Stream.map((hue) => hue / scaleHue),
		Stream.flatMap((hue) =>
			Stream.range(0, 100 * scaleLightness).pipe(
				Stream.map(
					(l) =>
						new LightnessChromaHue({
							hue,
							lightness: l / (100 * scaleLightness),
							chroma: LightnessHue.maxChroma(
								LightnessHue.of(l / (100 * scaleLightness), hue),
							),
						}),
				),
			),
		),
		Stream.tap((v) =>
			Math.random() > 0.999 ? Effect.log(v.toJson()) : Effect.void,
		),
		Stream.runCollect,
	)

	const fs = yield* FileSystem.FileSystem

	yield* fs.writeFileString(
		'./gamut.json',
		chunk.pipe(
			Chunk.map((x) => x.toJson()),
			Chunk.toReadonlyArray,
			JSON.stringify,
		),
	)
})

export const gamut = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem

	const hasFile = yield* fs.exists('./gamut.json')
	if (!hasFile) {
		yield* writeGamut()
	}

	const data = yield* fs.readFileString('./gamut.json')

	return yield* Schema.decode(
		Schema.parseJson(
			Schema.Array(
				Schema.Struct({
					hue: hue,
					lightness: lightness,
					chroma: chroma,
				}),
			),
		),
	)(data)
})
