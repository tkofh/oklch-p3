import { Effect } from 'effect'
import { gamut } from './gamut.ts'

export const program = Effect.fn('program')(function* () {
	const data = yield* gamut

	yield* Effect.log(`Gamut data loaded with ${data.length} entries.`)
})()
