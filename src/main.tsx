import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'
import { SimulatedSensorProvider } from './services/sensor/simulatedSensor'
import { createStorageService, getBrowserBackend } from './services/storage/storage'

const storage = createStorageService(getBrowserBackend())
const sensor = new SimulatedSensorProvider({ initial: storage.load().simulator })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App sensor={sensor} storage={storage} />
  </StrictMode>,
)
