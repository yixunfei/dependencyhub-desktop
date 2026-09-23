import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Form } from 'antd'
import type { FormInstance } from 'antd'
import { FolderOpenOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useAppStore } from '../../../../../stores/appStore'
import { useT } from '../../../../../i18n'
import { localizedMessage as message } from '../../../../../utils/localizedFeedback'
import styles from './Publish.module.css'
import PublishCheckCard from './PublishCheckCard'
import PublishConfigCard from './PublishConfigCard'
import type { CredentialOption, PackageJsonDocument, PublishCheckResult, PublishFormValues } from './publishTypes'

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** Loads the npm credentials from the vault and maps them to Select options. */
function useNpmCredentials() {
  const [credentials, setCredentials] = useState<CredentialMetadata[]>([])
  const loadCredentials = useCallback(async () => {
    try {
      setCredentials(await window.electronAPI.credentials.list({ managerId: 'npm' }))
    } catch {
      setCredentials([])
    }
  }, [])
  const credentialOptions = useMemo(() => credentials.map((credential) => ({
    value: credential.id,
    label: `${credential.label} ${credential.secretPreview}`
  })), [credentials])
  return { credentialOptions, loadCredentials }
}

/**
 * Owns the selected project, the readiness check result, and the loaded
 * package.json. Keeps the editor form fields in sync with the check result.
 */
export function usePackageCheck(form: FormInstance<PublishFormValues>) {
  const requestId = useRef(0)
  const [projectPath, setProjectPath] = useState('')
  const [checkResult, setCheckResult] = useState<PublishCheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [packageJson, setPackageJson] = useState<PackageJsonDocument | null>(null)
  const addNotification = useAppStore((state) => state.addNotification)
  const t = useT()

  useEffect(() => {
    if (!projectPath || !checkResult?.packageInfo) return
    const info = checkResult.packageInfo
    form.setFieldsValue({
      name: info.name,
      version: info.version,
      description: info.description || '',
      license: info.license || '',
      author: typeof info.author === 'string' ? info.author : info.author?.name || '',
      homepage: info.homepage || '',
      repository: typeof info.repository === 'string' ? info.repository : info.repository?.url || ''
    })
  }, [projectPath, checkResult, form])

  const selectProject = (path: string) => {
    requestId.current += 1
    setProjectPath(path)
    setCheckResult(null)
    setPackageJson(null)
    setChecking(false)
    form.resetFields()
  }

  const handleCheck = async () => {
    if (!projectPath) {
      message.warning(t('npm.publish.selectDirFirst'))
      return
    }
    const currentRequest = ++requestId.current
    setChecking(true)
    setCheckResult(null)
    setPackageJson(null)
    try {
      const [result, document] = await Promise.all([
        window.electronAPI.publish.check(projectPath),
        window.electronAPI.project.readPackage(projectPath)
      ])
      if (currentRequest !== requestId.current) return
      setCheckResult(result)
      setPackageJson(document)
    } catch (error) {
      if (currentRequest !== requestId.current) return
      addNotification({
        type: 'error',
        message: t('npm.publish.checkFailed'),
        description: describeError(error)
      })
    } finally {
      if (currentRequest === requestId.current) setChecking(false)
    }
  }

  /** Applies a package.json document written by the publish flow back to state. */
  const applyWrittenPackage = (updatedPackage: PackageJsonDocument, version: string) => {
    setPackageJson(updatedPackage)
    setCheckResult((prev) => prev
      ? { ...prev, packageInfo: prev.packageInfo ? { ...prev.packageInfo, version } : prev.packageInfo }
      : prev)
  }

  return { projectPath, checkResult, checking, packageJson, selectProject, handleCheck, applyWrittenPackage }
}

/** Owns edit mode state and the save-package.json flow. */
function usePackageEditor(deps: {
  form: FormInstance<PublishFormValues>
  packageJson: PackageJsonDocument | null
  projectPath: string
  onRecheck: () => Promise<void>
}) {
  const [editMode, setEditMode] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const addNotification = useAppStore((state) => state.addNotification)
  const t = useT()

  const handleSavePackageJson = async () => {
    setSaveLoading(true)
    try {
      const values = await deps.form.validateFields()
      const updatedPackage = {
        ...deps.packageJson,
        name: values.name,
        version: values.version,
        description: values.description,
        license: values.license,
        author: values.author,
        homepage: values.homepage,
        repository: values.repository
      }
      await window.electronAPI.project.writePackage(deps.projectPath, updatedPackage)
      addNotification({
        type: 'success',
        message: t('npm.publish.packageJsonUpdated')
      })
      setEditMode(false)
      await deps.onRecheck()
    } catch (error) {
      addNotification({
        type: 'error',
        message: t('npm.publish.saveFailed'),
        description: describeError(error)
      })
    } finally {
      setSaveLoading(false)
    }
  }

  return { editMode, setEditMode, saveLoading, handleSavePackageJson }
}

