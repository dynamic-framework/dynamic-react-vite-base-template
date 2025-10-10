/* eslint-disable @typescript-eslint/no-explicit-any */
export default function errorHandler(error: any) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (error.name === 'AbortError') {
    return;
  }

  // eslint-disable-next-line no-console
  console.log(error);
}
