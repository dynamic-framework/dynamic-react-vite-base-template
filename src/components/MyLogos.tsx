import { DIcon } from '@dynamic-framework/ui-react';

import ModyoLogo from '../assets/modyoLogo.svg?react';
import ReactLogo from '../assets/reactLogo.svg?react';

export default function MyLogos() {
  return (
    <div className="d-flex gap-4 flex-column flex-md-row justify-content-center align-items-center mt-4">
      <ModyoLogo />
      <DIcon
        icon="plus"
        size="2rem"
        className="text-muted"
      />
      <ReactLogo />
    </div>
  );
}
