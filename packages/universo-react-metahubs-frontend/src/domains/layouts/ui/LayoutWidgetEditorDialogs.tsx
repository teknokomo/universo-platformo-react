import type { TFunction } from 'i18next'
import type { ComponentProps } from 'react'
import { MarketingWidgetConfigDialog } from '@universo-react/template-mui'

import MenuWidgetEditorDialog from './MenuWidgetEditorDialog'
import ColumnsContainerEditorDialog from './ColumnsContainerEditorDialog'
import QuizWidgetEditorDialog from './QuizWidgetEditorDialog'
import PlayCanvasCanvasWidgetEditorDialog from './PlayCanvasCanvasWidgetEditorDialog'
import InterpretationNetworkWorkspaceWidgetEditorDialog from './InterpretationNetworkWorkspaceWidgetEditorDialog'
import WidgetBehaviorEditorDialog from './WidgetBehaviorEditorDialog'
import MarketingWidgetBindingDialog from './MarketingWidgetBindingDialog'
import type { LayoutWidgetAuthoringResult } from './useLayoutWidgetAuthoring'

interface LayoutWidgetEditorDialogsProps {
    authoring: LayoutWidgetAuthoringResult
    metahubId: string
    layoutId: string
    locale: string
    isGlobalLayout: boolean
    canManageLayouts: boolean
    canEditContent: boolean
    t: TFunction
}

/** Renders the existing dashboard and marketing widget editors from authoring state. */
export default function LayoutWidgetEditorDialogs({
    authoring,
    metahubId,
    layoutId,
    locale,
    isGlobalLayout,
    canManageLayouts,
    canEditContent,
    t
}: LayoutWidgetEditorDialogsProps) {
    const { editors, dialogs } = authoring
    const marketingConfigT: ComponentProps<typeof MarketingWidgetConfigDialog>['t'] = (key, defaultValue, options) =>
        String(t(key, { ...options, defaultValue }))

    return (
        <>
            <MenuWidgetEditorDialog
                open={editors.menu.open}
                metahubId={metahubId}
                config={editors.menu.config}
                onSave={dialogs.saveMenu}
                onCancel={dialogs.closeMenu}
            />
            <ColumnsContainerEditorDialog
                open={editors.columns.open}
                config={editors.columns.config ?? undefined}
                metahubId={metahubId}
                layoutId={layoutId}
                widgetId={editors.columns.widgetId}
                showScopeVisibility={isGlobalLayout && Boolean(editors.columns.widgetId)}
                onSave={dialogs.saveColumns}
                onCancel={dialogs.closeColumns}
            />
            <QuizWidgetEditorDialog
                open={editors.quiz.open}
                metahubId={metahubId}
                config={editors.quiz.config ?? undefined}
                onSave={dialogs.saveQuiz}
                onCancel={dialogs.closeQuiz}
            />
            <PlayCanvasCanvasWidgetEditorDialog
                open={editors.playCanvas.open}
                metahubId={metahubId}
                config={editors.playCanvas.config ?? undefined}
                layoutId={layoutId}
                widgetId={editors.playCanvas.widgetId}
                showScopeVisibility={isGlobalLayout && Boolean(editors.playCanvas.widgetId)}
                onSave={dialogs.savePlayCanvas}
                onCancel={dialogs.closePlayCanvas}
            />
            {editors.interpretationNetwork.open ? (
                <InterpretationNetworkWorkspaceWidgetEditorDialog
                    open={editors.interpretationNetwork.open}
                    config={editors.interpretationNetwork.config ?? undefined}
                    metahubId={metahubId}
                    layoutId={layoutId}
                    widgetId={editors.interpretationNetwork.widgetId}
                    showScopeVisibility={isGlobalLayout && Boolean(editors.interpretationNetwork.widgetId)}
                    onSave={dialogs.saveInterpretationNetwork}
                    onCancel={dialogs.closeInterpretationNetwork}
                />
            ) : null}
            <WidgetBehaviorEditorDialog
                open={editors.behavior.open}
                config={editors.behavior.config ?? undefined}
                metahubId={metahubId}
                layoutId={layoutId}
                widgetId={editors.behavior.widgetId}
                widgetKey={editors.behavior.widgetKey}
                widgetLabel={editors.behavior.widgetLabel}
                showScopeVisibility={isGlobalLayout && Boolean(editors.behavior.widgetId)}
                onSave={dialogs.saveBehavior}
                onCancel={dialogs.closeBehavior}
            />
            <MarketingWidgetBindingDialog
                open={editors.marketingBinding.open}
                templateKey={authoring.templateKey}
                metahubId={metahubId}
                layoutId={layoutId}
                zone={editors.marketingBinding.zone ?? (authoring.templateKey === 'dashboard' ? 'center' : 'marketing-main')}
                widgetKey={
                    editors.marketingBinding.widgetKey ?? (authoring.templateKey === 'dashboard' ? 'overviewTitle' : 'marketing.hero')
                }
                widgetId={editors.marketingBinding.widgetId}
                sourceWidgetId={editors.marketingBinding.sourceWidgetId}
                duplicateMode={editors.marketingBinding.duplicateMode}
                rendererConfigPending={editors.marketingBinding.rendererConfigPending}
                openSelectedRecordOnOpen={editors.marketingBinding.openSelectedRecordOnOpen}
                locale={locale}
                rendererConfig={editors.marketingBinding.config ?? {}}
                sectionTargets={authoring.sectionTargets}
                canManageLayouts={canManageLayouts}
                canEditContent={canEditContent}
                onClose={dialogs.closeMarketingBinding}
                onBindingSaved={dialogs.onBindingSaved}
                onSelection={dialogs.saveMarketingSelection}
                onConfigurePresentation={dialogs.configureMarketingPresentation}
            />
            {editors.marketing.open && editors.marketing.widgetKey ? (
                <MarketingWidgetConfigDialog
                    open={editors.marketing.open}
                    widgetKey={editors.marketing.widgetKey}
                    initialConfig={editors.marketing.config}
                    title={authoring.widgetLabelByKey[editors.marketing.widgetKey] ?? editors.marketing.widgetKey}
                    t={marketingConfigT}
                    onSave={dialogs.saveMarketingConfig}
                    onCancel={dialogs.closeMarketingConfig}
                />
            ) : null}
        </>
    )
}
