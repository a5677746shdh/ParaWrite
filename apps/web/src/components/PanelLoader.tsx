import { memo } from 'react'
import { useTranslation } from 'react-i18next'

export const PanelLoader = memo(function PanelLoader() {
  const { t } = useTranslation()

  return (
    <div className="panel-loader" role="status" aria-label={t('loading')}>
      <span className="panel-loader-bar" aria-hidden="true" />
    </div>
  )
})
