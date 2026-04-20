import {
  boutonnieres,
  bridalBouquets,
  giftHampers,
  ringHolders,
} from "../utils/products.js";

function buildCatalogProducts(products, { categorySlug, imageBasePath, fallbackCategory }) {
  return products.map((product) => ({
    ...product,
    category: product.category || fallbackCategory,
    categorySlug,
    image: `${imageBasePath}/${product.image}`,
    description:
      product.specs?.[0] ||
      "A floral-led studio piece arranged for a premium gifting and celebration storefront.",
    active: true,
  }));
}

const PRODUCT_CATALOG = {
  boutonniere: buildCatalogProducts(boutonnieres, {
    categorySlug: "boutonniere",
    imageBasePath: "/images/products/boutonnieres",
    fallbackCategory: "Boutonniere",
  }),
  "bridal-bouquet": buildCatalogProducts(bridalBouquets, {
    categorySlug: "bridal-bouquet",
    imageBasePath: "/images/products/bouquets",
    fallbackCategory: "Bridal Bouquet",
  }),
  "gift-hampers": buildCatalogProducts(giftHampers, {
    categorySlug: "gift-hampers",
    imageBasePath: "/images/products/gift-hampers",
    fallbackCategory: "Gift Hamper",
  }),
  "ring-holder": buildCatalogProducts(ringHolders, {
    categorySlug: "ring-holder",
    imageBasePath: "/images/products/ring-holders",
    fallbackCategory: "Ring Holder",
  }),
};

function isActiveProduct(product) {
  return product?.active !== false;
}

export const giftHamperProducts = PRODUCT_CATALOG["gift-hampers"];
export const productCatalog = PRODUCT_CATALOG;

export function getProductsByCategory(categorySlug, { includeInactive = false } = {}) {
  const products = PRODUCT_CATALOG[categorySlug] || [];

  return includeInactive ? [...products] : products.filter(isActiveProduct);
}

export function getAllProducts(options) {
  return Object.keys(PRODUCT_CATALOG).flatMap((categorySlug) =>
    getProductsByCategory(categorySlug, options),
  );
}

export function mergeProductsWithSharedData(products = [], options) {
  const mergedProducts = new Map();

  products.forEach((product) => {
    if (product?.id) {
      mergedProducts.set(product.id, product);
    }
  });

  getAllProducts(options).forEach((product) => {
    if (product?.id) {
      mergedProducts.set(product.id, product);
    }
  });

  return Array.from(mergedProducts.values());
}
