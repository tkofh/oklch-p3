import { Clock, Effect, Ref } from 'effect'

export const createThrottledLogger = () => {
	return Effect.gen(function* () {
		const lastLogTimeRef = yield* Ref.make(0)

		return (...logs: ReadonlyArray<unknown>): Effect.Effect<void> => {
			return Effect.gen(function* () {
				const currentTime = yield* Clock.currentTimeMillis

				const shouldLog = yield* Ref.modify(lastLogTimeRef, (lastLogTime) => {
					if (currentTime - lastLogTime >= 1000) {
						return [true, currentTime]
					}
					return [false, lastLogTime]
				})

				if (shouldLog) {
					yield* Effect.log(...logs)
				}
			})
		}
	})
}
