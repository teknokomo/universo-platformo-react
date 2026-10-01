import { marketingPageTemplate } from '../../../../packages/universo-react-metahubs-backend/dist/domains/templates/data/marketing-page.template.js'
import { assertMarketingPageSeedIntegrity } from '../../../../packages/universo-react-metahubs-backend/dist/domains/templates/services/marketingPageSeedIntegrity.js'
import { assertMarketingPageTemplateBaseline } from './marketingPageBaselineContract.ts'

assertMarketingPageTemplateBaseline(marketingPageTemplate)
assertMarketingPageSeedIntegrity(marketingPageTemplate.seed)
process.stdout.write('Marketing page template baseline contract passed\n')
