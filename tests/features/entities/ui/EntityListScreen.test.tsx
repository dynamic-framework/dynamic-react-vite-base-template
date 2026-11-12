import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EntityListScreen from '@/features/entities/ui/EntityListScreen';

const hooks = vi.hoisted(() => ({ useEntities: vi.fn(), useCreateEntity: vi.fn() }));
const portal = vi.hoisted(() => ({ openPortal: vi.fn(), closePortal: vi.fn() }));

vi.mock('@/features/entities/hooks/useEntities', () => hooks);

vi.mock('@dynamic-framework/ui-react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dynamic-framework/ui-react')>()),
  useDPortalContext: () => portal,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const refetch = vi.fn();
const mutateAsync = vi.fn();

function queryState(state: Partial<{ data: unknown; isLoading: boolean; isError: boolean }>) {
  hooks.useEntities.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch,
    ...state,
  });
}

describe('<EntityListScreen />', () => {
  beforeEach(() => {
    hooks.useEntities.mockReset();
    hooks.useCreateEntity.mockReturnValue({ mutateAsync });
    refetch.mockReset();
    portal.openPortal.mockReset();
  });

  it('carga: muestra el estado de carga', () => {
    queryState({ isLoading: true });

    render(<EntityListScreen />);

    expect(screen.getByText('states.loading')).toBeInTheDocument();
  });

  it('vacío: muestra el mensaje de la feature', () => {
    queryState({ data: [] });

    render(<EntityListScreen />);

    expect(screen.getByText('entities.list.empty')).toBeInTheDocument();
  });

  it('error: muestra el mensaje y reintenta', async () => {
    queryState({ isError: true });

    render(<EntityListScreen />);

    expect(screen.getByText('entities.list.error')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /states.error.retry/ }));
    expect(refetch).toHaveBeenCalled();
  });

  it('datos: pinta una fila por entidad', () => {
    queryState({
      data: [
        { id: '1', name: 'Uno', createdAt: '2024-01-01T00:00:00Z' },
        { id: '2', name: 'Dos', createdAt: '2024-01-01T00:00:00Z' },
      ],
    });

    render(<EntityListScreen />);

    const list = screen.getByRole('list', { name: 'entities.list.title' });
    expect(list).toHaveTextContent('Uno');
    expect(list).toHaveTextContent('Dos');
  });

  it('abre el modal de creación con la mutación en el payload', async () => {
    queryState({ data: [] });

    render(<EntityListScreen />);
    await userEvent.click(screen.getByRole('button', { name: /entities.list.create/ }));

    expect(portal.openPortal).toHaveBeenCalledWith('entity-create', { onCreate: mutateAsync });
  });

  it('pide la lista con el filtro de búsqueda', () => {
    queryState({ data: [] });

    render(<EntityListScreen />);

    expect(hooks.useEntities).toHaveBeenCalledWith({ search: '' });
  });
});
