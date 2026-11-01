import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Bersihkan DOM dan sesi login di antara test.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
