import CssBaseline from '@mui/material/CssBaseline'
// import Divider from '@mui/material/Divider'
import AppTheme from '../../components/shared/AppTheme'
import AppAppBar from './components/AppAppBar'
import Hero from './components/Hero'
// MVP: Temporarily commented out - will be restored later
// import LogoCollection from './components/LogoCollection'
// import Highlights from './components/Highlights'
// import Pricing from './components/Pricing'
// import Features from './components/Features'
import Testimonials from './components/Testimonials'
// import FAQ from './components/FAQ'
// import Footer from './components/Footer'

export default function MarketingPage(props: { disableCustomTheme?: boolean }) {
  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />

      <AppAppBar />
      <Hero />
      <div>
        {/* MVP: Temporarily commented out - will be restored later */}
        {/* <LogoCollection /> */}
        {/* <Features /> */}
        {/* <Divider /> */}
        <Testimonials />
        {/* <Divider /> */}
        {/* <Highlights /> */}
        {/* <Divider /> */}
        {/* <Pricing /> */}
        {/* <Divider /> */}
        {/* <FAQ /> */}
        {/* <Divider /> */}
        {/* <Footer /> */}
      </div>
    </AppTheme>
  )
}
