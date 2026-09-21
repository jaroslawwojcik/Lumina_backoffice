import { Alert, Box, Button, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { Permission } from './permissions'
import { hasAnyPermission } from './permissions'
import { useAuth } from './useAuth'
import type { ReactNode } from 'react'
export function RequirePermission({ children, requiredPermissions }: { children?: ReactNode; requiredPermissions: readonly Permission[] }) { const { permissions } = useAuth(); if (hasAnyPermission(permissions, requiredPermissions)) return children ?? <Box component="main" sx={{ p: 5 }}><Typography variant="h4">Ten moduł jest przygotowywany</Typography></Box>; return <Box component="main" sx={{ maxWidth: 680, p: 5 }}><Typography variant="h4" gutterBottom>Brak uprawnienia</Typography><Alert severity="warning" sx={{ mb: 3 }}>Nie masz uprawnienia do tej części panelu.</Alert><Button component={Link} to="/">Wróć do startu</Button></Box> }