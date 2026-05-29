import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import ProductForm from "./components/ProductForm";
import {
  addProductToFirestore,
  deleteProductFromFirestore,
  fetchCategoriesFromFirestore,
  fetchProductsFromFirestore,
  updateProductInFirestore,
  updateProductPatchInFirestore,
} from "./adminStore";
import {
  formatPrice,
  getInitials,
  getProductImage,
  getProductName,
  slugify,
} from "../utils/store";

const initialFormState = {
  name: "",
  slug: "",
  price: "",
  comparePrice: "",
  image: "",
  gallery: [""],
  category: "",
  description: "",
  specifications: [""],
  featured: false,
  active: true,
  stock: "0",
  sku: "",
};

function createProductFormState(product) {
  return {
    name: getProductName(product),
    slug: product.slug || slugify(getProductName(product)),
    price: String(product.price ?? ""),
    comparePrice: product.comparePrice ?? "",
    image: getProductImage(product),
    gallery:
      product.gallery && product.gallery.length > 0
        ? [...product.gallery]
        : [getProductImage(product)].filter(Boolean).concat([""]).slice(0, 2),
    category: product.category || product.categoryName || "",
    description: product.description || "",
    specifications:
      product.specifications && product.specifications.length > 0
        ? [...product.specifications]
        : [""],
    featured: Boolean(product.featured),
    active: product.active !== false,
    stock: String(product.stock ?? 0),
    sku: product.sku || "",
  };
}

function normalizeArrayRows(values) {
  const filteredValues = values.map((value) => String(value || "").trim()).filter(Boolean);
  return filteredValues.length > 0 ? filteredValues : [""];
}

function getRecordTime(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
}

function sortProductsForUi(records) {
  return [...records].sort((firstProduct, secondProduct) =>
    getRecordTime(secondProduct.updatedAt || secondProduct.createdAt) -
    getRecordTime(firstProduct.updatedAt || firstProduct.createdAt),
  );
}

function createLocalProductRecord(productId, values, existingProduct = null) {
  const name = values.name.trim();
  const categoryName = values.category.trim();
  const createdAt = existingProduct?.createdAt || new Date();

  return {
    ...existingProduct,
    id: productId,
    name,
    slug: values.slug.trim() || slugify(name),
    price: Number(values.price),
    comparePrice: values.comparePrice === "" ? null : Number(values.comparePrice),
    image: values.image.trim(),
    gallery: normalizeArrayRows(values.gallery),
    category: categoryName,
    categoryName,
    categorySlug: slugify(categoryName),
    description: values.description.trim(),
    specifications: normalizeArrayRows(values.specifications),
    featured: Boolean(values.featured),
    active: Boolean(values.active),
    stock: Number.parseInt(values.stock, 10),
    sku: values.sku.trim(),
    createdAt,
    updatedAt: new Date(),
  };
}

