/** Opens the filters sheet when the library log list is already on screen. */
export const LIBRARY_FILTERS_OPEN_EVENT = "geeklogs:open-library-filters";

export function openMountedLibraryFilters(): void {
  window.dispatchEvent(new Event(LIBRARY_FILTERS_OPEN_EVENT));
}
