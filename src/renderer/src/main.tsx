import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { AvatarApp } from './AvatarApp'
import { SettingsApp } from './SettingsApp'

const isSettings = window.location.hash === '#settings'
document.body.dataset.view = isSettings ? 'settings' : 'avatar'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')

createRoot(root).render(
  <StrictMode>{isSettings ? <SettingsApp /> : <AvatarApp />}</StrictMode>
)
