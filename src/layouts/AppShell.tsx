import { AccountTreeOutlined, LogoutOutlined } from '@mui/icons-material'
import { AppBar, Avatar, Box, Button, Chip, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Tooltip, Typography } from '@mui/material'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { environment } from '../app/environment'
import { navigationRoutes, type AppRoute } from '../app/routes'
import { hasAnyPermission } from '../auth/permissions'
import { useAuth } from '../auth/useAuth'

const drawerWidth = { xs: 64, md: 220 }
export function AppShell() {
  const { displayName, permissions, signOut } = useAuth()
  const location = useLocation()
  const isProgram = location.pathname.startsWith('/content/programs') || (location.pathname === '/content' && new URLSearchParams(location.search).get('type') === 'program')
  const routes: AppRoute[] = navigationRoutes.flatMap((route) => route.path === '/content' ? [route, { path: '/content?type=program', label: 'Programy', icon: AccountTreeOutlined, requiredPermissions: ['content.read'] }] : [route])
  const visibleRoutes = routes.filter((route) => hasAnyPermission(permissions, route.requiredPermissions))
  const isSelected = (path: string) => path === '/content?type=program' ? isProgram : path === '/' ? location.pathname === '/' : path === '/content' ? location.pathname.startsWith('/content') && !isProgram : location.pathname.startsWith(path)
  const active = visibleRoutes.find((route) => isSelected(route.path))
  const name = displayName ?? 'Administrator'
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <Box sx={{ display: 'flex', minHeight: '100vh' }}>
    <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0 }} slotProps={{ paper: { sx: { width: drawerWidth, bgcolor: '#201a2c', color: '#f7f2fb', border: 0, px: { xs: 1, md: 1.75 }, py: 2.75 } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1, mb: 3 }}>
        <Avatar variant="rounded" sx={{ width: 32, height: 32, borderRadius: '10px', fontSize: 18, background: 'linear-gradient(145deg, #caa9e9, #7650a1)' }}>L</Avatar>
        <Typography sx={{ display: { xs: 'none', md: 'block' }, fontWeight: 600 }}>LUMINA</Typography>
        <Chip label={environment.name} size="small" sx={{ display: { xs: 'none', md: 'flex' }, ml: 'auto', borderRadius: '6px', bgcolor: '#564467', color: '#f7edf9', height: 23, '& .MuiChip-label': { px: .75 } }} />
      </Box>
      <List component="nav" aria-label="Główna nawigacja" disablePadding>
        {visibleRoutes.map((route) => { const Icon = route.icon; return <Box key={route.path}>
          {route.path === '/staff' && <Typography sx={{ display: { xs: 'none', md: 'block' }, m: '21px 11px 7px', color: '#a99ab8', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>Administracja</Typography>}
          <Tooltip title={route.label} placement="right"><ListItemButton component={Link} aria-label={route.label} aria-current={isSelected(route.path) ? 'page' : undefined} selected={isSelected(route.path)} to={route.path} sx={{ mb: .5, borderRadius: '9px', minHeight: 42, px: 1.4, color: '#cec4d7', '&:hover': { bgcolor: '#2e2639', color: '#fff' }, '&.Mui-selected, &.Mui-selected:hover': { bgcolor: '#49375c', color: '#fff' } }}>
            <ListItemIcon sx={{ color: 'inherit', minWidth: { xs: 0, md: 28 }, '& svg': { fontSize: 18 } }}><Icon /></ListItemIcon>
            <ListItemText primary={route.path === '/staff' ? 'Personel i role' : route.label} sx={{ display: { xs: 'none', md: 'block' } }} />
          </ListItemButton></Tooltip>
        </Box> })}
      </List>
    </Drawer>
    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}><Toolbar sx={{ gap: 1.25, px: { xs: 2, md: 3 }, minHeight: 64 }}>
        <Typography color="text.secondary" sx={{ flexGrow: 1 }}>{active?.label ?? 'Panel'}{location.pathname === '/content' && !isProgram ? ' / Wszystkie zasoby' : ''}</Typography>
        <Typography color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{name}</Typography>
        <Avatar sx={{ width: 32, height: 32, bgcolor: '#eee7f6', color: 'primary.main', fontSize: 12, fontWeight: 600 }}>{initials}</Avatar>
        <Button color="inherit" onClick={() => void signOut()} aria-label="Wyloguj" sx={{ minWidth: 36, p: 1 }}><LogoutOutlined sx={{ fontSize: 18 }} /></Button>
      </Toolbar></AppBar>
      <Box component="main"><Outlet /></Box>
    </Box>
  </Box>
}
