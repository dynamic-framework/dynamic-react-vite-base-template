import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MyLink from '../../src/components/MyLink';

vi.mock('@dynamic-framework/ui-react', async () => {
    const originalModule = await vi.importActual<object>('@dynamic-framework/ui-react');
    return {
        ...originalModule,
        DIcon: (props: { icon: string }) => <div data-testid="d-icon">{props.icon}</div>,
    };
});

describe('<MyLink />', () => {
  it('should render the link with correct attributes and content', () => {
    const props = {
      href: 'https://example.com',
      icon: 'test-icon',
      title: 'Test Title',
      description: 'Test Description',
    };
    render(<MyLink {...props} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', props.href);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');

    expect(screen.getByText(props.title)).toBeInTheDocument();
    expect(screen.getByText(props.description)).toBeInTheDocument();
    expect(screen.getByTestId('d-icon')).toHaveTextContent(props.icon);
  });
});
