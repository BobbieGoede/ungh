import { gfm } from "micromark-extension-gfm";
import { visit } from "unist-util-visit";
import { toHtml } from "hast-util-to-html";
import { fromHtml } from "hast-util-from-html";
import { toMarkdown } from "mdast-util-to-markdown";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";

import type { Nodes, Element } from "hast";

function alreadyURL(path: string) {
  return path.startsWith("http");
}

function resolveAbsoluteURL(path: string, base: string) {
  return `${base}/${path.replace(/^\.\//, "")}`;
}

/**
 * HTML & Mardown Function to replace relative paths with absolute paths
 * - prefixes relative image paths with `cdnBaseURL`
 * - prefixes relative markdown paths with `ghBaseURL`
 */
export function resolveMarkdownRelativeLinks(
  content: string,
  options: { cdnBaseURL: string; githubBaseURL: string },
) {
  const tree = fromMarkdown(content, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

  visit(
    tree,
    (node) => node.type === "link" || node.type === "html",
    (node) => {
      // replace if url is relative
      if (node.type === "link" && !alreadyURL(node.url)) {
        node.url = resolveAbsoluteURL(node.url, options.githubBaseURL);
      }

      // parse html and traverse
      if (node.type === "html") {
        const htmlTree = fromHtml(node.value, { fragment: true });

        visit(
          htmlTree,

          // filter for img tags with relative src
          (n: Nodes) =>
            n.type === "element" &&
            n.tagName === "img" &&
            typeof n.properties.src === "string" &&
            !alreadyURL(n.properties.src),

          // replace src with resolved url
          (n: Element & { properties: { src: string } }) => {
            n.properties.src = resolveAbsoluteURL(
              n.properties.src,
              options.cdnBaseURL,
            );
          },
        );

        node.value = toHtml(htmlTree);
      }
    },
  );

  const out = toMarkdown(tree, { extensions: [gfmToMarkdown()] });

  // trim off added trailing newline (?)
  return out.trim();
}
