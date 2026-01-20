import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';

type LoadingVariant = 'spinner' | 'list' | 'card' | 'table';

interface DataStateWrapperProps<T> {
  isLoading: boolean;
  isError: boolean;
  data: T[] | undefined;
  onRetry?: () => void;
  emptyMessage?: string;
  emptyIcon?: string;
  emptyActionText?: string;
  onEmptyAction?: () => void;
  errorMessage?: string;
  loadingVariant?: LoadingVariant;
  loadingItems?: number;
  children: (data: T[]) => ReactNode;
}

export function DataStateWrapper<T>({
  isLoading,
  isError,
  data,
  onRetry,
  emptyMessage,
  emptyIcon,
  emptyActionText,
  onEmptyAction,
  errorMessage,
  loadingVariant = 'list',
  loadingItems = 3,
  children
}: DataStateWrapperProps<T>) {
  const { t } = useTranslation();

  // 1. Loading
  if (isLoading) {
    return <LoadingState variant={loadingVariant} items={loadingItems} />;
  }

  // 2. Error
  if (isError) {
    return (
      <ErrorState
        message={errorMessage ?? t('states.error.default')}
        onRetry={onRetry}
      />
    );
  }

  // 3. Empty
  if (!data?.length) {
    return (
      <EmptyState
        message={emptyMessage ?? t('states.empty.default')}
        icon={emptyIcon}
        actionText={emptyActionText}
        onAction={onEmptyAction}
      />
    );
  }

  // 4. Success
  return <>{children(data)}</>;
}
