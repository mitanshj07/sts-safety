// packages/shared/src/schemas/coords.ts
import { z } from "zod"
import { roundCoordinate } from "../utils/geo"

export const latitudeSchema = z
  .number()
  .min(-90)
  .max(90)
  .overwrite(roundCoordinate)

export const longitudeSchema = z
  .number()
  .min(-180)
  .max(180)
  .overwrite(roundCoordinate)

export const lonLatTupleSchema = z.tuple([longitudeSchema, latitudeSchema])

export const positionSchema = z.object({
  lat: latitudeSchema,
  lon: longitudeSchema,
})
export type Position = z.infer<typeof positionSchema>

export const timestamptzSchema = z.iso.datetime({ offset: true })

export const uuidSchema = z.uuid()

export const hexSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/, "expected 0x-prefixed hex")
  .transform((value) => value.toLowerCase() as `0x${string}`)
