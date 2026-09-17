# web-app-shell Specification

## Purpose

Defines the frame every page of the web application shares: global navigation, the visible health of the API, the states a data view must present, and keyboard operability of its controls.

## Requirements

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

### Requirement: Data view states
Every page that loads data SHALL show a loading state while the request is in flight, an error state with a retry action if the request fails, and — for lists — an empty state when no items match. A list whose filters produce no items SHALL offer an action that clears the filters. A page for a single record that does not exist SHALL show a not-found state with a link back to the list.

#### Scenario: Empty filtered list
- **WHEN** the products page is filtered so that no product matches
- **THEN** the page shows an empty state naming that no products match and a control that clears the filters and shows the full list again

#### Scenario: Unreachable API on the list
- **WHEN** the products page cannot reach the API
- **THEN** the page shows an error state with a retry action instead of an empty table

#### Scenario: Missing product
- **WHEN** a user opens the detail page of an id that does not exist
- **THEN** the page shows a not-found state and a link to the products page

### Requirement: Keyboard operability
Interactive controls SHALL be operable with the keyboard: confirmation dialogs trap focus while open, return focus to the triggering control when closed and close on `Escape`; select controls open, navigate and choose with the keyboard; sortable table headers are focusable buttons; every form field has a visible label associated with its input.

#### Scenario: Dialog dismissed with Escape
- **WHEN** a delete confirmation dialog is open and the user presses `Escape`
- **THEN** the dialog closes, nothing is deleted, and focus returns to the delete control that opened it

#### Scenario: Form fields labelled
- **WHEN** a user tabs through the product form
- **THEN** each input is announced with its label and, when invalid, with its error message
