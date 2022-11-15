// The meta data object type
export type Meta = {
  description: string
  external_url: string // eslint-disable-line camelcase
  image: string
  name: string
  attributes: {
    type: string
    value: string[]
  }
}

// The inclusive set of all the permitted keys in a metadata object
export const MetaKeys = [
  "description",
  "external_url",
  "image",
  "name",
  "attributes",
]
