import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntityCreateModal } from '@/features/entities/ui/EntityCreateModal';

const portal = vi.hoisted(() => ({
  openPortal: vi.fn(),
  closePortal: vi.fn(),
  stack: [] as Array<{ name: string; payload: unknown }>,
}));

vi.mock('@dynamic-framework/ui-react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dynamic-framework/ui-react')>()),
  useDPortalContext: () => portal,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const onCreate = vi.fn();

/** Pinta el modal como el portal de arriba de la pila. */
function renderModal() {
  const payload = { onCreate };
  portal.stack = [{ name: 'entity-create', payload }];
  const view = render(<EntityCreateModal name="entity-create" payload={payload} />);
  return { ...view, payload };
}

describe('<EntityCreateModal />', () => {
  beforeEach(() => {
    onCreate.mockReset();
    portal.closePortal.mockReset();
  });

  it('crea con el nombre sin espacios y cierra el portal', async () => {
    onCreate.mockResolvedValue(undefined);
    renderModal();

    await userEvent.type(screen.getByLabelText('entities.create.name'), '  Nueva  ');
    await userEvent.click(screen.getByRole('button', { name: /common.save/ }));

    expect(onCreate).toHaveBeenCalledWith({ name: 'Nueva' });
    await waitFor(() => expect(portal.closePortal).toHaveBeenCalled());
  });

  it('no crea con el nombre vacío', async () => {
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /common.save/ }));

    expect(onCreate).not.toHaveBeenCalled();
  });

  it('si falla, muestra el error y no cierra', async () => {
    onCreate.mockRejectedValue(new Error('fallo'));
    renderModal();

    await userEvent.type(screen.getByLabelText('entities.create.name'), 'Nueva');
    await userEvent.click(screen.getByRole('button', { name: /common.save/ }));

    expect(await screen.findByText('entities.create.error')).toBeInTheDocument();
    expect(portal.closePortal).not.toHaveBeenCalled();
  });

  it('si se cerró y se abrió otro mientras creaba, no cierra el nuevo', async () => {
    let finish: () => void = () => {};
    onCreate.mockReturnValue(new Promise<void>((resolve) => {
      finish = resolve;
    }));
    const { rerender, payload } = renderModal();

    await userEvent.type(screen.getByLabelText('entities.create.name'), 'Nueva');
    await userEvent.click(screen.getByRole('button', { name: /common.save/ }));

    // Otra apertura del portal queda arriba con su propio payload.
    portal.stack = [{ name: 'entity-create', payload: { onCreate } }];
    rerender(<EntityCreateModal name="entity-create" payload={payload} />);
    await act(async () => finish());

    expect(portal.closePortal).not.toHaveBeenCalled();
  });
});
