export type MinecraftProperties = Record<string, string>;

type PropertyPosition = { key: string; valueStart: number };

/** Decode the escapes used by Java .properties files without changing unrelated lines. */
function decodeProperty(value: string): string {
  return value.replace(/\\u([0-9a-fA-F]{4})|\\(.)/g, (_match, unicode: string | undefined, escaped: string | undefined) => {
    if (unicode) return String.fromCharCode(Number.parseInt(unicode, 16));
    switch (escaped) {
      case "t": return "\t";
      case "n": return "\n";
      case "r": return "\r";
      case "f": return "\f";
      default: return escaped ?? "";
    }
  });
}

function encodeProperty(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\t/g, "\\t")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\f/g, "\\f")
    .replace(/^ +/, (spaces) => "\\ ".repeat(spaces.length));
}

function propertyPosition(line: string): PropertyPosition | null {
  if (!line.trim() || line.trimStart().startsWith("#") || line.trimStart().startsWith("!")) return null;
  let escaped = false;
  let separator = -1;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "=" || character === ":") {
      separator = index;
      break;
    }
  }
  if (separator < 0) return null;
  const rawKey = line.slice(0, separator).trim();
  if (!rawKey) return null;
  let valueStart = separator + 1;
  while (valueStart < line.length && /[ \t\f]/.test(line[valueStart])) valueStart += 1;
  return { key: decodeProperty(rawKey), valueStart };
}

function linesWithEndings(content: string): string[] {
  return content.split(/(\r\n|\n|\r)/);
}

export function parseMinecraftProperties(content: string): MinecraftProperties {
  const properties: MinecraftProperties = {};
  const parts = linesWithEndings(content);
  for (let index = 0; index < parts.length; index += 2) {
    const line = parts[index];
    const position = propertyPosition(line);
    if (position) properties[position.key] = decodeProperty(line.slice(position.valueStart));
  }
  return properties;
}

/**
 * Update known keys in-place, retaining comments, key order, line endings, and
 * unrelated plugin/server settings. Missing keys are appended at the end.
 */
export function updateMinecraftProperties(content: string, updates: MinecraftProperties): string {
  const entries = Object.entries(updates);
  if (!entries.length) return content;
  const remaining = new Map(entries);
  const found = new Set<string>();
  const parts = linesWithEndings(content);
  for (let index = 0; index < parts.length; index += 2) {
    const line = parts[index];
    const position = propertyPosition(line);
    if (!position) continue;
    const nextValue = remaining.get(position.key);
    if (nextValue === undefined) continue;
    parts[index] = line.slice(0, position.valueStart) + encodeProperty(nextValue);
    found.add(position.key);
  }

  let result = parts.join("");
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  for (const [key, value] of remaining) {
    if (found.has(key)) continue;
    if (result && !/(?:\r\n|\n|\r)$/.test(result)) result += newline;
    result += `${key}=${encodeProperty(value)}${newline}`;
  }
  return result;
}

export function validMinecraftPort(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const port = Number(value);
  return Number.isSafeInteger(port) && port >= 1 && port <= 65535;
}

export function validMinecraftInteger(value: string, min: number, max: number): boolean {
  if (!/^-?\d+$/.test(value)) return false;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max;
}
