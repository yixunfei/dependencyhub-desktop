import type { MenuProps } from 'antd'
import {
  ApiOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  ToolOutlined
} from '@ant-design/icons'
import { getImplementedManagerDefinitions } from '../../domain/managers/registry'
import { managerIcon } from '../../domain/managers/presentation'
import { MANAGER_WORKSPACE_GROUPS } from '../../domain/managers/workspaces'
import type { LabelTranslator } from '../../i18n'

export type MenuEntry = NonNullable<MenuProps['items']>[number]

/** Entries produced here are always plain items; the cast avoids widening them
 *  back into the full union when they are nested under a group. */
type MenuItemEntry = MenuEntry & { key: string }

/**
 * Sidebar structure, built away from the layout component.
 *
 * Both lists flatten every implemented manager, which is dozens of objects per
 * render; keeping them here lets the layout memoise them once per language and
 * keeps that noise out of an already large component.
 */
export function buildManagerMenuEntries(): MenuItemEntry[] {
  const groupedManagerIds = new Set(MANAGER_WORKSPACE_GROUPS.flatMap((group) => group.managerIds))
  return [
    ...MANAGER_WORKSPACE_GROUPS.map((group) => ({
      key: group.route,
      icon: managerIcon(group.iconManagerId),
      label: group.shortLabel
    })),
    ...getImplementedManagerDefinitions()
      .filter((manager) => !groupedManagerIds.has(manager.id))
      .map((manager) => ({
        key: manager.route || `/${manager.id}`,
        icon: managerIcon(manager.id),
        label: manager.shortName
      }))
  ]
}

export function buildMainMenuEntries(
  t: LabelTranslator,
  managerEntries: MenuItemEntry[]
): MenuProps['items'] {
  return [
    { key: '/workspace', icon: <DashboardOutlined />, label: t('layout.workspace') },
    {
      key: 'managers',
      label: t('layout.ecosystemManagement'),
      type: 'group',
      children: managerEntries as unknown as MenuEntry[]
    },
    { key: '/environment', icon: <ToolOutlined />, label: t('layout.environmentToolchains') },
    { key: '/health', icon: <SafetyCertificateOutlined />, label: t('layout.healthSecurity') },
    { key: '/extended', icon: <ExperimentOutlined />, label: t('layout.extendedEcosystems') },
    { key: '/ai-providers', icon: <ApiOutlined />, label: t('layout.aiProviders') },
    { key: '/search', icon: <SearchOutlined />, label: t('layout.search') },
    { key: '/plugins', icon: <DeploymentUnitOutlined />, label: t('layout.plugins') },
    { key: '/settings', icon: <SettingOutlined />, label: t('layout.settings') }
  ]
}
