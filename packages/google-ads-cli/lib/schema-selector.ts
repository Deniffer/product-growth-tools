/**
 * @input argc router trees plus jq-like selector strings
 * @output schema subset helpers for focused CLI schema discovery
 * @pos local compatibility layer over argc schema selector behavior
 */

import { type AnyCommand, type AnyGroup, group, type Router } from "argc";

export type SelectorStep =
  | { type: "key"; name: string }
  | { type: "wildcard" }
  | { type: "set"; names: string[] }
  | { type: "recursive" };

export type SelectorMatch = {
  path: string[];
  node: Router;
};

const IDENT_RE = /[A-Za-z0-9_-]/;

function isCommand(value: unknown): value is AnyCommand {
  return value !== null && typeof value === "object" && "~argc" in value;
}

function isGroup(value: unknown): value is AnyGroup {
  return value !== null && typeof value === "object" && "~argc.group" in value;
}

export function parseSchemaSelector(input: string): SelectorStep[] {
  validateSelectorPrefix(input);

  const steps: SelectorStep[] = [];
  let index = 0;

  while (index < input.length) {
    index = consumeSelectorDot(input, index, steps);
  }

  return steps;
}

export function matchSchemaSelector(
  schema: Router,
  steps: SelectorStep[]
): SelectorMatch[] {
  let current: SelectorMatch[] = [{ path: [], node: schema }];

  for (const step of steps) {
    current = applySelectorStep(current, step);
  }

  return current;
}

export function buildSchemaSubset(
  schema: Router,
  matches: SelectorMatch[],
  depth: number
): Router {
  if (matches.length === 0) {
    return {};
  }
  if (matches.some((match) => match.path.length === 0)) {
    return sliceRouter(schema, depth);
  }

  const root: Record<string, Router> = {};
  for (const match of matches) {
    insertPath(schema, root, match.path, depth);
  }
  return root;
}

function sliceRouter(router: Router, depth: number): Router {
  if (isCommand(router)) {
    return router;
  }

  if (isGroup(router)) {
    if (depth <= 0) {
      return group(router["~argc.group"].meta, {});
    }

    const children: Record<string, Router> = {};
    for (const [name, child] of Object.entries(
      router["~argc.group"].children
    )) {
      children[name] = sliceRouter(child, depth - 1);
    }
    return group(router["~argc.group"].meta, children);
  }

  if (depth <= 0) {
    return {};
  }

  const children: Record<string, Router> = {};
  for (const [name, child] of Object.entries(router)) {
    children[name] = sliceRouter(child, depth - 1);
  }
  return children;
}

function parseSegment(
  input: string,
  start: number
): { step: SelectorStep; nextIndex: number } {
  const char = readChar(input, start);

  if (char === "*") {
    return { step: { type: "wildcard" }, nextIndex: start + 1 };
  }

  if (char === "{") {
    return parseSetSegment(input, start);
  }

  return parseKeySegment(input, start, char);
}

function getChildren(router: Router): Record<string, Router> | null {
  if (isCommand(router)) {
    return null;
  }
  if (isGroup(router)) {
    return router["~argc.group"].children;
  }
  return router;
}

function collectDescendants(match: SelectorMatch, output: SelectorMatch[]) {
  output.push(match);

  const children = getChildren(match.node);
  if (!children) {
    return;
  }

  for (const [name, child] of Object.entries(children)) {
    collectDescendants({ path: [...match.path, name], node: child }, output);
  }
}

function insertPath(
  schema: Router,
  outputRoot: Record<string, Router>,
  path: string[],
  depth: number
) {
  let currentOriginal = schema;
  let currentOutput = outputRoot;

  for (let index = 0; index < path.length; index += 1) {
    const name = path[index];
    if (!name) {
      return;
    }
    const originalChildren = getChildren(currentOriginal);
    if (!originalChildren) {
      return;
    }

    const originalNode = originalChildren[name];
    if (!originalNode) {
      return;
    }

    const isLast = index === path.length - 1;
    if (isLast) {
      currentOutput[name] = sliceRouter(originalNode, depth);
      return;
    }

    const nextOutputNode = ensureOutputNode(currentOutput, name, originalNode);
    const nextChildren = getChildren(nextOutputNode);
    if (!nextChildren) {
      return;
    }

    currentOutput = nextChildren;
    currentOriginal = originalNode;
  }
}