/** Owns the submit-publish flow, including version write-back and credentials. */
function usePackagePublisher(deps: {
  checkResult: PublishCheckResult | null
  packageJson: PackageJsonDocument | null
  projectPath: string
  applyWrittenPackage: (updatedPackage: PackageJsonDocument, version: string) => void
  reloadCredentials: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const addNotification = useAppStore((state) => state.addNotification)
  const t = useT()

  const handlePublish = async (values: PublishFormValues) => {
    if (!deps.checkResult?.canPublish) {
      message.error(t('npm.publish.checkFirst'))
      return
    }
    if (!values.version?.trim()) {
      message.warning(t('npm.publish.versionRequired'))
      return
    }
    setLoading(true)
    try {
      const publishVersion = values.version.trim()
      if (deps.packageJson && publishVersion !== deps.checkResult.packageInfo?.version) {
        const updatedPackage = {
          ...deps.packageJson,
          version: publishVersion
        }
        await window.electronAPI.project.writePackage(deps.projectPath, updatedPackage)
        deps.applyWrittenPackage(updatedPackage, publishVersion)
      }

      let credentialId = values.credentialId
      if (!credentialId && values.token && values.saveCredential) {
        const credential = await window.electronAPI.credentials.save({
          managerId: 'npm',
          service: values.registry || 'https://registry.npmjs.org/',
          account: 'NODE_AUTH_TOKEN',
          label: `npm ${values.registry || 'registry.npmjs.org'}`,
          kind: 'token',
          secret: values.token,
          url: values.registry
        })
        credentialId = credential.id
        await deps.reloadCredentials()
      }

      await window.electronAPI.publish.publish({
        cwd: deps.projectPath,
        tag: values.tag,
        access: values.access,
        registry: values.registry,
        credentialId,
        token: credentialId ? undefined : values.token,
        overrideReadinessGate: values.overrideReadinessGate === true
      })
      addNotification({
        type: 'success',
        message: t('npm.publish.succeeded'),
        description: t('npm.publish.succeededDescription', {
          name: deps.checkResult.packageInfo?.name || '',
          version: publishVersion
        })
      })
    } catch (error) {
      addNotification({
        type: 'error',
        message: t('npm.publish.failed'),
        description: describeError(error)
      })
    } finally {
      setLoading(false)
    }
  }

  return { loading, handlePublish }
}

/**
 * Composes the publish page state: directory selection, readiness checks,
 * package editing, credentials, and the publish flow itself.
 */
function usePublishPage() {
  const [form] = Form.useForm<PublishFormValues>()
  const check = usePackageCheck(form)
  const credentials = useNpmCredentials()
  const editor = usePackageEditor({
    form,
    packageJson: check.packageJson,
    projectPath: check.projectPath,
    onRecheck: check.handleCheck
  })
  const publisher = usePackagePublisher({
    checkResult: check.checkResult,
    packageJson: check.packageJson,
    projectPath: check.projectPath,
    applyWrittenPackage: check.applyWrittenPackage,
    reloadCredentials: credentials.loadCredentials
  })

  const handleSelectDirectory = async () => {
    const path = await window.electronAPI.selectDirectory()
    if (!path) return
    check.selectProject(path)
    editor.setEditMode(false)
  }

  return {
    form,
    projectPath: check.projectPath,
    checkResult: check.checkResult,
    checking: check.checking,
    editMode: editor.editMode,
    setEditMode: editor.setEditMode,
    saveLoading: editor.saveLoading,
    loading: publisher.loading,
    credentialOptions: credentials.credentialOptions as CredentialOption[],
    handleSelectDirectory,
    handleCheck: check.handleCheck,
    handleSavePackageJson: editor.handleSavePackageJson,
    handlePublish: publisher.handlePublish,
    loadCredentials: credentials.loadCredentials
  }
}

const PublishPage: React.FC = () => {
  const t = useT()
  const {
    form,
    projectPath,
    checkResult,
    checking,
    editMode,
    setEditMode,
    saveLoading,
    loading,
    credentialOptions,
    handleSelectDirectory,
    handleCheck,
    handleSavePackageJson,
    handlePublish,
    loadCredentials
  } = usePublishPage()

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('npm.publish.title')}</h2>
        <div className={styles.pathSelector}>
          <span className={styles.label}>{t('npm.publish.projectPath')}</span>
          <span className={styles.path}>{projectPath || t('npm.publish.noProject')}</span>
          <Button
            icon={<FolderOpenOutlined />}
            disabled={loading || saveLoading}
            onClick={handleSelectDirectory}
          >
            {t('npm.publish.selectDir')}
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handleCheck}
            loading={checking}
            disabled={!projectPath || loading || saveLoading}
          >
            {t('npm.publish.check')}
          </Button>
        </div>
      </div>

      {checkResult && (
        <div className={styles.content}>
          <PublishCheckCard
            form={form}
            checkResult={checkResult}
            editMode={editMode}
            onEditModeChange={setEditMode}
            saveLoading={saveLoading}
            onSave={handleSavePackageJson}
          />
          {checkResult.canPublish && !editMode && (
            <PublishConfigCard
              form={form}
              loading={loading}
              credentialOptions={credentialOptions}
              onPublish={handlePublish}
              onReloadCredentials={loadCredentials}
            />
          )}
        </div>
      )}

      {!checkResult && (
        <div className={styles.empty}>
          <p>{t('npm.publish.emptyHint')}</p>
        </div>
      )}
    </div>
  )
}

export default PublishPage
