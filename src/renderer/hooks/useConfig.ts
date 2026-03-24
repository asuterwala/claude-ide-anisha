import { useEffect } from 'react'
import { useAppState } from '../store'
import type { AppConfig } from '../../shared/types'

export function useConfig() {
  const { state, dispatch } = useAppState()

  useEffect(() => {
    if (!state.config) {
      window.api.loadConfig().then((config: AppConfig) => {
        dispatch({ type: 'CONFIG_LOADED', payload: config })
      })
    }
  }, [state.config, dispatch])

  return state.config
}
