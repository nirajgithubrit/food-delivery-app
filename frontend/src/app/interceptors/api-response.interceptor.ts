import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs/operators';

function isWrapped(body: unknown): body is { success: true; data: unknown } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'success' in body &&
    (body as { success: unknown }).success === true &&
    'data' in body
  );
}

export const apiResponseInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse && event.body && isWrapped(event.body)) {
        return event.clone({ body: event.body.data });
      }
      return event;
    }),
  );
};
