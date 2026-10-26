import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MyComponent from '../../src/components/MyComponent';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (
      options ? `${key} ${JSON.stringify(options)}` : key
    ),
  }),
}));

// Mock widgetConfig to control SITE_LANG in tests
vi.mock('../../src/config/widgetConfig', () => ({
  SITE_LANG: 'en',
}));

describe('<MyComponent />', () => {
  it('should render the title and initial content', () => {
    render(<MyComponent />);
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText(/Get started by editing/)).toBeInTheDocument();
  });

  it('should render the site language label with the correct interpolation params', () => {
    render(<MyComponent />);
    expect(screen.getByText('siteLang {"lang":"en"}')).toBeInTheDocument();
  });
});