function ensureOutputNode(
  parent: Record<string, Router>,
  name: string,
  originalNode: Router
): Router {
  const existing = parent[name];
  if (existing) {
    return existing;
  }

  let created: Router;
  if (isGroup(originalNode)) {
    created = group(originalNode["~argc.group"].meta, {});
  } else if (isCommand(originalNode)) {
    created = originalNode;
  } else {
    created = {};
  }

  parent[name] = created;
  return created;
}

function skipSpaces(input: string, index: number) {
  let cursor = index;

  while (cursor < input.length && readChar(input, cursor) === " ") {
    cursor += 1;
  }

  return cursor;
}

function readChar(input: string, index: number) {
  return index < input.length ? (input[index] ?? "") : "";
}

function validateSelectorPrefix(input: string) {
  if (!input) {
    throw new Error("Selector is empty");
  }
  if (input[0] !== ".") {
    throw new Error('Selector must start with "."');
  }
}

function consumeSelectorDot(
  input: string,
  index: number,
  steps: SelectorStep[]
) {
  if (readChar(input, index) !== ".") {
    throw new Error(
      `Unexpected character "${readChar(input, index)}" at ${index}`
    );
  }

  if (readChar(input, index + 1) === ".") {
    return consumeRecursiveSelector(input, index, steps);
  }

  return consumeDirectSelector(input, index, steps);
}

function consumeRecursiveSelector(
  input: string,
  index: number,
  steps: SelectorStep[]
) {
  const nextIndex = index + 2;
  steps.push({ type: "recursive" });

  if (nextIndex >= input.length || readChar(input, nextIndex) === ".") {
    return nextIndex;
  }

  const segment = parseSegment(input, nextIndex);
  steps.push(segment.step);
  return segment.nextIndex;
}

function consumeDirectSelector(
  input: string,
  index: number,
  steps: SelectorStep[]
) {
  const nextIndex = index + 1;
  if (nextIndex >= input.length) {
    throw new Error("Selector cannot end with '.'");
  }

  const segment = parseSegment(input, nextIndex);
  steps.push(segment.step);
  return segment.nextIndex;
}

function parseSetSegment(
  input: string,
  start: number
): { step: SelectorStep; nextIndex: number } {
  let index = skipSpaces(input, start + 1);
  const names: string[] = [];

  while (index < input.length) {
    const key = readIdentifier(input, index);
    if (!key.value) {
      throw new Error(`Expected identifier inside set at ${index}`);
    }

    names.push(key.value);
    index = skipSpaces(input, key.nextIndex);

    const char = readChar(input, index);
    if (char === "}") {
      return { step: { type: "set", names }, nextIndex: index + 1 };
    }
    if (char !== ",") {
      throw new Error(`Expected "," or "}" at ${index}`);
    }

    index = skipSpaces(input, index + 1);
  }

  throw new Error("Unterminated set selector");
}

function parseKeySegment(
  input: string,
  start: number,
  char: string
): { step: SelectorStep; nextIndex: number } {
  if (!IDENT_RE.test(char)) {
    throw new Error(`Unexpected character "${char}" at ${start}`);
  }

  const identifier = readIdentifier(input, start);
  return {
    step: { type: "key", name: identifier.value },
    nextIndex: identifier.nextIndex,
  };
}

function readIdentifier(input: string, start: number) {
  let index = start;
  let value = "";

  while (IDENT_RE.test(readChar(input, index))) {
    value += readChar(input, index);
    index += 1;
  }

  return { value, nextIndex: index };
}

function applySelectorStep(
  matches: SelectorMatch[],
  step: SelectorStep
): SelectorMatch[] {
  if (step.type === "recursive") {
    const recursiveMatches: SelectorMatch[] = [];

    for (const match of matches) {
      collectDescendants(match, recursiveMatches);
    }

    return recursiveMatches;
  }

  const output: SelectorMatch[] = [];
  for (const match of matches) {
    const children = getChildren(match.node);
    if (!children) {
      continue;
    }

    for (const [name, child] of Object.entries(children)) {
      if (!stepMatchesName(step, name)) {
        continue;
      }

      output.push({
        path: [...match.path, name],
        node: child,
      });
    }
  }

  return output;
}

function stepMatchesName(
  step: Exclude<SelectorStep, { type: "recursive" }>,
  name: string
) {
  if (step.type === "wildcard") {
    return true;
  }
  if (step.type === "set") {
    return step.names.includes(name);
  }
  return step.name === name;
}
