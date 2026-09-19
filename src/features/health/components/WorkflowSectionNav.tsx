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
        // A plain anchor href="#id" would be interpreted as a route path by the
        // HashRouter and blank the content area; scroll instead.
        <button
          key={section.id}
          type="button"
          className={styles.sectionNavLink}
          onClick={() => document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' })}
        >
          {section.label}
        </button>
      ))}
    </div>
  </div>
)

export default WorkflowSectionNav
