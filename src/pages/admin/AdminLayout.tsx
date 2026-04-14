import { NavLink, Outlet, Link } from 'react-router-dom';
import { useIsAdmin } from '../../lib/adminCrud';
import { useUser, authAvailable } from '../../lib/auth';

/**
 * Layout for the entire /admin route tree. Guards access to a single
 * admin user (matched by VITE_ADMIN_EMAIL), draws a left sidebar with
 * resource links, and renders the current sub-route in the main column.
 * Visually it looks like a CMS â€” tables, forms, save buttons â€” not
 * like the public site.
 */
export default function AdminLayout() {
  const user = useUser();
  const isAdmin = useIsAdmin();

  if (!authAvailable) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-serif text-3xl">Admin unavailable</h1>
        <p className="mt-3 text-muted">
          Supabase is not configured in this build. Set the VITE_SUPABASE_*
          env vars and deploy again.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-serif text-3xl">Admin</h1>
        <p className="mt-3 text-muted">Sign in from the header to continue.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-serif text-3xl">Not authorized</h1>
        <p className="mt-3 text-muted">
          This account ({user.email}) isn't the configured admin.{' '}
          <Link to="/">Go home</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <aside className="lg:w-56 lg:shrink-0">
        <nav className="space-y-1 rounded-2xl border border-rule bg-surface p-3 text-sm">
          <div className="mb-2 px-3 pt-1 text-[10px] uppercase tracking-[0.2em] text-terracotta">
            Heritage Kitchen CMS
          </div>
          <AdminLink to="/admin" end label="Overview" />
          <AdminLink to="/admin/editions" label="Editions" />
          <AdminLink to="/admin/courses" label="Courses" />
          <AdminLink to="/admin/store" label="Store" />
          <AdminLink to="/admin/monasteries" label="Monasteries" />
          <AdminLink to="/admin/sponsors" label="Sponsors" />
          <AdminLink to="/admin/adoptions" label="Adopt-a-recipe" />
          <AdminLink to="/admin/enquiries" label="Enquiries" />
          <div className="my-2 border-t border-rule" />
          <AdminLink to="/admin/images" label="Recipe images" />
          <div className="my-2 border-t border-rule" />
          <Link
            to="/"
            className="block rounded-xl px-3 py-2 text-xs !text-muted !no-underline hover:!text-terracotta"
          >
            &larr; back to the site
          </Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function AdminLink({
  to,
  label,
  end = false,
}: {
  to: string;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `block rounded-xl px-3 py-2 !no-underline transition ${
          isActive
            ? 'bg-terracotta !text-cream'
            : '!text-ink hover:bg-paper hover:!text-terracotta'
        }`
      }
    >
      {label}
    </NavLink>
  );
}