function validateProduct(formData) {
  if (!formData.name.trim()) {
    return "Product name is required.";
  }

  if (!formData.slug.trim()) {
    return "Product slug is required.";
  }

  if (!formData.category.trim()) {
    return "Product category is required.";
  }

  if (!formData.image.trim()) {
    return "Primary image is required.";
  }

  if (formData.price === "" || Number.isNaN(Number(formData.price))) {
    return "Price must be a valid number.";
  }

  if (formData.stock === "" || Number.isNaN(Number(formData.stock))) {
    return "Stock must be a valid number.";
  }

  return "";
}

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formData, setFormData] = useState(initialFormState);
  const [editingProductId, setEditingProductId] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionProductId, setActionProductId] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [productData, categoryData] = await Promise.all([
        fetchProductsFromFirestore(),
        fetchCategoriesFromFirestore(),
      ]);
      setProducts(productData);
      setCategories(categoryData);
      setError("");
    } catch (fetchError) {
      console.error("Failed to fetch products:", fetchError);
      setError("Product data could not be loaded from Firestore.");
      alert("Error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return products.filter((product) => {
      if (categoryFilter !== "all" && product.categorySlug !== categoryFilter) {
        return false;
      }

      if (statusFilter === "active" && !product.active) {
        return false;
      }

      if (statusFilter === "inactive" && product.active) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        getProductName(product),
        product.slug,
        product.category,
        product.sku,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [products, searchValue, categoryFilter, statusFilter]);

  const resetForm = useCallback(() => {
    setFormData(initialFormState);
    setEditingProductId("");
    setSlugEdited(false);
    setFormError("");
    setIsFormOpen(false);
  }, []);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    setFormData((currentFormData) => {
      if (name === "name" && !slugEdited) {
        return {
          ...currentFormData,
          name: value,
          slug: slugify(value),
        };
      }

      return {
        ...currentFormData,
        [name]: value,
      };
    });

    if (name === "slug") {
      setSlugEdited(true);
    }
  };

  const handleToggleChange = (event) => {
    const { name, checked } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: checked,
    }));
  };

  const updateGalleryRow = (index, value) => {
    setFormData((currentFormData) => ({
      ...currentFormData,
      gallery: currentFormData.gallery.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    }));
  };

  const removeGalleryRow = (index) => {
    setFormData((currentFormData) => ({
      ...currentFormData,
      gallery: normalizeArrayRows(
        currentFormData.gallery.filter((_, itemIndex) => itemIndex !== index),
      ),
    }));
  };

  const updateSpecificationRow = (index, value) => {
    setFormData((currentFormData) => ({
      ...currentFormData,
      specifications: currentFormData.specifications.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    }));
  };

  const removeSpecificationRow = (index) => {
    setFormData((currentFormData) => ({
      ...currentFormData,
      specifications: normalizeArrayRows(
        currentFormData.specifications.filter((_, itemIndex) => itemIndex !== index),
      ),
    }));
  };

  const handleStartAdd = () => {
    setFeedback("");
    setFormError("");
    setFormData(initialFormState);
    setEditingProductId("");
    setSlugEdited(false);
    setIsFormOpen(true);
  };

  const handleStartEdit = (product) => {
    setFeedback("");
    setFormError("");
    setFormData(createProductFormState(product));
    setEditingProductId(product.id);
    setSlugEdited(true);
    setIsFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateProduct(formData);

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError("");
    setFeedback("");

    const payload = {
      ...formData,
      gallery: normalizeArrayRows(formData.gallery),
      specifications: normalizeArrayRows(formData.specifications),
    };

    try {
      if (editingProductId) {
        await updateProductInFirestore(editingProductId, payload);
        setProducts((currentProducts) =>
          sortProductsForUi(
            currentProducts.map((currentProduct) =>
              currentProduct.id === editingProductId
                ? createLocalProductRecord(editingProductId, payload, currentProduct)
                : currentProduct,
            ),
          ),
        );
        setFeedback("Product updated successfully.");
      } else {
        const docRef = await addProductToFirestore(payload);
        setProducts((currentProducts) =>
          sortProductsForUi([
            createLocalProductRecord(docRef.id, payload),
            ...currentProducts,
          ]),
        );
        setFeedback("Product created successfully.");
      }

      window.dispatchEvent(new Event("jackstudio-storefront-refresh"));
      resetForm();
    } catch (saveError) {
      console.error("Failed to save product:", saveError);
      setFormError("Product could not be saved.");
      alert("Error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${getProductName(product)}"?`)) {
      return;
    }

    setActionProductId(product.id);
    setFeedback("");

    try {
      await deleteProductFromFirestore(product.id);
      setProducts((currentProducts) =>
        currentProducts.filter((currentProduct) => currentProduct.id !== product.id),
      );
      setFeedback("Product deleted successfully.");
      window.dispatchEvent(new Event("jackstudio-storefront-refresh"));
    } catch (deleteError) {
      console.error("Failed to delete product:", deleteError);
      setFeedback("Product could not be deleted.");
      alert("Error occurred");
    } finally {
      setActionProductId("");
    }
  };

  const handleTogglePatch = async (product, fieldName) => {
    const nextValue = !product[fieldName];
    setActionProductId(product.id);
    setFeedback("");

    try {
      await updateProductPatchInFirestore(product.id, {
        [fieldName]: nextValue,
      });
      setProducts((currentProducts) =>
        currentProducts.map((currentProduct) =>
          currentProduct.id === product.id
            ? { ...currentProduct, [fieldName]: nextValue }
            : currentProduct,
        ),
      );
      setFeedback(`Product ${fieldName} updated.`);
      window.dispatchEvent(new Event("jackstudio-storefront-refresh"));
    } catch (updateError) {
      console.error(`Failed to update product ${fieldName}:`, updateError);
      setFeedback(`Product ${fieldName} could not be updated.`);
      alert("Error occurred");
    } finally {
      setActionProductId("");
    }
  };

  return (
    <AdminLayout
      title="Catalog"
      description="Add, edit, search, filter, and maintain live products with Firestore-backed catalog fields."
      actions={
        <>
          <button className="admin-button admin-button--secondary" onClick={loadData} type="button">
            Refresh
          </button>
          <button className="admin-button admin-button--primary" onClick={handleStartAdd} type="button">
            Add Product
          </button>
        </>
      }
    >
      {error ? <div className="admin-feedback admin-feedback--error">{error}</div> : null}
      {feedback ? (
        <div className={`admin-feedback${feedback.includes("could not") ? " admin-feedback--error" : ""}`}>
          {feedback}
        </div>
      ) : null}

      <section className="admin-grid admin-grid--stats">
        <article className="admin-card admin-card--stat">
          <p className="admin-stat__label">Products</p>
          <p className="admin-stat__value">{loading ? "..." : products.length}</p>
        </article>
        <article className="admin-card admin-card--stat">
          <p className="admin-stat__label">Featured</p>
          <p className="admin-stat__value">
            {loading ? "..." : products.filter((product) => product.featured).length}
          </p>
        </article>
        <article className="admin-card admin-card--stat">
          <p className="admin-stat__label">Inactive</p>
          <p className="admin-stat__value">
            {loading ? "..." : products.filter((product) => !product.active).length}
          </p>
        </article>
        <article className="admin-card admin-card--stat">
          <p className="admin-stat__label">Out of stock</p>
          <p className="admin-stat__value">
            {loading ? "..." : products.filter((product) => product.stock <= 0).length}
          </p>
        </article>
      </section>

      {isFormOpen ? (
        <ProductForm
          categories={categories}
          errorMessage={formError}
          formData={formData}
          isEditing={Boolean(editingProductId)}
          onAddGalleryRow={() =>
            setFormData((currentFormData) => ({
              ...currentFormData,
              gallery: [...currentFormData.gallery, ""],
            }))
          }
          onAddSpecificationRow={() =>
            setFormData((currentFormData) => ({
              ...currentFormData,
              specifications: [...currentFormData.specifications, ""],
            }))
          }
          onCancel={resetForm}
          onFieldChange={handleFieldChange}
          onGalleryChange={updateGalleryRow}
          onRemoveGalleryRow={removeGalleryRow}
          onRemoveSpecificationRow={removeSpecificationRow}
          onSpecificationChange={updateSpecificationRow}
          onSubmit={handleSubmit}
          onToggleChange={handleToggleChange}
          saving={saving}
        />
      ) : null}

      <section className="admin-card">
        <div className="admin-toolbar">
          <label className="admin-field">
            <span className="admin-field__label">Search</span>
            <input
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by name, slug, SKU"
              type="text"
              value={searchValue}
            />
          </label>

          <label className="admin-field">
            <span className="admin-field__label">Category</span>
            <select onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span className="admin-field__label">Status</span>
            <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="all">All products</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card__header">
          <div>
            <p className="admin-caption">Catalog list</p>
            <h3 className="admin-card__title">Products</h3>
          </div>
        </div>

        {loading ? (
          <p className="admin-card__description">Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <div className="admin-empty">No products match the current filters.</div>
        ) : (
          <div className="admin-table">
            {filteredProducts.map((product) => {
              const image = getProductImage(product);
              const productName = getProductName(product);

              return (
                <div key={product.id} className="admin-table__row">
                  <div className="admin-table__media">
                    {image ? (
                      <img alt={productName} className="admin-table__image" src={image} />
                    ) : (
                      <div className="admin-table__placeholder">
                        <span>{getInitials(productName)}</span>
                      </div>
                    )}
                  </div>

                  <div className="admin-table__content">
                    <div>
                      <h4 className="admin-list-item__title">{productName}</h4>
                      <p className="admin-list-item__meta">
                        {product.category} | SKU: {product.sku || "Not set"} | Slug: {product.slug}
                      </p>
                    </div>

                    <div className="admin-table__meta">
                      <span className={`admin-status${product.active ? "" : " admin-status--legacy"}`}>
                        {product.active ? "active" : "inactive"}
                      </span>
                      <span className={`admin-status${product.featured ? "" : " admin-status--legacy"}`}>
                        {product.featured ? "featured" : "standard"}
                      </span>
                      <span className={`admin-status${product.stock > 0 ? " admin-status--contacted" : " admin-status--legacy"}`}>
                        {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                      </span>
                    </div>
                  </div>

                  <div className="admin-table__pricing">
                    <strong>{formatPrice(product.price)}</strong>
                    {product.comparePrice ? (
                      <span className="admin-list-item__meta">{formatPrice(product.comparePrice)}</span>
                    ) : null}
                  </div>

                  <div className="admin-actions">
                    <button
                      className="admin-button admin-button--secondary admin-button--small"
                      disabled={actionProductId === product.id}
                      onClick={() => handleTogglePatch(product, "featured")}
                      type="button"
                    >
                      {product.featured ? "Unfeature" : "Feature"}
                    </button>
                    <button
                      className="admin-button admin-button--secondary admin-button--small"
                      disabled={actionProductId === product.id}
                      onClick={() => handleTogglePatch(product, "active")}
                      type="button"
                    >
                      {product.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      className="admin-button admin-button--secondary admin-button--small"
                      onClick={() => handleStartEdit(product)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="admin-button admin-button--danger admin-button--small"
                      disabled={actionProductId === product.id}
                      onClick={() => handleDelete(product)}
                      type="button"
                    >
                      {actionProductId === product.id ? "Working..." : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AdminLayout>
  );
}

export default AdminProducts;
