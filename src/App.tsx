import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import RecipePage from './pages/RecipePage';
import EssayPage from './pages/EssayPage';
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
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="category/:slug" element={<CategoryPage />} />
        <Route path="recipe/:id" element={<RecipePage />} />
        <Route path="essay/:id" element={<EssayPage />} />
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
        <Route path="admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
