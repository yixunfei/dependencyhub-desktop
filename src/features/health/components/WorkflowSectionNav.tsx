import React from 'react'
import { Typography } from 'antd'
import { HEALTH_WORKFLOW_SECTIONS } from '../workflows'
import styles from '../HealthCenter.module.css'

const { Text } = Typography

const WorkflowSectionNav: React.FC = () => (
  <div className={styles.sectionNav}>
    <Text className={styles.sectionNavTitle}>Health Center workflows</Text>
    <div className={styles.sectionNavLinks}>
      {HEALTH_WORKFLOW_SECTIONS.map((section) => (
        <a key={section.id} href={`#${section.id}`}>{section.label}</a>
      ))}
    </div>
  </div>
)

export default WorkflowSectionNav
