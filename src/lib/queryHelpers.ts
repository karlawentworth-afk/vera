/**
 * Returns the is_demo filter value based on sessionStorage.
 * Use in SELECT queries: .eq('is_demo', getIsDemo())
 * Use in INSERT data: { ...data, is_demo: getIsDemo() }
 */
export function getIsDemo(): boolean {
  return sessionStorage.getItem('vera_demo_mode') === 'true'
}

/**
 * Shorthand: adds .eq('is_demo', getIsDemo()) to a query builder.
 */
export function demoFilter<T extends { eq: (col: string, val: boolean) => T }>(query: T): T {
  return query.eq('is_demo', getIsDemo())
}
