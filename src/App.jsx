import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import StorefrontFooter from "./components/StorefrontFooter";
import StorefrontFloatingActions from "./components/StorefrontFloatingActions";
import Chatbot from "./components/Chatbot";
import ScrollToTop from "./components/ScrollToTop";
import Home from "./pages/Home";
import Collections from "./pages/Collections";
import CollectionPage from "./pages/CollectionPage";
import ProductDetails from "./pages/ProductDetails";
import Cart from "./pages/Cart";
import Contact from "./pages/Contact";
import About from "./pages/About";
import Inquiry from "./pages/Inquiry";
import AdminDashboard from "./admin/AdminDashboard";
import AdminLogin from "./admin/AdminLogin";
import AdminOrders from "./admin/AdminOrders";
import AdminProducts from "./admin/AdminProducts";
import AdminCategories from "./admin/AdminCategories";
import AdminSettings from "./admin/AdminSettings";
import AdminFaq from "./admin/AdminFaq";
import AdminChatLogs from "./admin/AdminChatLogs";
import AdminProtectedRoute from "./admin/AdminProtectedRoute";
import {
  fetchCategoriesFromFirestore,
  fetchProductsFromFirestore,
} from "./admin/adminStore";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { StorefrontProvider } from "./context/StorefrontContext";
import {
  buildCategoryOptions,
  getFeaturedProducts,
} from "./utils/store";
import "./App.css";
import "./admin/admin.css";

function AppContent({ products, categories, loading, error }) {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const categoryOptions = buildCategoryOptions(categories);
  const featuredProducts = getFeaturedProducts(products);

  return (
    <div className={isAdminRoute ? "admin-app" : "app-shell"}>
      <ScrollToTop />
      {!isAdminRoute ? <Navbar /> : null}

      <Routes>
        <Route
          path="/"
          element={
            <Home
              products={products}
              categories={categoryOptions}
              featuredProducts={featuredProducts}
              loading={loading}
              error={error}
            />
          }
        />
        <Route
          path="/collections"
          element={
            <Collections
              products={products}
              categories={categoryOptions}
              loading={loading}
              error={error}
            />
          }
        />
        <Route
          path="/collections/:slug"
          element={
            <CollectionPage
              products={products}
              categories={categoryOptions}
              loading={loading}
              error={error}
            />
          }
        />
        <Route
          path="/product/:productSlug"
          element={
            <ProductDetails
              products={products}
              categories={categoryOptions}
              loading={loading}
              error={error}
            />
          }
        />
        <Route path="/cart" element={<Cart />} />
        <Route path="/inquiry" element={<Inquiry />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        <Route element={<AdminProtectedRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/inquiries" element={<AdminOrders />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/faq" element={<AdminFaq />} />
          <Route path="/admin/chat-logs" element={<AdminChatLogs />} />
        </Route>
      </Routes>

      {!isAdminRoute ? (
        <>
          <StorefrontFooter />
          <StorefrontFloatingActions />
          <Chatbot key={location.pathname} />
        </>
      ) : null}
    </div>
  );
}

function App() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchStorefrontData = async () => {
      try {
        setLoading(true);
        setError("");

        const [productsResult, categoriesResult] = await Promise.allSettled([
          fetchProductsFromFirestore(),
          fetchCategoriesFromFirestore(),
        ]);

        const productData =
          productsResult.status === "fulfilled"
            ? productsResult.value.filter((product) => product.active !== false)
            : [];

        if (isMounted) {
          setProducts(productData);
        }

        if (productsResult.status === "rejected") {
          console.error("Failed to fetch products:", productsResult.reason);

          if (isMounted && productData.length === 0) {
            setError("Please check your Firestore data or connection and try again.");
          }
        }

        if (categoriesResult.status === "fulfilled") {
          const categoryData = categoriesResult.value.filter(
            (category) => category.active !== false,
          );

          if (isMounted) {
            setCategories(categoryData);
          }
        } else {
          console.error("Failed to fetch categories:", categoriesResult.reason);

          if (isMounted) {
            setCategories([]);
          }
        }
      } catch (fetchError) {
        console.error("Failed to fetch storefront data:", fetchError);

        if (isMounted) {
          setProducts([]);
          setError("Please check your Firestore data or connection and try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchStorefrontData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AuthProvider>
      <CartProvider>
        <StorefrontProvider>
          <BrowserRouter>
            <AppContent
              products={products}
              categories={categories}
              loading={loading}
              error={error}
            />
          </BrowserRouter>
        </StorefrontProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
