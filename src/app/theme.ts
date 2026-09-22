import { createTheme } from '@mui/material'
import { paletteTokens } from './designTokens'

export const theme = createTheme({
  palette: {
    background: { default: paletteTokens.paper, paper: paletteTokens.paper },
    primary: { main: paletteTokens.accent, contrastText: paletteTokens.accentInk },
    secondary: { main: paletteTokens.muted },
    text: { primary: paletteTokens.ink, secondary: paletteTokens.muted },
    divider: paletteTokens.rule,
    success: { main: paletteTokens.success, light: paletteTokens.successSoft },
    warning: { main: paletteTokens.warning, light: paletteTokens.warningSoft },
    error: { main: paletteTokens.error, light: paletteTokens.errorSoft },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    h3: { fontFamily: 'var(--font-display)', fontSize: 28, lineHeight: 1.2, fontWeight: 700, letterSpacing: '-0.02em' },
    h4: { fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }, h5: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 },
    h6: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }, body1: { fontSize: 14, lineHeight: 1.5 }, body2: { fontSize: 13, lineHeight: 1.45 },
    button: { fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, textTransform: 'none', letterSpacing: 0 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 8, minHeight: 44, padding: '10px 16px', whiteSpace: 'nowrap', transition: 'background-color var(--dur-micro) var(--ease-out), color var(--dur-micro) var(--ease-out), transform var(--dur-micro) var(--ease-out)', '&:active': { transform: 'translateY(1px)' }, '&.Mui-disabled': { cursor: 'not-allowed' } }, outlined: { borderColor: 'var(--color-rule-2)' } } },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTableCell: { styleOverrides: { root: { padding: '12px 16px', borderColor: 'var(--color-rule)', fontSize: 13 }, head: { backgroundColor: 'var(--color-paper-2)', color: 'var(--color-muted)', fontWeight: 700 } } },
    MuiTableRow: { styleOverrides: { root: { '&:last-child td': { borderBottom: 0 }, '@media (hover: hover) and (pointer: fine)': { '&:hover td': { backgroundColor: 'var(--color-paper-2)' } } } } },
    MuiTableContainer: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiFormControl: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: { styleOverrides: { root: { minHeight: 44, borderRadius: 8, backgroundColor: 'var(--color-paper)', '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 1, borderColor: 'var(--color-focus)' } }, notchedOutline: { borderColor: 'var(--color-rule-2)' } } },
    MuiChip: { styleOverrides: { root: { fontSize: 12, height: 28, fontWeight: 600 }, colorSuccess: { backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }, colorWarning: { backgroundColor: 'var(--color-warning-soft)', color: 'var(--color-warning)' }, colorDefault: { backgroundColor: 'var(--color-paper-3)', color: 'var(--color-muted)' } } },
    MuiTab: { styleOverrides: { root: { minHeight: 44, minWidth: 0, borderRadius: 8, margin: 4, padding: '8px 12px', whiteSpace: 'nowrap', '&.Mui-selected': { backgroundColor: 'var(--color-paper-3)' } } } },
    MuiTabs: { styleOverrides: { root: { minHeight: 48, borderBottom: '1px solid var(--color-rule)' }, indicator: { display: 'none' } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 8 } } },
  },
})
