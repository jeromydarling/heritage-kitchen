import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-terracotta">404</p>
      <h1 className="mt-2 font-serif text-4xl">Page not found</h1>
      <p className="mt-3 text-muted">
        The page you were looking for isnâ€™t in the cookbook. Try going{' '}
        <Link to="/">back to the kitchen</Link>.
      </p>
    </div>
  );
}
