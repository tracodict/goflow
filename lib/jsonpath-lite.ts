/** Lightweight JSONPath subset (dot + bracket + numeric indices, no filters) */

export interface JsonPathSegment { key: string | number }

export function parseJsonPath(path: string): JsonPathSegment[] {
  const segs: JsonPathSegment[] = [];
  let i = 0;
  while (i < path.length) {
    if (path[i] === '.') { i++; continue; }
    if (path[i] === '[') {
      const end = path.indexOf(']', i);
      if (end === -1) throw new Error('Unmatched ] in path');
      const token = path.slice(i+1, end).trim();
      if (/^\d+$/.test(token)) segs.push({ key: Number(token) }); else if (/^['"].+['"]$/.test(token)) {
        segs.push({ key: token.slice(1, -1) });
      } else {
        segs.push({ key: token });
      }
      i = end + 1;
      continue;
    }
    // dot-style identifier
    let j = i;
    while (j < path.length && /[A-Za-z0-9_\-$]/.test(path[j])) j++;
    segs.push({ key: path.slice(i, j) });
    i = j;
  }
  return segs;
}

export function getAtPath(root: any, path: string): any {
  if (!path) return root;
  const segs = parseJsonPath(path);
  let cur = root;
  for (const { key } of segs) {
    if (cur == null) return undefined;
    cur = (cur as any)[key as any];
  }
  return cur;
}

export function setAtPath(root: any, path: string, value: any): any {
  if (!path) return value;
  const segs = parseJsonPath(path);
  const clone = Array.isArray(root) ? [...root] : { ...root };
  let cur: any = clone;
  for (let i = 0; i < segs.length; i++) {
    const k = segs[i].key as any;
    const last = i === segs.length - 1;
    if (last) {
      cur[k] = value;
    } else {
      const next = cur[k];
      if (next == null) {
        // choose container type based on next segment
        const nextSeg = segs[i+1].key;
        cur[k] = typeof nextSeg === 'number' ? [] : {};
      } else if (Array.isArray(next)) {
        cur[k] = [...next];
      } else if (typeof next === 'object') {
        cur[k] = { ...next };
      } else {
        cur[k] = {};
      }
      cur = cur[k];
    }
  }
  return clone;
}

export function deleteAtPath(root: any, path: string): any {
  const segs = parseJsonPath(path);
  if (segs.length === 0) return root;
  const clone = Array.isArray(root) ? [...root] : { ...root };
  let cur: any = clone;
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i].key as any;
    cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...cur[k] };
    cur = cur[k];
    if (cur == null) return clone;
  }
  const lastKey = segs[segs.length - 1].key as any;
  if (Array.isArray(cur)) {
    if (typeof lastKey === 'number') cur.splice(lastKey, 1);
  } else if (cur && typeof cur === 'object') {
    delete cur[lastKey];
  }
  return clone;
}

// Simple tests (can be removed or gated later)
// Lightweight self-check when explicitly enabled
if ((process.env.NODE_ENV as string) === 'test-lite') {
  const obj = { a: { b: [ { c: 1 } ] } };
  const v = getAtPath(obj, 'a.b[0].c');
  if (v !== 1) console.error('jsonpath-lite get failed');
}
