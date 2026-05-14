/**
 * Returns the is_demo filter value based on sessionStorage.
 * Call this in every query that touches data tables.
 */
export function getIsDemo(): boolean {
  return sessionStorage.getItem('vera_demo_mode') === 'true'
}

/**
 * Shorthand: adds .eq('is_demo', getIsDemo()) to a query builder.
 * Usage: demoFilter(supabase.from('jobs').select('*')).then(...)
 */
export function demoFilter<T extends { eq: (col: string, val: boolean) => T }>(query: T): T {
  return query.eq('is_demo', getIsDemo())
}
