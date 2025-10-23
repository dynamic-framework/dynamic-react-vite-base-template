import * as DynamicFramework from '@dynamic-framework/ui-react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import App from '../src/App';
import { CONTEXT_CONFIG } from '../src/config/widgetConfig';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the useDContext hook
vi.mock('@dynamic-framework/ui-react', async () => {
  const originalModule = await vi.importActual<typeof DynamicFramework>('@dynamic-framework/ui-react');
  return {
    ...originalModule,
    useDContext: vi.fn(),
  };
});

describe('<App />', () => {
  const setContextMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (DynamicFramework.useDContext as Mock).mockReturnValue({
      setContext: setContextMock,
    });
  });

  it('should set context with correct configuration on mount', async () => {
    render(<App />);
    await waitFor(() => {
      expect(setContextMock).toHaveBeenCalledWith(CONTEXT_CONFIG);
    });
  });

  it('should render MyComponent', () => {
    render(<App />);
    expect(screen.getByText('Get started by editing')).toBeInTheDocument();
    expect(screen.getByText('Click me!')).toBeInTheDocument();
  });
});
