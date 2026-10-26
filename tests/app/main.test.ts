import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createRoot } = vi.hoisted(() => ({
  createRoot: vi.fn(() => ({ render: vi.fn() })),
}));

vi.mock('react-dom/client', () => ({
  default: { createRoot },
}));

function setReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    get: () => state,
  });
}

async function importMain() {
  await import('../src/main');
}

describe('montaje en src/main.tsx', () => {
  beforeEach(() => {
    vi.resetModules();
    createRoot.mockClear();
    document.body.innerHTML = '<div data-widget="widgetName"></div>';
  });

  afterEach(() => {
    delete (document as { readyState?: DocumentReadyState }).readyState;
    document.body.innerHTML = '';
  });

  it("con readyState 'loading' monta tras DOMContentLoaded, una sola vez", async () => {
    setReadyState('loading');

    await importMain();

    expect(createRoot).not.toHaveBeenCalled();

    document.dispatchEvent(new Event('DOMContentLoaded'));

    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-widget]')).toHaveAttribute('data-mounted');

    document.body.insertAdjacentHTML('beforeend', '<div data-widget="widgetName"></div>');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    expect(createRoot).toHaveBeenCalledTimes(1);
  });

  it("con readyState 'complete' monta en el acto", async () => {
    setReadyState('complete');

    await importMain();

    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-widget]')).toHaveAttribute('data-mounted');
  });
});
