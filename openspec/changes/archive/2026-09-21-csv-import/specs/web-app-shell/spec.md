# Spec Delta

## MODIFIED Requirements

### Requirement: Global navigation
Every page SHALL render a header containing the application wordmark linking to the home page, links to the products page and to the imports page, and the API status indicator; and a footer. The home page SHALL present the application name and a primary action leading to the products page.

#### Scenario: Header on every page
- **WHEN** a user opens the home page, the products page, a product's detail page, a product form, the imports page or an import report
- **THEN** the same header with the wordmark, the `Products` and `Imports` links and the API status is visible at the top

#### Scenario: Home leads to the catalog
- **WHEN** a user activates the primary action on the home page
- **THEN** the products page opens

#### Scenario: Header leads to imports
- **WHEN** a user activates the `Imports` link in the header
- **THEN** the imports page opens
