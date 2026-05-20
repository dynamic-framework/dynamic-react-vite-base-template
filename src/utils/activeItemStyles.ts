/**
 * Utility for managing visual styles in selectable list items.
 *
 * When DListGroupItem has active={true}, background changes to primary color.
 * Internal elements need adjusted colors to maintain contrast.
 *
 * @example
 * const styles = getActiveItemStyles(isSelected);
 * <DIcon color={styles.iconColor} />
 * <small className={styles.subtextClass}>...</small>
 */

type BootstrapColor = 'primary' | 'secondary' | 'light' | 'success' | 'danger' | 'warning' | 'info';

export interface ActiveItemStyles {
  /** For DIcon color prop when icon should be primary normally */
  iconColor: BootstrapColor;
  /** For DIcon color prop when icon should be secondary normally */
  iconColorSecondary: BootstrapColor;
  /** For secondary text (account numbers, dates, etc.) */
  subtextClass: string;
  /** For danger/negative text (negative balances, errors) */
  dangerTextClass: string;
  /** For DBadge theme prop */
  badgeTheme: BootstrapColor;
  /** For success text */
  successTextClass: string;
}

/**
 * Returns appropriate style values based on selection state.
 * Use these values to maintain contrast when items are selected.
 *
 * @param isActive - Whether the item is currently selected/active
 * @returns Object with style values for various UI elements
 */
export function getActiveItemStyles(isActive: boolean): ActiveItemStyles {
  return {
    iconColor: isActive ? 'light' : 'primary',
    iconColorSecondary: isActive ? 'light' : 'secondary',
    subtextClass: isActive ? 'opacity-75' : 'text-muted',
    dangerTextClass: isActive ? 'text-warning' : 'text-danger',
    badgeTheme: isActive ? 'light' : 'secondary',
    successTextClass: isActive ? 'opacity-90' : 'text-success',
  };
}

/**
 * Simplified version that returns just the most common adjustments.
 * Use when you only need icon and text adjustments.
 */
export function getActiveItemBasicStyles(isActive: boolean) {
  return {
    iconColor: (isActive ? 'light' : 'primary') as BootstrapColor,
    textClass: isActive ? 'opacity-75' : 'text-muted',
  };
}
