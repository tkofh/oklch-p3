import { Effect } from 'effect'

export const factorial = Effect.fnUntraced(function* (n: number) {
	if (n < 0) {
		yield* Effect.fail(new Error('n must be a non-negative integer'))
	}

	if (n === 0 || n === 1) {
		return 1
	}

	let result = 1
	for (let i = 2; i <= n; i++) {
		result *= i
	}

	return result
})

export const doubleFactorial = Effect.fnUntraced(function* (n: number) {
	if (n < 0) {
		yield* Effect.fail(new Error('n must be a non-negative integer'))
	}

	if (n === 0 || n === 1) {
		return 1
	}

	let result = 1
	for (let i = n; i > 0; i -= 2) {
		result *= i
	}

	return result
})

const normalizationConstant = Effect.fnUntraced(function* (
	l: number,
	m: number,
) {
	return Math.sqrt(
		(((2 * l + 1) / (4 * Math.PI)) * (yield* factorial(l - Math.abs(m)))) /
			(yield* factorial(l + Math.abs(m))),
	)
})

const associatedLegendre = Effect.fnUntraced(function* (
	l: number,
	m: number,
	x: number,
) {
	if (m < 0) {
		yield* Effect.fail(new Error('m must be non-negative'))
	}

	if (m > l) {
		yield* Effect.fail(new Error('m must be less than or equal to l'))
	}

	if (x < -1 || x > 1) {
		yield* Effect.fail(new Error('x must be in the range [-1, 1]'))
	}

	const pmm =
		(1 - x ** 2) ** (m / 2) *
		(m === 0 ? 1 : (-1) ** m * (yield* doubleFactorial(2 * m - 1)))

	if (l === m) {
		return pmm
	}

	const pmm1 = x * (2 * m + 1) * pmm
	if (l === m + 1) {
		return pmm1
	}

	let previous = pmm
	let current = pmm1
	let next = 0

	for (let ll = m + 2; ll <= l; ll++) {
		next = ((2 * ll - 1) * x * current - (ll + m - 1) * previous) / (ll - m)
		previous = current
		current = next
	}

	return current
})

export const sphericalHarmonic = Effect.fnUntraced(function* (
	l: number,
	m: number,
	theta: number,
	phi: number,
) {
	if (l < 0 || !Number.isInteger(l)) {
		yield* Effect.fail(new Error('l must be a non-negative integer'))
	}

	const absM = Math.abs(m)
	if (absM > l) {
		yield* Effect.fail(new Error('|m| must be less than or equal to l'))
	}

	const x = Math.cos(theta)
	const normalization = yield* normalizationConstant(l, absM)
	const legendre = yield* associatedLegendre(l, absM, x)

	if (m === 0) {
		return normalization * legendre
	}

	const mSign = m < 0 ? (absM % 2 === 0 ? 1 : -1) : 1

	if (m < 0) {
		return (
			mSign * Math.sqrt(2) * normalization * legendre * Math.sin(absM * phi)
		)
	}
	return Math.sqrt(2) * normalization * legendre * Math.cos(m * phi)
})
