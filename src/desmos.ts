import { round } from 'curvy/utils'
import type { Vector3 } from 'curvy/vector3'
import { Array as Arr } from 'effect'

export function printDesmos(points: Iterable<Vector3>): string {
	const x = []
	const y = []
	const z = []

	for (const point of points) {
		x.push(round(point.x, 3))
		y.push(round(point.y, 3))
		z.push(round(point.z, 3))
	}

	const xLists = Arr.chunksOf(Arr.chunksOf(x, 1000), 10)
	const yLists = Arr.chunksOf(Arr.chunksOf(y, 1000), 10)
	const zLists = Arr.chunksOf(Arr.chunksOf(z, 1000), 10)

	const lines = []

	for (const [index, list] of xLists.entries()) {
		for (const [sublistIndex, sublist] of list.entries()) {
			lines.push(`x_{${index}s${sublistIndex}} = [${sublist.join(', ')}]`)
		}
		if (list.length === 1) {
			lines.push(`x_{${index}} = x_{${index}s0}`)
		} else {
			lines.push(
				`x_{${index}} = \\join(${Array.from({ length: list.length }, (_, i) => `x_{${index}s${i}}`).join(', ')})`,
			)
		}
	}

	for (const [index, list] of yLists.entries()) {
		for (const [sublistIndex, sublist] of list.entries()) {
			lines.push(`y_{${index}s${sublistIndex}} = [${sublist.join(', ')}]`)
		}
		if (list.length === 1) {
			lines.push(`y_{${index}} = y_{${index}s0}`)
		} else {
			lines.push(
				`y_{${index}} = \\join(${Array.from({ length: list.length }, (_, i) => `y_{${index}s${i}}`).join(', ')})`,
			)
		}
	}

	for (const [index, list] of zLists.entries()) {
		for (const [sublistIndex, sublist] of list.entries()) {
			lines.push(`z_{${index}s${sublistIndex}} = [${sublist.join(', ')}]`)
		}
		if (list.length === 1) {
			lines.push(`z_{${index}} = z_{${index}s0}`)
		} else {
			lines.push(
				`z_{${index}} = \\join(${Array.from({ length: list.length }, (_, i) => `z_{${index}s${i}}`).join(', ')})`,
			)
		}
	}

	return [
		...lines,
		...Array.from(
			{ length: xLists.length },
			(_, i) => `(x_{${i}}, y_{${i}}, z_{${i}})`,
		),
	].join('\n')
}
