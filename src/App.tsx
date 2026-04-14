import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import RecipePage from './pages/RecipePage';
import EssayPage from './pages/EssayPage';
import SearchPage from './pages/SearchPage';
import CalendarPage from './pages/CalendarPage';
import CookbookPage from './pages/CookbookPage';
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
        <Route path="search" element={<SearchPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
