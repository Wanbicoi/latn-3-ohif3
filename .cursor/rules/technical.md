# Technical Specifications

This document outlines the technical standards for the data annotation platform.

## 1. Technology Stack

- **Backend**: PostgreSQL on Supabase (Auth, Database, Real-time)
- **Frontend**: React with [refine.dev](https://refine.dev/) and Ant Design
- **Tooling**: Vite, and either npm or yarn

## 2. Backend Development (Supabase)

1.  **Project Setup**: New projects should be configured on the Supabase dashboard using the `public_v2` schema by default.

2.  **Schema Management**:
    - Define the initial schema in `supabase/tables.sql` and `supabase/policies.sql`.
    - REMEMBER to apply new changes or additions to `functions`, or `views` within the `supabase` directory by running the following command:
      ```bash
      yarn run psql ./supabase/<file_path>
      ```

3.  **SQL Logic**:
    - All SQL functions and triggers **MUST** be idempotent.
    - Implement atomic state transitions as SQL functions in `supabase/functions/`. Here is the template for functions:
      ```sql
      DROP FUNCTION IF EXISTS public_v2.<function_name> (...);

      CREATE OR REPLACE FUNCTION public_v2.<function_name> (...) RETURNS ... AS $$
      BEGIN
          ...
      END;
      $$ LANGUAGE plpgsql VOLATILE;
      ```
    - All views **MUST** use `WITH (security_invoker = true)` to ensure security context, like so:
      ```sql
      DROP VIEW IF EXISTS public_v2.<view_name>;

      CREATE OR REPLACE VIEW public_v2.<view_name>
      WITH (security_invoker = true)
      AS
      SELECT ...;
      ```

## 3. Frontend Development (React & Refine)

The frontend should be built with a "Refine-first" approach to maximize development speed and maintainability.

- **Scaffolding**: Use the [Refine CLI](https://refine.dev/docs/packages/documentation/cli/) with the Ant Design template.
- **Component Strategy**: Prioritize official Refine and Ant Design components for UI and application logic (CRUD, auth, routing, notifications).
- **Custom Code**: Write custom components or logic ONLY when the required functionality is not available in the core libraries.
- **Supabase Integration**: Use swizzled supabase data provider 
- **Workflow Builder**: For the graph-based UI, integrate a library like `reactflow` within the Refine and Ant Design ecosystem.

## 4. Key Conventions

- **File Naming**: All files and directories **MUST** use **kebab-case**.
- **Transactional Integrity**: Wrap multi-step database operations in atomic SQL functions.
- **Logic Isolation**:
    - **Backend**: Core logic is contained within PostgreSQL functions and triggers.
    - **Frontend**: Business logic for workflow evaluation is isolated in the `/src/core` directory.
- **Database Schema**:
    - Core tables are prefixed with an underscore (e.g., `_projects`).
    - Application logic should interact with views (e.g., `projects`), not core tables directly.
- **RPC Mapping**: For complex actions, map resource names to RPC functions in [`src/providers/supabase/data-provider/index.ts:5`](src/providers/supabase/data-provider/index.ts:5) while standard CRUD operations use the default data provider behavior.
  ```typescript
  const rpcMap: Record<string, string> = {
    projects: "projects_create",
    // Add more mappings as needed
  };
  ```

## 5. Dependencies

- **Backend**: No external package dependencies. All logic is self-contained in SQL.
- **Frontend**: Key dependencies are managed by the Refine template. Refer to `package.json` for a complete list. The primary packages are `@refinedev/*`, `antd`, and `reactflow`.
