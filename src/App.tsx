import React, { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/Layout/MainLayout'
import { NotificationContainer } from './components/Notification/NotificationContainer'
import CommandLogWindow from './components/CommandLog/CommandLogWindow'
import ToolchainStatusModal from './components/Toolchain/ToolchainStatusModal'
import { LanguageStartupGate } from './components/Localization/LanguageStartupGate'
import { RuntimeLocalizer } from './components/Localization/RuntimeLocalizer'
import { useAppStore } from './stores/appStore'

const Search = lazy(() => import('./features/search/Search'))
const ManagerHub = lazy(() => import('./features/workspace/ManagerHub'))
const MultiManager = lazy(() => import('./features/workspace/MultiManager'))
const NpmManagerPage = lazy(() => import('./features/managers/npm/NpmManagerPage'))
const NodePackageManagersPage = lazy(() => import('./features/managers/node/NodePackageManagersPage'))
const PythonEnvironmentManagersPage = lazy(() => import('./features/managers/python/PythonEnvironmentManagersPage'))
const BackendPackageManagersPage = lazy(() => import('./features/managers/backend/BackendPackageManagersPage'))
const CloudNativeManagersPage = lazy(() => import('./features/managers/cloud/CloudNativeManagersPage'))
const AiManagersPage = lazy(() => import('./features/managers/ai/AiManagersPage'))
const PlatformManagersPage = lazy(() => import('./features/managers/platform/PlatformManagersPage'))
const PolyglotManagersPage = lazy(() => import('./features/managers/polyglot/PolyglotManagersPage'))
const DataScienceManagersPage = lazy(() => import('./features/managers/data/DataScienceManagersPage'))
const InfrastructureManagersPage = lazy(() => import('./features/managers/infra/InfrastructureManagersPage'))
const AutomationManagersPage = lazy(() => import('./features/managers/automation/AutomationManagersPage'))
const BuildSystemsManagersPage = lazy(() => import('./features/managers/build/BuildSystemsManagersPage'))
const SystemsManagersPage = lazy(() => import('./features/managers/systems/SystemsManagersPage'))
const RuntimeManagersPage = lazy(() => import('./features/managers/runtime/RuntimeManagersPage'))
const PipManagerPage = lazy(() => import('./features/managers/pip/PipManagerPage'))
const MavenManagerPage = lazy(() => import('./features/managers/maven/MavenManagerPage'))
const Cargo = lazy(() => import('./features/managers/cargo/Cargo'))
const Gradle = lazy(() => import('./features/managers/gradle/Gradle'))
const Go = lazy(() => import('./features/managers/go/Go'))
const Flutter = lazy(() => import('./features/managers/flutter/Flutter'))
const Native = lazy(() => import('./features/managers/native/Native'))
const Settings = lazy(() => import('./features/settings/Settings'))
const ToolVersions = lazy(() => import('./features/toolchains/ToolVersions'))
const PluginComponents = lazy(() => import('./pages/PluginComponents/PluginComponents'))
const HealthCenter = lazy(() => import('./features/health/HealthCenter'))
const ExtendedEcosystems = lazy(() => import('./features/managers/extended/ExtendedEcosystems'))

const App: React.FC = () => {
  const initCurrentPath = useAppStore((state) => state.initCurrentPath)
  
  useEffect(() => {
    initCurrentPath()
  }, [])
  
  return (
    <>
      <RuntimeLocalizer />
      <LanguageStartupGate />
      <MainLayout>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<ManagerHub />} />
            <Route path="/workspace" element={<ManagerHub />} />
            <Route path="/hub" element={<ManagerHub />} />
            <Route path="/search" element={<Search />} />
            <Route path="/project" element={<NpmManagerPage initialScope="project" />} />
            <Route path="/global" element={<NpmManagerPage initialScope="global" />} />
            <Route path="/multi-manager" element={<MultiManager />} />
            <Route path="/node" element={<NodePackageManagersPage />} />
            <Route path="/python" element={<PythonEnvironmentManagersPage />} />
            <Route path="/backend" element={<BackendPackageManagersPage />} />
            <Route path="/cloud" element={<CloudNativeManagersPage />} />
            <Route path="/ai" element={<AiManagersPage />} />
            <Route path="/platform" element={<PlatformManagersPage />} />
            <Route path="/polyglot" element={<PolyglotManagersPage />} />
            <Route path="/data" element={<DataScienceManagersPage />} />
            <Route path="/infra" element={<InfrastructureManagersPage />} />
            <Route path="/automation" element={<AutomationManagersPage />} />
            <Route path="/build" element={<BuildSystemsManagersPage />} />
            <Route path="/systems" element={<SystemsManagersPage />} />
            <Route path="/runtime" element={<RuntimeManagersPage />} />
            <Route path="/npm" element={<NpmManagerPage initialScope="project" />} />
            <Route path="/npm/project" element={<NpmManagerPage initialScope="project" />} />
            <Route path="/npm/global" element={<NpmManagerPage initialScope="global" />} />
            <Route path="/npm/publish" element={<NpmManagerPage initialScope="publish" />} />
            <Route path="/pip" element={<PipManagerPage />} />
            <Route path="/maven" element={<MavenManagerPage />} />
            <Route path="/cargo" element={<Cargo />} />
            <Route path="/gradle" element={<Gradle />} />
            <Route path="/go" element={<Go />} />
            <Route path="/flutter" element={<Flutter />} />
            <Route path="/native" element={<Native />} />
            <Route path="/publish" element={<NpmManagerPage initialScope="publish" />} />
            <Route path="/environment" element={<ToolVersions />} />
            <Route path="/health" element={<HealthCenter />} />
            <Route path="/extended" element={<ExtendedEcosystems />} />
            <Route path="/tool-versions" element={<ToolVersions />} />
            <Route path="/plugins" element={<PluginComponents />} />
            <Route path="/settings" element={<Settings />} />
            {/* Catch unknown hash routes (e.g. a stray "#section" anchor) instead of rendering a blank content area. */}
            <Route path="*" element={<Navigate to="/workspace" replace />} />
          </Routes>
        </Suspense>
      </MainLayout>
      <NotificationContainer />
      <CommandLogWindow />
      <ToolchainStatusModal />
    </>
  )
}

export default App
