import * as Vector3 from 'curvy/vector3'
import { Context, Data, Effect, MutableHashMap, Option, Schema } from 'effect'
import { CacheStorage } from './storage.ts'

const phi = (1 + Math.sqrt(5)) / 2
const a = 1 / Math.sqrt(1 + phi ** 2)
const b = phi * a

const INITIAL_VERTICES = [
	Vector3.make(0, a, -b),
	Vector3.make(0, a, b),
	Vector3.make(0, -a, b),
	Vector3.make(-a, b, 0),
	Vector3.make(-a, -b, 0),
	Vector3.make(a, b, 0),
	Vector3.make(a, -b, 0),
	Vector3.make(0, -a, -b),
	Vector3.make(b, 0, a),
	Vector3.make(-b, 0, a),
	Vector3.make(-b, 0, -a),
	Vector3.make(b, 0, -a),
] as const
const INITIAL_FACES = [
	[0, 3, 10],
	[0, 3, 5],
	[0, 5, 11],
	[0, 7, 10],
	[0, 7, 11],
	[1, 2, 8],
	[1, 2, 9],
	[1, 3, 5],
	[1, 3, 9],
	[1, 5, 8],
	[2, 4, 6],
	[2, 4, 9],
	[2, 6, 8],
	[3, 9, 10],
	[4, 6, 7],
	[4, 7, 10],
	[4, 9, 10],
	[5, 8, 11],
	[6, 7, 11],
	[6, 8, 11],
] as const
const INITIAL_EDGES = [
	[0, 3],
	[0, 5],
	[0, 7],
	[0, 10],
	[0, 11],
	[1, 2],
	[1, 3],
	[1, 5],
	[1, 8],
	[1, 9],
	[2, 4],
	[2, 6],
	[2, 8],
	[2, 9],
	[3, 5],
	[3, 9],
	[3, 10],
	[4, 6],
	[4, 7],
	[4, 9],
	[4, 10],
	[5, 8],
	[5, 11],
	[6, 7],
	[6, 8],
	[6, 11],
	[7, 10],
	[7, 11],
	[8, 11],
	[9, 10],
] as const

class Vertices extends Effect.Service<Vertices>()('vertices', {
	sync: () => {
		const store = MutableHashMap.make() as MutableHashMap.MutableHashMap<
			Vector3.Vector3,
			number
		>
		const list = [] as Array<Vector3.Vector3>

		for (const [i, vertex] of INITIAL_VERTICES.entries()) {
			MutableHashMap.set(store, Data.struct(vertex), i)
			list.push(vertex)
		}

		let nextIndex = 12

		const indexOf = (v: Vector3.Vector3) => {
			const vec = Data.struct(v)

			const stored = MutableHashMap.get(store, vec)

			if (Option.isSome(stored)) {
				return Effect.succeed(stored.value)
			}

			MutableHashMap.set(store, Data.struct(v), nextIndex)
			list.push(v)
			nextIndex++

			return Effect.succeed(nextIndex - 1)
		}

		const vertexAt = (index: number) => {
			if (index < 0 || index >= list.length) {
				return Effect.fail(new RangeError('Index out of bounds'))
			}
			return Effect.succeed(list[index] as Vector3.Vector3)
		}

		const toArray = (): Effect.Effect<ReadonlyArray<Vector3.Vector3>> => {
			return Effect.succeed(Array.from(list))
		}

		return {
			indexOf,
			toArray,
			vertexAt,
		}
	},
	accessors: true,
}) {}

class GetMidpoint extends Context.Tag('GetMidpoint')<
	GetMidpoint,
	(a: number, b: number) => Effect.Effect<number, RangeError, Vertices>
>() {}

class Subdivisions extends Context.Tag('Subdivisions')<
	Subdivisions,
	number
>() {}

