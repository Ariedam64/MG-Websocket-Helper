/**
 * Minimal RFC 6902 JSON Patch implementation.
 * Operates on plain JS objects/arrays (mutates in place for performance).
 */

// The RFC's "one past the end" token, used to append to an array.
const APPEND = "-";

function decodePointer(path) {
  return path
    .split("/")
    .slice(1)
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

// An empty segment is a key named "", not index zero.
function isNumeric(value) {
  return /^\d+$/.test(value);
}

function addressesArray(key) {
  return isNumeric(key) || key === APPEND;
}

// A missing child is an array when the next step indexes into it, an object otherwise.
function emptyChildFor(nextKey) {
  return addressesArray(nextKey) ? [] : {};
}

/**
 * Write `value` into `array` at `key`.
 *
 * An add inserts and shifts the rest along, as the RFC says: the server replaces
 * a user slot with `remove /child/data/userSlots/i` then `add .../userSlots/i`,
 * so treating the add as a replace drops a slot on every frame. A replace
 * overwrites in place. Either way an index past the end appends, never leaving
 * a hole.
 */
function writeIntoArray(array, key, value, op) {
  const idx = key === APPEND ? array.length : parseInt(key, 10);
  if (idx >= array.length) array.push(value);
  else if (op === "add") array.splice(idx, 0, value);
  else array[idx] = value;
}

/**
 * Apply a single patch operation to a target object.
 * @param {object} target - The root state object
 * @param {string} path - JSON pointer (e.g. "/data/players/0/name")
 * @param {*} value - The value to set (ignored for "remove")
 * @param {string} op - "add", "replace", or "remove"; anything else (move,
 *   copy, test - never seen from the server) leaves the tree unchanged
 */
function applyPatch(target, path, value, op) {
  // Skip leading "data" segment (matches game's patch format)
  const segments = decodePointer(path);
  return applySegments(target, segments[0] === "data" ? segments.slice(1) : segments, value, op);
}

/**
 * Same as applyPatch, but the pointer is taken literally from the root. This
 * is how the game applies a frame: to the whole `fullState`
 * ({ data: room, child: { data: game } }).
 */
function applyPointer(target, path, value, op) {
  return applySegments(target, decodePointer(path), value, op);
}

function applySegments(target, segs, value, op) {
  if (segs.length === 0) return value !== undefined ? value : target;

  if (op !== "remove" && (value === undefined || (op !== "add" && op !== "replace"))) {
    return target;
  }

  let current = target;

  // Navigate to the parent of the target key
  for (let i = 0; i < segs.length - 1; i++) {
    const key = segs[i];
    const nextKey = segs[i + 1];

    if (Array.isArray(current)) {
      if (!isNumeric(key)) return target;
      const idx = parseInt(key, 10);
      if (idx >= current.length) {
        // Past the end: append rather than pad the gap with nulls.
        const child = emptyChildFor(nextKey);
        current.push(child);
        current = child;
        continue;
      }
      if (current[idx] === undefined || current[idx] === null) {
        current[idx] = emptyChildFor(nextKey);
      }
      current = current[idx];
    } else if (typeof current === "object" && current !== null) {
      if (current[key] === undefined || current[key] === null) {
        current[key] = emptyChildFor(nextKey);
      }
      current = current[key];
    } else {
      return target;
    }
  }

  const lastKey = segs[segs.length - 1];

  if (op === "remove") {
    if (Array.isArray(current)) {
      if (isNumeric(lastKey)) current.splice(parseInt(lastKey, 10), 1);
    } else if (typeof current === "object" && current !== null) {
      delete current[lastKey];
    }
  } else if (Array.isArray(current)) {
    if (addressesArray(lastKey)) writeIntoArray(current, lastKey, value, op);
  } else if (typeof current === "object" && current !== null) {
    current[lastKey] = value;
  }

  return target;
}

module.exports = { applyPatch, applyPointer, decodePointer };
