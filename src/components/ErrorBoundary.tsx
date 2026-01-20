import { Component, ErrorInfo, ReactNode } from 'react';
import { Translation } from 'react-i18next';
import { DAlert, DButton, DIcon } from '@dynamic-framework/ui-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);

    // Update state with error info
    this.setState({ errorInfo });

    // Call optional error handler (for external logging like Sentry)
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI with i18n
      return (
        <Translation>
          {(t) => (
            <div className="p-4">
              <DAlert color="danger">
                <div className="d-flex align-items-start gap-3">
                  <DIcon icon="AlertTriangle" size="1.5rem" />
                  <div className="flex-grow-1">
                    <h5 className="mb-2">{t('states.boundary.title')}</h5>
                    <p className="mb-3 text-secondary">
                      {t('states.boundary.description')}
                    </p>
                    <div className="d-flex gap-2 flex-wrap">
                      <DButton
                        onClick={this.handleReset}
                        text={t('states.boundary.retry')}
                        variant="outline"
                        iconStart="RefreshCw"
                      />
                      <DButton
                        onClick={this.handleReload}
                        text={t('states.boundary.reload')}
                        variant="link"
                        iconStart="RotateCcw"
                      />
                    </div>
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                      <details className="mt-3">
                        <summary className="text-secondary cursor-pointer">
                          {t('states.boundary.details')}
                        </summary>
                        <pre className="mt-2 p-2 bg-light rounded small overflow-auto">
                          <code>
                            {this.state.error.toString()}
                            {this.state.errorInfo?.componentStack}
                          </code>
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </DAlert>
            </div>
          )}
        </Translation>
      );
    }

    return this.props.children;
  }
}