const subdivideEdge = Effect.fn(function* (a: number, b: number) {
	const getMidpoint = yield* GetMidpoint
	const subdivisions = yield* Subdivisions

	let points = [a, b] as Array<number>

	for (let i = 0; i < subdivisions; i++) {
		yield* Effect.log(`subdividing edge ${a} - ${b} (${i + 1}/${subdivisions})`)
		const newPoints = [] as Array<number>
		for (let j = 0; j < points.length - 1; j++) {
			const a = points[j] as number
			const b = points[j + 1] as number

			const ab = yield* getMidpoint(a, b)
			newPoints.push(a, ab)
		}

		newPoints.push(points[points.length - 1] as number)

		points = newPoints
	}
})

const subdivideFace = Effect.fn(function* (f0: number, f1: number, f2: number) {
	let faces = [[f0, f1, f2]] as Array<readonly [number, number, number]>

	const getMidpoint = yield* GetMidpoint
	const subdivisions = yield* Subdivisions

	for (let i = 0; i < subdivisions; i++) {
		yield* Effect.log(
			`subdividing face ${f0} - ${f1} - ${f2} (${i + 1}/${subdivisions})`,
		)
		const newFaces = [] as Array<readonly [number, number, number]>
		for (const [a, b, c] of faces) {
			const ab = yield* getMidpoint(a, b)
			const ac = yield* getMidpoint(a, c)
			const bc = yield* getMidpoint(b, c)

			newFaces.push([a, ab, ac])
			newFaces.push([b, ab, bc])
			newFaces.push([c, ac, bc])
			newFaces.push([ab, ac, bc])
		}

		faces = newFaces
	}
})

function midpoint(v0: Vector3.Vector3, v1: Vector3.Vector3) {
	const midpoint = v0.pipe(Vector3.add(v1), Vector3.scale(0.5))

	let projected: Vector3.Vector3
	if (Vector3.magnitude(midpoint) === 0) {
		const cross = v0.pipe(Vector3.cross(Vector3.unitY))

		if (Vector3.magnitude(cross) === 0) {
			projected = Vector3.normalize(Vector3.unitZ)
		} else {
			projected = Vector3.normalize(cross)
		}
	} else {
		projected = Vector3.normalize(midpoint)
	}
	return projected
}

export const generateSphere = Effect.fn(
	function* (subdivisions: number) {
		yield* Effect.log('start')
		const cache = (yield* CacheStorage).forSchema(
			Schema.parseJson(
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
			),
		)

		const cached = yield* cache.get(`icosahedron-${subdivisions}`)
		if (Option.isSome(cached)) {
			yield* Effect.log(
				`Using cached icosahedron with ${subdivisions} subdivisions`,
			)
			return cached.value
		}

		const edgeCache = new Map<string, number>()

		for (const [a, b] of INITIAL_EDGES) {
			yield* subdivideEdge(a, b).pipe(
				Effect.provideService(Subdivisions, subdivisions),
				Effect.provideService(
					GetMidpoint,
					Effect.fn(function* (a, b) {
						const key = a < b ? `${a}-${b}` : `${b}-${a}`
						const cached = edgeCache.get(key)
						if (cached !== undefined) {
							return cached
						}

						const va = yield* Vertices.vertexAt(a)
						const vb = yield* Vertices.vertexAt(b)

						const result = yield* Vertices.indexOf(midpoint(va, vb))
						edgeCache.set(key, result)

						return result
					}),
				),
			)
		}

		const faceCache = new Map<string, number>()
		for (const [f0, f1, f2] of INITIAL_FACES) {
			yield* subdivideFace(f0, f1, f2).pipe(
				Effect.provideService(Subdivisions, subdivisions),
				Effect.provideService(
					GetMidpoint,
					Effect.fn(function* (a, b) {
						const key = a < b ? `${a}-${b}` : `${b}-${a}`
						const cached = faceCache.get(key) ?? edgeCache.get(key)
						if (cached !== undefined) {
							return cached
						}

						const va = yield* Vertices.vertexAt(a)
						const vb = yield* Vertices.vertexAt(b)
						const result = yield* Vertices.indexOf(midpoint(va, vb))
						faceCache.set(key, result)
						return result
					}),
				),
			)

			faceCache.clear()
		}

		yield* cache.set(`icosahedron-${subdivisions}`, yield* Vertices.toArray())

		return yield* Vertices.toArray()
	},
	(effect) => effect.pipe(Effect.provide(Vertices.Default)),
)
