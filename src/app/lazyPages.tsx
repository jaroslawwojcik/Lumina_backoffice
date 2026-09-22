import { Box, CircularProgress } from '@mui/material'
import { lazy, Suspense, type ReactNode } from 'react'

export const LoginPage = lazy(() => import('../features/auth/LoginPage').then((module) => ({ default: module.LoginPage })))
export const ContentPage = lazy(() => import('../features/content/ContentPage').then((module) => ({ default: module.ContentPage })))
export const CreateResourcePage = lazy(() => import('../features/content/CreateResourcePage').then((module) => ({ default: module.CreateResourcePage })))
export const CreateProgramPage = lazy(() => import('../features/content/ProgramAuthoringPages').then((module) => ({ default: module.CreateProgramPage })))
export const ProgramEditorPage = lazy(() => import('../features/content/ProgramAuthoringPages').then((module) => ({ default: module.ProgramEditorPage })))
export const ResourceDetailPage = lazy(() => import('../features/content/ResourceDetailPage').then((module) => ({ default: module.ResourceDetailPage })))
export const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })))
export const MediaLibraryPage = lazy(() => import('../features/media/MediaLibraryPage').then((module) => ({ default: module.MediaLibraryPage })))
export const ProductDetailPage = lazy(() => import('../features/commerce/ProductsPages').then((module) => ({ default: module.ProductDetailPage })))
export const ProductsPage = lazy(() => import('../features/commerce/ProductsPages').then((module) => ({ default: module.ProductsPage })))
export const ReleaseComposerPage = lazy(() => import('../features/releases/ReleaseComposerPage').then((module) => ({ default: module.ReleaseComposerPage })))
export const ReleasesPage = lazy(() => import('../features/releases/ReleasesPage').then((module) => ({ default: module.ReleasesPage })))
export const UserDetailPage = lazy(() => import('../features/users/UsersPages').then((module) => ({ default: module.UserDetailPage })))
export const UsersPage = lazy(() => import('../features/users/UsersPages').then((module) => ({ default: module.UsersPage })))
export const AppShell = lazy(() => import('../layouts/AppShell').then((module) => ({ default: module.AppShell })))

export function RouteBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Box aria-label="Ładowanie widoku" sx={{ minHeight: 240, display: 'grid', placeItems: 'center' }}><CircularProgress size={28} /></Box>}>{children}</Suspense>
}
