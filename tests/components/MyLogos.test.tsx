import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MyLogos from '../../src/components/MyLogos';

vi.mock('../../src/assets/modyoLogo.svg?react', () => ({
  default: () => <div data-testid="modyo-logo">ModyoLogo</div>,
}));

vi.mock('../../src/assets/reactLogo.svg?react', () => ({
    default: () => <div data-testid="react-logo">ReactLogo</div>,
}));

vi.mock('@dynamic-framework/ui-react', async () => {
    const originalModule = await vi.importActual<object>('@dynamic-framework/ui-react');
    return {
        ...originalModule,
        DIcon: (props: { icon: string }) => <div data-testid="d-icon">{props.icon}</div>,
    };
});

describe('<MyLogos />', () => {
  it('should render the logos and the plus icon', () => {
    render(<MyLogos />);
    expect(screen.getByTestId('modyo-logo')).toBeInTheDocument();
    expect(screen.getByTestId('react-logo')).toBeInTheDocument();
    expect(screen.getByTestId('d-icon')).toHaveTextContent('Plus');
  });
});
