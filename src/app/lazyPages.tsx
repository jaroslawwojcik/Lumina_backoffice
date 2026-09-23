import { Box, CircularProgress } from '@mui/material'
import { lazy, Suspense, type ReactNode } from 'react'
import { importWithReload } from './lazyImport'

export const LoginPage = lazy(() => importWithReload(() => import('../features/auth/LoginPage'), 'login').then((module) => ({ default: module.LoginPage })))
export const ContentPage = lazy(() => importWithReload(() => import('../features/content/ContentPage'), 'content').then((module) => ({ default: module.ContentPage })))
export const CreateResourcePage = lazy(() => importWithReload(() => import('../features/content/CreateResourcePage'), 'create-resource').then((module) => ({ default: module.CreateResourcePage })))
export const CreateProgramPage = lazy(() => importWithReload(() => import('../features/content/ProgramAuthoringPages'), 'program-authoring').then((module) => ({ default: module.CreateProgramPage })))
export const ProgramEditorPage = lazy(() => importWithReload(() => import('../features/content/ProgramAuthoringPages'), 'program-authoring').then((module) => ({ default: module.ProgramEditorPage })))
export const ResourceDetailPage = lazy(() => importWithReload(() => import('../features/content/ResourceDetailPage'), 'resource-detail').then((module) => ({ default: module.ResourceDetailPage })))
export const DashboardPage = lazy(() => importWithReload(() => import('../features/dashboard/DashboardPage'), 'dashboard').then((module) => ({ default: module.DashboardPage })))
export const MediaLibraryPage = lazy(() => importWithReload(() => import('../features/media/MediaLibraryPage'), 'media').then((module) => ({ default: module.MediaLibraryPage })))
export const ProductDetailPage = lazy(() => importWithReload(() => import('../features/commerce/ProductsPages'), 'products').then((module) => ({ default: module.ProductDetailPage })))
export const ProductsPage = lazy(() => importWithReload(() => import('../features/commerce/ProductsPages'), 'products').then((module) => ({ default: module.ProductsPage })))
export const ReleaseComposerPage = lazy(() => importWithReload(() => import('../features/releases/ReleaseComposerPage'), 'release-composer').then((module) => ({ default: module.ReleaseComposerPage })))
export const ReleasesPage = lazy(() => importWithReload(() => import('../features/releases/ReleasesPage'), 'releases').then((module) => ({ default: module.ReleasesPage })))
export const UserDetailPage = lazy(() => importWithReload(() => import('../features/users/UsersPages'), 'users').then((module) => ({ default: module.UserDetailPage })))
export const UsersPage = lazy(() => importWithReload(() => import('../features/users/UsersPages'), 'users').then((module) => ({ default: module.UsersPage })))
export const AppShell = lazy(() => importWithReload(() => import('../layouts/AppShell'), 'app-shell').then((module) => ({ default: module.AppShell })))

export function RouteBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Box aria-label="Ładowanie widoku" sx={{ minHeight: 240, display: 'grid', placeItems: 'center' }}><CircularProgress size={28} /></Box>}>{children}</Suspense>
}
