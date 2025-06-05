import { Effect } from 'effect'
import { writeGamut } from './gamut'

export const program = Effect.fn('program')(function* () {
	yield* writeGamut()
})()
