import { createTheme } from '@mui/material'

export const theme = createTheme({
  palette: {
    background: { default: '#f5f5f8', paper: '#ffffff' },
    primary: { main: '#684890' }, secondary: { main: '#716d7c' },
    text: { primary: '#201d2b', secondary: '#716d7c' }, divider: '#e4e1e9',
    success: { main: '#237354', light: '#e5f5ee' },
    warning: { main: '#9c6500', light: '#fff3da' }, error: { main: '#b53838', light: '#fdeaea' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 13,
    h3: { fontSize: 24, fontWeight: 600, letterSpacing: '-0.4px' },
    h4: { fontSize: 22, fontWeight: 600 }, h5: { fontSize: 18, fontWeight: 600 },
    h6: { fontSize: 15, fontWeight: 600 }, body1: { fontSize: 13 }, body2: { fontSize: 12 },
    button: { fontSize: 13, fontWeight: 500, textTransform: 'none', letterSpacing: 0 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 9, minHeight: 38, padding: '8px 13px', whiteSpace: 'nowrap' }, outlined: { borderColor: '#e4e1e9' } } },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTableCell: { styleOverrides: { root: { padding: '13px 15px', borderColor: '#e4e1e9', fontSize: 13 }, head: { backgroundColor: '#f8f7fb', color: '#716d7c', fontWeight: 500 } } },
    MuiTableRow: { styleOverrides: { root: { '&:last-child td': { borderBottom: 0 }, '&:hover td': { backgroundColor: '#faf9fc' } } } },
    MuiTableContainer: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiFormControl: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8, backgroundColor: '#ffffff' }, notchedOutline: { borderColor: '#e4e1e9' } } },
    MuiChip: { styleOverrides: { root: { fontSize: 11, height: 25, fontWeight: 500 }, colorSuccess: { backgroundColor: '#e5f5ee', color: '#237354' }, colorWarning: { backgroundColor: '#fff3da', color: '#9c6500' }, colorDefault: { backgroundColor: '#f0edf4', color: '#716d7c' } } },
    MuiTab: { styleOverrides: { root: { minHeight: 36, minWidth: 0, borderRadius: 7, margin: 4, padding: '8px 10px', '&.Mui-selected': { backgroundColor: '#eee7f6' } } } },
    MuiTabs: { styleOverrides: { root: { minHeight: 44, borderBottom: '1px solid #e4e1e9' }, indicator: { display: 'none' } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 9 } } },
  },
})
