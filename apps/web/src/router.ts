import { useEffect, useState } from 'react';

export type RouteName =
  | 'dashboard'
  | 'classes'
  | 'students'
  | 'assignments'
  | 'my-classes'
  | 'attendance'
  | 'reports'
  | 'fees'
  | 'settings'
  | 'backup';

export function navigate(route: RouteName, params?: Record<string, string | number>) {
  let hash = `#/${route}`;
  if (params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
    hash += `?${qs.toString()}`;
  }
  if (window.location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}

export function parseHash(): { route: RouteName | ''; params: URLSearchParams } {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query] = raw.split('?');
  const clean = path.replace(/\/+$/, '');
  const known: RouteName[] = [
    'dashboard', 'classes', 'students', 'assignments', 'my-classes',
    'attendance', 'reports', 'fees', 'settings', 'backup',
  ];
  const route = (known.includes(clean as RouteName) ? clean : '') as RouteName | '';
  return { route, params: new URLSearchParams(query ?? '') };
}

export function useRoute(): { route: RouteName | ''; params: URLSearchParams } {
  const [state, setState] = useState(parseHash);
  useEffect(() => {
    const onChange = () => setState(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return state;
}