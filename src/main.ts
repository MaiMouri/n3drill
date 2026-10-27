import './style.css';
import { boot } from './app';
import { safeLocalStorage } from './store';

const root = document.getElementById('app');
if (root) {
  void boot(root, {
    storage: safeLocalStorage(),
    fetchText: async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      return res.text();
    },
  });
}
