import { Navigate, Route, Routes } from 'react-router-dom'

import { GuidePage } from '@/pages/guide-page'
import { HomePage } from '@/pages/home-page'
import { ResultPage } from '@/pages/result-page'
import { RiskMapPage } from '@/pages/risk-map-page'
import { ScanPage } from '@/pages/scan-page'
import { ShowcasePage } from '@/pages/showcase-page'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/scan" element={<ScanPage />} />
      <Route path="/result" element={<ResultPage />} />
      <Route path="/map" element={<RiskMapPage />} />
      <Route path="/guide" element={<GuidePage />} />
      <Route path="/showcase" element={<ShowcasePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
