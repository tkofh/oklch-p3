import { FileSystem } from '@effect/platform'
import { BunFileSystem } from '@effect/platform-bun'
import Color from 'colorjs.io'
import { roundDown } from 'curvy/utils'
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
		// if (lh.lightness < 0.125) {
		// 	const near = Vector2.make(
		// 		0.125,
		// 		LightnessHue.maxChroma(LightnessHue.of(0.125, lh.hue)),
		// 	)
		// 	const far = Vector2.make(
		// 		0.25,
		// 		LightnessHue.maxChroma(LightnessHue.of(0.25, lh.hue)),
		// 	)
		// 	const line = LinearPolynomial.fromPoints(near, far)
		// 	const pos = line.pipe(LinearPolynomial.solve(-1))
		//
		// 	return Bezier2d.characteristic.pipe(
		// 		Matrix4x4.vectorProductLeft(
		// 			Vector4.make(
		// 				0,
		// 				0,
		// 				near.y,
		// 				Vector2.subtract(
		// 					Vector2.make(x1, near),
		// 					Vector2.make(
		// 						x2,
		// 						LightnessHue.maxChroma(LightnessHue.of(x2, lh.hue)),
		// 					),
		// 				).pipe(Vector2.magnitude),
		// 			),
		// 		),
		// 		CubicPolynomial.fromVector,
		// 		CubicPolynomial.solve(normalize(lh.lightness, 0, x1)),
		// 	)
		// }

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

		return roundDown(bestC, 5)
	}
}

class LightnessChromaHue extends Schema.TaggedClass<LightnessChromaHue>()(
	'LightnessChromaHue',
	{ hue, lightness, chroma },
) {
	toJson() {
		return [this.hue, this.lightness, this.chroma]
	}
}

export const writeGamut = Effect.fn(function* (
	scaleHue = 2,
	scaleLightness = 20,
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

export class Gamut extends Effect.Service<Gamut>()('gamut', {
	effect: Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem

		const hasFile = yield* fs.exists('./gamut.json')
		if (!hasFile) {
			yield* writeGamut()
		}

		yield* Effect.log('Loading gamut...')
		const data = yield* fs.readFileString('./gamut.json')

		yield* Effect.log('Gamut loaded. Decoding...')

		return yield* Schema.decode(
			Schema.parseJson(
				Schema.Array(
					Schema.transform(
						Schema.Tuple(hue, lightness, chroma),
						Schema.Struct({
							hue: hue,
							lightness: lightness,
							chroma: chroma,
						}),
						{
							decode: (arr) => ({
								hue: arr[0],
								lightness: arr[1],
								chroma: arr[2],
							}),
							encode: ({ hue, lightness, chroma }) => [hue, lightness, chroma],
							strict: false,
						},
					),
				),
			),
		)(data)
	}),
	dependencies: [BunFileSystem.layer],
}) {
	static maxChroma(hue: number, lightness: number): number {
		return LightnessHue.maxChroma(LightnessHue.of(lightness, hue))
	}
}

export declare namespace Gamut {
	export interface Point {
		readonly hue: number
		readonly lightness: number
		readonly chroma: number
	}
}
