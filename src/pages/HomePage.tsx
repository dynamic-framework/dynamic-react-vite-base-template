import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

import MyLink from './MyLink';
import SiteLang from './SiteLang';

const EDIT_PATH = 'src/pages/HomePage.tsx';

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <div
      className={classNames(
        'd-flex flex-column gap-4',
        'align-items-center justify-content-center',
      )}
    >
      <SiteLang />
      <h1 className="fw-semibold text-center">{t('title')}</h1>
      <p className="h5 text-muted text-center py-4">
        {t('home.getStarted')}
        <br />
        <span className="font-monospace text-primary-500">{EDIT_PATH}</span>
      </p>
      <div className="w-100 row mt-14">
        <div className="col mb-6">
          <MyLink
            href="https://docs.modyo.com/en/dynamic"
            icon="Book"
            title={t('home.links.learn.title')}
            description={t('home.links.learn.description')}
          />
        </div>
        <div className="col mb-6">
          <MyLink
            href="https://docs.modyo.com/en/dynamic/customization/theming.html"
            icon="Brush"
            title={t('home.links.themes.title')}
            description={t('home.links.themes.description')}
          />
        </div>
        <div className="col mb-6">
          <MyLink
            href="https://docs.modyo.com/en/dynamic/development/components.html"
            icon="Layout"
            title={t('home.links.components.title')}
            description={t('home.links.components.description')}
          />
        </div>
      </div>
    </div>
  );
}
