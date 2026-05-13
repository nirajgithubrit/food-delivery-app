describe("Smoke", () => {
  it("loads customer login", () => {
    cy.visit("/");
    cy.contains("Gir Gamthi", { matchCase: false });
    cy.contains("Sign in", { matchCase: false });
  });

  it("loads admin login", () => {
    cy.visit("/admin/login");
    cy.contains("Admin sign in", { matchCase: false });
  });

  it("loads admin registration", () => {
    cy.visit("/admin/register");
    cy.contains("Create restaurant account", { matchCase: false });
  });
});
