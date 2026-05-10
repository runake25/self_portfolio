const CONTENT_EXTENSION_REGEX = /\.(md|mdx)$/i;

export function entrySlugFromId(id: string) {
  return id.replace(CONTENT_EXTENSION_REGEX, "");
}

export function entryHref(collection: string, id: string) {
  return `/${collection}/${entrySlugFromId(id)}`;
}
