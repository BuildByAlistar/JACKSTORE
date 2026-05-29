import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import CategoryForm from "./components/CategoryForm";
import {
  addCategoryToFirestore,
  deleteCategoryFromFirestore,
  fetchCategoriesFromFirestore,
  fetchProductsFromFirestore,
  updateCategoryInFirestore,
  updateCategoryPatchInFirestore,
} from "./adminStore";
import { slugify } from "../utils/store";

const initialFormState = {
  name: "",
  slug: "",
  description: "",
  image: "",
  active: true,
};

function validateCategory(formData) {
  if (!formData.name.trim()) {
    return "Category name is required.";
  }

  if (!formData.slug.trim()) {
    return "Category slug is required.";
  }

  return "";
}

function sortCategoriesForUi(records) {
  return [...records].sort((firstCategory, secondCategory) =>
    firstCategory.name.localeCompare(secondCategory.name),
  );
}

function createLocalCategoryRecord(categoryId, values, existingCategory = null) {
  const name = values.name.trim();

  return {
    ...existingCategory,
    id: categoryId,
    name,
    slug: values.slug.trim() || slugify(name),
    description: values.description.trim(),
    image: values.image.trim(),
    active: Boolean(values.active),
    createdAt: existingCategory?.createdAt || new Date(),
    updatedAt: new Date(),
  };
}

