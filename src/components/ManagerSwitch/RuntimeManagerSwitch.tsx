import React from 'react'
import { Segmented } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getImplementedManagerDefinitions, implementedManagerRoutes } from '../../domain/managers/registry'

const MANAGER_OPTIONS: Array<{ label: string; value: PackageManagerId }> = getImplementedManagerDefinitions()
  .map((manager) => ({ label: manager.shortName, value: manager.id }))

interface RuntimeManagerSwitchProps {
  active: PackageManagerId
}

const RuntimeManagerSwitch: React.FC<RuntimeManagerSwitchProps> = ({ active }) => {
  const navigate = useNavigate()

  return (
    <Segmented<PackageManagerId>
      value={active}
      options={MANAGER_OPTIONS}
      onChange={(value) => navigate(implementedManagerRoutes[value])}
    />
  )
}

export default RuntimeManagerSwitch
