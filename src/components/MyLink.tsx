import { DIcon } from '@dynamic-framework/ui-react';

type Props = {
  href: string;
  icon: string;
  title: string;
  description: string;
};

export default function MyLink(
  {
    href,
    icon,
    title,
    description,
  }: Props,
) {
  return (
    <a
      href={href}
      className="card text-decoration-none p-6 flex-row border h-100 bg-secondary-soft"
      target="_blank"
      rel="noreferrer"
    >
      <DIcon
        hasCircle
        icon={icon}
        size="30px"
        theme="secondary"
      />
      <div className="ms-4">
        <p className="fs-5 fw-bold text-dark mb-1">{title}</p>
        <p className="mb-0 text-muted">{description}</p>
      </div>
    </a>
  );
}
