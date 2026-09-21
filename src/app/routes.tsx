import { ArticleOutlined, DashboardOutlined, GroupOutlined, MovieOutlined, PublishOutlined, SellOutlined, SettingsOutlined } from '@mui/icons-material'
import type { SvgIconComponent } from '@mui/icons-material'
import type { Permission } from '../auth/permissions'
export type AppRoute = { path: string; label: string; icon: SvgIconComponent; requiredPermissions: readonly Permission[] }
export const appRoutes: readonly AppRoute[] = [
  { path: '/', label: 'Start', icon: DashboardOutlined, requiredPermissions: [] },
  { path: '/content', label: 'Treści', icon: ArticleOutlined, requiredPermissions: ['content.read'] },
  { path: '/content/sessions', label: 'Sesje', icon: ArticleOutlined, requiredPermissions: ['content.read'] },
  { path: '/content/programs', label: 'Programy', icon: ArticleOutlined, requiredPermissions: ['content.read'] },
  { path: '/content/materials', label: 'Materiały', icon: ArticleOutlined, requiredPermissions: ['content.read'] },
  { path: '/content/sessions/new', label: 'Nowa sesja', icon: ArticleOutlined, requiredPermissions: ['content.create'] },
  { path: '/content/sessions/:resourceId', label: 'Sesja', icon: ArticleOutlined, requiredPermissions: ['content.read'] },
  { path: '/content/programs/new', label: 'Nowy program', icon: ArticleOutlined, requiredPermissions: ['content.create'] },
  { path: '/content/programs/:resourceId', label: 'Program', icon: ArticleOutlined, requiredPermissions: ['content.read'] },
  { path: '/content/materials/new', label: 'Nowy materiał', icon: ArticleOutlined, requiredPermissions: ['content.create'] },
  { path: '/content/materials/:resourceId', label: 'Materiał', icon: ArticleOutlined, requiredPermissions: ['content.read'] },
  { path: '/media', label: 'Media', icon: MovieOutlined, requiredPermissions: ['media.read'] },
  { path: '/media/uploads/:uploadId', label: 'Upload', icon: MovieOutlined, requiredPermissions: ['media.read'] },
  { path: '/releases', label: 'Wydania', icon: PublishOutlined, requiredPermissions: ['content.read'] },
  { path: '/releases/new', label: 'Nowe wydanie', icon: PublishOutlined, requiredPermissions: ['release.build'] },
  { path: '/releases/:releaseId', label: 'Wydanie', icon: PublishOutlined, requiredPermissions: ['content.read'] },
  { path: '/commerce/products', label: 'Sprzedaż', icon: SellOutlined, requiredPermissions: ['commerce.read'] },
  { path: '/commerce/products/:productId', label: 'Produkt', icon: SellOutlined, requiredPermissions: ['commerce.read'] },
  { path: '/users', label: 'Użytkownicy', icon: GroupOutlined, requiredPermissions: ['users.read'] },
  { path: '/users/:userId', label: 'Użytkownik', icon: GroupOutlined, requiredPermissions: ['users.read'] },
  { path: '/staff', label: 'Administracja', icon: SettingsOutlined, requiredPermissions: ['staff.manage'] },
  { path: '/staff/roles', label: 'Role', icon: SettingsOutlined, requiredPermissions: ['staff.manage'] },
  { path: '/audit', label: 'Audyt', icon: SettingsOutlined, requiredPermissions: ['audit.read'] },
]

export const navigationRoutes = appRoutes.filter((route) => ['/', '/content', '/media', '/releases', '/commerce/products', '/users', '/staff'].includes(route.path))
