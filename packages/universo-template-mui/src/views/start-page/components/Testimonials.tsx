import Card from '@mui/material/Card'
// MVP: CardHeader commented out - not used in current simplified layout
// import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
// MVP: Avatar commented out - not used in current simplified layout
// import Avatar from '@mui/material/Avatar'
import Typography from '@mui/material/Typography'
// MVP: Box commented out - not used in current simplified layout
// import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
// MVP: useColorScheme commented out - not used in current simplified layout
// import { useColorScheme } from '@mui/material/styles'

// Universo ecosystem product cards
const universoProducts = [
    {
        title: 'Universo Kompendio',
        description:
            'Вместе собираем и структурируем знания о мире, создаём образование будущего — чтобы приблизить Эру Текнокомо: шестой технологический уклад и социальную справедливость.'
    },
    {
        title: 'Universo Platformo',
        description:
            'Общий абстрактный слой для построения метахабов управления, где можно проектировать процессы, сервисы и интерфейсы под любые отрасли и масштабы.'
    },
    {
        title: 'Universo Kiberplano',
        description:
            'Система всемирного планирования и реализации: объединяет цели, планы, задачи и ресурсы, координирует исполнение и управляет роботизированными процессами.'
    },
    {
        title: 'Universo Grandaringo',
        description:
            'Творческий контур экосистемы: инструменты для медиа и кино, пространство совместной разработки, коммуникации, мессенджер и управление контент-процессами.'
    }
]

/* MVP: Logo arrays commented out - not used in current simplified layout
const darkModeLogos = [
  'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/6560628e8573c43893fe0ace_Sydney-white.svg',
  'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/655f4d520d0517ae8e8ddf13_Bern-white.svg',
  'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/655f46794c159024c1af6d44_Montreal-white.svg',
  'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/61f12e891fa22f89efd7477a_TerraLight.svg',
  'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/6560a09d1f6337b1dfed14ab_colorado-white.svg',
  'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/655f5caa77bf7d69fb78792e_Ankara-white.svg',
];

const lightModeLogos = [
  'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/6560628889c3bdf1129952dc_Sydney-black.svg',
  'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/655f4d4d8b829a89976a419c_Bern-black.svg',
  'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/655f467502f091ccb929529d_Montreal-black.svg',
  'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/61f12e911fa22f2203d7514c_TerraDark.svg',
  'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/6560a0990f3717787fd49245_colorado-black.svg',
  'https://assets-global.website-files.com/61ed56ae9da9fd7e0ef0a967/655f5ca4e548b0deb1041c33_Ankara-black.svg',
];

const logoStyle = {
  width: '64px',
  opacity: 0.3,
};
*/

export default function Testimonials() {
    /* MVP: useColorScheme logic commented out - not used in current simplified layout
  const { mode, systemMode } = useColorScheme();

  let logos;
  if (mode === 'system') {
    if (systemMode === 'light') {
      logos = lightModeLogos;
    } else {
      logos = darkModeLogos;
    }
  } else if (mode === 'light') {
    logos = lightModeLogos;
  } else {
    logos = darkModeLogos;
  }
  */

    return (
        <Container
            id='testimonials'
            sx={{
                // Cards at bottom - minimal padding to match header spacing
                pt: { xs: 2, sm: 2 },
                pb: { xs: 3.5, sm: 3.5 },
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: { xs: 2, sm: 2 }
            }}
        >
            {/* MVP: Testimonials header temporarily commented out
      <Box
        sx={{
          width: { sm: '100%', md: '60%' },
          textAlign: { sm: 'left', md: 'center' },
        }}
      >
        <Typography
          component="h2"
          variant="h4"
          gutterBottom
          sx={{ color: 'text.primary' }}
        >
          Testimonials
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          See what our customers love about our products. Discover how we excel in
          efficiency, durability, and satisfaction. Join us for quality, innovation,
          and reliable support.
        </Typography>
      </Box>
      */}
            <Grid container spacing={2}>
                {universoProducts.map((product, index) => (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index} sx={{ display: 'flex' }}>
                        <Card
                            variant='outlined'
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                flexGrow: 1
                            }}
                        >
                            <CardContent>
                                <Typography variant='h6' component='h3' gutterBottom sx={{ fontWeight: 'bold' }}>
                                    <Typography
                                        component='span'
                                        sx={(theme) => ({
                                            color: 'primary.main',
                                            fontWeight: 'bold',
                                            fontSize: 'inherit',
                                            ...theme.applyStyles('dark', {
                                                color: 'primary.light'
                                            })
                                        })}
                                    >
                                        Universo
                                    </Typography>{' '}
                                    {product.title.replace('Universo ', '')}
                                </Typography>
                                <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                                    {product.description}
                                </Typography>
                            </CardContent>
                            {/* MVP: Demo user data (avatar, name, occupation, logo) temporarily commented out
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <CardHeader
                  avatar={testimonial.avatar}
                  title={testimonial.name}
                  subheader={testimonial.occupation}
                />
                <img
                  src={logos[index]}
                  alt={`Logo ${index + 1}`}
                  style={logoStyle}
                />
              </Box>
              */}
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Container>
    )
}
