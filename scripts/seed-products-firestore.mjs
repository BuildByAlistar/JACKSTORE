import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../src/firebase.js";
import { getAllProducts } from "../src/data/products.js";
import { getCanonicalCategorySlug, slugify } from "../src/utils/store.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeImagePath(imagePath) {
  const value = normalizeText(imagePath);
  return value;
}

function buildImportRecord(product) {
  const name = normalizeText(product?.name) || "Untitled product";
  const sourceId = normalizeText(product?.id);
  const slug = normalizeText(product?.slug) || slugify(name);
  const categoryName = normalizeText(product?.category) || "Uncategorized";
  const categorySlug =
    getCanonicalCategorySlug(product?.categorySlug || categoryName) || slugify(categoryName);
  const specs = Array.isArray(product?.specs)
    ? product.specs.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  const description =
    normalizeText(product?.description) ||
    specs[0] ||
    "A floral-led studio piece arranged for a premium gifting and celebration storefront.";

  return {
    docId: sourceId || slug,
    sourceId,
    slug,
    data: {
      id: sourceId || slug,
      name,
      slug,
      category: categoryName,
      categorySlug,
      description,
      image: normalizeImagePath(product?.image),
      price: toNumber(product?.price, 0),
      specs,
      specifications: specs,
      active: product?.active !== false,
      featured: Boolean(product?.featured),
      sku: normalizeText(product?.sku),
      updatedAt: serverTimestamp(),
    },
  };
}

async function loadExistingProductKeys() {
  const snapshot = await getDocs(collection(db, "products"));
  const existingSlugs = new Set();
  const existingIds = new Set();

  snapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data() || {};
    const docId = normalizeText(docSnapshot.id);
    const recordId = normalizeText(data.id);
    const recordSlug = normalizeText(data.slug);

    if (docId) {
      existingIds.add(docId);
    }
    if (recordId) {
      existingIds.add(recordId);
    }
    if (recordSlug) {
      existingSlugs.add(recordSlug);
    }
  });

  return { existingIds, existingSlugs };
}

async function seedProducts() {
  const dryRun = process.argv.includes("--dry-run");
  const staticProducts = getAllProducts({ includeInactive: true });
  const { existingIds, existingSlugs } = await loadExistingProductKeys();

  let created = 0;
  let skipped = 0;

  for (const rawProduct of staticProducts) {
    const { docId, sourceId, slug, data } = buildImportRecord(rawProduct);
    const duplicateBySlug = existingSlugs.has(slug);
    const duplicateById = existingIds.has(docId) || (sourceId && existingIds.has(sourceId));

    if (duplicateBySlug || duplicateById) {
      skipped += 1;
      continue;
    }

    if (!dryRun) {
      await setDoc(
        doc(db, "products", docId),
        {
          ...data,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
    }

    existingIds.add(docId);
    if (sourceId) {
      existingIds.add(sourceId);
    }
    existingSlugs.add(slug);
    created += 1;
  }

  console.log(
    [
      `Static products scanned: ${staticProducts.length}`,
      `Inserted into Firestore: ${created}${dryRun ? " (dry run)" : ""}`,
      `Skipped as duplicates: ${skipped}`,
    ].join("\n"),
  );
}

seedProducts().catch((error) => {
  console.error("Failed to seed Firestore products:", error);
  process.exit(1);
});
