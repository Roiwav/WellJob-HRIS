import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sidebarSource = fs.readFileSync(
  new URL("../src/components/Sidebar.jsx", import.meta.url),
  "utf8"
);
const navbarSource = fs.readFileSync(
  new URL("../src/components/Navbar.jsx", import.meta.url),
  "utf8"
);
const layoutSource = fs.readFileSync(
  new URL("../src/layout/MainLayout.jsx", import.meta.url),
  "utf8"
);

test("mobile navigation exposes an accessible controlled drawer", () => {
  assert.match(navbarSource, /aria-label="Open navigation menu"/);
  assert.match(navbarSource, /aria-expanded=\{mobileNavigationOpen\}/);
  assert.match(navbarSource, /aria-controls="mobile-navigation-drawer"/);
  assert.match(sidebarSource, /role="dialog"/);
  assert.match(sidebarSource, /aria-modal="true"/);
  assert.match(sidebarSource, /event\.key === "Escape"/);
  assert.match(sidebarSource, /document\.body\.style\.overflow = "hidden"/);
  assert.match(sidebarSource, /restoreFocusTarget\?\.focus/);
});

test("desktop navigation remains lg-only and viewport changes close the drawer", () => {
  assert.match(sidebarSource, /lg:flex/);
  assert.match(sidebarSource, /lg:hidden/);
  assert.match(layoutSource, /min-width: 1024px/);
  assert.match(layoutSource, /p-0 sm:p-2 lg:p-6/);
});