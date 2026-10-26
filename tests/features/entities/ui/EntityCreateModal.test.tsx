import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntityCreateModal } from '@/features/entities/ui/EntityCreateModal';

const portal = vi.hoisted(() => ({ openPortal: vi.fn(), closePortal: vi.fn() }));

vi.mock('@dynamic-framework/ui-react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dynamic-framework/ui-react')>()),
  useDPortalContext: () => portal,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const onCreate = vi.fn();

function renderModal() {
  render(<EntityCreateModal name="entity-create" payload={{ onCreate }} />);
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
});
