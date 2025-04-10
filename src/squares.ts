import * as Vector3 from 'curvy/vector3'
import { Effect } from 'effect'
import { Matrix, SVD } from 'ml-matrix'
import { sphericalHarmonic } from './harmonics'

const calculateNumCoefficients = (maxDegree: number): number => {
	let count = 0
	for (let l = 0; l <= maxDegree; l += 2) {
		// Count only even m values (0, 2, 4, ...) up to l
		for (let m = 0; m <= l; m += 2) {
			count++
		}
	}
	return count
}

export const fitSphericalHarmonics = Effect.fnUntraced(function* (
	data: ReadonlyArray<Vector3.Vector3>,
	maxDegree: number,
) {
	const numCoefficients = calculateNumCoefficients(maxDegree)

	yield* Effect.log(
		`fitting spherical harmonics with ${numCoefficients} coefficients`,
	)

	const A: number[][] = Array.from({ length: data.length }, () =>
		Array.from({ length: numCoefficients }, () => 0),
	)

	const b: number[] = data.map((point) => point.pipe(Vector3.getR))

	yield* Effect.log(
		`constructing matrix A with ${data.length} rows and ${numCoefficients} columns`,
	)

	let colIdx = 0
	for (let l = 0; l <= maxDegree; l += 2) {
		for (let m = 0; m <= l; m += 2) {
			// Only even m values
			yield* Effect.log(`calculating coefficients for l=${l}, m=${m}`)
			for (const [rowIdx, point] of data.entries()) {
				;(A[rowIdx] as Array<number>)[colIdx] = yield* sphericalHarmonic(
					l,
					m,
					Vector3.getTheta(point),
					Vector3.getPhi(point),
				)
			}
			colIdx++
		}
	}

	// Rest of the function remains the same
	const matA = new Matrix(A)
	const matB = Matrix.columnVector(b)

	yield* Effect.log('solving linear system')

	const svd = new SVD(matA)
	const coefficients = svd.solve(matB)

	yield* Effect.log('calculating result')

	const result: Record<string, number> = {}
	colIdx = 0
	for (let l = 0; l <= maxDegree; l += 2) {
		for (let m = 0; m <= l; m += 2) {
			// Only even m values
			result[`${l},${m}`] = coefficients.get(colIdx, 0)
			colIdx++
		}
	}

	return result
})
