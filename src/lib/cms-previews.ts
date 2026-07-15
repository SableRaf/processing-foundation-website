/**
 * Decap CMS preview templates for the page builder.
 *
 * Decap renders its preview pane with React, in an iframe, and cannot import
 * .astro components — so each block's markup is mirrored here. Keep this in sync
 * with the components in src/blocks/; the markup is deliberately simple (the
 * same `data-block` sections) so the two stay easy to compare.
 *
 * Decap is loaded from a <script> tag, so `window.CMS` and `window.h` (its
 * bundled Preact createElement) are globals here rather than imports.
 */

import { marked } from "marked";

type Props = {
  entry: { getIn: (path: string[]) => unknown };
  widgetsFor: (name: string) => unknown;
};

declare global {
  interface Window {
    CMS?: {
      registerPreviewTemplate: (name: string, component: unknown) => void;
    };
    h?: (type: unknown, props?: unknown, ...children: unknown[]) => unknown;
  }
}

/** Sketch modules, bundled so the preview can run the same code as the site. */
const sketchModules = import.meta.glob("../content/sketches/*.js");

/**
 * Mounts a p5 sketch into the preview pane.
 *
 * The preview iframe re-renders on every keystroke, so this is careful to tear
 * down the previous p5 instance: without `remove()` each edit would leak a
 * running animation loop and they would stack up until the pane crawls.
 */
function P5SketchPreview(props: { sketch?: string; width: number; height: number }) {
  const h = window.h!;
  const { sketch, width, height } = props;

  return h("div", {
    style: { maxWidth: `${width}px`, aspectRatio: `${width} / ${height}` },
    // The ref fires with the mounted node (and with null on unmount), which is
    // where the p5 instance is created and destroyed.
    ref: (el: (HTMLElement & { __p5?: { remove: () => void } }) | null) => {
      if (!el) return;
      el.__p5?.remove();
      delete el.__p5;
      el.textContent = "";
      if (!sketch) return;

      const loader = sketchModules[`../content/sketches/${sketch}.js`];
      if (!loader) {
        el.textContent = `Unknown sketch: ${sketch}`;
        return;
      }

      let cancelled = false;
      Promise.all([import("p5"), loader() as Promise<{ default: Function }>]).then(
        ([{ default: p5 }, mod]) => {
          // The pane may have re-rendered while p5 was loading.
          if (cancelled || !el.isConnected) return;
          el.__p5 = new p5((p: any) => {
            mod.default(p, { width, height }, p5);
          }, el);
        },
      );

      // Re-running the ref (or unmounting) cancels an in-flight load.
      (el as any).__cancel?.();
      (el as any).__cancel = () => {
        cancelled = true;
      };
    },
  });
}

/** Mirrors the markup of Block1/2/3 and P5Sketch.astro. */
function blockPreview(block: Record<string, unknown>, index: number) {
  const h = window.h!;
  const type = block.type as string;

  if (type === "p5sketch") {
    return h(
      "figure",
      { key: index, "data-block": "p5sketch" },
      block.title ? h("h2", null, block.title as string) : null,
      h(P5SketchPreview, {
        sketch: block.sketch as string | undefined,
        width: (block.width as number) || 600,
        height: (block.height as number) || 400,
      }),
      block.caption ? h("figcaption", null, block.caption as string) : null,
    );
  }

  // block1/2/3 share a title + description section; block1 adds a markdown body.
  return h(
    "section",
    { key: index, "data-block": type },
    h("h2", null, (block.title as string) ?? ""),
    h("p", null, (block.description as string) ?? ""),
    type === "block1" && block.body
      ? h("div", {
          class: "rich-text",
          dangerouslySetInnerHTML: {
            __html: marked.parse(block.body as string) as string,
          },
        })
      : null,
  );
}

/** Preview for the `pages` collection: title + the block list, in order. */
function PagePreview({ entry }: Props) {
  const h = window.h!;
  const blocks = entry.getIn(["data", "blocks"]) as
    | { toJS: () => Record<string, unknown>[] }
    | undefined;
  const list = blocks?.toJS?.() ?? [];

  return h(
    "main",
    { style: { padding: "1rem" } },
    h("h1", null, (entry.getIn(["data", "title"]) as string) ?? ""),
    ...list.map(blockPreview),
  );
}

/** Registers every preview template. Called from src/pages/admin.astro. */
export function registerPreviews() {
  if (!window.CMS || !window.h) {
    console.warn("[cms-previews] Decap CMS not found on window; previews not registered.");
    return;
  }
  window.CMS.registerPreviewTemplate("pages", PagePreview);
}
