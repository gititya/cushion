import { createTheme } from '@mui/material/styles'

/**
 * Material 3 Expressive theme for Cushion.
 *
 * Colour roles match the M3 spec with primary #6750A4.
 * Font: Plus Jakarta Sans (loaded in index.html via Google Fonts).
 * No heavy shadows -- M3 tinted surface elevation only.
 */
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6750A4',
      light: '#9A82DB',
      dark: '#4F378B',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#625B71',
      light: '#9A93A8',
      dark: '#4A4458',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#B3261E',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#7D5700',
    },
    success: {
      main: '#386A20',
    },
    background: {
      default: '#FEF7FF',
      paper: '#FFFBFE',
    },
    // M3 surface variant used for cards and elevated surfaces
    surfaceVariant: '#E7E0EC',
    // Tertiary for gradients
    tertiary: '#7D5260',
    tertiaryContainer: '#FFD8E4',
  },

  typography: {
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },

  shape: {
    // M3 uses generous rounding
    borderRadius: 16,
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#FEF7FF',
          fontFamily: '"Plus Jakarta Sans", sans-serif',
        },
      },
    },

    // M3-style cards: tinted surface, no heavy shadow
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: 'none',
          border: '1px solid rgba(103, 80, 164, 0.12)',
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 50,
          padding: '10px 24px',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #6750A4 0%, #7D5260 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #4F378B 0%, #633B48 100%)',
          },
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
          },
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderBottom: '1px solid rgba(103, 80, 164, 0.12)',
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
})

export default theme
