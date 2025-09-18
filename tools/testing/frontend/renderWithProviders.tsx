import React, { ReactElement, ReactNode } from 'react'
import { render, RenderOptions, RenderResult } from '@testing-library/react'
import { ThemeProvider, Theme, ThemeOptions, createTheme } from '@mui/material/styles'
import { CssBaseline, StyledEngineProvider } from '@mui/material'
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom'
import { Provider } from 'react-redux'
import {
  configureStore,
  type EnhancedStore,
  type Reducer,
  type AnyAction,
  type PreloadedState,
} from '@reduxjs/toolkit'
import { SnackbarProvider, SnackbarProviderProps } from 'notistack'
import { I18nextProvider } from 'react-i18next'
import type { i18n as I18nInstance } from 'i18next'

import { createTestI18n } from './i18n'

export type AdditionalWrapper = React.ComponentType<{ children: ReactNode }>

type DefaultState = Record<string, unknown>

export interface CreateTestStoreOptions<S extends DefaultState = DefaultState> {
  reducer?: Reducer<S, AnyAction>
  preloadedState?: PreloadedState<S>
}

export interface RenderWithProvidersOptions<S extends DefaultState = DefaultState>
  extends Omit<RenderOptions, 'wrapper'> {
  theme?: Theme
  themeOptions?: ThemeOptions
  withTheme?: boolean
  withCssBaseline?: boolean
  i18n?: I18nInstance
  withI18n?: boolean
  routerProps?: Omit<MemoryRouterProps, 'children'>
  withRouter?: boolean
  store?: EnhancedStore<S>
  reducer?: Reducer<S, AnyAction>
  preloadedState?: PreloadedState<S>
  withRedux?: boolean
  withSnackbar?: boolean
  snackbarProps?: SnackbarProviderProps
  additionalWrappers?: AdditionalWrapper[]
}

export interface RenderWithProvidersResult<S extends DefaultState = DefaultState> extends RenderResult {
  store?: EnhancedStore<S>
  i18n?: I18nInstance
  theme?: Theme
}

const defaultReducer: Reducer<DefaultState, AnyAction> = (state = {}) => state

export function createTestStore<S extends DefaultState = DefaultState>(
  options: CreateTestStoreOptions<S> = {},
): EnhancedStore<S> {
  const { reducer = defaultReducer as Reducer<S, AnyAction>, preloadedState } = options
  return configureStore({ reducer, preloadedState })
}

export function createTestTheme(themeOptions?: ThemeOptions): Theme {
  return createTheme(themeOptions)
}

function applyAdditionalWrappers(children: ReactNode, wrappers: AdditionalWrapper[] = []): ReactNode {
  return wrappers.reduceRight((acc, Wrapper) => React.createElement(Wrapper, null, acc), children)
}

export async function renderWithProviders<S extends DefaultState = DefaultState>(
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
  }: RenderWithProvidersOptions<S> = {}
): Promise<RenderWithProvidersResult<S>> {
  const resolvedTheme = withTheme ? theme ?? createTestTheme(themeOptions) : undefined
  const resolvedI18n = withI18n ? i18n ?? (await createTestI18n()) : undefined
  const resolvedStore = withRedux ? store ?? createTestStore<S>({ reducer, preloadedState }) : undefined
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
