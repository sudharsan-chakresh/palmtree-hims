# HIMS Regression Automation Framework

This framework is designed to automate the regression testing of the HIMS platform across multiple tiers (Nexus and Tenant Shards) and modules (OPD, Pharmacy, etc.). It uses Playwright for high-fidelity browser automation.

## 📁 Directory Structure

```text
tests/regression/
├── data/               # Externalized test data (JSON)
│   ├── opd_test_data.json
│   ├── pharmacy_test_data.json
│   └── billing_test_data.json
├── nexus/              # Tests for Superadmin Control Plane
│   └── tenant_provisioning.spec.ts
├── tenant/             # Tests for Hospital Shards (OPD, Pharmacy, etc.)
│   ├── opd_regression.spec.ts
│   ├── pharmacy_regression.spec.ts
│   └── billing_regression.spec.ts
└── utils/              # Shared helpers and Page Objects
    └── auth_helper.ts
```

## 🚀 How to Run Tests

### Run All Regression Tests
```bash
npx playwright test tests/regression
```

### Run Nexus Tier Tests
```bash
npx playwright test tests/regression/nexus
```

### Run Tenant Tier Tests
```bash
npx playwright test tests/regression/tenant
```

### View Test Report
```bash
npx playwright show-report
```

## 🛠 Key Features

1. **Multi-Tier Testing**: Separate suites for Nexus (Superadmin) and Tenant (Hospital) environments.
2. **Field-Level Validation**: Tests check for mandatory fields, data types, and UI feedback.
3. **Data-Driven**: Uses `data/opd_test_data.json` to run the same test logic with multiple patient profiles.
4. **Auth Helper**: Unified authentication logic for both tiers in `utils/auth_helper.ts`.

## 📝 Adding New Tests

1. **Add Data**: Add new test cases to the appropriate JSON file in `tests/regression/data`.
2. **Create Spec**: Create a new `.spec.ts` file in `nexus/` or `tenant/`.
3. **Use Helpers**: Import `AuthHelper` to handle session setup.

### Example: Adding Pharmacy Regression
1. Create `tests/regression/tenant/pharmacy_regression.spec.ts`.
2. Use `auth.loginTenant('Millenium Hospitals')`.
3. Navigate to Pharmacy and validate dispensing flows and inventory updates.

---

## 🆕 Recent Regression Updates (May 18-20, 2026)
- New shared helper support was added in `tests/regression/utils/auth_helper.ts` for tenant and nexus login flows.
- Regression tests should now cover the updated doctor scheduling and appointment booking workflows, including weekly schedule navigation and rescheduling.
- The framework supports new schema reconciliation workflows with database migration validation scripts under `database/migrations/`.
- New test coverage should validate improved tenant billing tracking and invoice item creation for the updated `invoice_items` schema.

### Example: Adding Billing Regression
1. Create `tests/regression/tenant/billing_regression.spec.ts`.
2. Select a patient and add multiple billing items.
3. Validate total calculation and invoice generation.

---

> [!TIP]
> To run tests in headed mode (visible browser), use the `--headed` flag:
> `npx playwright test tests/regression --headed`
