import * as DynamicFramework from '@dynamic-framework/ui-react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import App from '@/app/App';
import { CONTEXT_CONFIG, getMissingVariables } from '@/config/widgetConfig';

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

// Las variables que faltan las decide cada test; findMissingVariables y el
// registro se prueban en tests/config/widgetConfig.test.ts.
vi.mock('@/config/widgetConfig', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/widgetConfig')>()),
  getMissingVariables: vi.fn(),
}));

describe('<App />', () => {
  const setContextMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (DynamicFramework.useDContext as Mock).mockReturnValue({
      setContext: setContextMock,
    });
    (getMissingVariables as Mock).mockReturnValue([]);
  });

  it('should set context with correct configuration on mount', async () => {
    render(<App />);
    await waitFor(() => {
      expect(setContextMock).toHaveBeenCalledWith(CONTEXT_CONFIG);
    });
  });

  it('should render HomePage', () => {
    render(<App />);
    expect(screen.getByText('home.getStarted')).toBeInTheDocument();
  });

  describe('gate de configuración', () => {
    it('con todas las variables obligatorias pinta la página', () => {
      render(<App />);
      expect(screen.queryByText('config.missing.title')).not.toBeInTheDocument();
      expect(screen.getByText('home.getStarted')).toBeInTheDocument();
    });

    it('si faltan variables, pinta cuáles en lugar de la página', () => {
      (getMissingVariables as Mock).mockReturnValue(['vars.api-base-url', 'vars.other-var']);
      render(<App />);

      expect(screen.getByText('config.missing.title')).toBeInTheDocument();
      expect(screen.getByText('vars.api-base-url')).toBeInTheDocument();
      expect(screen.getByText('vars.other-var')).toBeInTheDocument();
      expect(screen.queryByText('home.getStarted')).not.toBeInTheDocument();
    });

    it('consulta las faltantes al renderizar', () => {
      render(<App />);
      expect(getMissingVariables).toHaveBeenCalled();
    });
  });
});
