import MarketingWidgetBindingDialogView from './MarketingWidgetBindingDialogView'
import { useMarketingWidgetBindingDialog } from './useMarketingWidgetBindingDialog'
import type { MarketingWidgetBindingDialogProps } from './marketingWidgetBindingDialogModel'

export default function MarketingWidgetBindingDialog(props: MarketingWidgetBindingDialogProps) {
    const model = useMarketingWidgetBindingDialog(props)
    return <MarketingWidgetBindingDialogView model={model} />
}
