import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MyComponent from '../../src/components/MyComponent';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock MyLogos component
vi.mock('../../src/components/MyLogos', () => ({
  default: () => <div data-testid="my-logos">MyLogos</div>,
}));

describe('<MyComponent />', () => {
  it('should render the title and initial content', () => {
    render(<MyComponent />);
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText(/Get started by editing/)).toBeInTheDocument();
    expect(screen.getByText('Click me!')).toBeInTheDocument();
  });

  it('should show logos when "Click me!" button is clicked', () => {
    render(<MyComponent />);
    const button = screen.getByText('Click me!');
    fireEvent.click(button);
    expect(screen.getByTestId('my-logos')).toBeInTheDocument();
  });

  it('should hide logos when "Click me!" button is clicked twice', () => {
    render(<MyComponent />);
    const button = screen.getByText('Click me!');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.queryByTestId('my-logos')).not.toBeInTheDocument();
  });
});
