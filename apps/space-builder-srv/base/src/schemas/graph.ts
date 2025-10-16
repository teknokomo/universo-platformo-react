import { z } from 'zod'

const AllowedNames = z.enum(['Space', 'Data', 'Entity', 'Component'])

const NodeData = z
  .object({
    name: AllowedNames,
    label: z.string().optional(),
    inputs: z.record(z.any()).optional()
  })
  .passthrough()

const Node = z
  .object({
    id: z.string(),
    data: NodeData,
    type: z.string().optional()
  })
  .passthrough()

const Edge = z
  .object({
    source: z.string(),
    target: z.string(),
    type: z.string().default('buttonedge')
  })
  .passthrough()

export const GraphSchema = z.object({
  nodes: z.array(Node).max(250),
  edges: z.array(Edge).max(500)
})

export type Graph = z.infer<typeof GraphSchema>
