import React, { ReactElement, ReactNode } from 'react'
import { render, RenderOptions, RenderResult } from '@testing-library/react'
import { ThemeProvider, Theme, ThemeOptions, createTheme } from '@mui/material/styles'
import { CssBaseline, StyledEngineProvider } from '@mui/material'
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom'
import { Provider } from 'react-redux'
import type { Store, Reducer, AnyAction } from 'redux'
import { createStore } from 'redux'
import { SnackbarProvider, SnackbarProviderProps } from 'notistack'
import { I18nextProvider } from 'react-i18next'
import type { i18n as I18nInstance } from 'i18next'

import { createTestI18n } from './i18n'

export type AdditionalWrapper = React.ComponentType<{ children: ReactNode }>

export interface CreateTestStoreOptions {
  reducer?: Reducer<any, AnyAction>
  preloadedState?: unknown
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  theme?: Theme
  themeOptions?: ThemeOptions
  withTheme?: boolean
  withCssBaseline?: boolean
  i18n?: I18nInstance
  withI18n?: boolean
  routerProps?: Omit<MemoryRouterProps, 'children'>
  withRouter?: boolean
  store?: Store
  reducer?: Reducer<any, AnyAction>
  preloadedState?: unknown
  withRedux?: boolean
  withSnackbar?: boolean
  snackbarProps?: SnackbarProviderProps
  additionalWrappers?: AdditionalWrapper[]
}

export interface RenderWithProvidersResult extends RenderResult {
  store?: Store
  i18n?: I18nInstance
  theme?: Theme
}

const defaultReducer: Reducer<any, AnyAction> = (state = {}) => state

export function createTestStore(options: CreateTestStoreOptions = {}): Store {
  const { reducer = defaultReducer, preloadedState } = options
  return createStore(reducer, preloadedState as any)
}

export function createTestTheme(themeOptions?: ThemeOptions): Theme {
  return createTheme(themeOptions)
}

function applyAdditionalWrappers(children: ReactNode, wrappers: AdditionalWrapper[] = []): ReactNode {
  return wrappers.reduceRight((acc, Wrapper) => React.createElement(Wrapper, null, acc), children)
}

export function renderWithProviders(
  ui: ReactElement,
  {
    theme,
    themeOptions,
    withTheme = true,
    withCssBaseline = true,
    i18n,
    withI18n = true,
    routerProps,
    withRouter = true,
    store,
    reducer,
    preloadedState,
    withRedux = true,
    withSnackbar = false,
    snackbarProps,
    additionalWrappers,
    ...renderOptions
  }: RenderWithProvidersOptions = {}
): RenderWithProvidersResult {
  const resolvedTheme = withTheme ? theme ?? createTestTheme(themeOptions) : undefined
  const resolvedI18n = withI18n ? i18n ?? createTestI18n() : undefined
  const resolvedStore = withRedux ? store ?? createTestStore({ reducer, preloadedState }) : undefined
  const memoryRouterProps: MemoryRouterProps | undefined = withRouter
    ? {
        initialEntries: ['/'],
        ...routerProps,
      }
    : undefined

  const Providers = ({ children }: { children: ReactNode }) => {
    let content = children

    content = applyAdditionalWrappers(content, additionalWrappers)

    if (withSnackbar) {
      content = <SnackbarProvider {...snackbarProps}>{content}</SnackbarProvider>
    }

    if (withRouter && memoryRouterProps) {
      content = <MemoryRouter {...memoryRouterProps}>{content}</MemoryRouter>
    }

    if (withI18n && resolvedI18n) {
      content = <I18nextProvider i18n={resolvedI18n}>{content}</I18nextProvider>
    }

    if (withTheme && resolvedTheme) {
      content = (
        <StyledEngineProvider injectFirst>
          <ThemeProvider theme={resolvedTheme}>
            {withCssBaseline ? <CssBaseline /> : null}
            {content}
          </ThemeProvider>
        </StyledEngineProvider>
      )
    }

    if (withRedux && resolvedStore) {
      content = <Provider store={resolvedStore}>{content}</Provider>
    }

    return <>{content}</>
  }

  const result = render(ui, {
    ...renderOptions,
    wrapper: Providers,
  })

  return {
    ...result,
    store: resolvedStore,
    i18n: resolvedI18n,
    theme: resolvedTheme,
  }
}

export * from '@testing-library/react'