function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [formData, setFormData] = useState(initialFormState);
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionCategoryId, setActionCategoryId] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [categoryData, productData] = await Promise.all([
        fetchCategoriesFromFirestore(),
        fetchProductsFromFirestore(),
      ]);
      setCategories(categoryData);
      setProducts(productData);
      setError("");
    } catch (fetchError) {
      console.error("Failed to fetch categories:", fetchError);
      setError("Category data could not be loaded from Firestore.");
      alert("Error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categorySummary = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return categories
      .map((category) => ({
        ...category,
        productCount: products.filter((product) => product.categorySlug === category.slug).length,
      }))
      .filter((category) => {
        if (!normalizedSearch) {
          return true;
        }

        return [category.name, category.slug, category.description]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      });
  }, [categories, products, searchValue]);

  const resetForm = useCallback(() => {
    setFormData(initialFormState);
    setEditingCategoryId("");
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

  const handleStartAdd = () => {
    setFeedback("");
    setFormError("");
    setFormData(initialFormState);
    setEditingCategoryId("");
    setSlugEdited(false);
    setIsFormOpen(true);
  };

  const handleStartEdit = (category) => {
    setFeedback("");
    setFormError("");
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      image: category.image || "",
      active: category.active !== false,
    });
    setEditingCategoryId(category.id);
    setSlugEdited(true);
    setIsFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateCategory(formData);

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError("");
    setFeedback("");

    try {
      if (editingCategoryId) {
        await updateCategoryInFirestore(editingCategoryId, formData);
        setCategories((currentCategories) =>
          sortCategoriesForUi(
            currentCategories.map((currentCategory) =>
              currentCategory.id === editingCategoryId
                ? createLocalCategoryRecord(editingCategoryId, formData, currentCategory)
                : currentCategory,
            ),
          ),
        );
        setFeedback("Category updated successfully.");
      } else {
        const docRef = await addCategoryToFirestore(formData);
        setCategories((currentCategories) =>
          sortCategoriesForUi([
            createLocalCategoryRecord(docRef.id, formData),
            ...currentCategories,
          ]),
        );
        setFeedback("Category created successfully.");
      }

      window.dispatchEvent(new Event("jackstudio-storefront-refresh"));
      resetForm();
    } catch (saveError) {
      console.error("Failed to save category:", saveError);
      setFormError("Category could not be saved.");
      alert("Error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`Delete category "${category.name}"?`)) {
      return;
    }

    setActionCategoryId(category.id);
    setFeedback("");

    try {
      await deleteCategoryFromFirestore(category.id);
      setCategories((currentCategories) =>
        currentCategories.filter((currentCategory) => currentCategory.id !== category.id),
      );
      setFeedback("Category deleted successfully.");
      window.dispatchEvent(new Event("jackstudio-storefront-refresh"));
    } catch (deleteError) {
      console.error("Failed to delete category:", deleteError);
      setFeedback("Category could not be deleted.");
      alert("Error occurred");
    } finally {
      setActionCategoryId("");
    }
  };

  const handleToggleActive = async (category) => {
    setActionCategoryId(category.id);
    setFeedback("");

    try {
      await updateCategoryPatchInFirestore(category.id, {
        active: !category.active,
      });
      setCategories((currentCategories) =>
        currentCategories.map((currentCategory) =>
          currentCategory.id === category.id
            ? { ...currentCategory, active: !currentCategory.active }
            : currentCategory,
        ),
      );
      setFeedback("Category status updated.");
      window.dispatchEvent(new Event("jackstudio-storefront-refresh"));
    } catch (updateError) {
      console.error("Failed to update category status:", updateError);
      setFeedback("Category status could not be updated.");
      alert("Error occurred");
    } finally {
      setActionCategoryId("");
    }
  };

  return (
    <AdminLayout
      title="Categories"
      description="Manage category names, slugs, descriptions, storefront images, and active status for product assignment."
      actions={
        <>
          <button className="admin-button admin-button--secondary" onClick={loadData} type="button">
            Refresh
          </button>
          <button className="admin-button admin-button--primary" onClick={handleStartAdd} type="button">
            Add Category
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
          <p className="admin-stat__label">Categories</p>
          <p className="admin-stat__value">{loading ? "..." : categories.length}</p>
        </article>
        <article className="admin-card admin-card--stat">
          <p className="admin-stat__label">Active</p>
          <p className="admin-stat__value">
            {loading ? "..." : categories.filter((category) => category.active).length}
          </p>
        </article>
        <article className="admin-card admin-card--stat">
          <p className="admin-stat__label">Products mapped</p>
          <p className="admin-stat__value">{loading ? "..." : products.length}</p>
        </article>
        <article className="admin-card admin-card--stat">
          <p className="admin-stat__label">Search results</p>
          <p className="admin-stat__value">{loading ? "..." : categorySummary.length}</p>
        </article>
      </section>

      {isFormOpen ? (
        <CategoryForm
          errorMessage={formError}
          formData={formData}
          isEditing={Boolean(editingCategoryId)}
          onCancel={resetForm}
          onFieldChange={handleFieldChange}
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
              placeholder="Search categories by name or slug"
              type="text"
              value={searchValue}
            />
          </label>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card__header">
          <div>
            <p className="admin-caption">Category records</p>
            <h3 className="admin-card__title">Categories</h3>
          </div>
        </div>

        {loading ? (
          <p className="admin-card__description">Loading categories...</p>
        ) : categorySummary.length === 0 ? (
          <div className="admin-empty">No categories match the current search.</div>
        ) : (
          <div className="admin-grid admin-grid--categories">
            {categorySummary.map((category) => (
              <article key={category.id} className="admin-card">
                <div className="admin-card__header">
                  <div>
                    <p className="admin-caption">Slug</p>
                    <h4 className="admin-card__title">{category.name}</h4>
                  </div>
                  <span className={`admin-status${category.active ? "" : " admin-status--legacy"}`}>
                    {category.active ? "active" : "inactive"}
                  </span>
                </div>

                <p className="admin-card__description">{category.slug}</p>
                <p className="admin-card__description">
                  {category.description || "No description added yet."}
                </p>
                <p className="admin-list-item__meta">{category.productCount} mapped products</p>

                <div className="admin-actions">
                  <button
                    className="admin-button admin-button--secondary admin-button--small"
                    disabled={actionCategoryId === category.id}
                    onClick={() => handleToggleActive(category)}
                    type="button"
                  >
                    {category.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    className="admin-button admin-button--secondary admin-button--small"
                    onClick={() => handleStartEdit(category)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="admin-button admin-button--danger admin-button--small"
                    disabled={actionCategoryId === category.id}
                    onClick={() => handleDelete(category)}
                    type="button"
                  >
                    {actionCategoryId === category.id ? "Working..." : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminLayout>
  );
}

export default AdminCategories;
