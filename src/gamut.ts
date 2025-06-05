import { FileSystem } from '@effect/platform'
import Color from 'colorjs.io'
import * as Matrix4x4 from 'curvy/matrix4x4'
import * as CubicPolynomial from 'curvy/polynomial/cubic'
import * as Hermite2d from 'curvy/splines/hermite2d'
import { normalize, round } from 'curvy/utils'
import * as Vector2 from 'curvy/vector2'
import * as Vector4 from 'curvy/vector4'
import { Effect, Schema, Stream } from 'effect'

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
) {}

export const writeGamut = Effect.fn(function* (
	scaleHue = 4,
	scaleLightness = 4,
) {
	const values = yield* Stream.range(0, 360 * scaleHue - 1).pipe(
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
		Stream.runFold('hue,lightness,chroma\n', (acc, lch) => {
			if (Math.random() > 0.999) {
				console.log(
					`Hue: ${lch.hue}, Lightness: ${lch.lightness}, Chroma: ${lch.chroma}`,
				)
			}
			return `${acc}${lch.hue},${lch.lightness},${lch.chroma}\n`
		}),
	)

	const fs = yield* FileSystem.FileSystem

	yield* fs.writeFileString('./gamut.csv', values)
})
