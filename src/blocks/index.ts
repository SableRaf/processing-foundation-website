import type { BlockType } from "../schemas/pages.ts";
import Block1 from "./Block1.astro";
import Block2 from "./Block2.astro";
import Block3 from "./Block3.astro";

/**
 * Maps each block `type` (the discriminator from schema.ts) to the Astro
 * component that renders it. Add a new block here alongside its schema.
 */
export const blockComponents: Record<BlockType, typeof Block1> = {
  block1: Block1,
  block2: Block2,
  block3: Block3,
};
