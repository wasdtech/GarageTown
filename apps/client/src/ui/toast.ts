import { h } from './dom';

export function createToaster(root: HTMLElement) {
  const box = h('div', { class: 'gt-toasts', 'aria-live': 'polite' });
  root.append(box);
  return (text: string, kind: 'info' | 'good' | 'bad' | 'big' = 'info', ms = 2200) => {
    const t = h('div', { class: `gt-toast gt-toast-${kind}`, role: 'status' }, text);
    box.append(t);
    setTimeout(() => t.remove(), ms);
  };
}
