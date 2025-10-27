const tabStateCache = new Map<string, Record<string, any>>()

export const getTabStateCache = () => tabStateCache

export const clearTabState = (filePath: string) => {
  tabStateCache.delete(filePath)
}

export const setTabState = (filePath: string, state: Record<string, any>) => {
  tabStateCache.set(filePath, state)
}

export const getTabState = (filePath: string) => tabStateCache.get(filePath)

export const resetTabStateCache = () => {
  tabStateCache.clear()
}
