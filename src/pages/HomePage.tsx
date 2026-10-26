import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

import MyLink from './MyLink';
import SiteLang from './SiteLang';

export default function MyComponent() {
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
        Get started by editing
        <br />
        <span className="font-monospace text-primary-500">src/components/MyComponent.tsx</span>
      </p>
      <div className="w-100 row mt-14">
        <div className="col mb-6">
          <MyLink
            href="https://docs.modyo.com/en/dynamic"
            icon="Book"
            title="Learn"
            description="Get started with Dynamic Framework!"
          />
        </div>
        <div className="col mb-6">
          <MyLink
            href="https://docs.modyo.com/en/dynamic/customization/theming.html"
            icon="Brush"
            title="Themes"
            description="Learn how to create a unique look-and-feel!"
          />
        </div>
        <div className="col mb-6">
          <MyLink
            href="https://docs.modyo.com/en/dynamic/development/components.html"
            icon="Layout"
            title="Components"
            description="Explore the fully React-based components"
          />
        </div>
      </div>
    </div>
  );
}
