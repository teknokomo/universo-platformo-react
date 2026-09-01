import { marketingPageTemplate } from '../../../../packages/universo-react-metahubs-backend/dist/domains/templates/data/marketing-page.template.js'
import { assertMarketingPageTemplateBaseline } from './marketingPageBaselineContract.ts'

assertMarketingPageTemplateBaseline(marketingPageTemplate)
process.stdout.write('Marketing page template baseline contract passed\n')
