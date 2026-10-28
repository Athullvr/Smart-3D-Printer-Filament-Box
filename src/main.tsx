import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'
import { SimulatedSensorProvider } from './services/sensor/simulatedSensor'
import { HttpSensorProvider } from './services/sensor/httpSensor'
import { createStorageService, getBrowserBackend } from './services/storage/storage'

const storage = createStorageService(getBrowserBackend())
const stored = storage.load()
const sensor = new SimulatedSensorProvider({ initial: stored.simulator })
const hardware = new HttpSensorProvider({ url: stored.connection.endpointUrl })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App sensor={sensor} hardware={hardware} storage={storage} />
  </StrictMode>,
)
