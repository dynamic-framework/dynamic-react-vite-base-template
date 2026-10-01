/* eslint-disable @typescript-eslint/no-explicit-any */
export default function errorHandler(error: any) {
  if (error.name === 'AbortError') {
    return;
  }

  console.log(error);
}
