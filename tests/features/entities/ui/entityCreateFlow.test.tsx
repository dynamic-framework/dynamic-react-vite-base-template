/**
 * Flujo completo con el mismo árbol que src/app/main.tsx y App.tsx: el portal
 * registrado en DContextProvider y la feature dentro del QueryProvider. El
 * modal se pinta fuera del QueryProvider, así que este test falla si vuelve a
 * depender de él.
 */
import { DContextProvider } from '@dynamic-framework/ui-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  EntityCreateModal,
  EntityListScreen,
  type EntityPortals,
} from '@/features/entities';

vi.mock('@/config/widgetConfig', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/widgetConfig')>()),
  USE_MOCKS: true,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('crear una entidad desde la lista', () => {
  it('el modal crea en modo mocks y la lista se actualiza', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <DContextProvider<EntityPortals> availablePortals={{ 'entity-create': EntityCreateModal }}>
        <QueryClientProvider client={queryClient}>
          <EntityListScreen />
        </QueryClientProvider>
      </DContextProvider>,
    );

    const list = await screen.findByRole('list', {}, { timeout: 3000 });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: /entities.list.create/ }));
    await userEvent.type(await screen.findByLabelText('entities.create.name'), 'Cuarta');
    await userEvent.click(screen.getByRole('button', { name: /common.save/ }));

    expect(await screen.findByText('Cuarta', {}, { timeout: 3000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('entities.create.name')).not.toBeInTheDocument());
  });
});
