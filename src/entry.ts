import { BunContext, BunRuntime } from '@effect/platform-bun'
import { Effect } from 'effect'
import { Gamut } from './gamut.ts'
import { program } from './program'

BunRuntime.runMain(
	program.pipe(Effect.provide(Gamut.Default), Effect.provide(BunContext.layer)),
)
