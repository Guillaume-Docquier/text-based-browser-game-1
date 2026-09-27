import { type ReactElement, useId } from "react"

const HULL_PATH =
  "M48 14.6 C46.5 14.7 45.4 16.6 44.4 19.2 C40.8 28.8 37.4 38.1 35.0 47.1 C32.8 55.4 31.8 66.1 30.6 76.7 L28.6 89.3 C28.4 90.5 29.2 91.2 30.0 90.4 C33.4 86.6 36.0 82.1 38.9 78.0 C41.6 74.2 44.0 71.1 48.0 71.0 C52.0 71.1 54.4 74.2 57.1 78.0 C60.0 82.1 62.6 86.6 66.0 90.4 C66.8 91.2 67.6 90.5 67.4 89.3 L65.4 76.7 C64.2 66.1 63.2 55.4 61.0 47.1 C58.6 38.1 55.2 28.8 51.6 19.2 C50.6 16.6 49.5 14.7 48 14.6Z"
const LEFT_FIN_PATH =
  "M30.9 52.0 C28.2 55.0 24.6 58.8 22.2 61.9 C21.4 63.1 21.1 65.0 20.9 67.2 L19.8 81.9 C19.7 83.6 20.6 84.8 22.0 84.9 C23.5 85.0 25.1 83.4 25.6 81.7 C27.2 75.2 28.4 68.1 29.6 61.6 Z"
const RIGHT_FIN_PATH =
  "M65.1 52.0 C67.8 55.0 71.4 58.8 73.8 61.9 C74.6 63.1 74.9 65.0 75.1 67.2 L76.2 81.9 C76.3 83.6 75.4 84.8 74.0 84.9 C72.5 85.0 70.9 83.4 70.4 81.7 C68.8 75.2 67.6 68.1 66.4 61.6 Z"

export function FleetIcon({ color }: { color: string }): ReactElement {
  const idPrefix = `fleet${useId().replaceAll(":", "-")}`
  const shadowId = `${idPrefix}-soft-shadow`
  const mainLightId = `${idPrefix}-main-light`
  const finLightId = `${idPrefix}-fin-light`

  return (
    <svg x="-16" y="-5" width="32" height="34" viewBox="0 0 96 102" aria-hidden="true" data-fleet-color={color} style={{ color }}>
      <defs>
        <filter id={shadowId} x="-30%" y="-25%" width="160%" height="170%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.35" result="blur" />
          <feOffset dy="1.2" result="offset" />
          <feColorMatrix in="offset" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0.08  0 0 0 .48 0" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={mainLightId} x1="33" y1="19" x2="63" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".30" />
          <stop offset=".34" stopColor="#fff" stopOpacity=".09" />
          <stop offset=".72" stopColor="#000" stopOpacity=".06" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
        <linearGradient id={finLightId} x1="20" y1="53" x2="31" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".20" />
          <stop offset="1" stopColor="#000" stopOpacity=".14" />
        </linearGradient>
      </defs>
      <g filter={`url(#${shadowId})`} strokeLinejoin="round" strokeLinecap="round">
        <path d={HULL_PATH} fill="currentColor" stroke="#fff" strokeOpacity=".28" strokeWidth="1.15" />
        <path d={HULL_PATH} fill={`url(#${mainLightId})`} />
        <path
          d="M47.8 16.3 C45.6 20.8 42.0 30.8 39.2 40.4 C36.7 49.2 34.8 60.2 33.6 71.2"
          fill="none"
          stroke="#fff"
          strokeOpacity=".26"
          strokeWidth="1.2"
        />
        <path d={LEFT_FIN_PATH} fill="currentColor" stroke="#fff" strokeOpacity=".22" strokeWidth=".9" />
        <path d={LEFT_FIN_PATH} fill={`url(#${finLightId})`} />
        <path d={RIGHT_FIN_PATH} fill="currentColor" stroke="#fff" strokeOpacity=".22" strokeWidth=".9" />
        <path d={RIGHT_FIN_PATH} fill={`url(#${finLightId})`} transform="translate(96 0) scale(-1 1)" />
      </g>
    </svg>
  )
}
