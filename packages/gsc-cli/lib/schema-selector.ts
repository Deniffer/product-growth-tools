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

  const parsed = parseSegment(input, nextIndex);
  steps.push(parsed.step);
  return parsed.nextIndex;
}

function consumeDirectSelector(
  input: string,
  index: number,
  steps: SelectorStep[]
) {
  const nextIndex = index + 1;

  if (nextIndex >= input.length) {
    if (input.length === 1 && steps.length === 0) {
      return nextIndex;
    }
    throw new Error(`Expected identifier at ${nextIndex}`);
  }

  const parsed = parseSegment(input, nextIndex);
  steps.push(parsed.step);
  return parsed.nextIndex;
}

function applySelectorStep(current: SelectorMatch[], step: SelectorStep) {
  if (step.type === "recursive") {
    return expandRecursiveMatches(current);
  }

  return expandNamedMatches(current, step);
}

function expandRecursiveMatches(current: SelectorMatch[]) {
  const expanded: SelectorMatch[] = [];

  for (const match of current) {
    collectDescendants(match, expanded);
  }

  return expanded;
}

function expandNamedMatches(
  current: SelectorMatch[],
  step: Exclude<SelectorStep, { type: "recursive" }>
) {
  const next: SelectorMatch[] = [];

  for (const match of current) {
    const children = getChildren(match.node);
    if (!children) {
      continue;
    }

    pushChildMatches(next, match.path, children, step);
  }

  return next;
}

function pushChildMatches(
  output: SelectorMatch[],
  basePath: string[],
  children: Record<string, Router>,
  step: Exclude<SelectorStep, { type: "recursive" }>
) {
  if (step.type === "key") {
    pushIfPresent(output, basePath, step.name, children[step.name]);
    return;
  }

  if (step.type === "wildcard") {
    for (const [name, child] of Object.entries(children)) {
      pushIfPresent(output, basePath, name, child);
    }
    return;
  }

  for (const name of step.names) {
    pushIfPresent(output, basePath, name, children[name]);
  }
}

function pushIfPresent(
  output: SelectorMatch[],
  basePath: string[],
  name: string,
  child: Router | undefined
) {
  if (!child) {
    return;
  }

  output.push({ path: [...basePath, name], node: child });
}

function parseSetSegment(
  input: string,
  start: number
): { step: SelectorStep; nextIndex: number } {
  let index = skipSpaces(input, start + 1);
  const names: string[] = [];

  if (readChar(input, index) === "}") {
    throw new Error("Selector set cannot be empty");
  }

  while (index < input.length) {
    const parsedName = parseIdentifier(input, index);
    names.push(parsedName.name);
    index = skipSpaces(input, parsedName.nextIndex);

    const currentChar = readChar(input, index);
    if (currentChar === ",") {
      index = skipSpaces(input, index + 1);
      continue;
    }
    if (currentChar === "}") {
      return { step: { type: "set", names }, nextIndex: index + 1 };
    }

    throw new Error(`Expected "," or "}" at ${index}`);
  }

  throw new Error(`Expected "," or "}" at ${index}`);
}

function parseKeySegment(
  input: string,
  start: number,
  char: string
): { step: SelectorStep; nextIndex: number } {
  if (!IDENT_RE.test(char)) {
    throw new Error(`Expected identifier at ${start}`);
  }

  const parsed = parseIdentifier(input, start);
  return {
    step: { type: "key", name: parsed.name },
    nextIndex: parsed.nextIndex,
  };
}

function parseIdentifier(input: string, start: number) {
  let index = start;

  while (index < input.length && IDENT_RE.test(readChar(input, index))) {
    index += 1;
  }

  if (index === start) {
    throw new Error(`Expected identifier at ${start}`);
  }

  return {
    name: input.slice(start, index),
    nextIndex: index,
  };
}
