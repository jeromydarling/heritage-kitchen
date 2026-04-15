import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import RecipePage from './pages/RecipePage';
import EssayPage from './pages/EssayPage';
import HowToCookPage from './pages/HowToCookPage';
import HowToCookKidsPage from './pages/HowToCookKidsPage';
import LessonDetailPage from './pages/LessonDetailPage';
import SearchPage from './pages/SearchPage';
import CalendarPage from './pages/CalendarPage';
import CookbookPage from './pages/CookbookPage';
import MealPlanPage from './pages/MealPlanPage';
import ShoppingListPage from './pages/ShoppingListPage';
import CookbookBuilderPage from './pages/CookbookBuilderPage';
import PrintCookbookPage from './pages/PrintCookbookPage';
import OrderStatusPage from './pages/OrderStatusPage';
import EditionsPage from './pages/EditionsPage';
import EditionDetailPage from './pages/EditionDetailPage';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import StorePage from './pages/StorePage';
import MonasteriesPage from './pages/MonasteriesPage';
import MonasteryDetailPage from './pages/MonasteryDetailPage';
import FriendsPage from './pages/FriendsPage';
import ServicesPage from './pages/ServicesPage';
import AlmanacPage from './pages/AlmanacPage';
import LicensingPage from './pages/LicensingPage';
import AboutPage from './pages/AboutPage';
import HouseholdPage from './pages/HouseholdPage';
import KidJournalPage from './pages/KidJournalPage';
import AdminPage from './pages/AdminPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminOverviewPage from './pages/admin/AdminOverviewPage';
import EditionsAdminPage from './pages/admin/EditionsAdminPage';
import CoursesAdminPage from './pages/admin/CoursesAdminPage';
import StoreAdminPage from './pages/admin/StoreAdminPage';
import MonasteriesAdminPage from './pages/admin/MonasteriesAdminPage';
import SponsorsAdminPage from './pages/admin/SponsorsAdminPage';
import AdoptionsAdminPage from './pages/admin/AdoptionsAdminPage';
import EnquiriesAdminPage from './pages/admin/EnquiriesAdminPage';
import OrdersAdminPage from './pages/admin/OrdersAdminPage';
import LessonsAdminPage from './pages/admin/LessonsAdminPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="category/:slug" element={<CategoryPage />} />
        <Route path="recipe/:id" element={<RecipePage />} />
        <Route path="essay/:id" element={<EssayPage />} />
        <Route path="how-to-cook" element={<HowToCookPage />} />
        <Route path="how-to-cook/kids" element={<HowToCookKidsPage />} />
        <Route path="how-to-cook/:id" element={<LessonDetailPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="cookbook" element={<CookbookPage />} />
        <Route path="cookbook/build" element={<CookbookBuilderPage />} />
        <Route path="print/cookbook/:id" element={<PrintCookbookPage />} />
        <Route path="order/:id" element={<OrderStatusPage />} />
        <Route path="editions" element={<EditionsPage />} />
        <Route path="editions/:slug" element={<EditionDetailPage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/:slug" element={<CourseDetailPage />} />
        <Route path="store" element={<StorePage />} />
        <Route path="monasteries" element={<MonasteriesPage />} />
        <Route path="monasteries/:slug" element={<MonasteryDetailPage />} />
        <Route path="friends" element={<FriendsPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="almanac" element={<AlmanacPage />} />
        <Route path="licensing" element={<LicensingPage />} />
        <Route path="plan" element={<MealPlanPage />} />
        <Route path="shopping" element={<ShoppingListPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="household" element={<HouseholdPage />} />
        <Route path="household/kids/:id" element={<KidJournalPage />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="editions" element={<EditionsAdminPage />} />
          <Route path="courses" element={<CoursesAdminPage />} />
          <Route path="store" element={<StoreAdminPage />} />
          <Route path="monasteries" element={<MonasteriesAdminPage />} />
          <Route path="sponsors" element={<SponsorsAdminPage />} />
          <Route path="adoptions" element={<AdoptionsAdminPage />} />
          <Route path="enquiries" element={<EnquiriesAdminPage />} />
          <Route path="orders" element={<OrdersAdminPage />} />
          <Route path="lessons" element={<LessonsAdminPage />} />
          <Route path="images" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
