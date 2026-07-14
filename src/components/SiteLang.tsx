import { useTranslation } from 'react-i18next';

import { SITE_LANG } from '../config/widgetConfig';

export default function SiteLang() {
  const { t } = useTranslation();

  return (
    <small className="fw-normal text-center text-muted">
      {t('siteLang', { lang: SITE_LANG })}
    </small>
  );
}
