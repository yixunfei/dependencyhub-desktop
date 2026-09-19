import React from 'react'
import { Button, Space, Tabs, Typography } from 'antd'
import { FolderOpenOutlined, ReloadOutlined } from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'
import { useT } from '../../i18n'
import ProjectToolchainPanel from '../../components/Toolchain/ProjectToolchainPanel'
import GlobalToolchainPanel from '../../components/Toolchain/GlobalToolchainPanel'
import styles from './ToolVersions.module.css'

const { Text } = Typography

const ToolVersionsPage: React.FC = () => {
  const t = useT()
  const currentPath = useAppStore((state) => state.currentPath)
  const setCurrentPath = useAppStore((state) => state.setCurrentPath)
  const addNotification = useAppStore((state) => state.addNotification)

  const chooseDirectory = async () => {
    const path = await window.electronAPI.selectDirectory()
    if (!path) return
    setCurrentPath(path)
    addNotification({
      type: 'info',
      message: t('common.workdirSwitched'),
      description: path
    })
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t('toolchain.title')}</h2>
          <Text type="secondary">{t('toolchain.description')}</Text>
        </div>
        <Space wrap>
          <span className={styles.pathInfo}>
            <span className={styles.pathLabel}>{t('toolchain.currentProject')}</span>
            <span className={styles.pathValue}>{currentPath || t('common.notSelected')}</span>
          </span>
          <Button icon={<FolderOpenOutlined />} onClick={chooseDirectory}>
            {t('toolchain.selectDirectory')}
          </Button>
        </Space>
      </div>

      <Tabs
        items={[
          {
            key: 'project',
            label: t('toolchain.projectTitle'),
            children: <ProjectToolchainPanel projectPath={currentPath} />
          },
          {
            key: 'global',
            label: t('toolchain.globalDefaultVersion'),
            children: (
              <div className={styles.panel}>
                <GlobalToolchainPanel />
              </div>
            )
          }
        ]}
        tabBarExtraContent={{
          right: (
            <Button icon={<ReloadOutlined />} onClick={chooseDirectory}>
              {t('toolchain.switchProject')}
            </Button>
          )
        }}
      />
    </div>
  )
}

export default ToolVersionsPage
