import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchProducts from "./tools/search-products";
import getProduct from "./tools/get-product";
import listMyOrders from "./tools/list-my-orders";
import getMyOrder from "./tools/get-my-order";
import listMyWishlist from "./tools/list-my-wishlist";
import addToMyWishlist from "./tools/add-to-my-wishlist";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "click-cart-importer",
  title: "Click Cart Importer",
  version: "0.1.0",
  instructions:
    "Tools for the PasarPilih storefront (Click Cart Importer). Use `search_products` and `get_product` to browse the catalog, `list_my_orders` / `get_my_order` for the signed-in user's orders, and `list_my_wishlist` / `add_to_my_wishlist` to manage their saved products. All data is scoped to the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    searchProducts,
    getProduct,
    listMyOrders,
    getMyOrder,
    listMyWishlist,
    addToMyWishlist,
  ],
});
