import React from 'react'
import { Space, Typography } from 'antd'
import type { HealthWorkflowSectionId } from '../workflows'
import styles from '../HealthCenter.module.css'

const { Text } = Typography

interface WorkflowSectionHeaderProps {
  id: HealthWorkflowSectionId
  icon: React.ReactNode
  title: string
  meta: React.ReactNode
}

const WorkflowSectionHeader: React.FC<WorkflowSectionHeaderProps> = ({ id, icon, title, meta }) => (
  <div id={id} className={styles.workflowSection}>
    <div className={styles.workflowSectionHeader}>
      <Space wrap>
        {icon}
        <Text strong className={styles.workflowSectionTitle}>{title}</Text>
      </Space>
      <Text type="secondary" className={styles.workflowSectionMeta}>{meta}</Text>
    </div>
  </div>
)

export default WorkflowSectionHeader
